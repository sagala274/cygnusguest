const express = require('express');
const PDFDocument = require('pdfkit');
const pool = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { isIndependentCompany } = require('../utils/validators');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
router.use(authenticate, requireRole('admin', 'verifikator'));

const INDEPENDENT_GROUP_LABEL = 'Lainnya';

function securityCategoryLabelId(category) {
  return {
    aman: 'Aman',
    perlu_perhatian: 'Perlu Perhatian',
    perlu_penanganan: 'Perlu Penanganan',
  }[category] || 'Belum Dianalisa';
}

function sanitizeFilename(value) {
  return String(value).replace(/[^a-zA-Z0-9\-_. ]/g, '_').trim().slice(0, 80) || 'data';
}

// Bank data personel tamu: SATU BARIS PER PENDAFTARAN (bukan per-NIK).
// Sengaja tidak digabung berdasarkan NIK -- NIK yang sama pernah dipakai oleh
// beberapa nama berbeda dalam data nyata (typo/placeholder saat entri), dan
// menggabungkannya akan MENYEMBUNYIKAN nama-nama tersebut secara diam-diam.
// visit_count/last_visit_at dihitung berdasarkan NIK sebagai info pendukung
// (mis. mendeteksi NIK yang dipakai berulang oleh nama berbeda), tapi tidak
// pernah dipakai untuk menyembunyikan baris manapun.
async function fetchAllRecords() {
  const [rows] = await pool.query(`
    SELECT
      gm.id, gm.guest_id, gm.nik, gm.full_name, gm.phone_number, gm.position, gm.employee_id,
      gm.affiliation, gm.analysis_notes, gm.security_category, gm.device_status, gm.device_reason,
      g.company, g.registration_number, g.created_at, g.status AS registration_status
    FROM guest_members gm
    JOIN guests g ON g.id = gm.guest_id
    ORDER BY g.company, gm.full_name, g.created_at DESC
  `);

  // MySQL tidak mendukung COUNT(DISTINCT ..) sebagai window function --
  // dihitung manual di sini untuk mendeteksi NIK yang dipakai >1 nama berbeda.
  const namesByNik = new Map();
  const visitCountByNik = new Map();
  const lastVisitByNik = new Map();
  rows.forEach((r) => {
    if (!namesByNik.has(r.nik)) namesByNik.set(r.nik, new Set());
    namesByNik.get(r.nik).add(r.full_name.trim().toLowerCase());
    visitCountByNik.set(r.nik, (visitCountByNik.get(r.nik) || 0) + 1);
    const prev = lastVisitByNik.get(r.nik);
    if (!prev || new Date(r.created_at) > new Date(prev)) lastVisitByNik.set(r.nik, r.created_at);
  });

  return rows.map((r) => ({
    ...r,
    visit_count: visitCountByNik.get(r.nik),
    last_visit_at: lastVisitByNik.get(r.nik),
    nik_shared_by_multiple_names: namesByNik.get(r.nik).size > 1,
  }));
}

function groupByCompany(records) {
  const groups = new Map();
  records.forEach((p) => {
    const groupName = isIndependentCompany(p.company) ? INDEPENDENT_GROUP_LABEL : p.company.trim();
    if (!groups.has(groupName)) groups.set(groupName, []);
    groups.get(groupName).push(p);
  });

  const data = Array.from(groups.entries())
    .filter(([name]) => name !== INDEPENDENT_GROUP_LABEL)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([company, members]) => ({ company, members }));

  if (groups.has(INDEPENDENT_GROUP_LABEL)) {
    data.push({ company: INDEPENDENT_GROUP_LABEL, members: groups.get(INDEPENDENT_GROUP_LABEL) });
  }
  return data;
}

function applyFilters(records, { q, category }) {
  let filtered = records;
  if (q) {
    const needle = q.toLowerCase();
    filtered = filtered.filter((p) =>
      p.full_name.toLowerCase().includes(needle) ||
      p.nik.includes(needle) ||
      p.company.toLowerCase().includes(needle) ||
      (p.affiliation || '').toLowerCase().includes(needle)
    );
  }
  if (category) filtered = filtered.filter((p) => p.security_category === category);
  return filtered;
}

