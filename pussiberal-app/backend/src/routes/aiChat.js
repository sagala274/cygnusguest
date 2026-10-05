const express = require('express');
const pool = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { logAudit } = require('../utils/audit');
const { getAiSettings, getDecryptedApiKey, getDecryptedOllamaApiKey } = require('../utils/aiSettings');
const { formatJakartaDate, todayJakarta } = require('../utils/datetime');
const { maskNik } = require('../utils/validators');

const router = express.Router();
router.use(authenticate, requireRole('admin'));

const MAX_MESSAGE_LENGTH = 4000;
const MAX_HISTORY_TURNS = 20;
// Dinaikkan dari 4 -> 6: saat beralih ke AI lokal (Ollama) karena kuota
// OpenRouter habis, peralihan itu sendiri memakai satu putaran tambahan,
// jadi perlu ruang lebih supaya tool-calling tetap kebagian putaran cukup.
const MAX_TOOL_ROUNDS = 6;

function isValidDateStr(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value));
}

// Satu-satunya "tool" yang boleh dipanggil model -- READ-ONLY, query
// ter-parameterisasi (bukan model menulis SQL bebas), supaya pertanyaan
// seperti "siapa saja tamu tanggal 29 September" bisa dijawab dengan data
// sungguhan, bukan cuma ringkasan angka agregat di buildPlatformContext().
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'cari_tamu',
      description:
        'Mencari data tamu (nama & biodata) yang TERDAFTAR di PUSSIBERAL, difilter berdasarkan rentang tanggal pendaftaran dan/atau nama/perusahaan. ' +
        'Pakai tool ini setiap kali pengguna meminta nama, biodata, atau daftar tamu tertentu (bukan cuma angka statistik) -- baik untuk tanggal baru maupun lama. ' +
        'Semua parameter opsional; kosongkan yang tidak relevan.',
      parameters: {
        type: 'object',
        properties: {
          tanggal_mulai: { type: 'string', description: 'Tanggal pendaftaran paling awal, format YYYY-MM-DD.' },
          tanggal_selesai: { type: 'string', description: 'Tanggal pendaftaran paling akhir, format YYYY-MM-DD.' },
          nama: { type: 'string', description: 'Potongan nama tamu yang dicari.' },
          perusahaan: { type: 'string', description: 'Potongan nama perusahaan/instansi asal tamu.' },
          limit: { type: 'integer', description: 'Jumlah maksimal hasil, default 20, maksimal 50.' },
        },
      },
    },
  },
];

