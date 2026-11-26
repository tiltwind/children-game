/* ============================================================
 * game.js —— 主循环、输入、状态机、关卡流程
 * ============================================================ */
window.PVZ = window.PVZ || {};

(function (PVZ) {
  "use strict";

  var CFG = PVZ.CFG;
  var U = PVZ.Util;

  function Game(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.state = "menu";        // menu / playing / paused / win / lose
    this.world = null;
    this.level = null;
    this.selected = null;
    this.shovel = false;
    this.hoverCell = null;
    this.dpr = 1;
    this.scale = 1;
    this.lastT = 0;

    this.progress = U.Progress.read();
    this.muted = this.progress.muted;
    this.music = this.progress.music !== false;

    this._bindInput();
    this.resize();
    var self = this;
    window.addEventListener("resize", function () { self.resize(); });
  }

  // ---------- 尺寸与坐标 ----------
  Game.prototype.resize = function () {
    var rect = this.canvas.parentNode.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    var cw = Math.max(320, rect.width);
    var ch = Math.max(180, rect.height);
    this.canvas.width = Math.round(cw * this.dpr);
    this.canvas.height = Math.round(ch * this.dpr);
    this.scale = (cw * this.dpr) / CFG.W;
    // 高度按宽度等比，理论上与 canvas 比例一致
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.viewH = ch;
  };

  Game.prototype.toLogical = function (ev) {
    var rect = this.canvas.getBoundingClientRect();
    var x = (ev.clientX - rect.left) * (CFG.W / rect.width);
    var y = (ev.clientY - rect.top) * (CFG.H / rect.height);
    return { x: x, y: y };
  };

  Game.prototype.chapterPalette = function () {
    if (!this.level) return null;
    var ch = PVZ.CHAPTERS[this.level.chapter - 1];
    return ch ? ch.palette : null;
  };

  // ---------- 输入 ----------
  Game.prototype._bindInput = function () {
    var self = this;

    this.canvas.addEventListener("pointermove", function (ev) {
      var p = self.toLogical(ev);
      self.hoverCell = U.pointToCell(p.x, p.y);
    });

    this.canvas.addEventListener("pointerleave", function () {
      self.hoverCell = null;
    });

    this.canvas.addEventListener("pointerdown", function (ev) {
      ev.preventDefault();
      if (self.state !== "playing") return;
      var p = self.toLogical(ev);
      self.pointerDown(p);
    });

    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") {
        if (self.selected || self.shovel) {
          self.selected = null;
          self.shovel = false;
          PVZ.HUD.updateShovel(false);
        } else if (self.state === "playing") {
          self.togglePause();
        }
        return;
      }
      if (ev.key === "p" || ev.key === "P") {
        if (self.state === "playing" || self.state === "paused") self.togglePause();
        return;
      }
      if (self.state !== "playing" || !self.level) return;
      var n = parseInt(ev.key, 10);
      if (n >= 1 && n <= self.level.unlock.length) {
        self.selectSeed(self.level.unlock[n - 1]);
      }
    });
  };

  Game.prototype.pointerDown = function (p) {
    var world = this.world;
    if (!world) return;

    // 先收阳光（优先级最高）
    for (var i = 0; i < world.suns.length; i++) {
      var s = world.suns[i];
      if (s.collected) continue;
      var dx = s.x - p.x, dy = s.y - p.y;
      if (dx * dx + dy * dy <= 66 * 66) {
        world.collectSun(s);
        return;
      }
    }

    var cell = U.pointToCell(p.x, p.y);
    if (!cell) return;

    if (this.shovel) {
      var removed = world.removePlant(cell.row, cell.col);
      if (removed) PVZ.HUD.toast("已铲除");
      return;
    }

    if (!this.selected) {
      var target = world.grid[cell.row][cell.col];
      if (target && target.upgradeInfo && target.upgradeInfo()) {
        var up = world.tryUpgrade(cell.row, cell.col);
        PVZ.HUD.toast(up.ok ? ("已升级为 " + up.name) : up.reason);
        PVZ.HUD.setSun(world.sun);
        return;
      }
      PVZ.HUD.toast("先选一张种子卡");
      return;
    }

    var res = world.tryPlant(cell.row, cell.col, this.selected);
    if (!res.ok) {
      PVZ.HUD.toast(res.reason);
    } else {
      this.selected = null;
      PVZ.HUD.updateCooldowns(world);
    }
  };

  // ---------- 选卡 / 铲子 ----------
  Game.prototype.selectSeed = function (id) {
    if (this.state !== "playing") return;
    this.shovel = false;
    PVZ.HUD.updateShovel(false);
    if (this.selected === id) {
      this.selected = null;
    } else {
      this.selected = id;
      var spec = PVZ.PLANT_MAP[id];
      if (spec && this.world.sun < spec.cost) {
        PVZ.HUD.toast("阳光还差 " + (spec.cost - this.world.sun));
      }
    }
    PVZ.Audio.play("click");
    PVZ.HUD.updateCooldowns(this.world);
  };

  Game.prototype.toggleShovel = function () {
    if (this.state !== "playing") return;
    this.shovel = !this.shovel;
    this.selected = null;
    PVZ.HUD.updateShovel(this.shovel);
    PVZ.Audio.play("click");
  };

  // ---------- 关卡流程 ----------
  Game.prototype.startLevel = function (id) {
    var level = PVZ.LEVEL_MAP[id];
    if (!level) return;

    // 一关最多打两次：通关两次后锁定，只能去下一关
    if (U.Progress.isMaxed(U.Progress.read(), id)) {
      PVZ.Audio.play("warn");
      PVZ.HUD.showLevelDone(id);
      return;
    }

    this.level = level;
    this.world = new PVZ.World(level, PVZ.Audio);
    this.selected = null;
    this.shovel = false;
    this.state = "playing";
    if (PVZ.ensureGate) PVZ.ensureGate();

    var world = this.world;
    var self = this;

    world.on("sun", function (v) { PVZ.HUD.setSun(v); });
    world.on("wave", function (info) {
      PVZ.HUD.setWave(info.index, info.total);
      if (info.final) {
        PVZ.HUD.banner("一大波僵尸正在接近", 2400);
      }
    });
    world.on("mower", function () {
      PVZ.HUD.toast("割草机启动，这一行暂时安全");
    });
    world.on("win", function (data) { self.onWin(data); });
    world.on("lose", function (data) { self.onLose(data); });

    PVZ.HUD.hideModal();
    PVZ.HUD.setLevel(level);
    PVZ.HUD.setSun(world.sun);
    PVZ.HUD.setWave(0, world.totalWaves);
    PVZ.HUD.renderSeeds(level);
    PVZ.HUD.updateShovel(false);
    PVZ.HUD.updateCooldowns(world);
    PVZ.Audio.play("click");
    PVZ.Audio.startBGM();
  };

  Game.prototype.restartLevel = function () {
    if (!this.level) return;
    this.startLevel(this.level.id);
  };

  Game.prototype.nextLevel = function () {
    if (!this.level) return;
    var next = PVZ.LEVEL_MAP[this.level.id + 1];
    if (next) this.startLevel(next.id);
    else PVZ.HUD.showLevelSelect();
  };

  Game.prototype.computeStars = function (world) {
    var stars = 1;
    var lastWave = this.level.waves[this.level.waves.length - 1];
    var target = lastWave.at + 40;
    if (world.stats.plantsLost <= 5) stars = 2;
    if (world.stats.plantsLost <= 2 && world.time <= target) stars = 3;
    return stars;
  };

  function fmtTime(sec) {
    var m = Math.floor(sec / 60);
    var s = Math.floor(sec % 60);
    return m + ":" + (s < 10 ? "0" + s : s);
  }

  Game.prototype.onWin = function (data) {
    this.state = "win";
    /* 通过一关记一次完整游戏：玩满 5 关，本游戏休息 15 分钟 */
    if (window.GameLimit) window.GameLimit.count("pvz");
    PVZ.Audio.stopBGM();
    var stars = this.computeStars(this.world);
    U.Progress.markCleared(this.progress, this.level.id, stars);
    this.progress.muted = this.muted;
    this.progress.music = this.music;
    U.Progress.write(this.progress);

    PVZ.Audio.play("win");
    PVZ.HUD.showWin({
      level: this.level,
      stars: stars,
      timeText: fmtTime(data.time),
      stats: data.stats,
      sun: data.sun
    });
  };

  Game.prototype.onLose = function (data) {
    PVZ.Audio.stopBGM();
    this.state = "lose";
    PVZ.HUD.showLose({
      level: this.level,
      row: data.row,
      time: data.time,
      stats: data.stats,
      waveIndex: this.world.waveIdx,
      totalWaves: this.world.totalWaves
    });
  };

  Game.prototype.togglePause = function () {
    if (this.state === "playing") {
      this.state = "paused";
      PVZ.Audio.stopBGM();
      PVZ.HUD.showPause();
    } else if (this.state === "paused") {
      this.state = "playing";
      PVZ.HUD.hideModal();
      PVZ.Audio.startBGM();
    }
  };

  // ---------- 24 点门禁 ----------
  Game.prototype.gateLock = function () {
    if (this.state !== "playing") return;
    this._gateResume = true;
    this.state = "gate";
    this.selected = null;
    this.shovel = false;
    if (PVZ.HUD.updateShovel) PVZ.HUD.updateShovel(false);
  };

  Game.prototype.gateUnlock = function () {
    if (!this._gateResume) return;
    this._gateResume = false;
    if (this.state === "gate") this.state = "playing";
    this.lastT = performance.now();
  };


  // ---------- 全站强制休息 ----------
  Game.prototype.breakLock = function () {
    if (this.state !== "playing") return;
    this._breakResume = true;
    this.state = "break";
    this.selected = null;
    this.shovel = false;
    if (PVZ.HUD.updateShovel) PVZ.HUD.updateShovel(false);
  };

  Game.prototype.breakUnlock = function () {
    if (!this._breakResume) return;
    this._breakResume = false;
    if (this.state === "break") this.state = "playing";
    this.lastT = performance.now();
  };

  Game.prototype.toggleMusic = function () {
    this.music = !this.music;
    PVZ.Audio.setMusic(this.music);
    PVZ.HUD.setMusic(this.music);
    this.progress.music = this.music;
    U.Progress.write(this.progress);
    if (this.music && this.state === "playing") PVZ.Audio.startBGM();
  };

  Game.prototype.toggleMute = function () {
    this.muted = !this.muted;
    PVZ.Audio.setMuted(this.muted);
    PVZ.HUD.setMute(this.muted);
    if (!this.muted && this.state === "playing") PVZ.Audio.startBGM();
    this.progress.muted = this.muted;
    U.Progress.write(this.progress);
    if (!this.muted) PVZ.Audio.play("click");
  };

  // ---------- 主循环 ----------
  Game.prototype.start = function () {
    var self = this;
    this.lastT = performance.now();
    function frame(t) {
      var dt = (t - self.lastT) / 1000;
      self.lastT = t;
      if (dt > 0.25) dt = 0.25;

      if (self.state === "playing" && PVZ.gate) PVZ.gate.tick(dt);

      if (self.state === "playing" && self.world) {
        self.world.update(dt);
        PVZ.HUD.setSun(self.world.sun);
        PVZ.HUD.updateCooldowns(self.world);
      }
      self.draw();
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  };

  Game.prototype.draw = function () {
    var ctx = this.ctx;
    ctx.save();
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    PVZ.Render.draw(ctx, this);
    ctx.restore();
  };

  PVZ.Game = Game;
})(window.PVZ);
