/* app1.js — state, persistence, formatting, charts, account/journal math */
var R = window.RRE, D = R.DEFAULTS;
var UIDEF = { lang: 'fa', theme: 'dark', tab: 'overview', side: 'long', stopMode: 'pct', targetMode: 'rr',
  stopPrice: '', targetPrice: '', calcEquity: '', planSide: 'alternate', anSource: 'journal',
  jfSide: 'all', jfStatus: 'all', jfText: '' };
var mem = {};
function ld(k, def) { try { var v = localStorage.getItem('rrt.' + k); return v ? JSON.parse(v) : def; } catch (e) { return mem[k] !== undefined ? mem[k] : def; } }
function sv(k, v) { try { localStorage.setItem('rrt.' + k, JSON.stringify(v)); } catch (e) { mem[k] = v; } }
var S = Object.assign({}, D, UIDEF, ld('S', {}));
var J = ld('J', []);
var PL = ld('PL', []);
var SIM = null;
var TABS = ['overview', 'calc', 'planner', 'sim', 'analytics', 'journal', 'settings'];

function $(s, el) { return (el || document).querySelector(s); }
function $$(s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); }
function T(k) { var p = window.I18N[k]; return p ? p[S.lang === 'fa' ? 0 : 1] : k; }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function isn(x) { return typeof x === 'number' && isFinite(x); }
function f(x, d) { if (!isn(x)) return '—'; d = d == null ? 2 : d; return x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); }
function usd(x, d) { return isn(x) ? (x < 0 ? '-' : '') + '$' + f(Math.abs(x), d == null ? 2 : d) : '—'; }
function pc(x, d) { return isn(x) ? f(x, d == null ? 2 : d) + '%' : '—'; }
function qtyF(x) { return isn(x) ? x.toFixed(Math.max(4, R.stepDecimals(+S.qtyStep || 0.0001))).replace(/0+$/, '').replace(/\.$/, '') : '—'; }
function unitLbl() { return T(S.fxUnit === 'rial' ? 'u_rial' : 'u_toman'); }
function loc(x) { return isn(x) && isn(+S.fxRate) ? Math.round(x * S.fxRate).toLocaleString('en-US') + ' ' + unitLbl() : '—'; }
function both(x) { return '<span class="n">' + usd(x) + '</span><small class="loc n">≈ ' + loc(x) + '</small>'; }
function toast(m) { var t = $('#toast'); t.textContent = m; t.className = 'show'; clearTimeout(toast.t); toast.t = setTimeout(function () { t.className = ''; }, 3200); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function todayStr() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
function saveAll() { sv('S', S); sv('J', J); sv('PL', PL); }

/* ---------- builders ---------- */
function tip(k) { return T(k) ? '<i class="tip-i" tabindex="0" title="' + esc(T(k)) + '" aria-label="' + esc(T(k)) + '">i</i>' : ''; }
function field(k, o) {
  o = o || {};
  var lab = T(o.l || 'f_' + k), t = o.type || 'number', tp = o.tip ? tip(o.tip) : '';
  var show = o.show ? ' data-show="' + o.show + '"' : '';
  if (t === 'select') {
    return '<label class="f"' + show + '><span>' + lab + tp + '</span><select data-k="' + k + '"' + (o.num ? ' data-num="1"' : '') + '>' +
      o.opts.map(function (p) { return '<option value="' + p[0] + '">' + p[1] + '</option>'; }).join('') + '</select></label>';
  }
  if (t === 'check') return '<label class="f chk"' + show + '><input type="checkbox" data-k="' + k + '"><span>' + lab + tp + '</span></label>';
  var extra = (o.min != null ? ' min="' + o.min + '"' : '') + (o.max != null ? ' max="' + o.max + '"' : '') + (o.ph ? ' placeholder="' + esc(o.ph) + '"' : '');
  var inp = t === 'number' ? ' type="number" inputmode="decimal" step="' + (o.step || 'any') + '"' : ' type="text"';
  return '<label class="f"' + show + '><span>' + lab + tp + '</span><input data-k="' + k + '"' + inp + extra + ' dir="ltr"></label>';
}
function seg(k, opts, show) {
  return '<div class="seg" role="group" data-seg="' + k + '"' + (show ? ' data-show="' + show + '"' : '') + '>' +
    opts.map(function (p) { return '<button type="button" data-v="' + p[0] + '">' + p[1] + '</button>'; }).join('') + '</div>';
}
function kpi(l, v, s, c) { return '<div class="kpi ' + (c || '') + '"><div class="kl">' + l + '</div><div class="kv">' + v + '</div><div class="ks">' + (s || '') + '</div></div>'; }
function tr(l, v, c) { return '<tr class="' + (c || '') + '"><th scope="row">' + l + '</th><td class="n">' + v + '</td></tr>'; }
function msgs(pos) {
  var h = '';
  (pos.errors || []).forEach(function (e) { h += '<li class="err">' + T(e) + '</li>'; });
  (pos.warnings || []).forEach(function (w) { h += '<li class="warn">' + T(w) + '</li>'; });
  return h ? '<ul class="msgs">' + h + '</ul>' : '';
}
function badge(st) { return '<span class="badge b-' + st + '">' + T('st_' + st) + '</span>'; }

/* ---------- charts (inline SVG, no deps) ---------- */
var CH = {};
var CW = 640, CHH = 230, CL = 52, CR = 10, CT = 10, CB = 22;
function lineChart(id, o) {
  var ser = o.series || [], bands = o.bands || [], hl = o.hl || [], fm = o.fmt || function (v) { return f(v, 2); };
  var all = [];
  ser.forEach(function (s) { s.data.forEach(function (v) { if (isn(v)) all.push(v); }); });
  bands.forEach(function (b) { b.lo.concat(b.hi).forEach(function (v) { if (isn(v)) all.push(v); }); });
  hl.forEach(function (h) { if (isn(h.y)) all.push(h.y); });
  if (!all.length) return '<div class="empty">' + T('empty') + '</div>';
  var lo = Math.min.apply(null, all), hi = Math.max.apply(null, all);
  if (o.zero) lo = Math.min(lo, 0);
  if (lo === hi) { lo -= 1; hi += 1; }
  var pv = (hi - lo) * 0.06; lo -= o.zero && lo === 0 ? 0 : pv; hi += pv;
  var n = 0; ser.forEach(function (s) { n = Math.max(n, s.data.length); }); bands.forEach(function (b) { n = Math.max(n, b.lo.length); });
  var X = function (i) { return CL + (n > 1 ? i / (n - 1) : 0) * (CW - CL - CR); };
  var Y = function (v) { return CT + (1 - (v - lo) / (hi - lo)) * (CHH - CT - CB); };
  var s = '<svg viewBox="0 0 ' + CW + ' ' + CHH + '" role="img" aria-label="' + esc(o.label || '') + '">';
  for (var g = 0; g <= 4; g++) {
    var gv = lo + (hi - lo) * g / 4, gy = Y(gv);
    s += '<line class="gl" x1="' + CL + '" x2="' + (CW - CR) + '" y1="' + gy.toFixed(1) + '" y2="' + gy.toFixed(1) + '"/><text class="ax" x="' + (CL - 6) + '" y="' + (gy + 4).toFixed(1) + '" text-anchor="end">' + fm(gv) + '</text>';
  }
  for (var xt = 0; xt <= 4; xt++) {
    var xi = Math.round((n - 1) * xt / 4);
    s += '<text class="ax" x="' + X(xi).toFixed(1) + '" y="' + (CHH - 6) + '" text-anchor="middle">' + xi + '</text>';
  }
  bands.forEach(function (b) {
    var d = 'M';
    b.hi.forEach(function (v, i) { d += (i ? 'L' : '') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1); });
    for (var i = b.lo.length - 1; i >= 0; i--) d += 'L' + X(i).toFixed(1) + ' ' + Y(b.lo[i]).toFixed(1);
    s += '<path d="' + d + 'Z" fill="' + b.color + '" opacity="' + (b.op || 0.18) + '"/>';
  });
  hl.forEach(function (h) {
    if (!isn(h.y)) return;
    s += '<line x1="' + CL + '" x2="' + (CW - CR) + '" y1="' + Y(h.y).toFixed(1) + '" y2="' + Y(h.y).toFixed(1) + '" stroke="' + h.color + '" stroke-dasharray="5 4" stroke-width="1.2"/>' +
      '<text class="ax" x="' + (CW - CR - 2) + '" y="' + (Y(h.y) - 4).toFixed(1) + '" text-anchor="end" fill="' + h.color + '">' + esc(h.label || '') + '</text>';
  });
  ser.forEach(function (sr, si) {
    var d = '';
    sr.data.forEach(function (v, i) { if (isn(v)) d += (d ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1); });
    if (!d) return;
    if (o.area) {
      var gid = 'gd-' + id + '-' + si;
      s += '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:' + sr.color + ';stop-opacity:.38"/><stop offset="1" style="stop-color:' + sr.color + ';stop-opacity:0"/></linearGradient></defs>' +
        '<path d="' + d + 'L' + X(sr.data.length - 1).toFixed(1) + ' ' + Y(o.zero ? 0 : lo).toFixed(1) + 'L' + X(0).toFixed(1) + ' ' + Y(o.zero ? 0 : lo).toFixed(1) + 'Z" fill="url(#' + gid + ')"/>';
    }
    s += '<path d="' + d + '" fill="none" stroke="' + sr.color + '" stroke-width="' + (sr.w || 2) + '"' + (sr.dash ? ' stroke-dasharray="6 4"' : '') + ' stroke-linejoin="round"/>';
  });
  s += '<line class="cross" x1="0" x2="0" y1="' + CT + '" y2="' + (CHH - CB) + '" style="display:none"/></svg>';
  CH[id] = { ser: ser, n: n, fm: fm, xl: o.xlabel || '#' };
  var lg = ser.length > 1 || bands.length ? '<div class="legend">' + ser.map(function (q) { return '<span><i style="background:' + q.color + '"></i>' + esc(q.name || '') + '</span>'; }).join('') + '</div>' : '';
  return '<div class="chart" data-ch="' + id + '">' + s + '<div class="tipbox" hidden></div></div>' + lg;
}
function barChart(bins, o) {
  o = o || {};
  var mx = Math.max.apply(null, bins.map(function (b) { return b.v; }).concat([1]));
  var n = bins.length, bw = (CW - CL - CR) / n;
  var s = '<svg viewBox="0 0 ' + CW + ' ' + CHH + '" role="img" aria-label="' + esc(o.label || '') + '">';
  for (var g = 0; g <= 3; g++) {
    var gy = CT + (1 - g / 3) * (CHH - CT - CB);
    s += '<line class="gl" x1="' + CL + '" x2="' + (CW - CR) + '" y1="' + gy.toFixed(1) + '" y2="' + gy.toFixed(1) + '"/><text class="ax" x="' + (CL - 6) + '" y="' + (gy + 4).toFixed(1) + '" text-anchor="end">' + Math.round(mx * g / 3) + '</text>';
  }
  bins.forEach(function (b, i) {
    var h = b.v / mx * (CHH - CT - CB), x = CL + i * bw;
    s += '<rect x="' + (x + 1).toFixed(1) + '" y="' + (CHH - CB - h).toFixed(1) + '" width="' + Math.max(1, bw - 2).toFixed(1) + '" height="' + h.toFixed(1) + '" fill="' + b.c + '" rx="2"><title>' + esc(b.t) + ': ' + b.v + '</title></rect>';
  });
  [0, Math.floor((n - 1) / 2), n - 1].forEach(function (i) {
    if (bins[i]) s += '<text class="ax" x="' + (CL + i * bw + bw / 2).toFixed(1) + '" y="' + (CHH - 6) + '" text-anchor="middle">' + esc(bins[i].l) + '</text>';
  });
  return '<div class="chart">' + s + '</svg></div>';
}
function histPnl(pnls) {
  if (!pnls.length) return '<div class="empty">' + T('empty') + '</div>';
  var lo = Math.min.apply(null, pnls), hi = Math.max.apply(null, pnls), nb = Math.min(12, Math.max(4, pnls.length));
  if (lo === hi) { lo -= 0.5; hi += 0.5; }
  var w = (hi - lo) / nb, bins = [];
  for (var i = 0; i < nb; i++) { var a = lo + i * w; bins.push({ v: 0, l: f(a, 2), t: f(a, 2) + '…' + f(a + w, 2), c: (a + w / 2) >= 0 ? 'var(--g)' : 'var(--r)' }); }
  pnls.forEach(function (p) { bins[Math.min(nb - 1, Math.floor((p - lo) / w))].v++; });
  return barChart(bins, { label: T('c_dist') });
}
function ddSeries(curve) {
  var pk = -Infinity;
  return curve.map(function (v) { if (v > pk) pk = v; return pk > 0 ? -(pk - v) / pk * 100 : 0; });
}

