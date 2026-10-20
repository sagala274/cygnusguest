requireAuth();
requireRole('admin', 'verifikator', 'pimpinan');
renderNav('bank-data');

const params = new URLSearchParams(window.location.search);
const nik = params.get('nik');
const memberId = params.get('member_id');
const resultBox = document.getElementById('resultBox');
const user = getUser();
const isAdmin = user && user.role === 'admin';
// Pimpinan hanya boleh MELIHAT ringkasan data ini -- tidak boleh mengedit.
const canEditAnalysis = user && ['admin', 'verifikator'].includes(user.role);
if (!canEditAnalysis) {
  document.getElementById('editSummaryBtn').style.display = 'none';
}

if (!nik) {
  window.location.href = 'bank-data';
}

document.getElementById('editSummaryIcon').innerHTML = icon('pencil');
document.getElementById('editSummaryCloseIcon').innerHTML = icon('close');
document.getElementById('editNameField').style.display = isAdmin ? '' : 'none';
document.getElementById('editPositionField').style.display = isAdmin ? '' : 'none';
document.getElementById('editPhoneField').style.display = isAdmin ? '' : 'none';
document.getElementById('editPhotosField').style.display = isAdmin ? '' : 'none';
document.getElementById('editFullName').required = isAdmin;

const photoWidget = initPhotoWidget(document.querySelector('#editPhotosField [data-kind="photo"]'), 'user');
const ktpPhotoWidget = initPhotoWidget(document.querySelector('#editPhotosField [data-kind="ktp_photo"]'), 'environment');

let lastPerson = null;

function showMessage(message, isError) {
  resultBox.style.display = 'block';
  resultBox.textContent = message;
  resultBox.classList.toggle('error-box', !!isError);
}

async function load() {
  try {
    const query = memberId ? `?member_id=${encodeURIComponent(memberId)}` : '';
    const res = await api(`/bank-data/personnel/${encodeURIComponent(nik)}${query}`);
    const p = res.data;
    lastPerson = p;

    document.getElementById('personName').textContent = p.full_name;
    document.getElementById('personNik').textContent = `NIK: ${p.nik}`;

    document.getElementById('nikWarning').style.display = p.nik_shared_by_multiple_names ? 'block' : 'none';
    if (p.nik_shared_by_multiple_names) {
      const others = (p.other_names_same_nik || []).map(escapeHtml).join(', ');
      document.getElementById('nikWarningScope').innerHTML =
        `Laporan ini hanya mencakup kunjungan atas nama "${escapeHtml(p.full_name)}". NIK yang sama juga tercatat atas nama: <strong>${others}</strong> — ` +
        `<a class="link" href="bank-data?q=${encodeURIComponent(p.nik)}">cari NIK ini di Bank Data</a> untuk menelusuri seluruh riwayatnya.`;
    } else {
      document.getElementById('nikWarningScope').textContent = '';
    }

    document.getElementById('summaryRows').innerHTML = `
      <div class="detail-row"><span class="detail-label">NIK</span><span class="detail-value">${escapeHtml(p.nik || '-')}</span></div>
      <div class="detail-row"><span class="detail-label">Nama Lainnya</span><span class="detail-value">${escapeHtml(p.other_names || '-')}</span></div>
      <div class="detail-row"><span class="detail-label">Jabatan Terakhir</span><span class="detail-value">${escapeHtml(p.position)}</span></div>
      <div class="detail-row"><span class="detail-label">Nomor HP</span><span class="detail-value">${escapeHtml(p.phone_number)}</span></div>
      <div class="detail-row detail-row-stacked"><span class="detail-label">Afiliasi</span><span class="detail-value">${escapeHtml(p.affiliation || '-')}</span></div>
      <div class="detail-row"><span class="detail-label">Media Sosial</span><span class="detail-value">${escapeHtml(p.social_media || '-')}</span></div>
      <div class="detail-row"><span class="detail-label">Alamat Rumah</span><span class="detail-value">${escapeHtml(p.address || '-')}</span></div>
      <div class="detail-row"><span class="detail-label">Plat Nomor Kendaraan</span><span class="detail-value">${escapeHtml(p.plate_number || '-')}</span></div>
      <div class="detail-row"><span class="detail-label">Kategori Tamu Terkini</span><span class="detail-value"><span class="badge ${securityCategoryBadgeClass(p.effective_security_category)}">${escapeHtml(securityCategoryLabel(p.effective_security_category))}</span>${p.analysis_source && p.analysis_source.is_inherited ? ` <span title="Diambil dari hasil analisa paling baru untuk orang ini, pendaftaran ${escapeHtml(p.analysis_source.registration_number)} (dianalisa ${formatDateTime(p.analysis_source.analyzed_at)})" style="color: var(--muted); cursor:help; font-size:11px;">ⓘ dari kunjungan lain</span>` : ''}</span></div>
      <div class="detail-row"><span class="detail-label">Perusahaan Terkait</span><span class="detail-value">${escapeHtml(p.companies.join(', '))}</span></div>
      <div class="detail-row"><span class="detail-label">Jumlah Kunjungan</span><span class="detail-value">${p.visit_count}x</span></div>
      <div class="detail-row"><span class="detail-label">Kunjungan Pertama</span><span class="detail-value">${formatDateTime(p.first_visit_at)}</span></div>
      <div class="detail-row"><span class="detail-label">Kunjungan Terakhir</span><span class="detail-value">${formatDateTime(p.last_visit_at)}</span></div>
    `;

    const photoFrame = (label, value) => `
      <div class="photo-widget">
        <label class="photo-widget-label">${label}</label>
        ${
          value
            ? `<div class="photo-frame" style="max-width:220px;"><img src="${escapeHtml(value)}" alt="${escapeHtml(label)}"></div>`
            : `<div class="photo-frame" style="max-width:220px;"><div class="photo-frame-empty">Tidak ada foto</div></div>`
        }
      </div>
    `;
    document.getElementById('summaryPhotos').innerHTML =
      photoFrame('Foto Wajah', p.photo) + photoFrame('Foto KTP', p.ktp_photo);

    const analysisSection = document.getElementById('analysisSection');
    if (p.effective_analysis_notes) {
      document.getElementById('analysisNotes').textContent = p.effective_analysis_notes;
      analysisSection.style.display = 'block';
    } else {
      analysisSection.style.display = 'none';
    }

    document.getElementById('visitsTableBody').innerHTML = p.visits
      .map(
        (v) => `
      <tr>
        <td>${formatDateTime(v.created_at)}</td>
        <td>${escapeHtml(v.full_name)}</td>
        <td>${escapeHtml(v.registration_number)}</td>
        <td>${escapeHtml(v.company)}</td>
        <td>${escapeHtml(v.position)}</td>
        <td><span class="badge ${securityCategoryBadgeClass(v.security_category)}">${escapeHtml(securityCategoryLabel(v.security_category))}</span></td>
        <td><span class="badge ${statusBadgeClass(v.registration_status)}">${escapeHtml(v.registration_status)}</span></td>
        <td><a class="link" href="detail-tamu?id=${v.guest_id}">Lihat Pendaftaran</a></td>
      </tr>
    `
      )
      .join('');
  } catch (err) {
    document.getElementById('personName').textContent = 'Data tidak ditemukan';
    showMessage(err.message, true);
  }
}

