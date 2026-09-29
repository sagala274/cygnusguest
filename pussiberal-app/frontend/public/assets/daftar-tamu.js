requireAuth();
renderNav('daftar-tamu');

const searchInput = document.getElementById('searchInput');
const statusFilter = document.getElementById('statusFilter');
const tbody = document.getElementById('guestTableBody');
const pagination = document.getElementById('pagination');
const resultBox = document.getElementById('resultBox');

const user = getUser();
const isAdmin = user && user.role === 'admin';
// Sama seperti hak edit data tamu lainnya (lihat PUT /api/guests/:id
// di backend) -- Verifikator/Pimpinan cuma boleh MELIHAT foto kegiatan
// yang sudah ada, tidak boleh mengunggah/mengubahnya.
const canEditActivityPhoto = user && ['admin', 'pos_depan'].includes(user.role);

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
  tbody.innerHTML = `<tr><td colspan="8">Memuat data...</td></tr>`;
  try {
    const params = new URLSearchParams({
      page: state.page,
      pageSize: state.pageSize,
      ...(state.q ? { q: state.q } : {}),
      ...(state.status ? { status: state.status } : {}),
    });
    const res = await api(`/guests?${params.toString()}`);

    if (!res.data.length) {
      tbody.innerHTML = `<tr><td colspan="8">Tidak ada data tamu ditemukan.</td></tr>`;
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
          <td>${activityPhotoCellHtml(g)}</td>
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
    document.querySelectorAll('.activity-photo-btn').forEach((btn) => {
      btn.addEventListener('click', () => openActivityPhotoModal(Number(btn.dataset.id), btn.dataset.reg));
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8">${escapeHtml(err.message)}</td></tr>`;
  }
}

// ---- Kolom "Foto Kegiatan" -- 1 foto per pendaftaran (bukan per tamu
// individu seperti Foto Tamu/Foto KTP di formulir Pendaftaran), diisi
// setelah tamu berkunjung supaya kegiatannya terdokumentasi. ----

function activityPhotoCellHtml(g) {
  if (canEditActivityPhoto) {
    const label = g.has_activity_photo ? 'Lihat/Ubah' : '+ Upload';
    return `<button type="button" class="btn btn-small activity-photo-btn" data-id="${g.id}" data-reg="${escapeHtml(g.registration_number)}">${label}</button>`;
  }
  if (g.has_activity_photo) {
    return `<button type="button" class="btn btn-small activity-photo-btn" data-id="${g.id}" data-reg="${escapeHtml(g.registration_number)}">Lihat</button>`;
  }
  return '-';
}

let activityPhotoWidget = null;
let activityPhotoGuestId = null;

function activityPhotoModalEls() {
  return {
    modal: document.getElementById('activityPhotoModal'),
    title: document.getElementById('activityPhotoModalTitle'),
    desc: document.getElementById('activityPhotoDesc'),
    widgetRoot: document.getElementById('activityPhotoWidgetRoot'),
    viewOnly: document.getElementById('activityPhotoViewOnly'),
    viewImg: document.getElementById('activityPhotoViewImg'),
    viewEmpty: document.getElementById('activityPhotoViewEmpty'),
    saveBtn: document.getElementById('activityPhotoSaveBtn'),
    cancelBtn: document.getElementById('activityPhotoCancelBtn'),
  };
}

async function openActivityPhotoModal(id, regNumber) {
  const els = activityPhotoModalEls();
  if (!activityPhotoWidget) activityPhotoWidget = initPhotoWidget(els.widgetRoot, 'environment');

  activityPhotoGuestId = id;
  els.title.textContent = `Foto Kegiatan -- ${regNumber}`;
  activityPhotoWidget.reset();

  els.widgetRoot.style.display = canEditActivityPhoto ? '' : 'none';
  els.desc.style.display = canEditActivityPhoto ? '' : 'none';
  els.viewOnly.style.display = canEditActivityPhoto ? 'none' : 'block';
  els.saveBtn.style.display = canEditActivityPhoto ? '' : 'none';
  els.cancelBtn.textContent = canEditActivityPhoto ? 'Batal' : 'Tutup';

  els.modal.classList.add('open');

  try {
    const res = await api(`/guests/${id}`);
    const photo = res.data.activity_photo || null;
    if (canEditActivityPhoto) {
      activityPhotoWidget.setValue(photo);
    } else {
      els.viewImg.src = photo || '';
      els.viewImg.style.display = photo ? 'block' : 'none';
      els.viewEmpty.style.display = photo ? 'none' : 'block';
    }
  } catch (err) {
    showMessage(err.message, true);
  }
}

function closeActivityPhotoModal() {
  if (activityPhotoWidget) activityPhotoWidget.stopCamera();
  document.getElementById('activityPhotoModal').classList.remove('open');
  activityPhotoGuestId = null;
}

document.getElementById('activityPhotoCloseIconSlot').innerHTML = icon('close');
document.getElementById('activityPhotoCloseBtn').addEventListener('click', closeActivityPhotoModal);
document.getElementById('activityPhotoCancelBtn').addEventListener('click', closeActivityPhotoModal);
document.getElementById('activityPhotoModal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('activityPhotoModal')) closeActivityPhotoModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.getElementById('activityPhotoModal').classList.contains('open')) closeActivityPhotoModal();
});

document.getElementById('activityPhotoSaveBtn').addEventListener('click', async () => {
  if (activityPhotoGuestId === null || !activityPhotoWidget) return;
  try {
    await api(`/guests/${activityPhotoGuestId}`, {
      method: 'PUT',
      body: JSON.stringify({ activity_photo: activityPhotoWidget.getValue() || null }),
    });
    showMessage('Foto kegiatan berhasil disimpan.', false);
    closeActivityPhotoModal();
    load();
  } catch (err) {
    showMessage(err.message, true);
  }
});

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
