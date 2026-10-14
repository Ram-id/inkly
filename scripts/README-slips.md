# Isi botol perasaan

Isi gulungan kertas (`src/domain/slips.ts`) dibuat sekali dengan Gemini, dikurasi, lalu disimpan sebagai data tetap. Aplikasi **tidak** memanggil AI saat dipakai dan tidak mengirim isi jurnal ke mana pun.

Membuat ulang (API key hanya lewat variabel lingkungan, jangan pernah di-commit):

```bash
GEMINI_KEY=... node scripts/generate-slips.mjs slips-out
GEMINI_KEY=... node scripts/generate-slips.mjs slips-out sedih,cemas   # emosi tertentu saja
node scripts/build-slips.mjs slips-out src/domain/slips.ts
```

Kalimat yang ingin dibuang bisa ditulis di `slips-out/drop.json` (array teks persis) sebelum menjalankan `build-slips`.
