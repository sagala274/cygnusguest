requireAuth();
requireRole('admin', 'pos_depan');
renderNav('pendaftaran');

const form = document.getElementById('guestForm');
const cancelBtn = document.getElementById('cancelBtn');
const resultBox = document.getElementById('resultBox');
const membersContainer = document.getElementById('membersContainer');
const addMemberBtn = document.getElementById('addMemberBtn');

const memberWidgets = new Map();
let memberSeq = 0;

const targetOfficialOtherCheckbox = document.getElementById('targetOfficialOtherCheckbox');
const targetOfficialOtherField = document.getElementById('targetOfficialOtherField');
const targetOfficialOtherInput = document.getElementById('target_official_other');

function updateTargetOfficialOtherVisibility() {
  const needsOther = targetOfficialOtherCheckbox.checked;
  targetOfficialOtherField.style.display = needsOther ? 'block' : 'none';
  if (!needsOther) targetOfficialOtherInput.value = '';
}
targetOfficialOtherCheckbox.addEventListener('change', updateTargetOfficialOtherVisibility);

// Tamu Terjadwal -- daftarkan NIK/Nama/Jabatan/Nomor HP di muka, Foto Tamu &
// deklarasi Perangkat Elektronik menyusul saat kedatangan (dilengkapi lewat
// halaman Detail Tamu). Mempengaruhi kartu tamu yang DITAMBAHKAN SETELAH
// toggle ini diubah -- kartu yang sudah ada sebelumnya tidak dirender ulang,
// tapi validasi submit tetap mengikuti status toggle saat ini secara global.
const scheduledToggle = document.getElementById('scheduledToggle');

// Kartu tamu yang sudah terlanjur dibuat sebelum toggle diubah tetap
// diperbarui label-nya di tempat (tanpa render ulang, supaya data yang
// sudah diisi tidak hilang).
function updateMemberScheduledBadges() {
  const isScheduled = scheduledToggle.checked;
  const badgeHtml = isScheduled
    ? '<span class="optional-badge">Menyusul saat kedatangan</span>'
    : '<span class="required">*</span>';

  Array.from(membersContainer.children).forEach((block) => {
    const photoLabel = block.querySelector('[data-kind="photo"] .photo-widget-label');
    if (photoLabel) photoLabel.innerHTML = `Foto Tamu ${badgeHtml}`;

    const deviceLabel = block.querySelector('.m-device-status')?.closest('.field')?.querySelector('label');
    if (deviceLabel) deviceLabel.innerHTML = `PERANGKAT ELEKTRONIK ${badgeHtml}`;
  });
}
scheduledToggle.addEventListener('change', updateMemberScheduledBadges);

// Untuk tamu terjadwal, Perusahaan/Tujuan Menghadap/Kategori Keperluan/Detail
// Tujuan juga boleh dikosongkan dulu (dilengkapi belakangan lewat Detail Tamu)
// -- lepas atribut `required` bawaan browser dan ganti tanda (*) jadi label
// "boleh menyusul" supaya jelas terlihat opsional saat toggle aktif.
const companyInputRequired = document.getElementById('company');
const purposeInputRequired = document.getElementById('purpose');
const REQUIRED_MARK_IDS = ['companyRequiredMark', 'targetOfficialsRequiredMark', 'purposeCategoryRequiredMark', 'purposeRequiredMark'];

function updateCompanyPurposeRequirement() {
  const isScheduled = scheduledToggle.checked;
  if (isScheduled) {
    companyInputRequired.removeAttribute('required');
    purposeInputRequired.removeAttribute('required');
  } else {
    companyInputRequired.setAttribute('required', '');
    purposeInputRequired.setAttribute('required', '');
  }
  const badgeHtml = isScheduled ? '<span class="optional-badge">Boleh menyusul</span>' : '<span class="required">*</span>';
  REQUIRED_MARK_IDS.forEach((id) => {
    const wrapper = document.getElementById(id);
    if (wrapper) wrapper.innerHTML = badgeHtml;
  });
}
scheduledToggle.addEventListener('change', updateCompanyPurposeRequirement);

// Saran nama perusahaan (autocomplete) + auto-lengkapi data tamu yang sudah
// pernah terdaftar dari perusahaan yang sama.
const companyInput = document.getElementById('company');
const companySuggestionsList = document.getElementById('companySuggestions');
const companyMemberSuggestionsList = document.getElementById('companyMemberSuggestions');
const companyMembersHint = document.getElementById('companyMembersHint');

let companyMembers = [];
let companyFetchTimer = null;

