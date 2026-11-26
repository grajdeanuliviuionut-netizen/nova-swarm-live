const nodeToPath = {
  SCOUT: 'p-scout',
  GUARD: 'p-guard',
  STRATEGIST: 'p-strat',
  RISK: 'p-risk',
  TRADER: 'p-trader',
  CHIEF: 'p-chief'
};

const pathCycle = ['p-scout','p-guard','p-strat','p-risk','p-trader','p-chief'];
let cycleIdx = 0;
let lastTs = 0;
let pnlChart, candleChart;

function animatePacket(pathId, duration = 1400) {
  const path = document.getElementById(pathId);
  const packet = document.getElementById('pkt1');
  if (!path || !packet) return;
  path.classList.add('active');
  packet.classList.add('active');
  const len = path.getTotalLength();
  let start = null;
  function step(ts) {
    if (!start) start = ts;
    const p = Math.min((ts - start) / duration, 1);
    const pt = path.getPointAtLength(p * len);
    const svg = document.getElementById('orbit-svg');
    const sp = svg.createSVGPoint();
    sp.x = pt.x; sp.y = pt.y;
    const screen = sp.matrixTransform(svg.getScreenCTM());
    const rect = svg.getBoundingClientRect();
    packet.style.left = (screen.x - rect.left - 4) + 'px';
    packet.style.top = (screen.y - rect.top - 4) + 'px';
    if (p < 1) requestAnimationFrame(step);
    else path.classList.remove('active');
  }
  requestAnimationFrame(step);
}

setInterval(() => {
  animatePacket(pathCycle[cycleIdx % pathCycle.length], 1600);
  cycleIdx++;
}, 1800);

function pulseNode(agent) {
  document.querySelectorAll('.node.agent').forEach(n => n.classList.remove('active'));
  const el = document.getElementById('node-' + agent);
  if (el) el.classList.add('active');
  setTimeout(() => el && el.classList.remove('active'), 1400);
}

function initCharts() {
  const pnlCtx = document.getElementById('pnlChart').getContext('2d');
  pnlChart = new Chart(pnlCtx, {
    type: 'line',
    data: {
      labels: Array.from({length: 12}, (_, i) => i),
      datasets: [{
        data: [0, 0.003, -0.001, 0.005, 0.002, 0.007, 0.004, 0.009, 0.006, 0.011, 0.008, 0],
        borderColor: '#00f0ff',
        backgroundColor: 'rgba(0,240,255,0.1)',
        borderWidth: 2,
        tension: 0.35,
        fill: true,
        pointRadius: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#6b7280', maxTicksLimit: 6 }, grid: { color: '#151520' } },
        y: { ticks: { color: '#6b7280' }, grid: { color: '#151520' } }
      }
    }
  });

  const candleCtx = document.getElementById('candleChart').getContext('2d');
  candleChart = new Chart(candleCtx, {
    type: 'bar',
    data: {
      labels: Array.from({length: 10}, (_, i) => i),
      datasets: [{
        data: [[72,76],[73,77],[71,75],[74,78],[73,76],[75,79],[74,77],[76,80],[75,78],[74,77]],
        backgroundColor: ['rgba(0,255,136,0.4)','rgba(0,255,136,0.4)','rgba(255,0,110,0.4)','rgba(0,255,136,0.4)','rgba(255,0,110,0.4)','rgba(0,255,136,0.4)','rgba(255,0,110,0.4)','rgba(0,255,136,0.4)','rgba(255,0,110,0.4)','rgba(0,255,136,0.4)'],
        borderColor: ['#00ff88','#00ff88','#ff006e','#00ff88','#ff006e','#00ff88','#ff006e','#00ff88','#ff006e','#00ff88'],
        borderWidth: 1,
        barPercentage: 0.55
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#6b7280', maxTicksLimit: 6 }, grid: { display: false } },
        y: { ticks: { color: '#6b7280' }, grid: { color: '#151520' } }
      }
    }
  });
}

function updateCharts(data) {
  if (!pnlChart || !candleChart) return;
  const pnl = data.chartData?.pnl || [];
  if (pnl.length > 2) {
    pnlChart.data.labels = pnl.map((_, i) => i);
    pnlChart.data.datasets[0].data = pnl;
    pnlChart.update('none');
  }
  const candles = data.chartData?.candles || [];
  if (candles.length) {
    candleChart.data.labels = candles.map((_, i) => i);
    candleChart.data.datasets[0].data = candles.map(c => [c.l, c.h]);
    candleChart.data.datasets[0].backgroundColor = candles.map(c => c.c >= c.o ? 'rgba(0,255,136,0.4)' : 'rgba(255,0,110,0.4)');
    candleChart.data.datasets[0].borderColor = candles.map(c => c.c >= c.o ? '#00ff88' : '#ff006e');
    candleChart.update('none');
  }
}

async function poll() {
  try {
    const res = await fetch('/api/status');
    const d = await res.json();

    document.getElementById('equity').textContent = (d.equity || 1).toFixed(4) + ' SOL';
    const pnl = d.totalPnl || 0;
    const pnlEl = document.getElementById('pnl');
    pnlEl.textContent = (pnl >= 0 ? '+' : '') + pnl.toFixed(4);
    pnlEl.className = pnl >= 0 ? 'pos' : 'neg';
    const total = (d.wins || 0) + (d.losses || 0);
    document.getElementById('wr').textContent = total ? ((d.wins / total) * 100).toFixed(1) + '%' : '0%';

    updateCharts(d);

    const newest = d.agentLogs?.[0];
    if (newest && newest.time > lastTs && Date.now() - newest.time < 6000) {
      lastTs = newest.time;
      pulseNode(newest.agent);
      const pathId = nodeToPath[newest.agent];
      if (pathId) animatePacket(pathId, 1000);
    }
  } catch (e) {}
}

initCharts();
setInterval(poll, 2000);
poll();
