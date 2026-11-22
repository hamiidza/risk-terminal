/* app3.js — events, sync, init */
function applyShow() {
  $$('[data-show]').forEach(function (el) { var p = el.dataset.show.split('='); el.hidden = String(S[p[0]]) !== p[1]; });
}
function syncInputs() {
  $$('[data-k]').forEach(function (el) {
    if (el === document.activeElement) return;
    var v = S[el.dataset.k];
    if (el.type === 'checkbox') el.checked = !!v; else el.value = v == null ? '' : v;
  });
  $$('[data-seg]').forEach(function (g) {
    $$('button', g).forEach(function (b) { var on = String(S[g.dataset.seg]) === b.dataset.v; b.setAttribute('aria-pressed', String(on)); b.classList.toggle('on', on); });
  });
  var cl = $('[data-sp="capLocal"]');
  if (cl && cl !== document.activeElement) { var v = +S.initialEquity * +S.fxRate; cl.value = isn(v) ? +v.toFixed(2) : ''; }
}
var RENDER = { overview: renderOverview, calc: renderCalc, planner: renderPlanner, sim: renderSim, analytics: renderAnalytics, journal: renderJournal, settings: renderSettings };
function renderActive() {
  TABS.forEach(function (t) {
    $('#tab-' + t).hidden = t !== S.tab;
    var b = $('#nt-' + t); b.setAttribute('aria-selected', String(t === S.tab)); b.setAttribute('tabindex', t === S.tab ? '0' : '-1'); b.classList.toggle('on', t === S.tab);
  });
  applyShow(); syncInputs(); RENDER[S.tab]();
}
function dl(name, text) {
  var b = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }), a = document.createElement('a');
  a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
var ACTS = {
  fillEven: function () { ensurePlan(); var o = R.evenOutcomes(PL.length, +S.winRatePct); PL.forEach(function (r, i) { r.outcome = o[i]; }); sv('PL', PL); renderPlanner(); },
  fillRand: function () { ensurePlan(); var o = R.seededOutcomes(PL.length, +S.winRatePct, parseInt(S.seed, 10) || 1); PL.forEach(function (r, i) { r.outcome = o[i]; }); sv('PL', PL); renderPlanner(); },
  clearPlan: function () { PL.forEach(function (r) { r.outcome = 'pending'; }); sv('PL', PL); renderPlanner(); },
  resetSides: function () { PL.forEach(function (r, i) { r.side = R.sideFor(i, S.planSide); }); sv('PL', PL); renderPlanner(); },
  exportPlan: function () { dl('trade-plan-' + todayStr() + '.csv', planCsv()); },
  runSim: runSim,
  addTrade: function () {
    J.unshift({ id: uid(), date: todayStr(), side: 'long', entry: S.entryPrice, stop: '', target: '', qty: '', leverage: S.leverage, exit: '', fees: '', funding: '', risk: '', notes: '' });
    sv('J', J); renderJournal();
  },
  saveCalc: function () {
    var a = account(), pos = calcPos(a); if (!pos.ok) return;
    var g = guardState(a);
    if (!g.allowed && !confirm(T('guard_confirm') + '\n' + g.reasons.map(T).join('\n'))) return;
    J.unshift({ id: uid(), date: todayStr(), side: pos.side, entry: pos.entry, stop: +pos.slPrice.toFixed(2), target: +pos.tpPrice.toFixed(2), qty: pos.qty, leverage: pos.leverage, exit: '', fees: '', funding: '', risk: +pos.netLoss.toFixed(4), notes: '' });
    sv('J', J); toast(T('saved'));
  },
  exportJ: function () { dl('trade-journal-' + todayStr() + '.csv', journalCsv()); },
  clearJ: function () { if (confirm(T('confirm_clear'))) { J = []; sv('J', J); renderJournal(); } },
  resetDefaults: function () {
    if (!confirm(T('confirm_reset'))) return;
    S = Object.assign({}, D, UIDEF, { lang: S.lang, theme: S.theme, tab: S.tab }); PL = []; SIM = null; saveAll(); buildAll(); renderActive();
  }
};

