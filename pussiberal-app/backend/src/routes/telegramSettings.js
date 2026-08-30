const express = require('express');
const pool = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { logAudit } = require('../utils/audit');
const {
  getTelegramSettings,
  getDecryptedBotToken,
  sendTelegramMessage,
  encrypt,
} = require('../utils/telegram');

const router = express.Router();
router.use(authenticate, requireRole('admin'));

async function getBotIdentity(token) {
  if (!token) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const body = await res.json();
    return body.ok ? body.result : null;
  } catch (err) {
    return null;
  }
}

router.get('/', asyncHandler(async (req, res) => {
  const settings = await getTelegramSettings();
  const token = await getDecryptedBotToken();
  const bot = await getBotIdentity(token);

  res.json({
    data: {
      chat_id: settings.chat_id,
      notify_new_registration: !!settings.notify_new_registration,
      notify_login: !!settings.notify_login,
      notify_logout: !!settings.notify_logout,
      has_bot_token: !!settings.bot_token_encrypted,
      bot_username: bot ? bot.username : null,
      bot_connection_ok: !!bot,
      detected_chat_id: settings.detected_chat_id,
      detected_chat_name: settings.detected_chat_name,
      updated_at: settings.updated_at,
    },
  });
}));

router.put('/', asyncHandler(async (req, res) => {
  const { bot_token, chat_id, notify_new_registration, notify_login, notify_logout } = req.body || {};

  const fields = [];
  const params = {};
  if (typeof bot_token === 'string' && bot_token.trim()) {
    fields.push('bot_token_encrypted = :bot_token_encrypted');
    params.bot_token_encrypted = encrypt(bot_token.trim());
    fields.push('last_update_id = 0');
  }
  if (chat_id !== undefined) {
    fields.push('chat_id = :chat_id');
    params.chat_id = chat_id ? String(chat_id).trim() : null;
  }
  if (notify_new_registration !== undefined) {
    fields.push('notify_new_registration = :notify_new_registration');
    params.notify_new_registration = notify_new_registration ? 1 : 0;
  }
  if (notify_login !== undefined) {
    fields.push('notify_login = :notify_login');
    params.notify_login = notify_login ? 1 : 0;
  }
  if (notify_logout !== undefined) {
    fields.push('notify_logout = :notify_logout');
    params.notify_logout = notify_logout ? 1 : 0;
  }
  fields.push('updated_by = :updated_by');
  params.updated_by = req.user.sub;

  await pool.execute(`UPDATE telegram_settings SET ${fields.join(', ')} WHERE id = 1`, params);
  await logAudit(req.user.sub, 'update_telegram_settings', 'telegram_settings', null, {
    chat_id_changed: chat_id !== undefined,
    bot_token_changed: typeof bot_token === 'string' && !!bot_token.trim(),
    notify_new_registration,
    notify_login,
    notify_logout,
  });

  const settings = await getTelegramSettings();
  const token = await getDecryptedBotToken();
  const bot = await getBotIdentity(token);

  res.json({
    data: {
      chat_id: settings.chat_id,
      notify_new_registration: !!settings.notify_new_registration,
      notify_login: !!settings.notify_login,
      notify_logout: !!settings.notify_logout,
      has_bot_token: !!settings.bot_token_encrypted,
      bot_username: bot ? bot.username : null,
      bot_connection_ok: !!bot,
      detected_chat_id: settings.detected_chat_id,
      detected_chat_name: settings.detected_chat_name,
      updated_at: settings.updated_at,
    },
  });
}));

router.post('/test', asyncHandler(async (req, res) => {
  const settings = await getTelegramSettings();
  if (!settings.bot_token_encrypted) {
    return res.status(400).json({ error: 'Bot token belum diisi' });
  }
  if (!settings.chat_id) {
    return res.status(400).json({ error: 'Chat ID belum diisi' });
  }

  const result = await sendTelegramMessage(
    `✅ *Tes Notifikasi Berhasil*\n\nJika Anda menerima pesan ini, integrasi Telegram sudah berjalan dengan benar\\.`
  );

  if (!result.ok) {
    return res.status(502).json({ error: `Gagal mengirim pesan tes: ${result.description || result.reason || 'kesalahan tidak diketahui'}` });
  }

  res.json({ data: { sent: true } });
}));

module.exports = router;
