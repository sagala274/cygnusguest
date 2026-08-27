# Aplikasi Pendaftaran Tamu Pussiberal

## 1. Tujuan

Aplikasi digunakan untuk melakukan pencatatan, verifikasi, dan
pengelolaan data tamu yang akan berkunjung ke Pussiberal secara
terstruktur dan terdokumentasi.

## 2. Data Pendaftaran Tamu

  -----------------------------------------------------------------------------
  Field            Tipe                             Wajib Keterangan
  ---------------- ---------------- --------------------- ---------------------
  Nama Tamu        Text                                Ya Nama lengkap sesuai
                                                          identitas

  NIK KTP          String                              Ya Nomor Induk
                                                          Kependudukan 16 digit

  Keperluan        Text/Long Text                      Ya Maksud atau tujuan
  Menghadap                                               kunjungan

  Jenis Mobil      Text/Select                      Tidak Jenis/merek kendaraan

  Plat Mobil       String                           Tidak Nomor registrasi
                                                          kendaraan

  Perusahaan       Text                                Ya Instansi/perusahaan
                                                          asal

  Jabatan          Text                                Ya Jabatan tamu

  Nomor HP         String                              Ya Nomor telepon yang
                                                          dapat dihubungi
  -----------------------------------------------------------------------------

## 3. Validasi Input

-   Nama tamu tidak boleh kosong.
-   NIK harus terdiri dari 16 digit numerik.
-   Nomor HP harus memiliki format nomor Indonesia yang valid.
-   Keperluan menghadap wajib diisi.
-   Perusahaan dan jabatan wajib diisi.
-   Plat kendaraan divalidasi sebagai data kendaraan, tetapi tidak wajib
    apabila tamu tidak menggunakan kendaraan.
-   Sistem harus mencegah pendaftaran duplikat yang tidak diperlukan.
-   Data sensitif harus disimpan secara aman dan hanya dapat diakses
    oleh pengguna berwenang.

## 4. Alur Utama

1.  Petugas membuka halaman pendaftaran tamu.
2.  Petugas memasukkan data tamu.
3.  Sistem melakukan validasi.
4.  Sistem menyimpan data.
5.  Sistem menghasilkan nomor registrasi tamu.
6.  Petugas dapat melihat status pendaftaran.
7.  Setelah kunjungan selesai, data dapat diberi status
    selesai/checkout.

## 5. Status Pendaftaran

-   Draft
-   Terdaftar
-   Menunggu Verifikasi
-   Disetujui
-   Ditolak
-   Sedang Berkunjung
-   Selesai

## 6. Pengembangan Lanjutan

-   Pencarian berdasarkan nama, NIK, perusahaan, atau nomor registrasi.
-   Riwayat kunjungan.
-   Dashboard jumlah tamu.
-   Rekap kunjungan berdasarkan periode.
-   QR Code/nomor registrasi.
-   Cetak kartu tamu.
-   Audit log aktivitas pengguna.
-   Role-based access control.
