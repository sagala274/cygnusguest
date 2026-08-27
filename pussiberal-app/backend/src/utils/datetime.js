// Container backend & MySQL berjalan dalam UTC (bukan WIB) -- lihat db.js
// (mysql2 default `timezone: 'local'`, dan MySQL sendiri konsisten
// menyimpan CURRENT_TIMESTAMP dalam UTC, jadi PENYIMPANAN datanya sudah
// benar/konsisten). Bug-nya ada di langkah TERAKHIR: toLocaleString/
// toLocaleDateString tanpa opsi `timeZone` eksplisit memformat memakai zona
// waktu runtime (container = UTC), bukan WIB -- jadi tanggal/jam yang
// ditampilkan di PDF dan pesan Telegram (dibuat di backend, bukan browser
// pengguna) selisih 7 jam dari waktu Jakarta sebenarnya. Helper ini
// memastikan setiap format tanggal yang dibuat backend selalu memakai WIB.
const JAKARTA_TZ = 'Asia/Jakarta';

function formatJakartaDateTime(date) {
  return new Date(date).toLocaleString('id-ID', { timeZone: JAKARTA_TZ });
}

function formatJakartaDate(date, options = {}) {
  return new Date(date).toLocaleDateString('id-ID', { timeZone: JAKARTA_TZ, ...options });
}

module.exports = { JAKARTA_TZ, formatJakartaDateTime, formatJakartaDate };
