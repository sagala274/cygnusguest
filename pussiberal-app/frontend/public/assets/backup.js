requireAuth();
requireRole('admin');
renderNav('backup.html');

const resultBox = document.getElementById('resultBox');

function showMessage(message, isError) {
  resultBox.style.display = 'block';
  resultBox.textContent = message;
  resultBox.classList.toggle('error-box', !!isError);
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`;
}

function rowsHTML(type, files) {
  if (!files.length) {
    return '<tr><td colspan="4">Belum ada backup.</td></tr>';
  }
  return files
    .map(
      (f) => `
    <tr>
      <td>${escapeHtml(f.filename)}</td>
      <td>${formatBytes(f.size)}</td>
      <td>${formatDateTime(f.created_at)}</td>
      <td><button class="btn btn-small download-backup-btn" data-type="${type}" data-filename="${escapeHtml(f.filename)}">Unduh</button></td>
    </tr>
  `
    )
    .join('');
}

async function load() {
  try {
    const res = await api('/backups');
    document.getElementById('dailyTableBody').innerHTML = rowsHTML('daily', res.data.daily);
    document.getElementById('weeklyTableBody').innerHTML = rowsHTML('weekly', res.data.weekly);
    document.getElementById('monthlyTableBody').innerHTML = rowsHTML('monthly', res.data.monthly);

    document.querySelectorAll('.download-backup-btn').forEach((btn) => {
      btn.addEventListener('click', () => downloadBackup(btn.dataset.type, btn.dataset.filename));
    });
  } catch (err) {
    showMessage(err.message, true);
  }
}

async function downloadBackup(type, filename) {
  resultBox.style.display = 'none';
  try {
    await downloadFile(`/backups/${type}/${encodeURIComponent(filename)}/download`, filename);
  } catch (err) {
    showMessage(err.message, true);
  }
}

document.querySelectorAll('.run-backup-btn').forEach((btn) => {
  btn.addEventListener('click', async () => {
    resultBox.style.display = 'none';
    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = 'Memproses...';
    try {
      const res = await api('/backups/run', { method: 'POST', body: JSON.stringify({ type: btn.dataset.type }) });
      showMessage(`Backup berhasil dibuat: ${res.data.filename}`, false);
      load();
    } catch (err) {
      showMessage(err.message, true);
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  });
});

load();
