# Perbaikan Zona Waktu dan Penyederhanaan Dashboard
## Aplikasi Pendaftaran Tamu PUSSIBERAL

Dokumen ini mencatat pekerjaan pada **27 September 2026** (lanjutan dari
`12_verifikasi_telegram_dan_tema_cyber.md`): perluasan redesain tema cyber
ke seluruh halaman, perbaikan bug penting soal tanggal "hari ini" yang
ternyata mengikuti jam server (UTC) bukan WIB, serta penyederhanaan kartu
"Ringkasan Personel" di Dashboard. Seluruh pekerjaan di dokumen ini sudah
diuji dan **aktif berjalan** di server produksi (https://187.52.126.252)
sampai tanggal disusunnya dokumen ini.

---

## 1. Perluasan Tema Cyber ke Semua Halaman & Perbaikan Tampilan Mobile

**Permintaan:** lanjutan dari redesain Dashboard sebelumnya -- perluas gaya "padat & bergradasi" ke SEMUA halaman (bukan cuma Dashboard), dan cek tampilan di layar HP.

**Yang dikerjakan:**
- Elemen bersama yang dipakai di SEMUA halaman diperbarui, supaya konsisten:
  - `.form-card` (kartu utama di setiap halaman): diberi aksen garis gradasi tipis di tepi atas, radius lebih membulat, bayangan sedikit lebih terasa.
  - Jarak & bantalan (`.section`, `.section-title`) dirapatkan.
  - Tombol utama (`.btn-accent`) dan ikon judul halaman (`.page-title-icon`) memakai gradasi navy-ke-cyan menggantikan warna rata.
  - Tabel (`thead th`/`tbody td`): bantalan sel dirapatkan sedikit supaya lebih padat.
- Tampilan di layar kecil (mobile) diperiksa lewat tinjauan kode pada setiap breakpoint yang ada (850px/700px/480px) -- ditemukan banner "cyber" baru di Dashboard (`.dash-hero`) belum punya penyesuaian ukuran untuk layar kecil, langsung ditambahkan (bantalan & ukuran judul lebih kecil di layar HP).

---

## 2. Dashboard Dimuat Ulang Otomatis Saat Tanggal Berganti

**Laporan:** Dashboard yang dibiarkan terbuka lama menampilkan data absensi hari sebelumnya yang sudah tidak berlaku, padahal tanggal sudah berganti.

**Yang dikerjakan:** Dashboard sekarang memeriksa tanggal setiap 1 menit; kalau tanggal berubah (mis. dashboard dibiarkan terbuka semalaman di ruang jaga), halaman dimuat ulang otomatis supaya data yang ditampilkan selalu sesuai hari yang sebenarnya.

**Catatan:** perbaikan ini membantu, tapi belakangan ditemukan bahwa akar masalah sebenarnya lebih dalam -- lihat poin 3 di bawah.

---

## 3. Perbaikan Bug Penting: Tanggal "Hari Ini" Mengikuti Jam Server (UTC), Bukan WIB

**Laporan:** kartu "Ringkasan Personel" di Dashboard menunjukkan "2 personel Bertugas", tapi begitu diklik untuk lihat detailnya, daftarnya kosong. Sudah dicoba muat ulang halaman, hasilnya tetap sama.

**Penyebab (ditemukan setelah diselidiki langsung ke database produksi):** server dan database MySQL berjalan di zona waktu UTC, sementara seluruh pemakai aplikasi ini berada di WIB (UTC+7). Beberapa query di backend memakai fungsi tanggal bawaan MySQL (`CURDATE()`/`NOW()`) untuk mengambil data "hari ini" -- akibatnya, setiap hari selama jendela waktu 7 jam (pukul 00:00-07:00 WIB), database masih menganggap "hari ini" adalah KEMARIN, padahal menurut jam pemakai di Jakarta sudah masuk hari baru. Ini membuat kartu ringkasan (dihitung lewat `CURDATE()`, jadi masih data kemarin) tidak sinkron dengan jendela detail (yang menghitung ulang "hari ini" dari tanggal yang benar, dikirim oleh browser pengguna).

**Yang dikerjakan:**
- Ditambahkan fungsi pembantu baru yang menghitung "hari ini" berdasarkan zona waktu Jakarta (WIB) yang sebenarnya, dipakai untuk MENGGANTI setiap pemakaian `CURDATE()`/`NOW()` yang berkaitan dengan "hari ini" di seluruh backend:
  - Ringkasan tamu hari ini/kemarin serta kondisi & "Perlu Perhatian" absensi personel di Dashboard.
  - Rentang periode pada grafik Tren Kehadiran Personel dan Grafik Kunjungan Tamu.
  - Perintah `/status` pada bot Telegram.
  - Ringkasan data yang diberikan ke AI Chat.
  - Pengecekan duplikat pendaftaran tamu dengan NIK yang sama di hari yang sama.
  - Tanggal pada nomor registrasi pendaftaran tamu baru.
  - Perhitungan status Aktif/Akan Datang/Selesai pada data Personel Pembelajaran.
- **Sengaja TIDAK** mengubah jam/zona waktu database secara langsung -- itu berisiko merusak cara penyimpanan tanggal/waktu yang sudah benar untuk keperluan lain (pesan Telegram & PDF ekspor, yang sudah mengasumsikan data tersimpan dalam UTC dan baru dikonversi ke WIB saat ditampilkan). Perbaikan ini murni pada level query yang secara spesifik menghitung "hari ini".
- Sudah diuji langsung ke database produksi sebelum diaktifkan: query versi lama dikonfirmasi masih menampilkan data hari sebelumnya (sesuai laporan bug), versi baru sudah benar menampilkan hari yang sebenarnya menurut WIB.

---

## 4. Penyederhanaan Kartu "Ringkasan Personel" di Dashboard

**Masukan:** kartu "Ringkasan Personel" dan pie chart "Kondisi Absensi Hari Ini" di sebelahnya menampilkan data yang persis sama (Hadir, WFH, Bertugas, Sakit, dst.), cuma beda bentuk tampilan -- dashboard jadi kurang ringkas dan terasa mengulang informasi.

**Yang dikerjakan:** "Ringkasan Personel" disederhanakan jadi 2 kartu inti saja: **Total Personel** dan **Hadir Hari Ini**. Rincian per kategori (WFH, Bertugas, Sakit, Libur, Ijin/Cuti, Pendidikan, Tanpa Keterangan) tidak dihilangkan -- tetap lengkap tersedia lewat legenda pie chart "Kondisi Absensi Hari Ini" di sebelahnya (termasuk klik-tembus untuk lihat detail personelnya), jadi tidak ada informasi yang hilang, hanya tidak ditampilkan dua kali.

---

## Cara Kerja Pengembangan (Untuk Referensi)

Perbaikan bug zona waktu pada poin 3 ditemukan dan diverifikasi dengan cara membandingkan langsung hasil `CURDATE()` MySQL (yang mengikuti jam server) dengan hasil perhitungan tanggal berbasis zona waktu Asia/Jakarta, dijalankan langsung terhadap data produksi -- bukan sekadar tinjauan kode -- untuk memastikan diagnosis dan perbaikannya benar sebelum diaktifkan secara luas.

*Dokumen ini melengkapi:*
- `11_penyempurnaan_absensi_personel_dan_akses_pimpinan.md`
- `12_verifikasi_telegram_dan_tema_cyber.md`
