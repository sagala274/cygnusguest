const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const pool = require('../db');
const { authenticate } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const { notifyLogin, notifyLogout } = require('../utils/telegram');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Terlalu banyak percobaan login. Coba lagi dalam beberapa menit.' },
});

router.post('/login', loginLimiter, asyncHandler(async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username dan password wajib diisi' });
  }

  const [rows] = await pool.execute(
    'SELECT id, username, password_hash, full_name, role, is_active, avatar_url FROM users WHERE username = :username',
    { username }
  );

  const user = rows[0];
  if (!user || !user.is_active) {
    return res.status(401).json({ error: 'Username atau password salah' });
  }

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    return res.status(401).json({ error: 'Username atau password salah' });
  }

  const token = jwt.sign(
    { sub: user.id, username: user.username, role: user.role, name: user.full_name },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );

  await logAudit(user.id, 'login', 'user', user.id, { username: user.username });
  notifyLogin({ username: user.username, fullName: user.full_name, role: user.role, ipAddress: req.ip }).catch(() => {});

  res.json({
    token,
    user: { id: user.id, username: user.username, full_name: user.full_name, role: user.role, avatar_url: user.avatar_url },
  });
}));

router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

router.post('/logout', authenticate, asyncHandler(async (req, res) => {
  await logAudit(req.user.sub, 'logout', 'user', req.user.sub, { username: req.user.username });
  notifyLogout({ username: req.user.username, fullName: req.user.name, role: req.user.role }).catch(() => {});
  res.json({ data: { ok: true } });
}));

module.exports = router;
