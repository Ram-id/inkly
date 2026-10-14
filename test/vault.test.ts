import { describe, expect, it } from 'vitest';
import { emptyEntry } from '../src/domain/types';
import { Vault, VaultLockedError } from '../src/storage/vault';
import { enablePin, unlockWithPin, WrongPinError, hasPin } from '../src/storage/pin';
import { FAST_KDF, freshVault } from './helpers';

const SECRET_TITLE = 'Rahasia Malioboro';
const SECRET_BODY = 'Hari ini aku menangis di kafe dekat kantor';
const SECRET_TAG = 'patahhati';

async function rawDump(vault: Vault): Promise<string> {
  const all = {
    meta: await vault.db.getAll('meta'),
    objects: await vault.db.getAll('objects'),
    media: await vault.db.getAll('media')
  };
  return JSON.stringify(all, (_k, v) => (v instanceof Uint8Array ? new TextDecoder('latin1').decode(v) : v));
}

describe('local vault', () => {
  it('stores only ciphertext on the device', async () => {
    const vault = await freshVault();
    const words = await vault.create('password-panjang-1');
    const e = { ...emptyEntry(), title: SECRET_TITLE, body: SECRET_BODY, tags: [SECRET_TAG], mood: 'sedih' as const };
    await vault.saveEntry(e);
    await vault.addPhoto('p1', new TextEncoder().encode('FOTO-ASLI-GPS--6.2,106.8'));

    const dump = await rawDump(vault);
    for (const secret of [SECRET_TITLE, SECRET_BODY, SECRET_TAG, 'sedih', 'password-panjang-1', words.slice(0, 3).join(' '), 'FOTO-ASLI']) {
      expect(dump).not.toContain(secret);
    }
  });

  it('CRUD, lock wipes memory, unlock restores', async () => {
    const vault = await freshVault();
    await vault.create('password-panjang-1');
    const saved = await vault.saveEntry({ ...emptyEntry(), title: 'Satu', body: 'isi' });
    expect(vault.list().map((x) => x.title)).toEqual(['Satu']);

    await vault.saveEntry({ ...saved, title: 'Satu (edit)' });
    expect(vault.get(saved.id)?.title).toBe('Satu (edit)');

    vault.lock();
    expect(vault.unlocked).toBe(false);
    expect(() => vault.list()).toThrow(VaultLockedError);

    await vault.unlockPassword('password-panjang-1');
    expect(vault.get(saved.id)?.title).toBe('Satu (edit)');

    await vault.deleteEntry(saved.id);
    expect(vault.list()).toHaveLength(0);
  });

  it('survives a reload from IndexedDB', async () => {
    const name = `reload-${Date.now()}`;
    const v1 = await Vault.open(name, FAST_KDF);
    await v1.create('password-panjang-1');
    await v1.saveEntry({ ...emptyEntry(), title: 'Tetap ada' });
    await v1.addPhoto('ph', new Uint8Array([1, 2, 3]));
    v1.db.close();

    const v2 = await Vault.open(name, FAST_KDF);
    expect(v2.exists).toBe(true);
    expect(v2.unlocked).toBe(false);
    await v2.unlockPassword('password-panjang-1');
    expect(v2.list()[0].title).toBe('Tetap ada');
    expect(await v2.photoBytes('ph')).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('forgot password: recovery words open the vault and a new password can be set', async () => {
    const vault = await freshVault();
    const words = await vault.create('password-lama-123');
    await vault.saveEntry({ ...emptyEntry(), title: 'Penting' });
    vault.lock();
    await vault.unlockRecovery(words.join(' '));
    await vault.changePassword('password-baru-456');
    vault.lock();
    await expect(vault.unlockPassword('password-lama-123')).rejects.toThrow();
    await vault.unlockPassword('password-baru-456');
    expect(vault.list()[0].title).toBe('Penting');
  });

  it('rejects a ciphertext moved to another id', async () => {
    const vault = await freshVault();
    await vault.create('password-panjang-1');
    const a = await vault.saveEntry({ ...emptyEntry(), title: 'A' });
    const row = (await vault.getObject(a.id))!;
    expect(() => vault.openPayload('id-lain', row.ct!)).toThrow();
  });

  it('PIN quick unlock with attempt limit', async () => {
    const vault = await freshVault();
    await vault.create('password-panjang-1');
    await vault.saveEntry({ ...emptyEntry(), title: 'Dengan PIN' });
    await enablePin(vault, '246810');
    vault.lock();

    await unlockWithPin(vault, '246810');
    expect(vault.list()[0].title).toBe('Dengan PIN');
    vault.lock();

    for (let i = 4; i >= 1; i--) {
      await expect(unlockWithPin(vault, '000000')).rejects.toMatchObject({ attemptsLeft: i });
    }
    await expect(unlockWithPin(vault, '000000')).rejects.toBeInstanceOf(WrongPinError);
    expect(await hasPin(vault)).toBe(false);
    await expect(unlockWithPin(vault, '246810')).rejects.toThrow(/belum diaktifkan/);
  });

  it('encrypted backup: restore on a new device and merge into an existing vault', async () => {
    const a = await freshVault();
    const words = await a.create('password-a-12345');
    await a.saveEntry({ ...emptyEntry(), title: 'Dari backup', body: SECRET_BODY });
    const backup = await a.exportBackup();
    expect(backup).not.toContain(SECRET_BODY);

    const b = await freshVault();
    expect(await b.importBackup(backup, words.join(' '))).toBe(1);
    expect(b.list()[0].title).toBe('Dari backup');

    const c = await freshVault();
    await c.create('password-c-12345');
    await c.saveEntry({ ...emptyEntry(), title: 'Milik C' });
    expect(await c.importBackup(backup, 'password-a-12345')).toBe(1);
    expect(c.list().map((e) => e.title).sort()).toEqual(['Dari backup', 'Milik C']);
    c.lock();
    await c.unlockPassword('password-c-12345');
    expect(c.list()).toHaveLength(2);
  });
});
