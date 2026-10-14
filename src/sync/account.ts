import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  DEFAULT_KDF,
  deriveAuthSecret,
  normalizeEmail,
  unlockWithPassword,
  unlockWithRecovery,
  WrongSecretError,
  type KdfParams,
  type KeyBlob
} from '../crypto/keys';
import { deleteMeta, getMeta, setMeta, type SyncMeta } from '../storage/db';
import type { Vault } from '../storage/vault';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../config';
import { SupabaseRemote, type Remote } from './remote';

/** The account side: who you are to the sync server. It never handles journal keys. */
export interface AuthProvider {
  signUp(email: string, secret: string): Promise<{ userId: string | null; needsConfirmation: boolean }>;
  signIn(email: string, secret: string): Promise<{ userId: string }>;
  sendCode(email: string): Promise<void>;
  verifyCode(email: string, code: string): Promise<{ userId: string }>;
  updateSecret(secret: string): Promise<void>;
  signOut(): Promise<void>;
  currentUserId(): Promise<string | null>;
  deleteAccount(): Promise<void>;
  remoteFor(userId: string): Remote;
}

function friendly(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login')) return 'Email atau password salah.';
  if (m.includes('email not confirmed')) return 'Email belum dikonfirmasi. Buka email dari Inkly lalu klik tautan konfirmasi.';
  if (m.includes('already registered')) return 'Email ini sudah terdaftar. Pilih "Masuk" di layar awal.';
  if (m.includes('rate limit') || m.includes('security purposes')) return 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.';
  if (m.includes('token has expired') || m.includes('invalid')) return 'Kode salah atau sudah kedaluwarsa.';
  if (m.includes('failed to fetch') || m.includes('network')) return 'Tidak bisa terhubung ke server. Periksa koneksi internet.';
  return message;
}

export class SupabaseAuth implements AuthProvider {
  readonly sb: SupabaseClient;

  constructor(url = SUPABASE_URL, anonKey = SUPABASE_ANON_KEY) {
    this.sb = createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'inkly-auth' }
    });
  }

  /** Unwraps a Supabase `{ data, error }` result, turning errors into friendly messages. */
  private ok<R extends { data: unknown; error: { message: string } | null }>(res: R): NonNullable<Extract<R, { error: null }>['data']> {
    if (res.error) throw new Error(friendly(res.error.message));
    return res.data as NonNullable<Extract<R, { error: null }>['data']>;
  }

  async signUp(email: string, secret: string) {
    const data = this.ok(await this.sb.auth.signUp({ email, password: secret }));
    // Supabase hides whether an email already exists: an existing user comes back with no identities.
    if (data.user && data.user.identities?.length === 0) throw new Error(friendly('already registered'));
    return { userId: data.session?.user.id ?? null, needsConfirmation: !data.session };
  }

  async signIn(email: string, secret: string) {
    const data = this.ok(await this.sb.auth.signInWithPassword({ email, password: secret }));
    return { userId: data.user.id };
  }

  async sendCode(email: string) {
    this.ok(await this.sb.auth.signInWithOtp({ email, options: { shouldCreateUser: false } }));
  }

  async verifyCode(email: string, code: string) {
    const data = this.ok(await this.sb.auth.verifyOtp({ email, token: code.trim(), type: 'email' }));
    if (!data.user) throw new Error('Kode tidak valid.');
    return { userId: data.user.id };
  }

  async updateSecret(secret: string) {
    this.ok(await this.sb.auth.updateUser({ password: secret }));
  }

  async signOut() {
    await this.sb.auth.signOut({ scope: 'local' });
  }

  async currentUserId() {
    const { data } = await this.sb.auth.getSession();
    return data.session?.user.id ?? null;
  }

  async deleteAccount() {
    const userId = await this.currentUserId();
    if (!userId) throw new Error('Tidak ada akun yang sedang masuk.');
    await new SupabaseRemote(this.sb, userId).deleteAllMedia();
    this.ok(await this.sb.rpc('inkly_delete_account'));
    await this.sb.auth.signOut({ scope: 'local' });
  }

  remoteFor(userId: string): Remote {
    return new SupabaseRemote(this.sb, userId);
  }
}

/**
 * Flows that combine the account with the vault. The rule throughout: the password and the
 * recovery words are only ever used locally; the server receives the derived auth secret
 * (for login) and the wrapped key blob (useless on its own).
 */
export class Account {
  constructor(
    private vault: Vault,
    readonly auth: AuthProvider,
    private kdf: KdfParams = DEFAULT_KDF
  ) {}

  async meta(): Promise<SyncMeta | undefined> {
    return getMeta(this.vault.db, 'sync');
  }

  private async saveMeta(userId: string, email: string): Promise<SyncMeta> {
    const meta: SyncMeta = { userId, email: normalizeEmail(email), cursor: 0, lastSyncAt: null, keyblobDirty: false };
    await setMeta(this.vault.db, 'sync', meta);
    return meta;
  }

  async remote(): Promise<Remote | null> {
    const meta = await this.meta();
    return meta ? this.auth.remoteFor(meta.userId) : null;
  }

