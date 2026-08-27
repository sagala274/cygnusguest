const express = require('express');
const pool = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { logAudit } = require('../utils/audit');
const { getAiSettings, encrypt, VALID_MODELS } = require('../utils/aiSettings');

const router = express.Router();
router.use(authenticate, requireRole('admin'));

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

  if (model !== undefined && !VALID_MODELS.includes(model)) {
    return res.status(400).json({ error: 'Model tidak valid' });
  }

  const fields = [];
  const params = {};
  if (model !== undefined) { fields.push('model = :model'); params.model = model; }
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

module.exports = router;
