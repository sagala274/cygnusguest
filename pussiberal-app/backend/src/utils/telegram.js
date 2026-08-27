const pool = require('../db');
const { encrypt, decrypt } = require('./crypto');
const { TARGET_OFFICIAL_LABELS } = require('./guestFields');
const { formatJakartaDateTime } = require('./datetime');

async function ensureTelegramSettingsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS telegram_settings (
      id TINYINT PRIMARY KEY DEFAULT 1,
      bot_token_encrypted TEXT NULL,
      chat_id VARCHAR(50) NULL,
      notify_new_registration TINYINT(1) NOT NULL DEFAULT 1,
      notify_login TINYINT(1) NOT NULL DEFAULT 1,
      last_update_id BIGINT NOT NULL DEFAULT 0,
      detected_chat_id VARCHAR(50) NULL,
      detected_chat_name VARCHAR(200) NULL,
      updated_by INT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT chk_telegram_settings_singleton CHECK (id = 1)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await pool.query(
    `INSERT INTO telegram_settings (id) VALUES (1) ON DUPLICATE KEY UPDATE id = id`
  );
}

async function getTelegramSettings() {
  const [rows] = await pool.query('SELECT * FROM telegram_settings WHERE id = 1');
  return rows[0] || null;
}

async function getDecryptedBotToken() {
  const settings = await getTelegramSettings();
  if (!settings || !settings.bot_token_encrypted) return null;
  return decrypt(settings.bot_token_encrypted);
}

async function setLastUpdateId(updateId) {
  await pool.execute('UPDATE telegram_settings SET last_update_id = :updateId WHERE id = 1', { updateId });
}

async function setDetectedChat(chatId, chatName) {
  await pool.execute(
    'UPDATE telegram_settings SET detected_chat_id = :chatId, detected_chat_name = :chatName WHERE id = 1',
    { chatId, chatName }
  );
}

// Escape untuk Telegram MarkdownV2 -- karakter di bawah ini wajib di-escape
// jika muncul di luar konteks format (bold/italic dsb), atau Telegram menolak pesannya.
function escapeMarkdown(text) {
  return String(text).replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

// Untuk teks yang ditaruh DI DALAM code span (`...`) -- di dalam entitas
// code/pre, MarkdownV2 hanya mewajibkan escape pada backtick dan backslash.
// Memakai escapeMarkdown() biasa di sini salah: backslash tambahan justru
// akan tampil apa adanya karena tidak diproses sebagai markdown di dalam code span.
function escapeMarkdownCode(text) {
  return String(text).replace(/[`\\]/g, '\\$&');
}

async function sendTelegramMessage(text) {
  const token = await getDecryptedBotToken();
  const settings = await getTelegramSettings();
  if (!token || !settings.chat_id) return { ok: false, reason: 'not_configured' };

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: settings.chat_id,
        text,
        parse_mode: 'MarkdownV2',
        disable_web_page_preview: true,
      }),
    });
    const body = await res.json();
    if (!body.ok) console.error('Gagal mengirim pesan Telegram:', body.description);
    return body;
  } catch (err) {
    console.error('Gagal mengirim pesan Telegram:', err.message);
    return { ok: false, reason: 'network_error' };
  }
}

async function notifyNewRegistration({ registrationNumber, company, targetOfficials, targetOfficialOther, purpose, memberCount, memberNames, createdByName }) {
  const settings = await getTelegramSettings();
  if (!settings || !settings.notify_new_registration) return;

  let officialLabels = (targetOfficials || []).map((v) => TARGET_OFFICIAL_LABELS[v] || v).join(', ');
  if ((targetOfficials || []).includes('lainnya') && targetOfficialOther) {
    officialLabels += ` (${targetOfficialOther})`;
  }

  const lines = [
    '🆕 *Pendaftaran Tamu Baru*',
    '',
    `No\\. Registrasi: \`${escapeMarkdownCode(registrationNumber)}\``,
    `Perusahaan: ${escapeMarkdown(company)}`,
    `Tujuan Menghadap Kepada: ${escapeMarkdown(officialLabels)}`,
    `Jumlah Tamu: ${escapeMarkdown(String(memberCount))}`,
    `Nama: ${escapeMarkdown(memberNames.join(', '))}`,
    `Detail Keperluan: ${escapeMarkdown(purpose)}`,
    `Didaftarkan oleh: ${escapeMarkdown(createdByName)}`,
    `Waktu: ${escapeMarkdown(formatJakartaDateTime(new Date()))}`,
  ];
  await sendTelegramMessage(lines.join('\n'));
}

async function notifyLogin({ username, fullName, role, ipAddress }) {
  const settings = await getTelegramSettings();
  if (!settings || !settings.notify_login) return;

  const lines = [
    '🔐 *Akses Sistem \\(Login\\)*',
    '',
    `Pengguna: ${escapeMarkdown(fullName)} \\(${escapeMarkdown(username)}\\)`,
    `Role: ${escapeMarkdown(role)}`,
    `IP: \`${escapeMarkdownCode(ipAddress || '-')}\``,
    `Waktu: ${escapeMarkdown(formatJakartaDateTime(new Date()))}`,
  ];
  await sendTelegramMessage(lines.join('\n'));
}

module.exports = {
  ensureTelegramSettingsTable,
  getTelegramSettings,
  getDecryptedBotToken,
  setLastUpdateId,
  setDetectedChat,
  sendTelegramMessage,
  notifyNewRegistration,
  notifyLogin,
  escapeMarkdown,
  escapeMarkdownCode,
  encrypt,
};
