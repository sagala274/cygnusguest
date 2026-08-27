# Arsitektur Aplikasi Pendaftaran Tamu Pussiberal

## 1. Gambaran Umum

Arsitektur menggunakan pendekatan modular 3-tier:

``` text
[Client / Browser]
        |
        v
[Web Application / Frontend]
        |
        v
[Backend API / Business Logic]
        |
        +------------------+
        |                  |
        v                  v
   [Database]        [Audit Log]
```

## 2. Komponen

### A. Frontend

Fungsi: - Form pendaftaran tamu. - Validasi input dasar. - Halaman
daftar tamu. - Detail profil tamu. - Status kunjungan. - Dashboard dan
pencarian.

Contoh teknologi: - React / Next.js atau framework web sejenis. -
Responsive design untuk desktop dan tablet.

### B. Backend API

Fungsi: - Autentikasi dan otorisasi. - Validasi data. - CRUD data
tamu. - Pengelolaan status kunjungan. - Pembuatan nomor registrasi. -
Audit logging. - Penyediaan API untuk frontend.

Contoh endpoint:

``` text
POST   /api/guests
GET    /api/guests
GET    /api/guests/{id}
PUT    /api/guests/{id}
DELETE /api/guests/{id}
POST   /api/guests/{id}/check-in
POST   /api/guests/{id}/check-out
GET    /api/guests/search
GET    /api/reports/visits
```

### C. Database

Tabel utama:

``` text
users
guests
visits
vehicles
audit_logs
```

Relasi sederhana:

``` text
users
  |
  +---- audit_logs

guests
  |
  +---- visits
          |
          +---- vehicles
```

## 3. Struktur Data Utama

### guests

  Field                 Keterangan
  --------------------- ---------------------
  id                    Primary key
  registration_number   Nomor registrasi
  full_name             Nama tamu
  nik                   NIK KTP
  phone_number          Nomor HP
  company               Perusahaan/instansi
  position              Jabatan
  purpose               Keperluan menghadap
  status                Status pendaftaran
  created_at            Waktu pendaftaran
  updated_at            Waktu perubahan

### vehicles

  Field          Keterangan
  -------------- ----------------
  id             Primary key
  guest_id       Relasi ke tamu
  vehicle_type   Jenis mobil
  plate_number   Nomor plat

### visits

  Field          Keterangan
  -------------- ------------------
  id             Primary key
  guest_id       Relasi ke tamu
  check_in_at    Waktu masuk
  check_out_at   Waktu keluar
  status         Status kunjungan

### audit_logs

  Field         Keterangan
  ------------- -----------------------------------
  id            Primary key
  user_id       Pengguna yang melakukan aktivitas
  action        Jenis aktivitas
  object_type   Jenis data
  object_id     ID data
  timestamp     Waktu aktivitas

## 4. Keamanan

Karena aplikasi menyimpan NIK dan nomor HP, keamanan menjadi bagian
utama desain.

Minimum control: - HTTPS/TLS. - Password disimpan menggunakan hashing
yang kuat. - Role-Based Access Control. - Session/token management yang
aman. - Validasi input server-side. - Protection terhadap SQL Injection
dan XSS. - Audit log. - Backup database terenkripsi. - Pembatasan akses
berdasarkan kebutuhan tugas. - NIK dan data pribadi tidak ditampilkan
penuh kepada seluruh pengguna. - Retensi dan penghapusan data mengikuti
kebijakan organisasi yang berlaku.

## 5. Role Pengguna

### Admin

-   Mengelola user.
-   Melihat seluruh data.
-   Mengelola konfigurasi aplikasi.

### Petugas Pendaftaran

-   Membuat pendaftaran.
-   Melakukan check-in/check-out.
-   Melihat data yang diperlukan untuk tugas.

### Pimpinan/Pejabat Berwenang

-   Melihat dashboard.
-   Melihat rekap dan riwayat sesuai kewenangan.

## 6. Deployment

``` text
Internet / Internal Network
          |
       Firewall
          |
      Web Server
          |
      Backend API
          |
      Database Server
```

Untuk lingkungan internal, aplikasi sebaiknya ditempatkan pada jaringan
yang dikendalikan organisasi dan tidak membuka database secara langsung
ke jaringan pengguna.

## 7. Backup dan Recovery

-   Backup database terjadwal.
-   Backup terenkripsi.
-   Pengujian restore secara berkala.
-   Logging kegagalan backup.
-   Recovery Point Objective (RPO) dan Recovery Time Objective (RTO)
    ditentukan pada tahap desain final.