async function loadCompanySuggestions() {
  try {
    const res = await api('/guests/meta/companies');
    companySuggestionsList.innerHTML = res.data.map((c) => `<option value="${escapeHtml(c)}">`).join('');
  } catch (err) {
    // Gagal memuat saran nama perusahaan tidak menghalangi pengisian formulir manual.
  }
}

async function loadCompanyMembers(company) {
  if (!company) {
    companyMembers = [];
    companyMemberSuggestionsList.innerHTML = '';
    companyMembersHint.style.display = 'none';
    return;
  }
  try {
    const res = await api(`/guests/meta/company-members?company=${encodeURIComponent(company)}`);
    companyMembers = res.data;
    companyMemberSuggestionsList.innerHTML = companyMembers.map((m) => `<option value="${escapeHtml(m.full_name)}">`).join('');
    companyMembersHint.style.display = companyMembers.length ? 'block' : 'none';
  } catch (err) {
    companyMembers = [];
    companyMemberSuggestionsList.innerHTML = '';
    companyMembersHint.style.display = 'none';
  }
}

companyInput.addEventListener('input', () => {
  clearTimeout(companyFetchTimer);
  companyFetchTimer = setTimeout(() => loadCompanyMembers(companyInput.value.trim()), 400);
});

loadCompanySuggestions();

function memberBlockHTML(seq, isScheduled) {
  const photoRequiredBadge = isScheduled
    ? '<span class="optional-badge">Menyusul saat kedatangan</span>'
    : '<span class="required">*</span>';
  const deviceRequiredBadge = isScheduled
    ? '<span class="optional-badge">Menyusul saat kedatangan</span>'
    : '<span class="required">*</span>';
  const dititipkanChecked = isScheduled ? '' : 'checked';
  return `
    <div class="member-card" data-seq="${seq}">
      <div class="member-card-head">
        <span class="member-card-title"></span>
        <button type="button" class="btn btn-small btn-danger remove-member-btn">Hapus</button>
      </div>

      <div class="grid">
        <div class="field">
          <label>NIK KTP <span class="required">*</span><span class="label-note">16 Digit</span></label>
          <input type="text" class="m-nik" inputmode="numeric" maxlength="16" placeholder="Masukkan NIK KTP" required>
        </div>
        <div class="field">
          <label>NAMA LENGKAP <span class="required">*</span></label>
          <input type="text" class="m-name" placeholder="Sesuai kartu identitas" list="companyMemberSuggestions" autocomplete="off" required>
        </div>
        <div class="field">
          <label>JABATAN <span class="required">*</span></label>
          <input type="text" class="m-position" placeholder="Jabatan atau profesi" required>
        </div>
        <div class="field">
          <label>NOMOR HANDPHONE <span class="required">*</span></label>
          <input type="tel" class="m-phone" inputmode="tel" placeholder="08xxxxxxxxxx" required>
        </div>
        <div class="field">
          <label>NOMOR ID KARYAWAN <span class="optional-badge">Opsional</span></label>
          <input type="text" class="m-employee-id" placeholder="Contoh: EMP-00231">
        </div>
      </div>

      <div class="member-photos">
        <div class="photo-widget" data-kind="photo">
          <label class="photo-widget-label">Foto Tamu ${photoRequiredBadge}</label>
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

        <div class="photo-widget" data-kind="ktp_photo">
          <label class="photo-widget-label">Foto KTP <span class="optional-badge">Opsional</span></label>
          <div class="photo-frame">
            <div class="photo-frame-empty">Kamera belum aktif.<br>Tekan "Aktifkan Kamera" atau unggah foto KTP.</div>
            <video autoplay playsinline muted style="display:none;"></video>
            <img alt="Pratinjau foto KTP" style="display:none;">
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
      </div>

      <div class="subsection-divider">
        <h3 class="subsection-title">
          <span class="section-icon">📵</span>
          Kebijakan Perangkat Elektronik
        </h3>

        <div class="field full">
          <label>PERANGKAT ELEKTRONIK ${deviceRequiredBadge}</label>
          <div class="device-options">
            <label class="device-option">
              <input type="radio" name="deviceStatus-${seq}" class="m-device-status" value="tidak_membawa">
              <span>Tidak membawa perangkat elektronik</span>
            </label>
            <label class="device-option">
              <input type="radio" name="deviceStatus-${seq}" class="m-device-status" value="dititipkan" ${dititipkanChecked}>
              <span>Membawa dan menitipkan di Pos Penjagaan</span>
            </label>
            <label class="device-option">
              <input type="radio" name="deviceStatus-${seq}" class="m-device-status" value="dibawa_alasan_khusus">
              <span>Tetap membawa HP/perangkat elektronik lainnya dengan alasan khusus</span>
            </label>
          </div>
        </div>

        <div class="field full m-device-reason-field" style="display:none; margin-top:18px;">
          <label>
            <span>ALASAN MEMBAWA HP/PERANGKAT ELEKTRONIK <span class="required">*</span></span>
            <span class="label-note m-device-reason-counter">0 / 500</span>
          </label>
          <textarea class="m-device-reason" placeholder="Jelaskan alasan khusus mengapa HP/perangkat elektronik lainnya perlu tetap dibawa selama berada di area PUSSIBERAL..." maxlength="500"></textarea>
        </div>

        <div class="field full" style="margin-top:18px;">
          <label class="confirm-checkbox">
            <input type="checkbox" class="m-device-confirm">
            <span>Petugas telah menyampaikan kebijakan penitipan perangkat elektronik ini kepada tamu, dan tamu telah memahaminya. <span class="required">*</span></span>
          </label>
        </div>
      </div>

      <div class="member-errors"></div>
    </div>
  `;
}

