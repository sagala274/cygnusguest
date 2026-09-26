requireAuth();
requireRole('admin', 'verifikator');
renderNav('personnel-list');

const searchInput = document.getElementById('searchInput');
const showInactiveCheck = document.getElementById('showInactiveCheck');
const tbody = document.getElementById('personnelTableBody');
const resultBox = document.getElementById('resultBox');

document.getElementById('searchIconSlot').innerHTML = icon('search');
document.getElementById('closeIconSlot').innerHTML = icon('close');

let allRows = [];
let editingId = null;

function showMessage(message, isError) {
  resultBox.style.display = 'block';
  resultBox.textContent = message;
  resultBox.classList.toggle('error-box', !!isError);
}

function statusBadgeHtml(isActive) {
  return isActive
    ? '<span class="badge badge-green">Aktif</span>'
    : '<span class="badge badge-gray">Nonaktif</span>';
}

function matchesSearch(p, q) {
  if (!q) return true;
  const haystack = `${p.full_name} ${p.position} ${p.category} ${p.rank_info || ''}`.toLowerCase();
  return haystack.includes(q.toLowerCase());
}

function render() {
  const q = searchInput.value.trim();
  const filtered = allRows.filter((p) => (showInactiveCheck.checked || p.is_active) && matchesSearch(p, q));

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="8">Tidak ada data personel ditemukan.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered
    .map(
      (p, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${escapeHtml(p.full_name)}</td>
      <td>${escapeHtml(p.rank_info || '-')}</td>
      <td>${escapeHtml(p.position)}</td>
      <td>${escapeHtml(p.category)}</td>
      <td>${escapeHtml(p.notes || '-')}</td>
      <td>${statusBadgeHtml(p.is_active)}</td>
      <td>
        <button type="button" class="btn btn-small edit-personnel-btn" data-id="${p.id}">Edit</button>
        <button type="button" class="btn btn-small btn-danger delete-personnel-btn" data-id="${p.id}" data-name="${escapeHtml(p.full_name)}" style="margin-left:6px;">Hapus</button>
      </td>
    </tr>
  `
    )
    .join('');

  document.querySelectorAll('.edit-personnel-btn').forEach((btn) => {
    btn.addEventListener('click', () => openEditModal(Number(btn.dataset.id)));
  });
  document.querySelectorAll('.delete-personnel-btn').forEach((btn) => {
    btn.addEventListener('click', () => deletePersonnel(Number(btn.dataset.id), btn.dataset.name));
  });
}

async function load() {
  tbody.innerHTML = `<tr><td colspan="8">Memuat data...</td></tr>`;
  try {
    const res = await api('/personnel?includeInactive=1');
    allRows = res.data;
    populateCategoryList();
    render();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8">${escapeHtml(err.message)}</td></tr>`;
  }
}

function populateCategoryList() {
  const categories = [...new Set(allRows.map((p) => p.category))].sort();
  document.getElementById('categoryList').innerHTML = categories.map((c) => `<option value="${escapeHtml(c)}"></option>`).join('');
}

searchInput.addEventListener('input', render);
showInactiveCheck.addEventListener('change', render);

async function deletePersonnel(id, name) {
  resultBox.style.display = 'none';
  if (!confirm(`Hapus data personel "${name}"? Jika personel ini sudah punya riwayat absensi, datanya akan dinonaktifkan (bukan dihapus permanen) agar riwayat absensi lama tetap tersimpan.`)) return;
  try {
    const res = await api(`/personnel/${id}`, { method: 'DELETE' });
    if (res && res.data && res.data.deactivated) {
      showMessage(`Personel "${name}" dinonaktifkan (sudah punya riwayat absensi).`, false);
    } else {
      showMessage(`Personel "${name}" berhasil dihapus permanen.`, false);
    }
    load();
  } catch (err) {
    showMessage(err.message, true);
  }
}

// ---- Modal (tambah / edit) ----

const modal = document.getElementById('personnelModal');
const modalTitle = document.getElementById('modalTitle');
const personnelForm = document.getElementById('personnelForm');
const modalSubmitBtn = document.getElementById('modalSubmitBtn');
const activeFieldWrap = document.getElementById('activeFieldWrap');

function openCreateModal() {
  resultBox.style.display = 'none';
  editingId = null;
  personnelForm.reset();
  modalTitle.textContent = 'Tambah Personel';
  modalSubmitBtn.textContent = 'Tambah Personel';
  activeFieldWrap.style.display = 'none';
  modal.classList.add('open');
}

function openEditModal(id) {
  resultBox.style.display = 'none';
  const p = allRows.find((r) => r.id === id);
  if (!p) return;
  editingId = id;
  personnelForm.reset();
  modalTitle.textContent = `Edit: ${p.full_name}`;
  modalSubmitBtn.textContent = 'Simpan Perubahan';

  document.getElementById('formFullName').value = p.full_name || '';
  document.getElementById('formRankInfo').value = p.rank_info || '';
  document.getElementById('formPosition').value = p.position || '';
  document.getElementById('formCategory').value = p.category || '';
  document.getElementById('formNotes').value = p.notes || '';
  document.getElementById('formActive').checked = !!p.is_active;
  activeFieldWrap.style.display = '';

  modal.classList.add('open');
}

function closeModal() {
  modal.classList.remove('open');
  editingId = null;
  personnelForm.reset();
}

document.getElementById('addPersonnelBtn').addEventListener('click', openCreateModal);
document.getElementById('modalCloseBtn').addEventListener('click', closeModal);
document.getElementById('modalCancelBtn').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.classList.contains('open')) closeModal(); });

function clearFieldErrors() {
  personnelForm.querySelectorAll('.field').forEach((f) => f.classList.remove('error'));
  personnelForm.querySelectorAll('.error-message').forEach((e) => e.remove());
}

function showFieldError(field, message) {
  const MAP = {
    full_name: 'formFullName', rank_info: 'formRankInfo', position: 'formPosition',
    category: 'formCategory', notes: 'formNotes',
  };
  const input = document.getElementById(MAP[field]);
  if (!input) return;
  const fieldEl = input.closest('.field');
  fieldEl.classList.add('error');
  const msg = document.createElement('div');
  msg.className = 'error-message';
  msg.textContent = message;
  fieldEl.appendChild(msg);
}

personnelForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  resultBox.style.display = 'none';
  clearFieldErrors();

  const payload = {
    full_name: document.getElementById('formFullName').value.trim(),
    rank_info: document.getElementById('formRankInfo').value.trim() || null,
    position: document.getElementById('formPosition').value.trim(),
    category: document.getElementById('formCategory').value.trim(),
    notes: document.getElementById('formNotes').value.trim() || null,
  };
  if (editingId !== null) {
    payload.is_active = document.getElementById('formActive').checked;
  }

  try {
    if (editingId === null) {
      await api('/personnel', { method: 'POST', body: JSON.stringify(payload) });
      showMessage('Personel berhasil ditambahkan.', false);
    } else {
      await api(`/personnel/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) });
      showMessage('Perubahan berhasil disimpan.', false);
    }
    closeModal();
    load();
  } catch (err) {
    showMessage(err.message, true);
    if (err.fields) {
      Object.entries(err.fields).forEach(([field, message]) => showFieldError(field, message));
    }
  }
});

load();
