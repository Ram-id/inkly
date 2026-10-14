import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { LocalVault } from '../src/vault/local-vault.ts';
import { AppLock } from '../src/vault/app-lock.ts';
import { KeyManager } from '../src/crypto/key-manager.ts';

const TEST_VAULT_DIR = path.join(process.cwd(), 'scratch_test_vault');

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

test('C1.1: User can create, read, search, edit, and delete journal entries offline', () => {
  const vaultMaterial = KeyManager.initializeNewVault();
  const appLock = new AppLock();
  appLock.setupPin('123456');
  appLock.unlockWithPin('123456', vaultMaterial.vmk);

  const vault = new LocalVault(TEST_VAULT_DIR, appLock);

  // 1. Create entry
  const entry1 = vault.saveEntry({
    id: 'entry-uuid-001',
    title: 'Hari yang produktif',
    body: 'Pagi ini bangun lebih awal dan langsung olahraga ringan. Setelah itu lanjut kerja.',
    mood: 'Senang',
    tags: ['#productive', '#goodday']
  });

  assert.strictEqual(entry1.title, 'Hari yang produktif');

  // 2. Read back entry
  const fetched = vault.getEntry('entry-uuid-001');
  assert.ok(fetched);
  assert.strictEqual(fetched.title, 'Hari yang produktif');
  assert.strictEqual(fetched.mood, 'Senang');

  // 3. Search entries
  const searchResults = vault.searchEntries('olahraga');
  assert.strictEqual(searchResults.length, 1);
  assert.strictEqual(searchResults[0].id, 'entry-uuid-001');

  // 4. Update entry
  vault.saveEntry({
    id: 'entry-uuid-001',
    title: 'Hari yang sangat produktif (Updated)',
    body: 'Pagi ini bangun lebih awal dan olahraga. Sore ngopi di kafe cozy.',
    mood: 'Senang',
    tags: ['#productive', '#coffee']
  });

  const updated = vault.getEntry('entry-uuid-001');
  assert.ok(updated);
  assert.strictEqual(updated.title, 'Hari yang sangat produktif (Updated)');
  assert.strictEqual(updated.tags?.includes('#coffee'), true);

  // 5. Delete entry (soft delete tombstone)
  const deleted = vault.deleteEntry('entry-uuid-001');
  assert.strictEqual(deleted, true);
  assert.strictEqual(vault.getEntry('entry-uuid-001'), null);
  assert.strictEqual(vault.listEntries().length, 0);
});

test('C1.2: Local storage inspection strictly proves NO plaintext titles, bodies, tags, or keys on disk', () => {
  const vaultMaterial = KeyManager.initializeNewVault();
  const appLock = new AppLock();
  appLock.unlockWithBiometrics(vaultMaterial.vmk);

  const vault = new LocalVault(TEST_VAULT_DIR, appLock);

  const secretTitle = 'Super Secret Diary Title 998877';
  const secretBody = 'Very private thoughts that must never be unencrypted on disk!';
  const secretTag = '#ultra_private_tag';

  vault.saveEntry({
    id: 'entry-audit-001',
    title: secretTitle,
    body: secretBody,
    mood: 'Tenang',
    tags: [secretTag]
  });

  // Read raw storage file from disk
  const rawDiskContent = vault.getRawStorageContent();
  assert.ok(rawDiskContent.length > 0);

  // Plaintext verification check: Assert ZERO occurrences of private words on disk
  assert.strictEqual(rawDiskContent.includes(secretTitle), false, 'Disk storage MUST NOT contain plaintext title!');
  assert.strictEqual(rawDiskContent.includes(secretBody), false, 'Disk storage MUST NOT contain plaintext body!');
  assert.strictEqual(rawDiskContent.includes(secretTag), false, 'Disk storage MUST NOT contain plaintext tags!');
  assert.strictEqual(rawDiskContent.includes(vaultMaterial.mnemonic), false, 'Disk storage MUST NOT contain recovery words!');

  // Verify that disk storage contains encrypted container structure
  assert.ok(rawDiskContent.includes('"magic": "INKL"'));
  assert.ok(rawDiskContent.includes('"ciphertext"'));
  assert.ok(rawDiskContent.includes('"macTag"'));
  assert.ok(rawDiskContent.includes('"wrappedObjectKey"'));
});

test('C1.5: User can export and import encrypted vault archive', () => {
  const vaultMaterial = KeyManager.initializeNewVault();
  const appLock = new AppLock();
  appLock.unlockWithBiometrics(vaultMaterial.vmk);

  const vault1 = new LocalVault(TEST_VAULT_DIR, appLock);
  vault1.saveEntry({
    id: 'entry-backup-1',
    title: 'Backup Test Entry',
    body: 'Testing export and import integrity.',
    mood: 'Senang'
  });

  const exportedArchive = vault1.exportEncryptedArchive();
  assert.ok(exportedArchive.includes('INKLY_ENCRYPTED_VAULT_BACKUP'));
  assert.strictEqual(exportedArchive.includes('Backup Test Entry'), false, 'Exported backup must remain encrypted!');

  // Import into a second vault instance
  const SECOND_DIR = path.join(process.cwd(), 'scratch_test_vault_2');
  try {
    const vault2 = new LocalVault(SECOND_DIR, appLock);
    const importedCount = vault2.importEncryptedArchive(exportedArchive);
    assert.strictEqual(importedCount, 1);

    const importedEntry = vault2.getEntry('entry-backup-1');
    assert.ok(importedEntry);
    assert.strictEqual(importedEntry.title, 'Backup Test Entry');
  } finally {
    if (fs.existsSync(SECOND_DIR)) fs.rmSync(SECOND_DIR, { recursive: true, force: true });
  }
});
