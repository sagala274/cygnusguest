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
    has_google_search_api_key: !!settings.google_search_api_key_encrypted,
    google_search_cx: settings.google_search_cx || '',
    ollama_base_url: settings.ollama_base_url || '',
    ollama_model: settings.ollama_model || '',
    has_ollama_api_key: !!settings.ollama_api_key_encrypted,
    ollama_enabled: !!settings.ollama_enabled,
    routing_mode: settings.routing_mode || 'auto',
    updated_at: settings.updated_at,
  };
}

const ROUTING_MODES = ['auto', 'openrouter', 'ollama'];

router.get('/', asyncHandler(async (req, res) => {
  const settings = await getAiSettings();
  res.json({ data: toPublicSettings(settings) });
}));

const OLLAMA_URL_PATTERN = /^https?:\/\/.+/i;

router.put('/', asyncHandler(async (req, res) => {
  const {
    model, system_prompt, api_key, google_search_api_key, google_search_cx,
    ollama_base_url, ollama_model, ollama_api_key, ollama_enabled, routing_mode,
  } = req.body || {};

  if (model !== undefined && (typeof model !== 'string' || !MODEL_ID_PATTERN.test(model.trim()))) {
    return res.status(400).json({ error: 'Format model tidak valid. Gunakan format "vendor/model" sesuai katalog OpenRouter.' });
  }
  if (google_search_cx !== undefined && typeof google_search_cx === 'string' && google_search_cx.trim().length > 100) {
    return res.status(400).json({ error: 'Search Engine ID (cx) terlalu panjang.' });
  }
  if (ollama_base_url !== undefined && typeof ollama_base_url === 'string' && ollama_base_url.trim() && !OLLAMA_URL_PATTERN.test(ollama_base_url.trim())) {
    return res.status(400).json({ error: 'URL server Ollama tidak valid. Harus diawali http:// atau https://.' });
  }
  if (routing_mode !== undefined && !ROUTING_MODES.includes(routing_mode)) {
    return res.status(400).json({ error: 'Mode routing AI tidak valid.' });
  }

  const fields = [];
  const params = {};
  if (model !== undefined) { fields.push('model = :model'); params.model = model.trim(); }
  if (system_prompt !== undefined) { fields.push('system_prompt = :system_prompt'); params.system_prompt = system_prompt || null; }
  if (typeof api_key === 'string' && api_key.trim()) {
    fields.push('api_key_encrypted = :api_key_encrypted');
    params.api_key_encrypted = encrypt(api_key.trim());
  }
  if (typeof google_search_api_key === 'string' && google_search_api_key.trim()) {
    fields.push('google_search_api_key_encrypted = :google_search_api_key_encrypted');
    params.google_search_api_key_encrypted = encrypt(google_search_api_key.trim());
  }
  if (google_search_cx !== undefined) {
    fields.push('google_search_cx = :google_search_cx');
    params.google_search_cx = (google_search_cx || '').trim() || null;
  }
  if (ollama_base_url !== undefined) {
    fields.push('ollama_base_url = :ollama_base_url');
    params.ollama_base_url = (ollama_base_url || '').trim().replace(/\/+$/, '') || null;
  }
  if (ollama_model !== undefined) {
    fields.push('ollama_model = :ollama_model');
    params.ollama_model = (ollama_model || '').trim() || null;
  }
  if (typeof ollama_api_key === 'string' && ollama_api_key.trim()) {
    fields.push('ollama_api_key_encrypted = :ollama_api_key_encrypted');
    params.ollama_api_key_encrypted = encrypt(ollama_api_key.trim());
  }
  if (ollama_enabled !== undefined) {
    fields.push('ollama_enabled = :ollama_enabled');
    params.ollama_enabled = ollama_enabled ? 1 : 0;
  }
  if (routing_mode !== undefined) {
    fields.push('routing_mode = :routing_mode');
    params.routing_mode = routing_mode;
  }
  fields.push('updated_by = :updated_by');
  params.updated_by = req.user.sub;

  await pool.execute(`UPDATE ai_settings SET ${fields.join(', ')} WHERE id = 1`, params);
  await logAudit(req.user.sub, 'update_ai_settings', 'ai_settings', null, {
    model,
    system_prompt_changed: system_prompt !== undefined,
    api_key_changed: typeof api_key === 'string' && !!api_key.trim(),
    google_search_api_key_changed: typeof google_search_api_key === 'string' && !!google_search_api_key.trim(),
    google_search_cx_changed: google_search_cx !== undefined,
    ollama_base_url_changed: ollama_base_url !== undefined,
    ollama_model_changed: ollama_model !== undefined,
    ollama_api_key_changed: typeof ollama_api_key === 'string' && !!ollama_api_key.trim(),
    ollama_enabled_changed: ollama_enabled !== undefined,
    routing_mode_changed: routing_mode !== undefined,
  });

  const settings = await getAiSettings();
  res.json({ data: toPublicSettings(settings) });
}));

router.delete('/google-search', asyncHandler(async (req, res) => {
  await pool.execute(
    `UPDATE ai_settings SET google_search_api_key_encrypted = NULL, google_search_cx = NULL, updated_by = :updated_by WHERE id = 1`,
    { updated_by: req.user.sub }
  );
  await logAudit(req.user.sub, 'clear_ai_google_search_settings', 'ai_settings', null, {});

  const settings = await getAiSettings();
  res.json({ data: toPublicSettings(settings) });
}));

router.delete('/ollama', asyncHandler(async (req, res) => {
  // Kalau mode routing sedang dipaksa "ollama", turunkan ke "auto" dulu --
  // kalau tidak, AI Chat akan berhenti total begitu konfigurasinya dihapus.
  await pool.execute(
    `UPDATE ai_settings SET
       ollama_base_url = NULL, ollama_model = NULL, ollama_api_key_encrypted = NULL,
       routing_mode = IF(routing_mode = 'ollama', 'auto', routing_mode),
       updated_by = :updated_by
     WHERE id = 1`,
    { updated_by: req.user.sub }
  );
  await logAudit(req.user.sub, 'clear_ai_ollama_settings', 'ai_settings', null, {});

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
