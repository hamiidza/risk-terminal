/* app2.js — page construction and tab renderers */
var MK = [['maker', ''], ['taker', '']];
function ordOpts() { return [['maker', T('maker')], ['taker', T('taker')]]; }
function sel(v, opts) { return opts.map(function (p) { return '<option value="' + p[0] + '"' + (String(p[0]) === String(v) ? ' selected' : '') + '>' + p[1] + '</option>'; }).join(''); }
function sideOpts() { return [['long', T('long')], ['short', T('short')]]; }

function buildAll() {
  document.documentElement.lang = S.lang; document.documentElement.dir = S.lang === 'fa' ? 'rtl' : 'ltr';
  document.documentElement.setAttribute('data-theme', S.theme);
  document.title = T('title');
  $('#ttl').textContent = T('title'); $('#sub').textContent = [S.exchange, S.pair, T(S.marginMode), T('subtitle')].join(' · '); $('#banner').textContent = T('banner');
  $('#bLang').textContent = S.lang === 'fa' ? 'EN' : 'فارسی'; $('#bTheme').textContent = S.theme === 'dark' ? T('light') : T('dark');
  var IC = {
    overview: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    calc: '<rect x="4" y="2.5" width="16" height="19" rx="2.5"/><path d="M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01"/>',
    planner: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M3.5 6l1.2 1.2L7 4.8M3.5 12l1.2 1.2L7 10.8M3.5 18l1.2 1.2L7 16.8"/>',
    sim: '<path d="M3 17c3 0 3-12 6-12s3 14 6 14 3-8 6-8"/><path d="M3 21h18"/>',
    analytics: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    journal: '<path d="M5 3h12a2 2 0 0 1 2 2v16H7a2 2 0 0 1-2-2V3z"/><path d="M9 8h6M9 12h6"/>',
    settings: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2.2"/><circle cx="8" cy="17" r="2.2"/>'
  };
  $('#nav').innerHTML = TABS.map(function (t) { return '<button role="tab" data-tab="' + t + '" id="nt-' + t + '"><svg viewBox="0 0 24 24" aria-hidden="true">' + IC[t] + '</svg><span>' + T('t_' + t) + '</span></button>'; }).join('');
  var sec = function (id, inner) { return '<section id="tab-' + id + '" role="tabpanel" aria-labelledby="nt-' + id + '" hidden>' + inner + '</section>'; };
  var planN = [[30, 30], [50, 50], [100, 100], [250, 250], [500, 500]];
  var modeOpts = [['compound', T('m_compound')], ['fixed', T('m_fixed')]];
  var sideModeOpts = [['alternate', T('alt')], ['long', T('long')], ['short', T('short')]];
  var h = '';
  h += sec('overview', '<div id="o-ov"></div>');
  h += sec('calc', '<div class="cols"><div class="card" id="in-calc"><h2>' + T('h_inputs') + '</h2>' +
    seg('side', [['long', T('long')], ['short', T('short')]]) +
    field('entryPrice', { tip: 'tip_entry' }) + field('calcEquity', { ph: T('auto'), tip: 'tip_calcEquity' }) +
    '<div class="row2">' + field('riskPct', { tip: 'tip_risk' }) + field('leverage', { tip: 'tip_lev' }) + '</div>' +
    '<div class="lbl">' + T('f_stop') + '</div>' + seg('stopMode', [['pct', '%'], ['price', T('price')]]) +
    field('stopPct', { show: 'stopMode=pct' }) + field('stopPrice', { show: 'stopMode=price' }) +
    '<div class="lbl">' + T('f_target') + '</div>' + seg('targetMode', [['rr', 'R:R'], ['pct', '%'], ['price', T('price')]]) +
    field('rr', { show: 'targetMode=rr' }) + field('targetPct', { show: 'targetMode=pct' }) + field('targetPrice', { show: 'targetMode=price' }) +
    '<div class="lbl">' + T('h_exec') + '</div><div class="row3">' +
    field('entryType', { type: 'select', opts: ordOpts() }) + field('tpType', { type: 'select', opts: ordOpts() }) + field('slType', { type: 'select', opts: ordOpts() }) + '</div>' +
    field('holdHours', { tip: 'tip_hold' }) + '</div><div id="o-calc"></div></div>');
  h += sec('planner', '<div class="card"><div class="row4">' +
    field('planTrades', { type: 'select', opts: planN, num: 1 }) + field('compoundMode', { type: 'select', opts: modeOpts }) +
    field('planSide', { type: 'select', opts: sideModeOpts }) + field('winRatePct') + field('seed', { step: 1 }) + '</div>' +
    '<div class="btns"><button class="btn" data-act="fillEven">' + T('b_fillEven') + '</button><button class="btn" data-act="fillRand">' + T('b_fillRand') + '</button>' +
    '<button class="btn" data-act="clearPlan">' + T('b_clearPlan') + '</button><button class="btn" data-act="resetSides">' + T('b_resetSides') + '</button>' +
    '<button class="btn pri" data-act="exportPlan">' + T('b_exportPlan') + '</button></div></div><div id="o-pl"></div>');
  h += sec('sim', '<div class="card"><div class="row4">' + field('winRatePct') + field('mcPaths', { step: 100, min: 100, max: 20000 }) + field('seed', { step: 1 }) +
    field('planTrades', { type: 'select', opts: planN, num: 1 }) + field('compoundMode', { type: 'select', opts: modeOpts }) + field('planSide', { type: 'select', opts: sideModeOpts }) + '</div>' +
    '<div class="btns"><button class="btn pri" data-act="runSim">' + T('b_runSim') + '</button></div></div><div id="o-sim"></div>');
  h += sec('analytics', '<div class="card"><div class="row3">' +
    field('anSource', { type: 'select', opts: [['journal', T('src_journal')], ['planner', T('src_planner')]] }) + field('winRatePct') + '</div></div><div id="o-an"></div>');
  h += sec('journal', '<div class="card"><div class="btns"><button class="btn pri" data-act="addTrade">' + T('b_addTrade') + '</button>' +
    '<button class="btn" data-act="exportJ">' + T('b_exportJ') + '</button><button class="btn danger" data-act="clearJ">' + T('b_clearJ') + '</button></div>' +
    '<div class="row3">' + field('jfSide', { type: 'select', opts: [['all', T('all')], ['long', T('long')], ['short', T('short')]] }) +
    field('jfStatus', { type: 'select', opts: [['all', T('all')], ['open', T('res_open')], ['closed', T('closed')]] }) + field('jfText', { type: 'text' }) + '</div></div><div id="o-jr"></div>');
  h += sec('settings', '<div class="cols3">' +
    '<div class="card"><h2>' + T('h_account') + '</h2>' + field('initialEquity') +
    '<label class="f"><span>' + T('f_capLocal') + ' (' + unitLbl() + ')' + tip('tip_fx') + '</span><input data-sp="capLocal" type="number" inputmode="decimal" step="any" dir="ltr"></label>' +
    field('fxRate', { tip: 'tip_fx' }) + field('fxUnit', { type: 'select', opts: [['toman', T('u_toman')], ['rial', T('u_rial')]] }) + field('fxStamp', { type: 'text', ph: T('ph_fxStamp') }) +
    field('exchange', { type: 'text' }) + field('pair', { type: 'text' }) + field('marginMode', { type: 'select', opts: [['isolated', T('isolated')]] }) +
    '</div><div class="card"><h2>' + T('h_risk') + '</h2>' + field('riskPct') + field('maxLeverage') + field('leverage') + field('maxDrawdownPct') + field('rr') + field('stopPct') + field('targetPct') +
    field('maxDailyTrades', { step: 1 }) + field('maxDailyLossPct') + field('maxConsecLosses', { step: 1, tip: 'tip_consec' }) +
    '</div><div class="card"><h2>' + T('h_costs') + '</h2>' + field('makerFeePct') + field('takerFeePct') + field('slippagePct') +
    field('fundingRatePct') + field('fundingIntervalH') + field('holdHours') +
    '<h2>' + T('h_specs') + '</h2>' + field('qtyStep', { tip: 'tip_specs' }) + field('minQty') + field('minNotional') + field('mmrPct', { tip: 'tip_mmr' }) +
    '<h2>' + T('h_opts') + '</h2>' + field('costsInRisk', { type: 'check', tip: 'tip_costsInRisk' }) +
    field('capMode', { type: 'select', opts: [['cap', T('cap_cap')], ['block', T('cap_block')]], tip: 'tip_capMode' }) +
    '<div class="btns"><button class="btn danger" data-act="resetDefaults">' + T('b_reset') + '</button></div></div></div><div id="o-st"></div>');
  $('#main').innerHTML = h;
}

