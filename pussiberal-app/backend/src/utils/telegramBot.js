const pool = require('../db');
const {
  getTelegramSettings,
  getDecryptedBotToken,
  setLastUpdateId,
  setDetectedChat,
  escapeMarkdown,
  escapeMarkdownCode,
} = require('./telegram');

const POLL_TIMEOUT_SECONDS = 25;
const IDLE_RETRY_MS = 15000;

async function replyTo(chatId, token, text) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'MarkdownV2', disable_web_page_preview: true }),
    });
  } catch (err) {
    console.error('Gagal membalas pesan Telegram:', err.message);
  }
}

async function handleStatus() {
  const [[guestTotals]] = await pool.query(`
    SELECT COUNT(*) AS total,
           SUM(DATE(created_at) = CURDATE()) AS today,
           SUM(status = 'Sedang Berkunjung') AS active
    FROM guests
  `);
  const [byStatus] = await pool.query('SELECT status, COUNT(*) AS count FROM guests GROUP BY status');

  const lines = [
    '📊 *Ringkasan Status Sistem*',
    '',
    `Total pendaftaran: ${guestTotals.total}`,
    `Hari ini: ${guestTotals.today || 0}`,
    `Sedang berkunjung: ${guestTotals.active || 0}`,
    '',
    '*Distribusi status:*',
    ...byStatus.map((r) => `\\- ${escapeMarkdown(r.status)}: ${r.count}`),
  ];
  return lines.join('\n');
}

async function handleTamu() {
  const [rows] = await pool.query(`
    SELECT registration_number, company, status, created_at
    FROM guests ORDER BY created_at DESC LIMIT 5
  `);
  if (!rows.length) return '📋 *5 Pendaftaran Terbaru*\n\nBelum ada data\\.';

  const lines = ['📋 *5 Pendaftaran Terbaru*', ''];
  rows.forEach((r) => {
    lines.push(
      `\\- \`${escapeMarkdownCode(r.registration_number)}\` — ${escapeMarkdown(r.company)} \\(${escapeMarkdown(r.status)}\\)`,
      `  ${escapeMarkdown(new Date(r.created_at).toLocaleString('id-ID'))}`
    );
  });
  return lines.join('\n');
}

async function handleLog() {
  const [rows] = await pool.query(`
    SELECT al.action, al.timestamp, u.full_name
    FROM audit_logs al
    LEFT JOIN users u ON u.id = al.user_id
    ORDER BY al.timestamp DESC LIMIT 5
  `);
  if (!rows.length) return '🕐 *5 Aktivitas Terbaru*\n\nBelum ada data\\.';

  const lines = ['🕐 *5 Aktivitas Terbaru*', ''];
  rows.forEach((r) => {
    lines.push(
      `\\- ${escapeMarkdown(r.full_name || 'Sistem')}: ${escapeMarkdown(r.action)}`,
      `  ${escapeMarkdown(new Date(r.timestamp).toLocaleString('id-ID'))}`
    );
  });
  return lines.join('\n');
}

const HELP_TEXT = [
  '🤖 *PUSSIBERAL Monitor Bot*',
  '',
  'Perintah yang tersedia:',
  '/status \\- ringkasan jumlah tamu',
  '/tamu \\- 5 pendaftaran terbaru',
  '/log \\- 5 aktivitas terbaru',
  '/help \\- daftar perintah ini',
].join('\n');

async function handleUpdate(update, token) {
  const message = update.message;
  if (!message || !message.text) return;

  const chatId = String(message.chat.id);
  const text = message.text.trim();

  if (text === '/start') {
    const chat = message.chat;
    const chatName = chat.title || [chat.first_name, chat.last_name].filter(Boolean).join(' ') || chat.username || chatId;
    await setDetectedChat(chatId, chatName);
    await replyTo(
      chatId,
      token,
      [
        '👋 Halo\\! Chat ID Anda:',
        `\`${escapeMarkdownCode(chatId)}\``,
        '',
        'Buka menu *Notifikasi Telegram* pada aplikasi PUSSIBERAL, lalu klik tombol "Gunakan Chat Terdeteksi" untuk mengaktifkan notifikasi ke chat ini\\.',
      ].join('\n')
    );
    return;
  }

  // Perintah data (selain /start) hanya dilayani untuk chat yang sudah terdaftar
  // sebagai chat_id resmi -- mencegah siapapun yang menemukan username bot ini
  // bisa menanyakan data internal sistem.
  const settings = await getTelegramSettings();
  if (!settings || !settings.chat_id || settings.chat_id !== chatId) {
    if (text.startsWith('/')) {
      await replyTo(chatId, token, '⛔ Chat ini belum terdaftar\\. Kirim /start lalu daftarkan Chat ID-nya di menu Notifikasi Telegram\\.');
    }
    return;
  }

  try {
    if (text === '/status') return await replyTo(chatId, token, await handleStatus());
    if (text === '/tamu') return await replyTo(chatId, token, await handleTamu());
    if (text === '/log') return await replyTo(chatId, token, await handleLog());
    if (text === '/help') return await replyTo(chatId, token, HELP_TEXT);
    if (text.startsWith('/')) return await replyTo(chatId, token, HELP_TEXT);
  } catch (err) {
    console.error('Gagal memproses perintah bot Telegram:', err);
  }
}

let polling = false;

async function pollOnce() {
  const token = await getDecryptedBotToken();
  if (!token) return IDLE_RETRY_MS;

  const settings = await getTelegramSettings();
  const offset = Number(settings.last_update_id) + 1;

  let res;
  try {
    res = await fetch(
      `https://api.telegram.org/bot${token}/getUpdates?timeout=${POLL_TIMEOUT_SECONDS}&offset=${offset}`,
      { signal: AbortSignal.timeout((POLL_TIMEOUT_SECONDS + 10) * 1000) }
    );
  } catch (err) {
    console.error('Gagal polling Telegram getUpdates:', err.message);
    return IDLE_RETRY_MS;
  }

  const body = await res.json().catch(() => null);
  if (!body || !body.ok) {
    // Termasuk 401 (token salah) atau 409 (konflik konsumen getUpdates lain) --
    // mundur dulu sebelum coba lagi, jangan langsung retry tanpa jeda.
    console.error('Telegram getUpdates gagal:', body && body.description);
    return IDLE_RETRY_MS;
  }
  if (!Array.isArray(body.result) || !body.result.length) {
    return 0;
  }

  for (const update of body.result) {
    await handleUpdate(update, token);
  }

  const lastId = body.result[body.result.length - 1].update_id;
  await setLastUpdateId(lastId);
  return 0;
}

async function pollLoop() {
  if (polling) return;
  polling = true;
  while (polling) {
    let delay = IDLE_RETRY_MS;
    try {
      delay = await pollOnce();
    } catch (err) {
      console.error('Error tak terduga pada polling Telegram:', err);
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

function startTelegramPolling() {
  pollLoop();
}

module.exports = { startTelegramPolling };
