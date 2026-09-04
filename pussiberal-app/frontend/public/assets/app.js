const API_BASE = '/api';

/* Ikon garis (gaya Feather/Lucide) di-inline sebagai SVG, bukan icon font/CDN,
   supaya tidak perlu melonggarkan CSP (script-src/font-src 'self'). */
const ICONS = {
  dashboard: '<polyline points="3,10 12,3 21,10"/><path d="M5,10 V20 H19 V10"/>',
  pendaftaran: '<circle cx="9" cy="7" r="3.2"/><path d="M3.5,20 a5.5,5.2 0 0 1 11,0"/><line x1="18" y1="8" x2="18" y2="14"/><line x1="15" y1="11" x2="21" y2="11"/>',
  'daftar-tamu': '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
  verifikasi: '<path d="M12,3 L20,6 V11 C20,16 16.5,19.5 12,21 C7.5,19.5 4,16 4,11 V6 Z"/><polyline points="8.5,12 11,14.5 15.5,9.5"/>',
  laporan: '<line x1="3" y1="20" x2="21" y2="20"/><line x1="6" y1="20" x2="6" y2="12"/><line x1="12" y1="20" x2="12" y2="6"/><line x1="18" y1="20" x2="18" y2="15"/>',
  'bank-data': '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4,6 V18 C4,19.7 7.6,21 12,21 C16.4,21 20,19.7 20,18 V6"/><path d="M4,12 C4,13.7 7.6,15 12,15 C16.4,15 20,13.7 20,12"/>',
  'ai-chat': '<path d="M21,11.5 C21,16.2 16.97,20 12,20 C10.5,20 9.1,19.65 7.86,19.03 L3,20 L4.3,15.9 C3.48,14.6 3,13.1 3,11.5 C3,6.8 7.03,3 12,3 C16.97,3 21,6.8 21,11.5 Z"/>',
  users: '<circle cx="12" cy="12" r="3.2"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/><line x1="4.9" y1="4.9" x2="7" y2="7"/><line x1="17" y1="17" x2="19.1" y2="19.1"/><line x1="4.9" y1="19.1" x2="7" y2="17"/><line x1="17" y1="7" x2="19.1" y2="4.9"/>',
  'audit-log': '<circle cx="12" cy="12" r="8.5"/><polyline points="12,7 12,12 16,14.5"/>',
  telegram: '<path d="M3,11 L21,4 L14,20 L11,13 L3,11 Z"/><line x1="11" y1="13" x2="21" y2="4"/>',
  backup: '<rect x="4" y="4" width="16" height="4" rx="1"/><rect x="5" y="8" width="14" height="12" rx="1"/><line x1="10" y1="13" x2="14" y2="13"/>',
  'ai-config': '<line x1="4" y1="6" x2="20" y2="6"/><circle cx="9" cy="6" r="2"/><line x1="4" y1="12" x2="20" y2="12"/><circle cx="15" cy="12" r="2"/><line x1="4" y1="18" x2="20" y2="18"/><circle cx="7" cy="18" r="2"/>',
  bell: '<path d="M6,17 V11 C6,7.5 8.5,5 12,5 C15.5,5 18,7.5 18,11 V17 L20,19 H4 L6,17 Z"/><path d="M10,21 a2,2 0 0 0 4,0"/>',
  sun: '<circle cx="12" cy="12" r="4.2"/><line x1="19" y1="12" x2="21.5" y2="12"/><line x1="17" y1="17" x2="18.8" y2="18.8"/><line x1="12" y1="19" x2="12" y2="21.5"/><line x1="7" y1="17" x2="5.2" y2="18.8"/><line x1="5" y1="12" x2="2.5" y2="12"/><line x1="7" y1="7" x2="5.2" y2="5.2"/><line x1="12" y1="5" x2="12" y2="2.5"/><line x1="17" y1="7" x2="18.8" y2="5.2"/>',
  chevronDown: '<polyline points="6,9 12,15 18,9"/>',
  chevronRight: '<polyline points="9,6 15,12 9,18"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><line x1="15.5" y1="15.5" x2="21" y2="21"/>',
  filter: '<path d="M3,4 H21 L14,12.5 V19 L10,21 V12.5 Z"/>',
  pencil: '<path d="M4,20 L4.7,16.5 L15.5,5.7 a1.8,1.8 0 0 1 2.5,0 L19.3,7 a1.8,1.8 0 0 1 0,2.5 L8.5,19.3 Z"/><line x1="14" y1="7.2" x2="17.5" y2="10.7"/>',
  power: '<line x1="12" y1="3" x2="12" y2="11"/><path d="M7,6 a8,8 0 1 0 10,0"/>',
  trash: '<line x1="4" y1="7" x2="20" y2="7"/><path d="M6,7 L7,20 a1,1 0 0 0 1,1 H16 a1,1 0 0 0 1,-1 L18,7"/><line x1="9" y1="11" x2="9" y2="16"/><line x1="15" y1="11" x2="15" y2="16"/><path d="M9,7 V4 a1,1 0 0 1 1,-1 H14 a1,1 0 0 1 1,1 V7"/>',
  close: '<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>',
  crown: '<path d="M4,17 L2,7 L8,11 L12,4 L16,11 L22,7 L20,17 Z"/><line x1="4" y1="20" x2="20" y2="20"/>',
  shield: '<path d="M12,3 L19,6 V11 C19,15.5 16,19 12,21 C8,19 5,15.5 5,11 V6 Z"/>',
  checkCircle: '<circle cx="12" cy="12" r="8.5"/><polyline points="8,12.5 11,15.5 16,9.5"/>',
  sort: '<polyline points="8,9 12,5 16,9"/><polyline points="8,15 12,19 16,15"/>',
  logout: '<path d="M9,4 H5 a1,1 0 0 0 -1,1 V19 a1,1 0 0 0 1,1 H9"/><polyline points="14,8 18,12 14,16"/><line x1="18" y1="12" x2="9" y2="12"/>',
  login: '<path d="M15,4 H19 a1,1 0 0 1 1,1 V19 a1,1 0 0 1 -1,1 H15"/><polyline points="10,8 14,12 10,16"/><line x1="14" y1="12" x2="3" y2="12"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="3" x2="8" y2="7"/><line x1="16" y1="3" x2="16" y2="7"/>',
  trendUp: '<polyline points="3,17 10,10 14,14 21,6"/><polyline points="15,6 21,6 21,12"/>',
  trendDown: '<polyline points="3,7 10,14 14,10 21,18"/><polyline points="15,18 21,18 21,12"/>',
  people: '<circle cx="8.5" cy="8" r="3"/><path d="M2.5,20 a6,5.6 0 0 1 12,0"/><circle cx="16.5" cy="9" r="2.3"/><path d="M14.8,13 a4.6,4 0 0 1 6.7,4.2"/>',
  clipboard: '<rect x="5" y="5" width="14" height="16" rx="2"/><rect x="9" y="3" width="6" height="4" rx="1"/><line x1="8" y1="11" x2="16" y2="11"/><line x1="8" y1="15" x2="16" y2="15"/>',
  activity: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8.5" stroke-dasharray="2 3"/>',
  graduation: '<polygon points="12,4 21,8.5 12,13 3,8.5"/><path d="M7,10.5 V15.5 C7,17 9.2,18.5 12,18.5 C14.8,18.5 17,17 17,15.5 V10.5"/><line x1="21" y1="8.5" x2="21" y2="14"/>',
};