document.addEventListener('input', function (e) {
  var el = e.target, d = el.dataset; if (!d) return;
  if (d.k) {
    var v;
    if (el.type === 'checkbox') v = el.checked; else if (el.type === 'number' || d.num) v = el.value === '' ? '' : parseFloat(el.value); else v = el.value;
    if (d.k === 'fxUnit' && v !== S.fxUnit && isn(+S.fxRate)) S.fxRate = v === 'rial' ? S.fxRate * 10 : S.fxRate / 10;
    S[d.k] = v; sv('S', S);
    if (d.k === 'fxUnit') buildAll();
    renderActive(); return;
  }
  if (d.sp === 'capLocal') {
    var L = parseFloat(el.value);
    if (L > 0 && +S.initialEquity > 0) { S.fxRate = L / S.initialEquity; sv('S', S); var fx = $('[data-k="fxRate"]'); if (fx) fx.value = S.fxRate; renderSettings(); }
  }
});
document.addEventListener('change', function (e) {
  var el = e.target, d = el.dataset; if (!d) return;
  if (d.j !== undefined) {
    var r = J.filter(function (x) { return x.id === d.j; })[0]; if (!r) return;
    r[d.f] = el.type === 'number' ? (el.value === '' ? '' : parseFloat(el.value)) : el.value;
    sv('J', J); refreshJournalRow(d.j); return;
  }
  if (d.pl !== undefined) {
    PL[+d.pl][d.f] = d.f === 'entry' ? (el.value === '' ? '' : parseFloat(el.value)) : el.value;
    sv('PL', PL); renderPlanner();
  }
});
document.addEventListener('click', function (e) {
  var b = e.target.closest ? e.target.closest('button') : null; if (!b) return;
  if (b.dataset.tab) { S.tab = b.dataset.tab; sv('S', S); renderActive(); return; }
  if (b.parentElement && b.parentElement.dataset.seg && b.dataset.v) { S[b.parentElement.dataset.seg] = b.dataset.v; sv('S', S); renderActive(); return; }
  if (b.dataset.del) { if (confirm(T('confirm_del'))) { J = J.filter(function (x) { return x.id !== b.dataset.del; }); sv('J', J); renderJournal(); } return; }
  if (b.dataset.act && ACTS[b.dataset.act]) ACTS[b.dataset.act]();
});
document.addEventListener('keydown', function (e) {
  var b = e.target.closest ? e.target.closest('#nav button') : null;
  if (!b || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
  var rtl = document.documentElement.dir === 'rtl', step = (e.key === 'ArrowRight') === !rtl ? 1 : -1;
  var i = (TABS.indexOf(S.tab) + step + TABS.length) % TABS.length;
  S.tab = TABS[i]; sv('S', S); renderActive(); $('#nt-' + S.tab).focus();
});
document.addEventListener('pointermove', function (e) {
  var c = e.target.closest ? e.target.closest('.chart[data-ch]') : null;
  $$('.tipbox').forEach(function (t) { if (!c || t.parentNode !== c) t.hidden = true; });
  if (!c) return;
  var m = CH[c.dataset.ch]; if (!m || m.n < 1) return;
  var svg = $('svg', c), rc = svg.getBoundingClientRect(), x = (e.clientX - rc.left) / rc.width * CW;
  var i = Math.max(0, Math.min(m.n - 1, Math.round((x - CL) / (CW - CL - CR) * (m.n - 1))));
  var tb = $('.tipbox', c); tb.hidden = false;
  tb.innerHTML = '<b>' + m.xl + i + '</b>' + m.ser.map(function (s) { return '<div><i style="background:' + s.color + '"></i>' + esc(s.name) + ': ' + (isn(s.data[i]) ? m.fm(s.data[i]) : '—') + '</div>'; }).join('');
  var px = CL + (m.n > 1 ? i / (m.n - 1) : 0) * (CW - CL - CR), cr = $('.cross', c);
  cr.setAttribute('x1', px); cr.setAttribute('x2', px); cr.style.display = '';
  tb.style.left = Math.max(4, Math.min(c.clientWidth - tb.offsetWidth - 4, e.clientX - c.getBoundingClientRect().left + 12)) + 'px';
});
$('#bLang').addEventListener('click', function () { S.lang = S.lang === 'fa' ? 'en' : 'fa'; sv('S', S); buildAll(); renderActive(); });
$('#bTheme').addEventListener('click', function () { S.theme = S.theme === 'dark' ? 'light' : 'dark'; sv('S', S); buildAll(); renderActive(); });

if (TABS.indexOf(S.tab) < 0) S.tab = 'overview';
ensurePlan(); buildAll(); renderActive();
