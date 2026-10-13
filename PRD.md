# PRD --- Inkly: Aplikasi Journaling Digital Zero-Knowledge

**Versi:** 1.0  
**Tanggal:** 13 Oktober 2026  
**Status:** Draft siap dieksekusi di Antigravity  
**Platform:** Android dan iOS  
**Pendekatan:** Mobile-first, local-first, end-to-end encryption (E2EE), zero-knowledge cloud sync  

---

## 1. Ringkasan Produk

Inkly adalah aplikasi journaling digital pribadi untuk Android dan iOS. Pengguna dapat menulis jurnal, menghias halaman dengan stiker dan dekorasi, menambahkan foto/lampiran, menggunakan template, mencatat mood, melihat kalender dan statistik, serta memilih penyimpanan lokal atau sinkronisasi cloud terenkripsi.

Privasi adalah prinsip arsitektur utama. Isi jurnal, foto, lampiran, mood, tag, judul, dan tata letak pribadi harus dienkripsi di perangkat sebelum disimpan atau dikirim. Backend hanya mengelola akun, ciphertext, sinkronisasi, dan metadata minimum. Backend maupun developer tidak boleh memiliki kunci yang dapat mendekripsi konten pengguna.

> **Pernyataan keamanan yang harus dipenuhi:** sistem dirancang agar developer tidak memiliki jalur normal untuk membaca jurnal. Jangan mengklaim keamanan 100% atau zero-knowledge yang telah terverifikasi sebelum audit independen dan pengujian implementasi selesai.

## 2. Visi dan Tujuan

### 2.1 Visi
Membuat jurnal digital yang ekspresif, personal, menyenangkan untuk dihias, dan memiliki privasi yang kuat secara default.

### 2.2 Tujuan produk
1. Membuat pengalaman menulis jurnal yang nyaman di layar ponsel.
2. Menyediakan editor scrapbook dengan stiker, foto, teks, warna, template, dan elemen dekoratif.
3. Mendukung mode lokal tanpa akun dan mode cloud sync opsional.
4. Memastikan konten pribadi dienkripsi sebelum keluar dari perangkat.
5. Memungkinkan pemulihan lintas perangkat hanya melalui recovery key yang dikendalikan pengguna.
6. Menghilangkan kemampuan admin/developer untuk mendekripsi konten melalui backend.
7. Memberikan UX yang jelas tentang kehilangan recovery key dan konsekuensi pemulihan.

### 2.3 Bukan tujuan MVP
- Kolaborasi jurnal real-time.
- Berbagi jurnal publik atau feed sosial.
- AI cloud yang membaca isi jurnal.
- Pemulihan konten oleh customer support.
- Fitur komunitas, chat, atau profil publik.
- Klaim keamanan bersertifikasi sebelum audit dilakukan.

## 3. Pengguna Sasaran dan Prinsip UX

### Pengguna sasaran
- Pengguna yang ingin menulis refleksi pribadi dan diary harian.
- Pengguna yang suka scrapbook, stiker, foto, mood tracker, dan template.
- Pengguna yang ingin menyimpan pikiran pribadi tanpa akses dari operator layanan.

### Prinsip UX
- Mobile-first; kontrol penting mudah dijangkau ibu jari.
- Visual hangat, lembut, kreatif, dan tidak mengganggu fokus menulis.
- Menulis dan menyimpan jurnal harus cepat serta minim langkah.
- Privasi dijelaskan dengan bahasa sederhana, bukan istilah kriptografi saja.
- Jangan membuat pengguna salah mengira password akun sebagai recovery key.
- Beri peringatan yang jelas sebelum tindakan destruktif, terutama kehilangan recovery key atau penghapusan vault.

## 4. Platform dan Rekomendasi Teknologi

Teknologi final ditentukan setelah spike teknis awal. Pilih satu stack utama dan hindari mencampur dua implementasi UI tanpa alasan kuat.

