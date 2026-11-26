const paths = ['p1','p2','p3','p4','p5','p6'];
const nodes = ['SCOUT','GUARD','STRAT','RISK','TRADER','CHIEF'];
let cycle = 0;
let lastTs = 0;
let pnlChart, candleChart;

function animatePacket(pathId, dur = 1500) {
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
    const svg = document.getElementById('orbit-svg');
    const sp = svg.createSVGPoint();
    sp.x = pt.x; sp.y = pt.y;
    const screen = sp.matrixTransform(svg.getScreenCTM());
    const rect = svg.getBoundingClientRect();
    pkt.style.left = (screen.x - rect.left - 4.5) + 'px';
    pkt.style.top = (screen.y - rect.top - 4.5) + 'px';
    if (p < 1) requestAnimationFrame(step);
    else path.classList.remove('active');
  }
  requestAnimationFrame(step);
}

setInterval(() => {
  animatePacket(paths[cycle % paths.length], 1600);
  const n = nodes[cycle % nodes.length];
  document.querySelectorAll('.orb-node').forEach(el => el.classList.remove('active'));
  const el = document.getElementById('node-' + n);
  if (el) el.classList.add('active');
  cycle++;
}, 1700);

function initCharts() {
  const pCtx = document.getElementById('pnlChart').getContext('2d');
  pnlChart = new Chart(pCtx, {
    type: 'line',
    data: {
      labels: Array.from({length: 16}, (_, i) => i),
      datasets: [{
        data: [0,0.004,-0.002,0.006,0.003,0.009,0.005,0.012,0.008,0.015,0.011,0.018,0.014,0.021,0.017,0],
        borderColor: '#00f0ff',
        backgroundColor: 'rgba(0,240,255,0.08)',
        borderWidth: 2,
        tension: 0.35,
        fill: true,
        pointRadius: 0
      }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
      scales: { x: { ticks: { color: '#555', maxTicksLimit: 5 }, grid: { color: '#151520' } },
                y: { ticks: { color: '#555' }, grid: { color: '#151520' } } } }
  });

  const cCtx = document.getElementById('candleChart').getContext('2d');
  candleChart = new Chart(cCtx, {
    type: 'bar',
    data: {
      labels: Array.from({length: 12}, (_, i) => i),
      datasets: [{
        data: [[70,75],[72,77],[69,74],[73,78],[71,76],[74,79],[72,77],[75,80],[73,78],[76,81],[74,79],[75,80]],
        backgroundColor: Array(12).fill(0).map((_,i) => i%2 ? 'rgba(0,255,136,0.45)' : 'rgba(255,0,110,0.45)'),
        borderColor: Array(12).fill(0).map((_,i) => i%2 ? '#00ff88' : '#ff006e'),
        borderWidth: 1,
        barPercentage: 0.5
      }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
      scales: { x: { ticks: { color: '#555', maxTicksLimit: 5 }, grid: { display: false } },
                y: { ticks: { color: '#555' }, grid: { color: '#151520' } } } }
  });
}

function updateUI(d) {
  document.getElementById('equity').textContent = (d.equity || 1).toFixed(4);
  const pnl = d.totalPnl || 0;
  const pnlEl = document.getElementById('pnl');
  pnlEl.textContent = (pnl >= 0 ? '+' : '') + pnl.toFixed(4);
  pnlEl.className = pnl >= 0 ? 'pos' : 'neg';
  const tot = (d.wins||0)+(d.losses||0);
  document.getElementById('wr').textContent = tot ? ((d.wins/tot)*100).toFixed(0)+'%' : '0%';
  document.getElementById('open-count').textContent = d.openTrade ? '1' : '0';
  document.getElementById('trade-status').textContent = d.openTrade ? d.openTrade.token : 'WAITING';
  document.getElementById('mood').textContent = (d.chiefMood || 'calm').toUpperCase();
  document.getElementById('brief').textContent = d.chiefBriefing || 'Standing by...';
  if (d.openTrade) document.getElementById('sol-price').textContent = '$' + d.openTrade.entryPrice.toFixed(2);

  const newest = d.agentLogs?.[0];
  if (newest && newest.time > lastTs && Date.now() - newest.time < 5000) {
    lastTs = newest.time;
    const map = { SCOUT:'p1', GUARD:'p2', STRATEGIST:'p3', RISK:'p4', TRADER:'p5', CHIEF:'p6' };
    if (map[newest.agent]) animatePacket(map[newest.agent], 900);
  }
}

async function poll() {
  try {
    const r = await fetch('/api/status');
    const d = await r.json();
    updateUI(d);
  } catch(e) {}
  document.getElementById('utc').textContent = new Date().toLocaleTimeString('en-GB', {hour12:false});
}

initCharts();
setInterval(poll, 2000);
poll();
