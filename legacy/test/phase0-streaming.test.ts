import test from 'node:test';
import assert from 'node:assert';
import { generateRandomBytes, KEY_LENGTH } from '../src/crypto/primitives.ts';
import { StreamCipher, CHUNK_SIZE } from '../src/crypto/stream-cipher.ts';

test('C0.5: Streaming chunk cipher round-trip for large media attachments', () => {
  const objectKey = generateRandomBytes(KEY_LENGTH);
  // Generate 150 KiB mock image payload (exceeds single 64KB chunk)
  const mockPhotoData = generateRandomBytes(150 * 1024);

  const encryptedChunks = StreamCipher.encryptStream(objectKey, mockPhotoData);

  // 150 KiB should produce 3 chunks (64KB + 64KB + 22KB)
  assert.strictEqual(encryptedChunks.length, 3);
  assert.strictEqual(encryptedChunks[0].isFinal, false);
  assert.strictEqual(encryptedChunks[1].isFinal, false);
  assert.strictEqual(encryptedChunks[2].isFinal, true);

  const decryptedData = StreamCipher.decryptStream(objectKey, encryptedChunks);
  assert.deepStrictEqual(decryptedData, mockPhotoData);
});

test('C0.5: Streaming chunk cipher detects chunk reordering attack', () => {
  const objectKey = generateRandomBytes(KEY_LENGTH);
  const mockPhotoData = generateRandomBytes(150 * 1024);

  const encryptedChunks = StreamCipher.encryptStream(objectKey, mockPhotoData);

  // Swap chunk 0 and chunk 1
  const reorderedChunks = [encryptedChunks[1], encryptedChunks[0], encryptedChunks[2]];

  assert.throws(() => {
    StreamCipher.decryptStream(objectKey, reorderedChunks);
  }, /Chunk sequencing violation/);
});

test('C0.5: Streaming chunk cipher detects truncation / missing final chunk attack', () => {
  const objectKey = generateRandomBytes(KEY_LENGTH);
  const mockPhotoData = generateRandomBytes(150 * 1024);

  const encryptedChunks = StreamCipher.encryptStream(objectKey, mockPhotoData);

  // Drop final chunk
  const truncatedChunks = [encryptedChunks[0], encryptedChunks[1]];

  assert.throws(() => {
    StreamCipher.decryptStream(objectKey, truncatedChunks);
  }, /Incomplete stream: final chunk flag was never received/);
});

test('C0.5: Streaming chunk cipher detects tampered ciphertext in a middle chunk', () => {
  const objectKey = generateRandomBytes(KEY_LENGTH);
  const mockPhotoData = generateRandomBytes(150 * 1024);

  const encryptedChunks = StreamCipher.encryptStream(objectKey, mockPhotoData);

  // Tamper with middle chunk
  const tamperedChunkBytes = Buffer.from(encryptedChunks[1].ciphertext, 'base64');
  tamperedChunkBytes[10] ^= 0x01; // flip bit
  encryptedChunks[1].ciphertext = tamperedChunkBytes.toString('base64');

  assert.throws(() => {
    StreamCipher.decryptStream(objectKey, encryptedChunks);
  }, /corrupted, tampered, or invalid key/);
});
