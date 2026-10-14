import test from 'node:test';
import assert from 'node:assert';
import {
  generateRandomBytes,
  deriveKeyHkdf,
  encryptAead,
  decryptAead,
  timingSafeEqual,
  zeroize,
  KEY_LENGTH,
  NONCE_LENGTH,
  TAG_LENGTH
} from '../src/crypto/primitives.ts';
import { VaultSerializer } from '../src/crypto/serializer.ts';

test('C0.1: Round-trip AEAD encryption and decryption with ChaCha20-Poly1305', () => {
  const key = generateRandomBytes(KEY_LENGTH);
  const nonce = generateRandomBytes(NONCE_LENGTH);
  const plaintext = new TextEncoder().encode('Hari yang produktif! Hari ini akhirnya bisa menyelesaikan semua tugas yang tertunda. 🌟✨');
  const aad = new TextEncoder().encode('Inkly-AAD-Test');

  const { ciphertext, tag } = encryptAead(key, nonce, plaintext, aad);

  assert.strictEqual(ciphertext.length, plaintext.length);
  assert.strictEqual(tag.length, TAG_LENGTH);

  const decrypted = decryptAead(key, nonce, ciphertext, tag, aad);
  assert.deepStrictEqual(decrypted, plaintext);
  assert.strictEqual(new TextDecoder().decode(decrypted), new TextDecoder().decode(plaintext));
});

test('C0.2: Authenticated Decryption detects bit tampering in ciphertext, tag, and AAD', () => {
  const key = generateRandomBytes(KEY_LENGTH);
  const nonce = generateRandomBytes(NONCE_LENGTH);
  const plaintext = new TextEncoder().encode('Secret Diary Content');
  const aad = new TextEncoder().encode('Metadata-2026-10-13');

  const { ciphertext, tag } = encryptAead(key, nonce, plaintext, aad);

  // 1. Bit flip in ciphertext
  const tamperedCiphertext = new Uint8Array(ciphertext);
  tamperedCiphertext[0] ^= 0x01; // flip single bit
  assert.throws(() => {
    decryptAead(key, nonce, tamperedCiphertext, tag, aad);
  }, /corrupted, tampered, or invalid key/);

  // 2. Bit flip in tag
  const tamperedTag = new Uint8Array(tag);
  tamperedTag[0] ^= 0x01;
  assert.throws(() => {
    decryptAead(key, nonce, ciphertext, tamperedTag, aad);
  }, /corrupted, tampered, or invalid key/);

  // 3. Tampered AAD
  const tamperedAad = new TextEncoder().encode('Metadata-2026-10-14');
  assert.throws(() => {
    decryptAead(key, nonce, ciphertext, tag, tamperedAad);
  }, /corrupted, tampered, or invalid key/);

  // 4. Wrong key
  const wrongKey = generateRandomBytes(KEY_LENGTH);
  assert.throws(() => {
    decryptAead(wrongKey, nonce, ciphertext, tag, aad);
  }, /corrupted, tampered, or invalid key/);
});

test('C0.1: Envelope encryption with VaultSerializer round-trip and integrity verification', () => {
  const vmk = generateRandomBytes(KEY_LENGTH);
  const journalPayload = {
    id: 'entry-uuid-1234',
    title: 'Jalan sore di Malioboro',
    body: 'Udara sore yang sejuk, banyak hal kecil yang bikin hati happy...',
    mood: 'Senang',
    tags: ['#santai', '#jogja', '#happy'],
    scrapbook: {
      stickers: [
        { id: 'stk-1', name: 'good-day', x: 120, y: 80, rotation: 12, scale: 1.2 }
      ]
    }
  };

  const container = VaultSerializer.encryptPayload(vmk, journalPayload);

  assert.strictEqual(container.magic, 'INKL');
  assert.strictEqual(container.version, 1);
  assert.ok(container.ciphertext.length > 0);
  assert.ok(container.wrappedObjectKey.wrappedKey.length > 0);

  // Decrypt with correct VMK
  const decrypted = VaultSerializer.decryptPayload(vmk, container);
  assert.deepStrictEqual(decrypted, journalPayload);

  // Decrypt with incorrect VMK fails
  const wrongVmk = generateRandomBytes(KEY_LENGTH);
  assert.throws(() => {
    VaultSerializer.decryptPayload(wrongVmk, container);
  });
});

test('Memory hygiene: zeroize securely clears key buffers', () => {
  const secretKey = generateRandomBytes(KEY_LENGTH);
  const copy = new Uint8Array(secretKey);

  assert.ok(secretKey.some(b => b !== 0));
  zeroize(secretKey);
  assert.ok(secretKey.every(b => b === 0));
});
