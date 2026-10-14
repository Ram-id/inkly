import { describe, expect, it } from 'vitest';
import { emptyEntry } from '../src/domain/types';
import { Account } from '../src/sync/account';
import { SyncEngine } from '../src/sync/engine';
import type { Vault } from '../src/storage/vault';
import { FakeAuth, FakeServer, FAST_KDF, freshVault } from './helpers';

const EMAIL = 'pemilik@contoh.id';
const PASSWORD = 'password-sangat-rahasia-1';

interface Device {
  vault: Vault;
  account: Account;
  engine: SyncEngine;
}

async function device(server: FakeServer, auth = new FakeAuth(server)): Promise<Device & { auth: FakeAuth }> {
  const vault = await freshVault();
  const account = new Account(vault, auth, FAST_KDF);
  return {
    vault,
    account,
    auth,
    get engine() {
      return engineFor(vault, account);
    }
  } as Device & { auth: FakeAuth };
}

const engines = new WeakMap<Vault, SyncEngine>();
function engineFor(vault: Vault, account: Account): SyncEngine {
  let e = engines.get(vault);
  if (!e) {
    e = new SyncEngine(vault, account.auth.remoteFor('user-1'));
    engines.set(vault, e);
  }
  return e;
}

/** Device A creates the journal and an account; device B signs in fresh. */
async function twoDevices() {
  const server = new FakeServer();
  const auth = new FakeAuth(server);
  const a = await device(server, auth);
  const words = await a.vault.create(PASSWORD);
  expect(await a.account.register(EMAIL, PASSWORD)).toBe('linked');
  const b = await device(server, auth);
  return { server, auth, a, b, words };
}

