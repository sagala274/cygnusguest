# Redesain Tema Visual, Dashboard, dan Sanitasi Upload Foto
## Aplikasi Pendaftaran Tamu PUSSIBERAL

Dokumen ini mencatat pekerjaan pada **30 Agustus 2026**: penyelarasan tema
visual dengan brand book Naval-CSIRT, redesain menyeluruh sidebar/topbar dan
halaman Manajemen Pengguna, redesain Dashboard dengan data statistik riil,
serta audit dan pengerasan keamanan validasi foto upload. Dokumen ini
melengkapi:

- `07_formulir_lanjutan_dan_perbaikan_data.md`
- `08_branding_avatar_dan_url_bersih.md`

---

## 1. Selaraskan Palet Warna & Tipografi dengan Brand Book

Brand book resmi Naval-CSIRT (4 warna: **Admiral Blue** `#002878`, **Pure
White**, **Obsidian Black** `#222222`, **Chalk White** `#F8F8F8`; tipografi
**Open Sans**) dijadikan dasar seluruh palet CSS, menggantikan skema navy tua
gelap + aksen ungu yang dipakai sebelumnya.

### 1.1 Variabel Warna

`--purple`/`--purple-soft` diganti total jadi `--accent`/`--accent-soft`
(nilainya Admiral Blue), dipakai konsisten untuk link, badge, chart, callout,
tombol saran chat. Warna status (`--danger`/`--success`/`--amber`) sedikit
diredupkan supaya terasa lebih institusional, tetap jelas terbaca sebagai
merah/hijau/kuning.

### 1.2 Open Sans Self-Hosted

Font diunduh langsung dari Google Fonts (4 weight: 400/600/700/800, format
woff2) dan disajikan lewat `@font-face` lokal
(`frontend/public/assets/fonts/`), **bukan** lewat tag `<link>` ke Google
Fonts CDN -- supaya tidak perlu melonggarkan `font-src`/`style-src` di
Content-Security-Policy (`frontend/nginx.conf`) yang sudah diperketat sejak
audit keamanan sebelumnya.

### 1.3 Perbaikan Kecil: Tanda Bintang Wajib (*)

`.field label` sebelumnya pakai `justify-content: space-between`, yang
mendorong tanda `*` jauh ke ujung kanan kolom kalau labelnya cuma "judul
+ *" tanpa keterangan tambahan (NIK, Nama Lengkap, dst). Diganti
`flex-start` + `margin-left` kecil pada `.required`, sementara `.label-note`
(keterangan seperti "16 Digit") tetap didorong ke kanan lewat
`margin-left: auto` -- jadi cuma posisi bintangnya yang dirapatkan, bukan
perilaku keterangan tambahan.

---

## 2. Redesain Sidebar/Topbar App-Wide & Manajemen Pengguna

Dipicu oleh gambar referensi (mockup dashboard admin generik) yang diminta
pengguna untuk ditiru gayanya. Sebelum mengerjakan, cakupan diklarifikasi
lewat `AskUserQuestion` karena mockup mengandung elemen yang belum ada sama
sekali di aplikasi (lonceng notifikasi, toggle mode gelap/terang, form
sebagai modal pop-up):

- **Cakupan**: diterapkan ke seluruh aplikasi (bukan cuma satu halaman).
- **Notifikasi & dark mode**: ditampilkan sebagai elemen visual saja
  (tooltip "segera hadir"), **tidak** dibuat fungsi palsu yang terlihat
  bisa diklik tapi sebenarnya tidak berbuat apa-apa secara diam-diam.
- **Form Tambah/Edit Pengguna**: diubah jadi modal pop-up.

### 2.1 Sistem Ikon SVG Inline

Karena CSP membatasi `script-src`/`font-src` ke `'self'` (tidak bisa pakai
icon font dari CDN), dibuat **registry ikon custom** (~28 ikon gaya
Feather/Lucide, path SVG tangan) di `app.js` (`ICONS` + fungsi `icon(name)`)
-- di-*inline* langsung sebagai markup, bukan file terpisah, jadi tidak
kena batasan CSP sama sekali.

Ikon disuntikkan lewat **JavaScript** (fungsi `renderNav()` yang sudah
dipanggil di setiap halaman), bukan dengan mengedit 14 file HTML satu per
satu:
- Ikon menu sidebar (mengganti karakter emoji lama).
- Tombol lonceng notifikasi + toggle tema di topbar.
- Chevron di avatar profil topbar.
- Bubble ikon berwarna di sebelah judul tiap halaman (ikut ikon menu
  aktifnya).
