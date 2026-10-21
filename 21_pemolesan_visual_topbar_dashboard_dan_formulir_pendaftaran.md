# Pemolesan Visual: Topbar, Dashboard & Formulir Pendaftaran
## Aplikasi Pendaftaran Tamu PUSSIBERAL

Dokumen ini mencatat pekerjaan pada **20-21 Oktober 2026** (lanjutan dari
`20_penyempurnaan_laporan_keamanan_unggah_dan_profiling_perusahaan.md`):
dua tahap penyempulasan visual Formulir Pendaftaran Tamu, perombakan
topbar di seluruh halaman menjadi bergaya foto kapal + tema cyber,
penggeseran foto banner Dashboard, perbaikan sidebar agar tidak ikut
tergeser saat halaman di-scroll, dan pemolesan tampilan Dashboard dengan
badge heksagon. Sebagian besar pekerjaan di dokumen ini sudah diuji dan
aktif berjalan di server produksi (https://187.52.126.252). **Satu
pengecualian ditandai secara eksplisit di Bagian 6**: perbaikan glitch
topbar belum terkonfirmasi tuntas oleh pengguna saat dokumen ini disusun.

---

## 1. Formulir Pendaftaran Tamu: Dua Tahap Penyempurnaan Visual

Dua permintaan estetika yang terpisah dan sengaja dipersempit lingkupnya
satu per satu (belajar dari percobaan desain ulang besar-besaran di
dokumen sebelumnya yang akhirnya dikembalikan ke format semula) --
keduanya dikonfirmasi lingkupnya lewat pertanyaan pilihan sebelum
dikerjakan.

**Tahap 1 -- "Rapikan saja, jangan ubah struktur":**
Daftar pilihan checkbox/radio (Daftar Pejabat yang Dituju, Kategori
Keperluan) dirapikan jadi tata letak grid dengan gaya kartu per pilihan
(`.device-option`, highlight lewat `:has(input:checked)`) -- tanpa
mengubah struktur field, urutan, atau data apa pun di formulir.

**Tahap 2 -- Band judul bergaya cyber + ikon per pilihan:**
Berdasarkan mockup gelap yang diberikan, diterapkan versi yang disesuaikan
sesuai permintaan eksplisit pengguna: **"jangan tema gelap supaya mudah
dibaca ... tapi pertahankan ke khasan cybernya"**, dan **dibatasi hanya
untuk halaman ini** (bukan tema global). Diterapkan:
- Header bernomor "1/2/3" bergaya badge heksagon di tiga bagian utama
  formulir (Perusahaan & Keperluan, Data Tamu, Data Kendaraan), dengan
  band foto kapal tipis sebagai aksen -- latar konten di bawahnya tetap
  terang (bukan navy gelap), sesuai permintaan keterbacaan.
- Ikon per pilihan Kategori Keperluan (`.device-option-icon`).
- Seluruh perubahan diberi prefiks `#guestForm` di CSS supaya tidak
  memengaruhi class `.device-option`/`.callout` yang dipakai bersama di
  halaman lain.

**Revisi lanjutan:** setelah dicoba, pengguna meminta ikon **dihilangkan
khusus dari daftar Pejabat yang Dituju** (ikon di Kategori Keperluan
tetap dipertahankan).

---

## 2. Topbar Seluruh Halaman: Foto Kapal + Tema Cyber

**Permintaan:** topbar dibuat mengikuti mockup yang diberikan, dengan
pengecualian eksplisit -- **tanpa ikon menu 3-strip (hamburger)**.

**Yang dikerjakan (berlaku global, semua halaman):**
- Tinggi topbar diperbesar (57px -> 68px), latar diganti jadi susunan
  layer: gradasi redup + radial glow + gradasi navy diagonal + foto kapal
  `dashboard-hero.jpg` (cover), ditambah garis bawah (`border-bottom`).
- Judul dua baris: judul halaman + subjudul tetap **"Pengamanan
  PUSSIBERAL"** (`.top-title-main` / `.top-title-sub`), disuntikkan lewat
  `renderNav()` di `app.js` supaya otomatis tampil di semua halaman.
- Pola grid tipis (`::before`, memudar ke kanan lewat `mask-image`) sebagai
  aksen cyber, mengikuti bahasa visual yang sudah ada di `.main`.
- Ikon bell (notifikasi) dan sun (tema) yang sudah ada sebelumnya di
  `#topbarIcons` tetap dipertahankan; ikon hamburger/menu-3-strip memang
  **tidak ditambahkan**, sesuai permintaan.

---

## 3. Dashboard: Penggeseran Foto Banner (Tim VBSS & Kapal 850)

**Permintaan:** supaya tidak sama persis dengan fokus topbar (kapal
"371"), foto banner Dashboard digeser agar menonjolkan **tim VBSS dan
kapal 850** yang posisinya lebih ke bawah pada foto yang sama.

**Yang dikerjakan:** `background-position` pada `.dash-hero` diubah dari
`center` seragam jadi `center 74%` khusus untuk layer foto -- memverifikasi
dulu posisi objek di foto (kapal "371" di 22-60% tinggi gambar, perahu
tim VBSS di 52-83%, kapal "850" di 57-78%) sebelum menentukan titik geser,
supaya kedua objek yang diminta masuk ke area yang terlihat di kartu
banner tanpa memotong keduanya.

---

## 4. Sidebar Tetap di Tempat (Sticky)

**Permintaan:** untuk seluruh halaman, batas scroll halaman seharusnya
cuma sampai batas bawah sidebar -- sidebar tidak boleh ikut tergeser ke
atas saat konten halaman yang panjang di-scroll.

**Penyebab:** `.sidebar` sebelumnya memakai `min-height: 100vh; position:
relative;` -- di halaman dengan konten lebih tinggi dari viewport, flex
container membuat sidebar ikut discroll bersama konten.

**Perbaikan:** diganti jadi `position: sticky; top: 0; height: 100vh;
overflow-y: auto;` -- sidebar menempel di posisinya sendiri terlepas dari
tinggi konten halaman, berlaku di seluruh halaman karena `.sidebar` adalah
class global.

---

## 5. Dashboard: Badge Heksagon & Pemolesan Visual

**Permintaan:** tampilan Dashboard dirapikan mengikuti mockup kedua yang
diberikan, dengan batasan yang sama seperti perombakan sebelumnya --
**tidak mengubah komponen utama** (data, interaksi, dan struktur section
tetap sama).

**Yang dikerjakan:**
- Setiap judul section (Ringkasan Tamu, Grafik Kunjungan Tamu, Ringkasan
  Personel, Tren Kehadiran Personel, Personel Belum Absensi Hari Ini,
  Aktivitas Terbaru, dan judul-judul kartu dinamis seperti Status
  Pendaftaran/Statistik Perangkat Elektronik) diberi badge ikon
  heksagon (`.section-icon-hex`) di depan judulnya.
- Kartu statistik diberi aksen garis warna di sisi kiri sesuai kategori
  warnanya yang sudah ada (`.stat-card:has(.icon-bubble-accent/blue/...)`).
- Teks penjelasan "Klik salah satu kelompok..." diubah jadi kotak info
  biru bertanda ikon (`.hint-callout`) supaya lebih menonjol.
- Tombol toggle periode (Per Hari/Minggu/Bulan) dan tombol "Lihat sebagai
  Tabel" diberi ikon kecil.
- Karena sebagian judul section dibuat ulang secara dinamis lewat
  `innerHTML` (bukan HTML statis), ditambahkan helper global
  `fillIconPlaceholders(root)` di `app.js` -- memindai elemen
  `[data-icon]` dan menyuntikkan ikon SVG-nya, dipanggil ulang setiap
  kali bagian dinamis itu ditulis ulang.

**Dua bug ditemukan lewat laporan pengguna ("banyak logo yg tidak
sejajar") dan diperbaiki:**
1. **Ikon salah:** judul "Ringkasan Personel" memakai `ICONS.users`, yang
   ternyata menampilkan bentuk lingkaran berpancar (bukan siluet orang)
   -- ikon ini memang salah label di sistem ikon yang sudah ada.
   Diganti ke `ICONS.people` (dua siluet orang) yang memang
   dimaksudkan untuk makna "personel/orang".
2. **Badge tidak sejajar:** `.section-title-group` memakai
   `align-items: center`, yang membuat badge heksagon bergeser naik/turun
   antar-kartu ketika judul satu kartu melipat ke 2 baris sementara
   kartu sebelahnya tetap 1 baris (misalnya "Statistik Perangkat
   Elektronik" vs "Status Pendaftaran"). Diperbaiki dengan
   `align-items: flex-start` + sedikit `padding-top` pada judul supaya
   badge dan huruf pertama tetap rata atas secara konsisten.

---

## 6. Topbar: Perbaikan Sambungan/Glitch di Tepi Bawah (Belum Terkonfirmasi Tuntas)

**Masalah yang dilaporkan:** setelah topbar diganti jadi latar foto
kapal yang penuh/tidak transparan (Bagian 2), muncul garis/pita gelap
bermotif grid yang terlihat seperti sambungan patah di tepi bawah
topbar, terlihat di tangkapan layar yang dikirim pengguna.

**Diagnosis:** `.main` sudah lebih dulu punya latar navy gelap + pola
grid sendiri (dari pengerjaan sebelumnya, sebagai bingkai di belakang
panel konten yang terang). Sebelumnya topbar bersifat semi-transparan
(`rgba(6,14,30,.68)` + `backdrop-filter: blur`), jadi sambungan antara
topbar dan `.main` tidak pernah terlihat tegas. Begitu topbar diganti
jadi latar foto yang sepenuhnya tidak transparan, sambungan itu jadi
terlihat sebagai pita/garis tegas.

**Dua percobaan perbaikan yang sudah dilakukan:**
1. **Percobaan pertama:** ditambahkan layer gradasi memudar
   `linear-gradient(to bottom, transparent 0%, transparent 78%, #060c1e
   100%)` di 18% bagian bawah topbar, sekaligus menghapus `overflow:
   hidden` yang sempat ditambahkan di percobaan ini -- `overflow: hidden`
   ternyata berisiko memotong tampilan dropdown notifikasi/profil, yang
   menurut komentar kode yang sudah ada sejak awal, sengaja didesain
   meluber keluar dari kotak topbar (68px) ke area konten di bawahnya.
   **Hasil:** pengguna melaporkan masih terlihat glitch/pita di tangkapan
   layar kedua.
2. **Percobaan kedua:** gradasi diubah jadi memudar **bertahap di
   seluruh tinggi topbar** (`linear-gradient(to bottom, transparent 0%,
   #060c1e 100%)`, bukan cuma 18% bagian bawah) -- dugaannya, gradasi
   yang terlalu terkonsentrasi di area sempit (18% dari 68px, melawan
   foto berdetail tinggi) yang justru membuat transisinya terlihat
   sebagai garis tegas, bukan gradasi halus.

**Status saat dokumen ini disusun:** perbaikan kedua sudah di-deploy ke
server produksi, **namun belum dikonfirmasi oleh pengguna** -- balasan
terakhir pengguna ("masih ada glitchnya..") datang tanpa tangkapan layar
baru, dan permintaan selanjutnya adalah dokumentasi ini. Jika glitch
masih muncul, langkah lanjutan yang disarankan: minta tangkapan layar
terbaru (dengan hard refresh/Ctrl+Shift+R dipastikan dulu, karena browser
beberapa kali menampilkan versi lama CSS selama sesi ini) sebelum mencoba
perbaikan ketiga.

---

## Cara Kerja Pengembangan (Untuk Referensi)

Pola yang berulang di dokumen ini: setiap permintaan pemolesan visual
besar (topbar, dashboard, formulir pendaftaran) diterapkan dengan
batasan eksplisit dari pengguna -- "jangan ubah struktur", "jangan tema
gelap", "jangan ubah komponen utama" -- dan untuk permintaan yang
berpotensi lebih luas lingkupnya dari yang terlihat, lingkupnya
dikonfirmasi dulu lewat pertanyaan pilihan sebelum mengerjakan perubahan
besar, bukan menebak. Bug visual (ikon salah, badge tidak sejajar)
ditemukan lewat laporan pengguna dengan tangkapan layar, didiagnosis
dari kode yang relevan, baru diperbaiki -- bukan ditebak dari deskripsi
teks saja. Satu perbaikan (Bagian 6) secara sengaja didokumentasikan
sebagai **belum terkonfirmasi** alih-alih diklaim selesai, karena
pengguna belum mengirim tangkapan layar/konfirmasi hasil percobaan
kedua.

*Dokumen ini melengkapi:*
- `19_password_tambahan_data_sensitif_dan_audit_keamanan.md`
- `20_penyempurnaan_laporan_keamanan_unggah_dan_profiling_perusahaan.md`
