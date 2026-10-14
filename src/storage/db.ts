import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { KeyBlob } from '../crypto/keys';

/**
 * On-device storage (IndexedDB). Only ciphertext and non-sensitive preferences live here:
 * no titles, bodies, moods, tags, photos or keys are ever written in plaintext.
 */

export interface LocalObject {
  id: string;
  /** last revision confirmed by the server (0 = never synced) */
  rev: number;
  ct: Uint8Array | null;
  deleted: boolean;
  dirty: boolean;
}

export interface LocalMedia {
  id: string;
  /** null when the photo exists on the server but was not downloaded to this device yet */
  ct: Uint8Array | null;
  dirty: boolean;
  deleted: boolean;
}

export interface PinRecord {
  salt: string;
  /** VMK sealed with the PIN-derived key, then encrypted again with a non-extractable device key */
  wrapped: Uint8Array;
  iv: Uint8Array;
  deviceKey: CryptoKey | null;
  attemptsLeft: number;
}

export interface SyncMeta {
  userId: string;
  email: string;
  cursor: number;
  lastSyncAt: number | null;
  keyblobDirty: boolean;
}

export interface LocalPrefs {
  autoLockMinutes: number;
  theme: 'system' | 'light' | 'dark';
  /** false until the owner has confirmed they wrote down the 24 recovery words */
  recoveryConfirmed: boolean;
  /** when a backup file was last downloaded on this device */
  lastBackupAt?: number;
}

export const DEFAULT_PREFS: LocalPrefs = { autoLockMinutes: 1, theme: 'system', recoveryConfirmed: true };

interface MetaValues {
  keyblob: KeyBlob;
  pin: PinRecord;
  sync: SyncMeta;
  prefs: LocalPrefs;
}

interface InklyDB extends DBSchema {
  meta: { key: keyof MetaValues; value: MetaValues[keyof MetaValues] };
  objects: { key: string; value: LocalObject };
  media: { key: string; value: LocalMedia };
}

export type Db = IDBPDatabase<InklyDB>;

export async function openInklyDb(name = 'inkly'): Promise<Db> {
  return openDB<InklyDB>(name, 1, {
    upgrade(db) {
      db.createObjectStore('meta');
      db.createObjectStore('objects', { keyPath: 'id' });
      db.createObjectStore('media', { keyPath: 'id' });
    }
  });
}

export async function getMeta<K extends keyof MetaValues>(db: Db, key: K): Promise<MetaValues[K] | undefined> {
  return (await db.get('meta', key)) as MetaValues[K] | undefined;
}

export async function setMeta<K extends keyof MetaValues>(db: Db, key: K, value: MetaValues[K]): Promise<void> {
  await db.put('meta', value, key);
}

export async function deleteMeta(db: Db, key: keyof MetaValues): Promise<void> {
  await db.delete('meta', key);
}
