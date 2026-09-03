requireAuth();
renderNav('daftar-tamu');

const params = new URLSearchParams(window.location.search);
const guestId = params.get('id');
const resultBox = document.getElementById('resultBox');
const user = getUser();
const canManage = user && ['admin', 'pos_depan'].includes(user.role);
const canVerify = user && ['admin', 'verifikator'].includes(user.role);
const isAdmin = user && user.role === 'admin';

if (!guestId) {
  window.location.href = 'daftar-tamu';
}

function showMessage(message, isError) {
  resultBox.style.display = 'block';
  resultBox.textContent = message;
  resultBox.classList.toggle('error-box', !!isError);
}

// Widget foto & kebijakan perangkat yang dibuat untuk melengkapi tamu
// terjadwal (guest.status === 'Draft') -- dipetakan per member.id supaya
// nilainya bisa diambil lagi saat "Selesaikan & Ajukan Verifikasi" ditekan.
const completionWidgets = new Map();

// Kolom Perusahaan/Tujuan Menghadap/Keperluan yang boleh ditunda saat
// pendaftaran tamu terjadwal (lihat pendaftaran.js) -- dilengkapi belakangan
// di sini lewat PUT /guests/:id, terpisah dari "Selesaikan & Ajukan
// Verifikasi" supaya bisa disimpan sebagian tanpa harus langsung lengkap.
const TARGET_OFFICIAL_OPTIONS = [
  ['danpussiberal', 'Danpussiberal'],
  ['wadan_pussiberal', 'Wadan Pussiberal'],
  ['dirbinminlogpers', 'Dirbinminlogpers'],
  ['dirbinkamsiber', 'Dirbinkamsiber'],
  ['dansatdak', 'Dansatdak'],
  ['dansatinasi', 'Dansatinasi'],
  ['dansathan', 'Dansathan'],
  ['lainnya', 'Lainnya'],
];
const PURPOSE_CATEGORY_OPTIONS = [
  ['audiensi', 'Audiensi'],
  ['rapat_koordinasi', 'Rapat/Koordinasi'],
  ['diskusi_teknis', 'Diskusi Teknis'],
  ['maintenance', 'Maintenance'],
  ['pengiriman', 'Pengiriman'],
  ['lainnya', 'Lainnya'],
];

function scheduleCompanyFieldsHTML(g) {
  const currentOfficials = g.target_officials || [];
  const showOther = currentOfficials.includes('lainnya');
  return `
    <div class="grid">
      <div class="field">
        <label for="scCompany">PERUSAHAAN / INSTANSI ASAL</label>
        <input id="scCompany" type="text" placeholder="Nama instansi" value="${escapeHtml(g.company || '')}">
      </div>
    </div>
    <div class="field full" style="margin-top:21px;">
      <label>TUJUAN MENGHADAP KEPADA <span class="label-note">Boleh pilih lebih dari satu</span></label>
      <div class="device-options" id="scTargetOfficials">
        ${TARGET_OFFICIAL_OPTIONS.map(([value, label]) => `
          <label class="device-option"><input type="checkbox" class="sc-target-official" value="${value}" ${currentOfficials.includes(value) ? 'checked' : ''}><span>${label}</span></label>
        `).join('')}
      </div>
    </div>
    <div class="field full" id="scTargetOfficialOtherField" style="margin-top:18px; ${showOther ? '' : 'display:none;'}">
      <label for="scTargetOfficialOther">SEBUTKAN TUJUAN MENGHADAP LAINNYA</label>
      <input id="scTargetOfficialOther" type="text" placeholder="Tulis nama/jabatan pihak yang dituju" value="${escapeHtml(g.target_official_other || '')}">
    </div>
    <div class="field full" style="margin-top:21px;">
      <label>KATEGORI KEPERLUAN</label>
      <div class="device-options" id="scPurposeCategory">
        ${PURPOSE_CATEGORY_OPTIONS.map(([value, label]) => `
          <label class="device-option"><input type="radio" name="scPurposeCategory" class="sc-purpose-category" value="${value}" ${g.purpose_category === value ? 'checked' : ''}><span>${label}</span></label>
        `).join('')}
      </div>
    </div>
    <div class="field full" style="margin-top:21px;">
      <label for="scPurpose">DETAIL TUJUAN MENGHADAP</label>
      <textarea id="scPurpose" placeholder="Jelaskan lebih detail keperluan kunjungan...">${escapeHtml(g.purpose || '')}</textarea>
    </div>
  `;
}

