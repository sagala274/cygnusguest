const express = require('express');
const pool = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
router.use(authenticate, requireRole('admin'));

router.get('/', asyncHandler(async (req, res) => {
  const { q, action, from, to, page = 1, pageSize = 25 } = req.query;
  const limit = Math.min(parseInt(pageSize, 10) || 25, 100);
  const offset = (Math.max(parseInt(page, 10) || 1, 1) - 1) * limit;

  const where = [];
  const params = {};

  if (q) {
    where.push('(u.username LIKE :q OR u.full_name LIKE :q OR al.action LIKE :q OR al.object_type LIKE :q)');
    params.q = `%${q}%`;
  }
  if (action) {
    where.push('al.action = :action');
    params.action = action;
  }
  if (from) {
    where.push('DATE(al.timestamp) >= :from');
    params.from = from;
  }
  if (to) {
    where.push('DATE(al.timestamp) <= :to');
    params.to = to;
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT al.id, al.action, al.object_type, al.object_id, al.detail, al.timestamp,
            u.username, u.full_name
     FROM audit_logs al
     LEFT JOIN users u ON u.id = al.user_id
     ${whereSql}
     ORDER BY al.timestamp DESC
     LIMIT ${limit} OFFSET ${offset}`,
    params
  );

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM audit_logs al LEFT JOIN users u ON u.id = al.user_id ${whereSql}`,
    params
  );

  res.json({ data: rows, total: countRows[0].total, page: Number(page), pageSize: limit });
}));

module.exports = router;
