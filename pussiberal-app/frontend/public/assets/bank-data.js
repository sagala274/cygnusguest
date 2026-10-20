requireAuth();
requireRole('admin', 'verifikator', 'pimpinan');
renderNav('bank-data');

const user = getUser();
const isAdmin = user && user.role === 'admin';
// Pimpinan hanya boleh MELIHAT data & analisa -- tidak boleh
// mengubah kategori/keterangan analisa maupun profiling perusahaan.
const canEditAnalysis = user && ['admin', 'verifikator'].includes(user.role);

// Kelompok "Lainnya" (tamu tanpa afiliasi instansi) menggabungkan banyak
// nilai company mentah yang berbeda (kosong, "pribadi", "umum", dst) --
// tidak bisa diubah/dihapus sebagai satu nama perusahaan lewat sini.
const INDEPENDENT_GROUP_LABEL = 'Lainnya';

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

const companyProfileModal = document.getElementById('companyProfileModal');
const profileCompanyName = document.getElementById('profileCompanyName');
const profileNotes = document.getElementById('profileNotes');
const profileResultBox = document.getElementById('profileResultBox');

// Field teks/textarea biasa (key field di database -> id elemen input-nya)
// pada "Rancangan Formulir Profiling Perusahaan" -- dipetakan di sini
// (bukan ditulis berulang satu-satu) supaya populate (openCompanyProfile)
// dan collect (tombol Simpan) sama-sama tinggal loop lewat daftar ini.
// security_category (radio) & profiling_notes ditangani terpisah di bawah
// karena bentuknya beda (bagian "5. Kesimpulan Profiling").
const PROFILE_TEXT_FIELD_IDS = {
  official_name: 'profileOfficialName',
  business_field: 'profileBusinessField',
  founded_year: 'profileFoundedYear',
  head_office_address: 'profileHeadOfficeAddress',
  website: 'profileWebsite',
  company_phone: 'profileCompanyPhone',
  nib: 'profileNib',
  director_name: 'profileDirectorName',
  representative_name: 'profileRepresentativeName',
  legal_notes: 'profileLegalNotes',
  relationship_target_unit: 'profileRelationshipTargetUnit',
  relationship_basis: 'profileRelationshipBasis',
  internal_contact: 'profileInternalContact',
  track_record_notes: 'profileTrackRecordNotes',
  information_sources: 'profileInformationSources',
};
const PROFILE_SELECT_FIELD_IDS = {
  company_type: 'profileCompanyType',
  legal_status: 'profileLegalStatus',
  relationship_status: 'profileRelationshipStatus',
  visit_history: 'profileVisitHistory',
  public_check_result: 'profilePublicCheckResult',
  data_consistency: 'profileDataConsistency',
};

// Semua kolom "isi" company_profiles (bukan metadata seperti id/updated_by/
// created_at/updated_at) -- dipakai groupCardHTML() untuk menentukan apakah
// kartu perusahaan ini sudah punya data profiling untuk ditampilkan.
const PROFILE_CONTENT_KEYS = new Set([
  ...Object.keys(PROFILE_TEXT_FIELD_IDS),
  ...Object.keys(PROFILE_SELECT_FIELD_IDS),
  'security_category',
  'profiling_notes',
]);

// Label yang enak dibaca untuk tiap nilai ENUM -- dipakai ringkasan hasil
// profiling di kartu perusahaan (bukan nilai mentah "bumn_bumd").
const COMPANY_TYPE_LABELS = {
  swasta: 'Swasta', bumn_bumd: 'BUMN/BUMD', instansi_pemerintah: 'Instansi Pemerintah',
  pendidikan: 'Pendidikan', organisasi_lsm: 'Organisasi/LSM', perorangan: 'Perorangan', lainnya: 'Lainnya',
};
const LEGAL_STATUS_LABELS = {
  terverifikasi: 'Terverifikasi', belum_terverifikasi: 'Belum Terverifikasi', tidak_valid: 'Tidak Valid/Bermasalah',
};
const RELATIONSHIP_STATUS_LABELS = {
  mitra_aktif: 'Mitra Aktif', calon_mitra: 'Calon Mitra',
  tidak_ada_hubungan_khusus: 'Tidak Ada Hubungan Khusus', perlu_tindak_lanjut: 'Perlu Tindak Lanjut',
};
const VISIT_HISTORY_LABELS = { baru_pertama_kali: 'Baru Pertama Kali', beberapa_kali: 'Beberapa Kali', rutin: 'Rutin/Berkala' };
const PUBLIC_CHECK_RESULT_LABELS = {
  tidak_ada_masalah: 'Tidak Ditemukan Masalah', ada_catatan: 'Ada Catatan Minor', perlu_pendalaman: 'Perlu Pendalaman Lebih Lanjut',
};
const DATA_CONSISTENCY_LABELS = { konsisten: 'Konsisten', sebagian_konsisten: 'Sebagian Konsisten', tidak_konsisten: 'Tidak Konsisten' };

