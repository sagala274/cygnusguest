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

async function ensureGuestExtraColumns() {
  await pool.query(`
    ALTER TABLE guests
      ADD COLUMN IF NOT EXISTS target_officials SET(${TARGET_OFFICIALS.map((v) => `'${v}'`).join(',')}) NOT NULL DEFAULT '' AFTER company,
      ADD COLUMN IF NOT EXISTS purpose_category ENUM(${PURPOSE_CATEGORIES.map((v) => `'${v}'`).join(',')}) NULL AFTER purpose
  `);
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
