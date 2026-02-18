// ── State ──
let challengeData = null;
let currentTab = 'overview';
let selectedMemberId = null;
let currentPeriod = 'total';
let periodOffset = 0;
let charts = {};

// ── Color palette ──
const COLORS = [
  '#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4',
  '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#64748b',
  '#a855f7', '#84cc16', '#e11d48', '#0ea5e9', '#fbbf24',
  '#fb923c', '#2dd4bf', '#a78bfa'
];

const DAY_CAP = 2;
const WEEK_CAP = 10;

// ── Chart.js defaults ──
Chart.defaults.color = '#8b8fa3';
Chart.defaults.borderColor = '#2a2e3a';
Chart.defaults.font.family = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
  setupUpload();
  setupTabs();
  setupPeriodFilters();
  tryLoadDefaultData();
});

function tryLoadDefaultData() {
  fetch('challenge-data.json')
    .then(r => { if (r.ok) return r.json(); throw new Error(); })
    .then(data => loadData(data))
    .catch(() => {});
}

// ── File Upload ──
function setupUpload() {
  ['json-upload', 'json-upload-empty'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', handleUpload);
  });
}

function handleUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      loadData(JSON.parse(ev.target.result));
    } catch (err) {
      alert('Invalid JSON file');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

// ── Load Data ──
function loadData(data) {
  challengeData = data;
  document.getElementById('no-data-screen').classList.add('hidden');
  document.getElementById('main-content').classList.remove('hidden');
  document.getElementById('challenge-name').textContent = data.name || 'GymRats Challenge Report';
  document.getElementById('challenge-desc').textContent = (data.description || '').replace(/\n/g, ' · ');
  buildMemberTabs();
  currentTab = 'overview';
  selectedMemberId = null;
  periodOffset = 0;
  renderAll();
}

// ── Members ──
function getMembersMap() {
  const map = {};
  (challengeData.members || []).forEach(m => { map[m.id] = m; });
  return map;
}

function memberName(id, members) {
  const m = members[parseInt(id)];
  return m ? m.full_name.split(' ').slice(0, 2).join(' ') : `User ${id}`;
}

// ── Tabs ──
function setupTabs() {
  document.querySelector('.tab[data-tab="overview"]').addEventListener('click', () => switchTab('overview'));
}

function buildMemberTabs() {
  const container = document.getElementById('member-tabs');
  container.innerHTML = '';
  (challengeData.members || []).sort((a, b) => a.full_name.localeCompare(b.full_name)).forEach(m => {
    const btn = document.createElement('button');
    btn.className = 'tab';
    btn.dataset.memberId = m.id;
    btn.textContent = m.full_name.split(' ')[0];
    btn.addEventListener('click', () => switchTab('personal', m.id));
    container.appendChild(btn);
  });
}

function switchTab(tab, memberId = null) {
  currentTab = tab;
  selectedMemberId = memberId;
  periodOffset = 0;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  if (tab === 'overview') {
    document.querySelector('.tab[data-tab="overview"]').classList.add('active');
  } else {
    document.querySelectorAll('.tab[data-member-id]').forEach(t => {
      if (parseInt(t.dataset.memberId) === memberId) t.classList.add('active');
    });
  }
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById(tab === 'overview' ? 'tab-overview' : 'tab-personal').classList.add('active');
  renderAll();
}

// ── Period Filters ──
function setupPeriodFilters() {
  document.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentPeriod = btn.dataset.period;
      periodOffset = 0;
      document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderAll();
    });
  });
  document.getElementById('prev-period').addEventListener('click', () => { periodOffset--; renderAll(); });
  document.getElementById('next-period').addEventListener('click', () => { if (periodOffset < 0) { periodOffset++; renderAll(); } });
}

