const express = require('express');
const pool = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const asyncHandler = require('../utils/asyncHandler');
const { categoryOrderSql, ATTENDANCE_STATUSES, isWeekend } = require('../utils/attendance');

const router = express.Router();
router.use(authenticate);

function isValidDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value));
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