function icon(name, extraClass) {
  const body = ICONS[name] || '';
  return `<svg class="icon${extraClass ? ' ' + extraClass : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

/* Sesi login sengaja disimpan di sessionStorage (bukan localStorage) supaya
   otomatis hilang saat tab/browser ditutup -- menutup celah "tutup browser
   lalu buka lagi masih tetap login" tanpa perlu memasukkan ulang kredensial.
   Baris di bawah membersihkan token lama yang mungkin masih tersisa di
   localStorage dari versi aplikasi sebelum perbaikan ini. */
localStorage.removeItem('token');
localStorage.removeItem('user');

function getToken() {
  return sessionStorage.getItem('token');
}

function getUser() {
  try {
    return JSON.parse(sessionStorage.getItem('user') || 'null');
  } catch (err) {
    return null;
  }
}

function setSession(token, user) {
  sessionStorage.setItem('token', token);
  sessionStorage.setItem('user', JSON.stringify(user));
}

function clearSession() {
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('user');
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
  }[status] || (status ? status : 'Belum dideklarasikan');
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
    logout: 'Logout',
    account_locked: 'Akun Terkunci (Percobaan Login Gagal)',
    create_guest: 'Daftarkan Tamu',
    update_guest: 'Ubah Data Tamu',
    verify_guest: 'Verifikasi Tamu',
    schedule_guest: 'Jadwalkan Tamu',
    complete_guest_schedule: 'Lengkapi Kedatangan Tamu Terjadwal',
    check_in: 'Check-in Tamu',
    check_out: 'Check-out Tamu',
    re_check_in: 'Check-in Ulang Tamu',
    rename_bank_data_company: 'Ubah Nama Perusahaan (Bank Data)',
    delete_bank_data_company: 'Hapus Perusahaan (Bank Data)',
    update_company_profile: 'Isi Profiling Perusahaan (Bank Data)',
    create_trainee: 'Tambah Personel Pembelajaran',
    update_trainee: 'Ubah Personel Pembelajaran',
    delete_trainee: 'Hapus Personel Pembelajaran',
    delete_guest: 'Hapus Tamu',
    delete_guest_member: 'Hapus Data Tamu',
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

// "Draft" (nama status di database, sudah ada sejak skema awal) dipakai
// ulang untuk merepresentasikan tamu TERJADWAL -- didaftarkan di muka
// (NIK/Nama/Jabatan/No. HP), foto & deklarasi perangkat elektronik menyusul
// saat kedatangan. Label yang ditampilkan ke pengguna sengaja "Terjadwal",
// bukan "Draft", supaya lebih jelas maksudnya.
function guestStatusLabel(status) {
  return status === 'Draft' ? 'Terjadwal' : status;
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

// Untuk kolom bertipe DATE (tanpa jam) seperti tanggal lahir/mulai/selesai --
// pakai parsing manual (bukan `new Date(value)`) supaya tidak digeser mundur
// sehari akibat "YYYY-MM-DD" ditafsirkan sebagai tengah malam UTC lalu
// dikonversi ke zona waktu lokal (WIB, UTC+7 -> tanggal berkurang saat < jam 7 pagi UTC dianggap hari sebelumnya di UI).
function formatDate(value) {
  if (!value) return '-';
  const str = String(value).slice(0, 10);
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return '-';
  const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('id-ID', { dateStyle: 'medium' });
}

/* Widget foto (kamera + unggah), dipakai di Pendaftaran Tamu dan modal edit
   Ringkasan Data Tamu (Bank Data). Butuh markup ".photo-widget" berisi
   ".photo-frame-empty", <video>, <img>, <canvas>, ".start-camera-btn",
   ".capture-btn", ".retake-btn", ".upload-btn", ".photo-file-input",
   ".photo-hint" di dalam elemen `root`. Foto selalu digambar ulang lewat
   <canvas> sebelum dikirim -- baik dari kamera maupun file yang diunggah --
   supaya hasilnya selalu JPEG bersih (lihat 09_...md bagian sanitasi upload). */
function initPhotoWidget(root, facingMode) {
  let mediaStream = null;
  let capturedPhoto = null;

  const placeholder = root.querySelector('.photo-frame-empty');
  const video = root.querySelector('video');
  const img = root.querySelector('img');
  const canvas = root.querySelector('canvas');
  const startBtn = root.querySelector('.start-camera-btn');
  const captureBtn = root.querySelector('.capture-btn');
  const retakeBtn = root.querySelector('.retake-btn');
  const uploadBtn = root.querySelector('.upload-btn');
  const fileInput = root.querySelector('.photo-file-input');
  const hint = root.querySelector('.photo-hint');

  function showError(msg) { hint.textContent = msg || ''; }

  function stopCamera() {
    if (mediaStream) {
      mediaStream.getTracks().forEach((t) => t.stop());
      mediaStream = null;
    }
  }

  function reset() {
    stopCamera();
    capturedPhoto = null;
    showError('');
    img.src = '';
    img.style.display = 'none';
    video.style.display = 'none';
    placeholder.style.display = 'flex';
    startBtn.style.display = 'inline-block';
    captureBtn.style.display = 'none';
    retakeBtn.style.display = 'none';
  }

  function showPreview(dataUrl) {
    stopCamera();
    video.style.display = 'none';
    img.src = dataUrl;
    img.style.display = 'block';
    placeholder.style.display = 'none';
    captureBtn.style.display = 'none';
    retakeBtn.style.display = 'inline-block';
    startBtn.style.display = 'none';
  }

  // Menampilkan foto yang sudah ada (mis. saat membuka modal edit) tanpa
  // menggambar ulang lewat canvas -- nilainya sudah tersimpan valid di
  // database, tidak perlu disanitasi ulang di sisi klien.
  function setValue(dataUrl) {
    if (!dataUrl) { reset(); return; }
    capturedPhoto = dataUrl;
    showPreview(dataUrl);
  }

  function applyImage(source, w, h) {
    const maxW = 640;
    const scale = Math.min(1, maxW / w);
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
    capturedPhoto = canvas.toDataURL('image/jpeg', 0.8);
    showPreview(capturedPhoto);
  }

  startBtn.addEventListener('click', async () => {
    showError('');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showError('Browser ini tidak mendukung akses kamera. Gunakan opsi unggah.');
      return;
    }
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode }, audio: false });
      video.srcObject = mediaStream;
      placeholder.style.display = 'none';
      img.style.display = 'none';
      video.style.display = 'block';
      startBtn.style.display = 'none';
      captureBtn.style.display = 'inline-block';
      retakeBtn.style.display = 'none';
    } catch (err) {
      showError('Tidak dapat mengakses kamera (' + err.message + ').');
    }
  });

  captureBtn.addEventListener('click', () => {
    applyImage(video, video.videoWidth || 640, video.videoHeight || 480);
  });

  retakeBtn.addEventListener('click', reset);
  uploadBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    showError('');
    const file = fileInput.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { showError('File harus berupa gambar.'); return; }
    if (file.size > 8 * 1024 * 1024) { showError('Ukuran file maksimal 8MB.'); return; }

    const reader = new FileReader();
    reader.onload = () => {
      const im = new Image();
      im.onload = () => applyImage(im, im.width, im.height);
      im.onerror = () => showError('Gagal membaca file gambar.');
      im.src = reader.result;
    };
    reader.readAsDataURL(file);
  });

  return { getValue: () => capturedPhoto, setValue, reset, stopCamera };
}

function timeAgo(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  const diffSec = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (diffSec < 60) return 'Baru saja';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} menit yang lalu`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} jam yang lalu`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay} hari yang lalu`;
  return formatDateTime(value);
}