// ── Date Range ──
function getDateRange() {
  const now = new Date();
  if (currentPeriod === 'total') return { start: null, end: null, label: 'All Time' };
  let start, end, label;
  if (currentPeriod === 'week') {
    const ref = new Date(now); ref.setDate(ref.getDate() + periodOffset * 7);
    const day = ref.getDay();
    start = new Date(ref); start.setDate(ref.getDate() - (day === 0 ? 6 : day - 1)); start.setHours(0, 0, 0, 0);
    end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23, 59, 59, 999);
    label = `${fmtDate(start)} – ${fmtDate(end)}`;
  } else if (currentPeriod === 'month') {
    const ref = new Date(now.getFullYear(), now.getMonth() + periodOffset, 1);
    start = new Date(ref.getFullYear(), ref.getMonth(), 1);
    end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59, 999);
    label = start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  } else if (currentPeriod === 'year') {
    const year = now.getFullYear() + periodOffset;
    start = new Date(year, 0, 1); end = new Date(year, 11, 31, 23, 59, 59, 999);
    label = String(year);
  }
  return { start, end, label };
}

function fmtDate(d) { return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }

function filterCheckIns(checkIns, range, memberId = null) {
  return checkIns.filter(ci => {
    if (memberId && ci.account_id !== memberId) return false;
    if (range.start) {
      const d = new Date(ci.occurred_at || ci.created_at);
      if (d < range.start || d > range.end) return false;
    }
    return true;
  });
}

// ═══════════════════════════════════════════════════════════
// ── CAPPING LOGIC ──
// Cap: max 2 check-ins per day, max 10 per week (Mon–Sun)
// ═══════════════════════════════════════════════════════════

function getISOWeekKey(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return monday.toISOString().slice(0, 10);
}

// Returns { memberId: { weekKey: cappedWeeklyCount } }
function computeCappedScores(checkIns) {
  // Step 1: raw daily counts per member
  const daily = {}; // { `${memberId}|${date}`: rawCount }
  checkIns.forEach(ci => {
    const date = (ci.occurred_at || ci.created_at || '').slice(0, 10);
    if (!date) return;
    const key = `${ci.account_id}|${date}`;
    daily[key] = (daily[key] || 0) + 1;
  });

  // Step 2: cap daily at DAY_CAP, group by member+week
  const weekly = {}; // { `${memberId}|${weekKey}`: sum of dailyCapped }
  for (const [key, rawCount] of Object.entries(daily)) {
    const [memberId, date] = key.split('|');
    const weekKey = getISOWeekKey(date);
    const wk = `${memberId}|${weekKey}`;
    weekly[wk] = (weekly[wk] || 0) + Math.min(rawCount, DAY_CAP);
  }

  // Step 3: cap weekly at WEEK_CAP, structure as { memberId: { weekKey: capped } }
  const result = {};
  for (const [key, sum] of Object.entries(weekly)) {
    const [memberId, weekKey] = key.split('|');
    if (!result[memberId]) result[memberId] = {};
    result[memberId][weekKey] = Math.min(sum, WEEK_CAP);
  }
  return result;
}

// Returns { date: cappedCount } for a single member (daily capped at 2)
function computeDailyCapped(checkIns, memberId) {
  const raw = {};
  checkIns.forEach(ci => {
    if (ci.account_id !== memberId) return;
    const date = (ci.occurred_at || ci.created_at || '').slice(0, 10);
    if (date) raw[date] = (raw[date] || 0) + 1;
  });
  const capped = {};
  for (const [date, count] of Object.entries(raw)) {
    capped[date] = Math.min(count, DAY_CAP);
  }
  return capped;
}

function getTotalCapped(scores, memberId) {
  const weeks = scores[memberId] || {};
  return Object.values(weeks).reduce((s, v) => s + v, 0);
}

// ═══════════════════════════════════════════════════════════
// ── RENDER ──
// ═══════════════════════════════════════════════════════════

function renderAll() {
  const range = getDateRange();
  const nav = document.getElementById('period-nav');
  if (currentPeriod === 'total') {
    nav.classList.add('hidden');
  } else {
    nav.classList.remove('hidden');
    document.getElementById('period-label').textContent = range.label;
  }
  if (currentTab === 'overview') renderOverview(range);
  else renderPersonal(range);
}

// ── Overview ──
function renderOverview(range) {
  const checkIns = filterCheckIns(challengeData.check_ins || [], range);
  const members = getMembersMap();
  const scores = computeCappedScores(checkIns);

  renderOverviewStats(checkIns, members, scores);
  renderRaceChart(checkIns, members, scores);
  renderRanking(members, scores);
  renderWeeklyOverview(members, scores);
  renderWeekdayOverview(checkIns, members);
}