async function runCariTamu(args = {}) {
  const limit = Math.min(Math.max(parseInt(args.limit, 10) || 20, 1), 50);
  const where = [];
  const params = {};
  if (isValidDateStr(args.tanggal_mulai)) {
    where.push('DATE(g.created_at) >= :tanggal_mulai');
    params.tanggal_mulai = args.tanggal_mulai;
  }
  if (isValidDateStr(args.tanggal_selesai)) {
    where.push('DATE(g.created_at) <= :tanggal_selesai');
    params.tanggal_selesai = args.tanggal_selesai;
  }
  if (args.nama && String(args.nama).trim()) {
    where.push('gm.full_name LIKE :nama');
    params.nama = `%${String(args.nama).trim()}%`;
  }
  if (args.perusahaan && String(args.perusahaan).trim()) {
    where.push('g.company LIKE :perusahaan');
    params.perusahaan = `%${String(args.perusahaan).trim()}%`;
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT g.registration_number, g.company, g.purpose, g.status, g.created_at,
            gm.full_name, gm.nik, gm.phone_number, gm.position
     FROM guests g
     JOIN guest_members gm ON gm.guest_id = g.id
     ${whereSql}
     ORDER BY g.created_at DESC
     LIMIT ${limit}`,
    params
  );

  if (!rows.length) return { jumlah: 0, catatan: 'Tidak ada tamu yang cocok dengan kriteria pencarian ini.' };

  // NIK disamarkan sebelum dikirim ke model AI pihak ketiga (lewat
  // OpenRouter, bisa diteruskan ke penyedia model mana pun) -- berbeda
  // dengan tampilan di aplikasi sendiri (mis. Bank Data) yang memang boleh
  // menampilkan NIK penuh ke Admin, data yang keluar dari infrastruktur
  // sendiri menuju pihak ketiga sengaja dibuat lebih hati-hati.
  return {
    jumlah: rows.length,
    tamu: rows.map((r) => ({
      nama: r.full_name,
      nik: maskNik(r.nik),
      no_hp: r.phone_number,
      jabatan: r.position,
      perusahaan: r.company,
      tujuan_kunjungan: r.purpose,
      status_pendaftaran: r.status,
      no_registrasi: r.registration_number,
      tanggal_daftar: formatJakartaDate(r.created_at, { day: '2-digit', month: 'long', year: 'numeric' }),
    })),
  };
}

async function buildPlatformContext() {
  const todayStr = todayJakarta();
  const [[guestTotals]] = await pool.query(
    `SELECT COUNT(*) AS total,
            SUM(DATE(created_at) = :today) AS today,
            SUM(status = 'Sedang Berkunjung') AS active
     FROM guests`,
    { today: todayStr }
  );
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
      SELECT nik FROM guest_members WHERE nik IS NOT NULL
      GROUP BY nik HAVING COUNT(DISTINCT LOWER(TRIM(full_name))) > 1
    ) t
  `);
  const [topCompanies] = await pool.query(
    'SELECT company, COUNT(*) AS count FROM guests GROUP BY company ORDER BY count DESC LIMIT 5'
  );
  const [usersByRole] = await pool.query(
    "SELECT role, COUNT(*) AS count FROM users WHERE is_active = 1 GROUP BY role"
  );
  const [recentDaily] = await pool.query(
    `SELECT DATE(created_at) AS day, COUNT(*) AS count
     FROM guests
     WHERE created_at >= DATE_SUB(:today, INTERVAL 7 DAY)
     GROUP BY day ORDER BY day`,
    { today: todayStr }
  );

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
  lines.push('Tren pendaftaran 7 hari terakhir: ' + (recentDaily.map((r) => `${formatJakartaDate(r.day)}=${r.count}`).join(', ') || '-'));

  return lines.join('\n');
}

function buildSystemPrompt(context, customPrompt) {
  const base = `Anda adalah asisten analisa data untuk PUSSIBERAL Guest Management, sebuah sistem manajemen tamu dan keamanan fasilitas.
Tugas Anda adalah membantu Administrator menganalisa dan memahami data pada platform ini (statistik kunjungan tamu, kategori keamanan personel, bank data, aktivitas pengguna, dsb).
Hari ini: ${formatJakartaDate(new Date(), { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })} (pakai ini untuk menafsirkan tanggal relatif seperti "kemarin"/"minggu lalu").

Aturan:
- Jawab dalam Bahasa Indonesia, singkat dan langsung ke inti, kecuali diminta lebih detail.
- Untuk angka/statistik agregat, gunakan HANYA data pada bagian "RINGKASAN DATA PLATFORM" di bawah. Jangan mengarang angka yang tidak ada di sana.
- Kalau pengguna meminta NAMA, BIODATA, atau DAFTAR TAMU tertentu (baik tanggal lama maupun baru) -- bukan cuma angka -- WAJIB panggil tool "cari_tamu" untuk mengambil datanya langsung dari database, jangan menjawab "tidak tersedia" tanpa mencoba tool ini dulu. NIK yang dikembalikan tool sudah sengaja disamarkan sebagian untuk privasi.
- Kalau hasil tool kosong atau pertanyaan di luar cakupan tool ini (mis. butuh data personel internal, bukan tamu), katakan jujur data itu tidak tersedia lewat chat ini, dan sarankan menu yang relevan (mis. Absensi Personel, Bank Data, Laporan, Log Aktivitas).
- Anda tidak dapat mengubah data apapun di sistem, hanya menjawab pertanyaan dan memberi analisa/insight.`;
  return [base, customPrompt || '', context].filter(Boolean).join('\n\n');
}

async function callOpenRouter(apiKey, model, messages, useTools) {
  return fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'X-Title': 'PUSSIBERAL Guest Management - AI Chat',
    },
    body: JSON.stringify({
      model,
      max_tokens: 8000,
      messages,
      ...(useTools ? { tools: TOOLS, tool_choice: 'auto' } : {}),
    }),
  });
}