### Opsi stack yang direkomendasikan untuk dievaluasi
- **Mobile:** Flutter untuk satu codebase Android/iOS, atau Kotlin Multiplatform bila tim memilih UI native. (Dapat juga mengevaluasi React Native/Expo untuk ekosistem JS/TS cross-platform).
- **Local database:** SQLite dengan enkripsi database yang teruji, ditambah enkripsi level objek untuk konten privat.
- **Cryptography:** library kriptografi teruji dan terawat, misalnya libsodium melalui binding yang kompatibel; jangan membuat algoritma sendiri.
- **Android key protection:** Android Keystore, hardware-backed bila tersedia.
- **iOS key protection:** Keychain dan Secure Enclave sesuai jenis kunci dan dukungan platform.
- **Backend:** REST API atau API setara untuk autentikasi, metadata minimum, dan sinkronisasi ciphertext.
- **Object storage:** private bucket untuk blob terenkripsi.
- **CI/CD:** secret management, signed builds, pembatasan akses signing key, dependency scanning, dan audit perubahan rilis.

### Ketentuan pemilihan stack
Sebelum implementasi penuh, buat technical spike untuk membuktikan:
1. Binding kriptografi tersedia dan terawat di Android dan iOS.
2. Format enkripsi mendukung authenticated encryption serta penanganan file besar.
3. Kunci lokal dapat dilindungi sesuai kemampuan masing-masing OS.
4. Backup OS, cache, thumbnail, log, dan crash report tidak membocorkan plaintext.
5. Format vault kompatibel untuk pemulihan lintas perangkat.
6. Ada strategi migrasi versi format ciphertext tanpa kehilangan data.

## 5. Ruang Lingkup Fitur

### 5.1 MVP --- wajib
1. Onboarding dan penjelasan privasi.
2. Pembuatan vault lokal tanpa akun.
3. Pembuatan akun cloud opsional.
4. Pembuatan dan verifikasi recovery key pribadi.
5. Penguncian aplikasi dengan PIN/biometrik.
6. Beranda jurnal dan daftar entri.
7. Editor jurnal berbasis teks.
8. Editor scrapbook sederhana: teks, gambar, stiker, warna latar, posisi, ukuran, rotasi, dan urutan lapisan.
9. Penyimpanan foto dan lampiran terenkripsi.
10. Mood harian, kalender, pencarian lokal, tag, dan filter.
11. Template jurnal dan paket stiker bawaan.
12. Mode lokal dan mode cloud sync opsional.
13. Restore vault di perangkat baru menggunakan recovery key.
14. Penghapusan entri dan penghapusan akun/cloud data.
15. Ekspor vault terenkripsi yang dikendalikan pengguna.
16. Pengaturan privasi, lock timeout, pengelolaan perangkat, dan status sinkronisasi.
17. Logging tersanitasi dan pengujian keamanan dasar.

### 5.2 Setelah MVP
- Paket stiker tambahan.
- Template buatan pengguna dan koleksi favorit.
- Widget privasi dengan konten disembunyikan secara default.
- Statistik dan insight yang dihitung sepenuhnya di perangkat.
- Pengingat journaling dengan notifikasi generik.
- Impor/ekspor format terenkripsi yang terdokumentasi.
- Dukungan multi-device yang lebih baik dan alat konflik sinkronisasi.

### 5.3 Tidak boleh dibangun
- Admin viewer untuk membaca jurnal.
- Server-side decryption atau master key global.
- Fitur "lupa recovery key, admin bisa memulihkan isi jurnal".
- Analytics yang mengirim teks jurnal, judul, mood, foto, tag, atau recovery key.
- AI cloud yang menerima plaintext tanpa desain privasi terpisah dan persetujuan eksplisit.
- Fitur impersonasi admin yang dapat membuka vault.

## 6. Arsitektur Sistem

