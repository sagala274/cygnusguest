const express = require('express');
const pool = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const asyncHandler = require('../utils/asyncHandler');
const { categoryOrderSql } = require('../utils/attendance');

const router = express.Router();
// "pimpinan" boleh MELIHAT (GET) tapi tidak boleh menulis -- setiap route
// tulis (POST/PUT/DELETE) di bawah punya requireRole tersendiri yang
// sengaja TIDAK menyertakan "pimpinan".
router.use(authenticate, requireRole('admin', 'verifikator', 'pimpinan'));

// GET /api/personnel  (?includeInactive=1)
router.get('/', asyncHandler(async (req, res) => {
  const includeInactive = req.query.includeInactive === '1';
  const where = includeInactive ? '' : 'WHERE is_active = 1';
  const [rows] = await pool.query(
    `SELECT id, full_name, rank_info, position, category, notes, sort_order, is_active, created_at, updated_at
     FROM personnel ${where}
     ORDER BY ${categoryOrderSql()}, category, sort_order, id`
  );
  res.json({ data: rows });
}));

// GET /api/personnel/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const [rows] = await pool.execute('SELECT * FROM personnel WHERE id = :id', { id: req.params.id });
  if (!rows[0]) return res.status(404).json({ error: 'Data personel tidak ditemukan' });
  res.json({ data: rows[0] });
}));

// POST /api/personnel
router.post('/', requireRole('admin', 'verifikator'), asyncHandler(async (req, res) => {
  const { full_name, rank_info, position, category, notes } = req.body || {};

  const errors = {};
  if (!full_name || !String(full_name).trim()) errors.full_name = 'Nama wajib diisi';
  else if (String(full_name).length > 150) errors.full_name = 'Nama maksimal 150 karakter';
  if (rank_info && String(rank_info).length > 150) errors.rank_info = 'Pangkat/Korps/NRP/NIP maksimal 150 karakter';
  if (!position || !String(position).trim()) errors.position = 'Jabatan wajib diisi';
  else if (String(position).length > 200) errors.position = 'Jabatan maksimal 200 karakter';
  if (!category || !String(category).trim()) errors.category = 'Kategori/Satuan wajib diisi';
  else if (String(category).length > 50) errors.category = 'Kategori maksimal 50 karakter';
  if (notes && String(notes).length > 255) errors.notes = 'Keterangan maksimal 255 karakter';

  if (Object.keys(errors).length) {
    return res.status(400).json({ error: 'Validasi gagal', fields: errors });
  }

  const categoryTrimmed = String(category).trim().toUpperCase();
  const [[{ maxSort }]] = await pool.execute(
    'SELECT COALESCE(MAX(sort_order), 0) AS maxSort FROM personnel WHERE category = :category',
    { category: categoryTrimmed }
  );

  const [result] = await pool.execute(
    `INSERT INTO personnel (full_name, rank_info, position, category, notes, sort_order, created_by, updated_by)
     VALUES (:full_name, :rank_info, :position, :category, :notes, :sort_order, :userId, :userId)`,
    {
      full_name: String(full_name).trim(),
      rank_info: rank_info && String(rank_info).trim() ? String(rank_info).trim() : null,
      position: String(position).trim(),
      category: categoryTrimmed,
      notes: notes && String(notes).trim() ? String(notes).trim() : null,
      sort_order: maxSort + 1,
      userId: req.user.sub,
    }
  );

  await logAudit(req.user.sub, 'create_personnel', 'personnel', result.insertId, {
    full_name: String(full_name).trim(),
    category: categoryTrimmed,
  });

  res.status(201).json({ data: { id: result.insertId } });
}));

// PUT /api/personnel/reorder  { category, personnel_ids: [...] }
// Menulis ulang sort_order sesuai urutan array yang dikirim -- dipakai fitur
// geser-urutkan (drag-and-drop) personel per kelompok/satuan di halaman
// Absensi Personel (mis. supaya bisa diurutkan manual berdasarkan
// senioritas pangkat/NRP). Didaftarkan SEBELUM "PUT /:id" di bawah supaya
// "reorder" tidak keliru ditangkap sebagai :id.
router.put('/reorder', requireRole('admin', 'verifikator'), asyncHandler(async (req, res) => {
  const { category, personnel_ids } = req.body || {};
  if (!category || !String(category).trim()) {
    return res.status(400).json({ error: 'Kategori wajib diisi' });
  }
  if (!Array.isArray(personnel_ids) || !personnel_ids.length || personnel_ids.some((id) => !Number.isInteger(id))) {
    return res.status(400).json({ error: 'Daftar ID personel tidak valid' });
  }
  if (personnel_ids.length > 200) {
    return res.status(400).json({ error: 'Jumlah personel terlalu banyak dalam satu permintaan' });
  }

  const categoryTrimmed = String(category).trim().toUpperCase();
  const [existingRows] = await pool.query(
    'SELECT id FROM personnel WHERE category = :category AND is_active = 1',
    { category: categoryTrimmed }
  );
  const validIds = new Set(existingRows.map((r) => r.id));
  const sameSet = personnel_ids.length === validIds.size && personnel_ids.every((id) => validIds.has(id));
  if (!sameSet) {
    return res.status(400).json({ error: 'Daftar personel tidak cocok dengan data terbaru kategori ini -- muat ulang halaman lalu coba lagi' });
  }

  for (let i = 0; i < personnel_ids.length; i += 1) {
    await pool.execute('UPDATE personnel SET sort_order = :sortOrder WHERE id = :id', { sortOrder: i + 1, id: personnel_ids[i] });
  }

  await logAudit(req.user.sub, 'update_personnel', 'personnel', null, { category: categoryTrimmed, action: 'reorder', count: personnel_ids.length });
  res.json({ data: { category: categoryTrimmed, count: personnel_ids.length } });
}));

