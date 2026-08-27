const express = require('express');
const pool = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { logAudit } = require('../utils/audit');
const { getAiSettings, encrypt } = require('../utils/aiSettings');

const router = express.Router();
router.use(authenticate, requireRole('admin'));

const MODEL_ID_PATTERN = /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._:-]+$/;

function toPublicSettings(settings) {
  const hasApiKey = !!settings.api_key_encrypted;
  return {
    provider: settings.provider,
    model: settings.model,
    system_prompt: settings.system_prompt,
    has_api_key: hasApiKey,
    updated_at: settings.updated_at,
  };
}

router.get('/', asyncHandler(async (req, res) => {
  const settings = await getAiSettings();
  res.json({ data: toPublicSettings(settings) });
}));

router.put('/', asyncHandler(async (req, res) => {
  const { model, system_prompt, api_key } = req.body || {};

  if (model !== undefined && (typeof model !== 'string' || !MODEL_ID_PATTERN.test(model.trim()))) {
    return res.status(400).json({ error: 'Format model tidak valid. Gunakan format "vendor/model" sesuai katalog OpenRouter.' });
  }

  const fields = [];
  const params = {};
  if (model !== undefined) { fields.push('model = :model'); params.model = model.trim(); }
  if (system_prompt !== undefined) { fields.push('system_prompt = :system_prompt'); params.system_prompt = system_prompt || null; }
  if (typeof api_key === 'string' && api_key.trim()) {
    fields.push('api_key_encrypted = :api_key_encrypted');
    params.api_key_encrypted = encrypt(api_key.trim());
  }
  fields.push('updated_by = :updated_by');
  params.updated_by = req.user.sub;

  await pool.execute(`UPDATE ai_settings SET ${fields.join(', ')} WHERE id = 1`, params);
  await logAudit(req.user.sub, 'update_ai_settings', 'ai_settings', null, {
    model,
    system_prompt_changed: system_prompt !== undefined,
    api_key_changed: typeof api_key === 'string' && !!api_key.trim(),
  });

  const settings = await getAiSettings();
  res.json({ data: toPublicSettings(settings) });
}));

// Katalog model OpenRouter bersifat publik (tidak perlu API key) -- di-cache
// singkat di memori supaya halaman Konfigurasi AI tidak memanggil OpenRouter
// setiap kali dibuka.
let modelsCache = { data: null, fetchedAt: 0 };
const MODELS_CACHE_TTL_MS = 10 * 60 * 1000;

router.get('/models', asyncHandler(async (req, res) => {
  const now = Date.now();
  if (modelsCache.data && now - modelsCache.fetchedAt < MODELS_CACHE_TTL_MS) {
    return res.json({ data: modelsCache.data });
  }

  let response;
  try {
    response = await fetch('https://openrouter.ai/api/v1/models');
  } catch (err) {
    return res.status(502).json({ error: 'Gagal menghubungi OpenRouter untuk mengambil daftar model.' });
  }
  if (!response.ok) {
    return res.status(502).json({ error: `OpenRouter mengembalikan kesalahan (${response.status}) saat mengambil daftar model.` });
  }

  const body = await response.json();
  const models = (body.data || [])
    .map((m) => ({
      id: m.id,
      name: m.name,
      context_length: m.context_length,
      prompt_price_per_million: m.pricing ? Number(m.pricing.prompt) * 1000000 : null,
      completion_price_per_million: m.pricing ? Number(m.pricing.completion) * 1000000 : null,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  modelsCache = { data: models, fetchedAt: now };
  res.json({ data: models });
}));

module.exports = router;
