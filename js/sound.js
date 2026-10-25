// ---- Sound effects ----
// Short tones made with the Web Audio API: no audio files are downloaded. The audio context is
// only created after the first click or key press (browsers block sound before that).
const Sound = (() => {
  let ctx = null, master = null, enabled = true, lastTick = 0;

  function ready() {
    if (!enabled) return null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { enabled = false; return null; }
      try { ctx = new AC(); } catch (e) { enabled = false; return null; }
      master = ctx.createGain();
      master.gain.value = 0.22;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // one enveloped oscillator note; f1 = optional end frequency for a glide
  function tone(f0, dur, { type = 'sine', gain = 0.5, f1 = null, delay = 0, attack = 0.004 } = {}) {
    const c = ready();
    if (!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  // filtered noise burst (paper rustle / valve hiss)
  function noise(dur, { freq = 2000, q = 0.8, gain = 0.25, delay = 0 } = {}) {
    const c = ready();
    if (!c) return;
    const t = c.currentTime + delay;
    const n = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    g.gain.value = gain;
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t);
  }

  const fx = {
    click: () => tone(1250, 0.03, { type: 'triangle', gain: 0.18 }),
    toggle: on => on ? tone(700, 0.07, { f1: 1050, gain: 0.25 }) : tone(1050, 0.07, { f1: 700, gain: 0.25 }),
    tick: () => { // isotherm crossing; rate-limited so fast drags don't buzz
      const c = ready(); if (!c) return;
      if (c.currentTime - lastTick < 0.035) return;
      lastTick = c.currentTime;
      tone(2300, 0.018, { type: 'square', gain: 0.05 });
    },
    pin: () => { tone(520, 0.09, { f1: 900, gain: 0.35 }); tone(1300, 0.05, { gain: 0.08, delay: 0.05 }); },
    unpin: () => tone(800, 0.09, { f1: 380, gain: 0.25 }),
    grab: () => tone(330, 0.05, { type: 'triangle', gain: 0.25 }),
    drop: () => tone(440, 0.06, { type: 'triangle', gain: 0.2, f1: 300 }),
    zoom: inward => tone(inward ? 380 : 620, 0.09, { f1: inward ? 620 : 380, gain: 0.16 }),
    page: () => noise(0.09, { freq: 3200, gain: 0.12 }),
    theme: dark => dark ? tone(660, 0.18, { f1: 330, gain: 0.2 }) : tone(330, 0.18, { f1: 660, gain: 0.2 }),
    correct: () => { tone(784, 0.12, { gain: 0.3 }); tone(1175, 0.2, { gain: 0.3, delay: 0.1 }); },
    wrong: () => { tone(196, 0.2, { type: 'sawtooth', gain: 0.12 }); tone(185, 0.22, { type: 'sawtooth', gain: 0.1, delay: 0.02 }); },
    start: () => { tone(392, 0.08, { gain: 0.25 }); tone(523, 0.08, { gain: 0.25, delay: 0.08 }); noise(0.5, { freq: 900, gain: 0.07, delay: 0.05 }); },
    step: () => tone(1600, 0.02, { type: 'triangle', gain: 0.07 }),
    end: () => { tone(523, 0.1, { gain: 0.25 }); tone(392, 0.25, { gain: 0.22, delay: 0.09 }); },
    copy: () => { tone(880, 0.05, { gain: 0.2 }); tone(1320, 0.07, { gain: 0.2, delay: 0.05 }); },
  };

  return {
    play(name, ...args) { if (enabled && fx[name]) { try { fx[name](...args); } catch (e) { /* audio is optional */ } } },
    setEnabled(v) { enabled = !!v; if (!enabled && ctx && ctx.state === 'running') ctx.suspend(); },
    get enabled() { return enabled; },
  };
})();
