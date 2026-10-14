import {
  createVault,
  DEFAULT_KDF,
  expandVmk,
  isKeyBlob,
  revealRecoveryWords,
  rewrapWithPassword,
  rotateRecovery,
  unlockWithPassword,
  unlockWithRecovery,
  wipeKeys,
  type KdfParams,
  type KeyBlob,
  type VaultKeys
} from '../crypto/keys';
import { fromB64, fromUtf8, open, pad, seal, toB64, unpad, utf8 } from '../crypto/primitives';
import { DEFAULT_SETTINGS, type Entry, type ObjectPayload, type UserSettings } from '../domain/types';
import {
  DEFAULT_PREFS,
  getMeta,
  openInklyDb,
  setMeta,
  type Db,
  type LocalMedia,
  type LocalObject,
  type LocalPrefs
} from './db';

export const SETTINGS_ID = 'settings';
const OBJECT_PAD = 512;
const MEDIA_PAD = 16 * 1024;

const objectAad = (id: string) => `inkly/obj/v1|${id}`;
const mediaAad = (id: string) => `inkly/media/v1|${id}`;

export class VaultLockedError extends Error {
  constructor() {
    super('Jurnal sedang terkunci.');
    this.name = 'VaultLockedError';
  }
}

export interface BackupFile {
  format: 'inkly-backup';
  v: 1;
  exportedAt: string;
  keyblob: KeyBlob;
  objects: { id: string; ct: string | null; deleted: boolean }[];
  media: { id: string; ct: string }[];
}

export type MediaFetcher = (id: string) => Promise<Uint8Array | null>;

export class Vault {
  private keys: VaultKeys | null = null;
  private entries = new Map<string, Entry>();
  private settingsValue: UserSettings = { ...DEFAULT_SETTINGS };
  private listeners = new Set<() => void>();
  private photoUrls = new Map<string, string>();
  /** set by the sync layer so photos that only exist on the server can be fetched on demand */
  mediaFetcher: MediaFetcher | null = null;
  /** bumps on every change; handy as a render key */
  version = 0;

  private constructor(
    readonly db: Db,
    private blob: KeyBlob | null,
    public prefs: LocalPrefs,
    private kdf: KdfParams
  ) {}

  static async open(name = 'inkly', kdf: KdfParams = DEFAULT_KDF): Promise<Vault> {
    const db = await openInklyDb(name);
    const blob = (await getMeta(db, 'keyblob')) ?? null;
    const prefs = { ...DEFAULT_PREFS, ...((await getMeta(db, 'prefs')) ?? {}) };
    return new Vault(db, blob, prefs, kdf);
  }

  // ---------------------------------------------------------------- lifecycle

  get exists(): boolean {
    return this.blob !== null;
  }

  get unlocked(): boolean {
    return this.keys !== null;
  }

  get keyBlob(): KeyBlob | null {
    return this.blob;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    this.version++;
    for (const fn of this.listeners) fn();
  }

  private requireKeys(): VaultKeys {
    if (!this.keys) throw new VaultLockedError();
    return this.keys;
  }

  /** Creates a brand-new vault. Returns the 24 recovery words, which are shown once. */
  async create(password: string): Promise<string[]> {
    const { vmk, blob, words } = await createVault(password, this.kdf);
    await setMeta(this.db, 'keyblob', blob);
    this.blob = blob;
    await this.savePrefs({ recoveryConfirmed: false });
    await this.unlockVmk(vmk);
    return words;
  }

  async unlockPassword(password: string): Promise<void> {
    if (!this.blob) throw new Error('Belum ada jurnal di perangkat ini.');
    await this.unlockVmk(await unlockWithPassword(this.blob, password));
  }

  async unlockRecovery(words: string): Promise<void> {
    if (!this.blob) throw new Error('Belum ada jurnal di perangkat ini.');
    await this.unlockVmk(unlockWithRecovery(this.blob, words));
  }

  async unlockVmk(vmk: Uint8Array): Promise<void> {
    this.lockKeysOnly();
    this.keys = expandVmk(vmk);
    await this.loadAll();
    this.emit();
  }

  /** A copy of the VMK, for wrapping under a PIN. Caller must wipe it. */
  exportVmk(): Uint8Array {
    return new Uint8Array(this.requireKeys().vmk);
  }

  private lockKeysOnly(): void {
    wipeKeys(this.keys);
    this.keys = null;
  }

  lock(): void {
    this.lockKeysOnly();
    this.entries.clear();
    this.settingsValue = { ...DEFAULT_SETTINGS };
    for (const url of this.photoUrls.values()) URL.revokeObjectURL(url);
    this.photoUrls.clear();
    this.emit();
  }

