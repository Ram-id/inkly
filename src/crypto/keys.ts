import { argon2id } from 'hash-wasm';
import {
  DecryptError,
  deriveKey,
  fromB64,
  open,
  randomBytes,
  seal,
  sha256Bytes,
  toB64,
  toHex,
  utf8,
  wipe,
  KEY_LEN
} from './primitives';
import { entropyToWords, newRecoveryEntropy, wordsToEntropy } from './recovery';

/**
 * Key hierarchy
 *
 *   password ──Argon2id(random salt)──► pwKEK ─┐
 *                                              ├─ each wraps the same VMK (Vault Master Key)
 *   24 recovery words (256-bit) ──HKDF──► rkKEK┘
 *
 *   VMK ──HKDF──► dataKey (entries, settings), mediaKey (photos), metaKey (recovery-key copy)
 *
 *   password ──Argon2id(salt = H(email))──HKDF──► authSecret  (the only thing Supabase sees)
 *
 * The VMK, KEKs and recovery words never leave the device. The server stores the KeyBlob,
 * which is useless without the password or the recovery words.
 */

export interface KdfParams {
  alg: 'argon2id';
  /** memory in KiB */
  m: number;
  t: number;
  p: number;
}

export const DEFAULT_KDF: KdfParams = { alg: 'argon2id', m: 64 * 1024, t: 3, p: 1 };

export interface KeyBlob {
  v: 1;
  kdf: KdfParams & { salt: string };
  byPassword: string;
  byRecovery: string;
  /** Recovery entropy sealed under the VMK, so the owner can view it again later. */
  rkCopy: string;
  createdAt: number;
}

const AAD_PW = 'inkly/vmk/password/v1';
const AAD_RK = 'inkly/vmk/recovery/v1';
const AAD_RK_COPY = 'inkly/recovery-copy/v1';

export class WrongSecretError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WrongSecretError';
  }
}

export function normalizePassword(pw: string): string {
  return pw.normalize('NFKC');
}

async function stretch(secret: string, salt: Uint8Array, p: KdfParams): Promise<Uint8Array> {
  return argon2id({
    password: utf8(normalizePassword(secret)),
    salt,
    iterations: p.t,
    parallelism: p.p,
    memorySize: p.m,
    hashLength: KEY_LEN,
    outputType: 'binary'
  });
}

async function passwordKek(password: string, blobKdf: KeyBlob['kdf']): Promise<Uint8Array> {
  const stretched = await stretch(password, fromB64(blobKdf.salt), blobKdf);
  const kek = deriveKey(stretched, 'inkly/pw-kek/v1');
  wipe(stretched);
  return kek;
}

function recoveryKek(entropy: Uint8Array): Uint8Array {
  return deriveKey(entropy, 'inkly/rk-kek/v1');
}

export interface VaultKeys {
  vmk: Uint8Array;
  data: Uint8Array;
  media: Uint8Array;
  meta: Uint8Array;
}

export function expandVmk(vmk: Uint8Array): VaultKeys {
  return {
    vmk,
    data: deriveKey(vmk, 'inkly/data/v1'),
    media: deriveKey(vmk, 'inkly/media/v1'),
    meta: deriveKey(vmk, 'inkly/meta/v1')
  };
}

export function wipeKeys(k: VaultKeys | null): void {
  if (!k) return;
  wipe(k.vmk, k.data, k.media, k.meta);
}

export async function createVault(
  password: string,
  params: KdfParams = DEFAULT_KDF
): Promise<{ vmk: Uint8Array; blob: KeyBlob; words: string[] }> {
  const vmk = randomBytes(KEY_LEN);
  const entropy = newRecoveryEntropy();
  const salt = randomBytes(16);
  const kdf = { ...params, salt: toB64(salt) };

  const pwKek = await passwordKek(password, kdf);
  const rkKek = recoveryKek(entropy);
  const keys = expandVmk(vmk);

  const blob: KeyBlob = {
    v: 1,
    kdf,
    byPassword: toB64(seal(pwKek, vmk, AAD_PW)),
    byRecovery: toB64(seal(rkKek, vmk, AAD_RK)),
    rkCopy: toB64(seal(keys.meta, entropy, AAD_RK_COPY)),
    createdAt: Date.now()
  };
  const words = entropyToWords(entropy);
  wipe(pwKek, rkKek, entropy, keys.data, keys.media, keys.meta);
  return { vmk, blob, words };
}

