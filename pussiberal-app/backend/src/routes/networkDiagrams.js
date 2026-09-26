const express = require('express');
const pool = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
// "pimpinan" boleh MELIHAT (GET) tapi tidak boleh menulis -- setiap route
// tulis (POST/PUT/DELETE) di bawah punya requireRole tersendiri yang
// sengaja TIDAK menyertakan "pimpinan".
router.use(authenticate, requireRole('admin', 'verifikator', 'pimpinan'));

const EMPTY_DIAGRAM = JSON.stringify({ nodes: [], edges: [] });

// Validasi longgar: hanya memastikan bentuknya objek dengan nodes/edges
// berupa array -- isi tiap node/edge (posisi, warna, label) sepenuhnya
// dikendalikan editor di sisi client, tidak divalidasi mendetail di sini
// (mirip pola field bebas lain di aplikasi ini), karena cuma memengaruhi
// tampilan diagram itu sendiri, bukan data tamu/keamanan.
function isValidDiagramData(value) {
  if (typeof value !== 'string') return false;
  if (value.length > 2_000_000) return false; // ~2MB, cukup longgar untuk diagram besar
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && Array.isArray(parsed.nodes) && Array.isArray(parsed.edges);
  } catch (err) {
    return false;
  }
}

// GET /api/network-diagrams  (daftar ringkas, tanpa isi data diagram)
router.get('/', asyncHandler(async (req, res) => {
  const [rows] = await pool.query(`
    SELECT nd.id, nd.name, nd.created_at, nd.updated_at,
           cu.full_name AS created_by_name, uu.full_name AS updated_by_name
    FROM network_diagrams nd
    LEFT JOIN users cu ON cu.id = nd.created_by
    LEFT JOIN users uu ON uu.id = nd.updated_by
    ORDER BY nd.updated_at DESC
  `);
  res.json({ data: rows });
}));

// GET /api/network-diagrams/:id  (satu diagram lengkap dengan isinya)
router.get('/:id', asyncHandler(async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT nd.id, nd.name, nd.data, nd.created_at, nd.updated_at,
            cu.full_name AS created_by_name, uu.full_name AS updated_by_name
     FROM network_diagrams nd
     LEFT JOIN users cu ON cu.id = nd.created_by
     LEFT JOIN users uu ON uu.id = nd.updated_by
     WHERE nd.id = :id`,
    { id: req.params.id }
  );
  if (!rows[0]) return res.status(404).json({ error: 'Pemetaan tidak ditemukan' });
  res.json({ data: rows[0] });
}));

// POST /api/network-diagrams  (buat diagram baru, kosong atau dengan data awal)
router.post('/', requireRole('admin', 'verifikator'), asyncHandler(async (req, res) => {
  const { name, data } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: 'Nama pemetaan wajib diisi' });
  }
  if (String(name).trim().length > 150) {
    return res.status(400).json({ error: 'Nama pemetaan maksimal 150 karakter' });
  }
  const diagramData = data !== undefined ? data : EMPTY_DIAGRAM;
  if (!isValidDiagramData(diagramData)) {
    return res.status(400).json({ error: 'Data diagram tidak valid' });
  }

  const [result] = await pool.execute(
    'INSERT INTO network_diagrams (name, data, created_by, updated_by) VALUES (:name, :data, :userId, :userId)',
    { name: String(name).trim(), data: diagramData, userId: req.user.sub }
  );

  await logAudit(req.user.sub, 'create_network_diagram', 'network_diagram', result.insertId, { name: String(name).trim() });

  res.status(201).json({ data: { id: result.insertId, name: String(name).trim() } });
}));

// PUT /api/network-diagrams/:id  (ubah nama dan/atau isi diagram)
router.put('/:id', requireRole('admin', 'verifikator'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, data } = req.body || {};

  const fields = [];
  const params = { id };

  if (name !== undefined) {
    if (!String(name).trim()) return res.status(400).json({ error: 'Nama pemetaan wajib diisi' });
    if (String(name).trim().length > 150) return res.status(400).json({ error: 'Nama pemetaan maksimal 150 karakter' });
    fields.push('name = :name'); params.name = String(name).trim();
  }
  if (data !== undefined) {
    if (!isValidDiagramData(data)) return res.status(400).json({ error: 'Data diagram tidak valid' });
    fields.push('data = :data'); params.data = data;
  }

  if (!fields.length) {
    return res.status(400).json({ error: 'Tidak ada perubahan untuk disimpan' });
  }

  fields.push('updated_by = :userId'); params.userId = req.user.sub;

  const [result] = await pool.execute(`UPDATE network_diagrams SET ${fields.join(', ')} WHERE id = :id`, params);
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Pemetaan tidak ditemukan' });

  res.json({ data: { id: Number(id) } });
}));

// DELETE /api/network-diagrams/:id
router.delete('/:id', requireRole('admin', 'verifikator'), asyncHandler(async (req, res) => {
  const [rows] = await pool.execute('SELECT name FROM network_diagrams WHERE id = :id', { id: req.params.id });
  if (!rows[0]) return res.status(404).json({ error: 'Pemetaan tidak ditemukan' });

  await pool.execute('DELETE FROM network_diagrams WHERE id = :id', { id: req.params.id });
  await logAudit(req.user.sub, 'delete_network_diagram', 'network_diagram', req.params.id, { name: rows[0].name });

  res.status(204).send();
}));

module.exports = router;
