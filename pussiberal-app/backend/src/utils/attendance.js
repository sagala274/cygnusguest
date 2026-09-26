const pool = require('../db');

// Urutan kelompok/satuan sesuai struktur organisasi di daftar nama personel.
// Kategori baru yang ditambahkan lewat menu Kelola Personel (di luar daftar
// ini) tetap ditampilkan, hanya diurutkan setelah kelompok yang sudah dikenal.
const CATEGORY_ORDER = ['PIMPINAN', 'SET', 'BAGKU', 'SATMA', 'DITBINKAM', 'DITBINMINLOGPERS', 'SATINASI', 'SATHAN', 'SATDAK'];

const ATTENDANCE_STATUSES = [
  'hadir', 'wfh', 'dinas_dalam', 'dinas_luar', 'sakit', 'ijin', 'cuti', 'pendidikan', 'bko', 'libur', 'tanpa_keterangan',
];

// Hari Sabtu (6) & Minggu (0) otomatis dianggap "libur" untuk personel yang
// belum diisi absensinya -- dihitung dari komponen tanggal lokal (bukan
// `new Date(dateString)` langsung) supaya tidak bergeser sehari akibat
// parsing UTC, sama seperti pola tanggal-saja di tempat lain pada aplikasi ini.
function isWeekend(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const day = new Date(y, m - 1, d).getDay();
  return day === 0 || day === 6;
}

