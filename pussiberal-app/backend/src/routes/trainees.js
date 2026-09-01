const express = require('express');
const pool = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const asyncHandler = require('../utils/asyncHandler');
const { VALID_SECURITY_CATEGORIES } = require('../utils/validators');

const router = express.Router();
router.use(authenticate, requireRole('admin', 'pos_depan', 'verifikator'));

// Status dihitung dari tanggal, bukan disimpan -- supaya selalu akurat tanpa
// perlu job terjadwal untuk memperbarui status saat tanggalnya lewat.
const STATUS_CASE = `
  CASE
    WHEN CURDATE() < start_date THEN 'Akan Datang'
    WHEN CURDATE() > end_date THEN 'Selesai'
    ELSE 'Aktif'
  END
`;

// GET /api/trainees  (?q=&status=&page=&pageSize=)
router.get('/', asyncHandler(async (req, res) => {
  const { q, status, page = 1, pageSize = 20 } = req.query;
  const limit = Math.min(parseInt(pageSize, 10) || 20, 100);
  const offset = (Math.max(parseInt(page, 10) || 1, 1) - 1) * limit;

  const where = [];
  const params = {};
  if (q) {
    where.push('(full_name LIKE :q OR institution LIKE :q OR position LIKE :q OR rank_title LIKE :q)');
    params.q = `%${q}%`;
  }
  if (status) {
    where.push(`(${STATUS_CASE}) = :status`);
    params.status = status;
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT id, full_name, rank_title, position, institution, start_date, end_date, security_category,
            (${STATUS_CASE}) AS status
     FROM trainees ${whereSql}
     ORDER BY start_date DESC
     LIMIT ${limit} OFFSET ${offset}`,
    params
  );
  const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM trainees ${whereSql}`, params);

  res.json({ data: rows, total: countRows[0].total, page: Number(page), pageSize: limit });
}));

// GET /api/trainees/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT *, (${STATUS_CASE}) AS status FROM trainees WHERE id = :id`,
    { id: req.params.id }
  );
  if (!rows[0]) return res.status(404).json({ error: 'Data tidak ditemukan' });
  res.json({ data: rows[0] });
}));

// POST /api/trainees  (admin/pos depan mendaftarkan teknisi/siswa yang akan/sedang pembelajaran)
router.post('/', requireRole('admin', 'pos_depan'), asyncHandler(async (req, res) => {
  const { full_name, rank_title, position, institution, address, birth_place, birth_date, activities, start_date, end_date } = req.body || {};

  const errors = {};
  if (!full_name || !String(full_name).trim()) errors.full_name = 'Nama wajib diisi';
  if (rank_title && String(rank_title).length > 100) errors.rank_title = 'Pangkat maksimal 100 karakter';
  if (!position || !String(position).trim()) errors.position = 'Jabatan wajib diisi';
  if (!institution || !String(institution).trim()) errors.institution = 'Instansi/Perusahaan wajib diisi';
  if (address && String(address).length > 255) errors.address = 'Alamat maksimal 255 karakter';
  if (birth_place && String(birth_place).length > 100) errors.birth_place = 'Tempat lahir maksimal 100 karakter';
  if (birth_date && isNaN(Date.parse(birth_date))) errors.birth_date = 'Tanggal lahir tidak valid';
  if (!activities || !String(activities).trim()) errors.activities = 'Kegiatan yang dilakukan wajib diisi';
  if (!start_date || isNaN(Date.parse(start_date))) errors.start_date = 'Tanggal mulai wajib diisi';
  if (!end_date || isNaN(Date.parse(end_date))) errors.end_date = 'Tanggal selesai wajib diisi';
  if (!errors.start_date && !errors.end_date && new Date(end_date) < new Date(start_date)) {
    errors.end_date = 'Tanggal selesai tidak boleh sebelum tanggal mulai';
  }

  if (Object.keys(errors).length) {
    return res.status(400).json({ error: 'Validasi gagal', fields: errors });
  }

  const [result] = await pool.execute(
    `INSERT INTO trainees (full_name, rank_title, position, institution, address, birth_place, birth_date, activities, start_date, end_date, created_by)
     VALUES (:full_name, :rank_title, :position, :institution, :address, :birth_place, :birth_date, :activities, :start_date, :end_date, :created_by)`,
    {
      full_name: String(full_name).trim(),
      rank_title: rank_title && String(rank_title).trim() ? String(rank_title).trim() : null,
      position: String(position).trim(),
      institution: String(institution).trim(),
      address: address && String(address).trim() ? String(address).trim() : null,
      birth_place: birth_place && String(birth_place).trim() ? String(birth_place).trim() : null,
      birth_date: birth_date || null,
      activities: String(activities).trim(),
      start_date,
      end_date,
      created_by: req.user.sub,
    }
  );

  await logAudit(req.user.sub, 'create_trainee', 'trainee', result.insertId, {
    full_name: String(full_name).trim(),
    institution: String(institution).trim(),
  });

  res.status(201).json({ data: { id: result.insertId } });
}));

