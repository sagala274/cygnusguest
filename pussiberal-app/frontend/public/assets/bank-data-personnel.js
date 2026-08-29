requireAuth();
requireRole('admin', 'verifikator');
renderNav('bank-data');

const params = new URLSearchParams(window.location.search);
const nik = params.get('nik');
const memberId = params.get('member_id');
const resultBox = document.getElementById('resultBox');

if (!nik) {
  window.location.href = 'bank-data';
}

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
      <div class="detail-row"><span class="detail-label">Jabatan Terakhir</span><span class="detail-value">${escapeHtml(p.position)}</span></div>
      <div class="detail-row"><span class="detail-label">Nomor HP</span><span class="detail-value">${escapeHtml(p.phone_number)}</span></div>
      <div class="detail-row"><span class="detail-label">Afiliasi</span><span class="detail-value">${escapeHtml(p.affiliation || '-')}</span></div>
      <div class="detail-row"><span class="detail-label">Kategori Tamu Terkini</span><span class="detail-value"><span class="badge ${securityCategoryBadgeClass(p.security_category)}">${escapeHtml(securityCategoryLabel(p.security_category))}</span></span></div>
      <div class="detail-row"><span class="detail-label">Perusahaan Terkait</span><span class="detail-value">${escapeHtml(p.companies.join(', '))}</span></div>
      <div class="detail-row"><span class="detail-label">Jumlah Kunjungan</span><span class="detail-value">${p.visit_count}x</span></div>
      <div class="detail-row"><span class="detail-label">Kunjungan Pertama</span><span class="detail-value">${formatDateTime(p.first_visit_at)}</span></div>
      <div class="detail-row"><span class="detail-label">Kunjungan Terakhir</span><span class="detail-value">${formatDateTime(p.last_visit_at)}</span></div>
    `;

    const analysisSection = document.getElementById('analysisSection');
    if (p.analysis_notes) {
      document.getElementById('analysisNotes').textContent = p.analysis_notes;
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

load();
