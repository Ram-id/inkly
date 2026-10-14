import { entropyToMnemonic, mnemonicToEntropy, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { randomBytes } from './primitives';

/** 24-word BIP-39 recovery key: 256 bits of entropy plus an 8-bit checksum that catches typos. */

export function newRecoveryEntropy(): Uint8Array {
  return randomBytes(32);
}

export function entropyToWords(entropy: Uint8Array): string[] {
  return entropyToMnemonic(entropy, wordlist).split(' ');
}

export function normalizeWords(input: string): string {
  return input.trim().toLowerCase().split(/[\s,.;]+/).filter(Boolean).join(' ');
}

export class RecoveryPhraseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RecoveryPhraseError';
  }
}

export function wordsToEntropy(input: string): Uint8Array {
  const phrase = normalizeWords(input);
  const count = phrase ? phrase.split(' ').length : 0;
  if (count !== 24) {
    throw new RecoveryPhraseError(`Recovery key harus 24 kata (sekarang ${count} kata).`);
  }
  const unknown = phrase.split(' ').filter((w) => !wordlist.includes(w));
  if (unknown.length) {
    throw new RecoveryPhraseError(`Kata tidak dikenal: ${unknown.join(', ')}. Periksa ejaannya.`);
  }
  if (!validateMnemonic(phrase, wordlist)) {
    throw new RecoveryPhraseError('Urutan kata atau salah satu kata keliru (checksum tidak cocok).');
  }
  return mnemonicToEntropy(phrase, wordlist);
}

export function isRecoveryWord(w: string): boolean {
  return wordlist.includes(w.trim().toLowerCase());
}
