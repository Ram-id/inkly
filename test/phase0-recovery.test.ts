import test from 'node:test';
import assert from 'node:assert';
import { KeyManager } from '../src/crypto/key-manager.ts';
import { VaultSerializer } from '../src/crypto/serializer.ts';
import { isValidMnemonic } from '../src/crypto/bip39.ts';

test('C0.3: BIP-39 24-word Recovery Key generation and checksum validation', () => {
  const vault = KeyManager.initializeNewVault();

  // Must produce exactly 24 words
  const words = vault.mnemonic.split(' ');
  assert.strictEqual(words.length, 24);
  assert.ok(isValidMnemonic(vault.mnemonic));

  // Typo or corrupted word fails checksum
  const corruptedWords = [...words];
  corruptedWords[0] = corruptedWords[0] === 'apple' ? 'abandon' : 'apple'; // change word
  assert.strictEqual(isValidMnemonic(corruptedWords.join(' ')), false);
});

test('C0.4: Cross-device recovery simulation (Device A -> Device B)', () => {
  // === DEVICE A (Original device) ===
  const deviceAVault = KeyManager.initializeNewVault();
  const deviceAVmk = deviceAVault.vmk;
  const userMnemonic = deviceAVault.mnemonic;

  // Device A creates a private journal entry
  const originalEntry = {
    title: 'Catatan Rahasia Pertama',
    body: 'Ini adalah entri yang sangat privat. Tidak boleh ada orang lain atau server yang tahu.',
    mood: 'Tenang',
    date: '2026-10-13'
  };

  const encryptedEntryContainer = VaultSerializer.encryptPayload(deviceAVmk, originalEntry);

  // Data sent to cloud: ONLY recoverySalt and wrappedVmk
  const cloudStoredState = {
    recoverySalt: deviceAVault.recoverySalt,
    wrappedVmk: deviceAVault.wrappedVmk.ciphertext,
    nonce: deviceAVault.wrappedVmk.nonce,
    macTag: deviceAVault.wrappedVmk.macTag
  };

  // Plaintext VMK and RK are NEVER sent to cloud
  assert.ok(!JSON.stringify(cloudStoredState).includes(userMnemonic));

  // === DEVICE B (New phone restored with Recovery Key) ===
  // Device B downloads cloudStoredState and prompts user for 24 words
  const deviceBRestoredVmk = KeyManager.restoreVmkFromRecoveryPhrase(
    userMnemonic,
    cloudStoredState.recoverySalt,
    cloudStoredState.wrappedVmk,
    cloudStoredState.nonce,
    cloudStoredState.macTag
  );

  // Device B's restored VMK must match Device A's VMK
  assert.deepStrictEqual(deviceBRestoredVmk, deviceAVmk);

  // Device B can now decrypt Device A's encrypted journal container!
  const decryptedOnDeviceB = VaultSerializer.decryptPayload(deviceBRestoredVmk, encryptedEntryContainer);
  assert.deepStrictEqual(decryptedOnDeviceB, originalEntry);
});

test('C0.4: Cross-device recovery failure scenarios with incorrect recovery keys', () => {
  const vault1 = KeyManager.initializeNewVault();
  const vault2 = KeyManager.initializeNewVault(); // different user's recovery words

  const cloudState = {
    recoverySalt: vault1.recoverySalt,
    wrappedVmk: vault1.wrappedVmk.ciphertext,
    nonce: vault1.wrappedVmk.nonce,
    macTag: vault1.wrappedVmk.macTag
  };

  // Attempting to restore Vault 1 using Vault 2's mnemonic fails Poly1305 authentication tag check
  assert.throws(() => {
    KeyManager.restoreVmkFromRecoveryPhrase(
      vault2.mnemonic,
      cloudState.recoverySalt,
      cloudState.wrappedVmk,
      cloudState.nonce,
      cloudState.macTag
    );
  }, /corrupted, tampered, or invalid key/);

  // Attempting to restore with tampered wrapped VMK fails
  const tamperedWrappedVmk = Buffer.from('corrupted-data').toString('base64');
  assert.throws(() => {
    KeyManager.restoreVmkFromRecoveryPhrase(
      vault1.mnemonic,
      cloudState.recoverySalt,
      tamperedWrappedVmk,
      cloudState.nonce,
      cloudState.macTag
    );
  });
});