### 6.1 Komponen
1. **Presentation layer:** beranda, editor, sticker store, kalender, mood, statistik, profil, dan pengaturan.
2. **Domain layer:** entri jurnal, media, template, mood, dan operasi vault.
3. **Crypto engine:** enkripsi/dekripsi, autentikasi ciphertext, derivasi kunci, wrapping kunci, dan validasi format.
4. **Key manager:** pembuatan, penyimpanan sementara, pembukaan, penguncian, rotasi, dan pemulihan kunci.
5. **Local vault:** database lokal, file terenkripsi, indeks privat, dan antrean sinkronisasi.
6. **Sync engine:** unggah/unduh ciphertext, versi perubahan, deteksi konflik, retry, dan penghapusan.
7. **Backend:** autentikasi akun, otorisasi objek, metadata minimum, daftar perangkat, dan API ciphertext.
8. **Object storage:** blob terenkripsi, bukan file asli.
9. **Observability:** metrik teknis tanpa isi jurnal atau material kunci.

### 6.2 Alur data
**Menulis jurnal:**
1. Pengguna menulis di editor.
2. Konten diserahkan ke crypto engine di perangkat.
3. Konten dan metadata privat dienkripsi.
4. Ciphertext disimpan di local vault.
5. Jika cloud sync aktif, ciphertext dikirim ke backend.
6. Backend tidak menerima plaintext atau kunci dekripsi.

**Membaca jurnal:**
1. Aplikasi membaca ciphertext lokal.
2. Key manager menyediakan akses kunci setelah autentikasi lokal.
3. Crypto engine memverifikasi integritas lalu mendekripsi di perangkat.
4. UI menampilkan konten.
5. Ketika aplikasi dikunci/background, aplikasi menghapus referensi sensitif sebaik mungkin dan menampilkan layar privasi.

**Mode lokal:**
- Tidak ada konten jurnal dikirim ke backend.
- Akun tidak diwajibkan.
- Backup dilakukan melalui ekspor terenkripsi yang dimulai pengguna.

**Mode cloud:**
- Ciphertext diunggah melalui TLS.
- Cloud hanya menyimpan data terenkripsi dan metadata minimum.
- Perangkat baru mengunduh ciphertext dan membuka vault secara lokal dengan recovery key.

## 7. Model Keamanan dan Ancaman

### Aset yang dilindungi
- Isi, judul, tanggal pribadi, tag, mood, dan catatan jurnal.
- Foto, video, audio, thumbnail, dan nama file.
- Layout scrapbook, posisi stiker, template privat, dan lampiran.
- Recovery key, VMK, kunci objek, dan kunci lokal.
- Token sesi dan metadata akun.

### Ancaman utama dan mitigasi
| Ancaman | Mitigasi |
| :--- | :--- |
| Kebocoran database/cloud | Semua konten privat dienkripsi di perangkat sebelum upload |
| Developer/admin membaca jurnal | Tidak ada kunci dekripsi di backend, tidak ada admin viewer, audit akses |
| Akun diambil alih | Login aman, sesi dapat dicabut, akun tidak cukup untuk membuka vault |
| Perangkat hilang | Vault terenkripsi, app lock, OS-backed key protection |
| Manipulasi ciphertext | Authenticated encryption dan validasi format/version |
| Replay/rollback | Versi perubahan, checkpoint, dan deteksi versi yang mundur bila memungkinkan |
| Penghapusan/penahanan data oleh server | Backup ciphertext pengguna, indikator sinkronisasi, dan retry |
| Kebocoran log/crash/analytics | Redaksi data, telemetry minimum, pengujian kebocoran |
| Klien aplikasi berbahaya | Signed build, review kode, kontrol rilis, dependency scanning, audit independen |
| Malware/perangkat kompromi | Jelaskan batas perlindungan; lock dan hardening mengurangi risiko tetapi tidak menghilangkannya |

### Batas keamanan
Zero-knowledge melindungi dari akses backend biasa, operator layanan, dan kebocoran ciphertext selama implementasi benar. Ini tidak menjamin perlindungan jika perangkat terinfeksi malware, OS dikompromikan, pengguna membagikan konten sendiri, atau developer mendistribusikan klien berbahaya. Server masih dapat melihat sebagian metadata operasional dan dapat menolak/menghapus data.

