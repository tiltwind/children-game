/* ============================================================
 * plane.js —— 穿云战机 · SKYBORNE
 * 侧向飞行躲避：能量闸门 / 擦身连击 / 护盾 / 时缓 / 冲刺
 * ============================================================ */
(function () {
  'use strict';

  /* ---------------- 基础常量与工具 ---------------- */
  var W = 1280;
  var H = 720;
  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d', { alpha: false });
  var DPR = Math.min(2, window.devicePixelRatio || 1);

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function randInt(a, b) { return Math.floor(rand(a, b + 1)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function mod(n, m) { return ((n % m) + m) % m; }
  function $(id) { return document.getElementById(id); }
  function pad(n, len) {
    var s = String(Math.max(0, Math.floor(n)));
    while (s.length < len) s = '0' + s;
    return s;
  }
  function rgba(hex, a) {
    var h = String(hex).replace('#', '');
    if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
    var n = parseInt(h, 16);
    if (isNaN(n)) return 'rgba(255,255,255,' + a + ')';
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function rectHit(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }
  function roundRectPath(x, y, w, h, r) {
    var rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
  }

  /* ---------------- 航段配色 ---------------- */
  var ZONES = [
    { label: 'SECTOR 01 · 琥珀星云', accent: '#5fd8ff', warm: '#ffb066', planet: '#9a6a3f',
      deep: '#171009', nebA: '#6b3d1f', nebB: '#2a1a2e' },
    { label: 'SECTOR 02 · 熔金磁场', accent: '#ff9a3c', warm: '#ffd9a0', planet: '#c9873c',
      deep: '#1a0f08', nebA: '#8a4412', nebB: '#3a1410' },
    { label: 'SECTOR 03 · 紫电风暴', accent: '#b479ff', warm: '#ffa6d2', planet: '#6d5590',
      deep: '#140b18', nebA: '#3f2156', nebB: '#1a1430' },
    { label: 'SECTOR 04 · 极光深井', accent: '#3ef0c0', warm: '#a8fff0', planet: '#317f6b',
      deep: '#08130f', nebA: '#0f4438', nebB: '#0a2a3a' },
    { label: 'SECTOR 05 · 无尽航线', accent: '#ff6b74', warm: '#ffc9a8', planet: '#9a3a3a',
      deep: '#160808', nebA: '#5a1a1c', nebB: '#2a0e18' }
  ];

  /* ---------------- 界面元素 ---------------- */
  var hudScore = $('hudScore');
  var hudEl = $('hud');
  var hudBest = $('hudBest');
  var hudDist = $('hudDist');
  var hudSector = $('hudSector');
  var hudCombo = $('hudCombo');
  var hudMult = $('hudMult');
  var hudComboNum = $('hudComboNum');
  var heartsEl = $('hearts');
  var energyFill = $('energyFill');
  var dashLabel = $('dashLabel');
  var menuOv = $('menuOv');
  var pauseOv = $('pauseOv');
  var overOv = $('overOv');
  var zoneBanner = $('zoneBanner');
  var menuBest = $('menuBest');
  var overScore = $('overScore');
  var overDist = $('overDist');
  var overCombo = $('overCombo');
  var overBest = $('overBest');
  var overRecord = $('overRecord');
  var overTitle = $('overTitle');
  var overKicker = $('overKicker');
  var overFocus = $('overFocus');
  var soundBtn = $('soundBtn');
  var pauseBtn = $('pauseBtn');
  var startBtn = $('startBtn');
  var retryBtn = $('retryBtn');
  var resumeBtn = $('resumeBtn');
  var dashBtn = $('dashBtn');

  var BEST_KEY = 'shutu.plane.best.v1';
  var MUTE_KEY = 'shutu.plane.mute.v1';

  var heartEls = [];

  /* ---------------- 存档 ---------------- */
  function loadNumber(key, fallback) {
    try {
      var v = Number(localStorage.getItem(key));
      return isFinite(v) && v > 0 ? v : fallback;
    } catch (e) {
      return fallback;
    }
  }
    function saveNumber(key, value) {
    try { localStorage.setItem(key, String(value)); } catch (e) { /* 隐私模式忽略 */ }
  }

  /* ---------------- 音效（WebAudio 合成，无外部资源） ---------------- */
  var SFX = {
    ctx: null,
    muted: false,
    init: function () {
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        if (!this.ctx) this.ctx = new AC();
        if (this.ctx.state === 'suspended') this.ctx.resume();
      } catch (e) { /* 不支持音频时静默 */ }
    },
    tone: function (freq, dur, type, gain, slideTo) {
      if (this.muted) return;
      this.init();
      var c = this.ctx;
      if (!c) return;
      try {
        var o = c.createOscillator();
        var g = c.createGain();
        o.type = type || 'sine';
        o.frequency.value = freq;
        var now = c.currentTime;
        if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), now + dur);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(gain || 0.1, now + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
        o.connect(g).connect(c.destination);
        o.start(now);
        o.stop(now + dur + 0.03);
      } catch (e) { /* 音频节点异常忽略 */ }
    },
    noise: function (dur, gain, cutoff) {
      if (this.muted) return;
      this.init();
      var c = this.ctx;
      if (!c) return;
      try {
        var len = Math.max(1, Math.floor(c.sampleRate * dur));
        var buf = c.createBuffer(1, len, c.sampleRate);
        var data = buf.getChannelData(0);
        for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
        var src = c.createBufferSource();
        src.buffer = buf;
        var f = c.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = cutoff || 900;
        var g = c.createGain();
        g.gain.value = gain || 0.18;
        g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
        src.connect(f).connect(g).connect(c.destination);
        src.start();
      } catch (e) { /* ignore */ }
    },
    pickup: function (pitch) {
      var p = pitch || 880;
      this.tone(p, 0.09, 'triangle', 0.09);
      var self = this;
      setTimeout(function () { self.tone(p * 1.5, 0.1, 'triangle', 0.07); }, 55);
    },
    tick: function (combo) {
      var f = 520 + Math.min(360, (combo || 0) * 26);
      this.tone(f, 0.06, 'square', 0.05);
    },
    dash: function () {
      this.noise(0.3, 0.22, 1600);
      this.tone(220, 0.24, 'sawtooth', 0.09, 90);
    },
    hit: function () {
      this.noise(0.45, 0.32, 700);
      this.tone(120, 0.35, 'sawtooth', 0.12, 55);
    },
    shield: function () {
      this.tone(660, 0.18, 'sine', 0.1, 990);
    },
    slowmo: function () {
      this.tone(300, 0.5, 'sine', 0.08, 900);
    },
    zone: function () {
      this.tone(440, 0.3, 'triangle', 0.08, 660);
      this.tone(880, 0.4, 'sine', 0.05, 1320);
    },
    gameover: function () {
      this.noise(0.8, 0.35, 520);
      this.tone(180, 0.9, 'sawtooth', 0.16, 40);
    }
  };
  SFX.muted = loadNumber(MUTE_KEY, 0) === 1;

  /* ---------------- 游戏状态 ---------------- */
  var G = {
    mode: 'menu',            // menu / playing / over
    clock: 0,
    bgScroll: 0,
    menuT: 0,
    time: 0,
    dist: 0,
    speed: 300,
    score: 0,
    best: loadNumber(BEST_KEY, 0),
    lives: 3,
    energy: 100,
    combo: 0,
    mult: 1,
    comboTimer: 0,
    maxCombo: 0,
    shield: 0,
    slow: 0,
    inv: 0,
    dashT: 0,
    dashCd: 0,
    zone: 0,
    pal: ZONES[0],
    lastGap: null,
    gateIn: 1200,
    rockIn: 2200,
    droneIn: 99999,
    powerIn: 3400,
    shake: 0,
    flash: 0,
    hitFlash: 0,
    manualPaused: false,
    gatePaused: false,
    breakPaused: false,
    bgGrad: null,
    vignette: null,
    endingAt: 0
  };

  var player = { x: 250, y: H / 2, vy: 0, angle: 0, trailT: 0, exT: 0 };
  var targetY = H / 2;
  var keys = { up: false, down: false };
  var gates = [];
  var asteroids = [];
  var drones = [];
  var orbs = [];
  var powers = [];
  var particles = [];
  var floats = [];
  var trail = [];
  var stars = [];
  var nebulas = [
    { x: 0.12, y: 0.24, r: 0.6, p: 0.035, ph: 0 },
    { x: 0.55, y: 0.78, r: 0.52, p: 0.06, ph: 1.7 },
    { x: 0.95, y: 0.32, r: 0.45, p: 0.09, ph: 3.1 }
  ];
  var rafId = null;
  var last = 0;
  var gate = null;

  /* ---------------- 画布尺寸 ---------------- */
  function setupCanvas() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.imageSmoothingEnabled = true;
    buildBackdrop();
  }

  /* ---------------- 背景 ---------------- */
  function initStars() {
    stars = [];
    for (var i = 0; i < 230; i++) {
      stars.push({
        x: rand(0, W),
        y: rand(0, H),
        s: rand(0.6, 2.3),
        p: rand(0.08, 0.62),
        tw: rand(0.6, 2.2),
        ph: rand(0, Math.PI * 2)
      });
    }
  }

  function buildBackdrop() {
    var pal = G.pal;
    G.bgGrad = ctx.createLinearGradient(0, 0, W * 0.25, H);
    G.bgGrad.addColorStop(0, '#0b0706');
    G.bgGrad.addColorStop(0.45, pal.deep);
    G.bgGrad.addColorStop(1, '#060403');

    G.vignette = ctx.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, H * 0.92);
    G.vignette.addColorStop(0, 'rgba(0,0,0,0)');
    G.vignette.addColorStop(0.7, 'rgba(0,0,0,0.18)');
    G.vignette.addColorStop(1, 'rgba(0,0,0,0.62)');
  }

  function drawBackground() {
    var pal = G.pal;
    ctx.fillStyle = G.bgGrad;
    ctx.fillRect(0, 0, W, H);

    // 星云团（缓慢视差）
    for (var i = 0; i < nebulas.length; i++) {
      var n = nebulas[i];
      var r = n.r * W;
      var nx = mod(n.x * W - G.bgScroll * n.p, W + r * 2) - r;
      var ny = n.y * H + Math.sin(G.clock * 0.12 + n.ph) * 26;
      var color = i % 2 === 0 ? pal.nebA : pal.nebB;
      var g = ctx.createRadialGradient(nx, ny, 8, nx, ny, r);
      g.addColorStop(0, rgba(color, 0.62));
      g.addColorStop(0.45, rgba(color, 0.26));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(nx, ny, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 星点
    for (var s = 0; s < stars.length; s++) {
      var st = stars[s];
      var sx = mod(st.x - G.bgScroll * st.p, W + 8) - 4;
      var alpha = 0.22 + 0.65 * Math.abs(Math.sin(G.clock * st.tw + st.ph));
      ctx.fillStyle = rgba('#ffe9c9', alpha);
      ctx.fillRect(sx, st.y, st.s, st.s);
    }

    // 快速掠过的小尘埃（速度感）
    for (var d = 0; d < 30; d++) {
      var dx = mod(d * 173 - G.bgScroll * 0.62, W + 160) - 80;
      var dy = (d * 97 % H) + Math.sin(d * 2.1 + G.clock * 0.5) * 10;
      var len = 18 + (d % 6) * 12;
      ctx.fillStyle = rgba(pal.warm, 0.05 + (d % 3) * 0.022);
      ctx.fillRect(dx, dy, len, 1);
    }

    // 底部地平线余晖
    var hg = ctx.createLinearGradient(0, H - 210, 0, H);
    hg.addColorStop(0, 'rgba(0,0,0,0)');
    hg.addColorStop(1, rgba(pal.nebA, 0.22));
    ctx.fillStyle = hg;
    ctx.fillRect(0, H - 210, W, 210);
  }

  function drawPlanet() {
    var pal = G.pal;
    var x = W * 0.85 + Math.sin(G.clock * 0.06) * 16;
    var y = H * 0.23 + Math.cos(G.clock * 0.05) * 8;
    var r = 122;

    ctx.save();
    ctx.translate(x, y);

    // 行星外光
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var halo = ctx.createRadialGradient(0, 0, r * 0.6, 0, 0, r * 2.6);
    halo.addColorStop(0, rgba(pal.warm, 0.12));
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, r * 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 行星环
    ctx.save();
    ctx.rotate(-0.34);
    ctx.strokeStyle = rgba(pal.planet, 0.3);
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.95, r * 0.4, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = rgba(pal.warm, 0.16);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.62, r * 0.33, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // 行星球体
    var g = ctx.createRadialGradient(-r * 0.38, -r * 0.4, 8, 0, 0, r);
    g.addColorStop(0, rgba(pal.planet, 0.9));
    g.addColorStop(0.55, rgba(pal.planet, 0.45));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    // 大气边缘
    ctx.strokeStyle = rgba(pal.warm, 0.22);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.98, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  /* ---------------- 玩家操控 ---------------- */
  function updatePlayer(dt) {
    if (keys.up) targetY -= 470 * dt;
    if (keys.down) targetY += 470 * dt;
    targetY = clamp(targetY, 46, H - 48);

    var desired = clamp((targetY - player.y) * 8, -560, 560);
    player.vy = lerp(player.vy, desired, 1 - Math.exp(-dt * 10));
    player.y += player.vy * dt;

    if (player.y < 46) { player.y = 46; player.vy = Math.max(0, player.vy * -0.3); }
    if (player.y > H - 48) { player.y = H - 48; player.vy = Math.min(0, player.vy * -0.3); }

    player.angle = -clamp(player.vy / 560, -1, 1) * 0.36 + (G.dashT > 0 ? 0.05 : 0);

    // 尾迹采样
    player.trailT -= dt;
    if (player.trailT <= 0) {
      player.trailT = 0.016;
      trail.push({ x: player.x - 52, y: player.y + rand(-3, 3), life: 0.55 });
      if (trail.length > 80) trail.shift();
    }

    // 引擎余烬
    player.exT -= dt;
    if (player.exT <= 0) {
      player.exT = 0.04;
      particles.push({
        type: 'spark',
        x: player.x - 62 + rand(-5, 5),
        y: player.y + rand(-9, 9),
        vx: -rand(140, 280),
        vy: rand(-34, 34),
        life: rand(0.12, 0.3),
        max: 0.3,
        size: rand(1, 2.2),
        color: '#ffb066'
      });
    }
  }

  /* ---------------- 关卡生成 ---------------- */
  function spawnGate() {
    var gapH = clamp(300 - G.dist * 0.045 - G.zone * 6, 166, 300);
    var minY = gapH / 2 + 88;
    var maxY = H - gapH / 2 - 88;

    var base = G.lastGap == null
      ? rand(minY, maxY)
      : clamp(G.lastGap + rand(-210, 210), minY, maxY);
    G.lastGap = base;

    var osc = G.zone >= 2 && Math.random() < 0.32;
    var g = {
      x: W + 120,
      w: 84,
      gapY: base,
      baseY: base,
      gapH: gapH,
      osc: osc,
      amp: osc ? clamp(gapH * 0.24, 30, 62) : 0,
      phase: rand(0, Math.PI * 2),
      speedOsc: rand(1.7, 2.5),
      color: Math.random() < 0.24 ? G.pal.warm : G.pal.accent,
      seed: rand(0, 10),
      near: false
    };
    gates.push(g);

    // 闸门里的能量球：贴着缺口中心，奖励“从中间穿过去”
    if (Math.random() < 0.62) {
      var count = randInt(2, 4);
      for (var i = 0; i < count; i++) {
        orbs.push({
          x: g.x + 150 + i * 46,
          y: base + rand(-22, 22),
          seed: rand(0, 10)
        });
      }
    }

    // 闸门后面偶尔放一个道具
    if (Math.random() < 0.26) {
      spawnPower(g.x + rand(320, 460), base + rand(-70, 70), null);
    }
  }

  function spawnAsteroid(x, y, r, vy) {
    var pts = [];
    var count = randInt(8, 11);
    for (var i = 0; i < count; i++) {
      pts.push({
        a: (i / count) * Math.PI * 2 + rand(-0.14, 0.14),
        r: rand(0.8, 1.08)
      });
    }
    asteroids.push({
      x: x,
      y: y,
      r: r,
      vy: vy == null ? rand(-60, 60) : vy,
      rot: rand(0, Math.PI * 2),
      spin: rand(-1.2, 1.2),
      points: pts,
      seed: rand(0, 9),
      dead: false
    });
  }

  function spawnDrone() {
    drones.push({
      x: W + 70,
      y: rand(120, H - 120),
      seed: rand(0, 9),
      dead: false
    });
  }

  function spawnPower(x, y, type) {
    var t = type || (Math.random() < 0.55 ? 'shield' : 'slow');
    powers.push({
      x: x,
      y: clamp(y, 100, H - 100),
      type: t,
      seed: rand(0, 10),
      dead: false
    });
  }

  /* ---------------- 生成节奏 ---------------- */
  function spawnLogic(adv) {
    G.gateIn -= adv;
    if (G.gateIn <= 0) {
      spawnGate();
      G.gateIn = Math.max(440, rand(600, 880) - Math.min(150, G.zone * 34));
    }

    G.rockIn -= adv;
    if (G.rockIn <= 0) {
      if (G.zone >= 1) {
        spawnAsteroid(W + 90, rand(90, H - 90), rand(24, 46), rand(-80, 80));
      }
      G.rockIn = rand(720, 1280);
    }

    G.droneIn -= adv;
    if (G.zone >= 2 && G.droneIn <= 0) {
      if (drones.length < 2) {
        spawnDrone();
        G.droneIn = rand(1500, 2400);
      } else {
        G.droneIn = 400;
      }
    }

    G.powerIn -= adv;
    if (G.powerIn <= 0) {
      if (powers.length < 1) spawnPower(W + 90, rand(110, H - 110), null);
      G.powerIn = rand(2800, 4400);
    }
  }

  /* ---------------- 世界更新 ---------------- */
  function updateWorld(adv, wdt) {
    var i;

    // 闸门
    for (i = gates.length - 1; i >= 0; i--) {
      var g = gates[i];
      g.x -= adv;
      if (g.osc) {
        g.phase += g.speedOsc * wdt;
        g.gapY = g.baseY + Math.sin(g.phase) * g.amp;
      }
      if (g.x + g.w < -60) gates.splice(i, 1);
    }

    // 陨石
    for (i = asteroids.length - 1; i >= 0; i--) {
      var a = asteroids[i];
      a.x -= adv * 1.04;
      a.y += a.vy * wdt;
      a.rot += a.spin * wdt;
      if (a.y < 40 || a.y > H - 40) a.vy *= -0.8;
      if (a.x < -90 || a.dead) asteroids.splice(i, 1);
    }

    // 无人机
    for (i = drones.length - 1; i >= 0; i--) {
      var d = drones[i];
      d.x -= adv * 1.2;
      var dy = clamp((player.y - d.y) / 160, -1, 1);
      d.y += dy * 150 * wdt + Math.sin(G.clock * 2 + d.seed) * 26 * wdt;
      d.y = clamp(d.y, 54, H - 54);
      if (d.x < -70 || d.dead) drones.splice(i, 1);
    }

    // 能量球
    for (i = orbs.length - 1; i >= 0; i--) {
      var o = orbs[i];
      o.x -= adv;
      if (o.x < -40) orbs.splice(i, 1);
    }

    // 道具
    for (i = powers.length - 1; i >= 0; i--) {
      var p = powers[i];
      p.x -= adv * 0.92;
      if (p.x < -50 || p.dead) powers.splice(i, 1);
    }
  }

  /* ---------------- 计时器 ---------------- */
  function timers(dt) {
    if (G.inv > 0) G.inv -= dt;
    if (G.dashCd > 0) G.dashCd -= dt;
    if (G.dashT > 0) G.dashT -= dt;

    if (G.shield > 0) {
      G.shield -= dt;
      if (G.shield <= 0) {
        G.shield = 0;
        addFloat(player.x, player.y - 46, '护盾结束', '#8fdcff', 16);
      }
    }

    if (G.slow > 0) {
      G.slow -= dt;
      if (G.slow <= 0) {
        G.slow = 0;
        canvas.classList.remove('is-slow');
      }
    }

    if (G.comboTimer > 0) {
      G.comboTimer -= dt;
      if (G.comboTimer <= 0 && G.combo > 0) {
        G.combo = 0;
        G.mult = 1;
      }
    }

    G.energy = clamp(G.energy + 9 * dt, 0, 100);
  }

  /* ---------------- 碰撞 ---------------- */
  function playerRect() {
    return { x: player.x - 42, y: player.y - 19, w: 84, h: 38 };
  }

  function collisions() {
    var i;
    var pr = playerRect();

    // 闸门
    for (i = 0; i < gates.length; i++) {
      var g = gates[i];
      var top = g.gapY - g.gapH / 2;
      var bot = g.gapY + g.gapH / 2;
      var overlapX = g.x < pr.x + pr.w && g.x + g.w > pr.x;
      if (!overlapX) continue;

      var hitTop = rectHit(pr, { x: g.x, y: -40, w: g.w, h: top + 40 });
      var hitBot = rectHit(pr, { x: g.x, y: bot, w: g.w, h: H - bot + 40 });

      if (hitTop || hitBot) {
        applyHit();
        continue;
      }

      if (!g.near) {
        var clearTop = pr.y - top;
        var clearBot = bot - (pr.y + pr.h);
        var clear = Math.min(clearTop, clearBot);
        if (clear > 0 && clear < 24) {
          g.near = true;
          nearMiss(g);
        }
      }
    }

    // 陨石
    for (i = asteroids.length - 1; i >= 0; i--) {
      var a = asteroids[i];
      var distSq = (a.x - player.x) * (a.x - player.x) + (a.y - player.y) * (a.y - player.y);
      var reach = a.r + 28;
      if (distSq < reach * reach) {
        if (G.dashT > 0 && G.inv > 0) {
          a.dead = true;
          smash(a.x, a.y, a.r, G.pal.warm, 60);
          asteroids.splice(i, 1);
        } else {
          applyHit();
        }
      }
    }

    // 无人机
    for (i = drones.length - 1; i >= 0; i--) {
      var d = drones[i];
      var dd = (d.x - player.x) * (d.x - player.x) + (d.y - player.y) * (d.y - player.y);
      if (dd < 46 * 46) {
        if (G.dashT > 0 && G.inv > 0) {
          d.dead = true;
          smash(d.x, d.y, 20, '#ff6b5f', 70);
          drones.splice(i, 1);
        } else {
          applyHit();
        }
      }
    }

    // 能量球
    for (i = orbs.length - 1; i >= 0; i--) {
      var o = orbs[i];
      var ox = o.x - player.x;
      var oy = o.y - player.y;
      if (ox * ox + oy * oy < 52 * 52) {
        orbs.splice(i, 1);
        collectOrb(o);
      }
    }

    // 道具
    for (i = powers.length - 1; i >= 0; i--) {
      var p = powers[i];
      var px = p.x - player.x;
      var py = p.y - player.y;
      if (px * px + py * py < 46 * 46) {
        powers.splice(i, 1);
        collectPower(p);
      }
    }
  }

  function nearMiss(g) {
    G.combo++;
    G.comboTimer = 3.6;
    G.mult = 1 + Math.min(4, Math.floor(G.combo / 5));
    var gain = 20 * G.mult;
    G.score += gain;
    G.maxCombo = Math.max(G.maxCombo, G.combo);

    addFloat(player.x + 96, player.y - 26, '擦身 +' + gain, G.pal.warm, 17);
    for (var i = 0; i < 6; i++) {
      particles.push({
        type: 'spark',
        x: player.x + 20 + rand(-10, 30),
        y: player.y + rand(-24, 24),
        vx: rand(40, 160),
        vy: rand(-90, 90),
        life: rand(0.18, 0.42),
        max: 0.42,
        size: rand(1.4, 3),
        color: G.pal.warm
      });
    }
    SFX.tick(G.combo);
  }

  function collectOrb(o) {
    G.energy = clamp(G.energy + 18, 0, 100);
    G.combo++;
    G.comboTimer = 3.6;
    G.mult = 1 + Math.min(4, Math.floor(G.combo / 5));
    var gain = 60 * G.mult;
    G.score += gain;
    G.maxCombo = Math.max(G.maxCombo, G.combo);
    addFloat(o.x, o.y - 18, '+' + gain, '#fff2cc', 16);
    boom(o.x, o.y, 0.45, G.pal.accent, true);
    SFX.pickup(760 + Math.min(240, G.combo * 18));
  }

  function collectPower(p) {
    if (p.type === 'shield') {
      G.shield = Math.max(G.shield, 6);
      addFloat(p.x, p.y - 22, '护盾 6s', '#8fdcff', 18);
      SFX.shield();
      boom(p.x, p.y, 0.5, '#8fdcff', true);
    } else {
      G.slow = 4.5;
      canvas.classList.add('is-slow');
      addFloat(p.x, p.y - 22, '时缓 4.5s', '#c8a6ff', 18);
      SFX.slowmo();
      boom(p.x, p.y, 0.5, '#c8a6ff', true);
    }
    G.score += 30;
  }

  /* ---------------- 受伤 / 坠机 ---------------- */
  function applyHit() {
    if (G.inv > 0 || G.dashT > 0) return;

    if (G.shield > 0) {
      G.shield = 0;
      G.inv = 1.3;
      G.shake = 14;
      G.combo = 0;
      G.mult = 1;
      addFloat(player.x, player.y - 52, '护盾吸收', '#8fdcff', 18);
      boom(player.x, player.y, 0.8, '#8fdcff');
      SFX.shield();
      return;
    }

    G.lives -= 1;
    G.inv = 1.8;
    G.combo = 0;
    G.mult = 1;
    G.comboTimer = 0;
    G.shake = 22;
    G.hitFlash = 1;
    boom(player.x, player.y, 1, '#ff8a50');
    SFX.hit();
    updateHearts();

    if (G.lives <= 0) {
      gameOver();
    } else {
      addFloat(player.x, player.y - 54, '机体受损 · 剩 ' + G.lives, '#ffb066', 17);
    }
  }

  function gameOver() {
    if (G.mode !== 'playing') return;
    G.mode = 'over';
    G.endingAt = G.clock;
    G.shake = 30;
    G.flash = 0.9;
    boom(player.x, player.y, 1.9, '#ffb066');
    boom(player.x, player.y, 1.2, '#ffe2b0');
    stopGate();
    SFX.gameover();

    if (window.GameLimit) {
      try { window.GameLimit.count('plane'); } catch (e) { /* 存档异常不影响游戏 */ }
    }

    var finalScore = Math.floor(G.score);
    var isRecord = finalScore > G.best;
    if (isRecord) {
      G.best = finalScore;
      saveNumber(BEST_KEY, G.best);
    }

    setTimeout(function () { showOver(finalScore, isRecord); }, 700);
  }

  function showOver(finalScore, isRecord) {
    if (G.mode !== 'over') return;
    overScore.textContent = pad(finalScore, 1);
    overDist.textContent = Math.floor(G.dist) + ' m';
    overCombo.textContent = String(G.maxCombo);
    overBest.textContent = pad(G.best, 1);
    overRecord.hidden = !isRecord;
    overKicker.textContent = isRecord ? 'NEW RECORD · 新纪录' : 'FLIGHT RECORD · 航程报告';
    overTitle.textContent = isRecord ? '刷新纪录' : '本次航程结束';
    overOv.hidden = false;
    menuBest.textContent = String(G.best);
    if (overFocus) overFocus.textContent = '护盾、时缓、冲刺：三个按钮一样重要';
  }

  function updateHearts() {
    for (var i = 0; i < heartEls.length; i++) {
      heartEls[i].classList.toggle('is-off', i >= G.lives);
    }
  }

  /* ---------------- 冲刺 ---------------- */
  function tryDash() {
    if (G.mode !== 'playing' || isPaused()) return;
    if (G.dashCd > 0) return;
    if (G.energy < 25) {
      addFloat(player.x, player.y - 46, '能量不足', '#ff9a3c', 15);
      return;
    }
    G.energy -= 25;
    G.dashCd = 1.15;
    G.dashT = 0.4;
    G.inv = Math.max(G.inv, 0.55);
    G.shake = 9;
    SFX.dash();
    boom(player.x - 26, player.y, 0.55, G.pal.accent, true);

    for (var i = 0; i < 18; i++) {
      particles.push({
        type: 'streak',
        x: player.x - 30 + rand(-14, 14),
        y: player.y + rand(-28, 28),
        vx: -rand(460, 900),
        vy: rand(-40, 40),
        life: rand(0.16, 0.42),
        max: 0.42,
        size: rand(18, 62),
        color: G.pal.accent
      });
    }
  }

  /* ---------------- 粒子 / 飘字 ---------------- */
  function boom(x, y, scale, color, soft) {
    var n = soft ? 8 : 22;
    for (var i = 0; i < n; i++) {
      var a = rand(0, Math.PI * 2);
      var sp = rand(60, 330) * scale;
      particles.push({
        type: 'spark',
        x: x,
        y: y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: rand(0.25, 0.62) * (soft ? 0.8 : 1),
        max: 0.7,
        size: rand(1.5, 4.2),
        color: color || G.pal.warm
      });
    }
    particles.push({
      type: 'ring',
      x: x,
      y: y,
      r: 6,
      vr: 300 * scale,
      life: 0.5,
      max: 0.5,
      w: 3,
      color: color || G.pal.warm
    });
    if (!soft) {
      for (var j = 0; j < 6; j++) {
        particles.push({
          type: 'smoke',
          x: x + rand(-22, 22),
          y: y + rand(-22, 22),
          vx: rand(-50, 50),
          vy: rand(-50, 50),
          life: rand(0.5, 1.2),
          max: 1.2,
          size: rand(12, 28),
          color: '#3a2a22'
        });
      }
    }
  }

  function smash(x, y, r, color, points) {
    G.score += points * G.mult;
    addFloat(x, y - r - 8, '+' + (points * G.mult), color, 16);
    boom(x, y, 1.1, color);
    G.shake = Math.max(G.shake, 10);
  }

  function addFloat(x, y, text, color, size) {
    floats.push({ x: x, y: y, text: text, color: color || '#ffe9c9', size: size || 16, life: 1.1, max: 1.1 });
    if (floats.length > 24) floats.shift();
  }

  function updateParticles(dt) {
    var i;
    for (i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      if (p.type === 'ring') {
        p.r += p.vr * dt;
      } else {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 1 - dt * 1.4;
        p.vy *= 1 - dt * 1.4;
      }
      if (p.type === 'smoke') p.size += dt * 26;
    }
    if (particles.length > 460) particles.splice(0, particles.length - 460);

    for (i = trail.length - 1; i >= 0; i--) {
      trail[i].x -= 8 * dt;
      trail[i].life -= dt;
      if (trail[i].life <= 0) trail.splice(i, 1);
    }
  }

  function updateFloats(dt) {
    for (var i = floats.length - 1; i >= 0; i--) {
      var f = floats[i];
      f.life -= dt;
      f.y -= 42 * dt;
      if (f.life <= 0) floats.splice(i, 1);
    }
  }

  /* ---------------- 航段切换 ---------------- */
  function zoneCheck() {
    var z = Math.min(ZONES.length - 1, Math.floor(G.dist / 380));
    if (z === G.zone) return;
    G.zone = z;
    G.pal = ZONES[z];
    buildBackdrop();
    hudSector.textContent = G.pal.label;
    showBanner(G.pal.label, '进入新航段 · 速度与障碍同步升级');
    G.flash = 0.5;
    SFX.zone();

    if (z >= 1) meteorShower();
  }

  function meteorShower() {
    var count = 6 + G.zone + randInt(0, 2);
    for (var i = 0; i < count; i++) {
      spawnAsteroid(W + 160 + i * 96, rand(90, H - 90), rand(20, 34), rand(-50, 50));
    }
    addFloat(W - 200, 140, '陨石雨', G.pal.warm, 22);
  }

  function showBanner(text, sub) {
    if (!zoneBanner) return;
    zoneBanner.innerHTML = '<span class="zb-sub">' + sub + '</span><span class="zb-text">' + text + '</span>';
    zoneBanner.classList.remove('is-show');
    // 强制重排以重启动画
    void zoneBanner.offsetWidth;
    zoneBanner.classList.add('is-show');
  }

  /* ---------------- HUD ---------------- */
  var lastHUD = { score: -1, best: -1, dist: -1, lives: -1, energy: -1, mult: -1, combo: -1, dash: '', sector: '' };

  function syncHUD() {
    var s = Math.floor(G.score);
    if (s !== lastHUD.score) {
      hudScore.textContent = pad(s, 6);
      lastHUD.score = s;
    }
    if (G.best !== lastHUD.best) {
      hudBest.textContent = 'BEST ' + pad(G.best, 6);
      lastHUD.best = G.best;
    }
    var d = Math.floor(G.dist);
    if (d !== lastHUD.dist) {
      hudDist.textContent = d + ' m';
      lastHUD.dist = d;
    }
    if (G.mult !== lastHUD.mult || G.combo !== lastHUD.combo) {
      lastHUD.mult = G.mult;
      lastHUD.combo = G.combo;
      if (G.mult > 1) {
        hudCombo.hidden = false;
        hudMult.textContent = '×' + G.mult;
        hudComboNum.textContent = '连击 ' + G.combo;
        hudCombo.classList.toggle('is-hot', G.mult >= 3);
      } else {
        hudCombo.hidden = true;
      }
    }
    if (G.lives !== lastHUD.lives) {
      lastHUD.lives = G.lives;
      updateHearts();
    }
    var e = Math.round(G.energy);
    if (e !== lastHUD.energy) {
      lastHUD.energy = e;
      energyFill.style.width = e + '%';
      energyFill.classList.toggle('is-full', e >= 100);
    }
    var dashText;
    if (G.dashCd > 0) dashText = '冲刺冷却 ' + G.dashCd.toFixed(1) + 's';
    else if (G.energy < 25) dashText = '能量不足 · 收集能量球';
    else dashText = 'SPACE · 冲刺就绪';
    if (dashText !== lastHUD.dash) {
      lastHUD.dash = dashText;
      dashLabel.textContent = dashText;
      dashLabel.classList.toggle('is-ready', G.dashCd <= 0 && G.energy >= 25);
    }
    if (G.pal.label !== lastHUD.sector) {
      lastHUD.sector = G.pal.label;
      hudSector.textContent = G.pal.label;
    }
  }

  /* ---------------- 绘制：闸门 ---------------- */
  function drawGateBar(x, y, w, h, acc, pulse, capSide) {
    if (h <= 0) return;
    var i;

    // 背板
    var g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, '#17100c');
    g.addColorStop(0.35, '#31231a');
    g.addColorStop(0.65, '#241813');
    g.addColorStop(1, '#120c09');
    ctx.fillStyle = g;
    roundRectPath(x, y, w, h, 10);
    ctx.fill();

    // 内侧色染
    var tint = ctx.createLinearGradient(x, 0, x + w, 0);
    tint.addColorStop(0, rgba(acc, 0.03));
    tint.addColorStop(0.5, rgba(acc, 0.1));
    tint.addColorStop(1, rgba(acc, 0.03));
    ctx.fillStyle = tint;
    roundRectPath(x, y, w, h, 10);
    ctx.fill();

    // 内部电路纹
    ctx.save();
    ctx.strokeStyle = 'rgba(255,224,190,0.09)';
    ctx.lineWidth = 1;
    for (i = x + 12; i < x + w; i += 13) {
      ctx.beginPath();
      ctx.moveTo(i, Math.max(y, 0));
      ctx.lineTo(i, Math.min(y + h, H));
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,224,190,0.055)';
    for (i = Math.max(y, -20); i < y + h; i += 46) {
      ctx.beginPath();
      ctx.moveTo(x + 6, i);
      ctx.lineTo(x + w - 6, i);
      ctx.stroke();
    }

    // 缓慢下移的扫描光带（裁进闸门内部，避免漏到缺口外）
    roundRectPath(x, y, w, h, 10);
    ctx.clip();
    var span = Math.max(40, h);
    var scanY = y + mod(G.clock * 130 + x * 0.7, span + 220) - 110;
    var sg = ctx.createLinearGradient(0, scanY - 26, 0, scanY + 26);
    sg.addColorStop(0, 'rgba(0,0,0,0)');
    sg.addColorStop(0.5, rgba(acc, 0.22 * pulse));
    sg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(x + 2, scanY - 26, w - 4, 52);
    ctx.restore();

    // 外框发光
    ctx.save();
    ctx.shadowColor = acc;
    ctx.shadowBlur = 18 * pulse;
    ctx.strokeStyle = rgba(acc, 0.62 * pulse);
    ctx.lineWidth = 2;
    roundRectPath(x, y, w, h, 10);
    ctx.stroke();
    ctx.restore();

    // 缺口侧的高亮边 + 柔和光晕
    var capY = capSide === 'bottom' ? y + h - 6 : y + 2;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var cxp = x + w / 2;
    var gg = ctx.createRadialGradient(cxp, capY, 2, cxp, capY, Math.max(64, w));
    gg.addColorStop(0, rgba(acc, 0.2 * pulse));
    gg.addColorStop(0.45, rgba(acc, 0.07 * pulse));
    gg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gg;
    ctx.beginPath();
    ctx.ellipse(cxp, capY, w * 1.1, 44, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.shadowColor = acc;
    ctx.shadowBlur = 26;
    ctx.fillStyle = rgba(acc, 0.95);
    roundRectPath(x + 3, capY, w - 6, 4, 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    roundRectPath(x + 12, capY + 1, w - 24, 1.4, 1);
    ctx.fill();
    ctx.restore();

    // 两侧角标
    ctx.save();
    ctx.strokeStyle = rgba(acc, 0.8);
    ctx.lineWidth = 1.6;
    var bracketY = capSide === 'bottom' ? capY - 12 : capY + 12;
    var by = capSide === 'bottom' ? bracketY : capY;
    for (i = 0; i < 2; i++) {
      var bx = i === 0 ? x + 4 : x + w - 4;
      var sgn = i === 0 ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(bx + sgn * 8, by);
      ctx.lineTo(bx, by);
      ctx.lineTo(bx, by + (capSide === 'bottom' ? -9 : 9));
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawGates() {
    for (var i = 0; i < gates.length; i++) {
      var g = gates[i];
      var top = g.gapY - g.gapH / 2;
      var bot = g.gapY + g.gapH / 2;
      var pulse = 0.75 + 0.25 * Math.sin(G.clock * 3 + g.seed);

      drawGateBar(g.x, -80, g.w, top + 80, g.color, pulse, 'bottom');
      drawGateBar(g.x, bot, g.w, H - bot + 80, g.color, pulse, 'top');

      // 缺口里飘动的能量丝
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (var k = 0; k < 2; k++) {
        var yy = top + (k + 1) * (g.gapH / 3);
        var wob = Math.sin(G.clock * 2.4 + g.seed + k) * 4;
        var a = 0.1 * pulse;
        var lg = ctx.createLinearGradient(g.x, 0, g.x + g.w, 0);
        lg.addColorStop(0, 'rgba(0,0,0,0)');
        lg.addColorStop(0.5, rgba(g.color, a));
        lg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.strokeStyle = lg;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(g.x + 4, yy + wob);
        ctx.lineTo(g.x + g.w - 4, yy - wob);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  /* ---------------- 绘制：陨石 / 无人机 ---------------- */
  function drawAsteroids() {
    for (var i = 0; i < asteroids.length; i++) {
      var a = asteroids[i];
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(a.rot);

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      var glow = ctx.createRadialGradient(0, 0, a.r * 0.3, 0, 0, a.r * 2.1);
      glow.addColorStop(0, rgba(G.pal.warm, 0.12));
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, a.r * 2.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      var g = ctx.createRadialGradient(-a.r * 0.4, -a.r * 0.5, a.r * 0.15, 0, 0, a.r);
      g.addColorStop(0, '#82614a');
      g.addColorStop(0.55, '#41302a');
      g.addColorStop(1, '#1b1310');

      ctx.beginPath();
      for (var k = 0; k < a.points.length; k++) {
        var pt = a.points[k];
        var px = Math.cos(pt.a) * a.r * pt.r;
        var py = Math.sin(pt.a) * a.r * pt.r;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = rgba(G.pal.warm, 0.4);
      ctx.lineWidth = 1.4;
      ctx.stroke();

      // 坑洞
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath();
      ctx.arc(-a.r * 0.22, a.r * 0.1, a.r * 0.19, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(a.r * 0.28, -a.r * 0.24, a.r * 0.12, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  function drawDrones() {
    for (var i = 0; i < drones.length; i++) {
      var d = drones[i];
      var wob = Math.sin(G.clock * 4 + d.seed) * 0.1;
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(wob);

      // 红色警示光
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      var glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 46);
      glow.addColorStop(0, 'rgba(255,74,58,0.35)');
      glow.addColorStop(1, 'rgba(255,74,58,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, 46, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 机体
      ctx.beginPath();
      ctx.moveTo(24, 0);
      ctx.lineTo(-10, -15);
      ctx.lineTo(-2, 0);
      ctx.lineTo(-10, 15);
      ctx.closePath();
      ctx.fillStyle = '#2b1a18';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,107,95,0.85)';
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // 红色感应眼
      ctx.save();
      ctx.shadowColor = '#ff4438';
      ctx.shadowBlur = 16;
      ctx.fillStyle = '#ff5a4a';
      ctx.beginPath();
      ctx.arc(7, 0, 3.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.restore();
    }
  }

  /* ---------------- 绘制：能量球 / 道具 ---------------- */
  function drawOrbs() {
    for (var i = 0; i < orbs.length; i++) {
      var o = orbs[i];
      var bob = Math.sin(G.clock * 3 + o.seed) * 5;
      var pulse = 1 + Math.sin(G.clock * 4 + o.seed) * 0.12;

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      var g = ctx.createRadialGradient(o.x, o.y + bob, 2, o.x, o.y + bob, 24 * pulse);
      g.addColorStop(0, 'rgba(255,248,224,1)');
      g.addColorStop(0.35, rgba(G.pal.accent, 0.9));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(o.x, o.y + bob, 24 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = '#fff8e2';
      ctx.beginPath();
      ctx.arc(o.x, o.y + bob, 3.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = rgba(G.pal.accent, 0.75);
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.arc(o.x, o.y + bob, 9 + pulse * 2, G.clock * 2, G.clock * 2 + 4.4);
      ctx.stroke();
    }
  }

  function drawPowers() {
    for (var i = 0; i < powers.length; i++) {
      var p = powers[i];
      var bob = Math.sin(G.clock * 3 + p.seed) * 4;
      var color = p.type === 'shield' ? '#8fdcff' : '#c8a6ff';

      ctx.save();
      ctx.translate(p.x, p.y + bob);

      // 外光
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      var halo = ctx.createRadialGradient(0, 0, 8, 0, 0, 52);
      halo.addColorStop(0, rgba(color, 0.4));
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(0, 0, 52, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 菱形底
      ctx.rotate(Math.sin(G.clock * 2 + p.seed) * 0.16);
      ctx.beginPath();
      ctx.moveTo(0, -24);
      ctx.lineTo(24, 0);
      ctx.lineTo(0, 24);
      ctx.lineTo(-24, 0);
      ctx.closePath();
      var g = ctx.createLinearGradient(-20, -20, 20, 20);
      g.addColorStop(0, rgba(color, 0.9));
      g.addColorStop(1, rgba(color, 0.35));
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = rgba('#ffffff', 0.55);
      ctx.lineWidth = 1.4;
      ctx.stroke();

      // 图标
      ctx.strokeStyle = '#1c1210';
      ctx.fillStyle = '#1c1210';
      ctx.lineWidth = 2.2;
      if (p.type === 'shield') {
        ctx.beginPath();
        ctx.moveTo(0, -11);
        ctx.lineTo(9, -6);
        ctx.lineTo(7, 5);
        ctx.lineTo(0, 12);
        ctx.lineTo(-7, 5);
        ctx.lineTo(-9, -6);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, -6);
        ctx.lineTo(0, 7);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -6);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(4, 3);
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  /* ---------------- 绘制：尾迹与飞机 ---------------- */
  function drawTrail() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < trail.length; i++) {
      var t = trail[i];
      var a = (t.life / 0.55) * 0.16;
      var r = 3 + (1 - t.life / 0.55) * 7;
      ctx.fillStyle = rgba('#ffb066', a);
      ctx.beginPath();
      ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawFlame(boost) {
    var len = (boost ? 86 : 40) + Math.sin(G.clock * 32) * 7 + Math.random() * 10;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var g = ctx.createLinearGradient(-42, 0, -44 - len, 0);
    g.addColorStop(0, 'rgba(255,255,240,0.95)');
    g.addColorStop(0.22, 'rgba(255,204,120,0.85)');
    g.addColorStop(0.65, 'rgba(255,110,40,0.4)');
    g.addColorStop(1, 'rgba(255,80,20,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-42, -6.5);
    ctx.quadraticCurveTo(-46 - len * 0.6, -4.4, -46 - len, 0);
    ctx.quadraticCurveTo(-46 - len * 0.6, 4.4, -42, 6.5);
    ctx.closePath();
    ctx.fill();

    // 亮芯
    ctx.fillStyle = 'rgba(255,255,235,0.8)';
    ctx.beginPath();
    ctx.moveTo(-42, -3);
    ctx.quadraticCurveTo(-46 - len * 0.38, 0, -42, 3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawShipShape(x, y, angle, ghost, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = ghost ? 'rgba(120,220,255,0.5)' : '#c8ab84';
    ctx.beginPath();
    ctx.moveTo(46, 0);
    ctx.quadraticCurveTo(30, -12, 4, -12);
    ctx.lineTo(-30, -12);
    ctx.quadraticCurveTo(-44, -9, -46, 0);
    ctx.quadraticCurveTo(-44, 9, -30, 12);
    ctx.lineTo(4, 12);
    ctx.quadraticCurveTo(30, 12, 46, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawPlayer() {
    if (G.mode === 'over') return;
    var p = player;

    // 机身环境光
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var halo = ctx.createRadialGradient(p.x, p.y, 8, p.x, p.y, 150);
    halo.addColorStop(0, rgba('#ff9a3c', 0.16));
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 150, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 冲刺残影
    if (G.dashT > 0) {
      for (var i = 1; i <= 3; i++) {
        drawShipShape(p.x - i * 34, p.y, p.angle, true, 0.22 / i);
      }
    }

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.scale(1.2, 1.2);
    if (G.inv > 0 && G.mode === 'playing' && Math.sin(G.clock * 28) > 0) {
      ctx.globalAlpha = 0.55;
    }

    // 机翼（上下对称，带金属渐变与前缘高光）
    for (var w = -1; w <= 1; w += 2) {
      var wg2 = ctx.createLinearGradient(-2, 11 * w, -42, 38 * w);
      wg2.addColorStop(0, '#57402f');
      wg2.addColorStop(0.55, '#3a2a22');
      wg2.addColorStop(1, '#211612');
      ctx.beginPath();
      ctx.moveTo(-2, 11 * w);
      ctx.lineTo(-24, 40 * w);
      ctx.lineTo(-42, 38 * w);
      ctx.lineTo(-32, 10 * w);
      ctx.closePath();
      ctx.fillStyle = wg2;
      ctx.fill();
      ctx.strokeStyle = rgba('#d8b073', 0.3);
      ctx.lineWidth = 1;
      ctx.stroke();

      // 前缘高光
      ctx.beginPath();
      ctx.moveTo(-2, 11 * w);
      ctx.lineTo(-24, 40 * w);
      ctx.strokeStyle = 'rgba(255,214,160,0.55)';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // 翼面分割线
      ctx.beginPath();
      ctx.moveTo(-9, 15 * w);
      ctx.lineTo(-30, 34 * w);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // 翼尖灯
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var wl = -1; wl <= 1; wl += 2) {
      var wx = -40;
      var wy = 38 * wl;
      var navCol = wl < 0 ? '#8fe8ff' : '#ffb26b';
      var wg = ctx.createRadialGradient(wx, wy, 1, wx, wy, 13);
      wg.addColorStop(0, rgba(navCol, 0.5));
      wg.addColorStop(1, rgba(navCol, 0));
      ctx.fillStyle = wg;
      ctx.beginPath();
      ctx.arc(wx, wy, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = rgba(navCol, 0.95);
      ctx.beginPath();
      ctx.arc(wx, wy, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 尾翼
    ctx.fillStyle = '#4a3527';
    ctx.beginPath();
    ctx.moveTo(-30, -4);
    ctx.lineTo(-58, -20);
    ctx.lineTo(-60, -14);
    ctx.lineTo(-38, 0);
    ctx.closePath();
    ctx.fill();

    // 机身
    var body = ctx.createLinearGradient(0, -14, 0, 16);
    body.addColorStop(0, '#f7e9d1');
    body.addColorStop(0.4, '#d3b58c');
    body.addColorStop(1, '#6d523c');
    ctx.beginPath();
    ctx.moveTo(48, 0);
    ctx.quadraticCurveTo(30, -12, 4, -13);
    ctx.lineTo(-28, -13);
    ctx.quadraticCurveTo(-45, -10, -47, -2);
    ctx.lineTo(-47, 2);
    ctx.quadraticCurveTo(-45, 10, -28, 13);
    ctx.lineTo(4, 13);
    ctx.quadraticCurveTo(30, 12, 48, 0);
    ctx.closePath();
    ctx.fillStyle = body;
    ctx.fill();

    // 边缘描光
    ctx.strokeStyle = 'rgba(255,238,200,0.55)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(48, 0);
    ctx.quadraticCurveTo(30, -12, 4, -13);
    ctx.lineTo(-28, -13);
    ctx.quadraticCurveTo(-45, -10, -47, -2);
    ctx.stroke();

    // 机腹暗线
    ctx.strokeStyle = 'rgba(60,40,26,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(44, 3);
    ctx.lineTo(-30, 4);
    ctx.stroke();

    // 驾驶舱
    var cockpit = ctx.createLinearGradient(2, -8, 26, 8);
    cockpit.addColorStop(0, '#bff4ff');
    cockpit.addColorStop(0.5, '#5ec8e6');
    cockpit.addColorStop(1, '#1f6079');
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(16, -1.5, 13, 7.4, -0.08, 0, Math.PI * 2);
    ctx.fillStyle = cockpit;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // 座舱高光
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(9, -3.5);
    ctx.quadraticCurveTo(15, -6.5, 21, -3.4);
    ctx.stroke();

    // 引擎口
    ctx.fillStyle = '#1a1210';
    ctx.beginPath();
    ctx.arc(-46, 0, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,190,110,0.7)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(-46, 0, 6.5, 0, Math.PI * 2);
    ctx.stroke();

    // 尾焰（画在最上层，避免被尾翼遮挡）
    drawFlame(G.dashT > 0);

    ctx.restore();

    // 护盾
    if (G.shield > 0) drawShield(p.x, p.y);
  }

  function drawShield(x, y) {
    var a = 0.4 + 0.2 * Math.sin(G.clock * 6);
    ctx.save();
    ctx.translate(x, y);
    ctx.globalCompositeOperation = 'lighter';
    var g = ctx.createRadialGradient(0, 0, 42, 0, 0, 78);
    g.addColorStop(0, 'rgba(120,220,255,0)');
    g.addColorStop(0.72, rgba('#78dcff', 0.16));
    g.addColorStop(1, 'rgba(120,220,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 78, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = rgba('#8fdcff', a);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 68, 0, Math.PI * 2);
    ctx.stroke();

    ctx.lineWidth = 1;
    for (var i = 0; i < 8; i++) {
      var ang = G.clock * 0.8 + i * Math.PI / 4;
      var ax = Math.cos(ang) * 68;
      var ay = Math.sin(ang) * 68;
      ctx.strokeStyle = rgba('#8fdcff', 0.5);
      ctx.beginPath();
      ctx.moveTo(ax * 0.94, ay * 0.94);
      ctx.lineTo(ax, ay);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ---------------- 绘制：粒子与飘字 ---------------- */
  function drawParticles() {
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      var t = clamp(p.life / p.max, 0, 1);
      if (p.type === 'ring') {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = rgba(p.color, t * 0.7);
        ctx.lineWidth = p.w * t;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else if (p.type === 'smoke') {
        ctx.fillStyle = rgba(p.color, t * 0.35);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'streak') {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = rgba(p.color, t * 0.55);
        ctx.lineWidth = 2 * t + 0.5;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.size, p.y - p.vy * 0.04);
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = rgba(p.color, t);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.4 + t * 0.6), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  function drawFloats() {
    ctx.save();
    ctx.textAlign = 'center';
    for (var i = 0; i < floats.length; i++) {
      var f = floats[i];
      var t = clamp(f.life / f.max, 0, 1);
      ctx.globalAlpha = t;
      ctx.font = '600 ' + f.size + 'px "PingFang SC","Helvetica Neue",sans-serif';
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillText(f.text, f.x + 1, f.y + 1);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.restore();
  }

  /* ---------------- 主绘制 ---------------- */
  function draw() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.save();

    if (G.shake > 0.4) {
      ctx.translate(rand(-1, 1) * G.shake * 0.55, rand(-1, 1) * G.shake * 0.45);
    }

    drawBackground();
    drawPlanet();
    drawGates();
    drawPowers();
    drawOrbs();
    drawAsteroids();
    drawDrones();
    drawTrail();
    drawPlayer();
    drawParticles();
    drawFloats();

    ctx.restore();

    // 屏幕后处理
    ctx.fillStyle = G.vignette;
    ctx.fillRect(0, 0, W, H);

    if (G.hitFlash > 0) {
      ctx.fillStyle = 'rgba(255,64,48,' + (G.hitFlash * 0.22) + ')';
      ctx.fillRect(0, 0, W, H);
    }
    if (G.flash > 0) {
      ctx.fillStyle = 'rgba(255,245,225,' + (G.flash * 0.5) + ')';
      ctx.fillRect(0, 0, W, H);
    }

    // 时缓提示环
    if (G.slow > 0) {
      var a = 0.12 + 0.08 * Math.sin(G.clock * 4);
      ctx.fillStyle = 'rgba(150,120,255,' + a + ')';
      ctx.fillRect(0, 0, W, 8);
      ctx.fillRect(0, H - 8, W, 8);
    }
  }

  /* ---------------- 更新入口 ---------------- */
  function update(dt) {
    var slowScale = G.slow > 0 ? 0.52 : 1;
    var adv = G.speed * slowScale * dt;
    G.bgScroll += adv;
    G.time += dt;

    updatePlayer(dt);

    G.speed = Math.min(560, 300 + G.dist * 0.22);
    var gain = (G.speed * slowScale * dt) / 10;
    G.dist += gain;
    G.score += gain * 8 * G.mult;
    G.maxCombo = Math.max(G.maxCombo, G.combo);

    updateWorld(adv, dt * slowScale);
    spawnLogic(adv);
    collisions();
    timers(dt);
    zoneCheck();
    syncHUD();

    if (gate) gate.tick(dt);
  }

  function updateMenu(dt) {
    G.menuT += dt;
    G.bgScroll += 140 * dt;
    player.y = H * 0.56 + Math.sin(G.menuT * 1.1) * 36;
    player.x = 250 + Math.sin(G.menuT * 0.5) * 12;
    player.angle = Math.cos(G.menuT * 1.1) * 0.06;
    player.trailT -= dt;
    if (player.trailT <= 0) {
      player.trailT = 0.03;
      trail.push({ x: player.x - 44, y: player.y + rand(-3, 3), life: 0.55 });
      if (trail.length > 60) trail.shift();
    }
  }

  function isPaused() {
    return G.manualPaused || G.gatePaused || G.breakPaused;
  }

  /* ---------------- 主循环 ---------------- */
  function frame(ts) {
    var dt = (ts - last) / 1000;
    if (!(dt > 0)) dt = 0.016;
    if (dt > 0.05) dt = 0.05;
    last = ts;
    G.clock += dt;

    G.shake = Math.max(0, G.shake - dt * 70);
    G.flash = Math.max(0, G.flash - dt * 2.2);
    G.hitFlash = Math.max(0, G.hitFlash - dt * 2.2);

    if (G.mode === 'playing' && !isPaused()) update(dt);
    else if (G.mode === 'menu') updateMenu(dt);

    updateParticles(dt);
    updateFloats(dt);
    draw();

    rafId = requestAnimationFrame(frame);
  }

  /* ---------------- 开局 / 重置 ---------------- */
  function resetGame() {
    gates = [];
    asteroids = [];
    drones = [];
    orbs = [];
    powers = [];
    particles = [];
    floats = [];
    trail = [];

    G.mode = 'playing';
    G.time = 0;
    G.dist = 0;
    G.score = 0;
    G.speed = 300;
    G.lives = 3;
    G.energy = 100;
    G.combo = 0;
    G.mult = 1;
    G.comboTimer = 0;
    G.maxCombo = 0;
    G.shield = 0;
    G.slow = 0;
    G.inv = 1.4;
    G.dashT = 0;
    G.dashCd = 0;
    G.zone = 0;
    G.pal = ZONES[0];
    G.lastGap = null;
    G.gateIn = 1150;
    G.rockIn = 2400;
    G.droneIn = 2600;
    G.powerIn = 3000;
    G.shake = 0;
    G.flash = 0;
    G.hitFlash = 0;
    G.manualPaused = false;
    G.gatePaused = false;
    G.breakPaused = false;
    G.endingAt = 0;

    player.x = 250;
    player.y = H / 2;
    player.vy = 0;
    player.angle = 0;
    player.trailT = 0;
    player.exT = 0;
    targetY = H / 2;

    canvas.classList.remove('is-slow');

    lastHUD = { score: -1, best: -1, dist: -1, lives: -1, energy: -1, mult: -1, combo: -1, dash: '', sector: '' };
    hudScore.textContent = '000000';
    hudDist.textContent = '0 m';
    hudSector.textContent = G.pal.label;
    hudCombo.hidden = true;
    lastHUD.sector = G.pal.label;
    updateHearts();
    syncHUD();
    buildBackdrop();
  }

  function startGame() {
    SFX.init();
    if (window.GameLimit) {
      var st = window.GameLimit.status('plane');
      if (st && st.locked) {
        // 冷却中：让 limit.js 自己的锁定层接管
        return;
      }
    }
    resetGame();
    if (hudEl) hudEl.classList.add('is-live');
    menuOv.hidden = true;
    pauseOv.hidden = true;
    overOv.hidden = true;
    G.manualPaused = false;
    createGate();
    showBanner('起飞', '穿云战机 · SKYBORNE · 收集能量，贴着闸门飞');
    last = performance.now();

    // 调试：?warp=秒数 快进世界，方便检查障碍与特效
    var warp = /[?&]warp=(\d+(?:\.\d+)?)/.exec(location.search);
    if (warp) {
      var steps = Math.min(2400, Math.round(Number(warp[1]) * 60));
      for (var wi = 0; wi < steps; wi++) update(1 / 60);
      last = performance.now();
    }
  }

  function togglePause() {
    if (G.mode !== 'playing') return;
    if (gate && gate.locked) return;
    G.manualPaused = !G.manualPaused;
    pauseOv.hidden = !G.manualPaused;
    if (G.manualPaused) {
      keys.up = false;
      keys.down = false;
    } else {
      last = performance.now();
    }
  }

  /* ---------------- 局间门禁 ---------------- */
  function createGate() {
    if (!window.Gate) return;
    if (gate) {
      gate.destroy();
      gate = null;
    }
    gate = window.Gate.create({
      everyMinutes: 5,
      challenges: ['twenty-four', 'poem', 'english'],
      showBadge: true,
      badgePosition: 'bottom-left',
      openOnStart: /[?&]tf24demo=1/.test(location.search),
      kicker: '局间门禁 · 穿云战机',
      title: '先过一道关卡',
      note: '已经飞了 5 分钟。答完这道题，再回到航线。',
      onLock: function () {
        if (G.mode !== 'playing') return;
        G.gatePaused = true;
        keys.up = false;
        keys.down = false;
      },
      onUnlock: function () {
        if (G.mode !== 'playing') return;
        G.gatePaused = false;
        last = performance.now();
      }
    });
  }

  function stopGate() {
    if (gate) {
      gate.destroy();
      gate = null;
    }
    G.gatePaused = false;
  }

  /* ---------------- 输入 ---------------- */
  function pointerY(e) {
    var r = canvas.getBoundingClientRect();
    return (e.clientY - r.top) / r.height * H;
  }

  canvas.addEventListener('pointermove', function (e) {
    if (G.mode !== 'playing' || isPaused()) return;
    targetY = clamp(pointerY(e), 50, H - 52);
  });

  canvas.addEventListener('pointerdown', function (e) {
    if (G.mode !== 'playing' || isPaused()) return;
    if (e.cancelable) e.preventDefault();
    targetY = clamp(pointerY(e), 50, H - 52);
    if (e.pointerType === 'mouse') tryDash();
  });

  canvas.addEventListener('contextmenu', function (e) {
    if (G.mode === 'playing') e.preventDefault();
  });

  window.addEventListener('keydown', function (e) {
    var k = e.key;
    if (k === 'ArrowUp' || k === 'w' || k === 'W') {
      keys.up = true;
      if (G.mode === 'playing') e.preventDefault();
    } else if (k === 'ArrowDown' || k === 's' || k === 'S') {
      keys.down = true;
      if (G.mode === 'playing') e.preventDefault();
    } else if (k === ' ' || k === 'Spacebar') {
      if (G.mode === 'playing') {
        e.preventDefault();
        tryDash();
      } else if (G.mode === 'menu') {
        e.preventDefault();
        startGame();
      }
    } else if (k === 'Enter') {
      if (G.mode === 'menu') startGame();
      else if (G.mode === 'over' && !overOv.hidden) startGame();
    } else if (k === 'p' || k === 'P' || k === 'Escape') {
      if (gate && gate.locked) return;
      togglePause();
    }
  });

  window.addEventListener('keyup', function (e) {
    var k = e.key;
    if (k === 'ArrowUp' || k === 'w' || k === 'W') keys.up = false;
    if (k === 'ArrowDown' || k === 's' || k === 'S') keys.down = false;
  });

  window.addEventListener('blur', function () {
    keys.up = false;
    keys.down = false;
  });

  /* ---------------- 界面按钮 ---------------- */
  function buildHearts() {
    if (!heartsEl) return;
    heartsEl.innerHTML = '';
    heartEls = [];
    for (var i = 0; i < 3; i++) {
      var el = document.createElement('span');
      el.className = 'heart';
      heartsEl.appendChild(el);
      heartEls.push(el);
    }
  }

  function refreshSoundBtn() {
    if (!soundBtn) return;
    soundBtn.classList.toggle('is-muted', SFX.muted);
    soundBtn.textContent = '♪';
    soundBtn.title = SFX.muted ? '开启音效' : '关闭音效';
  }

  if (startBtn) startBtn.addEventListener('click', startGame);
  if (retryBtn) retryBtn.addEventListener('click', startGame);
  if (resumeBtn) resumeBtn.addEventListener('click', togglePause);
  if (pauseBtn) pauseBtn.addEventListener('click', function () {
    if (G.mode === 'playing') togglePause();
  });
  if (soundBtn) {
    soundBtn.addEventListener('click', function () {
      SFX.muted = !SFX.muted;
      saveNumber(MUTE_KEY, SFX.muted ? 1 : 0);
      refreshSoundBtn();
      if (!SFX.muted) { SFX.init(); SFX.pickup(700); }
    });
  }
  if (dashBtn) {
    dashBtn.addEventListener('pointerdown', function (e) {
      e.stopPropagation();
      e.preventDefault();
      tryDash();
    });
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden && G.mode === 'playing' && !isPaused()) {
      G.manualPaused = true;
      pauseOv.hidden = false;
    }
  });

  document.addEventListener('playclock:breakstart', function () {
    G.breakPaused = true;
    keys.up = false;
    keys.down = false;
  });
  document.addEventListener('playclock:breakend', function () {
    G.breakPaused = false;
    last = performance.now();
  });

  window.addEventListener('resize', function () {
    // 只更新 DPR 相关缓存，逻辑坐标不变
    setupCanvas();
  });

  /* ---------------- 启动 ---------------- */
  function boot() {
    setupCanvas();
    initStars();
    buildBackdrop();
    buildHearts();
    G.pal = ZONES[0];
    hudSector.textContent = G.pal.label;
    hudBest.textContent = 'BEST ' + pad(G.best, 6);
    menuBest.textContent = String(G.best);
    refreshSoundBtn();
    syncHUD();
    last = performance.now();
    rafId = requestAnimationFrame(frame);

    // 调试：?autostart=1 直接起飞，方便截屏与自测
    if (/[?&]autostart=1/.test(location.search)) {
      setTimeout(startGame, 800);
    }
  }

  boot();
})();
