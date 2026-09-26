requireAuth();
renderNav('dashboard');

const user = getUser();
const isAdmin = user && user.role === 'admin';
const canSeeVisitChart = user && ['admin', 'verifikator'].includes(user.role);
const canSeeAttendanceTrend = user && ['admin', 'verifikator', 'pimpinan'].includes(user.role);
if (!canSeeAttendanceTrend) {
  document.getElementById('personnelStatLink').style.display = 'none';
  document.getElementById('attendanceAttentionLink').style.display = 'none';
}
// Kolom kanan (urusan personel internal) & garis pemisahnya hanya tampil
// untuk role yang punya akses data absensi (Admin/Verifikator/Pimpinan) --
// Pos Depan hanya melihat kolom kiri (urusan tamu) selebar penuh.
if (canSeeAttendanceTrend) {
  document.getElementById('personnelColumn').style.display = 'flex';
  document.getElementById('dashboardDivider').style.display = 'block';
} else {
  document.getElementById('dashboardColumns').style.gridTemplateColumns = '1fr';
}

const STATUS_COLOR = {
  Draft: '#98a2b3',
  Terdaftar: '#175cd3',
  'Menunggu Verifikasi': 'var(--amber)',
  Disetujui: 'var(--success)',
  Ditolak: 'var(--danger)',
  'Sedang Berkunjung': 'var(--accent)',
  Selesai: '#98a2b3',
};

const DEVICE_COLOR = {
  dititipkan: 'var(--success)',
  dibawa_alasan_khusus: 'var(--amber)',
  tidak_membawa: '#175cd3',
};

const SECURITY_COLOR = {
  aman: 'var(--success)',
  perlu_perhatian: '#f59e0b',
  perlu_penanganan: '#dc2626',
  belum_dianalisa: '#98a2b3',
};

// Status absensi mentah dikelompokkan jadi kondisi ringkas untuk pie chart &
// Ringkasan Personel di dashboard (urutan & warna tetap, tidak diacak) --
// rincian per status (9 pilihan) tetap bisa dilihat lengkap di halaman
// Absensi Personel. "Berhalangan" dipecah jadi Sakit/Ijin-Cuti/Pendidikan
// supaya lebih rinci -- palet warnanya sudah divalidasi lewat validator
// skill dataviz (aman dari segi keterbacaan warna buta).
const ATTENDANCE_BUCKETS = [
  { key: 'hadir', label: 'Hadir', color: 'var(--success)', statuses: ['hadir'] },
  { key: 'wfh', label: 'WFH', color: '#d97706', statuses: ['wfh'] },
  { key: 'bertugas', label: 'Bertugas', color: '#175cd3', statuses: ['dinas_dalam', 'dinas_luar', 'bko'], title: 'Dinas Dalam, Dinas Luar, atau BKO' },
  { key: 'sakit', label: 'Sakit', color: '#6b21a8', statuses: ['sakit'] },
  { key: 'libur', label: 'Libur', color: '#0d9488', statuses: ['libur'] },
  { key: 'ijin_cuti', label: 'Ijin/Cuti', color: '#be185d', statuses: ['ijin', 'cuti'], title: 'Ijin atau Cuti' },
  { key: 'pendidikan', label: 'Pendidikan', color: '#0891b2', statuses: ['pendidikan'] },
  { key: 'tanpa_keterangan', label: 'Tanpa Keterangan', color: 'var(--danger)', statuses: ['tanpa_keterangan'] },
  { key: 'belum_diisi', label: 'Belum Diisi', color: '#98a2b3', statuses: [null] },
];

function attendanceBucketSegments(attendanceStats) {
  const countByStatus = {};
  attendanceStats.forEach((r) => { countByStatus[r.status === null ? 'null' : r.status] = r.count; });
  return ATTENDANCE_BUCKETS.map((b) => ({
    key: b.key,
    label: b.label,
    color: b.color,
    title: b.title,
    count: b.statuses.reduce((sum, s) => sum + (countByStatus[s === null ? 'null' : s] || 0), 0),
  }));
}

const ACTION_ICON = {
  login: 'login', logout: 'logout', account_locked: 'shield', create_guest: 'pendaftaran', schedule_guest: 'pendaftaran',
  complete_guest_schedule: 'checkCircle', update_guest: 'pencil', verify_guest: 'checkCircle',
  check_in: 'login', check_out: 'logout', re_check_in: 'login', delete_guest: 'trash', create_user: 'people',
  update_user: 'pencil', delete_user: 'trash', create_backup: 'backup', download_backup: 'backup',
  ai_chat_query: 'ai-chat', update_ai_settings: 'ai-config', update_telegram_settings: 'telegram',
  rename_bank_data_company: 'pencil', delete_bank_data_company: 'trash', delete_guest_member: 'trash',
  create_trainee: 'graduation', update_trainee: 'pencil', delete_trainee: 'trash',
  update_company_profile: 'pencil',
  create_network_diagram: 'network', delete_network_diagram: 'trash',
  create_personnel: 'people', update_personnel: 'pencil', deactivate_personnel: 'trash', delete_personnel: 'trash',
  save_attendance: 'clipboard',
};

