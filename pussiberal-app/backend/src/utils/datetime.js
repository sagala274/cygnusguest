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

// "Hari ini" menurut WIB, sebagai string YYYY-MM-DD -- dipakai untuk
// MENGGANTI CURDATE()/NOW() pada query yang butuh tanggal "hari ini"
// (bukan sekadar menampilkan tanggal yang sudah tersimpan). CURDATE()
// MySQL ikut jam server (UTC), jadi selama jendela 7 jam setiap hari
// (00:00-07:00 WIB) dia masih menganggap "hari ini" adalah kemarin
// menurut WIB -- locale 'en-CA' dipakai murni karena formatnya persis
// YYYY-MM-DD, bukan karena kaitan dengan Kanada.
function todayJakarta() {
  return new Date().toLocaleDateString('en-CA', { timeZone: JAKARTA_TZ });
}

// Sama seperti todayJakarta(), tapi sebagai objek Date "lokal" (bukan
// string) -- dipakai untuk perhitungan rentang periode (mis. buildPeriods
// di reports.js) yang butuh operasi tanggal seperti getFullYear/getMonth/
// getDate. Komponen y/m/d hasil todayJakarta() ditaruh langsung ke
// `new Date(y, m, d)` (bukan `new Date(string)`) supaya operasi
// getFullYear/getMonth/getDate berikutnya membaca kembali angka yang
// sama, sama seperti pola isWeekend() di utils/attendance.js -- jadi
// tetap benar walau runtime server sendiri bukan WIB.
function nowJakartaLocal() {
  const [y, m, d] = todayJakarta().split('-').map(Number);
  return new Date(y, m - 1, d);
}

module.exports = { JAKARTA_TZ, formatJakartaDateTime, formatJakartaDate, todayJakarta, nowJakartaLocal };
