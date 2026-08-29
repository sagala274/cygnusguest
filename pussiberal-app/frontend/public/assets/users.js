requireAuth();
requireRole('admin');
renderNav('users');

const tbody = document.getElementById('userTableBody');
const resultBox = document.getElementById('resultBox');
const currentUser = getUser();
const editCard = document.getElementById('editUserCard');
let editingId = null;

function showMessage(message, isError) {
  resultBox.style.display = 'block';
  resultBox.textContent = message;
  resultBox.classList.toggle('error-box', !!isError);
}

async function load() {
  tbody.innerHTML = `<tr><td colspan="5">Memuat data...</td></tr>`;
  try {
    const res = await api('/users');
    tbody.innerHTML = res.data
      .map((u) => {
        const isSelf = u.username === currentUser.username;
        return `
      <tr>
        <td>${escapeHtml(u.username)}</td>
        <td>${escapeHtml(u.full_name)}</td>
        <td>${escapeHtml(roleLabel(u.role))}</td>
        <td><span class="badge ${u.is_active ? 'badge-green' : 'badge-gray'}">${u.is_active ? 'Aktif' : 'Nonaktif'}</span></td>
        <td style="display:flex; gap:8px; white-space:nowrap;">
          <button class="btn btn-small edit-user" data-id="${u.id}" data-username="${escapeHtml(u.username)}" data-fullname="${escapeHtml(u.full_name)}" data-role="${u.role}">Edit</button>
          ${
            isSelf
              ? ''
              : `<button class="btn btn-small toggle-active" data-id="${u.id}" data-active="${u.is_active ? 0 : 1}">${u.is_active ? 'Nonaktifkan' : 'Aktifkan'}</button>
                 <button class="btn btn-small btn-danger delete-user" data-id="${u.id}" data-username="${escapeHtml(u.username)}">Hapus</button>`
          }
        </td>
      </tr>
    `;
      })
      .join('');

    document.querySelectorAll('.toggle-active').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await api(`/users/${btn.dataset.id}`, {
            method: 'PUT',
            body: JSON.stringify({ is_active: btn.dataset.active === '1' }),
          });
          load();
        } catch (err) {
          showMessage(err.message, true);
        }
      });
    });

    document.querySelectorAll('.edit-user').forEach((btn) => {
      btn.addEventListener('click', () => openEdit(btn.dataset));
    });

    document.querySelectorAll('.delete-user').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm(`Hapus pengguna "${btn.dataset.username}" secara permanen?`)) return;
        try {
          await api(`/users/${btn.dataset.id}`, { method: 'DELETE' });
          showMessage(`Pengguna "${btn.dataset.username}" berhasil dihapus.`, false);
          if (editingId === btn.dataset.id) closeEdit();
          load();
        } catch (err) {
          showMessage(err.message, true);
        }
      });
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5">${escapeHtml(err.message)}</td></tr>`;
  }
}

function openEdit(data) {
  editingId = data.id;
  document.getElementById('editUsername').textContent = data.username;
  document.getElementById('editFullName').value = data.fullname;
  document.getElementById('editRole').value = data.role;
  document.getElementById('editPassword').value = '';
  editCard.style.display = 'block';
  editCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function closeEdit() {
  editingId = null;
  editCard.style.display = 'none';
  document.getElementById('editUserForm').reset();
}

document.getElementById('cancelEditBtn').addEventListener('click', closeEdit);

document.getElementById('editUserForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  resultBox.style.display = 'none';

  const payload = {
    full_name: document.getElementById('editFullName').value.trim(),
    role: document.getElementById('editRole').value,
  };
  const newPassword = document.getElementById('editPassword').value;
  if (newPassword) payload.password = newPassword;

  try {
    await api(`/users/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) });
    showMessage('Perubahan berhasil disimpan.', false);
    closeEdit();
    load();
  } catch (err) {
    showMessage(err.message, true);
  }
});

document.getElementById('createUserForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  resultBox.style.display = 'none';

  const payload = {
    username: document.getElementById('newUsername').value.trim(),
    full_name: document.getElementById('newFullName').value.trim(),
    password: document.getElementById('newPassword').value,
    role: document.getElementById('newRole').value,
  };

  try {
    await api('/users', { method: 'POST', body: JSON.stringify(payload) });
    showMessage(`Pengguna "${payload.username}" berhasil dibuat.`, false);
    e.target.reset();
    load();
  } catch (err) {
    showMessage(err.message, true);
  }
});

load();
