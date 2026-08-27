requireAuth();
requireRole('admin', 'pos_depan');
renderNav('pendaftaran.html');

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

function memberBlockHTML(seq) {
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
          <input type="text" class="m-name" placeholder="Sesuai kartu identitas" required>
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
          <label class="photo-widget-label">Foto Tamu <span class="optional-badge">Opsional</span></label>
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
          <label>PERANGKAT ELEKTRONIK <span class="required">*</span></label>
          <div class="device-options">
            <label class="device-option">
              <input type="radio" name="deviceStatus-${seq}" class="m-device-status" value="tidak_membawa">
              <span>Tidak membawa perangkat elektronik</span>
            </label>
            <label class="device-option">
              <input type="radio" name="deviceStatus-${seq}" class="m-device-status" value="dititipkan" checked>
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

function initPhotoWidget(root, facingMode) {
  let mediaStream = null;
  let capturedPhoto = null;

  const placeholder = root.querySelector('.photo-frame-empty');
  const video = root.querySelector('video');
  const img = root.querySelector('img');
  const canvas = root.querySelector('canvas');
  const startBtn = root.querySelector('.start-camera-btn');
  const captureBtn = root.querySelector('.capture-btn');
  const retakeBtn = root.querySelector('.retake-btn');
  const uploadBtn = root.querySelector('.upload-btn');
  const fileInput = root.querySelector('.photo-file-input');
  const hint = root.querySelector('.photo-hint');

  function showError(msg) { hint.textContent = msg || ''; }

  function stopCamera() {
    if (mediaStream) {
      mediaStream.getTracks().forEach((t) => t.stop());
      mediaStream = null;
    }
  }

  function reset() {
    stopCamera();
    capturedPhoto = null;
    showError('');
    img.src = '';
    img.style.display = 'none';
    video.style.display = 'none';
    placeholder.style.display = 'flex';
    startBtn.style.display = 'inline-block';
    captureBtn.style.display = 'none';
    retakeBtn.style.display = 'none';
  }

  function applyImage(source, w, h) {
    const maxW = 640;
    const scale = Math.min(1, maxW / w);
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
    capturedPhoto = canvas.toDataURL('image/jpeg', 0.8);

    stopCamera();
    video.style.display = 'none';
    img.src = capturedPhoto;
    img.style.display = 'block';
    placeholder.style.display = 'none';
    captureBtn.style.display = 'none';
    retakeBtn.style.display = 'inline-block';
    startBtn.style.display = 'none';
  }

  startBtn.addEventListener('click', async () => {
    showError('');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showError('Browser ini tidak mendukung akses kamera. Gunakan opsi unggah.');
      return;
    }
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode }, audio: false });
      video.srcObject = mediaStream;
      placeholder.style.display = 'none';
      img.style.display = 'none';
      video.style.display = 'block';
      startBtn.style.display = 'none';
      captureBtn.style.display = 'inline-block';
      retakeBtn.style.display = 'none';
    } catch (err) {
      showError('Tidak dapat mengakses kamera (' + err.message + ').');
    }
  });

  captureBtn.addEventListener('click', () => {
    applyImage(video, video.videoWidth || 640, video.videoHeight || 480);
  });

  retakeBtn.addEventListener('click', reset);
  uploadBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    showError('');
    const file = fileInput.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { showError('File harus berupa gambar.'); return; }
    if (file.size > 8 * 1024 * 1024) { showError('Ukuran file maksimal 8MB.'); return; }

    const reader = new FileReader();
    reader.onload = () => {
      const im = new Image();
      im.onload = () => applyImage(im, im.width, im.height);
      im.onerror = () => showError('Gagal membaca file gambar.');
      im.src = reader.result;
    };
    reader.readAsDataURL(file);
  });

  return { getValue: () => capturedPhoto, reset, stopCamera };
}

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

function addMember() {
  const seq = memberSeq++;
  membersContainer.insertAdjacentHTML('beforeend', memberBlockHTML(seq));
  const block = membersContainer.querySelector(`[data-seq="${seq}"]`);

  const nikInput = block.querySelector('.m-nik');
  nikInput.addEventListener('input', () => {
    nikInput.value = nikInput.value.replace(/\D/g, '').slice(0, 16);
  });

  const photoWidget = initPhotoWidget(block.querySelector('[data-kind="photo"]'), 'user');
  const ktpWidget = initPhotoWidget(block.querySelector('[data-kind="ktp_photo"]'), 'environment');
  memberWidgets.set(block, { photo: photoWidget, ktp_photo: ktpWidget });

  wireDevicePolicy(block);

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

  if (!targetOfficialsOk || !purposeCategoryOk || !devicePoliciesOk) {
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
    vehicle_type: document.getElementById('vehicle').value || undefined,
    plate_number: document.getElementById('plate').value.trim() || undefined,
    members: collectMembers(),
  };

  try {
    const res = await api('/guests', { method: 'POST', body: JSON.stringify(payload) });
    resultBox.style.display = 'block';
    const count = res.data.member_count;
    resultBox.innerHTML = `Pendaftaran berhasil untuk ${count} tamu. Nomor registrasi: <strong>${escapeHtml(res.data.registration_number)}</strong> — <a class="link" href="detail-tamu.html?id=${res.data.id}">Lihat detail</a>`;
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
