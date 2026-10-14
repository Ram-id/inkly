-- Inkly: skema server sinkronisasi (Supabase / Postgres).
-- Jalankan sekali di Supabase Dashboard → SQL Editor → New query → Run.
--
-- Server ini sengaja "bodoh": ia hanya menyimpan ciphertext, nomor revisi, dan bendera hapus.
-- Tidak ada kolom judul, isi, mood, tag, atau tanggal jurnal — data itu hanya ada di dalam ciphertext.

create sequence if not exists public.inkly_seq;

-- Wrapped Vault Master Key per akun (tidak bisa dibuka tanpa password atau 24 kata recovery).
create table if not exists public.inkly_keys (
  user_id    uuid primary key default auth.uid() references auth.users on delete cascade,
  blob       jsonb not null,
  updated_at timestamptz not null default now()
);

-- Objek terenkripsi (jurnal & pengaturan). id = UUID acak dari aplikasi.
create table if not exists public.inkly_objects (
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  id         text not null check (char_length(id) <= 64),
  rev        integer not null,
  ct         text check (char_length(ct) <= 4000000),
  deleted    boolean not null default false,
  seq       bigint not null default nextval('public.inkly_seq'),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists inkly_objects_seq on public.inkly_objects (user_id, seq);

alter table public.inkly_keys enable row level security;
alter table public.inkly_objects enable row level security;

-- Setiap akun hanya bisa melihat dan mengubah barisnya sendiri.
drop policy if exists "own keys" on public.inkly_keys;
create policy "own keys" on public.inkly_keys
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "own objects read" on public.inkly_objects;
create policy "own objects read" on public.inkly_objects
  for select to authenticated
  using (user_id = (select auth.uid()));
-- Tidak ada policy insert/update/delete langsung: penulisan hanya lewat fungsi inkly_push
-- supaya aturan revisi (compare-and-swap) tidak bisa dilewati.

-- Push batch dengan compare-and-swap per objek.
-- items: [{ "id": text, "base_rev": int, "ct": text|null, "deleted": bool }]
-- hasil: [{ "id": text, "ok": bool, "rev": int }]
create or replace function public.inkly_push(items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  item jsonb;
  out jsonb := '[]'::jsonb;
  v_id text;
  v_base int;
  v_rev int;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if jsonb_array_length(items) > 100 then
    raise exception 'batch too large';
  end if;

  for item in select * from jsonb_array_elements(items) loop
    v_id := item->>'id';
    v_base := (item->>'base_rev')::int;
    v_rev := null;

    if v_base = 0 then
      if (item->>'deleted')::boolean then
        -- Dihapus sebelum pernah tersimpan di server: tidak perlu menyimpan apa pun.
        out := out || jsonb_build_object('id', v_id, 'ok', true, 'rev', 0);
        continue;
      end if;
      insert into public.inkly_objects (user_id, id, rev, ct, deleted)
      values (uid, v_id, 1, item->>'ct', false)
      on conflict (user_id, id) do nothing
      returning rev into v_rev;
    else
      update public.inkly_objects
         set rev = rev + 1,
             ct = case when (item->>'deleted')::boolean then null else item->>'ct' end,
             deleted = (item->>'deleted')::boolean,
             seq = nextval('public.inkly_seq'),
             updated_at = now()
       where user_id = uid and id = v_id and rev = v_base
      returning rev into v_rev;
    end if;

    if v_rev is null then
      select rev into v_rev from public.inkly_objects where user_id = uid and id = v_id;
      out := out || jsonb_build_object('id', v_id, 'ok', false, 'rev', coalesce(v_rev, 0));
    else
      out := out || jsonb_build_object('id', v_id, 'ok', true, 'rev', v_rev);
    end if;
  end loop;
  return out;
end;
$$;

revoke all on function public.inkly_push(jsonb) from public, anon;
grant execute on function public.inkly_push(jsonb) to authenticated;

-- Hapus akun sendiri beserta semua data (tabel di atas ikut terhapus lewat ON DELETE CASCADE).
-- Foto di Storage dihapus oleh aplikasi sebelum fungsi ini dipanggil.
create or replace function public.inkly_delete_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.inkly_delete_account() from public, anon;
grant execute on function public.inkly_delete_account() to authenticated;

-- Penyimpanan foto terenkripsi. Bucket privat; path = <user_id>/<photo_id>.
insert into storage.buckets (id, name, public, file_size_limit)
values ('inkly-media', 'inkly-media', false, 10485760)
on conflict (id) do update set public = false;

drop policy if exists "inkly media own read" on storage.objects;
create policy "inkly media own read" on storage.objects
  for select to authenticated
  using (bucket_id = 'inkly-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "inkly media own insert" on storage.objects;
create policy "inkly media own insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'inkly-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "inkly media own update" on storage.objects;
create policy "inkly media own update" on storage.objects
  for update to authenticated
  using (bucket_id = 'inkly-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "inkly media own delete" on storage.objects;
create policy "inkly media own delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'inkly-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
