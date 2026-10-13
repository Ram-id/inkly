import type { ZeroKnowledgeSyncServer } from './sync-server.ts';

export interface AdminOperationalMetrics {
  serverStatus: 'HEALTHY' | 'DEGRADED';
  totalRegisteredAccounts: number;
  totalEncryptedSyncObjects: number;
  totalCiphertextBytesStored: number;
  uptimeSeconds: number;
  zeroKnowledgeAuditPass: boolean;
  canAdminReadJournals: false; // Architecturally guaranteed false
}

export class AdminDashboard {
  private server: ZeroKnowledgeSyncServer;
  private startedAt: number;

  constructor(server: ZeroKnowledgeSyncServer) {
    this.server = server;
    this.startedAt = Date.now();
  }

  /**
   * Returns high-level operational telemetry ONLY.
   * STRICT PROHIBITION: There is NO endpoint or method to read or decrypt user journals!
   */
  public getOperationalMetrics(): AdminOperationalMetrics {
    const audit = this.server.auditVerifyCloudStorageZeroKnowledge();

    return {
      serverStatus: 'HEALTHY',
      totalRegisteredAccounts: 1, // Simulated active
      totalEncryptedSyncObjects: audit.totalRecords,
      totalCiphertextBytesStored: audit.totalRecords * 512, // approx byte size
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      zeroKnowledgeAuditPass: !audit.hasPlaintext,
      canAdminReadJournals: false
    };
  }

  /**
   * Explicitly throws an error if any administrative user attempts to request user journal contents.
   */
  public requestUserJournalContents(): never {
    throw new Error(
      '[CRITICAL SECURITY EXCEPTION] Zero-Knowledge Architectural Mandate: Administrators and developers possess NO capability, endpoint, or keys to view user journal content.'
    );
  }
}
