requireAuth();
requireRole('admin', 'verifikator', 'pimpinan');
renderNav('absensi');

// Pimpinan (Danpussiberal/Wadanpussiberal) hanya boleh MELIHAT halaman ini --
// tidak boleh mengubah/menambah/menghapus apapun. Kaurpam (admin) dan
// Verifikator tetap bisa mengedit seperti biasa.
const user = getUser();
const canEditAttendance = user && ['admin', 'verifikator'].includes(user.role);
if (!canEditAttendance) {
  document.getElementById('manageLink').style.display = 'none';
}

const resultBox = document.getElementById('resultBox');
const groupsContainer = document.getElementById('groupsContainer');
const summaryRow = document.getElementById('summaryRow');
const dateInput = document.getElementById('dateInput');
const saveStatus = document.getElementById('saveStatus');

const STATUS_LABELS = {
  hadir: 'Hadir',
  wfh: 'WFH',
  dinas_dalam: 'Dinas Dalam',
  dinas_luar: 'Dinas Luar',
  sakit: 'Sakit',
  ijin: 'Ijin',
  cuti: 'Cuti',
  pendidikan: 'Pendidikan',
  bko: 'BKO',
  libur: 'Libur',
  terlambat: 'Terlambat',
  tanpa_keterangan: 'Tanpa Keterangan',
};
const STATUS_ORDER = Object.keys(STATUS_LABELS);

// Warna kategorikal untuk grafik batang -- dipilih & divalidasi (kontras,
// keterbacaan buta warna) supaya tiap kategori tetap bisa dibedakan
// meski berdampingan. "Belum Diisi" memakai abu-abu netral (pengecualian
// yang sudah dipakai konsisten di seluruh aplikasi untuk kondisi "tidak
// ada data").
const STATUS_COLORS = {
  hadir: '#067647',
  wfh: '#d97706',
  dinas_dalam: '#175cd3',
  dinas_luar: '#ea580c',
  sakit: '#6b21a8',
  ijin: '#be185d',
  cuti: '#86198f',
  pendidikan: '#0891b2',
  bko: '#92400e',
  libur: '#0d9488',
  terlambat: '#93a000',
  tanpa_keterangan: '#c62828',
};
const BELUM_DIISI_COLOR = '#98a2b3';

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

  renderStatusBarChart(counts, belumDiisi);
}

function niceMax(value) {
  if (value <= 0) return 5;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const residual = value / magnitude;
  let niceResidual;
  if (residual <= 1) niceResidual = 1;
  else if (residual <= 2) niceResidual = 2;
  else if (residual <= 5) niceResidual = 5;
  else niceResidual = 10;
  return niceResidual * magnitude;
}

