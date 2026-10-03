# Status Terlambat, Foto Kegiatan, Check-out Mandiri, dan Hardening Keamanan
## Aplikasi Pendaftaran Tamu PUSSIBERAL

Dokumen ini mencatat pekerjaan pada **28 September -- 2 Oktober 2026**
(lanjutan dari `14_foto_latar_banner_dashboard.md`): penambahan status
absensi "Terlambat", kredit pengembang di sidebar, fitur "Foto Kegiatan"
pada Daftar Tamu, pengujian ulang & hardening keamanan (termasuk perbaikan
satu celah XSS), fitur check-out mandiri per tamu, animasi pada
grafik/pie chart Dashboard, serta beberapa penyesuaian kartu Ringkasan
Personel. Seluruh pekerjaan di dokumen ini sudah diuji dan **aktif
berjalan** di server produksi (https://187.52.126.252) sampai tanggal
disusunnya dokumen ini.

---

## 1. Status Absensi Baru: "Terlambat"

**Permintaan:** tambahkan status "Terlambat" ke klasifikasi absensi yang
sudah ada (Hadir, WFH, Dinas Dalam, Dinas Luar, Sakit, Ijin, Cuti,
Pendidikan, BKO, Libur, Tanpa Keterangan).

**Yang dikerjakan:**
- Status `terlambat` ditambahkan ke ENUM kolom status di database (migrasi
  otomatis saat backend start, seperti pola penambahan status sebelumnya).
- Warna kategorikal baru (`#93a000`, zaitun tua) dicari dan diuji lewat
  validator skill dataviz (lightness band, chroma floor, pemisahan warna
  untuk buta warna, kontras) -- butuh belasan percobaan karena ruang warna
  sudah padat dengan 11 kategori lain. Warna yang lolos validasi mengharuskan
  "Terlambat" ditempatkan di antara "Libur" dan "Tanpa Keterangan" dalam
  urutan status (bukan tepat setelah "Hadir"), supaya jarak warnanya cukup
  jauh dari status tetangga.
- Ditampilkan di halaman Absensi Personel (label, grafik batang, lencana
  status) dan Dashboard (potongan baru di pie chart "Kondisi Absensi Hari
  Ini").
- Grafik "Tren Kehadiran Personel" diperbarui supaya status Terlambat ikut
  dihitung sebagai kehadiran (bersama Hadir dan Dinas Dalam).

**Bug ikutan yang ditemukan & diperbaiki:** setelah fitur ini aktif,
grafik "Tren Kehadiran Personel" sempat menunjukkan angka yang tidak
cocok dengan kartu ringkasan (mis. 83% padahal seharusnya 81%).
Penyebabnya: query grafik tren ikut menghitung riwayat absensi milik
personel yang **sudah dinonaktifkan** (datanya tidak terhapus, cuma
personelnya dinonaktifkan) sebagai pembilang, sementara pembaginya cuma
personel yang masih aktif. Query diperbaiki supaya pembilang & pembagi
sama-sama hanya menghitung personel yang masih aktif, sama seperti cara
kartu "Kondisi Absensi Hari Ini" menghitung.

---

## 2. Kredit Pengembang di Sidebar

**Permintaan:** tambahkan kredit pengembang di bagian atas sidebar
(dekat logo), bukan cuma di bagian bawah seperti sebelumnya.

**Yang dikerjakan:**
- Kredit singkat ("© 2026 Kapten Laut (P) Tetuko Sagala, CTIA.")
  ditambahkan di atas sidebar, dekat logo -- kredit yang sudah ada di
  bagian bawah tetap dipertahankan di posisi lamanya.
- Setelah beberapa kali revisi sesuai masukan: kredit di bagian bawah
  akhirnya disederhanakan jadi tiga baris tanpa baris copyright (supaya
  tidak diulang dengan yang di atas):
  ```
  Dikembangkan oleh
  Kapten Laut (P) Tetuko Sagala, CTIA.
  Ka Urpam Pussiberal 2026
  ```
- Muncul otomatis di semua halaman (disuntik lewat `renderNav()`, sama
  seperti elemen bersama lainnya), dan ikut tersembunyi di tampilan
  sidebar menyempit (layar kecil).

---

## 3. Tata Letak Kartu "Aktivitas Terbaru" di Dashboard

**Masukan:** kartu "Aktivitas Terbaru" tampil selebar penuh sebagai baris
tersendiri, sementara kartu "Kategori Keamanan Personel" (kartu ke-3 di
grid 2 kolom di bawahnya) menyisakan slot kosong di sebelahnya.

**Yang dikerjakan:** "Aktivitas Terbaru" dipindahkan ke grid yang sama
dengan kartu-kartu di bawahnya (lewat teknik `display:contents` pada
wrapper), supaya ukurannya seragam dan otomatis mengisi slot kosong di
pojok kanan bawah untuk role yang melihat kartu "Kategori Keamanan
Personel" (Admin).

---

## 4. Fitur Baru: Foto Kegiatan pada Daftar Tamu

**Ide/permintaan:** terkadang kegiatan PT yang berkunjung ke PUSSIBERAL
perlu didokumentasikan lewat foto. Diminta satu kolom di Daftar Tamu
untuk mengunggah 1 foto kegiatan per kunjungan (bukan per tamu individu).

**Yang dikerjakan:**
- Kolom baru `activity_photo` pada tabel pendaftaran (`guests`), satu
  foto per pendaftaran/kunjungan -- memakai ulang pola base64 + validasi
  magic-bytes yang sudah dipakai untuk Foto Tamu/Foto KTP, supaya
  konsisten dan tidak perlu dependensi upload file baru.
- Kolom "Foto Kegiatan" baru di halaman Daftar Tamu: tombol "+ Upload"
  atau "Lihat/Ubah" yang membuka modal kamera/unggah (memakai ulang
  komponen `initPhotoWidget` yang sudah ada).
- **Hak akses** (disesuaikan dua kali mengikuti masukan lapangan):
  - **Kaurpam (Admin) & Baurpam (Verifikator):** boleh melihat DAN
    mengunggah/mengubah.
  - **Pimpinan:** boleh melihat saja.
  - **Pos Jaga (Pos Depan):** sama sekali tidak boleh mengakses --
    disaring di level backend (field-nya tidak dikirim sama sekali ke
    respons API untuk role ini), bukan cuma disembunyikan di tampilan.
- Endpoint upload dipisah tersendiri (`PUT /api/guests/:id/activity-photo`)
  dari endpoint edit data pendaftaran biasa, karena kombinasi hak
  aksesnya berbeda dari field lain.

---

## 5. Pengujian Keamanan & Hardening

**Permintaan:** lakukan hardening terhadap kemungkinan celah keamanan
sesuai hasil pemindaian otomatis (40 pengujian: SQL injection, file
upload, API endpoint, session token, cookie, directory listing, debug
info, transmisi password, OpenAPI, rate limit), lalu diuji ulang
mengikuti skema: Login -> Auth Bypass, Input Data -> XSS/SQLi,
File -> Upload, Database -> Authorization -> IDOR.

**Hasil tinjauan -- sudah kuat sebelumnya (tidak perlu diubah):**
- Seluruh query database memakai parameterized query, tidak ada input
  pengguna yang digabung langsung ke string SQL.
- Tidak ada upload file mentah di aplikasi ini; semua "foto" lewat base64
  yang divalidasi magic-bytes + batas ukuran sebelum masuk database.
- Seluruh endpoint API dijaga middleware autentikasi & pemeriksaan peran.
- Tidak memakai cookie sesi sama sekali (token JWT disimpan di
  `sessionStorage`), sehingga celah cookie HttpOnly/Secure tidak relevan.
- HTTPS dipaksa (redirect otomatis dari HTTP), header keamanan lengkap
  sudah terpasang di nginx (HSTS, CSP, X-Frame-Options, dst.), directory
  listing sudah nonaktif.
- Endpoint yang mengubah data tamu/anggota tamu lain (mis. hapus/ubah
  anggota, notifikasi, tautan Telegram) sudah memverifikasi kepemilikan
  data (`guest_id`/`user_id` yang sesuai) sebelum mengizinkan perubahan --
  tidak ditemukan celah IDOR.

**Perbaikan yang ditambal:**
- Header `X-Powered-By: Express` (mengekspos framework backend ke
  penyerang) dimatikan.
- `jwt.verify()` dikunci ke algoritma HS256 saja -- mencegah celah klasik
  "algorithm confusion" pada validasi token sesi (diuji langsung dengan
  token palsu beralgoritma `none`, hasilnya ditolak 401 setelah perbaikan).
- `NODE_ENV=production` ditambahkan ke Dockerfile backend.
- Endpoint `/api/auth/*` (berisi JWT & data akun) sekarang mengirim
  `Cache-Control: no-store`, lebih ketat dari header `no-cache` global
  yang sudah ada di nginx.
- **Celah stored XSS ditemukan & diperbaiki** pada editor Pemetaan
  Hubungan (`network-map-editor.js`): atribut SVG (warna, koordinat, ID
  node/edge) disisipkan ke HTML tanpa di-escape -- hanya label yang sudah
  lolos `escapeHtml()`. Karena endpoint API pemetaan sengaja hanya
  memvalidasi BENTUK data (nodes/edges harus array), bukan isinya,
  pengguna Verifikator/Admin bisa mengirim payload lewat panggilan API
  langsung (bukan lewat editor visual) yang berpotensi tereksekusi di
  browser pengguna LAIN yang membuka diagram yang sama. Ditambal dengan
  memaksa koordinat/ukuran jadi angka murni dan meng-`escapeHtml()`
  warna/ID sebelum masuk atribut SVG. (Dampak nyatanya sendiri sudah
  lebih dulu diredam oleh Content-Security-Policy yang ketat di nginx,
  tapi tetap ditambal sebagai pertahanan berlapis -- tidak boleh hanya
  mengandalkan satu lapis pertahanan untuk menutupi bug di lapis lain.)

---

## 6. Fitur Baru: Check-out Mandiri per Tamu

**Laporan:** satu pendaftaran bisa berisi beberapa tamu dari PT yang
sama, dan kadang salah satu anggota sudah menyelesaikan urusannya dan
pulang lebih dulu, sementara yang lain masih di dalam. Check-out
sebelumnya sifatnya sekaligus untuk SELURUH anggota pendaftaran,
sehingga pencatatan waktu keluar jadi tidak akurat untuk anggota yang
pulang duluan.

**Yang dikerjakan:**
- Kolom baru `checked_out_at` pada data tamu per anggota (`guest_members`)
  -- `NULL` berarti masih di area.
- Endpoint baru untuk check-out SATU anggota saja. Begitu **semua**
  anggota pendaftaran sudah check-out mandiri satu per satu, kunjungan
  keseluruhan otomatis ditutup juga (status "Selesai"), sama seperti efek
  tombol "Check-out Semua Tamu" -- tanpa langkah manual tambahan.
  "Check-out Semua Tamu" & "Check-in Ulang" turut diperbarui supaya
  status check-out mandiri per anggota tetap konsisten (ikut
  ditandai/direset).
- Di halaman Detail Tamu, tiap kartu tamu (selama kunjungan berjalan)
  kini punya tombol "Check-out" sendiri, atau lencana "Sudah Check-out"
  kalau sudah ditekan.

---

## 7. Animasi & Penyesuaian Tampilan Dashboard

**Permintaan:** tambahkan animasi pergerakan pada pie chart dan grafik
saat Dashboard diakses; perlambat animasinya supaya naik-turunnya
terlihat jelas; dan jadikan "Per Hari" sebagai tampilan default semua
grafik (bukan "Per Minggu").

**Yang dikerjakan:**
- Donut ("Kondisi Absensi Hari Ini" & "Status Pendaftaran"): tiap
  potongan tumbuh dari 0 ke ukurannya sendiri-sendiri secara bertahap
  (efek "menyapu"), teks di tengah memudar masuk setelahnya.
- Grafik area/garis ("Tren Kehadiran Personel" & "Grafik Kunjungan
  Tamu"): garis "digambar" dari kiri ke kanan selama 3 detik dengan
  kecepatan rata (bukan cepat-di-tengah), supaya naik-turunnya bentuk
  garis terlihat jelas; area & titik menyusul memudar masuk.
- Bar list ("Statistik Perangkat Elektronik"): batang tumbuh dari 0 ke
  lebar aslinya secara bertahap.
- Semua lewat CSS `@keyframes` murni (bukan transisi), supaya otomatis
  terpicu ulang tiap kali data di-refresh/ganti periode, dan otomatis
  nonaktif untuk pengguna yang mengaktifkan pengaturan "kurangi gerakan"
  di sistemnya.
- Tombol "Per Hari" dijadikan aktif secara default pada kedua grafik
  (sebelumnya "Per Minggu").

---

## 8. Penyesuaian Kartu "Hadir di Kantor Hari Ini"

**Masukan:** personel berstatus "Dinas Dalam" (standby/bertugas di DALAM
kantor, mis. jaga) semestinya ikut terhitung "hadir" pada kartu ringkasan
di sebelah jumlah total personel -- tapi pie chart "Kondisi Absensi Hari
Ini" di sebelahnya tetap harus memisahkan tiap kategori apa adanya (Dinas
Dalam tetap satu kelompok dengan Dinas Luar/BKO sebagai "Bertugas"),
supaya tidak membingungkan.

**Yang dikerjakan:**
- Pie chart "Kondisi Absensi Hari Ini" **tidak diubah** -- tetap
  memisahkan tiap kategori sesuai aslinya.
- Kartu ringkasan di sebelah "Total Personel" sekarang menghitung Hadir +
  Dinas Dalam **digabung**, lewat jalur hitung tersendiri yang terpisah
  dari logika pie chart (tidak ikut muncul sebagai potongan sendiri di
  pie chart, tapi tetap bisa diklik-tembus untuk lihat daftar
  personelnya).
- Labelnya diganti dari "Hadir Hari Ini" menjadi **"Hadir di Kantor Hari
  Ini"**, supaya jelas kalau angkanya memang gabungan, tidak
  membingungkan dibanding pie chart di sebelahnya.

---

## Cara Kerja Pengembangan (Untuk Referensi)

- Perubahan warna kategorikal (poin 1) dan perbaikan XSS (poin 5)
  memakai validator otomatis (skill dataviz untuk warna; tinjauan kode
  manual + pengujian langsung dengan payload nyata untuk XSS/auth bypass)
  sebelum diterapkan, bukan sekadar tinjauan visual/kode.
- Pengujian keamanan dilakukan dengan percobaan nyata ke endpoint
  produksi secara aman (tanpa token, token acak, token JWT palsu
  beralgoritma `none`) -- bukan cuma tinjauan kode -- untuk memverifikasi
  perbaikan benar-benar menutup celahnya.
- Setiap perubahan disebar ke seluruh titik kode yang relevan (migrasi
  database otomatis, backend, frontend), diuji sintaksnya, baru di-deploy
  ke server produksi setelah konfirmasi.

*Dokumen ini melengkapi:*
- `13_perbaikan_zona_waktu_dan_penyederhanaan_dashboard.md`
- `14_foto_latar_banner_dashboard.md`