// Field mana masuk bagian mana, dipakai untuk menyusun ringkasan hasil
// profiling di kartu perusahaan (groupCardHTML) -- urutan & pengelompokan
// sama persis dengan modal "Rancangan Formulir Profiling Perusahaan".
// "long: true" ditampilkan disusun ke bawah (seperti Hasil Analisa di
// Detail Tamu), field lain sejajar label-nilai karena biasanya pendek.
const COMPANY_PROFILE_SUMMARY_SECTIONS = [
  {
    title: '1. Identitas Perusahaan',
    fields: [
      ['official_name', 'Nama Resmi Perusahaan'],
      ['company_type', 'Kategori Perusahaan', COMPANY_TYPE_LABELS],
      ['business_field', 'Bidang Usaha'],
      ['founded_year', 'Tahun Berdiri'],
      ['head_office_address', 'Alamat Kantor Pusat'],
      ['website', 'Website Resmi'],
      ['company_phone', 'Nomor Telepon Perusahaan'],
    ],
  },
  {
    title: '2. Legalitas dan Pengurus',
    fields: [
      ['nib', 'Nomor Induk Berusaha'],
      ['legal_status', 'Status Legalitas', LEGAL_STATUS_LABELS],
      ['director_name', 'Nama Pimpinan/Direktur'],
      ['representative_name', 'Nama Perwakilan Perusahaan'],
      ['legal_notes', 'Catatan Legalitas', null, true],
    ],
  },
  {
    title: '3. Hubungan dengan Pussiberal/TNI AL',
    fields: [
      ['relationship_status', 'Status Hubungan', RELATIONSHIP_STATUS_LABELS],
      ['relationship_target_unit', 'Unit/Pejabat yang Dituju'],
      ['relationship_basis', 'Dasar atau Kepentingan Hubungan', null, true],
      ['visit_history', 'Riwayat Kunjungan', VISIT_HISTORY_LABELS],
      ['internal_contact', 'Kontak Internal Penghubung'],
    ],
  },
  {
    title: '4. Rekam Jejak dan Hasil Pemeriksaan',
    fields: [
      ['public_check_result', 'Hasil Pemeriksaan Informasi Publik', PUBLIC_CHECK_RESULT_LABELS],
      ['data_consistency', 'Konsistensi Data Perusahaan', DATA_CONSISTENCY_LABELS],
      ['track_record_notes', 'Temuan atau Rekam Jejak', null, true],
      ['information_sources', 'Sumber Informasi'],
    ],
  },
];

// Menyusun hasil profiling (bagian 1-4) jadi ringkasan rapi -- field yang
// kosong tidak ditampilkan sama sekali, dan bagian yang semua field-nya
// kosong juga tidak ikut muncul (supaya ringkasannya tidak penuh baris
// "-" untuk perusahaan yang baru sebagian diisi datanya).
function companyProfileSummaryHTML(profile) {
  return COMPANY_PROFILE_SUMMARY_SECTIONS
    .map((section) => {
      const rows = section.fields
        .filter(([key]) => profile[key])
        .map(([key, label, labelMap, isLong]) => {
          const value = labelMap ? (labelMap[profile[key]] || profile[key]) : profile[key];
          return `<div class="detail-row${isLong ? ' detail-row-stacked' : ''}"><span class="detail-label">${escapeHtml(label)}</span><span class="detail-value">${escapeHtml(value)}</span></div>`;
        })
        .join('');
      if (!rows) return '';
      return `
        <div style="margin-top:16px;">
          <div style="font-size:11px; font-weight:800; letter-spacing:.2px; color:#667085; margin-bottom:4px;">${escapeHtml(section.title)}</div>
          ${rows}
        </div>
      `;
    })
    .join('');
}