  /** Step 1 of turning on sync from a device that already has a journal. */
  async register(email: string, password: string): Promise<'linked' | 'confirm-email'> {
    await unlockWithPassword(this.vault.keyBlob!, password); // proves the password before we use it
    const secret = await deriveAuthSecret(email, password, this.kdf);
    const res = await this.auth.signUp(normalizeEmail(email), secret);
    if (res.needsConfirmation || !res.userId) return 'confirm-email';
    await this.link(res.userId, email, password);
    return 'linked';
  }

  /** Signs in and links this device's journal to the account. */
  async signInAndLink(email: string, password: string): Promise<void> {
    const secret = await deriveAuthSecret(email, password, this.kdf);
    const { userId } = await this.auth.signIn(normalizeEmail(email), secret);
    await this.link(userId, email, password);
  }

  private async link(userId: string, email: string, password: string): Promise<void> {
    const remote = this.auth.remoteFor(userId);
    const remoteBlob = await remote.getKeyBlob();
    if (!remoteBlob) {
      await remote.putKeyBlob(this.vault.keyBlob!);
    } else if (remoteBlob.byRecovery !== this.vault.keyBlob!.byRecovery) {
      // The account already holds a journal (made on another device). Move this device's
      // entries under that journal's key so both end up in one place.
      const vmk = await unlockWithPassword(remoteBlob, password).catch(() => {
        throw new WrongSecretError('Akun ini sudah punya jurnal dengan password lain. Masuk dengan password akun tersebut.');
      });
      const current = this.vault.exportVmk();
      const sameVault = current.every((b, i) => b === vmk[i]);
      current.fill(0);
      if (sameVault) {
        vmk.fill(0);
        await this.vault.setKeyBlob(remoteBlob); // same journal, newer wrapper (e.g. rotated recovery key)
      } else {
        await this.vault.adoptVault(remoteBlob, vmk);
      }
    }
    await this.saveMeta(userId, email);
  }

  /** New device: download the key blob and open the journal with the password. */
  async signInFresh(email: string, password: string): Promise<void> {
    const secret = await deriveAuthSecret(email, password, this.kdf);
    const { userId } = await this.auth.signIn(normalizeEmail(email), secret);
    const remote = this.auth.remoteFor(userId);
    const blob = await remote.getKeyBlob();
    if (!blob) {
      await this.auth.signOut();
      throw new Error('Akun ini belum punya jurnal. Buat jurnal baru dulu, lalu aktifkan sinkronisasi.');
    }
    const vmk = await unlockWithPassword(blob, password);
    await this.vault.setKeyBlob(blob);
    await this.vault.unlockVmk(vmk);
    await this.saveMeta(userId, email);
  }

  async sendRecoveryCode(email: string): Promise<void> {
    await this.auth.sendCode(normalizeEmail(email));
  }

  /**
   * Forgot password: the email code proves you own the account (which only gives access to
   * ciphertext); the 24 recovery words open the journal; then a new password is set.
   */
  async recoverWithCode(email: string, code: string, words: string, newPassword: string): Promise<void> {
    const { userId } = await this.auth.verifyCode(normalizeEmail(email), code);
    const remote = this.auth.remoteFor(userId);
    const blob = await remote.getKeyBlob();
    if (!blob) throw new Error('Akun ini belum punya jurnal tersimpan.');
    const vmk = unlockWithRecovery(blob, words);
    await this.vault.setKeyBlob(blob);
    await this.vault.unlockVmk(vmk);
    const next = await this.vault.changePassword(newPassword);
    await this.auth.updateSecret(await deriveAuthSecret(email, newPassword, this.kdf));
    await remote.putKeyBlob(next);
    await this.saveMeta(userId, email);
  }

  /** Password change while unlocked. Keeps account login and key blob in step. */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const before = this.vault.keyBlob!;
    await unlockWithPassword(before, currentPassword);
    const next = await this.vault.changePassword(newPassword);
    const meta = await this.meta();
    if (!meta) return;
    try {
      await this.auth.updateSecret(await deriveAuthSecret(meta.email, newPassword, this.kdf));
    } catch (e) {
      await this.vault.setKeyBlob(before);
      throw e;
    }
    await this.uploadKeyBlob(next, meta);
  }

  async newRecoveryKey(password: string): Promise<string[]> {
    await unlockWithPassword(this.vault.keyBlob!, password);
    const { blob, words } = await this.vault.newRecoveryKey();
    const meta = await this.meta();
    if (meta) await this.uploadKeyBlob(blob, meta);
    return words;
  }

  private async uploadKeyBlob(blob: KeyBlob, meta: SyncMeta): Promise<void> {
    try {
      await this.auth.remoteFor(meta.userId).putKeyBlob(blob);
    } catch {
      await setMeta(this.vault.db, 'sync', { ...meta, keyblobDirty: true });
    }
  }

  /** Stops syncing on this device. The journal stays here and on the server. */
  async unlink(): Promise<void> {
    await this.auth.signOut();
    await deleteMeta(this.vault.db, 'sync');
  }

  async deleteAccount(): Promise<void> {
    await this.auth.deleteAccount();
    await deleteMeta(this.vault.db, 'sync');
  }
}
