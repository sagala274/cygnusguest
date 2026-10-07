# Password Tambahan untuk Data Sensitif & Audit Keamanan (Persiapan Pentest)
## Aplikasi Pendaftaran Tamu PUSSIBERAL

Dokumen ini mencatat pekerjaan pada **6-7 Oktober 2026** (lanjutan dari
`18_ai_lokal_ollama_dan_penyimpanan_kredensial_pencarian.md`): lapis
keamanan tambahan khusus untuk halaman **Bank Data** dan **Data
Personel** (keduanya berisi hasil analisa/penilaian Kaur Pam & Baur Pam
yang sifatnya rahasia), serta audit keamanan menyeluruh sebagai
persiapan pengujian oleh tim pentest internal Pussiberal yang akan
memakai **Acunetix Pro**. Seluruh pekerjaan di dokumen ini sudah diuji
dan aktif berjalan di server produksi (https://187.52.126.252) sampai
tanggal disusunnya dokumen ini.

---

## 1. Password Tambahan untuk Bank Data & Data Personel

**Permintaan:** tambahkan keamanan berlapis -- setiap kali masuk ke
Bank Data, perlu password tambahan. Setelah didiskusikan lebih lanjut,
cakupan dan desainnya disesuaikan beberapa kali berdasarkan klarifikasi
langsung dari pengguna (lihat catatan di bawah).

**Desain final (setelah dua kali klarifikasi):**
- Password tambahan ini **terpisah total** dari password login --
  kolom baru `secondary_password_hash` di tabel `users`, bukan dicek
  terhadap `password_hash` yang dipakai untuk login sehari-hari.
  Kompromi salah satu password tidak otomatis membuka yang lain.
- Hanya dipasang di **Bank Data** dan **Data Personel** -- BUKAN di
  Daftar Tamu. Dicek dulu: Daftar Tamu dipakai rutin setiap hari oleh
  petugas pos depan (role `pos_depan`) dan ternyata tidak menampilkan
  data analisa/penilaian apa pun (cuma data pendaftaran dasar), jadi
  mengunci halaman itu hanya akan mengganggu kerja operasional tanpa
  manfaat keamanan nyata.
- Satu gerbang password berlaku untuk **kedua halaman sekaligus**
  (bukan per-halaman terpisah) -- terverifikasi di salah satu otomatis
  berlaku untuk yang satunya juga selama 15 menit, sesuai permintaan
  eksplisit pengguna setelah ditanya ulang ("mau dibuat lebih simple").

**Yang dikerjakan:**
- Kolom baru `secondary_password_hash` (terpisah dari `password_hash`)
  dan endpoint `POST /api/auth/verify-secondary-password` (terautentikasi,
  dibatasi rate limiter sendiri 5 percobaan/15 menit -- terpisah dari
  penguncian akun login biasa).
- Gerbang verifikasi (modal full-blocking, konten halaman benar-benar
  disembunyikan sampai lolos verifikasi -- bukan cuma ditutupi overlay)
  dipasang di `bank-data.html`, `bank-data-personnel.html`, dan
  `personnel-list.html`, memakai fungsi `requireStepUpAuth()` yang sudah
  dibuat generik (bisa dipakai ulang untuk gerbang serupa di masa depan).
- **Nilai awal diisi otomatis sesuai NRP** 4 akun perwira saat backend
  pertama kali start dengan kolom ini (idempoten -- tidak menimpa kalau
  sudah pernah diganti): Danpussiberal (12682), Wadanpussiberal (13365,
  dicocokkan dari data personel tersimpan), Kaurpam (22655, dicocokkan
  dari posisi "Kaur Pam Satma Pussiberal"), baurpam (130560, dicocokkan
  dari posisi "Ur Pam Satma Pussiberal").
- **Bisa diatur/direset kapan saja lewat menu Kelola Pengguna** (field
  baru "Password Tambahan" di form tambah/edit pengguna) -- sepenuhnya
  lewat aplikasi, tidak perlu akses server/database sama sekali. Ini
  khusus menjawab kekhawatiran pengguna (Kaurpam, role admin) yang
  tidak akan punya akses SSH lagi begitu aplikasi dipindah ke server
  internal Pussiberal.

**Catatan risiko yang disampaikan ke pengguna:** NRP adalah nomor dinas
yang relatif bisa diketahui pihak lain di lingkungan yang sama, dan
nilai awalnya tersimpan sebagai teks biasa di riwayat kode (git
history) sebagai default seed -- bukan di database (di database sudah
terenkripsi/di-hash). Disarankan setiap pemilik akun mengganti password
tambahannya sendiri lewat Kelola Pengguna sebelum pentest dilakukan.

---

## 2. Audit Keamanan Menyeluruh (Persiapan Acunetix Pro)

**Permintaan:** cek ulang frontend, backend, dan database karena tools
yang dipakai tim pentest adalah Acunetix Pro.

**Yang diperiksa (frontend, backend, database):**
- **SQL Injection** -- seluruh query diverifikasi memakai parameterized
  query (named params `:nama`); pola `${fields.join(', ')}` yang banyak
  dipakai untuk UPDATE dinamis diperiksa satu per satu dan dipastikan
  daftar field-nya selalu dibangun dari string tetap di kode server
  (bukan dari input pengguna), nilainya tetap lewat parameter terikat.
  `LIMIT`/`OFFSET` di semua endpoint listing diverifikasi selalu lewat
  `parseInt()` + pembatasan angka.
- **XSS** -- diperiksa pemakaian `escapeHtml()` di titik-titik yang
  menampilkan data dari input pengguna (nama tamu, NIK, catatan
  analisa, alamat, afiliasi, media sosial, dst.) di seluruh halaman
  yang relevan (Daftar Tamu, Detail Tamu, Bank Data, Data Personel,
  Dashboard) -- konsisten diterapkan.
- **Header keamanan** -- dikonfirmasi ulang konfigurasi nginx: HSTS,
  Content-Security-Policy ketat (`script-src 'self'` tanpa
  `unsafe-inline`), X-Frame-Options `DENY`, X-Content-Type-Options,
  `server_tokens off`, serta `X-Powered-By` Express yang sudah
  dimatikan di backend.
- **Kebocoran informasi lewat error** -- dipastikan error handler
  global backend selalu mengembalikan pesan generik ke klien, detail
  error (termasuk stack trace) hanya dicatat di log server.
- **Upload file** -- diverifikasi ulang validasi foto (magic bytes file
  asli, bukan cuma ekstensi/MIME yang diklaim; batas ukuran; karakter
  base64 ketat tanpa data tambahan setelahnya).
- **Broken Access Control / IDOR** -- diperiksa sampel endpoint edit
  data tamu (`PUT /guests/:id/members/:memberId`): dikonfirmasi query-nya
  memverifikasi `memberId` benar-benar anggota dari `guest_id` yang
  diminta (bukan cuma mengecek ID ada), mencegah pengeditan data tamu
  lain lewat tebak-ID.
- **Autentikasi** -- dikonfirmasi bcrypt untuk seluruh password, rate
  limiter + penguncian akun untuk percobaan login bertubi-tubi, dan
  algoritma JWT yang dikunci eksplisit ke `HS256` saat verifikasi
  (mencegah serangan algorithm confusion).
- **Command Injection** -- satu-satunya pemakaian `child_process`
  (menjalankan `mysqldump` untuk backup otomatis) diverifikasi memakai
  `spawn()` dengan argumen berbentuk array, bukan string shell yang
  bisa disisipi perintah tambahan.
- **CORS** -- dikonfirmasi tidak ada konfigurasi CORS sama sekali,
  sesuai arsitektur satu origin (frontend & backend lewat nginx yang
  sama) -- aman secara default karena tidak ada origin lain yang
  diizinkan memanggil API dengan kredensial.

**Temuan & diperbaiki:** `npm audit` pada backend menemukan satu CVE
tingkat *moderate* pada paket `uuid` (versi di bawah 11.1.1,
GHSA-w5hq-g745-h8pq, celah pada pemeriksaan batas buffer) -- dependensi
transitif lewat `exceljs` dan `node-cron`, bukan dipakai langsung oleh
kode aplikasi. Perbaikan otomatis yang disarankan npm (`npm audit fix
--force`) akan menurunkan versi `exceljs` secara signifikan dan
berisiko merusak fitur ekspor Excel yang sudah dipakai -- sebagai
gantinya ditambal lewat field `overrides` di `package.json` supaya
versi `uuid` di seluruh pohon dependency naik ke versi aman tanpa
mengubah `exceljs`/`node-cron` itu sendiri. Setelah dibangun ulang dan
diuji, `npm audit` menunjukkan 0 temuan, dan fitur ekspor Excel
dikonfirmasi tetap berfungsi normal.

**Catatan untuk koordinasi dengan tim pentest:** beberapa mekanisme
keamanan yang sudah dibangun bisa membuat scan otomatis Acunetix
berhenti di titik tertentu -- ini bukan bug, tapi perilaku yang memang
disengaja:
- Rate limiter pada endpoint login dan verifikasi password (5
  percobaan/15 menit) bisa mengunci sementara alamat IP scanner kalau
  ia mencoba banyak kombinasi berturut-turut.
- Gerbang password tambahan (lihat Bagian 1) akan memblokir scanner
  masuk lebih dalam ke Bank Data/Data Personel kecuali diberi
  kredensial valid.

Kalau tim pentest ingin pengujian menjangkau sampai ke dalam kedua
halaman tersebut, perlu dikoordinasikan kredensial ujinya lebih dulu.

---

## Cara Kerja Pengembangan (Untuk Referensi)

Fitur password tambahan melalui dua putaran klarifikasi langsung
dengan pengguna sebelum desain akhirnya ditentukan (awalnya diasumsikan
memakai password login yang sudah ada, lalu dikoreksi jadi password
terpisah; awalnya mengunci 3 halaman termasuk Daftar Tamu, lalu
dipersempit ke 2 halaman setelah ditemukan konflik dengan kerja rutin
petugas pos depan). Audit keamanan dilakukan dengan membaca langsung
kode sumber di setiap kategori OWASP yang relevan (bukan hanya
mengandalkan deskripsi/komentar di kode), dan satu-satunya temuan nyata
(CVE `uuid`) diverifikasi ulang dengan menjalankan `npm audit` dan
smoke-test `exceljs` di container produksi setelah perbaikan di-deploy.

*Dokumen ini melengkapi:*
- `17_laporan_absensi_dan_pencarian_tamu_ai_chat.md`
- `18_ai_lokal_ollama_dan_penyimpanan_kredensial_pencarian.md`
