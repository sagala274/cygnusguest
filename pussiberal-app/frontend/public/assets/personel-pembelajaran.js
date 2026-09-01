requireAuth();
renderNav('personel-pembelajaran');

const user = getUser();
const canEditIdentity = user && ['admin', 'pos_depan'].includes(user.role);
const canEditProfiling = user && ['admin', 'verifikator'].includes(user.role);
const isAdmin = user && user.role === 'admin';

const searchInput = document.getElementById('searchInput');
const statusFilter = document.getElementById('statusFilter');
const tbody = document.getElementById('traineeTableBody');
const pagination = document.getElementById('pagination');
const resultBox = document.getElementById('resultBox');

document.getElementById('searchIconSlot').innerHTML = icon('search');
document.getElementById('statusIconSlot').innerHTML = icon('filter');
document.getElementById('closeIconSlot').innerHTML = icon('close');

if (canEditIdentity) document.getElementById('addTraineeBtn').style.display = '';

let state = { page: 1, pageSize: 15, q: '', status: '' };
let debounceTimer = null;
let editingId = null;

function showMessage(message, isError) {
  resultBox.style.display = 'block';
  resultBox.textContent = message;
  resultBox.classList.toggle('error-box', !!isError);
}

function statusBadgeHtml(status) {
  const cls = { Aktif: 'badge-green', 'Akan Datang': 'badge-blue', Selesai: 'badge-gray' }[status] || 'badge-gray';
  return `<span class="badge ${cls}">${escapeHtml(status)}</span>`;
}

async function load() {
  tbody.innerHTML = `<tr><td colspan="7">Memuat data...</td></tr>`;
  try {
    const params = new URLSearchParams({
      page: state.page,
      pageSize: state.pageSize,
      ...(state.q ? { q: state.q } : {}),
      ...(state.status ? { status: state.status } : {}),
    });
    const res = await api(`/trainees?${params.toString()}`);

    if (!res.data.length) {
      tbody.innerHTML = `<tr><td colspan="7">Tidak ada data personel pembelajaran ditemukan.</td></tr>`;
    } else {
      tbody.innerHTML = res.data
        .map(
          (t) => `
        <tr>
          <td>${escapeHtml(t.full_name)}${t.rank_title ? ` <span class="label-note">(${escapeHtml(t.rank_title)})</span>` : ''}</td>
          <td>${escapeHtml(t.position)}</td>
          <td>${escapeHtml(t.institution)}</td>
          <td>${formatDate(t.start_date)} &ndash; ${formatDate(t.end_date)}</td>
          <td>${statusBadgeHtml(t.status)}</td>
          <td><span class="badge ${securityCategoryBadgeClass(t.security_category)}">${escapeHtml(securityCategoryLabel(t.security_category))}</span></td>
          <td>
            <button type="button" class="btn btn-small edit-trainee-btn" data-id="${t.id}">${canEditIdentity || canEditProfiling ? 'Edit' : 'Lihat'}</button>
            ${isAdmin ? `<button type="button" class="btn btn-small btn-danger delete-trainee-btn" data-id="${t.id}" data-name="${escapeHtml(t.full_name)}" style="margin-left:6px;">Hapus</button>` : ''}
          </td>
        </tr>
      `
        )
        .join('');
    }

    const totalPages = Math.max(1, Math.ceil(res.total / state.pageSize));
    pagination.innerHTML = `
      <span>Halaman ${state.page} dari ${totalPages} (${res.total} data)</span>
      <button class="btn btn-small" id="prevPage" ${state.page <= 1 ? 'disabled' : ''}>Sebelumnya</button>
      <button class="btn btn-small" id="nextPage" ${state.page >= totalPages ? 'disabled' : ''}>Berikutnya</button>
    `;

    document.getElementById('prevPage').addEventListener('click', () => {
      state.page = Math.max(1, state.page - 1);
      load();
    });
    document.getElementById('nextPage').addEventListener('click', () => {
      state.page = Math.min(totalPages, state.page + 1);
      load();
    });

    document.querySelectorAll('.edit-trainee-btn').forEach((btn) => {
      btn.addEventListener('click', () => openEditModal(btn.dataset.id));
    });
    document.querySelectorAll('.delete-trainee-btn').forEach((btn) => {
      btn.addEventListener('click', () => deleteTrainee(btn.dataset.id, btn.dataset.name));
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7">${escapeHtml(err.message)}</td></tr>`;
  }
}

searchInput.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    state.q = searchInput.value.trim();
    state.page = 1;
    load();
  }, 350);
});

statusFilter.addEventListener('change', () => {
  state.status = statusFilter.value;
  state.page = 1;
  load();
});

async function deleteTrainee(id, name) {
  resultBox.style.display = 'none';
  if (!confirm(`Hapus data personel "${name}" secara permanen? Tindakan ini tidak bisa dibatalkan.`)) return;
  try {
    await api(`/trainees/${id}`, { method: 'DELETE' });
    showMessage(`Data "${name}" berhasil dihapus.`, false);
    load();
  } catch (err) {
    showMessage(err.message, true);
  }
}

// ---- Modal (tambah / edit) ----

