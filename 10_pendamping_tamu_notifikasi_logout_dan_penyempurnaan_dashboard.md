# Pendamping Tamu, Notifikasi Logout, dan Penyempurnaan Dashboard
## Aplikasi Pendaftaran Tamu PUSSIBERAL

Dokumen ini mencatat pekerjaan pada **30 Agustus 2026** (lanjutan hari yang
sama dengan `09_redesain_tema_dan_sanitasi_upload.md`): perbaikan celah sesi
login, pencatatan & notifikasi Telegram saat logout, kolom baru "tamu
didampingi oleh", serta beberapa penyempurnaan tampilan dan akurasi data di
Dashboard. Dokumen ini melengkapi:

- `08_branding_avatar_dan_url_bersih.md`
- `09_redesain_tema_dan_sanitasi_upload.md`

---

## 1. Perbaikan Sesi Login: localStorage &rarr; sessionStorage

**Dilaporkan pengguna:** menutup tab/browser lalu membukanya lagi tetap
dalam kondisi login tanpa perlu memasukkan kredensial ulang.

**Akar masalah:** token JWT disimpan di `localStorage`, yang bertahan
permanen sampai dihapus manual -- selama token belum kedaluwarsa (masa
berlaku 8 jam di backend), sesi tetap "hidup" walau browser ditutup total.

**Perbaikan:** seluruh fungsi sesi (`getToken`, `getUser`, `setSession`,
`clearSession` di `app.js`) dipindah ke `sessionStorage`, yang otomatis
dikosongkan browser saat tab/window ditutup. Token lama yang mungkin masih
tersisa di `localStorage` dari versi sebelumnya juga dibersihkan sekali di
awal skrip. Efek langsung: siapa pun yang sedang login di browser mana pun
diminta login ulang begitu halaman berikutnya dimuat.

---

## 2. Pencatatan & Notifikasi Telegram Saat Logout

Sebelumnya logout murni aksi *client-side* (hapus token, redirect ke
halaman login) -- tidak tercatat di Log Aktivitas maupun terkirim ke
Telegram, berbeda dengan login yang sudah lama tercatat & dinotifikasi.

- **Endpoint baru** `POST /api/auth/logout` (terautentikasi): mencatat
  audit log (aksi `logout`) dan mengirim notifikasi Telegram lewat
  `notifyLogout()`, simetris dengan alur `notifyLogin()` yang sudah ada.
- **Toggle terpisah** "Kirim notifikasi saat ada logout" di halaman
  Notifikasi Telegram (default aktif) -- bisa dimatikan independen dari
  notifikasi login, pola yang sama dengan toggle-toggle lain yang sudah ada.
  Ditambahkan lewat migrasi kolom idempoten (`notify_logout`, dicek lewat
  `information_schema` sebelum `ALTER TABLE`) supaya instalasi lama yang
  tabelnya sudah ada tidak perlu di-drop ulang.
- Tombol Logout di frontend sekarang memanggil endpoint ini dulu sebelum
  membersihkan sesi -- **best-effort**: kalau panggilan API gagal (jaringan
  bermasalah, token sudah kedaluwarsa), logout di sisi klien tetap
  dilanjutkan, tidak pernah membuat pengguna "terjebak" tidak bisa logout.
- Log Aktivitas (filter aksi) dan kartu Aktivitas Terbaru di Dashboard
  menampilkan "Logout" dengan label dan ikon (pintu keluar) sendiri.

Cakupan notifikasi sempat diklarifikasi dulu ke pengguna sebelum dikerjakan:
apakah notifikasi hanya untuk akun Kaurpam secara spesifik, atau untuk
SIAPA PUN yang logout (dikirim ke chat Telegram yang sama dengan notifikasi
login yang sudah ada, yang memang dipantau Kaurpam). Jawabannya opsi kedua
-- simetris dengan fitur notifikasi login yang sudah berjalan.

---

## 3. Kolom Baru: "Tamu Didampingi Oleh"

Kolom baru `guests.accompanied_by` (VARCHAR 150, opsional) untuk mencatat
petugas PUSSIBERAL yang mendampingi tamu -- misalnya diisi "Jaga Cygnus"
saat Kaurpam/Baurpam tidak di tempat.

- **Formulir Pendaftaran Tamu**: field opsional baru di bagian Perusahaan
  & Keperluan, dengan catatan bantuan yang menjelaskan kapan biasanya diisi.
- **Detail Tamu**: nilainya ditampilkan di Detail Pendaftaran (untuk semua
  peran yang berhak melihat halaman ini), dan bisa diisi/diubah lagi oleh
  Verifikator di bagian Verifikasi Pendaftaran saat menyetujui/menolak --
  field ini di-*pre-fill* dengan nilai yang sudah ada dari pendaftaran,
  supaya tidak tertimpa kosong kalau Verifikator tidak menyentuhnya sama
  sekali.
- **Backend**: diterima dan divalidasi (panjang maksimal) di tiga endpoint
  -- `POST /guests` (saat pendaftaran), `PUT /guests/:id` (edit umum), dan
  `POST /guests/:id/verify` (saat verifikasi). Migrasi kolom memakai fungsi
  `ensureGuestExtraColumns()` yang sudah ada (dipakai sebelumnya untuk
  `target_officials`/`purpose_category`), bukan membuat berkas migrasi
  terpisah baru -- konsisten dengan pola yang sudah mapan di proyek ini.

