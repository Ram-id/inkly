import type { KdfParams, KeyBlob } from '../src/crypto/keys';
import { Vault } from '../src/storage/vault';
import type { AuthProvider } from '../src/sync/account';
import type { PushItem, PushResult, Remote, RemoteObject } from '../src/sync/remote';

/** Tiny Argon2 cost so tests run fast. Production uses DEFAULT_KDF (64 MiB). */
export const FAST_KDF: KdfParams = { alg: 'argon2id', m: 64, t: 1, p: 1 };

let dbCounter = 0;
export async function freshVault(): Promise<Vault> {
  return Vault.open(`test-${Date.now()}-${dbCounter++}`, FAST_KDF);
}

/**
 * In-memory stand-in for the Supabase server with the same compare-and-swap rules as
 * supabase/setup.sql. It records every byte it receives so tests can look for leaks.
 */
export class FakeServer {
  keyBlobs = new Map<string, KeyBlob>();
  objects = new Map<string, { userId: string; id: string; rev: number; ct: string | null; deleted: boolean; seq: number }>();
  media = new Map<string, Uint8Array>();
  traffic: string[] = [];
  private seq = 0;

  remote(userId: string): Remote {
    const log = (label: string, data: unknown) =>
      this.traffic.push(`${label} ${typeof data === 'string' ? data : JSON.stringify(data, (_k, v) => (v instanceof Uint8Array ? Buffer.from(v).toString('base64') : v))}`);
    return {
      getKeyBlob: async () => this.keyBlobs.get(userId) ?? null,
      putKeyBlob: async (blob) => {
        log('putKeyBlob', blob);
        this.keyBlobs.set(userId, blob);
      },
      push: async (items: PushItem[]): Promise<PushResult[]> => {
        log('push', items);
        return items.map((it) => {
          const key = `${userId}:${it.id}`;
          const cur = this.objects.get(key);
          if (it.base_rev === 0) {
            if (it.deleted) return { id: it.id, ok: true, rev: 0 };
            if (cur) return { id: it.id, ok: false, rev: cur.rev };
            this.objects.set(key, { userId, id: it.id, rev: 1, ct: it.ct, deleted: false, seq: ++this.seq });
            return { id: it.id, ok: true, rev: 1 };
          }
          if (!cur || cur.rev !== it.base_rev) return { id: it.id, ok: false, rev: cur?.rev ?? 0 };
          const next = { ...cur, rev: cur.rev + 1, ct: it.deleted ? null : it.ct, deleted: it.deleted, seq: ++this.seq };
          this.objects.set(key, next);
          return { id: it.id, ok: true, rev: next.rev };
        });
      },
      pull: async (since: number, limit: number): Promise<RemoteObject[]> =>
        [...this.objects.values()]
          .filter((o) => o.userId === userId && o.seq > since)
          .sort((a, b) => a.seq - b.seq)
          .slice(0, limit)
          .map(({ id, rev, ct, deleted, seq }) => ({ id, rev, ct, deleted, seq })),
      putMedia: async (id, ct) => {
        log('putMedia', ct);
        this.media.set(`${userId}/${id}`, ct);
      },
      getMedia: async (id) => this.media.get(`${userId}/${id}`) ?? null,
      deleteMedia: async (ids) => {
        for (const id of ids) this.media.delete(`${userId}/${id}`);
      }
    };
  }
}

/** Fake auth that behaves like Supabase: it stores whatever "password" the client sends. */
export class FakeAuth implements AuthProvider {
  users = new Map<string, { id: string; secret: string }>();
  current: string | null = null;
  pendingCodes = new Map<string, string>();

  constructor(private server: FakeServer) {}

  async signUp(email: string, secret: string) {
    this.server.traffic.push(`signUp ${email} ${secret}`);
    if (this.users.has(email)) throw new Error('Email ini sudah terdaftar.');
    const id = `user-${this.users.size + 1}`;
    this.users.set(email, { id, secret });
    this.current = id;
    return { userId: id, needsConfirmation: false };
  }
  async signIn(email: string, secret: string) {
    this.server.traffic.push(`signIn ${email} ${secret}`);
    const u = this.users.get(email);
    if (!u || u.secret !== secret) throw new Error('Email atau password salah.');
    this.current = u.id;
    return { userId: u.id };
  }
  async sendCode(email: string) {
    this.pendingCodes.set(email, '123456');
  }
  async verifyCode(email: string, code: string) {
    if (this.pendingCodes.get(email) !== code) throw new Error('Kode salah.');
    const u = this.users.get(email)!;
    this.current = u.id;
    return { userId: u.id };
  }
  async updateSecret(secret: string) {
    this.server.traffic.push(`updateSecret ${secret}`);
    for (const u of this.users.values()) if (u.id === this.current) u.secret = secret;
  }
  async signOut() {
    this.current = null;
  }
  async currentUserId() {
    return this.current;
  }
  async deleteAccount() {
    for (const [k, o] of this.server.objects) if (o.userId === this.current) this.server.objects.delete(k);
  }
  remoteFor(userId: string) {
    return this.server.remote(userId);
  }
}
