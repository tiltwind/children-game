/* ============================================================
 * racing.js —— 霓虹狂飙 · NEON RUSH
 * 弯道公路 + 四路面 + 四车 + 六赛段；擦身连击 / 漂移 / 氮气
 * 全部美术与音效由 Canvas + WebAudio 合成，无外部资源
 * ============================================================ */
(function () {
  'use strict';

  /* ---------------- 基础常量与工具 ---------------- */
  var W = 1280;
  var H = 720;
  var CAR_Y = 556;
  var ROAD_HALF = 248;
  var VIEW_AHEAD = 1250;
  var M_PER_PX = 4;      // 世界像素 → 显示米数
  var KMH = 0.85;        // 世界像素/秒 → 显示 km/h

  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d', { alpha: false });
  var DPR = Math.min(2, window.devicePixelRatio || 1);

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function randInt(a, b) { return Math.floor(rand(a, b + 1)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function $(id) { return document.getElementById(id); }
  function pad(n, len) {
    var s = String(Math.max(0, Math.floor(n)));
    while (s.length < len) s = '0' + s;
    return s;
  }
  function hash(n) {
    var x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }
  function rgba(hex, a) {
    var h = String(hex).replace('#', '');
    if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
    var n = parseInt(h, 16);
    if (isNaN(n)) return 'rgba(255,255,255,' + a + ')';
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
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

  /* ---------------- 数据：路面 ---------------- */
  var SURFACES = [
    {
      id: 'asphalt', name: '沥青高架', tag: '均衡',
      grip: 1.0, speed: 1.0,
      note: '标准的城市高架：抓地稳、弯道好读，第一次跑就从这里开始。',
      colors: {
        terrain: '#1b120c', terrainFar: '#251811', terrainNear: '#100a07',
        road: '#2c221a', roadFar: '#3a2a20', roadNear: '#221a14',
        lane: '#e9c98d', edge: '#ffc25a', glow: '#ff9a2e',
        stripe1: '#cfa976', stripe2: '#7f3a1e',
        prop: '#33231a', accent: '#ffb03a'
      }
    },
    {
      id: 'sand', name: '赤沙公路', tag: '低抓地',
      grip: 0.8, speed: 0.96,
      note: '沙面咬不住胎：转向会往外滑，路肩也更黏，适合练反打方向。',
      colors: {
        terrain: '#2b1a0f', terrainFar: '#3a2413', terrainNear: '#1a0f08',
        road: '#6a4728', roadFar: '#7d5733', roadNear: '#5a3b21',
        lane: '#ffe2a8', edge: '#ffcf6a', glow: '#ff9a3c',
        stripe1: '#dcb98a', stripe2: '#74401f',
        prop: '#3d2715', accent: '#ffb75e'
      }
    },
    {
      id: 'snow', name: '霜峰雪道', tag: '最滑',
      grip: 0.66, speed: 0.94,
      note: '雪面像抹了油：车尾会飘出去，靠漂移反而更稳，也更容易叠加分。',
      colors: {
        terrain: '#182028', terrainFar: '#222b34', terrainNear: '#101820',
        road: '#3e4750', roadFar: '#4c5862', roadNear: '#333c45',
        lane: '#eaf6fa', edge: '#bfe9ff', glow: '#7fd8ff',
        stripe1: '#e8f6fb', stripe2: '#476270',
        prop: '#243039', accent: '#9fe6ff'
      }
    },
    {
      id: 'metal', name: '霓虹钢板', tag: '最强抓地',
      grip: 1.12, speed: 1.06,
      note: '赛道拼钢板，胎一咬就住：转向最灵、速度上限最高，适合冲纪录。',
      colors: {
        terrain: '#140d0f', terrainFar: '#1e1416', terrainNear: '#0c0708',
        road: '#261b1d', roadFar: '#332426', roadNear: '#1d1415',
        lane: '#7ef0c0', edge: '#3ef0c0', glow: '#3ef0c0',
        stripe1: '#8ff5cf', stripe2: '#1d3c37',
        prop: '#2a1a1d', accent: '#5fe0c0'
      }
    }
  ];

  /* ---------------- 数据：赛车 ---------------- */
  var CARS = [
    {
      id: 'gt', name: '疾风 GT', tag: '均衡', color: '#f0c070', accent: '#ff8a3c',
      speed: 1.0, accel: 1.0, grip: 1.0, armor: 3, drift: 1.0,
      desc: '起步就有好手感，容错最高。'
    },
    {
      id: 'v12', name: '闪电 V12', tag: '极速', color: '#7ef0d0', accent: '#3ef0c0',
      speed: 1.16, accel: 1.14, grip: 0.86, armor: 2, drift: 1.1,
      desc: '最快也最脆，靠躲不靠撞。'
    },
    {
      id: 't9', name: '铁壁 T-9', tag: '耐撞', color: '#d98c4a', accent: '#ffb03a',
      speed: 0.92, accel: 0.88, grip: 1.05, armor: 4, drift: 0.95,
      desc: '慢半拍，但能多扛一次撞击。'
    },
    {
      id: 'rx', name: '漂移王 RX', tag: '操控', color: '#ff6b74', accent: '#ff9aa2',
      speed: 0.98, accel: 0.94, grip: 1.28, armor: 3, drift: 1.5,
      desc: '转向最灵，漂移分数 1.5 倍。'
    }
  ];

  /* ---------------- 数据：赛段 ---------------- */
  var LEVELS = [
    { name: '热身赛', sub: 'NIGHT CITY · 城市霓虹', dist: 6000, weather: 'none', amp: 150, gap: 820, par: 10200,
      desc: '熟悉弯道、星币和氮气。' },
    { name: '逆风赛', sub: 'SANDSTORM · 赤沙风口', dist: 7000, weather: 'wind', amp: 168, gap: 760, par: 11300,
      desc: '侧风会把车推向路肩，记得反打方向。' },
    { name: '结霜赛', sub: 'FROST PASS · 霜峰山道', dist: 8000, weather: 'frost', amp: 178, gap: 710, par: 12400,
      desc: '路面结霜，冰斑会让车轮打滑。' },
    { name: '雨战', sub: 'RAIN OVERPASS · 雨夜高架', dist: 9000, weather: 'rain', amp: 176, gap: 670, par: 13500,
      desc: '雨幕压视野，水坑会拖慢车速。' },
    { name: '极速赛', sub: 'REDLINE · 限速解除', dist: 10000, weather: 'speed', amp: 188, gap: 610, par: 14600,
      desc: '限速解除，路更窄，卡车也更快。' },
    { name: '冠军赛', sub: 'CHAMPION · 终局追击', dist: 11000, weather: 'champion', amp: 200, gap: 560, par: 15700,
      desc: '全机制叠加，后方追兵还会抛油桶。' }
  ];

  /* ---------------- 存档 ---------------- */
  var SAVE_KEY = 'shutu.racing.v1';
  var save = { v: 1, best: {}, stars: {}, unlocked: 1, car: 'gt', surface: 'asphalt' };

  function loadSave() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      var obj = JSON.parse(raw);
      if (!obj || typeof obj !== 'object') return;
      save.best = obj.best && typeof obj.best === 'object' ? obj.best : {};
      save.stars = obj.stars && typeof obj.stars === 'object' ? obj.stars : {};
      save.unlocked = clamp(Number(obj.unlocked) || 1, 1, LEVELS.length);
      save.car = CARS.some(function (c) { return c.id === obj.car; }) ? obj.car : 'gt';
      save.surface = SURFACES.some(function (s) { return s.id === obj.surface; }) ? obj.surface : 'asphalt';
    } catch (e) {
      /* 隐私模式或损坏存档：退回默认 */
    }
  }

  function persist() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* ignore */ }
  }

  /* ---------------- 音效（WebAudio 合成） ---------------- */
  var SFX = {
    ac: null, master: null, engine: null, filter: null, engineGain: null,
    muted: false,

    init: function () {
      if (this.ac) {
        if (this.ac.state === 'suspended') { try { this.ac.resume(); } catch (e) {} }
        return;
      }
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      var ac = new AC();
      this.ac = ac;
      this.master = ac.createGain();
      this.master.gain.value = this.muted ? 0 : 0.9;
      this.master.connect(ac.destination);

      var osc = ac.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 62;
      var filt = ac.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = 420;
      filt.Q.value = 3;
      var gain = ac.createGain();
      gain.gain.value = 0;
      osc.connect(filt);
      filt.connect(gain);
      gain.connect(this.master);
      osc.start();
      this.engine = osc;
      this.filter = filt;
      this.engineGain = gain;
    },

    setEngine: function (speed, active) {
      if (!this.ac || !this.engine) return;
      var t = this.ac.currentTime;
      var f = 58 + Math.min(190, speed * 0.17);
      this.engine.frequency.setTargetAtTime(active ? f : 50, t, 0.09);
      this.filter.frequency.setTargetAtTime(active ? 420 + speed * 0.55 : 260, t, 0.09);
      this.engineGain.gain.setTargetAtTime(active ? 0.052 : 0, t, 0.06);
    },

    tone: function (freq, dur, type, vol, slideTo) {
      if (!this.ac || this.muted) return;
      var t = this.ac.currentTime;
      var osc = this.ac.createOscillator();
      var g = this.ac.createGain();
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t + dur);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol || 0.12, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t);
      osc.stop(t + dur + 0.03);
    },

    noise: function (dur, vol, freq) {
      if (!this.ac || this.muted) return;
      var ac = this.ac;
      var t = ac.currentTime;
      var len = Math.floor(ac.sampleRate * dur);
      var buf = ac.createBuffer(1, len, ac.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      var src = ac.createBufferSource();
      src.buffer = buf;
      var bp = ac.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = freq || 700;
      bp.Q.value = 1.2;
      var g = ac.createGain();
      g.gain.value = vol || 0.2;
      src.connect(bp);
      bp.connect(g);
      g.connect(this.master);
      src.start(t);
    },

    ui: function () { this.tone(520, 0.06, 'square', 0.07, 660); },
    coin: function () { this.tone(980, 0.09, 'square', 0.08, 1420); },
    star: function () { this.tone(1180, 0.14, 'triangle', 0.1, 1760); },
    near: function (n) { this.tone(360 + n * 40, 0.07, 'sawtooth', 0.07, 520 + n * 50); },
    crash: function () { this.noise(0.32, 0.3, 320); this.tone(120, 0.28, 'sawtooth', 0.16, 44); },
    shield: function () { this.tone(440, 0.24, 'triangle', 0.12, 880); },
    nitro: function () { this.noise(0.5, 0.22, 1600); this.tone(240, 0.5, 'sawtooth', 0.12, 900); },
    beep: function (high) { this.tone(high ? 880 : 520, 0.12, 'square', 0.1); },
    finish: function () {
      var list = [660, 880, 1100, 1320];
      for (var i = 0; i < list.length; i++) {
        (function (self, f, d) {
          setTimeout(function () { self.tone(f, 0.22, 'triangle', 0.12, f * 1.1); }, d);
        })(this, list[i], i * 110);
      }
    },
    fail: function () { this.tone(220, 0.4, 'sawtooth', 0.12, 90); }
  };

  /* ---------------- DOM ---------------- */
  var hud = $('hud');
  var hudScore = $('hudScore');
  var hudBest = $('hudBest');
  var hudCoins = $('hudCoins');
  var hudCombo = $('hudCombo');
  var hudComboNum = $('hudComboNum');
  var hudLevel = $('hudLevel');
  var hudDist = $('hudDist');
  var hudTime = $('hudTime');
  var levelFill = $('levelFill');
  var levelMark = $('levelMark');
  var hudSpeed = $('hudSpeed');
  var nitroFill = $('nitroFill');
  var nitroPct = $('nitroPct');
  var nitroHead = $('nitroHead');
  var heartsEl = $('hearts');
  var driftTag = $('driftTag');

  var menuOv = $('menuOv');
  var pauseOv = $('pauseOv');
  var resultOv = $('resultOv');
  var crashOv = $('crashOv');
  var cupOv = $('cupOv');

  var surfaceGrid = $('surfaceGrid');
  var surfaceNote = $('surfaceNote');
  var carList = $('carList');
  var levelList = $('levelList');
  var menuBest = $('menuBest');

  var soundBtn = $('soundBtn');
  var pauseBtn = $('pauseBtn');
  var startBtn = $('startBtn');
  var resumeBtn = $('resumeBtn');
  var pauseRestartBtn = $('pauseRestartBtn');
  var pauseMenuBtn = $('pauseMenuBtn');
  var nextBtn = $('nextBtn');
  var retryBtn = $('retryBtn');
  var resultMenuBtn = $('resultMenuBtn');
  var crashRetryBtn = $('crashRetryBtn');
  var crashMenuBtn = $('crashMenuBtn');
  var cupAgainBtn = $('cupAgainBtn');
  var cupMenuBtn = $('cupMenuBtn');
  var nitroBtn = $('nitroBtn');

  var MUTE_KEY = 'shutu.racing.mute.v1';
  var heartEls = [];

  function loadNumber(key, fallback) {
    try {
      var v = Number(localStorage.getItem(key));
      return isFinite(v) ? v : fallback;
    } catch (e) {
      return fallback;
    }
  }
  function saveNumber(key, value) {
    try { localStorage.setItem(key, String(value)); } catch (e) { /* ignore */ }
  }
  /* ---------------- 运行时状态 ---------------- */
  // 调试免伤：?god=1，仅用于检查关卡结算
  var GOD = /[?&]god=1/.test(location.search);

  var G = {
    mode: 'menu',
    levelIndex: 0,
    surface: 'asphalt',
    carId: 'gt',
    travelled: 0,
    totalPx: 1,
    phase: 1.2,
    amp: 150,
    carX: W / 2,
    carVX: 0,
    carAngle: 0,
    speed: 0,
    hearts: 3,
    maxHearts: 3,
    nitro: 0.25,
    nitroTime: 0,
    score: 0,
    coins: 0,
    nearCount: 0,
    combo: 0,
    comboTimer: 0,
    maxCombo: 0,
    driftScore: 0,
    driftTime: 0,
    drifting: false,
    iceT: 0,
    slowMul: 1,
    offRoad: false,
    invuln: 0,
    shield: 0,
    time: 0,
    clock: 0,
    countdown: 0,
    pointerX: null,
    pointerActive: false,
    shake: 0,
    flash: 0,
    entities: [],
    particles: [],
    floats: [],
    nextSpawn: 0,
    par: 1,
    manualPaused: false,
    gatePaused: false,
    breakPaused: false,
    banner: null,
    lastHud: {},
    chaseX: W / 2,
    chaseWarn: 0,
    finishBonus: 0,
    newBest: false
  };

  var keys = { left: false, right: false, up: false, down: false };
  var lastTs = performance.now();
  var gate = null;

  function level() { return LEVELS[G.levelIndex] || LEVELS[0]; }
  function surf() {
    for (var i = 0; i < SURFACES.length; i++) if (SURFACES[i].id === G.surface) return SURFACES[i];
    return SURFACES[0];
  }
  function car() {
    for (var i = 0; i < CARS.length; i++) if (CARS[i].id === G.carId) return CARS[i];
    return CARS[0];
  }

  /* ---------------- 菜单 ---------------- */
  function bar(label, value) {
    return '<div class="stat-pill"><span>' + label + '</span><i><b style="width:' +
      Math.round(clamp(value, 0.08, 1) * 100) + '%"></b></i></div>';
  }

  function starHtml(n) {
    var out = '';
    for (var i = 0; i < 3; i++) out += i < n ? '★' : '<span class="off">☆</span>';
    return out;
  }

  function buildMenu() {
    surfaceGrid.innerHTML = SURFACES.map(function (s) {
      return '<button type="button" class="surface-btn" data-id="' + s.id + '">' +
        '<span class="swatch sw-' + s.id + '"></span>' +
        '<span class="surface-name">' + s.name + '<i>' + s.tag + '</i></span>' +
        '<span class="surface-meta">抓地 ' + Math.round(s.grip * 100) + '% · 极速 ' +
        Math.round(s.speed * 100) + '%</span>' +
        '</button>';
    }).join('');

    carList.innerHTML = CARS.map(function (c) {
      return '<button type="button" class="car-btn" data-id="' + c.id + '">' +
        '<span class="car-dot" style="background:' + c.color + ';color:' + c.accent + '"></span>' +
        '<span class="car-name">' + c.name + '<i>' + c.tag + '</i></span>' +
        '<span class="car-tag">耐久 ' + c.armor + '</span>' +
        '<span class="car-stats">' +
        bar('极速', c.speed / 1.2) +
        bar('加速', c.accel / 1.2) +
        bar('操控', c.grip / 1.4) +
        bar('耐久', c.armor / 4) +
        '</span>' +
        '</button>';
    }).join('');

    renderLevelList();

    Array.prototype.forEach.call(surfaceGrid.querySelectorAll('.surface-btn'), function (btn) {
      btn.addEventListener('click', function () {
        G.surface = btn.getAttribute('data-id');
        SFX.ui();
        updateMenuUI();
      });
    });

    Array.prototype.forEach.call(carList.querySelectorAll('.car-btn'), function (btn) {
      btn.addEventListener('click', function () {
        G.carId = btn.getAttribute('data-id');
        SFX.ui();
        updateMenuUI();
      });
    });

    updateMenuUI();
  }

  /* 赛段列表会随着解锁状态变化，单独抽出来以便结算后重绘 */
  function renderLevelList() {
    levelList.innerHTML = LEVELS.map(function (lv, i) {
      var locked = i + 1 > save.unlocked;
      var stars = Number(save.stars[String(i + 1)]) || 0;
      return '<button type="button" class="level-row" data-index="' + i + '"' +
        (locked ? ' disabled' : '') + '>' +
        '<span class="level-no">' + pad(i + 1, 2) + '</span>' +
        '<span class="level-info"><b>' + lv.name + '</b>' +
        '<span>' + lv.sub + ' · ' + lv.dist + ' m</span></span>' +
        '<span class="level-stars">' + (locked ? '<span class="lock">🔒</span>' : starHtml(stars)) + '</span>' +
        '</button>';
    }).join('');

    Array.prototype.forEach.call(levelList.querySelectorAll('.level-row'), function (btn) {
      btn.addEventListener('click', function () {
        if (btn.disabled) return;
        G.levelIndex = Number(btn.getAttribute('data-index')) || 0;
        SFX.ui();
        updateMenuUI();
      });
    });
  }

  function updateMenuUI() {
    Array.prototype.forEach.call(surfaceGrid.querySelectorAll('.surface-btn'), function (btn) {
      btn.classList.toggle('is-on', btn.getAttribute('data-id') === G.surface);
    });
    Array.prototype.forEach.call(carList.querySelectorAll('.car-btn'), function (btn) {
      btn.classList.toggle('is-on', btn.getAttribute('data-id') === G.carId);
    });
    Array.prototype.forEach.call(levelList.querySelectorAll('.level-row'), function (btn) {
      btn.classList.toggle('is-on', Number(btn.getAttribute('data-index')) === G.levelIndex);
    });

    var s = surf();
    surfaceNote.textContent = s.note;

    var c = car();
    var total = 0;
    Object.keys(save.best).forEach(function (k) { total += Number(save.best[k]) || 0; });
    menuBest.textContent = String(Math.floor(total));

    var lv = level();
    startBtn.innerHTML = '<span>开 赛</span><em>' + pad(G.levelIndex + 1, 2) + ' · ' + lv.name + '</em>';

    save.surface = G.surface;
    save.car = G.carId;
    persist();
  }

  /* ---------------- 关卡流程 ---------------- */
  function hideOverlays() {
    menuOv.hidden = true;
    pauseOv.hidden = true;
    resultOv.hidden = true;
    crashOv.hidden = true;
    cupOv.hidden = true;
  }

  function startLevel(index) {
    if (window.GameLimit) {
      var st = window.GameLimit.status('racing');
      if (st && st.locked) return;
    }
    G.levelIndex = clamp(Number(index) || 0, 0, LEVELS.length - 1);
    hideOverlays();
    resetLevel();
    hud.classList.add('is-live');
    hud.setAttribute('aria-hidden', 'false');
    G.mode = 'countdown';
    G.countdown = 3.7;
    ensureGate();
    SFX.init();
    SFX.setEngine(0, true);
    showBanner(level().name, level().sub);
    lastTs = performance.now();

    // 调试：?warp=秒数 直接推进赛道，方便检查障碍、道具与结算
    var warpMatch = /[?&]warp=(\d+(?:\.\d+)?)/.exec(location.search);
    if (warpMatch) {
      G.countdown = 0;
      G.mode = 'playing';
      var steps = Math.min(24000, Math.round(Number(warpMatch[1]) * 60));
      for (var wi = 0; wi < steps && G.mode === 'playing'; wi++) update(1 / 60);
      lastTs = performance.now();
    }
  }

  function resetLevel() {
    var lv = level();
    var c = car();
    G.travelled = 0;
    G.totalPx = lv.dist * M_PER_PX;
    G.phase = rand(0, Math.PI * 2);
    G.amp = lv.amp;
    G.carX = curveAt(0);
    G.carVX = 0;
    G.carAngle = 0;
    G.speed = 0;
    G.maxHearts = c.armor;
    G.hearts = c.armor;
    G.nitro = 0.25;
    G.nitroTime = 0;
    G.score = 0;
    G.coins = 0;
    G.nearCount = 0;
    G.combo = 0;
    G.comboTimer = 0;
    G.maxCombo = 0;
    G.driftScore = 0;
    G.driftTime = 0;
    G.drifting = false;
    G.iceT = 0;
    G.slowMul = 1;
    G.offRoad = false;
    G.invuln = 0;
    G.shield = 0;
    G.time = 0;
    G.countdown = 0;
    G.shake = 0;
    G.flash = 0;
    G.entities = [];
    G.particles = [];
    G.floats = [];
    G.nextSpawn = 1000;
    G.par = lv.par;
    G.pointerX = null;
    G.pointerActive = false;
    G.manualPaused = false;
    G.gatePaused = false;
    G.breakPaused = false;
    G.banner = null;
    G.chaseX = W / 2;
    G.chaseWarn = 0;
    G.halfShown = false;
    G.lastCount = null;
    G.finishBonus = 0;
    G.newBest = false;
    G.lastHud = {};
    keys.left = keys.right = keys.up = keys.down = false;
    buildHearts();
    paintHearts();
    initWeather();
    syncHUD(true);
  }

  function backToMenu() {
    G.mode = 'menu';
    hideOverlays();
    menuOv.hidden = false;
    hud.classList.remove('is-live');
    hud.setAttribute('aria-hidden', 'true');
    SFX.setEngine(0, false);
    G.amp = LEVELS[0].amp;
    G.travelled = 0;
    G.carVX = 0;
    G.carAngle = 0;
    renderLevelList();
    updateMenuUI();
    lastTs = performance.now();
  }

  function finishLevel() {
    if (G.mode !== 'playing') return;
    G.mode = 'result';
    SFX.setEngine(0, false);
    SFX.finish();

    G.finishBonus = 1000 + G.hearts * 250;
    G.score += G.finishBonus;

    var stars = 1;
    if (G.score >= G.par) stars = 2;
    if (G.score >= G.par * 1.15) stars = 3;

    var key = String(G.levelIndex + 1);
    var oldBest = Number(save.best[key]) || 0;
    G.newBest = Math.floor(G.score) > oldBest;
    save.best[key] = Math.max(oldBest, Math.floor(G.score));
    save.stars[key] = Math.max(Number(save.stars[key]) || 0, stars);
    save.unlocked = Math.max(save.unlocked, Math.min(LEVELS.length, G.levelIndex + 2));
    persist();
    renderLevelList();
    updateMenuUI();

    if (window.GameLimit) {
      try { window.GameLimit.count('racing'); } catch (e) { /* 存档异常不影响游戏 */ }
    }

    showResult(stars);
  }

  function showResult(stars) {
    var lv = level();
    $('resultKicker').textContent = 'STAGE ' + pad(G.levelIndex + 1, 2) + ' CLEAR';
    $('resultTitle').textContent = lv.name + ' 完成';
    $('resScore').textContent = Math.floor(G.score).toLocaleString('en-US');
    $('resTime').textContent = G.time.toFixed(1) + 's';
    $('resCoins').textContent = String(G.coins);
    $('resCombo').textContent = '×' + (G.maxCombo || 0);
    $('starNote').textContent = '2★ ' + G.par + ' 分 · 3★ ' + Math.round(G.par * 1.15) + ' 分';

    var starEls = $('resultStars').querySelectorAll('span');
    Array.prototype.forEach.call(starEls, function (el, i) {
      el.classList.remove('on');
      if (i < stars) {
        setTimeout(function () { el.classList.add('on'); }, 80 + i * 110);
      }
    });

    var record = $('resRecord');
    record.hidden = !G.newBest;
    record.textContent = '✦ 刷新了本关最佳';

    var hint = $('resHint');
    if (stars >= 3) {
      hint.innerHTML = '三星达成，可以换更快的车去冲纪录了。';
    } else if (stars === 2) {
      hint.innerHTML = '再贴车擦身几次、多跑一段漂移，就能摸到 <b>3★</b>。';
    } else {
      hint.innerHTML = '完成即 1★；想拿 <b>2★</b> 就多收集星币、少撞车。';
    }

    $('nextBtn').innerHTML = G.levelIndex + 1 < LEVELS.length
      ? '<span>下一关</span><em>ENTER</em>'
      : '<span>查看总成绩</span><em>ENTER</em>';

    resultOv.hidden = false;
    syncHUD(true);
  }

  function crashLevel() {
    if (G.mode !== 'playing') return;
    G.mode = 'crash';
    SFX.setEngine(0, false);
    SFX.fail();
    $('crashText').textContent = '「' + level().name + '」跑到 ' +
      Math.floor(G.travelled / M_PER_PX) + ' 米时耐久耗尽。换个更耐撞的车，或者先降速避开卡车。';
    $('crashDist').textContent = Math.floor(G.travelled / M_PER_PX) + ' m';
    $('crashScore').textContent = Math.floor(G.score).toLocaleString('en-US');
    $('crashCoins').textContent = String(G.coins);
    $('crashCombo').textContent = '×' + (G.maxCombo || 0);
    crashOv.hidden = false;
  }

  function showCup() {
    var totalStars = 0;
    var totalScore = 0;
    var bestOne = 0;
    Object.keys(save.stars).forEach(function (k) { totalStars += Number(save.stars[k]) || 0; });
    Object.keys(save.best).forEach(function (k) {
      var v = Number(save.best[k]) || 0;
      totalScore += v;
      if (v > bestOne) bestOne = v;
    });
    $('cupStarCount').textContent = totalStars + ' / ' + (LEVELS.length * 3);
    $('cupScore').textContent = Math.floor(totalScore).toLocaleString('en-US');
    $('cupBest').textContent = Math.floor(bestOne).toLocaleString('en-US');
    $('cupCar').textContent = car().name;
    $('cupNote').textContent = totalStars >= LEVELS.length * 3 ? '满星通关，霓虹之王' : '六个赛段全部通过，还可以回去刷满星';
    var el = $('cupStars').querySelectorAll('span');
    var lit = totalStars >= 12 ? 3 : totalStars >= 6 ? 2 : 1;
    Array.prototype.forEach.call(el, function (s, i) {
      s.classList.toggle('on', i < lit);
    });
    cupOv.hidden = false;
  }

  /* ---------------- 弯道与投影 ---------------- */
  function curveAt(d) {
    var ph = G.phase;
    return W / 2 +
      Math.sin(d / 2700 + ph) * G.amp +
      Math.sin(d / 980 + ph * 1.7) * G.amp * 0.28 +
      Math.sin(d / 5200 + ph * 0.6) * G.amp * 0.55;
  }

  function proj(d) {
    var delta = d - G.travelled;
    var y, s;
    if (delta >= 0) {
      y = CAR_Y - (delta * 0.62) / (1 + delta / 3000);
      s = 1 / (1 + delta / 2600);
    } else {
      y = CAR_Y - delta * 0.62;
      s = 1;
    }
    return { y: y, s: s, delta: delta };
  }

  function laneOff(i) { return [-186, -62, 62, 186][i]; }
  function randLane() { return randInt(0, 3); }

  /* ---------------- 实体 ---------------- */
  var KINDS = {
    cone: { w: 38, h: 44, damage: 1 },
    barrel: { w: 46, h: 54, damage: 1 },
    barrier: { w: 190, h: 38, damage: 1 },
    truck: { w: 116, h: 150, damage: 1, vs: 150 },
    rock: { w: 76, h: 64, damage: 1 },
    snow: { w: 104, h: 48, damage: 0, slow: 0.5 },
    puddle: { w: 150, h: 96, damage: 0, slow: 0.34, slip: 1 },
    ice: { w: 150, h: 100, damage: 0, slip: 1 },
    boost: { w: 84, h: 64, damage: 0, pad: 1 },
    coin: { w: 26, h: 26, damage: 0 },
    nitro: { w: 34, h: 44, damage: 0 },
    heart: { w: 30, h: 30, damage: 0 },
    shield: { w: 34, h: 34, damage: 0 },
    gate: { w: 110, h: 60, damage: 0, gate: 1 }
  };

  function addEntity(kind, d, off) {
    var def = KINDS[kind];
    if (!def) return;
    G.entities.push({
      kind: kind, d: d, off: off, w: def.w, h: def.h,
      vs: def.vs || 0, dead: false, passed: false, hitDone: false,
      seed: rand(0, 10), sy: 0, ss: 1
    });
  }

  function coinChain(d) {
    var lane = randLane();
    var n = randInt(4, 7);
    for (var i = 0; i < n; i++) {
      var off = laneOff(lane) + Math.sin(i / Math.max(1, n - 1) * Math.PI) * 34 * (i % 2 === 0 ? 1 : -1);
      addEntity('coin', d + i * 62, off);
    }
  }

  function powerup(d) {
    var r = Math.random();
    var kind = r < 0.5 ? 'nitro' : r < 0.82 ? 'heart' : 'shield';
    addEntity(kind, d, laneOff(randLane()));
  }

  function pickObstacleKind() {
    var w = level().weather;
    var r = Math.random();
    if (w === 'wind') {
      if (r < 0.22) return 'rock';
      if (r < 0.45) return 'barrel';
      if (r < 0.72) return 'cone';
      return 'barrier';
    }
    if (w === 'frost') {
      if (r < 0.2) return 'ice';
      if (r < 0.4) return 'snow';
      if (r < 0.7) return 'cone';
      return 'barrier';
    }
    if (w === 'rain') {
      if (r < 0.22) return 'puddle';
      if (r < 0.55) return 'cone';
      if (r < 0.82) return 'barrel';
      return 'barrier';
    }
    if (w === 'speed') {
      if (r < 0.3) return 'truck';
      if (r < 0.57) return 'cone';
      if (r < 0.82) return 'barrel';
      return 'barrier';
    }
    if (w === 'champion') {
      if (r < 0.16) return 'truck';
      if (r < 0.34) return 'puddle';
      if (r < 0.55) return 'barrel';
      if (r < 0.76) return 'cone';
      return 'barrier';
    }
    if (r < 0.16) return 'truck';
    if (r < 0.46) return 'cone';
    if (r < 0.76) return 'barrel';
    return 'barrier';
  }

  function spawnPattern(d) {
    var r = Math.random();
    if (r < 0.2) { coinChain(d); return; }
    if (r < 0.26) { powerup(d + 60); return; }
    if (r < 0.33) { addEntity('boost', d, laneOff(randLane())); return; }
    if (r < 0.37 && d > 1200) { addEntity('gate', d, laneOff(randLane())); return; }

    var diff = clamp(0.25 + G.levelIndex * 0.11, 0.25, 0.9);
    var lanes = [0, 1, 2, 3];
    for (var i = lanes.length - 1; i > 0; i--) {
      var j = randInt(0, i);
      var t = lanes[i]; lanes[i] = lanes[j]; lanes[j] = t;
    }

    var count = 1;
    if (Math.random() < diff) count++;
    if (Math.random() < diff * 0.55) count++;
    count = Math.min(count, 3);

    for (var k = 0; k < count; k++) {
      var lane = lanes[k];
      var kind = pickObstacleKind();
      addEntity(kind, d + rand(-22, 22), laneOff(lane) + rand(-8, 8));
    }
  }

  function spawnAhead() {
    var limit = G.travelled + VIEW_AHEAD;
    while (G.nextSpawn < limit && G.nextSpawn < G.totalPx - 320) {
      spawnPattern(G.nextSpawn);
      G.nextSpawn += level().gap * rand(0.8, 1.2);
    }
  }

  /* ---------------- 更新 ---------------- */
  function isPaused() {
    return G.manualPaused || G.gatePaused || G.breakPaused;
  }

  function updateSpeed(dt) {
    var lv = level();
    var c = car();
    var s = surf();
    var base = 600 * c.speed * s.speed * (1 + G.levelIndex * 0.035);
    if (lv.weather === 'speed') base *= 1.06;
    if (G.nitroTime > 0) base *= 1.3;

    var target = keys.down ? base * 0.42 : (keys.up ? base : base * 0.9);
    if (G.offRoad) target *= 0.62;
    target *= G.slowMul;

    var rate = target > G.speed ? 1.9 : 2.8;
    G.speed += (target - G.speed) * Math.min(1, dt * rate);
    G.speed = Math.max(0, G.speed);
  }

  function updateSteer(dt) {
    var c = car();
    var s = surf();
    var off = Math.abs(G.carX - curveAt(G.travelled));
    G.offRoad = off > ROAD_HALF - 26;

    var grip = s.grip * c.grip * (G.offRoad ? 0.52 : 1) * (G.iceT > 0 ? 0.55 : 1);
    grip = clamp(grip, 0.3, 1.6);

    if (G.pointerActive && G.pointerX != null) {
      var want = clamp((G.pointerX - G.carX) * 5.4, -470, 470);
      G.carVX = lerp(G.carVX, want, Math.min(1, dt * 7.5));
    } else {
      var steer = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      G.carVX += steer * 780 * grip * dt;
      G.carVX *= Math.pow(G.offRoad ? 0.5 : 0.19, dt);
    }

    G.carVX = clamp(G.carVX, -520, 520);
    G.carX += G.carVX * dt;

    var maxOff = ROAD_HALF + 12;
    var center = curveAt(G.travelled);
    if (G.carX < center - maxOff) { G.carX = center - maxOff; G.carVX = Math.max(0, G.carVX * 0.4); }
    if (G.carX > center + maxOff) { G.carX = center + maxOff; G.carVX = Math.min(0, G.carVX * 0.4); }

    G.carAngle = clamp(G.carVX / 470, -1, 1) * 0.34;

    G.drifting = Math.abs(G.carVX) > 165 && !G.offRoad && G.speed > 280;
    if (G.drifting) {
      G.driftTime += dt;
      G.driftScore += 20 * c.drift * dt * (G.speed / 600);
      G.nitro = Math.min(1, G.nitro + 0.05 * dt);
      if (Math.random() < dt * 26) {
        addParticle(G.carX + (G.carVX > 0 ? -22 : 22) + rand(-6, 6), CAR_Y + 34,
          rand(-40, 40) - G.carVX * 0.12, rand(20, 60), rand(0.25, 0.6),
          rand(4, 10), 'smoke', 'rgba(228,214,196,0.32)');
      }
    }

    if (G.offRoad && G.speed > 120 && Math.random() < dt * 40) {
      addParticle(G.carX + rand(-24, 24), CAR_Y + 40, -G.carVX * 0.2 + rand(-30, 30),
        rand(30, 80), rand(0.3, 0.7), rand(3, 8), 'dust', 'rgba(190,160,120,0.4)');
    }
  }

  function updateEntities(dt) {
    var pickupReach = 36;
    G.iceT = 0;
    var slowTarget = 1;

    for (var i = G.entities.length - 1; i >= 0; i--) {
      var e = G.entities[i];
      if (e.dead) { G.entities.splice(i, 1); continue; }
      if (e.vs) e.d += e.vs * dt;

      var p = proj(e.d);
      e.sy = p.y;
      e.ss = p.s;
      if (p.y > H + 140) { G.entities.splice(i, 1); continue; }
      if (p.y < -260) continue;

      var center = curveAt(e.d);
      var ex = center + e.off * p.s;
      var dy = Math.abs(p.y - CAR_Y);
      var scaledH = e.h * p.s;

      if (e.kind === 'coin' || e.kind === 'nitro' || e.kind === 'heart' || e.kind === 'shield') {
        if (dy < scaledH * 0.5 + 46 && Math.abs(ex - G.carX) < pickupReach) {
          collect(e);
          continue;
        }
        continue;
      }

      if (e.kind === 'boost') {
        if (dy < scaledH * 0.55 + 30 && Math.abs(ex - G.carX) < e.w * p.s * 0.5) {
          G.speed = Math.min(G.speed * 1.26 + 60, 1200);
          G.nitro = Math.min(1, G.nitro + 0.1);
          G.score += 80;
          boom(ex, p.y, '#ffb03a', 12);
          addFloat(ex, p.y - 20, '加速带 +80', '#ffd48a');
          SFX.star();
          e.dead = true;
          continue;
        }
        continue;
      }

      if (e.kind === 'gate') {
        var through = Math.abs(ex - G.carX) < e.w * 0.5 * p.s * 0.6;
        if (!e.passed && p.y > CAR_Y - 40) {
          e.passed = true;
          if (through) {
            G.score += 150;
            G.nitro = Math.min(1, G.nitro + 0.14);
            addFloat(ex, p.y - 30, '星门 +150', '#ffd48a');
            boom(ex, p.y, '#ffb03a', 10);
            SFX.star();
          } else {
            SFX.tone(260, 0.1, 'triangle', 0.05, 200);
          }
        }
        continue;
      }

      // 障碍与路面危险
      if (dy < scaledH * 0.5 + 46) {
        var gapX = Math.abs(ex - G.carX);
        var hitW = e.w * 0.5 * p.s + 24;

        if (e.kind === 'puddle') {
          if (gapX < hitW && !e.hitDone) {
            e.hitDone = true;
            G.speed *= 0.82;
            slowTarget = Math.min(slowTarget, KINDS[e.kind].slow || 0.8);
            splash(ex, p.y);
            addFloat(ex, p.y - 20, '积水 · 打滑', '#bfe9ff');
            SFX.noise(0.18, 0.12, 900);
          }
        } else if (e.kind === 'ice') {
          if (gapX < hitW) {
            G.iceT = Math.max(G.iceT, 0.6);
            if (!e.hitDone) {
              e.hitDone = true;
              addFloat(ex, p.y - 20, '冰面 · 抓地下降', '#bfe9ff');
              SFX.tone(420, 0.16, 'sine', 0.07, 320);
            }
          }
        } else if (e.kind === 'snow') {
          if (gapX < hitW && !e.hitDone) {
            e.hitDone = true;
            G.speed *= 0.72;
            slowTarget = Math.min(slowTarget, KINDS[e.kind].slow || 0.7);
            snowPuff(ex, p.y);
            addFloat(ex, p.y - 20, '雪堆 · 减速', '#eaf6fa');
            SFX.noise(0.2, 0.12, 500);
          }
        } else if (gapX < hitW && !e.hitDone) {
          hitObstacle(e, ex, p.y);
          continue;
        }
      }

      if (!e.passed && p.y > CAR_Y + 50) {
        e.passed = true;
        if (!e.hitDone && e.damage !== 0) {
          var nearGap = Math.abs(ex - G.carX) - e.w * 0.5 * p.s;
          if (nearGap > -10 && nearGap < 46) addCombo(ex, p.y);
        }
      }
    }

    G.slowMul = slowTarget < G.slowMul
      ? slowTarget
      : Math.min(1, G.slowMul + dt * 0.55);
    G.iceT = Math.max(0, G.iceT - dt);
  }

  function collect(e) {
    e.dead = true;
    if (e.kind === 'coin') {
      G.coins++;
      G.score += 35;
      G.nitro = Math.min(1, G.nitro + 0.035);
      addFloat(e.off ? curveAt(e.d) + e.off * e.ss : G.carX, e.sy - 16, '+35', '#ffd48a');
      coinSpark(e);
      SFX.coin();
    } else if (e.kind === 'nitro') {
      G.nitro = Math.min(1, G.nitro + 0.45);
      addFloat(curveAt(e.d) + e.off * e.ss, e.sy - 16, '氮气 +45%', '#7ef0d0');
      boom(curveAt(e.d) + e.off * e.ss, e.sy, '#5fe0c0', 10);
      SFX.star();
    } else if (e.kind === 'heart') {
      if (G.hearts < G.maxHearts) G.hearts++;
      paintHearts();
      addFloat(curveAt(e.d) + e.off * e.ss, e.sy - 16, '耐久 +1', '#ff9aa2');
      boom(curveAt(e.d) + e.off * e.ss, e.sy, '#ff6b74', 10);
      SFX.star();
    } else if (e.kind === 'shield') {
      G.shield = 7;
      addFloat(curveAt(e.d) + e.off * e.ss, e.sy - 16, '护盾 7 秒', '#9fe6ff');
      boom(curveAt(e.d) + e.off * e.ss, e.sy, '#bfe9ff', 12);
      SFX.shield();
    }
  }

  function addCombo(x, y) {
    G.combo = Math.min(9, G.combo + 1);
    G.comboTimer = 3.2;
    G.nearCount++;
    G.maxCombo = Math.max(G.maxCombo, G.combo);
    var mult = 1 + G.combo * 0.35;
    var gain = Math.round(30 * mult);
    G.score += gain;
    G.nitro = Math.min(1, G.nitro + 0.06);
    addFloat(x, y - 24, '擦身 +' + gain, '#fff0cf');
    addFloat(x, y - 52, '×' + G.combo, '#ffb03a');
    SFX.near(G.combo);
  }

  function hitObstacle(e, ex, y) {
    e.hitDone = true;

    if (GOD) {
      e.dead = true;
      boom(ex, y, '#ffd48a', 10);
      return;
    }

    if (G.nitroTime > 0) {
      e.dead = true;
      boom(ex, y, '#ffd48a', 16);
      addFloat(ex, y - 20, '氮气撞碎', '#ffd48a');
      G.score += 20;
      SFX.crash();
      return;
    }
    if (G.invuln > 0) {
      e.dead = true;
      boom(ex, y, '#ffd48a', 8);
      return;
    }
    if (G.shield > 0) {
      G.shield = 0;
      e.dead = true;
      boom(ex, y, '#9fe6ff', 18);
      addFloat(ex, y - 20, '护盾挡下', '#bfe9ff');
      SFX.shield();
      G.shake = 8;
      return;
    }

    e.dead = true;
    G.hearts--;
    G.combo = 0;
    G.comboTimer = 0;
    G.speed *= 0.5;
    G.invuln = 1.25;
    G.shake = 14;
    G.flash = 0.55;
    paintHearts();
    boom(ex, y, '#ff8a66', 20);
    addFloat(ex, y - 24, '撞击！', '#ff9c8c');
    SFX.crash();

    if (G.hearts <= 0) {
      G.hearts = 0;
      crashLevel();
    }
  }

  function update(dt) {
    if (G.mode !== 'playing') return;
    G.time += dt;

    updateSpeed(dt);
    var adv = G.speed * dt;
    G.travelled += adv;
    G.score += adv / M_PER_PX;

    updateSteer(dt);

    var w = level().weather;
    if (w === 'wind' || w === 'champion') {
      var gust = Math.sin(G.time * 0.85) * 62 + Math.sin(G.time * 2.4) * 26;
      G.carX += gust * dt * (w === 'champion' ? 1.35 : 1);
    }

    spawnAhead();
    updateEntities(dt);

    if (G.comboTimer > 0) {
      G.comboTimer -= dt;
      if (G.comboTimer <= 0) {
        G.combo = 0;
        G.comboTimer = 0;
      }
    }

    if (G.nitroTime > 0) {
      G.nitroTime -= dt;
      if (G.nitroTime <= 0) {
        G.nitroTime = 0;
        G.nitro = 0;
      }
      if (Math.random() < dt * 60) {
        addParticle(G.carX + rand(-14, 14), CAR_Y + 48, rand(-30, 30), rand(80, 200),
          rand(0.12, 0.3), rand(3, 7), 'flame', 'rgba(255,176,58,0.8)');
      }
    }

    if (G.invuln > 0) G.invuln -= dt;
    if (G.shield > 0) G.shield -= dt;
    if (G.flash > 0) G.flash -= dt * 2;
    if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 60);

    // 冠军赛：后方追兵抛油桶
    if (w === 'champion') {
      G.chaseX = lerp(G.chaseX, G.carX, Math.min(1, dt * 2.2));
      if (Math.random() < dt * 0.22 && G.travelled > 800) {
        addEntity('barrel', G.travelled + 260, G.carX - curveAt(G.travelled + 260));
        G.chaseWarn = 1.4;
        addFloat(G.carX, CAR_Y - 120, '后方追击 · 油桶！', '#ff9c8c');
        SFX.tone(180, 0.22, 'sawtooth', 0.1, 120);
      }
    }
    if (G.chaseWarn > 0) G.chaseWarn -= dt;

    if (G.travelled >= G.totalPx * 0.5 && !G.halfShown) {
      G.halfShown = true;
      showBanner('最后冲刺', '赛程过半 · 终点就在前面', 1.8);
    }

    if (gate) gate.tick(dt);

    syncHUD();

    if (G.travelled >= G.totalPx) finishLevel();
  }
  /* ---------------- 特效对象 ---------------- */
  function addParticle(x, y, vx, vy, life, size, kind, color) {
    if (G.particles.length > 220) G.particles.shift();
    G.particles.push({
      x: x, y: y, vx: vx, vy: vy, life: life, max: life,
      size: size, kind: kind, color: color
    });
  }

  function boom(x, y, color, n) {
    for (var i = 0; i < n; i++) {
      var a = rand(0, Math.PI * 2);
      var sp = rand(60, 260);
      addParticle(x, y, Math.cos(a) * sp, Math.sin(a) * sp,
        rand(0.2, 0.55), rand(2, 5), 'spark', color);
    }
  }

  function splash(x, y) {
    for (var i = 0; i < 12; i++) {
      addParticle(x + rand(-50, 50), y + rand(-10, 10), rand(-90, 90), rand(-140, -40),
        rand(0.25, 0.6), rand(2, 5), 'spark', 'rgba(190,236,255,0.75)');
    }
  }

  function snowPuff(x, y) {
    for (var i = 0; i < 10; i++) {
      addParticle(x + rand(-40, 40), y + rand(-8, 8), rand(-70, 70), rand(-100, -20),
        rand(0.3, 0.7), rand(3, 7), 'smoke', 'rgba(234,246,250,0.4)');
    }
  }

  function coinSpark(e) {
    var x = curveAt(e.d) + e.off * e.ss;
    for (var i = 0; i < 6; i++) {
      var a = rand(0, Math.PI * 2);
      addParticle(x, e.sy, Math.cos(a) * rand(30, 90), Math.sin(a) * rand(30, 90),
        rand(0.2, 0.4), rand(2, 4), 'spark', '#ffd48a');
    }
  }

  function addFloat(x, y, text, color) {
    G.floats.push({ x: x, y: y, text: text, color: color || '#fff3d6', life: 1.1, max: 1.1 });
    if (G.floats.length > 30) G.floats.shift();
  }

  function updateParticles(dt) {
    for (var i = G.particles.length - 1; i >= 0; i--) {
      var p = G.particles[i];
      p.life -= dt;
      if (p.life <= 0) { G.particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'smoke') {
        p.vy -= 30 * dt;
        p.size += 8 * dt;
      } else if (p.kind === 'spark') {
        p.vy += 80 * dt;
        p.vx *= 0.985;
      }
    }
  }

  function updateFloats(dt) {
    for (var i = G.floats.length - 1; i >= 0; i--) {
      var f = G.floats[i];
      f.life -= dt;
      f.y -= 54 * dt;
      if (f.life <= 0) G.floats.splice(i, 1);
    }
  }

  function initWeather() {
    G.weather = level().weather;
  }

  /* ---------------- 视觉：地形与路侧 ---------------- */
  function drawTerrain() {
    var c = surf().colors;
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, c.terrainFar);
    g.addColorStop(0.55, c.terrain);
    g.addColorStop(1, c.terrainNear);
    ctx.fillStyle = g;
    ctx.fillRect(-60, -60, W + 120, H + 120);

    // 两侧地面流光，用来传递速度感
    ctx.save();
    ctx.globalAlpha = 0.09;
    ctx.strokeStyle = c.accent;
    ctx.lineWidth = 1.4;
    var span = 150;
    var offset = (G.travelled * 0.55) % span;
    for (var i = -1; i < 10; i++) {
      var y = i * span - offset;
      if (y < -30 || y > H + 30) continue;
      var len = 44 + clamp(G.speed * 0.12, 0, 60);
      ctx.beginPath();
      ctx.moveTo(0, y); ctx.lineTo(len, y);
      ctx.moveTo(W, y + span / 2); ctx.lineTo(W - len, y + span / 2);
      ctx.stroke();
    }
    ctx.restore();

    // 路面外侧压暗
    var side = ctx.createLinearGradient(0, 0, W, 0);
    side.addColorStop(0, 'rgba(0,0,0,0.34)');
    side.addColorStop(0.24, 'rgba(0,0,0,0)');
    side.addColorStop(0.76, 'rgba(0,0,0,0)');
    side.addColorStop(1, 'rgba(0,0,0,0.34)');
    ctx.fillStyle = side;
    ctx.fillRect(0, 0, W, H);
  }

  function drawProps() {
    var c = surf().colors;
    var items = [];
    var step = 138;
    var fromK = Math.ceil((G.travelled - 140) / step);
    var toK = Math.ceil((G.travelled + VIEW_AHEAD) / step);

    for (var k = fromK; k <= toK; k++) {
      var d = k * step;
      var p = proj(d);
      if (p.y < -110 || p.y > H + 110) continue;
      for (var side = -1; side <= 1; side += 2) {
        var h1 = hash(k * 2.7 + (side > 0 ? 11 : 3));
        var h2 = hash(k * 5.1 + (side > 0 ? 7 : 19));
        var type = h1 < 0.34 ? 'lamp' : h1 < 0.58 ? 'tower' : h1 < 0.84 ? 'board' : 'tree';
        var off = ROAD_HALF + 38 + h2 * 160;
        items.push({
          x: curveAt(d) + side * off * p.s,
          y: p.y,
          s: p.s,
          type: type,
          seed: h1,
          side: side
        });
      }
    }

    items.sort(function (a, b) { return a.y - b.y; });

    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var s = it.s;
      ctx.save();
      ctx.translate(it.x, it.y);
      ctx.scale(s, s);

      if (it.type === 'lamp') {
        ctx.fillStyle = c.prop;
        ctx.fillRect(-2, -74, 4, 74);
        var lg = ctx.createRadialGradient(0, -78, 1, 0, -78, 20);
        lg.addColorStop(0, rgba(c.accent, 0.85));
        lg.addColorStop(1, rgba(c.accent, 0));
        ctx.fillStyle = lg;
        ctx.beginPath();
        ctx.arc(0, -78, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = rgba(c.accent, 0.85);
        ctx.beginPath();
        ctx.arc(0, -78, 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (it.type === 'tower') {
        var hgt = 60 + it.seed * 90;
        ctx.fillStyle = c.prop;
        ctx.fillRect(-22, -hgt, 44, hgt);
        ctx.fillStyle = rgba(c.accent, 0.22);
        for (var wy = -hgt + 8; wy < -8; wy += 12) {
          for (var wx = -14; wx <= 8; wx += 12) {
            if (hash(it.seed * 31 + wy + wx) > 0.55) ctx.fillRect(wx, wy, 5, 4);
          }
        }
      } else if (it.type === 'board') {
        ctx.fillStyle = '#1d140f';
        ctx.fillRect(-2, -44, 4, 44);
        var bw = 52;
        var bh = 32;
        ctx.fillStyle = rgba(c.accent, 0.16);
        ctx.fillRect(-bw / 2, -78, bw, bh);
        ctx.strokeStyle = rgba(c.accent, 0.55);
        ctx.lineWidth = 1.6;
        ctx.strokeRect(-bw / 2, -78, bw, bh);
        ctx.fillStyle = rgba(c.accent, 0.75);
        ctx.fillRect(-bw / 2 + 6, -70, bw * (0.28 + it.seed * 0.4), 3);
        ctx.fillRect(-bw / 2 + 6, -61, bw * (0.2 + it.seed * 0.3), 2);
      } else {
        ctx.fillStyle = c.prop;
        ctx.beginPath();
        ctx.moveTo(0, -46);
        ctx.quadraticCurveTo(-26, -24, -12, 0);
        ctx.lineTo(12, 0);
        ctx.quadraticCurveTo(26, -24, 0, -46);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = rgba(c.accent, 0.3);
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(0, -4); ctx.lineTo(0, -40);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  /* ---------------- 视觉：公路 ---------------- */
  function drawRoad() {
    var c = surf().colors;
    var left = [];
    var right = [];
    var d, p, hw, cx;
    for (var delta = -140; delta <= VIEW_AHEAD; delta += 10) {
      d = G.travelled + delta;
      p = proj(d);
      cx = curveAt(d);
      hw = ROAD_HALF * p.s;
      left.push({ x: cx - hw, y: p.y });
      right.push({ x: cx + hw, y: p.y });
    }

    // 路肩暗影
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.moveTo(left[0].x - 16, left[0].y);
    for (var i = 1; i < left.length; i++) ctx.lineTo(left[i].x - 16 * (i < 10 ? 1 : 0.7), left[i].y);
    ctx.lineTo(left[left.length - 1].x, left[left.length - 1].y);
    for (var j = left.length - 1; j >= 0; j--) ctx.lineTo(left[j].x, left[j].y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 路面
    ctx.beginPath();
    ctx.moveTo(left[0].x, left[0].y);
    for (var k = 1; k < left.length; k++) ctx.lineTo(left[k].x, left[k].y);
    for (var m = right.length - 1; m >= 0; m--) ctx.lineTo(right[m].x, right[m].y);
    ctx.closePath();

    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, c.roadFar);
    g.addColorStop(0.42, c.road);
    g.addColorStop(1, c.roadNear);
    ctx.fillStyle = g;
    ctx.fill();

    // 中央柔光
    ctx.save();
    ctx.globalAlpha = 0.35;
    var lg = ctx.createLinearGradient(0, 0, 0, H);
    lg.addColorStop(0, 'rgba(255,255,255,0)');
    lg.addColorStop(0.62, 'rgba(255,255,255,0.045)');
    lg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.moveTo(left[0].x + 80, left[0].y);
    for (var n = 1; n < left.length; n++) ctx.lineTo(left[n].x + ROAD_HALF * 0.62, left[n].y);
    for (var q = right.length - 1; q >= 0; q--) ctx.lineTo(right[q].x - ROAD_HALF * 0.62, right[q].y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 边缘霓虹
    ctx.save();
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = c.glow;
    ctx.shadowColor = c.glow;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.moveTo(left[0].x, left[0].y);
    for (var a = 1; a < left.length; a++) ctx.lineTo(left[a].x, left[a].y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(right[0].x, right[0].y);
    for (var b = 1; b < right.length; b++) ctx.lineTo(right[b].x, right[b].y);
    ctx.stroke();
    ctx.restore();

    drawRumble(-1);
    drawRumble(1);

    drawLaneDash(0, 0, 3.6, 0.55);
    drawLaneDash(-124, 0, 3.6, 0.4);
    drawLaneDash(124, 0, 3.6, 0.4);

    if (level().weather === 'rain') {
      ctx.save();
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = '#9fd8ff';
      ctx.beginPath();
      ctx.moveTo(left[0].x, left[0].y);
      for (var r1 = 1; r1 < left.length; r1++) ctx.lineTo(left[r1].x, left[r1].y);
      for (var r2 = right.length - 1; r2 >= 0; r2--) ctx.lineTo(right[r2].x, right[r2].y);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  function drawRumble(side) {
    var c = surf().colors;
    var chunk = 72;
    var w = 12;
    var start = Math.floor((G.travelled - 150) / chunk) * chunk;
    for (var d = start; d < G.travelled + VIEW_AHEAD; d += chunk) {
      var p1 = proj(d);
      var p2 = proj(d + chunk);
      if (p2.y < -40 || p1.y > H + 40) continue;
      var idx = Math.floor(d / chunk);
      ctx.fillStyle = idx % 2 === 0 ? c.stripe1 : c.stripe2;
      ctx.beginPath();
      ctx.moveTo(curveAt(d) + side * ROAD_HALF * p1.s, p1.y);
      ctx.lineTo(curveAt(d) + side * (ROAD_HALF - w) * p1.s, p1.y);
      ctx.lineTo(curveAt(d + chunk) + side * (ROAD_HALF - w) * p2.s, p2.y);
      ctx.lineTo(curveAt(d + chunk) + side * ROAD_HALF * p2.s, p2.y);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawLaneDash(off, extra, width, alpha) {
    var c = surf().colors;
    var chunk = 104;
    var on = 58;
    var start = Math.floor((G.travelled - 150) / chunk) * chunk;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = c.lane;
    for (var d = start; d < G.travelled + VIEW_AHEAD; d += chunk) {
      var p1 = proj(d);
      var p2 = proj(d + on);
      if (p2.y < -40 || p1.y > H + 40) continue;
      ctx.lineWidth = width * ((p1.s + p2.s) / 2);
      ctx.beginPath();
      ctx.moveTo(curveAt(d) + (off + extra) * p1.s, p1.y);
      ctx.lineTo(curveAt(d + on) + (off + extra) * p2.s, p2.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ---------------- 视觉：实体 ---------------- */
  function drawEntities() {
    var list = G.entities.slice().sort(function (a, b) { return a.sy - b.sy; });
    for (var i = 0; i < list.length; i++) drawEntity(list[i]);
  }

  function drawEntity(e) {
    if (e.dead) return;
    var ground = (e.kind === 'puddle' || e.kind === 'ice' || e.kind === 'snow' || e.kind === 'boost');
    if (ground && e.sy < 6) return;
    if (e.sy < -90 || e.sy > H + 90) return;
    var x = curveAt(e.d) + e.off * e.ss;
    var s = e.ss;
    var kind = e.kind;

    ctx.save();
    ctx.translate(x, e.sy);
    ctx.scale(s, s);

    // 地面投影
    if (kind !== 'coin' && kind !== 'boost' && kind !== 'puddle' && kind !== 'ice' && kind !== 'gate') {
      ctx.fillStyle = 'rgba(0,0,0,0.34)';
      ctx.beginPath();
      ctx.ellipse(0, e.h * 0.32, e.w * 0.55, e.h * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    if (kind === 'coin') {
      var spin = Math.abs(Math.cos(G.clock * 3 + e.seed));
      var wob = 0.45 + spin * 0.55;
      ctx.save();
      ctx.scale(wob, 1);
      ctx.rotate(Math.sin(G.clock * 2 + e.seed) * 0.3);
      var cg = ctx.createRadialGradient(0, 0, 2, 0, 0, 28);
      cg.addColorStop(0, 'rgba(255,243,214,0.95)');
      cg.addColorStop(0.6, 'rgba(255,176,58,0.85)');
      cg.addColorStop(1, 'rgba(255,176,58,0)');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(0, 0, 28, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffe9bd';
      ctx.beginPath();
      ctx.moveTo(0, -14); ctx.lineTo(9, 0); ctx.lineTo(0, 14); ctx.lineTo(-9, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,176,58,0.9)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    } else if (kind === 'nitro') {
      var ng = ctx.createLinearGradient(-16, -20, 16, 20);
      ng.addColorStop(0, '#a9fff0');
      ng.addColorStop(1, '#31b79a');
      ctx.fillStyle = ng;
      roundRectPath(-13, -21, 26, 42, 7);
      ctx.fill();
      ctx.strokeStyle = 'rgba(220,255,247,0.85)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#0b2b24';
      ctx.font = 'bold 20px "SF Mono", Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('N', 0, 1);
      ctx.shadowColor = '#5fe0c0';
      ctx.shadowBlur = 18;
      ctx.fillRect(-13, -21, 26, 6);
      ctx.shadowBlur = 0;
    } else if (kind === 'heart') {
      ctx.fillStyle = '#ff8a92';
      ctx.shadowColor = '#ff6b74';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.moveTo(0, 12);
      ctx.bezierCurveTo(-20, -2, -12, -18, 0, -8);
      ctx.bezierCurveTo(12, -18, 20, -2, 0, 12);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    } else if (kind === 'shield') {
      ctx.fillStyle = 'rgba(159,230,255,0.9)';
      ctx.shadowColor = '#9fe6ff';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      for (var si = 0; si < 6; si++) {
        var ang = si * Math.PI / 3 - Math.PI / 6;
        var px = Math.cos(ang) * 17;
        var py = Math.sin(ang) * 17;
        if (si === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(12,26,30,0.55)';
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'boost') {
      var pulse = 0.5 + 0.5 * Math.sin(G.clock * 5 + e.seed);
      ctx.globalAlpha = 0.42 + pulse * 0.4;
      for (var bi = 0; bi < 3; bi++) {
        ctx.fillStyle = bi === 2 ? '#ffe7b0' : '#ffb03a';
        ctx.beginPath();
        ctx.moveTo(-34, 22 - bi * 16);
        ctx.lineTo(0, -6 - bi * 16);
        ctx.lineTo(34, 22 - bi * 16);
        ctx.lineTo(22, 22 - bi * 16);
        ctx.lineTo(0, 6 - bi * 16);
        ctx.lineTo(-22, 22 - bi * 16);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else if (kind === 'gate') {
      var gp = 0.5 + 0.5 * Math.sin(G.clock * 3 + e.seed);
      ctx.shadowColor = '#ffb03a';
      ctx.shadowBlur = 22;
      ctx.fillStyle = '#ffcf6a';
      ctx.fillRect(-e.w / 2 - 5, 30, 8, 62);
      ctx.fillRect(e.w / 2 - 3, 30, 8, 62);
      ctx.strokeStyle = 'rgba(255,208,120,' + (0.55 + gp * 0.35) + ')';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-e.w / 2, 32);
      ctx.quadraticCurveTo(0, -22, e.w / 2, 32);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,240,214,' + (0.5 + gp * 0.3) + ')';
      ctx.font = 'bold 13px "SF Mono", Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('★', 0, -2);
    } else if (kind === 'puddle') {
      ctx.fillStyle = 'rgba(22,40,54,0.62)';
      ctx.beginPath();
      ctx.ellipse(0, 0, e.w / 2, e.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(150,220,255,0.34)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = 'rgba(190,236,255,0.24)';
      ctx.beginPath();
      ctx.ellipse(-e.w * 0.12, -e.h * 0.1, e.w * 0.26, e.h * 0.12, -0.3, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'ice') {
      ctx.fillStyle = 'rgba(170,225,250,0.5)';
      ctx.beginPath();
      ctx.moveTo(-e.w / 2, 10);
      ctx.lineTo(-e.w * 0.24, -e.h / 2);
      ctx.lineTo(e.w * 0.18, -e.h * 0.36);
      ctx.lineTo(e.w / 2, 6);
      ctx.lineTo(e.w * 0.2, e.h / 2);
      ctx.lineTo(-e.w * 0.3, e.h * 0.34);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(230,248,255,0.6)';
      ctx.lineWidth = 1.6;
      for (var ci = 0; ci < 4; ci++) {
        ctx.beginPath();
        var sx = -e.w / 2 + ci * e.w / 5 + 8;
        ctx.moveTo(sx, -e.h / 3);
        ctx.lineTo(sx + 12, e.h / 3);
        ctx.stroke();
      }
    } else if (kind === 'snow') {
      ctx.fillStyle = 'rgba(238,248,252,0.92)';
      ctx.beginPath();
      ctx.moveTo(-e.w / 2, 8);
      ctx.quadraticCurveTo(-e.w * 0.2, -e.h / 2, 0, -e.h * 0.36);
      ctx.quadraticCurveTo(e.w * 0.24, -e.h / 2, e.w / 2, 8);
      ctx.quadraticCurveTo(0, e.h * 0.34, -e.w / 2, 8);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(150,190,210,0.35)';
      ctx.beginPath();
      ctx.ellipse(0, e.h * 0.16, e.w * 0.34, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'cone') {
      ctx.fillStyle = '#e06a2b';
      ctx.beginPath();
      ctx.moveTo(0, -22);
      ctx.lineTo(17, 20);
      ctx.lineTo(-17, 20);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#f3e7d3';
      ctx.fillRect(-10, 2, 20, 6);
      ctx.fillStyle = '#2a211a';
      ctx.fillRect(-19, 20, 38, 5);
    } else if (kind === 'barrel') {
      var bg = ctx.createLinearGradient(-22, 0, 22, 0);
      bg.addColorStop(0, '#7a2c18');
      bg.addColorStop(0.45, '#e0752f');
      bg.addColorStop(1, '#8a3418');
      ctx.fillStyle = bg;
      roundRectPath(-22, -26, 44, 52, 8);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,235,200,0.55)';
      ctx.fillRect(-22, -12, 44, 7);
      ctx.fillRect(-22, 10, 44, 6);
      ctx.fillStyle = '#2a1510';
      ctx.beginPath();
      ctx.ellipse(0, -26, 22, 8, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'barrier') {
      ctx.fillStyle = '#2b1b12';
      ctx.fillRect(-e.w / 2, -8, e.w, 22);
      var bw = e.w / 8;
      for (var bj = 0; bj < 8; bj++) {
        ctx.fillStyle = bj % 2 === 0 ? '#ffcf6a' : '#3a1410';
        ctx.beginPath();
        ctx.moveTo(-e.w / 2 + bj * bw, -8);
        ctx.lineTo(-e.w / 2 + (bj + 1) * bw, -8);
        ctx.lineTo(-e.w / 2 + bj * bw, 14);
        ctx.lineTo(-e.w / 2 + (bj - 1) * bw, 14);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = G.clock % 1 < 0.5 ? '#ff6b74' : '#5a1f22';
      ctx.beginPath();
      ctx.arc(-e.w / 2 + 8, -16, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a1210';
      ctx.fillRect(-e.w / 2 + 8, 14, 6, 10);
      ctx.fillRect(e.w / 2 - 14, 14, 6, 10);
    } else if (kind === 'rock') {
      ctx.fillStyle = '#4a3526';
      ctx.beginPath();
      ctx.moveTo(-38, 12);
      ctx.lineTo(-26, -22);
      ctx.lineTo(-4, -32);
      ctx.lineTo(22, -22);
      ctx.lineTo(38, 4);
      ctx.lineTo(24, 26);
      ctx.lineTo(-16, 28);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,220,180,0.18)';
      ctx.beginPath();
      ctx.moveTo(-26, -10); ctx.lineTo(-6, -26); ctx.lineTo(4, -10); ctx.closePath();
      ctx.fill();
    } else if (kind === 'truck') {
      // 车厢
      var tg = ctx.createLinearGradient(-58, 0, 58, 0);
      tg.addColorStop(0, '#3a2a20');
      tg.addColorStop(0.5, '#6b4d33');
      tg.addColorStop(1, '#2f2118');
      ctx.fillStyle = tg;
      roundRectPath(-56, -76, 112, 120, 8);
      ctx.fill();
      // 驾驶室
      ctx.fillStyle = '#2b2018';
      roundRectPath(-44, -76, 88, 34, 7);
      ctx.fill();
      ctx.fillStyle = 'rgba(120,200,230,0.4)';
      ctx.fillRect(-38, -70, 76, 16);
      // 车灯
      ctx.fillStyle = '#ffd48a';
      ctx.shadowColor = '#ffb03a';
      ctx.shadowBlur = 18;
      ctx.fillRect(-44, -78, 12, 5);
      ctx.fillRect(32, -78, 12, 5);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ff6b74';
      ctx.fillRect(-46, 40, 16, 6);
      ctx.fillRect(30, 40, 16, 6);
      // 轮子
      ctx.fillStyle = '#120d0a';
      ctx.fillRect(-64, -40, 10, 30);
      ctx.fillRect(54, -40, 10, 30);
      ctx.fillRect(-64, 16, 10, 30);
      ctx.fillRect(54, 16, 10, 30);
    }

    ctx.restore();
  }

  /* ---------------- 视觉：车 ---------------- */
  function shade(hex, amt) {
    var h = hex.replace('#', '');
    var n = parseInt(h, 16);
    var r = clamp(((n >> 16) & 255) + amt, 0, 255);
    var g = clamp(((n >> 8) & 255) + amt, 0, 255);
    var b = clamp((n & 255) + amt, 0, 255);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function drawCar(x, y, angle, c, opts) {
    opts = opts || {};
    var scale = opts.scale || 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // 影子
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.beginPath();
    ctx.ellipse(0, 12, 32, 50, 0, 0, Math.PI * 2);
    ctx.fill();

    // 底盘霓虹
    var ug = ctx.createRadialGradient(0, 16, 4, 0, 16, 58);
    ug.addColorStop(0, rgba(c.accent, 0.45));
    ug.addColorStop(1, rgba(c.accent, 0));
    ctx.fillStyle = ug;
    ctx.beginPath();
    ctx.ellipse(0, 16, 52, 62, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.rotate(angle);

    if (opts.shield) {
      ctx.strokeStyle = 'rgba(159,230,255,0.75)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, 40, 62, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(159,230,255,0.12)';
      ctx.fill();
    }

    // 轮胎
    ctx.fillStyle = '#15100d';
    roundRectPath(-33, -38, 11, 28, 4);
    ctx.fill();
    roundRectPath(22, -38, 11, 28, 4);
    ctx.fill();
    roundRectPath(-33, 18, 11, 30, 4);
    ctx.fill();
    roundRectPath(22, 18, 11, 30, 4);
    ctx.fill();

    // 尾焰
    if (opts.nitro) {
      var fl = 26 + Math.random() * 30;
      var fg = ctx.createLinearGradient(0, 46, 0, 46 + fl);
      fg.addColorStop(0, 'rgba(255,240,200,0.95)');
      fg.addColorStop(0.45, 'rgba(255,150,50,0.8)');
      fg.addColorStop(1, 'rgba(255,90,20,0)');
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.moveTo(-14, 46);
      ctx.lineTo(0, 46 + fl);
      ctx.lineTo(14, 46);
      ctx.closePath();
      ctx.fill();
    }

    // 车身
    var bodyG = ctx.createLinearGradient(-28, 0, 28, 0);
    bodyG.addColorStop(0, shade(c.color, -58));
    bodyG.addColorStop(0.42, c.color);
    bodyG.addColorStop(1, shade(c.color, -34));
    ctx.fillStyle = bodyG;
    ctx.beginPath();
    ctx.moveTo(-20, -52);
    ctx.quadraticCurveTo(-26, -44, -27, -24);
    ctx.lineTo(-29, 28);
    ctx.quadraticCurveTo(-29, 46, -19, 50);
    ctx.lineTo(19, 50);
    ctx.quadraticCurveTo(29, 46, 29, 28);
    ctx.lineTo(27, -24);
    ctx.quadraticCurveTo(26, -44, 20, -52);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = rgba('#ffffff', 0.2);
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // 车顶座舱
    var glass = ctx.createLinearGradient(-16, -20, 16, 26);
    glass.addColorStop(0, 'rgba(24,32,40,0.95)');
    glass.addColorStop(0.5, 'rgba(58,80,92,0.9)');
    glass.addColorStop(1, 'rgba(14,18,22,0.95)');
    ctx.fillStyle = glass;
    roundRectPath(-15, -30, 30, 46, 9);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.moveTo(-12, -24);
    ctx.lineTo(6, -24);
    ctx.lineTo(-4, -4);
    ctx.lineTo(-12, -4);
    ctx.closePath();
    ctx.fill();

    // 中线条纹
    ctx.fillStyle = rgba(c.accent, 0.75);
    ctx.fillRect(-3, -50, 6, 16);
    ctx.fillRect(-3, 30, 6, 14);

    // 前灯
    ctx.shadowColor = '#ffe7b0';
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#fff3d6';
    ctx.fillRect(-19, -50, 10, 4);
    ctx.fillRect(9, -50, 10, 4);
    ctx.shadowBlur = 0;

    // 尾灯
    ctx.fillStyle = '#ff6b74';
    ctx.shadowColor = '#ff6b74';
    ctx.shadowBlur = 12;
    ctx.fillRect(-22, 47, 12, 4);
    ctx.fillRect(10, 47, 12, 4);
    ctx.shadowBlur = 0;

    // 尾翼
    ctx.fillStyle = shade(c.color, -70);
    ctx.fillRect(-24, 42, 48, 5);
    ctx.fillRect(-20, 38, 4, 8);
    ctx.fillRect(16, 38, 4, 8);

    // 前灯光束
    var beam = ctx.createLinearGradient(0, -52, 0, -160);
    beam.addColorStop(0, 'rgba(255,236,190,0.22)');
    beam.addColorStop(1, 'rgba(255,236,190,0)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(-22, -52);
    ctx.lineTo(-34, -150);
    ctx.lineTo(34, -150);
    ctx.lineTo(22, -52);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  function drawChase() {
    if (level().weather !== 'champion' || G.mode === 'menu') return;

    // 后视镜：把追兵放进右上角的镜面里，避免被底部 HUD 挡住
    var mw = 236, mh = 78;
    var mx = W - mw - 44, my = 58;
    var warn = G.chaseWarn > 0;

    ctx.save();
    ctx.fillStyle = 'rgba(10, 7, 6, 0.84)';
    roundRectPath(mx, my, mw, mh, 14);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = warn
      ? 'rgba(255,107,116,' + (0.55 + 0.4 * Math.sin(G.clock * 10)) + ')'
      : 'rgba(216,176,115,0.3)';
    roundRectPath(mx, my, mw, mh, 14);
    ctx.stroke();

    // 镜内车道与地平线
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(mx + 10, my + 30, mw - 20, 34);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(mx + mw / 2, my + 30);
    ctx.lineTo(mx + mw / 2, my + 64);
    ctx.stroke();

    ctx.fillStyle = warn ? 'rgba(255,140,140,0.95)' : 'rgba(216,176,115,0.75)';
    ctx.font = '600 10px "SF Mono", Menlo, Consolas, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('REAR · 追兵', mx + 14, my + 10);

    var cx = mx + mw / 2 + clamp((G.chaseX - W / 2) / ROAD_HALF, -1, 1) * 58;
    var cy = my + mh - 26;
    ctx.translate(cx, cy);
    ctx.scale(0.46, 0.46);

    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.ellipse(0, 6, 34, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5b1f27';
    roundRectPath(-30, -34, 60, 64, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,140,150,0.85)';
    ctx.lineWidth = 2;
    roundRectPath(-30, -34, 60, 64, 10);
    ctx.stroke();
    ctx.shadowColor = '#ff6b74';
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#ff6b74';
    ctx.fillRect(-22, -32, 13, 6);
    ctx.fillRect(9, -32, 13, 6);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,220,190,0.2)';
    ctx.beginPath();
    ctx.moveTo(-16, -36);
    ctx.lineTo(-42, -120);
    ctx.lineTo(42, -120);
    ctx.lineTo(16, -36);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    if (warn) {
      ctx.save();
      ctx.globalAlpha = clamp(G.chaseWarn, 0, 1) * 0.5;
      ctx.strokeStyle = '#ff6b74';
      ctx.lineWidth = 3;
      ctx.strokeRect(6, 6, W - 12, H - 12);
      ctx.restore();
    }
  }

  /* ---------------- 视觉：粒子与文字 ---------------- */
  function drawParticles() {
    for (var i = 0; i < G.particles.length; i++) {
      var p = G.particles[i];
      var a = clamp(p.life / p.max, 0, 1);
      ctx.globalAlpha = a;
      if (p.kind === 'spark') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(1, p.size * 0.6);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawFloats() {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (var i = 0; i < G.floats.length; i++) {
      var f = G.floats[i];
      var a = clamp(f.life / f.max, 0, 1);
      ctx.globalAlpha = a;
      ctx.font = '600 16px "SF Mono", Menlo, Consolas, monospace';
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillText(f.text, f.x + 1, f.y + 2);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  /* ---------------- 视觉：天气与速度 ---------------- */
  function drawWeather() {
    var w = level().weather;
    if (w === 'rain' || w === 'champion') {
      ctx.save();
      ctx.strokeStyle = 'rgba(190,230,255,0.3)';
      ctx.lineWidth = 1.2;
      for (var ri = 0; ri < 70; ri++) {
        var rx = hash(ri * 3.1) * W + Math.sin(G.clock * 0.6 + ri) * 6;
        var ry = (G.clock * 1050 + hash(ri * 7.7) * 900) % (H + 120) - 60;
        var len = 14 + hash(ri * 11.3) * 20;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 4, ry + len);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (w === 'frost' || w === 'champion') {
      ctx.save();
      for (var fi = 0; fi < 60; fi++) {
        var fx = (hash(fi * 5.3) * W + Math.sin(G.clock * 0.8 + fi) * 22) % W;
        var fy = (G.clock * 46 + hash(fi * 9.1) * H) % H;
        ctx.globalAlpha = 0.22 + hash(fi * 3.7) * 0.3;
        ctx.fillStyle = '#eaf6fa';
        ctx.beginPath();
        ctx.arc(fx, fy, 1.4 + hash(fi * 2.3) * 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    if (w === 'wind' || w === 'champion') {
      ctx.save();
      var gust = Math.sin(G.time * 0.85) * 62 + Math.sin(G.time * 2.4) * 26;
      ctx.strokeStyle = 'rgba(255,214,160,0.22)';
      ctx.lineWidth = 1.4;
      for (var wi = 0; wi < 30; wi++) {
        var wx = (G.clock * (gust + 240) + hash(wi * 4.7) * W * 2) % (W + 300) - 150;
        var wy = 40 + hash(wi * 8.3) * (H - 80);
        ctx.beginPath();
        ctx.moveTo(wx, wy);
        ctx.lineTo(wx + 46 + hash(wi) * 60, wy);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (w === 'rain' || w === 'frost' || w === 'champion') {
      var vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.24, W / 2, H / 2, H * 0.86);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, w === 'frost' ? 'rgba(150,210,235,0.22)' : 'rgba(0,0,0,0.34)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawSpeedFX() {
    var intensity = clamp((G.speed - 360) / 420, 0, 1);
    if (G.nitroTime > 0) intensity = 1;
    if (intensity <= 0.02) return;

    ctx.save();
    ctx.strokeStyle = G.nitroTime > 0 ? 'rgba(255,214,150,0.55)' : 'rgba(255,255,255,0.22)';
    for (var i = 0; i < 26; i++) {
      var x = hash(i * 3.9 + 1) * W;
      if (x > W * 0.34 && x < W * 0.66) x = x < W / 2 ? x - W * 0.18 : x + W * 0.18;
      var y = ((G.clock * 2400 + hash(i * 7.1) * H * 2) % (H + 220)) - 110;
      var len = 34 + intensity * 120;
      var drift = (x - W / 2) * 0.14;
      ctx.globalAlpha = 0.1 + intensity * 0.3;
      ctx.lineWidth = 1 + intensity * 1.2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + drift, y + len);
      ctx.stroke();
    }
    ctx.restore();

    if (G.nitroTime > 0) {
      var ng = ctx.createRadialGradient(W / 2, CAR_Y, 80, W / 2, CAR_Y, 520);
      ng.addColorStop(0, 'rgba(255,176,58,0.28)');
      ng.addColorStop(1, 'rgba(255,176,58,0)');
      ctx.fillStyle = ng;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function showBanner(title, sub, dur) {
    G.banner = { title: title, sub: sub || '', life: dur || 2.2, max: dur || 2.2 };
  }

  function drawBanner() {
    if (!G.banner || G.mode === 'menu') return;
    var b = G.banner;
    var t = 1 - b.life / b.max;
    var alpha = b.life > b.max - 0.25 ? (b.max - b.life) / 0.25 : Math.min(1, b.life / 0.5);
    var pop = 1 + (1 - Math.min(1, t * 4)) * 0.18;

    ctx.save();
    ctx.globalAlpha = clamp(alpha, 0, 1);
    ctx.translate(W / 2, 132);
    ctx.scale(pop, pop);
    ctx.textAlign = 'center';
    ctx.font = '700 30px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillText(b.title, 2, 3);
    ctx.fillStyle = '#ffe7bd';
    ctx.fillText(b.title, 0, 0);

    if (b.sub) {
      ctx.font = '11px "SF Mono", Menlo, monospace';
      ctx.letterSpacing = '3px';
      ctx.fillStyle = 'rgba(216,176,115,0.9)';
      ctx.fillText(b.sub, 0, 26);
    }
    ctx.restore();
  }

  function drawOverlayFX() {
    // 撞车红闪
    if (G.flash > 0) {
      ctx.fillStyle = 'rgba(255,90,70,' + clamp(G.flash, 0, 1) * 0.32 + ')';
      ctx.fillRect(0, 0, W, H);
    }

    // 暗角
    var vg = ctx.createRadialGradient(W / 2, H * 0.56, H * 0.3, W / 2, H * 0.56, H * 0.9);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.42)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    drawBanner();

    if (G.mode === 'countdown') {
      var n = G.countdown > 0.65 ? Math.ceil(G.countdown - 0.65) : 0;
      var label = n > 0 ? String(n) : 'GO!';
      var t = G.countdown > 0.65 ? 1 - (G.countdown - 0.65 - (n - 1)) : (0.65 - G.countdown) / 0.65;
      var scale = 1 + (1 - Math.min(1, t)) * 0.25;
      ctx.save();
      ctx.translate(W / 2, H * 0.44);
      ctx.scale(scale, scale);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '800 96px "SF Mono", Menlo, Consolas, monospace';
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillText(label, 4, 6);
      ctx.fillStyle = n > 0 ? '#ffe7bd' : '#7ef0d0';
      ctx.shadowColor = n > 0 ? '#ffb03a' : '#3ef0c0';
      ctx.shadowBlur = 38;
      ctx.fillText(label, 0, 0);
      ctx.restore();

      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = '12px "SF Mono", Menlo, monospace';
      ctx.fillStyle = 'rgba(216,176,115,0.85)';
      ctx.fillText('按 ← → 转向 · ↑ 加速 · SPACE 氮气', W / 2, H * 0.44 + 92);
      ctx.restore();
    }
  }

  function draw() {
    ctx.save();
    if (G.shake > 0) {
      ctx.translate(rand(-1, 1) * G.shake * 0.4, rand(-1, 1) * G.shake * 0.3);
    }
    drawTerrain();
    drawProps();
    drawRoad();
    if (G.mode !== 'menu') {
      drawEntities();
      drawChase();
    }
    drawCar(G.carX, CAR_Y, G.carAngle, car(), {
      nitro: G.nitroTime > 0,
      shield: G.shield > 0,
      drift: G.drifting,
      scale: 1
    });
    drawParticles();
    drawFloats();
    if (G.mode !== 'menu') drawWeather();
    drawSpeedFX();
    ctx.restore();
    drawOverlayFX();
  }
  /* ---------------- HUD ---------------- */
  function buildHearts() {
    heartsEl.innerHTML = '';
    heartEls = [];
    for (var i = 0; i < G.maxHearts; i++) {
      var el = document.createElement('span');
      el.className = 'heart';
      el.textContent = '♥';
      el.setAttribute('aria-hidden', 'true');
      heartsEl.appendChild(el);
      heartEls.push(el);
    }
  }

  function paintHearts() {
    for (var i = 0; i < heartEls.length; i++) {
      heartEls[i].classList.toggle('is-off', i >= G.hearts);
    }
  }

  function syncHUD(force) {
    var lv = level();
    var last = G.lastHud;
    var score = Math.floor(G.score);
    var key = String(G.levelIndex + 1);
    var best = Number(save.best[key]) || 0;
    var pct = clamp(G.travelled / G.totalPx, 0, 1) * 100;
    var dist = Math.floor(G.travelled / M_PER_PX);
    var spd = Math.floor(G.speed * KMH);
    var np = Math.floor(G.nitro * 100);

    if (force || score !== last.score) {
      hudScore.textContent = pad(score, 6);
      last.score = score;
    }
    if (force || best !== last.best || score > best) {
      hudBest.textContent = 'BEST ' + pad(Math.max(best, score), 6);
      last.best = best;
    }
    if (force || G.coins !== last.coins) {
      hudCoins.textContent = '★ ' + G.coins;
      last.coins = G.coins;
    }
    if (force || lv.name !== last.level) {
      hudLevel.textContent = pad(G.levelIndex + 1, 2) + ' · ' + lv.name + ' · ' + lv.sub;
      last.level = lv.name;
    }
    if (force || Math.round(pct) !== last.pct) {
      levelFill.style.width = pct + '%';
      levelMark.style.left = pct + '%';
      last.pct = Math.round(pct);
    }
    if (force || dist !== last.dist) {
      hudDist.textContent = dist + ' / ' + lv.dist + ' m';
      last.dist = dist;
    }
    var timeText = G.time.toFixed(1) + 's';
    if (force || timeText !== last.time) {
      hudTime.textContent = timeText;
      last.time = timeText;
    }
    if (force || spd !== last.speed) {
      hudSpeed.textContent = String(spd);
      last.speed = spd;
    }
    if (force || np !== last.nitro) {
      nitroPct.textContent = np + '%';
      nitroFill.style.width = np + '%';
      last.nitro = np;
    }
    var burning = G.nitroTime > 0;
    if (force || burning !== last.burning) {
      nitroFill.classList.toggle('is-burning', burning);
      nitroHead.classList.toggle('is-ready', !burning && G.nitro >= 0.35);
      nitroHead.firstElementChild.textContent = burning ? '氮气 · 冲刺中' : '氮气 · SPACE';
      nitroBtn.classList.toggle('is-ready', !burning && G.nitro >= 0.35);
      last.burning = burning;
    }

    var comboOn = G.combo > 1;
    if (force || comboOn !== last.comboOn) {
      hudCombo.classList.toggle('is-on', comboOn);
      last.comboOn = comboOn;
    }
    if (comboOn) hudComboNum.textContent = '×' + G.combo;

    driftTag.classList.toggle('is-on', G.drifting && G.mode === 'playing');
  }

  function refreshSoundBtn() {
    soundBtn.classList.toggle('is-muted', SFX.muted);
    soundBtn.textContent = SFX.muted ? '♪̸' : '♪';
    soundBtn.title = SFX.muted ? '音效已关闭' : '音效开启';
  }

  function toggleMute() {
    SFX.muted = !SFX.muted;
    saveNumber(MUTE_KEY, SFX.muted ? 1 : 0);
    if (SFX.master && SFX.ac) {
      SFX.master.gain.setTargetAtTime(SFX.muted ? 0 : 0.9, SFX.ac.currentTime, 0.1);
    }
    refreshSoundBtn();
    if (!SFX.muted) { SFX.init(); SFX.ui(); }
  }

  /* ---------------- 氮气与暂停 ---------------- */
  function useNitro() {
    if (G.mode !== 'playing' || isPaused()) return;
    if (gate && gate.locked) return;
    if (G.nitroTime > 0) return;
    if (G.nitro < 0.35) {
      SFX.tone(220, 0.08, 'square', 0.05, 170);
      return;
    }
    G.nitroTime = 2.4;
    G.nitro = 1;
    G.speed = Math.max(G.speed, 720);
    G.shake = 6;
    SFX.nitro();
    boom(G.carX, CAR_Y + 40, '#ffb03a', 18);
    addFloat(G.carX, CAR_Y - 70, 'NITRO!', '#ffd48a');
  }

  function togglePause() {
    if (G.mode !== 'playing') return;
    if (gate && gate.locked) return;
    G.manualPaused = !G.manualPaused;
    pauseOv.hidden = !G.manualPaused;
    if (G.manualPaused) {
      keys.left = keys.right = keys.up = keys.down = false;
      G.pointerActive = false;
      G.pointerX = null;
      SFX.setEngine(0, false);
    } else {
      lastTs = performance.now();
      SFX.setEngine(G.speed, true);
    }
  }

  /* ---------------- 菜单巡航 ---------------- */
  function updateMenu(dt) {
    G.travelled += 240 * dt;
    var cx = curveAt(G.travelled);
    G.carX = cx + Math.sin(G.clock * 0.9) * 30;
    G.carAngle = Math.cos(G.clock * 0.9) * 0.06;
    if (Math.random() < dt * 9) {
      addParticle(G.carX + rand(-12, 12), CAR_Y + 48, rand(-26, 26), rand(30, 90),
        rand(0.25, 0.55), rand(2, 5), 'smoke', 'rgba(228,214,196,0.22)');
    }
  }

  /* ---------------- 主循环 ---------------- */
  function frame(ts) {
    var dt = (ts - lastTs) / 1000;
    if (!(dt > 0)) dt = 0.016;
    if (dt > 0.05) dt = 0.05;
    lastTs = ts;
    G.clock += dt;

    if (G.mode === 'menu') {
      updateMenu(dt);
    } else if (G.mode === 'countdown' && !G.gatePaused) {
      G.countdown -= dt;
      var n = G.countdown > 0.65 ? Math.ceil(G.countdown - 0.65) : 0;
      if (n !== G.lastCount) {
        G.lastCount = n;
        SFX.beep(n === 0);
      }
      if (G.countdown <= 0) {
        G.countdown = 0;
        G.mode = 'playing';
        lastTs = ts;
      }
    } else if (G.mode === 'playing' && !isPaused()) {
      update(dt);
    }

    updateParticles(dt);
    updateFloats(dt);

    if (G.banner) {
      G.banner.life -= dt;
      if (G.banner.life <= 0) G.banner = null;
    }

    if (G.mode === 'playing' && !isPaused()) SFX.setEngine(G.speed, true);

    draw();
    requestAnimationFrame(frame);
  }

  /* ---------------- 输入 ---------------- */
  function canvasWorldX(e) {
    var rect = canvas.getBoundingClientRect();
    return (e.clientX - rect.left) / rect.width * W;
  }

  function bindEvents() {
    window.addEventListener('keydown', function (e) {
      var k = e.key;
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') {
        keys.left = true;
        if (G.mode === 'playing') e.preventDefault();
      } else if (k === 'ArrowRight' || k === 'd' || k === 'D') {
        keys.right = true;
        if (G.mode === 'playing') e.preventDefault();
      } else if (k === 'ArrowUp' || k === 'w' || k === 'W') {
        keys.up = true;
        if (G.mode === 'playing') e.preventDefault();
      } else if (k === 'ArrowDown' || k === 's' || k === 'S') {
        keys.down = true;
        if (G.mode === 'playing') e.preventDefault();
      } else if (k === ' ' || k === 'Spacebar') {
        if (G.mode === 'playing') {
          e.preventDefault();
          useNitro();
        } else if (G.mode === 'menu') {
          e.preventDefault();
          startLevel(G.levelIndex);
        }
      } else if (k === 'Enter') {
        if (G.mode === 'menu') {
          startLevel(G.levelIndex);
        } else if (G.mode === 'result') {
          nextLevelOrCup();
        } else if (G.mode === 'crash') {
          startLevel(G.levelIndex);
        } else if (G.mode === 'cup') {
          startLevel(0);
        }
      } else if (k === 'p' || k === 'P' || k === 'Escape') {
        if (G.mode === 'playing') {
          e.preventDefault();
          togglePause();
        }
      } else if (k === 'm' || k === 'M') {
        toggleMute();
      }
    });

    window.addEventListener('keyup', function (e) {
      var k = e.key;
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') keys.left = false;
      else if (k === 'ArrowRight' || k === 'd' || k === 'D') keys.right = false;
      else if (k === 'ArrowUp' || k === 'w' || k === 'W') keys.up = false;
      else if (k === 'ArrowDown' || k === 's' || k === 'S') keys.down = false;
    });

    window.addEventListener('blur', function () {
      keys.left = keys.right = keys.up = keys.down = false;
      if (G.mode === 'playing' && !isPaused() && !(gate && gate.locked)) {
        G.manualPaused = true;
        pauseOv.hidden = false;
      }
    });

    canvas.addEventListener('pointerdown', function (e) {
      if (G.mode !== 'playing' || isPaused()) return;
      if (gate && gate.locked) return;
      if (e.cancelable) e.preventDefault();
      G.pointerActive = true;
      G.pointerX = clamp(canvasWorldX(e), 30, W - 30);
      if (e.pointerType === 'mouse') useNitro();
    });

    canvas.addEventListener('pointermove', function (e) {
      if (!G.pointerActive || G.mode !== 'playing' || isPaused()) return;
      G.pointerX = clamp(canvasWorldX(e), 30, W - 30);
    });

    function endPointer() {
      G.pointerActive = false;
      G.pointerX = null;
    }
    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', endPointer);
    canvas.addEventListener('pointerleave', endPointer);

    canvas.addEventListener('contextmenu', function (e) {
      if (G.mode === 'playing') e.preventDefault();
    });

    startBtn.addEventListener('click', function () {
      SFX.init();
      SFX.ui();
      if (G.levelIndex + 1 > save.unlocked) G.levelIndex = 0;
      startLevel(G.levelIndex);
    });

    resumeBtn.addEventListener('click', function () {
      SFX.ui();
      togglePause();
    });

    pauseRestartBtn.addEventListener('click', function () {
      SFX.ui();
      startLevel(G.levelIndex);
    });

    pauseMenuBtn.addEventListener('click', function () {
      SFX.ui();
      backToMenu();
    });

    nextBtn.addEventListener('click', function () {
      SFX.ui();
      nextLevelOrCup();
    });

    retryBtn.addEventListener('click', function () {
      SFX.ui();
      startLevel(G.levelIndex);
    });

    resultMenuBtn.addEventListener('click', function () {
      SFX.ui();
      backToMenu();
    });

    crashRetryBtn.addEventListener('click', function () {
      SFX.ui();
      startLevel(G.levelIndex);
    });

    crashMenuBtn.addEventListener('click', function () {
      SFX.ui();
      backToMenu();
    });

    cupAgainBtn.addEventListener('click', function () { SFX.ui(); startLevel(0); });
    cupMenuBtn.addEventListener('click', function () { SFX.ui(); backToMenu(); });

    pauseBtn.addEventListener('click', function () {
      togglePause();
    });

    soundBtn.addEventListener('click', function () {
      SFX.init();
      toggleMute();
    });

    if (nitroBtn) {
      nitroBtn.addEventListener('pointerdown', function (e) {
        e.stopPropagation();
        e.preventDefault();
        useNitro();
      });
    }

    document.addEventListener('visibilitychange', function () {
      if (document.hidden && G.mode === 'playing' && !isPaused()) {
        G.manualPaused = true;
        pauseOv.hidden = false;
        SFX.setEngine(0, false);
      }
    });

    document.addEventListener('playclock:breakstart', function () {
      G.breakPaused = true;
      keys.left = keys.right = keys.up = keys.down = false;
      SFX.setEngine(0, false);
    });
    document.addEventListener('playclock:breakend', function () {
      G.breakPaused = false;
      lastTs = performance.now();
    });

    window.addEventListener('resize', setupCanvas);
  }

  function nextLevelOrCup() {
    if (G.levelIndex + 1 < LEVELS.length) {
      startLevel(G.levelIndex + 1);
    } else {
      G.mode = 'cup';
      resultOv.hidden = true;
      showCup();
    }
  }

  /* ---------------- 局间门禁 ---------------- */
  function ensureGate() {
    if (!window.Gate || gate) return;
    gate = window.Gate.create({
      everyMinutes: 5,
      challenges: ['quick-math', 'poem', 'english'],
      showBadge: true,
      badgePosition: 'bottom-left',
      kicker: '局间门禁 · 霓虹狂飙',
      title: '先过一道关卡',
      note: '已经飙了 5 分钟，答完这道题才能回到赛道。',
      onLock: function () {
        if (G.mode !== 'playing' && G.mode !== 'countdown') return;
        G.gatePaused = true;
        G.pointerActive = false;
        G.pointerX = null;
        keys.left = keys.right = keys.up = keys.down = false;
        SFX.setEngine(0, false);
      },
      onUnlock: function () {
        if (G.mode !== 'playing' && G.mode !== 'countdown') return;
        G.gatePaused = false;
        lastTs = performance.now();
        SFX.setEngine(G.speed, true);
      }
    });
  }

  /* ---------------- 启动 ---------------- */
  function setupCanvas() {
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.imageSmoothingEnabled = true;
  }

  function boot() {
    setupCanvas();
    loadSave();
    SFX.muted = loadNumber(MUTE_KEY, 0) === 1;

    G.surface = save.surface;
    G.carId = save.car;
    G.levelIndex = 0;
    G.mode = 'menu';
    G.amp = LEVELS[0].amp;
    G.phase = rand(0, Math.PI * 2);
    G.travelled = 0;
    G.maxHearts = car().armor;
    G.hearts = G.maxHearts;

    buildMenu();
    buildHearts();
    paintHearts();
    refreshSoundBtn();
    syncHUD(true);
    bindEvents();

    lastTs = performance.now();
    requestAnimationFrame(frame);

    // 调试：?level=3 选择赛段，?autostart=1 直接开赛
    var lvMatch = /[?&]level=(\d+)/.exec(location.search);
    if (lvMatch) {
      var wanted = clamp(Number(lvMatch[1]), 1, LEVELS.length) - 1;
      G.levelIndex = wanted;
      updateMenuUI();
    }
    if (/[?&]autostart=1/.test(location.search)) {
      setTimeout(function () {
        startLevel(G.levelIndex);
      }, 700);
    }
  }

  boot();

  // 调试探针：便于外部脚本读取运行态
  window.__racingDebug = function () {
    return {
      mode: G.mode,
      level: G.levelIndex + 1,
      travelled: Math.round(G.travelled),
      totalPx: Math.round(G.totalPx),
      speed: Math.round(G.speed),
      score: Math.round(G.score),
      hearts: G.hearts,
      nitro: Math.round(G.nitro),
      combo: G.combo,
      entities: G.entities.length,
      gatePaused: !!G.gatePaused,
      countdown: Number(G.countdown.toFixed(2))
    };
  };
})();
