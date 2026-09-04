requireAuth();
requireRole('admin');
renderNav('audit-log');

const searchInput = document.getElementById('searchInput');
const actionFilter = document.getElementById('actionFilter');
const fromDate = document.getElementById('fromDate');
const toDate = document.getElementById('toDate');
const tbody = document.getElementById('logTableBody');
const pagination = document.getElementById('pagination');

let state = { page: 1, pageSize: 25, q: '', action: '', from: '', to: '' };
let debounceTimer = null;

function parseDetail(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

// Kolom IP terpisah -- indikator sederhana User Behavior Analysis: alamat
// IP yang belum pernah tercatat untuk akun tersebut sebelumnya ditandai
// dengan badge "IP Baru" (lihat utils/userLoginIps.js di backend).
function ipCellHTML(detail) {
  if (!detail || !detail.ip_address) return '-';
  const badge = detail.is_new_ip
    ? ' <span class="badge badge-amber" title="Alamat IP ini belum pernah tercatat untuk akun ini sebelumnya">IP Baru</span>'
    : '';
  return `${escapeHtml(detail.ip_address)}${badge}`;
}

// Sama seperti formatAuditDetail() di app.js, tapi mengecualikan
// ip_address/is_new_ip karena sudah ditampilkan sendiri di kolom IP --
// supaya tidak dobel di kolom Detail.
function detailCellHTML(detail) {
  if (!detail) return '-';
  const { ip_address, is_new_ip, ...rest } = detail;
  const parts = Object.entries(rest)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`);
  return parts.length ? escapeHtml(parts.join(', ')) : '-';
}

async function load() {
  tbody.innerHTML = `<tr><td colspan="6">Memuat data...</td></tr>`;
  try {
    const params = new URLSearchParams({
      page: state.page,
      pageSize: state.pageSize,
      ...(state.q ? { q: state.q } : {}),
      ...(state.action ? { action: state.action } : {}),
      ...(state.from ? { from: state.from } : {}),
      ...(state.to ? { to: state.to } : {}),
    });
    const res = await api(`/audit-logs?${params.toString()}`);

    if (!res.data.length) {
      tbody.innerHTML = `<tr><td colspan="6">Tidak ada aktivitas ditemukan.</td></tr>`;
    } else {
      tbody.innerHTML = res.data
        .map((l) => {
          const detail = parseDetail(l.detail);
          return `
        <tr>
          <td>${formatDateTime(l.timestamp)}</td>
          <td>${escapeHtml(l.username ? `${l.full_name} (${l.username})` : 'Sistem')}</td>
          <td>${escapeHtml(actionLabel(l.action))}</td>
          <td>${escapeHtml(l.object_type || '-')}${l.object_id ? ' #' + escapeHtml(l.object_id) : ''}</td>
          <td>${ipCellHTML(detail)}</td>
          <td>${detailCellHTML(detail)}</td>
        </tr>
      `;
        })
        .join('');
    }

    const totalPages = Math.max(1, Math.ceil(res.total / state.pageSize));
    pagination.innerHTML = `
      <span>Halaman ${state.page} dari ${totalPages} (${res.total} entri)</span>
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
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6">${escapeHtml(err.message)}</td></tr>`;
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

actionFilter.addEventListener('change', () => {
  state.action = actionFilter.value;
  state.page = 1;
  load();
});

fromDate.addEventListener('change', () => {
  state.from = fromDate.value;
  state.page = 1;
  load();
});

toDate.addEventListener('change', () => {
  state.to = toDate.value;
  state.page = 1;
  load();
});

load();
