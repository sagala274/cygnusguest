const pool = require('../db');

const TARGET_OFFICIALS = [
  'danpussiberal',
  'wadan_pussiberal',
  'dirbinminlogpers',
  'dirbinkamsiber',
  'dansatdak',
  'dansatinasi',
  'dansathan',
  'lainnya',
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
// dijalankan di setiap startup backend. Untuk kolom SET/ENUM, daftar
// nilainya di-MODIFY ulang setiap start -- supaya kalau daftar pilihan
// (mis. TARGET_OFFICIALS) bertambah di kemudian hari, database yang sudah
// pernah di-deploy sebelumnya ikut ter-update otomatis, bukan cuma
// instalasi baru.
async function ensureGuestExtraColumns() {
  const targetOfficialsType = `SET(${TARGET_OFFICIALS.map((v) => `'${v}'`).join(',')})`;
  if (await columnExists('guests', 'target_officials')) {
    await pool.query(`ALTER TABLE guests MODIFY COLUMN target_officials ${targetOfficialsType} NOT NULL DEFAULT ''`);
  } else {
    await pool.query(`ALTER TABLE guests ADD COLUMN target_officials ${targetOfficialsType} NOT NULL DEFAULT '' AFTER company`);
  }

  const purposeCategoryType = `ENUM(${PURPOSE_CATEGORIES.map((v) => `'${v}'`).join(',')})`;
  if (await columnExists('guests', 'purpose_category')) {
    await pool.query(`ALTER TABLE guests MODIFY COLUMN purpose_category ${purposeCategoryType} NULL`);
  } else {
    await pool.query(`ALTER TABLE guests ADD COLUMN purpose_category ${purposeCategoryType} NULL AFTER purpose`);
  }

  if (!(await columnExists('guests', 'target_official_other'))) {
    await pool.query(`
      ALTER TABLE guests ADD COLUMN target_official_other
        VARCHAR(200) NULL AFTER target_officials
    `);
  }

  if (!(await columnExists('guests', 'accompanied_by'))) {
    await pool.query(`
      ALTER TABLE guests ADD COLUMN accompanied_by
        VARCHAR(150) NULL AFTER purpose_category
    `);
  }
}

// Migrasi kolom pada guest_members (bukan guests) -- dipisah supaya nama
// fungsi tetap jelas menunjuk tabel mana yang diubah.
async function ensureGuestMemberExtraColumns() {
  if (!(await columnExists('guest_members', 'social_media'))) {
    await pool.query(`
      ALTER TABLE guest_members ADD COLUMN social_media
        VARCHAR(255) NULL AFTER affiliation
    `);
  }
  if (!(await columnExists('guest_members', 'address'))) {
    await pool.query(`
      ALTER TABLE guest_members ADD COLUMN address
        VARCHAR(255) NULL AFTER social_media
    `);
  }
  if (!(await columnExists('guest_members', 'other_names'))) {
    await pool.query(`
      ALTER TABLE guest_members ADD COLUMN other_names
        VARCHAR(255) NULL AFTER full_name
    `);
  }

  // Diubah dari NOT NULL DEFAULT 'dititipkan' jadi boleh NULL -- dipakai
  // untuk merepresentasikan "belum dideklarasikan" pada tamu terjadwal
  // (dibuat sebelum kedatangan, deklarasi perangkat elektronik menyusul saat
  // tamu benar-benar tiba). Aman dijalankan berulang di data yang sudah ada
  // karena baris lama semuanya sudah terisi nilai valid, tidak pernah NULL.
  await pool.query(`
    ALTER TABLE guest_members MODIFY COLUMN device_status
      ENUM('tidak_membawa','dititipkan','dibawa_alasan_khusus') NULL
  `);

  // NIK diubah dari wajib jadi opsional (mis. tamu yang belum/tidak membawa
  // KTP) -- aman dijalankan berulang, indeks pada kolom ini bukan UNIQUE
  // sehingga banyak baris NULL tidak bermasalah.
  await pool.query(`
    ALTER TABLE guest_members MODIFY COLUMN nik VARCHAR(16) NULL
  `);
}

// Migrasi kolom pada visits -- dipakai untuk fitur "Check-in Ulang" (tamu
// yang sudah check-out balik lagi ke area, mis. tertinggal dokumen). Alasan
// disimpan tunggal (bukan histori) supaya tetap sederhana, terlihat di
// Detail Tamu; jejak lengkap tiap kejadian tetap tercatat di Log Aktivitas.
async function ensureVisitExtraColumns() {
  if (!(await columnExists('visits', 're_entry_reason'))) {
    await pool.query(`
      ALTER TABLE visits ADD COLUMN re_entry_reason
        VARCHAR(255) NULL AFTER status
    `);
  }
  if (!(await columnExists('visits', 're_entry_at'))) {
    await pool.query(`
      ALTER TABLE visits ADD COLUMN re_entry_at
        DATETIME NULL AFTER re_entry_reason
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
  lainnya: 'Lainnya',
};

module.exports = {
  TARGET_OFFICIALS,
  PURPOSE_CATEGORIES,
  TARGET_OFFICIAL_LABELS,
  ensureGuestExtraColumns,
  ensureGuestMemberExtraColumns,
  ensureVisitExtraColumns,
  isValidTargetOfficials,
};