const ACTION_COLOR = {
  login: 'icon-bubble-blue', logout: 'icon-bubble-amber', account_locked: 'icon-bubble-danger', create_guest: 'icon-bubble-accent', schedule_guest: 'icon-bubble-teal',
  complete_guest_schedule: 'icon-bubble-accent', update_guest: 'icon-bubble-blue',
  verify_guest: 'icon-bubble-success', check_in: 'icon-bubble-blue', check_out: 'icon-bubble-amber', re_check_in: 'icon-bubble-teal',
  delete_guest: 'icon-bubble-danger', create_user: 'icon-bubble-teal', update_user: 'icon-bubble-blue',
  rename_bank_data_company: 'icon-bubble-blue', delete_bank_data_company: 'icon-bubble-danger', delete_guest_member: 'icon-bubble-danger',
  update_company_profile: 'icon-bubble-blue',
  create_trainee: 'icon-bubble-teal', update_trainee: 'icon-bubble-blue', delete_trainee: 'icon-bubble-danger',
  create_network_diagram: 'icon-bubble-teal', delete_network_diagram: 'icon-bubble-danger',
  create_personnel: 'icon-bubble-teal', update_personnel: 'icon-bubble-blue', deactivate_personnel: 'icon-bubble-danger', delete_personnel: 'icon-bubble-danger',
  save_attendance: 'icon-bubble-accent',
  delete_user: 'icon-bubble-danger', create_backup: 'icon-bubble-teal', download_backup: 'icon-bubble-teal',
  ai_chat_query: 'icon-bubble-accent', update_ai_settings: 'icon-bubble-accent', update_telegram_settings: 'icon-bubble-blue',
};

// bucketKey (opsional) -- kalau diisi, kartu ini bisa diklik untuk buka
// daftar personel per kelompok status (sama seperti legenda pie chart
// "Kondisi Absensi Hari Ini"), dipakai kartu Hadir/Bertugas/Berhalangan/
// Tanpa Keterangan di "Ringkasan Personel".
function statCardHtml({ bubbleClass, iconName, label, value, caption, trendIcon, trendClass, bucketKey }) {
  return `
    <div class="stat-card${bucketKey ? ' is-clickable' : ''}"${bucketKey ? ` data-bucket-key="${bucketKey}"` : ''}>
      <div class="stat-card-head">
        <div class="icon-bubble ${bubbleClass}">${icon(iconName)}</div>
        <div class="stat-card-text">
          <div class="stat-value">${value}</div>
          <div class="stat-label">${label}</div>
        </div>
      </div>
      <div class="stat-caption${trendClass ? ' ' + trendClass : ''}">${trendIcon ? icon(trendIcon) : ''}<span>${caption}</span></div>
    </div>
  `;
}

function registrationTrendCard(today, yesterday) {
  let caption;
  let trendIcon;
  let trendClass;
  if (yesterday > 0) {
    const diffPct = Math.round(((today - yesterday) / yesterday) * 100);
    trendIcon = diffPct >= 0 ? 'trendUp' : 'trendDown';
    trendClass = diffPct >= 0 ? 'is-trend-up' : 'is-trend-down';
    caption = `${diffPct >= 0 ? '+' : ''}${diffPct}% dibanding kemarin`;
  } else if (today > 0) {
    caption = 'Tidak ada pendaftaran kemarin';
  } else {
    caption = 'Belum ada pendaftaran hari ini';
  }
  return { bubbleClass: 'icon-bubble-blue', iconName: 'clipboard', label: 'Pendaftaran Hari Ini', value: today, caption, trendIcon, trendClass };
}

function renderDonut(segments, centerValue, centerLabel) {
  const total = segments.reduce((sum, s) => sum + s.count, 0);
  const r = 52;
  const cx = 64;
  const cy = 64;
  const strokeWidth = 16;
  const circumference = 2 * Math.PI * r;
  let cumulative = 0;

  const arcs = segments
    .map((s) => {
      const pct = total > 0 ? s.count / total : 0;
      const dash = pct * circumference;
      const offset = -cumulative * circumference;
      cumulative += pct;
      return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${strokeWidth}" stroke-dasharray="${dash.toFixed(1)} ${(circumference - dash).toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}" transform="rotate(-90 ${cx} ${cy})" />`;
    })
    .join('');

  // s.key (opsional) -- kalau diisi, baris legenda ini bisa diklik untuk
  // buka daftar detail per kelompok (dipakai donut "Kondisi Absensi Hari
  // Ini"); donut lain yang tidak mengisi s.key tetap tidak bisa diklik.
  const legend = segments
    .map((s) => {
      const pct = total > 0 ? (s.count / total) * 100 : 0;
      return `
        <div class="donut-legend-row${s.key ? ' is-clickable' : ''}"${s.title ? ` title="${escapeHtml(s.title)}"` : ''}${s.key ? ` data-bucket-key="${s.key}"` : ''}>
          <span class="donut-legend-dot" style="background:${s.color}"></span>
          <span class="donut-legend-label">${escapeHtml(s.label)}</span>
          <span class="donut-legend-count">${s.count}</span>
          <span class="donut-legend-pct">${pct.toFixed(1)}%</span>
        </div>
      `;
    })
    .join('');

  return `
    <div class="donut-wrap">
      <svg class="donut-svg" width="128" height="128" viewBox="0 0 128 128">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#eef0f4" stroke-width="${strokeWidth}" />
        ${arcs}
        <text x="${cx}" y="${cy - 3}" text-anchor="middle" class="donut-center-value">${centerValue}</text>
        <text x="${cx}" y="${cy + 13}" text-anchor="middle" class="donut-center-label">${escapeHtml(centerLabel)}</text>
      </svg>
      <div class="donut-legend">${legend || '<p style="color:var(--muted);font-size:12.5px;">Belum ada data.</p>'}</div>
    </div>
  `;
}