// Nama perusahaan -> objek profil lengkapnya, diisi ulang tiap load() --
// dipakai openCompanyProfile() supaya tombol "Profiling Perusahaan" cukup
// bawa nama perusahaannya saja (bukan ~20 atribut data-* di tiap tombol).
let profilesByCompany = new Map();

let editingGuestId = null;
let editingMemberId = null;
let editingCompany = null;
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
      <td>${
        m.nik
          ? `<a class="link" href="bank-data-personnel?nik=${encodeURIComponent(m.nik)}&member_id=${encodeURIComponent(m.id)}">${escapeHtml(m.full_name)}</a>`
          : escapeHtml(m.full_name)
      }</td>
      <td>
        ${escapeHtml(m.nik || '-')}
        ${m.nik_shared_by_multiple_names ? '<span title="NIK ini juga tercatat dengan nama berbeda pada pendaftaran lain — periksa kembali" style="color: var(--danger); cursor:help;"> ⚠</span>' : ''}
      </td>
      <td>${escapeHtml(m.position)}</td>
      <td>${escapeHtml(m.phone_number)}</td>
      <td>${escapeHtml(m.affiliation || '-')}</td>
      <td>
        <span class="badge ${securityCategoryBadgeClass(m.effective_security_category)}">${escapeHtml(securityCategoryLabel(m.effective_security_category))}</span>
        ${m.analysis_source && m.analysis_source.is_inherited
          ? `<span title="Kategori ini diambil dari hasil analisa paling baru untuk orang ini, dari pendaftaran ${escapeHtml(m.analysis_source.registration_number)} (dianalisa ${formatDateTime(m.analysis_source.analyzed_at)}) -- bukan dari pendaftaran ini" style="color: var(--muted); cursor:help; font-size:11px; margin-left:4px;">ⓘ dari kunjungan lain</span>`
          : ''}
      </td>
      <td>${m.visit_count}x</td>
      <td>${formatDateTime(m.last_visit_at)}</td>
      <td>
        ${canEditAnalysis ? `<button class="btn btn-small manage-btn"
          data-guest-id="${m.guest_id}"
          data-member-id="${m.id}"
          data-name="${escapeHtml(m.full_name)}"
          data-affiliation="${escapeHtml(m.affiliation || '')}"
          data-category="${escapeHtml(m.security_category || '')}"
          data-notes="${escapeHtml(m.analysis_notes || '')}"
        >Kelola Analisa</button>` : ''}
        ${isAdmin ? `
          <button class="btn btn-small btn-danger delete-member-btn"
            data-guest-id="${m.guest_id}"
            data-member-id="${m.id}"
            data-name="${escapeHtml(m.full_name)}"
            data-visit-count="${m.visit_count}"
            style="margin-left:6px;"
          >Hapus</button>
        ` : ''}
      </td>
    </tr>
  `
    )
    .join('');

  const profile = group.profile;
  // Bukan cuma cek security_category/profiling_notes lagi -- perusahaan
  // bisa saja baru diisi sebagian data profilnya (mis. cuma bidang usaha)
  // tanpa sampai ke bagian "5. Kesimpulan Profiling" sama sekali. Kolom
  // metadata (id/updated_by/created_at/updated_at) sengaja DIKECUALIKAN --
  // itu selalu terisi begitu baris company_profiles pernah dibuat sekali
  // (termasuk kalau disimpan kosong semua), jadi tidak boleh ikut dihitung.
  const hasProfile = profile && [...PROFILE_CONTENT_KEYS].some((k) => !!profile[k]);
  const canEditProfile = group.company !== INDEPENDENT_GROUP_LABEL;

  return `
    <div class="form-card" style="margin-bottom:20px;">
      <div class="section">
        <div class="section-header-row">
          <h2 class="section-title">${escapeHtml(group.company)} <span class="optional-badge">${group.members.length} orang${group.total_registrations !== group.members.length ? ` &middot; ${group.total_registrations} kunjungan` : ''}</span></h2>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button type="button" class="btn btn-small download-group-btn" data-company="${escapeHtml(group.company)}">Unduh PDF Kelompok</button>
            ${canEditAnalysis && canEditProfile ? `
              <button type="button" class="btn btn-small profile-company-btn" data-company="${escapeHtml(group.company)}">Profiling Perusahaan</button>
            ` : ''}
            ${isAdmin && canEditProfile ? `
              <button type="button" class="btn btn-small edit-company-btn" data-company="${escapeHtml(group.company)}">Edit Nama Perusahaan</button>
              <button type="button" class="btn btn-small btn-danger delete-company-btn" data-company="${escapeHtml(group.company)}" data-count="${group.total_registrations}">Hapus Perusahaan</button>
            ` : ''}
          </div>
        </div>
        ${hasProfile ? `
          <div class="callout" style="margin-bottom:18px;">
            <span class="callout-label">Hasil Profiling Perusahaan${profile.security_category ? ` &middot; <span class="badge ${securityCategoryBadgeClass(profile.security_category)}">${escapeHtml(securityCategoryLabel(profile.security_category))}</span>` : ''}</span>
            ${profile.profiling_notes ? `<p style="white-space:pre-line; margin-top:8px;">${escapeHtml(profile.profiling_notes)}</p>` : ''}
            ${companyProfileSummaryHTML(profile)}
          </div>
        ` : ''}
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

    summaryLine.textContent = `${res.total_records} catatan pendaftaran (${res.total_unique_nik} NIK unik) dalam ${res.total_groups} kelompok perusahaan. Satu baris di tabel = satu orang (kunjungan berulang untuk perusahaan yang sama sudah digabung ke kolom "Kunjungan").`;

    if (!res.data.length) {
      groupsContainer.innerHTML = '<p class="page-description">Tidak ada data personel ditemukan.</p>';
      return;
    }

    profilesByCompany = new Map(res.data.map((g) => [g.company, g.profile || {}]));
    groupsContainer.innerHTML = res.data.map(groupCardHTML).join('');

    document.querySelectorAll('.manage-btn').forEach((btn) => {
      btn.addEventListener('click', () => openEdit(btn.dataset));
    });

    document.querySelectorAll('.delete-member-btn').forEach((btn) => {
      btn.addEventListener('click', () => deleteMember(btn.dataset.guestId, btn.dataset.memberId, btn.dataset.name, Number(btn.dataset.visitCount)));
    });

    document.querySelectorAll('.download-group-btn').forEach((btn) => {
      btn.addEventListener('click', () => downloadGroupPdf(btn.dataset.company));
    });

    document.querySelectorAll('.edit-company-btn').forEach((btn) => {
      btn.addEventListener('click', () => renameCompany(btn.dataset.company));
    });

    document.querySelectorAll('.delete-company-btn').forEach((btn) => {
      btn.addEventListener('click', () => deleteCompany(btn.dataset.company, Number(btn.dataset.count)));
    });

    document.querySelectorAll('.profile-company-btn').forEach((btn) => {
      btn.addEventListener('click', () => openCompanyProfile(btn.dataset.company));
    });
  } catch (err) {
    groupsContainer.innerHTML = `<p class="page-description" style="color: var(--danger);">${escapeHtml(err.message)}</p>`;
  }
}