function wireScheduleCompanyFields() {
  const otherCheckbox = document.querySelector('.sc-target-official[value="lainnya"]');
  const otherField = document.getElementById('scTargetOfficialOtherField');
  if (!otherCheckbox || !otherField) return;
  otherCheckbox.addEventListener('change', () => {
    otherField.style.display = otherCheckbox.checked ? 'block' : 'none';
    if (!otherCheckbox.checked) document.getElementById('scTargetOfficialOther').value = '';
  });
}

async function saveScheduleCompany() {
  const btn = document.getElementById('saveScheduleCompanyBtn');
  btn.disabled = true;
  try {
    const payload = {};

    const company = document.getElementById('scCompany').value.trim();
    if (company) payload.company = company;

    const officials = Array.from(document.querySelectorAll('.sc-target-official:checked')).map((el) => el.value);
    if (officials.length) {
      payload.target_officials = officials;
      if (officials.includes('lainnya')) {
        payload.target_official_other = document.getElementById('scTargetOfficialOther').value.trim();
      }
    }

    const purposeCategory = document.querySelector('.sc-purpose-category:checked');
    if (purposeCategory) payload.purpose_category = purposeCategory.value;

    const purpose = document.getElementById('scPurpose').value.trim();
    if (purpose) payload.purpose = purpose;

    if (!Object.keys(payload).length) {
      showMessage('Tidak ada perubahan untuk disimpan.', true);
      return;
    }

    await api(`/guests/${guestId}`, { method: 'PUT', body: JSON.stringify(payload) });
    showMessage('Perusahaan & keperluan berhasil disimpan.', false);
    load();
  } catch (err) {
    showMessage(err.message, true);
  } finally {
    btn.disabled = false;
  }
}

const saveScheduleCompanyBtn = document.getElementById('saveScheduleCompanyBtn');
if (saveScheduleCompanyBtn) saveScheduleCompanyBtn.addEventListener('click', saveScheduleCompany);

