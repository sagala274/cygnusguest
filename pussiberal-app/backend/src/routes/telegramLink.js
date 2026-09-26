const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { generateLinkCode, getLinkForUser, unlinkUser } = require('../utils/telegramLink');

const router = express.Router();
// Tautan Telegram pribadi hanya berguna untuk role yang bisa memverifikasi
// tamu (Admin/Verifikator) -- setiap orang menautkan akunnya SENDIRI, tidak
// ada endpoint untuk menautkan akun orang lain.
router.use(authenticate, requireRole('admin', 'verifikator'));

// GET /api/telegram-link -- status tautan akun sendiri
router.get('/', asyncHandler(async (req, res) => {
  const link = await getLinkForUser(req.user.sub);
  res.json({ data: link });
}));

// POST /api/telegram-link/code -- buat kode sekali-pakai untuk ditautkan
router.post('/code', asyncHandler(async (req, res) => {
  const { code, expiresAt } = await generateLinkCode(req.user.sub);
  res.json({ data: { code, expires_at: expiresAt } });
}));

// DELETE /api/telegram-link -- putus tautan akun sendiri
router.delete('/', asyncHandler(async (req, res) => {
  await unlinkUser(req.user.sub);
  res.status(204).send();
}));

module.exports = router;
