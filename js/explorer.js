// ---- Property explorer: one gas property against pressure along the operating isotherm ----
// Uses the app's globals (S, U, lastResult, gasProps, zBy, fmt, css, Sound) at call time.
const Explorer = (() => {
  const PROPS = {
    z: { tab: 'Z', label: 'Z', gas: true, direct: true,
      note: 'Z along the operating isotherm. Below Z = 1 attraction between molecules dominates; at high pressure the molecules\' own volume does and Z climbs above 1.' },
    pz: { tab: 'p/Z', label: 'p/Z', gas: true,
      note: 'For a volumetric (no water drive) gas reservoir, p/Z falls in a straight line against cumulative gas produced. This is the curve the p/Z material-balance plot is read from. Dashed: the ideal-gas line p/Z = p.' },
    bg: { tab: 'Bg', label: 'Bg', gas: true,
      note: 'Bg = 0.02827 ZT/p: reservoir volume taken up by one standard cubic foot of gas. It climbs steeply as the pressure falls.' },
    rho: { tab: 'ρg', label: 'ρg', gas: true,
      note: 'Gas density from the real-gas law, ρ = pMa/(ZRT). Dashed: the ideal-gas density (Z = 1).' },
    cg: { tab: 'cg', label: 'cg', gas: true,
      note: 'Isothermal compressibility. For an ideal gas cg = 1/p (dashed); the gap is the Z correction, which matters most near the bottom of the Z dip.' },
    mu: { tab: 'μg', label: 'μg', gas: true,
      note: 'Lee–Gonzalez–Eakin viscosity. It rises with density, so it follows the pressure up. Not meant for sour gas.' },
    cpr: { tab: 'cpr', label: 'cpr', direct: true,
      note: 'Pseudo-reduced compressibility cpr = 1/Ppr − (1/Z)(∂Z/∂Ppr). Dashed: the ideal-gas value 1/Ppr. Multiply by 1/Ppc to get cg.' },
  };
  const cv = document.getElementById('cv2'), ctx = cv.getContext('2d'), box = document.getElementById('plot2'), tip = document.getElementById('tip2');
  let W = 0, H = 0, series = null, hoverI = -1, key = '';
  const M = { l: 70, r: 18, t: 14, b: 44 };

  function propsFor() { return Object.entries(PROPS).filter(([, p]) => S.mode === 'gas' ? p.gas : p.direct).map(([k]) => k); }
  function current() { const ks = propsFor(); return ks.includes(S.prop) ? S.prop : 'z'; }

  function units(k) {
    const si = S.units === 'si';
    switch (k) {
      case 'pz': return U.pU();
      case 'bg': return si ? 'm³/sm³' : 'ft³/scf';
      case 'rho': return si ? 'kg/m³' : 'lb/ft³';
      case 'cg': return si ? '1/kPa' : '1/psi';
      case 'mu': return si ? 'mPa·s' : 'cp';
      default: return '';
    }
  }
  function conv(k, v) {
    const si = S.units === 'si';
    if (!si) return v;
    if (k === 'pz') return v * 6.894757;
    if (k === 'rho') return v * 16.01846;
    if (k === 'cg') return v / 6.894757;
    return v;
  }

  function renderTabs() {
    const tabs = document.getElementById('propTabs');
    const cur = current();
    tabs.innerHTML = '';
    for (const k of propsFor()) {
      const b = document.createElement('button');
      b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', k === cur);
      b.textContent = PROPS[k].tab;
      b.onclick = () => { Sound.play('page'); S.prop = k; save(); renderTabs(); build(lastResult, true); draw(); };
      tabs.appendChild(b);
    }
    document.getElementById('propNote').textContent = PROPS[cur].note;
  }

  // Sample the property along the isotherm. x is pressure (gas mode) or Ppr (direct mode).
  function build(r, force) {
    const k = current();
    const gas = r.mode === 'gas';
    // during depletion playback keep the starting axis so the curve doesn't rescale under the moving point
    const ref = anim && animSaved ? animSaved : { P: S.P, Ppr: r.Ppr };
    const xMax = gas ? Math.max(1500, Math.ceil(ref.P * 1.5 / 500) * 500) : Math.max(15, Math.ceil(ref.Ppr * 1.3));
    const newKey = [k, r.mode, S.method, S.units, gas ? [S.gamma, S.corr, S.CO2, S.H2S, S.N2, S.T, xMax].join(',') : [S.Tpr, xMax].join(',')].join('|');
    if (!force && newKey === key && series) return;
    key = newKey;
    const n = 140, pts = [];
    const x0 = gas ? 14.696 : 0.05;
    for (let i = 0; i <= n; i++) {
      const x = x0 + (xMax - x0) * (i / n) ** 1.15;
      let y, ideal = null;
      if (gas) {
        const g = gasProps(x, r.Tabs, S.gamma, r.pc, S.method);
        switch (k) {
          case 'z': y = g.z; ideal = 1; break;
          case 'pz': y = x / g.z; ideal = x; break;
          case 'bg': y = g.Bg; break;
          case 'rho': y = g.rho; ideal = g.rho * g.z; break;
          case 'cg': y = g.cg; ideal = 1 / x; break;
          case 'mu': y = g.mu; break;
        }
        pts.push({ x, xd: U.pIn(x), y: conv(k, y), ideal: ideal === null ? null : conv(k, ideal) });
      } else {
        const z = zBy(S.method, x, S.Tpr).z;
        if (k === 'z') { y = z; ideal = 1; }
        else { const h = 1e-4; const dz = (zBy(S.method, x + h, S.Tpr).z - zBy(S.method, Math.max(1e-6, x - h), S.Tpr).z) / (x + h - Math.max(1e-6, x - h)); y = 1 / x - dz / z; ideal = 1 / x; }
        pts.push({ x, xd: x, y, ideal });
      }
    }
    const ys = pts.map(p => p.y).filter(isFinite);
    let y0 = Math.min(...ys), y1 = Math.max(...ys);
    if (k === 'z') { y0 = Math.min(y0, 0.95); y1 = Math.max(y1, 1.02); }
    if (k === 'cg' || k === 'cpr') { y1 = Math.min(y1, pts[Math.floor(n * 0.08)].y * 1.2); y0 = Math.min(0, y0); }
    if (k === 'bg') { y1 = Math.min(y1, pts[Math.floor(n * 0.06)].y * 1.3); y0 = 0; }
    if (k === 'rho' || k === 'pz' || k === 'mu') y0 = 0;
    const pad = (y1 - y0) * 0.06 || 0.1;
    series = { k, gas, pts, x0: 0, x1: gas ? U.pIn(xMax) : xMax, y0: Math.max(k === 'z' ? 0 : -Infinity, y0 - (y0 === 0 ? 0 : pad)), y1: y1 + pad };
  }

  function X(x) { return M.l + (x - series.x0) / (series.x1 - series.x0) * (W - M.l - M.r); }
  function Y(y) { return M.t + (series.y1 - y) / (series.y1 - series.y0) * (H - M.t - M.b); }

  function resize() {
    const r = box.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    W = r.width; H = r.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function fmtAxis(v, step) {
    if (step < 1e-3) return v.toExponential(1);
    return v.toFixed(decimalsFor(step));
  }

  function draw() {
    if (!W || !series || !lastResult) return;
    const C = colors(), r = lastResult;
    ctx.clearRect(0, 0, W, H);
    const pw = W - M.l - M.r, ph = H - M.t - M.b;
    const xs = niceStep(series.x1 - series.x0, W < 480 ? 4 : 8), ys = niceStep(series.y1 - series.y0, 6);
    ctx.save(); ctx.beginPath(); ctx.rect(M.l, M.t, pw, ph); ctx.clip();
    ctx.lineWidth = 1;
    ctx.strokeStyle = C.minor; ctx.beginPath();
    for (let i = Math.ceil(series.x0 / (xs / 5)); i * xs / 5 <= series.x1; i++) { const x = Math.round(X(i * xs / 5)) + 0.5; ctx.moveTo(x, M.t); ctx.lineTo(x, H - M.b); }
    for (let i = Math.ceil(series.y0 / (ys / 5)); i * ys / 5 <= series.y1; i++) { const y = Math.round(Y(i * ys / 5)) + 0.5; ctx.moveTo(M.l, y); ctx.lineTo(W - M.r, y); }
    ctx.stroke();
    ctx.strokeStyle = C.major; ctx.beginPath();
    for (let i = Math.ceil(series.x0 / xs); i * xs <= series.x1; i++) { const x = Math.round(X(i * xs)) + 0.5; ctx.moveTo(x, M.t); ctx.lineTo(x, H - M.b); }
    for (let i = Math.ceil(series.y0 / ys); i * ys <= series.y1; i++) { const y = Math.round(Y(i * ys)) + 0.5; ctx.moveTo(M.l, y); ctx.lineTo(W - M.r, y); }
    ctx.stroke();

    const line = (get, color, width, dash) => {
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash || []);
      ctx.beginPath(); let pen = false;
      for (const p of series.pts) {
        const v = get(p);
        if (v === null || !isFinite(v)) { pen = false; continue; }
        const x = X(p.xd), y = Y(v);
        if (!pen) { ctx.moveTo(x, y); pen = true; } else ctx.lineTo(x, y);
      }
      ctx.stroke(); ctx.setLineDash([]);
    };
    if (series.pts[0].ideal !== null) line(p => p.ideal, C.muted, 1.2, [5, 4]);
    line(p => p.y, C.accent, 2.4);

    // operating point
    const opX = series.gas ? U.pIn(S.P) : r.Ppr;
    const opY = valueAt(r);
    if (isFinite(opY)) {
      const x = X(opX), y = Y(opY);
      ctx.strokeStyle = C.accent; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, H - M.b); ctx.moveTo(x, y); ctx.lineTo(M.l, y); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = C.sheet; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 2.4; ctx.strokeStyle = C.accent; ctx.stroke();
    }
    if (hoverI >= 0) {
      const p = series.pts[hoverI];
      ctx.strokeStyle = C.ink; ctx.lineWidth = 0.8; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(X(p.xd), M.t); ctx.lineTo(X(p.xd), H - M.b); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(X(p.xd), Y(p.y), 3.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    ctx.strokeStyle = C.rule; ctx.lineWidth = 1.4; ctx.strokeRect(M.l + 0.5, M.t + 0.5, pw - 1, ph - 1);
    ctx.fillStyle = C.ink; ctx.font = '12px ' + FONT_DATA; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (let i = Math.ceil(series.x0 / xs); i * xs <= series.x1 + 1e-9; i++) ctx.fillText(fmtAxis(i * xs, xs), X(i * xs), H - M.b + 6);
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (let i = Math.ceil(series.y0 / ys - 1e-9); i * ys <= series.y1 + 1e-9; i++) ctx.fillText(fmtAxis(i * ys, ys), M.l - 6, Y(i * ys));
    ctx.font = '700 13px ' + FONT_COND; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(series.gas ? `Pressure, ${U.pU()}   (T = ${fmt(U.tIn(S.T), 1)} ${U.tU()})` : `Pseudo-reduced pressure, Ppr   (Tpr = ${fmt(S.Tpr, 3)})`, M.l + pw / 2, H - 8);
    const u = units(series.k);
    ctx.save(); ctx.translate(14, M.t + ph / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText(PROPS[series.k].label + (u ? ', ' + u : ''), 0, 0); ctx.restore();
  }

  function valueAt(r) {
    const k = series.k;
    if (!series.gas) return k === 'z' ? r.z : r.cpr;
    const g = r.g;
    switch (k) {
      case 'z': return g.z;
      case 'pz': return conv(k, S.P / g.z);
      case 'bg': return g.Bg;
      case 'rho': return conv(k, g.rho);
      case 'cg': return conv(k, g.cg);
      case 'mu': return g.mu;
    }
    return NaN;
  }

  function fmtVal(v) {
    if (!isFinite(v)) return '—';
    const a = Math.abs(v);
    return a !== 0 && (a < 1e-3 || a >= 1e5) ? v.toExponential(3) : v.toFixed(a < 0.1 ? 5 : a < 10 ? 4 : 1);
  }

  cv.addEventListener('pointermove', ev => {
    if (!series) return;
    const rect = cv.getBoundingClientRect(), x = ev.clientX - rect.left, y = ev.clientY - rect.top;
    if (x < M.l || x > W - M.r || y < M.t || y > H - M.b) { hoverI = -1; tip.hidden = true; draw(); return; }
    const xd = series.x0 + (x - M.l) / (W - M.l - M.r) * (series.x1 - series.x0);
    let best = 0;
    series.pts.forEach((p, i) => { if (Math.abs(p.xd - xd) < Math.abs(series.pts[best].xd - xd)) best = i; });
    hoverI = best;
    const p = series.pts[best], u = units(series.k);
    tip.innerHTML = `<span class="t">${series.gas ? 'P' : 'Ppr'}</span> <b>${series.gas ? fmt(p.xd, 1) + ' ' + U.pU() : fmt(p.xd, 3)}</b><br>`
      + `<span class="t">${PROPS[series.k].label}</span> <b>${fmtVal(p.y)}</b>${u ? ' ' + u : ''}<br><span class="t">click to move the operating point here</span>`;
    tip.hidden = false;
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let tx = x + 14, ty = y - th - 12;
    if (tx + tw > W - 4) tx = x - tw - 14;
    if (ty < 4) ty = y + 16;
    tip.style.left = Math.max(4, tx) + 'px'; tip.style.top = Math.max(4, ty) + 'px';
    draw();
  });
  cv.addEventListener('pointerleave', () => { hoverI = -1; tip.hidden = true; draw(); });
  cv.addEventListener('click', () => {
    if (hoverI < 0 || !series) return;
    const p = series.pts[hoverI];
    Sound.play('pin');
    if (series.gas) S.P = +p.x.toFixed(1); else S.Ppr = +p.x.toFixed(3);
    onChange(true);
  });

  new ResizeObserver(resize).observe(box);

  return {
    render(r) { renderTabs(); build(r, false); if (!W) resize(); else draw(); },
    draw,
  };
})();