// Data awal dari "DAFTAR NAMA PERSONEL PUSSIBERAL 2026" -- hanya dimasukkan
// sekali saat tabel personnel masih kosong (lihat ensurePersonnelTables).
const SEED_PERSONNEL = [
  { full_name: 'Masnal Samian, S.H., M.Si.', rank_info: 'Laksamana Pertama TNI', position: 'Danpussiberal', category: 'PIMPINAN', notes: null },
  { full_name: 'Asdi Yasin Y. Pribadi., S.T., M.Si(Han)., M.A', rank_info: 'Kolonel Laut (E) NRP 13365/P', position: 'Wadan Pussiberal', category: 'PIMPINAN', notes: null },

  { full_name: 'Maryanto', rank_info: 'Kapten Laut (E) NRP 20941/P', position: 'Kaur TU SET', category: 'SET', notes: null },
  { full_name: 'Shalahuddin Al-Hafizh, S.T.Han', rank_info: 'Kapten Laut (T) NRP 21461/P', position: 'Kaur Minpers Set', category: 'SET', notes: null },
  { full_name: 'Boby Christyawan Totonafo Zai, S.Kom.', rank_info: 'Serda Pdk NRP 135605', position: 'Ur Andisi Proaktif Satinasi/DBP SPRI', category: 'SET', notes: null },
  { full_name: 'Rollerz Errol Yani Pattinassarany', rank_info: 'III/B 197606272001121004', position: 'Paur Anev Ditbinkam/DPB SET', category: 'SET', notes: null },
  { full_name: 'Anwarrudin, SE', rank_info: 'III/A 197606102002121003', position: 'Paur Renevedalgar/DPB SET', category: 'SET', notes: null },

  { full_name: 'Winartin', rank_info: 'Kapten Laut (S/W) NRP 20259/P', position: 'Kabagku Pussiberal', category: 'BAGKU', notes: null },

  { full_name: 'F.X. Tetuko Zlatoper W., S.Tr.(HAN), M.H.', rank_info: 'Kapten Laut (P) NRP 22655/P', position: 'Kaur Pam Satma Pussiberal', category: 'SATMA', notes: null },
  { full_name: 'Budi Siswanto', rank_info: 'Lettu Laut (KH) NRP 23553/P', position: 'Kaur Lam Satma Pussiberal', category: 'SATMA', notes: null },
  { full_name: 'Arma Jaya Wardana', rank_info: 'Letda Laut (S) NRP 27067/P', position: 'Paur Lamhar Satma Pussiberal', category: 'SATMA', notes: null },
  { full_name: 'Sayan', rank_info: 'Serka MES NRP 88063', position: 'Ur Lam Satma Pussiberal', category: 'SATMA', notes: null },
  { full_name: 'Didi Mulyadi', rank_info: 'Kopda TTU NRP 115650', position: 'Pengemudi DAN/CARAKA', category: 'SATMA', notes: null },
  { full_name: 'Eko Nugroho', rank_info: 'III/B 198010042002121004', position: 'Paur Kerma/DPB Satma', category: 'SATMA', notes: null },

  { full_name: 'Satria Perdana P., S.T., M.Tr.Hanla., CEH., ECIH', rank_info: 'Kolonel Laut (E) NRP 16081/P', position: 'Dirbinkam', category: 'DITBINKAM', notes: null },
  { full_name: 'Hudayah Ramadhan, S.E., M.Tr.Opsla.', rank_info: 'Letkol Laut (T) NRP 18215/P', position: 'Kasubdit Binprowas Ditbinkam', category: 'DITBINKAM', notes: null },
  { full_name: 'Jaka Winanto, S.T., M.Tr.Opsla', rank_info: 'Letkol Laut (E) NRP 18250/P', position: 'Kasubdit Binpuanrasi Ditbinkam', category: 'DITBINKAM', notes: null },
  { full_name: 'Gilang Pradana W., S.S.T.Han.', rank_info: 'Mayor Laut (S) NRP 20071/P', position: 'Kasi Latkerma Ditbinkam', category: 'DITBINKAM', notes: null },
  { full_name: 'Arrahmansyah Aji Pratama, S.Tr.han.', rank_info: 'Lettu Laut (E) NRP 25498/P', position: 'Paur Giatops Ditbinkam', category: 'DITBINKAM', notes: null },
  { full_name: 'Bambang Somantri', rank_info: 'Serda Pdk NRP 135621', position: 'Ur Fordigi Satdak/DBP Ditbinkam', category: 'DITBINKAM', notes: null },
  { full_name: 'Okti Nurmalasari, S.T., M.T.', rank_info: 'III/C 197910232008122001', position: 'Kaur TU Hansiber/BKO (DPB Ditbinkam)', category: 'DITBINKAM', notes: null },

  { full_name: 'Wakhid Nur Ismail, S.T.', rank_info: 'Kolonel Laut (E) NRP 13363/P', position: 'Dirbinminlogpers', category: 'DITBINMINLOGPERS', notes: null },
  { full_name: 'Ferry Is Satria Angga, S.Sos., CTMP., M.M.', rank_info: 'Mayor Laut (S) NRP 19265/P', position: 'Kasubdit Bingar Ditbinminlogpers', category: 'DITBINMINLOGPERS', notes: null },
  { full_name: 'Deni Edi Santosa., CSA.', rank_info: 'Kapten Laut (KH) NRP 21823/P', position: 'Kaur Harmatlogpers Ditbinminlogpers', category: 'DITBINMINLOGPERS', notes: null },
  { full_name: 'Marman Setiyo, A.Md., CSA', rank_info: 'Kapten Laut (T) NRP 23873/P', position: 'Kaur Renevadalgar Ditbinminlogpers', category: 'DITBINMINLOGPERS', notes: null },
  { full_name: 'Tugas Wahyu Kristanto, CHFI., ECIH.', rank_info: 'Serka BAH NRP 115927', position: 'Ur Renevadalgar Ditbinlogpers', category: 'DITBINMINLOGPERS', notes: null },
  { full_name: 'Zaidin, CSA.., ECIH.', rank_info: 'Serka PDK NRP 87091', position: 'Ur Harmatlogpers Ditbinminlogpers', category: 'DITBINMINLOGPERS', notes: null },

  { full_name: 'Risman, S.T., M.Tr.Opsla.', rank_info: 'Letkol Laut (E) NRP 17716/P', position: 'Dansatinasi', category: 'SATINASI', notes: null },
  { full_name: 'Robby Wahyu Hutomo, S.ST.TP., CEH., CHFI., Cysa+., ECIH.', rank_info: 'Kapten Laut (E) NRP 21543/P', position: 'Danunit Ujirekontasi Satdak/DPB Satinasi', category: 'SATINASI', notes: null },
  { full_name: 'Natia Seanesya Kencana, S.Tr.Hanla., CEH., ECIH.', rank_info: 'Kapten Laut (E/W) NRP 22396/P', position: 'Danunit Penvacam Reaktif Satinasi', category: 'SATINASI', notes: null },
  { full_name: 'Firman Sidiq, S.Kom.', rank_info: 'Kapten Laut (E) NRP 22741/P', position: 'Danunit Penvacam Proaktif Satinasi', category: 'SATINASI', notes: null },
  { full_name: 'Yusuf Kurniawan', rank_info: 'Letda Laut (KH) NRP 26200/P', position: 'Paunit Detiden Reaktif Satinasi', category: 'SATINASI', notes: null },
  { full_name: 'Dhenny Nurcahyono', rank_info: 'Letda Laut (KH) NRP 26203/P', position: 'Paunit Detiden Proaktif Satinasi', category: 'SATINASI', notes: null },
  { full_name: 'Afrizal Ajuj Mudzakar, S.Tr.Kom.', rank_info: 'Letda Laut (E) NRP 2225104020027692', position: 'Paunit Anadisi Proaktif Satinasi', category: 'SATINASI', notes: null },
  { full_name: 'Yogi Prawiro Aditya., CSA., CHFI., CND., ECIH.', rank_info: 'Serka KOM NRP 119242', position: 'Ur Ujireksa Satdak/DBP Satinasi', category: 'SATINASI', notes: null },
  { full_name: 'Anjar Ayyubi Nur Biantoro., CHFI., CND., CSA., ECIH.', rank_info: 'Sertu PDK NRP 122007', position: 'Ur Detiden Proaktif Satinasi', category: 'SATINASI', notes: null },
  { full_name: 'Bayu Angger Sucipto', rank_info: 'Serda Pdk NRP 135625', position: 'Ur Andisi Reaktif Satinasi', category: 'SATINASI', notes: null },

  { full_name: 'Arifin Setiawan, S.T., M.Tr.Opsla., M.Sc.', rank_info: 'Letkol Laut (E) NRP 16621/P', position: 'Dansathan', category: 'SATHAN', notes: null },
  { full_name: 'Yulizardi S.A., A.Md', rank_info: 'Kapten Laut (KH) NRP 21387/P', position: 'Dantim Gullih Sathan', category: 'SATHAN', notes: null },
  { full_name: 'Muntalib Yudha Makatur, S.Kom.', rank_info: 'Kapten Laut (KH) NRP 22284/P', position: 'Danunit Pantau Promit Sathan', category: 'SATHAN', notes: null },
  { full_name: 'Teddy Wahyanto', rank_info: 'Lettu Laut (E) NRP 24101/P', position: 'Paunit Pemantauan Sathan', category: 'SATHAN', notes: null },
  { full_name: 'M. Fierza Eries., S.Kom.', rank_info: 'Letda Laut (E) NRP 2225107010028405', position: 'Paunit Penanggulangan Sathan', category: 'SATHAN', notes: 'Dik Cilendek' },
  { full_name: 'Timur Yulis Santosa, S.Kom., CND., Cysa+., CEH., ECIH.', rank_info: 'Serma PDK NRP 114142', position: 'Ur Penanggulangan Sathan', category: 'SATHAN', notes: null },
  { full_name: 'Dwi Hayat Bima Sakti, CSA.., Cysa+.', rank_info: 'Sertu KOM NRP 121687', position: 'Ur Pantau Sathan', category: 'SATHAN', notes: null },
  { full_name: 'Rivaldi Noviar, S.Kom.', rank_info: 'Serda Pdk NRP 135622', position: 'Ur Promit Sathan', category: 'SATHAN', notes: null },
  { full_name: 'Bima Eka Samudra, A.Md.T.', rank_info: 'Serda Pdk NRP 135635', position: 'Ur TU Hansiber', category: 'SATHAN', notes: null },
  { full_name: 'Kusuma Wahyu Pratama', rank_info: 'Serda Pdk NRP 135645', position: 'Ur Pemulihan Sathan', category: 'SATHAN', notes: null },

  { full_name: 'Krida Eva S.H., S.Kom, M.Tr. Opsla., CEH.', rank_info: 'Letkol Laut (E) NRP 17713/P', position: 'Dansatdak', category: 'SATDAK', notes: null },
  { full_name: 'Aditya Pradhana Purcha, S.T., MInfTech.', rank_info: 'Mayor Laut (E) NRP 20414/P', position: 'Dantim Ujirekontasi Satdak', category: 'SATDAK', notes: null },
  { full_name: 'Randi Muliyawan Bando, S.Kom., CHFI., CSA., ECIH.', rank_info: 'Kapten Laut (E) NRP 22737/P', position: 'Danunit Inforsik Satdak', category: 'SATDAK', notes: null },
  { full_name: 'Muhammad Ady Rasyiq Imanullah, S.Tr.Han.', rank_info: 'Lettu Laut (E) NRP 25504/P', position: 'Paunit Investigasi Satdak', category: 'SATDAK', notes: null },
  { full_name: 'Abie Ilham Prasetyo, S.Kom.', rank_info: 'Letda Laut (KH) NRP 2522107980027633', position: 'Paunit Ekstra Satdak', category: 'SATDAK', notes: null },
  { full_name: 'Prabowo, S.Kom.', rank_info: 'Letda Laut (E) NRP 2225109860028410', position: 'Paunit Jianrek Satdak', category: 'SATDAK', notes: 'Dik Cilendek' },
  { full_name: 'Enggar Wicaksono, CHFI.', rank_info: 'Serka PDK NRP 116327', position: 'Ur Investigasi Satdak', category: 'SATDAK', notes: null },
  { full_name: 'Fahmi Rolland Maulana', rank_info: 'Serda Pdk NRP 135624', position: 'Ur Ekstra Satdak', category: 'SATDAK', notes: null },
  { full_name: 'Reza Rizki Reynaldo, S.Kom.', rank_info: 'Serda Pdk NRP 135654', position: 'Ur TU Daksiber', category: 'SATDAK', notes: null },
];

