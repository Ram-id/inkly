import test from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import { LocalVault } from '../src/vault/local-vault.ts';
import { AppLock } from '../src/vault/app-lock.ts';
import { KeyManager } from '../src/crypto/key-manager.ts';
import { ZeroKnowledgeSyncServer } from '../src/server/sync-server.ts';
import { NetworkSniffer, ZeroKnowledgeViolationError } from '../src/sync/network-sniffer.ts';
import { SyncClient } from '../src/sync/sync-client.ts';

const TEST_DIR = path.join(process.cwd(), 'scratch_test_sync_leak');

test.beforeEach(() => {
  if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true });
});

test.afterEach(() => {
  if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true });
});

test('C3.2: Automated network sniffer proves ZERO plaintext and ZERO decryption keys are sent to backend', () => {
  const vaultMaterial = KeyManager.initializeNewVault();
  const appLock = new AppLock();
  appLock.unlockWithBiometrics(vaultMaterial.vmk);

  const vault = new LocalVault(TEST_DIR, appLock);
  const server = new ZeroKnowledgeSyncServer();
  const sniffer = new NetworkSniffer();

  // Register all private items with the sniffer
  const sensitiveTitle = 'Rahasia Terbesar Tahun 2026';
  const sensitiveBody = 'Hari ini saya memutuskan untuk mengambil langkah besar dalam karir dan kehidupan pribadi...';
  const sensitiveTag = '#confidential_life_decision';
  const sensitiveMood = 'Tenang';

  sniffer.registerSensitiveSecret(sensitiveTitle);
  sniffer.registerSensitiveSecret(sensitiveBody);
  sniffer.registerSensitiveSecret(sensitiveTag);
  sniffer.registerSensitiveSecret(vaultMaterial.mnemonic);
  sniffer.registerSensitiveSecret(vaultMaterial.vmk);
  sniffer.registerSensitiveSecret(vaultMaterial.rk);

  // User creates private entry in local vault
  vault.saveEntry({
    id: 'entry-leak-audit-1',
    title: sensitiveTitle,
    body: sensitiveBody,
    mood: sensitiveMood,
    tags: [sensitiveTag]
  });

  // Register account on server (submits recovery salt and wrapped VMK only)
  const { sessionToken } = server.registerAccount(
    'user@test-privacy.org',
    'securePasswordHash123',
    Buffer.from(vaultMaterial.recoverySalt).toString('base64'),
    vaultMaterial.wrappedVmk
  );

  const syncClient = new SyncClient(vault, server, sniffer);
  syncClient.setSessionToken(sessionToken);

  // Execute sync push through sniffer
  const pushResult = syncClient.pushOutbox();
  assert.strictEqual(pushResult.uploadedCount, 1);

  // Verify all network requests were logged and contained zero sensitive leaks
  const logs = sniffer.getTrafficLogs();
  assert.ok(logs.length > 0);

  for (const log of logs) {
    const rawTraffic = JSON.stringify(log);
    // Explicit assertions: ZERO occurrences of sensitive title, body, tag, or keys in HTTP traffic
    assert.strictEqual(rawTraffic.includes(sensitiveTitle), false, 'HTTP payload must not contain title!');
    assert.strictEqual(rawTraffic.includes(sensitiveBody), false, 'HTTP payload must not contain body!');
    assert.strictEqual(rawTraffic.includes(sensitiveTag), false, 'HTTP payload must not contain tags!');
    assert.strictEqual(rawTraffic.includes(vaultMaterial.mnemonic), false, 'HTTP payload must not contain recovery words!');
    assert.strictEqual(rawTraffic.includes(Buffer.from(vaultMaterial.vmk).toString('hex')), false, 'HTTP payload must not contain raw VMK hex!');
    assert.strictEqual(rawTraffic.includes(Buffer.from(vaultMaterial.vmk).toString('base64')), false, 'HTTP payload must not contain raw VMK base64!');
  }
});

test('C3.2: Automated sniffer detects and halts on any accidental plaintext leakage', () => {
  const sniffer = new NetworkSniffer();
  const privateSecret = 'Top Secret Diary Paragraph';
  sniffer.registerSensitiveSecret(privateSecret);

  // If a flawed sync client tries to send plaintext:
  assert.throws(() => {
    sniffer.inspectOutboundRequest(
      '/api/v1/sync/push',
      'POST',
      {},
      { unencryptedTitle: 'Normal Title', unencryptedBody: `Notes: ${privateSecret}` }
    );
  }, ZeroKnowledgeViolationError);
});
