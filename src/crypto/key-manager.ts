import {
  generateRandomBytes,
  deriveKeyHkdf,
  encryptAead,
  decryptAead,
  KEY_LENGTH,
  NONCE_LENGTH,
  zeroize
} from './primitives.ts';
import { entropyToMnemonic, mnemonicToEntropy } from './bip39.ts';
import type { KeyMaterial } from './types.ts';

const HKDF_INFO_VMK_WRAPPING = 'Inkly-VMK-Wrapping-v1';
const HKDF_INFO_OBJECT_KEY_WRAPPING = 'Inkly-ObjectKey-Wrapping-v1';

export class KeyManager {
  /**
   * Initializes a fresh vault: creates random VMK and RK, encodes RK as BIP-39 24 words,
   * derives the wrapping key via HKDF, and wraps the VMK.
   */
  public static initializeNewVault(): KeyMaterial {
    // 1. Generate 256-bit VMK and RK
    const vmk = generateRandomBytes(KEY_LENGTH);
    const rk = generateRandomBytes(KEY_LENGTH);

    // 2. Generate BIP-39 24 words for RK
    const mnemonic = entropyToMnemonic(rk);

    // 3. Generate salt for HKDF
    const recoverySalt = generateRandomBytes(32);

    // 4. Derive Wrapping Key from RK
    const wrappingKey = deriveKeyHkdf(rk, recoverySalt, HKDF_INFO_VMK_WRAPPING, KEY_LENGTH);

    // 5. Wrap VMK using AEAD (ChaCha20-Poly1305)
    const nonce = generateRandomBytes(NONCE_LENGTH);
    const { ciphertext, tag } = encryptAead(wrappingKey, nonce, vmk);

    // Clean up temporary wrapping key from memory
    zeroize(wrappingKey);

    return {
      vmk,
      rk,
      mnemonic,
      recoverySalt,
      wrappedVmk: {
        nonce: Buffer.from(nonce).toString('base64'),
        ciphertext: Buffer.from(ciphertext).toString('base64'),
        macTag: Buffer.from(tag).toString('base64')
      }
    };
  }

  /**
   * Restores the VMK on a new device using the 24-word recovery phrase and wrapped VMK blob.
   * Completely local operation - RK is NEVER sent to the cloud.
   */
  public static restoreVmkFromRecoveryPhrase(
    mnemonic: string,
    recoverySalt: Uint8Array,
    wrappedVmkBase64: string,
    nonceBase64: string,
    macTagBase64: string
  ): Uint8Array {
    // 1. Decode and validate 24 words
    const rk = mnemonicToEntropy(mnemonic);

    try {
      // 2. Derive Wrapping Key using exact same HKDF parameters
      const wrappingKey = deriveKeyHkdf(rk, recoverySalt, HKDF_INFO_VMK_WRAPPING, KEY_LENGTH);

      // 3. Decrypt and verify wrapped VMK
      const nonce = new Uint8Array(Buffer.from(nonceBase64, 'base64'));
      const ciphertext = new Uint8Array(Buffer.from(wrappedVmkBase64, 'base64'));
      const tag = new Uint8Array(Buffer.from(macTagBase64, 'base64'));

      const vmk = decryptAead(wrappingKey, nonce, ciphertext, tag);

      // Clean up wrapping key
      zeroize(wrappingKey);
      return vmk;
    } finally {
      // Clean up temporary recovery key buffer
      zeroize(rk);
    }
  }

  /**
   * Generates a unique 256-bit Object Key for an individual journal entry or media attachment
   */
  public static generateObjectKey(): Uint8Array {
    return generateRandomBytes(KEY_LENGTH);
  }

  /**
   * Wraps an Object Key using the Vault Master Key (VMK)
   */
  public static wrapObjectKey(
    vmk: Uint8Array,
    objectKey: Uint8Array
  ): { nonce: string; wrappedKey: string; macTag: string } {
    const nonce = generateRandomBytes(NONCE_LENGTH);
    const { ciphertext, tag } = encryptAead(vmk, nonce, objectKey, Buffer.from(HKDF_INFO_OBJECT_KEY_WRAPPING));

    return {
      nonce: Buffer.from(nonce).toString('base64'),
      wrappedKey: Buffer.from(ciphertext).toString('base64'),
      macTag: Buffer.from(tag).toString('base64')
    };
  }

  /**
   * Unwraps an Object Key using the Vault Master Key (VMK)
   */
  public static unwrapObjectKey(
    vmk: Uint8Array,
    wrappedKeyBase64: string,
    nonceBase64: string,
    macTagBase64: string
  ): Uint8Array {
    const nonce = new Uint8Array(Buffer.from(nonceBase64, 'base64'));
    const ciphertext = new Uint8Array(Buffer.from(wrappedKeyBase64, 'base64'));
    const tag = new Uint8Array(Buffer.from(macTagBase64, 'base64'));

    return decryptAead(vmk, nonce, ciphertext, tag, Buffer.from(HKDF_INFO_OBJECT_KEY_WRAPPING));
  }
}
