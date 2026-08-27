requireAuth();
requireRole('admin', 'verifikator');
renderNav('bank-data.html');

const searchInput = document.getElementById('searchInput');
const categoryFilter = document.getElementById('categoryFilter');
const groupsContainer = document.getElementById('groupsContainer');
const summaryLine = document.getElementById('summaryLine');
const resultBox = document.getElementById('resultBox');

const editPanel = document.getElementById('editPanel');
const editPersonName = document.getElementById('editPersonName');
const editAffiliation = document.getElementById('editAffiliation');
const editCategory = document.getElementById('editCategory');
const editAnalysisNotes = document.getElementById('editAnalysisNotes');

let editingGuestId = null;
let editingMemberId = null;
let debounceTimer = null;

function showMessage(message, isError) {
  resultBox.style.display = 'block';
  resultBox.textContent = message;
  resultBox.classList.toggle('error-box', !!isError);
}

function groupCardHTML(group) {
  const rows = group.members
    .map(
      (m) => `
    <tr>
      <td><a class="link" href="bank-data-personnel.html?nik=${encodeURIComponent(m.nik)}&member_id=${encodeURIComponent(m.id)}">${escapeHtml(m.full_name)}</a></td>
      <td>
        ${escapeHtml(m.nik)}
        ${m.nik_shared_by_multiple_names ? '<span title="NIK ini juga tercatat dengan nama berbeda pada pendaftaran lain — periksa kembali" style="color: var(--danger); cursor:help;"> ⚠</span>' : ''}
      </td>
      <td>${escapeHtml(m.position)}</td>
      <td>${escapeHtml(m.phone_number)}</td>
      <td>${escapeHtml(m.affiliation || '-')}</td>
      <td><span class="badge ${securityCategoryBadgeClass(m.security_category)}">${escapeHtml(securityCategoryLabel(m.security_category))}</span></td>
      <td>${m.visit_count}x</td>
      <td>${formatDateTime(m.last_visit_at)}</td>
      <td>
        <button class="btn btn-small manage-btn"
          data-guest-id="${m.guest_id}"
          data-member-id="${m.id}"
          data-name="${escapeHtml(m.full_name)}"
          data-affiliation="${escapeHtml(m.affiliation || '')}"
          data-category="${escapeHtml(m.security_category || '')}"
          data-notes="${escapeHtml(m.analysis_notes || '')}"
        >Kelola Analisa</button>
      </td>
    </tr>
  `
    )
    .join('');

  return `
    <div class="form-card" style="margin-bottom:20px;">
      <div class="section">
        <div class="section-header-row">
          <h2 class="section-title">${escapeHtml(group.company)} <span class="optional-badge">${group.members.length} catatan</span></h2>
          <button type="button" class="btn btn-small download-group-btn" data-company="${escapeHtml(group.company)}">Unduh PDF Kelompok</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nama</th>
                <th>NIK</th>
                <th>Jabatan</th>
                <th>No. HP</th>
                <th>Afiliasi</th>
                <th>Kategori</th>
                <th>Kunjungan</th>
                <th>Terakhir</th>
                <th></th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

async function load() {
  groupsContainer.innerHTML = '<p class="page-description">Memuat data...</p>';
  try {
    const params = new URLSearchParams({
      ...(searchInput.value.trim() ? { q: searchInput.value.trim() } : {}),
      ...(categoryFilter.value ? { category: categoryFilter.value } : {}),
    });
    const res = await api(`/bank-data?${params.toString()}`);

    summaryLine.textContent = `${res.total_records} catatan pendaftaran (${res.total_unique_nik} NIK unik) dalam ${res.total_groups} kelompok perusahaan. Satu baris = satu kali kunjungan; NIK yang sama bisa muncul lebih dari sekali.`;

    if (!res.data.length) {
      groupsContainer.innerHTML = '<p class="page-description">Tidak ada data personel ditemukan.</p>';
      return;
    }

    groupsContainer.innerHTML = res.data.map(groupCardHTML).join('');

    document.querySelectorAll('.manage-btn').forEach((btn) => {
      btn.addEventListener('click', () => openEdit(btn.dataset));
    });

    document.querySelectorAll('.download-group-btn').forEach((btn) => {
      btn.addEventListener('click', () => downloadGroupPdf(btn.dataset.company));
    });
  } catch (err) {
    groupsContainer.innerHTML = `<p class="page-description" style="color: var(--danger);">${escapeHtml(err.message)}</p>`;
  }
}

function openEdit(data) {
  editingGuestId = data.guestId;
  editingMemberId = data.memberId;
  editPersonName.textContent = data.name;
  editAffiliation.value = data.affiliation || '';
  editCategory.value = data.category || '';
  editAnalysisNotes.value = data.notes || '';
  editPanel.style.display = 'block';
  editPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function closeEdit() {
  editingGuestId = null;
  editingMemberId = null;
  editPanel.style.display = 'none';
}

document.getElementById('cancelEditBtn').addEventListener('click', closeEdit);

document.getElementById('saveEditBtn').addEventListener('click', async () => {
  resultBox.style.display = 'none';
  const payload = {
    affiliation: editAffiliation.value.trim() || null,
    analysis_notes: editAnalysisNotes.value.trim() || null,
    security_category: editCategory.value || null,
  };

  try {
    await api(`/guests/${editingGuestId}/members/${editingMemberId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    showMessage('Hasil analisa berhasil disimpan.', false);
    closeEdit();
    load();
  } catch (err) {
    showMessage(err.message, true);
  }
});

searchInput.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(load, 350);
});

categoryFilter.addEventListener('change', load);

async function downloadGroupPdf(company) {
  resultBox.style.display = 'none';
  try {
    const params = new URLSearchParams({ format: 'pdf', scope: 'company', company });
    await downloadFile(`/bank-data/export?${params.toString()}`, `bank-data-${company}.pdf`);
  } catch (err) {
    showMessage(err.message, true);
  }
}

document.getElementById('downloadAllBtn').addEventListener('click', async () => {
  resultBox.style.display = 'none';
  try {
    const params = new URLSearchParams({
      format: 'pdf',
      scope: 'all',
      ...(searchInput.value.trim() ? { q: searchInput.value.trim() } : {}),
      ...(categoryFilter.value ? { category: categoryFilter.value } : {}),
    });
    await downloadFile(`/bank-data/export?${params.toString()}`, 'bank-data-lengkap.pdf');
  } catch (err) {
    showMessage(err.message, true);
  }
});

const initialQuery = new URLSearchParams(window.location.search).get('q');
if (initialQuery) searchInput.value = initialQuery;

load();