document.getElementById('downloadBtn').addEventListener('click', async () => {
  resultBox.style.display = 'none';
  try {
    const p = new URLSearchParams({ format: 'pdf', scope: 'personnel', nik, ...(memberId ? { member_id: memberId } : {}) });
    await downloadFile(`/bank-data/export?${p.toString()}`, `bank-data-personel-${nik}.pdf`);
  } catch (err) {
    showMessage(err.message, true);
  }
});

const editModal = document.getElementById('editSummaryModal');
const editForm = document.getElementById('editSummaryForm');

// Media Sosial disimpan di database sebagai SATU string bebas (kolom
// guest_members.social_media, mis. "Instagram: @nama, TikTok: @nama2") --
// tidak diubah jadi tabel terpisah supaya tidak perlu migrasi. Di form ini
// dipecah jadi baris-baris [jenis platform] + [username/tautan] supaya enak
// diisi, lalu digabung ulang jadi satu string dengan format yang sama saat
// disimpan.
const SOCIAL_MEDIA_PLATFORMS = ['Instagram', 'Facebook', 'TikTok', 'Twitter/X', 'LinkedIn', 'YouTube', 'WhatsApp', 'Telegram', 'Lainnya'];

function socialMediaRowHTML(platform, handle) {
  const options = SOCIAL_MEDIA_PLATFORMS
    .map((p) => `<option value="${escapeHtml(p)}" ${p === platform ? 'selected' : ''}>${escapeHtml(p)}</option>`)
    .join('');
  return `
    <div class="inline-form social-media-row" style="margin-bottom:8px;">
      <select class="sm-platform" style="max-width:150px;">${options}</select>
      <input type="text" class="sm-handle" placeholder="Username atau tautan akun" maxlength="200" value="${escapeHtml(handle || '')}" style="flex:1; min-width:160px;">
      <button type="button" class="btn btn-small btn-danger sm-remove-row-btn">Hapus</button>
    </div>
  `;
}

function addSocialMediaRow(platform, handle) {
  const rowsEl = document.getElementById('editSocialMediaRows');
  rowsEl.insertAdjacentHTML('beforeend', socialMediaRowHTML(platform || SOCIAL_MEDIA_PLATFORMS[0], handle || ''));
  rowsEl.lastElementChild.querySelector('.sm-remove-row-btn').addEventListener('click', (e) => {
    e.target.closest('.social-media-row').remove();
  });
}
document.getElementById('addSocialMediaRowBtn').addEventListener('click', () => addSocialMediaRow());