  private async loadAll(): Promise<void> {
    this.entries.clear();
    this.settingsValue = { ...DEFAULT_SETTINGS };
    const rows = await this.db.getAll('objects');
    for (const row of rows) this.absorb(row);
  }

  /** Decrypts one stored row into the in-memory view. Unreadable rows are skipped, never fatal. */
  private absorb(row: LocalObject): void {
    if (row.deleted || !row.ct) {
      this.entries.delete(row.id);
      return;
    }
    let payload: ObjectPayload;
    try {
      payload = this.openPayload(row.id, row.ct);
    } catch {
      console.warn('Inkly: satu data tidak bisa dibuka dan dilewati.');
      return;
    }
    if (payload.type === 'entry') this.entries.set(row.id, normalizeEntry(payload.entry));
    else if (payload.type === 'settings') this.settingsValue = { ...DEFAULT_SETTINGS, ...payload.settings };
  }

  // ---------------------------------------------------------------- payload crypto

  sealPayload(id: string, payload: ObjectPayload): Uint8Array {
    return seal(this.requireKeys().data, pad(utf8(JSON.stringify(payload)), OBJECT_PAD), objectAad(id));
  }

  openPayload(id: string, ct: Uint8Array): ObjectPayload {
    return JSON.parse(fromUtf8(unpad(open(this.requireKeys().data, ct, objectAad(id)))));
  }

  sealMedia(id: string, bytes: Uint8Array): Uint8Array {
    return seal(this.requireKeys().media, pad(bytes, MEDIA_PAD), mediaAad(id));
  }

  openMedia(id: string, ct: Uint8Array): Uint8Array {
    return unpad(open(this.requireKeys().media, ct, mediaAad(id)));
  }

  // ---------------------------------------------------------------- entries

  list(): Entry[] {
    this.requireKeys();
    return [...this.entries.values()].sort((a, b) => b.date - a.date);
  }

  get(id: string): Entry | undefined {
    this.requireKeys();
    return this.entries.get(id);
  }

  get settings(): UserSettings {
    return this.settingsValue;
  }

  private async writeObject(id: string, payload: ObjectPayload | null): Promise<void> {
    const existing = await this.db.get('objects', id);
    const row: LocalObject = {
      id,
      rev: existing?.rev ?? 0,
      ct: payload ? this.sealPayload(id, payload) : null,
      deleted: payload === null,
      dirty: true
    };
    await this.db.put('objects', row);
  }

  async saveEntry(entry: Entry): Promise<Entry> {
    this.requireKeys();
    const saved = normalizeEntry({ ...entry, updatedAt: Date.now() });
    await this.writeObject(saved.id, { type: 'entry', entry: saved });
    this.entries.set(saved.id, saved);
    this.emit();
    return saved;
  }

  async deleteEntry(id: string): Promise<void> {
    this.requireKeys();
    const entry = this.entries.get(id);
    await this.writeObject(id, null);
    this.entries.delete(id);
    // A conflict copy can share photos with the original; only drop photos nobody else uses.
    const stillUsed = new Set([...this.entries.values()].flatMap((e) => e.photos.map((p) => p.id)));
    for (const p of entry?.photos ?? []) if (!stillUsed.has(p.id)) await this.deleteMedia(p.id);
    this.emit();
  }

  async saveSettings(patch: Partial<UserSettings>): Promise<void> {
    this.requireKeys();
    this.settingsValue = { ...this.settingsValue, ...patch };
    await this.writeObject(SETTINGS_ID, { type: 'settings', settings: this.settingsValue });
    this.emit();
  }

  async savePrefs(patch: Partial<LocalPrefs>): Promise<void> {
    this.prefs = { ...this.prefs, ...patch };
    await setMeta(this.db, 'prefs', this.prefs);
    this.emit();
  }

  // ---------------------------------------------------------------- photos

  async addPhoto(id: string, bytes: Uint8Array): Promise<void> {
    await this.db.put('media', { id, ct: this.sealMedia(id, bytes), dirty: true, deleted: false });
  }

  async deleteMedia(id: string): Promise<void> {
    const url = this.photoUrls.get(id);
    if (url) URL.revokeObjectURL(url);
    this.photoUrls.delete(id);
    await this.db.put('media', { id, ct: null, dirty: true, deleted: true });
  }

  async photoBytes(id: string): Promise<Uint8Array | null> {
    this.requireKeys();
    let row = await this.db.get('media', id);
    if (row?.deleted) return null;
    if (!row?.ct && this.mediaFetcher) {
      const ct = await this.mediaFetcher(id);
      if (!ct) return null;
      row = { id, ct, dirty: false, deleted: false };
      await this.db.put('media', row);
    }
    if (!row?.ct) return null;
    return this.openMedia(id, row.ct);
  }

