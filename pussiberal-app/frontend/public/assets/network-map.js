requireAuth();
requireRole('admin', 'verifikator', 'pimpinan');
renderNav('network-map');

// Pimpinan hanya boleh MELIHAT pemetaan -- tidak boleh membuat, mengganti
// nama, atau menghapus.
const user = getUser();
const canEditDiagrams = user && ['admin', 'verifikator'].includes(user.role);
if (!canEditDiagrams) {
  document.getElementById('createBtn').style.display = 'none';
}

const tbody = document.getElementById('diagramTableBody');
const resultBox = document.getElementById('resultBox');

function showMessage(message, isError) {
  resultBox.style.display = 'block';
  resultBox.textContent = message;
  resultBox.classList.toggle('error-box', !!isError);
}

async function load() {
  tbody.innerHTML = `<tr><td colspan="4">Memuat data...</td></tr>`;
  try {
    const res = await api('/network-diagrams');
    if (!res.data.length) {
      tbody.innerHTML = `<tr><td colspan="4">Belum ada pemetaan hubungan. Klik "+ Buat Pemetaan Baru" untuk memulai.</td></tr>`;
      return;
    }

    tbody.innerHTML = res.data
      .map(
        (d) => `
      <tr>
        <td><a class="link" href="network-map-editor?id=${d.id}">${escapeHtml(d.name)}</a></td>
        <td>${formatDateTime(d.updated_at)}</td>
        <td>${escapeHtml(d.updated_by_name || d.created_by_name || '-')}</td>
        <td>
          <a class="btn btn-small" href="network-map-editor?id=${d.id}">Buka</a>
          ${canEditDiagrams ? `<button type="button" class="btn btn-small rename-btn" data-id="${d.id}" data-name="${escapeHtml(d.name)}" style="margin-left:6px;">Ganti Nama</button>
          <button type="button" class="btn btn-small btn-danger delete-btn" data-id="${d.id}" data-name="${escapeHtml(d.name)}" style="margin-left:6px;">Hapus</button>` : ''}
        </td>
      </tr>
    `
      )
      .join('');

    document.querySelectorAll('.rename-btn').forEach((btn) => {
      btn.addEventListener('click', () => renameDiagram(btn.dataset.id, btn.dataset.name));
    });
    document.querySelectorAll('.delete-btn').forEach((btn) => {
      btn.addEventListener('click', () => deleteDiagram(btn.dataset.id, btn.dataset.name));
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4">${escapeHtml(err.message)}</td></tr>`;
  }
}

document.getElementById('createBtn').addEventListener('click', async () => {
  resultBox.style.display = 'none';
  const name = prompt('Nama pemetaan (mis. "Jaringan PT ABC"):');
  if (name === null) return;
  if (!name.trim()) {
    showMessage('Nama pemetaan tidak boleh kosong.', true);
    return;
  }
  try {
    const res = await api('/network-diagrams', { method: 'POST', body: JSON.stringify({ name: name.trim() }) });
    window.location.href = `network-map-editor?id=${res.data.id}`;
  } catch (err) {
    showMessage(err.message, true);
  }
});

async function renameDiagram(id, oldName) {
  resultBox.style.display = 'none';
  const newName = prompt('Ganti nama pemetaan menjadi:', oldName);
  if (newName === null) return;
  if (!newName.trim()) {
    showMessage('Nama pemetaan tidak boleh kosong.', true);
    return;
  }
  try {
    await api(`/network-diagrams/${id}`, { method: 'PUT', body: JSON.stringify({ name: newName.trim() }) });
    showMessage('Nama pemetaan berhasil diubah.', false);
    load();
  } catch (err) {
    showMessage(err.message, true);
  }
}

async function deleteDiagram(id, name) {
  resultBox.style.display = 'none';
  if (!confirm(`Hapus pemetaan "${name}" secara permanen? Tindakan ini tidak bisa dibatalkan.`)) return;
  try {
    await api(`/network-diagrams/${id}`, { method: 'DELETE' });
    showMessage(`Pemetaan "${name}" berhasil dihapus.`, false);
    load();
  } catch (err) {
    showMessage(err.message, true);
  }
}

load();
