import { argon2id } from 'hash-wasm';
import { DecryptError, deriveKey, fromB64, open, randomBytes, seal, toB64, utf8, wipe } from '../crypto/primitives';
import { deleteMeta, getMeta, setMeta, type PinRecord } from './db';
import type { Vault } from './vault';

/**
 * Quick unlock with a PIN on this one device.
 *
 * The VMK is sealed with a key stretched from the PIN, and that result is encrypted again with
 * a non-extractable WebCrypto key that lives only in this browser profile. After 5 wrong PINs
 * the record is erased and the full password is required. A PIN is a convenience: someone who
 * copies the raw browser storage off the phone could still try all PINs offline, which is why
 * the password stays the real key.
 */

const MAX_ATTEMPTS = 5;
const AAD = 'inkly/vmk/pin/v1';

export class WrongPinError extends Error {
  constructor(readonly attemptsLeft: number) {
    super(attemptsLeft > 0 ? `PIN salah. Sisa percobaan: ${attemptsLeft}.` : 'PIN salah terlalu sering. Masuk dengan password.');
    this.name = 'WrongPinError';
  }
}

async function pinKey(pin: string, salt: Uint8Array): Promise<Uint8Array> {
  const stretched = await argon2id({
    password: utf8(pin),
    salt,
    iterations: 2,
    parallelism: 1,
    memorySize: 19 * 1024,
    hashLength: 32,
    outputType: 'binary'
  });
  const key = deriveKey(stretched, 'inkly/pin-kek/v1');
  wipe(stretched);
  return key;
}

async function newDeviceKey(): Promise<CryptoKey | null> {
  try {
    return await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  } catch {
    return null;
  }
}

export function isValidPin(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}

export async function hasPin(vault: Vault): Promise<boolean> {
  return !!(await getMeta(vault.db, 'pin'));
}

export async function enablePin(vault: Vault, pin: string): Promise<void> {
  if (!isValidPin(pin)) throw new Error('PIN harus 6 angka.');
  const salt = randomBytes(16);
  const key = await pinKey(pin, salt);
  const vmk = vault.exportVmk();
  const sealed = seal(key, vmk, AAD);
  wipe(key, vmk);

  const deviceKey = await newDeviceKey();
  const iv = randomBytes(12);
  const wrapped = deviceKey
    ? new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, deviceKey, sealed as BufferSource))
    : sealed;

  const record: PinRecord = { salt: toB64(salt), wrapped, iv, deviceKey, attemptsLeft: MAX_ATTEMPTS };
  try {
    await setMeta(vault.db, 'pin', record);
  } catch {
    // Some browsers cannot store CryptoKey objects; fall back to the PIN layer alone.
    await setMeta(vault.db, 'pin', { ...record, wrapped: sealed, deviceKey: null });
  }
}

export async function disablePin(vault: Vault): Promise<void> {
  await deleteMeta(vault.db, 'pin');
}

export async function unlockWithPin(vault: Vault, pin: string): Promise<void> {
  const record = await getMeta(vault.db, 'pin');
  if (!record) throw new Error('PIN belum diaktifkan di perangkat ini.');

  let sealed: Uint8Array;
  try {
    sealed = record.deviceKey
      ? new Uint8Array(
          await crypto.subtle.decrypt({ name: 'AES-GCM', iv: record.iv as BufferSource }, record.deviceKey, record.wrapped as BufferSource)
        )
      : record.wrapped;
  } catch {
    await disablePin(vault);
    throw new Error('Kunci PIN di perangkat ini rusak. Masuk dengan password.');
  }

  const key = await pinKey(pin, fromB64(record.salt));
  try {
    const vmk = open(key, sealed, AAD);
    if (record.attemptsLeft !== MAX_ATTEMPTS) await setMeta(vault.db, 'pin', { ...record, attemptsLeft: MAX_ATTEMPTS });
    await vault.unlockVmk(vmk);
  } catch (e) {
    if (!(e instanceof DecryptError)) throw e;
    const left = record.attemptsLeft - 1;
    if (left <= 0) await disablePin(vault);
    else await setMeta(vault.db, 'pin', { ...record, attemptsLeft: left });
    throw new WrongPinError(left);
  } finally {
    wipe(key);
  }
}
