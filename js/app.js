// ---- App: state, inputs, the chart and its interactions ----
const STD_TPR = [1.05, 1.1, 1.15, 1.2, 1.25, 1.3, 1.35, 1.4, 1.45, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0, 2.2, 2.4, 2.6, 2.8, 3.0];
const METHODS = {
  dak: { name: 'Dranchuk–Abou-Kassem', short: 'DAK', year: 1975, range: '1.0 ≤ Tpr ≤ 3.0, 0.2 ≤ Ppr ≤ 30', inRange: (p, t) => t >= 1.0 && t <= 3.0 && p <= 30,
    note: '11-constant equation of state fitted to about 1,500 points read from the Standing–Katz chart (average error about 0.5%). Solved by Newton iteration.' },
  hy: { name: 'Hall–Yarborough', short: 'HY', year: 1973, range: '1.0 ≤ Tpr ≤ 3.0, 0.1 ≤ Ppr ≤ 24', inRange: (p, t) => t >= 1.0 && t <= 3.0 && p <= 24,
    note: 'Starling–Carnahan equation of state fitted to the chart. Solved for reduced density y by Newton iteration. Not recommended below Tpr = 1.' },
  bb: { name: 'Brill–Beggs', short: 'BB', year: 1974, range: '1.15 ≤ Tpr ≤ 2.4, Ppr ≤ 10 (approx.)', inRange: (p, t) => t >= 1.15 && t <= 2.4 && p <= 10,
    note: 'Explicit (no iteration), handy for pipe-flow work. Breaks down quickly outside its range.' },
  papay: { name: 'Papay', short: 'Papay', year: 1968, range: 'Tpr ≥ 1.2, Ppr ≲ 3 (approx.)', inRange: (p, t) => t >= 1.2 && p <= 3,
    note: 'Simple explicit formula. Only for quick estimates at low reduced pressure.' },
};
const RANGES = {
  low: { x0: 0, x1: 8, y0: 0.25, y1: 1.1 },
  high: { x0: 7, x1: 15, y0: 0.9, y1: 1.8 },
  full: { x0: 0, x1: 15, y0: 0.25, y1: 1.8 },
  ext: { x0: 0, x1: 30, y0: 0.25, y1: 3.0 },
};
const LIMITS = { x0: 0, x1: 30, y0: 0, y1: 3.2, minX: 0.2, minY: 0.02 };
const DEFAULTS = { mode: 'gas', units: 'field', gamma: 0.65, corr: 'sutton', CO2: 0, H2S: 0, N2: 0, P: 3000, T: 180,
  Ppr: 2.0, Tpr: 1.5, method: 'dak', compare: false, range: 'low', pins: [],
  theme: 'auto', sound: true, hidden: [], custom: [], prop: 'z', quizBest: 0 };

// Saved settings and shared links are untrusted input: only known keys, known choices and finite numbers are kept.
function sanitize(saved) {
  const out = Object.assign({}, DEFAULTS, { pins: [], hidden: [], custom: [] });
  if (!saved || typeof saved !== 'object') return out;
  const pick = (k, allowed) => { if (allowed.includes(saved[k])) out[k] = saved[k]; };
  pick('mode', ['gas', 'direct']); pick('units', ['field', 'si']); pick('corr', Object.keys(PC_CORR));
  pick('method', Object.keys(METHODS)); pick('range', Object.keys(RANGES)); pick('theme', ['auto', 'light', 'dark']);
  pick('prop', ['z', 'pz', 'bg', 'rho', 'cg', 'mu', 'cpr']);
  for (const k of ['compare', 'sound']) if (typeof saved[k] === 'boolean') out[k] = saved[k];
  for (const k of ['gamma', 'CO2', 'H2S', 'N2', 'P', 'T', 'Ppr', 'Tpr', 'quizBest']) if (typeof saved[k] === 'number' && isFinite(saved[k])) out[k] = saved[k];
  if (Array.isArray(saved.pins)) {
    out.pins = saved.pins.slice(0, 12).filter(p => p && isFinite(p.p) && isFinite(p.z))
      .map(p => ({ p: +p.p, z: +p.z, t: isFinite(p.t) && p.t !== null ? +p.t : null }));
  }
  if (Array.isArray(saved.hidden)) out.hidden = saved.hidden.filter(t => STD_TPR.includes(t));
  if (Array.isArray(saved.custom)) out.custom = saved.custom.filter(t => typeof t === 'number' && t >= 1 && t <= 3).slice(0, 6);
  return out;
}

// Shared links carry the setup in the URL fragment (#...). The fragment never reaches a server.
const LINK_KEYS = { mode: 'm', units: 'u', gamma: 'g', corr: 'c', CO2: 'co2', H2S: 'h2s', N2: 'n2', P: 'p', T: 't', Ppr: 'ppr', Tpr: 'tpr', method: 'z', range: 'r' };
function stateFromLink() {
  let h = '';
  try { h = location.hash.slice(1); } catch (e) { return null; }
  if (!h || h.length > 400) return null;
  const q = new URLSearchParams(h), o = {};
  for (const [k, a] of Object.entries(LINK_KEYS)) {
    if (!q.has(a)) continue;
    const v = q.get(a);
    o[k] = typeof DEFAULTS[k] === 'number' ? parseFloat(v) : v;
  }
  return Object.keys(o).length ? o : null;
}
function linkForState() {
  const q = new URLSearchParams();
  for (const [k, a] of Object.entries(LINK_KEYS)) q.set(a, typeof S[k] === 'number' ? String(+S[k].toFixed(4)) : S[k]);
  return location.href.split('#')[0] + '#' + q.toString();
}

let S = sanitize(null);
try { S = sanitize(JSON.parse(localStorage.getItem('skz.v2') || localStorage.getItem('skz.v1') || 'null')); } catch (e) { /* storage unavailable or corrupt */ }
{ const linked = stateFromLink(); if (linked) S = sanitize(Object.assign({}, S, linked)); }
function save() { try { localStorage.setItem('skz.v2', JSON.stringify(S)); } catch (e) { /* ignore */ } }
Sound.setEnabled(S.sound);

const $ = id => document.getElementById(id);
const fmt = (x, d = 4) => (x === null || x === undefined || !isFinite(x)) ? '—' : Number(x).toFixed(d);
const fmtE = (x, d = 3) => (!isFinite(x)) ? '—' : Number(x).toExponential(d).replace('e', '×10^').replace(/\^\+?(-?\d+)/, (m, e) => '<sup>' + e + '</sup>');
const fmtEtxt = (x, d = 4) => (!isFinite(x)) ? '' : Number(x).toExponential(d);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// unit helpers (state is always field: psia, °F)
const PSI_KPA = 6.894757;
const U = {
  pIn: p => S.units === 'si' ? p * PSI_KPA : p,
  pOut: v => S.units === 'si' ? v / PSI_KPA : v,
  tIn: t => S.units === 'si' ? (t - 32) / 1.8 : t,
  tOut: v => S.units === 'si' ? v * 1.8 + 32 : v,
  pU: () => S.units === 'si' ? 'kPa' : 'psia',
  tU: () => S.units === 'si' ? '°C' : '°F',
  tcIn: r => S.units === 'si' ? r / 1.8 : r,       // °R -> K
  tcU: () => S.units === 'si' ? 'K' : '°R',
};

// ---------- core computation ----------
function compute() {
  const m = S.method;
  if (S.mode === 'gas') {
    const y = { CO2: S.CO2 / 100, H2S: S.H2S / 100, N2: S.N2 / 100 };
    const pc = pseudoCritical(S.gamma, y, S.corr);
    const Tabs = S.T + 459.67;
    const g = gasProps(S.P, Tabs, S.gamma, pc, m);
    return { mode: 'gas', Ppr: g.Ppr, Tpr: g.Tpr, z: g.z, zr: g.zr, g, pc, Tabs, y, dakR: dak(g.Ppr, g.Tpr) };
  }
  const zr = zBy(m, S.Ppr, S.Tpr);
  const h = Math.max(1e-4, S.Ppr * 1e-4);
  const dZ = (zBy(m, S.Ppr + h, S.Tpr).z - zBy(m, Math.max(1e-6, S.Ppr - h), S.Tpr).z) / (S.Ppr + h - Math.max(1e-6, S.Ppr - h));
  const cpr = S.Ppr > 0 ? 1 / S.Ppr - dZ / zr.z : NaN;
  return { mode: 'direct', Ppr: S.Ppr, Tpr: S.Tpr, z: zr.z, zr, cpr, dZ, dakR: dak(S.Ppr, S.Tpr) };
}

// Every Tpr (1.05–3.0) whose DAK isotherm passes through (Ppr, Z): scan, then bisect each sign change.
function tprThrough(Ppr, Z, lo = 1.05, hi = 3.0) {
  if (!(Ppr > 0.02)) return [];
  const roots = [];
  let tPrev = lo, fPrev = dak(Ppr, tPrev).z - Z;
  for (let t = lo + 0.025; t <= hi + 1e-4; t += 0.025) {
    const f = dak(Ppr, t).z - Z;
    if (fPrev === 0) roots.push(tPrev);
    else if (fPrev * f < 0) {
      let a = tPrev, b = t, fa = fPrev;
      for (let i = 0; i < 40; i++) { const c = (a + b) / 2, fc = dak(Ppr, c).z - Z; if (fa * fc <= 0) b = c; else { a = c; fa = fc; } }
      roots.push((a + b) / 2);
    }
    tPrev = t; fPrev = f;
  }
  return roots;
}

