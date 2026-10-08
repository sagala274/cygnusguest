const express = require('express');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const pool = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const asyncHandler = require('../utils/asyncHandler');
const { categoryOrderSql, ATTENDANCE_STATUSES, isWeekend } = require('../utils/attendance');
const { formatJakartaDate } = require('../utils/datetime');

const router = express.Router();
router.use(authenticate);

function isValidDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value));
}

// Label lengkap (Excel) & singkatan (PDF, kolomnya sempit karena satu kolom
// per hari) -- cuma dipakai di laporan ekspor ini, jadi tidak digabung ke
// STATUS_LABELS sisi frontend (absensi.js) yang sudah ada sendiri.
const STATUS_LABELS = {
  hadir: 'Hadir', wfh: 'WFH', dinas_dalam: 'Dinas Dalam', dinas_luar: 'Dinas Luar', sakit: 'Sakit', ijin: 'Ijin',
  cuti: 'Cuti', pendidikan: 'Pendidikan', bko: 'BKO', libur: 'Libur', terlambat: 'Terlambat', tanpa_keterangan: 'Tanpa Keterangan',
};
const STATUS_SHORT = {
  hadir: 'H', wfh: 'WFH', dinas_dalam: 'DD', dinas_luar: 'DL', sakit: 'S', ijin: 'I',
  cuti: 'C', pendidikan: 'P', bko: 'BKO', libur: 'L', terlambat: 'T', tanpa_keterangan: 'TK',
};

// Komponen tanggal LOKAL (bukan toISOString yang UTC) -- sama seperti pola
// isWeekend()/nowJakartaLocal() yang sudah dipakai di aplikasi ini, supaya
// tanggal pada attendance_records (kolom DATE) tidak bergeser sehari saat
// dicocokkan dengan daftar tanggal rentang laporan.
function toDateKey(value) {
  const d = value instanceof Date ? value : new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(dateStr, amount) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + amount);
  return toDateKey(dt);
}

// GET /api/attendance?date=YYYY-MM-DD
// Daftar seluruh personel aktif untuk satu tanggal, lengkap dengan status
// absensinya kalau sudah pernah diisi (LEFT JOIN -- null kalau belum diisi).
// Pimpinan ikut diberi akses BACA di sini (bukan di router.use di atas)
// supaya bisa klik-tembus dari pie chart dashboard untuk lihat detail
// personel per kelompok status, tanpa diberi akses ubah/simpan absensi.
router.get('/', requireRole('admin', 'verifikator', 'pimpinan'), asyncHandler(async (req, res) => {
  const { date } = req.query;
  if (!date || !isValidDate(date)) {
    return res.status(400).json({ error: 'Tanggal wajib diisi dengan format YYYY-MM-DD' });
  }

  const [rows] = await pool.execute(
    `SELECT p.id AS personnel_id, p.full_name, p.rank_info, p.position, p.category, p.notes AS personnel_notes,
            p.security_category, ar.status, ar.notes AS attendance_notes
     FROM personnel p
     LEFT JOIN attendance_records ar ON ar.personnel_id = p.id AND ar.attendance_date = :date
     WHERE p.is_active = 1
     ORDER BY ${categoryOrderSql('p.category')}, p.category, p.sort_order, p.id`,
    { date }
  );

  // Sabtu/Minggu otomatis dianggap "libur" untuk yang belum diisi -- bukan
  // ditulis ke database, cukup dihitung saat dibaca, supaya tetap bisa
  // ditimpa manual (mis. ada yang piket) dan tidak memenuhi tabel dengan
  // baris "libur" untuk tanggal yang mungkin tidak pernah dibuka siapa pun.
  if (isWeekend(date)) {
    rows.forEach((r) => { if (r.status === null) r.status = 'libur'; });
  }

  res.json({ data: rows, date });
}));

