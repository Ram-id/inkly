/**
 * Cryptographic and Vault Types for Inkly Zero-Knowledge System
 */

export interface CiphertextRecord {
  /** Magic identifier: "INKL" */
  magic: string;
  /** Format version: 1 */
  version: number;
  /** Cipher identifier: 1 = ChaCha20-Poly1305 */
  cipherId: number;
  /** 12-byte or 24-byte CSPRNG Nonce in Hex or Base64 */
  nonce: string;
  /** Wrapped 256-bit Object Key with authentication tag */
  wrappedObjectKey: string;
  /** Encrypted payload ciphertext */
  ciphertext: string;
  /** Poly1305 16-byte MAC authentication tag */
  macTag: string;
}

export interface KeyMaterial {
  /** 32-byte Vault Master Key (VMK) */
  vmk: Uint8Array;
  /** 32-byte Recovery Key (RK) */
  rk: Uint8Array;
  /** 24-word BIP-39 mnemonic representation of RK */
  mnemonic: string;
  /** 32-byte salt used for HKDF wrapping */
  recoverySalt: Uint8Array;
  /** VMK wrapped by key derived from RK */
  wrappedVmk: {
    nonce: string;
    ciphertext: string;
    macTag: string;
  };
}

export interface StreamChunkHeader {
  sequenceNumber: number;
  isFinal: boolean;
  chunkLength: number;
}
