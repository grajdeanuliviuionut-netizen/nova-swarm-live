const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const STATE_PATH = path.join(__dirname, 'data', 'state.json');

if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
}

const DEFAULT_STATE = {
  openTrade: null,
  dailyPnl: 0,
  wins: 0,
  losses: 0,
  totalPnl: 0,
  equity: 1.0,
  agentLogs: [],
  chiefBriefing: 'Swarm online. Scanning Solana memecoins.',
  chiefMood: 'calm',
  lastReset: new Date().toISOString().slice(0, 10)
};

function loadState() {
  try {
    if (fs.existsSync(STATE_PATH)) {
      return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
    }
  } catch (e) {}
  return { ...DEFAULT_STATE };
}

function saveState(state) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

let state = loadState();

function addLog(agent, message) {
  const entry = {
    ts: Date.now(),
    time: new Date().toLocaleTimeString('en-GB', { hour12: false }),
    agent,
    message
  };
  state.agentLogs.unshift(entry);
  if (state.agentLogs.length > 100) state.agentLogs.pop();
  saveState(state);
}

function resetDailyIfNeeded() {
  const today = new Date().toISOString().slice(0, 10);
  if (state.lastReset !== today) {
    state.dailyPnl = 0;
    state.lastReset = today;
    addLog('SYSTEM', 'Daily PnL reset.');
    saveState(state);
  }
}

async function scanPools() {
  if (state.openTrade || state.dailyPnl <= -0.05) return;
  try {
    addLog('SCOUT', 'Querying DexScreener for Solana pairs...');
    const res = await axios.get('https://api.dexscreener.com/latest/dex/search?q=SOL', { timeout: 8000 });
    const pairs = (res.data.pairs || []).filter(p => p.chainId === 'solana' && p.liquidity?.usd > 50000);
    if (!pairs.length) {
      addLog('SCOUT', 'No pools above $50k liquidity found.');
      return;
    }
    pairs.sort((a, b) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0));
    const pick = pairs[0];
    addLog('GUARD', `Candidate: ${pick.baseToken.symbol}/${pick.quoteToken.symbol} liq $${Math.round(pick.liquidity.usd)}`);
    addLog('STRATEGIST', `Volume 24h: $${Math.round(pick.volume?.h24 || 0)}. Setup looks viable.`);
    addLog('RISK', 'Position size 0.02 SOL approved. Max loss ~0.0016 SOL.');
    openTrade(pick);
  } catch (err) {
    addLog('SCOUT', `Scan error: ${err.message}`);
  }
}

function openTrade(pair) {
  const price = parseFloat(pair.priceUsd || pair.priceNative || 0);
  if (!price) return;
  state.openTrade = {
    pairAddress: pair.pairAddress,
    symbol: pair.baseToken.symbol,
    entryPrice: price,
    sizeSol: 0.02,
    entryTime: Date.now(),
    sl: price * 0.92,
    tp: price * 1.15,
    timeStop: Date.now() + 45 * 60 * 1000
  };
  addLog('TRADER', `PAPER BUY ${state.openTrade.symbol} @ $${price.toFixed(6)} size 0.02 SOL`);
  state.chiefBriefing = `Opened long ${state.openTrade.symbol}. Watching SL/TP.`;
  state.chiefMood = 'alert';
  saveState(state);
}

async function checkOpenTrade() {
  if (!state.openTrade) return;
  const t = state.openTrade;
  try {
    const res = await axios.get(`https://api.dexscreener.com/latest/dex/pairs/solana/${t.pairAddress}`, { timeout: 6000 });
    const pair = res.data.pairs?.[0];
    if (!pair) return;
    const price = parseFloat(pair.priceUsd || 0);
    if (!price) return;

    const now = Date.now();
    let closeReason = null;
    let pnlSol = 0;

    if (price <= t.sl) closeReason = 'STOP LOSS';
    else if (price >= t.tp) closeReason = 'TAKE PROFIT';
    else if (now >= t.timeStop) closeReason = 'TIME STOP';

    if (closeReason) {
      const rawReturn = (price - t.entryPrice) / t.entryPrice;
      const afterCost = rawReturn - 0.01;
      pnlSol = +(t.sizeSol * afterCost).toFixed(6);
      state.dailyPnl = +(state.dailyPnl + pnlSol).toFixed(6);
      state.totalPnl = +(state.totalPnl + pnlSol).toFixed(6);
      state.equity = +(state.equity + pnlSol).toFixed(6);
      if (pnlSol > 0) state.wins++; else state.losses++;

      addLog('TRADER', `CLOSED ${t.symbol} ${closeReason} @ $${price.toFixed(6)} PnL ${pnlSol.toFixed(4)} SOL`);
      state.chiefBriefing = closeReason === 'TAKE PROFIT'
        ? `Nice. +${pnlSol.toFixed(4)} SOL on ${t.symbol}.`
        : `Stopped ${t.symbol}. ${closeReason}. PnL ${pnlSol.toFixed(4)} SOL.`;
      state.chiefMood = pnlSol > 0 ? 'happy' : 'alert';
      state.openTrade = null;
      saveState(state);
    }
  } catch (err) {
    addLog('RISK', `Price check failed: ${err.message}`);
  }
}

setInterval(() => {
  resetDailyIfNeeded();
  if (!state.openTrade && state.dailyPnl > -0.05) scanPools();
  else if (state.openTrade) checkOpenTrade();
}, 12000);

if (state.agentLogs.length === 0) {
  addLog('SYSTEM', 'NOVA Swarm initialized. Paper trading only. Size 0.02 SOL.');
  addLog('CHIEF', 'Standing by for high-conviction Solana setups.');
}

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/status', (req, res) => {
  res.json({
    openTrade: state.openTrade,
    dailyPnl: state.dailyPnl,
    wins: state.wins,
    losses: state.losses,
    totalPnl: state.totalPnl,
    equity: state.equity,
    agentLogs: state.agentLogs.slice(0, 40),
    chiefBriefing: state.chiefBriefing,
    chiefMood: state.chiefMood
  });
});

app.listen(PORT, () => {
  console.log(`NOVA Swarm live on :${PORT}`);
});
