const express = require('express');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const pool = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { formatJakartaDateTime, formatJakartaDate } = require('../utils/datetime');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
router.use(authenticate);

router.get('/dashboard', requireRole('admin', 'pos_depan', 'verifikator', 'pimpinan'), asyncHandler(async (req, res) => {
  const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM guests');
  // "total" di atas menghitung PENDAFTARAN (satu pendaftaran bisa berisi lebih
  // dari satu orang), dipakai untuk donut Status Pendaftaran agar konsisten
  // dengan breakdown byStatus. "totalGuests" menghitung INDIVIDU tamu --
  // dipakai kartu "Total Tamu" supaya angkanya selalu >= jumlah pada
  // Statistik Perangkat Elektronik (yang juga menghitung per individu),
  // bukan malah lebih kecil dan terlihat seperti salah hitung.
  const [[{ totalGuests }]] = await pool.query('SELECT COUNT(*) AS totalGuests FROM guest_members');
  const [[{ today }]] = await pool.query('SELECT COUNT(*) AS today FROM guests WHERE DATE(created_at) = CURDATE()');
  const [[{ yesterday }]] = await pool.query(
    "SELECT COUNT(*) AS yesterday FROM guests WHERE DATE(created_at) = CURDATE() - INTERVAL 1 DAY"
  );
  const [[{ active }]] = await pool.query("SELECT COUNT(*) AS active FROM guests WHERE status = 'Sedang Berkunjung'");
  const [[{ pendingCheckout }]] = await pool.query(
    'SELECT COUNT(*) AS pendingCheckout FROM visits WHERE check_in_at IS NOT NULL AND check_out_at IS NULL'
  );
  const [byStatus] = await pool.query('SELECT status, COUNT(*) AS count FROM guests GROUP BY status');
  const [deviceStats] = await pool.query('SELECT device_status, COUNT(*) AS count FROM guest_members GROUP BY device_status');

  let securityStats = null;
  if (['admin', 'verifikator'].includes(req.user.role)) {
    [securityStats] = await pool.query(
      "SELECT COALESCE(security_category, 'belum_dianalisa') AS security_category, COUNT(*) AS count FROM guest_members GROUP BY security_category"
    );
  }

  // Kondisi absensi personel HARI INI (bukan tamu) -- dipakai kartu pie chart
  // di dashboard untuk Admin, Verifikator, dan Pimpinan. status = NULL berarti
  // personel aktif yang belum diisi absensinya hari ini.
  let attendanceStats = null;
  if (['admin', 'verifikator', 'pimpinan'].includes(req.user.role)) {
    [attendanceStats] = await pool.query(`
      SELECT ar.status, COUNT(*) AS count
      FROM personnel p
      LEFT JOIN attendance_records ar ON ar.personnel_id = p.id AND ar.attendance_date = CURDATE()
      WHERE p.is_active = 1
      GROUP BY ar.status
    `);
  }

  // Daftar personel yang PERLU PERHATIAN hari ini: belum diisi absensinya
  // sama sekali, atau sudah diisi tapi statusnya "Tanpa Keterangan" --
  // dipakai kartu "Perlu Perhatian" dan tabel di dashboard. "Tanpa
  // Keterangan" ditaruh lebih dulu karena lebih mendesak dari sekadar
  // belum diisi (yang masih mungkin diisi nanti di hari yang sama).
  let attendanceAttention = null;
  if (['admin', 'verifikator', 'pimpinan'].includes(req.user.role)) {
    [attendanceAttention] = await pool.query(`
      SELECT p.id, p.full_name, p.rank_info, p.position, ar.status, ar.notes AS attendance_notes
      FROM personnel p
      LEFT JOIN attendance_records ar ON ar.personnel_id = p.id AND ar.attendance_date = CURDATE()
      WHERE p.is_active = 1 AND (ar.status IS NULL OR ar.status = 'tanpa_keterangan')
      ORDER BY (ar.status = 'tanpa_keterangan') DESC, p.category, p.sort_order, p.id
    `);
  }

  res.json({
    data: {
      total, totalGuests, today, yesterday, active, pendingCheckout, byStatus, deviceStats, securityStats,
      attendanceStats, attendanceAttention,
    },
  });
}));

