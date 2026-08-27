const cron = require('node-cron');
const { runBackup } = require('./backup');

function startBackupScheduler() {
  // Harian, setiap jam 01:00
  cron.schedule('0 1 * * *', () => {
    runBackup('daily')
      .then((r) => console.log(`Backup harian berhasil: ${r.filename}`))
      .catch((err) => console.error('Backup harian gagal:', err.message));
  });

  // Mingguan, tiap Minggu jam 01:30
  cron.schedule('30 1 * * 0', () => {
    runBackup('weekly')
      .then((r) => console.log(`Backup mingguan berhasil: ${r.filename}`))
      .catch((err) => console.error('Backup mingguan gagal:', err.message));
  });

  // Bulanan, tanggal 1 tiap bulan jam 02:00
  cron.schedule('0 2 1 * *', () => {
    runBackup('monthly')
      .then((r) => console.log(`Backup bulanan berhasil: ${r.filename}`))
      .catch((err) => console.error('Backup bulanan gagal:', err.message));
  });

  console.log('Jadwal backup otomatis aktif (harian 01:00, mingguan Minggu 01:30, bulanan tanggal 1 pukul 02:00)');
}

module.exports = { startBackupScheduler };
