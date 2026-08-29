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

module.exports = { ensureUserAvatarColumn };
