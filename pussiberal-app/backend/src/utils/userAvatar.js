const pool = require('../db');
const bcrypt = require('bcryptjs');

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

// MySQL juga tidak punya "ALTER TYPE ADD VALUE" untuk ENUM -- MODIFY COLUMN
// di sini dijalankan tiap start backend (bukan dikondisikan seperti ADD
// COLUMN di atas) supaya nilai ENUM baru yang ditambahkan ke depannya juga
// otomatis ikut, sama seperti pola VALID_SECURITY_CATEGORIES di guestFields.js.
async function ensureUserRoleEnum() {
  await pool.query("ALTER TABLE users MODIFY COLUMN role ENUM('admin','verifikator','pos_depan','pimpinan') NOT NULL DEFAULT 'pos_depan'");
}

// "Password tambahan" -- lapis verifikasi KEDUA yang terpisah total dari
// password login (password_hash), khusus dipakai sebagai gerbang masuk ke
// halaman data sensitif (Bank Data, Data Personel). Sengaja dipisah supaya
// kompromi salah satu (mis. password login bocor) tidak otomatis membuka
// yang lain, dan supaya admin bisa mengatur/mereset ini lewat menu Kelola
// Pengguna tanpa perlu akses server sama sekali.
async function ensureSecondaryPasswordColumn() {
  if (!(await columnExists('users', 'secondary_password_hash'))) {
    await pool.query('ALTER TABLE users ADD COLUMN secondary_password_hash TEXT NULL AFTER password_hash');
  }
}

// Nilai awal (default) untuk 4 akun perwira Pussiberal, sesuai NRP
// masing-masing -- HANYA diisi kalau kolomnya masih kosong (idempoten,
// tidak menimpa kalau sudah pernah diganti admin lewat Kelola Pengguna).
const SECONDARY_PASSWORD_DEFAULTS = {
  Danpussiberal: '12682',
  Wadanpussiberal: '13365',
  Kaurpam: '22655',
  baurpam: '130560',
};

async function seedSecondaryPasswordDefaults() {
  for (const [username, nrp] of Object.entries(SECONDARY_PASSWORD_DEFAULTS)) {
    const [rows] = await pool.query(
      'SELECT id FROM users WHERE username = :username AND secondary_password_hash IS NULL',
      { username }
    );
    if (!rows.length) continue;
    const hash = await bcrypt.hash(nrp, 10);
    await pool.execute('UPDATE users SET secondary_password_hash = :hash WHERE id = :id', { hash, id: rows[0].id });
  }
}

module.exports = {
  ensureUserAvatarColumn,
  ensureUserLockoutColumns,
  ensureUserRoleEnum,
  ensureSecondaryPasswordColumn,
  seedSecondaryPasswordDefaults,
};