/* ---------- Overview ---------- */
function guardState(a) {
  return R.checkGuards(S, { equity: a.equity, initialEquity: +S.initialEquity, tradesToday: a.tradesToday, pnlToday: a.pnlToday, dayStartEquity: a.dayStart, consecLosses: a.consec });
}
function floorLines(floor) { return [{ y: +S.initialEquity, color: 'var(--m)', label: T('k_initial') }, { y: floor, color: 'var(--r)', label: T('k_floor') }]; }
function renderOverview() {
  var a = account(), pos = calcPos(a), init = +S.initialEquity, floor = init * (1 - S.maxDrawdownPct / 100);
  var ddI = Math.max(0, (init - a.equity) / init * 100), use = Math.min(100, ddI / S.maxDrawdownPct * 100);
  var pk = Math.max.apply(null, a.curve), ddP = pk > 0 ? (pk - a.equity) / pk * 100 : 0;
  var eff = a.equity > 0 ? a.exposure / a.equity : 0, g = guardState(a), plan = planRun();
  var chg = (a.equity / init - 1) * 100;
  var h = '<div class="note">' + T('src_note') + '</div><div class="kpis">' +
    kpi(T('k_initial'), both(init), T('k_initial_s')) +
    kpi(T('k_equity'), both(a.equity), '<span class="' + (chg >= 0 ? 'pos' : 'neg') + ' n">' + (chg >= 0 ? '+' : '') + pc(chg) + '</span>') +
    kpi(T('k_free'), both(a.free)) + kpi(T('k_margin'), both(a.usedMargin)) +
    kpi(T('k_exposure'), '<span class="n">' + usd(a.exposure) + '</span>', '<span class="n ' + (eff > S.maxLeverage ? 'neg' : '') + '">' + f(eff, 2) + 'x / ' + f(+S.maxLeverage, 1) + 'x</span>') +
    kpi(T('k_openrisk'), '<span class="n">' + usd(a.openRisk) + '</span>', '<span class="n">' + pc(a.equity > 0 ? a.openRisk / a.equity * 100 : NaN) + '</span>') +
    kpi(T('k_dd'), '<span class="n">' + pc(ddI) + '</span>', '<div class="meter"><i style="width:' + use + '%" class="' + (use > 80 ? 'hi' : '') + '"></i></div><span class="n">' + T('k_limit') + ' ' + pc(+S.maxDrawdownPct, 1) + ' · ' + T('k_peak') + ' ' + pc(ddP) + '</span>') +
    kpi(T('k_floor'), both(floor), T('k_floor_s')) +
    kpi(T('k_today'), '<span class="n">' + a.tradesToday + ' / ' + S.maxDailyTrades + '</span>', '<span class="n">' + usd(a.pnlToday) + '</span>') + '</div>';
  h += '<div class="card ' + (g.allowed ? 'ok' : 'bad') + '"><h2>' + T('h_guard') + '</h2>' +
    (g.allowed ? '<p class="pos">' + T('guard_ok') + '</p>' : '<ul class="msgs">' + g.reasons.map(function (r) { return '<li class="err">' + T(r) + '</li>'; }).join('') + '</ul>') + '</div>';
  h += '<div class="card"><h2>' + T('h_next') + ' ' + badge(pos.status || 'blocked') + '</h2>';
  if (isn(pos.slPrice)) h += '<div class="kpis sm">' + kpi(T('r_qty'), '<span class="n">' + qtyF(pos.qty) + ' BTC</span>') + kpi(T('r_notional'), '<span class="n">' + usd(pos.notional) + '</span>') +
    kpi(T('r_margin'), '<span class="n">' + usd(pos.margin) + '</span>') + kpi(T('r_netloss'), '<span class="n neg">' + usd(pos.netLoss) + '</span>') + kpi(T('r_netwin'), '<span class="n pos">' + usd(pos.netWin) + '</span>') + '</div>';
  h += msgs(pos) + '</div>';
  h += '<div class="cols"><div class="card"><h2>' + T('c_equity_actual') + '</h2>' +
    lineChart('ov1', { series: [{ name: T('k_equity'), color: 'var(--ac)', data: a.curve }], hl: floorLines(floor), area: true, label: T('c_equity_actual') }) + '</div>' +
    '<div class="card"><h2>' + T('c_equity_plan') + '</h2>' +
    lineChart('ov2', { series: [{ name: T('k_equity'), color: 'var(--bl)', data: plan.curve }], hl: floorLines(floor), area: true, label: T('c_equity_plan') }) + '</div></div>';
  $('#o-ov').innerHTML = h;
}