async function deleteMember(guestId, memberId, name, visitCount) {
  resultBox.style.display = 'none';
  const message = visitCount > 1
    ? `Baris ini mewakili kunjungan PALING BARU "${name}" (total ${visitCount}x kunjungan tercatat). Menghapus di sini hanya menghapus data kunjungan yang paling baru itu beserta fotonya -- riwayat kunjungan sebelumnya tetap ada dan bisa ditelusuri lewat Laporan Personel. Lanjutkan?`
    : `Hapus data tamu "${name}" ini secara permanen (termasuk foto & riwayat kunjungannya)? Tindakan ini tidak bisa dibatalkan.`;
  if (!confirm(message)) return;

  try {
    const res = await api(`/guests/${guestId}/members/${memberId}`, { method: 'DELETE' });
    showMessage(
      res.data.registration_deleted
        ? `Data tamu "${name}" berhasil dihapus. Pendaftarannya ikut terhapus karena tidak ada tamu lain di dalamnya.`
        : `Data tamu "${name}" berhasil dihapus.`,
      false
    );
    load();
  } catch (err) {
    showMessage(err.message, true);
  }
}

async function renameCompany(oldCompany) {
  resultBox.style.display = 'none';
  const newCompany = prompt(`Ubah nama perusahaan "${oldCompany}" menjadi:`, oldCompany);
  if (newCompany === null) return;
  const trimmed = newCompany.trim();
  if (!trimmed) {
    showMessage('Nama perusahaan tidak boleh kosong.', true);
    return;
  }
  if (trimmed === oldCompany) return;

  try {
    const res = await api('/bank-data/company', {
      method: 'PUT',
      body: JSON.stringify({ old_company: oldCompany, new_company: trimmed }),
    });
    showMessage(`Nama perusahaan berhasil diubah menjadi "${trimmed}". ${res.data.updated_guests} pendaftaran diperbarui.`, false);
    load();
  } catch (err) {
    showMessage(err.message, true);
  }
}