// PUT /api/personnel/:id
router.put('/:id', requireRole('admin', 'verifikator'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { full_name, rank_info, position, category, notes, is_active } = req.body || {};

  const [existing] = await pool.execute('SELECT id FROM personnel WHERE id = :id', { id });
  if (!existing[0]) return res.status(404).json({ error: 'Data personel tidak ditemukan' });

  const fields = [];
  const params = { id };

  if (full_name !== undefined) {
    if (!String(full_name).trim()) return res.status(400).json({ error: 'Nama wajib diisi' });
    if (String(full_name).length > 150) return res.status(400).json({ error: 'Nama maksimal 150 karakter' });
    fields.push('full_name = :full_name'); params.full_name = String(full_name).trim();
  }
  if (rank_info !== undefined) {
    if (rank_info && String(rank_info).length > 150) return res.status(400).json({ error: 'Pangkat/Korps/NRP/NIP maksimal 150 karakter' });
    fields.push('rank_info = :rank_info'); params.rank_info = rank_info && String(rank_info).trim() ? String(rank_info).trim() : null;
  }
  if (position !== undefined) {
    if (!String(position).trim()) return res.status(400).json({ error: 'Jabatan wajib diisi' });
    if (String(position).length > 200) return res.status(400).json({ error: 'Jabatan maksimal 200 karakter' });
    fields.push('position = :position'); params.position = String(position).trim();
  }
  if (category !== undefined) {
    if (!String(category).trim()) return res.status(400).json({ error: 'Kategori/Satuan wajib diisi' });
    if (String(category).length > 50) return res.status(400).json({ error: 'Kategori maksimal 50 karakter' });
    fields.push('category = :category'); params.category = String(category).trim().toUpperCase();
  }
  if (notes !== undefined) {
    if (notes && String(notes).length > 255) return res.status(400).json({ error: 'Keterangan maksimal 255 karakter' });
    fields.push('notes = :notes'); params.notes = notes && String(notes).trim() ? String(notes).trim() : null;
  }
  if (is_active !== undefined) {
    fields.push('is_active = :is_active'); params.is_active = is_active ? 1 : 0;
  }

  if (fields.length) {
    fields.push('updated_by = :userId'); params.userId = req.user.sub;
    await pool.execute(`UPDATE personnel SET ${fields.join(', ')} WHERE id = :id`, params);
  }

  await logAudit(req.user.sub, 'update_personnel', 'personnel', id, req.body);
  res.json({ data: { id: Number(id) } });
}));

// DELETE /api/personnel/:id
// Kalau personel belum punya riwayat absensi, dihapus permanen. Kalau sudah
// punya riwayat, hanya dinonaktifkan (tidak muncul di absensi harian lagi)
// supaya riwayat absensi lama tidak kehilangan konteks personelnya --
// pola yang sama dipakai untuk akun pengguna yang pernah beraktivitas.
router.delete('/:id', requireRole('admin', 'verifikator'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [personnelRows] = await pool.execute('SELECT full_name FROM personnel WHERE id = :id', { id });
  if (!personnelRows[0]) return res.status(404).json({ error: 'Data personel tidak ditemukan' });

  const [[{ count }]] = await pool.execute('SELECT COUNT(*) AS count FROM attendance_records WHERE personnel_id = :id', { id });

  if (count > 0) {
    await pool.execute('UPDATE personnel SET is_active = 0, updated_by = :userId WHERE id = :id', { id, userId: req.user.sub });
    await logAudit(req.user.sub, 'deactivate_personnel', 'personnel', id, { full_name: personnelRows[0].full_name });
    return res.json({ data: { id: Number(id), deactivated: true } });
  }

  await pool.execute('DELETE FROM personnel WHERE id = :id', { id });
  await logAudit(req.user.sub, 'delete_personnel', 'personnel', id, { full_name: personnelRows[0].full_name });
  res.status(204).send();
}));

module.exports = router;
