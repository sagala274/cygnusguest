const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const BACKUP_ROOT = process.env.BACKUP_DIR || '/app/backups';
const RETENTION = { daily: 7, weekly: 8, monthly: 12 };
const VALID_TYPES = ['daily', 'weekly', 'monthly'];

function backupDir(type) {
  const dir = path.join(BACKUP_ROOT, type);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getIsoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const isoWeek = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return { isoYear: d.getUTCFullYear(), isoWeek };
}

function buildFilename(type, date) {
  if (type === 'daily') {
    return `daily-${date.toISOString().slice(0, 10)}.sql`;
  }
  if (type === 'weekly') {
    const { isoYear, isoWeek } = getIsoWeek(date);
    return `weekly-${isoYear}-W${String(isoWeek).padStart(2, '0')}.sql`;
  }
  return `monthly-${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}.sql`;
}

function rotate(type) {
  const dir = backupDir(type);
  const files = fs.readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => ({ name: f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  files.slice(RETENTION[type]).forEach((f) => {
    fs.unlinkSync(path.join(dir, f.name));
  });
}

function runBackup(type) {
  if (!VALID_TYPES.includes(type)) {
    return Promise.reject(new Error('Jenis backup tidak valid'));
  }

  return new Promise((resolve, reject) => {
    const dir = backupDir(type);
    const filename = buildFilename(type, new Date());
    const filePath = path.join(dir, filename);
    const writeStream = fs.createWriteStream(filePath);

    const args = [
      '-h', process.env.DB_HOST || 'mysql',
      '-P', String(process.env.DB_PORT || '3306'),
      '-u', process.env.DB_USER,
      '--single-transaction',
      '--routines',
      '--triggers',
      process.env.DB_NAME,
    ];

    const child = spawn('mysqldump', args, {
      env: { ...process.env, MYSQL_PWD: process.env.DB_PASSWORD },
    });

    let stderrOutput = '';
    child.stderr.on('data', (chunk) => { stderrOutput += chunk.toString(); });
    child.stdout.pipe(writeStream);

    child.on('error', (err) => {
      writeStream.close();
      reject(err);
    });

    child.on('close', (code) => {
      writeStream.end(() => {
        if (code !== 0) {
          fs.unlink(filePath, () => {});
          reject(new Error(`mysqldump keluar dengan kode ${code}: ${stderrOutput.trim()}`));
          return;
        }
        rotate(type);
        const stat = fs.statSync(filePath);
        resolve({ type, filename, size: stat.size, created_at: stat.mtime });
      });
    });
  });
}

function listBackups() {
  const result = {};
  VALID_TYPES.forEach((type) => {
    const dir = backupDir(type);
    result[type] = fs.readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .map((f) => {
        const stat = fs.statSync(path.join(dir, f));
        return { filename: f, size: stat.size, created_at: stat.mtime };
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  });
  return result;
}

module.exports = { runBackup, listBackups, backupDir, RETENTION, VALID_TYPES };
