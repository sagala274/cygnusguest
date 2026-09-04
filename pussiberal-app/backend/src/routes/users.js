const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const asyncHandler = require('../utils/asyncHandler');

const VALID_ROLES = ['admin', 'verifikator', 'pos_depan'];

// Dibatasi ke karakter aman (bukan karena escaping di tampilan tidak
// memadai -- sudah diverifikasi aman -- tapi sebagai lapisan pertahanan
// tambahan yang tidak bergantung sepenuhnya pada benarnya escaping di
// setiap titik tampilan ke depannya).
const USERNAME_PATTERN = /^[a-zA-Z0-9._-]{3,50}$/;

const router = express.Router();
router.use(authenticate, requireRole('admin'));

router.get('/', asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    'SELECT id, username, full_name, avatar_url, role, is_active, created_at FROM users ORDER BY created_at DESC'
  );
  res.json({ data: rows });
}));

router.post('/', asyncHandler(async (req, res) => {
  const { username, password, full_name, role } = req.body || {};
  if (!username || !password || !full_name || !role) {
    return res.status(400).json({ error: 'Semua field wajib diisi' });
  }
  if (!USERNAME_PATTERN.test(username)) {
    return res.status(400).json({ error: 'Username hanya boleh berisi huruf, angka, titik, garis bawah, atau strip (3-50 karakter)' });
  }
  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: 'Role tidak valid' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password minimal 8 karakter' });
  }

  const hash = await bcrypt.hash(password, 10);
  try {
    const [result] = await pool.execute(
      'INSERT INTO users (username, password_hash, full_name, role) VALUES (:username, :hash, :full_name, :role)',
      { username, hash, full_name, role }
    );
    await logAudit(req.user.sub, 'create_user', 'user', result.insertId, { username, role });
    res.status(201).json({ data: { id: result.insertId, username, full_name, role } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Username sudah digunakan' });
    throw err;
  }
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const { full_name, role, is_active, password, avatar_url } = req.body || {};
  const id = req.params.id;

  if (role !== undefined && !VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: 'Role tidak valid' });
  }
  if (avatar_url !== undefined && avatar_url !== null && String(avatar_url).length > 255) {
    return res.status(400).json({ error: 'Avatar URL maksimal 255 karakter' });
  }
  if (password && password.length < 8) {
    return res.status(400).json({ error: 'Password minimal 8 karakter' });
  }
  if (Number(id) === req.user.sub && is_active === false) {
    return res.status(400).json({ error: 'Tidak dapat menonaktifkan akun yang sedang digunakan' });
  }
  if (Number(id) === req.user.sub && role !== undefined && role !== req.user.role) {
    return res.status(400).json({ error: 'Tidak dapat mengubah role akun sendiri' });
  }

  const fields = [];
  const params = { id };
  if (full_name !== undefined) { fields.push('full_name = :full_name'); params.full_name = full_name; }
  if (role !== undefined) { fields.push('role = :role'); params.role = role; }
  if (is_active !== undefined) { fields.push('is_active = :is_active'); params.is_active = is_active ? 1 : 0; }
  if (avatar_url !== undefined) { fields.push('avatar_url = :avatar_url'); params.avatar_url = avatar_url || null; }
  if (password) {
    fields.push('password_hash = :password_hash');
    params.password_hash = await bcrypt.hash(password, 10);
  }

  if (fields.length) {
    const [result] = await pool.execute(`UPDATE users SET ${fields.join(', ')} WHERE id = :id`, params);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
    }
  }

  await logAudit(req.user.sub, 'update_user', 'user', id, { full_name, role, is_active });
  res.json({ data: { id: Number(id) } });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const id = req.params.id;

  if (Number(id) === req.user.sub) {
    return res.status(400).json({ error: 'Tidak dapat menghapus akun yang sedang digunakan' });
  }

  try {
    const [result] = await pool.execute('DELETE FROM users WHERE id = :id', { id });
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
    }
  } catch (err) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_ROW_IS_REFERENCED') {
      return res.status(409).json({
        error: 'Pengguna ini memiliki riwayat aktivitas (pendaftaran tamu/audit log) sehingga tidak dapat dihapus permanen. Nonaktifkan pengguna ini sebagai gantinya.',
      });
    }
    throw err;
  }

  await logAudit(req.user.sub, 'delete_user', 'user', id, null);
  res.status(204).send();
}));

module.exports = router;