// initPhotoWidget() sekarang ada di app.js (dipakai bersama dengan modal
// edit Ringkasan Data Tamu di Bank Data).

function wireDevicePolicy(block) {
  const radios = block.querySelectorAll('.m-device-status');
  const reasonField = block.querySelector('.m-device-reason-field');
  const reasonInput = block.querySelector('.m-device-reason');
  const reasonCounter = block.querySelector('.m-device-reason-counter');

  function updateReasonVisibility() {
    const selected = block.querySelector('.m-device-status:checked');
    const needsReason = selected && selected.value === 'dibawa_alasan_khusus';
    reasonField.style.display = needsReason ? 'block' : 'none';
    if (!needsReason) {
      reasonInput.value = '';
      reasonCounter.textContent = '0 / 500';
    }
  }

  radios.forEach((r) => r.addEventListener('change', updateReasonVisibility));
  reasonInput.addEventListener('input', () => {
    reasonCounter.textContent = `${reasonInput.value.length} / 500`;
  });
}

function renumberMembers() {
  const blocks = Array.from(membersContainer.children);
  blocks.forEach((block, i) => {
    block.querySelector('.member-card-title').textContent = `Tamu ${i + 1}`;
    block.querySelector('.remove-member-btn').style.display = blocks.length > 1 ? 'inline-block' : 'none';
  });
}

function wireCompanyMemberAutofill(block) {
  const nameInput = block.querySelector('.m-name');
  nameInput.addEventListener('input', () => {
    const typed = nameInput.value.trim().toLowerCase();
    if (!typed) return;
    const match = companyMembers.find((m) => m.full_name.trim().toLowerCase() === typed);
    if (!match) return;
    block.querySelector('.m-nik').value = match.nik || '';
    block.querySelector('.m-position').value = match.position || '';
    block.querySelector('.m-phone').value = match.phone_number || '';
    block.querySelector('.m-employee-id').value = match.employee_id || '';
  });
}

function addMember() {
  const seq = memberSeq++;
  membersContainer.insertAdjacentHTML('beforeend', memberBlockHTML(seq, scheduledToggle.checked));
  const block = membersContainer.querySelector(`[data-seq="${seq}"]`);

  const nikInput = block.querySelector('.m-nik');
  nikInput.addEventListener('input', () => {
    nikInput.value = nikInput.value.replace(/\D/g, '').slice(0, 16);
  });

  const photoWidget = initPhotoWidget(block.querySelector('[data-kind="photo"]'), 'user');
  const ktpWidget = initPhotoWidget(block.querySelector('[data-kind="ktp_photo"]'), 'environment');
  memberWidgets.set(block, { photo: photoWidget, ktp_photo: ktpWidget });

  wireDevicePolicy(block);
  wireCompanyMemberAutofill(block);

  block.querySelector('.remove-member-btn').addEventListener('click', () => {
    const widgets = memberWidgets.get(block);
    widgets.photo.stopCamera();
    widgets.ktp_photo.stopCamera();
    memberWidgets.delete(block);
    block.remove();
    renumberMembers();
  });

  renumberMembers();
}

addMemberBtn.addEventListener('click', addMember);

function stopAllCameras() {
  memberWidgets.forEach((w) => {
    w.photo.stopCamera();
    w.ktp_photo.stopCamera();
  });
}
window.addEventListener('beforeunload', stopAllCameras);

