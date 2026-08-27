const express = require('express');
const path = require('path');
const fs = require('fs');
const { authenticate, requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { runBackup, listBackups, backupDir, RETENTION, VALID_TYPES } = require('../utils/backup');
const { logAudit } = require('../utils/audit');

const router = express.Router();
router.use(authenticate, requireRole('admin'));

// Nama file backup dibuat sendiri oleh sistem (lihat utils/backup.js), tidak
// pernah dari input pengguna -- pola ini tetap divalidasi ketat sebelum dipakai
// untuk path filesystem, sebagai lapisan pertahanan terhadap path traversal.
const FILENAME_PATTERN = /^[a-zA-Z0-9_.-]+\.sql$/;

router.get('/', asyncHandler(async (req, res) => {
  res.json({ data: listBackups(), retention: RETENTION });
}));

router.post('/run', asyncHandler(async (req, res) => {
  const { type } = req.body || {};
  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: 'Jenis backup tidak valid. Gunakan daily, weekly, atau monthly.' });
  }

  const result = await runBackup(type);
  await logAudit(req.user.sub, 'create_backup', 'backup', null, { type, filename: result.filename, size: result.size });
  res.status(201).json({ data: result });
}));

router.get('/:type/:filename/download', asyncHandler(async (req, res) => {
  const { type, filename } = req.params;

  if (!VALID_TYPES.includes(type) || !FILENAME_PATTERN.test(filename) || !filename.startsWith(`${type}-`)) {
    return res.status(400).json({ error: 'Nama file tidak valid' });
  }

  const filePath = path.join(backupDir(type), filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File backup tidak ditemukan' });
  }

  await logAudit(req.user.sub, 'download_backup', 'backup', null, { type, filename });
  res.download(filePath, filename);
}));

module.exports = router;
