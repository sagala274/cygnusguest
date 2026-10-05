requireAuth();
requireRole('admin');
renderNav('ai-config');

const resultBox = document.getElementById('resultBox');
const form = document.getElementById('aiConfigForm');
const apiKeyStatusCallout = document.getElementById('apiKeyStatusCallout');
const apiKeyStatusLabel = document.getElementById('apiKeyStatusLabel');
const apiKeyStatusText = document.getElementById('apiKeyStatusText');
const modelInput = document.getElementById('model');
const modelOptions = document.getElementById('modelOptions');
const modelHint = document.getElementById('modelHint');
const googleSearchForm = document.getElementById('googleSearchForm');
const searchKeyStatusCallout = document.getElementById('searchKeyStatusCallout');
const searchKeyStatusLabel = document.getElementById('searchKeyStatusLabel');
const searchKeyStatusText = document.getElementById('searchKeyStatusText');
const googleSearchCxInput = document.getElementById('googleSearchCx');
const removeGoogleSearchBtn = document.getElementById('removeGoogleSearchBtn');
const ollamaForm = document.getElementById('ollamaForm');
const ollamaStatusCallout = document.getElementById('ollamaStatusCallout');
const ollamaStatusLabel = document.getElementById('ollamaStatusLabel');
const ollamaStatusText = document.getElementById('ollamaStatusText');
const ollamaBaseUrlInput = document.getElementById('ollamaBaseUrl');
const ollamaModelInput = document.getElementById('ollamaModel');
const removeOllamaBtn = document.getElementById('removeOllamaBtn');

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

function renderSearchKeyStatus(hasKey, cx) {
  const ready = hasKey && !!cx;
  searchKeyStatusCallout.classList.toggle('warn', !ready);
  searchKeyStatusLabel.textContent = ready ? 'Pencarian Profil Publik Aktif' : 'Pencarian Profil Publik Belum Diatur';
  searchKeyStatusText.textContent = ready
    ? 'AI Chat bisa mencari informasi publik tamu. Isi field di bawah hanya jika ingin menggantinya.'
    : 'Isi API key dan Search Engine ID (cx) di bawah untuk mengaktifkan fitur pencarian profil publik.';
}

function renderOllamaStatus(baseUrl, model) {
  const ready = !!baseUrl && !!model;
  ollamaStatusCallout.classList.toggle('warn', !ready);
  ollamaStatusLabel.textContent = ready ? 'Cadangan AI Lokal Aktif' : 'Cadangan AI Lokal Belum Diatur';
  ollamaStatusText.textContent = ready
    ? `AI Chat otomatis beralih ke "${model}" di ${baseUrl} kalau kredit OpenRouter habis. Isi field di bawah hanya jika ingin menggantinya.`
    : 'Isi URL server dan nama model di bawah untuk mengaktifkan cadangan otomatis saat kredit OpenRouter habis.';
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
    renderSearchKeyStatus(res.data.has_google_search_api_key, res.data.google_search_cx);
    googleSearchCxInput.value = res.data.google_search_cx || '';
    renderOllamaStatus(res.data.ollama_base_url, res.data.ollama_model);
    ollamaBaseUrlInput.value = res.data.ollama_base_url || '';
    ollamaModelInput.value = res.data.ollama_model || '';
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

googleSearchForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  resultBox.style.display = 'none';

  const payload = { google_search_cx: googleSearchCxInput.value.trim() };
  const searchApiKey = document.getElementById('googleSearchApiKey').value.trim();
  if (searchApiKey) payload.google_search_api_key = searchApiKey;

  const submitBtn = googleSearchForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  try {
    const res = await api('/ai-settings', { method: 'PUT', body: JSON.stringify(payload) });
    document.getElementById('googleSearchApiKey').value = '';
    renderSearchKeyStatus(res.data.has_google_search_api_key, res.data.google_search_cx);
    showMessage('Kredensial pencarian profil publik berhasil disimpan.', false);
  } catch (err) {
    showMessage(err.message, true);
  } finally {
    submitBtn.disabled = false;
  }
});

removeGoogleSearchBtn.addEventListener('click', async () => {
  if (!confirm('Hapus kredensial Google Custom Search? Fitur pencarian profil publik di AI Chat akan nonaktif sampai diisi ulang.')) return;
  resultBox.style.display = 'none';

  removeGoogleSearchBtn.disabled = true;
  try {
    const res = await api('/ai-settings/google-search', { method: 'DELETE' });
    document.getElementById('googleSearchApiKey').value = '';
    googleSearchCxInput.value = '';
    renderSearchKeyStatus(res.data.has_google_search_api_key, res.data.google_search_cx);
    showMessage('Kredensial pencarian profil publik berhasil dihapus.', false);
  } catch (err) {
    showMessage(err.message, true);
  } finally {
    removeGoogleSearchBtn.disabled = false;
  }
});

ollamaForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  resultBox.style.display = 'none';

  const payload = {
    ollama_base_url: ollamaBaseUrlInput.value.trim(),
    ollama_model: ollamaModelInput.value.trim(),
  };
  const ollamaApiKey = document.getElementById('ollamaApiKey').value.trim();
  if (ollamaApiKey) payload.ollama_api_key = ollamaApiKey;

  const submitBtn = ollamaForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  try {
    const res = await api('/ai-settings', { method: 'PUT', body: JSON.stringify(payload) });
    document.getElementById('ollamaApiKey').value = '';
    renderOllamaStatus(res.data.ollama_base_url, res.data.ollama_model);
    showMessage('Konfigurasi AI lokal berhasil disimpan.', false);
  } catch (err) {
    showMessage(err.message, true);
  } finally {
    submitBtn.disabled = false;
  }
});

removeOllamaBtn.addEventListener('click', async () => {
  if (!confirm('Hapus konfigurasi AI lokal (Ollama)? Cadangan otomatis saat kredit OpenRouter habis akan nonaktif sampai diisi ulang.')) return;
  resultBox.style.display = 'none';

  removeOllamaBtn.disabled = true;
  try {
    const res = await api('/ai-settings/ollama', { method: 'DELETE' });
    document.getElementById('ollamaApiKey').value = '';
    ollamaBaseUrlInput.value = '';
    ollamaModelInput.value = '';
    renderOllamaStatus(res.data.ollama_base_url, res.data.ollama_model);
    showMessage('Konfigurasi AI lokal berhasil dihapus.', false);
  } catch (err) {
    showMessage(err.message, true);
  } finally {
    removeOllamaBtn.disabled = false;
  }
});

loadModels();
load();
