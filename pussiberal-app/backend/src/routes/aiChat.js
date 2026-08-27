const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const pool = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { logAudit } = require('../utils/audit');
const { getAiSettings, getDecryptedApiKey } = require('../utils/aiSettings');

const router = express.Router();
router.use(authenticate, requireRole('admin'));

const MAX_MESSAGE_LENGTH = 4000;
const MAX_HISTORY_TURNS = 20;

async function buildPlatformContext() {
  const [[guestTotals]] = await pool.query(`
    SELECT COUNT(*) AS total,
           SUM(DATE(created_at) = CURDATE()) AS today,
           SUM(status = 'Sedang Berkunjung') AS active
    FROM guests
  `);
  const [byStatus] = await pool.query('SELECT status, COUNT(*) AS count FROM guests GROUP BY status');
  const [bySecurityCategory] = await pool.query(
    "SELECT COALESCE(security_category, 'belum_dianalisa') AS category, COUNT(*) AS count FROM guest_members GROUP BY category"
  );
  const [byDeviceStatus] = await pool.query(
    'SELECT device_status, COUNT(*) AS count FROM guest_members GROUP BY device_status'
  );
  const [[nikStats]] = await pool.query('SELECT COUNT(DISTINCT nik) AS unique_nik FROM guest_members');
  const [[nikConflict]] = await pool.query(`
    SELECT COUNT(*) AS conflicting_nik FROM (
      SELECT nik FROM guest_members GROUP BY nik HAVING COUNT(DISTINCT LOWER(TRIM(full_name))) > 1
    ) t
  `);
  const [topCompanies] = await pool.query(
    'SELECT company, COUNT(*) AS count FROM guests GROUP BY company ORDER BY count DESC LIMIT 5'
  );
  const [usersByRole] = await pool.query(
    "SELECT role, COUNT(*) AS count FROM users WHERE is_active = 1 GROUP BY role"
  );
  const [recentDaily] = await pool.query(`
    SELECT DATE(created_at) AS day, COUNT(*) AS count
    FROM guests
    WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
    GROUP BY day ORDER BY day
  `);

  const lines = [];
  lines.push('=== RINGKASAN DATA PLATFORM PUSSIBERAL (real-time) ===');
  lines.push(`Total pendaftaran tamu: ${guestTotals.total} (hari ini: ${guestTotals.today || 0}, sedang berkunjung: ${guestTotals.active || 0})`);
  lines.push('Distribusi status pendaftaran: ' + (byStatus.map((r) => `${r.status}=${r.count}`).join(', ') || '-'));
  lines.push('Distribusi kategori keamanan personel: ' + (bySecurityCategory.map((r) => `${r.category}=${r.count}`).join(', ') || '-'));
  lines.push('Distribusi status perangkat elektronik: ' + (byDeviceStatus.map((r) => `${r.device_status}=${r.count}`).join(', ') || '-'));
  lines.push(`Jumlah NIK unik di bank data personel: ${nikStats.unique_nik}`);
  lines.push(`Jumlah NIK yang tercatat dengan >1 nama berbeda (potensi anomali identitas): ${nikConflict.conflicting_nik}`);
  lines.push('5 perusahaan dengan pendaftaran terbanyak: ' + (topCompanies.map((r) => `${r.company} (${r.count})`).join(', ') || '-'));
  lines.push('Jumlah pengguna aktif per role: ' + (usersByRole.map((r) => `${r.role}=${r.count}`).join(', ') || '-'));
  lines.push('Tren pendaftaran 7 hari terakhir: ' + (recentDaily.map((r) => `${new Date(r.day).toLocaleDateString('id-ID')}=${r.count}`).join(', ') || '-'));

  return lines.join('\n');
}

const BASE_SYSTEM_PROMPT = `Anda adalah asisten analisa data untuk PUSSIBERAL Guest Management, sebuah sistem manajemen tamu dan keamanan fasilitas.
Tugas Anda adalah membantu Administrator menganalisa dan memahami data pada platform ini (statistik kunjungan tamu, kategori keamanan personel, bank data, aktivitas pengguna, dsb).
Aturan:
- Jawab dalam Bahasa Indonesia, singkat dan langsung ke inti, kecuali diminta lebih detail.
- Gunakan HANYA data pada bagian "RINGKASAN DATA PLATFORM" di bawah sebagai sumber angka/statistik. Jangan mengarang angka yang tidak ada di sana.
- Jika pertanyaan memerlukan data yang tidak tersedia dalam ringkasan, katakan dengan jujur bahwa data tersebut tidak tersedia dalam ringkasan ini, dan sarankan menu yang relevan (mis. Bank Data, Laporan, Log Aktivitas).
- Anda tidak dapat mengubah data apapun di sistem, hanya menjawab pertanyaan dan memberi analisa/insight.`;

router.post('/query', asyncHandler(async (req, res) => {
  const { message, history } = req.body || {};

  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Pesan tidak boleh kosong' });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ error: `Pesan terlalu panjang (maksimal ${MAX_MESSAGE_LENGTH} karakter)` });
  }

  let safeHistory = [];
  if (Array.isArray(history)) {
    safeHistory = history
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
      .slice(-MAX_HISTORY_TURNS)
      .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_LENGTH) }));
  }

  const settings = await getAiSettings();
  const apiKey = await getDecryptedApiKey();
  if (!apiKey) {
    return res.status(400).json({
      error: 'API key AI belum dikonfigurasi. Silakan atur di menu Konfigurasi AI terlebih dahulu.',
    });
  }

  const context = await buildPlatformContext();
  const systemPrompt = [BASE_SYSTEM_PROMPT, settings.system_prompt || '', context].filter(Boolean).join('\n\n');

  const client = new Anthropic({ apiKey });

  let response;
  try {
    response = await client.messages.create({
      model: settings.model,
      max_tokens: 16000,
      system: systemPrompt,
      messages: [...safeHistory, { role: 'user', content: message.trim() }],
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return res.status(400).json({ error: 'API key AI tidak valid. Periksa kembali di menu Konfigurasi AI.' });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: 'Terlalu banyak permintaan ke layanan AI. Coba lagi sesaat lagi.' });
    }
    if (err instanceof Anthropic.APIError) {
      return res.status(502).json({ error: `Layanan AI mengembalikan kesalahan: ${err.message}` });
    }
    throw err;
  }

  const reply = response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();

  await logAudit(req.user.sub, 'ai_chat_query', 'ai_chat', null, { message: message.trim().slice(0, 500) });

  res.json({ data: { reply, model: response.model } });
}));

module.exports = router;
