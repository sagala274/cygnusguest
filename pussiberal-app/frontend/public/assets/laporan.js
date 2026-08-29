requireAuth();
requireRole('admin', 'verifikator');
renderNav('laporan');

const tbody = document.getElementById('reportTableBody');
const resultBox = document.getElementById('resultBox');

function showMessage(message, isError) {
  resultBox.style.display = 'block';
  resultBox.textContent = message;
  resultBox.classList.toggle('error-box', !!isError);
}

async function load() {
  const from = document.getElementById('fromDate').value;
  const to = document.getElementById('toDate').value;

  tbody.innerHTML = `<tr><td colspan="7">Memuat data...</td></tr>`;
  try {
    const params = new URLSearchParams({
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    });
    const res = await api(`/reports/visits?${params.toString()}`);

    if (!res.data.length) {
      tbody.innerHTML = `<tr><td colspan="7">Tidak ada data pada periode ini.</td></tr>`;
      return;
    }

    tbody.innerHTML = res.data
      .map(
        (r) => `
      <tr>
        <td>${escapeHtml(r.registration_number)}</td>
        <td>${escapeHtml(r.company)}</td>
        <td>${r.member_count}</td>
        <td>${escapeHtml(r.member_names || '-')}</td>
        <td><span class="badge ${statusBadgeClass(r.status)}">${escapeHtml(r.status)}</span></td>
        <td>${formatDateTime(r.check_in_at)}</td>
        <td>${formatDateTime(r.check_out_at)}</td>
      </tr>
    `
      )
      .join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7">${escapeHtml(err.message)}</td></tr>`;
  }
}

document.getElementById('filterBtn').addEventListener('click', load);

async function exportReport(format, filename) {
  resultBox.style.display = 'none';
  try {
    const from = document.getElementById('fromDate').value;
    const to = document.getElementById('toDate').value;
    const params = new URLSearchParams({ format, ...(from ? { from } : {}), ...(to ? { to } : {}) });
    await downloadFile(`/reports/visits/export?${params.toString()}`, filename);
  } catch (err) {
    showMessage(err.message, true);
  }
}

document.getElementById('exportXlsxBtn').addEventListener('click', () => exportReport('xlsx', 'rekap-kunjungan.xlsx'));
document.getElementById('exportPdfBtn').addEventListener('click', () => exportReport('pdf', 'rekap-kunjungan.pdf'));

load();
