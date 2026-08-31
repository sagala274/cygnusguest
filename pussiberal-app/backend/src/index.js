require('dotenv').config();
const express = require('express');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const pool = require('./db');

const authRoutes = require('./routes/auth');
const guestRoutes = require('./routes/guests');
const userRoutes = require('./routes/users');
const reportRoutes = require('./routes/reports');
const auditLogRoutes = require('./routes/auditLogs');
const bankDataRoutes = require('./routes/bankData');
const backupRoutes = require('./routes/backups');
const aiSettingsRoutes = require('./routes/aiSettings');
const aiChatRoutes = require('./routes/aiChat');
const telegramSettingsRoutes = require('./routes/telegramSettings');
const notificationRoutes = require('./routes/notifications');
const { startBackupScheduler } = require('./utils/backupScheduler');
const { ensureAiSettingsTable } = require('./utils/aiSettings');
const { ensureTelegramSettingsTable } = require('./utils/telegram');
const { startTelegramPolling } = require('./utils/telegramBot');
const { ensureGuestExtraColumns, ensureGuestMemberExtraColumns, ensureVisitExtraColumns } = require('./utils/guestFields');
const { ensureUserAvatarColumn } = require('./utils/userAvatar');
const { ensureNotificationsTable } = require('./utils/notifications');

const app = express();

// Berada di belakang reverse proxy nginx (1 hop) -- perlu agar rate limiter dan
// req.ip membaca alamat client asli dari header X-Forwarded-For, bukan IP nginx.
app.set('trust proxy', 1);

app.use(express.json({ limit: '5mb' }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', apiLimiter);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/guests', guestRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/bank-data', bankDataRoutes);
app.use('/api/backups', backupRoutes);
app.use('/api/ai-settings', aiSettingsRoutes);
app.use('/api/ai-chat', aiChatRoutes);
app.use('/api/telegram-settings', telegramSettingsRoutes);
app.use('/api/notifications', notificationRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint tidak ditemukan' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Terjadi kesalahan pada server' });
});

async function ensureAdminSeed() {
  const [rows] = await pool.query('SELECT COUNT(*) AS count FROM users');
  if (rows[0].count > 0) return;

  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    console.warn('ADMIN_PASSWORD tidak diset, admin default tidak dibuat.');
    return;
  }

  const hash = await bcrypt.hash(password, 10);
  await pool.execute(
    "INSERT INTO users (username, password_hash, full_name, role) VALUES (:username, :hash, 'Administrator', 'admin')",
    { username, hash }
  );
  console.log(`Admin default dibuat: ${username}`);
}

async function waitForDatabase() {
  for (let attempt = 1; attempt <= 15; attempt += 1) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (err) {
      console.log(`Menunggu database... (${attempt}/15)`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      if (attempt === 15) throw err;
    }
  }
}

async function start() {
  const port = process.env.PORT || 3000;
  await waitForDatabase();
  await ensureAdminSeed();
  await ensureAiSettingsTable();
  await ensureTelegramSettingsTable();
  await ensureGuestExtraColumns();
  await ensureGuestMemberExtraColumns();
  await ensureVisitExtraColumns();
  await ensureUserAvatarColumn();
  await ensureNotificationsTable();
  startBackupScheduler();
  startTelegramPolling();
  app.listen(port, () => console.log(`Backend berjalan di port ${port}`));
}

start().catch((err) => {
  console.error('Gagal memulai server', err);
  process.exit(1);
});