/* ---------- Calculator ---------- */
function renderCalc() {
  var a = account(), pos = calcPos(a), h = '';
  h += '<div class="card"><h2>' + T('h_result') + ' ' + badge(pos.status || 'blocked') + ' <span class="est">' + T('estimate') + '</span></h2>' + msgs(pos);
  if (isn(pos.slPrice)) {
    var tot = pos.netLoss + Math.max(pos.netWin, 0), lw = tot > 0 ? pos.netLoss / tot * 100 : 50;
    h += '<div class="rbar" aria-label="risk reward"><span class="rl" style="width:' + lw.toFixed(1) + '%">' + usd(pos.netLoss) + '</span><span class="rw" style="width:' + (100 - lw).toFixed(1) + '%">' + usd(pos.netWin) + '</span></div>';
    h += '<div class="cols"><table class="tbl"><caption>' + T('h_sizing') + '</caption>' +
      tr(T('r_side'), T(pos.side)) + tr(T('r_entry'), f(pos.entry, 2)) +
      tr(T('r_sl'), '<span class="neg">' + f(pos.slPrice, 2) + '</span> (' + pc(pos.stopPct) + ')') +
      tr(T('r_tp'), '<span class="pos">' + f(pos.tpPrice, 2) + '</span> (' + pc(pos.targetPct) + ')') +
      tr(T('r_qty'), qtyF(pos.qty) + ' BTC') + tr(T('r_qty_raw'), isn(pos.qtyUncapped) ? pos.qtyUncapped.toFixed(8) + ' BTC' : '—') +
      tr(T('r_notional'), both(pos.notional)) + tr(T('r_margin'), both(pos.margin)) +
      tr(T('r_efflev'), f(pos.effLeverage, 2) + 'x / ' + f(+S.maxLeverage, 1) + 'x') +
      tr(T('r_liq'), f(pos.liqPrice, 2) + ' (' + pc(pos.liqDistPct) + ')') + '</table>' +
      '<table class="tbl"><caption>' + T('h_rr') + '</caption>' +
      tr(T('r_budget'), both(pos.riskBudget)) +
      tr(T('r_grossrisk'), usd(pos.grossRisk, 4)) + tr(T('r_feeloss'), usd(pos.fees.entry + pos.fees.sl, 4)) + tr(T('r_slip'), usd(pos.slippage.entry + pos.slippage.sl, 4)) + tr(T('r_fund'), usd(pos.funding, 4)) +
      tr(T('r_netloss'), '<b class="neg">' + usd(pos.netLoss, 4) + '</b> · ' + loc(pos.netLoss), 'sum') +
      tr(T('r_grossreward'), usd(pos.grossReward, 4)) + tr(T('r_feewin'), usd(pos.fees.entry + pos.fees.tp, 4)) + tr(T('r_slip'), usd(pos.slippage.entry + pos.slippage.tp, 4)) + tr(T('r_fund'), usd(pos.funding, 4)) +
      tr(T('r_netwin'), '<b class="pos">' + usd(pos.netWin, 4) + '</b> · ' + loc(pos.netWin), 'sum') +
      tr(T('r_rrg'), '1 : ' + f(pos.rrGross, 2)) + tr(T('r_rrn'), '1 : ' + f(pos.netRR, 2)) + tr(T('r_be'), pc(pos.breakevenWR)) + tr(T('r_riskpct'), pc(pos.riskPctEquity, 3)) + '</table></div>';
    h += '<div class="btns"><button class="btn pri" data-act="saveCalc"' + (pos.ok ? '' : ' disabled') + '>' + T('b_saveCalc') + '</button></div>';
  }
  h += '</div>';
  if (isn(pos.notional) && pos.notional > 0) {
    var N = pos.notional, mk = +S.makerFeePct / 100, tk = +S.takerFeePct / 100, sc = [['maker', 'maker', mk, mk], ['maker', 'taker', mk, tk], ['taker', 'maker', tk, mk], ['taker', 'taker', tk, tk]];
    h += '<div class="cols"><div class="card"><h2>' + T('h_fees') + '</h2><div class="tw"><table class="tbl"><thead><tr><th>' + T('f_entryType') + ' → ' + T('f_tpType') + '</th><th>%</th><th>USDT</th><th>' + unitLbl() + '</th></tr></thead><tbody>' +
      sc.map(function (s) { var p = (s[2] + s[3]) * 100, u = N * (s[2] + s[3]); return '<tr><td>' + T(s[0]) + ' → ' + T(s[1]) + '</td><td class="n">' + f(p, 3) + '</td><td class="n">' + f(u, 4) + '</td><td class="n">' + f(u * S.fxRate, 0) + '</td></tr>'; }).join('') +
      '</tbody></table></div></div><div class="card"><h2>' + T('h_funding') + '</h2><div class="tw"><table class="tbl"><thead><tr><th>' + T('f_holdHours') + '</th><th>USDT</th><th>%</th></tr></thead><tbody>' +
      [8, 16, 24, 48, 72].map(function (hh) { var fr = R.fundingFraction(S.side, +S.fundingRatePct, hh, +S.fundingIntervalH); return '<tr><td class="n">' + hh + 'h</td><td class="n">' + usd(N * fr, 4) + '</td><td class="n">' + f(fr * 100, 4) + '</td></tr>'; }).join('') +
      '</tbody></table></div><p class="muted">' + T('fund_note') + '</p></div></div>';
  }
  $('#o-calc').innerHTML = h;
}

