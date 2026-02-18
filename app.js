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
  '#a855f7', '#84cc16', '#e11d48', '#0ea5e9', '#fbbf24'
];

const ACTIVITY_COLORS = {
  strength_training: '#6366f1',
  weight_lifting: '#818cf8',
  cycling: '#22c55e',
  spinning: '#16a34a',
  running: '#f59e0b',
  treadmill: '#d97706',
  walking: '#06b6d4',
  swimming: '#ec4899',
  surfing: '#f472b6',
  yoga: '#8b5cf6',
  pilates: '#a78bfa',
  hiit: '#ef4444',
  functional_training: '#dc2626',
  core_training: '#fb923c',
  martial_arts: '#e11d48',
  tennis: '#0ea5e9',
  table_tennis: '#38bdf8',
  mixed_cardio: '#14b8a6',
  stairs: '#fbbf24',
  elliptical: '#84cc16',
  other: '#64748b'
};

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
  const handlers = ['json-upload', 'json-upload-empty'];
  handlers.forEach(id => {
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
      const data = JSON.parse(ev.target.result);
      loadData(data);
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
  const desc = data.description || '';
  document.getElementById('challenge-desc').textContent = desc.replace(/\n/g, ' · ');
  buildMemberTabs();
  currentTab = 'overview';
  selectedMemberId = null;
  periodOffset = 0;
  renderAll();
}

// ── Members map ──
function getMembersMap() {
  const map = {};
  (challengeData.members || []).forEach(m => { map[m.id] = m; });
  return map;
}

// ── Tabs ──
function setupTabs() {
  document.querySelector('.tab[data-tab="overview"]').addEventListener('click', () => {
    switchTab('overview');
  });
}

function buildMemberTabs() {
  const container = document.getElementById('member-tabs');
  container.innerHTML = '';
  const members = (challengeData.members || []).sort((a, b) => a.full_name.localeCompare(b.full_name));
  members.forEach(m => {
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

  document.getElementById('prev-period').addEventListener('click', () => {
    periodOffset--;
    renderAll();
  });

  document.getElementById('next-period').addEventListener('click', () => {
    if (periodOffset < 0) {
      periodOffset++;
      renderAll();
    }
  });
}

// ── Date Range ──
function getDateRange() {
  const now = new Date();
  if (currentPeriod === 'total') return { start: null, end: null, label: 'All Time' };

  let start, end, label;
  if (currentPeriod === 'week') {
    const ref = new Date(now);
    ref.setDate(ref.getDate() + periodOffset * 7);
    const day = ref.getDay();
    start = new Date(ref);
    start.setDate(ref.getDate() - (day === 0 ? 6 : day - 1));
    start.setHours(0, 0, 0, 0);
    end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    label = `${fmtDate(start)} – ${fmtDate(end)}`;
  } else if (currentPeriod === 'month') {
    const ref = new Date(now.getFullYear(), now.getMonth() + periodOffset, 1);
    start = new Date(ref.getFullYear(), ref.getMonth(), 1);
    end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59, 999);
    label = start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  } else if (currentPeriod === 'year') {
    const year = now.getFullYear() + periodOffset;
    start = new Date(year, 0, 1);
    end = new Date(year, 11, 31, 23, 59, 59, 999);
    label = String(year);
  }

  return { start, end, label };
}

function fmtDate(d) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

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

// ── Render ──
function renderAll() {
  const range = getDateRange();
  const nav = document.getElementById('period-nav');
  if (currentPeriod === 'total') {
    nav.classList.add('hidden');
  } else {
    nav.classList.remove('hidden');
    document.getElementById('period-label').textContent = range.label;
  }

  if (currentTab === 'overview') {
    renderOverview(range);
  } else {
    renderPersonal(range);
  }
}

// ── Overview ──
function renderOverview(range) {
  const checkIns = filterCheckIns(challengeData.check_ins || [], range);
  const members = getMembersMap();

  renderOverviewStats(checkIns, members);
  renderWorkoutsOverTime(checkIns, range);
  renderWorkoutsPerMember(checkIns, members);
  renderCaloriesPerMember(checkIns, members);
  renderActivityTypes(checkIns);
  renderDurationPerMember(checkIns, members);
  renderPointsPerMember(checkIns, members);
  renderAvgCalories(checkIns, members);
  renderWeekdayHeatmap(checkIns, members);
}

function renderOverviewStats(checkIns, members) {
  const totalWorkouts = checkIns.length;
  const totalCalories = checkIns.reduce((s, ci) => s + (ci.calories || 0), 0);
  const totalDuration = checkIns.reduce((s, ci) => s + (ci.duration || 0), 0);
  const totalPoints = checkIns.reduce((s, ci) => s + (ci.points || 0), 0);
  const activeMemberIds = new Set(checkIns.map(ci => ci.account_id));
  const avgPerMember = activeMemberIds.size ? (totalWorkouts / activeMemberIds.size).toFixed(1) : 0;

  document.getElementById('overview-stats').innerHTML = `
    <div class="stat-card"><div class="label">Total Workouts</div><div class="value">${totalWorkouts}</div></div>
    <div class="stat-card"><div class="label">Total Calories</div><div class="value">${formatNum(totalCalories)}</div></div>
    <div class="stat-card"><div class="label">Total Hours</div><div class="value">${(totalDuration / 60).toFixed(1)}</div></div>
    <div class="stat-card"><div class="label">Total Points</div><div class="value">${formatNum(totalPoints)}</div></div>
    <div class="stat-card"><div class="label">Active Members</div><div class="value">${activeMemberIds.size}</div></div>
    <div class="stat-card"><div class="label">Avg per Member</div><div class="value">${avgPerMember}</div><div class="sub">workouts</div></div>
  `;
}

function renderWorkoutsOverTime(checkIns, range) {
  const grouped = {};
  checkIns.forEach(ci => {
    const d = (ci.occurred_at || ci.created_at || '').slice(0, 10);
    if (d) grouped[d] = (grouped[d] || 0) + 1;
  });

  const sorted = Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0]));
  createChart('chart-workouts-time', 'bar', {
    labels: sorted.map(e => e[0]),
    datasets: [{
      label: 'Workouts',
      data: sorted.map(e => e[1]),
      backgroundColor: '#6366f1',
      borderRadius: 3,
      barPercentage: 0.8
    }]
  }, {
    scales: {
      x: { type: 'time', time: { unit: getBestTimeUnit(sorted.length), tooltipFormat: 'MMM d, yyyy' } },
      y: { beginAtZero: true, ticks: { precision: 0 } }
    }
  });
}