async function ensurePersonnelTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS personnel (
      id INT AUTO_INCREMENT PRIMARY KEY,
      full_name VARCHAR(150) NOT NULL,
      rank_info VARCHAR(150) NULL,
      position VARCHAR(200) NOT NULL,
      category VARCHAR(50) NOT NULL,
      notes VARCHAR(255) NULL,
      sort_order INT NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_by INT NULL,
      updated_by INT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id),
      FOREIGN KEY (updated_by) REFERENCES users(id),
      KEY idx_category (category),
      KEY idx_full_name (full_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS attendance_records (
      id INT AUTO_INCREMENT PRIMARY KEY,
      personnel_id INT NOT NULL,
      attendance_date DATE NOT NULL,
      status ENUM(${ATTENDANCE_STATUSES.map((s) => `'${s}'`).join(',')}) NOT NULL,
      notes VARCHAR(255) NULL,
      recorded_by INT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_personnel_date (personnel_id, attendance_date),
      FOREIGN KEY (personnel_id) REFERENCES personnel(id) ON DELETE CASCADE,
      FOREIGN KEY (recorded_by) REFERENCES users(id),
      KEY idx_date (attendance_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  const [[{ count }]] = await pool.query('SELECT COUNT(*) AS count FROM personnel');
  if (count === 0) {
    for (let i = 0; i < SEED_PERSONNEL.length; i += 1) {
      const p = SEED_PERSONNEL[i];
      await pool.execute(
        `INSERT INTO personnel (full_name, rank_info, position, category, notes, sort_order)
         VALUES (:full_name, :rank_info, :position, :category, :notes, :sort_order)`,
        {
          full_name: p.full_name,
          rank_info: p.rank_info || null,
          position: p.position,
          category: p.category,
          notes: p.notes || null,
          sort_order: i + 1,
        }
      );
    }
    console.log(`Seed data personel: ${SEED_PERSONNEL.length} personel dimasukkan.`);
  }
}

// Fragmen SQL statis (daftar kategori sudah dikenal, bukan input pengguna)
// untuk mengurutkan kategori sesuai struktur organisasi; kategori baru di
// luar daftar ini tetap tampil, diurutkan setelah yang sudah dikenal.
function categoryOrderSql(column = 'category') {
  const list = CATEGORY_ORDER.map((c) => `'${c}'`).join(',');
  return `CASE WHEN FIELD(${column}, ${list}) = 0 THEN 999 ELSE FIELD(${column}, ${list}) END`;
}

async function columnExists(table, column) {
  const [rows] = await pool.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table AND COLUMN_NAME = :column`,
    { table, column }
  );
  return rows.length > 0;
}

// Kolom analisa intelijen (anomali/kecurigaan) untuk personel internal --
// pola & kategori yang sama seperti analisa Bank Data pada tamu (lihat
// utils/validators.js VALID_SECURITY_CATEGORIES), supaya konsisten. Dicek
// lewat information_schema (idempoten) karena MySQL tidak punya
// "ADD COLUMN IF NOT EXISTS".
async function ensurePersonnelAnalysisColumns() {
  if (!(await columnExists('personnel', 'security_category'))) {
    await pool.query(
      "ALTER TABLE personnel ADD COLUMN security_category ENUM('aman','perlu_perhatian','perlu_penanganan') NULL AFTER is_active"
    );
  }
  if (!(await columnExists('personnel', 'analysis_notes'))) {
    await pool.query('ALTER TABLE personnel ADD COLUMN analysis_notes TEXT NULL AFTER security_category');
  }
}

// MySQL tidak punya "ALTER TYPE ADD VALUE" -- MODIFY COLUMN dijalankan tiap
// start backend (bukan dikondisikan seperti ADD COLUMN) supaya nilai ENUM
// baru (mis. "wfh", "libur") ikut ditambahkan ke database yang sudah lebih
// dulu berjalan, sama seperti pola ensureUserRoleEnum() di utils/userAvatar.js.
async function ensureAttendanceStatusEnum() {
  await pool.query(
    `ALTER TABLE attendance_records MODIFY COLUMN status ENUM(${ATTENDANCE_STATUSES.map((s) => `'${s}'`).join(',')}) NOT NULL`
  );
}

module.exports = {
  ensurePersonnelTables, ensureAttendanceStatusEnum, ensurePersonnelAnalysisColumns,
  CATEGORY_ORDER, ATTENDANCE_STATUSES, categoryOrderSql, isWeekend,
};