/* ---------- Planner ---------- */
function fKey() { var e = document.activeElement; if (e && e.dataset && e.dataset.pl !== undefined) return '[data-pl="' + e.dataset.pl + '"][data-f="' + e.dataset.f + '"]'; return null; }
function fRestore(k) { if (k) { var n = $(k); if (n) n.focus(); } }
function renderPlanner() {
  var fk = fKey(), p = planRun(), s = p.summary, init = +S.initialEquity;
  var h = '<div class="kpis">' + kpi(T('p_final'), both(s.finalEquity), '<span class="n ' + (s.returnPct >= 0 ? 'pos' : 'neg') + '">' + (s.returnPct >= 0 ? '+' : '') + pc(s.returnPct) + '</span>') +
    kpi(T('p_net'), '<span class="n">' + usd(s.netPnl) + '</span>', '<span class="n">' + T('p_costs') + ': ' + usd(s.costs) + '</span>') +
    kpi(T('k_dd'), '<span class="n">' + pc(s.maxDDPct) + '</span>', '<span class="n">' + T('k_limit') + ' ' + pc(+S.maxDrawdownPct, 1) + '</span>') +
    kpi(T('p_wl'), '<span class="n">' + s.wins + ' / ' + s.losses + '</span>', '<span class="n">' + pc(s.winRate, 1) + '</span>') +
    kpi(T('p_days'), '<span class="n">' + s.days + '</span>', '<span class="n">' + s.executed + ' ' + T('p_executed') + '</span>') +
    kpi(T('p_state'), p.halted ? '<span class="neg">' + T('p_halted') + '</span>' : '<span class="pos">' + T('p_active') + '</span>', T('p_state_s')) + '</div>';
  h += '<div class="cols"><div class="card"><h2>' + T('c_equity_plan') + '</h2>' + lineChart('pl1', { series: [{ name: T('k_equity'), color: 'var(--ac)', data: p.curve }], hl: floorLines(p.floor), area: true, label: T('c_equity_plan') }) + '</div>' +
    '<div class="card"><h2>' + T('c_dd') + '</h2>' + lineChart('pl2', { series: [{ name: '%', color: 'var(--r)', data: ddSeries(p.curve) }], area: true, zero: true, fmt: function (v) { return f(v, 1) + '%'; }, label: T('c_dd') }) + '</div></div>';
  h += '<div class="card"><h2>' + T('h_planner') + '</h2><div class="tw tall"><table class="tbl plan"><thead><tr>' +
    ['#', T('p_day'), T('r_side'), T('p_outcome'), T('r_entry'), T('r_qty'), T('r_notional'), T('r_margin'), T('p_risk'), T('p_reward'), T('p_pnl'), T('p_eq'), T('p_ddp'), T('p_status')].map(function (x) { return '<th>' + x + '</th>'; }).join('') + '</tr></thead><tbody>';
  var oo = [['pending', T('o_pending')], ['win', T('o_win')], ['loss', T('o_loss')], ['skip', T('o_skip')]];
  p.rows.forEach(function (r, i) {
    var cell = function (v, fn) { return '<td class="n">' + (v == null ? '' : fn(v)) + '</td>'; };
    var wr = (r.warnings || []).concat(r.errors || []).map(function (c) { return T(c); }).join(' | ');
    h += '<tr class="r-' + r.status + '"><td class="n">' + r.i + '</td><td class="n">' + (r.day || '') + '</td>' +
      '<td><select data-pl="' + i + '" data-f="side">' + sel(PL[i].side, sideOpts()) + '</select></td>' +
      '<td><select data-pl="' + i + '" data-f="outcome">' + sel(PL[i].outcome, oo) + '</select></td>' +
      '<td><input data-pl="' + i + '" data-f="entry" type="number" step="any" dir="ltr" placeholder="' + esc(S.entryPrice) + '" value="' + esc(PL[i].entry) + '"></td>' +
      cell(r.qty, qtyF) + cell(r.notional, function (v) { return f(v, 2); }) + cell(r.margin, function (v) { return f(v, 2); }) +
      cell(r.risk, function (v) { return f(v, 3); }) + cell(r.reward, function (v) { return f(v, 3); }) +
      '<td class="n ' + (r.pnl > 0 ? 'pos' : r.pnl < 0 ? 'neg' : '') + '">' + (r.pnl == null ? '' : f(r.pnl, 3)) + '</td>' +
      '<td class="n">' + f(r.eqAfter, 2) + '</td><td class="n">' + (r.ddPeakPct == null ? '' : f(r.ddPeakPct, 2)) + '</td>' +
      '<td title="' + esc(wr) + '">' + T('ps_' + r.status) + (wr ? ' ⚠' : '') + '</td></tr>';
  });
  h += '</tbody></table></div></div>';
  $('#o-pl').innerHTML = h; fRestore(fk);
}