// Baris lama (bebas format, tanpa label platform yang konsisten) diurai
// sebaik mungkin dengan mencari kemunculan nama platform yang dikenal --
// kalau tidak ada satu pun yang cocok, seluruh teksnya ditaruh sebagai satu
// baris "Lainnya" supaya datanya tidak hilang begitu saja.
function parseSocialMediaValue(value) {
  const raw = String(value || '').trim();
  if (!raw) return [];
  const knownPlatforms = SOCIAL_MEDIA_PLATFORMS.filter((p) => p !== 'Lainnya');
  const pattern = knownPlatforms.map((p) => p.replace('/', '\\/')).join('|');
  const re = new RegExp(`(${pattern})\\s*:?\\s*`, 'gi');
  const matches = [...raw.matchAll(re)];
  if (!matches.length) return [{ platform: 'Lainnya', handle: raw }];

  return matches.map((m, i) => {
    const start = m.index + m[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : raw.length;
    const handle = raw.slice(start, end).replace(/[,;]+\s*$/, '').trim();
    const platform = knownPlatforms.find((p) => p.toLowerCase() === m[1].toLowerCase()) || m[1];
    return { platform, handle };
  });
}

function serializeSocialMediaRows() {
  return Array.from(document.querySelectorAll('.social-media-row'))
    .map((row) => ({
      platform: row.querySelector('.sm-platform').value,
      handle: row.querySelector('.sm-handle').value.trim(),
    }))
    .filter((r) => r.handle)
    .map((r) => `${r.platform}: ${r.handle}`)
    .join(', ');
}

function openEditModal() {
  if (!lastPerson) return;
  document.getElementById('editFullName').value = lastPerson.full_name || '';
  document.getElementById('editOtherNames').value = lastPerson.other_names || '';
  photoWidget.setValue(lastPerson.photo || null);
  ktpPhotoWidget.setValue(lastPerson.ktp_photo || null);
  document.getElementById('editPosition').value = lastPerson.position || '';
  document.getElementById('editPhone').value = lastPerson.phone_number || '';
  document.getElementById('editAffiliation').value = lastPerson.affiliation || '';
  document.getElementById('editSocialMediaRows').innerHTML = '';
  const parsedSocialMedia = parseSocialMediaValue(lastPerson.social_media);
  if (parsedSocialMedia.length) {
    parsedSocialMedia.forEach((r) => addSocialMediaRow(r.platform, r.handle));
  } else {
    addSocialMediaRow();
  }
  document.getElementById('editAddress').value = lastPerson.address || '';
  document.getElementById('editCategory').value = lastPerson.security_category || '';
  document.getElementById('editAnalysisNotes').value = lastPerson.analysis_notes || '';
  editModal.classList.add('open');
}

function closeEditModal() {
  editModal.classList.remove('open');
  photoWidget.stopCamera();
  ktpPhotoWidget.stopCamera();
}

document.getElementById('editSummaryBtn').addEventListener('click', openEditModal);
document.getElementById('editSummaryCloseBtn').addEventListener('click', closeEditModal);
document.getElementById('editSummaryCancelBtn').addEventListener('click', closeEditModal);
editModal.addEventListener('click', (e) => { if (e.target === editModal) closeEditModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && editModal.classList.contains('open')) closeEditModal(); });

editForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!lastPerson) return;
  resultBox.style.display = 'none';

  const payload = {
    other_names: document.getElementById('editOtherNames').value.trim(),
    affiliation: document.getElementById('editAffiliation').value.trim(),
    social_media: serializeSocialMediaRows(),
    address: document.getElementById('editAddress').value.trim(),
    security_category: document.getElementById('editCategory').value || null,
    analysis_notes: document.getElementById('editAnalysisNotes').value.trim(),
  };
  if (isAdmin) {
    payload.full_name = document.getElementById('editFullName').value.trim();
    payload.position = document.getElementById('editPosition').value.trim();
    payload.phone_number = document.getElementById('editPhone').value.trim();
    const newPhoto = photoWidget.getValue();
    const newKtpPhoto = ktpPhotoWidget.getValue();
    if (newPhoto) payload.photo = newPhoto;
    if (newKtpPhoto) payload.ktp_photo = newKtpPhoto;
  }

  try {
    await api(`/guests/${lastPerson.guest_id}/members/${lastPerson.member_id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    closeEditModal();
    showMessage('Ringkasan data tamu berhasil diperbarui.', false);
    load();
  } catch (err) {
    showMessage(err.message, true);
  }
});

requireStepUpAuth('sensitive-data', load);