function memberCardHTML(m, isDraftGuest) {
  const needsPhotoUpload = isDraftGuest && canManage && !m.photo;
  const needsDeviceDeclaration = isDraftGuest && canManage && !m.device_status;

  const photoBlock = (kind, label, value) => {
    if (kind === 'photo' && needsPhotoUpload) {
      return `
        <div class="photo-widget" data-kind="photo">
          <label class="photo-widget-label">${label} <span class="required">*</span> <span class="label-note">Lengkapi saat tamu tiba</span></label>
          <div class="photo-frame">
            <div class="photo-frame-empty">Kamera belum aktif.<br>Tekan "Aktifkan Kamera" atau unggah foto.</div>
            <video autoplay playsinline muted style="display:none;"></video>
            <img alt="Pratinjau foto tamu" style="display:none;">
          </div>
          <canvas style="display:none;"></canvas>
          <div class="photo-actions">
            <button type="button" class="btn btn-small start-camera-btn">Aktifkan Kamera</button>
            <button type="button" class="btn btn-small btn-primary capture-btn" style="display:none;">Ambil Foto</button>
            <button type="button" class="btn btn-small retake-btn" style="display:none;">Ambil Ulang</button>
            <button type="button" class="btn btn-small upload-btn">Unggah</button>
            <input type="file" class="file-input-hidden photo-file-input" accept="image/*">
          </div>
          <p class="photo-hint"></p>
        </div>
      `;
    }
    return `
      <div class="photo-widget">
        <label class="photo-widget-label">${label}</label>
        ${
          value
            ? `<div class="photo-frame" style="max-width:220px;"><img src="${escapeHtml(value)}" alt="${escapeHtml(label)}"></div>
               ${isAdmin ? `<div class="photo-actions"><button type="button" class="btn btn-danger btn-small delete-photo-btn" data-member-id="${m.id}" data-kind="${kind}">Hapus ${label}</button></div>` : ''}`
            : `<div class="photo-frame" style="max-width:220px;"><div class="photo-frame-empty">Tidak ada foto</div></div>`
        }
      </div>
    `;
  };

  const deviceBlock = needsDeviceDeclaration
    ? `
      <div class="subsection-divider">
        <h3 class="subsection-title">Kebijakan Perangkat Elektronik <span class="required">*</span> <span class="label-note">Lengkapi saat tamu tiba</span></h3>
        <div class="device-options mc-device-options">
          <label class="device-option"><input type="radio" name="deviceStatusComplete-${m.id}" class="mc-device-status" value="tidak_membawa"><span>Tidak membawa perangkat elektronik</span></label>
          <label class="device-option"><input type="radio" name="deviceStatusComplete-${m.id}" class="mc-device-status" value="dititipkan"><span>Membawa dan menitipkan di Pos Penjagaan</span></label>
          <label class="device-option"><input type="radio" name="deviceStatusComplete-${m.id}" class="mc-device-status" value="dibawa_alasan_khusus"><span>Tetap membawa HP/perangkat elektronik lainnya dengan alasan khusus</span></label>
        </div>
        <div class="field full mc-device-reason-field" style="display:none; margin-top:14px;">
          <label>ALASAN MEMBAWA HP/PERANGKAT ELEKTRONIK <span class="required">*</span></label>
          <textarea class="mc-device-reason" maxlength="500" placeholder="Jelaskan alasan khusus mengapa HP/perangkat elektronik lainnya perlu tetap dibawa..."></textarea>
        </div>
      </div>
    `
    : '';

  return `
    <div class="member-card" data-member-id="${m.id}">
      <div class="member-card-head">
        <span class="member-card-title">${escapeHtml(m.full_name)}</span>
      </div>
      <div class="detail-row"><span class="detail-label">NIK</span><span class="detail-value">${escapeHtml(m.nik || '-')}</span></div>
      <div class="detail-row"><span class="detail-label">Nomor HP</span><span class="detail-value">${escapeHtml(m.phone_number)}</span></div>
      <div class="detail-row"><span class="detail-label">Jabatan</span><span class="detail-value">${escapeHtml(m.position)}</span></div>
      <div class="detail-row"><span class="detail-label">Nomor ID Karyawan</span><span class="detail-value">${escapeHtml(m.employee_id || '-')}</span></div>
      ${!needsDeviceDeclaration ? `<div class="detail-row"><span class="detail-label">Perangkat Elektronik</span><span class="detail-value">${escapeHtml(deviceStatusLabel(m.device_status))}</span></div>` : ''}
      ${m.device_status === 'dibawa_alasan_khusus' ? `<div class="detail-row"><span class="detail-label">Alasan Membawa HP/Perangkat Elektronik</span><span class="detail-value">${escapeHtml(m.device_reason)}</span></div>` : ''}
      ${canVerify ? `
        <div class="detail-row"><span class="detail-label">Afiliasi</span><span class="detail-value">${escapeHtml(m.affiliation || '-')}</span></div>
        <div class="detail-row"><span class="detail-label">Kategori Tamu</span><span class="detail-value"><span class="badge ${securityCategoryBadgeClass(m.security_category)}">${escapeHtml(securityCategoryLabel(m.security_category))}</span></span></div>
        ${m.analysis_notes ? `<div class="detail-row"><span class="detail-label">Hasil Analisa</span><span class="detail-value">${escapeHtml(m.analysis_notes)}</span></div>` : ''}
      ` : ''}

      <div class="member-photos">
        ${photoBlock('photo', 'Foto Tamu', m.photo)}
        ${photoBlock('ktp_photo', 'Foto KTP', m.ktp_photo)}
      </div>
      ${deviceBlock}
    </div>
  `;
}

