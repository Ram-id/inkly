import { describe, expect, it } from 'vitest';
import {
  createVault,
  deriveAuthSecret,
  rewrapWithPassword,
  rotateRecovery,
  unlockWithPassword,
  unlockWithRecovery,
  WrongSecretError,
  expandVmk,
  revealRecoveryWords
} from '../src/crypto/keys';
import { DecryptError, open, pad, randomBytes, seal, unpad, utf8 } from '../src/crypto/primitives';
import { RecoveryPhraseError } from '../src/crypto/recovery';
import { FAST_KDF } from './helpers';

describe('primitives', () => {
  it('round-trips and rejects any tampering', () => {
    const key = randomBytes(32);
    const sealed = seal(key, utf8('rahasia 🌙'), 'aad-1');
    expect(new TextDecoder().decode(open(key, sealed, 'aad-1'))).toBe('rahasia 🌙');

    for (const i of [1, 30, sealed.length - 1]) {
      const bad = sealed.slice();
      bad[i] ^= 1;
      expect(() => open(key, bad, 'aad-1')).toThrow(DecryptError);
    }
    expect(() => open(key, sealed, 'aad-2')).toThrow(DecryptError); // swapped to another object id
    expect(() => open(randomBytes(32), sealed, 'aad-1')).toThrow(DecryptError);
  });

  it('uses a fresh nonce every time', () => {
    const key = randomBytes(32);
    expect(seal(key, utf8('x'), 'a')).not.toEqual(seal(key, utf8('x'), 'a'));
  });

  it('pads to buckets so exact length is hidden', () => {
    expect(pad(utf8('a'), 512).length).toBe(512);
    expect(pad(new Uint8Array(600), 512).length).toBe(1024);
    expect(unpad(pad(utf8('halo'), 512))).toEqual(utf8('halo'));
  });
});

describe('key hierarchy', () => {
  it('opens with the password and with the 24 recovery words', async () => {
    const { vmk, blob, words } = await createVault('kata sandi panjang', FAST_KDF);
    expect(words).toHaveLength(24);
    expect(await unlockWithPassword(blob, 'kata sandi panjang')).toEqual(vmk);
    expect(unlockWithRecovery(blob, words.join(' '))).toEqual(vmk);
    expect(unlockWithRecovery(blob, `  ${words.join('  ').toUpperCase()} `)).toEqual(vmk);
  });

  it('rejects a wrong password', async () => {
    const { blob } = await createVault('benar-benar-rahasia', FAST_KDF);
    await expect(unlockWithPassword(blob, 'salah')).rejects.toThrow(WrongSecretError);
  });

  it('catches typos and foreign recovery keys', async () => {
    const a = await createVault('pw-a-1234567', FAST_KDF);
    const b = await createVault('pw-b-1234567', FAST_KDF);
    const typo = [...a.words];
    typo[3] = typo[3] === 'abandon' ? 'ability' : 'abandon';
    expect(() => unlockWithRecovery(a.blob, typo.join(' '))).toThrow(RecoveryPhraseError);
    expect(() => unlockWithRecovery(a.blob, a.words.slice(0, 23).join(' '))).toThrow(/24 kata/);
    expect(() => unlockWithRecovery(a.blob, b.words.join(' '))).toThrow(WrongSecretError);
  });

  it('password change keeps the same VMK and retires the old password', async () => {
    const { vmk, blob, words } = await createVault('password-lama-1', FAST_KDF);
    const next = await rewrapWithPassword(blob, vmk, 'password-baru-2', FAST_KDF);
    expect(await unlockWithPassword(next, 'password-baru-2')).toEqual(vmk);
    await expect(unlockWithPassword(next, 'password-lama-1')).rejects.toThrow(WrongSecretError);
    expect(unlockWithRecovery(next, words.join(' '))).toEqual(vmk);
  });

  it('can show the recovery key again and rotate it', async () => {
    const { vmk, blob, words } = await createVault('pw-1234567890', FAST_KDF);
    expect(revealRecoveryWords(blob, expandVmk(new Uint8Array(vmk)))).toEqual(words);
    const rotated = rotateRecovery(blob, vmk);
    expect(rotated.words).not.toEqual(words);
    expect(unlockWithRecovery(rotated.blob, rotated.words.join(' '))).toEqual(vmk);
    expect(() => unlockWithRecovery(rotated.blob, words.join(' '))).toThrow(WrongSecretError);
  });

  it('auth secret is deterministic per email+password and unrelated to the key blob', async () => {
    const s1 = await deriveAuthSecret('Ana@Mail.com ', 'pw-1234567890', FAST_KDF);
    const s2 = await deriveAuthSecret('ana@mail.com', 'pw-1234567890', FAST_KDF);
    const s3 = await deriveAuthSecret('ana@mail.com', 'pw-0000000000', FAST_KDF);
    expect(s1).toBe(s2);
    expect(s1).not.toBe(s3);
    expect(s1).toMatch(/^[0-9a-f]{64}$/);
    expect(s1).not.toContain('pw-1234567890');
  });
});
