const express = require('express');
const pool = require('../db');
const { authenticate } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
router.use(authenticate);

// GET /api/notifications  (30 notifikasi terbaru milik pengguna yang login,
// plus jumlah yang belum dibaca -- untuk badge di lonceng topbar)
router.get('/', asyncHandler(async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT id, type, message, guest_id, is_read, created_at
     FROM notifications WHERE user_id = :userId ORDER BY created_at DESC LIMIT 30`,
    { userId: req.user.sub }
  );
  const [[{ unread }]] = await pool.execute(
    'SELECT COUNT(*) AS unread FROM notifications WHERE user_id = :userId AND is_read = 0',
    { userId: req.user.sub }
  );
  res.json({ data: rows, unread_count: unread });
}));

// POST /api/notifications/:id/read
router.post('/:id/read', asyncHandler(async (req, res) => {
  await pool.execute(
    'UPDATE notifications SET is_read = 1 WHERE id = :id AND user_id = :userId',
    { id: req.params.id, userId: req.user.sub }
  );
  res.json({ data: { ok: true } });
}));

// POST /api/notifications/read-all
router.post('/read-all', asyncHandler(async (req, res) => {
  await pool.execute(
    'UPDATE notifications SET is_read = 1 WHERE user_id = :userId AND is_read = 0',
    { userId: req.user.sub }
  );
  res.json({ data: { ok: true } });
}));

module.exports = router;