function wireDeviceCompletion(block, memberId) {
  const radios = block.querySelectorAll('.mc-device-status');
  const reasonField = block.querySelector('.mc-device-reason-field');
  const reasonInput = block.querySelector('.mc-device-reason');
  if (!radios.length) return;

  radios.forEach((r) => {
    r.addEventListener('change', () => {
      const needsReason = r.checked && r.value === 'dibawa_alasan_khusus';
      if (needsReason) reasonField.style.display = 'block';
    });
  });
  block.querySelectorAll('.mc-device-status').forEach((r) => {
    r.addEventListener('change', () => {
      const selected = block.querySelector('.mc-device-status:checked');
      reasonField.style.display = selected && selected.value === 'dibawa_alasan_khusus' ? 'block' : 'none';
      if (!(selected && selected.value === 'dibawa_alasan_khusus')) reasonInput.value = '';
    });
  });
}

async function load() {
  try {
    const res = await api(`/guests/${guestId}`);
    const g = res.data;

    document.getElementById('guestName').textContent = g.company || '(Perusahaan belum diisi)';
    document.getElementById('regNumber').textContent = `No. Registrasi: ${g.registration_number} — ${g.members.length} tamu`;

    document.getElementById('detailRows').innerHTML = `
      <div class="detail-row"><span class="detail-label">Perusahaan / Instansi</span><span class="detail-value">${escapeHtml(g.company || '-')}</span></div>
      <div class="detail-row"><span class="detail-label">Tujuan Menghadap Kepada</span><span class="detail-value">${escapeHtml(targetOfficialsLabel(g.target_officials, g.target_official_other))}</span></div>
      <div class="detail-row"><span class="detail-label">Kategori Keperluan</span><span class="detail-value">${escapeHtml(purposeCategoryLabel(g.purpose_category))}</span></div>
      <div class="detail-row"><span class="detail-label">Detail Tujuan Menghadap</span><span class="detail-value">${escapeHtml(g.purpose || '-')}</span></div>
      <div class="detail-row"><span class="detail-label">Tamu Didampingi Oleh</span><span class="detail-value">${escapeHtml(g.accompanied_by || '-')}</span></div>
      <div class="detail-row"><span class="detail-label">Kendaraan</span><span class="detail-value">${escapeHtml(g.vehicle_type || '-')} ${g.plate_number ? '&middot; ' + escapeHtml(g.plate_number) : ''}</span></div>
      <div class="detail-row"><span class="detail-label">Status Pendaftaran</span><span class="detail-value"><span class="badge ${statusBadgeClass(g.status)}">${escapeHtml(guestStatusLabel(g.status))}</span></span></div>
      <div class="detail-row"><span class="detail-label">Status Kunjungan</span><span class="detail-value">${escapeHtml(g.visit_status || '-')}</span></div>
      <div class="detail-row"><span class="detail-label">Check-in</span><span class="detail-value">${formatDateTime(g.check_in_at)}</span></div>
      <div class="detail-row"><span class="detail-label">Check-out</span><span class="detail-value">${formatDateTime(g.check_out_at)}</span></div>
      ${g.re_entry_reason ? `<div class="detail-row"><span class="detail-label">Keterangan Check-in Ulang</span><span class="detail-value">${escapeHtml(g.re_entry_reason)} <span class="label-note">(${formatDateTime(g.re_entry_at)})</span></span></div>` : ''}
      <div class="detail-row"><span class="detail-label">Terdaftar Pada</span><span class="detail-value">${formatDateTime(g.created_at)}</span></div>
    `;

    const isDraftGuest = g.status === 'Draft';
    document.getElementById('membersList').innerHTML = g.members.map((m) => memberCardHTML(m, isDraftGuest)).join('');

    document.querySelectorAll('.delete-photo-btn').forEach((btn) => {
      btn.addEventListener('click', () => deletePhoto(btn.dataset.memberId, btn.dataset.kind));
    });

    // Tamu terjadwal: aktifkan widget kamera/unggah foto & radio kebijakan
    // perangkat pada kartu tamu yang datanya masih belum lengkap.
    completionWidgets.clear();
    if (isDraftGuest && canManage) {
      document.querySelectorAll('.member-card').forEach((card) => {
        const memberId = card.dataset.memberId;
        const photoRoot = card.querySelector('.photo-widget[data-kind="photo"]');
        if (photoRoot) completionWidgets.set(memberId, initPhotoWidget(photoRoot, 'user'));
        wireDeviceCompletion(card, memberId);
      });
    }

    const scheduledInfoCallout = document.getElementById('scheduledInfoCallout');
    const completeScheduleActions = document.getElementById('completeScheduleActions');
    const showCompletion = isDraftGuest && canManage;
    scheduledInfoCallout.style.display = showCompletion ? 'block' : 'none';
    completeScheduleActions.style.display = showCompletion ? 'flex' : 'none';

    const scheduleCompanySection = document.getElementById('scheduleCompanySection');
    scheduleCompanySection.style.display = showCompletion ? 'block' : 'none';
    if (showCompletion) {
      document.getElementById('scheduleCompanyFields').innerHTML = scheduleCompanyFieldsHTML(g);
      wireScheduleCompanyFields();
    }

    // Verifikasi (verifikator/admin): hanya tampil saat status masih menunggu verifikasi
    const verifySection = document.getElementById('verifySection');
    verifySection.style.display = canVerify && g.status === 'Menunggu Verifikasi' ? 'block' : 'none';
    const accompaniedByInput = document.getElementById('accompaniedByInput');
    if (accompaniedByInput) accompaniedByInput.value = g.accompanied_by || '';

    // Check-in/out (pos depan/admin): gated pada status Disetujui
    const actions = document.getElementById('visitActions');
    actions.innerHTML = '';
    if (canManage) {
      if (g.visit_status === 'Belum Check-in') {
        if (g.status === 'Disetujui') {
          actions.innerHTML = `<button class="btn btn-primary" id="checkInBtn">Check-in Semua Tamu</button>`;
        } else if (g.status === 'Menunggu Verifikasi') {
          actions.innerHTML = `<p class="page-description" style="margin:0;">Menunggu persetujuan verifikator sebelum tamu dapat check-in.</p>`;
        } else if (g.status === 'Ditolak') {
          actions.innerHTML = `<p class="page-description" style="margin:0; color: var(--danger);">Pendaftaran ini ditolak oleh verifikator.</p>`;
        }
      } else if (g.visit_status === 'Sedang Berkunjung') {
        actions.innerHTML = `<button class="btn btn-primary" id="checkOutBtn">Check-out Semua Tamu</button>`;
      } else if (g.visit_status === 'Selesai') {
        // Tamu yang sudah check-out balik lagi (mis. tertinggal dokumen) --
        // tidak perlu mendaftar ulang dari nol, cukup check-in ulang dengan
        // menyertakan alasannya.
        actions.innerHTML = `
          <div class="field full" style="width:100%; margin-bottom:0;">
            <label for="reCheckInReason">ALASAN CHECK-IN ULANG <span class="required">*</span><span class="label-note">Misal: tertinggal dokumen, lupa tanda tangan, dll</span></label>
            <div class="inline-form" style="margin-top:8px; flex-wrap:nowrap;">
              <input id="reCheckInReason" type="text" placeholder="Jelaskan alasan tamu kembali masuk" maxlength="255" style="flex:1; min-width:0;">
              <button class="btn btn-primary" id="reCheckInBtn" style="flex-shrink:0;">Check-in Ulang</button>
            </div>
          </div>
        `;
      }
    }

    const checkInBtn = document.getElementById('checkInBtn');
    if (checkInBtn) checkInBtn.addEventListener('click', () => doVisitAction('check-in'));

    const checkOutBtn = document.getElementById('checkOutBtn');
    if (checkOutBtn) checkOutBtn.addEventListener('click', () => doVisitAction('check-out'));

    const reCheckInBtn = document.getElementById('reCheckInBtn');
    if (reCheckInBtn) reCheckInBtn.addEventListener('click', doReCheckIn);
  } catch (err) {
    document.getElementById('guestName').textContent = 'Data tidak ditemukan';
    showMessage(err.message, true);
  }
}

