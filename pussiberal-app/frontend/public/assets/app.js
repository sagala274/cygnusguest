const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('token');
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch (err) {
    return null;
  }
}

function setSession(token, user) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

function requireAuth() {
  if (!getToken()) {
    window.location.href = 'login';
  }
}

function requireRole(...roles) {
  const user = getUser();
  if (!user || !roles.includes(user.role)) {
    window.location.href = 'dashboard';
  }
}

async function api(path, options = {}) {
  const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    clearSession();
    window.location.href = 'login';
    throw new Error('Unauthorized');
  }

  const isJson = (res.headers.get('content-type') || '').includes('application/json');
  const body = isJson ? await res.json() : null;

  if (!res.ok) {
    const message = (body && (body.error || body.message)) || `Request gagal (${res.status})`;
    const err = new Error(message);
    err.fields = body && body.fields;
    err.status = res.status;
    throw err;
  }

  return body;
}

async function downloadFile(path, filename) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (res.status === 401) {
    clearSession();
    window.location.href = 'login';
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    let message = `Gagal mengunduh (${res.status})`;
    try {
      const body = await res.json();
      message = body.error || message;
    } catch (err) {
      /* response bukan JSON, gunakan pesan default */
    }
    throw new Error(message);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function roleLabel(role) {
  return { admin: 'Administrator', verifikator: 'Verifikator', pos_depan: 'Petugas Pos Depan' }[role] || role;
}

function deviceStatusLabel(status) {
  return {
    tidak_membawa: 'Tidak membawa perangkat elektronik',
    dititipkan: 'Dititipkan di Pos Penjagaan',
    dibawa_alasan_khusus: 'Tetap membawa HP/perangkat elektronik lainnya (alasan khusus)',
  }[status] || status;
}

function securityCategoryLabel(category) {
  return {
    aman: 'Aman',
    perlu_perhatian: 'Perlu Perhatian',
    perlu_penanganan: 'Perlu Penanganan',
  }[category] || 'Belum Dianalisa';
}

function securityCategoryBadgeClass(category) {
  return {
    aman: 'badge-green',
    perlu_perhatian: 'badge-amber',
    perlu_penanganan: 'badge-red',
  }[category] || 'badge-gray';
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

function targetOfficialLabel(value) {
  return TARGET_OFFICIAL_LABELS[value] || value;
}

function targetOfficialsLabel(values, otherDetail) {
  if (!values || !values.length) return '-';
  return values
    .map((v) => (v === 'lainnya' && otherDetail ? `Lainnya (${otherDetail})` : targetOfficialLabel(v)))
    .join(', ');
}

function purposeCategoryLabel(category) {
  return {
    audiensi: 'Audiensi',
    rapat_koordinasi: 'Rapat/Koordinasi',
    diskusi_teknis: 'Diskusi Teknis',
    maintenance: 'Maintenance',
    pengiriman: 'Pengiriman',
    lainnya: 'Lainnya',
  }[category] || '-';
}

function actionLabel(action) {
  const map = {
    login: 'Login',
    create_guest: 'Daftarkan Tamu',
    update_guest: 'Ubah Data Tamu',
    verify_guest: 'Verifikasi Tamu',
    check_in: 'Check-in Tamu',
    check_out: 'Check-out Tamu',
    delete_guest: 'Hapus Tamu',
    create_user: 'Buat Pengguna',
    update_user: 'Ubah Pengguna',
    delete_user: 'Hapus Pengguna',
    create_backup: 'Buat Backup Database',
    download_backup: 'Unduh Backup Database',
    ai_chat_query: 'Tanya AI Chat',
    update_ai_settings: 'Ubah Konfigurasi AI',
    update_telegram_settings: 'Ubah Konfigurasi Telegram',
  };
  return map[action] || action;
}

function formatAuditDetail(raw) {
  if (!raw) return '-';
  try {
    const obj = JSON.parse(raw);
    const parts = Object.entries(obj)
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`);
    return parts.length ? parts.join(', ') : '-';
  } catch (err) {
    return raw;
  }
}

function statusBadgeClass(status) {
  const map = {
    Draft: 'badge-gray',
    Terdaftar: 'badge-blue',
    'Menunggu Verifikasi': 'badge-amber',
    Disetujui: 'badge-green',
    Ditolak: 'badge-red',
    'Sedang Berkunjung': 'badge-purple',
    Selesai: 'badge-gray',
  };
  return map[status] || 'badge-gray';
}

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDateTime(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

function renderNav(active) {
  const user = getUser();
  if (!user) return;

  const links = [
    { href: 'dashboard', label: 'Dashboard', icon: '◆', roles: ['admin', 'pos_depan', 'verifikator'] },
    { href: 'pendaftaran', label: 'Pendaftaran Tamu', icon: '✎', roles: ['admin', 'pos_depan'] },
    { href: 'daftar-tamu', label: 'Daftar Tamu', icon: '☰', roles: ['admin', 'pos_depan', 'verifikator'] },
    { href: 'daftar-tamu?status=Menunggu%20Verifikasi', label: 'Verifikasi Tamu', icon: '✔', roles: ['admin', 'verifikator'], matchHref: 'daftar-tamu' },
    { href: 'laporan', label: 'Laporan', icon: '▤', roles: ['admin', 'verifikator'] },
    { href: 'bank-data', label: 'Bank Data', icon: '🗂', roles: ['admin', 'verifikator'] },
    { href: 'ai-chat', label: 'AI Chat', icon: '✦', roles: ['admin'] },
    { href: 'users', label: 'Manajemen Pengguna', icon: '⚙', roles: ['admin'] },
    { href: 'audit-log', label: 'Log Aktivitas', icon: '🕐', roles: ['admin'] },
    { href: 'telegram-settings', label: 'Notifikasi Telegram', icon: '📨', roles: ['admin'] },
    { href: 'backup', label: 'Backup Database', icon: '💾', roles: ['admin'] },
    { href: 'ai-config', label: 'Konfigurasi AI', icon: '🛠', roles: ['admin'] },
  ];

  const nav = document.getElementById('mainNav');
  if (nav) {
    nav.innerHTML = links
      .filter((l) => l.roles.includes(user.role))
      .map((l) => {
        const isActive = (l.matchHref || l.href) === active;
        return `
        <a class="nav-item ${isActive ? 'active' : ''}" href="${l.href}">
          <span class="nav-icon">${l.icon}</span><span>${l.label}</span>
          ${isActive ? '<span class="nav-dot"></span>' : ''}
        </a>
      `;
      })
      .join('');
  }

  const nameEl = document.getElementById('profileName');
  const roleEl = document.getElementById('profileRole');
  if (nameEl) nameEl.textContent = user.full_name;
  if (roleEl) roleEl.textContent = roleLabel(user.role);

  const avatarEl = document.querySelector('.avatar');
  if (avatarEl && user.avatar_url) {
    avatarEl.style.backgroundImage = `url('${user.avatar_url}')`;
    avatarEl.style.backgroundSize = 'cover';
    avatarEl.style.backgroundPosition = 'center';
  }

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      clearSession();
      window.location.href = 'login';
    });
  }

  const profileTrigger = document.getElementById('profileTrigger');
  const profileDropdown = document.getElementById('profileDropdown');
  if (profileTrigger && profileDropdown) {
    profileTrigger.setAttribute('aria-haspopup', 'true');
    profileTrigger.setAttribute('aria-expanded', 'false');

    const closeDropdown = () => {
      profileDropdown.classList.remove('open');
      profileTrigger.setAttribute('aria-expanded', 'false');
    };

    profileTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = profileDropdown.classList.toggle('open');
      profileTrigger.setAttribute('aria-expanded', String(isOpen));
    });

    document.addEventListener('click', (e) => {
      if (!profileDropdown.classList.contains('open')) return;
      if (profileTrigger.contains(e.target) || profileDropdown.contains(e.target)) return;
      closeDropdown();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeDropdown();
    });
  }
}
