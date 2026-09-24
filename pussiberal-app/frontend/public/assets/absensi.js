requireAuth();
requireRole('admin', 'verifikator');
renderNav('absensi');

const resultBox = document.getElementById('resultBox');
const groupsContainer = document.getElementById('groupsContainer');
const summaryRow = document.getElementById('summaryRow');
const dateInput = document.getElementById('dateInput');
const saveStatus = document.getElementById('saveStatus');

const STATUS_LABELS = {
  hadir: 'Hadir',
  dinas_dalam: 'Dinas Dalam',
  dinas_luar: 'Dinas Luar',
  sakit: 'Sakit',
  ijin: 'Ijin',
  cuti: 'Cuti',
  pendidikan: 'Pendidikan',
  bko: 'BKO',
  tanpa_keterangan: 'Tanpa Keterangan',
};
const STATUS_ORDER = Object.keys(STATUS_LABELS);

let rows = [];

function showMessage(message, isError) {
  resultBox.style.display = 'block';
  resultBox.textContent = message;
  resultBox.classList.toggle('error-box', !!isError);
}

function todayDateString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function renderSummary() {
  const counts = {};
  STATUS_ORDER.forEach((s) => { counts[s] = 0; });
  let belumDiisi = 0;
  rows.forEach((r) => {
    if (r.status && counts[r.status] !== undefined) counts[r.status] += 1;
    else belumDiisi += 1;
  });

  // Setiap kotak status (kecuali Total Personel) bisa diklik untuk lihat
  // daftar personelnya -- mekanisme sama seperti pie chart di Dashboard.
  const chips = STATUS_ORDER.map(
    (s) => `<div class="attendance-summary-chip is-clickable" data-status="${s}"><span class="chip-count">${counts[s]}</span><span class="chip-label">${escapeHtml(STATUS_LABELS[s])}</span></div>`
  );
  chips.push(`<div class="attendance-summary-chip is-clickable" data-status="__belum_diisi__"><span class="chip-count">${belumDiisi}</span><span class="chip-label">Belum Diisi</span></div>`);
  chips.push(`<div class="attendance-summary-chip"><span class="chip-count">${rows.length}</span><span class="chip-label">Total Personel</span></div>`);
  summaryRow.innerHTML = chips.join('');

  summaryRow.querySelectorAll('.attendance-summary-chip.is-clickable').forEach((chip) => {
    chip.addEventListener('click', () => openStatusListModal(chip.dataset.status));
  });
}

function statusOptionsHtml(currentStatus) {
  const options = ['<option value="">- Pilih -</option>']
    .concat(STATUS_ORDER.map((s) => `<option value="${s}" ${currentStatus === s ? 'selected' : ''}>${escapeHtml(STATUS_LABELS[s])}</option>`));
  return options.join('');
}

function personnelRowHtml(r, no) {
  return `
    <tr data-personnel-id="${r.personnel_id}">
      <td class="drag-handle-cell"><span class="drag-handle" draggable="true" title="Geser untuk urutkan">${icon('grip')}</span></td>
      <td>${no}</td>
      <td>${escapeHtml(r.full_name)}</td>
      <td>${escapeHtml(r.rank_info || '-')}</td>
      <td>${escapeHtml(r.position)}${r.personnel_notes ? ` <span class="label-note">(${escapeHtml(r.personnel_notes)})</span>` : ''}</td>
      <td class="attendance-status-cell">
        <select class="attendance-status-select" data-personnel-id="${r.personnel_id}">${statusOptionsHtml(r.status)}</select>
        <span class="attendance-row-flash" data-flash-for="${r.personnel_id}"></span>
      </td>
      <td><input type="text" class="attendance-notes-input" data-personnel-id="${r.personnel_id}" maxlength="255" placeholder="Keterangan (opsional)" value="${escapeHtml(r.attendance_notes || '')}"></td>
      <td style="white-space:nowrap;">
        <button type="button" class="btn btn-small edit-personnel-btn" data-id="${r.personnel_id}">Edit</button>
        <button type="button" class="btn btn-small btn-danger delete-personnel-btn" data-id="${r.personnel_id}" data-name="${escapeHtml(r.full_name)}" style="margin-left:6px;">Hapus</button>
      </td>
    </tr>
  `;
}