async function doVisitAction(action) {
  try {
    await api(`/guests/${guestId}/${action}`, { method: 'POST' });
    showMessage(action === 'check-in' ? 'Semua tamu berhasil check-in.' : 'Semua tamu berhasil check-out.', false);
    load();
  } catch (err) {
    showMessage(err.message, true);
  }
}

async function doReCheckIn() {
  const reasonInput = document.getElementById('reCheckInReason');
  const reason = reasonInput.value.trim();
  if (!reason) {
    showMessage('Alasan check-in ulang wajib diisi.', true);
    return;
  }
  const btn = document.getElementById('reCheckInBtn');
  btn.disabled = true;
  try {
    await api(`/guests/${guestId}/re-check-in`, { method: 'POST', body: JSON.stringify({ reason }) });
    showMessage('Tamu berhasil check-in ulang.', false);
    load();
  } catch (err) {
    showMessage(err.message, true);
  } finally {
    btn.disabled = false;
  }
}

async function deletePhoto(memberId, kind) {
  const label = kind === 'ktp_photo' ? 'foto KTP' : 'foto';
  if (!confirm(`Hapus ${label} tamu ini secara permanen?`)) return;
  try {
    await api(`/guests/${guestId}/members/${memberId}`, { method: 'PUT', body: JSON.stringify({ [kind]: null }) });
    showMessage(`${label[0].toUpperCase()}${label.slice(1)} berhasil dihapus.`, false);
    load();
  } catch (err) {
    showMessage(err.message, true);
  }
}

