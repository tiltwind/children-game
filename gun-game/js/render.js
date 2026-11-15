/* ============================================================
 * render.js —— 全部 Canvas 绘制（只读，不改逻辑）
 * 分层：静态地图 / 贴花 / 实体 / 弹道粒子 / 动态光照迷雾 / 屏幕效果
 * ============================================================ */
(function (root) {
  'use strict';
  var GG = (root.GG = root.GG || {});
  var C = GG.C, U = GG.U, TILE = C.TILE;

  var canvas, ctx, fogCanvas, fogCtx, staticCanvas, staticCtx;
  var dpr = 1, SS = 2;
  var R = (GG.Render = {
    cam: { x: 0, y: 0 },
    vis: null,
    visT: 0,
    time: 0
  });

  R.init = function (cv) {
    canvas = cv;
    dpr = U.dpr();
    cv.width = C.VIEW.w * dpr;
    cv.height = C.VIEW.h * dpr;
    cv.style.width = '100%';
    cv.style.height = 'auto';
    ctx = cv.getContext('2d');
    fogCanvas = document.createElement('canvas');
    fogCanvas.width = C.VIEW.w;
    fogCanvas.height = C.VIEW.h;
    fogCtx = fogCanvas.getContext('2d');
  };

  /* ---------------- 静态地图 ---------------- */
  R.buildStatic = function (world) {
    var map = world.map;
    var theme = map.theme;
    var w = map.w * TILE, h = map.h * TILE;
    if (!staticCanvas) {
      staticCanvas = document.createElement('canvas');
      staticCtx = staticCanvas.getContext('2d');
    }
    staticCanvas.width = w * SS;
    staticCanvas.height = h * SS;
    staticCtx.setTransform(SS, 0, 0, SS, 0, 0);
    staticCtx.clearRect(0, 0, w, h);
    var rng = U.noise(12345 + (world.mission.no || 1) * 77);

    // 地面
    for (var y = 0; y < map.h; y++) {
      for (var x = 0; x < map.w; x++) {
        var code = map.grid[y * map.w + x];
        var px = x * TILE, py = y * TILE;
        if (code === GG.Map.WALL) continue;
        staticCtx.fillStyle = (x + y) % 2 === 0 ? theme.floor : theme.floor2;
        staticCtx.fillRect(px, py, TILE, TILE);
        // 细碎污渍
        if (rng() < 0.12) {
          staticCtx.fillStyle = 'rgba(0,0,0,.16)';
          var sx = px + rng() * TILE, sy = py + rng() * TILE;
          staticCtx.beginPath();
          staticCtx.ellipse(sx, sy, 3 + rng() * 8, 2 + rng() * 6, rng() * 3, 0, Math.PI * 2);
          staticCtx.fill();
        }
      }
    }
    // 网格
    staticCtx.strokeStyle = theme.grid;
    staticCtx.lineWidth = 1;
    for (var gx = 0; gx <= map.w; gx++) {
      staticCtx.beginPath();
      staticCtx.moveTo(gx * TILE + 0.5, 0);
      staticCtx.lineTo(gx * TILE + 0.5, h);
      staticCtx.stroke();
    }
    for (var gy = 0; gy <= map.h; gy++) {
      staticCtx.beginPath();
      staticCtx.moveTo(0, gy * TILE + 0.5);
      staticCtx.lineTo(w, gy * TILE + 0.5);
      staticCtx.stroke();
    }

    // 墙体投影
    for (var yy = 0; yy < map.h; yy++) {
      for (var xx = 0; xx < map.w; xx++) {
        if (map.grid[yy * map.w + xx] !== GG.Map.WALL) continue;
        var bx = xx * TILE, by = yy * TILE;
        if (yy + 1 < map.h && map.grid[(yy + 1) * map.w + xx] !== GG.Map.WALL) {
          var grd = staticCtx.createLinearGradient(0, by + TILE, 0, by + TILE + 12);
          grd.addColorStop(0, 'rgba(0,0,0,.38)');
          grd.addColorStop(1, 'rgba(0,0,0,0)');
          staticCtx.fillStyle = grd;
          staticCtx.fillRect(bx, by + TILE, TILE, 12);
        }
      }
    }

    // 墙体
    for (var wy = 0; wy < map.h; wy++) {
      for (var wx = 0; wx < map.w; wx++) {
        if (map.grid[wy * map.w + wx] !== GG.Map.WALL) continue;
        var wx0 = wx * TILE, wy0 = wy * TILE;
        staticCtx.fillStyle = theme.wall;
        staticCtx.fillRect(wx0, wy0, TILE, TILE);
        if (wy > 0 && map.grid[(wy - 1) * map.w + wx] !== GG.Map.WALL) {
          staticCtx.fillStyle = theme.wallTop;
          staticCtx.fillRect(wx0, wy0, TILE, 5);
        }
        if (wy + 1 < map.h && map.grid[(wy + 1) * map.w + wx] !== GG.Map.WALL) {
          staticCtx.fillStyle = 'rgba(0,0,0,.55)';
          staticCtx.fillRect(wx0, wy0 + TILE - 4, TILE, 4);
        }
        staticCtx.strokeStyle = 'rgba(0,0,0,.28)';
        staticCtx.lineWidth = 1;
        staticCtx.strokeRect(wx0 + 0.5, wy0 + 0.5, TILE - 1, TILE - 1);
      }
    }

    // 地面涂装：撤离区的斜向警戒条
    if (map.extract) {
      var ex = map.extract.x, ey = map.extract.y, ew = map.extract.w, eh = map.extract.h;
      staticCtx.save();
      staticCtx.beginPath();
      staticCtx.rect(ex + 4, ey + 4, ew - 8, eh - 8);
      staticCtx.clip();
      staticCtx.fillStyle = 'rgba(224,179,84,.12)';
      staticCtx.fillRect(ex, ey, ew, eh);
      staticCtx.strokeStyle = 'rgba(224,179,84,.35)';
      staticCtx.lineWidth = 7;
      for (var hs = -eh; hs < ew + eh; hs += 26) {
        staticCtx.beginPath();
        staticCtx.moveTo(ex + hs, ey + eh);
        staticCtx.lineTo(ex + hs + eh, ey);
        staticCtx.stroke();
      }
      staticCtx.restore();
      staticCtx.strokeStyle = 'rgba(224,179,84,.5)';
      staticCtx.lineWidth = 2;
      staticCtx.strokeRect(ex + 4, ey + 4, ew - 8, eh - 8);
    }

    // 掩体 / 油桶 / 终端
    map.props.forEach(function (p) {
      if (!p.alive) return;
      var px = p.x, py = p.y;
      if (p.type === 'crate') drawCrate(staticCtx, px, py, p);
      else if (p.type === 'barrel') drawBarrel(staticCtx, px, py, p);
      else if (p.type === 'terminal') drawTerminal(staticCtx, px, py, p, theme);
    });

    map.staticDirty = false;
    return staticCanvas;
  };

  function drawCrate(g, x, y, p) {
    g.save();
    g.translate(x, y);
    g.fillStyle = 'rgba(0,0,0,.35)';
    g.beginPath();
    g.ellipse(3, 5, 21, 18, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#6d5135';
    g.fillRect(-18, -18, 36, 36);
    g.fillStyle = '#7d5f3f';
    g.fillRect(-18, -18, 36, 5);
    g.strokeStyle = '#4a3523';
    g.lineWidth = 2;
    g.strokeRect(-18, -18, 36, 36);
    g.strokeStyle = 'rgba(40,28,18,.7)';
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(-18, -18); g.lineTo(18, 18);
    g.moveTo(18, -18); g.lineTo(-18, 18);
    g.stroke();
    g.fillStyle = 'rgba(255,220,170,.08)';
    g.fillRect(-16, -16, 32, 2);
    if (p.flash > 0) {
      g.fillStyle = 'rgba(255,220,160,' + Math.min(0.5, p.flash * 2) + ')';
      g.fillRect(-18, -18, 36, 36);
    }
    g.restore();
  }

  function drawBarrel(g, x, y, p) {
    g.save();
    g.translate(x, y);
    g.fillStyle = 'rgba(0,0,0,.35)';
    g.beginPath();
    g.ellipse(2, 4, 16, 14, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#8f4526';
    g.beginPath();
    g.arc(0, 0, 15, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#c98347';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(0, 0, 15, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = '#b5622f';
    g.beginPath();
    g.arc(0, 0, 9, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#f0c25e';
    g.beginPath();
    g.arc(0, 0, 4, 0, Math.PI * 2);
    g.fill();
    if (p.flash > 0) {
      g.fillStyle = 'rgba(255,240,190,' + Math.min(0.7, p.flash * 3) + ')';
      g.beginPath();
      g.arc(0, 0, 15, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }

  function drawTerminal(g, x, y, p, theme) {
    g.save();
    g.translate(x, y);
    g.fillStyle = 'rgba(0,0,0,.4)';
    g.fillRect(-15, -12, 34, 32);
    g.fillStyle = '#20292b';
    g.fillRect(-18, -18, 36, 36);
    g.strokeStyle = '#3a4a48';
    g.lineWidth = 2;
    g.strokeRect(-18, -18, 36, 36);
    g.fillStyle = '#10201b';
    g.fillRect(-13, -13, 26, 16);
    g.fillStyle = p.hacked ? 'rgba(120,240,170,.9)' : 'rgba(90,190,140,.55)';
    g.fillRect(-12, -12, 24, 14);
    g.fillStyle = 'rgba(20,60,45,.55)';
    for (var i = 0; i < 3; i++) g.fillRect(-10, -10 + i * 4, 14 - i * 3, 1.4);
    g.fillStyle = 'rgba(120,240,180,.18)';
    g.beginPath();
    g.arc(0, -4, 22, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  /* ---------------- 相机 ---------------- */
  function updateCamera(world, input, dt) {
    var map = world.map;
    var pw = map.w * TILE, ph = map.h * TILE;
    var p = world.player;
    var targetX = p.x - C.VIEW.w / 2 + (input.mx - p.x) * 0.10;
    var targetY = p.y - C.VIEW.h / 2 + (input.my - p.y) * 0.10;
    var clampX = pw <= C.VIEW.w ? (pw - C.VIEW.w) / 2 : U.clamp(targetX, 0, pw - C.VIEW.w);
    var clampY = ph <= C.VIEW.h ? (ph - C.VIEW.h) / 2 : U.clamp(targetY, 0, ph - C.VIEW.h);
    if (!R.camReady) {
      R.cam.x = clampX; R.cam.y = clampY; R.camReady = true;
    } else {
      var k = 1 - Math.pow(0.002, dt);
      R.cam.x = U.lerp(R.cam.x, clampX, k);
      R.cam.y = U.lerp(R.cam.y, clampY, k);
    }
    if (pw <= C.VIEW.w) R.cam.x = (pw - C.VIEW.w) / 2;
    if (ph <= C.VIEW.h) R.cam.y = (ph - C.VIEW.h) / 2;
  }

  /* ---------------- 主绘制 ---------------- */
  R.frame = function (world, input, dt) {
    R.time += dt;
    if (!ctx) return;
    var map = world.map, p = world.player, theme = map.theme;
    updateCamera(world, input, dt);

    var shakeX = 0, shakeY = 0;
    if (world.shakeT > 0) {
      var s = world.shakeMag * Math.min(1, world.shakeT * 6);
      shakeX = U.rand(-s, s);
      shakeY = U.rand(-s, s);
    }
    var camX = Math.round(R.cam.x) + shakeX;
    var camY = Math.round(R.cam.y) + shakeY;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = theme.fog;
    ctx.fillRect(0, 0, C.VIEW.w, C.VIEW.h);

    ctx.save();
    ctx.translate(-camX, -camY);

    if (map.staticDirty || !staticCanvas) R.buildStatic(world);
    ctx.drawImage(staticCanvas, camX * SS, camY * SS, C.VIEW.w * SS, C.VIEW.h * SS, camX, camY, C.VIEW.w, C.VIEW.h);

    drawDecals(world, camX, camY);
    drawExtract(world);
    drawPickups(world);
    drawTerminals(world);

    // 实体按 y 排序
    var drawList = [];
    for (var i = 0; i < world.enemies.length; i++) {
      var e = world.enemies[i];
      if (e.alive || e.dying > 0) drawList.push(e);
    }
    drawList.push(p);
    drawList.sort(function (a, b) { return a.y - b.y; });
    for (var d = 0; d < drawList.length; d++) {
      var it = drawList[d];
      if (it === p) drawPlayer(world, p);
      else drawEnemy(world, it);
    }

    drawTracers(world);
    drawBullets(world);
    drawGrenades(world);
    drawParticles(world);
    drawBlasts(world);
    drawFloaters(world);

    ctx.restore();

    drawFog(world, camX, camY);

    // 雾外仍可见的曳光弹尾迹（极淡），帮助判断火力方向
    drawPostFx(world);
    drawCrosshair(world, input);
  };

  /* ---------------- 贴花 ---------------- */
  function drawDecals(world, camX, camY) {
    var decals = world.decals;
    for (var i = 0; i < decals.length; i++) {
      var d = decals[i];
      if (d.type === 'blood') {
        ctx.fillStyle = d.color;
        ctx.beginPath();
        ctx.ellipse(d.x, d.y, d.size, d.size * 0.75, 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(d.x + d.size * 0.9, d.y - d.size * 0.4, d.size * 0.5, d.size * 0.4, 0.2, 0, Math.PI * 2);
        ctx.fill();
      } else if (d.type === 'scorch') {
        var g = ctx.createRadialGradient(d.x, d.y, 2, d.x, d.y, d.size);
        g.addColorStop(0, d.color);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (d.type === 'hole') {
        ctx.fillStyle = d.color;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawExtract(world) {
    var map = world.map;
    if (!map.extract) return;
    var open = world.extractionOpen;
    var t = R.time * 2;
    ctx.save();
    ctx.globalAlpha = open ? 0.6 + Math.sin(t) * 0.25 : 0.25;
    ctx.fillStyle = open ? '#e8b453' : '#7a6c50';
    ctx.fillRect(map.extract.x + 6, map.extract.y + 6, map.extract.w - 12, map.extract.h - 12);
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = open ? '#ffd98a' : '#8b7a5c';
    ctx.lineWidth = 2;
    ctx.strokeRect(map.extract.x + 6, map.extract.y + 6, map.extract.w - 12, map.extract.h - 12);
    ctx.restore();
    if (open) {
      ctx.save();
      ctx.globalAlpha = 0.5 + Math.sin(t * 1.5) * 0.2;
      ctx.fillStyle = '#7fd3a1';
      ctx.font = '600 13px ui-monospace, Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('撤离', map.extract.x + map.extract.w / 2, map.extract.y - 10);
      ctx.restore();
    }
  }

  function drawPickups(world) {
    for (var i = 0; i < world.pickups.length; i++) {
      var pk = world.pickups[i];
      if (!pk.alive) continue;
      var bob = Math.sin(R.time * 3 + i) * 3;
      ctx.save();
      ctx.translate(pk.x, pk.y + bob);
      ctx.fillStyle = 'rgba(0,0,0,.4)';
      ctx.beginPath();
      ctx.ellipse(0, 12, 11, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      if (pk.type === 'ammo') {
        ctx.fillStyle = '#4f4634';
        ctx.fillRect(-10, -9, 20, 16);
        ctx.fillStyle = '#c9a56b';
        ctx.fillRect(-10, -9, 20, 3);
        ctx.fillStyle = '#ffd98a';
        ctx.fillRect(-5, -3, 2, 7);
        ctx.fillRect(-1, -3, 2, 7);
        ctx.fillRect(3, -3, 2, 7);
      } else {
        ctx.fillStyle = '#e8e4d8';
        ctx.fillRect(-10, -9, 20, 16);
        ctx.fillStyle = '#b3423a';
        ctx.fillRect(-2, -6, 4, 10);
        ctx.fillRect(-5, -3, 10, 4);
      }
      ctx.globalAlpha = 0.35 + Math.sin(R.time * 4) * 0.12;
      ctx.fillStyle = pk.type === 'ammo' ? '#ffd98a' : '#ff8a7a';
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawTerminals(world) {
    for (var i = 0; i < world.terminals.length; i++) {
      var t = world.terminals[i];
      if (t.hacked) {
        ctx.save();
        ctx.globalAlpha = 0.2 + Math.sin(R.time * 2) * 0.05;
        ctx.fillStyle = '#6ff0aa';
        ctx.beginPath();
        ctx.arc(t.x, t.y, 34, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      if (world.interact === t) {
        var prog = Math.min(1, (t.progress || 0) / 3);
        ctx.save();
        ctx.translate(t.x, t.y - 34);
        ctx.strokeStyle = 'rgba(255,255,255,.25)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = '#7fe0a8';
        ctx.beginPath();
        ctx.arc(0, 0, 15, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(230,240,235,.85)';
        ctx.font = '600 11px ui-monospace, Menlo, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('接入 ' + Math.round(prog * 100) + '%', 0, -22);
        ctx.restore();
      }
    }
  }

  /* ---------------- 玩家 ---------------- */
  function drawPlayer(world, p) {
    if (!p.alive) {
      ctx.save();
      ctx.fillStyle = 'rgba(90,20,16,.5)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 22, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    var walk = p.moving ? Math.sin(world.elapsed * (p.sprinting ? 18 : 11)) : 0;
    ctx.save();
    ctx.translate(p.x, p.y);

    // 影子
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    ctx.beginPath();
    ctx.ellipse(2, 4, 14, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    if (p.ifr > 0 && p.dodgeT > 0) {
      ctx.globalAlpha = 0.72;
    }

    // 脚下识别光圈（画在本体后面，避免盖住枪和头）
    ctx.strokeStyle = 'rgba(140,214,192,.34)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(140,214,192,.10)';
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fill();

    ctx.rotate(p.angle + Math.PI / 2);

    // 腿
    ctx.fillStyle = '#2f3628';
    ctx.beginPath();
    ctx.ellipse(-6, 6 + walk * 4, 4.5, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(6, 6 - walk * 4, 4.5, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // 身体
    ctx.fillStyle = '#5c7154';
    ctx.beginPath();
    ctx.arc(0, 0, 12.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(160,220,198,.55)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // 肩章识别
    ctx.fillStyle = 'rgba(150,214,192,.8)';
    ctx.fillRect(-10, -6, 5, 3);
    ctx.fillRect(5, -6, 5, 3);

    // 防弹背心
    ctx.fillStyle = '#8c7448';
    ctx.beginPath();
    ctx.ellipse(0, 1, 8, 9.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#5c4a2b';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // 头
    ctx.fillStyle = '#c7ac7e';
    ctx.beginPath();
    ctx.arc(0, -3, 6.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2b2f28';
    ctx.beginPath();
    ctx.arc(0, -4.4, 4.4, 0, Math.PI * 2);
    ctx.fill();

    // 枪
    var wdef = p.weapon ? p.weapon.def : C.WEAPONS.pistol;
    ctx.fillStyle = '#23252a';
    var gunLen = wdef.id === 'dmr' ? 34 : wdef.id === 'shotgun' ? 28 : wdef.id === 'smg' ? 26 : 22;
    ctx.fillRect(-2.4, -gunLen, 4.8, gunLen + 2);
    ctx.fillStyle = wdef.color;
    ctx.fillRect(-2.4, -gunLen, 4.8, 4);

    // 枪口火光
    if (p.muzzle > 0) {
      ctx.fillStyle = 'rgba(255,220,150,.95)';
      ctx.beginPath();
      var mL = gunLen + 6;
      ctx.moveTo(0, -mL - 8);
      ctx.lineTo(5, -mL);
      ctx.lineTo(0, -mL + 2);
      ctx.lineTo(-5, -mL);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

  }

  /* ---------------- 敌人 ---------------- */
  function drawEnemy(world, e) {
    var visible = e.alive && e.dying <= 0 &&
      U.dist(e.x, e.y, world.player.x, world.player.y) < 520 &&
      world.map.los(world.player.x, world.player.y, e.x, e.y, 560);
    if (!e.alive && e.dying <= 0) return;
    if (e.alive && !visible && !(e.boss && e.bossT < 9)) {
      // 不可见时不画本体，仅保留 Boss 的远程压迫感（激光/火力由粒子体现）
    }
    if (e.alive && !visible) return;

    // 狙击手激光预警（开火前 0.95 秒可见）
    if (e.alive && e.laserOn > 0 && e.aimTarget != null && visible) {
      var lx = e.x + Math.cos(e.aimTarget) * 700;
      var ly = e.y + Math.sin(e.aimTarget) * 700;
      ctx.save();
      ctx.globalAlpha = Math.min(1, e.laserOn * 1.6) * 0.85;
      ctx.strokeStyle = 'rgba(255,86,70,.9)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(lx, ly);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,180,150,.35)';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.restore();
    }

    var alpha = e.alive ? 1 : Math.max(0, e.dying / 1.1);
    ctx.save();
    ctx.globalAlpha = alpha * (visible || !e.alive ? 1 : 0.9);
    ctx.translate(e.x, e.y);

    // 影子
    ctx.fillStyle = 'rgba(0,0,0,.42)';
    ctx.beginPath();
    ctx.ellipse(2, 4, e.r + 2, e.r * 0.75, 0, 0, Math.PI * 2);
    ctx.fill();

    if (!e.alive) {
      ctx.rotate(e.angle);
      ctx.fillStyle = 'rgba(80,30,24,.55)';
      ctx.beginPath();
      ctx.ellipse(0, 0, e.r + 6, e.r - 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    ctx.rotate(e.angle + Math.PI / 2);

    // 腿
    ctx.fillStyle = '#2a2422';
    ctx.beginPath();
    ctx.ellipse(-5, 5, 4, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(5, 5, 4, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // 重装盾牌
    if (e.def.shield && e.type !== 'b') {
      ctx.strokeStyle = 'rgba(150,170,180,.55)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(0, 0, e.r + 5, -1.1, 1.1);
      ctx.stroke();
    }

    // 身体
    ctx.fillStyle = e.hitFlash > 0 ? '#ffffff' : e.def.color;
    ctx.beginPath();
    ctx.arc(0, 0, e.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.45)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 背心
    ctx.fillStyle = 'rgba(30,26,24,.6)';
    ctx.beginPath();
    ctx.ellipse(0, 1, e.r * 0.55, e.r * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();

    // 头
    ctx.fillStyle = e.type === 'm' ? '#c9b18a' : '#c0a279';
    ctx.beginPath();
    ctx.arc(0, -3, e.r * 0.48, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a2420';
    ctx.beginPath();
    ctx.arc(0, -4, e.r * 0.4, 0, Math.PI * 2);
    ctx.fill();

    // 枪
    ctx.fillStyle = '#1f2124';
    ctx.fillRect(-2, -e.r - 12, 4, e.r + 12);
    if (e.def.laser) {
      ctx.fillStyle = '#6c5a6a';
      ctx.fillRect(-2.4, -e.r - 18, 4.8, 10);
    }
    ctx.restore();

    // 血条 / 警觉标记
    if (e.hp < e.maxHp || e.alerted) {
      var bw = e.type === 'b' ? 0 : Math.max(24, e.r * 2.2);
      if (bw) {
        ctx.fillStyle = 'rgba(0,0,0,.6)';
        ctx.fillRect(e.x - bw / 2, e.y - e.r - 18, bw, 4);
        ctx.fillStyle = e.hp / e.maxHp > 0.5 ? '#c96a4a' : '#e04a38';
        ctx.fillRect(e.x - bw / 2, e.y - e.r - 18, bw * Math.max(0, e.hp / e.maxHp), 4);
      }
      if (e.alerted) {
        ctx.fillStyle = '#ff6b4a';
        ctx.font = '700 13px ui-monospace, Menlo, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('!', e.x, e.y - e.r - 24);
      }
    }

    // 狙击激光
    if (e.def.laser && e.aiming && visible) {
      var prog = Math.min(1, e.aimT / e.def.aim);
      ctx.save();
      ctx.globalAlpha = 0.25 + prog * 0.55;
      ctx.strokeStyle = '#ff4d4d';
      ctx.lineWidth = 1 + prog * 1.6;
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(world.player.x, world.player.y);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,80,80,.75)';
      ctx.beginPath();
      ctx.arc(world.player.x, world.player.y, 3 + prog * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Boss 光环
    if (e.type === 'b') {
      ctx.save();
      ctx.globalAlpha = 0.18 + Math.sin(R.time * 2) * 0.05;
      ctx.fillStyle = '#ff7a4d';
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r + 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /* ---------------- 弹道 / 粒子 ---------------- */
  function drawTracers(world) {
    for (var i = 0; i < world.tracers.length; i++) {
      var t = world.tracers[i];
      var a = Math.min(1, t.life / 0.055);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.strokeStyle = t.color;
      ctx.lineWidth = t.width;
      ctx.beginPath();
      ctx.moveTo(t.x1, t.y1);
      ctx.lineTo(t.x2, t.y2);
      ctx.stroke();
      ctx.globalAlpha = a * 0.35;
      ctx.lineWidth = t.width * 3;
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawBullets(world) {
    for (var i = 0; i < world.bullets.length; i++) {
      var b = world.bullets[i];
      ctx.save();
      ctx.strokeStyle = b.color;
      ctx.lineWidth = b.type === 'sniper' ? 2.2 : 1.5;
      ctx.beginPath();
      ctx.moveTo(b.px, b.py);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawGrenades(world) {
    for (var i = 0; i < world.grenades.length; i++) {
      var g = world.grenades[i];
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,.4)';
      ctx.beginPath();
      ctx.ellipse(g.x, g.y + 4, 6, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#6f7a55';
      ctx.beginPath();
      ctx.arc(g.x, g.y - g.z, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#c9d18a';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.fillStyle = (R.time * 6 % 1) < 0.5 ? '#ff6b4a' : '#7a2a1e';
      ctx.beginPath();
      ctx.arc(g.x + 2, g.y - g.z - 3, 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawParticles(world) {
    for (var i = 0; i < world.particles.length; i++) {
      var p = world.particles[i];
      var a = Math.min(1, p.life / p.maxLife);
      ctx.save();
      if (p.type === 'flash') {
        ctx.globalAlpha = a;
        var g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        g.addColorStop(0, 'rgba(255,240,200,.95)');
        g.addColorStop(0.45, 'rgba(255,190,100,.5)');
        g.addColorStop(1, 'rgba(255,150,60,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'smoke') {
        ctx.globalAlpha = a * 0.5;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1.6 - a * 0.6), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'blood') {
        ctx.globalAlpha = a * 0.9;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'casing') {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-2, -1, 4, 2);
        ctx.restore();
      } else if (p.type === 'debris') {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      } else {
        ctx.globalAlpha = a;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawBlasts(world) {
    for (var i = 0; i < world.blasts.length; i++) {
      var b = world.blasts[i];
      var k = 1 - b.life / b.max;
      ctx.save();
      ctx.globalAlpha = (1 - k) * 0.9;
      var g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r * (0.3 + k * 1.2));
      g.addColorStop(0, 'rgba(255,250,220,.95)');
      g.addColorStop(0.4, 'rgba(255,170,80,.65)');
      g.addColorStop(1, 'rgba(255,110,40,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * (0.3 + k * 1.2), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,220,170,' + (1 - k) * 0.7 + ')';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * (0.35 + k * 1.25), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawFloaters(world) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '600 12px ui-monospace, Menlo, monospace';
    for (var i = 0; i < world.floaters.length; i++) {
      var f = world.floaters[i];
      ctx.globalAlpha = Math.min(1, f.life * 2);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.restore();
  }

  /* ---------------- 迷雾 / 光照 ---------------- */
  function drawFog(world, camX, camY) {
    var p = world.player;
    var visionR = 500;
    R.visT -= 1;
    var px = p.x - camX, py = p.y - camY;
    if (!R.vis || R.visT <= 0 || R.visPX === undefined ||
        Math.abs(R.visPX - px) > 16 || Math.abs(R.visPY - py) > 16) {
      R.vis = world.map.visibility(p.x, p.y, visionR, 160);
      R.visPX = px; R.visPY = py;
      R.visT = 2;
    }

    fogCtx.setTransform(1, 0, 0, 1, 0, 0);
    fogCtx.globalCompositeOperation = 'source-over';
    fogCtx.clearRect(0, 0, C.VIEW.w, C.VIEW.h);
    fogCtx.fillStyle = 'rgba(4,5,8,.86)';
    fogCtx.fillRect(0, 0, C.VIEW.w, C.VIEW.h);

    fogCtx.globalCompositeOperation = 'destination-out';
    var grad = fogCtx.createRadialGradient(px, py, 30, px, py, visionR + 30);
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(0.55, 'rgba(0,0,0,.96)');
    grad.addColorStop(0.82, 'rgba(0,0,0,.66)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    fogCtx.fillStyle = grad;
    fogCtx.beginPath();
    for (var i = 0; i < R.vis.length; i++) {
      var vx = R.vis[i][0] - camX, vy = R.vis[i][1] - camY;
      if (i === 0) fogCtx.moveTo(vx, vy);
      else fogCtx.lineTo(vx, vy);
    }
    fogCtx.closePath();
    fogCtx.fill();

    // 枪口 / 爆炸的光孔
    var lights = [];
    if (p.muzzle > 0) lights.push({ x: p.x - camX, y: p.y - camY, r: 70 });
    for (var q = 0; q < world.particles.length; q++) {
      var pt = world.particles[q];
      if (pt.type !== 'flash') continue;
      lights.push({ x: pt.x - camX, y: pt.y - camY, r: pt.size * 2.2 });
    }
    for (var b = 0; b < world.blasts.length; b++) {
      var bl = world.blasts[b];
      lights.push({ x: bl.x - camX, y: bl.y - camY, r: bl.r * 1.5 });
    }
    if (world.extractionOpen && world.map.extract) {
      lights.push({
        x: world.map.extract.x + world.map.extract.w / 2 - camX,
        y: world.map.extract.y + world.map.extract.h / 2 - camY,
        r: 86
      });
    }
    for (var l = 0; l < lights.length; l++) {
      var li = lights[l];
      var lg = fogCtx.createRadialGradient(li.x, li.y, 0, li.x, li.y, li.r);
      lg.addColorStop(0, 'rgba(0,0,0,.8)');
      lg.addColorStop(1, 'rgba(0,0,0,0)');
      fogCtx.fillStyle = lg;
      fogCtx.beginPath();
      fogCtx.arc(li.x, li.y, li.r, 0, Math.PI * 2);
      fogCtx.fill();
    }

    fogCtx.globalCompositeOperation = 'source-over';
    ctx.drawImage(fogCanvas, 0, 0);
  }

  /* ---------------- 屏幕效果 / 准星 ---------------- */
  function drawPostFx(world) {
    var p = world.player;
    // 暖色环境光
    ctx.save();
    var warm = ctx.createRadialGradient(C.VIEW.w / 2, C.VIEW.h / 2, 200, C.VIEW.w / 2, C.VIEW.h / 2, 620);
    warm.addColorStop(0, 'rgba(255,200,140,.05)');
    warm.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = warm;
    ctx.fillRect(0, 0, C.VIEW.w, C.VIEW.h);

    // 暗角
    var vig = ctx.createRadialGradient(C.VIEW.w / 2, C.VIEW.h / 2, 250, C.VIEW.w / 2, C.VIEW.h / 2, 620);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,.62)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, C.VIEW.w, C.VIEW.h);

    // 受伤红边
    var hurt = Math.max(p.hurtFlash, p.hp / p.maxHp < 0.3 ? 0.35 + Math.sin(R.time * 4) * 0.12 : 0);
    if (hurt > 0.02) {
      var rg = ctx.createRadialGradient(C.VIEW.w / 2, C.VIEW.h / 2, 180, C.VIEW.w / 2, C.VIEW.h / 2, 600);
      rg.addColorStop(0, 'rgba(160,20,15,0)');
      rg.addColorStop(1, 'rgba(160,20,15,' + Math.min(0.55, hurt * 0.55) + ')');
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, C.VIEW.w, C.VIEW.h);
    }
    ctx.restore();
  }

  function drawCrosshair(world, input) {
    var p = world.player;
    if (!p.alive) return;
    var x = input.sx, y = input.sy;
    var w = p.weapon ? p.weapon.def : C.WEAPONS.pistol;
    var spread = (w.spread + p.bloom) * 260 + 8;
    var over = false;
    for (var i = 0; i < world.enemies.length; i++) {
      var e = world.enemies[i];
      if (!e.alive) continue;
      if (U.dist(input.mx, input.my, e.x, e.y) < e.r + 8) { over = true; break; }
    }
    ctx.save();
    ctx.strokeStyle = over ? '#ff5a45' : 'rgba(235,225,205,.65)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(x, y, spread, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = over ? '#ff7a60' : 'rgba(235,225,205,.85)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x - 3, y); ctx.lineTo(x + 3, y);
    ctx.moveTo(x, y - 3); ctx.lineTo(x, y + 3);
    ctx.stroke();
    // 命中反馈
    if (world.hitMarker > 0) {
      ctx.strokeStyle = 'rgba(255,240,200,' + Math.min(1, world.hitMarker * 5) + ')';
      ctx.lineWidth = 2;
      var s = 6;
      ctx.beginPath();
      ctx.moveTo(x - s, y - s); ctx.lineTo(x - s + 4, y - s + 4);
      ctx.moveTo(x + s, y - s); ctx.lineTo(x + s - 4, y - s + 4);
      ctx.moveTo(x - s, y + s); ctx.lineTo(x - s + 4, y + s - 4);
      ctx.moveTo(x + s, y + s); ctx.lineTo(x + s - 4, y + s - 4);
      ctx.stroke();
    }
    // 换弹进度
    if (p.reloading > 0) {
      var prog = 1 - p.reloading / Math.max(0.001, p.reloadTotal);
      ctx.strokeStyle = 'rgba(255,210,130,.85)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(x, y, spread + 7, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,220,160,.85)';
      ctx.font = '600 10px ui-monospace, Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('换弹', x, y + spread + 22);
    }
    ctx.restore();
  }

  /* ---------------- 小地图 ---------------- */
  R.minimap = function (world, mctx) {
    var map = world.map, p = world.player;
    var mw = mctx.canvas.width, mh = mctx.canvas.height;
    var sx = mw / map.w, sy = mh / map.h;
    mctx.clearRect(0, 0, mw, mh);
    mctx.fillStyle = 'rgba(8,9,11,.92)';
    mctx.fillRect(0, 0, mw, mh);
    for (var y = 0; y < map.h; y++) {
      for (var x = 0; x < map.w; x++) {
        var explored = map.explored[y * map.w + x];
        var code = map.grid[y * map.w + x];
        if (code === GG.Map.WALL) {
          mctx.fillStyle = explored ? 'rgba(96,93,86,.5)' : 'rgba(96,93,86,.11)';
        } else if (explored) {
          mctx.fillStyle = 'rgba(150,140,120,.16)';
        } else {
          continue;
        }
        mctx.fillRect(x * sx, y * sy, Math.ceil(sx), Math.ceil(sy));
      }
    }
    // 终端
    for (var i = 0; i < world.terminals.length; i++) {
      var t = world.terminals[i];
      mctx.fillStyle = t.hacked ? 'rgba(110,240,170,.9)' : 'rgba(120,220,160,.55)';
      mctx.fillRect(t.x / TILE * sx - 1, t.y / TILE * sy - 1, 3, 3);
    }
    if (map.extract) {
      mctx.strokeStyle = world.extractionOpen ? '#f0c25e' : 'rgba(240,194,94,.4)';
      mctx.lineWidth = 1;
      mctx.strokeRect(map.extract.x / TILE * sx, map.extract.y / TILE * sy, map.extract.w / TILE * sx, map.extract.h / TILE * sy);
    }
    for (var e = 0; e < world.enemies.length; e++) {
      var en = world.enemies[e];
      if (!en.alive) continue;
      if (!map.los(p.x, p.y, en.x, en.y, 520)) continue;
      mctx.fillStyle = en.boss ? '#ff5a3c' : 'rgba(255,105,80,.9)';
      mctx.beginPath();
      mctx.arc(en.x / TILE * sx, en.y / TILE * sy, en.boss ? 3 : 2, 0, Math.PI * 2);
      mctx.fill();
    }
    // 玩家
    mctx.save();
    mctx.translate(p.x / TILE * sx, p.y / TILE * sy);
    mctx.rotate(p.angle);
    mctx.fillStyle = '#f5e9cf';
    mctx.beginPath();
    mctx.moveTo(4, 0); mctx.lineTo(-2.5, 2.5); mctx.lineTo(-2.5, -2.5);
    mctx.closePath();
    mctx.fill();
    mctx.restore();
    if (world.interact) {
      mctx.strokeStyle = 'rgba(120,240,170,.8)';
      mctx.beginPath();
      mctx.arc(world.interact.x / TILE * sx, world.interact.y / TILE * sy, 5, 0, Math.PI * 2);
      mctx.stroke();
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
