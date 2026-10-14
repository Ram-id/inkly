import { xchacha20poly1305 } from '@noble/ciphers/chacha';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha2';

/**
 * Low-level building blocks. Everything here uses audited libraries (@noble/*) or the
 * platform CSPRNG; there is no home-made cryptography.
 *
 * Sealed format (version 1):  [0x01][24-byte random nonce][ciphertext || 16-byte Poly1305 tag]
 * XChaCha20-Poly1305 has a 192-bit nonce, so random nonces are safe for any realistic volume.
 */

export const KEY_LEN = 32;
const SEAL_VERSION = 1;
const NONCE_LEN = 24;

const enc = new TextEncoder();
const dec = new TextDecoder();

export function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  crypto.getRandomValues(out);
  return out;
}

export function utf8(s: string): Uint8Array {
  return enc.encode(s);
}

export function fromUtf8(b: Uint8Array): string {
  return dec.decode(b);
}

export function deriveKey(ikm: Uint8Array, info: string, salt?: Uint8Array): Uint8Array {
  return hkdf(sha256, ikm, salt, utf8(info), KEY_LEN);
}

export function sha256Bytes(data: Uint8Array): Uint8Array {
  return sha256(data);
}

export function seal(key: Uint8Array, plaintext: Uint8Array, aad: string): Uint8Array {
  const nonce = randomBytes(NONCE_LEN);
  const ct = xchacha20poly1305(key, nonce, utf8(aad)).encrypt(plaintext);
  const out = new Uint8Array(1 + NONCE_LEN + ct.length);
  out[0] = SEAL_VERSION;
  out.set(nonce, 1);
  out.set(ct, 1 + NONCE_LEN);
  return out;
}

export class DecryptError extends Error {
  constructor(message = 'Data tidak bisa dibuka: kunci salah atau data rusak.') {
    super(message);
    this.name = 'DecryptError';
  }
}

export function open(key: Uint8Array, sealed: Uint8Array, aad: string): Uint8Array {
  if (sealed.length < 1 + NONCE_LEN + 16 || sealed[0] !== SEAL_VERSION) {
    throw new DecryptError('Format data terenkripsi tidak dikenal.');
  }
  const nonce = sealed.subarray(1, 1 + NONCE_LEN);
  const ct = sealed.subarray(1 + NONCE_LEN);
  try {
    return xchacha20poly1305(key, nonce, utf8(aad)).decrypt(ct);
  } catch {
    throw new DecryptError();
  }
}

/**
 * Pads plaintext to a bucket size so the server only learns a coarse size, not the exact
 * length of an entry. Layout: [4-byte big-endian length][data][zero padding].
 */
export function pad(data: Uint8Array, bucket: number): Uint8Array {
  const total = Math.ceil((data.length + 4) / bucket) * bucket;
  const out = new Uint8Array(total);
  new DataView(out.buffer).setUint32(0, data.length);
  out.set(data, 4);
  return out;
}

export function unpad(padded: Uint8Array): Uint8Array {
  const len = new DataView(padded.buffer, padded.byteOffset, padded.byteLength).getUint32(0);
  if (len > padded.length - 4) throw new DecryptError('Padding tidak valid.');
  return padded.subarray(4, 4 + len);
}

export function wipe(...buffers: (Uint8Array | null | undefined)[]): void {
  for (const b of buffers) b?.fill(0);
}

export function toB64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

export function fromB64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
