const assert = require('assert');
const R = require('../src/engine.js');
const D = R.DEFAULTS;
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('  ok  ' + name); } catch (e) { fail++; console.log('FAIL  ' + name + '\n      ' + e.message); } }
const near = (a, b, tol, m) => assert(Math.abs(a - b) <= (tol || 1e-9), (m || '') + ' expected ' + b + ' got ' + a);

/* zero-cost, fine-step base config */
const Z = Object.assign({}, D, {
  makerFeePct: 0, takerFeePct: 0, slippagePct: 0, fundingRatePct: 0, qtyStep: 1e-8, minQty: 0,
  side: 'long', equity: 45, freeBalance: 45, entry: 100000, stopMode: 'pct', targetMode: 'rr', stopPct: 1, rr: 3
});

t('Long: SL/TP direction', () => {
  const r = R.computePosition(Z);
  near(r.slPrice, 99000, 1e-6); near(r.tpPrice, 103000, 1e-6); assert(r.ok);
});
t('Short: SL/TP direction', () => {
  const r = R.computePosition(Object.assign({}, Z, { side: 'short' }));
  near(r.slPrice, 101000, 1e-6); near(r.tpPrice, 97000, 1e-6); assert(r.ok);
});
t('Risk budget, notional, qty, margin (45 USDT, 1%, 1% stop, 3x)', () => {
  const r = R.computePosition(Z);
  near(r.riskBudget, 0.45); near(r.notional, 45, 1e-6); near(r.qty, 0.00045, 1e-9);
  near(r.margin, 15, 1e-6); near(r.grossRisk, 0.45, 1e-6); near(r.grossReward, 1.35, 1e-6);
  near(r.netRR, 3, 1e-9); near(r.breakevenWR, 25, 1e-9);
});
t('Quantity rounds DOWN, risk never exceeds budget', () => {
  const r = R.computePosition(Object.assign({}, Z, { qtyStep: 0.0001, minQty: 0.0001 }));
  near(r.qty, 0.0004, 1e-12); near(r.notional, 40, 1e-9); assert(r.netLoss <= 0.45 + 1e-12);
});
t('floorTo float safety', () => {
  near(R.floorTo(0.3, 0.1), 0.3, 1e-12); near(R.floorTo(0.00045, 0.0001), 0.0004, 1e-12);
  assert.strictEqual(R.floorTo(0.00009, 0.0001), 0);
});
t('Leverage cap: capped size, flagged, not silent', () => {
  const r = R.computePosition(Object.assign({}, Z, { stopPct: 0.3 }));
  assert(r.warnings.includes('WARN_CAPPED_MARGIN')); assert.strictEqual(r.status, 'adjusted');
  near(r.notional, 135, 1e-6); near(r.effLeverage, 3, 1e-9); assert(r.netLoss < 0.45);
});
t('capMode=block rejects instead of reducing', () => {
  const r = R.computePosition(Object.assign({}, Z, { stopPct: 0.3, capMode: 'block' }));
  assert(!r.ok && r.errors.includes('ERR_MARGIN'));
});
t('Leverage above configured max is blocked', () => {
  const r = R.computePosition(Object.assign({}, Z, { leverage: 5 }));
  assert(!r.ok && r.errors.includes('ERR_LEV_CAP'));
});
t('Fees+slippage inside risk budget: net loss == budget', () => {
  const c = Object.assign({}, Z, { makerFeePct: 0.02, takerFeePct: 0.06, slippagePct: 0.02, entryType: 'taker', tpType: 'maker', slType: 'taker' });
  const r = R.computePosition(c);
  const lossFrac = 0.01 + 0.0006 + 0.0006 + 0.0002 + 0.0002;
  near(r.notional, 0.45 / lossFrac, 2e-3);          /* qty rounded down at 1e-8 BTC */
  assert(r.netLoss <= 0.45 + 1e-12); near(r.netLoss, 0.45, 1e-4);
});
t('Net P&L reconciliation (components add up)', () => {
  const c = Object.assign({}, Z, { makerFeePct: 0.02, takerFeePct: 0.06, slippagePct: 0.02, fundingRatePct: 0.01, holdHours: 16, qtyStep: 0.00001 });
  const r = R.computePosition(c);
  near(r.netLoss, r.grossRisk + r.fees.entry + r.fees.sl + r.slippage.entry + r.slippage.sl + r.funding, 1e-9);
  near(r.netWin, r.grossReward - r.fees.entry - r.fees.tp - r.slippage.entry - r.slippage.tp - r.funding, 1e-9);
});
t('Funding sign: long pays / short receives on positive rate', () => {
  near(R.fundingFraction('long', 0.01, 8, 8), 0.0001, 1e-12);
  near(R.fundingFraction('short', 0.01, 8, 8), -0.0001, 1e-12);
  near(R.fundingFraction('long', 0.01, 24, 8), 0.0003, 1e-12);
});
t('Drawdown floor blocks new trades', () => {
  const r = R.computePosition(Object.assign({}, Z, { equity: 38.25, freeBalance: 38.25 }));
  assert(!r.ok && r.errors.includes('ERR_DD_HALT'));
});
t('Risk clamped to remaining drawdown buffer (flagged)', () => {
  const r = R.computePosition(Object.assign({}, Z, { equity: 38.5, freeBalance: 38.5 }));
  assert(r.warnings.includes('WARN_RISK_CLAMPED_DD')); near(r.riskBudget, 0.25, 1e-12); assert(38.5 - r.netLoss >= 38.25 - 1e-9);
});
t('Minimum quantity enforced', () => {
  const r = R.computePosition(Object.assign({}, Z, { qtyStep: 0.001, minQty: 0.001 }));
  assert(!r.ok && r.errors.includes('ERR_MIN_QTY'));
});
t('Invalid inputs rejected', () => {
  assert(R.computePosition(Object.assign({}, Z, { stopPct: -1 })).errors.includes('ERR_STOP'));
  assert(R.computePosition(Object.assign({}, Z, { entry: NaN })).errors.includes('ERR_ENTRY'));
  assert(R.computePosition(Object.assign({}, Z, { equity: 0 })).errors.includes('ERR_EQUITY'));
  assert(R.computePosition(Object.assign({}, Z, { stopMode: 'price', stopPrice: 101000 })).errors.includes('ERR_STOP_SIDE'));
  assert(R.computePosition(Object.assign({}, Z, { side: 'short', stopMode: 'price', stopPrice: 99000 })).errors.includes('ERR_STOP_SIDE'));
  assert(R.computePosition(Object.assign({}, Z, { makerFeePct: -1 })).errors.includes('ERR_COST'));
});
t('Stop/target by price mode', () => {
  const r = R.computePosition(Object.assign({}, Z, { stopMode: 'price', stopPrice: 99500, targetMode: 'price', targetPrice: 101500 }));
  near(r.stopPct, 0.5, 1e-9); near(r.targetPct, 1.5, 1e-9); near(r.rrGross, 3, 1e-9);
});
t('Liquidation estimate and stop-beyond-liquidation block', () => {
  const r = R.computePosition(Z); near(r.liqPrice, 100000 * (1 - (1 / 3 - 0.005)), 1e-6);
  const x = R.computePosition(Object.assign({}, Z, { maxLeverage: 100, leverage: 100, stopPct: 2 }));
  assert(x.errors.includes('ERR_STOP_BEYOND_LIQ'));
});
t('Theoretical expectancy (40% win, 1:3, zero cost) = 0.6R', () => {
  const th = R.theoretical(40, 3, 1); near(th.expectancyR, 0.6, 1e-12); near(th.breakevenWR, 25, 1e-12); near(th.profitFactor, 2, 1e-12);
});
t('Analytics on known series', () => {
  const a = R.analyze([3, -1, 3, -1, -1], [45, 48, 47, 50, 49, 48]);
  near(a.winRate, 40); near(a.profitFactor, 2); near(a.expectancy, 0.6); near(a.avgWin, 3); near(a.avgLoss, 1);
  assert.strictEqual(a.streaks.maxLoss, 2); near(a.maxDDUsd, 2);
});
t('Planner: 30 all-loss compounded trades halt at drawdown floor, never below', () => {
  const rows = Array.from({ length: 30 }, (_, i) => ({ side: R.sideFor(i, 'alternate'), outcome: 'loss' }));
  const p = R.runPlan(D, rows, { mode: 'compound' });
  assert(p.halted); assert(Math.min(...p.curve) >= p.floor - 1e-9, 'min ' + Math.min(...p.curve));
  assert(p.rows.some(r => r.status === 'halted'));
});
t('Planner: daily trade limit respected', () => {
  const rows = R.evenOutcomes(30, 40).map((o, i) => ({ side: R.sideFor(i, 'alternate'), outcome: o }));
  const p = R.runPlan(Object.assign({}, D, { maxDailyLossPct: 0 }), rows);
  const perDay = {}; p.rows.forEach(r => { if (r.day) perDay[r.day] = (perDay[r.day] || 0) + 1; });
  Object.values(perDay).forEach(c => assert(c <= D.maxDailyTrades));
  assert.strictEqual(p.rows[2].day, 2);
});
t('Planner: compound vs fixed differ after wins, equal on first trade', () => {
  const rows = Array.from({ length: 6 }, () => ({ side: 'long', outcome: 'win' }));
  const c = R.runPlan(D, rows, { mode: 'compound' }), f = R.runPlan(D, rows, { mode: 'fixed' });
  near(c.rows[0].pnl, f.rows[0].pnl, 0.01); assert(c.summary.finalEquity > f.summary.finalEquity);
});
t('Planner: equity reconciles with sum of pnl', () => {
  const rows = R.seededOutcomes(30, 40, 7).map((o, i) => ({ side: R.sideFor(i, 'alternate'), outcome: o }));
  const p = R.runPlan(D, rows); near(p.summary.finalEquity, 45 + p.pnls.reduce((a, b) => a + b, 0), 1e-9);
});
t('evenOutcomes win count', () => { assert.strictEqual(R.evenOutcomes(30, 40).filter(x => x === 'win').length, 12); });
t('Monte Carlo reproducible by seed', () => {
  const a = R.monteCarlo(D, { paths: 300, seed: 1 }), b = R.monteCarlo(D, { paths: 300, seed: 1 }), c = R.monteCarlo(D, { paths: 300, seed: 2 });
  assert.deepStrictEqual(a.pct, b.pct); assert.notDeepStrictEqual(a.pct, c.pct);
});
t('Monte Carlo extremes: 0% win => all halted; 100% win => all profitable, none halted', () => {
  const z = R.monteCarlo(D, { paths: 100, winRatePct: 0 }); near(z.probHalt, 100); assert(z.min >= z.floor - 1e-9);
  const o = R.monteCarlo(D, { paths: 100, winRatePct: 100 }); near(o.probProfit, 100); near(o.probHalt, 0);
});
t('Monte Carlo percentile ordering + equity never below floor', () => {
  const m = R.monteCarlo(D, { paths: 500, seed: 9 });
  assert(m.pct.p5 <= m.pct.p50 && m.pct.p50 <= m.pct.p95); assert(m.min >= m.floor - 1e-9);
  assert.strictEqual(m.bands.p50.length, 31);
});
t('Growth projection: compound >= fixed for positive expectancy', () => {
  const g = R.growthProjection({ initial: 45, riskPct: 1, netRR: 3, winRatePct: 40, n: 30 });
  assert(g.expectedCompound[30] > g.expectedFixed[30]); near(g.meanPerTrade, 0.01 * (0.4 * 3 - 0.6), 1e-12);
});
t('CSV escaping and formula-injection guard', () => {
  const csv = R.toCSV([{ a: 'x,"y"', b: '=1+1', c: 1.5, d: null }], [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }, { key: 'c', label: 'C' }, { key: 'd', label: 'D' }]);
  assert.strictEqual(csv, 'A,B,C,D\r\n"x,""y""",\'=1+1,1.5,');
});
t('FX: 45 USDT <-> 12,000,000 toman at default rate', () => {
  near(R.toLocal(45, D.fxRate), 12000000, 1e-3); near(R.fromLocal(12000000, D.fxRate), 45, 1e-9);
});
t('Guards: daily trades, drawdown, daily loss, consecutive', () => {
  const s = Object.assign({}, D, { maxConsecLosses: 3 });
  const g = R.checkGuards(s, { equity: 38, initialEquity: 45, tradesToday: 2, pnlToday: -0.95, dayStartEquity: 45, consecLosses: 3 });
  ['GUARD_DD', 'GUARD_DAILY_TRADES', 'GUARD_DAILY_LOSS', 'GUARD_CONSEC'].forEach(x => assert(g.reasons.includes(x), x));
  assert(R.checkGuards(D, { equity: 45, initialEquity: 45, tradesToday: 0, pnlToday: 0, dayStartEquity: 45, consecLosses: 0 }).allowed);
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