async function doVerify(status) {
  const accompaniedByInput = document.getElementById('accompaniedByInput');
  try {
    await api(`/guests/${guestId}/verify`, {
      method: 'POST',
      body: JSON.stringify({ status, accompanied_by: accompaniedByInput ? accompaniedByInput.value.trim() : undefined }),
    });
    showMessage(status === 'Disetujui' ? 'Pendaftaran disetujui.' : 'Pendaftaran ditolak.', false);
    load();
  } catch (err) {
    showMessage(err.message, true);
  }
}

async function completeSchedule() {
  const completeBtn = document.getElementById('completeScheduleBtn');
  completeBtn.disabled = true;
  try {
    for (const card of document.querySelectorAll('.member-card')) {
      const memberId = card.dataset.memberId;
      const payload = {};

      const widget = completionWidgets.get(memberId);
      if (widget) {
        const photoValue = widget.getValue();
        if (photoValue) payload.photo = photoValue;
      }

      const deviceRadio = card.querySelector('.mc-device-status:checked');
      if (deviceRadio) {
        payload.device_status = deviceRadio.value;
        if (deviceRadio.value === 'dibawa_alasan_khusus') {
          payload.device_reason = card.querySelector('.mc-device-reason').value.trim();
        }
      }

      if (Object.keys(payload).length) {
        await api(`/guests/${guestId}/members/${memberId}`, { method: 'PUT', body: JSON.stringify(payload) });
      }
    }

    await api(`/guests/${guestId}/complete`, { method: 'POST' });
    showMessage('Tamu terjadwal berhasil dilengkapi dan diajukan untuk verifikasi.', false);
    load();
  } catch (err) {
    let message = err.message;
    if (err.fields) {
      message += ' — ' + Object.values(err.fields).join('; ');
    }
    showMessage(message, true);
  } finally {
    completeBtn.disabled = false;
  }
}

const completeScheduleBtn = document.getElementById('completeScheduleBtn');
if (completeScheduleBtn) completeScheduleBtn.addEventListener('click', completeSchedule);

const approveBtn = document.getElementById('approveBtn');
if (approveBtn) approveBtn.addEventListener('click', () => doVerify('Disetujui'));

const rejectBtn = document.getElementById('rejectBtn');
if (rejectBtn) {
  rejectBtn.addEventListener('click', () => {
    if (confirm('Tolak pendaftaran tamu ini?')) doVerify('Ditolak');
  });
}

load();
