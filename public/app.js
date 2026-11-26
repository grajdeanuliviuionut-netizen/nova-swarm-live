const pathIds = ['p1','p2','p3','p4','p5','p6','p7','p8'];
const agentNames = ['SCOUT','GUARD','STRAT','RISK','TRADER','KELLY','EDGE','PRIOR'];
let cycle = 0;
let lastTs = 0;
let candleChart;

function animatePkt(pathId, dur = 1400) {
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
  animatePkt(pathIds[cycle % pathIds.length], 1500);
  document.querySelectorAll('.agent').forEach(a => a.classList.remove('active'));
  const ag = document.querySelector(`.agent[data-n="${agentNames[cycle % agentNames.length]}"]`);
  if (ag) ag.classList.add('active');
  cycle++;
}, 1600);

function initChart() {
  const ctx = document.getElementById('candleChart').getContext('2d');
  candleChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Array.from({length: 14}, (_, i) => i),
      datasets: [{
        data: [[68,74],[70,76],[69,75],[72,78],[71,77],[74,80],[73,79],[75,81],[74,80],[76,82],[75,81],[77,83],[76,82],[75,81]],
        backgroundColor: Array(14).fill(0).map((_,i) => i % 3 === 0 ? 'rgba(255,0,110,0.5)' : 'rgba(0,255,136,0.5)'),
        borderColor: Array(14).fill(0).map((_,i) => i % 3 === 0 ? '#ff006e' : '#00ff88'),
        borderWidth: 1,
        barPercentage: 0.55
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#444', maxTicksLimit: 5 }, grid: { display: false } },
        y: { ticks: { color: '#444' }, grid: { color: '#151520' } }
      }
    }
  });
}

function update(d) {
  document.getElementById('equity').textContent = '$' + (d.equity || 1).toFixed(4);
  document.getElementById('token-name').textContent = d.openTrade ? d.openTrade.token : 'SCANNING';
  document.getElementById('entry').textContent = d.openTrade ? '$' + d.openTrade.entryPrice.toFixed(4) : '--';
  const pnl = d.totalPnl || 0;
  const pnlEl = document.getElementById('trade-pnl');
  pnlEl.textContent = (pnl >= 0 ? '+' : '') + pnl.toFixed(4);
  pnlEl.className = pnl >= 0 ? 'pos' : 'neg';

  const list = document.getElementById('trade-list');
  const closed = (d.wins || 0) + (d.losses || 0);
  document.querySelector('.closed').textContent = closed + ' closed';
  if (d.agentLogs && d.agentLogs.length) {
    list.innerHTML = d.agentLogs.slice(0, 8).map(l => {
      const isBuy = (l.message || '').includes('BUY');
      const isClose = (l.message || '').includes('CLOSED');
      return `<div class="trade-row"><span class="${isBuy?'buy':isClose?'sell':''}">${l.agent}</span><span>${(l.message||'').slice(0,28)}</span></div>`;
    }).join('');
  }

  const logs = document.getElementById('logs');
  if (d.agentLogs && d.agentLogs.length) {
    logs.innerHTML = d.agentLogs.slice(0, 12).map(l => {
      const t = new Date(l.time).toLocaleTimeString('en-GB', {hour12:false});
      return `<div class="log-row"><span class="t">${t}</span><span class="ag">${l.agent}</span>${l.message || ''}</div>`;
    }).join('');
  }

  const newest = d.agentLogs?.[0];
  if (newest && newest.time > lastTs && Date.now() - newest.time < 5000) {
    lastTs = newest.time;
    const map = { SCOUT:'p1', GUARD:'p2', STRATEGIST:'p3', RISK:'p4', TRADER:'p5' };
    if (map[newest.agent]) animatePkt(map[newest.agent], 900);
  }
}

async function poll() {
  try {
    const r = await fetch('/api/status');
    const d = await r.json();
    update(d);
  } catch(e) {}
}

initChart();
setInterval(poll, 2000);
poll();