function renderWorkoutsPerMember(checkIns, members) {
  const counts = {};
  checkIns.forEach(ci => { counts[ci.account_id] = (counts[ci.account_id] || 0) + 1; });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  memberBarChart('chart-workouts-member', sorted, members, 'Workouts');
}

function renderCaloriesPerMember(checkIns, members) {
  const counts = {};
  checkIns.forEach(ci => { counts[ci.account_id] = (counts[ci.account_id] || 0) + (ci.calories || 0); });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  memberBarChart('chart-calories-member', sorted, members, 'Calories');
}

function renderActivityTypes(checkIns) {
  const counts = {};
  checkIns.forEach(ci => {
    (ci.check_in_activities || []).forEach(a => {
      const type = a.platform_activity || 'other';
      counts[type] = (counts[type] || 0) + 1;
    });
  });

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  createChart('chart-activity-types', 'doughnut', {
    labels: sorted.map(e => formatActivity(e[0])),
    datasets: [{
      data: sorted.map(e => e[1]),
      backgroundColor: sorted.map(e => ACTIVITY_COLORS[e[0]] || ACTIVITY_COLORS.other),
      borderWidth: 0
    }]
  }, {
    plugins: { legend: { position: 'right', labels: { boxWidth: 14, padding: 12 } } }
  });
}

function renderDurationPerMember(checkIns, members) {
  const counts = {};
  checkIns.forEach(ci => { counts[ci.account_id] = (counts[ci.account_id] || 0) + (ci.duration || 0); });
  const sorted = Object.entries(counts)
    .map(([id, val]) => [id, +(val / 60).toFixed(1)])
    .sort((a, b) => b[1] - a[1]);
  memberBarChart('chart-duration-member', sorted, members, 'Hours');
}

function renderPointsPerMember(checkIns, members) {
  const counts = {};
  checkIns.forEach(ci => { counts[ci.account_id] = (counts[ci.account_id] || 0) + (ci.points || 0); });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  memberBarChart('chart-points-member', sorted, members, 'Points');
}

function renderAvgCalories(checkIns, members) {
  const sums = {};
  const cnts = {};
  checkIns.forEach(ci => {
    sums[ci.account_id] = (sums[ci.account_id] || 0) + (ci.calories || 0);
    cnts[ci.account_id] = (cnts[ci.account_id] || 0) + 1;
  });
  const sorted = Object.entries(sums)
    .map(([id, total]) => [id, Math.round(total / (cnts[id] || 1))])
    .sort((a, b) => b[1] - a[1]);
  memberBarChart('chart-avg-calories', sorted, members, 'Avg Calories');
}

