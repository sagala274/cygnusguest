const express = require('express');
const PDFDocument = require('pdfkit');
const pool = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { isIndependentCompany, VALID_SECURITY_CATEGORIES } = require('../utils/validators');
const { formatJakartaDateTime, formatJakartaDate } = require('../utils/datetime');
const { logAudit } = require('../utils/audit');
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
      gm.id, gm.guest_id, gm.nik, gm.full_name, gm.other_names, gm.phone_number, gm.position, gm.employee_id,
      gm.affiliation, gm.social_media, gm.address, gm.analysis_notes, gm.security_category, gm.device_status, gm.device_reason,
      g.company, g.registration_number, g.created_at, g.status AS registration_status
    FROM guest_members gm
    JOIN guests g ON g.id = gm.guest_id
    ORDER BY g.company, gm.full_name, g.created_at DESC
  `);

  // MySQL tidak mendukung COUNT(DISTINCT ..) sebagai window function --
  // dihitung manual di sini. "nik_shared_by_multiple_names" sengaja tetap
  // dihitung per-NIK saja (untuk mendeteksi anomali: NIK yang sama dipakai
  // >1 nama berbeda). Tapi visit_count/last_visit_at dihitung per identitas
  // (NIK + nama, dinormalisasi) -- bukan per-NIK saja -- supaya statistik
  // kunjungan satu nama TIDAK ikut tercampur dengan nama lain yang kebetulan
  // berbagi NIK yang sama (mis. NIK dummy/placeholder yang dipakai berulang).
  const namesByNik = new Map();
  const visitCountByIdentity = new Map();
  const lastVisitByIdentity = new Map();
  rows.forEach((r) => {
    if (!namesByNik.has(r.nik)) namesByNik.set(r.nik, new Set());
    const normalizedName = r.full_name.trim().toLowerCase();
    namesByNik.get(r.nik).add(normalizedName);

    const identityKey = `${r.nik}|${normalizedName}`;
    visitCountByIdentity.set(identityKey, (visitCountByIdentity.get(identityKey) || 0) + 1);
    const prev = lastVisitByIdentity.get(identityKey);
    if (!prev || new Date(r.created_at) > new Date(prev)) lastVisitByIdentity.set(identityKey, r.created_at);
  });

  return rows.map((r) => {
    const identityKey = `${r.nik}|${r.full_name.trim().toLowerCase()}`;
    return {
      ...r,
      visit_count: visitCountByIdentity.get(identityKey),
      last_visit_at: lastVisitByIdentity.get(identityKey),
      nik_shared_by_multiple_names: namesByNik.get(r.nik).size > 1,
    };
  });
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
      (p.other_names || '').toLowerCase().includes(needle) ||
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

  const [profileRows] = await pool.query(
    'SELECT company, security_category, profiling_notes, updated_at FROM company_profiles'
  );
  const profileMap = new Map(profileRows.map((r) => [r.company, r]));

  const data = groupByCompany(records).map((g) => ({
    company: g.company,
    profile: profileMap.get(g.company) || null,
    members: g.members.map((m) => ({
      id: m.id,
      guest_id: m.guest_id,
      nik: m.nik,
      full_name: m.full_name,
      other_names: m.other_names,
      phone_number: m.phone_number,
      position: m.position,
      employee_id: m.employee_id,
      affiliation: m.affiliation,
      social_media: m.social_media,
      address: m.address,
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

// PUT /api/bank-data/company  (ubah nama perusahaan untuk seluruh pendaftaran
// dalam kelompok ini sekaligus -- admin saja, karena berdampak ke banyak
// pendaftaran tamu langsung). Kelompok "Lainnya" (tamu tanpa afiliasi
// instansi -- lihat isIndependentCompany) sengaja tidak bisa diubah lewat
// sini karena bukan satu nilai company yang sama, melainkan gabungan banyak
// nilai berbeda (kosong, "pribadi", "umum", dst).
router.put('/company', requireRole('admin'), asyncHandler(async (req, res) => {
  const { old_company, new_company } = req.body || {};

  if (!old_company || !String(old_company).trim()) {
    return res.status(400).json({ error: 'Nama perusahaan lama wajib diisi' });
  }
  if (isIndependentCompany(old_company)) {
    return res.status(400).json({ error: 'Kelompok "Lainnya" tidak bisa diubah namanya di sini' });
  }
  const trimmedNew = String(new_company || '').trim();
  if (!trimmedNew) {
    return res.status(400).json({ error: 'Nama perusahaan baru wajib diisi' });
  }
  if (trimmedNew.length > 150) {
    return res.status(400).json({ error: 'Nama perusahaan maksimal 150 karakter' });
  }

  const oldTrimmed = String(old_company).trim();
  const [result] = await pool.execute(
    'UPDATE guests SET company = :new_company WHERE TRIM(company) = :old_company',
    { new_company: trimmedNew, old_company: oldTrimmed }
  );
  if (result.affectedRows === 0) {
    return res.status(404).json({ error: 'Tidak ada pendaftaran ditemukan untuk perusahaan ini' });
  }

  await logAudit(req.user.sub, 'rename_bank_data_company', 'guest_company', null, {
    old_company: oldTrimmed,
    new_company: trimmedNew,
    updated_guests: result.affectedRows,
  });

  res.json({ data: { updated_guests: result.affectedRows } });
}));

// DELETE /api/bank-data/company?company=...  (hapus SELURUH pendaftaran tamu
// dari satu perusahaan sekaligus -- admin saja. Menghapus baris di tabel
// guests otomatis ikut menghapus guest_members/vehicles/visits/notifications
// terkait lewat FOREIGN KEY ... ON DELETE CASCADE -- termasuk seluruh foto
// tamu & foto KTP tersimpan di baris tersebut. TIDAK BISA DIBATALKAN.
router.delete('/company', requireRole('admin'), asyncHandler(async (req, res) => {
  const { company } = req.query;

  if (!company || !String(company).trim()) {
    return res.status(400).json({ error: 'Nama perusahaan wajib diisi' });
  }
  if (isIndependentCompany(company)) {
    return res.status(400).json({ error: 'Kelompok "Lainnya" tidak bisa dihapus lewat sini' });
  }

  const trimmed = String(company).trim();
  const [result] = await pool.execute('DELETE FROM guests WHERE TRIM(company) = :company', { company: trimmed });
  if (result.affectedRows === 0) {
    return res.status(404).json({ error: 'Tidak ada pendaftaran ditemukan untuk perusahaan ini' });
  }

  await logAudit(req.user.sub, 'delete_bank_data_company', 'guest_company', null, {
    company: trimmed,
    deleted_guests: result.affectedRows,
  });

  res.json({ data: { deleted_guests: result.affectedRows } });
}));

// PUT /api/bank-data/company-profile  (isi/ubah hasil profiling untuk
// PERUSAHAAN itu sendiri -- terpisah dari analisa per-personel. Admin &
// Verifikator, mengikuti pola yang sama dengan "Kelola Analisa" per tamu.
// Kelompok "Lainnya" sengaja tidak bisa diberi profiling di sini karena
// bukan satu nilai company yang sama (lihat catatan di rute rename/hapus).
router.put('/company-profile', requireRole('admin', 'verifikator'), asyncHandler(async (req, res) => {
  const { company, security_category, profiling_notes } = req.body || {};

  if (!company || !String(company).trim()) {
    return res.status(400).json({ error: 'Nama perusahaan wajib diisi' });
  }
  const trimmedCompany = String(company).trim();
  if (isIndependentCompany(trimmedCompany)) {
    return res.status(400).json({ error: 'Kelompok "Lainnya" tidak bisa diberi profiling perusahaan di sini' });
  }
  if (security_category && !VALID_SECURITY_CATEGORIES.includes(security_category)) {
    return res.status(400).json({ error: 'Kategori tidak valid' });
  }
  if (profiling_notes && String(profiling_notes).length > 2000) {
    return res.status(400).json({ error: 'Hasil profiling maksimal 2000 karakter' });
  }

  await pool.execute(
    `INSERT INTO company_profiles (company, security_category, profiling_notes, updated_by)
     VALUES (:company, :security_category, :profiling_notes, :updated_by)
     ON DUPLICATE KEY UPDATE
       security_category = VALUES(security_category),
       profiling_notes = VALUES(profiling_notes),
       updated_by = VALUES(updated_by)`,
    {
      company: trimmedCompany,
      security_category: security_category || null,
      profiling_notes: profiling_notes && String(profiling_notes).trim() ? String(profiling_notes).trim() : null,
      updated_by: req.user.sub,
    }
  );

  await logAudit(req.user.sub, 'update_company_profile', 'company_profile', null, { company: trimmedCompany });

  res.json({ data: { company: trimmedCompany } });
}));

// GET /api/bank-data/personnel/:nik  (laporan lengkap satu orang, seluruh riwayat kunjungan)
router.get('/personnel/:nik', asyncHandler(async (req, res) => {
  const records = await fetchAllRecords();
  const visits = records
    .filter((r) => r.nik === req.params.nik)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  if (!visits.length) return res.status(404).json({ error: 'Data personel tidak ditemukan' });

  // Kalau diakses dari baris tertentu di Bank Data (member_id disertakan),
  // pakai identitas baris itu sebagai "headline" laporan -- bukan selalu
  // kunjungan terbaru. Penting saat satu NIK tercatat dengan >1 nama
  // berbeda (lihat nik_shared_by_multiple_names): mengklik nama tertentu
  // harus menampilkan laporan nama itu, bukan diam-diam beralih ke nama
  // dari kunjungan lain yang kebetulan lebih baru.
  const requestedMemberId = req.query.member_id ? Number(req.query.member_id) : null;
  const headline = (requestedMemberId && visits.find((v) => v.id === requestedMemberId)) || visits[0];

  // Foto (bisa sampai beberapa MB per baris) sengaja TIDAK ikut di-SELECT di
  // fetchAllRecords() (dipakai juga oleh endpoint daftar Bank Data yang bisa
  // memuat ratusan baris sekaligus) -- diambil terpisah di sini, hanya untuk
  // satu baris (headline) yang benar-benar dibutuhkan laporan personel ini.
  const [[photoRow]] = await pool.execute('SELECT photo, ktp_photo FROM guest_members WHERE id = :id', { id: headline.id });

  // SELURUH laporan (ringkasan maupun riwayat kunjungan) di-scope ke nama
  // headline saja -- bukan seluruh riwayat NIK -- supaya saat satu NIK
  // dipakai >1 nama berbeda (anomali, biasanya NIK dummy/placeholder yang
  // dipakai berulang), riwayat orang lain yang kebetulan berbagi NIK yang
  // sama TIDAK ikut tercampur ke laporan personel ini. Nama-nama lain yang
  // tercatat dengan NIK yang sama tetap disurfacekan lewat
  // "other_names_same_nik" (bukan disembunyikan) supaya anomalinya tetap
  // bisa ditelusuri lebih lanjut lewat pencarian NIK di Bank Data.
  const headlineName = headline.full_name.trim().toLowerCase();
  const sameIdentityVisits = visits.filter((r) => r.full_name.trim().toLowerCase() === headlineName);
  const otherNamesSameNik = [...new Set(
    visits
      .filter((r) => r.full_name.trim().toLowerCase() !== headlineName)
      .map((r) => r.full_name.trim())
  )];
  const companies = [...new Set(sameIdentityVisits.map((r) => r.company.trim()))];

  res.json({
    data: {
      guest_id: headline.guest_id,
      member_id: headline.id,
      nik: headline.nik,
      full_name: headline.full_name,
      other_names: headline.other_names,
      phone_number: headline.phone_number,
      position: headline.position,
      employee_id: headline.employee_id,
      affiliation: headline.affiliation,
      social_media: headline.social_media,
      address: headline.address,
      photo: photoRow.photo,
      ktp_photo: photoRow.ktp_photo,
      security_category: headline.security_category,
      analysis_notes: headline.analysis_notes,
      visit_count: headline.visit_count,
      first_visit_at: sameIdentityVisits[sameIdentityVisits.length - 1].created_at,
      last_visit_at: headline.last_visit_at,
      companies,
      nik_shared_by_multiple_names: headline.nik_shared_by_multiple_names,
      other_names_same_nik: otherNamesSameNik,
      visits: sameIdentityVisits.map((r) => ({
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
  { header: 'Tanggal', width: 65, value: (r) => formatJakartaDate(r.created_at) },
  { header: 'Nama', width: 85, value: (r) => r.full_name },
  { header: 'No. Registrasi', width: 90, value: (r) => r.registration_number },
  { header: 'Perusahaan', width: 95, value: (r) => r.company },
  { header: 'Jabatan', width: 65, value: (r) => r.position },
  { header: 'Kategori', width: 75, value: (r) => securityCategoryLabelId(r.security_category) },
  { header: 'Status', width: 65, value: (r) => r.registration_status },
];

// Blok "Hasil Profiling Perusahaan" -- dicetak sebelum tabel personel,
// baik di rekap lengkap maupun PDF per-perusahaan. Tidak menulis apa pun
// kalau belum ada profiling yang diisi (mis. kelompok "Lainnya").
function renderCompanyProfileBlock(doc, profile) {
  if (!profile || (!profile.security_category && !profile.profiling_notes)) return;

  doc.fontSize(10);
  doc.font('Helvetica-Bold').text('Kategori Perusahaan: ', { continued: true })
    .font('Helvetica').text(securityCategoryLabelId(profile.security_category));
  if (profile.profiling_notes) {
    doc.moveDown(0.2);
    doc.font('Helvetica-Bold').text('Hasil Profiling Perusahaan:');
    doc.font('Helvetica').text(profile.profiling_notes);
  }
  doc.moveDown(0.5);
  doc.fontSize(9);
}

function renderFullBankDataPDF(doc, groups, profiles) {
  doc.fontSize(16).font('Helvetica-Bold').text('Rekap Bank Data Personel Tamu - PUSSIBERAL', { align: 'center' });
  doc.fontSize(9).font('Helvetica').text(`Dicetak: ${formatJakartaDateTime(new Date())}`, { align: 'center' });
  doc.moveDown();

  groups.forEach((g, idx) => {
    if (idx > 0) doc.addPage();
    doc.fontSize(13).font('Helvetica-Bold').text(`${g.company} (${g.members.length} catatan)`);
    doc.moveDown(0.4);
    doc.fontSize(9);
    renderCompanyProfileBlock(doc, profiles ? profiles.get(g.company) : null);
    drawPersonnelTable(doc, g.members, GROUP_COLUMNS);
  });
}

function renderGroupPDF(doc, company, records, profile) {
  doc.fontSize(16).font('Helvetica-Bold').text(`Bank Data Personel - ${company}`, { align: 'center' });
  doc.fontSize(9).font('Helvetica').text(`Dicetak: ${formatJakartaDateTime(new Date())} • ${records.length} catatan`, { align: 'center' });
  doc.moveDown();
  doc.fontSize(9);
  renderCompanyProfileBlock(doc, profile);
  drawPersonnelTable(doc, records, GROUP_COLUMNS);
}

function renderPersonnelPDF(doc, visits, headlineRecord) {
  const latest = headlineRecord || visits[0];

  doc.fontSize(16).font('Helvetica-Bold').text('Laporan Personel - Bank Data PUSSIBERAL', { align: 'center' });
  doc.fontSize(9).font('Helvetica').text(`Dicetak: ${formatJakartaDateTime(new Date())}`, { align: 'center' });
  doc.moveDown();

  doc.fontSize(10);
  const field = (label, value) => {
    doc.font('Helvetica-Bold').text(`${label}: `, { continued: true }).font('Helvetica').text(value === null || value === undefined || value === '' ? '-' : String(value));
  };

  field('Nama', latest.full_name);
  field('Nama Lainnya', latest.other_names);
  field('NIK', latest.nik);
  field('Jabatan Terakhir', latest.position);
  field('Nomor HP', latest.phone_number);
  field('Afiliasi', latest.affiliation);
  field('Media Sosial', latest.social_media);
  field('Alamat Rumah', latest.address);
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
  const { format, scope = 'all', company, nik, member_id, q, category } = req.query;

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

    const requestedMemberId = member_id ? Number(member_id) : null;
    const headlineRecord = (requestedMemberId && visits.find((v) => v.id === requestedMemberId)) || visits[0];
    const headlineName = headlineRecord.full_name.trim().toLowerCase();
    const sameIdentityVisits = visits.filter((r) => r.full_name.trim().toLowerCase() === headlineName);

    layout = 'portrait';
    filename = `bank-data-${sanitizeFilename(headlineRecord.full_name)}.pdf`;
    renderFn = (doc) => renderPersonnelPDF(doc, sameIdentityVisits, headlineRecord);
  } else if (scope === 'company') {
    if (!company) return res.status(400).json({ error: 'Parameter company wajib diisi' });
    const groupRecords = allRecords.filter((r) => {
      const groupName = isIndependentCompany(r.company) ? INDEPENDENT_GROUP_LABEL : r.company.trim();
      return groupName === company;
    });
    if (!groupRecords.length) return res.status(404).json({ error: 'Tidak ada data untuk perusahaan ini' });

    const [profileRows] = await pool.execute(
      'SELECT security_category, profiling_notes FROM company_profiles WHERE company = :company',
      { company }
    );
    const profile = profileRows[0] || null;

    filename = `bank-data-${sanitizeFilename(company)}.pdf`;
    renderFn = (doc) => renderGroupPDF(doc, company, groupRecords, profile);
  } else {
    const filtered = applyFilters(allRecords, { q, category });
    if (!filtered.length) return res.status(404).json({ error: 'Tidak ada data untuk diunduh' });

    const [profileRows] = await pool.query(
      'SELECT company, security_category, profiling_notes FROM company_profiles'
    );
    const profiles = new Map(profileRows.map((r) => [r.company, r]));

    renderFn = (doc) => renderFullBankDataPDF(doc, groupByCompany(filtered), profiles);
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const doc = new PDFDocument({ margin: 30, size: 'A4', layout });
  doc.pipe(res);
  renderFn(doc);
  doc.end();
}));

module.exports = router;
