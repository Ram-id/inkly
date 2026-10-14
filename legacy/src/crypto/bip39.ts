import * as bip39 from 'bip39';

/**
 * Standard BIP-39 24-Word Mnemonic Module for Inkly
 * Guarantees 256 bits of CSPRNG entropy and 8 bits of SHA-256 error-detection checksum.
 */

/**
 * Converts 32 bytes (256 bits) of entropy into a 24-word mnemonic phrase.
 */
export function entropyToMnemonic(entropy: Uint8Array): string {
  if (entropy.length !== 32) {
    throw new Error(`BIP-39 24-word requires exactly 32 bytes (256 bits) of entropy, got ${entropy.length}`);
  }
  return bip39.entropyToMnemonic(Buffer.from(entropy));
}

/**
 * Validates and converts a 24-word mnemonic back into 32 bytes of entropy.
 * Throws an error if the word count is wrong, unknown words are present, or the checksum fails.
 */
export function mnemonicToEntropy(mnemonic: string): Uint8Array {
  const normalized = mnemonic.trim().toLowerCase();
  const wordCount = normalized.split(/\s+/).length;
  if (wordCount !== 24) {
    throw new Error(`Expected exactly 24 recovery words, but got ${wordCount}.`);
  }

  if (!bip39.validateMnemonic(normalized)) {
    throw new Error('Recovery phrase validation failed! Check for typos, word order, or misspelled words.');
  }

  const hex = bip39.mnemonicToEntropy(normalized);
  return new Uint8Array(Buffer.from(hex, 'hex'));
}

/**
 * Validates whether a mnemonic is well-formed and passes checksum verification.
 */
export function isValidMnemonic(mnemonic: string): boolean {
  const normalized = mnemonic.trim().toLowerCase();
  const words = normalized.split(/\s+/);
  if (words.length !== 24) return false;
  return bip39.validateMnemonic(normalized);
}