function categoryCardHtml(category, members, startNo) {
  const rowsHtml = members.map((r, i) => personnelRowHtml(r, startNo + i)).join('');
  return `
    <div class="form-card" style="margin-bottom:20px;">
      <div class="section">
        <div class="section-header-row">
          <h2 class="section-title">${escapeHtml(category)} <span class="optional-badge">${members.length} personel</span></h2>
          <button type="button" class="btn btn-small add-personnel-btn" data-category="${escapeHtml(category)}">+ Tambah Personel</button>
        </div>
        <p class="page-description" style="margin:-6px 0 14px;">Geser ikon <span style="display:inline-flex;vertical-align:middle;">${icon('grip')}</span> untuk mengurutkan personel (mis. berdasarkan senioritas pangkat/NRP).</p>
        <div class="table-wrap">
          <table data-category="${escapeHtml(category)}">
            <thead>
              <tr>
                <th style="width:28px;"></th>
                <th style="width:40px;">No</th>
                <th>Nama</th>
                <th>Pangkat/Korps/NRP/NIP</th>
                <th>Jabatan</th>
                <th style="width:220px;">Status Absensi</th>
                <th>Keterangan</th>
                <th></th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function renderGroups() {
  const groups = [];
  const indexByCategory = {};
  rows.forEach((r) => {
    if (!(r.category in indexByCategory)) {
      indexByCategory[r.category] = groups.length;
      groups.push({ category: r.category, members: [] });
    }
    groups[indexByCategory[r.category]].members.push(r);
  });

  let runningNo = 1;
  groupsContainer.innerHTML = groups
    .map((g) => {
      const html = categoryCardHtml(g.category, g.members, runningNo);
      runningNo += g.members.length;
      return html;
    })
    .join('');

  wireRowEvents();
}

function wireRowEvents() {
  groupsContainer.querySelectorAll('.attendance-status-select').forEach((sel) => {
    sel.addEventListener('change', () => saveEntry(Number(sel.dataset.personnelId)));
  });
  groupsContainer.querySelectorAll('.attendance-notes-input').forEach((input) => {
    input.addEventListener('blur', () => saveEntry(Number(input.dataset.personnelId)));
  });
  groupsContainer.querySelectorAll('.add-personnel-btn').forEach((btn) => {
    btn.addEventListener('click', () => openCreateModal(btn.dataset.category));
  });
  groupsContainer.querySelectorAll('.edit-personnel-btn').forEach((btn) => {
    btn.addEventListener('click', () => openEditModal(Number(btn.dataset.id)));
  });
  groupsContainer.querySelectorAll('.delete-personnel-btn').forEach((btn) => {
    btn.addEventListener('click', () => deletePersonnel(Number(btn.dataset.id), btn.dataset.name));
  });
  groupsContainer.querySelectorAll('table[data-category]').forEach((table) => {
    wireDragReorder(table.querySelector('tbody'), table.dataset.category);
  });
}

// ---- Geser-urutkan (drag-and-drop) personel per kelompok -- supaya bisa
// diurutkan manual mengikuti senioritas pangkat/NRP, bukan cuma urutan saat
// data dimasukkan. Hanya bisa digeser DI DALAM kelompok/kategori yang sama
// (tidak memindahkan personel ke kategori lain lewat geser).
let draggedRow = null;

function wireDragReorder(tbody, category) {
  Array.from(tbody.rows).forEach((tr) => {
    const handle = tr.querySelector('.drag-handle');
    if (!handle) return;

    handle.addEventListener('dragstart', (e) => {
      draggedRow = tr;
      tr.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', tr.dataset.personnelId);
    });
    handle.addEventListener('dragend', () => {
      tr.classList.remove('is-dragging');
      if (draggedRow === tr) {
        saveReorder(tbody, category);
        draggedRow = null;
      }
    });

    tr.addEventListener('dragover', (e) => {
      if (!draggedRow || draggedRow === tr || draggedRow.parentElement !== tbody) return;
      e.preventDefault();
      const rect = tr.getBoundingClientRect();
      const before = (e.clientY - rect.top) / rect.height < 0.5;
      tbody.insertBefore(draggedRow, before ? tr : tr.nextSibling);
    });
  });
}

async function saveReorder(tbody, category) {
  const personnelIds = Array.from(tbody.rows).map((tr) => Number(tr.dataset.personnelId));

  // Perbarui angka "No" langsung di tampilan tanpa menunggu server, supaya
  // terasa responsif selagi tersimpan di belakang layar. Diambil dari nilai
  // TERKECIL yang sudah ada (bukan cuma baris pertama) karena baris yang
  // tadinya di posisi pertama bisa saja ikut tergeser oleh drag ini.
  const existingNumbers = Array.from(tbody.rows).map((tr) => Number(tr.cells[1].textContent));
  const firstNo = Math.min(...existingNumbers);
  Array.from(tbody.rows).forEach((tr, i) => { tr.cells[1].textContent = firstNo + i; });

  try {
    await api('/personnel/reorder', { method: 'PUT', body: JSON.stringify({ category, personnel_ids: personnelIds }) });
    // Muat ulang dari server supaya array `rows` di memori (sumber data
    // saat renderGroups() dipanggil ulang, mis. setelah ganti status/
    // tanggal) ikut mengikuti urutan baru -- bukan cuma tampilannya saja.
    load();
  } catch (err) {
    showMessage(`Gagal menyimpan urutan: ${err.message}`, true);
    load();
  }
}

async function load() {
  groupsContainer.innerHTML = '<div class="form-card"><div class="section">Memuat data...</div></div>';
  try {
    const res = await api(`/attendance?date=${dateInput.value}`);
    rows = res.data;
    renderGroups();
    renderSummary();
    populateCategoryList();
  } catch (err) {
    groupsContainer.innerHTML = '';
    showMessage(err.message, true);
  }
}

function populateCategoryList() {
  const categories = [...new Set(rows.map((r) => r.category))].sort();
  document.getElementById('categoryList').innerHTML = categories.map((c) => `<option value="${escapeHtml(c)}"></option>`).join('');
}

async function saveEntry(personnelId) {
  resultBox.style.display = 'none';
  const row = document.querySelector(`tr[data-personnel-id="${personnelId}"]`);
  const select = row.querySelector('.attendance-status-select');
  const notesInput = row.querySelector('.attendance-notes-input');
  const flash = row.querySelector('.attendance-row-flash');
  const status = select.value || null;
  const notes = notesInput.value.trim() || null;

  if (!status && notes) {
    flash.textContent = 'Pilih status dahulu';
    flash.classList.add('is-error');
    return;
  }

  saveStatus.textContent = 'Menyimpan...';
  try {
    await api('/attendance/save', {
      method: 'POST',
      body: JSON.stringify({ date: dateInput.value, entries: [{ personnel_id: personnelId, status, notes }] }),
    });

    const rowData = rows.find((r) => r.personnel_id === personnelId);
    if (rowData) {
      rowData.status = status;
      rowData.attendance_notes = notes;
    }
    renderSummary();

    flash.classList.remove('is-error');
    flash.textContent = 'Tersimpan';
    setTimeout(() => { if (flash.textContent === 'Tersimpan') flash.textContent = ''; }, 2000);
    saveStatus.textContent = `Tersimpan ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
  } catch (err) {
    flash.classList.add('is-error');
    flash.textContent = 'Gagal menyimpan';
    saveStatus.textContent = 'Gagal menyimpan';
    saveStatus.classList.add('is-error');
    showMessage(err.message, true);
  }
}

