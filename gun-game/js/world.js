/* ============================================================
 * world.js —— 一局任务的权威状态：战斗、目标、波次、胜负
 * 依赖：config / util / map / entities / audio
 * ============================================================ */
(function (root) {
  'use strict';
  var GG = (root.GG = root.GG || {});
  var C = GG.C, U = GG.U, Ent = GG.Ent, TILE = C.TILE;

  function rayCircle(ox, oy, dx, dy, max, cx, cy, r) {
    var ocx = cx - ox, ocy = cy - oy;
    var b = ocx * dx + ocy * dy;
    var c = ocx * ocx + ocy * ocy - r * r;
    var disc = b * b - c;
    if (disc < 0) return -1;
    var t = b - Math.sqrt(disc);
    if (t < 0) t = b + Math.sqrt(disc);
    if (t < 0 || t > max) return -1;
    return t;
  }

  function World(mission, profile, loadout, difficulty) {
    this.mission = mission;
    this.map = GG.Map.create(mission);
    this.difficulty = difficulty || C.DIFFICULTY.standard;
    this.player = Ent.createPlayer(this.map, profile, loadout);
    this.enemies = [];
    this.bullets = [];
    this.grenades = [];
    this.particles = [];
    this.tracers = [];
    this.decals = [];
    this.blasts = [];
    this.floaters = [];
    this.pickups = this.map.pickups.map(function (p) {
      return { type: p.type, x: p.x, y: p.y, alive: true, t: 0 };
    });
    this.terminals = this.map.props.filter(function (p) { return p.type === 'terminal'; });
    this.status = 'playing';
    this.elapsed = 0;
    this.time = 0;
    this.flowT = 0;
    this.extractionOpen = false;
    this.extractionT = 0;
    this.interact = null;
    this.interactT = 0;
    this.hitMarker = 0;
    this.killMarker = 0;
    this.shakeT = 0;
    this.shakeMag = 0;
    this.toastCb = null;
    this.toasts = [];
    this.stats = {
      kills: 0, shots: 0, hits: 0, alerts: 0, stealthKills: 0,
      damageTaken: 0, grenades: 0, time: 0
    };
    this.objective = {
      hacked: 0, required: mission.objective.count || 0,
      holdT: 0, remain: mission.objective.seconds || 0,
      done: false
    };
    this.waveIndex = 0;
    this.spawnQueue = [];
    this.bossAddT = mission.bossAdds ? mission.bossAdds.interval : 0;
    this.enemyTotal = 0;
    this.initEnemies();
  }

  World.prototype.initEnemies = function () {
    var self = this;
    this.map.enemySpawns.forEach(function (s) {
      self.spawnEnemy(s.type, (s.cx + 0.5) * TILE + U.rand(-8, 8), (s.cy + 0.5) * TILE + U.rand(-8, 8));
    });
  };

  World.prototype.play = function (name, vol) {
    if (GG.Audio) GG.Audio.play(name, vol);
  };

  World.prototype.spawnEnemy = function (type, x, y, opts) {
    var e = Ent.createEnemy(type, x, y, this, opts);
    if (this.map.circleHits(x, y, e.r)) {
      var f = this.map.findFloor(Math.floor(x / TILE), Math.floor(y / TILE));
      e.x = (f[0] + 0.5) * TILE;
      e.y = (f[1] + 0.5) * TILE;
    }
    this.enemies.push(e);
    this.enemyTotal++;
    return e;
  };

  World.prototype.summonAdds = function (x, y, type, count) {
    for (var i = 0; i < count; i++) {
      var f = this.map.findFloor(Math.floor(x / TILE) + U.randInt(-3, 3), Math.floor(y / TILE) + U.randInt(-3, 3));
      this.spawnEnemy(type, (f[0] + 0.5) * TILE, (f[1] + 0.5) * TILE, { alert: true, alertX: x, alertY: y });
      this.addParticle('flash', (f[0] + 0.5) * TILE, (f[1] + 0.5) * TILE, 0, 0, 0.35, 26, '#ffcf7a');
    }
  };

  World.prototype.onEnemyAlert = function (e) {
    this.stats.alerts++;
    this.alertNear(e.x, e.y, 320, e);
    if (e.type === 'm') this.play('alert', 0.5);
  };

  World.prototype.alertNear = function (x, y, radius, source) {
    for (var i = 0; i < this.enemies.length; i++) {
      var e = this.enemies[i];
      if (!e.alive || e === source || e.alerted) continue;
      if (U.dist(e.x, e.y, x, y) > radius) continue;
      Ent.alertEnemy(e, this, x, y);
    }
  };

  World.prototype.noise = function (x, y, radius, label) {
    for (var i = 0; i < this.enemies.length; i++) {
      var e = this.enemies[i];
      if (!e.alive) continue;
      if (U.dist(e.x, e.y, x, y) > radius) continue;
      if (e.alerted) {
        e.lastSeen.x = x; e.lastSeen.y = y; e.lastSeenT = 0;
      } else {
        Ent.alertEnemy(e, this, x, y);
      }
    }
  };

  World.prototype.toast = function (text) {
    this.toasts.push({ text: text, t: 3 });
    if (this.toasts.length > 4) this.toasts.shift();
    if (this.toastCb) this.toastCb(text);
  };

  World.prototype.shake = function (t, mag) {
    this.shakeT = Math.max(this.shakeT, t);
    this.shakeMag = Math.max(this.shakeMag, mag);
  };

  World.prototype.addParticle = function (type, x, y, vx, vy, life, size, color, grav) {
    if (this.particles.length > 420) this.particles.shift();
    this.particles.push({
      type: type, x: x, y: y, vx: vx, vy: vy, life: life, maxLife: life,
      size: size, color: color || '#fff', grav: grav || 0, rot: U.rand(0, 6.28), vr: U.rand(-8, 8)
    });
  };

  World.prototype.blood = function (x, y, n, dir) {
    for (var i = 0; i < n; i++) {
      var a = (dir || 0) + U.rand(-0.7, 0.7);
      var s = U.rand(40, 160);
      this.addParticle('blood', x, y, Math.cos(a) * s, Math.sin(a) * s, U.rand(0.2, 0.45), U.rand(2, 4), '#8d2f26', 60);
    }
  };

  World.prototype.spark = function (x, y, n, color) {
    for (var i = 0; i < n; i++) {
      var a = U.rand(0, 6.28);
      var s = U.rand(50, 170);
      this.addParticle('spark', x, y, Math.cos(a) * s, Math.sin(a) * s, U.rand(0.12, 0.3), U.rand(1.4, 2.6), color || '#ffd08a', 0);
    }
  };

  World.prototype.decal = function (x, y, type, size, color) {
    if (this.decals.length > 160) this.decals.shift();
    this.decals.push({ x: x, y: y, type: type, size: size, color: color, a: 0.55 });
  };

  /* ---------------- 玩家射击 ---------------- */
  World.prototype.playerShoot = function (p, w) {
    var self = this;
    this.stats.shots++;
    this.play('shot_' + w.id, 1);
    this.shake(w.recoil * 0.12, w.recoil * 2.2);
    this.noise(p.x, p.y, w.noise, '枪声');

    var mx = p.x + Math.cos(p.angle) * 16;
    var my = p.y + Math.sin(p.angle) * 16;
    this.addParticle('flash', mx, my, 0, 0, 0.07, w.id === 'shotgun' ? 20 : 15, '#ffdca0');
    this.addParticle('smoke', mx, my, Math.cos(p.angle) * 30, Math.sin(p.angle) * 30, 0.4, 8, 'rgba(190,180,160,.35)');
    // 抛壳
    var ca = p.angle + Math.PI / 2;
    this.addParticle('casing', p.x, p.y, Math.cos(ca) * U.rand(60, 100), Math.sin(ca) * U.rand(60, 100), 0.6, 2, '#d8b46a', 80);

    var anyHit = false;
    for (var i = 0; i < w.pellets; i++) {
      var spread = w.spread + p.bloom;
      var ang = p.angle + (Math.random() + Math.random() - 1) * spread;
      var dx = Math.cos(ang), dy = Math.sin(ang);
      var wall = this.map.raycast(mx, my, dx, dy, w.range);
      var maxT = wall.dist;
      var pierce = w.pierce || 0;
      var hits = [];
      var j;
      for (j = 0; j < this.enemies.length; j++) {
        var e = this.enemies[j];
        if (!e.alive) continue;
        var t = rayCircle(mx, my, dx, dy, maxT, e.x, e.y, e.r);
        if (t > 0) hits.push({ t: t, kind: 'e', obj: e });
      }
      for (j = 0; j < this.map.props.length; j++) {
        var pr = this.map.props[j];
        if (!pr.alive) continue;
        var tp = rayCircle(mx, my, dx, dy, maxT, pr.x, pr.y, pr.r);
        if (tp > 0) hits.push({ t: tp, kind: 'p', obj: pr });
      }
      hits.sort(function (a, b) { return a.t - b.t; });

      var endX = mx + dx * maxT, endY = my + dy * maxT;
      for (j = 0; j < hits.length; j++) {
        var h = hits[j];
        var hx = mx + dx * h.t, hy = my + dy * h.t;
        if (h.kind === 'p') {
          this.damageProp(h.obj, w.dmg * p.damageMul, { x: hx, y: hy, source: 'player' });
          endX = hx; endY = hy;
          anyHit = true;
          break;
        } else {
          var shielded = this.applyDamage(h.obj, w.dmg * p.damageMul, { x: hx, y: hy, angle: ang });
          endX = hx; endY = hy;
          anyHit = true;
          if (shielded) this.floaters.push({ x: hx, y: hy - 12, text: '格挡', life: 0.5, color: '#9fc6d9' });
          if (pierce > 0) { pierce--; continue; }
          break;
        }
      }
      this.tracers.push({
        x1: mx, y1: my, x2: endX, y2: endY,
        life: 0.055, color: w.tracer, width: w.id === 'dmr' ? 2.4 : 1.4
      });
      if (wall.hit && !hits.length) this.spark(endX, endY, 3, '#ffe0a8');
    }
    if (anyHit) {
      this.stats.hits++;
      this.hitMarker = 0.18;
      this.play('hit', 0.8);
    }
  };

  World.prototype.applyDamage = function (e, dmg, info) {
    if (!e || !e.alive) return false;
    var shielded = false;
    if (e.def.shield) {
      var from = Math.atan2(info.y - e.y, info.x - e.x);
      // 玩家在敌人正面扇区内 → 盾牌生效（Boss 同理）
      var diff = Math.abs(U.angleDiff(e.angle, from));
      if (diff < 1.15) {
        dmg *= (1 - e.def.shield);
        shielded = true;
      }
    }
    e.hp -= dmg;
    e.hitFlash = 0.16;
    this.blood(info.x, info.y, 3, Math.atan2(info.y - e.y, info.x - e.x));
    this.floaters.push({ x: info.x, y: info.y - 8, text: Math.round(dmg), life: 0.55, color: shielded ? '#9fc6d9' : '#ffd8a8' });
    if (!e.alerted) Ent.alertEnemy(e, this, this.player.x, this.player.y);
    if (e.hp <= 0) this.killEnemy(e, info);
    return shielded;
  };

  World.prototype.killEnemy = function (e, info) {
    if (!e.alive) return;
    e.alive = false;
    e.dying = 1.1;
    this.stats.kills++;
    this.play('kill', 0.9);
    this.killMarker = 0.3;
    this.blood(e.x, e.y, 10);
    if (info && info.stealth) this.stats.stealthKills++;

    var drop = null;
    if (e.boss) {
      drop = 'med';
      this.toast('「铁颚」已击毙');
      this.shake(0.6, 14);
      this.addBlast(e.x, e.y, 70);
    } else if (e.type === 'h' || e.type === 'k') {
      drop = U.chance(0.8) ? 'ammo' : 'med';
    } else if (U.chance(0.35)) {
      drop = 'ammo';
    } else if (U.chance(0.12)) {
      drop = 'med';
    }
    if (drop) this.dropPickup(drop, e.x, e.y);

    // 指挥官死亡会让手下短暂失去加成
    if (e.type === 'k') this.toast('敌方指挥官已被清除');
  };

  World.prototype.dropPickup = function (type, x, y) {
    var f = this.map.findFloor(Math.floor(x / TILE), Math.floor(y / TILE));
    this.pickups.push({ type: type, x: (f[0] + 0.5) * TILE, y: (f[1] + 0.5) * TILE, alive: true, t: 0, dropped: true });
  };

  World.prototype.damageProp = function (p, dmg, info) {
    if (!p || !p.alive || p.type === 'terminal') return;
    p.hp -= dmg;
    p.flash = 0.18;
    this.spark(info.x, info.y, 2, p.type === 'barrel' ? '#ffb15e' : '#d8c091');
    if (p.hp <= 0) {
      var wasBarrel = p.type === 'barrel';
      this.map.destroyProp(p);
      if (wasBarrel) {
        this.explode(p.x, p.y, 104, 95, { barrel: true });
      } else {
        for (var i = 0; i < 8; i++) {
          this.addParticle('debris', p.x, p.y, U.rand(-120, 120), U.rand(-120, 120), U.rand(0.4, 0.8), U.rand(3, 6), '#8a6b45', 90);
        }
        this.decal(p.x, p.y, 'scorch', 22, 'rgba(0,0,0,.5)');
      }
    }
  };

  /* ---------------- 敌方射击 ---------------- */
  World.prototype.fireEnemyShot = function (e, baseAngle) {
    if (!e.alive) return;
    var def = e.def;
    var a = baseAngle + (Math.random() + Math.random() - 1) * (def.spread || 0.05);
    var mx = e.x + Math.cos(a) * (e.r + 6);
    var my = e.y + Math.sin(a) * (e.r + 6);
    var speed = def.laser ? 900 : 620;
    this.bullets.push({
      x: mx, y: my, px: mx, py: my,
      vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
      dmg: def.dmg * e.dmgMul,
      life: 1.4, color: def.laser ? '#ff9b9b' : '#ffcf8a',
      owner: e, type: def.laser ? 'sniper' : 'normal'
    });
    this.addParticle('flash', mx, my, 0, 0, 0.06, 12, '#ffe0a0');
    var d = U.dist(e.x, e.y, this.player.x, this.player.y);
    this.play(def.laser ? 'shot_dmr' : 'shot_smg', U.clamp(1 - d / 800, 0, 1));
    this.noise(e.x, e.y, 360, '敌方枪声');
    this.alertNear(e.x, e.y, 260, e);
  };

  World.prototype.hurtPlayer = function (dmg, source) {
    var p = this.player;
    if (!p.alive || p.ifr > 0) return;
    var armorPart = Math.min(p.armor, dmg * 0.6);
    p.armor -= armorPart;
    var real = dmg - armorPart;
    p.hp -= real;
    p.hurtFlash = 1;
    this.stats.damageTaken += real;
    this.play('hurt', 0.9);
    this.shake(0.28, 7);
    this.addParticle('blood', p.x, p.y, U.rand(-40, 40), U.rand(-40, 40), 0.3, 3, '#a33a30', 40);
    if (p.hp <= 0) {
      p.hp = 0;
      p.alive = false;
      this.status = 'lost';
      this.stats.time = this.elapsed;
      this.play('lose');
      this.shake(0.6, 12);
      this.blood(p.x, p.y, 16);
    }
  };

  World.prototype.updateBullets = function (dt) {
    for (var i = this.bullets.length - 1; i >= 0; i--) {
      var b = this.bullets[i];
      b.life -= dt;
      b.px = b.x; b.py = b.y;
      var steps = Math.max(1, Math.ceil(Math.hypot(b.vx, b.vy) * dt / 7));
      var dead = false;
      for (var s = 0; s < steps && !dead; s++) {
        b.x += b.vx * dt / steps;
        b.y += b.vy * dt / steps;
        if (this.map.blockedAt(b.x, b.y)) {
          this.spark(b.x, b.y, 3, '#ffd8a0');
          this.decal(b.x, b.y, 'hole', 3, 'rgba(0,0,0,.7)');
          dead = true;
          break;
        }
        var p = this.player;
        if (p.alive && U.dist(b.x, b.y, p.x, p.y) < p.r + 2) {
          this.hurtPlayer(b.dmg, b.owner);
          dead = true;
          break;
        }
        for (var j = 0; j < this.map.props.length; j++) {
          var prop = this.map.props[j];
          if (!prop.alive || prop.type === 'terminal') continue;
          if (U.dist(b.x, b.y, prop.x, prop.y) < prop.r) {
            this.damageProp(prop, b.dmg, { x: b.x, y: b.y });
            dead = true;
            break;
          }
        }
      }
      if (dead || b.life <= 0) this.bullets.splice(i, 1);
    }
  };

  /* ---------------- 手雷 / 爆炸 ---------------- */
  World.prototype.throwGrenade = function (tx, ty) {
    var p = this.player;
    if (!p.alive || p.grenades <= 0) return false;
    var d = U.dist(p.x, p.y, tx, ty);
    var max = C.PLAYER.grenadeMaxRange;
    if (d > max) {
      var a = Math.atan2(ty - p.y, tx - p.x);
      tx = p.x + Math.cos(a) * max;
      ty = p.y + Math.sin(a) * max;
    }
    p.grenades--;
    this.stats.grenades++;
    this.grenades.push({
      x: p.x, y: p.y, sx: p.x, sy: p.y, tx: tx, ty: ty,
      t: 0, dur: 0.85, fuse: 1.15, z: 0, exploded: false
    });
    this.play('grenade_throw');
    return true;
  };

  World.prototype.useMedkit = function () {
    var p = this.player;
    if (!p.alive || p.medkits <= 0) {
      this.play('noammo', 0.6);
      return false;
    }
    if (p.hp >= p.maxHp) {
      this.toast('生命值已满');
      return false;
    }
    p.medkits--;
    p.hp = Math.min(p.maxHp, p.hp + C.PLAYER.medkitHeal);
    this.play('pickup');
    this.toast('使用医疗包 · 生命 +' + C.PLAYER.medkitHeal);
    this.addParticle('spark', p.x, p.y - 10, 0, -30, 0.5, 10, '#9fd8a8');
    return true;
  };

  World.prototype.updateGrenades = function (dt) {
    for (var i = this.grenades.length - 1; i >= 0; i--) {
      var g = this.grenades[i];
      g.t += dt;
      if (g.t < g.dur) {
        var k = g.t / g.dur;
        g.x = U.lerp(g.sx, g.tx, k);
        g.y = U.lerp(g.sy, g.ty, k);
        g.z = Math.sin(Math.PI * k) * 60;
      } else {
        g.x = g.tx; g.y = g.ty; g.z = 0;
        g.fuse -= dt;
        if (g.fuse <= 0) {
          this.explode(g.x, g.y, C.PLAYER.grenadeRadius, C.PLAYER.grenadeDamage);
          this.grenades.splice(i, 1);
        }
      }
    }
  };

  World.prototype.explode = function (x, y, radius, dmg, opts) {
    opts = opts || {};
    this.addBlast(x, y, radius);
    this.play('explode', 0.9);
    this.shake(0.4, 12);
    this.noise(x, y, 620, '爆炸');
    this.decal(x, y, 'scorch', radius * 0.7, 'rgba(0,0,0,.55)');
    for (var i = 0; i < 16; i++) {
      var a = U.rand(0, 6.28), s = U.rand(80, 300);
      this.addParticle('spark', x, y, Math.cos(a) * s, Math.sin(a) * s, U.rand(0.2, 0.55), U.rand(2, 4), '#ffb15e');
      this.addParticle('smoke', x, y, Math.cos(a) * s * 0.4, Math.sin(a) * s * 0.4, U.rand(0.6, 1.2), U.rand(8, 16), 'rgba(120,110,95,.28)');
    }

    var p = this.player;
    if (p.alive && U.dist(x, y, p.x, p.y) < radius && this.map.los(x, y, p.x, p.y, radius)) {
      var f = 1 - U.dist(x, y, p.x, p.y) / radius;
      this.hurtPlayer(dmg * 0.55 * f, null);
    }
    for (var e = 0; e < this.enemies.length; e++) {
      var en = this.enemies[e];
      if (!en.alive) continue;
      var d = U.dist(x, y, en.x, en.y);
      if (d > radius) continue;
      if (!this.map.los(x, y, en.x, en.y, radius)) continue;
      var fall = 1 - d / radius;
      this.applyDamage(en, dmg * (0.45 + fall * 0.7), { x: en.x, y: en.y, angle: 0 });
    }
    for (var j = 0; j < this.map.props.length; j++) {
      var pr = this.map.props[j];
      if (!pr.alive || pr.type === 'terminal') continue;
      if (U.dist(x, y, pr.x, pr.y) > radius + pr.r) continue;
      if (pr.type === 'barrel') {
        // 连锁引爆稍作延迟，视觉上更像连锁
        var self = this;
        setTimeout(function (prop) {
          if (prop.alive) self.damageProp(prop, 999, { x: prop.x, y: prop.y });
        }, 90);
      } else {
        this.damageProp(pr, 999, { x: pr.x, y: pr.y });
      }
    }
  };

  World.prototype.addBlast = function (x, y, r) {
    this.blasts.push({ x: x, y: y, r: r, life: 0.4, max: 0.4 });
  };

  /* ---------------- 交互 / 目标 ---------------- */
  World.prototype.updateInteract = function (dt, held) {
    var p = this.player;
    this.interact = null;
    this.interactT = 0;
    if (!p.alive || !held) return;
    var best = null, bd = 999;
    for (var i = 0; i < this.terminals.length; i++) {
      var t = this.terminals[i];
      if (t.hacked) continue;
      var d = U.dist(p.x, p.y, t.x, t.y);
      if (d < C.PLAYER.interactRange && d < bd) { best = t; bd = d; }
    }
    if (!best) return;
    this.interact = best;
    this.interactT = best.progress || 0;
    best.progress = this.interactT + dt;
    if (Math.floor(best.progress * 2) !== Math.floor((best.progress - dt) * 2)) this.play('hack_tick', 0.5);
    if (best.progress >= 3) {
      best.hacked = true;
      best.progress = 3;
      this.objective.hacked++;
      this.play('hack_done');
      this.toast('节点已接入 ' + this.objective.hacked + '/' + this.objective.required);
      this.hackAlarm(best);
      this.interact = null;
    }
  };

  World.prototype.hackAlarm = function (term) {
    var m = this.mission;
    if (!m.hackSpawn) return;
    var group = m.hackSpawn[this.objective.hacked - 1];
    if (!group) return;
    var pt = this.map.wavePoints[U.randInt(0, this.map.wavePoints.length - 1)];
    if (!pt) return;
    this.play('alarm', 0.9);
    for (var i = 0; i < group.count; i++) {
      var f = this.map.findFloor(pt.cx + U.randInt(-1, 1), pt.cy + U.randInt(-1, 1));
      this.spawnEnemy(group.type, (f[0] + 0.5) * TILE, (f[1] + 0.5) * TILE, {
        alert: true, alertX: term.x, alertY: term.y
      });
      this.addParticle('flash', (f[0] + 0.5) * TILE, (f[1] + 0.5) * TILE, 0, 0, 0.3, 24, '#ff9d6a');
    }
    this.toast('警报触发：敌方增援进入');
  };

  World.prototype.updateWaves = function (dt) {
    var m = this.mission;
    if (!m.waves || !m.waves.length) return;
    while (this.waveIndex < m.waves.length && this.elapsed >= m.waves[this.waveIndex].at) {
      var w = m.waves[this.waveIndex];
      var pt = this.map.wavePoints[w.point] || this.map.wavePoints[0];
      if (!pt) { this.waveIndex++; continue; }
      this.spawnWaveAt(pt, w.type, w.count);
      if (w.mix) this.spawnWaveAt(pt, w.mix.type, w.mix.count);
      this.waveIndex++;
    }
  };

  World.prototype.spawnWaveAt = function (pt, type, count) {
    for (var i = 0; i < count; i++) {
      var f = this.map.findFloor(pt.cx + U.randInt(-2, 2), pt.cy + U.randInt(-2, 2));
      this.spawnEnemy(type, (f[0] + 0.5) * TILE + U.rand(-6, 6), (f[1] + 0.5) * TILE + U.rand(-6, 6), {
        alert: true, alertX: this.player.x, alertY: this.player.y
      });
    }
    this.toast('敌方增援 '+count+' 人');
  };

  World.prototype.checkObjective = function () {
    var o = this.mission.objective;
    var st = this.objective;
    if (st.done) return;
    var unlocked = false;
    if (o.type === 'eliminate') {
      var alive = this.enemies.filter(function (e) { return e.alive; }).length;
      unlocked = alive === 0 && !this.spawnQueue.length;
    } else if (o.type === 'hack') {
      unlocked = st.hacked >= st.required;
    } else if (o.type === 'defend') {
      unlocked = st.holdT >= o.seconds;
    } else if (o.type === 'survive') {
      unlocked = st.remain <= 0;
    } else if (o.type === 'boss') {
      unlocked = !this.enemies.some(function (e) { return e.boss && e.alive; });
    }
    if (unlocked) {
      st.done = true;
      this.extractionOpen = true;
      this.play('hack_done');
      this.toast('目标完成 · 撤离点已开放');
    }
  };

  World.prototype.updatePickups = function (dt) {
    var p = this.player;
    for (var i = 0; i < this.pickups.length; i++) {
      var pk = this.pickups[i];
      if (!pk.alive) continue;
      pk.t += dt;
      if (!p.alive) continue;
      if (U.dist(p.x, p.y, pk.x, pk.y) > C.PLAYER.pickupRange) continue;
      pk.alive = false;
      if (pk.type === 'ammo') {
        for (var w = 0; w < p.weapons.length; w++) {
          p.weapons[w].reserve += w === p.cur ? 24 : 12;
        }
        this.toast('补充弹药');
      } else {
        if (p.medkits < 3) { p.medkits++; this.toast('获得医疗包 ×1'); }
        else { p.hp = Math.min(p.maxHp, p.hp + 28); this.toast('生命 +28'); }
      }
      this.play('pickup');
      this.addParticle('spark', pk.x, pk.y, 0, -30, 0.5, 12, '#ffe0a0');
    }
  };

  World.prototype.update = function (dt, input, held) {
    if (this.status !== 'playing') {
      this.updateFx(dt);
      return;
    }
    this.elapsed += dt;
    this.time += dt;
    this.hitMarker = Math.max(0, this.hitMarker - dt);
    this.killMarker = Math.max(0, this.killMarker - dt);
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      if (this.shakeT <= 0) this.shakeMag = 0;
    }

    var p = this.player;
    Ent.updatePlayer(p, dt, input, this);

    this.flowT -= dt;
    if (this.flowT <= 0) {
      this.flowT = 0.45;
      this.map.buildFlow(p.x, p.y);
      this.map.reveal(p.x, p.y, 440);
    }

    for (var i = 0; i < this.enemies.length; i++) {
      var e = this.enemies[i];
      if (!e.alive) {
        e.dying -= dt;
        continue;
      }
      Ent.updateEnemy(e, dt, this);
    }

    // 防重叠：把敌人从玩家身上推开一点
    for (var k = 0; k < this.enemies.length; k++) {
      var en = this.enemies[k];
      if (!en.alive) continue;
      var d = U.dist(en.x, en.y, p.x, p.y);
      var min = en.r + p.r;
      if (d < min && d > 0.01) {
        var a = Math.atan2(en.y - p.y, en.x - p.x);
        this.map.moveCircle(en, Math.cos(a) * (min - d) * 0.6, Math.sin(a) * (min - d) * 0.6);
      }
    }

    this.updateBullets(dt);
    this.updateGrenades(dt);
    this.updateInteract(dt, held && !p.reloading && this.interactAllowed !== false);
    this.updateWaves(dt);
    this.updatePickups(dt);
    this.updateFx(dt);

    // 防守计时 / 生存倒计时
    var o = this.mission.objective;
    if (o.type === 'defend') {
      if (this.map.zone && U.dist(p.x, p.y, this.map.zone.x, this.map.zone.y) <= this.map.zone.r) {
        this.objective.holdT += dt;
      }
      this.objective.remain = Math.max(0, o.seconds - this.objective.holdT);
    } else if (o.type === 'survive') {
      this.objective.remain = Math.max(0, o.seconds - this.elapsed);
    }

    // Boss 召唤
    if (this.mission.bossAdds) {
      var bossAlive = this.enemies.some(function (x) { return x.boss && x.alive; });
      if (bossAlive) {
        this.bossAddT -= dt;
        if (this.bossAddT <= 0) {
          this.bossAddT = this.mission.bossAdds.interval;
          var aliveAdds = this.enemies.filter(function (x) { return x.alive && !x.boss; }).length;
          if (aliveAdds < this.mission.bossAdds.max) {
            var boss = null;
            for (var bi = 0; bi < this.enemies.length; bi++) {
              if (this.enemies[bi].boss && this.enemies[bi].alive) { boss = this.enemies[bi]; break; }
            }
            var bx = boss ? boss.x : p.x, by = boss ? boss.y : p.y;
            this.summonAdds(bx, by, this.mission.bossAdds.type, this.mission.bossAdds.count);
            this.toast('敌方增援抵达');
          }
        }
      }
    }

    this.checkObjective();

    // 撤离判定
    if (this.extractionOpen && p.alive && this.map.inExtract(p.x, p.y)) {
      this.extractionT += dt;
      if (this.extractionT > 0.5) this.win();
    } else {
      this.extractionT = 0;
    }

    // 清理尸体
    for (var q = this.enemies.length - 1; q >= 0; q--) {
      if (!this.enemies[q].alive && this.enemies[q].dying < -0.2) this.enemies.splice(q, 1);
    }
  };

  World.prototype.updateFx = function (dt) {
    var i;
    for (i = this.particles.length - 1; i >= 0; i--) {
      var pt = this.particles[i];
      pt.life -= dt;
      if (pt.life <= 0) { this.particles.splice(i, 1); continue; }
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += pt.grav * dt;
      pt.vx *= 0.96;
      pt.vy *= 0.96;
      pt.rot += pt.vr * dt;
    }
    for (i = this.tracers.length - 1; i >= 0; i--) {
      this.tracers[i].life -= dt;
      if (this.tracers[i].life <= 0) this.tracers.splice(i, 1);
    }
    for (i = this.blasts.length - 1; i >= 0; i--) {
      this.blasts[i].life -= dt;
      if (this.blasts[i].life <= 0) this.blasts.splice(i, 1);
    }
    for (i = this.floaters.length - 1; i >= 0; i--) {
      this.floaters[i].life -= dt;
      if (this.floaters[i].life <= 0) this.floaters.splice(i, 1);
      else this.floaters[i].y -= dt * 22;
    }
    for (i = this.toasts.length - 1; i >= 0; i--) {
      this.toasts[i].t -= dt;
      if (this.toasts[i].t <= 0) this.toasts.splice(i, 1);
    }
    for (i = 0; i < this.map.props.length; i++) {
      if (this.map.props[i].flash > 0) this.map.props[i].flash -= dt;
    }
  };

  World.prototype.tryTakedown = function () {
    var p = this.player;
    if (!p.alive) return false;
    var best = null, bd = 999;
    for (var i = 0; i < this.enemies.length; i++) {
      var e = this.enemies[i];
      if (!e.alive || e.boss) continue;
      var d = U.dist(p.x, p.y, e.x, e.y);
      if (d < C.PLAYER.takedownRange && d < bd) { best = e; bd = d; }
    }
    if (!best) return false;
    var toE = Math.atan2(best.y - p.y, best.x - p.x);
    var behind = Math.abs(U.angleDiff(best.angle, toE)) > 1.25;
    if (!best.alerted || behind) {
      this.addParticle('spark', best.x, best.y, 0, -20, 0.4, 10, '#ffd0a0');
      best.hp = 0;
      this.killEnemy(best, { stealth: true });
      this.play('takedown');
      this.toast('无声处决');
      return true;
    }
    // 正面近战
    this.applyDamage(best, C.PLAYER.meleeDamage * p.damageMul, { x: best.x, y: best.y, angle: p.angle });
    this.play('takedown', 0.8);
    this.shake(0.12, 3);
    return true;
  };

  World.prototype.win = function () {
    if (this.status !== 'playing') return;
    this.status = 'won';
    this.stats.time = this.elapsed;
    this.play('win');
    this.toast('任务完成');
  };

  World.prototype.rate = function () {
    var s = this.stats;
    var acc = s.shots ? s.hits / s.shots : 0;
    var par = this.mission.par;
    var timeMul = this.elapsed <= par ? 1 : Math.max(0.2, par / this.elapsed);
    var score = 0;
    score += Math.min(1, acc) * 45;
    score += Math.max(0, 1 - s.damageTaken / 160) * 20;
    score += Math.max(0, 1 - s.alerts / 22) * 20;
    score += timeMul * 15;
    if (s.stealthKills > 0) score += Math.min(8, s.stealthKills * 2);
    if (score >= 88) return 'S';
    if (score >= 74) return 'A';
    if (score >= 58) return 'B';
    return 'C';
  };

  World.prototype.ratingDetail = function () {
    var s = this.stats;
    return {
      accuracy: s.shots ? Math.round(s.hits / s.shots * 100) : 0,
      kills: s.kills,
      alerts: s.alerts,
      damage: Math.round(s.damageTaken),
      time: s.time || this.elapsed,
      stealthKills: s.stealthKills,
      grenades: s.grenades
    };
  };

  GG.World = function (mission, profile, loadout, difficulty) {
    return new World(mission, profile, loadout, difficulty);
  };
})(typeof window !== 'undefined' ? window : globalThis);