function renderOverviewStats(checkIns, members, scores) {
  const rawTotal = checkIns.length;
  let cappedTotal = 0;
  const memberTotals = {};
  for (const [mid, weeks] of Object.entries(scores)) {
    const t = Object.values(weeks).reduce((s, v) => s + v, 0);
    memberTotals[mid] = t;
    cappedTotal += t;
  }
  const activeCount = Object.keys(scores).length;
  const avg = activeCount ? (cappedTotal / activeCount).toFixed(1) : 0;

  // Find leader
  let leader = '-';
  let leaderScore = 0;
  for (const [mid, t] of Object.entries(memberTotals)) {
    if (t > leaderScore) { leaderScore = t; leader = memberName(mid, members); }
  }

  document.getElementById('overview-stats').innerHTML = `
    <div class="stat-card"><div class="label">Capped Check-ins</div><div class="value">${cappedTotal}</div><div class="sub">${rawTotal} raw</div></div>
    <div class="stat-card"><div class="label">Active Members</div><div class="value">${activeCount}</div></div>
    <div class="stat-card"><div class="label">Avg per Member</div><div class="value">${avg}</div><div class="sub">capped check-ins</div></div>
    <div class="stat-card"><div class="label">Leader</div><div class="value" style="font-size:1.1rem">${leader}</div><div class="sub">${leaderScore} check-ins</div></div>
  `;
}

// ── F1-style Race Chart ──
function renderRaceChart(checkIns, members, scores) {
  // Collect all week keys across all members, sorted
  const allWeeks = new Set();
  for (const weeks of Object.values(scores)) {
    for (const wk of Object.keys(weeks)) allWeeks.add(wk);
  }
  const sortedWeeks = [...allWeeks].sort();
  if (sortedWeeks.length === 0) { createChart('chart-race', 'line', { datasets: [] }); return; }

  // Build week labels like "W1", "W2", ...
  const weekLabels = sortedWeeks.map((_, i) => `W${i + 1}`);

  // Sort members by total score descending for consistent legend ordering
  const memberIds = Object.keys(scores).sort((a, b) => getTotalCapped(scores, b) - getTotalCapped(scores, a));

  const datasets = memberIds.map((mid, idx) => {
    let cum = 0;
    const data = sortedWeeks.map(wk => {
      cum += (scores[mid] || {})[wk] || 0;
      return cum;
    });
    return {
      label: memberName(mid, members),
      data,
      borderColor: COLORS[idx % COLORS.length],
      backgroundColor: COLORS[idx % COLORS.length],
      borderWidth: 2.5,
      pointRadius: 3,
      pointHoverRadius: 6,
      tension: 0.15,
      fill: false
    };
  });

  createChart('chart-race', 'line', { labels: weekLabels, datasets }, {
    scales: {
      x: { title: { display: true, text: 'Week' } },
      y: { beginAtZero: true, title: { display: true, text: 'Cumulative Check-ins' }, ticks: { precision: 0 } }
    },
    plugins: {
      legend: { display: true, position: 'bottom', labels: { boxWidth: 12, padding: 10, font: { size: 11 } } },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          title: (items) => {
            const idx = items[0].dataIndex;
            const wkStart = sortedWeeks[idx];
            return `Week ${idx + 1} (${wkStart})`;
          }
        }
      }
    },
    interaction: { mode: 'index', intersect: false },
    hover: { mode: 'index', intersect: false }
  });
}

// ── Ranking Bar ──
function renderRanking(members, scores) {
  const sorted = Object.keys(scores)
    .map(mid => [mid, getTotalCapped(scores, mid)])
    .sort((a, b) => b[1] - a[1]);

  createChart('chart-ranking', 'bar', {
    labels: sorted.map(e => memberName(e[0], members)),
    datasets: [{
      label: 'Check-ins',
      data: sorted.map(e => e[1]),
      backgroundColor: sorted.map((_, i) => COLORS[i % COLORS.length]),
      borderRadius: 6,
      barPercentage: 0.7
    }]
  }, {
    indexAxis: 'y',
    scales: { x: { beginAtZero: true, ticks: { precision: 0 } } },
    plugins: { legend: { display: false } }
  });
}

