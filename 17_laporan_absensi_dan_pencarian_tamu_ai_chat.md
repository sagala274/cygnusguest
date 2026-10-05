# Laporan Rekap Absensi (PDF/Excel) dan Pencarian Tamu di AI Chat
## Aplikasi Pendaftaran Tamu PUSSIBERAL

Dokumen ini mencatat pekerjaan pada **5 Oktober 2026** (lanjutan dari
`16_penyempurnaan_dashboard_dan_tombol_modern.md`): fitur baru untuk
mencetak laporan rekap absensi personel dalam bentuk PDF/Excel, perbaikan
bug tata letak pada laporan PDF tersebut, serta perluasan kemampuan AI Chat
supaya bisa menjawab pertanyaan nama/biodata tamu sungguhan dari database
(bukan cuma angka ringkasan). Seluruh pekerjaan di dokumen ini sudah diuji
dan **aktif berjalan** di server produksi (https://187.52.126.252) sampai
tanggal disusunnya dokumen ini.

---

## 1. Ekspor Laporan Rekap Absensi (PDF & Excel)

**Permintaan:** di halaman Absensi Personel, tambahkan pilihan untuk
membuat laporan dalam bentuk PDF atau Excel, dengan opsi mencetak laporan
mingguan berdasarkan tanggal yang diminta -- berisi rekapan kehadiran dan
seluruh kategori lainnya beserta keterangan-keterangannya.

**Yang dikerjakan:**
- Tombol baru **"Cetak Laporan"** di halaman Absensi Personel (tersedia
  untuk Kaurpam, Baurpam, dan Pimpinan -- sama seperti akses baca absensi
  lainnya). Membuka modal pemilihan rentang tanggal, default otomatis satu
  minggu berjalan (Senin s.d. Minggu dari tanggal yang sedang dilihat),
  bisa diubah bebas.
- Endpoint baru `GET /api/attendance/export` menghasilkan laporan dengan
  satu kolom per hari berisi status personel hari itu (mencakup semua
  kategori: Hadir, WFH, Dinas Dalam, Dinas Luar, Sakit, Ijin, Cuti,
  Pendidikan, BKO, Libur, Terlambat, Tanpa Keterangan), dikelompokkan per
  satuan/kategori sama seperti tampilan halaman, plus kolom **Keterangan**
  berisi gabungan catatan tiap hari yang ada catatannya. Sabtu/Minggu yang
  belum diisi otomatis tercatat "Libur", konsisten dengan tampilan harian.
- **Excel** (ExcelJS): label status ditulis lengkap per kolom, baris nama
  kategori sebagai pemisah antar kelompok personel.
- **PDF** (PDFKit, landscape): label status disingkat (H, WFH, DD, DL, S,
  dst.) karena kolomnya sempit untuk rentang tanggal yang panjang, dengan
  legenda singkatan dicetak di bawah judul laporan.
- Memakai ulang pola PDFKit/ExcelJS yang sudah ada di aplikasi ini
  (dipakai fitur Rekap Kunjungan sebelumnya), jadi tidak perlu dependensi
  baru.

**Bug ditemukan & diperbaiki setelah dicoba:** laporan PDF yang dihasilkan
awalnya berantakan -- teks di kolom yang kepanjangan (mis. nama jabatan)
melebar ke beberapa baris alih-alih dipotong satu baris, sehingga tumpang
tindih dengan baris berikutnya dan memicu PDFKit menyisipkan halaman baru
secara acak (di luar kendali logika ganti halaman manual), menghasilkan
belasan halaman nyaris kosong berisi serpihan teks. Penyebabnya: opsi
pemotongan teks ("ellipsis") pada PDFKit baru benar-benar memotong satu
baris kalau tinggi selnya juga dibatasi secara eksplisit, bukan cuma
lebarnya. Sudah ditambal dan diuji langsung di server dengan data nama/
jabatan panjang: sebelumnya menghasilkan halaman berantakan, sekarang 58
personel x 7 hari jadi 2 halaman yang rapi.

---

## 2. AI Chat: Pencarian Nama & Biodata Tamu Sungguhan

**Laporan:** saat diminta nama-nama tamu yang datang pada rentang tanggal
tertentu, AI Chat selalu menjawab "data tidak tersedia" dan menyarankan
membuka menu lain secara manual -- padahal datanya ada di database.

**Penyebab:** AI Chat sebelumnya hanya diberi satu "ringkasan data
platform" berisi angka-angka agregat (total pendaftaran, distribusi
status, tren 7 hari terakhir, dst.) sebagai satu-satunya sumber informasi
untuk modelnya -- tidak pernah diberi akses ke data tamu individual (nama,
NIK, No. HP, jabatan, dst.) sama sekali, sehingga permintaan nama/biodata
memang mustahil dijawab dengan benar sebelumnya.

**Yang dikerjakan:**
- Ditambahkan kemampuan **tool-calling** (format OpenAI-compatible, sesuai
  OpenRouter yang sudah dipakai aplikasi ini): sebuah tool baru bernama
  `cari_tamu` yang bisa dipanggil model AI dengan parameter rentang
  tanggal pendaftaran dan/atau nama/perusahaan. Backend menjalankan query
  ter-parameterisasi (read-only -- model TIDAK bisa menulis SQL bebas)
  dan mengirim hasilnya (nama, NIK, No. HP, jabatan, perusahaan, tujuan
  kunjungan, status, tanggal daftar) kembali ke model untuk dirangkai jadi
  jawaban dalam Bahasa Indonesia. Mendukung tanggal lama maupun baru
  sesuai permintaan pengguna.
- **NIK pada hasil tool sengaja disamarkan sebagian** (pola masking yang
  sudah dipakai di tempat lain aplikasi ini) sebelum dikirim ke model AI
  pihak ketiga lewat OpenRouter -- berbeda dengan tampilan NIK penuh ke
  Admin di dalam aplikasi sendiri. Data yang keluar menuju pihak ketiga
  sengaja dibuat lebih hati-hati, karena melewati batas kepercayaan yang
  berbeda dari sekadar menampilkan data di dalam aplikasi sendiri.
- System prompt diperbarui: menyertakan tanggal hari ini (supaya model
  bisa menafsirkan permintaan relatif seperti "kemarin"/"minggu lalu"
  dengan benar) dan instruksi eksplisit supaya model memanggil tool
  `cari_tamu` lebih dulu ketika diminta nama/biodata, bukan langsung
  menjawab "tidak tersedia".
- Kalau model yang dipilih Admin di menu Konfigurasi AI ternyata tidak
  mendukung tool-calling, sistem otomatis mencoba ulang sekali tanpa tools
  (kembali ke perilaku lama: jawab dari ringkasan statistik saja) alih-
  alih langsung gagal total ke pengguna.

---

## Cara Kerja Pengembangan (Untuk Referensi)

Kedua fitur diuji langsung terhadap data produksi sebelum dianggap selesai:
query laporan absensi & query pencarian tamu dijalankan langsung ke
database (read-only) untuk memverifikasi hasilnya benar, dan perbaikan
bug tata letak PDF diverifikasi dengan membuat berkas PDF uji coba
memakai data nama/jabatan sepanjang data sungguhan, menghitung jumlah
halaman yang dihasilkan sebelum dan sesudah perbaikan.

*Dokumen ini melengkapi:*
- `15_status_terlambat_foto_kegiatan_dan_hardening_keamanan.md`
- `16_penyempurnaan_dashboard_dan_tombol_modern.md`
