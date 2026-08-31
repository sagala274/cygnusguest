const pool = require('../db');

async function ensureNotificationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      type VARCHAR(50) NOT NULL,
      message VARCHAR(500) NOT NULL,
      guest_id INT NULL,
      is_read TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      KEY idx_user_read (user_id, is_read),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

// Dipanggil saat ada pendaftaran baru yang butuh verifikasi -- mengirim satu
// notifikasi ke SETIAP akun berrole verifikator yang masih aktif.
async function notifyVerifiers({ guestId, message }) {
  try {
    const [verifiers] = await pool.query("SELECT id FROM users WHERE role = 'verifikator' AND is_active = 1");
    for (const v of verifiers) {
      await pool.execute(
        'INSERT INTO notifications (user_id, type, message, guest_id) VALUES (:userId, :type, :message, :guestId)',
        { userId: v.id, type: 'guest_needs_verification', message, guestId: guestId || null }
      );
    }
  } catch (err) {
    console.error('Gagal membuat notifikasi verifikator:', err.message);
  }
}

// Dipanggil saat pendaftaran selesai diverifikasi -- mengirim notifikasi ke
// akun yang membuat pendaftaran tersebut (Pos Depan/Admin).
async function notifyGuestCreator({ userId, guestId, message }) {
  if (!userId) return;
  try {
    await pool.execute(
      'INSERT INTO notifications (user_id, type, message, guest_id) VALUES (:userId, :type, :message, :guestId)',
      { userId, type: 'guest_verified', message, guestId: guestId || null }
    );
  } catch (err) {
    console.error('Gagal membuat notifikasi hasil verifikasi:', err.message);
  }
}

module.exports = { ensureNotificationsTable, notifyVerifiers, notifyGuestCreator };
