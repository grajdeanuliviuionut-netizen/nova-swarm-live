// NOVA Swarm Live — app.js
const agents = ['SCOUT', 'GUARD', 'STRATEGIST', 'RISK', 'TRADER', 'CHIEF'];
const nodeMap = {
  SCOUT: 'node-SCOUT',
  GUARD: 'node-GUARD',
  STRATEGIST: 'node-STRATEGIST',
  RISK: 'node-RISK',
  TRADER: 'node-TRADER',
  CHIEF: 'node-CHIEF'
};

let equity = 12450.80;
let dailyPnl = 0;
let wins = 0;
let losses = 0;
let closed = 0;
let paused = false;
let logInterval;

const equityEl = document.getElementById('equity');
const equity2El = document.getElementById('equity-2');
const dailyPnlEl = document.getElementById('daily-pnl');
const winRateEl = document.getElementById('win-rate');
const closedEl = document.getElementById('closed');
const activeTradeEl = document.getElementById('active-trade');
const logsEl = document.getElementById('agent-logs');
const briefingEl = document.getElementById('chief-briefing');
const pauseBtn = document.getElementById('pause-btn');

function updateMetrics() {
  equityEl.textContent = `$${equity.toFixed(2)}`;
  equity2El.textContent = `$${equity.toFixed(2)}`;
  dailyPnlEl.textContent = dailyPnl >= 0 ? `+$${dailyPnl.toFixed(2)}` : `-$${Math.abs(dailyPnl).toFixed(2)}`;
  dailyPnlEl.style.color = dailyPnl >= 0 ? 'var(--green)' : 'var(--red)';
  const total = wins + losses;
  const rate = total ? ((wins / total) * 100).toFixed(1) : '0.0';
  winRateEl.textContent = `${rate}%`;
  closedEl.textContent = closed;
}

function addLog(agent, message) {
  const time = new Date().toLocaleTimeString('en-GB', { hour12: false });
  const entry = document.createElement('div');
  entry.className = `log-entry ${agent.toLowerCase().replace('strategist','strat')}`;
  entry.innerHTML = `<span class="time">${time}</span><span class="agent">${agent}</span>${message}`;
  logsEl.prepend(entry);
  if (logsEl.children.length > 80) logsEl.lastChild.remove();
}

function pulseNode(agent) {
  const node = document.getElementById(nodeMap[agent]);
  if (!node) return;
  node.classList.add('active', 'pulse');
  setTimeout(() => node.classList.remove('active', 'pulse'), 1800);
}

function randomTrade() {
  const sides = ['LONG', 'SHORT'];
  const pairs = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT'];
  const side = sides[Math.floor(Math.random()*sides.length)];
  const pair = pairs[Math.floor(Math.random()*pairs.length)];
  const size = (Math.random()*0.8 + 0.2).toFixed(3);
  const entry = (Math.random()*200 + 50).toFixed(2);
  return { side, pair, size, entry };
}

function simulateCycle() {
  if (paused) return;

  // Scout
  pulseNode('SCOUT');
  addLog('SCOUT', 'Scanning order flow & liquidations...');
  
  setTimeout(() => {
    if (paused) return;
    pulseNode('GUARD');
    addLog('GUARD', 'Risk filters passed. Volatility within bounds.');

    setTimeout(() => {
      if (paused) return;
      pulseNode('STRATEGIST');
      const bias = Math.random() > 0.45 ? 'bullish' : 'bearish';
      addLog('STRATEGIST', `Confluence detected. Bias: ${bias.toUpperCase()}`);

      setTimeout(() => {
        if (paused) return;
        pulseNode('RISK');
        addLog('RISK', 'Position size approved. Max loss 1.2%.');

        setTimeout(() => {
          if (paused) return;
          const trade = randomTrade();
          pulseNode('TRADER');
          addLog('TRADER', `Executing ${trade.side} ${trade.size} ${trade.pair} @ ${trade.entry}`);
          activeTradeEl.innerHTML = `
            <strong>${trade.side}</strong> ${trade.pair}<br>
            Size: ${trade.size}<br>
            Entry: $${trade.entry}
          `;
          activeTradeEl.className = 'content ' + (trade.side === 'LONG' ? 'bullish' : 'bearish');

          setTimeout(() => {
            if (paused) return;
            pulseNode('CHIEF');
            const outcome = Math.random() > 0.42;
            const pnl = outcome ? +(Math.random()*180 + 20).toFixed(2) : -(Math.random()*90 + 15).toFixed(2);
            equity += pnl;
            dailyPnl += pnl;
            closed++;
            if (outcome) wins++; else losses++;
            updateMetrics();

            const summary = outcome 
              ? `Closed +$${pnl.toFixed(2)}. Equity rising. Hold bias.`
              : `Stopped -$${Math.abs(pnl).toFixed(2)}. Tightening filters.`;
            briefingEl.textContent = summary;
            briefingEl.className = 'content ' + (outcome ? 'bullish' : 'bearish');
            addLog('CHIEF', summary);
            activeTradeEl.textContent = 'No open trade';
            activeTradeEl.className = 'content';
          }, 2200);
        }, 900);
      }, 800);
    }, 700);
  }, 600);
}

pauseBtn.addEventListener('click', () => {
  paused = !paused;
  pauseBtn.textContent = paused ? 'RESUME' : 'PAUSE';
  pauseBtn.classList.toggle('paused', paused);
  if (!paused) {
    addLog('SYSTEM', 'Swarm resumed');
    startSimulation();
  } else {
    addLog('SYSTEM', 'Swarm paused');
    clearInterval(logInterval);
  }
});

function startSimulation() {
  if (logInterval) clearInterval(logInterval);
  logInterval = setInterval(simulateCycle, 8500);
  simulateCycle(); // kick off immediately
}

// Initial state
updateMetrics();
addLog('SYSTEM', 'NOVA Swarm initialized. All agents online.');
briefingEl.textContent = 'Monitoring market structure. Awaiting high-conviction setup.';
startSimulation();
