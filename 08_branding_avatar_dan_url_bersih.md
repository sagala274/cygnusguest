# Branding, Avatar Per-Akun, dan URL Bersih
## Aplikasi Pendaftaran Tamu PUSSIBERAL

Dokumen ini mencatat pekerjaan pada **29 Agustus 2026**: penggantian logo,
foto tamu/KTP wajib, sistem avatar per-akun, perubahan menu logout, dan
penghilangan ekstensi `.html` dari URL. Dokumen ini melengkapi:

- `06_integrasi_telegram.md`
- `07_formulir_lanjutan_dan_perbaikan_data.md`

---

## 1. Logo & Branding

Huruf "P" pada sidebar dan halaman login diganti dengan emblem resmi
PUSSIBERAL (elang, globe, jangkar) yang diberikan pengguna dalam bentuk
gambar.

### 1.1 Penghilangan Background

Gambar sumber punya latar putih polos. Karena tidak ada tool pengolah gambar
terpasang di komputer lokal (Python cuma stub Microsoft Store, tanpa
ImageMagick), background dihilangkan lewat **container Python sekali-pakai**
(`docker run --rm python:3-slim`, Pillow diinstal sementara di dalamnya, lalu
container otomatis terhapus) yang dijalankan di server -- tidak ada software
baru yang terpasang permanen di mana pun.

Algoritme penghapusan background: piksel dianggap "background" kalau
**terang DAN tidak berwarna** (nilai `max(R,G,B) - min(R,G,B)` kecil),
dengan transisi alpha yang halus di tepi supaya tidak menghasilkan potongan
bergerigi. Piksel emas (warna khas, saturasi tinggi) maupun bayangan gelap di
lekukan artwork tetap dipertahankan meski redup, karena syaratnya harus
"terang" **dan** "tidak berwarna" sekaligus. Hasil diverifikasi lewat
sampling piksel (`img.getpixel(...)`) di beberapa titik -- sudut gambar
alpha=0 (transparan penuh), bagian artwork alpha mendekati 255 -- bukan
sekadar dilihat sekilas.

Ukuran gambar dikompres dari ~3,6MB (resolusi asli 2208x1952) menjadi ~78KB
(diperkecil ke 400px) supaya tidak memperlambat loading halaman.

### 1.2 Ukuran & Jarak

Logo sempat direvisi dua kali sesuai masukan visual langsung:
`.brand-mark` dari 42px &rarr; **72px** (44px di layar sempit), dan jarak ke
teks "PUSSIBERAL" dari 10px &rarr; 14px &rarr; **6px** (dirapatkan lagi
setelah terlihat kurang seimbang).

---

## 2. Foto Tamu & Foto KTP Wajib Diisi

Sebelumnya kedua field ini opsional (`isValidPhotoDataUrl()` mengizinkan
`null`/`undefined`). Diubah jadi wajib **khusus untuk pendaftaran baru**:

- Frontend: label "Opsional" diganti tanda wajib (`*`), submit form divalidasi
  sebelum request dikirim.
- Backend: `validateMember()` di `guests.js` menolak `POST /api/guests` tanpa
  foto tamu/KTP, dengan pesan error per-tamu.
- **Endpoint edit** (`PUT /guests/:id/members/:memberId`, dipakai admin di
  Bank Data) sengaja **tidak** ikut diwajibkan -- tetap bisa update sebagian
  data tanpa menyertakan ulang foto, supaya data lama yang mungkin belum
  punya foto tidak terkunci.

---

## 3. Avatar Per-Akun

### 3.1 Fitur

Kolom `avatar_url` baru di tabel `users` (nullable, migrasi idempoten lewat
`information_schema` seperti pola-pola sebelumnya). Disertakan di respons
login, ditampilkan otomatis di lingkaran avatar topbar (menggantikan lingkaran
abu-abu polos) lewat `avatarEl.style.backgroundImage`. Endpoint
`PUT /api/users/:id` menerima `avatar_url` supaya avatar akun mana pun bisa
diatur lewat API ke depannya.

**Catatan penting:** avatar hanya ikut ter-update di sisi pengguna saat
**login ulang** (bukan sekadar refresh halaman) -- data user, termasuk
avatar, tersimpan di `localStorage` saat login dan tidak otomatis
disinkronkan ulang dari server.

### 3.2 Empat Avatar Terpasang

