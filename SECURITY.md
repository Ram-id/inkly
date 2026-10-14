# Keamanan Inkly

Tujuan Inkly: **isi jurnal hanya bisa dibaca oleh pemilik akun**, dan developer atau pengelola server tidak punya jalur untuk membacanya. Dokumen ini menjelaskan cara kerjanya, apa yang dijamin, dan apa yang **tidak** dijamin.

> Inkly belum diaudit oleh pihak independen. Desainnya mengikuti praktik umum aplikasi E2EE (mirip Bitwarden/Standard Notes) dan memakai library kripto yang sudah diaudit, tetapi klaim keamanan sebaiknya diverifikasi oleh auditor sebelum dipakai untuk data yang sangat sensitif.

## Hierarki kunci

```
password ──Argon2id (64 MiB, t=3, salt acak)──HKDF──► pwKEK ──┐
                                                             ├─ masing-masing membungkus VMK
24 kata recovery (256 bit, BIP-39) ──HKDF──────────► rkKEK ──┘

VMK (Vault Master Key, 256 bit acak)
 ├─HKDF─► dataKey   → jurnal & pengaturan
 ├─HKDF─► mediaKey  → foto
 └─HKDF─► metaKey   → salinan recovery key (agar bisa dilihat lagi setelah login)

password ──Argon2id (salt = SHA-256(email))──HKDF──► authSecret → satu-satunya yang dikirim ke Supabase saat login
```

- **Enkripsi**: XChaCha20-Poly1305 (`@noble/ciphers`, diaudit) dengan nonce acak 192 bit. Setiap objek diikat ke ID-nya lewat *associated data*, jadi server tidak bisa menukar isi dua jurnal tanpa ketahuan.
- **Penurunan kunci**: Argon2id (`hash-wasm`) dan HKDF-SHA256 (`@noble/hashes`).
- **Recovery key**: 24 kata BIP-39 (`@scure/bip39`) dengan checksum untuk mendeteksi salah ketik.
- **Padding**: isi jurnal dibulatkan ke kelipatan 512 byte dan foto ke kelipatan 16 KiB, supaya ukuran persisnya tidak terlihat.
- **Login**: `authSecret` diturunkan dengan salt dan label berbeda dari kunci enkripsi. Server menyimpan hash bcrypt dari `authSecret`; dari situ server tidak bisa menghitung `pwKEK`.

## Yang dilihat server

| Data | Terlihat oleh server? |
|---|---|
| Judul, isi, mood, tag, tanggal jurnal, foto, scrapbook, nama panggilan | Tidak, hanya ciphertext |
| Password, 24 kata recovery, VMK | Tidak pernah dikirim |
| Email akun | Ya (untuk login) |
| Jumlah objek, ukuran kasar (setelah padding), waktu sinkron | Ya |
| ID objek | Ya, tetapi berupa UUID acak tanpa makna |

Test `test/sync.test.ts` memeriksa seluruh lalu lintas ke server palsu dan memastikan tidak ada teks jurnal, tag, mood, nama, byte foto, password, recovery key, maupun VMK di dalamnya. Test `test/vault.test.ts` melakukan hal yang sama untuk penyimpanan di perangkat.

## Perlindungan lain

- **Penyimpanan perangkat (IndexedDB)** hanya berisi ciphertext. Kunci hanya ada di memori saat jurnal terbuka, dan dihapus saat terkunci.
- **Kunci otomatis** saat aplikasi ditinggal (bisa diatur: langsung/1/5/15 menit). Layar diburamkan saat aplikasi masuk latar belakang.
- **PIN** (opsional, per perangkat): VMK dibungkus dengan kunci dari PIN (Argon2id), lalu dibungkus lagi dengan kunci WebCrypto *non-extractable* milik browser tersebut. Setelah 5 kali salah, PIN dihapus dan password wajib dipakai.
- **Sinkronisasi** memakai compare-and-swap per revisi. Kalau dua perangkat mengedit jurnal yang sama, kedua versi disimpan (yang satu sebagai "salinan dari perangkat ini"), tidak ada yang tertimpa diam-diam.
- **Row Level Security** di Supabase: setiap akun hanya bisa membaca barisnya sendiri; penulisan hanya lewat fungsi `inkly_push`.
- **Content-Security-Policy** di build produksi: hanya kode Inkly sendiri yang boleh berjalan, dan koneksi hanya ke origin sendiri + project Supabase. Tidak ada skrip, font, atau CDN pihak ketiga.
- **Foto** di-encode ulang lewat canvas sebelum dienkripsi, sehingga semua metadata (EXIF, GPS, XMP) hilang.

## Yang TIDAK dijamin (batasan jujur)

1. **Lupa password + kehilangan recovery key = jurnal hilang permanen.** Tidak ada "reset oleh admin"; itulah harga dari zero-knowledge.
2. **Password lemah bisa ditebak secara offline** oleh siapa pun yang mendapat salinan data server (wrapped VMK). Argon2id membuat setiap tebakan mahal, tetapi password panjang dan unik tetap wajib. Aplikasi meminta minimal 10 karakter dan menampilkan indikator kekuatan.
3. **Kepercayaan pada kode yang dimuat.** Inkly adalah aplikasi web: siapa pun yang bisa mengubah kode yang disajikan (pemilik repo/hosting) secara teori bisa menyisipkan kode pencuri kunci. Mitigasinya: kode terbuka di GitHub, build yang bisa direproduksi, dan service worker yang menyimpan versi yang sudah terpasang. Aplikasi native pun punya risiko serupa lewat update.
4. **Perangkat yang sudah disusupi** (malware, keylogger, akses fisik saat jurnal terbuka) berada di luar cakupan perlindungan.
5. **PIN hanya kemudahan.** Penyerang yang menyalin seluruh profil browser bisa mencoba 1 juta kombinasi PIN secara offline. Untuk ancaman seperti itu, matikan PIN dan pakai password.
6. **JavaScript tidak bisa menjamin penghapusan memori** sepenuhnya (garbage collector, string). Inkly menghapus buffer kunci yang dipegangnya, tetapi salinan sementara di memori browser mungkin tetap ada sampai ditimpa.
7. **Rotasi recovery key** mengganti pembungkus VMK, bukan VMK itu sendiri. Kalau seseorang sudah pernah mendapat VMK (misalnya dari recovery key lama dan salinan blob lama), rotasi tidak mencabut aksesnya ke data lama. Rotasi VMK penuh (enkripsi ulang semua data) belum diimplementasikan.
8. **Metadata** (email, jumlah dan waktu sinkron, ukuran kasar) tetap terlihat oleh server.

## Melaporkan masalah keamanan

Laporkan secara privat ke pemilik repositori, bukan lewat issue publik.