const modal = document.getElementById('traineeModal');
const modalTitle = document.getElementById('modalTitle');
const traineeForm = document.getElementById('traineeForm');
const modalSubmitBtn = document.getElementById('modalSubmitBtn');
const profilingSectionTitle = document.getElementById('profilingSectionTitle');

const IDENTITY_FIELD_IDS = [
  'formFullName', 'formRank', 'formPosition', 'formInstitution',
  'formBirthPlace', 'formBirthDate', 'formAddress', 'formActivities', 'formStartDate', 'formEndDate',
];
const PROFILING_FIELD_IDS = ['formCategory', 'formProfilingNotes'];

function setFieldsDisabled(ids, disabled) {
  ids.forEach((id) => { document.getElementById(id).disabled = disabled; });
}

function openCreateModal() {
  resultBox.style.display = 'none';
  editingId = null;
  traineeForm.reset();
  modalTitle.textContent = 'Tambah Personel Pembelajaran';
  modalSubmitBtn.textContent = 'Tambah Personel';
  setFieldsDisabled(IDENTITY_FIELD_IDS, false);
  setFieldsDisabled(PROFILING_FIELD_IDS, true);
  profilingSectionTitle.style.display = 'none';
  document.getElementById('formCategory').closest('.field').style.display = 'none';
  document.getElementById('formProfilingNotes').closest('.field').style.display = 'none';
  modal.classList.add('open');
}

async function openEditModal(id) {
  resultBox.style.display = 'none';
  try {
    const res = await api(`/trainees/${id}`);
    const t = res.data;
    editingId = id;
    traineeForm.reset();
    modalTitle.textContent = `Edit: ${t.full_name}`;
    modalSubmitBtn.textContent = 'Simpan Perubahan';

    document.getElementById('formFullName').value = t.full_name || '';
    document.getElementById('formRank').value = t.rank_title || '';
    document.getElementById('formPosition').value = t.position || '';
    document.getElementById('formInstitution').value = t.institution || '';
    document.getElementById('formBirthPlace').value = t.birth_place || '';
    document.getElementById('formBirthDate').value = t.birth_date ? String(t.birth_date).slice(0, 10) : '';
    document.getElementById('formAddress').value = t.address || '';
    document.getElementById('formActivities').value = t.activities || '';
    document.getElementById('formStartDate').value = t.start_date ? String(t.start_date).slice(0, 10) : '';
    document.getElementById('formEndDate').value = t.end_date ? String(t.end_date).slice(0, 10) : '';
    document.getElementById('formCategory').value = t.security_category || '';
    document.getElementById('formProfilingNotes').value = t.profiling_notes || '';

    setFieldsDisabled(IDENTITY_FIELD_IDS, !canEditIdentity);
    setFieldsDisabled(PROFILING_FIELD_IDS, !canEditProfiling);
    profilingSectionTitle.style.display = '';
    document.getElementById('formCategory').closest('.field').style.display = '';
    document.getElementById('formProfilingNotes').closest('.field').style.display = '';

    modal.classList.add('open');
  } catch (err) {
    showMessage(err.message, true);
  }
}

function closeModal() {
  modal.classList.remove('open');
  editingId = null;
  traineeForm.reset();
}

document.getElementById('addTraineeBtn').addEventListener('click', openCreateModal);
document.getElementById('modalCloseBtn').addEventListener('click', closeModal);
document.getElementById('modalCancelBtn').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.classList.contains('open')) closeModal(); });

function clearFieldErrors() {
  traineeForm.querySelectorAll('.field').forEach((f) => f.classList.remove('error'));
  traineeForm.querySelectorAll('.error-message').forEach((e) => e.remove());
}

function showFieldError(field, message) {
  const MAP = {
    full_name: 'formFullName', rank_title: 'formRank', position: 'formPosition', institution: 'formInstitution',
    birth_place: 'formBirthPlace', birth_date: 'formBirthDate', address: 'formAddress', activities: 'formActivities',
    start_date: 'formStartDate', end_date: 'formEndDate',
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

traineeForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  resultBox.style.display = 'none';
  clearFieldErrors();

  const payload = {};
  if (editingId === null || canEditIdentity) {
    payload.full_name = document.getElementById('formFullName').value.trim();
    payload.rank_title = document.getElementById('formRank').value.trim() || undefined;
    payload.position = document.getElementById('formPosition').value.trim();
    payload.institution = document.getElementById('formInstitution').value.trim();
    payload.birth_place = document.getElementById('formBirthPlace').value.trim() || undefined;
    payload.birth_date = document.getElementById('formBirthDate').value || undefined;
    payload.address = document.getElementById('formAddress').value.trim() || undefined;
    payload.activities = document.getElementById('formActivities').value.trim();
    payload.start_date = document.getElementById('formStartDate').value;
    payload.end_date = document.getElementById('formEndDate').value;
  }
  if (editingId !== null && canEditProfiling) {
    payload.security_category = document.getElementById('formCategory').value || null;
    payload.profiling_notes = document.getElementById('formProfilingNotes').value.trim() || null;
  }

  try {
    if (editingId === null) {
      await api('/trainees', { method: 'POST', body: JSON.stringify(payload) });
      showMessage('Personel pembelajaran berhasil ditambahkan.', false);
    } else {
      await api(`/trainees/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) });
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