/* ---------- Simulator ---------- */
function runSim() {
  var o = $('#o-sim'); o.insertAdjacentHTML('afterbegin', '<div class="note" id="simwait">' + T('sim_wait') + '</div>');
  setTimeout(function () {
    var a = account(), t0 = Date.now();
    SIM = R.monteCarlo(Object.assign({}, S, { entry: S.entryPrice }), { paths: Math.min(20000, Math.max(100, parseInt(S.mcPaths, 10) || 2000)), trades: parseInt(S.planTrades, 10) || 30, winRatePct: +S.winRatePct, mode: S.compoundMode, seed: parseInt(S.seed, 10) || 1, sideMode: S.planSide });
    SIM.ms = Date.now() - t0; renderSim();
  }, 30);
}
function renderSim() {
  var a = account(), pos = calcPos(a), n = parseInt(S.planTrades, 10) || 30, init = +S.initialEquity, floor = init * (1 - S.maxDrawdownPct / 100);
  var h = '<div class="note">' + T('sim_disc') + '</div>';
  var nrr = isn(pos.netRR) ? pos.netRR : +S.rr;
  var th = isn(pos.netWin) && pos.netLoss > 0 ? R.theoretical(+S.winRatePct, pos.netWin, pos.netLoss) : null;
  var gp = R.growthProjection({ initial: init, riskPct: +S.riskPct, netRR: nrr, winRatePct: +S.winRatePct, n: n });
  h += '<div class="cols"><div class="card"><h2>' + T('h_growth') + '</h2>' + lineChart('gr', { series: [
    { name: T('g_comp'), color: 'var(--bl)', data: gp.expectedCompound }, { name: T('g_fixed'), color: 'var(--a)', data: gp.expectedFixed }, { name: T('g_typ'), color: 'var(--g)', data: gp.typicalGeometric, dash: true }], hl: floorLines(floor), label: T('h_growth') }) +
    '<p class="muted">' + T('g_note') + '</p></div>' +
    '<div class="card"><h2>' + T('h_expect') + '</h2>' + (th ? '<table class="tbl">' + tr(T('x_exp'), usd(th.expectancy, 4)) + tr(T('x_expr'), f(th.expectancyR, 3) + ' R') + tr(T('r_be'), pc(th.breakevenWR)) + tr(T('x_pf'), isFinite(th.profitFactor) ? f(th.profitFactor, 2) : '∞') +
      tr(T('x_mean'), pc(gp.meanPerTrade * 100, 3)) + tr(T('x_log'), pc(gp.logGrowth * 100, 3)) + tr(T('x_end'), usd(gp.expectedCompound[n]) + ' / ' + usd(gp.expectedFixed[n])) + '</table>' : '<p class="muted">' + T('x_na') + '</p>') + '</div></div>';
  if (!SIM) h += '<div class="card empty">' + T('sim_empty') + '</div>';
  else {
    var m = SIM, p = m.pct;
    h += '<div class="kpis">' + kpi(T('s_median'), both(p.p50), '<span class="n">' + pc((p.p50 / init - 1) * 100) + '</span>') +
      kpi(T('s_pprofit'), '<span class="n">' + pc(m.probProfit, 1) + '</span>') +
      kpi(T('s_phalt'), '<span class="n ' + (m.probHalt > 20 ? 'neg' : '') + '">' + pc(m.probHalt, 1) + '</span>', T('s_phalt_s')) +
      kpi(T('s_mdd'), '<span class="n">' + pc(m.medianMaxDD) + '</span>', '<span class="n">P95: ' + pc(m.p95MaxDD) + '</span>') +
      kpi(T('s_streak'), '<span class="n">' + f(m.medianLossStreak, 0) + '</span>', '<span class="n">max: ' + m.maxLossStreak + '</span>') + '</div>';
    h += '<div class="cols"><div class="card"><h2>' + T('h_fan') + '</h2>' + lineChart('fan', { series: [{ name: 'P50', color: 'var(--ac)', data: m.bands.p50 }], bands: [
      { lo: m.bands.p5, hi: m.bands.p95, color: 'var(--bl)', op: 0.13 }, { lo: m.bands.p25, hi: m.bands.p75, color: 'var(--bl)', op: 0.25 }], hl: floorLines(floor), label: T('h_fan') }) +
      '<p class="muted">' + T('fan_note') + '</p></div><div class="card"><h2>' + T('h_hist') + '</h2>' +
      barChart(m.hist.map(function (b) { var mid = (b.from + b.to) / 2; return { v: b.count, l: f(b.from, 1), t: f(b.from, 2) + '…' + f(b.to, 2), c: mid < floor ? 'var(--r)' : mid < init ? 'var(--a)' : 'var(--g)' }; }), { label: T('h_hist') }) + '</div></div>';
    h += '<div class="card"><div class="tw"><table class="tbl"><thead><tr><th></th><th>P5</th><th>P25</th><th>P50</th><th>P75</th><th>P95</th><th>' + T('s_mean') + '</th></tr></thead><tbody><tr><th scope="row">USDT</th>' +
      [p.p5, p.p25, p.p50, p.p75, p.p95, m.mean].map(function (v) { return '<td class="n">' + f(v, 2) + '</td>'; }).join('') + '</tr><tr><th scope="row">' + unitLbl() + '</th>' +
      [p.p5, p.p25, p.p50, p.p75, p.p95, m.mean].map(function (v) { return '<td class="n">' + f(v * S.fxRate, 0) + '</td>'; }).join('') + '</tr></tbody></table></div>' +
      '<p class="muted n">' + T('s_params') + ': ' + m.paths + ' · ' + m.trades + ' · WR ' + f(m.winRatePct, 1) + '% · ' + T('m_' + m.mode) + ' · seed ' + m.seed + ' · ' + m.ms + ' ms · ' + T('s_skipped') + ': ' + m.skippedTrades + '</p></div>';
  }
  $('#o-sim').innerHTML = h;
}

