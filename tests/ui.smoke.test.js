const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname,'..','index.html'), 'utf8');
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => errors.push('jsdomError: ' + (e.detail && e.detail.stack || e.message)));
vc.on('error', (e) => errors.push('console.error: ' + e));
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/', pretendToBeVisual: true, virtualConsole: vc });
const w = dom.window, d = w.document;
w.confirm = () => true;
let blobs = [];
w.URL.createObjectURL = (b) => { blobs.push(b); return 'blob:x'; };
w.URL.revokeObjectURL = () => {};
w.HTMLAnchorElement.prototype.click = function () {};
const R = w.RRE;
let ok = 0, bad = 0;
const check = (n, c, extra) => { if (c) { ok++; console.log('  ok  ' + n); } else { bad++; console.log('FAIL  ' + n + (extra ? ' :: ' + extra : '')); } };
const tab = (t) => d.getElementById('nt-' + t).click();
const txt = (sel) => (d.querySelector(sel) || {}).textContent || '';
const setInput = (sel, v) => { const el = d.querySelector(sel); el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); el.dispatchEvent(new w.Event('change', { bubbles: true })); };

check('app booted, nav built', d.querySelectorAll('#nav button').length === 7);
check('default RTL + Persian', d.documentElement.dir === 'rtl' && d.documentElement.lang === 'fa');
check('banner shown (estimate disclaimer)', txt('#banner').length > 40);

/* Overview */
tab('overview');
check('overview renders KPIs', d.querySelectorAll('#o-ov .kpi').length >= 8);
check('overview shows 12,000,000 toman equivalent', txt('#o-ov').replace(/,/g, '').includes('12000000'));
check('overview charts rendered', d.querySelectorAll('#o-ov svg').length === 2);

/* Calculator vs engine */
tab('calc');
const S0 = Object.assign({}, R.DEFAULTS, { side: 'long', stopMode: 'pct', targetMode: 'rr', equity: 45, freeBalance: 45, entry: R.DEFAULTS.entryPrice });
let pos = R.computePosition(S0);
const calcTxt = txt('#o-calc');
check('calculator: SL price matches engine', calcTxt.includes(pos.slPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })), String(pos.slPrice));
check('calculator: quantity matches engine', calcTxt.includes(String(pos.qty)), String(pos.qty));
check('calculator: net loss ≤ risk budget', pos.netLoss <= 0.45 + 1e-12, String(pos.netLoss));
check('calculator: estimate label present', calcTxt.length > 200 && d.querySelector('#o-calc .est'));
/* short side */
d.querySelector('[data-seg="side"] [data-v="short"]').click();
pos = R.computePosition(Object.assign({}, S0, { side: 'short' }));
check('short: SL above entry shown', txt('#o-calc').includes(pos.slPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })));
/* leverage over cap -> blocked */
setInput('#in-calc [data-k="leverage"]', '5');
check('leverage 5x blocked with error', d.querySelectorAll('#o-calc .msgs .err').length >= 1 && d.querySelector('#o-calc .badge').className.includes('b-blocked'));
{ const b = d.querySelector('[data-act="saveCalc"]'); check('save impossible when blocked', !b || b.disabled); }
setInput('#in-calc [data-k="leverage"]', '3');
check('back to 3x: OK', d.querySelector('#o-calc .badge').className.includes('b-ok') || d.querySelector('#o-calc .badge').className.includes('b-adjusted'));
/* tight stop -> capped by leverage */
setInput('#in-calc [data-k="stopPct"]', '0.1');
check('0.3% stop => margin cap warning shown', txt('#o-calc').length > 0 && d.querySelector('#o-calc .msgs .warn'));
setInput('#in-calc [data-k="stopPct"]', '1');
/* price mode */
d.querySelector('[data-seg="stopMode"] [data-v="price"]').click();
setInput('#in-calc [data-k="stopPrice"]', '101000');
d.querySelector('[data-seg="side"] [data-v="short"]').click();
check('price-mode SL (short, 101000) accepted', !txt('#o-calc').includes(d.defaultView.I18N.ERR_STOP_SIDE[0]));
d.querySelector('[data-seg="side"] [data-v="long"]').click();
check('price-mode SL wrong side for long shows error', txt('#o-calc').includes(w.I18N.ERR_STOP_SIDE[0]));
d.querySelector('[data-seg="stopMode"] [data-v="pct"]').click();
check('fee + funding tables rendered', d.querySelectorAll('#o-calc table').length >= 4);

