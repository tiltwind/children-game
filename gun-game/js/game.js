/* ============================================================
 * game.js —— 启动、存档、输入、主循环、门禁/休息/结算接线
 * ============================================================ */
(function (root) {
  'use strict';
  var GG = (root.GG = root.GG || {});
  var C = GG.C, U = GG.U, UI = GG.UI, Ent = GG.Ent, World = GG.World, R = GG.R, Audio = GG.Audio;
  var G = (GG.Game = {});

  var SAVE_KEY = 'shutu.gun-game.v2';

  var game = {
    state: 'menu',        // menu | briefing | shop | playing | results
    profile: null,
    difficulty: C.DIFFICULTY.standard,
    world: null,
    mission: null,
    paused: { gate: false, rest: false, user: false },
    endT: 0,
    lastTime: 0,
    raf: 0,
    gate: null,
    firing: false,
    dodgeReq: false,
    keys: {},
    mouse: { x: 480, y: 300, down: false },
    frameCount: 0,
    booted: false
  };

  /* ---------------- 存档 ---------------- */
  function num(n, d) {
    n = Number(n);
    return isFinite(n) ? n : (d || 0);
  }
  function clampInt(n, lo, hi) {
    n = Math.round(num(n, lo));
    return Math.max(lo, Math.min(hi, n));
  }

  function defaultProfile() {
    return {
      v: 2,
      credits: 60,
      missions: {},
      unlocked: { smg: true, shotgun: false, dmr: false },
      upgrades: { damage: 0, reload: 0, speed: 0, hp: 0, armor: 0 },
      supplies: { grenade: 0, medkit: 0 },
      loadout: ['pistol', 'smg'],
      difficulty: 'standard'
    };
  }

  function loadProfile() {
    var raw = U.load(SAVE_KEY, null);
    var p = defaultProfile();
    if (!raw || typeof raw !== 'object') return p;

    p.credits = Math.max(0, Math.round(num(raw.credits)));
    if (raw.unlocked) {
      p.unlocked.shotgun = !!raw.unlocked.shotgun;
      p.unlocked.dmr = !!raw.unlocked.dmr;
    }
    if (raw.upgrades) {
      C.SHOP.forEach(function (s) {
        if (s.kind !== 'upgrade') return;
        p.upgrades[s.key] = clampInt(raw.upgrades[s.key], 0, s.max);
      });
    }
    if (raw.supplies) {
      p.supplies.grenade = clampInt(raw.supplies.grenade, 0, 8);
      p.supplies.medkit = clampInt(raw.supplies.medkit, 0, 6);
    }
    if (raw.missions && typeof raw.missions === 'object') {
      C.MISSIONS.forEach(function (m) {
        var r = raw.missions[m.id];
        if (!r || !r.done) return;
        p.missions[m.id] = {
          done: true,
          best: ['S', 'A', 'B', 'C'].indexOf(r.best) >= 0 ? r.best : 'C',
          time: Math.max(0, num(r.time)),
          plays: clampInt(r.plays, 1, 999)
        };
      });
    }
    if (Array.isArray(raw.loadout)) {
      var list = [];
      raw.loadout.forEach(function (id) {
        if (!C.WEAPONS[id] || list.indexOf(id) >= 0) return;
        if (id !== 'pistol' && !p.unlocked[id]) return;
        list.push(id);
      });
      if (list.indexOf('pistol') < 0) list.unshift('pistol');
      p.loadout = list.slice(0, 3);
    }
    if (raw.difficulty && C.DIFFICULTY[raw.difficulty]) p.difficulty = raw.difficulty;
    return p;
  }

  function save() {
    U.save(SAVE_KEY, game.profile);
  }

  /* ---------------- 屏幕切换 ---------------- */
  function goMenu() {
    stopLoop();
    destroyGate();
    game.state = 'menu';
    game.world = null;
    game.mission = null;
    game.firing = false;
    game.paused = { gate: false, rest: false, user: false };
    UI.reset();
    UI.hideHUD();
    UI.hideScreens();
    UI.showMenu(game.profile, game.difficulty);
  }

  function goBriefing(id) {
    var idx = -1;
    for (var i = 0; i < C.MISSIONS.length; i++) if (C.MISSIONS[i].id === id) idx = i;
    if (idx < 0 || !UI.unlocked(game.profile, idx)) return;
    game.state = 'briefing';
    UI.showBriefing(C.MISSIONS[idx], game.profile, game.difficulty);
  }

  function goShop() {
    game.state = 'shop';
    UI.showShop(game.profile, game.difficulty);
  }

  /* ---------------- 开局 ---------------- */
  G.start = function (id) {
    var idx = -1;
    for (var i = 0; i < C.MISSIONS.length; i++) if (C.MISSIONS[i].id === id) idx = i;
    if (idx < 0) return false;
    if (!UI.unlocked(game.profile, idx) && !/[?&]unlock=1/.test(location.search)) return false;
    var mission = C.MISSIONS[idx];

    // 校验携带武器
    var loadout = game.profile.loadout.filter(function (wid) {
      return !!C.WEAPONS[wid] && (wid === 'pistol' || game.profile.unlocked[wid]);
    });
    if (loadout.indexOf('pistol') < 0) loadout.unshift('pistol');
    loadout = loadout.slice(0, 3);
    if (!loadout.length) loadout = ['pistol'];
    game.profile.loadout = loadout;

    var equipment = {
      weapons: loadout,
      grenades: 2 + (game.profile.supplies.grenade || 0),
      medkits: 1 + (game.profile.supplies.medkit || 0)
    };

    try {
      game.world = World(mission, game.profile, equipment, game.difficulty);
    } catch (err) {
      console.error('[gun-game] 关卡构建失败', err);
      UI.showMenu(game.profile, game.difficulty);
      return false;
    }

    game.world.toastCb = function (t) { UI.toast(t); };
    game.world.bannerCb = function (t) { UI.banner(t); };
    game.mission = mission;
    game.state = 'playing';
    game.paused = { gate: false, rest: false, user: false };
    game.firing = false;
    game.dodgeReq = false;
    game.endT = 0;
    game.frameCount = 0;
    game.lastTime = 0;
    game.mouse.x = C.VIEW.w * 0.62;
    game.mouse.y = C.VIEW.h * 0.5;

    R.camReady = false;
    R.shake = 0;
    UI.hideScreens();
    UI.setWorld(game.world);
    UI.showHUD();
    UI.banner(mission.code + ' · ' + mission.name);

    Audio.init();
    Audio.play('ui');

    createGate();
    startLoop();
    return true;
  };

  function createGate() {
    destroyGate();
    if (!root.Gate) return;
    if (/[?&]nogate=1/.test(location.search)) return;
    game.gate = root.Gate.create({
      everyMinutes: 5,
      challenges: ['twenty-four', 'poem'],
      onLock: function () {
        game.paused.gate = true;
        UI.toast('门禁开启，解开通关后继续行动');
      },
      onUnlock: function () {
        game.paused.gate = false;
        game.lastTime = 0;
      }
    });
  }

  function destroyGate() {
    if (game.gate && typeof game.gate.destroy === 'function') {
      try { game.gate.destroy(); } catch (e) { /* noop */ }
    }
    game.gate = null;
  }

  /* ---------------- 暂停 ---------------- */
  function isPaused() {
    return game.paused.gate || game.paused.rest || game.paused.user;
  }

  function togglePause() {
    if (game.state !== 'playing') return;
    if (game.paused.user) {
      game.paused.user = false;
      UI.hideScreens();
      UI.showHUD();
      game.lastTime = 0;
    } else if (!game.paused.gate && !game.paused.rest) {
      game.paused.user = true;
      game.firing = false;
      UI.showPause();
    }
  }

  function abort() {
    if (game.state !== 'playing') return;
    stopLoop();
    destroyGate();
    game.world = null;
    game.state = 'menu';
    game.paused = { gate: false, rest: false, user: false };
    UI.reset();
    UI.hideHUD();
    UI.showMenu(game.profile, game.difficulty);
  }

  /* ---------------- 主循环 ---------------- */
  function startLoop() {
    stopLoop();
    game.lastTime = 0;
    game.raf = requestAnimationFrame(loop);
  }

  function stopLoop() {
    if (game.raf) cancelAnimationFrame(game.raf);
    game.raf = 0;
  }

  function loop(ts) {
    if (game.state !== 'playing' || !game.world) return;
    game.raf = requestAnimationFrame(loop);

    var dt = game.lastTime ? (ts - game.lastTime) / 1000 : 1 / 60;
    game.lastTime = ts;
    if (dt > 0.05) dt = 0.05;
    if (dt <= 0) dt = 1 / 60;

    if (game.gate && typeof game.gate.tick === 'function') game.gate.tick(dt);

    var w = game.world;
    if (!isPaused()) {
      game.frameCount++;
      var p = w.player;

      var mx = game.mouse.x, my = game.mouse.y;
      if (!isFinite(mx) || !isFinite(my)) {
        mx = C.VIEW.w * 0.62;
        my = C.VIEW.h * 0.5;
      }
      if (R.camReady) {
        mx += R.cam.x;
        my += R.cam.y;
      }
      p.aim = Math.atan2(my - p.y, mx - p.x);
      p.wx = mx;
      p.wy = my;

      var k = game.keys;
      var input = {
        mx: mx,
        my: my,
        left: !!(k.KeyA || k.ArrowLeft),
        right: !!(k.KeyD || k.ArrowRight),
        up: !!(k.KeyW || k.ArrowUp),
        down: !!(k.KeyS || k.ArrowDown),
        sprint: !!(k.ShiftLeft || k.ShiftRight),
        dodge: game.dodgeReq,
        interacting: !!k.KeyE
      };

      w.update(dt, input, !!k.KeyE);
      game.dodgeReq = false;

      if (game.firing && p.alive) Ent.tryFire(p, w);

      if (w.status !== 'playing') {
        game.endT += dt;
        if (game.endT > 0.9) finishMission();
      }
    }

    var camInput = {
      mx: w.player.aimX,
      my: w.player.aimY,
      sx: game.mouse.x,
      sy: game.mouse.y
    };
    R.frame(w, camInput, dt);
    UI.tick(dt, ts);
  }

  /* ---------------- 结算 ---------------- */
  function finishMission() {
    if (game.state !== 'playing') return;
    var w = game.world;
    if (!w || w.status === 'playing') return;
    stopLoop();
    destroyGate();

    var mission = game.mission;
    var failed = w.status !== 'won';
    var stats = w.ratingDetail();

    if (failed) {
      game.state = 'results';
      game.firing = false;
      UI.hideHUD();
      UI.showResults({
        failed: true,
        mission: mission,
        reason: '行动人员在任务中阵亡，本次行动被迫中止。',
        stats: stats,
        nextId: null
      });
      return;
    }

    var prev = game.profile.missions[mission.id];
    var first = !(prev && prev.done);
    var grade = w.rate();
    var reward = Math.round(mission.reward * (first ? 1 : 0.4));
    var gBonus = Math.round(mission.reward * ({ S: 0.6, A: 0.4, B: 0.2, C: 0 }[grade] || 0));
    var dBonus = Math.round(mission.reward * (game.difficulty.id === 'hard' ? 0.25 : 0));
    var total = reward + gBonus + dBonus;

    game.profile.credits += total;
    if (first) {
      game.profile.supplies.grenade = 0;
      game.profile.supplies.medkit = 0;
    }
    var rec = game.profile.missions[mission.id] || { done: false, best: '', time: 0, plays: 0 };
    rec.done = true;
    rec.best = UI.bestGrade(rec.best, grade);
    rec.time = rec.time ? Math.min(rec.time, w.elapsed) : w.elapsed;
    rec.plays = (rec.plays || 0) + 1;
    game.profile.missions[mission.id] = rec;
    save();

    if (root.GameLimit && typeof root.GameLimit.count === 'function') {
      try { root.GameLimit.count('gun-game'); } catch (e) { /* noop */ }
    }

    var idx = C.MISSIONS.indexOf(mission);
    var nextId = null, nextName = '';
    if (idx >= 0 && idx + 1 < C.MISSIONS.length) {
      nextId = C.MISSIONS[idx + 1].id;
      nextName = C.MISSIONS[idx + 1].name;
    }

    game.state = 'results';
    game.firing = false;
    UI.hideHUD();
    UI.showResults({
      failed: false,
      mission: mission,
      grade: grade,
      stats: stats,
      reward: reward,
      gradeBonus: gBonus,
      diffBonus: dBonus,
      total: total,
      first: first,
      nextId: nextId,
      nextName: nextName
    });
  }

  /* ---------------- 输入 ---------------- */
  function bindInput() {
    var canvas = document.getElementById('gameCanvas');

    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return;
      e.preventDefault();
      Audio.init();
      if (game.state !== 'playing' || isPaused()) return;
      game.firing = true;
      onMove(e);
    });
    window.addEventListener('mouseup', function () { game.firing = false; });
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    canvas.addEventListener('wheel', function (e) {
      if (game.state !== 'playing' || isPaused() || !game.world) return;
      e.preventDefault();
      var p = game.world.player;
      var dir = e.deltaY > 0 ? 1 : -1;
      for (var i = 1; i <= p.weapons.length; i++) {
        var idx = ((p.cur + dir * i) % p.weapons.length + p.weapons.length) % p.weapons.length;
        if (p.weapons[idx] && (p.weapons[idx].mag > 0 || p.weapons[idx].reserve > 0)) {
          Ent.switchWeapon(p, idx, game.world);
          UI.refreshHud();
          break;
        }
      }
    }, { passive: false });

    window.addEventListener('keydown', function (e) {
      var code = e.code;
      if (code === 'Tab' || code === 'Space' || code.indexOf('Arrow') === 0) {
        if (game.state === 'playing') e.preventDefault();
      }
      if (e.repeat) {
        game.keys[code] = true;
        return;
      }
      game.keys[code] = true;
      Audio.init();

      if (game.state !== 'playing') {
        if (code === 'Escape' && game.state === 'briefing') goMenu();
        return;
      }
      if (isPaused()) {
        if (code === 'Escape' && game.paused.user && !game.paused.gate && !game.paused.rest) togglePause();
        return;
      }

      var w = game.world;
      if (!w) return;
      if (code === 'Escape') { togglePause(); return; }
      if (code === 'KeyR') { Ent.startReload(w.player, w); UI.refreshHud(); return; }
      if (code === 'Space') { game.dodgeReq = true; return; }
      if (code === 'KeyG') {
        var gx = game.mouse.x + (R.camReady ? R.cam.x : 0);
        var gy = game.mouse.y + (R.camReady ? R.cam.y : 0);
        w.throwGrenade(gx, gy);
        UI.refreshHud();
        return;
      }
      if (code === 'KeyV') { w.useMedkit(); UI.refreshHud(); return; }
      if (code === 'KeyF') { w.tryTakedown(); return; }
      if (/^Digit[1234]/.test(code)) {
        Ent.switchWeapon(w.player, parseInt(code.slice(5), 10) - 1, w);
        UI.refreshHud();
      }
    });

    window.addEventListener('keyup', function (e) { game.keys[e.code] = false; });
    window.addEventListener('blur', function () {
      game.keys = {};
      game.firing = false;
      if (game.state === 'playing' && !isPaused()) togglePause();
    });

    // 休息 / 门禁
    document.addEventListener('playclock:breakstart', function () {
      game.paused.rest = true;
      game.firing = false;
    });
    document.addEventListener('playclock:breakend', function () {
      game.paused.rest = false;
      game.lastTime = 0;
    });

    // 界面按钮
    document.getElementById('screenLayer').addEventListener('click', onScreenClick);
    var muteBtn = document.getElementById('muteBtn');
    if (muteBtn) {
      muteBtn.addEventListener('click', function () {
        Audio.init();
        Audio.toggleMute();
        muteBtn.textContent = Audio.isMuted() ? '音效 · 关' : '音效 · 开';
        Audio.play('ui');
      });
    }
    document.addEventListener('pointerdown', function () { Audio.init(); }, { once: true });
  }

  function onMove(e) {
    var canvas = document.getElementById('gameCanvas');
    var rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    if (!isFinite(e.clientX) || !isFinite(e.clientY)) return;
    game.mouse.x = (e.clientX - rect.left) / rect.width * C.VIEW.w;
    game.mouse.y = (e.clientY - rect.top) / rect.height * C.VIEW.h;
  }

  function onScreenClick(e) {
    var btn = e.target && e.target.closest ? e.target.closest('[data-act]') : null;
    if (!btn) return;
    var act = btn.getAttribute('data-act');
    var id = btn.getAttribute('data-id');
    Audio.init();
    Audio.play('ui');
    var p = game.profile;

    if (act === 'mission') { goBriefing(id); return; }
    if (act === 'shop') { goShop(); return; }
    if (act === 'menu') { goMenu(); return; }
    if (act === 'start') { G.start(id); return; }
    if (act === 'resume') { togglePause(); return; }
    if (act === 'abort') { abort(); return; }
    if (act === 'mute') {
      Audio.toggleMute();
      var mb = document.getElementById('muteBtn');
      if (mb) mb.textContent = Audio.isMuted() ? '音效 · 关' : '音效 · 开';
      UI.showMenu(game.profile, game.difficulty);
      return;
    }
    if (act === 'difficulty') {
      game.difficulty = game.difficulty.id === 'standard' ? C.DIFFICULTY.hard : C.DIFFICULTY.standard;
      p.difficulty = game.difficulty.id;
      save();
      UI.showMenu(p, game.difficulty);
      return;
    }
    if (act === 'buy-weapon') {
      var wi = null;
      C.SHOP.forEach(function (s) { if (s.weapon === id) wi = s; });
      if (!wi || p.unlocked[id] || p.credits < wi.cost) return;
      p.credits -= wi.cost;
      p.unlocked[id] = true;
      if (p.loadout.length < 3) p.loadout.push(id);
      save();
      Audio.play('buy');
      UI.showShop(p, game.difficulty);
      return;
    }
    if (act === 'toggle-weapon') {
      if (id === 'pistol') return;
      var at = p.loadout.indexOf(id);
      if (at >= 0) p.loadout.splice(at, 1);
      else if (p.loadout.length < 3) p.loadout.push(id);
      save();
      UI.showShop(p, game.difficulty);
      return;
    }
    if (act === 'buy-upgrade') {
      var item = null;
      C.SHOP.forEach(function (s) { if (s.kind === 'upgrade' && s.key === id) item = s; });
      if (!item) return;
      var lvl = p.upgrades[id] || 0;
      var cost = item.cost + lvl * item.step;
      if (lvl >= item.max || p.credits < cost) return;
      p.credits -= cost;
      p.upgrades[id] = lvl + 1;
      save();
      Audio.play('buy');
      UI.showShop(p, game.difficulty);
      return;
    }
    if (act === 'buy-supply') {
      var sup = null;
      C.SHOP.forEach(function (s) { if (s.kind === 'supply' && s.item === id) sup = s; });
      if (!sup || p.credits < sup.cost) return;
      var have = p.supplies[id] || 0;
      var add = sup.amount || 1;
      if (have >= (sup.max || 4)) return;
      p.credits -= sup.cost;
      p.supplies[id] = Math.min(sup.max || 4, have + add);
      save();
      Audio.play('buy');
      UI.showShop(p, game.difficulty);
    }
  }

  /* ---------------- 启动 ---------------- */
  function boot() {
    if (game.booted) return;
    game.booted = true;
    game.profile = loadProfile();
    game.difficulty = C.DIFFICULTY[game.profile.difficulty] || C.DIFFICULTY.standard;

    // 延迟解析模块引用，避免脚本加载顺序造成闭包捕获 undefined
    UI = GG.UI || UI;
    Ent = GG.Ent || Ent;
    World = GG.World || World;
    R = GG.Render || R;

    UI.init();
    R.init(document.getElementById('gameCanvas'));
    R.camReady = false;
    bindInput();

    var muteBtn = document.getElementById('muteBtn');
    if (muteBtn) muteBtn.textContent = Audio.isMuted() ? '音效 · 关' : '音效 · 开';

    goMenu();

    var m = /[?&]mission=([a-z0-9_-]+)/i.exec(location.search);
    if (m) {
      var id = m[1];
      var found = false;
      C.MISSIONS.forEach(function (mi) { if (mi.id === id) found = true; });
      if (found) {
        if (/[?&]start=1/.test(location.search)) G.start(id);
        else goBriefing(id);
      }
    }

    G.world = function () { return game.world; };
    G.profile = function () { return game.profile; };
    G.state = function () { return { state: game.state, paused: isPaused(), frame: game.frameCount }; };
    G.debug = function () {
      var p = game.world && game.world.player;
      return {
        mouse: { x: game.mouse.x, y: game.mouse.y },
        aim: p ? [p.aimX, p.aimY] : null,
        angle: p ? p.angle : null,
        cam: { x: R.cam.x, y: R.cam.y }
      };
    };
    console.log('[gun-game] v2 启动完成，任务数 ' + C.MISSIONS.length);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);
