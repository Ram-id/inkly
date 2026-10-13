import crypto from 'node:crypto';

/**
 * Standard Cryptographic Primitives Implementation
 * Strictly uses RFC 8439 (ChaCha20-Poly1305 AEAD), RFC 5869 (HKDF-SHA256), and CSPRNG.
 * NO CUSTOM CRYPTOGRAPHY.
 */

export const CIPHER_ALGORITHM = 'chacha20-poly1305';
export const KEY_LENGTH = 32; // 256 bits
export const NONCE_LENGTH = 12; // 96 bits standard RFC 8439 IV
export const TAG_LENGTH = 16; // 128 bits Poly1305 MAC

/**
 * Generate cryptographically secure random bytes
 */
export function generateRandomBytes(length: number): Uint8Array {
  return new Uint8Array(crypto.randomBytes(length));
}

/**
 * Derive high-entropy keys using standard HKDF-SHA256 (RFC 5869)
 */
export function deriveKeyHkdf(
  secret: Uint8Array,
  salt: Uint8Array,
  info: string,
  length: number = KEY_LENGTH
): Uint8Array {
  const derived = crypto.hkdfSync(
    'sha256',
    Buffer.from(secret),
    Buffer.from(salt),
    Buffer.from(info, 'utf8'),
    length
  );
  return new Uint8Array(derived);
}

/**
 * Standard Authenticated Encryption with Associated Data (AEAD)
 * RFC 8439 ChaCha20-Poly1305 with 128-bit MAC tag.
 */
export function encryptAead(
  key: Uint8Array,
  nonce: Uint8Array,
  plaintext: Uint8Array,
  associatedData?: Uint8Array
): { ciphertext: Uint8Array; tag: Uint8Array } {
  if (key.length !== KEY_LENGTH) {
    throw new Error(`Invalid key length: expected ${KEY_LENGTH} bytes, got ${key.length}`);
  }
  if (nonce.length !== NONCE_LENGTH) {
    throw new Error(`Invalid nonce length: expected ${NONCE_LENGTH} bytes, got ${nonce.length}`);
  }

  const cipher = crypto.createCipheriv(
    CIPHER_ALGORITHM,
    Buffer.from(key),
    Buffer.from(nonce),
    { authTagLength: TAG_LENGTH }
  );

  if (associatedData && associatedData.length > 0) {
    cipher.setAAD(Buffer.from(associatedData));
  }

  const ciphertextPart = cipher.update(Buffer.from(plaintext));
  const finalPart = cipher.final();
  const ciphertext = Buffer.concat([ciphertextPart, finalPart]);
  const tag = cipher.getAuthTag();

  return {
    ciphertext: new Uint8Array(ciphertext),
    tag: new Uint8Array(tag)
  };
}

/**
 * Standard Authenticated Decryption with Associated Data (AEAD)
 * Immediately throws on bit modification, invalid tag, or truncated ciphertext.
 */
export function decryptAead(
  key: Uint8Array,
  nonce: Uint8Array,
  ciphertext: Uint8Array,
  tag: Uint8Array,
  associatedData?: Uint8Array
): Uint8Array {
  if (key.length !== KEY_LENGTH) {
    throw new Error(`Invalid key length: expected ${KEY_LENGTH} bytes, got ${key.length}`);
  }
  if (nonce.length !== NONCE_LENGTH) {
    throw new Error(`Invalid nonce length: expected ${NONCE_LENGTH} bytes, got ${nonce.length}`);
  }
  if (tag.length !== TAG_LENGTH) {
    throw new Error(`Invalid tag length: expected ${TAG_LENGTH} bytes, got ${tag.length}`);
  }

  const decipher = crypto.createDecipheriv(
    CIPHER_ALGORITHM,
    Buffer.from(key),
    Buffer.from(nonce),
    { authTagLength: TAG_LENGTH }
  );

  decipher.setAuthTag(Buffer.from(tag));

  if (associatedData && associatedData.length > 0) {
    decipher.setAAD(Buffer.from(associatedData));
  }

  try {
    const decryptedPart = decipher.update(Buffer.from(ciphertext));
    const finalPart = decipher.final();
    return new Uint8Array(Buffer.concat([decryptedPart, finalPart]));
  } catch (err) {
    throw new Error('Authenticated decryption failed: ciphertext corrupted, tampered, or invalid key.');
  }
}

/**
 * Constant-time equality comparison to prevent timing attacks
 */
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Cryptographic memory wipe (zeroization) to clean sensitive key buffers
 */
export function zeroize(buffer: Uint8Array): void {
  buffer.fill(0);
}
