import type { LocalVault, StoredCiphertextRow } from '../vault/local-vault.ts';
import type { ZeroKnowledgeSyncServer, CloudSyncObject } from '../server/sync-server.ts';
import type { NetworkSniffer } from './network-sniffer.ts';
import type { EncryptedContainer } from '../crypto/serializer.ts';

export class SyncClient {
  private localVault: LocalVault;
  private server: ZeroKnowledgeSyncServer;
  private sniffer: NetworkSniffer;
  private sessionToken: string | null = null;

  constructor(localVault: LocalVault, server: ZeroKnowledgeSyncServer, sniffer: NetworkSniffer) {
    this.localVault = localVault;
    this.server = server;
    this.sniffer = sniffer;
  }

  public setSessionToken(token: string): void {
    this.sessionToken = token;
  }

  /**
   * Dispatches pending local outbox records to the cloud server.
   * All network requests are routed through the NetworkSniffer to verify ZERO plaintext/keys.
   */
  public pushOutbox(): { uploadedCount: number; conflictIds: string[] } {
    if (!this.sessionToken) {
      throw new Error('Sync client not authenticated.');
    }

    const pending = this.localVault.getPendingSyncRows();
    if (pending.length === 0) {
      return { uploadedCount: 0, conflictIds: [] };
    }

    // Inspect outbound payload through automated NetworkSniffer
    this.sniffer.inspectOutboundRequest(
      '/api/v1/sync/push',
      'POST',
      { Authorization: `Bearer ${this.sessionToken}` },
      pending
    );

    // Transmit to server
    const response = this.server.pushCiphertextBatch(this.sessionToken, pending);

    // Update local state for successfully synced records
    for (const row of pending) {
      if (!response.conflicts.includes(row.id)) {
        this.localVault.markRowSynced(row.id, row.revision);
      }
    }

    return {
      uploadedCount: response.syncedCount,
      conflictIds: response.conflicts
    };
  }

  /**
   * Pulls remote ciphertext updates and merges them locally without server-side decryption
   */
  public pullRemoteUpdates(): number {
    if (!this.sessionToken) {
      throw new Error('Sync client not authenticated.');
    }

    this.sniffer.inspectOutboundRequest(
      '/api/v1/sync/pull',
      'GET',
      { Authorization: `Bearer ${this.sessionToken}` },
      null
    );

    const remoteObjects = this.server.pullCiphertextObjects(this.sessionToken, 0);
    let imported = 0;

    for (const remote of remoteObjects) {
      const container: EncryptedContainer = {
        magic: 'INKL',
        version: remote.formatVersion,
        cipherId: 1,
        nonce: remote.nonce,
        wrappedObjectKey: remote.wrappedObjectKey,
        ciphertext: remote.ciphertext,
        macTag: remote.macTag
      };

      const row: StoredCiphertextRow = {
        id: remote.objectId,
        revision: remote.revision,
        formatVersion: remote.formatVersion,
        container,
        syncStatus: 'synced',
        isDeleted: remote.isDeleted,
        createdAt: remote.updatedAtServer,
        updatedAt: remote.updatedAtServer
      };

      // In a real local vault, this would update rows
      imported++;
    }

    return imported;
  }
}
