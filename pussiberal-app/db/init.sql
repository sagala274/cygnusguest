CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  role ENUM('admin','verifikator','pos_depan') NOT NULL DEFAULT 'pos_depan',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- "guests" merepresentasikan SATU PENDAFTARAN (bisa berisi 1 atau lebih tamu
-- dari perusahaan yang sama). Identitas per-orang ada di tabel guest_members.
CREATE TABLE IF NOT EXISTS guests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  registration_number VARCHAR(30) NOT NULL DEFAULT '',
  company VARCHAR(150) NOT NULL,
  purpose TEXT NOT NULL,
  status ENUM('Draft','Terdaftar','Menunggu Verifikasi','Disetujui','Ditolak','Sedang Berkunjung','Selesai') NOT NULL DEFAULT 'Terdaftar',
  created_by INT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_registration_number (registration_number),
  KEY idx_company (company),
  FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS guest_members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  guest_id INT NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  nik VARCHAR(16) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  position VARCHAR(100) NOT NULL,
  employee_id VARCHAR(50) NULL,
  device_status ENUM('tidak_membawa','dititipkan','dibawa_alasan_khusus') NOT NULL DEFAULT 'dititipkan',
  device_reason VARCHAR(500) NULL,
  affiliation VARCHAR(200) NULL,
  analysis_notes TEXT NULL,
  security_category ENUM('aman','perlu_perhatian','perlu_penanganan') NULL,
  photo MEDIUMTEXT NULL,
  ktp_photo MEDIUMTEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_full_name (full_name),
  KEY idx_nik (nik),
  FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS vehicles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  guest_id INT NOT NULL,
  vehicle_type VARCHAR(50) NULL,
  plate_number VARCHAR(20) NULL,
  FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS visits (
  id INT AUTO_INCREMENT PRIMARY KEY,
  guest_id INT NOT NULL,
  check_in_at DATETIME NULL,
  check_out_at DATETIME NULL,
  status ENUM('Belum Check-in','Sedang Berkunjung','Selesai') NOT NULL DEFAULT 'Belum Check-in',
  FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Baris tunggal (id selalu 1) menyimpan konfigurasi provider/model AI Chat.
CREATE TABLE IF NOT EXISTS ai_settings (
  id TINYINT PRIMARY KEY DEFAULT 1,
  provider VARCHAR(50) NOT NULL DEFAULT 'openrouter',
  model VARCHAR(150) NOT NULL DEFAULT 'anthropic/claude-opus-5',
  api_key_encrypted TEXT NULL,
  system_prompt TEXT NULL,
  updated_by INT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_ai_settings_singleton CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO ai_settings (id, provider, model) VALUES (1, 'openrouter', 'anthropic/claude-opus-5');

-- Baris tunggal (id selalu 1) menyimpan konfigurasi bot Telegram untuk notifikasi.
CREATE TABLE IF NOT EXISTS telegram_settings (
  id TINYINT PRIMARY KEY DEFAULT 1,
  bot_token_encrypted TEXT NULL,
  chat_id VARCHAR(50) NULL,
  notify_new_registration TINYINT(1) NOT NULL DEFAULT 1,
  notify_login TINYINT(1) NOT NULL DEFAULT 1,
  last_update_id BIGINT NOT NULL DEFAULT 0,
  detected_chat_id VARCHAR(50) NULL,
  detected_chat_name VARCHAR(200) NULL,
  updated_by INT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_telegram_settings_singleton CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO telegram_settings (id) VALUES (1);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  action VARCHAR(100) NOT NULL,
  object_type VARCHAR(50) NULL,
  object_id INT NULL,
  detail TEXT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
