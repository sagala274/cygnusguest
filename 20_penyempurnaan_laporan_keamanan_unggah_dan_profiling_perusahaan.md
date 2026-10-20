# Penyempurnaan Laporan, Keamanan Unggah File & Profiling Perusahaan
## Aplikasi Pendaftaran Tamu PUSSIBERAL

Dokumen ini mencatat pekerjaan pada **13-20 Oktober 2026** (lanjutan dari
`19_password_tambahan_data_sensitif_dan_audit_keamanan.md`): perbaikan
jaringan produksi, migrasi Ollama ke Docker, serangkaian perbaikan
tampilan laporan/tabel, penambahan data kendaraan, perombakan grafik
Kunjungan Tamu, kategori keperluan baru beserta kelengkapan Security
Clearance (SC), pengerasan keamanan unggah file, popup hasil pendaftaran,
perbaikan Rekap Kunjungan, dan perombakan Profiling Perusahaan jadi
formulir terstruktur. Seluruh pekerjaan di dokumen ini sudah diuji dan
aktif berjalan di server produksi (https://187.52.126.252) sampai
tanggal disusunnya dokumen ini.

---

## 1. Perbaikan Jaringan Produksi

**Masalah:** setelah backend di-redeploy berkali-kali selama sesi
pengembangan, login mendadak gagal dengan error 502 Bad Gateway.

**Penyebab:** `proxy_pass http://backend:3000/api/;` di nginx hanya
me-resolve hostname `backend` SEKALI saat nginx start, lalu menyimpan
IP-nya selamanya -- tidak otomatis mengikuti kalau container backend
direstart/dibangun ulang dan mendapat IP baru dari Docker.

**Perbaikan:** `resolver 127.0.0.11 valid=10s;` (DNS internal Docker) +
menyimpan upstream lewat variabel (`set $backend_upstream
http://backend:3000; proxy_pass $backend_upstream;`), memaksa nginx
me-resolve ulang hostname-nya tiap 10 detik. **Catatan penting:** begitu
`proxy_pass` memakai variabel, nginx otomatis mematikan penggantian
prefix location -- percobaan pertama yang menambahkan `/api/` di baris
`set` menyebabkan URI dobel (`/api/api/...`, semua panggilan API jadi
404), langsung terdeteksi lewat curl manual dan diperbaiki di commit
susulan.

---

## 2. Migrasi Ollama ke Docker & Riwayat Percakapan AI Chat

- **Ollama dipindah dari terinstal langsung di host ke container Docker
  tersendiri** (profil `ai-lokal` di `docker-compose.yml`, tanpa port
  yang diekspos ke host, hanya bisa dijangkau container lain lewat
  `http://ollama:11434`) -- menyatukan seluruh stack jadi murni berbasis
  container, memudahkan deployment ke server baru.
- **Riwayat percakapan AI Chat disimpan permanen** (sebelumnya hilang
  begitu halaman ditutup): tabel percakapan/pesan baru, retensi otomatis
  30 hari, sidebar daftar percakapan per akun (privat, tidak bisa
  dilihat akun lain).

---

## 3. Perbaikan Tampilan: Teks Panjang Tidak Lagi Terpotong

Pola berulang yang ditemukan di banyak halaman: field bernilai panjang
(Hasil Analisa, Afiliasi, nama tamu rombongan, Keperluan, No. Registrasi)
dipaksa satu baris dengan elipsis (`...`) atau dipotong begitu saja,
membuat isi pentingnya hilang. Diperbaiki satu per satu begitu ditemukan:

- **Hasil Analisa & Afiliasi** (Detail Tamu, Bank Data) -- diubah dari
  sejajar-kanan jadi disusun ke bawah (label di atas, teks rata kiri di
  bawahnya) lewat class CSS baru `.detail-row-stacked`.
- **Nama tamu rombongan** (>1 orang dalam satu pendaftaran) -- disusun
  satu nama per baris, bukan digabung sebaris dipisah koma, di tiga
  tempat: Daftar Tamu, Rekap Kunjungan Tamu, dan modal detail grafik
  Kunjungan Tamu di dashboard. Fungsi `stackedNamesHtml()` dipindah ke
  `app.js` supaya dipakai bersama di ketiganya.
- **Kolom "Keperluan" dan "No. Registrasi" di PDF Rekap Kunjungan** --
  sebelumnya dipaksa satu baris + elipsis; sekarang dibiarkan membungkus
  ke baris berikutnya, tinggi baris menyesuaikan kolom terpanjang
  (dihitung lewat `doc.heightOfString()` sebelum digambar). Lebar kolom
  No. Registrasi juga diperlebar (90pt -> 105pt) supaya nomor registrasi
  standar biasanya muat satu baris tanpa membungkus sama sekali.

---

## 4. Data Kendaraan: Kolom Merk/Nama Kendaraan

Field "Merk/Nama Kendaraan" (terpisah dari "Jenis Kendaraan" yang
sifatnya klasifikasi umum) ditambahkan ke Formulir Pendaftaran Tamu,
kolom baru `vehicles.brand` (migrasi idempoten), tersimpan dan tampil di
Detail Tamu (digabung jadi satu baris ringkas "Kendaraan": merk, jenis,
dan plat nomor).

---

## 5. Grafik Kunjungan Tamu: Dari Hover ke Klik-Tembus

Beberapa putaran revisi berdasarkan masukan langsung:

1. **Percobaan pertama:** daftar nama tamu ditumpuk langsung di dalam
   tooltip saat kursor diarahkan ke grafik -- dinilai berantakan
   (tooltip jadi raksasa untuk hari dengan banyak pendaftaran).
2. **Revisi:** tooltip dikembalikan ringkas (cuma jumlah + label
   periode), dan klik pada titik grafik membuka modal tabel berisi
   daftar pendaftaran periode itu -- pola yang sama persis dengan klik
   kelompok pada pie chart "Kondisi Absensi Hari Ini". Nama tamu di
   modal ini juga disusun ke bawah (lihat Bagian 3).
3. **Perbaikan posisi tooltip:** sebelumnya selalu muncul rata di bagian
   atas grafik (memakai area klik yang sengaja dibuat setinggi seluruh
   plot, bukan posisi titik data-nya) -- diperbaiki supaya tooltip
   mengikuti naik-turun titik data itu sendiri. Perbaikan yang sama
   diterapkan juga ke grafik "Tren Kehadiran Personel" karena pola
   kodenya identik.

Endpoint `/reports/visit-stats` ditambah `date_from`/`date_to` per titik
data (dipakai klik-tembus ke `GET /guests?from=&to=`, filter tanggal baru
yang ditambahkan di endpoint itu).

---

## 6. Formulir Pendaftaran Tamu: Kategori Baru & Security Clearance (SC)

**Permintaan:** kategori keperluan "Maintenance" sudah ada, tapi belum
ada istilah untuk pekerjaan instalasi/pemasangan alat baru maupun
kegiatan pembekalan/pemberian materi -- dan pekerjaan maintenance/
instalasi mengharuskan permintaan Security Clearance (SC) lebih dulu.

**Ditambahkan:**
- Dua kategori keperluan baru: **Instalasi/Pemasangan Perangkat** dan
  **Sosialisasi/Pelatihan**.
- Saat salah satu dari ketiganya (Maintenance/Instalasi/Sosialisasi)
  dipilih, formulir memunculkan dua kolom tambahan (opsional): **unggah
  dokumen/foto Security Clearance**, dan **catatan** untuk kasus
  pimpinan mengarahkan kegiatan itu tidak perlu SC. Kolom baru
  `guests.sc_document` & `guests.sc_exemption_note`, ditampilkan di
  Detail Tamu sebagai bagian tersendiri "Security Clearance (SC)".

*(Percobaan desain ulang tampilan formulir yang lebih besar -- badge
angka bernomor, ikon di tiap input, kartu bergaya baru -- sempat dibuat
mengikuti satu mockup, tapi dikembalikan ke format semula atas
permintaan setelah dicoba; field Merk/Nama Kendaraan & kategori
baru/SC yang ditambahkan selama proses itu tetap dipertahankan.)*

---

## 7. Keamanan Unggah File: Hanya JPEG/PNG/PDF + Validasi Magic Bytes

**Permintaan:** pastikan kolom unggah hanya bisa menerima JPEG/JPG/PNG
dan PDF, hindari upload PHP, sanitasi input file.

**Konteks arsitektur (disampaikan ke pengguna):** seluruh "unggahan" di
aplikasi ini TIDAK PERNAH disimpan sebagai file terpisah di server --
hanya sebagai teks base64 di kolom database, dikembalikan lagi sebagai
data URI di respons JSON. Tidak ada PHP maupun interpreter skrip apa pun
di stack ini (Node.js + Nginx murni), jadi secara arsitektur sudah
kebal dari serangan "upload web shell PHP". Validasi di bawah ini adalah
lapis pengaman tambahan (defense-in-depth), bukan karena ada celah
eksekusi nyata.

**Yang dikerjakan:**
- `isValidPhotoDataUrl` (Foto Tamu/KTP/Kegiatan) dipersempit ke
  JPEG/PNG saja (WebP dilepas dari daftar yang diizinkan).
- `isValidDocumentDataUrl` (baru, khusus Dokumen SC): JPEG/PNG/PDF.
  **Kedua fungsi memverifikasi *magic bytes* (byte awal file hasil
  decode base64)**, bukan cuma percaya prefix MIME yang diklaim di data
  URI-nya -- mencegah file yang isinya bukan benar-benar gambar/PDF
  lolos hanya karena header-nya dipalsukan.
- Dokumen SC mendapat widget unggah tersendiri (`initDocumentWidget` di
  `app.js`): file dibaca apa adanya lewat `FileReader`, TIDAK
  di-encode-ulang lewat `<canvas>` seperti `initPhotoWidget` (PDF tidak
  bisa dimuat ke `<canvas>`). Pratinjau PDF ditampilkan sebagai ikon +
  nama file (bukan `<img>`, yang memang tidak bisa merender PDF); di
  Detail Tamu, dokumen SC berupa PDF ditawarkan sebagai tautan unduhan.
- Atribut `accept` semua input file foto dipersempit dari `image/*`
  jadi eksplisit JPEG/PNG saja, supaya pemilihan file di sisi pengguna
  sudah konsisten dengan yang diterima server.

---

## 8. Popup Hasil Pendaftaran

Kotak ringkasan hasil pendaftaran (sebelumnya di atas formulir, gampang
terlewat) diganti jadi popup modal, mengikuti mockup yang diberikan:
ikon besar melingkar dengan efek halo (titik-titik dekoratif untuk
status berhasil), kotak nomor registrasi bergaris putus-putus dengan
tombol salin ke clipboard, dan tombol "Lihat Detail"/"Tutup" dengan
ikon. Dibuat responsif untuk layar HP/tablet (tombol ditumpuk ke bawah
di layar sempit).

---

## 9. Rekap Kunjungan & Detail Tamu

- **No. Registrasi di Rekap Kunjungan sekarang bisa diklik**, langsung
  membuka halaman Detail Tamu pendaftaran tersebut (`g.id` ditambahkan
  ke `SELECT` di `fetchVisits()`, yang sebelumnya tidak ikut diambil).
- **Foto Kegiatan ditampilkan di Detail Tamu** -- sebelumnya hanya bisa
  dilihat/diunggah lewat modal tersendiri di Daftar Tamu, tidak tersaji
  sama sekali di halaman detail. Otomatis mengikuti hak akses yang
  sudah ada (`canViewActivityPhoto()`: admin/verifikator/pimpinan boleh
  lihat, Pos Depan tidak).

---

## 10. Profiling Perusahaan: Formulir Modal 5 Bagian

**Permintaan:** ubah "Profiling Perusahaan" di Bank Data (sebelumnya
cuma kategori + satu catatan bebas) jadi formulir terstruktur mengikuti
rancangan yang diberikan, dibuka sebagai modal seperti mengedit data
tamu.

**Yang dikerjakan:**
- Modal 5 bagian: **Identitas Perusahaan**, **Legalitas dan Pengurus**,
  **Hubungan dengan Pussiberal/TNI AL**, **Rekam Jejak dan Hasil
  Pemeriksaan**, **Kesimpulan Profiling** (memakai ulang
  `security_category`/`profiling_notes` yang sudah ada sejak awal,
  direlabel sesuai rancangan: "Kategori Hasil Evaluasi" jadi pilihan
  radio dengan teks persis sesuai rancangan, "Hasil Analisis Kaurpam").
- ~19 kolom baru ditambahkan ke `company_profiles` (migrasi idempoten,
  pola yang sama dengan `utils/guestFields.js`), semuanya opsional.
- "Nama Resmi Perusahaan" otomatis terisi dengan nama perusahaan yang
  sudah tercatat dari pendaftaran tamu, kalau belum pernah diisi manual.
- **Revisi setelah dicoba:** ringkasan lengkap data profiling sempat
  ditampilkan langsung di kartu perusahaan (kepanjangan, menurut
  pengguna) -- dikembalikan ke ringkasan singkat semula ("Hasil Analisa
  Kaurpam": kategori + catatan Kesimpulan saja). Data profiling lengkap
  (bagian 1-4) sekarang bisa dilihat lewat modal baru yang terbuka saat
  **nama perusahaan diklik** -- ada tanda titik hijau kecil di nama
  perusahaan yang sudah punya data profiling, sebagai penanda.

---

## Cara Kerja Pengembangan (Untuk Referensi)

Beberapa fitur di dokumen ini melalui proses coba-revisi berdasarkan
tangkapan layar/mockup yang diberikan langsung oleh pengguna (grafik
Kunjungan Tamu, popup hasil pendaftaran, formulir Profiling Perusahaan),
dengan revisi lanjutan setiap kali hasil pertama dirasa belum pas
(tooltip kepenuhan nama, formulir pendaftaran didesain ulang lalu
dikembalikan, ringkasan profiling kepanjangan lalu dipersingkat lagi).
Pola berulang (teks panjang dipotong elipsis) ditemukan dan diperbaiki
di banyak halaman sekaligus begitu ditemukan di satu tempat. Setiap
perubahan diverifikasi langsung ke server produksi lewat `curl` sebelum
dilaporkan selesai (termasuk mengecek migrasi kolom database benar-benar
berhasil, bukan cuma container berhasil start).

*Dokumen ini melengkapi:*
- `18_ai_lokal_ollama_dan_penyimpanan_kredensial_pencarian.md`
- `19_password_tambahan_data_sensitif_dan_audit_keamanan.md`