---

## 4. Penyempurnaan Dashboard

Tiga perbaikan terpisah, masing-masing diminta setelah pengguna melihat
hasil redesain Dashboard sebelumnya secara langsung di browser:

### 4.1 Warna Kategori Keamanan Personel

Kartu "Kategori Keamanan Personel" tadinya memakai warna token institusional
yang cenderung coklat tua untuk "Perlu Perhatian". Diganti warna yang lebih
vivid dan tegas: **Perlu Perhatian** jadi kuning/oranye (`#f59e0b`), **Perlu
Penanganan** jadi merah (`#dc2626`) -- kategori "Aman" tetap hijau.

### 4.2 Statistik Perangkat Elektronik: Donut &rarr; Bar List Horizontal

Sesuai referensi visual dari pengguna, kartu ini diubah dari donut chart
menjadi daftar bar horizontal -- satu bar per kategori (Dititipkan, Tetap
Bawa HP, dst), panjang bar proporsional terhadap kategori dengan nilai
terbesar, label & jumlah ditampilkan di bawah tiap bar, total ditampilkan
sebagai angka besar di atas. Kartu "Status Pendaftaran" sengaja **tidak**
ikut diubah (tetap donut) karena tidak diminta.

### 4.3 Perbaikan "Total Tamu": Pendaftaran vs Individu

**Dilaporkan pengguna:** kartu "Total Tamu" menunjukkan 9, tapi total pada
kartu Statistik Perangkat Elektronik menunjukkan 10 -- terlihat seperti
salah hitung.

**Penjelasan (bukan bug data):** kartu "Total Tamu" sejak awal menghitung
jumlah **pendaftaran** (`COUNT(*) FROM guests`), padahal satu pendaftaran
bisa berisi lebih dari satu orang. Statistik Perangkat Elektronik menghitung
jumlah **individu** (`COUNT(*) FROM guest_members`) -- kedua angka itu
memang mengukur hal berbeda, dan pada kasus ini terbukti benar: 9
pendaftaran, salah satunya berisi 2 orang, jadi total individu 10 (diuji
langsung ke database sebelum menyimpulkan, bukan tebakan).

**Perbaikan:** endpoint `/reports/dashboard` menambahkan field
`totalGuests` (`COUNT(*) FROM guest_members`), dipakai khusus untuk kartu
"Total Tamu" supaya angkanya konsisten dengan Statistik Perangkat
Elektronik. Field `total` (jumlah pendaftaran) tetap dipertahankan apa
adanya untuk donut "Status Pendaftaran", karena breakdown status di sana
memang dihitung per pendaftaran, bukan per orang -- mengubahnya akan
menciptakan inkonsistensi baru di tempat lain.

---

## 5. Berkas yang Ditambahkan/Diubah

| Berkas | Perubahan |
|---|---|
| `backend/src/routes/auth.js` | Endpoint baru `POST /auth/logout` (audit log + notifikasi Telegram) |
| `backend/src/utils/telegram.js` | Migrasi kolom `notify_logout`; fungsi `notifyLogout()` |
| `backend/src/routes/telegramSettings.js` | `notify_logout` di `GET`/`PUT` |
| `backend/src/routes/guests.js` | `accompanied_by` diterima di create/edit/verify; `totalGuests` tidak di sini (ada di reports.js) |
| `backend/src/utils/guestFields.js` | Migrasi kolom `accompanied_by` (ditambahkan ke `ensureGuestExtraColumns()`) |
| `backend/src/routes/reports.js` | `/visit-stats` dibuka untuk role verifikator; `/dashboard` menambah `totalGuests` |
| `db/init.sql` | Kolom `notify_logout` dan `accompanied_by` untuk instalasi baru |
| `frontend/public/assets/app.js` | Sesi pindah ke `sessionStorage`; logout memanggil API baru; label aksi `logout` |
| `frontend/public/assets/dashboard.js` | `renderBarList()` baru; warna kategori keamanan; `totalGuests` untuk kartu Total Tamu |
| `frontend/public/assets/style.css` | Komponen `.bar-list-*` |
| `frontend/public/assets/detail-tamu.js` + `.html` | Field & tampilan "Tamu Didampingi Oleh" |
| `frontend/public/assets/pendaftaran.js` + `.html` | Field "Tamu Didampingi Oleh" di formulir |
| `frontend/public/telegram-settings.js` + `.html` | Checkbox notifikasi logout |
| `frontend/public/audit-log.html` | Opsi filter "Logout" |

---

## 6. Status Akhir

- ✅ Celah sesi login (tetap login setelah browser ditutup) sudah
  diperbaiki dan live di produksi.
- ✅ Logout tercatat di Log Aktivitas & mengirim notifikasi Telegram,
  simetris dengan login.
- ✅ Kolom "Tamu Didampingi Oleh" tersedia di Pendaftaran dan Verifikasi
  Tamu, tersimpan permanen di database.
- ✅ Tiga penyempurnaan Dashboard (warna kategori keamanan, bar list
  perangkat elektronik, akurasi kartu Total Tamu) sudah live.
- ✅ Setiap perubahan pada dokumen ini diverifikasi langsung ke database
  produksi (query nyata lewat kode di dalam container backend, tanpa
  membaca kredensial) sebelum dan sesudah deploy.
