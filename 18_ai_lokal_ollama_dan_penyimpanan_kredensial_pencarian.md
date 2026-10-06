# AI Lokal (Ollama) sebagai Cadangan Otomatis & Penyimpanan Kredensial Pencarian
## Aplikasi Pendaftaran Tamu PUSSIBERAL

Dokumen ini mencatat pekerjaan pada **5-6 Oktober 2026** (lanjutan dari
`17_laporan_absensi_dan_pencarian_tamu_ai_chat.md`): penambahan **AI
Lokal (Ollama)** sebagai provider model kedua di AI Chat -- lengkap
dengan mode routing yang bisa dipilih admin, saklar cepat di halaman
chat, serta pemasangan & pengujian langsung di server produksi -- dan
penyiapan **tempat penyimpanan terenkripsi** untuk kredensial Google
Custom Search (dipersiapkan untuk fitur pencarian profil publik tamu,
lihat status di Bagian 1). Seluruh bagian AI Lokal sudah diuji langsung
di server produksi (https://187.52.126.252) dan aktif berjalan sampai
tanggal disusunnya dokumen ini.

---

## 1. Penyimpanan Kredensial Google Custom Search (Infrastruktur -- Belum Jadi Fitur Utuh)

**Latar belakang:** sempat dibahas opsi menambahkan pencarian profil
publik tamu (pekerjaan, pendidikan, dll.) berbasis Google Custom Search
JSON API, sebagai alternatif setelah API scraping LinkedIn pihak ketiga
yang sempat dicoba ternyata sudah dihentikan layanannya oleh
penyedianya.

**Yang sudah dikerjakan (infrastruktur penyimpanan saja):**
- Kolom baru di tabel `ai_settings`: `google_search_api_key_encrypted`
  (terenkripsi, pola sama seperti API key OpenRouter) dan
  `google_search_cx` (Search Engine ID, tidak rahasia).
- Bagian baru **"Pencarian Profil Publik (Google Custom Search)"** di
  halaman Konfigurasi AI, digabung di menu yang sama (bukan menu
  terpisah) sesuai permintaan -- punya tombol **Simpan Kredensial
  Pencarian** dan **Hapus Kredensial** sendiri-sendiri.
- Endpoint `DELETE /api/ai-settings/google-search` untuk mengosongkan
  kredensial ini kapan saja tanpa perlu masuk ke database langsung.

**Status: BELUM menjadi fitur pencarian yang berfungsi.** Kredensial
API (API key + Search Engine ID) sudah berhasil dibuat di akun Google
Cloud milik pengguna, tapi pengujian langsung lewat `curl` masih
menemui galat `403 PERMISSION_DENIED` ("This project does not have
access to Custom Search JSON API") -- kemungkinan besar karena billing
account project Google Cloud belum terhubung. Troubleshooting belum
tuntas sampai dokumen ini disusun, dan **tool pencarian di AI Chat-nya
sendiri (yang akan memanggil API ini lalu merangkum hasilnya lewat
model AI) belum ditulis sama sekali**. Pekerjaan ini akan dilanjutkan
di dokumen terpisah begitu kredensialnya terbukti berfungsi.

---

## 2. AI Lokal (Ollama): Provider Kedua untuk AI Chat

**Permintaan:** tambahkan AI lokal (Ollama) di samping OpenRouter,
dengan sistem routing yang otomatis pindah ke AI lokal kalau kredit
OpenRouter habis.

**Yang dikerjakan -- Penyimpanan Konfigurasi:**
- Kolom baru di `ai_settings`: `ollama_base_url`, `ollama_model`,
  `ollama_api_key_encrypted` (opsional, untuk server Ollama yang
  dilindungi token), `ollama_enabled` (saklar aktif/nonaktif terpisah
  dari isi konfigurasinya), dan `routing_mode`
  (`auto`/`openrouter`/`ollama`).
- Bagian baru **"AI Lokal (Ollama)"** di Konfigurasi AI: field URL
  server, nama model, token opsional, saklar aktif/nonaktif (switch
  on/off bergaya iOS), serta tombol Simpan & Hapus terpisah -- sama
  seperti pola Google Search di atas, supaya gampang
  ditambah/dihapus/dimatikan sementara tanpa kehilangan konfigurasi
  yang sudah diisi.
- Bagian baru **"Mode Routing AI"** di atas halaman Konfigurasi AI:
  tiga kartu pilihan (Otomatis / Hanya OpenRouter / Hanya AI Lokal),
  tersimpan otomatis begitu diklik.
- **Saklar cepat langsung di halaman AI Chat** (bukan cuma di
  Konfigurasi AI): pil "Sumber Model: Otomatis | OpenRouter | AI
  Lokal" di atas kotak saran pertanyaan, supaya bisa ganti mode tanpa
  pindah halaman -- tombol otomatis nonaktif (abu-abu) kalau provider
  terkait belum siap dipakai.

**Yang dikerjakan -- Logika Routing di Backend (`aiChat.js`):**
- Endpoint `POST /api/ai-chat/query` sekarang mendukung dua provider:
  OpenRouter (format asli) dan Ollama (dipanggil lewat endpoint
  kompatibel-OpenAI bawaannya, `/v1/chat/completions`, format request
  identik dengan OpenRouter termasuk tool-calling).
- **Mode "Otomatis"**: OpenRouter tetap jadi provider utama. Kalau
  OpenRouter mengembalikan kredit habis (402), rate limit (429), atau
  gagal dihubungi sama sekali -- dan AI Lokal sudah dikonfigurasi &
  aktif -- backend **otomatis beralih ke Ollama** untuk sisa
  permintaan itu, tanpa campur tangan admin.
- **Mode "Hanya OpenRouter"/"Hanya AI Lokal"**: provider dipaksa sesuai
  pilihan, tidak pernah beralih otomatis, walau provider itu gagal
  (supaya sesuai pilihan eksplisit admin, bukan diam-diam pindah).
- Respons `/ai-chat/query` menyertakan `provider` dan `fallback_used`
  -- dipakai AI Chat untuk menampilkan catatan kecil di bawah balasan
  ("Dijawab oleh AI lokal...") setiap kali jawabannya berasal dari
  Ollama, baik karena mode manual maupun peralihan otomatis.

**Bug ditemukan & diperbaiki setelah diuji langsung:** model lokal
kecil (lihat Bagian 3) ternyata sering **mengabaikan** instruksi
tool-calling "auto" dan malah mengarang jawaban (halusinasi) alih-alih
memanggil tool `cari_tamu` untuk mengambil data sungguhan dari
database. Ditambal dengan dua lapis:
1. Kalau pertanyaan terdeteksi soal data tamu (kata kunci sederhana:
   "tamu", "biodata", "NIK", "jabatan", dst.), `tool_choice` **dipaksa**
   ke fungsi `cari_tamu` khusus untuk provider Ollama (OpenRouter tetap
   memakai "auto" seperti biasa karena sudah cukup andal).
2. Kalau model TETAP mengabaikan paksaan itu dan menjawab teks biasa,
   sistem **tidak menampilkan jawaban itu ke pengguna** -- diganti
   pesan jujur yang menyarankan pindah ke mode OpenRouter/Otomatis,
   daripada menampilkan karangan sebagai seolah-olah data sungguhan.

---

## 3. Pemasangan & Pengujian Ollama di Server Produksi

**Yang dikerjakan di server (187.52.126.252):**
- Dicek dulu spesifikasi server sebelum memasang apa pun: 1 vCPU,
  RAM 3,8 GB (sisa ~2,9 GB), **tanpa swap sama sekali**. Dikonfirmasi
  ke pengguna bahwa ini berisiko ke aplikasi utama yang sudah berjalan
  live di server yang sama -- pengguna memilih tetap lanjut dengan
  model paling kecil yang tersedia, menerima risikonya.
- **Ollama dipasang langsung di host** (via installer resmi,
  `systemctl` service `ollama.service`), BUKAN sebagai container
  Docker -- supaya tidak ikut ter-rebuild/restart setiap kali
  aplikasi utama di-deploy, siklus hidupnya independen dari
  `docker compose build/up` yang rutin dipakai untuk fitur lain.
- Model yang dipasang: **`qwen2.5:1.5b`** (~986 MB) -- dipilih sebagai
  model terkecil yang wajar, menyesuaikan keterbatasan RAM server.
- `OLLAMA_HOST=0.0.0.0:11434` diset lewat systemd override supaya bisa
  diakses dari container Docker (defaultnya hanya `127.0.0.1`, tidak
  terjangkau dari dalam container).
- **Firewall (iptables) dipasang untuk mengunci port 11434** -- hanya
  menerima koneksi dari `127.0.0.1` dan subnet jaringan internal
  Docker (`172.18.0.0/16`), eksplisit men-DROP semua sumber lain.
  Aturan disimpan permanen lewat `iptables-persistent` supaya tetap
  aktif setelah server reboot. Ini penting karena server punya IP
  publik dan API Ollama secara bawaan tidak pakai autentikasi.
- `docker-compose.yml` (service `backend`) ditambah `extra_hosts:
  host.docker.internal:host-gateway` supaya container backend bisa
  menjangkau Ollama yang jalan di host lewat alamat
  `http://host.docker.internal:11434`.

**Pengujian yang dilakukan (semua terkonfirmasi berhasil):**
- Koneksi dari container backend ke Ollama lewat `host.docker.internal`
  -- berhasil.
- Percobaan akses port 11434 dari luar server (simulasi internet
  publik) -- **gagal/timeout**, mengonfirmasi firewall bekerja.
- Format respons endpoint `/v1/chat/completions` Ollama -- cocok
  persis dengan yang dibutuhkan kode aplikasi, menjawab dalam Bahasa
  Indonesia dengan benar untuk pertanyaan umum.
- Tool-calling -- awalnya gagal (lihat Bug di Bagian 2), sudah ditambal
  dan diuji ulang lewat AI Chat sungguhan oleh pengguna.

**Catatan keterbatasan yang didokumentasikan:** model `qwen2.5:1.5b`
yang terpasang **tidak cukup andal** untuk fitur pencarian data tamu
secara konsisten -- layak dipakai sebagai cadangan darurat/obrolan
umum, bukan pengganti penuh OpenRouter. Kebutuhan server yang lebih
ideal (RAM per ukuran model, rekomendasi CPU/GPU, dan pilihan
menjalankan Ollama di server terpisah) didokumentasikan di
`WORKFLOW GUEST MANAGEMENT.txt` Bagian 9, supaya jadi acuan kalau suatu
saat ingin diupgrade ke model yang lebih besar/andal.

---

## Cara Kerja Pengembangan (Untuk Referensi)

Seluruh bagian AI Lokal diuji langsung di server produksi sebelum
dianggap selesai: pemasangan Ollama, pengujian firewall (dari dalam dan
luar jaringan Docker), pengujian format API lewat `curl`, sampai
pengujian end-to-end lewat AI Chat sungguhan oleh pengguna -- yang
sempat menemukan bug halusinasi tool-calling di atas dan langsung
ditambal & diuji ulang di hari yang sama. Bagian pencarian Google
Custom Search (Bagian 1) sengaja TIDAK ditandai selesai karena memang
belum teruji berfungsi -- mengikuti prinsip dokumen-dokumen sebelumnya,
hanya pekerjaan yang sudah terbukti jalan yang dicatat sebagai selesai.

*Dokumen ini melengkapi:*
- `16_penyempurnaan_dashboard_dan_tombol_modern.md`
- `17_laporan_absensi_dan_pencarian_tamu_ai_chat.md`
- `WORKFLOW GUEST MANAGEMENT.txt` (Bagian 9 -- kebutuhan server AI Lokal)
