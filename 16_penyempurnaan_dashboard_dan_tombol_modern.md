# Penyempurnaan Dashboard, Tombol Modern, dan Navigasi Tabel
## Aplikasi Pendaftaran Tamu PUSSIBERAL

Dokumen ini mencatat pekerjaan pada **3 Oktober 2026** (lanjutan dari
`15_status_terlambat_foto_kegiatan_dan_hardening_keamanan.md`): serangkaian
penyempurnaan tampilan & interaksi Dashboard (tooltip, animasi, tata letak,
kejelasan angka kehadiran), desain ulang tombol dengan tema "cyber" di
seluruh halaman, serta kemudahan menggeser tabel lebar. Seluruh pekerjaan di
dokumen ini sudah diuji dan **aktif berjalan** di server produksi
(https://187.52.126.252) sampai tanggal disusunnya dokumen ini.

---

## 1. Tooltip Prosentase pada Pie Chart Dashboard

**Permintaan:** saat kursor diarahkan ke salah satu warna di pie chart,
tampilkan info berapa prosentasenya.

**Yang dikerjakan:** mengarahkan kursor ke salah satu potongan warna di
donut "Kondisi Absensi Hari Ini" atau "Status Pendaftaran" sekarang
menampilkan tooltip (label, jumlah, prosentase) yang mengikuti posisi
kursor -- memakai ulang gaya tooltip yang sudah dipakai grafik batang/garis
lain supaya konsisten. Sekalian ditemukan & diperbaiki bug lama: tooltip
grafik batang di halaman Absensi Personel muncul "melayang" di posisi acak
(teksnya ikut tidak kelihatan) karena wadahnya tidak diberi `position:
relative` seperti grafik serupa di Dashboard.

---

## 2. Desain Ulang Tombol -- Tema "Cyber" ke Semua Halaman

**Permintaan:** tombol navigasi tanggal di Absensi Personel diubah jadi
lebih modern/futuristik (sesuai tema cyber yang sudah dipakai di sidebar),
lalu diterapkan juga ke semua halaman.

**Yang dikerjakan:**
- Tombol navigasi tanggal (Sebelumnya/Berikutnya/tanggal/Hari Ini)
  dikemas jadi satu kapsul dengan aksen gradasi navy-ke-cyan, tombolnya
  "menyatu" dan memendar cyan saat di-hover, "Hari Ini" ditonjolkan
  dengan isian gradasi penuh.
- Tombol "Kelola Data Personel" diberi varian baru `.btn-outline-accent`
  (tepi gradasi, isian terang) -- sekalian ditemukan & diperbaiki bug
  lama: tombol ini bergaris bawah (warisan gaya default elemen `<a>`
  yang belum pernah di-reset).
- Perubahan diterapkan ke **tombol dasar** (`.btn`) yang dipakai bersama
  di SELURUH aplikasi (sudut sedikit lebih membulat, transisi hover
  lebih halus, garis bawah di tombol berbasis link dihilangkan) --
  otomatis berlaku di semua halaman tanpa perlu diubah satu per satu.
- Toggle periode grafik Dashboard (Per Hari/Minggu/Bulan) didesain ulang
  jadi kapsul serupa, sekaligus memperbaiki inkonsistensi lama (toggle
  grafik Tren Kehadiran sebelumnya tidak punya gaya status "aktif" sama
  sekali, beda dari toggle Grafik Kunjungan yang isiannya hitam polos).
- Tombol pagination (Manajemen Pengguna, dst.) memendar cyan saat hover,
  status halaman aktif diberi isian gradasi.

---

## 3. Kartu "Perlu Perhatian" -- Chip Horizontal & Klik-Tembus

**Masukan:** daftar "Perlu Perhatian" (personel Tanpa Keterangan/Belum
Absensi) tersusun vertikal ke bawah, terlihat kosong/aneh kalau cuma ada
satu jenis; lalu diminta agar nama-nama personelnya juga bisa dilihat
langsung dari chip ini.

**Yang dikerjakan:**
- Daftar diubah jadi chip horizontal berdampingan, dengan warna berbeda
  sesuai tingkat urgensi: **Tanpa Keterangan** (merah -- absensinya SUDAH
  dilaksanakan, cuma tanpa keterangan jelas, lebih serius) dan **Belum
  Absensi** (kuning/amber -- memang belum ada status sama sekali, masih
  mungkin dilengkapi).
- Kedua chip sekarang bisa diklik untuk membuka daftar nama personelnya --
  memakai ulang modal yang sama dengan legenda pie chart "Kondisi Absensi
  Hari Ini" (kedua kategori ini sudah ada sebagai bucket di sana), jadi
  tidak perlu logika/endpoint baru.

---

## 4. Perbaikan Tabel "Personel Belum Absensi Hari Ini"

**Laporan:** personel berstatus "Tanpa Keterangan" masih ikut muncul di
tabel yang judulnya "Belum Absensi Hari Ini" -- padahal "Tanpa Keterangan"
berarti absensinya SUDAH dilaksanakan (statusnya sudah diisi, cuma tanpa
keterangan jelas kenapa dia tidak masuk), bukan "belum absensi".

**Yang dikerjakan:** tabel ini sekarang difilter supaya hanya menampilkan
personel yang statusnya benar-benar kosong (NULL). Personel "Tanpa
Keterangan" tidak hilang begitu saja -- tetap terlihat lewat chip "Tanpa
Keterangan" di kartu Perlu Perhatian (poin 3) dan potongan "Tanpa
Keterangan" pada pie chart.

---

## 5. Tata Letak Dashboard: Urutan Kartu & Posisi "Aktivitas Terbaru"

**Permintaan:** pie chart "Kondisi Absensi Hari Ini" ditumpuk di atas kartu
"Perlu Perhatian" (bukan berdampingan); dan kartu "Aktivitas Terbaru"
dipindah ke bawah, terpisah dari kelompok Tamu maupun Absensi Personel
(sebelumnya tercampur dalam grid kartu kolom Tamu, bersama "Kategori
Keamanan Personel").

**Yang dikerjakan:**
- Pie chart & kartu Perlu Perhatian sekarang tersusun vertikal (pie
  chart di atas), bukan sejajar.
- "Aktivitas Terbaru" dipindahkan jadi kartu tersendiri selebar penuh di
  **bawah** kedua kolom (Tamu & Absensi Personel) -- karena log
  aktivitasnya mencakup seluruh aplikasi, bukan cuma urusan tamu.
- Donut pie chart diperbesar (dari 128px ke 184px) supaya bagian legenda
  tidak terlalu melebar saat kartunya sendirian selebar penuh baris,
  sehingga jarak antara nama kategori dan angka prosentasenya lebih
  rapat (sebelumnya terasa jauh karena kartu jadi lebih lebar setelah
  perubahan tata letak di atas).

---

## 6. Konsistensi Angka "Kehadiran" di Dashboard

**Laporan:** prosentase pada kartu "Hadir di Kantor Hari Ini" tidak sama
dengan prosentase "hari ini" pada grafik "Tren Kehadiran Personel" (mis.
27,6% vs 29%), padahal keduanya sama-sama soal "kehadiran".

**Penyebab:** ada tiga rumus "kehadiran" berbeda terpakai bersamaan --
pie chart "Hadir" (cuma status Hadir), kartu "Hadir di Kantor Hari Ini"
(sebelumnya Hadir + Dinas Dalam), dan grafik Tren Kehadiran (Hadir +
Terlambat + Dinas Dalam). Ketiganya "benar" sesuai definisi masing-masing,
tapi karena ditampilkan berdekatan jadi terlihat tidak sinkron.

**Yang dikerjakan:** kartu "Hadir di Kantor Hari Ini" sekarang ikut
menghitung Terlambat juga, sehingga rumusnya sama persis dengan grafik
Tren Kehadiran (Hadir + Terlambat + Dinas Dalam) -- prosentase di kartu
ini sekarang selalu cocok dengan titik "hari ini" pada grafik. Pie chart
"Kondisi Absensi Hari Ini" sengaja TIDAK diubah, tetap memisahkan tiap
kategori apa adanya untuk keperluan rincian.

---

## 7. Klik-Geser (Drag) Horizontal untuk Tabel Lebar

**Laporan:** tabel dengan banyak kolom (Daftar Tamu, dst.) susah digeser
ke kiri/kanan -- harus scroll halaman ke bawah dulu untuk menemukan
scrollbar tipis di bagian paling bawah tabel.

**Yang dikerjakan:** klik-tahan di mana pun pada area kosong tabel (bukan
tombol/link/input) lalu geser mouse sekarang sudah cukup untuk
menggesernya ke kiri/kanan, tanpa perlu mencari scrollbar dulu. Kursor
berubah jadi ikon "genggam" (grab) sebagai penanda. Dipasang sekali lewat
event delegation ke seluruh dokumen (bukan per halaman), sehingga otomatis
berlaku di **semua tabel di semua halaman/akun** -- termasuk tabel yang
isinya disuntik lewat JavaScript belakangan -- tanpa perlu diaktifkan satu
per satu.

---

## Cara Kerja Pengembangan (Untuk Referensi)

Setiap perubahan tampilan di dokumen ini diuji sintaksnya (scp + `node
--check` ke server) sebelum di-deploy, dan beberapa perbaikan (poin 4 dan
6) berangkat dari laporan pengguna yang membandingkan angka antar-kartu
secara langsung di Dashboard produksi -- bukan ditemukan lewat tinjauan
kode semata.

*Dokumen ini melengkapi:*
- `14_foto_latar_banner_dashboard.md`
- `15_status_terlambat_foto_kegiatan_dan_hardening_keamanan.md`
