import { fromB64, toB64 } from '../crypto/primitives';
import { getMeta, setMeta, type LocalObject, type SyncMeta } from '../storage/db';
import { SETTINGS_ID, type Vault } from '../storage/vault';
import type { Entry } from '../domain/types';
import { newId } from '../domain/types';
import { AuthExpiredError, type Remote, type RemoteObject } from './remote';

export type SyncState = 'off' | 'idle' | 'syncing' | 'error' | 'offline' | 'needs-login';

export interface SyncStatus {
  state: SyncState;
  lastSyncAt: number | null;
  message?: string;
  conflicts: number;
}

const PULL_PAGE = 200;
const PUSH_BATCH = 50;

/**
 * Two-way sync of opaque ciphertext.
 *
 * Every object carries a server revision. A push says "replace revision N"; the server refuses
 * if the stored revision is no longer N (compare-and-swap), so two devices can never silently
 * overwrite each other. When that happens the client pulls the newer version and, if the
 * content really differs, keeps *both*: the server version stays in place and this device's
 * version is saved as a separate copy.
 */
export class SyncEngine {
  status: SyncStatus = { state: 'idle', lastSyncAt: null, conflicts: 0 };
  private listeners = new Set<(s: SyncStatus) => void>();
  private running: Promise<void> | null = null;
  private again = false;

  constructor(
    private vault: Vault,
    private remote: Remote
  ) {
    vault.mediaFetcher = (id) => this.remote.getMedia(id);
  }

  subscribe(fn: (s: SyncStatus) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private setStatus(patch: Partial<SyncStatus>): void {
    this.status = { ...this.status, ...patch };
    for (const fn of this.listeners) fn(this.status);
  }

  /** Runs a sync; concurrent calls are coalesced into one follow-up run. */
  sync(): Promise<void> {
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = (async () => {
      do {
        this.again = false;
        await this.runOnce();
      } while (this.again);
    })().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async runOnce(): Promise<void> {
    if (!this.vault.unlocked) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this.setStatus({ state: 'offline' });
      return;
    }
    this.setStatus({ state: 'syncing', message: undefined });
    try {
      const meta = await getMeta(this.vault.db, 'sync');
      if (!meta) throw new Error('Sinkronisasi belum diaktifkan.');
      await this.syncKeyBlob(meta);
      await this.pullAll(meta);
      await this.pushMedia();
      for (let round = 0; round < 3; round++) {
        const conflicts = await this.pushObjects();
        if (!conflicts) break;
        await this.pullAll(meta);
      }
      meta.lastSyncAt = Date.now();
      await setMeta(this.vault.db, 'sync', meta);
      this.setStatus({ state: 'idle', lastSyncAt: meta.lastSyncAt });
    } catch (e) {
      if (e instanceof AuthExpiredError) this.setStatus({ state: 'needs-login', message: e.message });
      else this.setStatus({ state: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  }

  private async syncKeyBlob(meta: SyncMeta): Promise<void> {
    const local = this.vault.keyBlob!;
    if (meta.keyblobDirty) {
      await this.remote.putKeyBlob(local);
      meta.keyblobDirty = false;
      await setMeta(this.vault.db, 'sync', meta);
      return;
    }
    // Password or recovery key changed on another device: take the newer wrapper.
    const remote = await this.remote.getKeyBlob();
    if (remote && (remote.byPassword !== local.byPassword || remote.byRecovery !== local.byRecovery)) {
      await this.vault.setKeyBlob(remote);
    }
  }

  private async pullAll(meta: SyncMeta): Promise<void> {
    for (;;) {
      const page = await this.remote.pull(meta.cursor, PULL_PAGE);
      for (const r of page) {
        await this.handleRemote(r);
        meta.cursor = Math.max(meta.cursor, r.seq);
      }
      await setMeta(this.vault.db, 'sync', meta);
      if (page.length < PULL_PAGE) return;
    }
  }

  private async handleRemote(r: RemoteObject): Promise<void> {
    const ct = r.ct ? fromB64(r.ct) : null;
    const local = await this.vault.getObject(r.id);
    if (!local || !local.dirty) {
      if (!local || r.rev > local.rev) await this.vault.applyRemote(r.id, r.rev, ct, r.deleted);
      return;
    }
    if (r.rev <= local.rev) return; // our own write echoed back

    // Both sides changed since the last common revision.
    await this.resolveConflict(local, r, ct);
  }

  private async resolveConflict(local: LocalObject, r: RemoteObject, remoteCt: Uint8Array | null): Promise<void> {
    if (r.id === SETTINGS_ID || local.deleted) {
      // Settings: server wins. Local delete vs remote edit: the edit wins, nothing is lost.
      await this.vault.applyRemote(r.id, r.rev, remoteCt, r.deleted);
      return;
    }
    const mine = this.vault.get(r.id);
    if (r.deleted || !remoteCt) {
      // Deleted elsewhere but edited here: keep the edit, it will be re-uploaded on top.
      await this.vault.setRev(r.id, r.rev);
      return;
    }
    const theirs = this.vault.openPayload(r.id, remoteCt);
    if (mine && theirs.type === 'entry' && !sameContent(mine, theirs.entry)) {
      const copy: Entry = {
        ...mine,
        id: newId(),
        title: `${mine.title || 'Tanpa judul'} (salinan dari perangkat ini)`
      };
      await this.vault.saveEntry(copy);
      this.setStatus({ conflicts: this.status.conflicts + 1 });
    }
    await this.vault.applyRemote(r.id, r.rev, remoteCt, false);
  }

  private async pushMedia(): Promise<void> {
    const dirty = await this.vault.dirtyMedia();
    const gone = dirty.filter((m) => m.deleted).map((m) => m.id);
    if (gone.length) {
      await this.remote.deleteMedia(gone);
      for (const id of gone) await this.vault.markMediaSynced(id);
    }
    for (const m of dirty) {
      if (m.deleted || !m.ct) continue;
      await this.remote.putMedia(m.id, m.ct);
      await this.vault.markMediaSynced(m.id);
    }
  }

  /** Returns the number of conflicts the server reported. */
  private async pushObjects(): Promise<number> {
    const dirty = await this.vault.dirtyObjects();
    let conflicts = 0;
    for (let i = 0; i < dirty.length; i += PUSH_BATCH) {
      const batch = dirty.slice(i, i + PUSH_BATCH);
      const results = await this.remote.push(
        batch.map((o) => ({ id: o.id, base_rev: o.rev, ct: o.ct ? toB64(o.ct) : null, deleted: o.deleted }))
      );
      for (const res of results) {
        const pushed = batch.find((o) => o.id === res.id)!;
        if (res.ok) await this.vault.markObjectSynced(pushed, res.rev);
        else conflicts++;
      }
    }
    return conflicts;
  }
}

function sameContent(a: Entry, b: Entry): boolean {
  return (
    a.title === b.title &&
    a.body === b.body &&
    a.mood === b.mood &&
    a.date === b.date &&
    a.tags.join('|') === b.tags.join('|') &&
    a.photos.map((p) => p.id).join('|') === b.photos.map((p) => p.id).join('|') &&
    JSON.stringify(a.scrapbook ?? null) === JSON.stringify(b.scrapbook ?? null)
  );
}