- Ikon panah keluar untuk Logout (mengganti karakter `⎋`).

Pendekatan ini membuat perubahan shell (sidebar + topbar) otomatis konsisten
di seluruh 13 halaman tanpa perlu menyentuh markup masing-masing halaman.

**Insiden kecil yang ditemukan & diperbaiki saat pengerjaan:** dua halaman
(`detail-tamu.html`, `bank-data-personnel.html`, lalu `dashboard.html`)
punya judul `<h1>` yang isinya di-*overwrite* penuh oleh JavaScript halaman
itu sendiri (`textContent = namaTamu`) -- ini menghapus bubble ikon yang
baru disuntikkan sebagai anak elemen pertama `<h1>`. Diperbaiki dengan
membungkus teks dinamis dalam `<span>` bersarang, supaya skrip halaman cuma
mengganti isi span itu, bukan seluruh `<h1>`.

### 2.2 Palet Aktif & Pil Navigasi

Sidebar tetap Admiral Blue (`--navy`), tapi item menu aktif diubah dari
"pil tint terang" jadi **pil solid biru cerah** (`--accent-hover`,
`#1a3ea3`) dengan teks putih + chevron kanan -- supaya kontras jelas
terhadap sidebar gelap, meniru pola mockup tanpa keluar dari keluarga warna
Admiral Blue.

### 2.3 Manajemen Pengguna Dirombak

- Toolbar pencarian (username/nama/role) + filter Role + filter Status,
  semua **client-side** (data user sudah kecil, tidak perlu endpoint baru).
- Header kolom tabel bisa diklik untuk **sortir** (username, nama, role,
  status) -- fungsi nyata, bukan sekadar ikon panah statis.
- Avatar bulat per baris: pakai foto asli (`avatar_url`) kalau ada, atau
  inisial huruf pertama dengan warna latar sesuai role kalau tidak ada.
- Badge Role berwarna + ikon (mahkota=Administrator, perisai=Petugas Pos
  Depan, centang=Verifikator) dan badge Status dengan titik indikator.
- Tombol aksi (Edit/Aktifkan-Nonaktifkan/Hapus) jadi tombol pill kecil
  berikon, bukan tombol teks polos.
- Paginasi baru (halaman, ukuran per-halaman) -- berfungsi nyata di atas
  data yang sudah difilter/disortir.
- Form Tambah & Edit Pengguna digabung jadi **satu modal** yang sama
  (berganti mode "tambah"/"edit"), dibuka dari tombol "+ Tambah Pengguna"
  di kanan atas atau tombol Edit per baris -- menggantikan pola lama (dua
  form section terpisah selalu terlihat di bawah tabel).

---

## 3. Insiden: Docker Lokal Bukan Server Deploy

Setelah redesain Manajemen Pengguna selesai secara kode, upaya menguji
perubahan lewat `docker compose up` **di komputer lokal** gagal berulang
kali:

1. Docker Desktop tidak mau menyala -- ternyata **WSL belum terpasang** di
   komputer ini (`wsl --status` melaporkan "not installed"), padahal Docker
   Desktop dikonfigurasi memakai backend WSL2.
2. `wsl --install` dijalankan (berhasil, tapi baru aktif setelah restart).
   Pengguna diminta izin eksplisit dulu sebelum restart dieksekusi (aksi
   yang mengganggu pekerjaan lain yang mungkin sedang terbuka).
3. Setelah restart & Docker Desktop akhirnya menyala, `docker compose build
   && up` untuk service `frontend` berhasil **build**, tapi container-nya
   **crash-loop**: nginx gagal start karena
   `/etc/nginx/certs/server.crt` tidak ditemukan.
4. Investigasi lebih lanjut (baca `04_dokumentasi_teknis_dan_keamanan.md`
   dan `05_ai_chat_dan_migrasi_deployment.md`) mengungkap akar masalahnya:
   **komputer ini bukan server produksi**. Aplikasi yang dilihat pengguna
   di browser berjalan di **server Ubuntu terpisah** (`187.52.126.252`),
   dan sertifikat TLS self-signed cuma ada di server itu, bukan di sini.
   Alur deploy yang benar (sudah didokumentasikan sejak `05_...md`):
   commit + push ke GitHub, lalu `ssh root@187.52.126.252` dan jalankan
   `git pull && docker compose build && docker compose up -d` di sana.