// GET /reports/attendance-trend?period=day|week|month&count=4  -- persentase
// Hadir per periode, dipakai grafik "Tren Kehadiran Personel" di dashboard
// (period/count sama seperti /visit-stats, supaya bisa pakai toggle Per
// Hari/Per Minggu/Per Bulan yang sama). Satu periode tanpa data sama sekali
// (belum pernah diisi) dikirim sebagai pct: null supaya frontend bisa
// membedakan "0% hadir" dari "belum ada data direkam".
router.get('/attendance-trend', requireRole('admin', 'verifikator', 'pimpinan'), asyncHandler(async (req, res) => {
  const period = ['day', 'month'].includes(req.query.period) ? req.query.period : 'week';
  const count = Math.min(Math.max(parseInt(req.query.count, 10) || 4, 2), 31);
  const periods = buildPeriods(period, count);
  const since = periods[0].start;

  const [rows] = await pool.query(
    'SELECT attendance_date, status FROM attendance_records WHERE attendance_date >= :since',
    { since }
  );

  const recorded = periods.map(() => 0);
  const hadir = periods.map(() => 0);
  rows.forEach((row) => {
    const t = new Date(row.attendance_date).getTime();
    const idx = periods.findIndex((p) => t >= p.start.getTime() && t < p.end.getTime());
    if (idx === -1) return;
    recorded[idx] += 1;
    if (row.status === 'hadir') hadir[idx] += 1;
  });

  res.json({
    data: periods.map((p, i) => ({
      label: p.label,
      pct: recorded[i] > 0 ? Math.round((hadir[i] / recorded[i]) * 100) : null,
      recordedCount: recorded[i],
    })),
    period,
  });
}));

function buildPeriods(period, count) {
  const periods = [];
  const now = new Date();

  if (period === 'month') {
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    for (let i = count - 1; i >= 0; i -= 1) {
      const start = new Date(currentMonthStart.getFullYear(), currentMonthStart.getMonth() - i, 1);
      const end = new Date(currentMonthStart.getFullYear(), currentMonthStart.getMonth() - i + 1, 1);
      const label = formatJakartaDate(start, { month: 'short', year: '2-digit' });
      periods.push({ start, end, label });
    }
    return periods;
  }

  if (period === 'day') {
    for (let i = count - 1; i >= 0; i -= 1) {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
      const label = formatJakartaDate(start, { weekday: 'short', day: 'numeric', month: 'short' });
      periods.push({ start, end, label });
    }
    return periods;
  }

  const day = now.getDay();
  const diffToMonday = (day === 0 ? -6 : 1) - day;
  const currentMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday);

  for (let i = count - 1; i >= 0; i -= 1) {
    const start = new Date(currentMonday.getFullYear(), currentMonday.getMonth(), currentMonday.getDate() - i * 7);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
    const lastDay = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 1);
    const label = `${start.getDate()}/${start.getMonth() + 1}-${lastDay.getDate()}/${lastDay.getMonth() + 1}`;
    periods.push({ start, end, label });
  }
  return periods;
}

router.get('/visit-stats', requireRole('admin', 'verifikator'), asyncHandler(async (req, res) => {
  const period = ['day', 'month'].includes(req.query.period) ? req.query.period : 'week';
  const count = Math.min(Math.max(parseInt(req.query.count, 10) || 12, 2), 31);

  const periods = buildPeriods(period, count);
  const since = periods[0].start;

  const [rows] = await pool.query(
    `SELECT g.created_at
     FROM guests g
     JOIN guest_members gm ON gm.guest_id = g.id
     WHERE g.created_at >= :since`,
    { since }
  );

  const counts = periods.map(() => 0);
  rows.forEach((row) => {
    const t = new Date(row.created_at).getTime();
    const idx = periods.findIndex((p) => t >= p.start.getTime() && t < p.end.getTime());
    if (idx !== -1) counts[idx] += 1;
  });

  res.json({
    data: periods.map((p, i) => ({ label: p.label, count: counts[i] })),
    period,
  });
}));