/* ---------- Analytics ---------- */
function renderAnalytics() {
  var a = account(), p = planRun(), pl = S.anSource === 'planner';
  var pnls = pl ? p.pnls : a.pnls, curve = pl ? p.curve : a.curve, an = R.analyze(pnls, curve), floor = +S.initialEquity * (1 - S.maxDrawdownPct / 100);
  var h = '';
  if (!an.n) h += '<div class="card empty">' + T('an_empty') + '</div>';
  else {
    h += '<div class="kpis">' + kpi(T('an_n'), '<span class="n">' + an.n + '</span>', '<span class="n">' + an.wins + ' W / ' + an.losses + ' L</span>') +
      kpi(T('x_wr'), '<span class="n">' + pc(an.winRate, 1) + '</span>') + kpi(T('an_net'), '<span class="n ' + (an.net >= 0 ? 'pos' : 'neg') + '">' + usd(an.net) + '</span>', '<span class="n">' + loc(an.net) + '</span>') +
      kpi(T('an_avgw'), '<span class="n pos">' + usd(an.avgWin, 3) + '</span>') + kpi(T('an_avgl'), '<span class="n neg">' + usd(an.avgLoss, 3) + '</span>', '<span class="n">' + T('an_payoff') + ': ' + f(an.payoff, 2) + '</span>') +
      kpi(T('x_exp'), '<span class="n">' + usd(an.expectancy, 4) + '</span>', '<span class="n">' + f(an.expectancyR, 3) + ' R</span>') +
      kpi(T('x_pf'), '<span class="n">' + (isFinite(an.profitFactor) ? f(an.profitFactor, 2) : '∞') + '</span>') +
      kpi(T('k_dd'), '<span class="n">' + pc(an.maxDDPct) + '</span>', '<span class="n">' + usd(an.maxDDUsd) + '</span>') +
      kpi(T('s_streak'), '<span class="n">' + an.streaks.maxLoss + '</span>', '<span class="n">W: ' + an.streaks.maxWin + '</span>') + '</div>';
    h += '<div class="cols"><div class="card"><h2>' + T('c_equity') + '</h2>' + lineChart('an1', { series: [{ name: T('k_equity'), color: 'var(--ac)', data: curve }], hl: floorLines(floor), area: true, label: T('c_equity') }) + '</div>' +
      '<div class="card"><h2>' + T('c_dd') + '</h2>' + lineChart('an2', { series: [{ name: '%', color: 'var(--r)', data: ddSeries(curve) }], area: true, zero: true, fmt: function (v) { return f(v, 1) + '%'; }, label: T('c_dd') }) + '</div></div>';
    h += '<div class="card"><h2>' + T('c_dist') + '</h2>' + histPnl(pnls) + '</div>';
  }
  var pos = calcPos(a), th = isn(pos.netWin) && pos.netLoss > 0 ? R.theoretical(+S.winRatePct, pos.netWin, pos.netLoss) : null;
  h += '<div class="card"><h2>' + T('h_expect') + ' (' + T('estimate') + ')</h2>' + (th ?
    '<table class="tbl">' + tr(T('x_wr'), pc(+S.winRatePct, 1)) + tr(T('r_netwin') + ' / ' + T('r_netloss'), usd(pos.netWin, 4) + ' / ' + usd(pos.netLoss, 4)) + tr(T('x_exp'), '<b class="' + (th.expectancy >= 0 ? 'pos' : 'neg') + '">' + usd(th.expectancy, 4) + '</b>') +
    tr(T('x_expr'), f(th.expectancyR, 3) + ' R') + tr(T('r_be'), pc(th.breakevenWR)) + tr(T('x_pf'), isFinite(th.profitFactor) ? f(th.profitFactor, 2) : '∞') + '</table>' : '<p class="muted">' + T('x_na') + '</p>') + '</div>';
  $('#o-an').innerHTML = h;
}