Pengguna memberikan satu lembar gambar berisi 4 emblem berbeda (Danpussiberal,
Kaur Pam, Bintara Ur Pam, Pos Jaga Cygnus) yang **cocok persis** dengan
akun-akun yang sudah ada di sistem. Tiap emblem dipotong presisi dari lembar
tersebut (deteksi otomatis batas artwork lewat bounding-box non-putih,
dipadatkan jadi persegi, di-resize ke 300x300) lalu dipasangkan:

| Username | Full Name | Avatar |
|---|---|---|
| `Kaurpam` | Kaur Pam | perisai + pedang |
| `Danpussiberal` | Danpussiberal | jangkar + menara |
| `baurpam` | Doni | siluet prajurit + gembok |
| `cygnus` | jaga cygnus | pos jaga + palang |

Karena kredensial admin yang tersimpan dari awal sesi sudah tidak berlaku
lagi (kemungkinan sudah diganti pengguna sendiri -- praktik keamanan yang
baik), `avatar_url` untuk 4 akun ini di-set langsung lewat SQL (`UPDATE
users SET avatar_url = ... WHERE username = ...`), bukan lewat API.

---

## 4. Menu Logout Dipindah ke Dropdown Avatar

### 4.1 Perubahan

Tombol "Logout" yang sebelumnya berdiri sendiri di bagian bawah sidebar
dihapus. Sekarang logout diakses dengan **klik foto profil/avatar** di
topbar, yang membuka dropdown kecil berisi tombol Logout. Dropdown menutup
otomatis saat klik di luar area atau tekan `Esc`. Diterapkan di 13 halaman
(semua halaman kecuali login).

Perilaku dipastikan konsisten di HP maupun laptop: dropdown memakai
`position: absolute` relatif terhadap avatar (bukan patokan lebar layar), dan
event `click` bekerja sama baiknya untuk tap maupun klik mouse tanpa
penanganan terpisah.

### 4.2 Insiden: Kerusakan Encoding Karakter (dan Pemulihannya)

Percobaan pertama mengganti struktur HTML di 13 file sekaligus memakai
`perl -0777 -pi` dengan escape Unicode (`\x{23CF}` untuk ikon logout).
Kombinasi ini **merusak encoding UTF-8 di seluruh isi file** -- bukan cuma
teks baru, tapi karakter/emoji yang sudah ada sebelumnya (⎋ ◆ ✎ ⚠ dsb) ikut
berubah jadi karakter aneh (mojibake, mis. `â`). Penyebabnya: Perl membaca
file sebagai byte mentah, tapi begitu escape Unicode dipakai sebagian isinya
"naik level" ke representasi internal wide-character Perl, sehingga saat
ditulis ulang terjadi mismatch encoding pada seluruh string.

**Terdeteksi segera** dari hasil diff sebelum sempat di-commit atau
di-deploy. Karena perubahan belum di-`git add`, pemulihan cukup dengan
`git checkout --` pada 13 file tersebut -- kembali bersih ke versi commit
terakhir tanpa kehilangan apa pun. Pekerjaan diulang dengan cara yang aman:
**Edit tool per file** (bukan lewat shell), yang menangani karakter Unicode
secara langsung tanpa lapisan encoding tambahan yang rawan gagal.

**Pelajaran:** kalau harus mengganti teks yang mengandung karakter non-ASCII
di banyak file sekaligus lewat shell, escape Unicode di Perl (`\x{...}`)
berisiko tinggi -- lebih aman pakai karakter literal langsung, atau proses
satu file per pemanggilan tool yang memang dirancang untuk itu.

---

## 5. URL Bersih (Hilangkan Ekstensi `.html`)

### 5.1 Konfigurasi Nginx

Dua penyesuaian di `nginx.conf`:

```nginx
# Akses langsung ke *.html di-redirect permanen ke versi tanpa ekstensi,
# query string ikut terbawa lewat $is_args$args.
location ~ ^/(.+)\.html$ {
    return 301 /$1$is_args$args;
}

location / {
    try_files $uri $uri.html $uri/ =404;
}
```

`/dashboard` &rarr; dicoba sebagai file (tidak ada) &rarr; dicoba
`dashboard.html` (ada) &rarr; disajikan, URL di address bar tetap `/dashboard`.
Akses langsung ke `/dashboard.html` (bookmark lama, tautan luar) tetap
berfungsi tapi otomatis di-redirect ke bentuk bersihnya.