// ── Weekly Overview (stacked bar per member per week) ──
function renderWeeklyOverview(members, scores) {
  const allWeeks = new Set();
  for (const weeks of Object.values(scores)) {
    for (const wk of Object.keys(weeks)) allWeeks.add(wk);
  }
  const sortedWeeks = [...allWeeks].sort();
  const weekLabels = sortedWeeks.map((_, i) => `W${i + 1}`);
  const memberIds = Object.keys(scores).sort((a, b) => getTotalCapped(scores, b) - getTotalCapped(scores, a));

  const datasets = memberIds.map((mid, idx) => ({
    label: memberName(mid, members),
    data: sortedWeeks.map(wk => (scores[mid] || {})[wk] || 0),
    backgroundColor: COLORS[idx % COLORS.length],
    borderRadius: 2,
    barPercentage: 0.85
  }));

  createChart('chart-weekly-overview', 'bar', { labels: weekLabels, datasets }, {
    scales: {
      x: { stacked: true },
      y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } }
    },
    plugins: { legend: { display: false } }
  });
}

// ── Weekday Distribution (overview) ──
function renderWeekdayOverview(checkIns, members) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const memberIds = [...new Set(checkIns.map(ci => ci.account_id))];
  const data = {};
  checkIns.forEach(ci => {
    const d = new Date(ci.occurred_at || ci.created_at);
    let day = d.getDay(); day = day === 0 ? 6 : day - 1;
    const key = `${ci.account_id}-${day}`;
    data[key] = (data[key] || 0) + 1;
  });
  const datasets = memberIds.map((id, idx) => ({
    label: memberName(id, members),
    data: days.map((_, di) => data[`${id}-${di}`] || 0),
    backgroundColor: COLORS[idx % COLORS.length],
    borderRadius: 3,
    barPercentage: 0.8
  }));
  createChart('chart-weekday-overview', 'bar', { labels: days, datasets }, {
    scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } } },
    plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 8, font: { size: 11 } } } }
  });
}

// ═══════════════════════════════════════════════════════════
// ── PERSONAL TAB ──
// ═══════════════════════════════════════════════════════════

function renderPersonal(range) {
  const member = (challengeData.members || []).find(m => m.id === selectedMemberId);
  if (!member) return;
  const checkIns = filterCheckIns(challengeData.check_ins || [], range, selectedMemberId);
  const scores = computeCappedScores(checkIns);
  const dailyCapped = computeDailyCapped(challengeData.check_ins || [], selectedMemberId);

  renderPersonalHeader(member);
  renderPersonalStats(checkIns, scores);
  renderHeatmap(dailyCapped, range);
  renderPersonalCumulative(checkIns, scores);
  renderPersonalWeekly(scores);
  renderPersonalWeekday(checkIns);
}