function renderBarList(segments, totalValue, totalLabel) {
  const maxCount = Math.max(...segments.map((s) => s.count), 1);

  const rows = segments
    .map((s) => {
      const pct = maxCount > 0 ? (s.count / maxCount) * 100 : 0;
      return `
        <div class="bar-list-row">
          <div class="bar-list-track"><div class="bar-list-fill" style="width:${pct}%; background:${s.color}"></div></div>
          <div class="bar-list-meta">
            <span class="bar-list-label">${escapeHtml(s.label)}</span>
            <span class="bar-list-count">${s.count}</span>
          </div>
        </div>
      `;
    })
    .join('');

  return `
    <div class="bar-list-total">${totalValue}<span class="bar-list-total-label">${escapeHtml(totalLabel)}</span></div>
    <div class="bar-list">${rows || '<p style="color:var(--muted);font-size:12.5px;">Belum ada data.</p>'}</div>
  `;
}

async function loadActivity() {
  const activityCard = document.getElementById('activityCard');
  activityCard.style.display = 'block';
  try {
    const res = await api('/audit-logs?pageSize=5&page=1');
    const rows = res.data;
    document.getElementById('activityList').innerHTML = rows.length
      ? rows
          .map(
            (r) => `
        <div class="activity-row">
          <div class="icon-bubble icon-bubble-sm ${ACTION_COLOR[r.action] || 'icon-bubble-blue'}">${icon(ACTION_ICON[r.action] || 'activity')}</div>
          <div class="activity-text">${escapeHtml(actionLabel(r.action))} oleh ${escapeHtml(r.full_name || r.username || 'Sistem')}</div>
          <div class="activity-time">${timeAgo(r.timestamp)}</div>
        </div>
      `
          )
          .join('')
      : '<p style="color:var(--muted);font-size:12.5px;">Belum ada aktivitas.</p>';
  } catch (err) {
    document.getElementById('activityList').innerHTML = `<p style="color:var(--danger);font-size:12.5px;">${escapeHtml(err.message)}</p>`;
  }
}

