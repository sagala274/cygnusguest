const pool = require('../db');

const TARGET_OFFICIALS = [
  'danpussiberal',
  'wadan_pussiberal',
  'dirbinminlogpers',
  'dirbinkamsiber',
  'dansatdak',
  'dansatinasi',
  'dansathan',
];

const PURPOSE_CATEGORIES = [
  'audiensi',
  'rapat_koordinasi',
  'diskusi_teknis',
  'maintenance',
  'pengiriman',
  'lainnya',
];

async function columnExists(table, column) {
  const [rows] = await pool.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table AND COLUMN_NAME = :column`,
    { table, column }
  );
  return rows.length > 0;
}

// MySQL (beda dengan MariaDB) tidak mendukung "ADD COLUMN IF NOT EXISTS" --
// dicek manual lewat information_schema supaya tetap idempoten dan aman
// dijalankan di setiap startup backend.
async function ensureGuestExtraColumns() {
  if (!(await columnExists('guests', 'target_officials'))) {
    await pool.query(`
      ALTER TABLE guests ADD COLUMN target_officials
        SET(${TARGET_OFFICIALS.map((v) => `'${v}'`).join(',')}) NOT NULL DEFAULT '' AFTER company
    `);
  }
  if (!(await columnExists('guests', 'purpose_category'))) {
    await pool.query(`
      ALTER TABLE guests ADD COLUMN purpose_category
        ENUM(${PURPOSE_CATEGORIES.map((v) => `'${v}'`).join(',')}) NULL AFTER purpose
    `);
  }
}

function isValidTargetOfficials(value) {
  return Array.isArray(value) && value.length > 0 && value.every((v) => TARGET_OFFICIALS.includes(v));
}

const TARGET_OFFICIAL_LABELS = {
  danpussiberal: 'Danpussiberal',
  wadan_pussiberal: 'Wadan Pussiberal',
  dirbinminlogpers: 'Dirbinminlogpers',
  dirbinkamsiber: 'Dirbinkamsiber',
  dansatdak: 'Dansatdak',
  dansatinasi: 'Dansatinasi',
  dansathan: 'Dansathan',
};

module.exports = {
  TARGET_OFFICIALS,
  PURPOSE_CATEGORIES,
  TARGET_OFFICIAL_LABELS,
  ensureGuestExtraColumns,
  isValidTargetOfficials,
};