function renderPersonalHeader(member) {
  const container = document.getElementById('personal-header');
  const initials = member.full_name.split(' ').map(n => n[0]).join('').slice(0, 2);
  const avatar = member.profile_picture_url
    ? `<img src="${member.profile_picture_url}" alt="${member.full_name}" onerror="this.outerHTML='<div class=\\'placeholder-avatar\\'>${initials}</div>'">`
    : `<div class="placeholder-avatar">${initials}</div>`;
  const role = member.role === 'owner' ? ' · Owner' : '';
  const joined = new Date(member.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  container.innerHTML = `${avatar}<div class="info"><h2>${member.full_name}</h2><p>Joined ${joined}${role}</p></div>`;
}

function renderPersonalStats(checkIns, scores) {
  const mid = String(selectedMemberId);
  const cappedTotal = getTotalCapped(scores, mid);
  const rawTotal = checkIns.length;
  const memberWeeks = scores[mid] || {};
  const weekValues = Object.values(memberWeeks);
  const bestWeek = weekValues.length ? Math.max(...weekValues) : 0;
  const activeWeeks = weekValues.filter(v => v > 0).length;
  const avgWeek = activeWeeks ? (cappedTotal / activeWeeks).toFixed(1) : 0;

  // Streak (consecutive days with at least 1 check-in)
  const dates = [...new Set(checkIns.map(ci => (ci.occurred_at || ci.created_at || '').slice(0, 10)))].sort().reverse();
  let streak = 0;
  if (dates.length > 0) {
    let check = new Date(dates[0]);
    for (const d of dates) {
      if (d === check.toISOString().slice(0, 10)) { streak++; check.setDate(check.getDate() - 1); }
      else break;
    }
  }

  document.getElementById('personal-stats').innerHTML = `
    <div class="stat-card"><div class="label">Capped Check-ins</div><div class="value">${cappedTotal}</div><div class="sub">${rawTotal} raw</div></div>
    <div class="stat-card"><div class="label">Best Week</div><div class="value">${bestWeek}</div><div class="sub">of ${WEEK_CAP} max</div></div>
    <div class="stat-card"><div class="label">Avg per Week</div><div class="value">${avgWeek}</div></div>
    <div class="stat-card"><div class="label">Active Weeks</div><div class="value">${activeWeeks}</div></div>
    <div class="stat-card"><div class="label">Current Streak</div><div class="value">${streak}</div><div class="sub">days</div></div>
  `;
}

// ── GitHub-style Contribution Heatmap ──
function renderHeatmap(dailyCapped, range) {
  const container = document.getElementById('heatmap-container');
  container.innerHTML = '';

  // Determine date range for heatmap
  const dates = Object.keys(dailyCapped).sort();
  if (dates.length === 0) {
    container.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.85rem;">No check-ins in this period</p>';
    return;
  }

  let startDate, endDate;
  if (range.start) {
    startDate = new Date(range.start);
    endDate = new Date(range.end);
  } else {
    startDate = new Date(dates[0]);
    endDate = new Date();
  }

  // Align startDate to Monday
  const startDay = startDate.getDay();
  startDate.setDate(startDate.getDate() - (startDay === 0 ? 6 : startDay - 1));
  startDate.setHours(0, 0, 0, 0);

  // Align endDate to Sunday
  const endDay = endDate.getDay();
  if (endDay !== 0) endDate.setDate(endDate.getDate() + (7 - endDay));
  endDate.setHours(23, 59, 59, 999);

  // Build weeks array
  const weeks = [];
  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      week.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }

  // Month labels
  const monthsDiv = document.createElement('div');
  monthsDiv.className = 'heatmap-months';
  let lastMonth = -1;
  const cellWidth = 16; // 13px + 3px gap
  weeks.forEach((week) => {
    const m = week[0].getMonth();
    const span = document.createElement('span');
    span.className = 'heatmap-month-label';
    span.style.width = cellWidth + 'px';
    if (m !== lastMonth) {
      span.textContent = week[0].toLocaleDateString('en-US', { month: 'short' });
      lastMonth = m;
    }
    monthsDiv.appendChild(span);
  });
  container.appendChild(monthsDiv);

  // Grid: 7 rows (Mon=0 to Sun=6), columns = weeks
  const dayLabels = ['Mon', '', 'Wed', '', 'Fri', '', 'Sun'];
  const grid = document.createElement('div');
  grid.style.display = 'flex';

  // Day labels column
  const labelsCol = document.createElement('div');
  labelsCol.style.display = 'flex';
  labelsCol.style.flexDirection = 'column';
  labelsCol.style.gap = '3px';
  labelsCol.style.marginRight = '3px';
  dayLabels.forEach(l => {
    const lbl = document.createElement('div');
    lbl.className = 'heatmap-day-label';
    lbl.textContent = l;
    lbl.style.height = '13px';
    lbl.style.lineHeight = '13px';
    labelsCol.appendChild(lbl);
  });
  grid.appendChild(labelsCol);

  // Week columns
  const heatmap = document.createElement('div');
  heatmap.className = 'heatmap';
  weeks.forEach(week => {
    const col = document.createElement('div');
    col.className = 'heatmap-column';
    week.forEach(date => {
      const dateStr = date.toISOString().slice(0, 10);
      const count = dailyCapped[dateStr] || 0;
      const level = count === 0 ? 0 : count === 1 ? 2 : 4; // 0, 1 check-in, 2 check-ins
      const cell = document.createElement('div');
      cell.className = `heatmap-cell heatmap-level-${level}`;
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
      cell.dataset.tooltip = `${count} check-in${count !== 1 ? 's' : ''} on ${dayName}`;
      col.appendChild(cell);
    });
    heatmap.appendChild(col);
  });
  grid.appendChild(heatmap);
  container.appendChild(grid);

  // Legend
  const legend = document.createElement('div');
  legend.className = 'heatmap-legend';
  legend.innerHTML = `
    <span>Less</span>
    <div class="heatmap-cell heatmap-level-0"></div>
    <div class="heatmap-cell heatmap-level-2"></div>
    <div class="heatmap-cell heatmap-level-4"></div>
    <span>More</span>
  `;
  container.appendChild(legend);
}