## 8. Desain Kriptografi dan Manajemen Kunci

### 8.1 Prinsip
- Gunakan CSPRNG untuk menghasilkan semua kunci acak.
- Gunakan authenticated encryption seperti AES-256-GCM atau XChaCha20-Poly1305 sesuai dukungan library.
- Jangan pernah menggunakan ulang nonce dengan kunci yang sama pada algoritma yang melarangnya.
- Jangan membuat algoritma, format enkripsi, atau skema derivasi kunci sendiri tanpa review ahli.
- Gunakan kunci terpisah untuk tujuan berbeda dan objek berbeda.
- Versikan format ciphertext agar perubahan protokol dapat dimigrasikan.
- Kunci tidak boleh masuk ke log, analytics, crash report, clipboard otomatis, atau request backend.

### 8.2 Hierarki kunci konseptual
- **Recovery Key (RK):** nilai acak 256-bit yang dimiliki pengguna dan tidak diunggah.
- **Vault Master Key (VMK):** kunci acak 256-bit yang melindungi kunci objek.
- **Object Key:** kunci terpisah untuk setiap entri atau lampiran.
- **Device Protection Key:** kunci atau mekanisme OS untuk melindungi salinan lokal VMK pada perangkat.
- **Wrapped VMK:** VMK terenkripsi dengan kunci yang diturunkan dari RK; dapat disimpan di cloud.

Gunakan KDF yang sesuai dan terdokumentasi untuk menghasilkan wrapping key dari RK. Recovery key berentropi tinggi sehingga tidak perlu diperlakukan seperti password manusia. Jangan menyimpan RK dalam bentuk plaintext di cloud.

### 8.3 Onboarding recovery key
1. Buat VMK dan RK secara lokal.
2. Turunkan wrapping key dari RK menggunakan KDF yang dipilih melalui review kriptografi.
3. Enkripsi VMK dan verifikasi hasil wrapping.
4. Tampilkan RK sekali dengan opsi menyalin atau menyimpan secara eksplisit setelah peringatan.
5. Minta pengguna mengonfirmasi backup RK melalui verifikasi yang tidak mengirim RK ke server.
6. Simpan wrapped VMK dan ciphertext yang diperlukan di cloud bila cloud mode dipilih.
7. Jangan mengizinkan sinkronisasi cloud dinyatakan "siap dipulihkan" sebelum proses backup RK terkonfirmasi.

### 8.4 Pemulihan lintas perangkat
1. Pengguna login ke akun cloud di perangkat baru.
2. Aplikasi mengambil wrapped VMK dan ciphertext.
3. Pengguna memasukkan RK.
4. Aplikasi membuka VMK dan memverifikasi hasilnya secara lokal.
5. Aplikasi menyimpan perlindungan lokal VMK menggunakan mekanisme OS perangkat baru.
6. Aplikasi mengunduh dan mendekripsi konten di perangkat baru.

Jika RK hilang dan tidak ada perangkat tepercaya atau backup yang dapat membuka vault, konten tidak dapat dipulihkan oleh developer. UX harus menyatakan ini secara eksplisit sebelum pengguna mengaktifkan cloud sync.

### 8.5 Rotasi dan pencabutan
- Logout menghapus sesi dan mengunci vault; jangan menjanjikan penghapusan forensik memori yang tidak dapat dijamin oleh OS.
- Pencabutan perangkat menghentikan akses cloud perangkat tersebut, tetapi tidak dapat menarik kembali plaintext atau kunci yang telah diperoleh perangkat yang sebelumnya tepercaya.
- Perubahan RK harus membungkus ulang VMK atau melakukan prosedur rotasi yang direview; tidak perlu mengenkripsi ulang seluruh jurnal jika VMK tidak berubah dan protokol mendukungnya.
- Jika VMK diduga kompromi, rancang rotasi kunci objek dan migrasi ciphertext secara terkontrol.
- Dokumentasikan konsekuensi backup lama, perangkat offline, dan perangkat yang belum tersinkron.

