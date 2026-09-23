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

  const chips = STATUS_ORDER.map(
    (s) => `<div class="attendance-summary-chip"><span class="chip-count">${counts[s]}</span><span class="chip-label">${escapeHtml(STATUS_LABELS[s])}</span></div>`
  );
  chips.push(`<div class="attendance-summary-chip"><span class="chip-count">${belumDiisi}</span><span class="chip-label">Belum Diisi</span></div>`);
  chips.push(`<div class="attendance-summary-chip"><span class="chip-count">${rows.length}</span><span class="chip-label">Total Personel</span></div>`);
  summaryRow.innerHTML = chips.join('');
}

function statusOptionsHtml(currentStatus) {
  const options = ['<option value="">- Pilih -</option>']
    .concat(STATUS_ORDER.map((s) => `<option value="${s}" ${currentStatus === s ? 'selected' : ''}>${escapeHtml(STATUS_LABELS[s])}</option>`));
  return options.join('');
}

function personnelRowHtml(r, no) {
  return `
    <tr data-personnel-id="${r.personnel_id}">
      <td>${no}</td>
      <td>${escapeHtml(r.full_name)}</td>
      <td>${escapeHtml(r.rank_info || '-')}</td>
      <td>${escapeHtml(r.position)}${r.personnel_notes ? ` <span class="label-note">(${escapeHtml(r.personnel_notes)})</span>` : ''}</td>
      <td class="attendance-status-cell">
        <select class="attendance-status-select" data-personnel-id="${r.personnel_id}">${statusOptionsHtml(r.status)}</select>
        <span class="attendance-row-flash" data-flash-for="${r.personnel_id}"></span>
      </td>
      <td><input type="text" class="attendance-notes-input" data-personnel-id="${r.personnel_id}" maxlength="255" placeholder="Keterangan (opsional)" value="${escapeHtml(r.attendance_notes || '')}"></td>
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
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th style="width:40px;">No</th>
                <th>Nama</th>
                <th>Pangkat/Korps/NRP/NIP</th>
                <th>Jabatan</th>
                <th style="width:220px;">Status Absensi</th>
                <th>Keterangan</th>
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
}

async function load() {
  groupsContainer.innerHTML = '<div class="form-card"><div class="section">Memuat data...</div></div>';
  try {
    const res = await api(`/attendance?date=${dateInput.value}`);
    rows = res.data;
    renderGroups();
    renderSummary();
  } catch (err) {
    groupsContainer.innerHTML = '';
    showMessage(err.message, true);
  }
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

dateInput.value = todayDateString();
load();
