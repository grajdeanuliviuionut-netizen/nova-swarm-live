const pathMap = {
  SCOUT: 'p-scout',
  GUARD: 'p-guard',
  STRATEGIST: 'p-strat',
  RISK: 'p-risk',
  TRADER: 'p-trader',
  KELLY: 'p-kelly'
};
const agents = Object.keys(pathMap);
let cycle = 0;
let lastTs = 0;
let chart;

function animatePacket(pathId, dur = 1200) {
  const path = document.getElementById(pathId);
  const pkt = document.getElementById('pkt');
  if (!path || !pkt) return;
  path.classList.add('active');
  pkt.classList.add('active');
  const len = path.getTotalLength();
  let start = null;
  function step(ts) {
    if (!start) start = ts;
    const p = Math.min((ts - start) / dur, 1);
    const pt = path.getPointAtLength(p * len);
    const svg = document.getElementById('svg');
    const sp = svg.createSVGPoint();
    sp.x = pt.x; sp.y = pt.y;
    const screen = sp.matrixTransform(svg.getScreenCTM());
    const rect = svg.getBoundingClientRect();
    pkt.style.left = (screen.x - rect.left - 4) + 'px';
    pkt.style.top = (screen.y - rect.top - 4) + 'px';
    if (p < 1) requestAnimationFrame(step);
    else path.classList.remove('active');
  }
  requestAnimationFrame(step);
}

setInterval(() => {
  const agent = agents[cycle % agents.length];
  animatePacket(pathMap[agent], 1400);
  document.querySelectorAll('.hud-card').forEach(c => c.classList.remove('active'));
  const card = document.getElementById('card-' + agent);
  if (card) card.classList.add('active');
  cycle++;
}, 1800);

function initChart() {
  const ctx = document.getElementById('candle').getContext('2d');
  chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Array.from({length: 18}, (_, i) => i),
      datasets: [{
        data: [[70,76],[72,78],[69,75],[73,79],[71,77],[75,81],[73,79],[76,82],[74,80],[77,83],[75,81],[78,84],[76,82],[75,81],[74,80],[73,79],[72,78],[71,77]],
        backgroundColor: Array(18).fill(0).map((_, i) => i % 3 === 0 ? 'rgba(255,0,85,0.55)' : 'rgba(0,255,136,0.55)'),
        borderColor: Array(18).fill(0).map((_, i) => i % 3 === 0 ? '#ff0055' : '#00ff88'),
        borderWidth: 1,
        barPercentage: 0.5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#445555', maxTicksLimit: 6 }, grid: { color: 'rgba(0,255,136,0.06)' } },
        y: { ticks: { color: '#445555' }, grid: { color: 'rgba(0,255,136,0.06)' } }
      }
    }
  });
}

function renderLogs(logs) {
  const el = document.getElementById('logs');
  if (!logs || !logs.length) {
    el.innerHTML = '<div class="log-entry"><span class="time">--:--:--</span>No activity</div>';
    return;
  }
  el.innerHTML = logs.slice(0, 20).map(l => {
    const t = new Date(l.time).toLocaleTimeString('en-GB', { hour12: false });
    const agent = (l.agent || '').toLowerCase();
    const tag = l.agent || 'SYS';
    return `<div class="log-entry ${agent}"><span class="time">${t}</span><span class="tag">[${tag}]</span>${l.message || ''}</div>`;
  }).join('');
}

function update(d) {
  document.getElementById('balance').textContent = (d.equity || 1).toFixed(4);
  const pnl = d.totalPnl || 0;
  const pnlEl = document.getElementById('pnl');
  pnlEl.textContent = (pnl >= 0 ? '+' : '') + pnl.toFixed(4);
  pnlEl.className = pnl >= 0 ? 'pos' : 'neg';
  const total = (d.wins || 0) + (d.losses || 0);
  document.getElementById('trades').textContent = total;
  document.getElementById('wr').textContent = total ? ((d.wins / total) * 100).toFixed(0) + '%' : '0%';
  document.getElementById('token').textContent = d.openTrade ? d.openTrade.token : '--';

  renderLogs(d.agentLogs || []);

  const newest = d.agentLogs?.[0];
  if (newest && newest.time > lastTs && Date.now() - newest.time < 5000) {
    lastTs = newest.time;
    const agent = newest.agent;
    const pathId = pathMap[agent];
    document.querySelectorAll('.hud-card').forEach(c => c.classList.remove('active'));
    const card = document.getElementById('card-' + agent);
    if (card) card.classList.add('active');
    if (pathId) animatePacket(pathId, 900);
  }
}

async function poll() {
  try {
    const r = await fetch('/api/status');
    const d = await r.json();
    update(d);
  } catch (e) {}
}

initChart();
setInterval(poll, 2000);
poll();
