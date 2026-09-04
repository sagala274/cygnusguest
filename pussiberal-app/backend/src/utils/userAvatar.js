const pool = require('../db');

async function columnExists(table, column) {
  const [rows] = await pool.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table AND COLUMN_NAME = :column`,
    { table, column }
  );
  return rows.length > 0;
}

// MySQL tidak mendukung "ADD COLUMN IF NOT EXISTS" -- dicek manual lewat
// information_schema supaya idempoten dan aman dijalankan tiap start backend.
async function ensureUserAvatarColumn() {
  if (!(await columnExists('users', 'avatar_url'))) {
    await pool.query('ALTER TABLE users ADD COLUMN avatar_url VARCHAR(255) NULL AFTER full_name');
  }
}

// Penguncian akun otomatis setelah beberapa kali gagal login beruntun --
// pelengkap rate limiter berbasis IP yang sudah ada (lihat routes/auth.js),
// supaya percobaan brute-force yang menyasar SATU akun tertentu dari
// banyak alamat IP berbeda tetap tercegah.
async function ensureUserLockoutColumns() {
  if (!(await columnExists('users', 'failed_login_attempts'))) {
    await pool.query('ALTER TABLE users ADD COLUMN failed_login_attempts INT NOT NULL DEFAULT 0 AFTER is_active');
  }
  if (!(await columnExists('users', 'locked_until'))) {
    await pool.query('ALTER TABLE users ADD COLUMN locked_until DATETIME NULL AFTER failed_login_attempts');
  }
}

module.exports = { ensureUserAvatarColumn, ensureUserLockoutColumns };