/* Save to journal */
d.querySelector('[data-act="saveCalc"]').click();
tab('journal');
check('journal has saved trade', d.querySelectorAll('#o-jr tbody tr').length === 1);
const exitInp = d.querySelector('#o-jr input[data-f="exit"]');
const entry = +d.querySelector('#o-jr input[data-f="entry"]').value, qty = +d.querySelector('#o-jr input[data-f="qty"]').value;
setInput('#o-jr input[data-f="exit"]', String(entry * 1.03));
const netCell = txt('#o-jr [data-c="net"]');
const gross = (entry * 1.03 - entry) * qty, fee = qty * entry * 0.0006 + qty * entry * 1.03 * 0.0002;
check('journal net P&L = gross − est. fees', Math.abs(parseFloat(netCell) - (gross - fee)) < 1e-3, netCell + ' vs ' + (gross - fee));
check('journal result badge = win', txt('#o-jr [data-c="res"]').length > 0 && d.querySelector('#o-jr [data-c="res"] .r-win'));
/* equity moved on overview */
tab('overview');
const eqNow = 45 + (gross - fee);
check('overview equity reflects journal', txt('#o-ov').includes(eqNow.toFixed(2)), eqNow.toFixed(2));
/* CSV */
tab('journal'); blobs = [];
d.querySelector('[data-act="exportJ"]').click();
check('journal CSV export produced', blobs.length === 1);

/* Planner */
tab('planner');
check('planner shows 30 rows', d.querySelectorAll('#o-pl tbody tr').length === 30);
d.querySelector('[data-act="fillEven"]').click();
const wins = [...d.querySelectorAll('#o-pl select[data-f="outcome"]')].filter((s) => s.value === 'win').length;
check('fill by win rate 35% => 11 wins of 30', wins === 11, String(wins));
const days = [...d.querySelectorAll('#o-pl tbody tr td:nth-child(2)')].map((c) => +c.textContent);
const cnt = {}; days.forEach((x) => { if (x) cnt[x] = (cnt[x] || 0) + 1; });
check('planner respects 2 trades/day', Object.values(cnt).every((c) => c <= 2));
setInput('#tab-planner select[data-k="planTrades"]', '100');
check('planner resizes to 100 rows', d.querySelectorAll('#o-pl tbody tr').length === 100);
setInput('#tab-planner select[data-k="planTrades"]', '30');
d.querySelector('[data-act="fillRand"]').click();
const sel0 = d.querySelector('#o-pl select[data-f="outcome"]'); sel0.value = 'loss'; sel0.dispatchEvent(new w.Event('change', { bubbles: true }));
check('planner KPIs + 2 charts', d.querySelectorAll('#o-pl .kpi').length === 6 && d.querySelectorAll('#o-pl svg').length === 2);
/* all losses -> halted */
for (let i = 0; i < 30; i++) { const s = d.querySelector('#o-pl select[data-pl="' + i + '"][data-f="outcome"]'); s.value = 'loss'; s.dispatchEvent(new w.Event('change', { bubbles: true })); }
check('all-loss plan halts at drawdown limit', txt('#o-pl').includes(w.I18N.p_halted[0]));
d.querySelector('[data-act="exportPlan"]').click();

/* Simulator */
tab('sim');
check('growth chart + expectancy rendered before run', d.querySelectorAll('#o-sim svg').length >= 1);
setInput('#tab-sim [data-k="mcPaths"]', '300');
d.querySelector('[data-act="runSim"]').click();

setTimeout(() => {
  check('Monte Carlo results rendered (fan + hist)', d.querySelectorAll('#o-sim svg').length >= 3, String(d.querySelectorAll('#o-sim svg').length));
  check('hypothetical disclaimer shown', txt('#o-sim').includes(w.I18N.sim_disc[0].slice(0, 15)));

  tab('analytics');
  setInput('#tab-analytics select[data-k="anSource"]', 'planner');
  check('analytics (planner source) KPIs + 3 charts', d.querySelectorAll('#o-an .kpi').length >= 9 && d.querySelectorAll('#o-an svg').length === 3, d.querySelectorAll('#o-an .kpi').length + '/' + d.querySelectorAll('#o-an svg').length);

  tab('settings');
  check('settings render + validation', d.querySelectorAll('#tab-settings input[data-k]').length > 15 && txt('#o-st').length > 40);
  setInput('#tab-settings [data-sp="capLocal"]', '9000000');
  check('capital-equivalent edit updates FX rate', Math.abs(+d.querySelector('#tab-settings [data-k="fxRate"]').value - 200000) < 1e-6, d.querySelector('#tab-settings [data-k="fxRate"]').value);
  setInput('#tab-settings [data-k="fxUnit"]', 'rial');
  check('unit switch toman→rial multiplies rate by 10', Math.abs(+d.querySelector('#tab-settings [data-k="fxRate"]').value - 2000000) < 1e-6);
  setInput('#tab-settings [data-k="fxUnit"]', 'toman');

  /* language toggle */
  d.getElementById('bLang').click();
  check('English toggle => LTR', d.documentElement.dir === 'ltr' && d.documentElement.lang === 'en' && txt('#ttl').includes('Risk'));
  tab('calc');
  check('English calculator renders', txt('#o-calc').includes('Net loss'));
  d.getElementById('bLang').click();
  check('back to Persian RTL', d.documentElement.dir === 'rtl');

  /* reset */
  tab('settings'); d.querySelector('[data-act="resetDefaults"]').click();
  check('reset restores defaults', Math.abs(+d.querySelector('#tab-settings [data-k="initialEquity"]').value - 45) < 1e-9);

  check('no JS errors during entire run', errors.length === 0, errors.join('\n'));
  console.log('\n' + ok + ' ok, ' + bad + ' failed');
  process.exit(bad ? 1 : 0);
}, 1500);
