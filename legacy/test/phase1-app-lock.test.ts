import test from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import { AppLock, VaultLockedError } from '../src/vault/app-lock.ts';
import { LocalVault } from '../src/vault/local-vault.ts';
import { KeyManager } from '../src/crypto/key-manager.ts';
import { SanitizedLogger } from '../src/vault/sanitized-logger.ts';

const TEST_VAULT_DIR = path.join(process.cwd(), 'scratch_test_app_lock');

test.beforeEach(() => {
  if (fs.existsSync(TEST_VAULT_DIR)) {
    fs.rmSync(TEST_VAULT_DIR, { recursive: true, force: true });
  }
});

test.afterEach(() => {
  if (fs.existsSync(TEST_VAULT_DIR)) {
    fs.rmSync(TEST_VAULT_DIR, { recursive: true, force: true });
  }
});

test('C1.3: App lock prevents unauthorized access and wipes in-memory key on lock', () => {
  const vaultMaterial = KeyManager.initializeNewVault();
  const appLock = new AppLock(300); // 300s timeout
  appLock.setupPin('456789');

  const vault = new LocalVault(TEST_VAULT_DIR, appLock);

  // Vault is initially locked
  assert.strictEqual(appLock.getIsLocked(), true);
  assert.throws(() => {
    vault.listEntries();
  }, VaultLockedError);

  // Unlock with wrong PIN fails
  assert.throws(() => {
    appLock.unlockWithPin('000000', vaultMaterial.vmk);
  }, /Incorrect PIN/);

  // Unlock with correct PIN succeeds
  appLock.unlockWithPin('456789', vaultMaterial.vmk);
  assert.strictEqual(appLock.getIsLocked(), false);

  // Now user can save and read entries
  vault.saveEntry({
    id: 'entry-lock-1',
    title: 'Locked App Entry',
    body: 'Testing locked vault behavior.'
  });
  assert.strictEqual(vault.listEntries().length, 1);

  // Lock vault manually
  appLock.lock();
  assert.strictEqual(appLock.getIsLocked(), true);
  assert.strictEqual(appLock.getIsPrivacyOverlayActive(), true);

  // Access is immediately blocked again
  assert.throws(() => {
    vault.listEntries();
  }, VaultLockedError);
});

test('C1.3: Auto-lock triggers after inactivity timeout', async () => {
  const vaultMaterial = KeyManager.initializeNewVault();
  // Set short 0.1s timeout for testing
  const appLock = new AppLock(0.1);
  appLock.setupPin('111222');
  appLock.unlockWithPin('111222', vaultMaterial.vmk);

  assert.strictEqual(appLock.getIsLocked(), false);

  // Sleep 150ms to exceed 100ms timeout
  await new Promise(resolve => setTimeout(resolve, 150));

  assert.strictEqual(appLock.getIsLocked(), true);
  assert.throws(() => {
    appLock.getUnlockedVmk();
  }, VaultLockedError);
});

test('C1.4: Sanitized logger redacts journal content and cryptographic keys', () => {
  const sensitiveContext = {
    title: 'Secret Meeting with Dr. Smith',
    body: 'I felt really anxious today...',
    mood: 'Sedih',
    tags: ['#therapy', '#personal'],
    vmk: new Uint8Array([1, 2, 3, 4]),
    nonSensitiveMetric: 'duration_ms_45'
  };

  const logOutput = SanitizedLogger.info('Sync event dispatched', sensitiveContext);

  // Ensure sensitive fields are replaced with [REDACTED_SENSITIVE_CONTENT] or [Binary Data]
  assert.strictEqual(logOutput.includes('Secret Meeting with Dr. Smith'), false);
  assert.strictEqual(logOutput.includes('I felt really anxious today'), false);
  assert.strictEqual(logOutput.includes('#therapy'), false);
  assert.ok(logOutput.includes('[REDACTED_SENSITIVE_CONTENT]'));
  assert.ok(logOutput.includes('duration_ms_45'));
});
