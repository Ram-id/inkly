import {
  encryptAead,
  decryptAead,
  generateRandomBytes,
  NONCE_LENGTH,
  TAG_LENGTH
} from './primitives.ts';
import { KeyManager } from './key-manager.ts';

const MAGIC = 'INKL';
const FORMAT_VERSION = 1;
const CIPHER_ID_CHACHA20_POLY1305 = 1;

export interface EncryptedContainer {
  magic: string;
  version: number;
  cipherId: number;
  nonce: string;
  wrappedObjectKey: {
    nonce: string;
    wrappedKey: string;
    macTag: string;
  };
  ciphertext: string;
  macTag: string;
}

export class VaultSerializer {
  /**
   * Encrypts a plaintext journal payload (JSON string or object) into an authenticated container
   * using an envelope Object Key wrapped by the VMK.
   */
  public static encryptPayload(
    vmk: Uint8Array,
    payload: string | object
  ): EncryptedContainer {
    const rawPlaintext = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const plaintextBytes = new Uint8Array(Buffer.from(rawPlaintext, 'utf8'));

    // 1. Generate unique Object Key for this payload
    const objectKey = KeyManager.generateObjectKey();

    // 2. Wrap Object Key using VMK
    const wrappedKeyInfo = KeyManager.wrapObjectKey(vmk, objectKey);

    // 3. Encrypt payload using Object Key
    const nonce = generateRandomBytes(NONCE_LENGTH);
    const headerAad = Buffer.from(`${MAGIC}:${FORMAT_VERSION}:${CIPHER_ID_CHACHA20_POLY1305}`);
    
    const { ciphertext, tag } = encryptAead(objectKey, nonce, plaintextBytes, headerAad);

    return {
      magic: MAGIC,
      version: FORMAT_VERSION,
      cipherId: CIPHER_ID_CHACHA20_POLY1305,
      nonce: Buffer.from(nonce).toString('base64'),
      wrappedObjectKey: wrappedKeyInfo,
      ciphertext: Buffer.from(ciphertext).toString('base64'),
      macTag: Buffer.from(tag).toString('base64')
    };
  }

  /**
   * Decrypts an authenticated container back into plaintext payload using the VMK
   */
  public static decryptPayload<T = any>(
    vmk: Uint8Array,
    container: EncryptedContainer
  ): T {
    if (container.magic !== MAGIC) {
      throw new Error(`Invalid container magic: expected ${MAGIC}, got ${container.magic}`);
    }
    if (container.version !== FORMAT_VERSION) {
      throw new Error(`Unsupported container version: ${container.version}`);
    }

    // 1. Unwrap Object Key using VMK
    const objectKey = KeyManager.unwrapObjectKey(
      vmk,
      container.wrappedObjectKey.wrappedKey,
      container.wrappedObjectKey.nonce,
      container.wrappedObjectKey.macTag
    );

    // 2. Decrypt payload using unwrapped Object Key
    const nonce = new Uint8Array(Buffer.from(container.nonce, 'base64'));
    const ciphertext = new Uint8Array(Buffer.from(container.ciphertext, 'base64'));
    const tag = new Uint8Array(Buffer.from(container.macTag, 'base64'));
    const headerAad = Buffer.from(`${container.magic}:${container.version}:${container.cipherId}`);

    const decryptedBytes = decryptAead(objectKey, nonce, ciphertext, tag, headerAad);
    const plaintext = Buffer.from(decryptedBytes).toString('utf8');

    try {
      return JSON.parse(plaintext) as T;
    } catch {
      return plaintext as unknown as T;
    }
  }
}
