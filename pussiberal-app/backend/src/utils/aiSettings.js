const pool = require('../db');
const { encrypt, decrypt } = require('./crypto');

const VALID_MODELS = ['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5'];
const DEFAULT_MODEL = 'claude-opus-5';

async function ensureAiSettingsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_settings (
      id TINYINT PRIMARY KEY DEFAULT 1,
      provider VARCHAR(50) NOT NULL DEFAULT 'anthropic',
      model VARCHAR(100) NOT NULL DEFAULT '${DEFAULT_MODEL}',
      api_key_encrypted TEXT NULL,
      system_prompt TEXT NULL,
      updated_by INT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT chk_ai_settings_singleton CHECK (id = 1)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await pool.query(
    `INSERT INTO ai_settings (id, provider, model) VALUES (1, 'anthropic', '${DEFAULT_MODEL}')
     ON DUPLICATE KEY UPDATE id = id`
  );
}

async function getAiSettings() {
  const [rows] = await pool.query('SELECT * FROM ai_settings WHERE id = 1');
  return rows[0] || null;
}

async function getDecryptedApiKey() {
  const settings = await getAiSettings();
  if (!settings || !settings.api_key_encrypted) return null;
  return decrypt(settings.api_key_encrypted);
}

module.exports = { ensureAiSettingsTable, getAiSettings, getDecryptedApiKey, encrypt, VALID_MODELS, DEFAULT_MODEL };