// PUT /api/trainees/:id  (identitas & kegiatan: admin/pos depan -- hasil profiling: admin/verifikator)
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    full_name, rank_title, position, institution, address, birth_place, birth_date, activities, start_date, end_date,
    security_category, profiling_notes,
  } = req.body || {};

  const touchesIdentity = [full_name, rank_title, position, institution, address, birth_place, birth_date, activities, start_date, end_date]
    .some((v) => v !== undefined);
  const touchesProfiling = [security_category, profiling_notes].some((v) => v !== undefined);

  if (touchesIdentity && !['admin', 'pos_depan'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Hanya Administrator atau Pos Depan yang dapat mengubah data identitas & kegiatan' });
  }
  if (touchesProfiling && !['admin', 'verifikator'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Hanya Administrator atau Verifikator yang dapat mengisi hasil profiling' });
  }

  const [existingRows] = await pool.execute('SELECT id FROM trainees WHERE id = :id', { id });
  if (!existingRows[0]) return res.status(404).json({ error: 'Data tidak ditemukan' });

  const fields = [];
  const params = { id };

  if (full_name !== undefined) {
    if (!String(full_name).trim()) return res.status(400).json({ error: 'Nama wajib diisi' });
    fields.push('full_name = :full_name'); params.full_name = String(full_name).trim();
  }
  if (rank_title !== undefined) {
    if (rank_title && String(rank_title).length > 100) return res.status(400).json({ error: 'Pangkat maksimal 100 karakter' });
    fields.push('rank_title = :rank_title'); params.rank_title = rank_title && String(rank_title).trim() ? String(rank_title).trim() : null;
  }
  if (position !== undefined) {
    if (!String(position).trim()) return res.status(400).json({ error: 'Jabatan wajib diisi' });
    fields.push('position = :position'); params.position = String(position).trim();
  }
  if (institution !== undefined) {
    if (!String(institution).trim()) return res.status(400).json({ error: 'Instansi/Perusahaan wajib diisi' });
    fields.push('institution = :institution'); params.institution = String(institution).trim();
  }
  if (address !== undefined) {
    if (address && String(address).length > 255) return res.status(400).json({ error: 'Alamat maksimal 255 karakter' });
    fields.push('address = :address'); params.address = address && String(address).trim() ? String(address).trim() : null;
  }
  if (birth_place !== undefined) {
    if (birth_place && String(birth_place).length > 100) return res.status(400).json({ error: 'Tempat lahir maksimal 100 karakter' });
    fields.push('birth_place = :birth_place'); params.birth_place = birth_place && String(birth_place).trim() ? String(birth_place).trim() : null;
  }
  if (birth_date !== undefined) {
    if (birth_date && isNaN(Date.parse(birth_date))) return res.status(400).json({ error: 'Tanggal lahir tidak valid' });
    fields.push('birth_date = :birth_date'); params.birth_date = birth_date || null;
  }
  if (activities !== undefined) {
    if (!String(activities).trim()) return res.status(400).json({ error: 'Kegiatan yang dilakukan wajib diisi' });
    fields.push('activities = :activities'); params.activities = String(activities).trim();
  }
  if (start_date !== undefined) {
    if (!start_date || isNaN(Date.parse(start_date))) return res.status(400).json({ error: 'Tanggal mulai tidak valid' });
    fields.push('start_date = :start_date'); params.start_date = start_date;
  }
  if (end_date !== undefined) {
    if (!end_date || isNaN(Date.parse(end_date))) return res.status(400).json({ error: 'Tanggal selesai tidak valid' });
    fields.push('end_date = :end_date'); params.end_date = end_date;
  }
  if (security_category !== undefined) {
    if (security_category !== null && security_category !== '' && !VALID_SECURITY_CATEGORIES.includes(security_category)) {
      return res.status(400).json({ error: 'Kategori profiling tidak valid' });
    }
    fields.push('security_category = :security_category'); params.security_category = security_category || null;
  }
  if (profiling_notes !== undefined) {
    if (profiling_notes && String(profiling_notes).length > 2000) return res.status(400).json({ error: 'Catatan profiling maksimal 2000 karakter' });
    fields.push('profiling_notes = :profiling_notes'); params.profiling_notes = profiling_notes && String(profiling_notes).trim() ? String(profiling_notes).trim() : null;
  }

  if (fields.length) {
    await pool.execute(`UPDATE trainees SET ${fields.join(', ')} WHERE id = :id`, params);
  }

  await logAudit(req.user.sub, 'update_trainee', 'trainee', id, req.body);
  res.json({ data: { id: Number(id) } });
}));

// DELETE /api/trainees/:id  (admin saja)
router.delete('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const [result] = await pool.execute('DELETE FROM trainees WHERE id = :id', { id: req.params.id });
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Data tidak ditemukan' });
  await logAudit(req.user.sub, 'delete_trainee', 'trainee', req.params.id, null);
  res.status(204).send();
}));

module.exports = router;
