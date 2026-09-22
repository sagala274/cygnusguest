const pool = require('../db');

// Pemetaan hubungan (mis. nama personel terhubung ke perusahaan lain) --
// disimpan sebagai satu blob JSON (nodes + edges) per diagram, mirip pola
// dokumen: banyak diagram bernama, dibuat/dibuka/diedit/dihapus terpisah.
async function ensureNetworkDiagramsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS network_diagrams (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      data LONGTEXT NOT NULL,
      created_by INT NULL,
      updated_by INT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id),
      FOREIGN KEY (updated_by) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

module.exports = { ensureNetworkDiagramsTable };
