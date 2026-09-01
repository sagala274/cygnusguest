const pool = require('../db');

// Hasil profiling tingkat PERUSAHAAN (bukan per-personel) di Bank Data --
// satu baris per nama perusahaan (kolom `company` sudah di-trim, mengikuti
// aturan pengelompokan yang sama dipakai groupByCompany() di routes/bankData.js).
async function ensureCompanyProfilesTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS company_profiles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company VARCHAR(150) NOT NULL UNIQUE,
      security_category ENUM('aman','perlu_perhatian','perlu_penanganan') NULL,
      profiling_notes TEXT NULL,
      updated_by INT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (updated_by) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

module.exports = { ensureCompanyProfilesTable };