## 9. Enkripsi Foto dan Lampiran
- Enkripsi foto, video, audio, thumbnail, dan file hasil impor sebelum ditulis ke penyimpanan permanen atau dikirim ke cloud.
- Hapus metadata EXIF/GPS secara default atau berikan pilihan yang jelas sebelum menyimpan foto.
- Enkripsi nama file, caption, tanggal privat, dan relasi lampiran di dalam manifest terenkripsi.
- Gunakan skema streaming authenticated encryption yang teruji untuk file besar.
- Simpan MIME type, ukuran, dan informasi pemulihan di metadata terenkripsi bila memungkinkan.
- Jangan menyimpan thumbnail plaintext pada cache publik, galeri sistem, folder sementara yang tidak terlindungi, atau backup OS.
- Gunakan file sementara terenkripsi dan hapus setelah operasi selesai.
- Tangani kegagalan dekripsi dengan aman: jangan menampilkan data parsial seolah valid.
- Saat ekspor, buat arsip terenkripsi dengan format dan versi yang terdokumentasi.
- Jangan mengunggah file asli sebelum proses enkripsi selesai.

## 10. Autentikasi, Lock, dan Privasi UI

### Akun cloud
- Passkey atau mekanisme autentikasi yang teruji dapat digunakan.
- Gunakan sesi berumur terbatas, revokasi sesi, rate limiting, dan proteksi brute-force.
- Password akun tidak boleh menjadi master key yang bisa direset oleh server.
- Perubahan email/password tidak boleh secara otomatis membuka vault.

### App lock
- PIN aplikasi dan biometrik hanya mengotorisasi pembukaan kunci lokal.
- Kunci lokal dilindungi Android Keystore atau iOS Keychain sesuai kemampuan OS.
- Sediakan auto-lock setelah idle dan saat aplikasi masuk background.
- Tampilkan privacy overlay saat app switcher dibuka.
- Notifikasi hanya menggunakan teks generik seperti "Waktunya menulis jurnal", tanpa isi entri.
- Sediakan opsi menyembunyikan konten pada widget dan preview.
- Jangan mencatat input sensitif atau mengaktifkan analytics pada layar vault.

## 11. Sinkronisasi dan Konflik

### Model data sinkronisasi
Setiap objek sinkronisasi setidaknya memiliki:
- ID acak.
- Versi format ciphertext.
- Ciphertext dan data autentikasi yang dibutuhkan algoritma.
- Versi perubahan/sequence.
- Waktu operasional minimum yang diperlukan server.
- Status tombstone untuk penghapusan, tanpa judul atau isi privat.

Metadata yang bisa mengungkap pola pribadi harus diminimalkan atau dimasukkan ke ciphertext.

### Konflik
- Jika dua perangkat mengedit objek yang sama, jangan menimpa salah satunya diam-diam.
- Simpan versi konflik dan tampilkan UI untuk memilih, menggabungkan, atau mempertahankan kedua versi.
- Penggabungan isi dan layout dilakukan setelah dekripsi di perangkat.
- Server tidak boleh melakukan merge konten plaintext.
- Implementasikan retry idempotent dan pemulihan antrean setelah aplikasi berhenti.

### Penghapusan
- Sinkronkan tombstone agar perangkat lain mengetahui objek dihapus.
- Terapkan kebijakan retensi backup yang transparan.
- Dokumentasikan bahwa server atau backup lama mungkin masih menyimpan ciphertext sampai siklus retensi selesai.
- Pertimbangkan penghapusan kriptografis melalui penghancuran kunci objek, tetapi pastikan semua referensi kunci dan versi backup ikut ditangani.

## 12. Struktur Data Konseptual

Semua contoh berikut adalah struktur konseptual, bukan skema final yang mengizinkan plaintext di backend.

### Objek jurnal lokal setelah didekripsi
- `journalId`
- `title`
- `body`
- `createdAt`
- `updatedAt`
- `mood`
- `tags`
- `layoutDocument`
- `attachmentReferences`
- `localSyncState`