async function load() {
  document.getElementById('welcomeTitle').textContent = `Selamat datang, ${user.full_name}!`;
  document.getElementById('todayLabel').textContent = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  document.getElementById('calendarIconSlot').innerHTML = icon('calendar');
  document.getElementById('dateChevronSlot').innerHTML = icon('chevronDown');

  try {
    const res = await api('/reports/dashboard');
    const { total, totalGuests, today, yesterday, active, pendingCheckout, byStatus, deviceStats, securityStats, attendanceStats, attendanceAttention } = res.data;

    document.getElementById('statGrid').innerHTML = [
      statCardHtml({ bubbleClass: 'icon-bubble-accent', iconName: 'people', label: 'Total Tamu', value: totalGuests, caption: 'Total individu tamu tercatat' }),
      statCardHtml(registrationTrendCard(today, yesterday)),
      statCardHtml({ bubbleClass: 'icon-bubble-success', iconName: 'checkCircle', label: 'Tamu Aktif (Saat Ini)', value: active, caption: 'Sedang berada di area' }),
      statCardHtml({ bubbleClass: 'icon-bubble-amber', iconName: 'audit-log', label: 'Belum Check-out', value: pendingCheckout, caption: 'Perlu perhatian petugas' }),
    ].join('');

    if (attendanceStats) {
      const segs = attendanceBucketSegments(attendanceStats);
      const byKey = {};
      ATTENDANCE_BUCKETS.forEach((b, i) => { byKey[b.key] = segs[i]; });
      const totalPersonnel = segs.reduce((sum, s) => sum + s.count, 0);
      const pct = (count) => (totalPersonnel > 0 ? `${((count / totalPersonnel) * 100).toFixed(1)}% dari total` : '-');

      document.getElementById('personnelStatGrid').innerHTML = [
        statCardHtml({ bubbleClass: 'icon-bubble-accent', iconName: 'people', label: 'Total Personel', value: totalPersonnel, caption: 'Seluruh personel aktif' }),
        statCardHtml({ bubbleClass: 'icon-bubble-success', iconName: 'checkCircle', label: 'Hadir', value: byKey.hadir.count, caption: pct(byKey.hadir.count), bucketKey: 'hadir' }),
        statCardHtml({ bubbleClass: 'icon-bubble-amber', iconName: 'backup', label: 'WFH', value: byKey.wfh.count, caption: pct(byKey.wfh.count), bucketKey: 'wfh' }),
        statCardHtml({ bubbleClass: 'icon-bubble-blue', iconName: 'login', label: 'Bertugas', value: byKey.bertugas.count, caption: pct(byKey.bertugas.count), bucketKey: 'bertugas' }),
        statCardHtml({ bubbleClass: 'icon-bubble-purple', iconName: 'activity', label: 'Sakit', value: byKey.sakit.count, caption: pct(byKey.sakit.count), bucketKey: 'sakit' }),
        statCardHtml({ bubbleClass: 'icon-bubble-teal-dark', iconName: 'sun', label: 'Libur', value: byKey.libur.count, caption: pct(byKey.libur.count), bucketKey: 'libur' }),
        statCardHtml({ bubbleClass: 'icon-bubble-pink', iconName: 'calendar', label: 'Ijin/Cuti', value: byKey.ijin_cuti.count, caption: pct(byKey.ijin_cuti.count), bucketKey: 'ijin_cuti' }),
        statCardHtml({ bubbleClass: 'icon-bubble-teal', iconName: 'graduation', label: 'Pendidikan', value: byKey.pendidikan.count, caption: pct(byKey.pendidikan.count), bucketKey: 'pendidikan' }),
        statCardHtml({ bubbleClass: 'icon-bubble-danger', iconName: 'close', label: 'Tanpa Keterangan', value: byKey.tanpa_keterangan.count, caption: pct(byKey.tanpa_keterangan.count), bucketKey: 'tanpa_keterangan' }),
      ].join('');
      document.querySelectorAll('#personnelStatGrid .stat-card.is-clickable').forEach((card) => {
        card.addEventListener('click', () => openAttendanceBucketModal(card.dataset.bucketKey));
      });
    }

    // Baris prioritas: pie chart "Kondisi Absensi Hari Ini" + "Perlu
    // Perhatian" -- ditaruh di baris tersendiri di ATAS grafik, terpisah
    // dari donut-donut lain di dashboardMidRow (di bawah grafik).
    const priorityCards = [];
    let attendanceSegments = null;
    if (attendanceStats) {
      attendanceSegments = attendanceBucketSegments(attendanceStats);
      const totalPersonnel = attendanceSegments.reduce((sum, s) => sum + s.count, 0);
      priorityCards.push(`
        <div class="form-card" id="attendanceDonutCard">
          <div class="section">
            <h2 class="section-title">Kondisi Absensi Hari Ini</h2>
            ${renderDonut(attendanceSegments, totalPersonnel, 'Personel')}
            <p class="page-description" style="margin:10px 0 0;">Klik salah satu kelompok untuk lihat daftar personelnya.</p>
            ${canSeeAttendanceTrend ? '<a class="link dashboard-card-link" href="absensi">Lihat detail &rarr;</a>' : ''}
          </div>
        </div>
      `);
    }
    if (attendanceAttention) {
      const tk = attendanceAttention.filter((p) => p.status === 'tanpa_keterangan').length;
      const belum = attendanceAttention.filter((p) => p.status === null).length;
      const hasIssue = tk > 0 || belum > 0;
      const rows = [];
      if (tk > 0) rows.push(`${icon('close', 'icon')}<span>${tk} personel tanpa keterangan</span>`);
      if (belum > 0) rows.push(`${icon('clipboard', 'icon')}<span>${belum} personel belum melaksanakan absensi</span>`);
      priorityCards.push(`
        <div class="form-card">
          <div class="alert-card ${hasIssue ? 'is-warning' : 'is-ok'}">
            <div class="alert-card-title">${icon(hasIssue ? 'bell' : 'checkCircle')}<span>Perlu Perhatian</span></div>
            <div class="alert-card-list">
              ${hasIssue ? rows.map((r) => `<div class="alert-card-row">${r}</div>`).join('') : '<div class="alert-card-row">Semua personel sudah tercatat kehadirannya hari ini.</div>'}
            </div>
            ${canSeeAttendanceTrend ? '<a class="link dashboard-card-link" href="absensi">Lihat Detail &rarr;</a>' : ''}
          </div>
        </div>
      `);
    }
    document.getElementById('attendancePriorityRow').innerHTML = priorityCards.join('');

    const midCards = [];
    midCards.push(`
      <div class="form-card">
        <div class="section">
          <h2 class="section-title">Status Pendaftaran</h2>
          ${renderDonut(
            byStatus.map((s) => ({ label: guestStatusLabel(s.status), count: s.count, color: STATUS_COLOR[s.status] || '#98a2b3' })),
            total,
            'Total'
          )}
          <a class="link dashboard-card-link" href="daftar-tamu">Lihat semua pendaftaran &rarr;</a>
        </div>
      </div>
    `);
    const canSeeBankData = ['admin', 'verifikator'].includes(user.role);
    midCards.push(`
      <div class="form-card">
        <div class="section">
          <h2 class="section-title">Statistik Perangkat Elektronik</h2>
          ${renderBarList(
            deviceStats.map((s) => ({ label: deviceStatusLabel(s.device_status), count: s.count, color: DEVICE_COLOR[s.device_status] || '#98a2b3' })),
            deviceStats.reduce((sum, s) => sum + s.count, 0),
            'Tamu'
          )}
          ${canSeeBankData ? '<a class="link dashboard-card-link" href="bank-data">Lihat detail &rarr;</a>' : ''}
        </div>
      </div>
    `);
    if (securityStats) {
      const rows = securityStats
        .map(
          (s) => `
        <div class="stat-list-row">
          <span class="donut-legend-dot" style="background:${SECURITY_COLOR[s.security_category] || '#98a2b3'}"></span>
          <span class="stat-list-label">${escapeHtml(securityCategoryLabel(s.security_category))}</span>
          <span class="stat-list-count">${s.count}</span>
        </div>
      `
        )
        .join('');
      midCards.push(`
        <div class="form-card">
          <div class="section">
            <h2 class="section-title">Kategori Keamanan Personel</h2>
            <div>${rows || '<p style="color:var(--muted);font-size:12.5px;">Belum ada data.</p>'}</div>
            <a class="link dashboard-card-link" href="bank-data">Lihat Bank Data &rarr;</a>
          </div>
        </div>
      `);
    }
    const midRow = document.getElementById('dashboardMidRow');
    midRow.innerHTML = midCards.join('');

    const attendanceDonutCard = document.getElementById('attendanceDonutCard');
    if (attendanceDonutCard) {
      attendanceDonutCard.querySelectorAll('.donut-legend-row.is-clickable').forEach((row) => {
        row.addEventListener('click', () => openAttendanceBucketModal(row.dataset.bucketKey));
      });
    }

    if (attendanceAttention) {
      document.getElementById('attendanceAttentionCard').style.display = 'block';
      const STATUS_BADGE = {
        tanpa_keterangan: '<span class="badge badge-red">Tanpa Keterangan</span>',
        null: '<span class="badge badge-amber">Belum Absensi</span>',
      };
      document.getElementById('attendanceAttentionTableBody').innerHTML = attendanceAttention.length
        ? attendanceAttention
            .map(
              (p) => `
        <tr>
          <td>${personnelNameHtml(p)}${p.position ? ` <span class="label-note">(${escapeHtml(p.position)})</span>` : ''}</td>
          <td>${STATUS_BADGE[p.status === null ? 'null' : p.status]}</td>
        </tr>
      `
            )
            .join('')
        : '<tr><td colspan="2">Semua personel sudah tercatat kehadirannya hari ini.</td></tr>';
    }
  } catch (err) {
    document.querySelector('.content').insertAdjacentHTML(
      'beforeend',
      `<div class="result-box error-box">${escapeHtml(err.message)}</div>`
    );
  }

  if (isAdmin) loadActivity();
}

