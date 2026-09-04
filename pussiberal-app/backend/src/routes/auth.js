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
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Terlalu banyak percobaan login. Coba lagi dalam beberapa menit.' },
});

// Penguncian per-akun setelah 5 kali gagal login beruntun -- pelengkap
// loginLimiter di atas (yang berbasis alamat IP). Rate limiter berbasis IP
// tidak menahan percobaan yang menyasar SATU akun tertentu dari banyak
// alamat IP berbeda; penguncian per-akun ini menutup celah itu.
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

router.post('/login', loginLimiter, asyncHandler(async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username dan password wajib diisi' });
  }

  const [rows] = await pool.execute(
    'SELECT id, username, password_hash, full_name, role, is_active, avatar_url, failed_login_attempts, locked_until FROM users WHERE username = :username',
    { username }
  );

  const user = rows[0];
  if (!user || !user.is_active) {
    return res.status(401).json({ error: 'Username atau password salah' });
  }

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    const minutesLeft = Math.max(1, Math.ceil((new Date(user.locked_until) - new Date()) / 60000));
    return res.status(423).json({
      error: `Akun terkunci sementara karena terlalu banyak percobaan login gagal. Coba lagi dalam ${minutesLeft} menit.`,
    });
  }

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    const attempts = user.failed_login_attempts + 1;
    if (attempts >= MAX_FAILED_ATTEMPTS) {
      await pool.execute(
        'UPDATE users SET failed_login_attempts = 0, locked_until = DATE_ADD(NOW(), INTERVAL :minutes MINUTE) WHERE id = :id',
        { minutes: LOCKOUT_MINUTES, id: user.id }
      );
      await logAudit(user.id, 'account_locked', 'user', user.id, {
        username: user.username,
        reason: `${MAX_FAILED_ATTEMPTS} percobaan login gagal beruntun`,
      });
      return res.status(423).json({
        error: `Akun terkunci sementara karena terlalu banyak percobaan login gagal. Coba lagi dalam ${LOCKOUT_MINUTES} menit.`,
      });
    }
    await pool.execute('UPDATE users SET failed_login_attempts = :attempts WHERE id = :id', { attempts, id: user.id });
    return res.status(401).json({ error: 'Username atau password salah' });
  }

  if (user.failed_login_attempts > 0 || user.locked_until) {
    await pool.execute('UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = :id', { id: user.id });
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
