/* ============================================================
 * world.js —— 一局战斗的全部权威状态
 * 职责：网格占用、阳光经济、植物冷却、波次调度、命中与爆炸结算、
 *       割草机、胜负判定。渲染与 DOM 不在这里。
 * ============================================================ */
window.PVZ = window.PVZ || {};

(function (PVZ) {
  "use strict";

  var U = PVZ.Util;
  var CFG = PVZ.CFG;
  var E = PVZ.Entities;

  function World(level, audio) {
    this.level = level;
    this.audio = audio;
    this.time = 0;
    this.state = "running";          // running / win / lose
    this.sun = level.sunStart;
    this.speedMul = level.speedMul || 1;
    this.hpMul = level.hpMul || 1;
    this.cooldownMul = level.cooldownMul || 1;

    this.grid = [];
    for (var r = 0; r < CFG.ROWS; r++) {
      var row = [];
      for (var c = 0; c < CFG.COLS; c++) row.push(null);
      this.grid.push(row);
    }

    this.zombies = [];
    this.projectiles = [];
    this.suns = [];
    this.particles = [];
    this.mowers = [];
    for (var i = 0; i < CFG.ROWS; i++) this.mowers.push(new E.Mower(i));

    this.cooldowns = {};
    PVZ.PLANTS.forEach(function (p) { this.cooldowns[p.id] = 0; }, this);

    this.sunTimer = 0;
    this.nextSunIn = U.rand(CFG.sunMinInterval, CFG.sunMaxInterval);

    this.schedule = this.buildSchedule(level);
    this.spawnIdx = 0;
    this.waveIdx = 0;
    this.totalWaves = level.waves.length;
    this.lastSpawnAt = this.schedule.length ? this.schedule[this.schedule.length - 1].t : 0;
    this.allSpawned = false;

    this.stats = { plantsLost: 0, sunsCollected: 0, kills: 0, planted: 0 };
    this.emitter = new U.Emitter();
  }

  World.prototype.on = function (name, fn) { this.emitter.on(name, fn); return this; };
  World.prototype.emit = function (name, payload) { this.emitter.emit(name, payload); };

  // ---------- 波次表 ----------
  World.prototype.buildSchedule = function (level) {
    var list = [];
    level.waves.forEach(function (w) {
      w.groups.forEach(function (g) {
        var type = g[0], count = g[1], gap = g[2] === undefined ? 2 : g[2];
        for (var i = 0; i < count; i++) {
          list.push({ t: w.at + i * gap, type: type, wave: w.at, boss: false });
        }
      });
      if (w.boss && level.boss) {
        list.push({ t: w.at, type: level.boss.type, wave: w.at, boss: true });
      }
    });
    list.sort(function (a, b) { return a.t - b.t; });
    return list;
  };

  // ---------- 行分配：整体分散，偶尔集中施压 ----------
  World.prototype.pickRow = function () {
    var counts = [];
    for (var i = 0; i < CFG.ROWS; i++) counts.push(0);
    this.zombies.forEach(function (z) { if (!z.dead) counts[z.row]++; });
    if (Math.random() < 0.4) return U.randInt(0, CFG.ROWS - 1);
    var min = Math.min.apply(null, counts);
    var cand = [];
    for (var r = 0; r < CFG.ROWS; r++) if (counts[r] <= min + 1) cand.push(r);
    return U.pick(cand);
  };

  // ---------- 主循环 ----------
  World.prototype.update = function (dt) {
    if (this.state !== "running") return;
    dt = Math.min(dt, 0.05);
    this.time += dt;

    // 冷却
    for (var id in this.cooldowns) {
      if (this.cooldowns[id] > 0) this.cooldowns[id] = Math.max(0, this.cooldowns[id] - dt);
    }

    this.spawnDue();
    this.updatePlants(dt);
    this.updateZombies(dt);
    this.updateProjectiles(dt);
    this.updateSuns(dt);
    this.updateMowers(dt);
    this.updateParticles(dt);
    this.updateSunSky(dt);
    this.cleanup();

    this.checkWin();
  };

  World.prototype.spawnDue = function () {
    while (this.spawnIdx < this.schedule.length && this.schedule[this.spawnIdx].t <= this.time) {
      var item = this.schedule[this.spawnIdx++];
      this.spawnZombie(item.type, this.pickRow(), {
        hpMul: this.hpMul * (item.boss && this.level.boss ? this.level.boss.hpMul : 1),
        speedMul: this.speedMul,
        scale: item.boss && this.level.boss ? this.level.boss.scale : 1,
        boss: !!item.boss,
        name: item.boss && this.level.boss ? this.level.boss.name : null
      });
    }
    if (!this.allSpawned && this.spawnIdx >= this.schedule.length) {
      this.allSpawned = true;
    }

    // 波次提示
    var waves = this.level.waves;
    while (this.waveIdx < waves.length && this.time >= waves[this.waveIdx].at) {
      this.waveIdx++;
      var isFinal = this.waveIdx === waves.length;
      this.emit("wave", { index: this.waveIdx, total: waves.length, final: isFinal });
      if (this.audio) {
        if (isFinal) this.audio.play("warn");
        else this.audio.play("wave");
      }
    }
  };

  World.prototype.spawnZombie = function (type, row, opts) {
    opts = opts || {};
    var z = new E.Zombie(type, row, {
      x: CFG.grid.right + CFG.cellW * (CFG.zombieStartGap + U.rand(0, 0.6)),
      hpMul: opts.hpMul || this.hpMul,
      speedMul: opts.speedMul || this.speedMul,
      scale: opts.scale || 1,
      boss: opts.boss,
      name: opts.name
    });
    this.zombies.push(z);
    return z;
  };

  World.prototype.updatePlants = function (dt) {
    for (var r = 0; r < CFG.ROWS; r++) {
      for (var c = 0; c < CFG.COLS; c++) {
        var p = this.grid[r][c];
        if (p) {
          p.update(dt, this);
          if (p.dead) {
            this.grid[r][c] = null;
            this.stats.plantsLost++;
            this.burst(p.x, p.y, "#7fc96a", 6);
          }
        }
      }
    }
  };

  World.prototype.updateZombies = function (dt) {
    for (var i = 0; i < this.zombies.length; i++) {
      var z = this.zombies[i];
      if (z.dead) continue;
      z.update(dt, this);
      if (z.dead) {
        this.stats.kills++;
        this.burst(z.x, z.y + CFG.cellH * 0.2, "#8fa88c", 8);
        if (this.audio) this.audio.play("groan");
      }
    }
  };

  World.prototype.updateProjectiles = function (dt) {
    for (var i = 0; i < this.projectiles.length; i++) {
      var p = this.projectiles[i];
      if (!p.dead) p.update(dt, this);
    }
  };

  World.prototype.updateSuns = function (dt) {
    for (var i = 0; i < this.suns.length; i++) {
      var s = this.suns[i];
      if (s.collected) continue;
      s.update(dt);
      if (s.life <= 0) s.collected = true;
    }
  };

  World.prototype.updateMowers = function (dt) {
    for (var i = 0; i < this.mowers.length; i++) {
      var m = this.mowers[i];
      m.update(dt, this);
      if (m.state !== "running") continue;
      // 碾压本行僵尸
      for (var j = 0; j < this.zombies.length; j++) {
        var z = this.zombies[j];
        if (!z.dead && z.row === m.row && Math.abs(z.x - m.x) < CFG.cellW * 0.55) {
          z.hp = 0;
          z.dead = true;
          this.stats.kills++;
          this.burst(z.x, z.y, "#b7c7a8", 10);
        }
      }
    }
  };

  World.prototype.updateParticles = function (dt) {
    for (var i = 0; i < this.particles.length; i++) {
      var p = this.particles[i];
      if (!p.dead) p.update(dt);
    }
  };

  World.prototype.updateSunSky = function (dt) {
    this.sunTimer += dt;
    if (this.sunTimer >= this.nextSunIn) {
      this.sunTimer = 0;
      this.nextSunIn = this.level.sunInterval + U.rand(-1.5, 1.5);
      var x = U.rand(CFG.grid.left + CFG.cellW * 0.5, CFG.grid.right - CFG.cellW);
      var y = U.rand(CFG.grid.top + CFG.cellH, CFG.grid.bottom - CFG.cellH);
      this.suns.push(new E.Sun(x, CFG.grid.top + 8, CFG.sunValue, { tx: x, ty: y, vy: 40 }));
    }
  };

  World.prototype.cleanup = function () {
    this.zombies = this.zombies.filter(function (z) { return !z.dead; });
    this.projectiles = this.projectiles.filter(function (p) { return !p.dead; });
    this.suns = this.suns.filter(function (s) { return !s.collected; });
    if (this.particles.length > CFG.particleLimit) {
      this.particles = this.particles.slice(this.particles.length - CFG.particleLimit);
    }
    this.particles = this.particles.filter(function (p) { return !p.dead; });
  };

  World.prototype.checkWin = function () {
    if (this.state !== "running") return;
    if (this.allSpawned && this.zombies.length === 0 && this.time > 4) {
      this.state = "win";
      this.emit("win", { time: this.time, stats: this.stats, sun: this.sun });
    }
  };

  // ---------- 种植与铲除 ----------
  World.prototype.canPlant = function (row, col, plantId) {
    if (this.state !== "running") return { ok: false, reason: "本局已结束" };
    var spec = PVZ.PLANT_MAP[plantId];
    if (!spec) return { ok: false, reason: "没有这种植物" };
    if (this.level.unlock.indexOf(plantId) < 0) return { ok: false, reason: "本关还没有解锁" };
    if (this.grid[row][col]) return { ok: false, reason: "这一格已经种了植物" };
    if (this.cooldowns[plantId] > 0) return { ok: false, reason: "卡片冷却中" };
    if (this.sun < spec.cost) return { ok: false, reason: "阳光不够" };
    return { ok: true, spec: spec };
  };

  World.prototype.tryPlant = function (row, col, plantId) {
    var check = this.canPlant(row, col, plantId);
    if (!check.ok) {
      if (this.audio) this.audio.play("error");
      return check;
    }
    var spec = check.spec;
    var plant = new E.Plant(spec, row, col);
    this.grid[row][col] = plant;
    this.sun -= spec.cost;
    this.cooldowns[plantId] = spec.cooldown * this.cooldownMul;
    this.stats.planted++;
    this.puff(plant.x, plant.y + CFG.cellH * 0.2);
    if (this.audio) this.audio.play("plant");
    this.emit("sun", this.sun);
    return { ok: true, plant: plant };
  };

  World.prototype.removePlant = function (row, col) {
    var p = this.grid[row][col];
    if (!p) return false;
    this.grid[row][col] = null;
    p.dead = true;
    this.stats.plantsLost++;
    this.burst(p.x, p.y, "#a98f5d", 7);
    if (this.audio) this.audio.play("shovel");
    return true;
  };

  // ---------- 阳光 ----------
  World.prototype.collectSun = function (sun) {
    if (sun.collected) return 0;
    sun.collected = true;
    this.sun += sun.value;
    this.stats.sunsCollected += sun.value;
    this.burst(sun.x, sun.y, "#ffe066", 6, { vy: -90, g: 60 });
    if (this.audio) this.audio.play("sun");
    this.emit("sun", this.sun);
    return sun.value;
  };

  World.prototype.spawnSunFromPlant = function (plant) {
    var tx = plant.x + U.rand(-26, 26);
    var ty = plant.y + CFG.cellH * 0.32 + U.rand(-6, 8);
    this.suns.push(new E.Sun(plant.x, plant.y - CFG.cellH * 0.42, plant.spec.produce, {
      tx: tx, ty: ty, vy: 20
    }));
    this.puff(plant.x, plant.y - 10);
  };

  // ---------- 射击 ----------
  World.prototype.hasTargetAhead = function (row, col) {
    var fromX = U.xOfCol(col) + CFG.cellW * 0.3;
    for (var i = 0; i < this.zombies.length; i++) {
      var z = this.zombies[i];
      if (!z.dead && z.row === row && z.x > fromX) return true;
    }
    return false;
  };

  World.prototype.zombieAtCell = function (row, col) {
    var cx = U.xOfCol(col) + CFG.cellW * 0.5;
    for (var i = 0; i < this.zombies.length; i++) {
      var z = this.zombies[i];
      if (!z.dead && z.row === row && Math.abs(z.x - cx) < CFG.cellW * 0.62) return z;
    }
    return null;
  };

  // 花阳光把一株已种下的植物升到下一级
  World.prototype.tryUpgrade = function (row, col) {
    var p = this.grid[row][col];
    if (!p) return { ok: false, reason: "这一格没有植物" };
    var up = p.upgradeInfo ? p.upgradeInfo() : null;
    if (!up) return { ok: false, reason: "" };
    if (this.sun < up.cost) {
      return { ok: false, reason: "升级需要 " + up.cost + " 阳光，还差 " + (up.cost - this.sun) };
    }
    this.sun -= up.cost;
    p.applyUpgrade();
    this.burst(p.x, p.y - CFG.cellH * 0.45, "#ffe27a", 16, { r: 4, g: 70, life: 0.55 });
    if (this.audio) this.audio.play("levelup");
    return { ok: true, name: up.name, cost: up.cost };
  };

  World.prototype.fireStraight = function (plant, spec, pierce) {
    var muzzleX = plant.x + CFG.cellW * 0.34;
    var muzzleY = plant.y - CFG.cellH * (pierce ? 0.04 : 0.10);
    var shots = spec.shots || 1;
    // 多发型：同一次开火喷出 N 颗，后方的略微错位，形成一道连发的豆流
    for (var s = 0; s < shots; s++) {
      this.projectiles.push(new E.Projectile(pierce ? "pierce" : "pea", {
        row: plant.row,
        x: muzzleX - s * CFG.cellW * 0.12,
        y: muzzleY,
        damage: spec.damage,
        speed: spec.bulletSpeed * CFG.cellW * 0.9,
        pierce: pierce,
        explosive: !!spec.explosive,
        splashDamage: spec.splashDamage || 0,
        splashRadius: spec.splashRadius || 1,
        gatling: !!spec.gatling
      }));
    }
    this.burst(muzzleX, muzzleY, pierce ? "#ffe9a8" : (spec.gatling ? "#ffcf7a" : "#c8f08a"), 3,
      { vy: U.rand(-40, -10), g: 40, life: 0.22 });
    if (this.audio) this.audio.play(pierce ? "sniper" : (spec.gatling ? "gatling" : "shot"));
  };

  World.prototype.fireLob = function (plant, spec) {
    // 打本行最靠前的僵尸
    var target = null;
    for (var i = 0; i < this.zombies.length; i++) {
      var z = this.zombies[i];
      if (!z.dead && z.row === plant.row && z.x > plant.x) {
        if (!target || z.x < target.x) target = z;
      }
    }
    var targetX = target ? target.x + CFG.cellW * 0.1 : plant.x + CFG.cellW * 7;
    this.projectiles.push(new E.Projectile("lob", {
      row: plant.row,
      x: plant.x + 10,
      y: plant.y - CFG.cellH * 0.2,
      damage: spec.damage,
      speed: CFG.cellW * 3.4,
      arc: spec.arc,
      targetX: targetX
    }));
    if (this.audio) this.audio.play("shot");
  };

  World.prototype.checkProjectileHit = function (p) {
    var hitW = CFG.cellW * 0.42;
    for (var i = 0; i < this.zombies.length; i++) {
      var z = this.zombies[i];
      if (z.dead || z.row !== p.row) continue;
      if (Math.abs(z.x - p.x) > hitW) continue;
      if (p.kind === "pierce") {
        if (p.hitSet && p.hitSet[z.uid]) continue;
        if (p.hitSet) p.hitSet[z.uid] = 1;
        z.hurt(p.damage, "pierce");
        this.impact(z.x - CFG.cellW * 0.18, p.y, "#ffe9a8");
        if (this.audio) this.audio.play("sniperHit");
        if (z.dead) { this.stats.kills++; this.burst(z.x, z.y, "#93a58c", 8); if (this.audio) this.audio.play("groan"); }
        continue;
      }
      // 普通豌豆：命中即消失
      z.hurt(p.damage, "pea");
      p.dead = true;
      this.impact(p.x, p.y, p.explosive ? "#ffc35c" : "#d7f59a");
      if (p.explosive) this.splash(p.row, p.x, p.y, p.splashDamage, p.splashRadius, z);
      if (this.audio) this.audio.play(p.explosive ? "burst" : "hit");
      if (z.dead) { this.stats.kills++; this.burst(z.x, z.y, "#93a58c", 8); if (this.audio) this.audio.play("groan"); }
      return;
    }
  };

  // 爆炸弹的小范围杀伤：只打同一行、以命中点为中心的一小圈
  World.prototype.splash = function (row, x, y, damage, radius, exclude) {
    var reach = CFG.cellW * (radius || 1);
    for (var i = 0; i < this.zombies.length; i++) {
      var z = this.zombies[i];
      if (z.dead || z.row !== row || z === exclude) continue;
      if (Math.abs(z.x - x) > reach) continue;
      z.hurt(damage, "splash");
      if (z.dead) { this.stats.kills++; this.burst(z.x, z.y, "#93a58c", 8); }
    }
    this.burst(x, y, "#ffb347", 8, { r: 3, g: 120, life: 0.32 });
  };

  World.prototype.onLobLand = function (p) {
    p.dead = true;
    this.impact(p.x, p.y + CFG.cellH * 0.16, "#9be07a");
    if (this.audio) this.audio.play("hit");
    for (var i = 0; i < this.zombies.length; i++) {
      var z = this.zombies[i];
      if (!z.dead && z.row === p.row && Math.abs(z.x - p.x) < CFG.cellW * 0.55) {
        z.hurt(p.damage, "lob");
        if (z.dead) { this.stats.kills++; this.burst(z.x, z.y, "#93a58c", 8); if (this.audio) this.audio.play("groan"); }
      }
    }
  };

  // ---------- 爆炸 ----------
  World.prototype.explodeAt = function (row, col, radius, damage, kind, source) {
    var cx = U.xOfCol(col) + CFG.cellW * 0.5;
    var reach = CFG.cellW * (radius || 1);
    for (var i = 0; i < this.zombies.length; i++) {
      var z = this.zombies[i];
      if (z.dead || z.row !== row) continue;
      if (Math.abs(z.x - cx) <= reach) {
        z.hurt(damage, "blast");
        if (z.dead) { this.stats.kills++; this.burst(z.x, z.y, "#93a58c", 8); }
      }
    }
    this.burst(cx, U.cellCenter(row, col).y, "#ffcf5c", 22, { r: 4, g: 220, life: 0.55 });
    this.burst(cx, U.cellCenter(row, col).y, "#5c4a2a", 12, { r: 3, g: 160 });
    if (source) source.dead = true;
    if (this.audio) this.audio.play(kind === "mine" ? "mine" : "boom");
  };

  World.prototype.blastGrid = function (row, col, gridRadius, damage, source) {
    var cx = U.xOfCol(col) + CFG.cellW * 0.5;
    var cy = U.cellCenter(row, col).y;
    for (var i = 0; i < this.zombies.length; i++) {
      var z = this.zombies[i];
      if (z.dead) continue;
      if (Math.abs(z.row - row) > gridRadius) continue;
      if (Math.abs(z.x - cx) < CFG.cellW * (gridRadius + 0.55)) {
        z.hurt(damage, "blast");
        if (z.dead) { this.stats.kills++; this.burst(z.x, z.y, "#93a58c", 8); }
      }
    }
    var radiusPx = CFG.cellW * (gridRadius + 0.6);
    var count = gridRadius >= 2 ? 56 : 34;
    for (var k = 0; k < count; k++) {
      var ang = Math.random() * Math.PI * 2;
      var sp = U.rand(60, 320);
      this.particles.push(new E.Particle(cx, cy, {
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 40,
        g: 120,
        r: U.rand(3, 8),
        life: U.rand(0.4, 0.9),
        color: k % 3 === 0 ? "#ffe066" : (k % 3 === 1 ? "#ff8a3d" : "#5c4a2a")
      }));
    }
    if (source) source.dead = true;
    if (this.audio) this.audio.play(gridRadius >= 2 ? "doom" : "boom");
  };

  // ---------- 事件回调 ----------
  World.prototype.onVault = function (z) {
    this.burst(z.x, z.y - CFG.cellH * 0.2, "#e4f0d6", 8, { vy: -40, g: 60 });
    if (this.audio) this.audio.play("shovel");
  };

  World.prototype.emitChomp = function (z) {
    if (this.audio) this.audio.play("chomp");
  };

  World.prototype.onZombieReachHouse = function (z) {
    var mower = this.mowers[z.row];
    if (mower && mower.state === "idle") {
      mower.state = "running";
      if (this.audio) this.audio.play("mower");
      this.emit("mower", mower);
      // 割草机启动瞬间就碾过这只僵尸
      z.hp = 0;
      z.dead = true;
      this.stats.kills++;
      return;
    }
    if (mower && mower.state === "running") {
      z.hp = 0;
      z.dead = true;
      this.stats.kills++;
      return;
    }
    if (z.dead) return;
    z.dead = true;
    this.state = "lose";
    this.emit("lose", { row: z.row, time: this.time, stats: this.stats });
  };

  // ---------- 粒子工具 ----------
  World.prototype.burst = function (x, y, color, count, opts) {
    opts = opts || {};
    for (var i = 0; i < count; i++) {
      this.particles.push(new E.Particle(x, y, {
        vx: U.rand(-150, 150),
        vy: opts.vy === undefined ? U.rand(-180, -30) : opts.vy,
        g: opts.g === undefined ? 260 : opts.g,
        r: opts.r || U.rand(2, 5),
        life: opts.life || U.rand(0.3, 0.6),
        color: color
      }));
    }
  };

  World.prototype.impact = function (x, y, color) {
    this.burst(x, y, color, 5, { r: 2.5, life: 0.26, g: 200 });
  };

  World.prototype.puff = function (x, y) {
    this.burst(x, y, "#d9f2c4", 7, { r: 3, vy: U.rand(-60, -10), g: 120, life: 0.4 });
  };

  World.prototype.activeZombies = function () {
    var n = 0;
    for (var i = 0; i < this.zombies.length; i++) if (!this.zombies[i].dead) n++;
    return n;
  };

  PVZ.World = World;
})(window.PVZ);
