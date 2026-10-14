import { useEffect, useState } from 'preact/hooks';
import { syncAvailable } from '../config';
import type { Vault } from '../storage/vault';
import { Account, SupabaseAuth } from '../sync/account';
import { SyncEngine, type SyncStatus } from '../sync/engine';

/** App-wide singletons. Created once at boot; screens read them through the hooks below. */
class Services {
  vault!: Vault;
  account: Account | null = null;
  engine: SyncEngine | null = null;
  private syncListeners = new Set<() => void>();
  private autoTimer: ReturnType<typeof setTimeout> | null = null;

  init(vault: Vault): void {
    this.vault = vault;
    if (syncAvailable()) this.account = new Account(vault, new SupabaseAuth());
    vault.subscribe(() => this.scheduleSync());
  }

  /** Builds (or drops) the sync engine to match whether this device is linked. */
  async refreshSync(): Promise<void> {
    const remote = this.account && this.vault.unlocked ? await this.account.remote() : null;
    if (!remote) {
      this.engine = null;
      this.vault.mediaFetcher = null;
    } else if (!this.engine) {
      this.engine = new SyncEngine(this.vault, remote);
      this.engine.subscribe(() => this.notify());
    }
    this.notify();
  }

  private notify(): void {
    for (const fn of this.syncListeners) fn();
  }

  onSyncChange(fn: () => void): () => void {
    this.syncListeners.add(fn);
    return () => this.syncListeners.delete(fn);
  }

  syncNow(): Promise<void> {
    return this.engine?.sync() ?? Promise.resolve();
  }

  /** Debounced sync after local edits. */
  scheduleSync(delay = 2500): void {
    if (!this.engine || !this.vault.unlocked) return;
    if (this.autoTimer) clearTimeout(this.autoTimer);
    this.autoTimer = setTimeout(() => void this.syncNow(), delay);
  }
}

export const services = new Services();

export function useVault(): Vault {
  const [, setV] = useState(0);
  useEffect(() => services.vault.subscribe(() => setV((n) => n + 1)), []);
  return services.vault;
}

export function useSync(): { status: SyncStatus | null; linked: boolean } {
  const [, setV] = useState(0);
  useEffect(() => services.onSyncChange(() => setV((n) => n + 1)), []);
  return { status: services.engine?.status ?? null, linked: !!services.engine };
}
