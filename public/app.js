let volChart, candleChart, flowChart;

function rand(min, max) { return Math.random() * (max - min) + min; }

function initCharts() {
  const vCtx = document.getElementById('volChart').getContext('2d');
  volChart = new Chart(vCtx, {
    type: 'line',
    data: { labels: Array.from({length: 20}, (_, i) => i), datasets: [{ data: Array.from({length: 20}, () => rand(0.8, 1.2)), borderColor: '#FFD700', borderWidth: 1.5, tension: 0.3, pointRadius: 0 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { ticks: { color: '#555', font: { size: 8 } }, grid: { color: '#151515' } } } }
  });

  const cCtx = document.getElementById('candleChart').getContext('2d');
  candleChart = new Chart(cCtx, {
    type: 'bar',
    data: {
      labels: Array.from({length: 24}, (_, i) => i),
      datasets: [{
        data: Array.from({length: 24}, () => [rand(70, 74), rand(76, 82)]),
        backgroundColor: Array(24).fill(0).map(() => Math.random() > 0.4 ? 'rgba(0,255,0,0.5)' : 'rgba(255,0,0,0.5)'),
        borderColor: Array(24).fill(0).map(() => Math.random() > 0.4 ? '#00FF00' : '#FF0000'),
        borderWidth: 1, barPercentage: 0.55
      }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
      scales: { x: { ticks: { color: '#444', maxTicksLimit: 6, font: { size: 8 } }, grid: { display: false } }, y: { ticks: { color: '#444', font: { size: 8 } }, grid: { color: '#151515' } } } }
  });

  const fCtx = document.getElementById('flowChart').getContext('2d');
  flowChart = new Chart(fCtx, {
    type: 'line',
    data: { labels: Array.from({length: 30}, (_, i) => i), datasets: [{ data: Array.from({length: 30}, () => rand(-1, 1)), borderColor: '#FFD700', borderWidth: 1, tension: 0.4, pointRadius: 0 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { ticks: { color: '#555', font: { size: 8 } }, grid: { color: '#151515' } } } }
  });
}

function animateCharts(d) {
  if (volChart) { volChart.data.datasets[0].data = Array.from({length: 20}, () => rand(0.8, 1.2)); volChart.update('none'); }
  if (candleChart && d.chartData?.candles?.length) {
    const c = d.chartData.candles;
    candleChart.data.labels = c.map((_, i) => i);
    candleChart.data.datasets[0].data = c.map(x => [x.l, x.h]);
    candleChart.data.datasets[0].backgroundColor = c.map(x => x.c >= x.o ? 'rgba(0,255,0,0.5)' : 'rgba(255,0,0,0.5)');
    candleChart.data.datasets[0].borderColor = c.map(x => x.c >= x.o ? '#00FF00' : '#FF0000');
    candleChart.update('none');
  }
  if (flowChart) { flowChart.data.datasets[0].data = Array.from({length: 30}, () => rand(-1, 1)); flowChart.update('none'); }
}

function renderRanker() {
  const tokens = ['WIF', 'BONK', 'PEPE', 'POPCAT', 'MEW'];
  document.getElementById('ranker').innerHTML = tokens.map(t => {
    const dir = Math.random() > 0.5 ? 'LONG' : 'SHORT';
    return `<tr><td>${t}</td><td class="${dir==='LONG'?'buy':'sell'}">${dir}</td><td>${rand(2,18).toFixed(1)}%</td></tr>`;
  }).join('');
}

function renderTrace(logs) {
  const el = document.getElementById('trace');
  if (!logs || !logs.length) { el.innerHTML = '<div class="trace-row">NO LOGS</div>'; return; }
  el.innerHTML = logs.slice(0, 16).map(l => {
    const t = new Date(l.time).toLocaleTimeString('en-GB', { hour12: false });
    return `<div class="trace-row"><span class="t">${t}</span><span class="ag">${l.agent}</span>${(l.message||'').slice(0,42)}</div>`;
  }).join('');
}

function renderPosition(t) {
  const el = document.getElementById('positions');
  if (!t) { el.innerHTML = 'NO ACTIVE TRADES'; return; }
  const cur = ((t.simPrice || t.entryPrice) - t.entryPrice) / t.entryPrice * 100;
  const peak = (t.peakPrice - t.entryPrice) / t.entryPrice * 100;
  el.innerHTML = `
    <div class="token">${t.token}${t.moonshot ? ' 🚀' : ''}</div>
    <div class="row"><span>ENTRY</span><span>$${t.entryPrice.toFixed(4)}</span></div>
    <div class="row"><span>SIZE</span><span>${t.sizeSol} SOL</span></div>
    <div class="row"><span>CURRENT</span><span class="${cur>=0?'buy':'sell'}">${cur.toFixed(1)}%</span></div>
    <div class="row"><span>PEAK</span><span class="buy">+${peak.toFixed(1)}%</span></div>
    <div class="row"><span>TRAIL</span><span class="${t.trailingActive?'trail':''}">${t.trailingActive ? 'ACTIVE' : 'OFF'}</span></div>
  `;
}

function renderCore(t) {
  const el = document.getElementById('core-content');
  if (!t) { el.innerHTML = 'GROK'; return; }
  const peak = (t.peakPrice - t.entryPrice) / t.entryPrice * 100;
  el.innerHTML = `${t.token}<br>+${peak.toFixed(0)}%`;
}

function renderAgents(logs) {
  const agents = ['SCOUT','GUARD','STRATEGIST','RISK','TRADER','CHIEF'];
  const newest = logs && logs[0] ? logs[0].agent : null;
  document.getElementById('agents-row').innerHTML = agents.map(a => `<span class="agent-pill ${a===newest?'active':''}">${a}</span>`).join('');
}

async function poll() {
  try {
    const r = await fetch('/api/status');
    const d = await r.json();
    document.getElementById('eq').textContent = (d.equity || 10).toFixed(4);
    const pnl = d.totalPnl || 0;
    const pnlEl = document.getElementById('pnl');
    pnlEl.textContent = (pnl >= 0 ? '+' : '') + pnl.toFixed(4);
    pnlEl.className = pnl >= 0 ? 'pos' : 'neg';
    const total = (d.wins || 0) + (d.losses || 0);
    document.getElementById('trades').textContent = total;
    document.getElementById('wr').textContent = total ? ((d.wins / total) * 100).toFixed(0) + '%' : '0%';
    renderTrace(d.agentLogs || []);
    renderPosition(d.openTrade);
    renderCore(d.openTrade);
    renderAgents(d.agentLogs || []);
    animateCharts(d);
    renderRanker();
  } catch (e) {}
}

initCharts();
setInterval(poll, 2000);
poll();
