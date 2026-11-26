// Node id map and path sequence matching the SVG
const nodeMap = {
  SCOUT: 'node-SCOUT',
  GUARD: 'node-GUARD',
  STRATEGIST: 'node-STRATEGIST',
  RISK: 'node-RISK',
  TRADER: 'node-TRADER',
  CHIEF: 'node-CHIEF'
};

const pathOrder = [
  { from: 'SCOUT', path: 'path-scout-guard', to: 'GUARD' },
  { from: 'GUARD', path: 'path-guard-strat', to: 'STRATEGIST' },
  { from: 'STRATEGIST', path: 'path-strat-risk', to: 'RISK' },
  { from: 'RISK', path: 'path-risk-trader', to: 'TRADER' },
  { from: 'TRADER', path: 'path-trader-chief', to: 'CHIEF' }
];

let lastProcessedTs = 0;
let currentAnim = null;

function setActiveNode(agent) {
  Object.values(nodeMap).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
  });
  const el = document.getElementById(nodeMap[agent]);
  if (el) el.classList.add('active');
}

function clearActive() {
  document.querySelectorAll('.node.active').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.line.active').forEach(l => l.classList.remove('active'));
  const packet = document.getElementById('data-packet');
  if (packet) packet.classList.remove('active');
}

function animatePacket(pathId, duration = 1000) {
  return new Promise(resolve => {
    const path = document.getElementById(pathId);
    const packet = document.getElementById('data-packet');
    if (!path || !packet) { resolve(); return; }

    path.classList.add('active');
    packet.classList.add('active');

    const length = path.getTotalLength();
    let start = null;

    function step(timestamp) {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      const point = path.getPointAtLength(progress * length);

      const svg = document.getElementById('swarm-svg');
      const svgPoint = svg.createSVGPoint();
      svgPoint.x = point.x;
      svgPoint.y = point.y;
      const ctm = svg.getScreenCTM();
      const screen = svgPoint.matrixTransform(ctm);

      const containerRect = document.getElementById('swarm-container').getBoundingClientRect();
      packet.style.left = (screen.x - containerRect.left - 6) + 'px';
      packet.style.top = (screen.y - containerRect.top - 6) + 'px';

      if (progress < 1) {
        currentAnim = requestAnimationFrame(step);
      } else {
        path.classList.remove('active');
        packet.classList.remove('active');
        resolve();
      }
    }
    currentAnim = requestAnimationFrame(step);
  });
}

function formatTime(ts) {
  if (!ts) return '--:--:--';
  const d = new Date(typeof ts === 'number' ? ts : parseInt(ts, 10));
  return d.toLocaleTimeString('en-GB', { hour12: false });
}

function renderLogs(logs) {
  const container = document.getElementById('agent-logs');
  if (!logs || !logs.length) {
    container.innerHTML = '<div class="log-entry"><span class="time">--</span>No logs yet</div>';
    return;
  }
  container.innerHTML = logs.map(log => {
    const agentClass = (log.agent || '').toLowerCase().replace('strategist', 'strat');
    return `
      <div class="log-entry ${agentClass}">
        <span class="time">${formatTime(log.time)}</span>
        <span class="agent">${log.agent || 'SYS'}</span>${log.message || ''}
      </div>`;
  }).join('');
}

function updateUI(data) {
  const tradeEl = document.getElementById('active-trade');
  if (data.openTrade) {
    const t = data.openTrade;
    tradeEl.innerHTML = `
      <strong>${t.token || 'TOKEN'}</strong><br>
      Entry: $${Number(t.entryPrice || 0).toFixed(6)}<br>
      Size: ${t.sizeSol || 0.02} SOL
    `;
  } else {
    tradeEl.textContent = 'No open trade';
  }

  const daily = Number(data.dailyPnl || 0);
  document.getElementById('daily-pnl').textContent = (daily >= 0 ? '+' : '') + daily.toFixed(4) + ' SOL';
  document.getElementById('daily-pnl').style.color = daily >= 0 ? 'var(--green)' : 'var(--red)';

  const wins = Number(data.wins || 0);
  const losses = Number(data.losses || 0);
  const totalClosed = wins + losses;
  const winRate = totalClosed ? ((wins / totalClosed) * 100).toFixed(1) : '0.0';
  document.getElementById('win-rate').textContent = winRate + '%';
  document.getElementById('closed').textContent = totalClosed;

  const totalPnl = Number(data.totalPnl || 0);
  document.getElementById('total-pnl').textContent = (totalPnl >= 0 ? '+' : '') + totalPnl.toFixed(4) + ' SOL';

  const brief = document.getElementById('chief-briefing');
  brief.textContent = data.chiefBriefing || 'Standing by...';
  const mood = (data.chiefMood || 'calm').toLowerCase();
  brief.className = 'content ' + (['calm', 'alert', 'happy', 'concerned'].includes(mood) ? mood : 'calm');

  renderLogs(data.agentLogs || []);

  const newest = data.agentLogs && data.agentLogs[0];
  if (newest && newest.time) {
    const ts = typeof newest.time === 'number' ? newest.time : parseInt(newest.time, 10);
    const age = Date.now() - ts;
    if (ts > lastProcessedTs && age < 5000 && age >= 0) {
      lastProcessedTs = ts;
      const agent = newest.agent;
      setActiveNode(agent);
      const link = pathOrder.find(p => p.from === agent);
      if (link) {
        if (currentAnim) cancelAnimationFrame(currentAnim);
        animatePacket(link.path, 1000).then(() => {
          setTimeout(clearActive, 300);
        });
      } else {
        setTimeout(clearActive, 1800);
      }
    }
  }
}

async function poll() {
  try {
    const res = await fetch('/api/status');
    if (!res.ok) throw new Error('bad status');
    const data = await res.json();
    updateUI(data);
    document.getElementById('status-pill').textContent = 'ONLINE';
  } catch (err) {
    document.getElementById('status-pill').textContent = 'OFFLINE';
  }
}

setInterval(poll, 2000);
poll();