describe('zero-knowledge sync', () => {
  it('device B opens device A’s journal with email + password only', async () => {
    const { a, b } = await twoDevices();
    await a.vault.saveEntry({ ...emptyEntry(), title: 'Ditulis di HP A', body: 'isi rahasia', tags: ['jogja'] });
    await a.vault.addPhoto('foto-1', new Uint8Array([9, 8, 7]));
    await a.engine.sync();

    await b.account.signInFresh(EMAIL, PASSWORD);
    await b.engine.sync();
    expect(b.vault.list().map((e) => e.title)).toEqual(['Ditulis di HP A']);
    expect(await b.vault.photoBytes('foto-1')).toEqual(new Uint8Array([9, 8, 7])); // fetched on demand
  });

  it('server and network never see plaintext, password, recovery words or keys', async () => {
    const { server, a, words } = await twoDevices();
    const title = 'Judul-Sangat-Pribadi';
    const body = 'Isi jurnal yang tidak boleh dibaca developer';
    await a.vault.saveEntry({ ...emptyEntry(), title, body, tags: ['tagrahasia'], mood: 'cemas' });
    await a.vault.saveSettings({ displayName: 'NamaPemilik' });
    await a.vault.addPhoto('px', new TextEncoder().encode('BYTES-FOTO-ASLI'));
    await a.engine.sync();

    const vmk = a.vault.exportVmk();
    const everything = [
      ...server.traffic,
      JSON.stringify([...server.objects.values()]),
      JSON.stringify([...server.keyBlobs.values()]),
      [...server.media.values()].map((m) => Buffer.from(m).toString('latin1')).join()
    ].join('\n');

    for (const leak of [
      title,
      body,
      'tagrahasia',
      'cemas',
      'NamaPemilik',
      'BYTES-FOTO-ASLI',
      PASSWORD,
      words.slice(0, 4).join(' '),
      Buffer.from(vmk).toString('hex'),
      Buffer.from(vmk).toString('base64')
    ]) {
      expect(everything, `bocor: ${leak}`).not.toContain(leak);
    }
    // The server rows hold nothing but ids, revisions and ciphertext.
    for (const o of server.objects.values()) {
      expect(Object.keys(o).sort()).toEqual(['ct', 'deleted', 'id', 'rev', 'seq', 'userId']);
    }
  });

  it('concurrent edits on two devices keep both versions (no silent loss)', async () => {
    const { a, b } = await twoDevices();
    const e = await a.vault.saveEntry({ ...emptyEntry(), title: 'Asli', body: 'v1' });
    await a.engine.sync();
    await b.account.signInFresh(EMAIL, PASSWORD);
    await b.engine.sync();

    await a.vault.saveEntry({ ...a.vault.get(e.id)!, body: 'diedit di A' });
    await b.vault.saveEntry({ ...b.vault.get(e.id)!, body: 'diedit di B' });
    await a.engine.sync();
    await b.engine.sync(); // B's push conflicts → B keeps its version as a copy
    await a.engine.sync();

    for (const d of [a, b]) {
      const bodies = d.vault.list().map((x) => x.body).sort();
      expect(bodies).toEqual(['diedit di A', 'diedit di B']);
    }
    expect(b.engine.status.conflicts).toBe(1);
  });

  it('edit beats a delete made on another device', async () => {
    const { a, b } = await twoDevices();
    const e = await a.vault.saveEntry({ ...emptyEntry(), title: 'Jangan hilang' });
    await a.engine.sync();
    await b.account.signInFresh(EMAIL, PASSWORD);
    await b.engine.sync();

    await a.vault.deleteEntry(e.id);
    await b.vault.saveEntry({ ...b.vault.get(e.id)!, body: 'tambahan penting' });
    await a.engine.sync();
    await b.engine.sync();
    await a.engine.sync();

    expect(a.vault.list().map((x) => x.body)).toEqual(['tambahan penting']);
    expect(b.vault.list().map((x) => x.body)).toEqual(['tambahan penting']);
  });

  it('deletes propagate', async () => {
    const { a, b } = await twoDevices();
    const e = await a.vault.saveEntry({ ...emptyEntry(), title: 'Hapus saya' });
    await a.engine.sync();
    await b.account.signInFresh(EMAIL, PASSWORD);
    await b.engine.sync();
    await a.vault.deleteEntry(e.id);
    await a.engine.sync();
    await b.engine.sync();
    expect(b.vault.list()).toHaveLength(0);
  });

  it('forgot password: email code + recovery words, then the new password works everywhere', async () => {
    const { a, b, words, auth } = await twoDevices();
    await a.vault.saveEntry({ ...emptyEntry(), title: 'Selamat' });
    await a.engine.sync();

    await b.account.sendRecoveryCode(EMAIL);
    await b.account.recoverWithCode(EMAIL, '123456', words.join(' '), 'password-baru-yang-panjang');
    await b.engine.sync();
    expect(b.vault.list()[0].title).toBe('Selamat');

    // Old password no longer logs in; the new one does, on a third device.
    const c = await device(new FakeServer(), auth);
    await expect(c.account.signInFresh(EMAIL, PASSWORD)).rejects.toThrow();
    const d = await device(new FakeServer(), auth);
    await d.account.signInFresh(EMAIL, 'password-baru-yang-panjang');
    expect(d.vault.unlocked).toBe(true);

    // Device A picks up the new key blob on its next sync.
    await a.engine.sync();
    a.vault.lock();
    await a.vault.unlockPassword('password-baru-yang-panjang');
  });

  it('linking a separate local journal to an existing account merges it in', async () => {
    const { a, auth } = await twoDevices();
    await a.vault.saveEntry({ ...emptyEntry(), title: 'Dari HP A' });
    await a.engine.sync();

    const server2 = a.account.auth; // same fake auth/server
    const other = await freshVault();
    await other.create('password-lokal-lain');
    await other.saveEntry({ ...emptyEntry(), title: 'Dari HP lain (lokal)' });
    const acc = new Account(other, server2, FAST_KDF);
    await acc.signInAndLink(EMAIL, PASSWORD);
    const eng = new SyncEngine(other, auth.remoteFor('user-1'));
    await eng.sync();
    expect(other.list().map((e) => e.title).sort()).toEqual(['Dari HP A', 'Dari HP lain (lokal)']);

    // Now the account password opens this device too.
    other.lock();
    await other.unlockPassword(PASSWORD);
    await a.engine.sync();
    expect(a.vault.list()).toHaveLength(2);
  });
});
