requireAuth();
requireRole('admin');
renderNav('users');

const resultBox = document.getElementById('resultBox');
const currentUser = getUser();
const tbody = document.getElementById('userTableBody');
const paginationBar = document.getElementById('paginationBar');

const searchInput = document.getElementById('searchInput');
const roleFilter = document.getElementById('roleFilter');
const statusFilter = document.getElementById('statusFilter');

const modal = document.getElementById('userModal');
const modalTitle = document.getElementById('modalTitle');
const userForm = document.getElementById('userForm');
const usernameField = document.getElementById('usernameField');
const formUsername = document.getElementById('formUsername');
const formFullName = document.getElementById('formFullName');
const formPassword = document.getElementById('formPassword');
const passwordLabel = document.getElementById('passwordLabel');
const formRole = document.getElementById('formRole');
const modalSubmitBtn = document.getElementById('modalSubmitBtn');

const ROLE_ICON = { admin: 'crown', verifikator: 'checkCircle', pos_depan: 'shield' };

let allUsers = [];
let editingId = null;
let sortKey = 'username';
let sortDir = 'asc';
let currentPage = 1;
let pageSize = 10;

document.getElementById('searchIconSlot').innerHTML = icon('search');
document.getElementById('roleIconSlot').innerHTML = icon('filter');
document.getElementById('statusIconSlot').innerHTML = icon('filter');
document.getElementById('closeIconSlot').innerHTML = icon('close');
document.querySelectorAll('.th-sort-btn .sort-icon-slot').forEach((slot) => {
  slot.innerHTML = icon('sort');
});

function showMessage(message, isError) {
  resultBox.style.display = 'block';
  resultBox.textContent = message;
  resultBox.classList.toggle('error-box', !!isError);
}

function getFilteredSortedUsers() {
  const q = searchInput.value.trim().toLowerCase();
  const roleVal = roleFilter.value;
  const statusVal = statusFilter.value;

  let list = allUsers.filter((u) => {
    if (roleVal && u.role !== roleVal) return false;
    if (statusVal !== '' && String(u.is_active ? 1 : 0) !== statusVal) return false;
    if (q) {
      const haystack = `${u.username} ${u.full_name} ${roleLabel(u.role)}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  list = list.slice().sort((a, b) => {
    let av = a[sortKey];
    let bv = b[sortKey];
    if (sortKey === 'role') { av = roleLabel(av); bv = roleLabel(bv); }
    if (sortKey === 'is_active') { av = av ? 1 : 0; bv = bv ? 1 : 0; }
    if (typeof av === 'string') av = av.toLowerCase();
    if (typeof bv === 'string') bv = bv.toLowerCase();
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  return list;
}

function renderSortIndicators() {
  document.querySelectorAll('.th-sort-btn').forEach((btn) => {
    btn.classList.toggle('is-sorted', btn.dataset.sort === sortKey);
  });
}

function avatarHtml(u) {
  const initial = (u.full_name || u.username || '?').trim().charAt(0).toUpperCase();
  if (u.avatar_url) {
    return `<div class="avatar-sm" style="background-image:url('${escapeHtml(u.avatar_url)}')"></div>`;
  }
  return `<div class="avatar-sm role-${u.role}">${escapeHtml(initial)}</div>`;
}

function roleBadgeHtml(role) {
  return `<span class="badge-role role-${role}">${icon(ROLE_ICON[role] || 'shield')}${escapeHtml(roleLabel(role))}</span>`;
}

function statusBadgeHtml(isActive) {
  return `<span class="badge status-badge ${isActive ? 'badge-green' : 'badge-gray'}"><span class="status-dot"></span>${isActive ? 'Aktif' : 'Nonaktif'}</span>`;
}

function render() {
  const filtered = getFilteredSortedUsers();
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (currentPage > totalPages) currentPage = totalPages;
  const start = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, total);
  const pageItems = filtered.slice(start - 1, end);

  renderSortIndicators();

  if (!total) {
    tbody.innerHTML = `<tr><td colspan="5" style="color:var(--muted);">Tidak ada pengguna yang cocok dengan pencarian/filter.</td></tr>`;
  } else {
    tbody.innerHTML = pageItems
      .map((u) => {
        const isSelf = u.username === currentUser.username;
        return `
      <tr>
        <td>
          <div class="user-cell">
            ${avatarHtml(u)}
            <span class="user-cell-name">${escapeHtml(u.username)}</span>
          </div>
        </td>
        <td>${escapeHtml(u.full_name)}</td>
        <td>${roleBadgeHtml(u.role)}</td>
        <td>${statusBadgeHtml(!!u.is_active)}</td>
        <td>
          <div class="action-btn-group">
            <button class="action-btn edit-user" data-id="${u.id}" data-username="${escapeHtml(u.username)}" data-fullname="${escapeHtml(u.full_name)}" data-role="${u.role}">${icon('pencil')}<span>Edit</span></button>
            ${
              isSelf
                ? ''
                : `<button class="action-btn toggle-active" data-id="${u.id}" data-active="${u.is_active ? 0 : 1}">${icon('power')}<span>${u.is_active ? 'Nonaktifkan' : 'Aktifkan'}</span></button>
                   <button class="action-btn action-danger delete-user" data-id="${u.id}" data-username="${escapeHtml(u.username)}">${icon('trash')}<span>Hapus</span></button>`
            }
          </div>
        </td>
      </tr>
    `;
      })
      .join('');
  }

  paginationBar.innerHTML = `
    <span>${total ? `Menampilkan ${start} - ${end} dari ${total} pengguna` : 'Tidak ada data'}</span>
    <div class="pagination-controls">
      <button type="button" class="page-btn" id="prevPageBtn" ${currentPage <= 1 ? 'disabled' : ''}>&lsaquo;</button>
      ${Array.from({ length: totalPages }, (_, i) => i + 1)
        .map((p) => `<button type="button" class="page-btn ${p === currentPage ? 'is-current' : ''}" data-page="${p}">${p}</button>`)
        .join('')}
      <button type="button" class="page-btn" id="nextPageBtn" ${currentPage >= totalPages ? 'disabled' : ''}>&rsaquo;</button>
      <select class="page-size-select" id="pageSizeSelect">
        <option value="10" ${pageSize === 10 ? 'selected' : ''}>10 / halaman</option>
        <option value="25" ${pageSize === 25 ? 'selected' : ''}>25 / halaman</option>
        <option value="50" ${pageSize === 50 ? 'selected' : ''}>50 / halaman</option>
      </select>
    </div>
  `;

  attachRowHandlers();
  attachPaginationHandlers();
}

function attachRowHandlers() {
  document.querySelectorAll('.toggle-active').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await api(`/users/${btn.dataset.id}`, {
          method: 'PUT',
          body: JSON.stringify({ is_active: btn.dataset.active === '1' }),
        });
        await load();
      } catch (err) {
        showMessage(err.message, true);
      }
    });
  });

  document.querySelectorAll('.edit-user').forEach((btn) => {
    btn.addEventListener('click', () => openModal('edit', btn.dataset));
  });

  document.querySelectorAll('.delete-user').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm(`Hapus pengguna "${btn.dataset.username}" secara permanen?`)) return;
      try {
        await api(`/users/${btn.dataset.id}`, { method: 'DELETE' });
        showMessage(`Pengguna "${btn.dataset.username}" berhasil dihapus.`, false);
        await load();
      } catch (err) {
        showMessage(err.message, true);
      }
    });
  });
}

function attachPaginationHandlers() {
  document.querySelectorAll('.page-btn[data-page]').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentPage = Number(btn.dataset.page);
      render();
    });
  });
  const prevBtn = document.getElementById('prevPageBtn');
  const nextBtn = document.getElementById('nextPageBtn');
  if (prevBtn) prevBtn.addEventListener('click', () => { currentPage -= 1; render(); });
  if (nextBtn) nextBtn.addEventListener('click', () => { currentPage += 1; render(); });
  const sizeSelect = document.getElementById('pageSizeSelect');
  if (sizeSelect) {
    sizeSelect.addEventListener('change', () => {
      pageSize = Number(sizeSelect.value);
      currentPage = 1;
      render();
    });
  }
}

async function load() {
  tbody.innerHTML = `<tr><td colspan="5">Memuat data...</td></tr>`;
  try {
    const res = await api('/users');
    allUsers = res.data;
    render();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5">${escapeHtml(err.message)}</td></tr>`;
  }
}

[searchInput, roleFilter, statusFilter].forEach((el) => {
  el.addEventListener(el === searchInput ? 'input' : 'change', () => {
    currentPage = 1;
    render();
  });
});

document.querySelectorAll('.th-sort-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const key = btn.dataset.sort;
    if (sortKey === key) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortKey = key;
      sortDir = 'asc';
    }
    render();
  });
});