// GET /api/attendance/export?from=YYYY-MM-DD&to=YYYY-MM-DD&format=xlsx|pdf
// Laporan rekap absensi untuk rentang tanggal (biasanya satu minggu) --
// satu kolom per hari berisi status personel hari itu, dikelompokkan per
// kategori/satuan (sama seperti tampilan halaman Absensi Personel), plus
// kolom Keterangan berisi gabungan catatan tiap hari yang ada catatannya.
router.get('/export', requireRole('admin', 'verifikator', 'pimpinan'), asyncHandler(async (req, res) => {
  const { from, to, format } = req.query;
  if (!isValidDate(from) || !isValidDate(to)) {
    return res.status(400).json({ error: 'Tanggal "dari" dan "sampai" wajib diisi dengan format YYYY-MM-DD' });
  }
  if (from > to) {
    return res.status(400).json({ error: 'Tanggal "dari" tidak boleh setelah tanggal "sampai"' });
  }
  if (!['xlsx', 'pdf'].includes(format)) {
    return res.status(400).json({ error: 'Format tidak didukung. Gunakan format=xlsx atau format=pdf' });
  }

  // Daftar tanggal dalam rentang -- dibatasi 31 hari supaya ukuran laporan
  // tetap wajar (laporan ini memang untuk mingguan, tapi rentangnya sengaja
  // dibiarkan fleksibel sesuai tanggal yang diminta, bukan dipaksa 7 hari).
  const dateList = [];
  let cursor = from;
  while (cursor <= to) {
    if (dateList.length >= 31) {
      return res.status(400).json({ error: 'Rentang tanggal maksimal 31 hari' });
    }
    dateList.push(cursor);
    cursor = addDays(cursor, 1);
  }

  const [personnelRows] = await pool.execute(
    `SELECT id, full_name, rank_info, position, category
     FROM personnel WHERE is_active = 1
     ORDER BY ${categoryOrderSql('category')}, category, sort_order, id`
  );
  const [recordRows] = await pool.execute(
    `SELECT personnel_id, attendance_date, status, notes
     FROM attendance_records WHERE attendance_date BETWEEN :from AND :to`,
    { from, to }
  );

  // recordsByPersonnel[personnelId][dateKey] = { status, notes }
  const recordsByPersonnel = {};
  recordRows.forEach((r) => {
    const key = toDateKey(r.attendance_date);
    if (!recordsByPersonnel[r.personnel_id]) recordsByPersonnel[r.personnel_id] = {};
    recordsByPersonnel[r.personnel_id][key] = { status: r.status, notes: r.notes };
  });

  // Sabtu/Minggu yang belum diisi dianggap "libur" -- sama seperti logika
  // GET /api/attendance untuk satu tanggal, supaya laporan rentang tanggal
  // konsisten dengan tampilan harian di halaman Absensi Personel.
  function statusFor(personnelId, dateKey) {
    const rec = recordsByPersonnel[personnelId] && recordsByPersonnel[personnelId][dateKey];
    if (rec) return rec.status;
    return isWeekend(dateKey) ? 'libur' : null;
  }

  const reportRows = personnelRows.map((p) => {
    const perDay = dateList.map((dateKey) => statusFor(p.id, dateKey));
    const notesParts = dateList
      .map((dateKey) => {
        const rec = recordsByPersonnel[p.id] && recordsByPersonnel[p.id][dateKey];
        return rec && rec.notes ? `${formatJakartaDate(dateKey, { day: '2-digit', month: '2-digit' })}: ${rec.notes}` : null;
      })
      .filter(Boolean);
    return { personnel: p, perDay, keterangan: notesParts.join('; ') };
  });

  const rangeLabel = `${formatJakartaDate(from, { day: '2-digit', month: 'short', year: 'numeric' })} s.d. ${formatJakartaDate(to, { day: '2-digit', month: 'short', year: 'numeric' })}`;

  await logAudit(req.user.sub, 'export_attendance', 'attendance', null, { from, to, format });

  if (format === 'xlsx') {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Rekap Absensi');
    sheet.columns = [
      { header: 'No', key: 'no', width: 5 },
      { header: 'Nama', key: 'nama', width: 28 },
      { header: 'Pangkat/Korps/NRP', key: 'pangkat', width: 26 },
      { header: 'Jabatan', key: 'jabatan', width: 26 },
      ...dateList.map((dateKey) => ({
        header: formatJakartaDate(dateKey, { weekday: 'short', day: '2-digit', month: 'short' }),
        key: `d_${dateKey}`,
        width: 11,
      })),
      { header: 'Keterangan', key: 'keterangan', width: 40 },
    ];
    // Baris judul disisipkan DI ATAS baris header kolom (insertRow menggeser
    // baris header yang sudah otomatis terisi dari sheet.columns turun ke
    // baris ke-2) -- urutan ini penting, baris header baru ditebalkan
    // SETELAH disisipkan supaya tidak ikut tertimpa.
    sheet.insertRow(1, [`Rekap Absensi Personel PUSSIBERAL -- Periode ${rangeLabel}`]);
    sheet.getRow(1).font = { bold: true, size: 13 };
    sheet.getRow(2).font = { bold: true };

    let no = 1;
    let currentCategory = null;
    reportRows.forEach((r) => {
      if (r.personnel.category !== currentCategory) {
        currentCategory = r.personnel.category;
        const catRow = sheet.addRow({ nama: currentCategory });
        catRow.font = { bold: true };
      }
      const rowData = {
        no: no++,
        nama: r.personnel.full_name,
        pangkat: r.personnel.rank_info || '-',
        jabatan: r.personnel.position,
        keterangan: r.keterangan || '-',
      };
      dateList.forEach((dateKey, i) => { rowData[`d_${dateKey}`] = STATUS_LABELS[r.perDay[i]] || '-'; });
      sheet.addRow(rowData);
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="rekap-absensi-${from}-sd-${to}.xlsx"`);
    await workbook.xlsx.write(res);
    return res.end();
  }

  // PDF -- kolom per hari dipersempit (pakai singkatan status, lihat
  // STATUS_SHORT) karena rentang tanggal bisa sampai beberapa minggu;
  // legenda singkatannya dicetak di bawah judul.
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="rekap-absensi-${from}-sd-${to}.pdf"`);

  const doc = new PDFDocument({ margin: 24, size: 'A4', layout: 'landscape' });
  doc.pipe(res);

  doc.fontSize(14).font('Helvetica-Bold').text('Rekap Absensi Personel - PUSSIBERAL', { align: 'center' });
  doc.fontSize(9).font('Helvetica').text(`Periode: ${rangeLabel}`, { align: 'center' });
  const legend = Object.entries(STATUS_SHORT).map(([key, short]) => `${short}=${STATUS_LABELS[key]}`).join('   ');
  doc.fontSize(7).fillColor('#555').text(`${legend}   -=Belum Diisi`, { align: 'center' });
  doc.fillColor('black');
  doc.moveDown(0.6);

  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const noW = 20;
  const namaW = 130;
  const jabatanW = 110;
  const ketW = Math.max(90, pageWidth - noW - namaW - jabatanW - dateList.length * 22);
  const dayW = (pageWidth - noW - namaW - jabatanW - ketW) / dateList.length;
  const colWidths = [noW, namaW, jabatanW, ...dateList.map(() => dayW), ketW];
  const headers = ['No', 'Nama', 'Jabatan', ...dateList.map((dateKey) => formatJakartaDate(dateKey, { day: '2-digit', month: '2-digit' })), 'Keterangan'];

  const startX = doc.page.margins.left;
  const rowHeight = 14;
  let y = doc.y;

  function checkPageBreak() {
    if (y > doc.page.height - doc.page.margins.bottom - rowHeight) {
      doc.addPage();
      y = doc.page.margins.top;
      drawRow(headers, { bold: true });
    }
  }

  // height + lineBreak:false MEMAKSA tiap sel satu baris saja (dipotong
  // "..." lewat ellipsis kalau teksnya kepanjangan, mis. nama jabatan yang
  // panjang) -- tanpa ini, teks yang kepanjangan melebar ke beberapa baris
  // dan tumpang tindih dengan baris berikutnya, sekaligus memicu PDFKit
  // menyisipkan halaman baru otomatis secara acak (di luar kendali
  // checkPageBreak() di atas) begitu teksnya "meluber" dari batas halaman.
  function drawRow(values, opts = {}) {
    let x = startX;
    doc.font(opts.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(opts.fontSize || 7.5);
    values.forEach((v, i) => {
      doc.text(String(v === null || v === undefined || v === '' ? '-' : v), x, y, {
        width: colWidths[i], height: rowHeight - 3, ellipsis: true, lineBreak: false,
      });
      x += colWidths[i];
    });
    y += rowHeight;
    checkPageBreak();
  }

  // Baris nama kategori/satuan -- teks penuh selebar tabel (bukan masuk ke
  // kolom pertama saja seperti drawRow biasa), jadi dipisah fungsinya sendiri.
  function drawCategoryRow(name) {
    doc.font('Helvetica-Bold').fontSize(8).text(name, startX, y, {
      width: pageWidth, height: rowHeight - 3, ellipsis: true, lineBreak: false,
    });
    y += rowHeight;
    checkPageBreak();
  }

  drawRow(headers, { bold: true });

  let currentCategoryPdf = null;
  let noPdf = 1;
  reportRows.forEach((r) => {
    if (r.personnel.category !== currentCategoryPdf) {
      currentCategoryPdf = r.personnel.category;
      drawCategoryRow(currentCategoryPdf);
    }
    drawRow([
      noPdf++,
      r.personnel.full_name,
      r.personnel.position,
      ...r.perDay.map((status) => (status ? STATUS_SHORT[status] : '-')),
      r.keterangan || '-',
    ]);
  });

  // Halaman rekapitulasi -- dihitung dari reportRows yang sama persis
  // dengan tabel detail (perDay sudah merekonsiliasi Sabtu/Minggu kosong
  // jadi "libur"), supaya angkanya selalu konsisten dengan apa yang
  // ditampilkan di tabel sebelumnya.
  const SUMMARY_CATEGORIES = [
    { key: 'sakit', label: 'Sakit', color: '#d97706' },
    { key: 'terlambat', label: 'Terlambat', color: '#dc2626' },
    { key: 'dinas_luar', label: 'Dinas Luar', color: '#2563eb' },
    { key: 'pendidikan', label: 'Pendidikan', color: '#7c3aed' },
    { key: 'tanpa_keterangan', label: 'Tanpa Keterangan', color: '#991b1b' },
  ];
  const summaryCounts = {};
  SUMMARY_CATEGORIES.forEach((c) => { summaryCounts[c.key] = 0; });
  reportRows.forEach((r) => {
    r.perDay.forEach((status) => {
      if (summaryCounts[status] !== undefined) summaryCounts[status] += 1;
    });
  });

  const totalPersonnelActive = personnelRows.length;
  const dailyHadirCounts = dateList.map((_, i) => reportRows.reduce((acc, r) => acc + (r.perDay[i] === 'hadir' ? 1 : 0), 0));
  const dailyHadirPct = dailyHadirCounts.map((c) => (totalPersonnelActive ? (c / totalPersonnelActive) * 100 : 0));
  const avgHadirPct = dailyHadirPct.length ? dailyHadirPct.reduce((a, b) => a + b, 0) / dailyHadirPct.length : 0;

  doc.addPage();
  doc.fontSize(14).font('Helvetica-Bold').text('Rekapitulasi Mingguan - PUSSIBERAL', { align: 'center' });
  doc.fontSize(9).font('Helvetica').text(`Periode: ${rangeLabel}`, { align: 'center' });
  doc.moveDown(1.2);

  // --- Kartu ringkasan 5 kategori ---
  doc.fontSize(11).font('Helvetica-Bold').fillColor('black').text('Rekapitulasi Kategori Keterangan', startX, doc.y, { width: pageWidth });
  doc.moveDown(0.5);

  const cardGap = 10;
  const cardW = (pageWidth - cardGap * (SUMMARY_CATEGORIES.length - 1)) / SUMMARY_CATEGORIES.length;
  const cardH = 54;
  const cardY = doc.y;
  SUMMARY_CATEGORIES.forEach((cat, i) => {
    const cardX = startX + i * (cardW + cardGap);
    doc.rect(cardX, cardY, cardW, cardH).lineWidth(1.2).strokeColor(cat.color).stroke();
    doc.rect(cardX, cardY, cardW, 5).fill(cat.color);
    doc.fillColor(cat.color).font('Helvetica-Bold').fontSize(20)
      .text(String(summaryCounts[cat.key]), cardX, cardY + 14, { width: cardW, align: 'center' });
    doc.fillColor('#333').font('Helvetica').fontSize(8)
      .text(cat.label, cardX + 4, cardY + 38, { width: cardW - 8, align: 'center', height: 14, ellipsis: true, lineBreak: false });
  });
  doc.fillColor('black');
  doc.y = cardY + cardH + 28;

  // --- Tren kehadiran harian ---
  doc.fontSize(11).font('Helvetica-Bold').text('Tren Kehadiran Harian (% Hadir)', startX, doc.y, { width: pageWidth });
  doc.fontSize(8.5).font('Helvetica').fillColor('#555')
    .text(`Rata-rata kehadiran periode ini: ${avgHadirPct.toFixed(1)}% dari ${totalPersonnelActive} personel aktif`, startX, doc.y + 2, { width: pageWidth });
  doc.fillColor('black');
  doc.moveDown(1.2);

  const chartX = startX;
  const chartY = doc.y;
  const chartH = 160;
  const chartW = pageWidth;
  const barGap = 10;
  const barW = Math.min(46, (chartW - barGap * (dateList.length - 1)) / dateList.length);
  const chartInnerW = barW * dateList.length + barGap * (dateList.length - 1);
  const chartStartX = chartX + (chartW - chartInnerW) / 2;
  const baselineY = chartY + chartH;

  // Garis bantu 0%/50%/100% supaya tinggi batang mudah dibaca.
  [0, 50, 100].forEach((pct) => {
    const gy = baselineY - (pct / 100) * chartH;
    doc.moveTo(chartX, gy).lineTo(chartX + chartW, gy).lineWidth(0.5).strokeColor('#e2e5ea').stroke();
    doc.fontSize(7).fillColor('#9aa0ab').text(`${pct}%`, chartX, gy - 7, { width: 24, height: 9, lineBreak: false });
  });

  // Garis putus-putus rata-rata.
  const avgY = baselineY - (avgHadirPct / 100) * chartH;
  doc.save();
  doc.dash(3, { space: 2 }).moveTo(chartStartX, avgY).lineTo(chartStartX + chartInnerW, avgY).lineWidth(1).strokeColor('#002878').stroke();
  doc.undash();
  doc.restore();

  dateList.forEach((dateKey, i) => {
    const pct = dailyHadirPct[i];
    const barX = chartStartX + i * (barW + barGap);
    const barH = Math.max(1, (pct / 100) * chartH);
    doc.rect(barX, baselineY - barH, barW, barH).fill('#1a3ea3');
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#1a3ea3')
      .text(`${pct.toFixed(0)}%`, barX - 5, baselineY - barH - 11, { width: barW + 10, align: 'center', height: 10, lineBreak: false });
    doc.fontSize(7.5).font('Helvetica').fillColor('#333')
      .text(formatJakartaDate(dateKey, { weekday: 'short', day: '2-digit', month: '2-digit' }), barX - 5, baselineY + 4, { width: barW + 10, align: 'center', height: 10, lineBreak: false, ellipsis: true });
  });
  doc.fillColor('black');
  doc.y = baselineY + 22;

  doc.end();
}));

// POST /api/attendance/save  { date, entries: [{ personnel_id, status, notes }] }
// status = null berarti hapus/kosongkan status yang sudah pernah diisi.
router.post('/save', requireRole('admin', 'verifikator'), asyncHandler(async (req, res) => {
  const { date, entries } = req.body || {};
  if (!date || !isValidDate(date)) {
    return res.status(400).json({ error: 'Tanggal wajib diisi dengan format YYYY-MM-DD' });
  }
  if (!Array.isArray(entries) || !entries.length) {
    return res.status(400).json({ error: 'Data absensi kosong' });
  }
  if (entries.length > 500) {
    return res.status(400).json({ error: 'Jumlah data terlalu banyak dalam satu permintaan' });
  }

  for (const entry of entries) {
    if (!entry || !Number.isInteger(entry.personnel_id)) {
      return res.status(400).json({ error: 'ID personel tidak valid' });
    }
    if (entry.status !== null && !ATTENDANCE_STATUSES.includes(entry.status)) {
      return res.status(400).json({ error: `Status absensi tidak valid untuk personel ID ${entry.personnel_id}` });
    }
    if (entry.notes && String(entry.notes).length > 255) {
      return res.status(400).json({ error: 'Keterangan maksimal 255 karakter' });
    }
  }

  for (const entry of entries) {
    if (entry.status === null) {
      await pool.execute(
        'DELETE FROM attendance_records WHERE personnel_id = :personnel_id AND attendance_date = :date',
        { personnel_id: entry.personnel_id, date }
      );
    } else {
      await pool.execute(
        `INSERT INTO attendance_records (personnel_id, attendance_date, status, notes, recorded_by)
         VALUES (:personnel_id, :date, :status, :notes, :userId)
         ON DUPLICATE KEY UPDATE status = :status, notes = :notes, recorded_by = :userId`,
        {
          personnel_id: entry.personnel_id,
          date,
          status: entry.status,
          notes: entry.notes && String(entry.notes).trim() ? String(entry.notes).trim() : null,
          userId: req.user.sub,
        }
      );
    }
  }

  await logAudit(req.user.sub, 'save_attendance', 'attendance', null, { date, count: entries.length });
  res.json({ data: { date, saved: entries.length } });
}));

module.exports = router;
