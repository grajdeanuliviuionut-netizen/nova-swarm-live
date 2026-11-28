const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const STATE_PATH = path.join(__dirname, 'data', 'state.json');

if (!fs.existsSync(path.join(__dirname, 'data'))) fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });

const DEFAULT = {
  openTrade: null,
  dailyPnl: 0,
  totalPnl: 0,
  wins: 0,
  losses: 0,
  equity: 10.0,
  agentLogs: [],
  chiefBriefing: 'Big-win desk online.',
  chiefMood: 'calm',
  chartData: { pnl: [0], candles: [] },
  lastReset: new Date().toISOString().slice(0, 10)
};

function load() {
  try { if (fs.existsSync(STATE_PATH)) return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')); } catch (e) {}
  return JSON.parse(JSON.stringify(DEFAULT));
}
function save(s) { fs.writeFileSync(STATE_PATH, JSON.stringify(s, null, 2)); }

let state = load();
if (state.equity < 10) state.equity = 10;

function log(agent, message) {
  state.agentLogs.unshift({ agent, message, time: Date.now() });
  if (state.agentLogs.length > 100) state.agentLogs.pop();
  save(state);
}

function resetDaily() {
  const today = new Date().toISOString().slice(0, 10);
  if (state.lastReset !== today) {
    state.dailyPnl = 0;
    state.lastReset = today;
    log('SYSTEM', 'Daily PnL reset');
  }
}

async function scan() {
  if (state.openTrade || state.dailyPnl <= -0.5) return;
  try {
    log('SCOUT', 'Scanning DexScreener...');
    const res = await axios.get('https://api.dexscreener.com/latest/dex/search?q=SOL', { timeout: 7000 });
    const pairs = (res.data.pairs || []).filter(p => {
      if (p.chainId !== 'solana') return false;
      if ((p.liquidity?.usd || 0) < 30000) return false;
      if ((p.volume?.m5 || 0) < 20000) return false;
      const ch5 = p.priceChange?.m5 || 0;
      return ch5 >= 5 && ch5 <= 25;
    });
    if (!pairs.length) { log('SCOUT', 'No setups'); return; }
    pairs.sort((a, b) => (b.volume?.m5 || 0) - (a.volume?.m5 || 0));
    const pick = pairs[0];
    log('GUARD', `${pick.baseToken.symbol} liq $${Math.round(pick.liquidity.usd)}`);
    log('STRATEGIST', `5m +${pick.priceChange.m5.toFixed(1)}%`);
    log('RISK', '0.05 SOL approved');
    openTrade(pick);
  } catch (e) { log('SCOUT', 'Scan error'); }
}

function openTrade(pair) {
  const price = parseFloat(pair.priceUsd || 0);
  if (!price) return;
  const moonshot = Math.random() < 0.20;
  state.openTrade = {
    token: pair.baseToken.symbol,
    pairAddress: pair.pairAddress,
    entryPrice: price,
    sizeSol: 0.05,
    entryTime: Date.now(),
    sl: price * 0.90,
    peakPrice: price,
    trailingActive: false,
    timeStop: Date.now() + 10 * 60 * 1000,
    moonshot,
    simPrice: price
  };
  log('TRADER', `BUY ${state.openTrade.token} @ $${price.toFixed(6)}${moonshot ? ' [MOONSHOT]' : ''}`);
  state.chiefBriefing = `Opened ${state.openTrade.token}`;
  state.chiefMood = 'alert';
  save(state);
}

function simulatePrice(t) {
  const elapsed = (Date.now() - t.entryTime) / 1000;
  if (t.moonshot) {
    const progress = Math.min(elapsed / 300, 1);
    const mult = 1 + progress * (1 + Math.random() * 4);
    return t.entryPrice * mult * (0.95 + Math.random() * 0.1);
  }
  const drift = 1 + (Math.random() - 0.45) * 0.08;
  return Math.max(t.entryPrice * 0.7, t.simPrice * drift);
}

async function checkTrade() {
  if (!state.openTrade) return;
  const t = state.openTrade;
  const price = simulatePrice(t);
  t.simPrice = price;

  if (price > t.peakPrice) t.peakPrice = price;
  const gain = (price - t.entryPrice) / t.entryPrice;

  if (gain >= 0.10 && t.sl < t.entryPrice) {
    t.sl = t.entryPrice;
    log('RISK', 'Breakeven stop set');
  }
  if (gain >= 0.20) t.trailingActive = true;

  let reason = null;
  if (price <= t.sl) reason = t.trailingActive ? 'TRAIL STOP' : 'STOP LOSS';
  else if (t.trailingActive && price <= t.peakPrice * 0.85) reason = 'TRAIL STOP';
  else if (Date.now() >= t.timeStop) reason = 'TIME STOP';

  if (reason) {
    const raw = (price - t.entryPrice) / t.entryPrice;
    const pnl = +(t.sizeSol * (raw - 0.01)).toFixed(6);
    state.dailyPnl = +(state.dailyPnl + pnl).toFixed(6);
    state.totalPnl = +(state.totalPnl + pnl).toFixed(6);
    state.equity = +(state.equity + pnl).toFixed(6);
    if (pnl > 0) state.wins++; else state.losses++;
    state.chartData.pnl.push(state.totalPnl);
    if (state.chartData.pnl.length > 50) state.chartData.pnl.shift();
    state.chartData.candles.push({ o: t.entryPrice, h: Math.max(t.entryPrice, t.peakPrice), l: Math.min(t.entryPrice, price), c: price });
    if (state.chartData.candles.length > 30) state.chartData.candles.shift();

    log('TRADER', `CLOSED ${t.token} ${reason} PnL ${pnl.toFixed(4)} SOL`);
    state.chiefBriefing = pnl > 0 ? `+${pnl.toFixed(4)} on ${t.token}` : `${reason}`;
    state.chiefMood = pnl > 0 ? 'happy' : 'alert';
    state.openTrade = null;
    save(state);
  }
}

setInterval(() => {
  resetDaily();
  if (!state.openTrade && state.dailyPnl > -0.5) scan();
  else if (state.openTrade) checkTrade();
}, 10000);

if (!state.agentLogs.length) {
  log('SYSTEM', 'Big-win desk ready. 10 SOL. Trailing stops on.');
  log('CHIEF', 'Standing by.');
}

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/status', (req, res) => {
  res.json({
    openTrade: state.openTrade,
    dailyPnl: state.dailyPnl,
    totalPnl: state.totalPnl,
    wins: state.wins,
    losses: state.losses,
    equity: state.equity,
    agentLogs: state.agentLogs.slice(0, 40),
    chiefBriefing: state.chiefBriefing,
    chiefMood: state.chiefMood,
    chartData: state.chartData
  });
});

app.listen(PORT, () => console.log('Big-win desk on :' + PORT));