export async function unlockWithPassword(blob: KeyBlob, password: string): Promise<Uint8Array> {
  const kek = await passwordKek(password, blob.kdf);
  try {
    return open(kek, fromB64(blob.byPassword), AAD_PW);
  } catch (e) {
    if (e instanceof DecryptError) throw new WrongSecretError('Password salah.');
    throw e;
  } finally {
    wipe(kek);
  }
}

export function unlockWithRecovery(blob: KeyBlob, words: string): Uint8Array {
  const entropy = wordsToEntropy(words);
  const kek = recoveryKek(entropy);
  try {
    return open(kek, fromB64(blob.byRecovery), AAD_RK);
  } catch (e) {
    if (e instanceof DecryptError) {
      throw new WrongSecretError('Recovery key valid, tetapi bukan milik jurnal ini.');
    }
    throw e;
  } finally {
    wipe(kek, entropy);
  }
}

/** Replaces the password wrapper (password change / reset). The VMK stays the same. */
export async function rewrapWithPassword(
  blob: KeyBlob,
  vmk: Uint8Array,
  newPassword: string,
  params: KdfParams = DEFAULT_KDF
): Promise<KeyBlob> {
  const kdf = { ...params, salt: toB64(randomBytes(16)) };
  const kek = await passwordKek(newPassword, kdf);
  const next: KeyBlob = { ...blob, kdf, byPassword: toB64(seal(kek, vmk, AAD_PW)) };
  wipe(kek);
  return next;
}

/** Issues a brand-new recovery key. The old words stop working for this blob. */
export function rotateRecovery(blob: KeyBlob, vmk: Uint8Array): { blob: KeyBlob; words: string[] } {
  const entropy = newRecoveryEntropy();
  const kek = recoveryKek(entropy);
  const keys = expandVmk(vmk);
  const next: KeyBlob = {
    ...blob,
    byRecovery: toB64(seal(kek, vmk, AAD_RK)),
    rkCopy: toB64(seal(keys.meta, entropy, AAD_RK_COPY))
  };
  const words = entropyToWords(entropy);
  wipe(kek, entropy, keys.data, keys.media, keys.meta);
  return { blob: next, words };
}

export function revealRecoveryWords(blob: KeyBlob, keys: VaultKeys): string[] {
  const entropy = open(keys.meta, fromB64(blob.rkCopy), AAD_RK_COPY);
  const words = entropyToWords(entropy);
  wipe(entropy);
  return words;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Login secret for the sync account. Derived with a different salt and HKDF label than the
 * encryption key, so knowing it (as the server does, via its bcrypt hash) gives no way to
 * compute pwKEK. 64 hex chars fits within bcrypt's 72-byte limit.
 */
export async function deriveAuthSecret(
  email: string,
  password: string,
  params: KdfParams = DEFAULT_KDF
): Promise<string> {
  const salt = sha256Bytes(utf8(`inkly/auth-salt/v1|${normalizeEmail(email)}`)).subarray(0, 16);
  const stretched = await stretch(password, salt, params);
  const secret = deriveKey(stretched, 'inkly/auth/v1');
  wipe(stretched);
  const hex = toHex(secret);
  wipe(secret);
  return hex;
}

export function isKeyBlob(x: unknown): x is KeyBlob {
  const b = x as KeyBlob;
  return !!b && b.v === 1 && typeof b.byPassword === 'string' && typeof b.byRecovery === 'string' && !!b.kdf?.salt;
}
