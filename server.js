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
  equity: 1.0,
  agentLogs: [],
  chiefBriefing: 'Desk online. Scanning.',
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
  if (state.openTrade || state.dailyPnl <= -0.05) return;
  try {
    log('SCOUT', 'Scanning DexScreener...');
    const res = await axios.get('https://api.dexscreener.com/latest/dex/search?q=SOL', { timeout: 7000 });
    const pairs = (res.data.pairs || []).filter(p => {
      if (p.chainId !== 'solana') return false;
      if ((p.liquidity?.usd || 0) < 50000) return false;
      if ((p.volume?.m5 || 0) < 20000) return false;
      const ch5 = p.priceChange?.m5 || 0;
      if (ch5 < 5 || ch5 > 20) return false;
      if (p.baseToken?.info?.mintAuthority) return false;
      if (p.baseToken?.info?.freezeAuthority) return false;
      return true;
    });
    if (!pairs.length) { log('SCOUT', 'No setups matching filters'); return; }
    pairs.sort((a, b) => (b.volume?.m5 || 0) - (a.volume?.m5 || 0));
    const pick = pairs[0];
    log('GUARD', `${pick.baseToken.symbol} liq $${Math.round(pick.liquidity.usd)} 5m vol $${Math.round(pick.volume.m5)}`);
    log('STRATEGIST', `5m change +${pick.priceChange.m5.toFixed(1)}%`);
    log('RISK', '0.02 SOL approved');
    openTrade(pick);
  } catch (e) { log('SCOUT', 'Scan error'); }
}

function openTrade(pair) {
  const price = parseFloat(pair.priceUsd || 0);
  if (!price) return;
  state.openTrade = {
    token: pair.baseToken.symbol,
    pairAddress: pair.pairAddress,
    entryPrice: price,
    sizeSol: 0.02,
    entryTime: Date.now(),
    sl: price * 0.92,
    tp: price * 1.35,
    timeStop: Date.now() + 15 * 60 * 1000,
    trailing: false,
    high: price
  };
  log('TRADER', `BUY ${state.openTrade.token} @ $${price.toFixed(6)}`);
  state.chiefBriefing = `Opened ${state.openTrade.token}`;
  state.chiefMood = 'alert';
  save(state);
}

async function checkTrade() {
  if (!state.openTrade) return;
  const t = state.openTrade;
  try {
    const res = await axios.get(`https://api.dexscreener.com/latest/dex/pairs/solana/${t.pairAddress}`, { timeout: 5000 });
    const pair = res.data.pairs?.[0];
    if (!pair) return;
    const price = parseFloat(pair.priceUsd || 0);
    if (!price) return;

    if (price > t.high) t.high = price;
    const gain = (price - t.entryPrice) / t.entryPrice;
    if (gain >= 0.20 && t.sl < t.entryPrice * 1.10) {
      t.sl = t.entryPrice * 1.10;
      t.trailing = true;
      log('RISK', 'Trail moved to +10%');
    } else if (gain >= 0.10 && t.sl < t.entryPrice) {
      t.sl = t.entryPrice;
      t.trailing = true;
      log('RISK', 'Trail moved to breakeven');
    }

    let reason = null;
    if (price <= t.sl) reason = t.trailing ? 'TRAIL STOP' : 'STOP LOSS';
    else if (price >= t.tp) reason = 'TAKE PROFIT';
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
      state.chartData.candles.push({ o: t.entryPrice, h: Math.max(t.entryPrice, price), l: Math.min(t.entryPrice, price), c: price });
      if (state.chartData.candles.length > 30) state.chartData.candles.shift();

      log('TRADER', `CLOSED ${t.token} ${reason} PnL ${pnl.toFixed(4)} SOL`);
      state.chiefBriefing = pnl > 0 ? `+${pnl.toFixed(4)} on ${t.token}` : `${reason} on ${t.token}`;
      state.chiefMood = pnl > 0 ? 'happy' : 'alert';
      state.openTrade = null;
      save(state);
    }
  } catch (e) { log('RISK', 'Price check failed'); }
}

setInterval(() => {
  resetDaily();
  if (!state.openTrade && state.dailyPnl > -0.05) scan();
  else if (state.openTrade) checkTrade();
}, 10000);

if (!state.agentLogs.length) {
  log('SYSTEM', 'Desk initialized. Trailing stops active.');
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

app.listen(PORT, () => console.log('Desk live on :' + PORT));