Objek ini hanya boleh berada dalam memori/perangkat dalam keadaan plaintext ketika diperlukan.

### Objek cloud
- `opaqueObjectId`
- `ciphertext`
- `ciphertextFormatVersion`
- `revision`
- `createdAtServer` jika diperlukan
- `ciphertextSize` jika diperlukan
- `deletionState` atau tombstone minimum

Backend tidak boleh memiliki field plaintext seperti `title`, `body`, `mood`, `tags`, `originalFilename`, atau `recoveryKey`.

## 13. UX dan Daftar Layar

### 13.1 Onboarding
- Splash dan pengenalan produk.
- Penjelasan bahwa jurnal privat hanya dapat dibuka dengan kunci pengguna.
- Pilihan "Gunakan di perangkat ini" atau "Aktifkan cloud sync".
- Pembuatan vault dan app lock.
- Pembuatan, backup, dan konfirmasi recovery key saat cloud dipilih.
- Penjelasan kehilangan RK sebelum pengguna menyelesaikan setup.

### 13.2 Beranda
- Sapaan personal yang hanya dihitung lokal bila berasal dari konten jurnal.
- Tombol "Tulis jurnal".
- Jurnal terbaru.
- Quick access: stiker, template, mood, foto, kalender.
- Ringkasan streak/statistik yang dihitung lokal.
- Status lock dan sinkronisasi yang jelas.

### 13.3 Editor scrapbook
- Kanvas halaman.
- Tambah teks, foto, stiker, doodle, shape, background, dan elemen dekorasi.
- Geser, ubah ukuran, rotasi, layering, duplikasi, undo/redo.
- Panel pemilihan stiker dan template.
- Autosave ke vault terenkripsi.
- Indikator "Tersimpan di perangkat" dan "Tersinkron" yang tidak menyesatkan.
- Konten tidak boleh dikirim ke layanan pihak ketiga untuk rendering tanpa persetujuan dan desain privasi yang terpisah.

### 13.4 Kalender dan mood
- Tampilan kalender bulanan.
- Indikator hari yang memiliki jurnal tanpa membocorkan isi di notifikasi.
- Mood tracker dan filter.
- Statistik dihitung di perangkat dan disimpan terenkripsi.

### 13.5 Sticker store dan template
- Paket bawaan dapat berupa aset publik.
- Koleksi favorit dan susunan yang dibuat pengguna bersifat privat dan dienkripsi.
- Jika ada paket berbayar, pembelian tidak boleh mengirim konten jurnal kepada penyedia pembayaran.
- Hindari pelacakan perilaku yang mengungkap isi jurnal.

### 13.6 Pengaturan
- App lock dan auto-lock.
- Mode lokal/cloud.
- Status sinkronisasi.
- Pengelolaan perangkat dan sesi.
- Backup/recovery key.
- Ekspor vault terenkripsi.
- Penghapusan data lokal/cloud.
- Privasi, kebijakan retensi, dan penjelasan batas keamanan.

## 14. Kebutuhan Backend

Backend harus sesederhana mungkin.

### Endpoint konseptual
- Registrasi/login/logout.
- Manajemen sesi dan perangkat.
- Upload/download ciphertext.
- Daftar objek ciphertext berdasarkan versi.
- Penghapusan objek dan tombstone.
- Pengelolaan kuota dan status penyimpanan.
- Penghapusan akun dan permintaan penghapusan data.

### Larangan backend
- Tidak menerima plaintext jurnal.
- Tidak menerima RK atau VMK plaintext.
- Tidak memiliki endpoint decrypt.
- Tidak memiliki master key global.
- Tidak mengirim konten privat ke analytics atau crash reporting.
- Tidak menyediakan admin impersonation untuk membuka vault.