/* ---------- Journal ---------- */
function jCellsHtml(c) {
  return { net: c.closed ? '<span class="' + (c.net > 0 ? 'pos' : c.net < 0 ? 'neg' : '') + '">' + f(c.net, 4) + '</span>' : '—',
    res: '<span class="badge r-' + c.res + '">' + T('res_' + c.res) + '</span>', r: c.rm == null ? '—' : f(c.rm, 2) + 'R' };
}
function jRowHtml(r) {
  var c = jCalc(r), id = r.id, x = jCellsHtml(c);
  var inp = function (k, ph) { return '<input data-j="' + id + '" data-f="' + k + '" type="number" step="any" inputmode="decimal" dir="ltr" value="' + esc(r[k] == null ? '' : r[k]) + '"' + (ph ? ' placeholder="' + ph + '"' : '') + '>'; };
  return '<tr data-id="' + id + '"><td><input data-j="' + id + '" data-f="date" type="date" value="' + esc(r.date) + '"></td>' +
    '<td><select data-j="' + id + '" data-f="side">' + sel(r.side, sideOpts()) + '</select></td>' +
    '<td>' + inp('entry') + '</td><td>' + inp('stop') + '</td><td>' + inp('target') + '</td><td>' + inp('qty') + '</td><td>' + inp('leverage') + '</td><td>' + inp('exit') + '</td>' +
    '<td>' + inp('fees', T('est')) + '</td><td>' + inp('funding', '0') + '</td><td>' + inp('risk') + '</td>' +
    '<td class="n" data-c="net">' + x.net + '</td><td data-c="res">' + x.res + '</td><td class="n" data-c="r">' + x.r + '</td>' +
    '<td><input data-j="' + id + '" data-f="notes" type="text" value="' + esc(r.notes) + '"></td>' +
    '<td><button class="btn sm danger" data-del="' + id + '" aria-label="' + T('del') + '">✕</button></td></tr>';
}
function jFiltered() {
  var q = String(S.jfText || '').toLowerCase();
  return J.filter(function (r) {
    var c = jCalc(r);
    return (S.jfSide === 'all' || r.side === S.jfSide) && (S.jfStatus === 'all' || (S.jfStatus === 'closed') === c.closed) && (!q || String(r.notes || '').toLowerCase().indexOf(q) >= 0);
  });
}
function jSummaryHtml() {
  var a = account(), an = R.analyze(a.pnls, a.curve);
  return '<div class="kpis sm">' + kpi(T('an_n'), '<span class="n">' + J.length + '</span>', '<span class="n">' + a.closed.length + ' ' + T('closed') + ' · ' + a.open.length + ' ' + T('res_open') + '</span>') +
    kpi(T('an_net'), '<span class="n ' + (an.net >= 0 ? 'pos' : 'neg') + '">' + usd(an.net) + '</span>', '<span class="n">' + loc(an.net) + '</span>') +
    kpi(T('x_wr'), '<span class="n">' + pc(an.winRate, 1) + '</span>') + kpi(T('k_equity'), '<span class="n">' + usd(a.equity) + '</span>') + '</div>';
}
function renderJournal() {
  var rows = jFiltered(), h = '<div id="jsum">' + jSummaryHtml() + '</div><div class="note">' + T('j_note') + '</div>';
  if (!J.length) h += '<div class="card empty">' + T('j_empty') + '</div>';
  else h += '<div class="card"><div class="tw tall"><table class="tbl jt"><thead><tr>' +
    [T('j_date'), T('r_side'), T('r_entry'), T('r_sl'), T('r_tp'), T('r_qty'), T('f_leverage'), T('j_exit'), T('j_fees'), T('j_funding'), T('j_risk'), T('p_pnl'), T('j_result'), 'R', T('j_notes'), ''].map(function (x) { return '<th>' + x + '</th>'; }).join('') +
    '</tr></thead><tbody>' + rows.map(jRowHtml).join('') + '</tbody></table></div></div>';
  $('#o-jr').innerHTML = h;
}
function refreshJournalRow(id) {
  var r = J.filter(function (x) { return x.id === id; })[0], tr0 = $('tr[data-id="' + id + '"]'); if (!r || !tr0) return;
  var x = jCellsHtml(jCalc(r));
  $('[data-c="net"]', tr0).innerHTML = x.net; $('[data-c="res"]', tr0).innerHTML = x.res; $('[data-c="r"]', tr0).innerHTML = x.r;
  $('#jsum').innerHTML = jSummaryHtml();
}
var JCOLS = [['id', 'id'], ['date', 'date'], ['side', 'side'], ['entry', 'entry'], ['stop', 'stop'], ['target', 'target'], ['qty', 'qty_btc'], ['leverage', 'leverage'], ['exit', 'exit'], ['fees_used', 'fees_usdt'],
  ['fees_est', 'fees_estimated'], ['funding', 'funding_usdt'], ['risk', 'planned_net_risk_usdt'], ['gross', 'gross_pnl_usdt'], ['net', 'net_pnl_usdt'], ['result', 'result'], ['r', 'r_multiple'], ['notes', 'notes']];
