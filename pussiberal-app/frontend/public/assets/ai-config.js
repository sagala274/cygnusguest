requireAuth();
requireRole('admin');
renderNav('ai-config.html');

const resultBox = document.getElementById('resultBox');
const form = document.getElementById('aiConfigForm');
const apiKeyStatusCallout = document.getElementById('apiKeyStatusCallout');
const apiKeyStatusLabel = document.getElementById('apiKeyStatusLabel');
const apiKeyStatusText = document.getElementById('apiKeyStatusText');

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
    : 'AI Chat belum bisa digunakan sampai API key Anthropic diisi dan disimpan di bawah.';
}

async function load() {
  try {
    const res = await api('/ai-settings');
    document.getElementById('model').value = res.data.model;
    document.getElementById('systemPrompt').value = res.data.system_prompt || '';
    renderApiKeyStatus(res.data.has_api_key);
  } catch (err) {
    showMessage(err.message, true);
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  resultBox.style.display = 'none';

  const payload = {
    model: document.getElementById('model').value,
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

load();