function initNotifications() {
  const bellBtn = document.getElementById('notifBellBtn');
  const dropdown = document.getElementById('notifDropdown');
  const markAllBtn = document.getElementById('notifMarkAllBtn');
  if (!bellBtn || !dropdown) return;

  function closeDropdown() { dropdown.classList.remove('open'); }

  bellBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = dropdown.classList.toggle('open');
    if (isOpen) loadNotifications();
  });

  document.addEventListener('click', (e) => {
    if (!dropdown.classList.contains('open')) return;
    if (bellBtn.contains(e.target) || dropdown.contains(e.target)) return;
    closeDropdown();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDropdown();
  });

  markAllBtn.addEventListener('click', async () => {
    try {
      await api('/notifications/read-all', { method: 'POST' });
      loadNotifications();
    } catch (err) {
      // Kalau gagal, badge akan menyesuaikan lagi di polling berikutnya.
    }
  });

  loadNotifications();
  setInterval(loadNotifications, 45000);
}

async function loadNotifications() {
  const badge = document.getElementById('notifBadge');
  const list = document.getElementById('notifList');
  if (!badge || !list) return;

  try {
    const res = await api('/notifications');
    const items = res.data;

    if (res.unread_count > 0) {
      badge.textContent = res.unread_count > 9 ? '9+' : String(res.unread_count);
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }

    list.innerHTML = items.length
      ? items
          .map(
            (n) => `
        <a class="notif-item ${n.is_read ? '' : 'is-unread'}" href="${n.guest_id ? `detail-tamu?id=${n.guest_id}` : '#'}" data-id="${n.id}">
          <span class="notif-item-dot" ${n.is_read ? 'style="visibility:hidden;"' : ''}></span>
          <span class="notif-item-body">
            <span class="notif-item-message">${escapeHtml(n.message)}</span>
            <span class="notif-item-time">${timeAgo(n.created_at)}</span>
          </span>
        </a>
      `
          )
          .join('')
      : '<p class="notif-empty">Belum ada notifikasi.</p>';

    list.querySelectorAll('.notif-item').forEach((el) => {
      el.addEventListener('click', () => {
        api(`/notifications/${el.dataset.id}/read`, { method: 'POST' }).catch(() => {});
      });
    });
  } catch (err) {
    list.innerHTML = '<p class="notif-empty">Gagal memuat notifikasi.</p>';
  }
}

