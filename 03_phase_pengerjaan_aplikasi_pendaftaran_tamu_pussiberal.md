# Phase Pengerjaan Aplikasi Pendaftaran Tamu Pussiberal

## Phase 1 --- Analisis Kebutuhan

**Output:** Dokumen kebutuhan sistem.

Pekerjaan: - Menentukan tujuan aplikasi. - Menentukan alur
pendaftaran. - Menentukan field data. - Menentukan role pengguna. -
Menentukan kebutuhan keamanan. - Menentukan kebutuhan laporan. -
Menentukan aturan retensi data.

**Kriteria selesai:** - Requirement disetujui. - Alur bisnis
disepakati. - Field dan role sudah final.

------------------------------------------------------------------------

## Phase 2 --- Perancangan UI/UX

**Output:** Wireframe dan desain halaman.

Halaman minimum: 1. Login. 2. Dashboard. 3. Pendaftaran tamu. 4. Daftar
tamu. 5. Detail tamu. 6. Check-in. 7. Check-out. 8. Laporan. 9.
Manajemen pengguna.

**Kriteria selesai:** - Form mudah digunakan. - Validasi input jelas. -
Tampilan desktop/tablet tersedia. - Hak akses tiap halaman sudah
ditentukan.

------------------------------------------------------------------------

## Phase 3 --- Perancangan Database

**Output:** ERD dan database schema.

Pekerjaan: - Membuat tabel users. - Membuat tabel guests. - Membuat
tabel vehicles. - Membuat tabel visits. - Membuat tabel audit_logs. -
Menentukan primary key dan foreign key. - Menentukan index pencarian. -
Menentukan strategi backup.

**Kriteria selesai:** - ERD disetujui. - Migration/schema siap
digunakan. - Constraint validasi tersedia.

------------------------------------------------------------------------

## Phase 4 --- Pengembangan Backend

**Output:** REST API/Backend Service.

Pekerjaan: - Login dan autentikasi. - Role-based authorization. - API
pendaftaran tamu. - API pencarian. - API detail tamu. - API
check-in/check-out. - API laporan. - Audit logging. - Server-side
validation.

**Kriteria selesai:** - Endpoint berjalan. - Authorization diuji. -
Error handling tersedia. - Audit log berjalan.

------------------------------------------------------------------------

## Phase 5 --- Pengembangan Frontend

**Output:** Aplikasi web yang dapat digunakan petugas.

Pekerjaan: - Implementasi login. - Form pendaftaran. - Daftar tamu. -
Detail tamu. - Check-in/check-out. - Dashboard. - Pencarian/filter. -
Laporan.

**Kriteria selesai:** - Semua fungsi utama dapat digunakan. - Validasi
frontend dan backend konsisten. - Tidak ada fungsi yang dapat diakses di
luar role.

------------------------------------------------------------------------

## Phase 6 --- Integrasi dan Security Testing

**Output:** Hasil pengujian keamanan dan integrasi.

Pengujian: - Authentication testing. - Authorization testing. - Input
validation. - SQL Injection testing. - XSS testing. - Session
management. - Access control testing. - Audit log verification. -
Backup/restore testing. - Data exposure testing.

**Kriteria selesai:** - Tidak ada vulnerability kritis/high yang belum
ditangani. - Hak akses sesuai role. - Data sensitif tidak bocor pada
response/API/log.

------------------------------------------------------------------------

## Phase 7 --- User Acceptance Test (UAT)

**Output:** Berita acara/hasil UAT.

Skenario minimum: 1. Petugas login. 2. Petugas mendaftarkan tamu. 3.
Sistem menolak NIK yang tidak valid. 4. Sistem menyimpan data valid. 5.
Sistem menghasilkan nomor registrasi. 6. Petugas melakukan check-in. 7.
Petugas melakukan check-out. 8. Pimpinan melihat rekap. 9. User tanpa
kewenangan mencoba mengakses data terbatas.

------------------------------------------------------------------------

## Phase 8 --- Deployment

**Output:** Aplikasi production.

Pekerjaan: - Menyiapkan server. - Konfigurasi database. - Konfigurasi
HTTPS. - Konfigurasi firewall. - Deployment backend. - Deployment
frontend. - Migrasi database. - Backup awal. - Pembuatan akun pengguna.

------------------------------------------------------------------------

## Phase 9 --- Monitoring dan Maintenance

**Output:** Sistem operasional dan terdokumentasi.

Pekerjaan: - Monitoring server. - Monitoring database. - Monitoring
error. - Review audit log. - Backup berkala. - Patch keamanan. - Review
user access. - Perbaikan bug. - Pengembangan fitur lanjutan.

------------------------------------------------------------------------

# Prioritas MVP

Untuk versi pertama, fokus pada:

1.  Login.
2.  Form pendaftaran tamu.
3.  Penyimpanan database.
4.  Validasi NIK dan nomor HP.
5.  Nomor registrasi.
6.  Pencarian tamu.
7.  Check-in/check-out.
8.  Role petugas dan admin.
9.  Audit log.
10. Backup database.

Fitur seperti QR Code, dashboard lanjutan, notifikasi, integrasi sistem
eksternal, dan analitik dapat dikerjakan setelah MVP stabil.