/* ---------- journal / account math ---------- */
function feeOf(type) { return (type === 'maker' ? +S.makerFeePct : +S.takerFeePct) / 100 || 0; }
function hasV(v) { return v !== '' && v != null && !isNaN(+v); }
function jCalc(r) {
  var dir = r.side === 'short' ? -1 : 1, q = +r.qty || 0, en = +r.entry || 0, ex = +r.exit || 0;
  var closed = ex > 0 && q > 0 && en > 0;
  var gross = closed ? dir * (ex - en) * q : 0;
  var estFees = (q * en * feeOf(S.entryType)) + (closed ? q * ex * (gross > 0 ? feeOf(S.tpType) : feeOf(S.slType)) : 0);
  var fees = hasV(r.fees) ? +r.fees : estFees, fund = hasV(r.funding) ? +r.funding : 0;
  var net = closed ? gross - fees - fund : 0;
  return { closed: closed, gross: gross, fees: fees, feesEst: !hasV(r.fees), fund: fund, net: net,
    res: !closed ? 'open' : net > 0 ? 'win' : net < 0 ? 'loss' : 'be',
    rm: closed && +r.risk > 0 ? net / +r.risk : null,
    margin: !closed && q && en && +r.leverage > 0 ? q * en / +r.leverage : 0, notional: !closed ? q * en : 0 };
}
function jRows() { return J.map(function (r) { return Object.assign({}, r, jCalc(r)); }); }
function account() {
  var rows = jRows(), init = +S.initialEquity || 0;
  var closed = rows.filter(function (r) { return r.closed; }).sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.id < b.id ? -1 : 1); });
  var open = rows.filter(function (r) { return !r.closed; });
  var pnls = closed.map(function (r) { return r.net; }), curve = [init];
  pnls.forEach(function (p) { curve.push(curve[curve.length - 1] + p); });
  var equity = curve[curve.length - 1], td = todayStr();
  var pnlToday = closed.filter(function (r) { return r.date === td; }).reduce(function (a, r) { return a + r.net; }, 0);
  var sum = function (arr, k) { return arr.reduce(function (a, r) { return a + (+r[k] || 0); }, 0); };
  var usedMargin = sum(open, 'margin');
  return { rows: rows, closed: closed, open: open, pnls: pnls, curve: curve, equity: equity, usedMargin: usedMargin,
    free: equity - usedMargin, exposure: sum(open, 'notional'), openRisk: sum(open, 'risk'),
    tradesToday: rows.filter(function (r) { return r.date === td; }).length, pnlToday: pnlToday,
    dayStart: equity - pnlToday, consec: R.streaks(pnls).currentLoss };
}
function calcPos(a) {
  var eq = +S.calcEquity > 0 ? +S.calcEquity : a.equity;
  return R.computePosition(Object.assign({}, S, { equity: eq, freeBalance: +S.calcEquity > 0 ? eq : a.free, entry: S.entryPrice }));
}
function ensurePlan() {
  var n = Math.min(500, Math.max(1, parseInt(S.planTrades, 10) || 30));
  while (PL.length < n) PL.push({ side: R.sideFor(PL.length, S.planSide), outcome: 'pending', entry: '' });
  if (PL.length > n) PL.length = n;
}
function planRun() { ensurePlan(); return R.runPlan(S, PL, { mode: S.compoundMode }); }