function journalCsv() {
  var rows = J.map(function (r) { var c = jCalc(r); return Object.assign({}, r, { fees_used: c.fees, fees_est: c.feesEst ? 'estimated' : 'actual', gross: c.closed ? c.gross : '', net: c.closed ? c.net : '', result: c.res, r: c.rm == null ? '' : c.rm }); });
  return R.toCSV(rows, JCOLS.map(function (p) { return { key: p[0], label: p[1] }; }));
}
function planCsv() {
  var p = planRun();
  return R.toCSV(p.rows.map(function (r) { return Object.assign({}, r, { warn: (r.warnings || []).concat(r.errors || []).join(' ') }); }), [
    ['i', 'trade'], ['day', 'day'], ['side', 'side'], ['outcome', 'outcome'], ['status', 'status'], ['entry', 'entry'], ['qty', 'qty_btc'], ['notional', 'notional_usdt'], ['margin', 'margin_usdt'],
    ['risk', 'net_risk_usdt'], ['reward', 'net_reward_usdt'], ['gross', 'gross_pnl_usdt'], ['costs', 'costs_usdt'], ['pnl', 'net_pnl_usdt'], ['eqBefore', 'equity_before'], ['eqAfter', 'equity_after'], ['ddPeakPct', 'drawdown_pct'], ['warn', 'flags']
  ].map(function (c) { return { key: c[0], label: c[1] }; }));
}

/* ---------- Settings ---------- */
function renderSettings() {
  var h = '<div class="card"><h2>' + T('h_validation') + '</h2><ul class="msgs">';
  var bad = false, add = function (c, t) { bad = true; h += '<li class="' + c + '">' + T(t) + '</li>'; };
  if (+S.leverage > +S.maxLeverage) add('err', 'v_lev');
  if (!(+S.fxRate > 0)) add('err', 'v_fx');
  if (!(+S.initialEquity > 0)) add('err', 'v_init');
  if (+S.riskPct > 5) add('warn', 'v_risk');
  if (+S.takerFeePct === 0 && +S.makerFeePct === 0) add('warn', 'v_fee0');
  if (!bad) h += '<li class="ok">' + T('v_ok') + '</li>';
  h += '</ul><p class="muted">' + T('note_assump') + '</p><p class="muted n">' + T('k_floor') + ': ' + usd(+S.initialEquity * (1 - S.maxDrawdownPct / 100)) + ' · FX: 1 USDT = ' + f(+S.fxRate, 2) + ' ' + unitLbl() + (S.fxStamp ? ' (' + esc(S.fxStamp) + ')' : '') + '</p></div>';
  $('#o-st').innerHTML = h;
}