### Kontrol backend
- TLS untuk seluruh trafik.
- Otorisasi per akun/objek.
- Rate limiting dan audit log akses administratif.
- Secret management dan least privilege.
- Enkripsi storage sebagai pertahanan tambahan, bukan pengganti E2EE.
- Backup database dan object storage yang diuji.
- Kebijakan retensi dan penghapusan yang jelas.
- Monitoring tanpa konten privat.
- Uji bahwa akun A tidak dapat membaca atau menimpa objek akun B.

## 15. Acceptance Criteria

MVP tidak dianggap selesai sampai seluruh kriteria wajib berikut terpenuhi.

### Fungsional
- Pengguna dapat membuat, mengedit, menghias, mencari, dan menghapus jurnal.
- Foto dan stiker dapat ditempatkan, diubah ukuran, diputar, dan diatur layer-nya.
- Jurnal tetap tersedia secara offline.
- Mode lokal dapat digunakan tanpa membuat akun.
- Cloud sync dapat diaktifkan secara eksplisit.
- Pemulihan di perangkat baru berhasil menggunakan RK yang benar.
- RK yang salah tidak dapat membuka VMK.
- Konflik sinkronisasi tidak menyebabkan kehilangan data diam-diam.

### Keamanan
- Plaintext konten privat tidak dikirim ke backend.
- RK, VMK plaintext, dan object key plaintext tidak masuk ke log, analytics, atau crash report.
- Database dan object storage cloud hanya memuat ciphertext untuk konten privat.
- Foto dan thumbnail privat terenkripsi sebelum penyimpanan permanen/upload.
- Developer tidak memiliki endpoint atau dashboard untuk mendekripsi jurnal.
- Kegagalan autentikasi ciphertext menyebabkan data ditolak.
- Logout dan app lock mengunci akses lokal sesuai desain.
- Backup dan pemulihan telah diuji pada Android dan iOS.
- Tidak ada secret statis atau kunci universal dalam source code.
- Security review dan penetration test tidak memiliki temuan kritis/high yang belum ditangani sebelum rilis.

### Privasi dan transparansi
- Pengguna diberi tahu data apa yang tetap dapat terlihat oleh server.
- Konsekuensi kehilangan RK dijelaskan dan dikonfirmasi.
- Penghapusan akun menjelaskan perbedaan penghapusan akun, ciphertext aktif, cache perangkat, dan backup retensi.
- Kebijakan privasi tidak mengklaim perlindungan yang belum diverifikasi.

## 16. Test Plan

### Kriptografi
- Enkripsi/dekripsi round-trip untuk teks, Unicode, emoji, layout, dan lampiran.
- Kunci salah, ciphertext korup, nonce/format salah, file terpotong, dan payload diputar ulang.
- Uji vector kriptografi yang disediakan library.
- Uji migrasi versi ciphertext.
- Uji recovery key yang salah/benar tanpa mengirimnya ke server.

### Penyimpanan
- Periksa database, filesystem, cache, thumbnail, temporary files, clipboard, logs, crash dumps, dan OS backups.
- Pastikan konten tidak tampil pada app switcher saat vault terkunci.
- Pastikan penghapusan menghapus salinan lokal sesuai batas kemampuan OS.

### Backend
- Inspeksi payload request/response dan storage untuk membuktikan tidak ada plaintext.
- Uji otorisasi lintas akun.
- Uji rate limit, revokasi sesi, replay, object ID enumeration, dan akses tidak sah.
- Uji backup restore dan kebijakan retensi.
- Pastikan admin tooling tidak dapat mendekripsi data.

### Sinkronisasi
- Offline/online, retry, request duplikat, dua perangkat mengedit objek yang sama, perangkat lama kembali online, penghapusan, dan kegagalan parsial.
- Pastikan status UI membedakan tersimpan lokal dan tersinkron ke cloud.

### Platform dan rilis
- Uji versi Android/iOS yang didukung.
- Periksa perlindungan kunci di perangkat yang mendukung dan tidak mendukung hardware-backed security.
- Dependency scanning, static analysis, dynamic analysis, dan penetration test.
- Audit proses signing dan pipeline rilis.
- Gunakan OWASP MASVS/MASTG sebagai checklist audit mobile.