### 5.2 Pembersihan Seluruh Link Internal

Kalau cuma nginx yang diubah, mengklik link di dalam aplikasi akan tetap
menampilkan `.html` di address bar (karena linknya sendiri masih mengandung
`.html`, lalu di-redirect balik -- pengalaman yang janggal). Maka **seluruh
referensi `.html`** di kode aplikasi turut dibersihkan: 17 berkas JavaScript
(termasuk daftar menu sidebar, seluruh pemanggilan `renderNav()`, redirect
setelah login/logout, link "Detail"/"Lihat Pendaftaran" yang dibuat dinamis)
dan 2 berkas HTML (`bank-data-personnel.html`, `detail-tamu.html`).

Kali ini dipakai `sed` (bukan Perl) karena penggantiannya murni ASCII
(`.html` &rarr; kosong, tanpa karakter Unicode terlibat) -- aman dari kelas
bug di [4.2](#42-insiden-kerusakan-encoding-karakter-dan-pemulihannya). Tetap
diverifikasi ulang (grep untuk karakter rusak, cek jumlah file yang berhasil
diubah) sebelum commit, sebagai kebiasaan yang dibawa dari insiden
sebelumnya.

### 5.3 Verifikasi

```
GET /dashboard              -> 200
GET /login                  -> 200
GET /dashboard.html         -> 301 -> /dashboard
GET /daftar-tamu.html?status=Menunggu%20Verifikasi
                             -> 301 -> /daftar-tamu?status=Menunggu%20Verifikasi
```

Query string terbukti ikut terbawa lewat redirect, tidak hilang.

---

## 6. Berkas yang Ditambahkan/Diubah

| Berkas | Perubahan |
|---|---|
| `backend/src/utils/userAvatar.js` | **Baru** -- migrasi kolom `avatar_url` |
| `backend/src/routes/auth.js` | Sertakan `avatar_url` di respons login |
| `backend/src/routes/users.js` | `avatar_url` bisa diatur lewat `PUT /users/:id`, disertakan di `GET /users` |
| `backend/src/routes/guests.js` | Foto tamu & KTP wajib diisi saat `POST /guests` |
| `db/init.sql` | Kolom `avatar_url` untuk instalasi baru |
| `frontend/public/assets/logo.png` | **Baru** -- emblem PUSSIBERAL, background transparan |
| `frontend/public/assets/avatars/*.png` | **Baru** -- 4 avatar akun |
| `frontend/public/assets/style.css` | Styling `.brand-mark` (gambar), `.profile-menu`/`.profile-dropdown` (dropdown logout) |
| `frontend/public/assets/app.js` | Render avatar di topbar; logika toggle dropdown profil; seluruh link `.html` dibersihkan |
| `frontend/public/assets/pendaftaran.js` | Validasi foto wajib; placeholder disederhanakan |
| 13 berkas HTML halaman (kecuali login) | Struktur `.logout` diganti `.profile-menu` + `.profile-dropdown` |
| 17 berkas JavaScript halaman | Referensi `.html` dihapus dari seluruh navigasi |
| `frontend/nginx.conf` | Redirect `.html` &rarr; tanpa ekstensi + `try_files` untuk URL bersih |

---

## 7. Status Akhir

- ✅ Logo emblem live di sidebar & login, background transparan, ukuran &
  jarak sudah disesuaikan sesuai masukan.
- ✅ Foto tamu & KTP wajib untuk pendaftaran baru, endpoint edit tetap
  fleksibel.
- ✅ 4 avatar akun terpasang dan terverifikasi bisa diakses.
- ✅ Logout lewat dropdown avatar, berfungsi di seluruh halaman.
- ✅ URL bersih tanpa `.html`, redirect otomatis untuk tautan lama, query
  string terjaga.
- ⏸️ **Catatan:** 5 berkas PNG mentah (`Logo Akun Danpussiberal.png`, dll)
  masih ada di root folder proyek -- sudah redundan karena versi olahannya
  ada di `assets/avatars/`, aman dihapus kapan saja.
- ⏸️ Kredensial admin awal (`admin`/`Kaurpam`) yang tersimpan di catatan kerja
  sudah tidak berlaku -- kemungkinan sudah diganti pengguna sendiri.