// ---- Tren Kehadiran Personel (Admin, Verifikator, Pimpinan) ----
// Sumbu Y selalu 0-100% (persentase), jadi tidak perlu penyesuaian skala
// dinamis seperti grafik kunjungan tamu (yang skalanya tergantung jumlah).
const ATTENDANCE_PERIOD_LABEL = { day: 'per hari', week: 'per minggu', month: 'per bulan' };

function renderAttendanceTrendChart(data, period) {
  const container = document.getElementById('attendanceTrendChart');
  const width = 720;
  const height = 220;
  const marginLeft = 40;
  const marginBottom = 30;
  const marginTop = 12;
  const marginRight = 8;
  const plotWidth = width - marginLeft - marginRight;
  const plotHeight = height - marginTop - marginBottom;

  if (!data.some((d) => d.pct !== null)) {
    container.innerHTML = '<p class="page-description" style="margin:0;">Belum ada data absensi yang cukup untuk ditampilkan.</p>';
    return;
  }

  const stepX = data.length > 1 ? plotWidth / (data.length - 1) : 0;
  const bandWidth = data.length > 1 ? stepX : plotWidth;

  let gridlines = '';
  let yLabels = '';
  [0, 25, 50, 75, 100].forEach((mark) => {
    const y = marginTop + plotHeight - (plotHeight * mark) / 100;
    gridlines += `<line x1="${marginLeft}" y1="${y}" x2="${width - marginRight}" y2="${y}" class="chart-gridline" />`;
    yLabels += `<text x="${marginLeft - 8}" y="${y + 3}" class="chart-axis-label" text-anchor="end">${mark}%</text>`;
  });

  const points = data.map((d, i) => ({
    x: marginLeft + (data.length > 1 ? i * stepX : plotWidth / 2),
    y: d.pct === null ? null : marginTop + plotHeight - (d.pct / 100) * plotHeight,
    pct: d.pct,
    label: d.label,
    date: d.date,
  }));

  const validPoints = points.filter((p) => p.y !== null);
  const linePath = validPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaPath = validPoints.length
    ? `${linePath} L${validPoints[validPoints.length - 1].x.toFixed(1)},${(marginTop + plotHeight).toFixed(1)} L${validPoints[0].x.toFixed(1)},${(marginTop + plotHeight).toFixed(1)} Z`
    : '';

  // Setiap titik dibungkus grup dengan area klik yang lebih lebar (chart-bar-hit),
  // sama seperti grafik Kunjungan Tamu -- supaya hover/tooltip dan klik lebih
  // mudah dijangkau daripada cuma titik kecilnya saja.
  let xLabels = '';
  let markers = '';
  let valueLabels = '';
  points.forEach((p, i) => {
    xLabels += `<text x="${p.x}" y="${height - marginBottom + 18}" class="chart-axis-label" text-anchor="middle">${escapeHtml(p.label)}</text>`;
    if (p.y === null) return;
    const isLast = i === points.length - 1;
    markers += `
      <g class="chart-bar-group" tabindex="0" data-index="${i}">
        <rect x="${(p.x - bandWidth / 2).toFixed(1)}" y="${marginTop}" width="${bandWidth.toFixed(1)}" height="${plotHeight}" class="chart-bar-hit" fill="transparent" />
        <circle cx="${p.x}" cy="${p.y}" r="${isLast ? 5 : 4}" class="chart-point${isLast ? ' chart-point-last' : ''}" />
      </g>
    `;
    valueLabels += `<text x="${p.x}" y="${p.y - 12}" class="chart-axis-label" text-anchor="middle" font-weight="800">${p.pct}%</text>`;
  });

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" class="bar-chart-svg" role="img" aria-label="Grafik tren kehadiran personel ${ATTENDANCE_PERIOD_LABEL[period] || 'per minggu'}">
      ${gridlines}
      ${yLabels}
      <path d="${areaPath}" class="chart-area-fill" />
      <path d="${linePath}" class="chart-area-line" />
      ${markers}
      ${valueLabels}
      ${xLabels}
    </svg>
    <div class="chart-tooltip" id="attendanceTrendTooltip" style="display:none;"></div>
  `;

  wireAttendanceTrendTooltip(points, period);
}

// Hover: tampilkan tooltip persentase + tanggal (sama seperti grafik Kunjungan
// Tamu). Klik pada mode "Per Hari": langsung ke Absensi Personel hari itu
// (Admin/Verifikator) atau modal ringkas (Pimpinan, karena tidak punya akses
// ke halaman Absensi Personel). Mode Per Minggu/Per Bulan tidak bisa
// diklik-tembus karena satu periode mencakup lebih dari satu hari.
function wireAttendanceTrendTooltip(points, period) {
  const wrap = document.getElementById('attendanceTrendChart');
  const tooltip = document.getElementById('attendanceTrendTooltip');
  const groups = wrap.querySelectorAll('.chart-bar-group');
  const clickable = period === 'day';

  function showTooltip(group) {
    const idx = Number(group.dataset.index);
    const point = points[idx];
    if (!point || point.pct === null) return;

    tooltip.innerHTML = '';
    const valueEl = document.createElement('div');
    valueEl.className = 'chart-tooltip-value';
    valueEl.textContent = `${point.pct}% hadir`;
    const labelEl = document.createElement('div');
    labelEl.className = 'chart-tooltip-label';
    labelEl.textContent = clickable ? `${point.label} -- klik untuk lihat detail` : point.label;
    tooltip.appendChild(valueEl);
    tooltip.appendChild(labelEl);
    tooltip.style.display = 'block';

    const hitRect = group.querySelector('.chart-bar-hit').getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    tooltip.style.left = `${hitRect.left - wrapRect.left + hitRect.width / 2}px`;
    tooltip.style.top = `${hitRect.top - wrapRect.top}px`;

    group.classList.add('is-hovered');
  }

  function hideTooltip(group) {
    tooltip.style.display = 'none';
    group.classList.remove('is-hovered');
  }

  function activate(group) {
    const idx = Number(group.dataset.index);
    const point = points[idx];
    if (point && point.date) goToAttendanceDate(point.date);
  }

  groups.forEach((group) => {
    group.addEventListener('pointerenter', () => showTooltip(group));
    group.addEventListener('pointerleave', () => hideTooltip(group));
    group.addEventListener('focus', () => showTooltip(group));
    group.addEventListener('blur', () => hideTooltip(group));
    if (clickable) {
      group.addEventListener('click', () => activate(group));
      group.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        activate(group);
      });
    }
  });
}

// Pimpinan sekarang juga punya akses (read-only) ke halaman Absensi
// Personel, jadi klik-tembus dari grafik tren selalu langsung ke sana --
// bukan cuma Admin/Verifikator.
function goToAttendanceDate(dateStr) {
  window.location.href = `absensi?date=${dateStr}`;
}

// ---- Klik-tembus dari pie chart "Kondisi Absensi Hari Ini" ----
// Supaya bisa langsung lihat siapa saja di satu kelompok (mis. "Bertugas")
// tanpa harus membuka Absensi Personel dan mengurutkan satu per satu --
// juga dipakai Pimpinan yang tidak punya akses ke halaman Absensi Personel.

function todayDateString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const ATTENDANCE_STATUS_LABEL = {
  hadir: 'Hadir', wfh: 'WFH', dinas_dalam: 'Dinas Dalam', dinas_luar: 'Dinas Luar', sakit: 'Sakit', ijin: 'Ijin',
  cuti: 'Cuti', pendidikan: 'Pendidikan', bko: 'BKO', libur: 'Libur', tanpa_keterangan: 'Tanpa Keterangan',
};
const ATTENDANCE_STATUS_BADGE_CLASS = {
  hadir: 'badge-green', wfh: 'badge-teal', dinas_dalam: 'badge-blue', dinas_luar: 'badge-blue', sakit: 'badge-red', ijin: 'badge-amber',
  cuti: 'badge-amber', pendidikan: 'badge-purple', bko: 'badge-gray', libur: 'badge-pink', tanpa_keterangan: 'badge-red',
};

function attendanceStatusBadgeHtml(status) {
  if (status === null) return '<span class="badge badge-gray">Belum Diisi</span>';
  return `<span class="badge ${ATTENDANCE_STATUS_BADGE_CLASS[status] || 'badge-gray'}">${escapeHtml(ATTENDANCE_STATUS_LABEL[status] || status)}</span>`;
}

// Tanda kecil di sebelah nama untuk personel yang sudah punya indikasi hasil
// analisa intelijen (lihat "Analisa Intelijen" di Kelola Personel) -- warna &
// label sama seperti lencana Bank Data. Personel yang belum dianalisa tidak
// diberi tanda apa pun supaya tabelnya tidak penuh lencana.
function personnelNameHtml(r) {
  const mark = r.security_category
    ? ` <span class="badge ${securityCategoryBadgeClass(r.security_category)}" style="margin-left:6px;">${escapeHtml(securityCategoryLabel(r.security_category))}</span>`
    : '';
  return `${escapeHtml(r.full_name)}${mark}`;
}

// Cache sederhana per tanggal -- klik beberapa kelompok berturut-turut di
// hari yang sama cukup satu kali ambil data ke server.
let attendanceModalCache = null;

async function openAttendanceBucketModal(bucketKey) {
  const bucket = ATTENDANCE_BUCKETS.find((b) => b.key === bucketKey);
  if (!bucket) return;

  const modal = document.getElementById('attendanceBucketModal');
  const titleEl = document.getElementById('attendanceBucketModalTitle');
  const bodyEl = document.getElementById('attendanceBucketModalBody');
  titleEl.textContent = `Personel -- ${bucket.label}`;
  bodyEl.innerHTML = '<tr><td colspan="5">Memuat data...</td></tr>';
  modal.classList.add('open');

  try {
    const today = todayDateString();
    if (!attendanceModalCache || attendanceModalCache.date !== today) {
      const res = await api(`/attendance?date=${today}`);
      attendanceModalCache = { date: today, rows: res.data };
    }
    const filtered = attendanceModalCache.rows.filter((r) => bucket.statuses.includes(r.status));
    titleEl.textContent = `Personel -- ${bucket.label} (${filtered.length})`;
    bodyEl.innerHTML = filtered.length
      ? filtered
          .map(
            (r) => `
        <tr>
          <td>${personnelNameHtml(r)}</td>
          <td>${escapeHtml(r.rank_info || '-')}</td>
          <td>${escapeHtml(r.position)}</td>
          <td>${attendanceStatusBadgeHtml(r.status)}</td>
          <td>${escapeHtml(r.attendance_notes || '-')}</td>
        </tr>
      `
          )
          .join('')
      : '<tr><td colspan="5">Tidak ada personel pada kelompok ini.</td></tr>';
  } catch (err) {
    bodyEl.innerHTML = `<tr><td colspan="5" style="color:var(--danger);">${escapeHtml(err.message)}</td></tr>`;
  }
}

function closeAttendanceBucketModal() {
  document.getElementById('attendanceBucketModal').classList.remove('open');
}

document.getElementById('attendanceBucketCloseIconSlot').innerHTML = icon('close');
document.getElementById('attendanceBucketModalCloseBtn').addEventListener('click', closeAttendanceBucketModal);
document.getElementById('attendanceBucketModal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('attendanceBucketModal')) closeAttendanceBucketModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.getElementById('attendanceBucketModal').classList.contains('open')) closeAttendanceBucketModal();
});

load();

// ---- Grafik Kunjungan Tamu (Administrator & Verifikator) ----

if (canSeeVisitChart) {
  document.getElementById('visitChartCard').style.display = 'block';
}

// ---- Tren Kehadiran Personel: toggle Per Hari/Per Minggu/Per Bulan ----
// Sama seperti Grafik Kunjungan Tamu, tapi disediakan untuk Pimpinan juga
// (bukan cuma Admin/Verifikator) karena kartu ini termasuk yang bisa
// diakses lewat dashboard tanpa perlu masuk ke halaman Absensi Personel.
if (canSeeAttendanceTrend) {
  document.getElementById('attendanceTrendCard').style.display = 'block';

  const ATTENDANCE_PERIOD_COUNT = { day: 7, week: 12, month: 12 };

  async function loadAttendanceTrend(period) {
    document.querySelectorAll('.attendance-period-btn').forEach((b) => {
      b.classList.toggle('is-active', b.dataset.period === period);
    });
    document.getElementById('attendanceTrendDesc').textContent =
      `Persentase kehadiran (status Hadir atau Dinas Dalam) personel ${ATTENDANCE_PERIOD_LABEL[period]}.`;

    const container = document.getElementById('attendanceTrendChart');
    container.innerHTML = '<p class="page-description" style="margin:0;">Memuat grafik...</p>';
    try {
      const res = await api(`/reports/attendance-trend?period=${period}&count=${ATTENDANCE_PERIOD_COUNT[period]}`);
      renderAttendanceTrendChart(res.data, period);
    } catch (err) {
      container.innerHTML = `<p class="page-description" style="margin:0; color: var(--danger);">${escapeHtml(err.message)}</p>`;
    }
  }

  document.querySelectorAll('.attendance-period-btn').forEach((btn) => {
    btn.addEventListener('click', () => loadAttendanceTrend(btn.dataset.period));
  });

  loadAttendanceTrend('week');
}

if (canSeeVisitChart) {
  let currentPeriod = 'week';
  let showingTable = false;
  let lastData = [];

  const PERIOD_LABEL = { day: 'per hari', week: 'per minggu', month: 'per bulan' };
  const PERIOD_COUNT = { day: 7, week: 12, month: 12 };

  function niceMax(value) {
    if (value <= 0) return 5;
    const magnitude = 10 ** Math.floor(Math.log10(value));
    const residual = value / magnitude;
    let niceResidual;
    if (residual <= 1) niceResidual = 1;
    else if (residual <= 2) niceResidual = 2;
    else if (residual <= 5) niceResidual = 5;
    else niceResidual = 10;
    return niceResidual * magnitude;
  }

  function renderAreaChart(data) {
    const container = document.getElementById('visitChart');
    const width = 720;
    const height = 260;
    const marginLeft = 34;
    const marginBottom = 30;
    const marginTop = 12;
    const marginRight = 8;

    const plotWidth = width - marginLeft - marginRight;
    const plotHeight = height - marginTop - marginBottom;

    const maxValue = niceMax(Math.max(...data.map((d) => d.count), 1));
    const gridSteps = 4;
    const stepX = data.length > 1 ? plotWidth / (data.length - 1) : 0;
    const bandWidth = data.length > 1 ? stepX : plotWidth;

    let gridlines = '';
    let yLabels = '';
    for (let i = 0; i <= gridSteps; i += 1) {
      const value = Math.round((maxValue / gridSteps) * i);
      const y = marginTop + plotHeight - (plotHeight * i) / gridSteps;
      gridlines += `<line x1="${marginLeft}" y1="${y}" x2="${width - marginRight}" y2="${y}" class="chart-gridline" />`;
      yLabels += `<text x="${marginLeft - 8}" y="${y + 3}" class="chart-axis-label" text-anchor="end">${value}</text>`;
    }

    const points = data.map((d, i) => {
      const x = marginLeft + (data.length > 1 ? i * stepX : plotWidth / 2);
      const y = marginTop + plotHeight - (maxValue > 0 ? (d.count / maxValue) * plotHeight : 0);
      return { x, y, count: d.count, label: d.label };
    });

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const areaPath = `${linePath} L${points[points.length - 1].x.toFixed(1)},${(marginTop + plotHeight).toFixed(1)} L${points[0].x.toFixed(1)},${(marginTop + plotHeight).toFixed(1)} Z`;

    let xLabels = '';
    let markers = '';
    points.forEach((p, i) => {
      xLabels += `<text x="${p.x}" y="${height - marginBottom + 18}" class="chart-axis-label" text-anchor="middle">${escapeHtml(p.label)}</text>`;
      const isLast = i === points.length - 1;
      markers += `
        <g class="chart-bar-group" tabindex="0" data-index="${i}">
          <rect x="${(p.x - bandWidth / 2).toFixed(1)}" y="${marginTop}" width="${bandWidth.toFixed(1)}" height="${plotHeight}" class="chart-bar-hit" fill="transparent" />
          <circle cx="${p.x}" cy="${p.y}" r="${isLast ? 5 : 4}" class="chart-point${isLast ? ' chart-point-last' : ''}" />
        </g>
      `;
    });

    container.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" class="bar-chart-svg" role="img" aria-label="Grafik jumlah tamu ${PERIOD_LABEL[currentPeriod]}">
        ${gridlines}
        ${yLabels}
        <path d="${areaPath}" class="chart-area-fill" />
        <path d="${linePath}" class="chart-area-line" />
        ${markers}
        ${xLabels}
      </svg>
      <div class="chart-tooltip" id="chartTooltip" style="display:none;"></div>
    `;

    wireChartTooltip(data);
  }

  function wireChartTooltip(data) {
    const wrap = document.getElementById('visitChart');
    const tooltip = document.getElementById('chartTooltip');
    const groups = wrap.querySelectorAll('.chart-bar-group');

    function showTooltip(group) {
      const idx = Number(group.dataset.index);
      const point = data[idx];

      tooltip.innerHTML = '';
      const valueEl = document.createElement('div');
      valueEl.className = 'chart-tooltip-value';
      valueEl.textContent = `${point.count} tamu`;
      const labelEl = document.createElement('div');
      labelEl.className = 'chart-tooltip-label';
      labelEl.textContent = point.label;
      tooltip.appendChild(valueEl);
      tooltip.appendChild(labelEl);
      tooltip.style.display = 'block';

      const hitRect = group.querySelector('.chart-bar-hit').getBoundingClientRect();
      const wrapRect = wrap.getBoundingClientRect();
      tooltip.style.left = `${hitRect.left - wrapRect.left + hitRect.width / 2}px`;
      tooltip.style.top = `${hitRect.top - wrapRect.top}px`;

      group.classList.add('is-hovered');
    }

    function hideTooltip(group) {
      tooltip.style.display = 'none';
      group.classList.remove('is-hovered');
    }

    groups.forEach((group) => {
      group.addEventListener('pointerenter', () => showTooltip(group));
      group.addEventListener('pointerleave', () => hideTooltip(group));
      group.addEventListener('focus', () => showTooltip(group));
      group.addEventListener('blur', () => hideTooltip(group));
    });
  }

  function renderChartTable(data) {
    const container = document.getElementById('visitChartTable');
    const rows = data
      .map((d) => `<tr><td>${escapeHtml(d.label)}</td><td>${d.count}</td></tr>`)
      .join('');
    container.innerHTML = `
      <div class="table-wrap">
        <table>
          <thead><tr><th>Periode</th><th>Jumlah Tamu</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="2">Belum ada data.</td></tr>'}</tbody>
        </table>
      </div>
    `;
  }

  async function loadVisitChart(period) {
    currentPeriod = period;
    document.querySelectorAll('.chart-period-btn').forEach((b) => {
      b.classList.toggle('is-active', b.dataset.period === period);
    });

    const chartEl = document.getElementById('visitChart');
    chartEl.innerHTML = '<p class="page-description" style="margin:0;">Memuat grafik...</p>';

    try {
      const res = await api(`/reports/visit-stats?period=${period}&count=${PERIOD_COUNT[period]}`);
      lastData = res.data;
      renderAreaChart(lastData);
      renderChartTable(lastData);
    } catch (err) {
      chartEl.innerHTML = `<p class="page-description" style="margin:0; color: var(--danger);">${escapeHtml(err.message)}</p>`;
    }
  }

  document.querySelectorAll('.chart-period-btn').forEach((btn) => {
    btn.addEventListener('click', () => loadVisitChart(btn.dataset.period));
  });

  document.getElementById('toggleChartView').addEventListener('click', (e) => {
    showingTable = !showingTable;
    document.getElementById('visitChart').style.display = showingTable ? 'none' : 'block';
    document.getElementById('visitChartTable').style.display = showingTable ? 'block' : 'none';
    e.target.textContent = showingTable ? 'Lihat sebagai Grafik' : 'Lihat sebagai Tabel';
  });

  loadVisitChart('week');
}
