/* ============================================================
 * audio.js —— WebAudio 现场合成音效（无外部音频文件）
 * ============================================================ */
(function (root) {
  'use strict';
  var GG = (root.GG = root.GG || {});

  var ctx = null;
  var master = null;
  var noiseBuf = null;
  var muted = false;
  var ready = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    var AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.85;
    master.connect(ctx.destination);
    var len = Math.floor(ctx.sampleRate * 0.6);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = noiseBuf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    ready = true;
    return true;
  }

  function noise(dur, filterFreq, vol, type, attack, decay) {
    if (!ready || muted) return;
    var src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    var f = ctx.createBiquadFilter();
    f.type = type || 'lowpass';
    f.frequency.value = filterFreq;
    var g = ctx.createGain();
    var t = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), t + (attack || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + (decay || dur));
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  function tone(freq, dur, vol, type, slide, delay) {
    if (!ready || muted) return;
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = type || 'sine';
    var t = ctx.currentTime + (delay || 0);
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function env(fn) { if (!ready || muted) return; fn(); }

  var SFX = {
    shot_pistol: function () { noise(0.09, 900, 0.22, 'lowpass', 0.002, 0.09); tone(170, 0.08, 0.16, 'triangle', 70); },
    shot_smg: function () { noise(0.075, 1500, 0.2, 'lowpass', 0.002, 0.075); tone(210, 0.06, 0.13, 'square', 90); },
    shot_shotgun: function () { noise(0.2, 700, 0.34, 'lowpass', 0.003, 0.2); tone(120, 0.16, 0.22, 'triangle', 55); },
    shot_dmr: function () { noise(0.12, 2200, 0.3, 'bandpass', 0.002, 0.1); tone(260, 0.22, 0.18, 'sawtooth', 60); },
    dry: function () { tone(900, 0.025, 0.08, 'square', 700); },
    reload_start: function () { tone(520, 0.04, 0.08, 'square', 300); tone(380, 0.05, 0.07, 'square', 260, 0.12); },
    reload_end: function () { tone(640, 0.05, 0.1, 'square', 420); tone(880, 0.04, 0.08, 'square', 700, 0.1); },
    hit: function () { noise(0.04, 2400, 0.12, 'bandpass', 0.002, 0.04); tone(420, 0.03, 0.05, 'square', 300); },
    kill: function () { tone(150, 0.12, 0.14, 'triangle', 60); noise(0.1, 500, 0.1); },
    hurt: function () { noise(0.14, 420, 0.24, 'lowpass', 0.004, 0.14); tone(90, 0.18, 0.18, 'sawtooth', 45); },
    pickup: function () { tone(660, 0.07, 0.1, 'sine', 880); tone(980, 0.07, 0.08, 'sine', 1200, 0.08); },
    grenade_throw: function () { noise(0.08, 600, 0.06, 'lowpass'); tone(300, 0.1, 0.05, 'triangle', 500); },
    explode: function () { noise(0.5, 300, 0.42, 'lowpass', 0.006, 0.5); tone(70, 0.45, 0.3, 'triangle', 30); },
    alert: function () { tone(480, 0.1, 0.12, 'square', 620); tone(720, 0.12, 0.12, 'square', 880, 0.12); },
    win: function () { tone(523, 0.5, 0.14, 'sine'); tone(659, 0.5, 0.12, 'sine', 0, 0.14); tone(784, 0.7, 0.12, 'sine', 0, 0.28); },
    lose: function () { tone(220, 0.5, 0.16, 'sawtooth', 90); tone(110, 0.6, 0.12, 'triangle', 55, 0.2); },
    ui: function () { tone(760, 0.035, 0.07, 'square', 660); },
    dodge: function () { noise(0.12, 900, 0.09, 'bandpass', 0.004, 0.12); },
    takedown: function () { noise(0.08, 300, 0.14, 'lowpass'); tone(200, 0.08, 0.1, 'triangle', 120); },
    hack_tick: function () { tone(540, 0.03, 0.05, 'square'); },
    hack_done: function () { tone(520, 0.08, 0.1, 'sine', 700); tone(900, 0.1, 0.1, 'sine', 1100, 0.1); },
    alarm: function () { tone(700, 0.18, 0.13, 'square', 500); tone(700, 0.18, 0.13, 'square', 500, 0.3); },
    noammo: function () { tone(300, 0.05, 0.09, 'square', 200); },
    buy: function () { tone(680, 0.06, 0.09, 'sine', 900); tone(1040, 0.08, 0.07, 'sine', 1200, 0.07); }
  };

  GG.Audio = {
    init: function () {
      ensure();
      try {
        muted = !!(GG.U.load(GG.C.SAVE_KEY + '.mute', false));
      } catch (e) { muted = false; }
      if (master) master.gain.value = muted ? 0 : 0.85;
    },
    play: function (name, vol) {
      if (!ready || muted) return;
      // 距离衰减：音量过低时直接跳过，避免远处枪声糊成一片
      if (vol != null && vol < 0.12) return;
      var fn = SFX[name];
      if (fn) fn();
    },
    setMuted: function (v) {
      muted = !!v;
      if (master) master.gain.value = muted ? 0 : 0.85;
      try { localStorage.setItem(GG.C.SAVE_KEY + '.mute', JSON.stringify(muted)); } catch (e) { }
      return muted;
    },
    isMuted: function () { return muted; },
    toggle: function () { return this.setMuted(!muted); },
    toggleMute: function () { return this.setMuted(!muted); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
