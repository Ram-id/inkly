import type { SupabaseClient } from '@supabase/supabase-js';
import type { KeyBlob } from '../crypto/keys';

/**
 * What the sync server is allowed to see: random ids, revision numbers, base64 ciphertext,
 * a deleted flag and the wrapped key blob. Nothing else is ever sent.
 */

export interface RemoteObject {
  id: string;
  rev: number;
  ct: string | null;
  deleted: boolean;
  seq: number;
}

export interface PushItem {
  id: string;
  base_rev: number;
  ct: string | null;
  deleted: boolean;
}

export interface PushResult {
  id: string;
  ok: boolean;
  /** new revision on success; the server's current revision on conflict */
  rev: number;
}

export interface Remote {
  getKeyBlob(): Promise<KeyBlob | null>;
  putKeyBlob(blob: KeyBlob): Promise<void>;
  push(items: PushItem[]): Promise<PushResult[]>;
  pull(since: number, limit: number): Promise<RemoteObject[]>;
  putMedia(id: string, ct: Uint8Array): Promise<void>;
  getMedia(id: string): Promise<Uint8Array | null>;
  deleteMedia(ids: string[]): Promise<void>;
}

export const MEDIA_BUCKET = 'inkly-media';

export class AuthExpiredError extends Error {
  constructor() {
    super('Sesi akun berakhir. Masuk lagi untuk melanjutkan sinkronisasi.');
    this.name = 'AuthExpiredError';
  }
}

function check<T>(res: { data: T; error: { message: string; status?: number; code?: string } | null }): T {
  if (res.error) {
    const status = (res.error as { status?: number }).status;
    if (status === 401 || res.error.code === 'PGRST301') throw new AuthExpiredError();
    throw new Error(res.error.message);
  }
  return res.data;
}

export class SupabaseRemote implements Remote {
  constructor(
    private sb: SupabaseClient,
    private userId: string
  ) {}

  async getKeyBlob(): Promise<KeyBlob | null> {
    const data = check(await this.sb.from('inkly_keys').select('blob').maybeSingle());
    return (data?.blob as KeyBlob) ?? null;
  }

  async putKeyBlob(blob: KeyBlob): Promise<void> {
    check(await this.sb.from('inkly_keys').upsert({ user_id: this.userId, blob }));
  }

  async push(items: PushItem[]): Promise<PushResult[]> {
    return check(await this.sb.rpc('inkly_push', { items })) as PushResult[];
  }

  async pull(since: number, limit: number): Promise<RemoteObject[]> {
    const data = check(
      await this.sb.from('inkly_objects').select('id,rev,ct,deleted,seq').gt('seq', since).order('seq').limit(limit)
    );
    return (data ?? []) as RemoteObject[];
  }

  async putMedia(id: string, ct: Uint8Array): Promise<void> {
    check(
      await this.sb.storage
        .from(MEDIA_BUCKET)
        .upload(`${this.userId}/${id}`, new Blob([ct as BlobPart]), { upsert: true, contentType: 'application/octet-stream' })
    );
  }

  async getMedia(id: string): Promise<Uint8Array | null> {
    const res = await this.sb.storage.from(MEDIA_BUCKET).download(`${this.userId}/${id}`);
    if (res.error || !res.data) return null;
    return new Uint8Array(await res.data.arrayBuffer());
  }

  async deleteMedia(ids: string[]): Promise<void> {
    if (!ids.length) return;
    check(await this.sb.storage.from(MEDIA_BUCKET).remove(ids.map((id) => `${this.userId}/${id}`)));
  }

  async deleteAllMedia(): Promise<void> {
    for (;;) {
      const list = check(await this.sb.storage.from(MEDIA_BUCKET).list(this.userId, { limit: 100 }));
      if (!list?.length) return;
      await this.deleteMedia(list.map((f) => f.name));
    }
  }
}
