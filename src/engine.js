/* engine.js — Pro Risk & Reward calculation engine (pure functions, no DOM).
 * All percent-type inputs are in PERCENT units (1 = 1%). All results are ESTIMATES,
 * not actual exchange execution. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RRE = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- editable defaults (fees/funding/specs are PLACEHOLDERS, verify on exchange) ---------- */
  var DEFAULTS = {
    exchange: 'LBank', pair: 'BTC/USDT', marginMode: 'isolated',
    initialEquity: 45,
    fxRate: 12000000 / 45, fxUnit: 'toman', fxStamp: '',
    entryPrice: 100000,
    maxLeverage: 3, leverage: 3,
    riskPct: 1, maxDrawdownPct: 15,
    rr: 3, stopPct: 1, targetPct: 3,
    planTrades: 30, maxDailyTrades: 2, maxDailyLossPct: 2, maxConsecLosses: 0,
    makerFeePct: 0.02, takerFeePct: 0.06, slippagePct: 0.02,
    entryType: 'taker', tpType: 'maker', slType: 'taker',
    fundingRatePct: 0.01, fundingIntervalH: 8, holdHours: 8,
    qtyStep: 0.0001, minQty: 0.0001, minNotional: 0,
    mmrPct: 0.5,
    costsInRisk: true, capMode: 'cap',
    winRatePct: 35, mcPaths: 2000, seed: 12345, compoundMode: 'compound'
  };

  /* ---------- helpers ---------- */
  function num(x) {
    var v = typeof x === 'string' ? parseFloat(x) : x;
    return (typeof v === 'number' && isFinite(v)) ? v : NaN;
  }
  function nz(x) { var v = num(x); return isNaN(v) ? 0 : v; }
  function stepDecimals(step) {
    if (!(step > 0)) return 8;
    var d = 0, x = step;
    while (d < 12 && Math.abs(Math.round(x) - x) > 1e-9) { x *= 10; d++; }
    return d;
  }
  /* round DOWN to the permitted step (never up) */
  function floorTo(x, step) {
    if (!(x > 0) || !(step > 0)) return 0;
    var n = Math.floor(x / step * (1 + 1e-12) + 1e-12);
    return Number((n * step).toFixed(stepDecimals(step)));
  }
  function mulberry32(seed) {
    var a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function percentile(sorted, q) {
    var n = sorted.length;
    if (!n) return NaN;
    if (n === 1) return sorted[0];
    var pos = (n - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  }
  function toLocal(usd, rate) { return usd * rate; }
  function fromLocal(local, rate) { return rate > 0 ? local / rate : NaN; }

  /* ---------- funding estimate ----------
   * cost as a FRACTION of notional; positive = paid, negative = received.
   * Long pays when rate > 0, short receives (and vice-versa). Expected value over hold time. */
  function fundingFraction(side, ratePct, holdHours, intervalH) {
    var dir = side === 'short' ? -1 : 1;
    var periods = intervalH > 0 ? holdHours / intervalH : 0;
    return dir * (ratePct / 100) * periods;
  }

  /* ---------- core: position calculator ---------- */
  function invalid(errors, side) {
    return {
      ok: false, status: 'blocked', errors: errors, warnings: [], side: side,
      qty: 0, notional: 0, margin: 0, netLoss: 0, netWin: 0, grossRisk: 0, grossReward: 0,
      riskBudget: 0, isEstimate: true
    };
  }

  function computePosition(p) {
    var Er = [], W = [];
    var side = p.side === 'short' ? 'short' : 'long';
    var dir = side === 'long' ? 1 : -1;
    var E = num(p.equity), P = num(p.entry), L = num(p.leverage), maxL = num(p.maxLeverage);
    var init = num(p.initialEquity), maxDD = nz(p.maxDrawdownPct);

    if (!(E > 0)) Er.push('ERR_EQUITY');
    if (!(P > 0)) Er.push('ERR_ENTRY');
    if (!(L >= 1)) Er.push('ERR_LEV_MIN');
    else if (isFinite(maxL) && L > maxL) Er.push('ERR_LEV_CAP');

    var maker = num(p.makerFeePct), taker = num(p.takerFeePct), slip = nz(p.slippagePct);
    if (isNaN(maker)) maker = 0; if (isNaN(taker)) taker = 0;
    if (maker < 0 || taker < 0 || slip < 0) Er.push('ERR_COST');

    /* stop distance s (fraction) */
    var s = NaN;
    if (p.stopMode === 'price') {
      var sp = num(p.stopPrice);
      if (!(sp > 0)) Er.push('ERR_STOP');
      else {
        s = P > 0 ? dir * (P - sp) / P : NaN;
        if (!(s > 0)) Er.push('ERR_STOP_SIDE');
      }
    } else {
      s = num(p.stopPct) / 100;
      if (!(s > 0 && s < 1)) Er.push('ERR_STOP');
    }
    /* target distance t (fraction) */
    var t = NaN;
    if (p.targetMode === 'price') {
      var tp0 = num(p.targetPrice);
      if (!(tp0 > 0)) Er.push('ERR_TARGET');
      else {
        t = P > 0 ? dir * (tp0 - P) / P : NaN;
        if (!(t > 0)) Er.push('ERR_TARGET_SIDE');
      }
    } else if (p.targetMode === 'pct') {
      t = num(p.targetPct) / 100;
      if (!(t > 0)) Er.push('ERR_TARGET');
    } else {
      var rr = num(p.rr);
      if (!(rr > 0)) Er.push('ERR_RR'); else if (s > 0) t = s * rr;
    }
    if (side === 'short' && t >= 1) Er.push('ERR_TARGET');

    /* drawdown floor */
    var floor = isNaN(init) ? 0 : init * (1 - maxDD / 100);
    var buffer = E - floor;
    if (E > 0 && !isNaN(init) && buffer <= 1e-12) Er.push('ERR_DD_HALT');

    if (Er.length) return invalid(Er, side);

    /* cost model (fractions of notional) */
    var fEntry = (p.entryType === 'maker' ? maker : taker) / 100;
    var fTP = (p.tpType === 'taker' ? taker : maker) / 100;
    var fSL = (p.slType === 'maker' ? maker : taker) / 100;
    var sl = slip / 100;
    var slipEntry = p.entryType === 'maker' ? 0 : sl;
    var slipTP = p.tpType === 'taker' ? sl : 0;
    var slipSL = p.slType === 'maker' ? 0 : sl;
    var fund = fundingFraction(side, nz(p.fundingRatePct), nz(p.holdHours), nz(p.fundingIntervalH));

    var costStop = fEntry + fSL + slipEntry + slipSL;
    var costTP = fEntry + fTP + slipEntry + slipTP;
    var lossFrac = s + costStop + fund;     /* net loss per $ notional if SL hits */
    var winFrac = t - costTP - fund;        /* net gain per $ notional if TP hits */

    /* risk budget (clamped to remaining drawdown buffer — never silent) */
    var R0 = (p.riskBudgetUsd != null && isFinite(p.riskBudgetUsd)) ? num(p.riskBudgetUsd) : E * nz(p.riskPct) / 100;
    if (!(R0 > 0)) return invalid(['ERR_RISK'], side);
    var R = R0;
    if (!isNaN(init) && R0 > buffer) { R = buffer; W.push('WARN_RISK_CLAMPED_DD'); }

    var sizingLoss = p.costsInRisk === false ? s : s + costStop + Math.max(fund, 0);
    var N0 = R / sizingLoss;

    /* margin / leverage cap: margin + entry fee must fit in free balance */
    var free = (p.freeBalance != null && isFinite(p.freeBalance)) ? num(p.freeBalance) : E;
    var capN = Math.max(free, 0) / (1 / L + fEntry);
    var N1 = N0;
    if (N0 > capN + 1e-12) {
      if (p.capMode === 'block') Er.push('ERR_MARGIN');
      else { N1 = capN; W.push('WARN_CAPPED_MARGIN'); }
    }

    /* quantity: round DOWN to step */
    var step = num(p.qtyStep) > 0 ? num(p.qtyStep) : 1e-8;
    var Q = floorTo(N1 / P, step);
    var minQ = nz(p.minQty);
    if (!(Q > 0) || Q < minQ - 1e-15) {
      Er.push('ERR_MIN_QTY');
      /* risk was clamped to the remaining drawdown buffer and that buffer cannot fund a minimum order */
      if (W.indexOf('WARN_RISK_CLAMPED_DD') >= 0) Er.push('ERR_DD_BUFFER');
    }
    var Nq = Q * P;
    if (nz(p.minNotional) > 0 && Nq < p.minNotional) Er.push('ERR_MIN_NOTIONAL');
    if (Q > 0 && N1 > 0 && Nq < N1 * 0.9) W.push('WARN_ROUNDING_BIG');

    var margin = Nq / L;
    var grossRisk = Nq * s, grossReward = Nq * t;
    var netLoss = Nq * lossFrac, netWin = Nq * winFrac;
    if (netWin <= 0) W.push('WARN_NET_REWARD_NEG');
    if (netLoss > R * (1 + 1e-9) + 1e-12 && Nq > 0) W.push('WARN_RISK_OVER_BUDGET');

    /* liquidation estimate (isolated, simplified) */
    var mmr = nz(p.mmrPct) / 100;
    var liqDist = 1 / L - mmr;
    var liqPrice = P * (1 - dir * liqDist);
    if (!(liqDist > 0)) Er.push('ERR_STOP_BEYOND_LIQ');
    else if (s >= liqDist) Er.push('ERR_STOP_BEYOND_LIQ');
    else if (s > 0.5 * liqDist) W.push('WARN_LIQ_CLOSE');

    if (!isNaN(init) && E - netLoss < floor - 1e-9) W.push('WARN_BREACH_DD_FLOOR');

    var be = (netWin > 0 && netLoss > 0) ? netLoss / (netLoss + netWin) * 100 : (netLoss > 0 ? 100 : NaN);
    var status = Er.length ? 'blocked' : (W.some(function (w) { return w === 'WARN_CAPPED_MARGIN' || w === 'WARN_RISK_CLAMPED_DD'; }) ? 'adjusted' : 'ok');

    return {
      ok: Er.length === 0, status: status, errors: Er, warnings: W, isEstimate: true,
      side: side, entry: P, equity: E, leverage: L,
      slPrice: P * (1 - dir * s), tpPrice: P * (1 + dir * t),
      stopPct: s * 100, targetPct: t * 100, rrGross: t / s,
      riskBudget: R, riskBudgetRequested: R0,
      qty: Q, qtyUncapped: N0 / P, notional: Nq, notionalTarget: N1,
      margin: margin, effLeverage: Nq / E,
      liqPrice: liqPrice, liqDistPct: liqDist * 100,
      grossRisk: grossRisk, grossReward: grossReward,
      fees: { entry: Nq * fEntry, tp: Nq * fTP, sl: Nq * fSL },
      slippage: { entry: Nq * slipEntry, tp: Nq * slipTP, sl: Nq * slipSL },
      funding: Nq * fund,
      netLoss: netLoss, netWin: netWin,
      netRR: netLoss > 0 ? netWin / netLoss : NaN,
      breakevenWR: be,
      riskPctEquity: netLoss / E * 100,
      costs: { loss: netLoss - grossRisk, win: grossReward - netWin },
      floor: floor, buffer: buffer
    };
  }

  /* ---------- guards ---------- */
  function streaks(pnls) {
    var maxW = 0, maxL = 0, cw = 0, cl = 0;
    for (var i = 0; i < pnls.length; i++) {
      if (pnls[i] > 0) { cw++; cl = 0; if (cw > maxW) maxW = cw; }
      else if (pnls[i] < 0) { cl++; cw = 0; if (cl > maxL) maxL = cl; }
      else { cw = 0; cl = 0; }
    }
    return { maxWin: maxW, maxLoss: maxL, currentLoss: cl, currentWin: cw };
  }

  /* st: {equity, initialEquity, tradesToday, pnlToday, dayStartEquity, consecLosses} */
  function checkGuards(s, st) {
    var reasons = [];
    var floor = st.initialEquity * (1 - s.maxDrawdownPct / 100);
    if (st.equity <= floor + 1e-9) reasons.push('GUARD_DD');
    if (st.tradesToday >= s.maxDailyTrades) reasons.push('GUARD_DAILY_TRADES');
    var ds = st.dayStartEquity > 0 ? st.dayStartEquity : st.equity;
    if (s.maxDailyLossPct > 0 && -st.pnlToday >= s.maxDailyLossPct / 100 * ds - 1e-9) reasons.push('GUARD_DAILY_LOSS');
    if (s.maxConsecLosses > 0 && st.consecLosses >= s.maxConsecLosses) reasons.push('GUARD_CONSEC');
    return { allowed: reasons.length === 0, reasons: reasons };
  }

  /* ---------- outcome generators ---------- */
  function evenOutcomes(n, winRatePct) {
    var w = Math.round(n * winRatePct / 100), out = [];
    for (var i = 0; i < n; i++) out.push(Math.floor((i + 1) * w / n) > Math.floor(i * w / n) ? 'win' : 'loss');
    return out;
  }
  function seededOutcomes(n, winRatePct, seed) {
    var rnd = mulberry32(seed), out = [];
    for (var i = 0; i < n; i++) out.push(rnd() < winRatePct / 100 ? 'win' : 'loss');
    return out;
  }
  function sideFor(i, mode) { return mode === 'long' ? 'long' : mode === 'short' ? 'short' : (i % 2 === 0 ? 'long' : 'short'); }

  /* ---------- sequential trade planner ----------
   * rows: [{side, outcome: win|loss|pending|skip, entry?}] ; mode: compound | fixed */
  function runPlan(s, rows, opts) {
    opts = opts || {};
    var mode = opts.mode || s.compoundMode || 'compound';
    var init = s.initialEquity, floor = init * (1 - s.maxDrawdownPct / 100);
    var E = init, peak = init, day = 1, dayTrades = 0, dayStart = E, dayPnl = 0, consec = 0, halted = false;
    var out = [], curve = [init], pnls = [];
    var wins = 0, losses = 0, grossSum = 0, costSum = 0, maxDDp = 0, executed = 0;
    var q = Object.assign({}, s);

    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var row = { i: i + 1, side: r.side === 'short' ? 'short' : 'long', outcome: r.outcome, entry: r.entry > 0 ? r.entry : s.entryPrice };
      if (r.outcome === 'skip') { row.status = 'skip'; row.eqBefore = E; row.eqAfter = E; out.push(row); continue; }
      if (halted || E <= floor + 1e-9) { halted = true; row.status = 'halted'; row.eqBefore = E; row.eqAfter = E; out.push(row); continue; }

      if (dayTrades >= s.maxDailyTrades) { day++; dayTrades = 0; dayStart = E; dayPnl = 0; }
      if (s.maxDailyLossPct > 0 && -dayPnl >= s.maxDailyLossPct / 100 * dayStart - 1e-9) { day++; dayTrades = 0; dayStart = E; dayPnl = 0; }
      if (s.maxConsecLosses > 0 && consec >= s.maxConsecLosses) {
        row.status = 'paused'; row.eqBefore = E; row.eqAfter = E; consec = 0; out.push(row); continue;
      }

      q.side = row.side; q.entry = row.entry; q.equity = E; q.freeBalance = E;
      q.stopMode = 'pct'; q.targetMode = 'rr';
      q.riskBudgetUsd = mode === 'fixed' ? init * s.riskPct / 100 : null;
      var pos = computePosition(q);
      row.day = day; row.eqBefore = E;
      if (!pos.ok) {
        row.status = (pos.errors.indexOf('ERR_DD_HALT') >= 0 || pos.errors.indexOf('ERR_DD_BUFFER') >= 0) ? 'halted' : 'invalid';
        if (row.status === 'halted') halted = true;
        row.errors = pos.errors; row.eqAfter = E; out.push(row); continue;
      }
      row.qty = pos.qty; row.notional = pos.notional; row.margin = pos.margin;
      row.risk = pos.netLoss; row.reward = pos.netWin; row.warnings = pos.warnings;
      dayTrades++;
      if (r.outcome === 'win' || r.outcome === 'loss') {
        var win = r.outcome === 'win';
        row.gross = win ? pos.grossReward : -pos.grossRisk;
        row.costs = win ? pos.costs.win : pos.costs.loss;
        row.pnl = win ? pos.netWin : -pos.netLoss;
        E += row.pnl; dayPnl += row.pnl;
        if (win) { wins++; consec = 0; } else { losses++; consec++; }
        grossSum += row.gross; costSum += row.costs; executed++; pnls.push(row.pnl);
        row.status = 'executed';
      } else { row.status = 'pending'; row.pnl = 0; row.gross = 0; row.costs = 0; }
      if (E > peak) peak = E;
      row.eqAfter = E;
      row.ddPeakPct = (peak - E) / peak * 100;
      row.ddInitPct = Math.max(0, (init - E) / init * 100);
      if (row.ddPeakPct > maxDDp) maxDDp = row.ddPeakPct;
      curve.push(E);
      out.push(row);
    }
    return {
      rows: out, curve: curve, pnls: pnls, floor: floor, halted: halted,
      summary: {
        finalEquity: E, peak: peak, netPnl: E - init, returnPct: (E / init - 1) * 100,
        maxDDPct: maxDDp, executed: executed, wins: wins, losses: losses,
        winRate: executed ? wins / executed * 100 : NaN,
        gross: grossSum, costs: costSum, days: day
      }
    };
  }

  /* ---------- analytics ---------- */
  function analyze(pnls, curve) {
    var n = pnls.length, wins = 0, losses = 0, gw = 0, gl = 0;
    for (var i = 0; i < n; i++) {
      if (pnls[i] > 0) { wins++; gw += pnls[i]; } else if (pnls[i] < 0) { losses++; gl += -pnls[i]; }
    }
    var avgWin = wins ? gw / wins : 0, avgLoss = losses ? gl / losses : 0;
    var wr = n ? wins / n : NaN;
    var exp = n ? (gw - gl) / n : NaN;
    var peak = -Infinity, mdd = 0, mddUsd = 0;
    (curve || []).forEach(function (v) {
      if (v > peak) peak = v;
      var d = peak > 0 ? (peak - v) / peak * 100 : 0;
      if (d > mdd) mdd = d;
      if (peak - v > mddUsd) mddUsd = peak - v;
    });
    return {
      n: n, wins: wins, losses: losses, winRate: wr * 100,
      avgWin: avgWin, avgLoss: avgLoss, payoff: avgLoss > 0 ? avgWin / avgLoss : NaN,
      expectancy: exp, expectancyR: avgLoss > 0 ? exp / avgLoss : NaN,
      profitFactor: gl > 0 ? gw / gl : (gw > 0 ? Infinity : NaN),
      grossWins: gw, grossLosses: gl, net: gw - gl,
      maxDDPct: mdd, maxDDUsd: mddUsd, streaks: streaks(pnls)
    };
  }

  /* theoretical expectancy from win rate and per-trade net win/loss (USD) */
  function theoretical(winRatePct, netWin, netLoss) {
    var p = winRatePct / 100;
    var e = p * netWin - (1 - p) * netLoss;
    return {
      expectancy: e,
      expectancyR: netLoss > 0 ? e / netLoss : NaN,
      breakevenWR: (netWin + netLoss) > 0 ? netLoss / (netWin + netLoss) * 100 : NaN,
      profitFactor: (1 - p) * netLoss > 0 ? p * netWin / ((1 - p) * netLoss) : Infinity
    };
  }

  /* ---------- compound / fixed growth projection (expected values) ---------- */
  function growthProjection(o) {
    var r = o.riskPct / 100, p = o.winRatePct / 100, R = o.netRR, n = o.n;
    var m = r * (p * R - (1 - p));               /* mean return per trade as fraction of base */
    var g = (1 + r * R > 0 && 1 - r > 0) ? p * Math.log(1 + r * R) + (1 - p) * Math.log(1 - r) : NaN;
    var comp = [], fixed = [], typical = [];
    for (var k = 0; k <= n; k++) {
      comp.push(o.initial * Math.pow(1 + m, k));
      fixed.push(o.initial * (1 + k * m));
      typical.push(o.initial * Math.exp(k * g));
    }
    return { expectedCompound: comp, expectedFixed: fixed, typicalGeometric: typical, meanPerTrade: m, logGrowth: g };
  }

  /* ---------- Monte Carlo (hypothetical, seeded, reproducible) ---------- */
  function monteCarlo(s, o) {
    var paths = Math.max(1, Math.min(50000, Math.floor(o.paths || s.mcPaths || 2000)));
    var T = Math.max(1, Math.floor(o.trades || s.planTrades));
    var wr = (o.winRatePct != null ? o.winRatePct : s.winRatePct) / 100;
    var mode = o.mode || s.compoundMode || 'compound';
    var seed = o.seed != null ? o.seed : s.seed;
    var sideMode = o.sideMode || 'alternate';
    var rnd = mulberry32(seed);
    var init = s.initialEquity, floor = init * (1 - s.maxDrawdownPct / 100);
    var q = Object.assign({}, s, { stopMode: 'pct', targetMode: 'rr', entry: o.entry > 0 ? o.entry : s.entryPrice });
    var matrix = [], finals = [], maxDDs = [], lossStreaks = [], halts = 0, skipped = 0, profitable = 0;

    for (var pI = 0; pI < paths; pI++) {
      var E = init, peak = init, mdd = 0, curve = new Array(T + 1), halted = false, cl = 0, ml = 0;
      curve[0] = E;
      for (var t = 0; t < T; t++) {
        if (!halted && E <= floor + 1e-9) { halted = true; halts++; }
        var win = rnd() < wr;   /* always draw, keeps sequences comparable across settings */
        if (!halted) {
          q.side = sideFor(t, sideMode); q.equity = E; q.freeBalance = E;
          q.riskBudgetUsd = mode === 'fixed' ? init * s.riskPct / 100 : null;
          var pos = computePosition(q);
          if (pos.ok) {
            E += win ? pos.netWin : -pos.netLoss;
            if (win) cl = 0; else { cl++; if (cl > ml) ml = cl; }
          } else if (pos.errors.indexOf('ERR_DD_HALT') >= 0 || pos.errors.indexOf('ERR_DD_BUFFER') >= 0) {
            halted = true; halts++;
          } else skipped++;
          if (E > peak) peak = E;
          var d = (peak - E) / peak * 100; if (d > mdd) mdd = d;
        }
        curve[t + 1] = E;
      }
      if (!halted && E <= floor + 1e-9) { halted = true; halts++; }
      matrix.push(curve); finals.push(E); maxDDs.push(mdd); lossStreaks.push(ml);
      if (E > init) profitable++;
    }
    var sf = finals.slice().sort(function (a, b) { return a - b; });
    var sd = maxDDs.slice().sort(function (a, b) { return a - b; });
    var sl = lossStreaks.slice().sort(function (a, b) { return a - b; });
    var pc = function (arr, q2) { return percentile(arr, q2); };
    var bands = { p5: [], p25: [], p50: [], p75: [], p95: [] };
    var col = new Array(paths);
    for (var k = 0; k <= T; k++) {
      for (var j = 0; j < paths; j++) col[j] = matrix[j][k];
      col.sort(function (a, b) { return a - b; });
      bands.p5.push(pc(col, 0.05)); bands.p25.push(pc(col, 0.25)); bands.p50.push(pc(col, 0.5));
      bands.p75.push(pc(col, 0.75)); bands.p95.push(pc(col, 0.95));
    }
    var lo = sf[0], hi = sf[sf.length - 1], nb = 20, w = (hi - lo) / nb || 1, hist = [];
    for (var b = 0; b < nb; b++) hist.push({ from: lo + b * w, to: lo + (b + 1) * w, count: 0 });
    finals.forEach(function (v) { var idx = Math.min(nb - 1, Math.floor((v - lo) / w)); hist[idx].count++; });
    var mean = finals.reduce(function (a, b2) { return a + b2; }, 0) / paths;
    return {
      hypothetical: true, paths: paths, trades: T, winRatePct: wr * 100, mode: mode, seed: seed,
      pct: { p5: pc(sf, 0.05), p25: pc(sf, 0.25), p50: pc(sf, 0.5), p75: pc(sf, 0.75), p95: pc(sf, 0.95) },
      mean: mean, min: lo, max: hi,
      probProfit: profitable / paths * 100, probHalt: halts / paths * 100,
      medianMaxDD: pc(sd, 0.5), p95MaxDD: pc(sd, 0.95), medianLossStreak: pc(sl, 0.5), maxLossStreak: sl[sl.length - 1],
      skippedTrades: skipped, bands: bands, hist: hist, floor: floor
    };
  }

  /* ---------- CSV (RFC4180-ish, spreadsheet-formula-injection safe) ---------- */
  function csvCell(v) {
    if (v == null) return '';
    var s2 = typeof v === 'number' ? (isFinite(v) ? String(v) : '') : String(v);
    if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s2)) s2 = "'" + s2;
    if (/[",\r\n]/.test(s2)) s2 = '"' + s2.replace(/"/g, '""') + '"';
    return s2;
  }
  function toCSV(rows, cols) {
    var lines = [cols.map(function (c) { return csvCell(c.label); }).join(',')];
    rows.forEach(function (r) { lines.push(cols.map(function (c) { return csvCell(r[c.key]); }).join(',')); });
    return lines.join('\r\n');
  }

  return {
    DEFAULTS: DEFAULTS, num: num, floorTo: floorTo, stepDecimals: stepDecimals, mulberry32: mulberry32,
    percentile: percentile, toLocal: toLocal, fromLocal: fromLocal, fundingFraction: fundingFraction,
    computePosition: computePosition, checkGuards: checkGuards, streaks: streaks,
    evenOutcomes: evenOutcomes, seededOutcomes: seededOutcomes, sideFor: sideFor,
    runPlan: runPlan, analyze: analyze, theoretical: theoretical,
    growthProjection: growthProjection, monteCarlo: monteCarlo, toCSV: toCSV
  };
});
