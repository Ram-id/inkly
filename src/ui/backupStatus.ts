import { syncAvailable } from '../config';
import type { SyncStatus } from '../sync/engine';
import type { Vault } from '../storage/vault';

const MONTH = 30 * 86_400_000;

export interface BackupState {
  /** journal is copied to the cloud and the last sync worked */
  cloud: boolean;
  /** time of the newest copy anywhere (cloud sync or backup file) */
  lastCopyAt: number | null;
  /** worth nudging the owner to make a copy */
  needsAttention: boolean;
}

export function backupState(vault: Vault, linked: boolean, status: SyncStatus | null): BackupState {
  const cloud = linked && status?.state !== 'error' && status?.state !== 'needs-login';
  const lastCopyAt = Math.max(cloud ? (status?.lastSyncAt ?? 0) : 0, vault.prefs.lastBackupAt ?? 0) || null;
  const hasEntries = vault.unlocked && vault.list().length > 0;
  const stale = !lastCopyAt || Date.now() - lastCopyAt > MONTH;
  return { cloud, lastCopyAt, needsAttention: hasEntries && !cloud && stale };
}

/** Where to send the owner to make a copy: cloud sync when it exists, otherwise a backup file. */
export const backupRoute = (): string => (syncAvailable() ? 'settings/sync' : 'settings/backup');
