requireAuth();
renderNav('dashboard');

const user = getUser();
const isAdmin = user && user.role === 'admin';
const canSeeVisitChart = user && ['admin', 'verifikator'].includes(user.role);

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

const ACTION_ICON = {
  login: 'login', logout: 'logout', create_guest: 'pendaftaran', schedule_guest: 'pendaftaran',
  complete_guest_schedule: 'checkCircle', update_guest: 'pencil', verify_guest: 'checkCircle',
  check_in: 'login', check_out: 'logout', re_check_in: 'login', delete_guest: 'trash', create_user: 'people',
  update_user: 'pencil', delete_user: 'trash', create_backup: 'backup', download_backup: 'backup',
  ai_chat_query: 'ai-chat', update_ai_settings: 'ai-config', update_telegram_settings: 'telegram',
  rename_bank_data_company: 'pencil', delete_bank_data_company: 'trash', delete_guest_member: 'trash',
};

const ACTION_COLOR = {
  login: 'icon-bubble-blue', logout: 'icon-bubble-amber', create_guest: 'icon-bubble-accent', schedule_guest: 'icon-bubble-teal',
  complete_guest_schedule: 'icon-bubble-accent', update_guest: 'icon-bubble-blue',
  verify_guest: 'icon-bubble-success', check_in: 'icon-bubble-blue', check_out: 'icon-bubble-amber', re_check_in: 'icon-bubble-teal',
  delete_guest: 'icon-bubble-danger', create_user: 'icon-bubble-teal', update_user: 'icon-bubble-blue',
  rename_bank_data_company: 'icon-bubble-blue', delete_bank_data_company: 'icon-bubble-danger', delete_guest_member: 'icon-bubble-danger',
  delete_user: 'icon-bubble-danger', create_backup: 'icon-bubble-teal', download_backup: 'icon-bubble-teal',
  ai_chat_query: 'icon-bubble-accent', update_ai_settings: 'icon-bubble-accent', update_telegram_settings: 'icon-bubble-blue',
};

function statCardHtml({ bubbleClass, iconName, label, value, caption, trendIcon, trendClass }) {
  return `
    <div class="stat-card">
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

  const legend = segments
    .map((s) => {
      const pct = total > 0 ? (s.count / total) * 100 : 0;
      return `
        <div class="donut-legend-row">
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
    const { total, totalGuests, today, yesterday, active, pendingCheckout, byStatus, deviceStats, securityStats } = res.data;

    document.getElementById('statGrid').innerHTML = [
      statCardHtml({ bubbleClass: 'icon-bubble-accent', iconName: 'people', label: 'Total Tamu', value: totalGuests, caption: 'Total individu tamu tercatat' }),
      statCardHtml(registrationTrendCard(today, yesterday)),
      statCardHtml({ bubbleClass: 'icon-bubble-success', iconName: 'checkCircle', label: 'Tamu Aktif (Saat Ini)', value: active, caption: 'Sedang berada di area' }),
      statCardHtml({ bubbleClass: 'icon-bubble-amber', iconName: 'audit-log', label: 'Belum Check-out', value: pendingCheckout, caption: 'Perlu perhatian petugas' }),
    ].join('');

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
    midRow.classList.toggle('dashboard-row-2col', midCards.length === 2);
  } catch (err) {
    document.querySelector('.content').insertAdjacentHTML(
      'beforeend',
      `<div class="result-box error-box">${escapeHtml(err.message)}</div>`
    );
  }

  if (isAdmin) loadActivity();
}

load();

// ---- Grafik Kunjungan Tamu (Administrator & Verifikator) ----

const dashboardBottomRow = document.getElementById('dashboardBottomRow');
if (canSeeVisitChart) {
  document.getElementById('visitChartCard').style.display = 'block';
  if (!isAdmin) dashboardBottomRow.classList.add('dashboard-row-single');
} else {
  dashboardBottomRow.style.display = 'none';
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
