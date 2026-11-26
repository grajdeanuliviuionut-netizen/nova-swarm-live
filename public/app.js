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

let lastLogTs = 0;
let packetAnim = null;

function pulseNode(agent) {
  const el = document.getElementById(nodeMap[agent]);
  if (!el) return;
  el.classList.add('active');
  setTimeout(() => el.classList.remove('active'), 2200);
}

function animatePacket(pathId, duration = 900) {
  return new Promise(resolve => {
    const path = document.getElementById(pathId);
    const packet = document.getElementById('data-packet');
    if (!path || !packet) { resolve(); return; }
    path.classList.add('active');
    packet.classList.add('active');
    const len = path.getTotalLength();
    let start = null;

    function step(ts) {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const pt = path.getPointAtLength(p * len);
      const svg = document.getElementById('swarm-svg');
      const svgPt = svg.createSVGPoint();
      svgPt.x = pt.x; svgPt.y = pt.y;
      const ctm = svg.getScreenCTM();
      const screen = svgPt.matrixTransform(ctm);
      const container = document.getElementById('swarm-container').getBoundingClientRect();
      packet.style.left = (screen.x - container.left - 5) + 'px';
      packet.style.top = (screen.y - container.top - 5) + 'px';
      if (p < 1) packetAnim = requestAnimationFrame(step);
      else {
        path.classList.remove('active');
        packet.classList.remove('active');
        resolve();
      }
    }
    packetAnim = requestAnimationFrame(step);
  });
}

function renderLogs(logs) {
  const el = document.getElementById('agent-logs');
  el.innerHTML = logs.map(l => `
    <div class="log-entry ${l.agent.toLowerCase().replace('strategist','strat')}">
      <span class="time">${l.time}</span>
      <span class="agent">${l.agent}</span>${l.message}
    </div>`).join('');
}

async function poll() {
  try {
    const res = await fetch('/api/status');
    const s = await res.json();

    document.getElementById('equity').textContent = s.equity.toFixed(4);
    document.getElementById('daily-pnl').textContent = (s.dailyPnl >= 0 ? '+' : '') + s.dailyPnl.toFixed(4) + ' SOL';
    document.getElementById('daily-pnl').style.color = s.dailyPnl >= 0 ? 'var(--green)' : 'var(--red)';
    const total = s.wins + s.losses;
    document.getElementById('win-rate').textContent = total ? ((s.wins / total) * 100).toFixed(1) + '%' : '0%';
    document.getElementById('total-pnl').textContent = (s.totalPnl >= 0 ? '+' : '') + s.totalPnl.toFixed(4) + ' SOL';
    document.getElementById('closed').textContent = total;

    const at = document.getElementById('active-trade');
    if (s.openTrade) {
      at.innerHTML = `<strong>LONG</strong> ${s.openTrade.symbol}<br>Size: ${s.openTrade.sizeSol} SOL<br>Entry: $${s.openTrade.entryPrice.toFixed(6)}`;
      at.className = 'content';
    } else {
      at.textContent = 'No open trade';
      at.className = 'content';
    }

    const brief = document.getElementById('chief-briefing');
    brief.textContent = s.chiefBriefing;
    brief.className = 'content ' + (s.chiefMood || 'calm');

    renderLogs(s.agentLogs || []);

    if (s.agentLogs && s.agentLogs[0]) {
      const newest = s.agentLogs[0];
      if (newest.ts > lastLogTs && Date.now() - newest.ts < 4000) {
        lastLogTs = newest.ts;
        const agent = newest.agent;
        pulseNode(agent);
        const link = pathOrder.find(p => p.from === agent);
        if (link) animatePacket(link.path, 1000);
      }
    }
  } catch (e) {}
}

setInterval(poll, 2000);
poll();