// GET /api/bank-data  (?q=&category=)
router.get('/', asyncHandler(async (req, res) => {
  const records = applyFilters(await fetchAllRecords(), req.query);

  const data = groupByCompany(records).map((g) => ({
    company: g.company,
    members: g.members.map((m) => ({
      id: m.id,
      guest_id: m.guest_id,
      nik: m.nik,
      full_name: m.full_name,
      phone_number: m.phone_number,
      position: m.position,
      employee_id: m.employee_id,
      affiliation: m.affiliation,
      analysis_notes: m.analysis_notes,
      security_category: m.security_category,
      registration_number: m.registration_number,
      visit_count: m.visit_count,
      last_visit_at: m.last_visit_at,
      nik_shared_by_multiple_names: m.nik_shared_by_multiple_names,
    })),
  }));

  const uniqueNikCount = new Set(records.map((p) => p.nik)).size;

  res.json({
    data,
    total_records: records.length,
    total_unique_nik: uniqueNikCount,
    total_groups: data.length,
  });
}));

// GET /api/bank-data/personnel/:nik  (laporan lengkap satu orang, seluruh riwayat kunjungan)
router.get('/personnel/:nik', asyncHandler(async (req, res) => {
  const records = await fetchAllRecords();
  const visits = records
    .filter((r) => r.nik === req.params.nik)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  if (!visits.length) return res.status(404).json({ error: 'Data personel tidak ditemukan' });

  const latest = visits[0];
  const companies = [...new Set(visits.map((r) => r.company.trim()))];

  res.json({
    data: {
      nik: latest.nik,
      full_name: latest.full_name,
      phone_number: latest.phone_number,
      position: latest.position,
      employee_id: latest.employee_id,
      affiliation: latest.affiliation,
      security_category: latest.security_category,
      analysis_notes: latest.analysis_notes,
      visit_count: latest.visit_count,
      first_visit_at: visits[visits.length - 1].created_at,
      last_visit_at: latest.last_visit_at,
      companies,
      nik_shared_by_multiple_names: latest.nik_shared_by_multiple_names,
      visits: visits.map((r) => ({
        guest_id: r.guest_id,
        member_id: r.id,
        registration_number: r.registration_number,
        company: r.company,
        full_name: r.full_name,
        position: r.position,
        affiliation: r.affiliation,
        security_category: r.security_category,
        analysis_notes: r.analysis_notes,
        device_status: r.device_status,
        device_reason: r.device_reason,
        registration_status: r.registration_status,
        created_at: r.created_at,
      })),
    },
  });
}));

function drawPersonnelTable(doc, records, columns) {
  const startX = doc.page.margins.left;
  let y = doc.y;
  const rowHeight = 16;

  function ensureSpace() {
    if (y > doc.page.height - doc.page.margins.bottom - rowHeight) {
      doc.addPage();
      y = doc.page.margins.top;
    }
  }

  function drawRow(values, bold) {
    ensureSpace();
    let x = startX;
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica');
    values.forEach((v, i) => {
      doc.text(v === null || v === undefined || v === '' ? '-' : String(v), x, y, { width: columns[i].width, ellipsis: true });
      x += columns[i].width;
    });
    y += rowHeight;
  }

  drawRow(columns.map((c) => c.header), true);
  records.forEach((r) => drawRow(columns.map((c) => c.value(r))));

  doc.y = y;
}

const GROUP_COLUMNS = [
  { header: 'Nama', width: 110, value: (r) => r.full_name },
  { header: 'NIK', width: 110, value: (r) => r.nik },
  { header: 'Jabatan', width: 100, value: (r) => r.position },
  { header: 'No. HP', width: 90, value: (r) => r.phone_number },
  { header: 'Afiliasi', width: 110, value: (r) => r.affiliation },
  { header: 'Kategori', width: 100, value: (r) => securityCategoryLabelId(r.security_category) },
  { header: 'Kunj.', width: 40, value: (r) => r.visit_count },
];

const VISIT_HISTORY_COLUMNS = [
  { header: 'Tanggal', width: 75, value: (r) => new Date(r.created_at).toLocaleDateString('id-ID') },
  { header: 'No. Registrasi', width: 105, value: (r) => r.registration_number },
  { header: 'Perusahaan', width: 130, value: (r) => r.company },
  { header: 'Jabatan', width: 90, value: (r) => r.position },
  { header: 'Kategori', width: 90, value: (r) => securityCategoryLabelId(r.security_category) },
  { header: 'Status', width: 80, value: (r) => r.registration_status },
];

function renderFullBankDataPDF(doc, groups) {
  doc.fontSize(16).font('Helvetica-Bold').text('Rekap Bank Data Personel Tamu - PUSSIBERAL', { align: 'center' });
  doc.fontSize(9).font('Helvetica').text(`Dicetak: ${new Date().toLocaleString('id-ID')}`, { align: 'center' });
  doc.moveDown();

  groups.forEach((g, idx) => {
    if (idx > 0) doc.addPage();
    doc.fontSize(13).font('Helvetica-Bold').text(`${g.company} (${g.members.length} catatan)`);
    doc.moveDown(0.4);
    doc.fontSize(9);
    drawPersonnelTable(doc, g.members, GROUP_COLUMNS);
  });
}

