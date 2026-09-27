# Foto Latar Banner Dashboard
## Aplikasi Pendaftaran Tamu PUSSIBERAL

Dokumen ini mencatat pekerjaan pada **27 September 2026** (lanjutan dari
`13_perbaikan_zona_waktu_dan_penyederhanaan_dashboard.md`): menambahkan
foto kapal TNI-AL sebagai latar banner "Selamat datang" di halaman
Dashboard. Pekerjaan ini sudah diuji dan **aktif berjalan** di server
produksi (https://187.52.126.252) sampai tanggal disusunnya dokumen ini.

---

## 1. Foto Kapal TNI-AL sebagai Latar Banner "Selamat Datang"

**Permintaan:** foto kapal TNI-AL (kapal perang, sekoci karet, dengan tulisan "PENGAMANAN PENGAWASAN KESIAPSIAGAAN") dijadikan latar belakang pada banner "Selamat datang, [nama]!" di halaman Dashboard. Diminta juga supaya mudah dikembalikan ke tampilan sebelumnya kalau ternyata hasilnya kurang cocok.

**Yang dikerjakan:**
- Foto disimpan sebagai aset aplikasi (`assets/dashboard-hero.jpg`), dimuat sendiri dari server aplikasi (tidak mengambil dari sumber luar), sejalan dengan kebijakan keamanan situs ini.
- Foto dipasang sebagai latar pada banner (`.dash-hero`), dengan gradasi gelap semi-transparan yang **sudah ada sebelumnya tetap dipertahankan di atasnya** (bukan dihapus/diganti) -- supaya foto kapal tetap terlihat sebagai latar, tapi teks "Selamat datang" dan tanggal tetap kontras tinggi dan mudah dibaca di bagian foto mana pun (termasuk bagian langit yang lebih terang).
- Karena disimpan sebagai satu commit di Git, perubahan ini mudah dibatalkan kapan saja (tinggal minta dikembalikan) tanpa kehilangan pekerjaan lain -- kembali ke tampilan gradasi polos sebelumnya cukup dengan membatalkan perubahan pada berkas gaya tampilan (`style.css`) ini saja.

---

*Dokumen ini melengkapi:*
- `12_verifikasi_telegram_dan_tema_cyber.md`
- `13_perbaikan_zona_waktu_dan_penyederhanaan_dashboard.md`