function clearAllErrors() {
  document.querySelectorAll('.field').forEach((f) => f.classList.remove('error'));
  document.querySelectorAll('.field .error-message, .member-card .error-message').forEach((e) => e.remove());
  document.querySelectorAll('.photo-hint').forEach((e) => { e.textContent = ''; });
}

const MEMBER_FIELD_MAP = {
  full_name: '.m-name',
  nik: '.m-nik',
  phone_number: '.m-phone',
  position: '.m-position',
  employee_id: '.m-employee-id',
};

function showFieldError(field, message) {
  const memberMatch = field.match(/^members\[(\d+)\]\.(.+)$/);
  if (memberMatch) {
    const idx = Number(memberMatch[1]);
    const fieldName = memberMatch[2];
    const block = membersContainer.children[idx];
    if (!block) return;

    if (fieldName === 'photo' || fieldName === 'ktp_photo') {
      const hint = block.querySelector(`[data-kind="${fieldName}"] .photo-hint`);
      if (hint) hint.textContent = message;
      return;
    }

    if (fieldName === 'device_reason') {
      const reasonField = block.querySelector('.m-device-reason-field');
      reasonField.classList.add('error');
      const msg = document.createElement('div');
      msg.className = 'error-message';
      msg.textContent = message;
      reasonField.appendChild(msg);
      return;
    }

    if (fieldName === 'device_status' || fieldName === 'device_confirm') {
      const options = block.querySelector('.device-options');
      const msg = document.createElement('div');
      msg.className = 'error-message';
      msg.textContent = message;
      options.insertAdjacentElement('afterend', msg);
      return;
    }

    const selector = MEMBER_FIELD_MAP[fieldName];
    const input = selector ? block.querySelector(selector) : null;
    if (!input) return;
    const fieldEl = input.closest('.field');
    fieldEl.classList.add('error');
    const msg = document.createElement('div');
    msg.className = 'error-message';
    msg.textContent = message;
    fieldEl.appendChild(msg);
    return;
  }

  const input = document.getElementById(field);
  if (!input) return;
  const fieldEl = input.closest('.field');
  fieldEl.classList.add('error');
  const msg = document.createElement('div');
  msg.className = 'error-message';
  msg.textContent = message;
  fieldEl.appendChild(msg);
}

function validateTargetOfficials() {
  const checked = document.querySelectorAll('.m-target-official:checked');
  if (checked.length === 0) {
    // Tamu terjadwal: boleh belum ditentukan sekarang, dilengkapi belakangan
    // lewat halaman Detail Tamu sebelum diajukan verifikasi.
    if (scheduledToggle.checked) return true;
    showFieldError('target_officials', 'Pilih minimal satu tujuan menghadap kepada');
    return false;
  }
  if (targetOfficialOtherCheckbox.checked && !targetOfficialOtherInput.value.trim()) {
    showFieldError('target_official_other', 'Sebutkan tujuan menghadap yang tidak ada dalam pilihan');
    return false;
  }
  return true;
}

function validatePurposeCategory() {
  const selected = document.querySelector('.m-purpose-category:checked');
  if (!selected) {
    if (scheduledToggle.checked) return true;
    showFieldError('purpose_category', 'Pilih kategori keperluan');
    return false;
  }
  return true;
}

function validateAllDevicePolicies() {
  let valid = true;

  Array.from(membersContainer.children).forEach((block, idx) => {
    const selected = block.querySelector('.m-device-status:checked');
    const status = selected ? selected.value : '';
    const confirmCheckbox = block.querySelector('.m-device-confirm');

    // Tamu terjadwal: seluruh kebijakan perangkat elektronik (termasuk
    // konfirmasi "sudah disampaikan ke tamu") menyusul saat kedatangan --
    // tidak masuk akal diwajibkan sekarang karena tamunya belum tiba.
    if (scheduledToggle.checked) {
      return;
    }

    if (status === 'dibawa_alasan_khusus') {
      const reason = block.querySelector('.m-device-reason').value.trim();
      if (!reason) {
        showFieldError(`members[${idx}].device_reason`, 'Alasan membawa HP wajib diisi');
        valid = false;
      } else if (reason.length < 20) {
        showFieldError(`members[${idx}].device_reason`, 'Alasan minimal 20 karakter');
        valid = false;
      } else if (reason.length > 500) {
        showFieldError(`members[${idx}].device_reason`, 'Alasan maksimal 500 karakter');
        valid = false;
      }
    }

    if (!confirmCheckbox.checked) {
      showFieldError(`members[${idx}].device_confirm`, `Konfirmasi kebijakan perangkat elektronik untuk Tamu ${idx + 1} wajib dicentang`);
      valid = false;
    }
  });

  return valid;
}

