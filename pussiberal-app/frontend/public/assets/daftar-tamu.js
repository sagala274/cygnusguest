requireAuth();
renderNav('daftar-tamu');

const searchInput = document.getElementById('searchInput');
const statusFilter = document.getElementById('statusFilter');
const tbody = document.getElementById('guestTableBody');
const pagination = document.getElementById('pagination');
const resultBox = document.getElementById('resultBox');

const user = getUser();
const isAdmin = user && user.role === 'admin';

const initialStatus = new URLSearchParams(window.location.search).get('status') || '';
if (initialStatus) statusFilter.value = initialStatus;

let state = { page: 1, pageSize: 15, q: '', status: initialStatus };
let debounceTimer = null;

function showMessage(message, isError) {
  resultBox.style.display = 'block';
  resultBox.textContent = message;
  resultBox.classList.toggle('error-box', !!isError);
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
    const res = await api(`/guests?${params.toString()}`);

    if (!res.data.length) {
      tbody.innerHTML = `<tr><td colspan="7">Tidak ada data tamu ditemukan.</td></tr>`;
    } else {
      tbody.innerHTML = res.data
        .map(
          (g) => `
        <tr>
          <td>${escapeHtml(g.registration_number)}</td>
          <td>${escapeHtml(g.company || '-')}</td>
          <td>${escapeHtml(g.member_names || '-')}</td>
          <td>${g.member_count}</td>
          <td><span class="badge ${statusBadgeClass(g.status)}">${escapeHtml(guestStatusLabel(g.status))}</span></td>
          <td>${formatDateTime(g.created_at)}</td>
          <td>
            <a class="link" href="detail-tamu?id=${g.id}">Detail</a>
            ${isAdmin ? `<button type="button" class="btn btn-small btn-danger delete-guest-btn" data-id="${g.id}" data-reg="${escapeHtml(g.registration_number)}" data-count="${g.member_count}" style="margin-left:8px;">Hapus</button>` : ''}
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

    document.querySelectorAll('.delete-guest-btn').forEach((btn) => {
      btn.addEventListener('click', () => deleteGuest(btn.dataset.id, btn.dataset.reg, Number(btn.dataset.count)));
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7">${escapeHtml(err.message)}</td></tr>`;
  }
}

async function deleteGuest(id, regNumber, memberCount) {
  resultBox.style.display = 'none';
  if (!confirm(`Hapus pendaftaran ${regNumber} beserta ${memberCount} data tamu di dalamnya secara permanen (termasuk foto & riwayat kunjungan)? Tindakan ini tidak bisa dibatalkan.`)) return;

  try {
    await api(`/guests/${id}`, { method: 'DELETE' });
    showMessage(`Pendaftaran ${regNumber} berhasil dihapus.`, false);
    load();
  } catch (err) {
    showMessage(err.message, true);
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

load();