function openModal(mode, data) {
  resultBox.style.display = 'none';
  userForm.reset();
  if (mode === 'create') {
    editingId = null;
    modalTitle.textContent = 'Tambah Pengguna Baru';
    modalSubmitBtn.textContent = 'Tambah Pengguna';
    usernameField.style.display = '';
    formUsername.required = true;
    passwordLabel.innerHTML = 'PASSWORD <span class="required">*</span>';
    formPassword.required = true;
    formRole.value = 'pos_depan';
  } else {
    editingId = data.id;
    modalTitle.textContent = `Edit Pengguna: ${data.username}`;
    modalSubmitBtn.textContent = 'Simpan Perubahan';
    usernameField.style.display = 'none';
    formUsername.required = false;
    formFullName.value = data.fullname;
    formRole.value = data.role;
    passwordLabel.innerHTML = 'PASSWORD BARU <span class="label-note">Kosongkan jika tidak diubah</span>';
    formPassword.required = false;
  }
  modal.classList.add('open');
}

function closeModal() {
  modal.classList.remove('open');
  editingId = null;
  userForm.reset();
}

document.getElementById('addUserBtn').addEventListener('click', () => openModal('create'));
document.getElementById('modalCloseBtn').addEventListener('click', closeModal);
document.getElementById('modalCancelBtn').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.classList.contains('open')) closeModal(); });

userForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  resultBox.style.display = 'none';

  try {
    if (editingId === null) {
      const payload = {
        username: formUsername.value.trim(),
        full_name: formFullName.value.trim(),
        password: formPassword.value,
        role: formRole.value,
      };
      await api('/users', { method: 'POST', body: JSON.stringify(payload) });
      showMessage(`Pengguna "${payload.username}" berhasil dibuat.`, false);
    } else {
      const payload = {
        full_name: formFullName.value.trim(),
        role: formRole.value,
      };
      if (formPassword.value) payload.password = formPassword.value;
      await api(`/users/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) });
      showMessage('Perubahan berhasil disimpan.', false);
    }
    closeModal();
    await load();
  } catch (err) {
    showMessage(err.message, true);
  }
});

load();