Setelah pengguna mengonfirmasi lewat `AskUserQuestion`, container
frontend lokal yang crash-loop dihentikan (`docker compose stop
frontend`), dan sejak titik ini **seluruh perubahan dalam dokumen ini
di-deploy lewat alur git pull + rebuild di server**, bukan Docker lokal.
Kunci SSH yang sudah terpasang di komputer ini (`~/.ssh/id_ed25519`,
berbeda dari `github_ed25519` yang dipakai untuk push) ternyata sudah
terdaftar di server dari sesi sebelumnya, jadi tidak perlu setup ulang.

**Pelajaran:** sebelum mengasumsikan "jalankan Docker Compose lokal" sebagai
cara menguji perubahan, cek dulu apakah proyek punya alur deploy terpisah
yang sudah terdokumentasi -- di proyek ini jawabannya sudah tertulis jelas
di `05_ai_chat_dan_migrasi_deployment.md` bagian 5.4, tapi sempat terlewat
sebelum mencoba jalur yang salah lebih dulu.

---

## 4. Redesain Dashboard

Mockup kedua dari pengguna (halaman Dashboard) diminta ditiru dengan warna
diganti biru navy. Sebelum membangun ulang, tiap elemen mockup dicek dulu
terhadap skema database yang sebenarnya ada -- **tidak ada angka rekaan**
yang ditampilkan seolah-olah data asli.

### 4.1 Kartu Statistik

4 kartu dengan bubble ikon berwarna: **Total Tamu** (navy), **Pendaftaran
Hari Ini** (biru, dengan tren naik/turun % riil dibanding kemarin --
dihitung dari query baru `yesterday`), **Tamu Aktif** (hijau), **Belum
Check-out** (amber, dari tabel `visits` yang belum punya `check_out_at`).
Kartu "Total Tamu" **sengaja tidak** diberi tren %, karena
total-kumulatif-vs-kemarin bukan metrik yang bermakna (selalu naik) --
beda dari mockup aslinya yang memaksakan tren di kartu itu.

### 4.2 Donut Chart & Kartu Ringkasan

- **Status Pendaftaran**: donut dari data `byStatus` yang sudah ada,
  warnanya disamakan dengan badge status yang sudah dipakai di halaman
  Daftar Tamu (konsisten, bukan palet baru).
- **Statistik Perangkat Elektronik**: donut baru dari agregasi
  `guest_members.device_status` (query baru).
- **Kategori Keamanan Personel**: kartu daftar (bukan donut) dari agregasi
  `guest_members.security_category`, **khusus tampil untuk Admin &
  Verifikator** (selaras dengan akses fitur Bank Data yang memang dibatasi
  ke dua role itu).

Ketiga sumber data ini dibangun sendiri (tanpa library chart), pakai SVG
`<circle>` dengan teknik `stroke-dasharray`/`stroke-dashoffset` untuk donut.

### 4.3 Grafik & Aktivitas Terbaru

Grafik Kunjungan diubah gayanya dari **bar chart ke area chart** (garis +
isian transparan, titik akhir ditonjolkan), tetap mempertahankan fungsi
lama (toggle Per Hari/Minggu/Bulan, tampilan tabel, tooltip hover).

**Aktivitas Terbaru** (khusus Admin) menarik 5 entri terbaru dari
`audit_logs` yang sudah ada (`GET /api/audit-logs?pageSize=5`) -- bukan
data baru, cuma ditampilkan lebih ringkas dengan ikon per jenis aksi
(pendaftaran, verifikasi, check-in/out, dst) dan format waktu relatif
("X menit yang lalu", fungsi `timeAgo()` baru).

### 4.4 Perubahan Backend

`GET /api/reports/dashboard` diperluas (tambahan, tidak menghapus field
lama): `yesterday`, `pendingCheckout`, `deviceStats`, `securityStats`
(`securityStats` cuma dikirim untuk role admin/verifikator). Semua dari
query SQL baru terhadap tabel yang sudah ada (`guests`, `visits`,
`guest_members`) -- diuji langsung terhadap database produksi (lewat kode
di dalam container backend yang sudah berjalan, tanpa perlu membaca
kredensial) sebelum di-deploy, memastikan tidak ada query yang gagal.

---

## 5. Penyesuaian Lanjutan

Tiga permintaan susulan setelah redesain awal terlihat pengguna:

