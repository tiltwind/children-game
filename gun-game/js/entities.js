/* ============================================================
 * entities.js —— 玩家、敌人（含战术 AI）、手雷、粒子
 * 依赖：config.js / util.js / map.js
 * ============================================================ */
(function (root) {
  'use strict';
  var GG = (root.GG = root.GG || {});
  var C = GG.C, U = GG.U;

  function weaponInstance(id, def, reserveBonus) {
    return {
      id: id,
      def: def,
      mag: def.mag,
      reserve: def.reserve + (reserveBonus || 0)
    };
  }

  function createPlayer(map, profile, loadout) {
    var P = C.PLAYER;
    var ups = (profile && profile.upgrades) || {};
    var maxHp = P.hp + (ups.hp || 0) * 12;
    var maxArmor = P.armor + (ups.armor || 0) * 10;
    var weapons = [];
    (loadout.weapons || ['pistol', 'smg']).forEach(function (id) {
      if (C.WEAPONS[id]) weapons.push(weaponInstance(id, C.WEAPONS[id], 0));
    });
    if (!weapons.length) weapons.push(weaponInstance('pistol', C.WEAPONS.pistol, 0));

    var p = {
      x: map.playerStart.x,
      y: map.playerStart.y,
      r: P.r,
      hp: maxHp, maxHp: maxHp,
      armor: maxArmor, maxArmor: maxArmor,
      angle: -Math.PI / 2,
      aimX: map.playerStart.x, aimY: map.playerStart.y - 40,
      weapons: weapons, cur: 0,
      cooldown: 0, reloading: 0, reloadTotal: 0,
      bloom: 0, stamina: P.stamina, staminaCd: 0,
      dodgeT: 0, dodgeCd: 0, dodgeDir: { x: 0, y: 0 },
      ifr: 0, grenades: loadout.grenades || 0, medkits: loadout.medkits || 0,
      alive: true, moving: false, sprinting: false,
      muzzle: 0, hurtFlash: 0, stepT: 0,
      upgrades: ups,
      damageMul: 1 + (ups.damage || 0) * 0.09,
      speedMul: 1 + (ups.speed || 0) * 0.06,
      reloadMul: 1 - (ups.reload || 0) * 0.10,
      kills: 0, shots: 0, hits: 0
    };
    p.weapon = p.weapons[0];
    return p;
  }

  function currentWeapon(p) { return p.weapons[p.cur]; }

  function baseSpeed(p) { return C.PLAYER.speed * (1 + (p.upgrades.speed || 0) * 0.06); }

  function startReload(p, world) {
    var w = currentWeapon(p);
    if (!w || p.reloading > 0) return false;
    if (w.mag >= w.def.mag || w.reserve <= 0) return false;
    p.reloading = w.def.reload * (1 - (p.upgrades.reload || 0) * 0.10);
    p.reloadTotal = p.reloading;
    if (world) world.play('reload_start', 0.9);
    return true;
  }

  function finishReload(p) {
    var w = currentWeapon(p);
    if (!w) return;
    var need = w.def.mag - w.mag;
    var take = Math.min(need, w.reserve);
    w.mag += take;
    w.reserve -= take;
  }

  function switchWeapon(p, idx, world) {
    if (idx < 0 || idx >= p.weapons.length) return;
    if (idx === p.cur && p.reloading <= 0) return;
    p.cur = idx;
    p.weapon = p.weapons[idx];
    p.reloading = 0;
    p.cooldown = Math.max(p.cooldown, 0.28);
    p.bloom = 0;
    if (world) world.play('ui');
  }

  function tryFire(p, world) {
    if (!p.alive) return false;
    var w = currentWeapon(p);
    if (p.reloading > 0 || p.cooldown > 0) return false;
    if (w.mag <= 0) {
      if (w.reserve > 0) startReload(p, world);
      else if (world) world.play('dry');
      return false;
    }
    w.mag--;
    p.shots++;
    p.cooldown = w.def.interval;
    p.bloom = Math.min(w.def.bloomMax, p.bloom + w.def.bloom);
    p.muzzle = 0.06;
    world.playerShoot(p, w.def);
    if (w.mag === 0) startReload(p, world);
    return true;
  }

  function finishDodge(p) {
    p.dodgeT = 0;
    p.dodgeCd = C.PLAYER.dodgeCd;
  }

  function startDodge(p, ix, iy) {
    if (p.dodgeCd > 0 || p.dodgeT > 0 || p.stamina < 25) return false;
    var dx = ix, dy = iy;
    if (!dx && !dy) { dx = Math.cos(p.angle); dy = Math.sin(p.angle); }
    var len = Math.hypot(dx, dy) || 1;
    p.dodgeDir.x = dx / len; p.dodgeDir.y = dy / len;
    p.dodgeT = C.PLAYER.dodgeTime;
    p.ifr = Math.max(p.ifr, C.PLAYER.dodgeIframes);
    p.stamina = Math.max(0, p.stamina - 25);
    p.staminaCd = C.PLAYER.staminaDelay;
    return true;
  }

  function updatePlayer(p, dt, input, world) {
    if (!p.alive) return;
    p.cooldown = Math.max(0, p.cooldown - dt);
    p.ifr = Math.max(0, p.ifr - dt);
    p.dodgeCd = Math.max(0, p.dodgeCd - dt);
    p.muzzle = Math.max(0, p.muzzle - dt);
    p.hurtFlash = Math.max(0, p.hurtFlash - dt * 2);
    p.bloom = Math.max(0, p.bloom - (currentWeapon(p).def.recover || 0.25) * dt);
    if (p.reloading > 0) {
      p.reloading -= dt;
      if (p.reloading <= 0) {
        p.reloading = 0;
        finishReload(p);
        world.play('reload_end', 0.9);
      }
    }

    p.aimX = input.mx; p.aimY = input.my;
    p.angle = Math.atan2(input.my - p.y, input.mx - p.x);

    var ix = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    var iy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    var len = Math.hypot(ix, iy);
    if (len > 0) { ix /= len; iy /= len; }
    p.moving = len > 0;

    if (input.dodge) {
      if (startDodge(p, ix, iy)) world.play('dodge');
    }

    if (p.dodgeT > 0) {
      p.dodgeT -= dt;
      world.map.moveCircle(p, p.dodgeDir.x * C.PLAYER.dodgeSpeed * dt, p.dodgeDir.y * C.PLAYER.dodgeSpeed * dt);
      p.ifr = Math.max(p.ifr, 0.04);
      if (p.dodgeT <= 0) finishDodge(p);
    } else if (p.moving) {
      var sprint = input.sprint && p.stamina > 1 && !input.interacting;
      p.sprinting = sprint;
      if (sprint) {
        p.stamina = Math.max(0, p.stamina - C.PLAYER.staminaDrain * dt);
        p.staminaCd = C.PLAYER.staminaDelay;
      }
      var sp = (sprint ? C.PLAYER.sprint : baseSpeed(p)) * (input.interacting ? 0.45 : 1);
      world.map.moveCircle(p, ix * sp * dt, iy * sp * dt);
      p.stepT -= dt;
      if (p.stepT <= 0) {
        p.stepT = sprint ? 0.28 : 0.42;
        if (sprint) world.noise(p.x, p.y, C.PLAYER.noiseSprint, '脚步');
      }
    } else {
      p.sprinting = false;
    }

    if (p.staminaCd > 0) p.staminaCd -= dt;
    else p.stamina = Math.min(C.PLAYER.stamina, p.stamina + C.PLAYER.staminaRegen * dt);
  }

  /* ============================================================
   * 敌人
   * ============================================================ */
  function createEnemy(typeId, x, y, world, opts) {
    var def = C.ENEMIES[typeId];
    if (!def) def = C.ENEMIES.g;
    var diff = world.difficulty || C.DIFFICULTY.standard;
    var hpMul = diff.enemyHp || 1;
    var e = {
      type: typeId, def: def, name: def.name,
      x: x, y: y, r: def.r,
      hp: Math.round(def.hp * hpMul), maxHp: Math.round(def.hp * hpMul),
      angle: U.rand(0, Math.PI * 2),
      state: 'idle', alerted: false,
      lastSeen: { x: x, y: y }, lastSeenT: 0,
      fireT: U.rand(0.2, 0.9), burstLeft: 0, gapT: 0,
      aiming: false, aimT: 0,
      anchor: { x: x, y: y },
      wander: null, wanderT: 0, idleT: U.rand(0.6, 2.2),
      reposition: 0, cover: null, coverT: 0,
      strafe: U.chance(0.5) ? 1 : -1, strafeT: U.rand(0.8, 1.8),
      alive: true, dying: 0, hitFlash: 0,
      dmgMul: (diff.enemyDmg || 1),
      buffed: false, boss: !!def.boss, phase: 1,
      bossMode: 'barrage', bossT: 3,
      summonT: 0,
      angleVel: U.rand(-0.6, 0.6),
      stuck: 0, lastPos: { x: x, y: y }
    };
    if (opts && opts.alert) { e.state = 'alert'; e.alerted = true; e.lastSeen = { x: opts.alertX || x, y: opts.alertY || y }; }
    return e;
  }

  function angleLerp(a, b, t) {
    return a + U.angleDiff(b, a) * Math.min(1, t);
  }

  function canSee(e, p, map) {
    if (!p.alive) return false;
    var d = U.dist(e.x, e.y, p.x, p.y);
    if (d > e.def.view) return false;
    var to = Math.atan2(p.y - e.y, p.x - e.x);
    if (e.def.fov < 360) {
      var half = (e.def.fov * Math.PI / 180) / 2;
      if (Math.abs(U.angleDiff(to, e.angle)) > half) return false;
    }
    return map.los(e.x, e.y, p.x, p.y, e.def.view);
  }

  function alertEnemy(e, world, x, y) {
    if (!e.alive) return;
    if (!e.alerted) {
      e.alerted = true;
      e.state = 'alert';
      e.aiming = false;
      e.aimT = 0;
      world.onEnemyAlert(e);
    }
    e.lastSeen.x = x != null ? x : e.lastSeen.x;
    e.lastSeen.y = y != null ? y : e.lastSeen.y;
    e.lastSeenT = 0;
  }

  function moveEnemy(e, map, dt, tx, ty, speed, world) {
    var dx = tx - e.x, dy = ty - e.y;
    var d = Math.hypot(dx, dy);
    if (d < 4) return true;
    dx /= d; dy /= d;

    // 与其他敌人的分离力，避免叠成一坨
    var sx = 0, sy = 0;
    for (var i = 0; i < world.enemies.length; i++) {
      var o = world.enemies[i];
      if (o === e || !o.alive) continue;
      var ox = e.x - o.x, oy = e.y - o.y;
      var od = Math.hypot(ox, oy);
      var min = e.r + o.r + 8;
      if (od > 0.01 && od < min) {
        sx += (ox / od) * (min - od) / min;
        sy += (oy / od) * (min - od) / min;
      }
    }
    dx += sx * 1.2; dy += sy * 1.2;
    var dl = Math.hypot(dx, dy) || 1;
    dx /= dl; dy /= dl;

    var vx = dx * speed, vy = dy * speed;
    var res = map.moveCircle(e, vx * dt, vy * dt);
    if (res.hitX || res.hitY) {
      // 撞墙时沿垂直方向滑一下
      var px = -dy, py = dx;
      map.moveCircle(e, px * speed * dt * 0.8, py * speed * dt * 0.8);
      e.stuck += dt;
      if (e.stuck > 1.2) {
        e.stuck = 0;
        e.strafe *= -1;
      }
    } else {
      e.stuck = 0;
    }

    // 朝移动方向转身（未交火时）
    if (!e.alerted || !world.player.alive) {
      e.angle = angleLerp(e.angle, Math.atan2(dy, dx), dt * 3);
    }
    return false;
  }

  function fireBurst(e, world) {
    var def = e.def;
    var burst = def.burst || 1;
    e.burstLeft = burst;
    e.gapT = 0;
    e.fireT = def.interval;
    e.aimT = 0;
    if (def.laser) e.laserOn = 0.12;
    var aim = e.aimTarget;
    if (aim == null || !isFinite(aim)) {
      aim = Math.atan2(world.player.y - e.y, world.player.x - e.x);
    }
    world.fireEnemyShot(e, aim);
  }

  function updateEnemy(e, dt, world) {
    if (!e.alive) return;
    var p = world.player;
    var map = world.map;
    e.hitFlash = Math.max(0, e.hitFlash - dt * 4);
    if (e.laserOn > 0) e.laserOn = Math.max(0, e.laserOn - dt);
    e.lastSeenT += dt;

    // 死亡渐隐
    if (e.dying > 0) {
      e.dying -= dt;
      return;
    }

    if (e.boss) { updateBoss(e, dt, world); return; }

    var sees = canSee(e, p, map);
    if (sees) {
      e.lastSeen.x = p.x; e.lastSeen.y = p.y;
      e.lastSeenT = 0;
      if (!e.alerted) alertEnemy(e, world, p.x, p.y);
      e.state = 'alert';
    }

    // 感知：视野扇形缓慢扫视
    if (!e.alerted) {
      e.idleT -= dt;
      if (e.idleT <= 0) {
        e.idleT = U.rand(1.6, 3.6);
        e.wander = map.randomFloorNear(Math.floor(e.anchor.x / C.TILE), Math.floor(e.anchor.y / C.TILE), 3);
        e.wander.x = (e.wander.cx + 0.5) * C.TILE;
        e.wander.y = (e.wander.cy + 0.5) * C.TILE;
      }
      if (e.wander) {
        moveEnemy(e, map, dt, e.wander.x, e.wander.y, e.def.speed * 0.55, world);
        if (U.dist(e.x, e.y, e.wander.x, e.wander.y) < 10) e.wander = null;
      } else {
        e.angle += e.angleVel * dt;
      }
      return;
    }

    // 已警觉
    var d = U.dist(e.x, e.y, p.x, p.y);
    var toPlayer = Math.atan2(p.y - e.y, p.x - e.x);

    if (!sees) {
      // 追到最后目击点，找不到就搜索/冷静
      var last = e.lastSeen;
      var reached = U.dist(e.x, e.y, last.x, last.y) < 18;
      if (reached) {
        if (e.lastSeenT > 7) {
          e.alerted = false;
          e.state = 'idle';
          e.aiming = false;
          e.wander = null;
          return;
        }
        // 到了最后目击点仍找不到人：原地搜索，缓慢转视角
        e.angle += dt * 1.2 * e.strafe;
      } else {
        // 只追到最后目击点，不透视玩家当前位置
        moveEnemy(e, map, dt, last.x, last.y, e.def.speed, world);
      }
      return;
    }

    // 看见玩家：转向 + 战术站位
    e.angle = angleLerp(e.angle, toPlayer, dt * (e.def.laser ? 2.2 : 5));
    e.aimTarget = toPlayer;

    var behavior = e.def.behavior;
    var moving = false;

    if (behavior === 'charge') {
      if (d > e.def.range * 0.85) {
        moveEnemy(e, map, dt, p.x, p.y, e.def.speed, world);
        moving = true;
      } else {
        e.strafeT -= dt;
        if (e.strafeT <= 0) { e.strafeT = U.rand(0.6, 1.2); e.strafe *= -1; }
        var pdx = -(p.y - e.y), pdy = p.x - e.x;
        var pl = Math.hypot(pdx, pdy) || 1;
        moveEnemy(e, map, dt, e.x + (pdx / pl) * e.strafe * 40, e.y + (pdy / pl) * e.strafe * 40, e.def.speed * 0.6, world);
      }
    } else if (behavior === 'sniper') {
      if (d < 260) {
        // 后撤到安全距离
        var ax = e.x - p.x, ay = e.y - p.y;
        var al = Math.hypot(ax, ay) || 1;
        moveEnemy(e, map, dt, e.x + (ax / al) * 120, e.y + (ay / al) * 120, e.def.speed, world);
        moving = true;
      }
    } else if (behavior === 'heavy') {
      if (d > e.def.range * 0.9) {
        moveEnemy(e, map, dt, p.x, p.y, e.def.speed, world);
        moving = true;
      }
    } else {
      var ideal = behavior === 'commander' ? 360 : 280;
      if (d > ideal * 1.18) {
        moveEnemy(e, map, dt, p.x, p.y, e.def.speed, world);
        moving = true;
      } else if (d < ideal * 0.55) {
        var bx = e.x - p.x, by = e.y - p.y;
        var bl = Math.hypot(bx, by) || 1;
        moveEnemy(e, map, dt, e.x + (bx / bl) * 90, e.y + (by / bl) * 90, e.def.speed, world);
        moving = true;
      } else if (!e.aiming) {
        // 横向游走，避免站桩
        e.strafeT -= dt;
        if (e.strafeT <= 0) { e.strafeT = U.rand(1.2, 2.4); e.strafe *= -1; }
        var qx = -(p.y - e.y), qy = p.x - e.x;
        var ql = Math.hypot(qx, qy) || 1;
        moveEnemy(e, map, dt, e.x + (qx / ql) * e.strafe * 52, e.y + (qy / ql) * e.strafe * 52, e.def.speed * 0.55, world);
      }
    }

    // 残血找掩体
    if (!e.boss && e.hp < e.maxHp * 0.45 && e.reposition <= 0 && e.coverT <= 0 && !moving) {
      var cover = map.findCover(e.x, e.y, p.x, p.y, 6);
      if (cover) {
        e.cover = cover; e.reposition = 1.4;
      }
    }
    if (e.reposition > 0) {
      e.reposition -= dt;
      moveEnemy(e, map, dt, e.cover.x, e.cover.y, e.def.speed * 1.1, world);
      if (e.reposition <= 0) { e.coverT = 2.4; e.cover = null; }
    }
    if (e.coverT > 0) {
      e.coverT -= dt;
      if (e.coverT <= 0) e.reposition = 0;
    }

    // 开火节奏
    if (e.burstLeft > 0) {
      e.gapT -= dt;
      if (e.gapT <= 0) {
        world.fireEnemyShot(e, e.aimTarget);
        e.burstLeft--;
        e.gapT = e.def.gap || 0.08;
      }
    } else if (e.aiming) {
      e.aimT += dt;
      if (e.aimT >= e.def.aim) {
        e.aiming = false;
        fireBurst(e, world);
      }
    } else if (e.fireT > 0) {
      e.fireT -= dt;
    } else if (d <= e.def.range && map.los(e.x, e.y, p.x, p.y)) {
      e.aiming = true;
      e.aimT = 0;
      if (e.def.laser) {
        e.laserOn = e.def.aim;
        world.play('alert', 0.25);
      }
    }

    // 指挥官光环
    if (behavior === 'commander') {
      e.summonT -= dt;
      if (e.summonT <= 0) {
        e.summonT = 14;
        if (world.enemies.filter(function (o) { return o.alive; }).length < 20) {
          world.summonAdds(e.x, e.y, 'g', 2);
          world.toast('敌方指挥官呼叫了增援');
        }
      }
    }
  }

  /* ---------------- Boss ---------------- */
  function updateBoss(e, dt, world) {
    var p = world.player, map = world.map;
    var d = U.dist(e.x, e.y, p.x, p.y);
    e.summonT -= dt;
    e.bossT -= dt;

    if (e.hp < e.maxHp * 0.5 && e.phase === 1) {
      e.phase = 2;
      e.def = Object.assign({}, C.ENEMIES.b, { interval: 0.62, burst: 12, speed: 62, aim: 0.3 });
      world.toast('「铁颚」进入狂暴');
      world.shake(0.35, 10);
    }

    if (e.bossT <= 0) {
      var modes = e.phase === 1 ? ['barrage', 'summon', 'barrage', 'charge'] : ['barrage', 'charge', 'summon', 'barrage'];
      var pick = modes[Math.floor(Math.random() * modes.length)];
      if (pick === 'summon') { world.summonAdds(e.x, e.y, 'g', e.phase === 2 ? 3 : 2); world.toast('「铁颚」呼叫增援'); }
      if (pick === 'charge') { e.bossMode = 'charge'; e.bossT = 1.6; }
      if (pick === 'barrage') { e.bossMode = 'barrage'; e.bossT = 2.4; e.fireT = 0; }
      world.shake(0.2, 5);
    }

    e.angle = angleLerp(e.angle, Math.atan2(p.y - e.y, p.x - e.x), dt * 2.4);
    e.aimTarget = Math.atan2(p.y - e.y, p.x - e.x);

    if (e.bossMode === 'charge') {
      moveEnemy(e, map, dt, p.x, p.y, C.ENEMIES.b.speed * 1.9, world);
      if (d < e.r + p.r + 10 && e.chargeHit !== true) {
        e.chargeHit = true;
        world.hurtPlayer(18 * e.dmgMul, e);
        world.shake(0.4, 12);
      }
      if (e.bossT <= 0) { e.bossMode = 'barrage'; e.bossT = 2.2; e.chargeHit = false; }
      return;
    }

    // 保持在 300 左右
    if (d > 340) moveEnemy(e, map, dt, p.x, p.y, e.def.speed, world);
    else if (d < 220) {
      var bx = e.x - p.x, by = e.y - p.y, bl = Math.hypot(bx, by) || 1;
      moveEnemy(e, map, dt, e.x + bx / bl * 100, e.y + by / bl * 100, e.def.speed, world);
    }

    if (e.burstLeft > 0) {
      e.gapT -= dt;
      if (e.gapT <= 0) { world.fireEnemyShot(e, e.aimTarget); e.burstLeft--; e.gapT = e.def.gap; }
    } else {
      e.fireT -= dt;
      if (e.fireT <= 0 && e.bossT > 0) {
        e.fireT = e.def.interval;
        e.aiming = true; e.aimT = 0;
      }
      if (e.aiming) {
        e.aimT += dt;
        if (e.aimT >= e.def.aim) {
          e.aiming = false;
          e.burstLeft = e.def.burst;
          e.gapT = 0;
        }
      }
    }
  }

  GG.Ent = {
    createPlayer: createPlayer,
    createEnemy: createEnemy,
    updatePlayer: updatePlayer,
    updateEnemy: updateEnemy,
    tryFire: tryFire,
    startReload: startReload,
    switchWeapon: switchWeapon,
    currentWeapon: currentWeapon,
    startDodge: startDodge,
    alertEnemy: alertEnemy,
    canSee: canSee
  };
})(typeof window !== 'undefined' ? window : globalThis);