// Server Ollama sendiri (lokal/on-premise), dipanggil lewat endpoint
// kompatibel-OpenAI bawaannya (/v1/chat/completions) supaya bisa memakai
// format request/response yang sama persis dengan OpenRouter di atas --
// termasuk tool-calling, kalau model lokalnya mendukung.
async function callOllama(baseUrl, apiKey, model, messages, useTools) {
  return fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      model,
      max_tokens: 8000,
      messages,
      ...(useTools ? { tools: TOOLS, tool_choice: 'auto' } : {}),
    }),
  });
}

async function parseApiError(apiResponse, defaultLabel) {
  let errorMessage = `${defaultLabel} mengembalikan kesalahan (${apiResponse.status})`;
  try {
    const errBody = await apiResponse.json();
    if (errBody && errBody.error && errBody.error.message) errorMessage = errBody.error.message;
    else if (errBody && typeof errBody.error === 'string') errorMessage = errBody.error;
  } catch (err) {
    /* body bukan JSON, gunakan pesan default */
  }
  return errorMessage;
}

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
  const ollamaApiKey = await getDecryptedOllamaApiKey();
  const ollamaBaseUrl = settings.ollama_base_url;
  const ollamaModel = settings.ollama_model;
  const ollamaConfigured = !!(ollamaBaseUrl && ollamaModel);

  if (!apiKey && !ollamaConfigured) {
    return res.status(400).json({
      error: 'API key AI belum dikonfigurasi. Silakan atur di menu Konfigurasi AI terlebih dahulu.',
    });
  }

  const context = await buildPlatformContext();
  const systemPrompt = buildSystemPrompt(context, settings.system_prompt);

  const messages = [
    { role: 'system', content: systemPrompt },
    ...safeHistory,
    { role: 'user', content: message.trim() },
  ];

  // Dua penyedia model yang mungkin dipakai: OpenRouter (utama, kalau API
  // key-nya diisi) atau Ollama lokal (dipakai langsung sebagai utama kalau
  // OpenRouter belum dikonfigurasi sama sekali). Selama permintaan ini
  // berjalan, begitu beralih ke Ollama (lihat alasan di bawah), sisa
  // putaran tool-calling tetap memakai Ollama -- tidak bolak-balik.
  let provider = apiKey ? 'openrouter' : 'ollama';
  let switchedToLocal = provider === 'ollama';

  // Loop tool-use manual (format OpenAI-compatible, dipakai sama persis
  // oleh OpenRouter maupun endpoint kompatibel-OpenAI Ollama): kalau model
  // memanggil tool "cari_tamu", hasilnya dimasukkan kembali ke percakapan
  // lalu model dipanggil ULANG untuk merangkai jawaban akhirnya berdasarkan
  // data sungguhan -- bukan cuma ringkasan statistik.
  let toolsEnabled = true;
  let finalReply = '';
  let usedModel = provider === 'openrouter' ? settings.model : ollamaModel;
  let toolsUsed = 0;
  let providerAttempts = 0;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    let apiResponse;
    try {
      apiResponse = provider === 'openrouter'
        ? await callOpenRouter(apiKey, settings.model, messages, toolsEnabled)
        : await callOllama(ollamaBaseUrl, ollamaApiKey, ollamaModel, messages, toolsEnabled);
    } catch (err) {
      // OpenRouter tidak terhubung sama sekali (bukan cuma error terstruktur)
      // -- kalau AI lokal tersedia dan belum pernah dicoba, alihkan juga,
      // sama seperti alasan kuota habis di bawah.
      if (provider === 'openrouter' && ollamaConfigured && !switchedToLocal) {
        provider = 'ollama';
        switchedToLocal = true;
        toolsEnabled = true;
        providerAttempts = 0;
        continue;
      }
      return res.status(502).json({
        error: provider === 'openrouter'
          ? 'Gagal menghubungi OpenRouter. Periksa koneksi server.'
          : 'Gagal menghubungi AI lokal (Ollama). Periksa apakah server Ollama aktif dan dapat diakses dari server aplikasi.',
      });
    }

    if (!apiResponse.ok) {
      // Kredit/kuota OpenRouter habis (402) atau terlalu banyak permintaan
      // (429) -- kalau AI lokal (Ollama) sudah dikonfigurasi dan belum
      // pernah dicoba di permintaan ini, alihkan otomatis ke sana alih-alih
      // langsung gagal ke pengguna. Inilah mekanisme "cadangan otomatis".
      const isQuotaIssue = provider === 'openrouter' && (apiResponse.status === 402 || apiResponse.status === 429);
      if (isQuotaIssue && ollamaConfigured && !switchedToLocal) {
        provider = 'ollama';
        switchedToLocal = true;
        toolsEnabled = true;
        providerAttempts = 0;
        continue;
      }

      // Sebagian model tidak mendukung tool-calling -- kalau gagal di
      // percobaan PERTAMA pada penyedia ini selagi tools masih aktif, coba
      // sekali lagi tanpa tools (fallback ke perilaku lama: jawab dari
      // ringkasan statistik saja) alih-alih langsung gagal total.
      if (providerAttempts === 0 && toolsEnabled) {
        toolsEnabled = false;
        providerAttempts += 1;
        continue;
      }

      if (provider === 'openrouter') {
        const errorMessage = await parseApiError(apiResponse, 'OpenRouter');
        if (apiResponse.status === 401) {
          return res.status(400).json({ error: 'API key OpenRouter tidak valid. Periksa kembali di menu Konfigurasi AI.' });
        }
        if (apiResponse.status === 402) {
          return res.status(400).json({ error: 'Kredit OpenRouter tidak mencukupi untuk memproses permintaan ini, dan AI lokal cadangan belum diatur di menu Konfigurasi AI.' });
        }
        if (apiResponse.status === 429) {
          return res.status(429).json({ error: 'Terlalu banyak permintaan ke OpenRouter. Coba lagi sesaat lagi.' });
        }
        return res.status(502).json({ error: `Layanan AI mengembalikan kesalahan: ${errorMessage}` });
      }
      const errorMessage = await parseApiError(apiResponse, 'AI lokal (Ollama)');
      return res.status(502).json({ error: `AI lokal (Ollama) mengembalikan kesalahan: ${errorMessage}` });
    }

    const body = await apiResponse.json();
    usedModel = body.model || (provider === 'openrouter' ? settings.model : ollamaModel);
    const choice = body.choices && body.choices[0];
    const msg = choice && choice.message;
    const toolCalls = msg && Array.isArray(msg.tool_calls) ? msg.tool_calls : [];

    if (toolCalls.length && toolsUsed < MAX_TOOL_ROUNDS - 1) {
      messages.push({ role: 'assistant', content: msg.content || null, tool_calls: toolCalls });
      for (const call of toolCalls) {
        let result;
        try {
          const args = call.function && call.function.arguments ? JSON.parse(call.function.arguments) : {};
          result = call.function && call.function.name === 'cari_tamu'
            ? await runCariTamu(args)
            : { error: 'Tool tidak dikenal' };
        } catch (err) {
          result = { error: `Gagal memproses permintaan tool: ${err.message}` };
        }
        messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
      }
      toolsUsed += 1;
      continue;
    }

    finalReply = (msg && msg.content || '').trim();
    break;
  }

  if (!finalReply) {
    // Beberapa model (terutama tier gratis) kadang mengembalikan HTTP 200 tanpa
    // isi balasan yang valid saat sedang sibuk/tidak stabil -- jangan tampilkan
    // bubble kosong, beri tahu penggunanya secara eksplisit.
    return res.status(502).json({
      error: 'Model AI tidak memberikan balasan (kemungkinan model sedang sibuk/tidak stabil, umum terjadi pada model gratis). Coba lagi, atau ganti model di menu Konfigurasi AI.',
    });
  }

  await logAudit(req.user.sub, 'ai_chat_query', 'ai_chat', null, {
    message: message.trim().slice(0, 500), model: usedModel, provider, fallback_used: switchedToLocal, used_tool: toolsUsed > 0,
  });

  res.json({ data: { reply: finalReply, model: usedModel, provider, fallback_used: switchedToLocal } });
}));

module.exports = router;