async function deleteCompany(company, recordCount) {
  resultBox.style.display = 'none';
  const typed = prompt(
    `PERINGATAN: Ini akan MENGHAPUS PERMANEN seluruh ${recordCount} catatan tamu dari perusahaan "${company}" beserta seluruh foto, riwayat kunjungan, dan datanya. Tindakan ini TIDAK BISA DIBATALKAN.\n\nKetik ulang nama perusahaan persis seperti ini untuk konfirmasi: ${company}`
  );
  if (typed === null) return;
  if (typed.trim() !== company) {
    showMessage('Nama perusahaan yang diketik tidak cocok -- penghapusan dibatalkan.', true);
    return;
  }

  try {
    const res = await api(`/bank-data/company?company=${encodeURIComponent(company)}`, { method: 'DELETE' });
    showMessage(`Berhasil menghapus ${res.data.deleted_guests} pendaftaran dari "${company}".`, false);
    load();
  } catch (err) {
    showMessage(err.message, true);
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

function openCompanyProfile(company) {
  editingCompany = company;
  profileCompanyName.textContent = company;
  profileResultBox.style.display = 'none';
  const profile = profilesByCompany.get(company) || {};

  Object.entries(PROFILE_TEXT_FIELD_IDS).forEach(([key, id]) => {
    // "Nama Resmi Perusahaan" belum pernah diisi -> isi otomatis dengan
    // nama perusahaan yang sudah tercatat dari pendaftaran tamu, supaya
    // petugas tidak perlu mengetik ulang nama yang sama.
    const fallback = key === 'official_name' ? company : '';
    document.getElementById(id).value = profile[key] || fallback;
  });
  Object.entries(PROFILE_SELECT_FIELD_IDS).forEach(([key, id]) => {
    document.getElementById(id).value = profile[key] || '';
  });
  document.querySelectorAll('.profile-category-radio').forEach((r) => {
    r.checked = !!profile.security_category && r.value === profile.security_category;
  });
  profileNotes.value = profile.profiling_notes || '';

  companyProfileModal.classList.add('open');
}

function closeCompanyProfile() {
  editingCompany = null;
  companyProfileModal.classList.remove('open');
}

document.getElementById('closeProfileIconSlot').innerHTML = icon('close');
document.getElementById('closeProfileIconBtn').addEventListener('click', closeCompanyProfile);
document.getElementById('cancelProfileBtn').addEventListener('click', closeCompanyProfile);
companyProfileModal.addEventListener('click', (e) => { if (e.target === companyProfileModal) closeCompanyProfile(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && companyProfileModal.classList.contains('open')) closeCompanyProfile(); });

document.getElementById('saveProfileBtn').addEventListener('click', async () => {
  profileResultBox.style.display = 'none';
  const selectedCategory = document.querySelector('.profile-category-radio:checked');
  const payload = {
    company: editingCompany,
    security_category: selectedCategory ? selectedCategory.value : null,
    profiling_notes: profileNotes.value.trim() || null,
  };
  Object.entries(PROFILE_TEXT_FIELD_IDS).forEach(([key, id]) => {
    payload[key] = document.getElementById(id).value.trim() || null;
  });
  Object.entries(PROFILE_SELECT_FIELD_IDS).forEach(([key, id]) => {
    payload[key] = document.getElementById(id).value || null;
  });

  try {
    await api('/bank-data/company-profile', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    closeCompanyProfile();
    showMessage(`Profiling perusahaan "${editingCompany}" berhasil disimpan.`, false);
    load();
  } catch (err) {
    profileResultBox.style.display = 'block';
    profileResultBox.classList.add('error-box');
    profileResultBox.textContent = err.message;
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

requireStepUpAuth('sensitive-data', load);
