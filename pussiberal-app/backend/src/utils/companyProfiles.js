const pool = require('../db');

// Hasil profiling tingkat PERUSAHAAN (bukan per-personel) di Bank Data --
// satu baris per nama perusahaan (kolom `company` sudah di-trim, mengikuti
// aturan pengelompokan yang sama dipakai groupByCompany() di routes/bankData.js).
async function ensureCompanyProfilesTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS company_profiles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company VARCHAR(150) NOT NULL UNIQUE,
      security_category ENUM('aman','perlu_perhatian','perlu_penanganan') NULL,
      profiling_notes TEXT NULL,
      updated_by INT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (updated_by) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

const COMPANY_TYPES = ['swasta', 'bumn_bumd', 'instansi_pemerintah', 'pendidikan', 'organisasi_lsm', 'perorangan', 'lainnya'];
const LEGAL_STATUSES = ['terverifikasi', 'belum_terverifikasi', 'tidak_valid'];
const RELATIONSHIP_STATUSES = ['mitra_aktif', 'calon_mitra', 'tidak_ada_hubungan_khusus', 'perlu_tindak_lanjut'];
const VISIT_HISTORIES = ['baru_pertama_kali', 'beberapa_kali', 'rutin'];
const PUBLIC_CHECK_RESULTS = ['tidak_ada_masalah', 'ada_catatan', 'perlu_pendalaman'];
const DATA_CONSISTENCIES = ['konsisten', 'sebagian_konsisten', 'tidak_konsisten'];

async function columnExists(table, column) {
  const [rows] = await pool.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table AND COLUMN_NAME = :column`,
    { table, column }
  );
  return rows.length > 0;
}

// Rancangan Formulir Profiling Perusahaan -- menambah kolom-kolom rinci di
// luar security_category/profiling_notes yang sudah ada sejak awal (dua
// kolom itu tetap dipakai sebagai bagian "5. Kesimpulan Profiling").
// MySQL tidak mendukung "ADD COLUMN IF NOT EXISTS" -- dicek manual lewat
// information_schema (lihat pola yang sama di utils/guestFields.js).
async function ensureCompanyProfileExtraColumns() {
  const addColumn = async (column, definition, after) => {
    if (await columnExists('company_profiles', column)) return;
    await pool.query(`ALTER TABLE company_profiles ADD COLUMN ${column} ${definition} AFTER ${after}`);
  };

  // 1. Identitas Perusahaan
  await addColumn('official_name', 'VARCHAR(200) NULL', 'company');
  await addColumn('company_type', `ENUM(${COMPANY_TYPES.map((v) => `'${v}'`).join(',')}) NULL`, 'official_name');
  await addColumn('business_field', 'VARCHAR(200) NULL', 'company_type');
  await addColumn('founded_year', 'VARCHAR(4) NULL', 'business_field');
  await addColumn('head_office_address', 'VARCHAR(255) NULL', 'founded_year');
  await addColumn('website', 'VARCHAR(200) NULL', 'head_office_address');
  await addColumn('company_phone', 'VARCHAR(50) NULL', 'website');

  // 2. Legalitas dan Pengurus
  await addColumn('nib', 'VARCHAR(50) NULL', 'company_phone');
  await addColumn('legal_status', `ENUM(${LEGAL_STATUSES.map((v) => `'${v}'`).join(',')}) NULL`, 'nib');
  await addColumn('director_name', 'VARCHAR(150) NULL', 'legal_status');
  await addColumn('representative_name', 'VARCHAR(150) NULL', 'director_name');
  await addColumn('legal_notes', 'TEXT NULL', 'representative_name');

  // 3. Hubungan dengan Pussiberal/TNI AL
  await addColumn('relationship_status', `ENUM(${RELATIONSHIP_STATUSES.map((v) => `'${v}'`).join(',')}) NULL`, 'legal_notes');
  await addColumn('relationship_target_unit', 'VARCHAR(150) NULL', 'relationship_status');
  await addColumn('relationship_basis', 'TEXT NULL', 'relationship_target_unit');
  await addColumn('visit_history', `ENUM(${VISIT_HISTORIES.map((v) => `'${v}'`).join(',')}) NULL`, 'relationship_basis');
  await addColumn('internal_contact', 'VARCHAR(150) NULL', 'visit_history');

  // 4. Rekam Jejak dan Hasil Pemeriksaan
  await addColumn('public_check_result', `ENUM(${PUBLIC_CHECK_RESULTS.map((v) => `'${v}'`).join(',')}) NULL`, 'internal_contact');
  await addColumn('data_consistency', `ENUM(${DATA_CONSISTENCIES.map((v) => `'${v}'`).join(',')}) NULL`, 'public_check_result');
  await addColumn('track_record_notes', 'TEXT NULL', 'data_consistency');
  await addColumn('information_sources', 'VARCHAR(255) NULL', 'track_record_notes');

  // 5. Kesimpulan Profiling -- sudah ada sejak awal: security_category, profiling_notes
}

module.exports = {
  ensureCompanyProfilesTable,
  ensureCompanyProfileExtraColumns,
  COMPANY_TYPES,
  LEGAL_STATUSES,
  RELATIONSHIP_STATUSES,
  VISIT_HISTORIES,
  PUBLIC_CHECK_RESULTS,
  DATA_CONSISTENCIES,
};