1. **Sidebar dibuat lebih gelap** -- ditambahkan variabel `--sidebar-bg`
   (`#0b1830`) terpisah dari `--navy` (Admiral Blue), supaya cuma menu
   samping yang berubah gelap; elemen lain yang juga memakai `--navy`
   (halaman login, tooltip grafik, bubble chat) sengaja tidak ikut
   berubah karena tidak diminta.
2. **Grafik Kunjungan dibuka untuk role Verifikator** (akun `Danpussiberal`
   dicek langsung ke database, rolenya "verifikator") -- sebelumnya
   khusus Admin. Backend (`requireRole('admin', 'verifikator')`) dan
   frontend disesuaikan; kartu Aktivitas Terbaru **tetap** khusus Admin
   karena itu yang diminta. Saat cuma grafik yang tampil (tanpa kartu
   Aktivitas di sampingnya), lebarnya otomatis menyesuaikan penuh satu
   baris lewat kelas modifier baru, supaya tidak ada ruang kosong.
3. **Rapikan Grafik Kunjungan**: judul diganti "Grafik Kunjungan Tamu ke
   Pussiberal" (sebelumnya "...ke Mabesal"), dan filter periode + tombol
   tampilan tabel dipindah ke baris tersendiri **di bawah** judul (semula
   sejajar di kanan judul).

---

## 6. Sanitasi Upload Foto (Pengerasan Keamanan)

Diminta secara eksplisit: pastikan file berbahaya yang disamarkan sebagai
gambar (pola klasik `shell.php.jpg`) tidak bisa lolos lewat fitur foto.

### 6.1 Audit Menyeluruh

Sebelum memperbaiki apa pun, dilakukan audit read-only atas **seluruh**
jalur yang bersinggungan dengan file/gambar di backend maupun frontend
(lewat subagent riset terpisah, supaya cakupannya benar-benar tuntas):
dependency backend (tidak ada `multer`/`formidable`/`express-fileupload`
apa pun), semua pemanggilan `fs.writeFile`/`createWriteStream`, semua
`express.static`, konfigurasi `nginx.conf`, endpoint backup, bot Telegram,
AI chat.

**Kesimpulan kunci**: aplikasi ini **tidak pernah menyimpan foto sebagai
file di server**. Foto tamu & KTP (`guest_members.photo`/`ktp_photo`)
disimpan sebagai **data URL base64 langsung di kolom `MEDIUMTEXT`** di
database -- tidak ada folder upload, tidak ada `express.static` yang
menyajikan file pengguna, tidak ada interpreter PHP sama sekali di stack
Node.js/Express ini. Skema serangan "upload file `.php.jpg`, lalu server
menjalankannya" **tidak berlaku secara arsitektur** di aplikasi ini --
tidak ada mekanisme apa pun yang bisa membaca file itu sebagai `.php`.

Alur upload foto yang sebenarnya (`pendaftaran.js`) juga sudah punya
sanitasi bawaan yang cukup kuat: baik dari kamera maupun `<input
type="file">`, hasilnya **selalu digambar ulang lewat `<canvas>`**
(`canvas.toDataURL('image/jpeg', ...)`) sebelum dikirim -- file yang bukan
gambar valid akan gagal di-decode oleh `Image()` bawaan browser dan tidak
pernah sampai ke tahap ini sama sekali.

### 6.2 Dua Celah Nyata yang Tetap Diperbaiki (Defense-in-Depth)

Meski vektor serangan utama tidak berlaku, audit menemukan dua celah nyata
di lapisan validasi/render yang tetap layak diperbaiki:

**a. Validator foto terlalu longgar** (`backend/src/utils/validators.js`).
Sebelumnya cuma memeriksa apakah string *diawali* `data:image/png;base64,`
dst -- tanpa memvalidasi isinya, tanpa mengunci akhir string. Diganti:

```js
// Regex diikat penuh (^...$) -- payload base64 tidak boleh disisipi
// data lain setelahnya.
const match = /^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
if (!match) return false;

// Payload didekode, lalu byte awalnya dicocokkan dengan magic bytes asli
// PNG/JPEG/WebP -- file yang cuma "berlabel" gambar tapi isinya bukan
// gambar sungguhan akan ditolak di sini.
const buffer = Buffer.from(base64Payload, 'base64');
return hasValidImageMagicBytes(buffer, subtype);
```

