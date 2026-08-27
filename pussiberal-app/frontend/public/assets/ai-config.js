requireAuth();
requireRole('admin');
renderNav('ai-config.html');

const resultBox = document.getElementById('resultBox');
const form = document.getElementById('aiConfigForm');
const apiKeyStatusCallout = document.getElementById('apiKeyStatusCallout');
const apiKeyStatusLabel = document.getElementById('apiKeyStatusLabel');
const apiKeyStatusText = document.getElementById('apiKeyStatusText');
const modelInput = document.getElementById('model');
const modelOptions = document.getElementById('modelOptions');
const modelHint = document.getElementById('modelHint');

let models = [];

function showMessage(message, isError) {
  resultBox.style.display = 'block';
  resultBox.textContent = message;
  resultBox.classList.toggle('error-box', !!isError);
}

function renderApiKeyStatus(hasApiKey) {
  apiKeyStatusCallout.classList.toggle('warn', !hasApiKey);
  apiKeyStatusLabel.textContent = hasApiKey ? 'API Key Terpasang' : 'API Key Belum Diatur';
  apiKeyStatusText.textContent = hasApiKey
    ? 'AI Chat siap digunakan. Isi field API Key di bawah hanya jika ingin menggantinya.'
    : 'AI Chat belum bisa digunakan sampai API key OpenRouter diisi dan disimpan di bawah.';
}

function formatPrice(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  if (value === 0) return 'gratis';
  return `$${value.toFixed(2)}/1M token`;
}

const DEFAULT_MODEL_HINT = 'Ketik untuk mencari dari katalog OpenRouter, atau isi manual format "vendor/model".';

function updateModelHint() {
  const found = models.find((m) => m.id === modelInput.value.trim());
  if (!found) {
    modelHint.textContent = DEFAULT_MODEL_HINT;
    return;
  }
  const parts = [found.name];
  const promptPrice = formatPrice(found.prompt_price_per_million);
  const completionPrice = formatPrice(found.completion_price_per_million);
  if (promptPrice || completionPrice) parts.push(`in: ${promptPrice || '-'}, out: ${completionPrice || '-'}`);
  if (found.context_length) parts.push(`konteks: ${found.context_length.toLocaleString('id-ID')} token`);
  modelHint.textContent = parts.join(' • ');
}

async function loadModels() {
  try {
    const res = await api('/ai-settings/models');
    models = res.data;
    modelOptions.innerHTML = models
      .map((m) => `<option value="${escapeHtml(m.id)}">${escapeHtml(m.name)}</option>`)
      .join('');
    updateModelHint();
  } catch (err) {
    modelHint.textContent = 'Gagal memuat daftar model dari OpenRouter, Anda tetap bisa mengetik ID model secara manual.';
  }
}

async function load() {
  try {
    const res = await api('/ai-settings');
    modelInput.value = res.data.model;
    document.getElementById('systemPrompt').value = res.data.system_prompt || '';
    renderApiKeyStatus(res.data.has_api_key);
    updateModelHint();
  } catch (err) {
    showMessage(err.message, true);
  }
}

modelInput.addEventListener('input', updateModelHint);

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  resultBox.style.display = 'none';

  const payload = {
    model: modelInput.value.trim(),
    system_prompt: document.getElementById('systemPrompt').value.trim(),
  };
  const apiKey = document.getElementById('apiKey').value.trim();
  if (apiKey) payload.api_key = apiKey;

  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  try {
    const res = await api('/ai-settings', { method: 'PUT', body: JSON.stringify(payload) });
    document.getElementById('apiKey').value = '';
    renderApiKeyStatus(res.data.has_api_key);
    showMessage('Konfigurasi AI berhasil disimpan.', false);
  } catch (err) {
    showMessage(err.message, true);
  } finally {
    submitBtn.disabled = false;
  }
});

loadModels();
load();
