import test from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import { LocalVault } from '../src/vault/local-vault.ts';
import { AppLock } from '../src/vault/app-lock.ts';
import { KeyManager } from '../src/crypto/key-manager.ts';
import { ZeroKnowledgeSyncServer } from '../src/server/sync-server.ts';
import { NetworkSniffer } from '../src/sync/network-sniffer.ts';
import { SyncClient } from '../src/sync/sync-client.ts';
import { AdminDashboard } from '../src/server/admin-dashboard.ts';
import { VaultSerializer } from '../src/crypto/serializer.ts';

const DIR_DEV_A = path.join(process.cwd(), 'scratch_test_sync_device_a');
const DIR_DEV_B = path.join(process.cwd(), 'scratch_test_sync_device_b');

test.beforeEach(() => {
  if (fs.existsSync(DIR_DEV_A)) fs.rmSync(DIR_DEV_A, { recursive: true, force: true });
  if (fs.existsSync(DIR_DEV_B)) fs.rmSync(DIR_DEV_B, { recursive: true, force: true });
});

test.afterEach(() => {
  if (fs.existsSync(DIR_DEV_A)) fs.rmSync(DIR_DEV_A, { recursive: true, force: true });
  if (fs.existsSync(DIR_DEV_B)) fs.rmSync(DIR_DEV_B, { recursive: true, force: true });
});

test('C3.1, C3.3, C3.4, C3.5: End-to-end multi-device sync, recovery, conflicts, and admin isolation', () => {
  const server = new ZeroKnowledgeSyncServer();
  const sniffer = new NetworkSniffer();

  // ==========================================
  // 1. DEVICE A: Onboarding & Journal Creation
  // ==========================================
  const vaultMaterialA = KeyManager.initializeNewVault();
  const lockA = new AppLock();
  lockA.unlockWithBiometrics(vaultMaterialA.vmk);
  const vaultA = new LocalVault(DIR_DEV_A, lockA);

  const { sessionToken: tokenA, userId } = server.registerAccount(
    'alice@example.com',
    'passwordHashA',
    Buffer.from(vaultMaterialA.recoverySalt).toString('base64'),
    vaultMaterialA.wrappedVmk
  );

  // Alice writes 2 journal entries on Device A
  vaultA.saveEntry({
    id: 'entry-001',
    title: 'Hari Pertama di Jogja',
    body: 'Makan gudeg yu djum, rasanya manis gurih!',
    mood: 'Senang'
  });
  vaultA.saveEntry({
    id: 'entry-002',
    title: 'Sunset di Parangtritis',
    body: 'Pemandangan pantai yang sangat damai.',
    mood: 'Tenang'
  });

  const clientA = new SyncClient(vaultA, server, sniffer);
  clientA.setSessionToken(tokenA);
  const pushA = clientA.pushOutbox();
  assert.strictEqual(pushA.uploadedCount, 2);

  // ==========================================
  // 2. SERVER & ADMIN AUDIT CHECK (C3.1 & C3.5)
  // ==========================================
  const audit = server.auditVerifyCloudStorageZeroKnowledge();
  assert.strictEqual(audit.hasPlaintext, false, 'Server DB must contain ZERO plaintext fields!');
  assert.strictEqual(audit.totalRecords, 2);

  const adminDashboard = new AdminDashboard(server);
  const metrics = adminDashboard.getOperationalMetrics();
  assert.strictEqual(metrics.canAdminReadJournals, false);
  assert.strictEqual(metrics.zeroKnowledgeAuditPass, true);

  // Admin attempting to read journal contents is strictly blocked by security exception
  assert.throws(() => {
    adminDashboard.requestUserJournalContents();
  }, /Zero-Knowledge Architectural Mandate/);

  // ==========================================
  // 3. DEVICE B: Cross-Device Restore via Recovery Key (C3.3)
  // ==========================================
  // Alice gets a new phone (Device B) and logs in
  const { sessionToken: tokenB } = server.login('alice@example.com', 'passwordHashA');
  const recoveryBlob = server.getRecoveryBlob(userId);

  // Alice inputs her 24-word recovery phrase on Device B
  const restoredVmkB = KeyManager.restoreVmkFromRecoveryPhrase(
    vaultMaterialA.mnemonic,
    new Uint8Array(Buffer.from(recoveryBlob.recoverySalt, 'base64')),
    recoveryBlob.wrappedVmk.ciphertext,
    recoveryBlob.wrappedVmk.nonce,
    recoveryBlob.wrappedVmk.macTag
  );

  // Restored VMK on Device B matches Device A's VMK!
  assert.deepStrictEqual(restoredVmkB, vaultMaterialA.vmk);

  // Device B pulls cloud ciphertext objects
  const remoteObjects = server.pullCiphertextObjects(tokenB, 0);
  assert.strictEqual(remoteObjects.length, 2);

  // Device B decrypts both entries using its restored VMK
  const lockB = new AppLock();
  lockB.unlockWithBiometrics(restoredVmkB);
  const vaultB = new LocalVault(DIR_DEV_B, lockB);

  for (const obj of remoteObjects) {
    const container = {
      magic: 'INKL',
      version: obj.formatVersion,
      cipherId: 1,
      nonce: obj.nonce,
      wrappedObjectKey: obj.wrappedObjectKey,
      ciphertext: obj.ciphertext,
      macTag: obj.macTag
    };
    const decryptedEntry = VaultSerializer.decryptPayload(restoredVmkB, container);
    vaultB.saveEntry(decryptedEntry);
  }

  const entriesOnDeviceB = vaultB.listEntries();
  assert.strictEqual(entriesOnDeviceB.length, 2);
  assert.ok(entriesOnDeviceB.some(e => e.title === 'Hari Pertama di Jogja'));
  assert.ok(entriesOnDeviceB.some(e => e.title === 'Sunset di Parangtritis'));

  // ==========================================
  // 4. CONFLICT HANDLING (C3.4)
  // ==========================================
  // Stale revision push is rejected by optimistic concurrency control
  const staleRow = {
    id: 'entry-001',
    revision: 1, // Already revision 1 on server
    formatVersion: 1,
    container: VaultSerializer.encryptPayload(vaultMaterialA.vmk, { title: 'Old Stale Edit', body: 'Stale' }),
    syncStatus: 'pending_upload' as const,
    isDeleted: false,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  // Push revision 2 first
  const newRow = { ...staleRow, revision: 2 };
  server.pushCiphertextBatch(tokenA, [newRow]);

  // Attempting to push revision 1 now results in a conflict!
  const conflictResult = server.pushCiphertextBatch(tokenA, [staleRow]);
  assert.strictEqual(conflictResult.conflicts.includes('entry-001'), true);

  // ==========================================
  // 5. DATA ERASURE (C5.2)
  // ==========================================
  const purged = server.purgeUserData(tokenA);
  assert.strictEqual(purged, true);
  assert.strictEqual(server.pullCiphertextObjects(tokenB, 0).length, 0);
});
