const pool = require('../db');
const { encrypt, decrypt } = require('./crypto');

const DEFAULT_MODEL = 'anthropic/claude-opus-5';

async function columnExists(table, column) {
  const [rows] = await pool.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table AND COLUMN_NAME = :column`,
    { table, column }
  );
  return rows.length > 0;
}

async function ensureAiSettingsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_settings (
      id TINYINT PRIMARY KEY DEFAULT 1,
      provider VARCHAR(50) NOT NULL DEFAULT 'openrouter',
      model VARCHAR(150) NOT NULL DEFAULT '${DEFAULT_MODEL}',
      api_key_encrypted TEXT NULL,
      system_prompt TEXT NULL,
      updated_by INT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT chk_ai_settings_singleton CHECK (id = 1)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await pool.query(
    `INSERT INTO ai_settings (id, provider, model) VALUES (1, 'openrouter', '${DEFAULT_MODEL}')
     ON DUPLICATE KEY UPDATE id = id`
  );
  // Migrasi ringan: instalasi lama pernah diset ke provider Anthropic langsung
  // (model tanpa prefix vendor, mis. "claude-opus-5"). Hanya diperbaiki jika
  // belum pernah dikonfigurasi API key-nya, agar tidak menimpa konfigurasi nyata.
  await pool.query(`
    UPDATE ai_settings SET provider = 'openrouter', model = '${DEFAULT_MODEL}'
    WHERE id = 1 AND api_key_encrypted IS NULL AND model NOT LIKE '%/%'
  `);

  // Kredensial Google Custom Search JSON API, dipakai tool pencarian profil
  // publik tamu di AI Chat -- disimpan terpisah dari api_key OpenRouter.
  if (!(await columnExists('ai_settings', 'google_search_api_key_encrypted'))) {
    await pool.query('ALTER TABLE ai_settings ADD COLUMN google_search_api_key_encrypted TEXT NULL AFTER api_key_encrypted');
  }
  if (!(await columnExists('ai_settings', 'google_search_cx'))) {
    await pool.query('ALTER TABLE ai_settings ADD COLUMN google_search_cx VARCHAR(100) NULL AFTER google_search_api_key_encrypted');
  }

  // Konfigurasi AI lokal (Ollama) -- dipakai sebagai CADANGAN OTOMATIS saat
  // OpenRouter kehabisan kredit/kuota (lihat logika routing di aiChat.js).
  // Tidak wajib diisi; kalau kosong, sistem tetap hanya memakai OpenRouter.
  if (!(await columnExists('ai_settings', 'ollama_base_url'))) {
    await pool.query('ALTER TABLE ai_settings ADD COLUMN ollama_base_url VARCHAR(255) NULL AFTER google_search_cx');
  }
  if (!(await columnExists('ai_settings', 'ollama_model'))) {
    await pool.query('ALTER TABLE ai_settings ADD COLUMN ollama_model VARCHAR(150) NULL AFTER ollama_base_url');
  }
  if (!(await columnExists('ai_settings', 'ollama_api_key_encrypted'))) {
    await pool.query('ALTER TABLE ai_settings ADD COLUMN ollama_api_key_encrypted TEXT NULL AFTER ollama_model');
  }
  // Saklar aktif/nonaktif AI lokal -- terpisah dari isi URL/model, supaya
  // admin bisa mematikan sementara tanpa menghapus konfigurasinya.
  if (!(await columnExists('ai_settings', 'ollama_enabled'))) {
    await pool.query('ALTER TABLE ai_settings ADD COLUMN ollama_enabled TINYINT(1) NOT NULL DEFAULT 1 AFTER ollama_api_key_encrypted');
  }
  // Mode routing: 'auto' (default, otomatis beralih ke AI lokal saat kredit
  // OpenRouter habis), 'openrouter' (paksa OpenRouter saja, tidak pernah
  // beralih), 'ollama' (paksa AI lokal saja, OpenRouter tidak dipanggil).
  if (!(await columnExists('ai_settings', 'routing_mode'))) {
    await pool.query("ALTER TABLE ai_settings ADD COLUMN routing_mode ENUM('auto','openrouter','ollama') NOT NULL DEFAULT 'auto' AFTER ollama_enabled");
  }
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

async function getDecryptedGoogleSearchApiKey() {
  const settings = await getAiSettings();
  if (!settings || !settings.google_search_api_key_encrypted) return null;
  return decrypt(settings.google_search_api_key_encrypted);
}

async function getDecryptedOllamaApiKey() {
  const settings = await getAiSettings();
  if (!settings || !settings.ollama_api_key_encrypted) return null;
  return decrypt(settings.ollama_api_key_encrypted);
}

module.exports = {
  ensureAiSettingsTable,
  getAiSettings,
  getDecryptedApiKey,
  getDecryptedGoogleSearchApiKey,
  getDecryptedOllamaApiKey,
  encrypt,
  DEFAULT_MODEL,
};