  async photoUrl(id: string): Promise<string | null> {
    const cached = this.photoUrls.get(id);
    if (cached) return cached;
    const bytes = await this.photoBytes(id);
    if (!bytes) return null;
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'image/jpeg' }));
    this.photoUrls.set(id, url);
    return url;
  }

  // ---------------------------------------------------------------- sync support

  async dirtyObjects(): Promise<LocalObject[]> {
    return (await this.db.getAll('objects')).filter((o) => o.dirty);
  }

  async dirtyMedia(): Promise<LocalMedia[]> {
    return (await this.db.getAll('media')).filter((m) => m.dirty);
  }

  async getObject(id: string): Promise<LocalObject | undefined> {
    return this.db.get('objects', id);
  }

  /** Clears the dirty flag only if the row was not edited again while the push was in flight. */
  async markObjectSynced(pushed: LocalObject, serverRev: number): Promise<void> {
    const tx = this.db.transaction('objects', 'readwrite');
    const current = await tx.store.get(pushed.id);
    if (current) {
      const unchanged = current.deleted === pushed.deleted && bytesEqual(current.ct, pushed.ct);
      await tx.store.put({ ...current, rev: serverRev, dirty: unchanged ? false : current.dirty });
    }
    await tx.done;
  }

  async markMediaSynced(id: string): Promise<void> {
    const row = await this.db.get('media', id);
    if (!row) return;
    if (row.deleted) await this.db.delete('media', id);
    else await this.db.put('media', { ...row, dirty: false });
  }

  /** Stores a server version as-is (no conflict logic here; see SyncEngine). */
  async applyRemote(id: string, rev: number, ct: Uint8Array | null, deleted: boolean): Promise<void> {
    const row: LocalObject = { id, rev, ct, deleted, dirty: false };
    await this.db.put('objects', row);
    if (this.keys) {
      this.absorb(row);
      this.emit();
    }
  }

  async setRev(id: string, rev: number): Promise<void> {
    const row = await this.db.get('objects', id);
    if (row) await this.db.put('objects', { ...row, rev });
  }

  // ---------------------------------------------------------------- key management

  async setKeyBlob(blob: KeyBlob): Promise<void> {
    await setMeta(this.db, 'keyblob', blob);
    this.blob = blob;
  }

  async changePassword(newPassword: string): Promise<KeyBlob> {
    const keys = this.requireKeys();
    const next = await rewrapWithPassword(this.blob!, keys.vmk, newPassword, this.kdf);
    await this.setKeyBlob(next);
    return next;
  }

  recoveryWords(): string[] {
    return revealRecoveryWords(this.blob!, this.requireKeys());
  }

  async newRecoveryKey(): Promise<{ blob: KeyBlob; words: string[] }> {
    const res = rotateRecovery(this.blob!, this.requireKeys().vmk);
    await this.setKeyBlob(res.blob);
    return res;
  }

  /**
   * Moves everything in this (unlocked) vault under a different vault key — used when the
   * owner links this device to an existing account whose journal was created elsewhere.
   */
  async adoptVault(blob: KeyBlob, vmk: Uint8Array): Promise<void> {
    const oldKeys = this.requireKeys();
    const newKeys = expandVmk(new Uint8Array(vmk)); // copy: wiped below, vmk itself is kept

    const objects = await this.db.getAll('objects');
    const media = await this.db.getAll('media');
    const tx = this.db.transaction(['objects', 'media', 'meta'], 'readwrite');
    for (const o of objects) {
      if (!o.ct) {
        await tx.objectStore('objects').delete(o.id);
        continue;
      }
      const plain = open(oldKeys.data, o.ct, objectAad(o.id));
      // Local-only objects start fresh on the account (rev 0); ids are random so they do not collide.
      await tx.objectStore('objects').put({ id: o.id, rev: 0, ct: seal(newKeys.data, plain, objectAad(o.id)), deleted: false, dirty: true });
    }
    for (const m of media) {
      if (!m.ct) continue;
      const plain = open(oldKeys.media, m.ct, mediaAad(m.id));
      await tx.objectStore('media').put({ id: m.id, ct: seal(newKeys.media, plain, mediaAad(m.id)), dirty: true, deleted: false });
    }
    await tx.objectStore('meta').put(blob, 'keyblob');
    await tx.done;
    this.blob = blob;
    wipeKeys(newKeys);
    await this.unlockVmk(vmk);
  }

  // ---------------------------------------------------------------- backup

  async exportBackup(): Promise<string> {
    this.requireKeys();
    const objects = await this.db.getAll('objects');
    const media = await this.db.getAll('media');
    const file: BackupFile = {
      format: 'inkly-backup',
      v: 1,
      exportedAt: new Date().toISOString(),
      keyblob: this.blob!,
      objects: objects.filter((o) => !o.deleted).map((o) => ({ id: o.id, ct: o.ct ? toB64(o.ct) : null, deleted: false })),
      media: media.filter((m) => m.ct && !m.deleted).map((m) => ({ id: m.id, ct: toB64(m.ct!) }))
    };
    return JSON.stringify(file);
  }

  /** Plaintext export for the owner (Markdown). Only generated on explicit request. */
  exportMarkdown(): string {
    const lines: string[] = ['# Jurnal Inkly', ''];
    for (const e of this.list()) {
      const d = new Date(e.date).toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' });
      lines.push(`## ${e.title || 'Tanpa judul'}`, `*${d}*${e.mood ? ` · mood: ${e.mood}` : ''}`);
      if (e.tags.length) lines.push(e.tags.map((t) => `#${t}`).join(' '));
      lines.push('', e.body, '');
      if (e.photos.length) lines.push(`_(${e.photos.length} foto tidak disertakan)_`, '');
    }
    return lines.join('\n');
  }

  /**
   * Restores a backup. `secret` is the backup's password or its 24 recovery words.
   * - No vault on this device: the backup becomes the vault.
   * - Vault already unlocked: entries are merged (newer edit wins per entry).
   */
  async importBackup(json: string, secret: string): Promise<number> {
    const file = parseBackup(json);
    const isWords = secret.trim().split(/\s+/).length >= 12;
    const vmk = isWords ? unlockWithRecovery(file.keyblob, secret) : await unlockWithPassword(file.keyblob, secret);

    if (!this.exists) {
      const tx = this.db.transaction(['objects', 'media', 'meta'], 'readwrite');
      for (const o of file.objects) {
        await tx.objectStore('objects').put({ id: o.id, rev: 0, ct: o.ct ? fromB64(o.ct) : null, deleted: o.deleted, dirty: true });
      }
      for (const m of file.media) {
        await tx.objectStore('media').put({ id: m.id, ct: fromB64(m.ct), dirty: true, deleted: false });
      }
      await tx.objectStore('meta').put(file.keyblob, 'keyblob');
      await tx.done;
      this.blob = file.keyblob;
      await this.unlockVmk(vmk);
      return this.entries.size;
    }

    const theirs = expandVmk(vmk);
    let merged = 0;
    try {
      for (const o of file.objects) {
        if (!o.ct || o.id === SETTINGS_ID) continue;
        const payload = JSON.parse(fromUtf8(unpad(open(theirs.data, fromB64(o.ct), objectAad(o.id))))) as ObjectPayload;
        if (payload.type !== 'entry') continue;
        const mine = this.entries.get(o.id);
        if (mine && mine.updatedAt >= payload.entry.updatedAt) continue;
        for (const p of payload.entry.photos) {
          const m = file.media.find((x) => x.id === p.id);
          if (m) await this.addPhoto(p.id, unpad(open(theirs.media, fromB64(m.ct), mediaAad(p.id))));
        }
        const entry = normalizeEntry(payload.entry);
        await this.writeObject(entry.id, { type: 'entry', entry });
        this.entries.set(entry.id, entry);
        merged++;
      }
    } finally {
      wipeKeys(theirs);
    }
    this.emit();
    return merged;
  }

  /** Erases every trace of the journal from this device. */
  async destroyLocal(): Promise<void> {
    this.lock();
    const tx = this.db.transaction(['objects', 'media', 'meta'], 'readwrite');
    await Promise.all([tx.objectStore('objects').clear(), tx.objectStore('media').clear(), tx.objectStore('meta').clear()]);
    await tx.done;
    this.blob = null;
    this.prefs = { ...DEFAULT_PREFS };
    this.emit();
  }
}

export function parseBackup(json: string): BackupFile {
  let file: BackupFile;
  try {
    file = JSON.parse(json);
  } catch {
    throw new Error('File backup tidak bisa dibaca.');
  }
  if (file?.format !== 'inkly-backup' || !isKeyBlob(file.keyblob) || !Array.isArray(file.objects)) {
    throw new Error('Ini bukan file backup Inkly.');
  }
  file.media ??= [];
  return file;
}

function normalizeEntry(e: Entry): Entry {
  return {
    ...e,
    title: e.title ?? '',
    body: e.body ?? '',
    tags: e.tags ?? [],
    photos: e.photos ?? [],
    date: e.date ?? e.createdAt,
    createdAt: e.createdAt ?? e.date ?? Date.now(),
    updatedAt: e.updatedAt ?? Date.now()
  };
}

function bytesEqual(a: Uint8Array | null, b: Uint8Array | null): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

