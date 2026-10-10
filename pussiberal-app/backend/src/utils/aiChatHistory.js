const pool = require('../db');
const cron = require('node-cron');

// Riwayat percakapan AI Chat -- private per akun (user_id), dengan retensi
// otomatis 30 hari (dihitung dari aktivitas TERAKHIR/updated_at, bukan
// created_at, supaya percakapan lama yang masih aktif dilanjutkan tidak
// terhapus prematur). Dua tabel: percakapan (judul + waktu) dan pesan
// (isi tiap giliran bicara), dengan ON DELETE CASCADE supaya menghapus
// satu percakapan otomatis ikut menghapus seluruh pesannya.
async function ensureAiChatHistoryTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_chat_conversations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      title VARCHAR(255) NOT NULL DEFAULT 'Percakapan Baru',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_ai_chat_conversations_user (user_id, updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_chat_messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      conversation_id INT NOT NULL,
      role ENUM('user','assistant') NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conversation_id) REFERENCES ai_chat_conversations(id) ON DELETE CASCADE,
      INDEX idx_ai_chat_messages_conversation (conversation_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

const RETENTION_DAYS = 30;

async function cleanupOldConversations() {
  const [result] = await pool.execute(
    `DELETE FROM ai_chat_conversations WHERE updated_at < DATE_SUB(NOW(), INTERVAL ${RETENTION_DAYS} DAY)`
  );
  if (result.affectedRows) {
    console.log(`Percakapan AI Chat yang sudah lebih dari ${RETENTION_DAYS} hari tidak aktif dihapus: ${result.affectedRows}`);
  }
}

// Dijalankan sekali saat startup (jaga-jaga kalau server lama tidak hidup
// pas jadwal cron harian), lalu terjadwal harian jam 03:00 -- waktu yang
// sengaja dipilih beda dari jadwal backup (01:00/01:30/02:00) supaya tidak
// menumpuk beban I/O di waktu yang sama.
function startAiChatHistoryCleanup() {
  cleanupOldConversations().catch((err) => console.error('Pembersihan riwayat AI Chat awal gagal:', err.message));
  cron.schedule('0 3 * * *', () => {
    cleanupOldConversations().catch((err) => console.error('Pembersihan riwayat AI Chat gagal:', err.message));
  });
}

module.exports = { ensureAiChatHistoryTables, startAiChatHistoryCleanup, cleanupOldConversations, RETENTION_DAYS };