// ---------- inputs ----------
function syncInputs() {
  $('modeGas').setAttribute('aria-pressed', S.mode === 'gas');
  $('modeDirect').setAttribute('aria-pressed', S.mode === 'direct');
  $('gasInputs').hidden = S.mode !== 'gas';
  $('directInputs').hidden = S.mode !== 'direct';
  $('unitField').setAttribute('aria-pressed', S.units === 'field');
  $('unitSI').setAttribute('aria-pressed', S.units === 'si');
  $('uP').textContent = U.pU(); $('uT').textContent = U.tU();
  const si = S.units === 'si';
  $('rgP').min = si ? 100 : 15; $('rgP').max = si ? 100000 : 15000; $('rgP').step = si ? 50 : 5;
  $('rgT').min = si ? 5 : 40; $('rgT').max = si ? 205 : 400; $('rgT').step = 1;
  if (document.activeElement !== $('inP')) $('inP').value = +U.pIn(S.P).toFixed(1);
  if (document.activeElement !== $('inT')) $('inT').value = +U.tIn(S.T).toFixed(1);
  $('rgP').value = U.pIn(S.P); $('rgT').value = U.tIn(S.T);
  if (document.activeElement !== $('inG')) $('inG').value = S.gamma;
  $('rgG').value = S.gamma;
  $('inCorr').value = S.corr;
  for (const k of ['CO2', 'H2S', 'N2']) if (document.activeElement !== $('in' + k)) $('in' + k).value = S[k];
  if (document.activeElement !== $('inPpr')) $('inPpr').value = +S.Ppr.toFixed(3);
  if (document.activeElement !== $('inTpr')) $('inTpr').value = +S.Tpr.toFixed(3);
  $('rgPpr').value = Math.min(15, S.Ppr); $('rgTpr').value = S.Tpr;
  $('inMethod').value = S.method;
  $('methodNote').textContent = METHODS[S.method].note;
  $('cbCompare').checked = S.compare;
  $('cbCompare').disabled = S.method === 'dak';
  document.querySelectorAll('[data-range]').forEach(b => b.setAttribute('aria-pressed', !viewCustom && b.dataset.range === S.range));
  document.querySelectorAll('[data-theme-set]').forEach(b => b.setAttribute('aria-pressed', b.dataset.themeSet === S.theme));
  $('btnSound').setAttribute('aria-pressed', S.sound);
  $('soundLbl').textContent = S.sound ? 'Sound on' : 'Sound off';
  $('tbMethod').textContent = METHODS[S.method].short + ' (' + METHODS[S.method].year + ')';
  $('tbUnits').textContent = S.mode === 'direct' ? 'Reduced' : (S.units === 'si' ? 'SI' : 'Field');
}

function num(v, fallback) { const x = parseFloat(v); return isFinite(x) ? x : fallback; }

function onChange(autoRange = true) {
  S.gamma = clamp(S.gamma, 0.55, 2.0);
  S.P = Math.max(1, S.P);
  for (const k of ['CO2', 'H2S', 'N2']) S[k] = clamp(S[k], 0, 80);
  if (S.CO2 + S.H2S + S.N2 > 95) S.N2 = Math.max(0, 95 - S.CO2 - S.H2S);
  S.Ppr = clamp(S.Ppr, 0, 30);
  S.Tpr = clamp(S.Tpr, 1.0, 3);
  const r = compute();
  if (autoRange && !gesture && !anim) {
    if (r.Ppr < view.x0 || r.Ppr > view.x1 || r.z < view.y0 || r.z > view.y1) {
      S.range = r.Ppr <= 8 && r.z >= 0.25 && r.z <= 1.1 ? 'low' : r.Ppr <= 15 && r.Ppr >= 7 && r.z >= 0.9 ? 'high' : r.Ppr <= 15 ? 'full' : 'ext';
      setView(RANGES[S.range], false);
    }
  }
  save();
  syncInputs();
  render(r);
}