function shiftDate(days) {
  const [y, m, d] = dateInput.value.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  dateInput.value = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  load();
}

document.getElementById('prevDayBtn').addEventListener('click', () => shiftDate(-1));
document.getElementById('nextDayBtn').addEventListener('click', () => shiftDate(1));
document.getElementById('todayBtn').addEventListener('click', () => { dateInput.value = todayDateString(); load(); });
dateInput.addEventListener('change', load);

// ---- Kelola Personel langsung dari sini (tambah/edit/hapus per kelompok) --
// supaya tidak perlu menyiapkan seluruh data personel lebih dulu di menu
// terpisah; personel baru bisa langsung ditambahkan saat dibutuhkan, per
// kelompok/satuan yang sedang dilihat.

document.getElementById('closeIconSlot').innerHTML = icon('close');

let editingPersonnelId = null;
const personnelModal = document.getElementById('personnelModal');
const personnelModalTitle = document.getElementById('modalTitle');
const personnelForm = document.getElementById('personnelForm');
const personnelModalSubmitBtn = document.getElementById('modalSubmitBtn');
const activeFieldWrap = document.getElementById('activeFieldWrap');

function openCreateModal(presetCategory) {
  resultBox.style.display = 'none';
  editingPersonnelId = null;
  personnelForm.reset();
  personnelModalTitle.textContent = 'Tambah Personel';
  personnelModalSubmitBtn.textContent = 'Tambah Personel';
  activeFieldWrap.style.display = 'none';
  if (presetCategory) document.getElementById('formCategory').value = presetCategory;
  personnelModal.classList.add('open');
}

