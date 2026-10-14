# Inkly — jurnal pribadi terenkripsi end-to-end

Inkly adalah aplikasi jurnal untuk HP (PWA) yang **hanya bisa dibaca oleh pemiliknya**. Semua isi jurnal (teks, mood, tag, foto, hiasan scrapbook, bahkan nama panggilan) dienkripsi di perangkat sebelum disimpan atau dikirim. Server sinkronisasi dan developer hanya pernah melihat data acak.

Penjelasan teknis keamanannya ada di [SECURITY.md](SECURITY.md).

## Fitur

- **Menulis jurnal**: judul, isi, mood (8 pilihan), tag, tanggal yang bisa diubah, favorit, simpan otomatis.
- **Template & ide tulisan**: 8 template (rasa syukur, refleksi, niat pagi, dll.) dan 30 pertanyaan harian.
- **Foto**: data lokasi GPS dan kamera dihapus dengan meng-encode ulang foto, lalu foto dienkripsi.
- **Scrapbook**: stiker, kata-kata, foto polaroid, washi tape, dan tulisan tangan. Geser dengan satu jari; cubit dengan dua jari untuk memperbesar dan memutar.
- **Kalender** dengan emoji mood per hari, **statistik** (streak, jumlah kata, tren mood 30 hari, mood terbanyak, hari favorit, tag populer), dan **kenangan di tanggal ini**.
- **Pencarian** lokal (judul, isi, tag, mood).
- **Keamanan**: password + 24 kata recovery key, PIN untuk buka cepat, kunci otomatis, layar diburamkan saat aplikasi ditinggal.
- **Sinkronisasi opsional** lewat Supabase, dengan penanganan bentrok edit tanpa kehilangan tulisan.
- **Backup terenkripsi** (.inkly), pemulihan/penggabungan backup, ekspor Markdown.
- **Pengingat harian** lewat kalender HP (.ics), tanpa server push.
- **PWA**: bisa dipasang ke layar utama, jalan offline, mode terang/gelap.

## Menjalankan di komputer

Butuh Node.js 20 atau lebih baru.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 25 test: kripto, vault, sync, uji kebocoran
npm run build      # hasil build ke folder docs/
```

Tanpa konfigurasi Supabase, aplikasi tetap berjalan penuh dalam mode lokal (tanpa sinkronisasi).

## Menyiapkan Supabase (untuk sinkronisasi)

1. Buat project gratis di [supabase.com](https://supabase.com).
2. Buka **SQL Editor → New query**, tempel isi [`supabase/setup.sql`](supabase/setup.sql), lalu klik **Run**. Skrip ini membuat tabel, aturan akses (Row Level Security), fungsi sinkronisasi, dan bucket foto privat.
3. Di **Authentication → Email Templates → Magic Link**, pastikan isi email memuat kode `{{ .Token }}`, misalnya:
   `Kode pemulihan Inkly kamu: {{ .Token }}`. Kode ini dipakai di alur "Lupa password".
4. Di **Authentication → URL Configuration**, isi **Site URL** dengan alamat aplikasi, misalnya `https://ram-id.github.io/inkly/`.
5. Salin **Project URL** dan **anon public key** dari **Project Settings → API**, lalu buat file `.env.local`:

   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```

   *Anon key* memang dirancang untuk dipasang di aplikasi; aksesnya dibatasi oleh Row Level Security. **Jangan pernah** memasukkan `service_role` key ke aplikasi.
6. Jalankan `npm run build` lagi. Domain Supabase otomatis dimasukkan ke Content-Security-Policy.

## Deploy ke GitHub Pages

Repo ini sudah diatur agar GitHub Pages menyajikan folder `docs/` dari branch `main`.

```bash
npm run build
git add -A
git commit -m "Build Inkly"
git push
```

Aplikasi akan tersedia di `https://ram-id.github.io/inkly/`. Buka alamat itu di HP, lalu pilih **Tambah ke Layar Utama** (Safari) atau **Pasang aplikasi** (Chrome).

## Struktur kode

```
src/crypto/     primitif kripto, hierarki kunci, recovery key BIP-39
src/storage/    vault terenkripsi di IndexedDB, PIN, backup
src/sync/       sinkronisasi ciphertext (Supabase) & alur akun
src/domain/     model data, template, stiker, statistik
src/media/      pemrosesan foto (hapus metadata)
src/ui/         tampilan (Preact)
supabase/       skema server
test/           test otomatis, termasuk uji kebocoran ke server
legacy/         prototipe lama (referensi saja, tidak dipakai)
```