// ── Personal Cumulative ──
function renderPersonalCumulative(checkIns, scores) {
  const mid = String(selectedMemberId);
  const memberWeeks = scores[mid] || {};
  const sortedWeeks = Object.keys(memberWeeks).sort();

  let cum = 0;
  const data = sortedWeeks.map((wk, i) => {
    cum += memberWeeks[wk];
    return { x: `W${i + 1}`, y: cum };
  });

  createChart('chart-personal-cumulative', 'line', {
    labels: sortedWeeks.map((_, i) => `W${i + 1}`),
    datasets: [{
      label: 'Cumulative Check-ins',
      data: data.map(d => d.y),
      borderColor: '#6366f1',
      backgroundColor: 'rgba(99, 102, 241, 0.1)',
      fill: true,
      tension: 0.2,
      pointRadius: 4,
      pointBackgroundColor: '#6366f1',
      borderWidth: 2.5
    }]
  }, {
    scales: {
      x: { title: { display: true, text: 'Week' } },
      y: { beginAtZero: true, ticks: { precision: 0 } }
    },
    plugins: { legend: { display: false } }
  });
}

// ── Personal Weekly Bar ──
function renderPersonalWeekly(scores) {
  const mid = String(selectedMemberId);
  const memberWeeks = scores[mid] || {};
  const sortedWeeks = Object.keys(memberWeeks).sort();
  const weekLabels = sortedWeeks.map((_, i) => `W${i + 1}`);

  createChart('chart-personal-weekly', 'bar', {
    labels: weekLabels,
    datasets: [{
      label: 'Check-ins',
      data: sortedWeeks.map(wk => memberWeeks[wk]),
      backgroundColor: sortedWeeks.map(wk => memberWeeks[wk] >= WEEK_CAP ? '#22c55e' : '#6366f1'),
      borderRadius: 4,
      barPercentage: 0.7
    }]
  }, {
    scales: {
      y: {
        beginAtZero: true,
        max: WEEK_CAP + 2,
        ticks: { precision: 0 },
        title: { display: true, text: 'Capped Check-ins' }
      }
    },
    plugins: {
      legend: { display: false },
      annotation: undefined
    }
  });
}

// ── Personal Weekday ──
function renderPersonalWeekday(checkIns) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const counts = new Array(7).fill(0);
  checkIns.forEach(ci => {
    const d = new Date(ci.occurred_at || ci.created_at);
    let day = d.getDay(); day = day === 0 ? 6 : day - 1;
    counts[day]++;
  });
  createChart('chart-personal-weekday', 'bar', {
    labels: days,
    datasets: [{
      label: 'Check-ins',
      data: counts,
      backgroundColor: days.map((_, i) => COLORS[i]),
      borderRadius: 6,
      barPercentage: 0.6
    }]
  }, {
    scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
    plugins: { legend: { display: false } }
  });
}

// ═══════════════════════════════════════════════════════════
// ── CHART HELPERS ──
// ═══════════════════════════════════════════════════════════

function createChart(canvasId, type, data, extraOptions = {}) {
  if (charts[canvasId]) charts[canvasId].destroy();
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  const defaultOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: { display: type === 'doughnut' || (data.datasets && data.datasets.length > 1 && type !== 'bar') }
    }
  };
  charts[canvasId] = new Chart(ctx, { type, data, options: deepMerge(defaultOptions, extraOptions) });
}

function formatNum(n) { return n.toLocaleString('en-US'); }

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}