function openEditModal(personnelId) {
  resultBox.style.display = 'none';
  const p = rows.find((r) => r.personnel_id === personnelId);
  if (!p) return;
  editingPersonnelId = personnelId;
  personnelForm.reset();
  personnelModalTitle.textContent = `Edit: ${p.full_name}`;
  personnelModalSubmitBtn.textContent = 'Simpan Perubahan';

  document.getElementById('formFullName').value = p.full_name || '';
  document.getElementById('formRankInfo').value = p.rank_info || '';
  document.getElementById('formPosition').value = p.position || '';
  document.getElementById('formCategory').value = p.category || '';
  document.getElementById('formNotes').value = p.personnel_notes || '';
  document.getElementById('formActive').checked = true;
  activeFieldWrap.style.display = '';

  personnelModal.classList.add('open');
}

function closeModal() {
  personnelModal.classList.remove('open');
  editingPersonnelId = null;
  personnelForm.reset();
}

document.getElementById('modalCloseBtn').addEventListener('click', closeModal);
document.getElementById('modalCancelBtn').addEventListener('click', closeModal);
personnelModal.addEventListener('click', (e) => { if (e.target === personnelModal) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && personnelModal.classList.contains('open')) closeModal(); });

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
  if (editingPersonnelId !== null) {
    payload.is_active = document.getElementById('formActive').checked;
  }

  try {
    if (editingPersonnelId === null) {
      await api('/personnel', { method: 'POST', body: JSON.stringify(payload) });
      showMessage('Personel berhasil ditambahkan.', false);
    } else {
      await api(`/personnel/${editingPersonnelId}`, { method: 'PUT', body: JSON.stringify(payload) });
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

// ---- Klik kotak ringkasan (Hadir, Dinas Dalam, dst.) untuk lihat detail ----
// Mekanisme sama seperti pie chart "Kondisi Absensi Hari Ini" di Dashboard,
// tapi datanya cukup difilter dari `rows` yang sudah dimuat di halaman ini
// (tidak perlu ambil data lagi ke server).

const STATUS_BADGE_CLASS = {
  hadir: 'badge-green', dinas_dalam: 'badge-blue', dinas_luar: 'badge-blue', sakit: 'badge-red', ijin: 'badge-amber',
  cuti: 'badge-amber', pendidikan: 'badge-purple', bko: 'badge-gray', tanpa_keterangan: 'badge-red',
};

function statusBadgeHtml(status) {
  if (status === null) return '<span class="badge badge-gray">Belum Diisi</span>';
  return `<span class="badge ${STATUS_BADGE_CLASS[status] || 'badge-gray'}">${escapeHtml(STATUS_LABELS[status] || status)}</span>`;
}

const statusListModal = document.getElementById('statusListModal');

function openStatusListModal(statusKey) {
  const status = statusKey === '__belum_diisi__' ? null : statusKey;
  const label = status === null ? 'Belum Diisi' : STATUS_LABELS[status];
  const filtered = rows.filter((r) => r.status === status);

  document.getElementById('statusListModalTitle').textContent = `Personel -- ${label} (${filtered.length})`;
  document.getElementById('statusListModalBody').innerHTML = filtered.length
    ? filtered
        .map(
          (r) => `
      <tr>
        <td>${escapeHtml(r.full_name)}</td>
        <td>${escapeHtml(r.rank_info || '-')}</td>
        <td>${escapeHtml(r.position)}</td>
        <td>${escapeHtml(r.category)}</td>
        <td>${escapeHtml(r.attendance_notes || '-')}</td>
      </tr>
    `
        )
        .join('')
    : '<tr><td colspan="5">Tidak ada personel dengan status ini.</td></tr>';

  statusListModal.classList.add('open');
}

function closeStatusListModal() {
  statusListModal.classList.remove('open');
}

document.getElementById('statusListCloseIconSlot').innerHTML = icon('close');
document.getElementById('statusListModalCloseBtn').addEventListener('click', closeStatusListModal);
statusListModal.addEventListener('click', (e) => { if (e.target === statusListModal) closeStatusListModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && statusListModal.classList.contains('open')) closeStatusListModal(); });

dateInput.value = todayDateString();
load();
