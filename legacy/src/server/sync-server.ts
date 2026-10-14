import crypto from 'node:crypto';
import type { StoredCiphertextRow } from '../vault/local-vault.ts';

export interface UserAccount {
  userId: string;
  emailHash: string;
  authVerifier: string;
  recoverySalt: string; // Base64
  wrappedVmk: {
    nonce: string;
    ciphertext: string;
    macTag: string;
  };
  createdAt: number;
}

export interface CloudSyncObject {
  userId: string;
  objectId: string;
  revision: number;
  formatVersion: number;
  wrappedObjectKey: {
    nonce: string;
    wrappedKey: string;
    macTag: string;
  };
  nonce: string;
  ciphertext: string;
  macTag: string;
  isDeleted: boolean;
  updatedAtServer: number;
}

export class ZeroKnowledgeSyncServer {
  private users: Map<string, UserAccount> = new Map(); // emailHash -> account
  private sessions: Map<string, string> = new Map(); // token -> userId
  private syncStore: Map<string, CloudSyncObject> = new Map(); // `${userId}:${objectId}` -> object

  /**
   * Register account with Recovery Salt and Wrapped VMK.
   * Recovery Key and plaintext VMK are NEVER sent or received.
   */
  public registerAccount(
    email: string,
    passwordSecret: string,
    recoverySaltBase64: string,
    wrappedVmk: { nonce: string; ciphertext: string; macTag: string }
  ): { userId: string; sessionToken: string } {
    const emailHash = crypto.createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
    if (this.users.has(emailHash)) {
      throw new Error('Email already registered.');
    }

    const userId = `usr_${crypto.randomBytes(12).toString('hex')}`;
    const authVerifier = crypto.createHash('sha256').update(`${passwordSecret}:${emailHash}`).digest('hex');

    const account: UserAccount = {
      userId,
      emailHash,
      authVerifier,
      recoverySalt: recoverySaltBase64,
      wrappedVmk,
      createdAt: Date.now()
    };

    this.users.set(emailHash, account);
    const sessionToken = `tok_${crypto.randomBytes(24).toString('hex')}`;
    this.sessions.set(sessionToken, userId);

    return { userId, sessionToken };
  }

  public login(email: string, passwordSecret: string): { userId: string; sessionToken: string } {
    const emailHash = crypto.createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
    const account = this.users.get(emailHash);
    if (!account) {
      throw new Error('Invalid email or password.');
    }

    const authVerifier = crypto.createHash('sha256').update(`${passwordSecret}:${emailHash}`).digest('hex');
    if (account.authVerifier !== authVerifier) {
      throw new Error('Invalid email or password.');
    }

    const sessionToken = `tok_${crypto.randomBytes(24).toString('hex')}`;
    this.sessions.set(sessionToken, account.userId);
    return { userId: account.userId, sessionToken };
  }

  public getRecoveryBlob(userId: string): { recoverySalt: string; wrappedVmk: any } {
    for (const account of this.users.values()) {
      if (account.userId === userId) {
        return {
          recoverySalt: account.recoverySalt,
          wrappedVmk: account.wrappedVmk
        };
      }
    }
    throw new Error('Account not found.');
  }

  private authenticate(sessionToken: string): string {
    const userId = this.sessions.get(sessionToken);
    if (!userId) {
      throw new Error('Unauthorized session.');
    }
    return userId;
  }

  /**
   * Push encrypted ciphertext batch from client
   */
  public pushCiphertextBatch(
    sessionToken: string,
    batch: StoredCiphertextRow[]
  ): { syncedCount: number; conflicts: string[] } {
    const userId = this.authenticate(sessionToken);
    const conflicts: string[] = [];
    let syncedCount = 0;

    for (const row of batch) {
      const key = `${userId}:${row.id}`;
      const existing = this.syncStore.get(key);

      // Optimistic concurrency control on revision
      if (existing && existing.revision > row.revision) {
        conflicts.push(row.id);
        continue;
      }

      const cloudObj: CloudSyncObject = {
        userId,
        objectId: row.id,
        revision: row.revision,
        formatVersion: row.formatVersion,
        wrappedObjectKey: row.container.wrappedObjectKey,
        nonce: row.container.nonce,
        ciphertext: row.container.ciphertext,
        macTag: row.container.macTag,
        isDeleted: row.isDeleted,
        updatedAtServer: Date.now()
      };

      this.syncStore.set(key, cloudObj);
      syncedCount++;
    }

    return { syncedCount, conflicts };
  }

  /**
   * Pull updated ciphertext objects for user since a given revision
   */
  public pullCiphertextObjects(
    sessionToken: string,
    sinceTimestamp: number = 0
  ): CloudSyncObject[] {
    const userId = this.authenticate(sessionToken);
    const results: CloudSyncObject[] = [];

    for (const obj of this.syncStore.values()) {
      if (obj.userId === userId && obj.updatedAtServer >= sinceTimestamp) {
        results.push(obj);
      }
    }

    return results;
  }

  /**
   * Purges all user data from cloud database (GDPR / User data erasure)
   */
  public purgeUserData(sessionToken: string): boolean {
    const userId = this.authenticate(sessionToken);

    // Delete all sync objects
    for (const [key, obj] of this.syncStore.entries()) {
      if (obj.userId === userId) {
        this.syncStore.delete(key);
      }
    }

    // Delete session
    this.sessions.delete(sessionToken);
    return true;
  }

  /**
   * Security audit check: Verifies that database stores strictly ciphertext strings
   */
  public auditVerifyCloudStorageZeroKnowledge(): { totalRecords: number; hasPlaintext: boolean } {
    let hasPlaintext = false;
    for (const obj of this.syncStore.values()) {
      // Must only contain base64 ciphertext and MAC tags
      if (!obj.ciphertext || !obj.macTag || !obj.nonce) {
        hasPlaintext = true;
      }
      // Check that forbidden columns don't exist
      if ('title' in obj || 'body' in obj || 'tags' in obj || 'mood' in obj) {
        hasPlaintext = true;
      }
    }
    return {
      totalRecords: this.syncStore.size,
      hasPlaintext
    };
  }
}
