requireAuth();
renderNav('dashboard');

const user = getUser();
const isAdmin = user && user.role === 'admin';

async function load() {
  try {
    const res = await api('/reports/dashboard');
    const { total, today, active, byStatus } = res.data;

    document.getElementById('statGrid').innerHTML = `
      <div class="stat-card"><div class="stat-value">${total}</div><div class="stat-label">Total Tamu</div></div>
      <div class="stat-card"><div class="stat-value">${today}</div><div class="stat-label">Pendaftaran Hari Ini</div></div>
      <div class="stat-card"><div class="stat-value">${active}</div><div class="stat-label">Sedang Berkunjung</div></div>
    `;

    document.getElementById('statusList').innerHTML =
      byStatus
        .map(
          (s) => `
        <div class="status-row">
          <span class="badge ${statusBadgeClass(s.status)}">${escapeHtml(s.status)}</span>
          <span>${s.count}</span>
        </div>
      `
        )
        .join('') || '<p>Belum ada data.</p>';
  } catch (err) {
    document.querySelector('.content').insertAdjacentHTML(
      'beforeend',
      `<div class="result-box error-box">${escapeHtml(err.message)}</div>`
    );
  }
}

load();

// ---- Grafik Kunjungan Tamu (khusus Administrator) ----

if (isAdmin) {
  document.getElementById('visitChartCard').style.display = 'block';

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

  function renderBarChart(data) {
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
    const slotWidth = plotWidth / data.length;
    const barWidth = Math.min(24, slotWidth - 8);

    let gridlines = '';
    let yLabels = '';
    for (let i = 0; i <= gridSteps; i += 1) {
      const value = Math.round((maxValue / gridSteps) * i);
      const y = marginTop + plotHeight - (plotHeight * i) / gridSteps;
      gridlines += `<line x1="${marginLeft}" y1="${y}" x2="${width - marginRight}" y2="${y}" class="chart-gridline" />`;
      yLabels += `<text x="${marginLeft - 8}" y="${y + 3}" class="chart-axis-label" text-anchor="end">${value}</text>`;
    }

    let bars = '';
    let xLabels = '';
    data.forEach((d, i) => {
      const slotX = marginLeft + i * slotWidth;
      const barX = slotX + (slotWidth - barWidth) / 2;
      const barHeight = maxValue > 0 ? (d.count / maxValue) * plotHeight : 0;
      const barY = marginTop + plotHeight - barHeight;

      bars += `
        <g class="chart-bar-group" tabindex="0" data-index="${i}">
          <rect x="${barX}" y="${barY}" width="${barWidth}" height="${Math.max(barHeight, 1)}" rx="4" ry="4" class="chart-bar" />
          <rect x="${barX}" y="${marginTop}" width="${barWidth}" height="${plotHeight}" class="chart-bar-hit" fill="transparent" />
        </g>
      `;
      xLabels += `<text x="${slotX + slotWidth / 2}" y="${height - marginBottom + 18}" class="chart-axis-label" text-anchor="middle">${escapeHtml(d.label)}</text>`;
    });

    container.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" class="bar-chart-svg" role="img" aria-label="Grafik jumlah tamu ${PERIOD_LABEL[currentPeriod]}">
        ${gridlines}
        ${yLabels}
        ${bars}
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
      renderBarChart(lastData);
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
