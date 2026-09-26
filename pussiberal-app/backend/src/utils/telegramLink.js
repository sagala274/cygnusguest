const crypto = require('crypto');
const pool = require('../db');

// Menautkan akun Telegram PRIBADI (identitas per-orang, dikenali dari
// telegram_user_id -- angka unik bawaan Telegram, bukan username yang bisa
// berubah) ke satu akun pengguna aplikasi. Ini terpisah dari chat_id bersama
// di telegram_settings (yang cuma satu untuk seluruh sistem, dipakai untuk
// mengirim notifikasi) -- link ini dipakai untuk mengetahui SIAPA yang
// menekan tombol Setuju/Tolak di Telegram, supaya tercatat di audit log
// sebagai akun aplikasi yang benar, bukan sekadar identitas Telegram.
async function ensureTelegramLinkTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS telegram_links (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      telegram_user_id BIGINT NOT NULL,
      telegram_username VARCHAR(64) NULL,
      linked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_telegram_links_user (user_id),
      UNIQUE KEY uq_telegram_links_telegram_id (telegram_user_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS telegram_link_codes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      code VARCHAR(10) NOT NULL,
      expires_at DATETIME NOT NULL,
      used_at DATETIME NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_telegram_link_codes_code (code),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

const CODE_TTL_MINUTES = 10;

// Kode 6 digit acak -- cukup pendek untuk diketik manual di Telegram, dan
// masa berlakunya singkat supaya tidak berguna lagi kalau bocor/terlihat
// orang lain sebelum dipakai.
async function generateLinkCode(userId) {
  // Kode lama milik user ini yang belum kepakai dibuang dulu, supaya tidak
  // menumpuk kode basi di tabel.
  await pool.execute('DELETE FROM telegram_link_codes WHERE user_id = :userId AND used_at IS NULL', { userId });

  let code;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    const [existing] = await pool.execute('SELECT 1 FROM telegram_link_codes WHERE code = :code', { code });
    if (!existing.length) break;
  }

  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);
  await pool.execute(
    'INSERT INTO telegram_link_codes (user_id, code, expires_at) VALUES (:userId, :code, :expiresAt)',
    { userId, code, expiresAt }
  );
  return { code, expiresAt };
}

async function getLinkForUser(userId) {
  const [rows] = await pool.execute(
    'SELECT telegram_user_id, telegram_username, linked_at FROM telegram_links WHERE user_id = :userId',
    { userId }
  );
  return rows[0] || null;
}

async function unlinkUser(userId) {
  await pool.execute('DELETE FROM telegram_links WHERE user_id = :userId', { userId });
}

// Dipakai bot (telegramBot.js) untuk mengenali siapa yang mengirim /link
// atau menekan tombol Setuju/Tolak, dari telegram_user_id di update Telegram.
// Ikut mengembalikan role & status aktif supaya pemanggil tidak perlu query lagi.
async function findUserByTelegramId(telegramUserId) {
  const [rows] = await pool.execute(
    `SELECT u.id, u.full_name, u.role, u.is_active
     FROM telegram_links tl
     JOIN users u ON u.id = tl.user_id
     WHERE tl.telegram_user_id = :telegramUserId`,
    { telegramUserId }
  );
  return rows[0] || null;
}

// Mencocokkan kode yang dikirim lewat /link ke kode yang masih berlaku,
// lalu menautkan telegram_user_id pengirim ke akun tersebut. Satu
// telegram_user_id hanya bisa tertaut ke SATU akun (ditegakkan lewat
// UNIQUE key) -- kalau sebelumnya sudah tertaut ke akun lain, tautan lama
// diganti (mis. ganti HP/akun Telegram), bukan ditolak.
async function consumeLinkCode(code, telegramUserId, telegramUsername) {
  const [rows] = await pool.execute(
    'SELECT id, user_id, expires_at, used_at FROM telegram_link_codes WHERE code = :code',
    { code }
  );
  const row = rows[0];
  if (!row) return { error: 'Kode tidak ditemukan. Pastikan diketik dengan benar.' };
  if (row.used_at) return { error: 'Kode ini sudah pernah dipakai.' };
  if (new Date(row.expires_at).getTime() < Date.now()) return { error: 'Kode sudah kedaluwarsa. Minta kode baru dari aplikasi.' };

  await pool.execute('UPDATE telegram_link_codes SET used_at = NOW() WHERE id = :id', { id: row.id });

  // Dua UNIQUE key (user_id & telegram_user_id) bisa berpotensi konflik dari
  // dua arah berbeda (mis. ganti HP, atau akun Telegram itu sebelumnya
  // tertaut ke akun aplikasi lain) -- dibersihkan dulu manual sebelum insert,
  // supaya tidak mengandalkan ON DUPLICATE KEY pada dua unique key sekaligus.
  await pool.execute('DELETE FROM telegram_links WHERE user_id = :userId OR telegram_user_id = :telegramUserId', {
    userId: row.user_id,
    telegramUserId,
  });
  await pool.execute(
    'INSERT INTO telegram_links (user_id, telegram_user_id, telegram_username) VALUES (:userId, :telegramUserId, :telegramUsername)',
    { userId: row.user_id, telegramUserId, telegramUsername: telegramUsername || null }
  );

  const [userRows] = await pool.execute('SELECT id, full_name FROM users WHERE id = :id', { id: row.user_id });
  return { user: userRows[0] };
}

module.exports = {
  ensureTelegramLinkTables,
  generateLinkCode,
  getLinkForUser,
  unlinkUser,
  findUserByTelegramId,
  consumeLinkCode,
};
