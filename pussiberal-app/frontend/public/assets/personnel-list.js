requireAuth();
requireRole('admin', 'verifikator', 'pimpinan');
renderNav('personnel-list');

// Pimpinan hanya boleh MELIHAT daftar personel -- tidak boleh
// menambah/mengedit/menghapus.
const user = getUser();
const canEditPersonnel = user && ['admin', 'verifikator'].includes(user.role);
if (!canEditPersonnel) {
  document.getElementById('addPersonnelBtn').style.display = 'none';
}

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
    tbody.innerHTML = `<tr><td colspan="9">Tidak ada data personel ditemukan.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered
    .map(
      (p, i) => `
    <tr>
      <td><span class="no-with-warning">${i + 1}${securityCategoryWarningIconHtml(p.security_category)}</span></td>
      <td>${canEditPersonnel ? `<a href="#" class="link analysis-trigger" data-id="${p.id}">${escapeHtml(p.full_name)}</a>` : escapeHtml(p.full_name)}</td>
      <td>${escapeHtml(p.rank_info || '-')}</td>
      <td>${escapeHtml(p.position)}</td>
      <td>${escapeHtml(p.category)}</td>
      <td>${escapeHtml(p.notes || '-')}</td>
      <td>${statusBadgeHtml(p.is_active)}</td>
      <td><span class="badge ${securityCategoryBadgeClass(p.security_category)}">${escapeHtml(securityCategoryLabel(p.security_category))}</span></td>
      <td>
        ${canEditPersonnel ? `<button type="button" class="btn btn-small edit-personnel-btn" data-id="${p.id}">Edit</button>
        <button type="button" class="btn btn-small btn-danger delete-personnel-btn" data-id="${p.id}" data-name="${escapeHtml(p.full_name)}" style="margin-left:6px;">Hapus</button>` : '-'}
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
  document.querySelectorAll('.analysis-trigger').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      openAnalysisModal(Number(link.dataset.id));
    });
  });
}

async function load() {
  tbody.innerHTML = `<tr><td colspan="9">Memuat data...</td></tr>`;
  try {
    const res = await api('/personnel?includeInactive=1');
    allRows = res.data;
    populateCategoryList();
    render();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="9">${escapeHtml(err.message)}</td></tr>`;
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

// ---- Analisa intelijen per personel -- klik nama untuk isi/lihat kategori
// keamanan & catatan anomali/kecurigaan, sama seperti "Kelola Analisa" di
// Bank Data (tapi untuk personel internal, bukan tamu).

const analysisModal = document.getElementById('analysisModal');
const analysisForm = document.getElementById('analysisForm');
let analysisPersonnelId = null;

document.getElementById('analysisCloseIconSlot').innerHTML = icon('close');

function openAnalysisModal(id) {
  resultBox.style.display = 'none';
  const p = allRows.find((r) => r.id === id);
  if (!p) return;
  analysisPersonnelId = id;
  document.getElementById('analysisModalTitle').textContent = `Analisa Intelijen: ${p.full_name}`;
  document.getElementById('analysisCategory').value = p.security_category || '';
  document.getElementById('analysisNotes').value = p.analysis_notes || '';
  analysisModal.classList.add('open');
}

function closeAnalysisModal() {
  analysisModal.classList.remove('open');
  analysisPersonnelId = null;
  analysisForm.reset();
}

document.getElementById('analysisModalCloseBtn').addEventListener('click', closeAnalysisModal);
document.getElementById('analysisCancelBtn').addEventListener('click', closeAnalysisModal);
analysisModal.addEventListener('click', (e) => { if (e.target === analysisModal) closeAnalysisModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && analysisModal.classList.contains('open')) closeAnalysisModal(); });

analysisForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (analysisPersonnelId === null) return;
  resultBox.style.display = 'none';

  const payload = {
    security_category: document.getElementById('analysisCategory').value || null,
    analysis_notes: document.getElementById('analysisNotes').value.trim() || null,
  };

  try {
    await api(`/personnel/${analysisPersonnelId}`, { method: 'PUT', body: JSON.stringify(payload) });
    showMessage('Analisa berhasil disimpan.', false);
    closeAnalysisModal();
    load();
  } catch (err) {
    showMessage(err.message, true);
  }
});

load();