function renderGroupPDF(doc, company, records) {
  doc.fontSize(16).font('Helvetica-Bold').text(`Bank Data Personel - ${company}`, { align: 'center' });
  doc.fontSize(9).font('Helvetica').text(`Dicetak: ${new Date().toLocaleString('id-ID')} • ${records.length} catatan`, { align: 'center' });
  doc.moveDown();
  doc.fontSize(9);
  drawPersonnelTable(doc, records, GROUP_COLUMNS);
}

function renderPersonnelPDF(doc, visits) {
  const latest = visits[0];

  doc.fontSize(16).font('Helvetica-Bold').text('Laporan Personel - Bank Data PUSSIBERAL', { align: 'center' });
  doc.fontSize(9).font('Helvetica').text(`Dicetak: ${new Date().toLocaleString('id-ID')}`, { align: 'center' });
  doc.moveDown();

  doc.fontSize(10);
  const field = (label, value) => {
    doc.font('Helvetica-Bold').text(`${label}: `, { continued: true }).font('Helvetica').text(value === null || value === undefined || value === '' ? '-' : String(value));
  };

  field('Nama', latest.full_name);
  field('NIK', latest.nik);
  field('Jabatan Terakhir', latest.position);
  field('Nomor HP', latest.phone_number);
  field('Afiliasi', latest.affiliation);
  field('Kategori Tamu Terkini', securityCategoryLabelId(latest.security_category));
  field('Jumlah Kunjungan', latest.visit_count);

  if (latest.nik_shared_by_multiple_names) {
    doc.moveDown(0.3);
    doc.fillColor('red').font('Helvetica-Bold').text('PERINGATAN: NIK ini tercatat dengan lebih dari satu nama berbeda pada riwayat pendaftaran lain. Periksa kembali identitas.');
    doc.fillColor('black').font('Helvetica');
  }

  if (latest.analysis_notes) {
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').text('Hasil Analisa Terkini:');
    doc.font('Helvetica').text(latest.analysis_notes, { width: 500 });
  }

  doc.moveDown();
  doc.fontSize(12).font('Helvetica-Bold').text('Riwayat Kunjungan');
  doc.moveDown(0.3);
  doc.fontSize(9);
  drawPersonnelTable(doc, visits, VISIT_HISTORY_COLUMNS);
}

// GET /api/bank-data/export?format=pdf&scope=all|company|personnel&company=&nik=&q=&category=
router.get('/export', asyncHandler(async (req, res) => {
  const { format, scope = 'all', company, nik, q, category } = req.query;

  if (format !== 'pdf') {
    return res.status(400).json({ error: 'Format tidak didukung. Gunakan format=pdf' });
  }

  const allRecords = await fetchAllRecords();
  let filename = 'bank-data-lengkap.pdf';
  let layout = 'landscape';
  let renderFn;

  if (scope === 'personnel') {
    if (!nik) return res.status(400).json({ error: 'Parameter nik wajib diisi' });
    const visits = allRecords
      .filter((r) => r.nik === nik)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    if (!visits.length) return res.status(404).json({ error: 'Data personel tidak ditemukan' });

    layout = 'portrait';
    filename = `bank-data-${sanitizeFilename(visits[0].full_name)}.pdf`;
    renderFn = (doc) => renderPersonnelPDF(doc, visits);
  } else if (scope === 'company') {
    if (!company) return res.status(400).json({ error: 'Parameter company wajib diisi' });
    const groupRecords = allRecords.filter((r) => {
      const groupName = isIndependentCompany(r.company) ? INDEPENDENT_GROUP_LABEL : r.company.trim();
      return groupName === company;
    });
    if (!groupRecords.length) return res.status(404).json({ error: 'Tidak ada data untuk perusahaan ini' });

    filename = `bank-data-${sanitizeFilename(company)}.pdf`;
    renderFn = (doc) => renderGroupPDF(doc, company, groupRecords);
  } else {
    const filtered = applyFilters(allRecords, { q, category });
    if (!filtered.length) return res.status(404).json({ error: 'Tidak ada data untuk diunduh' });

    renderFn = (doc) => renderFullBankDataPDF(doc, groupByCompany(filtered));
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const doc = new PDFDocument({ margin: 30, size: 'A4', layout });
  doc.pipe(res);
  renderFn(doc);
  doc.end();
}));

module.exports = router;
