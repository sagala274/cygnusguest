const pool = require('../db');

// Riwayat alamat IP yang pernah dipakai tiap akun untuk login berhasil --
// dasar untuk menandai "IP Baru" di Log Aktivitas (indikator sederhana
// User Behavior Analysis: login dari alamat yang belum pernah tercatat
// untuk akun tersebut sebelumnya).
async function ensureUserLoginIpsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_login_ips (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      ip_address VARCHAR(45) NOT NULL,
      first_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      login_count INT NOT NULL DEFAULT 1,
      UNIQUE KEY uq_user_ip (user_id, ip_address),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

// Mencatat IP login yang berhasil, dan mengembalikan apakah ini alamat IP
// PERTAMA KALI tercatat untuk akun ini (dipakai sebagai penanda "IP Baru").
async function recordLoginIp(userId, ipAddress) {
  const ip = ipAddress || 'unknown';
  const [existing] = await pool.execute(
    'SELECT id FROM user_login_ips WHERE user_id = :userId AND ip_address = :ip',
    { userId, ip }
  );
  const isNewIp = existing.length === 0;

  if (isNewIp) {
    await pool.execute(
      'INSERT INTO user_login_ips (user_id, ip_address) VALUES (:userId, :ip)',
      { userId, ip }
    );
  } else {
    await pool.execute(
      'UPDATE user_login_ips SET last_seen_at = NOW(), login_count = login_count + 1 WHERE user_id = :userId AND ip_address = :ip',
      { userId, ip }
    );
  }

  return isNewIp;
}

module.exports = { ensureUserLoginIpsTable, recordLoginIp };