Diuji langsung (lewat kode yang dijalankan di dalam container backend,
sebelum di-deploy) dengan beberapa kasus: gambar PNG asli (diterima),
teks PHP yang dibungkus prefix `data:image/png;base64,...` (**ditolak** --
magic bytes tidak cocok), prefix dengan spasi di tengah base64
(**ditolak**), gambar valid + `<script>` yang disisipkan di ekor string
(**ditolak** -- dulu lolos karena regex lama tidak diikat sampai akhir).

**b. Render `<img src>` tanpa escape** (`frontend/detail-tamu.js`). Nilai
`photo`/`ktp_photo` disisipkan ke `innerHTML` tanpa lewat `escapeHtml()`
(padahal semua field lain di file yang sama sudah konsisten pakai
`escapeHtml()`) -- celah berbentuk *stored XSS* kalau ada yang berhasil
menyimpan data janggal lewat panggilan API langsung (di luar UI resmi).
Risikonya sudah diredam CSP ketat yang sudah ada (`script-src 'self'`,
tanpa `'unsafe-inline'`), tapi tetap diperbaiki sebagai lapisan pertahanan
tambahan yang seharusnya memang ada sejak awal.

---

## 7. Berkas yang Ditambahkan/Diubah

| Berkas | Perubahan |
|---|---|
| `backend/src/routes/reports.js` | `/dashboard` diperluas (yesterday, pendingCheckout, deviceStats, securityStats); `/visit-stats` dibuka untuk role verifikator |
| `backend/src/utils/validators.js` | `isValidPhotoDataUrl()` diperkeras: regex diikat penuh + verifikasi magic bytes PNG/JPEG/WebP |
| `frontend/public/assets/app.js` | Registry ikon SVG (`ICONS`, fungsi `icon()`); `renderNav()` menyuntik ikon/tombol topbar/bubble judul ke semua halaman; `timeAgo()` baru |
| `frontend/public/assets/style.css` | Palet warna brand book; `@font-face` Open Sans; komponen baru (pil nav aktif, badge role/status, avatar, toolbar cari/filter, paginasi, modal, kartu statistik, donut chart, grafik area) |
| `frontend/public/assets/fonts/*.woff2` | **Baru** -- Open Sans self-hosted (4 weight) |
| `frontend/public/assets/users.js` | Ditulis ulang: cari/filter/sortir/paginasi client-side, modal tambah/edit |
| `frontend/public/assets/dashboard.js` | Ditulis ulang: kartu statistik, donut chart, area chart, aktivitas terbaru |
| `frontend/public/assets/detail-tamu.js` | `<img src>` foto sekarang di-`escapeHtml()` |
| `frontend/public/users.html`, `dashboard.html` | Struktur baru sesuai redesain masing-masing |
| `frontend/public/detail-tamu.html`, `bank-data-personnel.html` | Judul dinamis dibungkus `<span>` bersarang supaya tidak menghapus bubble ikon |

---

## 8. Status Akhir

- ✅ Palet warna & tipografi selaras brand book Naval-CSIRT, live di server.
- ✅ Sidebar/topbar app-wide + Manajemen Pengguna dirombak total, semua
  fitur (cari/filter/sortir/paginasi/modal) fungsional nyata, bukan
  tampilan kosong.
- ✅ Dashboard dirombak dengan data 100% riil dari database -- tidak ada
  sparkline/tren yang dipaksakan kalau memang tidak bisa dihitung jujur
  dari skema yang ada.
- ✅ Grafik Kunjungan sudah bisa diakses role Verifikator, judul & layout
  sudah dirapikan sesuai permintaan.
- ✅ Validasi foto diperkeras dengan verifikasi magic bytes; celah render
  `<img>` tanpa escape sudah diperbaiki; sudah diuji dengan payload
  berbahaya sebelum deploy.
- ✅ Seluruh perubahan sudah di-*commit*, di-push ke GitHub, dan di-deploy
  ke server produksi (`git pull` + `docker compose build && up -d` lewat
  SSH) -- bukan cuma tersimpan lokal.
- ⏸️ **Catatan:** alur pengujian lokal lewat Docker Compose di komputer
  Windows ini tidak sepenuhnya bisa dipakai (tidak ada sertifikat TLS di
  sini) -- verifikasi perubahan sebaiknya tetap lewat deploy ke server
  (siklusnya sudah terbukti cepat: commit &rarr; push &rarr; SSH pull +
  rebuild, biasanya di bawah 2 menit).
- ⏸️ Lonceng notifikasi & toggle mode gelap/terang di topbar masih murni
  visual (tooltip "segera hadir") -- belum ada sistem notifikasi maupun
  dark mode nyata di baliknya.
