# Verifikasi Telegram dan Redesain Tema Cyber
## Aplikasi Pendaftaran Tamu PUSSIBERAL

Dokumen ini mencatat pekerjaan pada **26-27 September 2026** (lanjutan dari
`11_penyempurnaan_absensi_personel_dan_akses_pimpinan.md`): verifikasi
tamu langsung dari tombol Telegram, tanda visual tambahan untuk personel
dengan indikasi anomali, pembaruan beberapa avatar akun, dan redesain
tampilan aplikasi dengan tema "cyber" (Dashboard, sidebar, dan latar
belakang seluruh halaman). Seluruh pekerjaan di dokumen ini sudah diuji
dan **aktif berjalan** di server produksi (https://187.52.126.252) sampai
tanggal disusunnya dokumen ini.

---

## 1. Verifikasi Tamu Lewat Tombol Setuju/Tolak di Telegram

**Permintaan:** bisakah verifikasi tamu (Setuju/Tolak) dilakukan langsung dari bot Telegram yang sudah terhubung, tanpa perlu membuka aplikasi.

**Keputusan** (dipilih saat ditanya): supaya tercatat di audit log sebagai akun aplikasi yang benar (bukan sekadar identitas Telegram), setiap Admin/Verifikator harus menautkan akun Telegram pribadinya sekali lewat kode sekali-pakai.

**Yang dikerjakan:**
- Notifikasi "Pendaftaran Tamu Baru" di Telegram sekarang punya dua tombol **✅ Setuju** dan **❌ Tolak** yang langsung menjalankan verifikasi.
- Menu profil (ikon avatar di pojok kanan atas) punya opsi baru **"Tautkan Telegram"** — membuat kode 6 digit sekali-pakai (berlaku 10 menit), lalu dikirim ke bot lewat pesan `/link <kode>`. Bot langsung membalas konfirmasi akun aplikasi mana yang tertaut.
- Logika inti verifikasi (di `routes/guests.js`) diekstrak jadi satu fungsi bersama (`applyGuestVerification`) yang dipakai baik oleh halaman web maupun tombol Telegram — supaya tidak ada dua logika berbeda yang bisa tidak sinkron.
- Penanganan tombol memanfaatkan mekanisme polling Telegram yang sudah ada sebelumnya (dipakai juga untuk perintah `/status`, `/tamu`, `/log`), diperluas untuk menangani tombol yang ditekan (bukan cuma perintah teks).
- Kalau akun Telegram penekan tombol belum ditautkan, atau pendaftarannya sudah diproses lebih dulu (lewat web atau tombol lain), aksinya ditolak dengan pesan jelas -- bukan diproses diam-diam atau dua kali.
- Keterangan Pendamping (opsional, kalau tamu didampingi) tetap hanya bisa diisi lewat halaman web; tombol Telegram cuma menyetujui/menolak tanpa keterangan itu.
- **Perbaikan kecil setelah diuji langsung ke bot produksi:** nomor registrasi tamu (formatnya mengandung tanda hubung, mis. `REG-2026-001`) sempat membuat Telegram menolak pesan hasil verifikasi karena kesalahan format penulisan (escaping) MarkdownV2. Sudah diperbaiki dan diuji ulang -- pesan tombol, pesan hasil verifikasi, dan penghapusan tombol setelah dipakai semuanya sudah dikonfirmasi diterima Telegram tanpa error.

---

## 2. Tanda Kategori Keamanan di Sebelah Nama & Nomor Personel

**Permintaan:** untuk data personel internal yang punya indikasi (hasil analisa intelijen), tolong diberi tanda visual sesuai klasifikasinya -- termasuk tanda segitiga peringatan di sebelah nomor urut.

**Yang dikerjakan:**
- Personel yang sudah punya hasil analisa (Aman/Perlu Perhatian/Perlu Penanganan) sekarang diberi lencana kecil di sebelah namanya -- di halaman Absensi Personel (tabel utama & jendela detail status) dan di Dashboard (jendela detail kelompok absensi & tabel "Perlu Perhatian"). Personel yang belum dianalisa tidak diberi tanda apa pun, supaya tabelnya tidak penuh lencana.
- Selain itu, personel dengan kategori **Perlu Perhatian** (kuning) atau **Perlu Penanganan** (merah) juga diberi ikon segitiga peringatan tepat di sebelah nomor urutnya, di tabel Absensi Personel dan Data Personel -- supaya langsung terlihat sekilas dari kolom paling kiri.
- **Perbaikan setelah dilaporkan:** posisi ikon segitiga sempat tidak sejajar tengah dengan angka nomor urutnya (`vertical-align` tidak presisi untuk ikon kecil). Diperbaiki dengan membungkus nomor & ikon dalam satu pembungkus flexbox supaya benar-benar sejajar tengah.

---

## 3. Pembaruan Avatar Beberapa Akun

**Permintaan:** ganti foto avatar akun Kaurpam, dan sesuaikan file avatar untuk Wadanpussiberal, Danpussiberal, dan Baurpam dengan akun yang benar di aplikasi.

**Yang dikerjakan:**
- Avatar akun **Kaurpam** diganti dengan logo baru (lambang panah & busur) yang diberikan.
- Avatar untuk **Wadanpussiberal** (sebelumnya belum punya foto), **Danpussiberal**, dan **Baurpam** (atas nama Doni Afriansyah, Ur Pam Satma) diperbarui/dipasangkan ke akun yang benar berdasarkan jabatan yang tercatat di Data Personel.

---

## 4. Kalimat Sambutan Dashboard Disesuaikan

**Laporan:** kalimat sambutan Dashboard ("Berikut ringkasan aktivitas pendaftaran dan kunjungan tamu PUSSIBERAL") terasa kurang tepat karena aplikasi ini sekarang bukan cuma soal tamu, tapi juga sudah mencakup absensi dan kondisi personel.

**Yang dikerjakan:**
- Pos Depan tetap melihat kalimat lama (fokus kerjanya memang pendaftaran/kunjungan tamu).
- Role lain (Admin, Verifikator, Pimpinan) sekarang melihat kalimat yang juga menyebut absensi & kondisi personel: *"Berikut ringkasan aktivitas tamu, serta absensi dan kondisi personel PUSSIBERAL."*

---

## 5. Redesain Dashboard: Banner Cyber & Tampilan Lebih Padat

**Permintaan:** halaman Dashboard dibuat lebih interaktif -- tampilan dipadatkan, warna lebih hidup dengan gradasi, dan latar belakang (wallpaper) memakai tema "cyber".

**Keputusan** (dipilih saat ditanya): fokus ke halaman Dashboard dulu, dan pola "cyber" dibuat murni dengan CSS (garis grid, gradasi warna) tanpa memuat gambar dari sumber luar -- sejalan dengan kebijakan keamanan situs ini yang tidak memuat aset dari luar.

**Yang dikerjakan:**
- Header "Selamat datang" diganti jadi **banner gelap bergradasi** (navy ke biru-cyan) dengan garis grid tipis dan aksen sudut menyerupai "scan line" -- murni CSS.
- Bubble ikon di kartu-kartu ringkasan (Ringkasan Tamu, Ringkasan Personel, dst.) memakai gradasi warna alih-alih warna rata.
- Jarak dan bantalan antar elemen dirapatkan (section, stat card, grafik) supaya lebih banyak informasi terlihat tanpa perlu banyak scroll.
- Grafik Kunjungan Tamu dan Tren Kehadiran Personel sekarang memakai isian gradasi (biru & hijau) alih-alih warna rata.
- Seluruh perubahan ini dilingkupi khusus untuk elemen Dashboard, supaya halaman lain (yang memakai class bersama seperti `.page-title`, `.icon-bubble`, `.stat-card`) tidak ikut berubah pada tahap ini.

---

## 6. Tema Cyber pada Sidebar

**Permintaan:** sidebar juga dibuat modern dengan tema cyber yang sama.

**Yang dikerjakan:**
- Sidebar (dipakai bersama di SEMUA halaman) sekarang memakai gradasi navy-ke-biru gelap dan garis grid tipis, sama seperti banner Dashboard.
- Menu yang sedang aktif memakai gradasi + aksen garis cyan menyala (efek glow) di tepi kiri, menggantikan warna rata sebelumnya.
- Garis pembatas tipis bercahaya ditambahkan di bawah logo PUSSIBERAL.

---

## 7. Latar Belakang Seluruh Halaman Jadi Tema Cyber

**Permintaan:** latar belakang pada Dashboard dan SEMUA halaman jangan putih -- dibuat dengan tema cyber, tapi tulisan harus tetap terbaca dan nyaman dilihat.

**Pendekatan yang diambil:** supaya tidak berisiko membuat teks di halaman manapun (dari ~20 halaman yang ada) menjadi tidak terbaca, area di belakang & sekitar konten (`.main`) dijadikan gelap bertema cyber, sementara konten halaman itu sendiri (judul, kartu, tabel) dijadikan **panel terang yang melayang** di atasnya -- persis warna dan kontras yang sama seperti sebelumnya, jadi tidak ada satu pun warna teks yang perlu diubah secara manual di halaman manapun.

**Yang dikerjakan:**
- Area di belakang konten setiap halaman memakai gradasi navy-ke-cyan gelap + garis grid tipis, sama seperti sidebar dan banner Dashboard.
- Topbar (bar atas berisi judul halaman, notifikasi, profil) berubah jadi bar gelap semi-transparan (efek kaca) dengan teks & ikon terang.
- Bagian konten setiap halaman (tempat judul & kartu-kartu berada) dijadikan panel putih/terang yang membulat dengan bayangan, melayang di atas latar gelap tersebut.

---

## 8. Perbaikan Bug: Dua Menu Sidebar Menyala Bersamaan

**Laporan:** setelah tema cyber pada sidebar aktif, mengklik menu "Daftar Tamu" membuat menu "Verifikasi Tamu" ikut menyala (glow) bersamaan, padahal cuma satu yang seharusnya aktif.

**Penyebab:** "Daftar Tamu" dan "Verifikasi Tamu" berbagi halaman yang sama, dibedakan lewat query string URL (`?status=Menunggu Verifikasi`) -- logika penentuan menu aktif sebelumnya hanya mencocokkan berdasarkan nama halaman, bukan query string-nya, sehingga dua-duanya ikut cocok. Bug ini sudah ada sebelum tema cyber diterapkan, tapi baru terlihat jelas sekarang karena efek glow pada menu aktif membuatnya sangat mencolok.

**Yang dikerjakan:** logika pencocokan menu aktif diperbaiki supaya ikut memeriksa query string URL saat ini, jadi cuma menu yang benar-benar sedang dibuka yang menyala.

---

## 9. Kredit Hak Cipta di Sidebar

**Permintaan:** tambahkan semacam kredit hak cipta pada aplikasi.

**Yang dikerjakan:** baris kecil **"© 2026 Kapten Laut (P) Tetuko Sagala, CTIA."** ditambahkan di bagian paling bawah sidebar, muncul di semua halaman.

---

## 10. Perbaikan Bug: Dropdown Profil Tertutup Konten & Warna Merah yang Salah

**Laporan:** tombol Logout di menu profil (pojok kanan atas) tertutup/tidak terlihat setelah tema cyber diterapkan.

**Penyebab & perbaikan (dua bug sekaligus):**
1. Bar atas (topbar) dan panel konten (`.content`) sempat diberi tingkat lapisan tampilan (z-index) yang sama. Karena panel konten letaknya belakangan, dia jadi menutupi dropdown notifikasi/profil yang meluas secara visual ke bawah (termasuk tombol Logout). Diperbaiki dengan menaikkan tingkat lapisan topbar supaya dropdownnya selalu berada di atas.
2. Item baru "Tautkan Telegram" di dropdown profil sempat ikut berwarna merah menyala, karena memakai kelas tampilan yang sama dengan tombol Logout (yang sebelumnya memang cuma dipakai sendirian, jadi warna merahnya ditaruh langsung di situ). Warna merah sekarang dikhususkan hanya untuk tombol Logout.

---

## Cara Kerja Pengembangan (Untuk Referensi)

Setiap perubahan yang melibatkan data (kolom/tabel baru di database, seperti tabel tautan Telegram) selalu diuji coba dulu langsung ke data produksi lewat skrip sementara sebelum benar-benar diterapkan. Perubahan yang berkomunikasi dengan layanan luar (mis. mengirim pesan Telegram dengan tombol) juga diuji langsung ke layanan aslinya sebelum dianggap selesai, memakai pesan yang jelas ditandai sebagai uji coba dan data yang aman untuk ditekan. Setiap kode juga diperiksa dulu (*syntax check*) di server sebelum diaktifkan, dan setelah aktif selalu diverifikasi ulang (cek status container, cek log, cek respons website) untuk memastikan perubahan benar-benar berjalan seperti yang diharapkan.

*Dokumen ini melengkapi:*
- `10_pendamping_tamu_notifikasi_logout_dan_penyempurnaan_dashboard.md`
- `11_penyempurnaan_absensi_personel_dan_akses_pimpinan.md`
