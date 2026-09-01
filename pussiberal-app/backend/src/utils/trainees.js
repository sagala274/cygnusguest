const pool = require('../db');

// Personel Pembelajaran -- teknisi/siswa/mahasiswa yang praktik/magang/PKL di
// PUSSIBERAL untuk suatu periode tanggal (bukan kunjungan satu-hari seperti
// Tamu), sehingga disimpan terpisah dari guests/guest_members.
async function ensureTraineesTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS trainees (
      id INT AUTO_INCREMENT PRIMARY KEY,
      full_name VARCHAR(150) NOT NULL,
      rank_title VARCHAR(100) NULL,
      position VARCHAR(150) NOT NULL,
      institution VARCHAR(150) NOT NULL,
      address VARCHAR(255) NULL,
      birth_place VARCHAR(100) NULL,
      birth_date DATE NULL,
      activities TEXT NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      security_category ENUM('aman','perlu_perhatian','perlu_penanganan') NULL,
      profiling_notes TEXT NULL,
      created_by INT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_full_name (full_name),
      KEY idx_dates (start_date, end_date),
      FOREIGN KEY (created_by) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

module.exports = { ensureTraineesTable };
