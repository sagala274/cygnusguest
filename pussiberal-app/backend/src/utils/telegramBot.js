const pool = require('../db');
const {
  getTelegramSettings,
  getDecryptedBotToken,
  setLastUpdateId,
  setDetectedChat,
  sendTelegramMessage,
  escapeMarkdown,
  escapeMarkdownCode,
} = require('./telegram');
const { consumeLinkCode, findUserByTelegramId } = require('./telegramLink');
const { formatJakartaDateTime, todayJakarta } = require('./datetime');

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

// Menutup notifikasi loading "..." di sisi pengguna Telegram setelah tombol
// ditekan. `alert=true` menampilkan popup kecil (dipakai untuk pesan
// error/penolakan supaya jelas terlihat, bukan cuma toast sekilas).
async function answerCallback(callbackQueryId, token, text, alert) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text, show_alert: !!alert }),
    });
  } catch (err) {
    console.error('Gagal membalas callback Telegram:', err.message);
  }
}

// Menghapus tombol Setuju/Tolak dari pesan supaya tidak bisa ditekan dua
// kali (mis. dua verifikator menekan tombol berbeda hampir bersamaan) --
// teks pesan aslinya (berformat MarkdownV2) dibiarkan apa adanya, hasil
// verifikasinya dikirim sebagai pesan BARU (lebih aman daripada mengedit
// ulang teks MarkdownV2 yang sudah terkirim, yang berisiko gagal parse
// kalau di-escape ulang tidak tepat).
async function clearMessageButtons(chatId, messageId, token) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/editMessageReplyMarkup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } }),
    });
  } catch (err) {
    console.error('Gagal menghapus tombol pesan Telegram:', err.message);
  }
}

async function handleStatus() {
  const [[guestTotals]] = await pool.query(
    `SELECT COUNT(*) AS total,
            SUM(DATE(created_at) = :today) AS today,
            SUM(status = 'Sedang Berkunjung') AS active
     FROM guests`,
    { today: todayJakarta() }
  );
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
      `  ${escapeMarkdown(formatJakartaDateTime(r.created_at))}`
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
      `  ${escapeMarkdown(formatJakartaDateTime(r.timestamp))}`
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
  '/link \\- tautkan akun Telegram pribadi ke akun aplikasi',
  '/help \\- daftar perintah ini',
].join('\n');

// /link bisa dikirim dari chat MANAPUN (biasanya DM pribadi ke bot, beda
// dengan chat_id bersama yang dipakai notifikasi) -- makanya ditangani
// SEBELUM gerbang "chat harus chat_id resmi" di bawah, sama seperti /start.
async function handleLinkCommand(message, token) {
  const chatId = String(message.chat.id);
  const parts = message.text.trim().split(/\s+/);
  const code = parts[1];
  if (!code) {
    await replyTo(chatId, token, 'Kirim kode tautan dengan format:\n`/link kode_anda`\n\nKode didapat dari aplikasi PUSSIBERAL, lewat menu profil \\> Tautkan Telegram\\.');
    return;
  }
  const telegramUserId = message.from && message.from.id;
  if (!telegramUserId) return;
  const telegramUsername = (message.from && message.from.username) || null;

  const result = await consumeLinkCode(code, telegramUserId, telegramUsername);
  if (result.error) {
    await replyTo(chatId, token, `⛔ ${escapeMarkdown(result.error)}`);
    return;
  }
  await replyTo(
    chatId,
    token,
    `✅ Akun Telegram Anda berhasil ditautkan ke akun aplikasi *${escapeMarkdown(result.user.full_name)}*\\. Anda sekarang bisa menekan tombol Setuju/Tolak pada notifikasi verifikasi tamu\\.`
  );
}

// Tombol Setuju/Tolak pada notifikasi "Pendaftaran Tamu Baru" -- lihat
// notifyNewRegistration() di telegram.js untuk pembuatan tombolnya, dan
// routes/guests.js (applyGuestVerification) untuk logika inti yang dipakai
// bersama dengan halaman web.
async function handleCallbackQuery(callbackQuery, token) {
  const data = callbackQuery.data || '';
  const [prefix, action, guestIdStr] = data.split(':');
  const guestId = Number(guestIdStr);
  if (prefix !== 'verify' || !['approve', 'reject'].includes(action) || !guestId) {
    await answerCallback(callbackQuery.id, token, 'Aksi tidak dikenali.', true);
    return;
  }

  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const telegramUserId = callbackQuery.from && callbackQuery.from.id;

  const account = telegramUserId ? await findUserByTelegramId(telegramUserId) : null;
  if (!account) {
    await answerCallback(callbackQuery.id, token, 'Akun Telegram Anda belum ditautkan. Kirim /link <kode> ke bot ini dulu (kode dari menu profil aplikasi).', true);
    return;
  }
  if (!account.is_active || !['admin', 'verifikator'].includes(account.role)) {
    await answerCallback(callbackQuery.id, token, 'Akun Anda tidak memiliki izin untuk memverifikasi tamu.', true);
    return;
  }

  // Lazy-require supaya tidak ada circular require di top-level (guests.js
  // ikut me-require utils lain yang pada akhirnya balik ke sini).
  const { applyGuestVerification } = require('../routes/guests');
  const status = action === 'approve' ? 'Disetujui' : 'Ditolak';
  const result = await applyGuestVerification({ id: guestId, status, actingUserId: account.id });

  if (result.error) {
    await answerCallback(callbackQuery.id, token, result.error, true);
    if (result.alreadyResolved) await clearMessageButtons(chatId, messageId, token);
    return;
  }

  await clearMessageButtons(chatId, messageId, token);
  await answerCallback(callbackQuery.id, token, status === 'Disetujui' ? '✅ Disetujui' : '❌ Ditolak');
  await sendTelegramMessage(
    [
      status === 'Disetujui' ? '✅ *Verifikasi via Telegram*' : '❌ *Verifikasi via Telegram*',
      '',
      `Pendaftaran ${escapeMarkdown(result.guest.company)} \\(\`${escapeMarkdownCode(result.guest.registration_number)}\`\\) telah *${escapeMarkdown(status)}*`,
      `oleh: ${escapeMarkdown(account.full_name)}`,
      `Waktu: ${escapeMarkdown(formatJakartaDateTime(new Date()))}`,
    ].join('\n')
  );
}

async function handleUpdate(update, token) {
  if (update.callback_query) {
    return handleCallbackQuery(update.callback_query, token);
  }

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

  if (text.startsWith('/link')) {
    return handleLinkCommand(message, token);
  }

  // Perintah data (selain /start dan /link) hanya dilayani untuk chat yang
  // sudah terdaftar sebagai chat_id resmi -- mencegah siapapun yang
  // menemukan username bot ini bisa menanyakan data internal sistem.
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