function renderWeekdayHeatmap(checkIns, members) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const memberIds = [...new Set(checkIns.map(ci => ci.account_id))];

  const data = {};
  checkIns.forEach(ci => {
    const d = new Date(ci.occurred_at || ci.created_at);
    let day = d.getDay();
    day = day === 0 ? 6 : day - 1;
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

  createChart('chart-heatmap', 'bar', {
    labels: days,
    datasets
  }, {
    scales: {
      x: { stacked: true },
      y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } }
    },
    plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 8, font: { size: 11 } } } }
  });
}

// ── Personal ──
function renderPersonal(range) {
  const member = (challengeData.members || []).find(m => m.id === selectedMemberId);
  if (!member) return;

  const checkIns = filterCheckIns(challengeData.check_ins || [], range, selectedMemberId);

  renderPersonalHeader(member);
  renderPersonalStats(checkIns);
  renderPersonalHistory(checkIns);
  renderPersonalActivities(checkIns);
  renderPersonalCalories(checkIns);
  renderPersonalDuration(checkIns);
  renderPersonalPoints(checkIns);
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
  container.innerHTML = `
    ${avatar}
    <div class="info">
      <h2>${member.full_name}</h2>
      <p>Joined ${joined}${role}</p>
    </div>
  `;
}

function renderPersonalStats(checkIns) {
  const total = checkIns.length;
  const cals = checkIns.reduce((s, ci) => s + (ci.calories || 0), 0);
  const dur = checkIns.reduce((s, ci) => s + (ci.duration || 0), 0);
  const pts = checkIns.reduce((s, ci) => s + (ci.points || 0), 0);
  const avgCal = total ? Math.round(cals / total) : 0;
  const avgDur = total ? Math.round(dur / total) : 0;

  // Streak calculation
  const dates = [...new Set(checkIns.map(ci => (ci.occurred_at || ci.created_at || '').slice(0, 10)))].sort().reverse();
  let streak = 0;
  if (dates.length > 0) {
    const today = new Date().toISOString().slice(0, 10);
    let check = dates[0] === today ? new Date() : new Date(dates[0]);
    for (const d of dates) {
      if (d === check.toISOString().slice(0, 10)) {
        streak++;
        check.setDate(check.getDate() - 1);
      } else {
        break;
      }
    }
  }

  document.getElementById('personal-stats').innerHTML = `
    <div class="stat-card"><div class="label">Workouts</div><div class="value">${total}</div></div>
    <div class="stat-card"><div class="label">Total Calories</div><div class="value">${formatNum(cals)}</div></div>
    <div class="stat-card"><div class="label">Total Hours</div><div class="value">${(dur / 60).toFixed(1)}</div></div>
    <div class="stat-card"><div class="label">Points</div><div class="value">${formatNum(pts)}</div></div>
    <div class="stat-card"><div class="label">Avg Calories</div><div class="value">${formatNum(avgCal)}</div><div class="sub">per workout</div></div>
    <div class="stat-card"><div class="label">Avg Duration</div><div class="value">${avgDur}</div><div class="sub">minutes</div></div>
  `;
}

function renderPersonalHistory(checkIns) {
  const grouped = {};
  checkIns.forEach(ci => {
    const d = (ci.occurred_at || ci.created_at || '').slice(0, 10);
    if (d) grouped[d] = (grouped[d] || 0) + 1;
  });
  const sorted = Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0]));

  createChart('chart-personal-history', 'bar', {
    labels: sorted.map(e => e[0]),
    datasets: [{
      label: 'Workouts',
      data: sorted.map(e => e[1]),
      backgroundColor: '#6366f1',
      borderRadius: 3
    }]
  }, {
    scales: {
      x: { type: 'time', time: { unit: getBestTimeUnit(sorted.length), tooltipFormat: 'MMM d, yyyy' } },
      y: { beginAtZero: true, ticks: { precision: 0 } }
    }
  });
}

function renderPersonalActivities(checkIns) {
  const counts = {};
  checkIns.forEach(ci => {
    (ci.check_in_activities || []).forEach(a => {
      const type = a.platform_activity || 'other';
      counts[type] = (counts[type] || 0) + 1;
    });
  });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  createChart('chart-personal-activities', 'doughnut', {
    labels: sorted.map(e => formatActivity(e[0])),
    datasets: [{
      data: sorted.map(e => e[1]),
      backgroundColor: sorted.map(e => ACTIVITY_COLORS[e[0]] || ACTIVITY_COLORS.other),
      borderWidth: 0
    }]
  }, {
    plugins: { legend: { position: 'right', labels: { boxWidth: 14, padding: 12 } } }
  });
}