function validateAllPhotos() {
  if (scheduledToggle.checked) return true;
  let valid = true;

  Array.from(membersContainer.children).forEach((block, idx) => {
    const widgets = memberWidgets.get(block);
    if (!widgets.photo.getValue()) {
      showFieldError(`members[${idx}].photo`, 'Foto tamu wajib diisi');
      valid = false;
    }
  });

  return valid;
}

function collectMembers() {
  return Array.from(membersContainer.children).map((block) => {
    const widgets = memberWidgets.get(block);
    const selectedDevice = block.querySelector('.m-device-status:checked');
    return {
      full_name: block.querySelector('.m-name').value.trim(),
      nik: block.querySelector('.m-nik').value.trim(),
      phone_number: block.querySelector('.m-phone').value.trim(),
      position: block.querySelector('.m-position').value.trim(),
      employee_id: block.querySelector('.m-employee-id').value.trim() || undefined,
      device_status: selectedDevice ? selectedDevice.value : undefined,
      device_reason: selectedDevice && selectedDevice.value === 'dibawa_alasan_khusus'
        ? block.querySelector('.m-device-reason').value.trim()
        : undefined,
      photo: widgets.photo.getValue() || undefined,
      ktp_photo: widgets.ktp_photo.getValue() || undefined,
    };
  });
}

function resetForm() {
  form.reset();
  membersContainer.innerHTML = '';
  memberWidgets.clear();
  memberSeq = 0;
  updateTargetOfficialOtherVisibility();
  updateCompanyPurposeRequirement();
  addMember();
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearAllErrors();
  resultBox.style.display = 'none';
  resultBox.classList.remove('error-box');

  const targetOfficialsOk = validateTargetOfficials();
  const purposeCategoryOk = validatePurposeCategory();
  const devicePoliciesOk = validateAllDevicePolicies();
  const photosOk = validateAllPhotos();

  if (!targetOfficialsOk || !purposeCategoryOk || !devicePoliciesOk || !photosOk) {
    resultBox.style.display = 'block';
    resultBox.classList.add('error-box');
    resultBox.textContent = 'Lengkapi seluruh field yang wajib diisi sebelum menyimpan.';
    return;
  }

  const selectedPurposeCategory = document.querySelector('.m-purpose-category:checked');

  const payload = {
    company: document.getElementById('company').value.trim(),
    target_officials: Array.from(document.querySelectorAll('.m-target-official:checked')).map((el) => el.value),
    target_official_other: targetOfficialOtherCheckbox.checked ? targetOfficialOtherInput.value.trim() : undefined,
    purpose_category: selectedPurposeCategory ? selectedPurposeCategory.value : undefined,
    purpose: document.getElementById('purpose').value.trim(),
    accompanied_by: document.getElementById('accompanied_by').value.trim() || undefined,
    vehicle_type: document.getElementById('vehicle').value || undefined,
    plate_number: document.getElementById('plate').value.trim() || undefined,
    is_scheduled: scheduledToggle.checked || undefined,
    members: collectMembers(),
  };

  try {
    const res = await api('/guests', { method: 'POST', body: JSON.stringify(payload) });
    resultBox.style.display = 'block';
    const count = res.data.member_count;
    resultBox.innerHTML = res.data.status === 'Draft'
      ? `Tamu terjadwal berhasil disimpan sebagai draft untuk ${count} tamu. Nomor registrasi: <strong>${escapeHtml(res.data.registration_number)}</strong> — lengkapi data yang masih kosong (Perusahaan/Keperluan, Foto Tamu, deklarasi Perangkat Elektronik) kapan saja sebelum tamu tiba di <a class="link" href="detail-tamu?id=${res.data.id}">halaman Detail Tamu</a>.`
      : `Pendaftaran berhasil untuk ${count} tamu. Nomor registrasi: <strong>${escapeHtml(res.data.registration_number)}</strong> — <a class="link" href="detail-tamu?id=${res.data.id}">Lihat detail</a>`;
    resetForm();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    resultBox.style.display = 'block';
    resultBox.classList.add('error-box');
    resultBox.textContent = err.message;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (err.fields) {
      Object.entries(err.fields).forEach(([field, message]) => showFieldError(field, message));
    }
  }
});

cancelBtn.addEventListener('click', () => {
  if (confirm('Batalkan pengisian formulir?')) {
    resultBox.style.display = 'none';
    resetForm();
  }
});

addMember();