function renderNav(active) {
  const user = getUser();
  if (!user) return;

  const links = [
    { href: 'dashboard', label: 'Dashboard', icon: 'dashboard', roles: ['admin', 'pos_depan', 'verifikator'] },
    { href: 'pendaftaran', label: 'Pendaftaran Tamu', icon: 'pendaftaran', roles: ['admin', 'pos_depan'] },
    { href: 'daftar-tamu', label: 'Daftar Tamu', icon: 'daftar-tamu', roles: ['admin', 'pos_depan', 'verifikator'] },
    { href: 'daftar-tamu?status=Menunggu%20Verifikasi', label: 'Verifikasi Tamu', icon: 'verifikasi', roles: ['admin', 'verifikator'], matchHref: 'daftar-tamu' },
    { href: 'laporan', label: 'Laporan', icon: 'laporan', roles: ['admin', 'verifikator'] },
    { href: 'bank-data', label: 'Bank Data', icon: 'bank-data', roles: ['admin', 'verifikator'] },
    { href: 'personel-pembelajaran', label: 'Personel Pembelajaran', icon: 'graduation', roles: ['admin', 'pos_depan', 'verifikator'] },
    { href: 'ai-chat', label: 'AI Chat', icon: 'ai-chat', roles: ['admin'] },
    { href: 'users', label: 'Manajemen Pengguna', icon: 'users', roles: ['admin'] },
    { href: 'audit-log', label: 'Log Aktivitas', icon: 'audit-log', roles: ['admin'] },
    { href: 'telegram-settings', label: 'Notifikasi Telegram', icon: 'telegram', roles: ['admin'] },
    { href: 'backup', label: 'Backup Database', icon: 'backup', roles: ['admin'] },
    { href: 'ai-config', label: 'Konfigurasi AI', icon: 'ai-config', roles: ['admin'] },
  ];

  const nav = document.getElementById('mainNav');
  if (nav) {
    nav.innerHTML = links
      .filter((l) => l.roles.includes(user.role))
      .map((l) => {
        const isActive = (l.matchHref || l.href) === active;
        return `
        <a class="nav-item ${isActive ? 'active' : ''}" href="${l.href}">
          <span class="nav-icon">${icon(l.icon)}</span><span>${l.label}</span>
          ${isActive ? `<span class="nav-chevron">${icon('chevronRight')}</span>` : ''}
        </a>
      `;
      })
      .join('');
  }

  /* Lonceng notifikasi & tombol mode tampilan di topbar -- disuntik lewat JS
     (bukan ditulis ulang di tiap file HTML) supaya semua halaman otomatis
     konsisten. Lonceng sudah fungsional nyata (initNotifications()); toggle
     mode tampilan masih murni visual (belum ada sistem dark mode). */
  const topRight = document.querySelector('.top-right');
  const profileMenuEl = document.getElementById('profileMenu');
  if (topRight && profileMenuEl && !document.getElementById('topbarIcons')) {
    const wrap = document.createElement('div');
    wrap.id = 'topbarIcons';
    wrap.className = 'topbar-icons';
    wrap.innerHTML = `
      <div class="notif-menu" id="notifMenu">
        <button type="button" class="topbar-icon-btn" id="notifBellBtn" title="Notifikasi">
          ${icon('bell')}
          <span class="notif-badge" id="notifBadge" style="display:none;"></span>
        </button>
        <div class="notif-dropdown" id="notifDropdown">
          <div class="notif-dropdown-head">
            <span>Notifikasi</span>
            <button type="button" class="link" id="notifMarkAllBtn" style="font-size:11px; background:none; border:none; cursor:pointer;">Tandai semua dibaca</button>
          </div>
          <div class="notif-list" id="notifList"><p class="notif-empty">Memuat...</p></div>
        </div>
      </div>
      <button type="button" class="topbar-icon-btn" title="Mode tampilan (segera hadir)">${icon('sun')}</button>
    `;
    topRight.insertBefore(wrap, profileMenuEl);
    initNotifications();
  }

  /* Ikon bubble di sebelah judul halaman, mengikuti ikon menu aktifnya. */
  const activeLink = links.find((l) => (l.matchHref || l.href) === active);
  const titleEl = document.querySelector('.page-title');
  if (titleEl && activeLink && !titleEl.querySelector('.page-title-icon')) {
    titleEl.insertAdjacentHTML('afterbegin', `<span class="page-title-icon">${icon(activeLink.icon)}</span>`);
  }

  const nameEl = document.getElementById('profileName');
  const roleEl = document.getElementById('profileRole');
  if (nameEl) nameEl.textContent = user.full_name;
  if (roleEl) roleEl.textContent = roleLabel(user.role);

  const avatarEl = document.querySelector('.avatar');
  if (avatarEl) {
    if (user.avatar_url) {
      avatarEl.style.backgroundImage = `url('${user.avatar_url}')`;
      avatarEl.style.backgroundSize = 'cover';
      avatarEl.style.backgroundPosition = 'center';
    } else {
      avatarEl.textContent = (user.full_name || user.username || '?').trim().charAt(0).toUpperCase();
    }
  }

  const profileTriggerEl = document.getElementById('profileTrigger');
  if (profileTriggerEl && !profileTriggerEl.querySelector('.profile-chevron')) {
    profileTriggerEl.insertAdjacentHTML('beforeend', `<span class="profile-chevron">${icon('chevronDown')}</span>`);
  }

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    const logoutIcon = logoutBtn.querySelector('.nav-icon');
    if (logoutIcon) logoutIcon.innerHTML = icon('logout');
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        await api('/auth/logout', { method: 'POST' });
      } catch (err) {
        // Tetap lanjutkan logout di sisi klien walau pencatatan di server
        // gagal (mis. token sudah kedaluwarsa atau jaringan bermasalah).
      }
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