// Grafik batang jumlah personel per kategori keterangan (tanggal yang
// dipilih) -- sama seperti kotak ringkasan di atasnya tapi dalam bentuk
// visual. Setiap batang bisa diklik untuk lihat daftar personelnya, sama
// seperti kotak ringkasan.
function renderStatusBarChart(counts, belumDiisi) {
  const container = document.getElementById('statusBarChart');
  const categories = STATUS_ORDER.map((s) => ({ key: s, label: STATUS_LABELS[s], count: counts[s], color: STATUS_COLORS[s] }));
  categories.push({ key: '__belum_diisi__', label: 'Belum Diisi', count: belumDiisi, color: BELUM_DIISI_COLOR });

  const width = 760;
  const height = 260;
  const marginLeft = 36;
  const marginBottom = 70;
  const marginTop = 16;
  const marginRight = 8;
  const plotWidth = width - marginLeft - marginRight;
  const plotHeight = height - marginTop - marginBottom;

  const maxCount = Math.max(...categories.map((c) => c.count), 1);
  const axisMax = niceMax(maxCount);
  const gridSteps = 4;
  const bandWidth = plotWidth / categories.length;
  const barWidth = Math.min(bandWidth * 0.56, 40);

  let gridlines = '';
  let yLabels = '';
  for (let i = 0; i <= gridSteps; i += 1) {
    const value = Math.round((axisMax / gridSteps) * i);
    const y = marginTop + plotHeight - (plotHeight * i) / gridSteps;
    gridlines += `<line x1="${marginLeft}" y1="${y}" x2="${width - marginRight}" y2="${y}" class="chart-gridline" />`;
    yLabels += `<text x="${marginLeft - 8}" y="${y + 3}" class="chart-axis-label" text-anchor="end">${value}</text>`;
  }

  let bars = '';
  let xLabels = '';
  let valueLabels = '';
  categories.forEach((c, i) => {
    const cx = marginLeft + bandWidth * i + bandWidth / 2;
    const barHeight = axisMax > 0 ? (c.count / axisMax) * plotHeight : 0;
    const y = marginTop + plotHeight - barHeight;
    const x = cx - barWidth / 2;
    const labelY = marginTop + plotHeight + 16;
    bars += `
      <g class="chart-bar-group" tabindex="0" data-index="${i}">
        <rect x="${x.toFixed(1)}" y="${marginTop.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${plotHeight.toFixed(1)}" class="chart-bar-hit" fill="transparent" />
        <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${Math.max(barHeight, 1).toFixed(1)}" rx="4" fill="${c.color}" />
      </g>
    `;
    if (c.count > 0) {
      valueLabels += `<text x="${cx.toFixed(1)}" y="${(y - 8).toFixed(1)}" class="chart-axis-label" text-anchor="middle" font-weight="800">${c.count}</text>`;
    }
    xLabels += `<text x="${cx.toFixed(1)}" y="${labelY.toFixed(1)}" class="chart-axis-label" text-anchor="end" transform="rotate(-40 ${cx.toFixed(1)} ${labelY.toFixed(1)})">${escapeHtml(c.label)}</text>`;
  });

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" class="bar-chart-svg" role="img" aria-label="Grafik batang absensi personel per kategori">
      ${gridlines}
      ${yLabels}
      ${bars}
      ${valueLabels}
      ${xLabels}
    </svg>
    <div class="chart-tooltip" id="statusBarChartTooltip" style="display:none;"></div>
  `;

  wireStatusBarChartTooltip(categories);
}

function wireStatusBarChartTooltip(categories) {
  const wrap = document.getElementById('statusBarChart');
  const tooltip = document.getElementById('statusBarChartTooltip');
  const groups = wrap.querySelectorAll('.chart-bar-group');

  function showTooltip(group) {
    const idx = Number(group.dataset.index);
    const c = categories[idx];
    if (!c) return;

    tooltip.innerHTML = '';
    const valueEl = document.createElement('div');
    valueEl.className = 'chart-tooltip-value';
    valueEl.textContent = `${c.count} personel`;
    const labelEl = document.createElement('div');
    labelEl.className = 'chart-tooltip-label';
    labelEl.textContent = `${c.label} -- klik untuk lihat detail`;
    tooltip.appendChild(valueEl);
    tooltip.appendChild(labelEl);
    tooltip.style.display = 'block';

    const hitRect = group.querySelector('.chart-bar-hit').getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    tooltip.style.left = `${hitRect.left - wrapRect.left + hitRect.width / 2}px`;
    tooltip.style.top = `${hitRect.top - wrapRect.top}px`;

    group.classList.add('is-hovered');
  }

  function hideTooltip(group) {
    tooltip.style.display = 'none';
    group.classList.remove('is-hovered');
  }

  function activate(group) {
    const idx = Number(group.dataset.index);
    const c = categories[idx];
    if (c) openStatusListModal(c.key);
  }

  groups.forEach((group) => {
    group.addEventListener('pointerenter', () => showTooltip(group));
    group.addEventListener('pointerleave', () => hideTooltip(group));
    group.addEventListener('focus', () => showTooltip(group));
    group.addEventListener('blur', () => hideTooltip(group));
    group.addEventListener('click', () => activate(group));
    group.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      activate(group);
    });
  });
}

function statusOptionsHtml(currentStatus) {
  const options = ['<option value="">- Pilih -</option>']
    .concat(STATUS_ORDER.map((s) => `<option value="${s}" ${currentStatus === s ? 'selected' : ''}>${escapeHtml(STATUS_LABELS[s])}</option>`));
  return options.join('');
}

// Tanda kecil di sebelah nama untuk personel yang sudah punya indikasi
// hasil analisa intelijen (lihat "Analisa Intelijen" di Kelola Personel) --
// warna & label sama seperti lencana Bank Data, supaya konsisten.
// Personel yang belum dianalisa (security_category kosong) tidak diberi
// tanda apa pun di sini, supaya tabel absensi harian tidak penuh lencana.
function personnelNameHtml(r) {
  const mark = r.security_category
    ? ` <span class="badge ${securityCategoryBadgeClass(r.security_category)}" style="margin-left:6px;">${escapeHtml(securityCategoryLabel(r.security_category))}</span>`
    : '';
  return `${escapeHtml(r.full_name)}${mark}`;
}

// Baris personel dibuat sebagai flex-row ("kartu baris"), BUKAN <table>, supaya
// seluruh kontrol (status, keterangan, aksi) muat tanpa perlu scroll ke samping
// di layar sempit/HP -- sebelumnya kolom Status Absensi & Keterangan ada jauh
// di kanan tabel lebar, harus discroll dulu untuk dicapai. Status dipindah ke
// dekat "No" (kiri), dan Keterangan ditampilkan langsung sebagai teks di bawah
// nama (bukan kolom lebar sendiri) -- diedit lewat tombol catatan yang membuka
// baris input kecil di bawahnya, bukan input yang selalu memakan lebar baris.
function personnelRowHtml(r, no) {
  const metaParts = [r.rank_info || '-', r.position].filter(Boolean);
  if (r.personnel_notes) metaParts.push(r.personnel_notes);
  const metaHtml = metaParts.map((p) => escapeHtml(p)).join(' &middot; ');
  const hasNote = !!(r.attendance_notes && r.attendance_notes.trim());

  if (!canEditAttendance) {
    return `
      <div class="attn-row" data-personnel-id="${r.personnel_id}">
        <div class="attn-no-status">
          <span class="attn-no no-with-warning"><span class="attn-no-text">${no}</span>${securityCategoryWarningIconHtml(r.security_category)}</span>
          ${statusBadgeHtml(r.status)}
        </div>
        <div class="attn-person">
          <div class="attn-person-name">${personnelNameHtml(r)}</div>
          <div class="attn-person-meta">${metaHtml}</div>
          ${hasNote ? `<div class="attn-person-note">${icon('note')} ${escapeHtml(r.attendance_notes)}</div>` : ''}
        </div>
      </div>
    `;
  }

  return `
    <div class="attn-row" data-personnel-id="${r.personnel_id}">
      <div class="attn-no-status">
        <span class="attn-no no-with-warning"><span class="attn-no-text">${no}</span>${securityCategoryWarningIconHtml(r.security_category)}</span>
        <select class="attendance-status-select attn-status-select" data-personnel-id="${r.personnel_id}">${statusOptionsHtml(r.status)}</select>
      </div>
      <div class="attn-person">
        <div class="attn-person-name-row">
          <div class="attn-person-name">${personnelNameHtml(r)}</div>
          <span class="attendance-row-flash" data-flash-for="${r.personnel_id}"></span>
        </div>
        <div class="attn-person-meta">${metaHtml}</div>
        ${hasNote ? `<div class="attn-person-note">${icon('note')} ${escapeHtml(r.attendance_notes)}</div>` : ''}
      </div>
      <div class="attn-row-tools">
        <button type="button" class="attn-icon-btn attn-note-btn${hasNote ? ' has-note' : ''}" data-personnel-id="${r.personnel_id}" title="Keterangan">${icon('note')}</button>
        <button type="button" class="attn-icon-btn attn-range-btn" data-id="${r.personnel_id}" data-name="${escapeHtml(r.full_name)}" title="Isi rentang tanggal">${icon('calendar')}</button>
        <span class="drag-handle attn-icon-btn" draggable="true" title="Geser untuk urutkan">${icon('grip')}</span>
        <button type="button" class="attn-icon-btn edit-personnel-btn" data-id="${r.personnel_id}" title="Edit personel">${icon('pencil')}</button>
        <button type="button" class="attn-icon-btn attn-icon-btn-danger delete-personnel-btn" data-id="${r.personnel_id}" data-name="${escapeHtml(r.full_name)}" title="Hapus personel">${icon('trash')}</button>
      </div>
      <div class="attn-note-edit-row" data-note-row-for="${r.personnel_id}" hidden>
        <input type="text" class="attendance-notes-input" data-personnel-id="${r.personnel_id}" maxlength="255" placeholder="Keterangan (opsional)" value="${escapeHtml(r.attendance_notes || '')}">
      </div>
    </div>
  `;
}

function categoryCardHtml(category, members, startNo) {
  const rowsHtml = members.map((r, i) => personnelRowHtml(r, startNo + i)).join('');
  return `
    <div class="form-card" style="margin-bottom:20px;">
      <div class="section">
        <div class="section-header-row">
          <h2 class="section-title">${escapeHtml(category)} <span class="optional-badge">${members.length} personel</span></h2>
          ${canEditAttendance ? `<button type="button" class="btn btn-small add-personnel-btn" data-category="${escapeHtml(category)}">+ Tambah Personel</button>` : ''}
        </div>
        ${canEditAttendance ? `<p class="page-description" style="margin:-6px 0 14px;">Geser ikon <span style="display:inline-flex;vertical-align:middle;">${icon('grip')}</span> untuk mengurutkan personel (mis. berdasarkan senioritas pangkat/NRP). Ikon <span style="display:inline-flex;vertical-align:middle;">${icon('calendar')}</span> mengisi status untuk rentang beberapa tanggal sekaligus (mis. Cuti/Dinas Luar).</p>` : ''}
        <div class="attn-group-rows" data-category="${escapeHtml(category)}">${rowsHtml}</div>
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
  groupsContainer.querySelectorAll('.attn-note-btn').forEach((btn) => {
    btn.addEventListener('click', () => toggleNoteRow(Number(btn.dataset.personnelId)));
  });
  groupsContainer.querySelectorAll('.attn-range-btn').forEach((btn) => {
    btn.addEventListener('click', () => openRangeModal(Number(btn.dataset.id), btn.dataset.name));
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
  groupsContainer.querySelectorAll('.attn-group-rows[data-category]').forEach((rowsWrap) => {
    wireDragReorder(rowsWrap, rowsWrap.dataset.category);
  });
}

// Tombol catatan ("Keterangan") membuka/menutup baris input kecil di bawah
// baris personel itu, bukan kolom lebar yang selalu tampil -- supaya baris
// tetap ringkas dan tidak memaksa scroll ke samping (lihat personnelRowHtml).
function toggleNoteRow(personnelId) {
  const noteRow = groupsContainer.querySelector(`.attn-note-edit-row[data-note-row-for="${personnelId}"]`);
  if (!noteRow) return;
  noteRow.hidden = !noteRow.hidden;
  if (!noteRow.hidden) noteRow.querySelector('.attendance-notes-input').focus();
}

// Perbarui pratinjau teks Keterangan & status tombol catatan tanpa me-render
// ulang seluruh daftar (supaya pesan "Tersimpan" di saveEntry() tidak
// langsung hilang tertimpa render ulang).
function updateNotePreview(personnelId) {
  const row = document.querySelector(`.attn-row[data-personnel-id="${personnelId}"]`);
  if (!row) return;
  const rowData = rows.find((r) => r.personnel_id === personnelId);
  const hasNote = !!(rowData && rowData.attendance_notes && rowData.attendance_notes.trim());

  const noteBtn = row.querySelector('.attn-note-btn');
  if (noteBtn) noteBtn.classList.toggle('has-note', hasNote);

  let previewEl = row.querySelector('.attn-person-note');
  if (hasNote) {
    if (!previewEl) {
      previewEl = document.createElement('div');
      previewEl.className = 'attn-person-note';
      row.querySelector('.attn-person').appendChild(previewEl);
    }
    previewEl.innerHTML = `${icon('note')} ${escapeHtml(rowData.attendance_notes)}`;
  } else if (previewEl) {
    previewEl.remove();
  }
}

// ---- Geser-urutkan (drag-and-drop) personel per kelompok -- supaya bisa
// diurutkan manual mengikuti senioritas pangkat/NRP, bukan cuma urutan saat
// data dimasukkan. Hanya bisa digeser DI DALAM kelompok/kategori yang sama
// (tidak memindahkan personel ke kategori lain lewat geser).
let draggedRow = null;

function wireDragReorder(rowsWrap, category) {
  Array.from(rowsWrap.children).forEach((row) => {
    const handle = row.querySelector('.drag-handle');
    if (!handle) return;

    handle.addEventListener('dragstart', (e) => {
      draggedRow = row;
      row.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', row.dataset.personnelId);
    });
    handle.addEventListener('dragend', () => {
      row.classList.remove('is-dragging');
      if (draggedRow === row) {
        saveReorder(rowsWrap, category);
        draggedRow = null;
      }
    });

    row.addEventListener('dragover', (e) => {
      if (!draggedRow || draggedRow === row || draggedRow.parentElement !== rowsWrap) return;
      e.preventDefault();
      const rect = row.getBoundingClientRect();
      const before = (e.clientY - rect.top) / rect.height < 0.5;
      rowsWrap.insertBefore(draggedRow, before ? row : row.nextSibling);
    });
  });
}

async function saveReorder(rowsWrap, category) {
  const personnelIds = Array.from(rowsWrap.children).map((row) => Number(row.dataset.personnelId));

  // Perbarui angka "No" langsung di tampilan tanpa menunggu server, supaya
  // terasa responsif selagi tersimpan di belakang layar. Diambil dari nilai
  // TERKECIL yang sudah ada (bukan cuma baris pertama) karena baris yang
  // tadinya di posisi pertama bisa saja ikut tergeser oleh drag ini.
  const existingNumbers = Array.from(rowsWrap.children).map((row) => Number(row.querySelector('.attn-no-text').textContent));
  const firstNo = Math.min(...existingNumbers);
  Array.from(rowsWrap.children).forEach((row, i) => { row.querySelector('.attn-no-text').textContent = firstNo + i; });

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
  const row = document.querySelector(`.attn-row[data-personnel-id="${personnelId}"]`);
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
    updateNotePreview(personnelId);
    const noteRow = row.querySelector('.attn-note-edit-row');
    if (noteRow) noteRow.hidden = true;

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
  hadir: 'badge-green', wfh: 'badge-teal', dinas_dalam: 'badge-blue', dinas_luar: 'badge-blue', sakit: 'badge-red', ijin: 'badge-amber',
  cuti: 'badge-amber', pendidikan: 'badge-purple', bko: 'badge-gray', libur: 'badge-pink', terlambat: 'badge-amber', tanpa_keterangan: 'badge-red',
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
        <td>${personnelNameHtml(r)}</td>
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

// Dukung "?date=YYYY-MM-DD" di URL supaya bisa klik-tembus langsung ke
// tanggal tertentu (dipakai dari grafik Tren Kehadiran Personel di dashboard).
const presetDate = new URLSearchParams(window.location.search).get('date');
dateInput.value = /^\d{4}-\d{2}-\d{2}$/.test(presetDate || '') ? presetDate : todayDateString();
load();

// ---- Cetak Laporan (PDF/Excel) -- rekap kehadiran per rentang tanggal ----
// Dibuka dengan rentang default satu minggu (Senin-Minggu) yang mencakup
// tanggal yang sedang dilihat di halaman, boleh diubah bebas sebelum
// diunduh. File-nya dibuat di backend (lihat GET /api/attendance/export),
// di sini cuma memicu unduhannya lewat downloadFile() yang sudah ada.
function mondayOf(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const day = dt.getDay();
  const diffToMonday = (day === 0 ? -6 : 1) - day;
  dt.setDate(dt.getDate() + diffToMonday);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}
function addDaysLocal(dateStr, amount) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + amount);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

const exportReportModal = document.getElementById('exportReportModal');
const exportFromDate = document.getElementById('exportFromDate');
const exportToDate = document.getElementById('exportToDate');

function openExportReportModal() {
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(dateInput.value) ? dateInput.value : todayDateString();
  const monday = mondayOf(anchor);
  exportFromDate.value = monday;
  exportToDate.value = addDaysLocal(monday, 6);
  exportReportModal.classList.add('open');
}
function closeExportReportModal() {
  exportReportModal.classList.remove('open');
}

async function downloadAttendanceReport(format, ext) {
  const from = exportFromDate.value;
  const to = exportToDate.value;
  if (!from || !to) {
    showMessage('Isi tanggal "Dari" dan "Sampai" terlebih dahulu.', true);
    return;
  }
  if (from > to) {
    showMessage('Tanggal "Dari" tidak boleh setelah tanggal "Sampai".', true);
    return;
  }
  resultBox.style.display = 'none';
  try {
    const params = new URLSearchParams({ from, to, format });
    await downloadFile(`/attendance/export?${params.toString()}`, `rekap-absensi-${from}-sd-${to}.${ext}`);
    closeExportReportModal();
  } catch (err) {
    showMessage(err.message, true);
  }
}

document.getElementById('exportReportBtn').addEventListener('click', openExportReportModal);
document.getElementById('exportReportCloseIconSlot').innerHTML = icon('close');
document.getElementById('exportReportCloseBtn').addEventListener('click', closeExportReportModal);
exportReportModal.addEventListener('click', (e) => { if (e.target === exportReportModal) closeExportReportModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && exportReportModal.classList.contains('open')) closeExportReportModal(); });
document.getElementById('exportXlsxBtn').addEventListener('click', () => downloadAttendanceReport('xlsx', 'xlsx'));
document.getElementById('exportPdfBtn').addEventListener('click', () => downloadAttendanceReport('pdf', 'pdf'));

// ---- Isi Rentang Tanggal (Cuti/Dinas Luar/Pendidikan/Ijin, dst.) ----
// Menerapkan satu status (& keterangan) yang sama untuk satu ATAU BEBERAPA
// personel sekaligus di banyak tanggal lewat POST /attendance/save-range --
// supaya tidak perlu membuka tiap tanggal satu per satu untuk personel yang
// sedang cuti/dinas luar/pendidikan/ijin berhari-hari, dan kalau beberapa
// personel ikut kegiatan/Dinas Luar yang SAMA, tanggalnya bisa langsung
// disinkronkan ke semua personel itu dalam satu kali "Terapkan" (dicentang
// lewat daftar personel di bawah form, bukan harus diulang satu-satu).
let rangeTargetPersonnelId = null;
const rangeModal = document.getElementById('rangeModal');
const rangeForm = document.getElementById('rangeForm');
const rangeStatus = document.getElementById('rangeStatus');
const rangeFromDate = document.getElementById('rangeFromDate');
const rangeToDate = document.getElementById('rangeToDate');
const rangeNotes = document.getElementById('rangeNotes');
const rangePersonnelSearch = document.getElementById('rangePersonnelSearch');
const rangePersonnelList = document.getElementById('rangePersonnelList');
const rangeSyncHint = document.getElementById('rangeSyncHint');

// true setelah pengguna MENGUBAH SENDIRI tanggal dari/sampai -- dipakai
// supaya sinkronisasi otomatis (lihat lookupRangeSync) tidak menimpa
// tanggal yang memang sudah sengaja diubah manual.
let rangeDatesTouched = false;
rangeFromDate.addEventListener('input', () => { rangeDatesTouched = true; });
rangeToDate.addEventListener('input', () => { rangeDatesTouched = true; });

function rangePersonnelListHtml() {
  const groups = [];
  const indexByCategory = {};
  rows.forEach((r) => {
    if (!(r.category in indexByCategory)) {
      indexByCategory[r.category] = groups.length;
      groups.push({ category: r.category, members: [] });
    }
    groups[indexByCategory[r.category]].members.push(r);
  });

  return groups
    .map((g) => `
      <div class="range-personnel-group">
        <div class="range-personnel-group-title">${escapeHtml(g.category)}</div>
        ${g.members
          .map((r) => {
            const isPrimary = r.personnel_id === rangeTargetPersonnelId;
            return `
              <label class="range-personnel-item${isPrimary ? ' is-primary' : ''}" data-search="${escapeHtml(r.full_name.toLowerCase())}">
                <input type="checkbox" value="${r.personnel_id}" ${isPrimary ? 'checked disabled' : ''}>
                <span>${escapeHtml(r.full_name)}${isPrimary ? ' <span class="label-note">(personel ini)</span>' : ''}</span>
              </label>
            `;
          })
          .join('')}
      </div>
    `)
    .join('');
}

function filterRangePersonnelList() {
  const q = rangePersonnelSearch.value.trim().toLowerCase();
  rangePersonnelList.querySelectorAll('.range-personnel-group').forEach((group) => {
    let anyVisible = false;
    group.querySelectorAll('.range-personnel-item').forEach((item) => {
      const match = !q || item.dataset.search.includes(q);
      item.style.display = match ? '' : 'none';
      if (match) anyVisible = true;
    });
    group.style.display = anyVisible ? '' : 'none';
  });
}

function openRangeModal(personnelId, personnelName) {
  resultBox.style.display = 'none';
  rangeTargetPersonnelId = personnelId;
  document.getElementById('rangeModalTitle').textContent = `Isi Rentang Tanggal -- ${personnelName}`;
  rangeForm.reset();
  rangeDatesTouched = false;
  rangeSyncHint.innerHTML = '';

  // Status & Keterangan personel ini pada tanggal yang sedang dilihat dipakai
  // sebagai awalan -- kalau sudah diisi lewat baris hariannya, tidak perlu
  // diketik ulang di sini, tinggal disesuaikan rentang tanggalnya.
  const current = rows.find((r) => r.personnel_id === personnelId);
  rangeStatus.innerHTML = statusOptionsHtml(current ? current.status : null);
  rangeNotes.value = (current && current.attendance_notes) || '';

  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(dateInput.value) ? dateInput.value : todayDateString();
  rangeFromDate.value = anchor;
  rangeToDate.value = anchor;

  rangePersonnelSearch.value = '';
  rangePersonnelList.innerHTML = rangePersonnelListHtml();

  rangeModal.classList.add('open');

  // Kalau Keterangan sudah terisi (dari baris harian di atas) dan PERSIS
  // sama dengan kegiatan personel lain, langsung sinkronkan begitu modal
  // dibuka -- tidak perlu menunggu pengguna mengetik ulang.
  if (rangeNotes.value.trim().length >= 3) lookupRangeSync(rangeNotes.value.trim());
}

function closeRangeModal() {
  rangeModal.classList.remove('open');
  rangeTargetPersonnelId = null;
}

rangePersonnelSearch.addEventListener('input', filterRangePersonnelList);

// ---- Sinkronisasi otomatis lewat kecocokan Keterangan -----------------
// Kalau Keterangan yang diketik PERSIS SAMA (tanpa peduli besar/kecil huruf)
// dengan kegiatan yang sudah pernah diisi untuk personel lain (mis. "Satgas
// Siber Koops TNI Timika" milik Kapten Hafizh), rentang tanggal & personel
// yang terlibat otomatis disalin dari situ -- supaya tidak perlu dicari
// manual tanggal berapa personel lain itu sudah diisi untuk kegiatan yang
// sama persis.
let rangeSyncTimer = null;
rangeNotes.addEventListener('input', () => {
  clearTimeout(rangeSyncTimer);
  rangeSyncHint.innerHTML = '';
  const q = rangeNotes.value.trim();
  if (q.length < 3) return;
  rangeSyncTimer = setTimeout(() => lookupRangeSync(q), 400);
});

async function lookupRangeSync(q) {
  let match;
  try {
    const res = await api(`/attendance/find-by-notes?q=${encodeURIComponent(q)}&exclude_personnel_id=${rangeTargetPersonnelId}`);
    match = res && res.data;
  } catch (err) {
    return; // cuma bantuan, bukan validasi wajib -- diam saja kalau gagal
  }
  // Keterangan di kolom bisa saja sudah berubah lagi selagi menunggu respons
  // server (pengguna lanjut mengetik) -- batalkan kalau sudah tidak relevan.
  if (!match || rangeNotes.value.trim().toLowerCase() !== q.toLowerCase()) return;

  if (!rangeDatesTouched) {
    rangeFromDate.value = match.date_from;
    rangeToDate.value = match.date_to;
  }
  if (STATUS_ORDER.includes(match.status)) rangeStatus.value = match.status;
  match.personnel.forEach((p) => {
    const cb = rangePersonnelList.querySelector(`input[type="checkbox"][value="${p.id}"]`);
    if (cb && !cb.disabled) cb.checked = true;
  });

  const names = match.personnel.map((p) => p.full_name).join(', ');
  rangeSyncHint.innerHTML = `${icon('check')}<span>Disinkronkan dengan kegiatan yang sama milik <strong>${escapeHtml(names)}</strong>: ${formatDateRangeLabel(match.date_from, match.date_to)}.</span>`;
}

rangeForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (rangeTargetPersonnelId === null) return;
  resultBox.style.display = 'none';

  if (!rangeStatus.value) {
    showMessage('Pilih status absensi terlebih dahulu.', true);
    return;
  }
  if (rangeFromDate.value > rangeToDate.value) {
    showMessage('Tanggal "Dari" tidak boleh setelah tanggal "Sampai".', true);
    return;
  }
  const personnelIds = Array.from(rangePersonnelList.querySelectorAll('input[type="checkbox"]:checked')).map((cb) => Number(cb.value));

  try {
    const res = await api('/attendance/save-range', {
      method: 'POST',
      body: JSON.stringify({
        personnel_ids: personnelIds,
        status: rangeStatus.value,
        notes: rangeNotes.value.trim() || null,
        date_from: rangeFromDate.value,
        date_to: rangeToDate.value,
      }),
    });
    const days = res && res.data ? res.data.days : 0;
    const personLabel = personnelIds.length > 1 ? `${personnelIds.length} personel` : '1 personel';
    showMessage(`Status "${STATUS_LABELS[rangeStatus.value]}" diterapkan untuk ${personLabel}, ${days} hari (${formatDateRangeLabel(rangeFromDate.value, rangeToDate.value)}).`, false);
    closeRangeModal();
    // Muat ulang kalau tanggal yang sedang dilihat ada di dalam rentang yang
    // baru diisi, supaya langsung terlihat berubah tanpa pindah tanggal dulu.
    if (dateInput.value >= rangeFromDate.value && dateInput.value <= rangeToDate.value) load();
  } catch (err) {
    showMessage(err.message, true);
  }
});

function formatDateRangeLabel(from, to) {
  if (from === to) return formatDate(from);
  return `${formatDate(from)} s.d. ${formatDate(to)}`;
}

document.getElementById('rangeModalCloseIconSlot').innerHTML = icon('close');
document.getElementById('rangeModalCloseBtn').addEventListener('click', closeRangeModal);
document.getElementById('rangeCancelBtn').addEventListener('click', closeRangeModal);
rangeModal.addEventListener('click', (e) => { if (e.target === rangeModal) closeRangeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && rangeModal.classList.contains('open')) closeRangeModal(); });
