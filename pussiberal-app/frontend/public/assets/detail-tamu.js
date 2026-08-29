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

function memberCardHTML(m) {
  const photoBlock = (kind, label, value) => `
    <div class="photo-widget">
      <label class="photo-widget-label">${label}</label>
      ${
        value
          ? `<div class="photo-frame" style="max-width:220px;"><img src="${value}" alt="${label}"></div>
             ${isAdmin ? `<div class="photo-actions"><button type="button" class="btn btn-danger btn-small delete-photo-btn" data-member-id="${m.id}" data-kind="${kind}">Hapus ${label}</button></div>` : ''}`
          : `<div class="photo-frame" style="max-width:220px;"><div class="photo-frame-empty">Tidak ada foto</div></div>`
      }
    </div>
  `;

  return `
    <div class="member-card">
      <div class="member-card-head">
        <span class="member-card-title">${escapeHtml(m.full_name)}</span>
      </div>
      <div class="detail-row"><span class="detail-label">NIK</span><span class="detail-value">${escapeHtml(m.nik)}</span></div>
      <div class="detail-row"><span class="detail-label">Nomor HP</span><span class="detail-value">${escapeHtml(m.phone_number)}</span></div>
      <div class="detail-row"><span class="detail-label">Jabatan</span><span class="detail-value">${escapeHtml(m.position)}</span></div>
      <div class="detail-row"><span class="detail-label">Nomor ID Karyawan</span><span class="detail-value">${escapeHtml(m.employee_id || '-')}</span></div>
      <div class="detail-row"><span class="detail-label">Perangkat Elektronik</span><span class="detail-value">${escapeHtml(deviceStatusLabel(m.device_status))}</span></div>
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
    </div>
  `;
}

async function load() {
  try {
    const res = await api(`/guests/${guestId}`);
    const g = res.data;

    document.getElementById('guestName').textContent = g.company;
    document.getElementById('regNumber').textContent = `No. Registrasi: ${g.registration_number} — ${g.members.length} tamu`;

    document.getElementById('detailRows').innerHTML = `
      <div class="detail-row"><span class="detail-label">Perusahaan / Instansi</span><span class="detail-value">${escapeHtml(g.company)}</span></div>
      <div class="detail-row"><span class="detail-label">Tujuan Menghadap Kepada</span><span class="detail-value">${escapeHtml(targetOfficialsLabel(g.target_officials, g.target_official_other))}</span></div>
      <div class="detail-row"><span class="detail-label">Kategori Keperluan</span><span class="detail-value">${escapeHtml(purposeCategoryLabel(g.purpose_category))}</span></div>
      <div class="detail-row"><span class="detail-label">Detail Tujuan Menghadap</span><span class="detail-value">${escapeHtml(g.purpose)}</span></div>
      <div class="detail-row"><span class="detail-label">Kendaraan</span><span class="detail-value">${escapeHtml(g.vehicle_type || '-')} ${g.plate_number ? '&middot; ' + escapeHtml(g.plate_number) : ''}</span></div>
      <div class="detail-row"><span class="detail-label">Status Pendaftaran</span><span class="detail-value"><span class="badge ${statusBadgeClass(g.status)}">${escapeHtml(g.status)}</span></span></div>
      <div class="detail-row"><span class="detail-label">Status Kunjungan</span><span class="detail-value">${escapeHtml(g.visit_status || '-')}</span></div>
      <div class="detail-row"><span class="detail-label">Check-in</span><span class="detail-value">${formatDateTime(g.check_in_at)}</span></div>
      <div class="detail-row"><span class="detail-label">Check-out</span><span class="detail-value">${formatDateTime(g.check_out_at)}</span></div>
      <div class="detail-row"><span class="detail-label">Terdaftar Pada</span><span class="detail-value">${formatDateTime(g.created_at)}</span></div>
    `;

    document.getElementById('membersList').innerHTML = g.members.map(memberCardHTML).join('');

    document.querySelectorAll('.delete-photo-btn').forEach((btn) => {
      btn.addEventListener('click', () => deletePhoto(btn.dataset.memberId, btn.dataset.kind));
    });

    // Verifikasi (verifikator/admin): hanya tampil saat status masih menunggu verifikasi
    const verifySection = document.getElementById('verifySection');
    verifySection.style.display = canVerify && g.status === 'Menunggu Verifikasi' ? 'block' : 'none';

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
      }
    }

    const checkInBtn = document.getElementById('checkInBtn');
    if (checkInBtn) checkInBtn.addEventListener('click', () => doVisitAction('check-in'));

    const checkOutBtn = document.getElementById('checkOutBtn');
    if (checkOutBtn) checkOutBtn.addEventListener('click', () => doVisitAction('check-out'));
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
  try {
    await api(`/guests/${guestId}/verify`, { method: 'POST', body: JSON.stringify({ status }) });
    showMessage(status === 'Disetujui' ? 'Pendaftaran disetujui.' : 'Pendaftaran ditolak.', false);
    load();
  } catch (err) {
    showMessage(err.message, true);
  }
}

const approveBtn = document.getElementById('approveBtn');
if (approveBtn) approveBtn.addEventListener('click', () => doVerify('Disetujui'));

const rejectBtn = document.getElementById('rejectBtn');
if (rejectBtn) {
  rejectBtn.addEventListener('click', () => {
    if (confirm('Tolak pendaftaran tamu ini?')) doVerify('Ditolak');
  });
}

load();
