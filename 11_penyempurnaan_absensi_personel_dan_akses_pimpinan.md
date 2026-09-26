# Penyempurnaan Absensi Personel dan Akses Pimpinan
## Aplikasi Pendaftaran Tamu PUSSIBERAL

Dokumen ini mencatat pekerjaan pada **22-26 September 2026** (lanjutan dari
`10_pendamping_tamu_notifikasi_logout_dan_penyempurnaan_dashboard.md`):
pembatasan login & keamanan tambahan, perbaikan Bank Data, menu baru
Pemetaan Hubungan, fitur Absensi Personel & Kelola Personel, perluasan role
Pimpinan jadi akses lihat-saja di seluruh halaman Verifikator, dan analisa
intelijen pada Data Personel. Seluruh pekerjaan di dokumen ini sudah diuji
dan **aktif berjalan** di server produksi (https://187.52.126.252) sampai
tanggal disusunnya dokumen ini.

---

## 1. Pembatasan Login & Pencegahan Brute-Force

**Permintaan:** batasi percobaan login tiap akun maksimal 5x, cegah percobaan menebak password secara paksa (brute-force).

**Yang dikerjakan:**
- Percobaan login gagal dibatasi 5 kali per akun. Setelah 5 kali gagal berturut-turut, akun tersebut otomatis **dikunci sementara selama 15 menit**, walau password yang dimasukkan setelahnya benar sekalipun.
- Batas dari sisi alamat internet (IP) juga diperketat dari 10 kali menjadi 5 kali percobaan gagal per 15 menit.
- Percobaan yang berhasil (login benar) tidak dihitung sebagai "percobaan gagal", jadi pengguna yang salah ketik sekali-dua kali lalu berhasil tidak akan terkunci tanpa alasan.
- Kejadian akun terkunci tercatat di Log Aktivitas.

**Hasil:** mempersulit siapa pun (termasuk program otomatis) untuk menebak-nebak password lewat percobaan berulang dalam jumlah besar.

---

## 2. Pembatasan Format Username (Lapisan Keamanan Tambahan)

**Konteks:** setelah ditanyakan apakah kolom username & password sudah aman dari percobaan SQL Injection / XSS — jawabannya sudah aman (karena sistem sudah memakai parameterized query & hashing sejak awal), namun ditambahkan satu lapis pengaman ekstra (*defense-in-depth*) atas persetujuan.

**Yang dikerjakan:**
- Saat membuat pengguna baru, username sekarang dibatasi hanya boleh berisi huruf, angka, titik (`.`), garis bawah (`_`), atau strip (`-`), panjang 3–50 karakter.
- Validasi diterapkan baik di tampilan (form) maupun di server (backend) — bukan cuma di tampilan, supaya tidak bisa diakali.

---

## 3. Pelacakan Alamat IP Login (User Behavior Analysis)

**Permintaan:** tambahkan geolocation login berdasarkan analisa perilaku pengguna (*User Behavior Analysis*) di Log Aktivitas.

**Keputusan** (dipilih langsung saat ditanya): cukup mencatat alamat IP saja (tanpa memakai layanan geolocation pihak ketiga), dan sistem menandai jika login berasal dari IP yang belum pernah dipakai akun tersebut sebelumnya.

**Yang dikerjakan:**
- Setiap alamat IP yang dipakai tiap akun untuk login sekarang dicatat (kapan pertama & terakhir dipakai, berapa kali).
- Kolom baru **"IP"** ditambahkan di halaman Log Aktivitas.
- Jika login berasal dari IP yang **baru** (belum pernah dipakai akun itu), muncul label kuning **"IP Baru"** di Log Aktivitas.
- Notifikasi Telegram saat login juga menambahkan tanda peringatan "IP Baru" jika berasal dari alamat yang belum dikenal.

**Hasil:** Administrator bisa langsung melihat kalau ada akun yang tiba-tiba login dari alamat/jaringan yang tidak biasa dipakai akun tersebut, tanpa perlu layanan pelacakan lokasi pihak ketiga.

---

## 4. Perbaikan Bank Data — Kategori Analisa Terbaru Ikut Semua Kunjungan

**Laporan:** kasus Ibu Dewi Pergiwi — sudah pernah dianalisa dan masuk kategori "Perlu Perhatian" pada kunjungan sebelumnya, namun pada kunjungan barunya kategori tersebut tidak muncul/dianggap "belum dianalisa".

**Penyebab:** setiap kunjungan tersimpan sebagai baris data terpisah, sehingga hasil analisa pada kunjungan lama tidak otomatis "menempel" ke kunjungan baru orang yang sama.

**Keputusan** (dipilih saat ditanya): kategori yang ditampilkan adalah hasil analisa **paling baru** dari orang tersebut, ditampilkan di semua baris kunjungannya (bukan cuma di baris tempat analisa itu dibuat).

**Yang dikerjakan:**
- Sistem sekarang otomatis mengambil hasil analisa keamanan paling baru seseorang (berdasarkan NIK + nama) dan menampilkannya di semua kunjungan orang itu di Bank Data, lengkap dengan penanda kecil **"(dari kunjungan lain)"** bila hasil itu berasal dari kunjungan yang berbeda.
- Data analisa mentah per-kunjungan tetap tersimpan apa adanya dan tetap bisa diedit lewat menu "Kelola Analisa" seperti biasa — yang berubah hanya cara menampilkannya.
- **Penting:** dilakukan juga perbaikan data (*backfill*) untuk data kunjungan lama yang sudah ada di database sebelum perbaikan ini, termasuk data Ibu Dewi Pergiwi, supaya kasus yang dilaporkan benar-benar sudah tertangani di data yang sudah ada, bukan cuma untuk data baru ke depannya. Sudah diverifikasi langsung ke database produksi bahwa datanya sudah benar.

---

## 5. Bank Data — Gabungkan Baris Orang yang Sama (Tidak Berulang)

**Laporan:** Ibu Dewi Pergiwi sudah datang 2 kali, tapi di Bank Data masih tertulis sebagai 2 baris terpisah, padahal kolom "kunjungan" sudah menghitung jumlah kedatangan (`visit_count`).

**Yang dikerjakan:**
- Daftar Bank Data sekarang menampilkan **satu baris per orang per perusahaan** (mewakili data kunjungan terbarunya), bukan satu baris per kali kedatangan.
- Jumlah kunjungan tetap terlihat di kolom "kunjungan" seperti sebelumnya.
- Khusus untuk tombol "Hapus Perusahaan": jumlah yang ditampilkan di konfirmasi penghapusan tetap menghitung **semua** data mentah (bukan yang sudah digabung), supaya tidak menyesatkan — karena penghapusan tetap menghapus seluruh riwayat kunjungan, bukan cuma satu baris yang tampil.
- Catatan keamanan: penggabungan ini **hanya** berlaku untuk orang yang identik (NIK & nama sama). Deteksi anomali "satu NIK dipakai nama berbeda-beda" (indikasi mencurigakan) **tidak** ikut digabung — tetap ditampilkan terpisah supaya tidak ada potensi kecurigaan yang "tertutupi".

---

## 6. Menu Baru: Pemetaan Hubungan (Diagram Jaringan Orang & Perusahaan)

**Permintaan:** menu baru di sidebar untuk membuat pemetaan seperti software Vensim — menghubungkan satu nama dengan PT lain, dengan pilihan bentuk (*shapes*), garis (*line*), dan warna (*color*) yang mudah dipakai.

**Keputusan** (dipilih saat ditanya):
- Bisa menyimpan banyak diagram berbeda, masing-masing punya nama.
- Hanya bisa diakses oleh Administrator & Verifikator.

**Yang dikerjakan** — menu **"Pemetaan Hubungan"** di sidebar, berisi:

- Halaman daftar: melihat semua pemetaan yang pernah dibuat, buka, ganti nama, atau hapus.
- Halaman editor pemetaan (kanvas interaktif), dengan:
  - Tombol **"+ Tambah Orang"** (bentuk oval/lingkaran) dan **"+ Tambah Perusahaan"** (bentuk kotak).
  - Elemen bisa digeser bebas dengan cara diklik-tahan-tarik (*drag & drop*).
  - Nama elemen bisa diubah dengan klik dua kali pada elemen, atau lewat tombol "Ganti Label".
  - Tombol **"Hubungkan"** untuk membuat garis penghubung antar dua elemen (klik elemen pertama, lalu elemen kedua).
  - Pilihan warna untuk elemen maupun garis penghubung, tinggal klik salah satu warna yang disediakan.
  - Elemen atau garis yang dipilih bisa dihapus lewat tombol "Hapus Elemen".
  - Setiap perubahan otomatis ditandai "Belum disimpan" sampai ditekan tombol "Simpan".
- Dibangun murni dengan teknologi bawaan browser (tanpa memakai library/plugin pihak ketiga dari internet luar), supaya tetap sejalan dengan kebijakan keamanan situs ini yang tidak memuat skrip dari sumber luar sembarangan.
- Tercatat di Log Aktivitas setiap kali pemetaan baru dibuat atau dihapus.

**Perbaikan lanjutan setelah menu ini dipakai:**
- Sempat dilaporkan nama elemen (nama perusahaan) tidak bisa diedit — ternyata kotak isian untuk mengedit nama salah posisi saat kanvas sedang di-scroll. Sudah diperbaiki, posisi kotak edit sekarang selalu tepat mengikuti elemen yang diklik.
- Diminta supaya klik dua kali pada nama elemen cukup dan diandalkan untuk mengganti nama. Sudah diperbaiki — sebelumnya ada kemungkinan klik dua kali tidak selalu terdeteksi browser karena tampilan sempat "digambar ulang" di antara klik pertama dan kedua; sekarang proses pemilihan elemen tidak lagi menggambar ulang seluruh kanvas, sehingga klik dua kali lebih konsisten terdeteksi.

---

## 7. Fitur Baru: Absensi Personel & Kelola Personel

**Permintaan:** aplikasi ini berkembang untuk mengumpulkan data absensi harian personel PUSSIBERAL sendiri (bukan tamu), dengan daftar personel yang sudah ditentukan, dikelompokkan per satuan (Pimpinan, Set, Bagku, Satma, Ditbinkam, Ditbinminlogpers, Satinasi, Sathan, Satdak).

**Yang dikerjakan:**
- Menu baru **"Absensi Personel"** (khusus Admin & Verifikator) — daftar personel dikelompokkan per satuan, tiap orang punya status absensi harian pilihan: **Hadir, Dinas Dalam, Dinas Luar, Sakit, Ijin, Cuti, Pendidikan, BKO, Tanpa Keterangan**. Setiap perubahan status tersimpan otomatis begitu dipilih (tidak perlu tombol "Simpan" terpisah), lengkap dengan navigasi tanggal (Sebelumnya/Berikutnya/Hari Ini).
- Data awal **56 personel** dari daftar resmi PUSSIBERAL 2026 dimasukkan otomatis ke database saat fitur ini pertama kali aktif.
- Menu **"Kelola Data Personel"** terpisah untuk mengelola daftar personel (tambah/edit/nonaktifkan) secara lengkap. Personel yang sudah punya riwayat absensi tidak dihapus permanen — hanya dinonaktifkan, supaya riwayat lama tidak kehilangan konteks (pola yang sama seperti akun pengguna).

---

## 8. Role Baru "Pimpinan" (Akses Khusus Lihat Saja) untuk Danpussiberal/Wadanpussiberal

**Permintaan:** Danpussiberal & Wadanpussiberal perlu bisa memantau kondisi absensi personel dari Dashboard, tanpa perlu akses penuh seperti Admin/Verifikator.

**Yang dikerjakan:**
- Role akun baru **"Pimpinan"** — hanya bisa melihat halaman Dashboard, tidak muncul menu lain di sidebar, dan tidak bisa mengubah/menghapus data apa pun di sistem manapun.
- Dibuatkan lewat menu Manajemen Pengguna seperti role lainnya.

---

## 9. Dashboard: Ringkasan & Visualisasi Kehadiran Personel

**Permintaan:** tampilkan kondisi absensi personel di Dashboard (untuk Admin, Verifikator, dan Pimpinan), dengan beberapa putaran penyesuaian tata letak berdasarkan masukan langsung.

**Yang dikerjakan (hasil akhir setelah beberapa kali penyesuaian):**
- **Dua kolom penuh** di Dashboard, dipisah garis vertikal yang menerus dari atas sampai bawah halaman: kolom **kiri** untuk urusan tamu yang datang (Ringkasan Tamu, Grafik Kunjungan Tamu, Aktivitas Terbaru, Status Pendaftaran, Statistik Perangkat Elektronik, Kategori Keamanan Personel), kolom **kanan** untuk urusan personel internal PUSSIBERAL (Ringkasan Personel, Kondisi Absensi Hari Ini, Perlu Perhatian, Tren Kehadiran Personel, Personel Belum Absensi Hari Ini). Kolom kanan otomatis tersembunyi untuk role yang tidak punya akses data absensi (Pos Depan).
- **Kartu "Ringkasan Personel"** — Total Personel, Hadir, Bertugas, Sakit, Ijin/Cuti, Pendidikan, Tanpa Keterangan, masing-masing dengan persentase dari total.
- **Pie chart "Kondisi Absensi Hari Ini"** — visual proporsi kondisi kehadiran personel hari itu, dengan 7 kelompok warna (Hadir/Bertugas/Sakit/Ijin-Cuti/Pendidikan/Tanpa Keterangan/Belum Diisi). "Berhalangan" awalnya digabung jadi satu kelompok, kemudian atas permintaan dipecah jadi Sakit, Ijin/Cuti, dan Pendidikan secara terpisah supaya lebih rinci. Palet warnanya divalidasi lewat validator skill dataviz (aman dari segi keterbacaan warna buta).
- **Klik-tembus dari pie chart maupun kartu Ringkasan Personel** — klik salah satu kelompok (mis. "Bertugas") langsung membuka jendela berisi daftar nama personel di kelompok itu beserta status rincinya (mis. siapa saja yang Dinas Luar), tanpa perlu membuka Absensi Personel dan mengurutkan satu per satu. Berfungsi juga untuk role Pimpinan (diberi akses baca data absensi khusus untuk keperluan ini).
- **Kartu "Perlu Perhatian"** — status siaga (merah) kalau ada personel tanpa keterangan atau belum mengisi absensi hari itu, atau status aman (hijau) kalau semua personel sudah tercatat.
- **Grafik "Tren Kehadiran Personel"** — persentase kehadiran (status Hadir) per periode, dengan tombol pilihan Per Hari/Per Minggu/Per Bulan, sama seperti Grafik Kunjungan Tamu yang sudah ada.
- **Tabel "Personel Belum Absensi Hari Ini"** — daftar personel yang belum diisi atau berstatus Tanpa Keterangan hari itu.

---

## 10. Kelola Personel Langsung dari Halaman Absensi Personel

**Permintaan:** bisa menambah, mengubah, dan menghapus personel langsung dari tiap kelompok/satuan di halaman Absensi Personel, tanpa perlu menyiapkan seluruh data personel lebih dulu di menu terpisah.

**Yang dikerjakan:**
- Tiap kelompok/satuan di halaman Absensi Personel sekarang punya tombol sendiri **"+ Tambah Personel"** (otomatis mengisi kategori sesuai kelompoknya), dan tiap baris personel punya tombol **Edit** dan **Hapus** — bisa langsung ditambah/diubah/dihapus sesuai kebutuhan saat mengisi absensi, tanpa perlu pindah ke menu "Kelola Data Personel" (yang tetap ada sebagai opsi lain).

---

## 11. Urutkan Personel dengan Geser (Drag-and-Drop)

**Permintaan:** bisa mengurutkan susunan nama personel dalam satu kelompok/satuan secara manual berdasarkan pangkat dan NRP (senioritas), karena urutan bawaan data belum tentu sesuai.

**Yang dikerjakan:**
- Tiap baris personel di halaman Absensi Personel punya ikon geser (⣿) — bisa diseret naik/turun **di dalam kelompok/kategorinya sendiri** untuk mengurutkan manual. Nomor urut (No) otomatis menyesuaikan begitu urutan diubah, dan urutan baru langsung tersimpan.

---

## 12. Klik Kotak Ringkasan (Hadir, Dinas Dalam, dst.) di Absensi Personel

**Permintaan:** kotak-kotak ringkasan hasil kompilasi (Hadir, Dinas Dalam, dan seterusnya) di halaman Absensi Personel bisa diklik untuk langsung melihat siapa saja yang termasuk di dalamnya, sama seperti mekanisme klik-tembus di Dashboard.

**Yang dikerjakan:**
- Setiap kotak ringkasan status (kecuali "Total Personel") di halaman Absensi Personel sekarang bisa diklik, membuka jendela berisi daftar nama personel dengan status tersebut, lengkap dengan pangkat, jabatan, kategori/satuan, dan keterangan.

---

## 13. Status Absensi "WFH" & Sabtu/Minggu Otomatis "Libur"

**Permintaan:** tambahkan status absensi "WFH" (Work From Home), dan hari Sabtu/Minggu otomatis dianggap "Libur" tanpa perlu diisi manual satu per satu.

**Yang dikerjakan:**
- Status **"WFH"** ditambahkan sebagai pilihan ke-11 di Absensi Personel (selain Hadir, Dinas Dalam, Dinas Luar, Sakit, Ijin, Cuti, Pendidikan, BKO, Tanpa Keterangan), sekaligus status **"Libur"**.
- Setiap personel yang belum diisi absensinya pada hari **Sabtu atau Minggu** otomatis ditampilkan berstatus "Libur" — dihitung otomatis saat ditampilkan (bukan ditulis ke database), sehingga kalau memang ada personel yang tetap bertugas di hari libur, statusnya tetap bisa diisi manual (mis. "Dinas Dalam") dan akan menimpa status "Libur" otomatis tersebut.
- Kartu ringkasan, pie chart, dan grafik tren di Dashboard ikut memperhitungkan status "Libur" ini.

---

## 14. Sidebar Dikelompokkan & "Laporan" Diganti Jadi "Rekap Kunjungan"

**Permintaan:** rapikan menu sidebar agar dikelompokkan per area kerja, dan ganti nama menu "Laporan" (tamu) menjadi "Rekap Kunjungan".

**Yang dikerjakan:**
- Menu sidebar dikelompokkan jadi 4 bagian: **Dashboard** (berdiri sendiri), **Tamu & Kunjungan** (Pendaftaran Tamu, Daftar Tamu, Verifikasi Tamu, Rekap Kunjungan), **Personel Internal** (Data Personel, Absensi Personel, Pembelajaran), **Bank Data & Intelijen** (Bank Data, Pemetaan Hubungan), dan **Sistem & Administrasi** (khusus Administrator).
- Menu "Laporan" diganti namanya menjadi **"Rekap Kunjungan"**, dan "Kelola Personel" dipromosikan jadi menu utama tersendiri bernama **"Data Personel"**.
- **Catatan transparansi:** perubahan ini sempat menimbulkan bug serius — seluruh halaman aplikasi mendadak tampil kosong (nama pengguna, avatar, dan seluruh isi Dashboard tidak muncul) karena ada satu baris kode sisa yang masih merujuk ke struktur data lama. Begitu dilaporkan, langsung ditelusuri dan ditemukan sebabnya, lalu diperbaiki dan diaktifkan ulang ke server dalam waktu singkat. Sudah diverifikasi tampilan kembali normal di semua halaman.

---

## 15. Judul "Guest Management" Jadi "Security Management" (Kecuali Pos Jaga)

**Permintaan:** tulisan "GUEST MANAGEMENT" di sidebar diganti jadi "SECURITY MANAGEMENT", tapi khusus Pos Jaga (Pos Depan) tetap tertulis "GUEST MANAGEMENT" seperti semula.

**Yang dikerjakan:**
- Pos Depan tetap melihat **"GUEST MANAGEMENT"** (fokus kerjanya memang pendaftaran/kunjungan tamu).
- Role lain (Administrator, Verifikator, Pimpinan) sekarang melihat **"SECURITY MANAGEMENT"**, karena cakupan aplikasi ini sudah lebih luas dari sekadar tamu (personel, absensi, Bank Data, Pemetaan Hubungan, dst).

---

## 16. Perbaikan Perhitungan Grafik "Tren Kehadiran Personel"

**Laporan:** persentase kehadiran pada grafik tren terlihat tidak sesuai dengan kondisi sebenarnya pada hari itu (mis. tertulis 0% padahal ada personel yang sedang bertugas).

**Penyebab yang ditemukan (dua hal berbeda, sama-sama diperbaiki):**
1. Persentase sebelumnya dihitung dari jumlah personel yang **sudah diisi** absensinya hari itu saja (bukan dari total seluruh personel aktif) — sehingga di hari yang datanya belum lengkap diisi, angkanya bisa menyesatkan.
2. Grafik hanya menghitung status **"Hadir"** secara harfiah, sedangkan personel yang sedang **"Dinas Dalam"** (tetap bertugas, hanya tidak fisik di kantor) tidak ikut dihitung sebagai kehadiran.

**Yang dikerjakan:**
- Persentase sekarang dihitung terhadap **total personel aktif** (konsisten dengan kartu "Kondisi Absensi Hari Ini" di Dashboard), bukan cuma yang sudah diisi datanya.
- Status **"Hadir"** dan **"Dinas Dalam"** sekarang dihitung bersama sebagai "kehadiran" (Dinas Luar, BKO, dan WFH tetap tidak termasuk).
- Sudah diuji langsung ke data produksi sebelum diaktifkan, memastikan angka yang muncul cocok dengan kondisi data sebenarnya.

---

## 17. Hover & Klik-Tembus pada Grafik "Tren Kehadiran Personel"

**Permintaan:** saat kursor diarahkan ke grafik harian, muncul detail angkanya; dan saat titik pada grafik hari tertentu diklik, langsung menuju hasil absensi hari itu.

**Yang dikerjakan:**
- Mengarahkan kursor ke titik pada grafik (mode Per Hari/Per Minggu/Per Bulan) menampilkan kotak info kecil berisi persentase dan tanggal/periode tersebut — sama seperti mekanisme yang sudah ada di Grafik Kunjungan Tamu.
- Pada mode **Per Hari**, mengklik satu titik langsung membuka halaman **Absensi Personel** tepat di tanggal tersebut (Administrator, Verifikator, dan sekarang juga Pimpinan — lihat poin 19).

---

## 18. Grafik Batang pada Absensi Personel

**Permintaan:** data ringkasan kotak-kotak (Hadir, WFH, Dinas Dalam, dst.) di halaman Absensi Personel dibuatkan juga dalam bentuk grafik, khusus grafik batang.

**Yang dikerjakan:**
- Kartu baru **"Grafik Absensi Hari Ini"** ditambahkan di halaman Absensi Personel, menampilkan jumlah personel per kategori keterangan (Hadir, WFH, Dinas Dalam, Dinas Luar, Sakit, Ijin, Cuti, Pendidikan, BKO, Libur, Tanpa Keterangan, Belum Diisi) dalam bentuk grafik batang, untuk tanggal yang sedang dipilih.
- Setiap batang bisa diarahkan kursor untuk lihat jumlah persisnya, dan bisa diklik untuk langsung melihat daftar personel di kategori tersebut — sama seperti kotak ringkasan di atasnya.
- Warna setiap kategori dipilih & divalidasi lewat alat bantu pemeriksaan warna (kontras dan keterbacaan bagi yang buta warna), supaya tetap bisa dibedakan satu sama lain.

---

## 19. Role "Pimpinan" Diperluas: Akses Lihat-Saja ke Semua Halaman Verifikator

**Permintaan:** Danpussiberal & Wadanpussiberal ingin bisa mengklik-tembus grafik Tren Kehadiran Personel langsung ke Absensi Personel (bukan cuma lewat Dashboard), namun tidak boleh bisa mengedit absensi. Setelah ditanyakan lebih lanjut, permintaannya diperluas: mereka boleh **melihat semua informasi yang bisa dilihat Verifikator**, tapi murni lihat-saja, tidak bisa menambah/mengubah/menghapus apa pun.

**Konteks:** sebelumnya role "Pimpinan" (lihat poin 8) hanya bisa melihat halaman Dashboard. Pekerjaan ini memperluas cakupannya secara signifikan.

**Yang dikerjakan:**
- Role **Pimpinan** sekarang bisa membuka halaman: **Daftar Tamu, Verifikasi Tamu, Rekap Kunjungan, Data Personel, Absensi Personel, Pembelajaran, Bank Data,** dan **Pemetaan Hubungan** — tapi murni untuk melihat. Semua tombol tambah/edit/hapus disembunyikan di halaman-halaman tersebut untuk role ini.
- Sebagai lapis pengaman tambahan (bukan cuma menyembunyikan tombol di tampilan), setiap jalur penyimpanan data (tambah/ubah/hapus) di server juga diperiksa ulang supaya benar-benar menolak permintaan dari role Pimpinan, sekalipun ada yang mencoba mengaksesnya secara langsung tanpa lewat tampilan.
- Akun **Danpussiberal** dan **Wadanpussiberal** (sebelumnya diberi role Verifikator) diubah ke role **Pimpinan** ini.
- Administrator (Kaurpam) dan Verifikator (Baurpam) tidak terpengaruh — tetap memiliki akses edit penuh seperti biasa.
- **Catatan teknis:** karena sesi login (token) membawa informasi role sejak saat login dan berlaku hingga 8 jam, akun yang rolenya baru diubah perlu **logout lalu login ulang** agar perubahan akses berlaku.

---

## 20. Analisa Intelijen pada Data Personel (Kategori Keamanan & Catatan Anomali)

**Permintaan:** pada Data Personel, bisa dimasukkan data anomali yang mencurigakan terhadap personel internal — sama seperti mekanisme Bank Data pada tamu (klik nama, muncul kolom untuk mengisi data intelijen).

**Yang dikerjakan:**
- Di halaman **Kelola Personel (Data Personel)**, nama personel sekarang bisa diklik untuk membuka jendela **"Analisa Intelijen"**, berisi:
  - **Kategori Keamanan**: Aman / Perlu Perhatian / Perlu Penanganan / Belum Dianalisa (pilihan yang sama seperti Bank Data, supaya konsisten).
  - **Catatan Analisa**: kolom teks bebas untuk mencatat indikasi anomali/kecurigaan.
- Kategori yang tersimpan ditampilkan sebagai lencana warna pada kolom baru **"Kategori Keamanan"** di tabel Data Personel, jadi bisa terlihat sekilas tanpa perlu membuka detailnya satu per satu.
- Hanya Administrator & Verifikator yang bisa mengisi/mengubah; role Pimpinan (lihat poin 19) tetap bisa melihat kategori & catatannya, tapi tidak bisa mengubahnya.

---

## Catatan Lain (Belum Dikerjakan, Masih Sebatas Pembahasan)

Sempat dibahas pertanyaan: apakah data tamu di database sudah terenkripsi, dan apa yang terjadi bila ada pihak yang berhasil masuk langsung ke MySQL. Beberapa opsi pendekatan enkripsi data sudah dijelaskan, namun **belum ada keputusan/arahan lebih lanjut** untuk diimplementasikan — menunggu arahan bila memang ingin dilanjutkan.

---

## Cara Kerja Pengembangan (Untuk Referensi)

Setiap perubahan yang melibatkan data (seperti penambahan kolom baru di database) selalu diuji coba dulu langsung ke data produksi lewat skrip sementara sebelum benar-benar diterapkan, supaya tidak ada risiko data rusak. Setiap kode juga diperiksa dulu (*syntax check*) di server sebelum diaktifkan. Setelah aktif, selalu diverifikasi ulang (cek status container, cek log, cek respons website) untuk memastikan perubahan benar-benar berjalan seperti yang diharapkan.

*Dokumen ini bisa diperbarui kembali seiring bertambahnya pekerjaan baru.*