function renderPersonalCalories(checkIns) {
  const sorted = checkIns
    .map(ci => ({ x: (ci.occurred_at || ci.created_at || '').slice(0, 10), y: ci.calories || 0 }))
    .filter(d => d.x)
    .sort((a, b) => a.x.localeCompare(b.x));

  createChart('chart-personal-calories', 'line', {
    datasets: [{
      label: 'Calories',
      data: sorted,
      borderColor: '#22c55e',
      backgroundColor: 'rgba(34, 197, 94, 0.1)',
      fill: true,
      tension: 0.3,
      pointRadius: 3,
      pointBackgroundColor: '#22c55e'
    }]
  }, {
    scales: {
      x: { type: 'time', time: { tooltipFormat: 'MMM d, yyyy' } },
      y: { beginAtZero: true }
    }
  });
}

function renderPersonalDuration(checkIns) {
  const sorted = checkIns
    .map(ci => ({
      x: (ci.occurred_at || ci.created_at || '').slice(0, 10),
      y: ci.duration || 0,
      title: ci.title || ''
    }))
    .filter(d => d.x)
    .sort((a, b) => a.x.localeCompare(b.x));

  createChart('chart-personal-duration', 'bar', {
    labels: sorted.map(d => d.x),
    datasets: [{
      label: 'Duration (min)',
      data: sorted.map(d => d.y),
      backgroundColor: '#f59e0b',
      borderRadius: 3
    }]
  }, {
    scales: {
      x: { type: 'time', time: { tooltipFormat: 'MMM d, yyyy' } },
      y: { beginAtZero: true }
    }
  });
}

function renderPersonalPoints(checkIns) {
  const grouped = {};
  checkIns.forEach(ci => {
    const d = (ci.occurred_at || ci.created_at || '').slice(0, 10);
    if (d) grouped[d] = (grouped[d] || 0) + (ci.points || 0);
  });
  const sorted = Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0]));

  // Cumulative
  let cumulative = 0;
  const cumData = sorted.map(([date, pts]) => {
    cumulative += pts;
    return { x: date, y: cumulative };
  });

  createChart('chart-personal-points', 'line', {
    datasets: [{
      label: 'Cumulative Points',
      data: cumData,
      borderColor: '#8b5cf6',
      backgroundColor: 'rgba(139, 92, 246, 0.1)',
      fill: true,
      tension: 0.3,
      pointRadius: 2,
      pointBackgroundColor: '#8b5cf6'
    }]
  }, {
    scales: {
      x: { type: 'time', time: { tooltipFormat: 'MMM d, yyyy' } },
      y: { beginAtZero: true }
    }
  });
}

function renderPersonalWeekday(checkIns) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const counts = new Array(7).fill(0);
  checkIns.forEach(ci => {
    const d = new Date(ci.occurred_at || ci.created_at);
    let day = d.getDay();
    day = day === 0 ? 6 : day - 1;
    counts[day]++;
  });

  createChart('chart-personal-weekday', 'bar', {
    labels: days,
    datasets: [{
      label: 'Workouts',
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

// ── Chart helpers ──
function createChart(canvasId, type, data, extraOptions = {}) {
  if (charts[canvasId]) {
    charts[canvasId].destroy();
  }

  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  const defaultOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: { display: type === 'doughnut' || (data.datasets && data.datasets.length > 1 && type !== 'bar') }
    }
  };

  charts[canvasId] = new Chart(ctx, {
    type,
    data,
    options: deepMerge(defaultOptions, extraOptions)
  });
}

function memberBarChart(canvasId, sorted, members, label) {
  createChart(canvasId, 'bar', {
    labels: sorted.map(e => memberName(e[0], members)),
    datasets: [{
      label,
      data: sorted.map(e => e[1]),
      backgroundColor: sorted.map((_, i) => COLORS[i % COLORS.length]),
      borderRadius: 6,
      barPercentage: 0.7
    }]
  }, {
    indexAxis: 'y',
    scales: { x: { beginAtZero: true } },
    plugins: { legend: { display: false } }
  });
}

// ── Utilities ──
function memberName(id, members) {
  const m = members[parseInt(id)];
  return m ? m.full_name.split(' ').slice(0, 2).join(' ') : `User ${id}`;
}

function formatActivity(type) {
  return (type || 'other').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatNum(n) {
  return n.toLocaleString('en-US');
}

function getBestTimeUnit(count) {
  if (count > 180) return 'month';
  if (count > 30) return 'week';
  return 'day';
}

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