## 17. Risiko Produk dan Keputusan yang Harus Disetujui
1. Kehilangan RK tanpa backup berarti isi vault mungkin tidak dapat dipulihkan.
2. Server tetap dapat menghapus atau menahan ciphertext meskipun tidak bisa membacanya.
3. Perangkat tepercaya yang sudah dibuka bisa menyimpan plaintext atau kunci; pencabutan akses tidak dapat menarik kembali data yang sudah disalin.
4. Statistik lokal lebih privat daripada analitik cloud, tetapi fitur lintas perangkat memerlukan sinkronisasi ciphertext statistik atau perhitungan ulang lokal.
5. Penggunaan AI cloud terhadap jurnal tidak termasuk MVP.
6. Zero-knowledge perlu diverifikasi oleh audit independen; dokumentasi saja tidak cukup.
7. Implementasi kriptografi dan recovery perlu ditinjau oleh engineer yang kompeten di bidang keamanan sebelum data nyata pengguna disimpan.

## 18. Tahapan Pengerjaan

### Phase 0 --- Technical spike dan threat model
- Pilih Flutter atau Kotlin Multiplatform (atau React Native/Expo).
- Validasi library kriptografi dan storage pada kedua OS.
- Tulis spesifikasi format vault dan recovery.
- Buat diagram data flow dan threat model.
- Buat proof-of-concept tanpa konten pengguna nyata.

**Exit criteria:** prototipe dapat membuat vault, mengenkripsi/dekripsi data, dan memulihkan di perangkat kedua tanpa mengirim kunci ke server.

### Phase 1 --- Local vault
- Onboarding, app lock, key manager, database lokal, editor dasar, dan ekspor terenkripsi.
- Uji backup OS, cache, dan log.

**Exit criteria:** journaling offline berfungsi dan inspeksi penyimpanan tidak menemukan plaintext yang tidak disengaja.

### Phase 2 --- Scrapbook dan lampiran
- Kanvas, stiker, template, foto, layout, kalender, mood, dan statistik lokal.
- Semua data privat masuk ke vault terenkripsi.

**Exit criteria:** seluruh konten dekorasi dan lampiran tetap privat pada penyimpanan.

### Phase 3 --- Cloud sync
- Login, ciphertext API, object storage, device management, recovery lintas perangkat, konflik, dan penghapusan.

**Exit criteria:** sinkronisasi bekerja tanpa server memperoleh kunci atau plaintext.

### Phase 4 --- Hardening dan audit
- Threat-model review, pengujian MASVS/MASTG, penetration test, dependency review, logging review, dan perbaikan.

**Exit criteria:** tidak ada temuan kritis/high yang belum ditangani; klaim keamanan disetujui berdasarkan bukti.

### Phase 5 --- Release bertahap
- Beta terbatas, telemetry minimal, crash monitoring tersanitasi, dan proses responsible disclosure.
- Publikasikan kebijakan privasi dan panduan recovery key.
- Pantau stabilitas tanpa mengumpulkan isi jurnal.

## 19. Instruksi Eksekusi untuk Antigravity
Gunakan dokumen ini sebagai product requirements document utama. Jangan langsung menghasilkan seluruh aplikasi dalam satu perubahan besar.

### Deliverables yang diharapkan
- `PRD.md` --- dokumen kebutuhan produk ini.
- `IMPLEMENTATION_PLAN.md` --- milestone dan dependency.
- `THREAT_MODEL.md` --- aset, aktor, ancaman, mitigasi, dan batas keamanan.
- `CRYPTO_SPEC.md` --- format ciphertext, hierarki kunci, recovery, nonce, versi, dan rotasi.
- `ARCHITECTURE.md` --- modul aplikasi, backend, alur data, dan trust boundaries.
- `SECURITY_TEST_PLAN.md` --- test case dan bukti verifikasi.
- Kode aplikasi, test suite, konfigurasi build, dan dokumentasi developer.
- Laporan status per milestone dan daftar risiko/temuan yang masih terbuka.
