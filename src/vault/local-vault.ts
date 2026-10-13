import fs from 'node:fs';
import path from 'node:path';
import { VaultSerializer, type EncryptedContainer } from '../crypto/serializer.ts';
import { AppLock, VaultLockedError } from './app-lock.ts';
import { SanitizedLogger } from './sanitized-logger.ts';
import { generateRandomBytes, KEY_LENGTH } from '../crypto/primitives.ts';

export interface StoredCiphertextRow {
  id: string;
  revision: number;
  formatVersion: number;
  container: EncryptedContainer;
  syncStatus: 'pending_upload' | 'synced' | 'tombstone';
  isDeleted: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface JournalEntry {
  id: string;
  title: string;
  body: string;
  mood?: string;
  tags?: string[];
  createdAt: number;
  updatedAt: number;
  scrapbookLayout?: any;
  attachmentIds?: string[];
}

export class LocalVault {
  private dbFilePath: string;
  private appLock: AppLock;
  private rows: Map<string, StoredCiphertextRow> = new Map();

  constructor(dbDirectory: string, appLock: AppLock) {
    if (!fs.existsSync(dbDirectory)) {
      fs.mkdirSync(dbDirectory, { recursive: true });
    }
    this.dbFilePath = path.join(dbDirectory, 'vault_store.json');
    this.appLock = appLock;
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    if (fs.existsSync(this.dbFilePath)) {
      try {
        const raw = fs.readFileSync(this.dbFilePath, 'utf8');
        const parsed: StoredCiphertextRow[] = JSON.parse(raw);
        for (const row of parsed) {
          this.rows.set(row.id, row);
        }
        SanitizedLogger.info(`Loaded ${this.rows.size} encrypted rows from disk store.`);
      } catch (err) {
        SanitizedLogger.error('Failed to parse vault store from disk', err);
      }
    }
  }

  private persistToDisk(): void {
    const list = Array.from(this.rows.values());
    fs.writeFileSync(this.dbFilePath, JSON.stringify(list, null, 2), 'utf8');
  }

  /**
   * Returns raw database file content for security inspection
   */
  public getRawStorageContent(): string {
    if (!fs.existsSync(this.dbFilePath)) return '';
    return fs.readFileSync(this.dbFilePath, 'utf8');
  }

  /**
   * Save or update an entry
   */
  public saveEntry(entry: Omit<JournalEntry, 'createdAt' | 'updatedAt'> & { createdAt?: number }): JournalEntry {
    const vmk = this.appLock.getUnlockedVmk();
    const now = Date.now();

    const existing = this.rows.get(entry.id);
    const fullEntry: JournalEntry = {
      ...entry,
      createdAt: entry.createdAt || (existing ? existing.createdAt : now),
      updatedAt: now
    };

    // Encrypt payload using envelope encryption
    const container = VaultSerializer.encryptPayload(vmk, fullEntry);
    const newRevision = existing ? existing.revision + 1 : 1;

    const row: StoredCiphertextRow = {
      id: entry.id,
      revision: newRevision,
      formatVersion: container.version,
      container,
      syncStatus: 'pending_upload',
      isDeleted: false,
      createdAt: fullEntry.createdAt,
      updatedAt: now
    };

    this.rows.set(entry.id, row);
    this.persistToDisk();
    SanitizedLogger.info(`Persisted encrypted entry id=${entry.id} rev=${newRevision}`);
    return fullEntry;
  }

  /**
   * Get an entry by ID (decrypts with in-memory VMK)
   */
  public getEntry(id: string): JournalEntry | null {
    const vmk = this.appLock.getUnlockedVmk();
    const row = this.rows.get(id);
    if (!row || row.isDeleted) return null;

    return VaultSerializer.decryptPayload<JournalEntry>(vmk, row.container);
  }

  /**
   * List all decrypted active entries
   */
  public listEntries(): JournalEntry[] {
    const vmk = this.appLock.getUnlockedVmk();
    const result: JournalEntry[] = [];

    for (const row of this.rows.values()) {
      if (!row.isDeleted) {
        const decrypted = VaultSerializer.decryptPayload<JournalEntry>(vmk, row.container);
        result.push(decrypted);
      }
    }

    return result.sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Search entries locally across title, body, and tags
   */
  public searchEntries(query: string): JournalEntry[] {
    const all = this.listEntries();
    const q = query.toLowerCase();
    return all.filter(entry => 
      entry.title.toLowerCase().includes(q) ||
      entry.body.toLowerCase().includes(q) ||
      (entry.tags && entry.tags.some(t => t.toLowerCase().includes(q)))
    );
  }

  /**
   * Mark an entry as deleted (creates tombstone for sync)
   */
  public deleteEntry(id: string): boolean {
    this.appLock.getUnlockedVmk(); // ensure unlocked
    const row = this.rows.get(id);
    if (!row) return false;

    row.isDeleted = true;
    row.syncStatus = 'tombstone';
    row.updatedAt = Date.now();
    row.revision += 1;
    this.persistToDisk();
    return true;
  }

  /**
   * Exports an encrypted archive of the entire vault
   */
  public exportEncryptedArchive(): string {
    this.appLock.getUnlockedVmk();
    const activeRows = Array.from(this.rows.values()).filter(r => !r.isDeleted);
    return JSON.stringify({
      format: 'INKLY_ENCRYPTED_VAULT_BACKUP',
      exportedAt: new Date().toISOString(),
      rows: activeRows
    }, null, 2);
  }

  /**
   * Imports an encrypted vault backup
   */
  public importEncryptedArchive(backupJson: string): number {
    const vmk = this.appLock.getUnlockedVmk();
    const parsed = JSON.parse(backupJson);
    if (parsed.format !== 'INKLY_ENCRYPTED_VAULT_BACKUP') {
      throw new Error('Invalid backup archive format.');
    }

    let count = 0;
    for (const row of parsed.rows as StoredCiphertextRow[]) {
      // Test decryption to ensure key matches
      VaultSerializer.decryptPayload(vmk, row.container);
      this.rows.set(row.id, {
        ...row,
        syncStatus: 'pending_upload'
      });
      count++;
    }

    this.persistToDisk();
    return count;
  }

  /**
   * Returns items pending upload for the sync engine
   */
  public getPendingSyncRows(): StoredCiphertextRow[] {
    return Array.from(this.rows.values()).filter(r => r.syncStatus === 'pending_upload' || r.syncStatus === 'tombstone');
  }

  /**
   * Marks row as synced after server acknowledgement
   */
  public markRowSynced(id: string, revision: number): void {
    const row = this.rows.get(id);
    if (row && row.revision === revision) {
      row.syncStatus = 'synced';
      this.persistToDisk();
    }
  }
}