async function fetchVisits(from, to) {
  let where = '1=1';
  const params = {};
  if (from) { where += ' AND DATE(g.created_at) >= :from'; params.from = from; }
  if (to) { where += ' AND DATE(g.created_at) <= :to'; params.to = to; }

  const [rows] = await pool.query(
    `SELECT g.registration_number, g.company, g.status, MAX(vi.check_in_at) AS check_in_at, MAX(vi.check_out_at) AS check_out_at,
            COUNT(gm.id) AS member_count,
            GROUP_CONCAT(gm.full_name ORDER BY gm.id SEPARATOR ', ') AS member_names
     FROM guests g
     LEFT JOIN visits vi ON vi.guest_id = g.id
     LEFT JOIN guest_members gm ON gm.guest_id = g.id
     WHERE ${where}
     GROUP BY g.id
     ORDER BY g.created_at DESC`,
    params
  );

  return rows;
}

router.get('/visits', requireRole('admin', 'verifikator'), asyncHandler(async (req, res) => {
  const rows = await fetchVisits(req.query.from, req.query.to);
  res.json({ data: rows });
}));

router.get('/visits/export', requireRole('admin', 'verifikator'), asyncHandler(async (req, res) => {
  const { format, from, to } = req.query;
  const rows = await fetchVisits(from, to);

  if (format === 'xlsx') {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Rekap Kunjungan');
    sheet.columns = [
      { header: 'No. Registrasi', key: 'registration_number', width: 22 },
      { header: 'Perusahaan', key: 'company', width: 28 },
      { header: 'Jumlah Tamu', key: 'member_count', width: 12 },
      { header: 'Nama Tamu', key: 'member_names', width: 36 },
      { header: 'Status', key: 'status', width: 20 },
      { header: 'Check-in', key: 'check_in_at', width: 20 },
      { header: 'Check-out', key: 'check_out_at', width: 20 },
    ];
    sheet.getRow(1).font = { bold: true };
    rows.forEach((r) => sheet.addRow(r));

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="rekap-kunjungan.xlsx"');
    await workbook.xlsx.write(res);
    return res.end();
  }

  if (format === 'pdf') {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="rekap-kunjungan.pdf"');

    const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
    doc.pipe(res);

    doc.fontSize(16).text('Rekap Kunjungan Tamu - PUSSIBERAL', { align: 'center' });
    doc.moveDown();
    doc.fontSize(9);

    const colWidths = [100, 130, 60, 190, 90, 100, 100];
    const startX = doc.page.margins.left;
    let y = doc.y;

    function drawRow(values, bold) {
      let x = startX;
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica');
      values.forEach((v, i) => {
        doc.text(String(v === null || v === undefined ? '-' : v), x, y, { width: colWidths[i], ellipsis: true });
        x += colWidths[i];
      });
      y += 18;
      if (y > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
        y = doc.page.margins.top;
      }
    }

    drawRow(['No. Registrasi', 'Perusahaan', 'Jml', 'Nama Tamu', 'Status', 'Check-in', 'Check-out'], true);
    rows.forEach((r) => drawRow([
      r.registration_number,
      r.company,
      r.member_count,
      r.member_names,
      r.status,
      r.check_in_at ? formatJakartaDateTime(r.check_in_at) : '-',
      r.check_out_at ? formatJakartaDateTime(r.check_out_at) : '-',
    ]));

    doc.end();
    return;
  }

  res.status(400).json({ error: 'Format tidak didukung. Gunakan format=xlsx atau format=pdf' });
}));

module.exports = router;