function applyTheme() {
  if (S.theme === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', S.theme);
}
function isDark() {
  return S.theme === 'dark' || (S.theme === 'auto' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
}

function bind() {
  const clickFx = (el, fn, fx = 'click') => { el.onclick = ev => { Sound.play(fx); fn(ev); }; };
  clickFx($('modeGas'), () => { S.mode = 'gas'; onChange(); });
  clickFx($('modeDirect'), () => { const r = compute(); S.Ppr = +r.Ppr.toFixed(3); S.Tpr = +clamp(r.Tpr, 1, 3).toFixed(3); S.mode = 'direct'; onChange(); });
  clickFx($('unitField'), () => { S.units = 'field'; onChange(false); });
  clickFx($('unitSI'), () => { S.units = 'si'; onChange(false); });
  $('inP').oninput = e => { const v = num(e.target.value, null); if (v > 0) { S.P = U.pOut(v); onChange(); } };
  $('rgP').oninput = e => { S.P = U.pOut(num(e.target.value, S.P)); onChange(); };
  $('inT').oninput = e => { const v = num(e.target.value, null); if (v !== null) { S.T = U.tOut(v); onChange(); } };
  $('rgT').oninput = e => { S.T = U.tOut(num(e.target.value, S.T)); onChange(); };
  $('inG').oninput = e => { const v = num(e.target.value, null); if (v >= 0.55 && v <= 2) { S.gamma = v; onChange(); } };
  $('rgG').oninput = e => { S.gamma = num(e.target.value, S.gamma); onChange(); };
  $('inCorr').onchange = e => { Sound.play('click'); S.corr = e.target.value; onChange(); };
  for (const k of ['CO2', 'H2S', 'N2']) $('in' + k).oninput = e => { S[k] = num(e.target.value, 0); onChange(); };
  $('inPpr').oninput = e => { const v = num(e.target.value, null); if (v !== null && v >= 0) { S.Ppr = v; onChange(); } };
  $('rgPpr').oninput = e => { S.Ppr = num(e.target.value, S.Ppr); onChange(); };
  $('inTpr').oninput = e => { const v = num(e.target.value, null); if (v >= 1 && v <= 3) { S.Tpr = v; onChange(); } };
  $('rgTpr').oninput = e => { S.Tpr = num(e.target.value, S.Tpr); onChange(); };
  $('inMethod').onchange = e => { Sound.play('click'); S.method = e.target.value; if (S.method === 'dak') S.compare = false; onChange(); };
  $('cbCompare').onchange = e => { Sound.play('toggle', e.target.checked); S.compare = e.target.checked; onChange(false); };
  document.querySelectorAll('[data-range]').forEach(b => clickFx(b, () => { S.range = b.dataset.range; setView(RANGES[S.range], true); onChange(false); }, 'page'));
  clickFx($('btnReset'), () => {
    stopAnim(false);
    S = Object.assign(sanitize(null), { units: S.units, theme: S.theme, sound: S.sound, hidden: S.hidden, custom: S.custom, quizBest: S.quizBest, prop: S.prop });
    setView(RANGES[S.range], false); onChange();
  }, 'page');
  $('btnCopy').onclick = copyCSV;
  for (const id of ['inP', 'inT', 'inG', 'inCO2', 'inH2S', 'inN2', 'inPpr', 'inTpr']) $(id).onblur = () => syncInputs();

  document.querySelectorAll('[data-theme-set]').forEach(b => b.onclick = () => {
    S.theme = b.dataset.themeSet; applyTheme(); save(); syncInputs();
    Sound.play('theme', isDark()); drawAll();
  });
  $('btnSound').onclick = () => {
    S.sound = !S.sound; Sound.setEnabled(S.sound); save(); syncInputs();
    if (S.sound) Sound.play('toggle', true);
  };
  $('btnLink').onclick = () => {
    const url = linkForState();
    try { history.replaceState(null, '', url); } catch (e) { /* sandboxed frame */ }
    const done = () => { Sound.play('copy'); toast('Link copied: it opens this exact setup'); };
    const fail = () => toast('Copying is blocked here: the link is in the address bar');
    try { navigator.clipboard.writeText(url).then(done, fail); } catch (e) { fail(); }
  };

  // chart toolbar
  clickFx($('zoomIn'), () => { zoomAt(plotCenterX(), plotCenterY(), 0.7); Sound.play('zoom', true); });
  clickFx($('zoomOut'), () => { zoomAt(plotCenterX(), plotCenterY(), 1 / 0.7); Sound.play('zoom', false); });
  clickFx($('zoomFit'), () => { setView(RANGES[S.range], true); syncInputs(); draw(); }, 'page');
  $('btnPlay').onclick = () => { if (anim) stopAnim(true); else startAnim(); };
  clickFx($('btnRestore'), restoreAnim);
  $('btnQuiz').onclick = () => { Sound.play('toggle', !quiz); quiz ? endQuiz() : startQuiz(); };
  clickFx($('btnPng'), savePNG);
  clickFx($('btnPinHere'), () => { const r = lastResult; addPin(r.Ppr, r.z, r.Tpr); });
  clickFx($('btnAddIso'), addIso);
  $('inAddIso').onkeydown = e => { if (e.key === 'Enter') { Sound.play('click'); addIso(); } };

  // practice
  $('btnCheck').onclick = checkQuiz;
  clickFx($('btnNext'), newQuestion);
  $('inGuess').onkeydown = e => { if (e.key === 'Enter') { if (quiz && quiz.answered) { Sound.play('click'); newQuestion(); } else checkQuiz(); } };
  $('cbQuizHelp').onchange = e => { Sound.play('toggle', e.target.checked); draw(); };
  $('inTol').onchange = () => Sound.play('click');
}

let toastTimer = 0;
function toast(msg) {
  const t = $('chartToast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2200);
}

// ---------- view (zoom & pan) ----------
let view = Object.assign({}, RANGES[S.range]);
let viewCustom = false;
function setView(v, animate) {
  const target = { x0: v.x0, x1: v.x1, y0: v.y0, y1: v.y1 };
  viewCustom = !Object.values(RANGES).some(R => R.x0 === v.x0 && R.x1 === v.x1 && R.y0 === v.y0 && R.y1 === v.y1);
  if (!animate || reducedMotion()) { view = target; return; }
  const from = Object.assign({}, view), t0 = performance.now(), dur = 260;
  const stepV = now => {
    const u = Math.min(1, (now - t0) / dur), e = 1 - (1 - u) ** 3;
    for (const k of ['x0', 'x1', 'y0', 'y1']) view[k] = from[k] + (target[k] - from[k]) * e;
    draw();
    if (u < 1) requestAnimationFrame(stepV);
  };
  requestAnimationFrame(stepV);
}
function reducedMotion() { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
function clampView(v) {
  let { x0, x1, y0, y1 } = v;
  let sx = clamp(x1 - x0, LIMITS.minX, LIMITS.x1 - LIMITS.x0), sy = clamp(y1 - y0, LIMITS.minY, LIMITS.y1 - LIMITS.y0);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  x0 = cx - sx / 2; x1 = cx + sx / 2; y0 = cy - sy / 2; y1 = cy + sy / 2;
  if (x0 < LIMITS.x0) { x1 += LIMITS.x0 - x0; x0 = LIMITS.x0; }
  if (x1 > LIMITS.x1) { x0 -= x1 - LIMITS.x1; x1 = LIMITS.x1; }
  if (y0 < LIMITS.y0) { y1 += LIMITS.y0 - y0; y0 = LIMITS.y0; }
  if (y1 > LIMITS.y1) { y0 -= y1 - LIMITS.y1; y1 = LIMITS.y1; }
  return { x0, x1, y0, y1 };
}
function zoomAt(px, py, f) {
  const p = invX(px), z = invY(py);
  view = clampView({ x0: p - (p - view.x0) * f, x1: p + (view.x1 - p) * f, y0: z - (z - view.y0) * f, y1: z + (view.y1 - z) * f });
  viewCustom = true; curveCache.clear(); syncInputs(); draw();
}
function plotCenterX() { const r = lastResult; return r && r.Ppr >= view.x0 && r.Ppr <= view.x1 ? X(r.Ppr) : (M.l + W - M.r) / 2; }
function plotCenterY() { const r = lastResult; return r && r.z >= view.y0 && r.z <= view.y1 ? Y(r.z) : (M.t + H - M.b) / 2; }

// "nice" tick step: 1, 2 or 5 × 10^k
function niceStep(span, n) {
  const raw = span / n, mag = 10 ** Math.floor(Math.log10(raw)), r = raw / mag;
  return (r < 1.5 ? 1 : r < 3.5 ? 2 : r < 7.5 ? 5 : 10) * mag;
}
function decimalsFor(step) { return Math.max(0, Math.ceil(-Math.log10(step) - 1e-9)); }

// ---------- chart ----------
const cv = $('cv'), ctx = cv.getContext('2d'), plot = $('plot'), tip = $('tip');
let W = 0, H = 0, hover = null, lastResult = null, hoverIso = null, hoverPin = -1, nearDot = false;
const M = { l: 56, r: 46, t: 16, b: 46 };
const curveCache = new Map();

function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
function X(p) { return M.l + (p - view.x0) / (view.x1 - view.x0) * (W - M.l - M.r); }
function Y(z) { return M.t + (view.y1 - z) / (view.y1 - view.y0) * (H - M.t - M.b); }
function invX(x) { return view.x0 + (x - M.l) / (W - M.l - M.r) * (view.x1 - view.x0); }
function invY(y) { return view.y1 - (y - M.t) / (H - M.t - M.b) * (view.y1 - view.y0); }

function curve(method, Tpr) {
  const x0 = Math.max(0, view.x0), x1 = view.x1;
  const key = method + '|' + Tpr.toFixed(4) + '|' + x0.toFixed(4) + '|' + x1.toFixed(4);
  if (curveCache.has(key)) return curveCache.get(key);
  const pts = [], n = 320;
  for (let i = 0; i <= n; i++) {
    const p = Math.max(0.001, x0 + (x1 - x0) * i / n);
    pts.push([p, zBy(method, p, Tpr).z]);
  }
  if (curveCache.size > 300) curveCache.clear();
  curveCache.set(key, pts);
  return pts;
}

function drawPath(pts) {
  const span = view.y1 - view.y0;
  ctx.beginPath();
  let pen = false;
  for (const [p, z] of pts) {
    if (!isFinite(z) || z < view.y0 - span || z > view.y1 + span) { pen = false; continue; }
    const x = X(p), y = Y(z);
    if (!pen) { ctx.moveTo(x, y); pen = true; } else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function visibleIsotherms() {
  const std = STD_TPR.filter(t => !S.hidden.includes(t)).map(t => ({ t, custom: false }));
  return std.concat(S.custom.map(t => ({ t, custom: true })));
}

function resize() {
  const r = plot.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  W = r.width; H = r.height;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  M.l = W < 480 ? 44 : 56; M.r = W < 480 ? 36 : 46;
  draw();
}

function colors() {
  return { ink: css('--ink'), muted: css('--muted'), major: css('--grid-major'), minor: css('--grid-minor'), curve: css('--curve'),
    accent: css('--accent'), pin: css('--pin'), sheet: css('--sheet'), soft: css('--accent-soft'), hover: css('--hover'),
    target: css('--target'), bad: css('--bad'), rule: css('--rule') };
}
const FONT_DATA = '"LM Mono", "Latin Modern Mono", "Courier New", monospace';
const FONT_COND = '"Heros Cn", "Arial Narrow", sans-serif';

function draw() {
  if (!W || !lastResult) return;
  const r = lastResult, C = colors();
  ctx.clearRect(0, 0, W, H);
  const small = W < 480;
  const pw = W - M.l - M.r, ph = H - M.t - M.b;

  // grid
  const xMaj = niceStep(view.x1 - view.x0, small ? 5 : 8), yMaj = niceStep(view.y1 - view.y0, small ? 6 : 9);
  const xMin = xMaj / (String(xMaj / 10 ** Math.floor(Math.log10(xMaj)))[0] === '2' ? 4 : 5);
  const yMin = yMaj / (String(yMaj / 10 ** Math.floor(Math.log10(yMaj)))[0] === '2' ? 4 : 5);
  ctx.save();
  ctx.beginPath(); ctx.rect(M.l, M.t, pw, ph); ctx.clip();
  ctx.lineWidth = 1;
  const lines = (step, color) => {
    ctx.strokeStyle = color; ctx.beginPath();
    for (let i = Math.ceil(view.x0 / step - 1e-9); i * step <= view.x1 + 1e-9; i++) { const x = Math.round(X(i * step)) + 0.5; ctx.moveTo(x, M.t); ctx.lineTo(x, H - M.b); }
    ctx.stroke();
  };
  const hlines = (step, color) => {
    ctx.strokeStyle = color; ctx.beginPath();
    for (let i = Math.ceil(view.y0 / step - 1e-9); i * step <= view.y1 + 1e-9; i++) { const y = Math.round(Y(i * step)) + 0.5; ctx.moveTo(M.l, y); ctx.lineTo(W - M.r, y); }
    ctx.stroke();
  };
  lines(xMin, C.minor); hlines(yMin, C.minor); lines(xMaj, C.major); hlines(yMaj, C.major);
  if (view.y0 < 1 && view.y1 > 1) { ctx.strokeStyle = C.muted; ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.moveTo(M.l, Y(1)); ctx.lineTo(W - M.r, Y(1)); ctx.stroke(); ctx.setLineDash([]); }

  // isotherms (DAK)
  const isos = visibleIsotherms();
  for (const iso of isos) {
    ctx.lineWidth = iso.custom ? 1.4 : 1.15; ctx.strokeStyle = C.curve;
    if (iso.custom) ctx.setLineDash([7, 3]);
    drawPath(curve('dak', iso.t));
    ctx.setLineDash([]);
  }
  if (S.compare && S.method !== 'dak') {
    ctx.setLineDash([5, 4]); ctx.strokeStyle = C.pin; ctx.lineWidth = 1;
    for (const iso of isos) drawPath(curve(S.method, iso.t));
    ctx.setLineDash([]);
  }
  if (hoverIso !== null) { ctx.lineWidth = 3; ctx.strokeStyle = C.hover; ctx.globalAlpha = 0.6; drawPath(curve('dak', hoverIso)); ctx.globalAlpha = 1; }

  // practice target
  if (quiz) {
    ctx.strokeStyle = C.target; ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.moveTo(X(quiz.p), M.t); ctx.lineTo(X(quiz.p), H - M.b); ctx.stroke(); ctx.setLineDash([]);
    if ($('cbQuizHelp').checked || quiz.answered) { ctx.lineWidth = 2.6; drawPath(curve('dak', quiz.t)); }
    if (quiz.answered) {
      if (isFinite(quiz.guess)) {
        const gx = X(quiz.p), gy = Y(quiz.guess);
        ctx.strokeStyle = quiz.ok ? C.target : C.bad; ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.moveTo(gx - 6, gy - 6); ctx.lineTo(gx + 6, gy + 6); ctx.moveTo(gx + 6, gy - 6); ctx.lineTo(gx - 6, gy + 6); ctx.stroke();
      }
      ctx.fillStyle = C.target; ctx.beginPath(); ctx.arc(X(quiz.p), Y(quiz.z), 5.5, 0, Math.PI * 2); ctx.fill();
    }
  } else {
    // operating isotherm and point
    if (r.Tpr >= 1.0 && r.Tpr <= 3.5) { ctx.lineWidth = 2.6; ctx.strokeStyle = C.accent; drawPath(curve(S.method, r.Tpr)); }
  }

  // pins
  S.pins.forEach((pn, i) => {
    if (pn.p < view.x0 || pn.p > view.x1 || pn.z < view.y0 || pn.z > view.y1) return;
    const x = X(pn.p), y = Y(pn.z), big = i === hoverPin;
    ctx.fillStyle = C.pin; ctx.beginPath(); ctx.arc(x, y, big ? 11 : 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.sheet; ctx.font = '700 10px ' + FONT_COND; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(i + 1), x, y + 0.5);
  });

  if (!quiz && r.Ppr >= view.x0 && r.Ppr <= view.x1 && r.z >= view.y0 && r.z <= view.y1) {
    const x = X(r.Ppr), y = Y(r.z);
    ctx.strokeStyle = C.accent; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, H - M.b); ctx.moveTo(x, y); ctx.lineTo(M.l, y); ctx.stroke(); ctx.setLineDash([]);
    if (nearDot || (gesture && gesture.type === 'drag')) { ctx.fillStyle = C.soft; ctx.beginPath(); ctx.arc(x, y, 16, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = C.sheet; ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 2.6; ctx.strokeStyle = C.accent; ctx.stroke();
    ctx.fillStyle = C.accent; ctx.beginPath(); ctx.arc(x, y, 2.6, 0, Math.PI * 2); ctx.fill();
  }

  // hover crosshair
  if (hover && !(gesture && gesture.type !== 'hover')) {
    ctx.strokeStyle = C.ink; ctx.lineWidth = 0.8; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(X(hover.p), M.t); ctx.lineTo(X(hover.p), H - M.b); ctx.moveTo(M.l, Y(hover.z)); ctx.lineTo(W - M.r, Y(hover.z)); ctx.stroke();
    ctx.setLineDash([]);
    if (hover.near && !quiz) { ctx.lineWidth = 2; ctx.strokeStyle = C.hover; ctx.globalAlpha = 0.45; drawPath(curve('dak', hover.near.t)); ctx.globalAlpha = 1; }
  }
  ctx.restore();

  // frame (double rule, like a drawing border)
  ctx.strokeStyle = C.rule; ctx.lineWidth = 1.4; ctx.strokeRect(M.l + 0.5, M.t + 0.5, pw - 1, ph - 1);

  // axis numbers
  ctx.fillStyle = C.ink; ctx.font = (small ? '11px ' : '12.5px ') + FONT_DATA; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  const xd = decimalsFor(xMaj), yd = Math.max(1, decimalsFor(yMaj));
  for (let i = Math.ceil(view.x0 / xMaj - 1e-9); i * xMaj <= view.x1 + 1e-9; i++) ctx.fillText((i * xMaj).toFixed(xd), X(i * xMaj), H - M.b + 6);
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  for (let i = Math.ceil(view.y0 / yMaj - 1e-9); i * yMaj <= view.y1 + 1e-9; i++) ctx.fillText((i * yMaj).toFixed(yd), M.l - 6, Y(i * yMaj));
  ctx.font = '700 ' + (small ? 12 : 13) + 'px ' + FONT_COND;
  ctx.fillStyle = C.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText('Pseudo-reduced pressure, Ppr', M.l + pw / 2, H - 8);
  ctx.save(); ctx.translate(14, M.t + ph / 2); ctx.rotate(-Math.PI / 2); ctx.fillText('Compressibility factor, Z', 0, 0); ctx.restore();

  // isotherm labels: under each curve's minimum (as on the printed chart), else at the right edge
  ctx.font = (small ? '10px ' : '11px ') + FONT_DATA; ctx.textBaseline = 'middle';
  const placed = [], rightEnds = [];
  const fits = (x, y, w, h) => !placed.some(b => x < b.x + b.w && x + w > b.x && y < b.y + b.h && y + h > b.y);
  for (const iso of isos) {
    const pts = curve('dak', iso.t);
    let mi = -1;
    for (let i = 3; i < pts.length - 3; i++) if (mi < 0 || pts[i][1] < pts[mi][1]) mi = i;
    const interior = mi > 3 && mi < pts.length - 4 && pts[mi][1] < pts[mi - 3][1] && pts[mi][1] < pts[mi + 3][1];
    const txt = iso.t.toFixed(2) + (iso.custom ? '*' : '');
    const w = ctx.measureText(txt).width + 4, h = small ? 11 : 13;
    if (interior && pts[mi][1] > view.y0 && pts[mi][1] < view.y1) {
      const x = X(pts[mi][0]) - w / 2, y = Y(pts[mi][1]) + 4;
      if (y + h < H - M.b && x > M.l && x + w < W - M.r && fits(x, y, w, h)) {
        placed.push({ x, y, w, h });
        ctx.fillStyle = C.sheet; ctx.globalAlpha = 0.88; ctx.fillRect(x, y, w, h); ctx.globalAlpha = 1;
        ctx.fillStyle = iso.t === hoverIso ? C.ink : C.muted; ctx.textAlign = 'center'; ctx.fillText(txt, x + w / 2, y + h / 2 + 0.5);
        continue;
      }
    }
    const last = pts[pts.length - 1];
    const ly = Y(last[1]);
    if (ly >= M.t - 4 && ly <= H - M.b + 4) rightEnds.push({ txt, y: ly });
  }
  rightEnds.sort((a, b) => a.y - b.y);
  const gap = small ? 11 : 12.5;
  let lastY = -1e9;
  ctx.textAlign = 'left'; ctx.fillStyle = C.muted;
  for (const e of rightEnds) {
    if (e.y - lastY < gap || e.y < M.t + 6) continue; // crowded: the hover readout names every curve
    ctx.fillText(e.txt, W - M.r + 5, e.y);
    lastY = e.y;
  }
  ctx.fillStyle = C.ink; ctx.font = '700 11px ' + FONT_COND; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
  ctx.fillText('Tpr', W - M.r + 5, Math.max(11, M.t - 2));
}

function drawAll() { draw(); if (typeof Explorer !== 'undefined') Explorer.draw(); }

// ---------- pointer interaction ----------
let gesture = null; // {type: 'maybe' | 'drag' | 'pan' | 'pinch', ...}
const pointers = new Map();

function local(ev) { const rect = cv.getBoundingClientRect(); return { x: ev.clientX - rect.left, y: ev.clientY - rect.top }; }
function inPlot(d) { return d.x >= M.l && d.x <= W - M.r && d.y >= M.t && d.y <= H - M.b; }
function isNearDot(d) {
  const r = lastResult;
  if (!r || quiz) return false;
  return Math.hypot(d.x - X(r.Ppr), d.y - Y(r.z)) <= (pointers.size && lastPointerType === 'touch' ? 24 : 14);
}
let lastPointerType = 'mouse';

function readAt(p, z) {
  let near = null;
  for (const { t } of visibleIsotherms()) { const zt = dak(p, t).z; const d = Math.abs(zt - z); if (!near || d < near.d) near = { t, z: zt, d }; }
  return { near, roots: tprThrough(p, z) };
}

function showTip(d) {
  const p = invX(d.x), z = invY(d.y);
  const rd = readAt(p, z);
  hover = { p, z, near: rd.near };
  if (quiz) {
    tip.innerHTML = `<span class="t">Ppr</span> <b>${fmt(p, 3)}</b>`;
  } else {
    const tprTxt = rd.roots.length ? rd.roots.map(t => t.toFixed(3)).join(' or ') : (p <= 0.02 ? '—' : 'outside 1.05–3.0');
    tip.innerHTML = `<span class="t">Ppr</span> <b>${fmt(p, 3)}</b> &nbsp;<span class="t">Z</span> <b>${fmt(z, 4)}</b><br>`
      + `<span class="t">Tpr through point</span> ${tprTxt}<br>`
      + (rd.near ? `<span class="t">Nearest isotherm</span> ${rd.near.t.toFixed(2)} → Z ${fmt(rd.near.z, 4)}` : '');
  }
  tip.hidden = false;
  const tw = tip.offsetWidth, th = tip.offsetHeight;
  let tx = d.x + 16, ty = d.y - th - 14;
  if (tx + tw > W - 4) tx = d.x - tw - 16;
  if (ty < 4) ty = d.y + 18;
  tip.style.left = Math.max(4, tx) + 'px'; tip.style.top = Math.max(4, ty) + 'px';
}
function hideTip() { hover = null; tip.hidden = true; }

let lastBand = -1;
function bandOf(t) { let i = 0; while (i < STD_TPR.length && STD_TPR[i] <= t) i++; return i; }

// Move the operating point to the chart position (p, z): pick the isotherm through it closest to the current one.
function moveOpTo(p, z) {
  const r = lastResult;
  p = clamp(p, 0.02, 30);
  const roots = tprThrough(p, z, 1.0, 3.0);
  let t = r.Tpr;
  if (roots.length) t = roots.reduce((a, b) => Math.abs(b - r.Tpr) < Math.abs(a - r.Tpr) ? b : a);
  t = clamp(t, 1.0, 3.0);
  const band = bandOf(t);
  if (lastBand >= 0 && band !== lastBand) Sound.play('tick');
  lastBand = band;
  if (S.mode === 'gas') {
    S.P = +(p * r.pc.pc).toFixed(1);
    S.T = +(t * r.pc.tc - 459.67).toFixed(1);
  } else {
    S.Ppr = +p.toFixed(3); S.Tpr = +t.toFixed(3);
  }
  onChange(false);
}

cv.addEventListener('pointerdown', ev => {
  lastPointerType = ev.pointerType;
  cv.focus({ preventScroll: true });
  try { cv.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
  const d = local(ev);
  pointers.set(ev.pointerId, d);
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
    gesture = { type: 'pinch', dist: Math.hypot(a.x - b.x, a.y - b.y), view0: Object.assign({}, view), p: invX(cx), z: invY(cy) };
    hideTip(); return;
  }
  if (isNearDot(d)) { gesture = { type: 'drag' }; lastBand = bandOf(lastResult.Tpr); Sound.play('grab'); hideTip(); cv.classList.add('grabbing'); draw(); return; }
  gesture = { type: 'maybe', x0: d.x, y0: d.y, view0: Object.assign({}, view) };
});

cv.addEventListener('pointermove', ev => {
  const d = local(ev);
  if (pointers.has(ev.pointerId)) pointers.set(ev.pointerId, d);
  if (!gesture) {
    if (!inPlot(d)) { hideTip(); nearDot = false; cv.classList.remove('grab'); draw(); return; }
    const nd = isNearDot(d);
    if (nd !== nearDot) { nearDot = nd; cv.classList.toggle('grab', nd); }
    if (nd) hideTip(); else showTip(d);
    draw(); return;
  }
  if (gesture.type === 'pinch' && pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    const f = gesture.dist / Math.max(10, dist), v = gesture.view0;
    view = clampView({ x0: gesture.p - (gesture.p - v.x0) * f, x1: gesture.p + (v.x1 - gesture.p) * f,
      y0: gesture.z - (gesture.z - v.y0) * f, y1: gesture.z + (v.y1 - gesture.z) * f });
    viewCustom = true; syncInputs(); draw(); return;
  }
  if (gesture.type === 'drag') { moveOpTo(invX(d.x), invY(d.y)); return; }
  if (gesture.type === 'maybe' && Math.hypot(d.x - gesture.x0, d.y - gesture.y0) > 5) { gesture.type = 'pan'; hideTip(); cv.classList.add('grabbing'); }
  if (gesture.type === 'pan') {
    const v = gesture.view0;
    const dp = (d.x - gesture.x0) / (W - M.l - M.r) * (v.x1 - v.x0), dz = (d.y - gesture.y0) / (H - M.t - M.b) * (v.y1 - v.y0);
    view = clampView({ x0: v.x0 - dp, x1: v.x1 - dp, y0: v.y0 + dz, y1: v.y1 + dz });
    viewCustom = true; syncInputs(); draw();
  }
});

function endPointer(ev) {
  pointers.delete(ev.pointerId);
  if (!gesture) return;
  const g = gesture;
  if (g.type === 'pinch') { if (pointers.size === 0) gesture = null; return; }
  gesture = null;
  cv.classList.remove('grabbing');
  if (ev.type === 'pointercancel') { draw(); return; }
  const d = local(ev);
  if (g.type === 'maybe' && inPlot(d) && !quiz) {
    const p = invX(d.x), z = invY(d.y), roots = tprThrough(p, z);
    addPin(p, z, roots.length ? roots[0] : null);
  } else if (g.type === 'drag') { Sound.play('drop'); onChange(true); }
  draw();
}
cv.addEventListener('pointerup', endPointer);
cv.addEventListener('pointercancel', endPointer);
cv.addEventListener('pointerleave', () => { if (!gesture) { hideTip(); nearDot = false; draw(); } });
cv.addEventListener('dblclick', ev => { ev.preventDefault(); setView(RANGES[S.range], true); syncInputs(); Sound.play('zoom', false); });

let wheelHintAt = 0;
cv.addEventListener('wheel', ev => {
  if (document.activeElement !== cv && !ev.ctrlKey && !ev.metaKey) {
    if (performance.now() - wheelHintAt > 4000) { wheelHintAt = performance.now(); toast('Click the chart first, then scroll to zoom'); }
    return;
  }
  ev.preventDefault();
  const d = local(ev);
  const f = Math.exp(clamp(ev.deltaY, -100, 100) * 0.0022);
  zoomAt(d.x, d.y, f);
  Sound.play('tick');
}, { passive: false });

cv.addEventListener('keydown', ev => {
  const big = ev.shiftKey;
  let handled = true;
  switch (ev.key) {
    case 'ArrowLeft': case 'ArrowRight': {
      const s = ev.key === 'ArrowRight' ? 1 : -1;
      if (S.mode === 'gas') S.P = Math.max(1, S.P * (1 + s * (big ? 0.05 : 0.01))); else S.Ppr = clamp(S.Ppr + s * (big ? 0.1 : 0.01), 0, 30);
      Sound.play('tick'); onChange(); break;
    }
    case 'ArrowUp': case 'ArrowDown': {
      const s = ev.key === 'ArrowUp' ? 1 : -1;
      if (S.mode === 'gas') S.T += s * (big ? 10 : 1); else S.Tpr = clamp(S.Tpr + s * (big ? 0.05 : 0.01), 1, 3);
      Sound.play('tick'); onChange(); break;
    }
    case '+': case '=': zoomAt(plotCenterX(), plotCenterY(), 0.7); Sound.play('zoom', true); break;
    case '-': case '_': zoomAt(plotCenterX(), plotCenterY(), 1 / 0.7); Sound.play('zoom', false); break;
    case '0': setView(RANGES[S.range], true); syncInputs(); Sound.play('page'); break;
    case 'p': case 'P': case 'Enter': { const r = lastResult; addPin(r.Ppr, r.z, r.Tpr); break; }
    default: handled = false;
  }
  if (handled) ev.preventDefault();
});

// ---------- pins ----------
function addPin(p, z, t) {
  S.pins.push({ p: +p.toFixed(4), z: +z.toFixed(4), t: t !== null && isFinite(t) ? +t.toFixed(4) : null });
  if (S.pins.length > 12) S.pins.shift();
  Sound.play('pin');
  save(); renderPins(); draw();
}

function renderPins() {
  const box = $('pins');
  box.innerHTML = '';
  $('pinsEmpty').hidden = S.pins.length > 0;
  S.pins.forEach((pn, i) => {
    const row = document.createElement('div');
    row.className = 'pin';
    row.innerHTML = `<span class="n">${i + 1}</span><span>P<sub>pr</sub> ${fmt(pn.p, 3)} &nbsp;Z ${fmt(pn.z, 4)}<br>T<sub>pr</sub> ${pn.t ? fmt(pn.t, 3) : 'outside 1.05–3.0'}</span>`;
    row.onmouseenter = () => { hoverPin = i; draw(); };
    row.onmouseleave = () => { hoverPin = -1; draw(); };
    const acts = document.createElement('span'); acts.className = 'acts';
    if (pn.t) {
      const use = document.createElement('button'); use.className = 'btn'; use.type = 'button'; use.textContent = 'Use';
      use.title = 'Make this the operating point (Ppr & Tpr mode)';
      use.onclick = () => { Sound.play('click'); S.mode = 'direct'; S.Ppr = pn.p; S.Tpr = pn.t; onChange(); };
      acts.appendChild(use);
    }
    const del = document.createElement('button'); del.className = 'btn'; del.type = 'button'; del.textContent = '×';
    del.setAttribute('aria-label', 'Remove reading ' + (i + 1));
    del.onclick = () => { Sound.play('unpin'); hoverPin = -1; S.pins.splice(i, 1); save(); renderPins(); draw(); };
    acts.appendChild(del);
    row.appendChild(acts);
    box.appendChild(row);
  });
  if (S.pins.length) {
    const clr = document.createElement('button'); clr.className = 'btn'; clr.type = 'button'; clr.textContent = 'Clear all';
    clr.onclick = () => { Sound.play('unpin'); S.pins = []; save(); renderPins(); draw(); };
    box.appendChild(clr);
  }
}

// ---------- isotherm chips ----------
function renderIsoChips() {
  const box = $('isoChips');
  box.innerHTML = '';
  const mk = (label, cls, pressed, onClick, t) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'isochip' + (cls ? ' ' + cls : ''); b.textContent = label;
    if (pressed !== null) b.setAttribute('aria-pressed', pressed);
    b.onclick = onClick;
    if (t !== undefined) { b.onmouseenter = () => { hoverIso = t; draw(); }; b.onmouseleave = () => { hoverIso = null; draw(); }; }
    box.appendChild(b);
  };
  mk('All', S.hidden.length === 0 ? 'act' : '', null, () => { Sound.play('click'); S.hidden = []; save(); renderIsoChips(); draw(); });
  mk('None', S.hidden.length === STD_TPR.length ? 'act' : '', null, () => { Sound.play('click'); S.hidden = STD_TPR.slice(); save(); renderIsoChips(); draw(); });
  for (const t of STD_TPR) {
    const on = !S.hidden.includes(t);
    mk(t.toFixed(2), '', on, () => {
      Sound.play('toggle', !on);
      S.hidden = on ? S.hidden.concat(t) : S.hidden.filter(x => x !== t);
      save(); renderIsoChips(); draw();
    }, t);
  }
  for (const t of S.custom) {
    mk(t.toFixed(2) + ' ×', 'custom', null, () => { Sound.play('unpin'); hoverIso = null; S.custom = S.custom.filter(x => x !== t); save(); renderIsoChips(); draw(); }, t);
  }
}
function addIso() {
  const v = num($('inAddIso').value, NaN);
  if (!(v >= 1.0 && v <= 3.0)) { toast('Enter a Tpr between 1.0 and 3.0'); return; }
  const t = +v.toFixed(3);
  if (STD_TPR.includes(t)) { S.hidden = S.hidden.filter(x => x !== t); }
  else if (!S.custom.includes(t)) { S.custom = S.custom.concat(t).slice(-6); }
  $('inAddIso').value = '';
  save(); renderIsoChips(); draw();
}

// ---------- depletion playback ----------
let anim = null, animSaved = null;
function startAnim() {
  if (quiz) endQuiz();
  const gas = S.mode === 'gas';
  const from = gas ? S.P : S.Ppr, to = gas ? 14.696 : 0.03;
  if (from <= to * 1.1) { toast('Already at atmospheric pressure'); return; }
  animSaved = { P: S.P, Ppr: S.Ppr };
  anim = { from, to, t0: performance.now(), dur: clamp(2500 + (gas ? from : from * 500) * 0.6, 3000, 7000), lastStep: 0, raf: 0 };
  Sound.play('start');
  $('btnPlay').classList.add('live'); $('playLbl').textContent = 'Stop';
  $('playIcon').setAttribute('d', 'M5 5h10v10H5z');
  $('btnRestore').hidden = true;
  const frame = now => {
    if (!anim) return;
    const u = Math.min(1, (now - anim.t0) / anim.dur);
    const e = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
    const v = anim.from + (anim.to - anim.from) * e;
    if (gas) S.P = v; else S.Ppr = v;
    const stepN = Math.floor(u * 12);
    if (stepN > anim.lastStep) { anim.lastStep = stepN; Sound.play('step'); }
    onChange(false);
    if (u >= 1) {
      stopAnim(false);
      Sound.play('end');
      toast(gas ? 'At 14.7 psia Z is close to 1: the gas behaves almost ideally' : 'At low Ppr every isotherm meets Z = 1');
    } else anim.raf = requestAnimationFrame(frame);
  };
  anim.raf = requestAnimationFrame(frame);
}
function stopAnim(byUser) {
  if (anim) { cancelAnimationFrame(anim.raf); anim = null; }
  $('btnPlay').classList.remove('live'); $('playLbl').textContent = 'Deplete';
  $('playIcon').setAttribute('d', 'M6 4l10 6-10 6z');
  if (animSaved) $('btnRestore').hidden = false;
  if (byUser) { Sound.play('drop'); onChange(true); }
}
function restoreAnim() {
  if (!animSaved) return;
  S.P = animSaved.P; S.Ppr = animSaved.Ppr; animSaved = null;
  $('btnRestore').hidden = true;
  onChange(true);
}

// ---------- practice: read Z off the chart ----------
let quiz = null;
const qStats = { n: 0, ok: 0, streak: 0 };
function startQuiz() {
  if (anim) stopAnim(false);
  quiz = { p: 0, t: 0, z: 0, answered: false };
  $('btnQuiz').setAttribute('aria-pressed', 'true');
  $('quiz').hidden = false;
  newQuestion();
}
function endQuiz() {
  quiz = null;
  $('btnQuiz').setAttribute('aria-pressed', 'false');
  $('quiz').hidden = true;
  draw();
}
function newQuestion() {
  if (!quiz) return;
  const isos = visibleIsotherms().map(i => i.t);
  const pool = isos.length ? isos : STD_TPR;
  const span = view.x1 - view.x0, dec = span > 3 ? 1 : 2, unit = dec === 1 ? 0.1 : 0.01;
  let p = 1, t = 1.5, z = 1;
  for (let k = 0; k < 40; k++) {
    t = pool[Math.floor(Math.random() * pool.length)];
    p = Math.round((Math.max(view.x0, 0.2) + span * (0.06 + 0.88 * Math.random())) / unit) * unit;
    z = dak(p, t).z;
    if (p > 0.1 && z > view.y0 + 0.02 * (view.y1 - view.y0) && z < view.y1 - 0.02 * (view.y1 - view.y0)) break;
  }
  Object.assign(quiz, { p, t, z, answered: false, guess: NaN, ok: false });
  $('quizQ').innerHTML = `On the <b>T<sub>pr</sub> = ${t.toFixed(2)}</b> isotherm, what is Z at <b>P<sub>pr</sub> = ${p.toFixed(dec)}</b>? Read it off the chart.`;
  $('quizFb').textContent = ''; $('quizFb').className = 'quiz-fb';
  $('inGuess').value = '';
  try { $('inGuess').focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  renderScore();
  draw();
}
function checkQuiz() {
  if (!quiz || quiz.answered) return;
  const g = num($('inGuess').value, NaN);
  if (!isFinite(g)) { $('quizFb').textContent = 'Type the Z you read, e.g. 0.85'; return; }
  const tol = num($('inTol').value, 0.01), err = g - quiz.z;
  quiz.answered = true; quiz.guess = g; quiz.ok = Math.abs(err) <= tol;
  qStats.n++;
  if (quiz.ok) { qStats.ok++; qStats.streak++; if (qStats.streak > S.quizBest) { S.quizBest = qStats.streak; save(); } }
  else qStats.streak = 0;
  $('quizFb').className = 'quiz-fb ' + (quiz.ok ? 'good' : 'miss');
  $('quizFb').textContent = (quiz.ok ? 'Good reading. ' : 'Not quite. ') + `The chart gives Z = ${quiz.z.toFixed(3)} (you were ${err >= 0 ? '+' : '−'}${Math.abs(err).toFixed(3)}). Press Enter for the next one.`;
  Sound.play(quiz.ok ? 'correct' : 'wrong');
  renderScore(); draw();
}
function renderScore() {
  $('quizScore').textContent = `Score ${qStats.ok} / ${qStats.n} · streak ${qStats.streak} · best streak ${S.quizBest}`;
}

// ---------- PNG export ----------
function savePNG() {
  const dpr = cv.width / W;
  const pad = 34 * dpr;
  const out = document.createElement('canvas');
  out.width = cv.width; out.height = cv.height + pad;
  const o = out.getContext('2d');
  o.fillStyle = css('--sheet'); o.fillRect(0, 0, out.width, out.height);
  o.drawImage(cv, 0, 0);
  const r = lastResult;
  o.fillStyle = css('--ink'); o.font = `${12 * dpr}px ${FONT_DATA}`; o.textBaseline = 'middle';
  const label = quiz ? 'Standing–Katz chart (DAK)' : `Standing–Katz chart (DAK) · ${METHODS[S.method].short}: Ppr ${fmt(r.Ppr, 3)}, Tpr ${fmt(r.Tpr, 3)}, Z = ${fmt(r.z, 4)}`;
  o.fillText(label, 12 * dpr, cv.height + pad / 2);
  const done = blob => {
    if (!blob) { toast('Saving images is blocked here'); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'standing-katz-chart.png';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast('Chart saved as PNG');
  };
  try { out.toBlob(done, 'image/png'); } catch (e) { toast('Saving images is blocked here'); }
}

// ---------- readout ----------
let prevZ = NaN;
function render(r) {
  lastResult = r;
  const zEl = $('outZ');
  zEl.textContent = fmt(r.z, 4);
  if (isFinite(prevZ) && Math.abs(r.z - prevZ) > 5e-5 && !gesture && !anim) { zEl.classList.remove('flash'); void zEl.offsetWidth; zEl.classList.add('flash'); }
  prevZ = r.z;
  const chips = [];
  const meth = METHODS[S.method];
  if (!isFinite(r.z) || r.z <= 0) chips.push(['bad', 'No valid solution']);
  else if (meth.inRange(r.Ppr, r.Tpr)) chips.push(['ok', 'Within ' + meth.short + ' range']);
  else chips.push(['warn', 'Outside ' + meth.short + ' range']);
  if (r.Tpr < 1.05) chips.push(['warn', 'Tpr < 1.05: near critical']);
  if (r.Ppr > 15) chips.push(['warn', 'Ppr > 15: beyond printed chart']);
  if ((S.method === 'dak' || S.method === 'hy') && r.zr && r.zr.ok === false) chips.push(['bad', 'Iteration did not converge']);
  if (r.mode === 'gas' && r.pc.steps.eps > 0.01) chips.push(['ok', 'Sour-gas corrected']);
  $('chips').innerHTML = chips.map(([c, t]) => `<span class="chip ${c}">${t}</span>`).join('');

  const kv = [];
  const row = (k, v) => kv.push(`<dt>${k}</dt><dd>${v}</dd>`);
  const sep = () => kv.push('<div class="sep"></div>');
  if (r.mode === 'gas') {
    const g = r.g, si = S.units === 'si';
    row('T<sub>pc</sub>', fmt(U.tcIn(r.pc.tc), 1) + ' ' + U.tcU());
    row('P<sub>pc</sub>', fmt(U.pIn(r.pc.pc), si ? 0 : 1) + ' ' + U.pU());
    row('<i>P<sub>pr</sub></i>', fmt(r.Ppr, 4));
    row('<i>T<sub>pr</sub></i>', fmt(r.Tpr, 4));
    if (r.dakR) row('ρ<sub>r</sub> (DAK)', fmt(r.dakR.rho, 4));
    sep();
    row('M<sub>a</sub>', fmt(g.Ma, 2) + ' lb/lb-mol');
    row('ρ<sub>g</sub>', si ? fmt(g.rho * 16.01846, 2) + ' kg/m³' : fmt(g.rho, 3) + ' lb/ft³');
    row('B<sub>g</sub>', si ? fmt(g.Bg, 6) + ' m³/sm³' : fmt(g.Bg, 6) + ' ft³/scf');
    if (!si) row('B<sub>g</sub>', fmt(g.Bg / 5.614583 * 1000, 4) + ' rb/Mscf');
    row('E<sub>g</sub>', fmt(g.Eg, 2) + (si ? ' sm³/m³' : ' scf/ft³'));
    row('c<sub>g</sub>', si ? fmtE(g.cg / PSI_KPA) + ' kPa⁻¹' : fmtE(g.cg) + ' psi⁻¹');
    row('c<sub>pr</sub>', fmt(g.cpr, 4));
    row('μ<sub>g</sub> (LGE)', fmt(g.mu, 4) + (si ? ' mPa·s' : ' cp'));
  } else {
    row('<i>P<sub>pr</sub></i>', fmt(r.Ppr, 4));
    row('<i>T<sub>pr</sub></i>', fmt(r.Tpr, 4));
    if (r.dakR) row('ρ<sub>r</sub> (DAK)', fmt(r.dakR.rho, 4));
    row('(∂Z/∂P<sub>pr</sub>)<sub>T</sub>', fmt(r.dZ, 4));
    row('c<sub>pr</sub>', fmt(r.cpr, 4));
  }
  $('outKV').innerHTML = kv.join('');

  renderSteps(r);
  renderCompare(r);
  renderIso(r);
  renderPins();
  draw();
  if (typeof Explorer !== 'undefined') Explorer.render(r);
}

// ---------- worked solution ----------
function renderSteps(r) {
  const out = [];
  const step = (title, text, eqs) => out.push(`<div class="step"><h3>${title}</h3>${text ? `<p>${text}</p>` : ''}<div class="eqs">${eqs.map(e => `<div class="eq">${e}</div>`).join('')}</div></div>`);
  const R = v => `<span class="r">${v}</span>`;
  if (r.mode === 'gas') {
    const s = r.pc.steps, g = r.g;
    step('Apparent molecular weight', S.units === 'si' ? 'The worked solution is in field units (psia, °R), the units the correlations were published in.' : '',
      [`M<sub>a</sub> = 28.9647 γ<sub>g</sub> = 28.9647 × ${fmt(S.gamma, 3)} = ${R(fmt(g.Ma, 3) + ' lb/lb-mol')}`]);
    if (s.yNon > 0) {
      step('Hydrocarbon-fraction gravity', 'Remove the non-hydrocarbons before applying the gravity correlation (Standing\'s method).',
        [`γ<sub>HC</sub> = (γ<sub>g</sub> − Σ y<sub>i</sub>M<sub>i</sub> / 28.9647) / (1 − Σ y<sub>i</sub>)`,
         `γ<sub>HC</sub> = (${fmt(S.gamma, 3)} − ${fmt(s.nonMass, 4)} / 28.9647) / (1 − ${fmt(s.yNon, 4)}) = ${R(fmt(s.gHC, 4))}`]);
    }
    const gUse = s.yNon > 0 ? 'γ<sub>HC</sub>' : 'γ<sub>g</sub>';
    step('Pseudo-critical properties', r.pc.corr.name + (s.yNon > 0 ? ', applied to the hydrocarbon fraction.' : '.'),
      [r.pc.corr.tcTxt.replace(/γ/g, gUse) + ` = ${R(fmt(s.tcHC, 2) + ' °R')}`,
       r.pc.corr.pcTxt.replace(/γ/g, gUse) + ` = ${R(fmt(s.pcHC, 2) + ' psia')}`]);
    if (s.yNon > 0) {
      step('Kay\'s mixing rule', `N<sub>2</sub> ${fmt(S.N2, 2)}%, CO<sub>2</sub> ${fmt(S.CO2, 2)}%, H<sub>2</sub>S ${fmt(S.H2S, 2)}%.`,
        [`T′<sub>pc</sub> = (1 − Σy<sub>i</sub>) T<sub>pc,HC</sub> + Σ y<sub>i</sub>T<sub>c,i</sub> = ${R(fmt(s.tcMix, 2) + ' °R')}`,
         `P′<sub>pc</sub> = (1 − Σy<sub>i</sub>) P<sub>pc,HC</sub> + Σ y<sub>i</sub>P<sub>c,i</sub> = ${R(fmt(s.pcMix, 2) + ' psia')}`]);
    }
    if (s.eps > 0) {
      step('Wichert–Aziz sour-gas correction', 'Adjusts for CO<sub>2</sub> and H<sub>2</sub>S, which the Standing–Katz chart did not include.',
        [`A = y<sub>CO2</sub> + y<sub>H2S</sub> = ${fmt(s.A, 4)},  B = y<sub>H2S</sub> = ${fmt(s.B, 4)}`,
         `ε = 120 (A<sup>0.9</sup> − A<sup>1.6</sup>) + 15 (B<sup>0.5</sup> − B<sup>4</sup>) = ${R(fmt(s.eps, 3) + ' °R')}`,
         `T*<sub>pc</sub> = T′<sub>pc</sub> − ε = ${fmt(s.tcMix, 2)} − ${fmt(s.eps, 3)} = ${R(fmt(r.pc.tc, 2) + ' °R')}`,
         `P*<sub>pc</sub> = P′<sub>pc</sub> T*<sub>pc</sub> / (T′<sub>pc</sub> + B(1 − B)ε) = ${R(fmt(r.pc.pc, 2) + ' psia')}`]);
    }
    step('Pseudo-reduced conditions', '',
      [`T = ${fmt(S.T, 2)} °F + 459.67 = ${fmt(r.Tabs, 2)} °R`,
       `T<sub>pr</sub> = T / T<sub>pc</sub> = ${fmt(r.Tabs, 2)} / ${fmt(r.pc.tc, 2)} = ${R(fmt(r.Tpr, 4))}`,
       `P<sub>pr</sub> = P / P<sub>pc</sub> = ${fmt(S.P, 2)} / ${fmt(r.pc.pc, 2)} = ${R(fmt(r.Ppr, 4))}`]);
  } else {
    step('Pseudo-reduced conditions', 'Entered directly.', [`P<sub>pr</sub> = ${R(fmt(r.Ppr, 4))},  T<sub>pr</sub> = ${R(fmt(r.Tpr, 4))}`]);
  }

  const P = r.Ppr, T = r.Tpr;
  if (S.method === 'dak') {
    const it = r.dakR.iters.slice(0, 8).map(o => `k = ${o.i}:  ρ<sub>r</sub> = ${fmt(o.rho, 6)}  →  Z = ${fmt(o.z, 6)}`);
    step('Solve the Dranchuk–Abou-Kassem equation', 'Newton iteration on the reduced density, starting from Z = 1.',
      [`ρ<sub>r</sub> = 0.27 P<sub>pr</sub> / (Z T<sub>pr</sub>)`,
       `Z = 1 + (A<sub>1</sub> + A<sub>2</sub>/T<sub>pr</sub> + A<sub>3</sub>/T<sub>pr</sub><sup>3</sup> + A<sub>4</sub>/T<sub>pr</sub><sup>4</sup> + A<sub>5</sub>/T<sub>pr</sub><sup>5</sup>) ρ<sub>r</sub>`,
       `&nbsp;&nbsp;&nbsp;&nbsp;+ (A<sub>6</sub> + A<sub>7</sub>/T<sub>pr</sub> + A<sub>8</sub>/T<sub>pr</sub><sup>2</sup>) ρ<sub>r</sub><sup>2</sup> − A<sub>9</sub>(A<sub>7</sub>/T<sub>pr</sub> + A<sub>8</sub>/T<sub>pr</sub><sup>2</sup>) ρ<sub>r</sub><sup>5</sup>`,
       `&nbsp;&nbsp;&nbsp;&nbsp;+ A<sub>10</sub>(1 + A<sub>11</sub>ρ<sub>r</sub><sup>2</sup>)(ρ<sub>r</sub><sup>2</sup>/T<sub>pr</sub><sup>3</sup>) exp(−A<sub>11</sub>ρ<sub>r</sub><sup>2</sup>)`,
       `A<sub>1…11</sub> = 0.3265, −1.0700, −0.5339, 0.01569, −0.05165, 0.5475, −0.7361, 0.1844, 0.1056, 0.6134, 0.7210`,
       `Initial guess: ρ<sub>r</sub> = 0.27 × ${fmt(P, 4)} / (1 × ${fmt(T, 4)}) = ${fmt(0.27 * P / T, 6)}`,
       ...it,
       (r.dakR.iters.length > 8 ? `… ${r.dakR.iters.length} iterations in total` : `Converged after ${r.dakR.iters.length} iterations`),
       `Z = ${R(fmt(r.z, 5))}`]);
  } else if (S.method === 'hy') {
    const t = 1 / T;
    step('Solve the Hall–Yarborough equation', 'Newton iteration on the reduced density y.',
      [`t = 1 / T<sub>pr</sub> = ${fmt(t, 5)}`,
       `−A P<sub>pr</sub> + (y + y<sup>2</sup> + y<sup>3</sup> − y<sup>4</sup>)/(1 − y)<sup>3</sup> − B y<sup>2</sup> + C y<sup>D</sup> = 0`,
       `A = 0.06125 t e<sup>−1.2(1−t)²</sup> = ${fmt(0.06125 * t * Math.exp(-1.2 * (1 - t) ** 2), 6)}`,
       `B = 14.76t − 9.76t² + 4.58t³ = ${fmt(14.76 * t - 9.76 * t * t + 4.58 * t ** 3, 5)}`,
       `C = 90.7t − 242.2t² + 42.4t³ = ${fmt(90.7 * t - 242.2 * t * t + 42.4 * t ** 3, 5)}`,
       `D = 2.18 + 2.82t = ${fmt(2.18 + 2.82 * t, 5)}`,
       `Z = A P<sub>pr</sub> / y = ${R(fmt(r.z, 5))}`]);
  } else if (S.method === 'bb') {
    const A = 1.39 * Math.sqrt(T - 0.92) - 0.36 * T - 0.101;
    const B = (0.62 - 0.23 * T) * P + (0.066 / (T - 0.86) - 0.037) * P * P + 0.32 * P ** 6 / 10 ** (9 * (T - 1));
    const C = 0.132 - 0.32 * Math.log10(T), D = 10 ** (0.3106 - 0.49 * T + 0.1824 * T * T);
    step('Evaluate Brill–Beggs (explicit)', '',
      [`A = 1.39(T<sub>pr</sub> − 0.92)<sup>0.5</sup> − 0.36T<sub>pr</sub> − 0.101 = ${fmt(A, 5)}`,
       `B = (0.62 − 0.23T<sub>pr</sub>)P<sub>pr</sub> + [0.066/(T<sub>pr</sub> − 0.86) − 0.037]P<sub>pr</sub><sup>2</sup> + 0.32P<sub>pr</sub><sup>6</sup>/10<sup>9(T<sub>pr</sub>−1)</sup> = ${fmt(B, 5)}`,
       `C = 0.132 − 0.32 log T<sub>pr</sub> = ${fmt(C, 5)}`,
       `D = 10<sup>(0.3106 − 0.49T<sub>pr</sub> + 0.1824T<sub>pr</sub>²)</sup> = ${fmt(D, 5)}`,
       `Z = A + (1 − A)/e<sup>B</sup> + C P<sub>pr</sub><sup>D</sup> = ${R(fmt(r.z, 5))}`]);
  } else {
    step('Evaluate Papay (explicit)', '',
      [`Z = 1 − 3.53 P<sub>pr</sub> / 10<sup>0.9813 T<sub>pr</sub></sup> + 0.274 P<sub>pr</sub><sup>2</sup> / 10<sup>0.8157 T<sub>pr</sub></sup>`,
       `Z = 1 − 3.53 × ${fmt(P, 4)} / ${fmt(10 ** (0.9813 * T), 4)} + 0.274 × ${fmt(P * P, 4)} / ${fmt(10 ** (0.8157 * T), 4)} = ${R(fmt(r.z, 5))}`]);
  }

  if (r.mode === 'gas') {
    const g = r.g;
    step('Density and formation volume factor', 'Real-gas law, with standard conditions of 14.696 psia and 60 °F.',
      [`ρ<sub>g</sub> = P M<sub>a</sub> / (Z R T) = ${fmt(S.P, 1)} × ${fmt(g.Ma, 3)} / (${fmt(r.z, 4)} × 10.7316 × ${fmt(r.Tabs, 2)}) = ${R(fmt(g.rho, 4) + ' lb/ft³')}`,
       `B<sub>g</sub> = 0.02827 Z T / P = 0.02827 × ${fmt(r.z, 4)} × ${fmt(r.Tabs, 2)} / ${fmt(S.P, 1)} = ${R(fmt(g.Bg, 6) + ' ft³/scf')}`,
       `E<sub>g</sub> = 1 / B<sub>g</sub> = ${R(fmt(g.Eg, 2) + ' scf/ft³')}`]);
    step('Isothermal gas compressibility', 'The slope of the isotherm is taken numerically from the same Z method.',
      [`(∂Z/∂P<sub>pr</sub>)<sub>T<sub>pr</sub></sub> = ${fmt(g.dZdPpr, 5)}`,
       `c<sub>pr</sub> = 1/P<sub>pr</sub> − (1/Z)(∂Z/∂P<sub>pr</sub>) = ${fmt(1 / r.Ppr, 5)} − ${fmt(g.dZdPpr / r.z, 5)} = ${R(fmt(g.cpr, 5))}`,
       `c<sub>g</sub> = c<sub>pr</sub> / P<sub>pc</sub> = ${fmt(g.cpr, 5)} / ${fmt(r.pc.pc, 2)} = ${R(fmtEtxt(g.cg, 4) + ' psi⁻¹')}`]);
    step('Gas viscosity (Lee–Gonzalez–Eakin)', 'T in °R, ρ<sub>g</sub> in g/cm³.',
      [`K = (9.4 + 0.02M<sub>a</sub>) T<sup>1.5</sup> / (209 + 19M<sub>a</sub> + T) = ${fmt(g.K, 3)}`,
       `X = 3.5 + 986/T + 0.01M<sub>a</sub> = ${fmt(g.X, 4)},  Y = 2.4 − 0.2X = ${fmt(g.Y, 4)}`,
       `μ<sub>g</sub> = 10<sup>−4</sup> K exp(X ρ<sub>g</sub><sup>Y</sup>) = 10<sup>−4</sup> × ${fmt(g.K, 3)} × exp(${fmt(g.X, 4)} × ${fmt(g.rhoGcc, 5)}<sup>${fmt(g.Y, 4)}</sup>) = ${R(fmt(g.mu, 5) + ' cp')}`]);
  }
  $('steps').innerHTML = out.join('');
}

function renderCompare(r) {
  const P = r.Ppr, T = r.Tpr;
  const zD = dak(P, T).z;
  let html = '<thead><tr><th>Method</th><th>Z</th><th>vs DAK</th><th>Quoted range</th><th>Here</th></tr></thead><tbody>';
  for (const k of ['dak', 'hy', 'bb', 'papay']) {
    const m = METHODS[k];
    const z = zBy(k, P, T).z;
    const dev = (z - zD) / zD * 100;
    const ok = m.inRange(P, T) && isFinite(z) && z > 0;
    html += `<tr${k === S.method ? ' class="here"' : ''}><td>${m.name}</td><td>${fmt(z, 4)}</td><td>${k === 'dak' ? '—' : (dev >= 0 ? '+' : '') + fmt(dev, 2) + '%'}</td><td>${m.range}</td>`
      + `<td><span class="chip ${ok ? 'ok' : 'warn'}">${ok ? 'in range' : 'outside'}</span></td></tr>`;
  }
  $('cmp').innerHTML = html + '</tbody>';
}

let csvText = '';
function renderIso(r) {
  const rows = [];
  if (r.mode === 'gas') {
    const si = S.units === 'si';
    $('isoTitle').textContent = `Isotherm table at ${fmt(U.tIn(S.T), 1)} ${U.tU()} (${METHODS[S.method].short})`;
    const pmax = Math.max(1000, S.P * 1.6);
    const step = [100, 200, 250, 500, 1000, 2000].find(s => pmax / s <= 18) || 2000;
    const ps = [];
    for (let p = step; p <= pmax + 1e-9; p += step) ps.push(p);
    ps.unshift(14.696);
    if (!ps.some(p => Math.abs(p - S.P) < 1e-6)) ps.push(S.P);
    ps.sort((a, b) => a - b);
    const head = si ? ['P (kPa)', 'Ppr', 'Z', 'Bg (m³/sm³)', 'ρg (kg/m³)', 'cg (1/kPa)', 'μg (mPa·s)']
      : ['P (psia)', 'Ppr', 'Z', 'Bg (ft³/scf)', 'ρg (lb/ft³)', 'cg (1/psi)', 'μg (cp)'];
    const body = ps.map(p => {
      const g = gasProps(p, r.Tabs, S.gamma, r.pc, S.method);
      return { here: Math.abs(p - S.P) < 1e-6, cells: [fmt(U.pIn(p), si ? 0 : 1), fmt(g.Ppr, 3), fmt(g.z, 4), fmt(g.Bg, 6),
        si ? fmt(g.rho * 16.01846, 2) : fmt(g.rho, 3), fmtEtxt(si ? g.cg / PSI_KPA : g.cg, 3), fmt(g.mu, 5)] };
    });
    rows.push(head, ...body.map(b => b.cells));
    $('iso').innerHTML = `<thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>`
      + body.map(b => `<tr${b.here ? ' class="here"' : ''}>${b.cells.map(c => `<td>${c}</td>`).join('')}</tr>`).join('') + '</tbody>';
  } else {
    $('isoTitle').textContent = `Isotherm table at Tpr ${fmt(S.Tpr, 3)} (${METHODS[S.method].short})`;
    const ps = [];
    for (let p = 0.5; p <= 15 + 1e-9; p += 0.5) ps.push(p);
    if (!ps.some(p => Math.abs(p - S.Ppr) < 1e-9)) ps.push(S.Ppr);
    ps.sort((a, b) => a - b);
    const head = ['Ppr', 'Z', 'cpr'];
    const body = ps.map(p => {
      const z = zBy(S.method, p, S.Tpr).z, h = 1e-4;
      const dz = (zBy(S.method, p + h, S.Tpr).z - zBy(S.method, p - h, S.Tpr).z) / (2 * h);
      return { here: Math.abs(p - S.Ppr) < 1e-9, cells: [fmt(p, 3), fmt(z, 4), fmt(1 / p - dz / z, 4)] };
    });
    rows.push(head, ...body.map(b => b.cells));
    $('iso').innerHTML = `<thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>`
      + body.map(b => `<tr${b.here ? ' class="here"' : ''}>${b.cells.map(c => `<td>${c}</td>`).join('')}</tr>`).join('') + '</tbody>';
  }
  csvText = rows.map(r => r.map(c => /[",]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c).join(',')).join('\n');
}

function copyCSV() {
  const done = () => { Sound.play('copy'); $('copyMsg').hidden = false; setTimeout(() => { $('copyMsg').hidden = true; }, 1600); };
  const fallback = () => { const ta = $('csvFallback'); ta.hidden = false; ta.value = csvText; ta.focus(); ta.select(); };
  try {
    navigator.clipboard.writeText(csvText).then(done, fallback);
  } catch (e) { fallback(); }
}

// ---------- boot ----------
applyTheme();
bind();
renderIsoChips();
new ResizeObserver(resize).observe(plot);
if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', drawAll);
new MutationObserver(drawAll).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawAll);
onChange(false);
resize();
