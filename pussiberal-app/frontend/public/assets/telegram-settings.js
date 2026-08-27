requireAuth();
requireRole('admin');
renderNav('telegram-settings.html');

const resultBox = document.getElementById('resultBox');
const form = document.getElementById('telegramConfigForm');
const statusCallout = document.getElementById('statusCallout');
const statusLabel = document.getElementById('statusLabel');
const statusText = document.getElementById('statusText');
const useDetectedBtn = document.getElementById('useDetectedBtn');
const chatIdInput = document.getElementById('chatId');
const testBtn = document.getElementById('testBtn');

let lastData = null;

function showMessage(message, isError) {
  resultBox.style.display = 'block';
  resultBox.textContent = message;
  resultBox.classList.toggle('error-box', !!isError);
}

function renderStatus(data) {
  const parts = [];
  if (!data.has_bot_token) {
    statusCallout.classList.add('warn');
    statusLabel.textContent = 'Bot Belum Dikonfigurasi';
    parts.push('Isi Bot Token terlebih dahulu sesuai langkah setup di atas.');
  } else if (!data.bot_connection_ok) {
    statusCallout.classList.add('warn');
    statusLabel.textContent = 'Bot Token Tidak Valid';
    parts.push('Bot Token tersimpan tapi gagal terhubung ke Telegram. Periksa kembali tokennya.');
  } else if (!data.chat_id) {
    statusCallout.classList.add('warn');
    statusLabel.textContent = `Bot @${data.bot_username} Terhubung — Chat ID Belum Diisi`;
    parts.push('Kirim /start ke bot di Telegram, lalu isi Chat ID (atau gunakan tombol deteksi otomatis jika muncul).');
  } else {
    statusCallout.classList.remove('warn');
    statusLabel.textContent = `Aktif — Bot @${data.bot_username}`;
    parts.push(`Notifikasi akan dikirim ke Chat ID ${data.chat_id}.`);
  }
  statusText.textContent = parts.join(' ');

  if (data.detected_chat_id && data.detected_chat_id !== data.chat_id) {
    useDetectedBtn.style.display = 'inline-block';
    useDetectedBtn.textContent = `Gunakan Chat Terdeteksi (${data.detected_chat_name || data.detected_chat_id})`;
  } else {
    useDetectedBtn.style.display = 'none';
  }
}

async function load() {
  try {
    const res = await api('/telegram-settings');
    lastData = res.data;
    chatIdInput.value = res.data.chat_id || '';
    document.getElementById('notifyRegistration').checked = res.data.notify_new_registration;
    document.getElementById('notifyLogin').checked = res.data.notify_login;
    renderStatus(res.data);
  } catch (err) {
    showMessage(err.message, true);
  }
}

useDetectedBtn.addEventListener('click', () => {
  if (lastData && lastData.detected_chat_id) {
    chatIdInput.value = lastData.detected_chat_id;
  }
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  resultBox.style.display = 'none';

  const payload = {
    chat_id: chatIdInput.value.trim(),
    notify_new_registration: document.getElementById('notifyRegistration').checked,
    notify_login: document.getElementById('notifyLogin').checked,
  };
  const botToken = document.getElementById('botToken').value.trim();
  if (botToken) payload.bot_token = botToken;

  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  try {
    const res = await api('/telegram-settings', { method: 'PUT', body: JSON.stringify(payload) });
    document.getElementById('botToken').value = '';
    lastData = res.data;
    renderStatus(res.data);
    showMessage('Konfigurasi Telegram berhasil disimpan.', false);
  } catch (err) {
    showMessage(err.message, true);
  } finally {
    submitBtn.disabled = false;
  }
});

testBtn.addEventListener('click', async () => {
  resultBox.style.display = 'none';
  testBtn.disabled = true;
  const originalText = testBtn.textContent;
  testBtn.textContent = 'Mengirim...';
  try {
    await api('/telegram-settings/test', { method: 'POST' });
    showMessage('Pesan tes berhasil dikirim, cek Telegram Anda.', false);
  } catch (err) {
    showMessage(err.message, true);
  } finally {
    testBtn.disabled = false;
    testBtn.textContent = originalText;
  }
});

load();
