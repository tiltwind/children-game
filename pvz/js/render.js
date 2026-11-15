/* ============================================================
 * render.js —— 全部 Canvas 绘制
 * 只读 world / game 状态，不改逻辑
 * ============================================================ */
window.PVZ = window.PVZ || {};

(function (PVZ) {
  "use strict";

  var CFG = PVZ.CFG;
  var U = PVZ.Util;

  var R = {};

  // 精灵按目标高度等比绘制，水平居中、底边对齐 baseY
  R.sprite = function (ctx, img, cx, baseY, targetH, opt) {
    if (!img || !img.width) return;
    opt = opt || {};
    var s = targetH / img.height;
    var dw = img.width * s;
    var dh = targetH;
    ctx.save();
    if (opt.alpha !== undefined) ctx.globalAlpha = opt.alpha;
    if (opt.rotate) {
      ctx.translate(cx, baseY);
      ctx.rotate(opt.rotate);
      ctx.drawImage(img, -dw / 2, -dh, dw, dh);
    } else {
      ctx.drawImage(img, cx - dw / 2, baseY - dh + (opt.offsetY || 0), dw, dh);
    }
    ctx.restore();
    return { w: dw, h: dh };
  };

  R.draw = function (ctx, game) {
    var world = game.world;
    var W = CFG.W, H = CFG.H;
    var palette = world ? game.chapterPalette() : null;

    ctx.clearRect(0, 0, W, H);

    // ---------- 背景 ----------
    var bg = PVZ.Assets.images.bg;
    if (bg && bg.width) {
      var s = Math.max(W / bg.width, H / bg.height);
      var dw = bg.width * s, dh = bg.height * s;
      ctx.drawImage(bg, (W - dw) / 2, (H - dh) / 2, dw, dh);
    } else {
      ctx.fillStyle = "#2f6b36";
      ctx.fillRect(0, 0, W, H);
    }

    // ---------- 章节色调 ----------
    if (palette) {
      if (palette.tint) {
        ctx.fillStyle = palette.tint;
        ctx.fillRect(0, 0, W, H);
      }
      if (palette.darkness > 0) {
        ctx.fillStyle = "rgba(8,16,34," + palette.darkness + ")";
        ctx.fillRect(0, 0, W, H);
      }
    }

    if (!world) {
      R.drawIdleLawn(ctx);
      return;
    }

    R.drawGrid(ctx, game, palette);
    R.drawMowers(ctx, world);
    R.drawPlants(ctx, world);
    R.drawZombies(ctx, world, game);
    // 阳光在植物和僵尸之后画，保证永远浮在最上层，不会被向日葵挡住
    R.drawSuns(ctx, world);
    R.drawProjectiles(ctx, world);
    R.drawParticles(ctx, world);
    R.drawHoverGhost(ctx, game);
    R.drawVignette(ctx);
    R.drawWavePreview(ctx, world);
  };

  // 下一波预告：贴在草坪右上方，告诉玩家下一波有哪些僵尸、各几只
  R.drawWavePreview = function (ctx, world) {
    var waves = world.level && world.level.waves;
    if (!waves) return;
    var idx = world.waveIdx;
    if (idx >= waves.length) return;
    var wave = waves[idx];
    var NAMES = { normal: "普通", cone: "路障", bucket: "铁桶", pole: "撑杆" };
    var counts = {}, order = [];
    (wave.groups || []).forEach(function (g) {
      var k = g[0];
      if (!counts[k]) { counts[k] = 0; order.push(k); }
      counts[k] += g[1];
    });
    var parts = [];
    order.forEach(function (k) { parts.push((NAMES[k] || k) + " ×" + counts[k]); });
    var head = idx === waves.length - 1 ? "最后一波  " : "下一波  ";
    var label = head + parts.join(" · ");
    if (wave.boss) label += " · 巨尸";

    ctx.save();
    ctx.font = "600 15px 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif";
    var tw = ctx.measureText(label).width;
    var boxW = tw + 26;
    var boxH = 28;
    var bx = CFG.grid.right - boxW;
    var by = CFG.grid.top - 34;
    ctx.fillStyle = "rgba(12,8,4,0.62)";
    ctx.fillRect(bx, by, boxW, boxH);
    ctx.fillStyle = idx === waves.length - 1 ? "#ff9a6e" : "#ffe9a8";
    ctx.fillRect(bx, by, 4, boxH);
    ctx.fillStyle = idx === waves.length - 1 ? "#ffd0bb" : "#fff3d2";
    ctx.textBaseline = "middle";
    ctx.fillText(label, bx + 14, by + boxH / 2 + 1);
    ctx.restore();
  };

  R.drawIdleLawn = function (ctx) {
    var g = CFG.grid;
    ctx.save();
    ctx.globalAlpha = 0.14;
    ctx.strokeStyle = "#e8ffd2";
    ctx.lineWidth = 2;
    for (var r = 0; r <= CFG.ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(g.left, g.top + r * CFG.cellH);
      ctx.lineTo(g.right, g.top + r * CFG.cellH);
      ctx.stroke();
    }
    for (var c = 0; c <= CFG.COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(g.left + c * CFG.cellW, g.top);
      ctx.lineTo(g.left + c * CFG.cellW, g.bottom);
      ctx.stroke();
    }
    ctx.restore();
  };

  R.drawGrid = function (ctx, game, palette) {
    var g = CFG.grid;
    var alpha = (palette && palette.gridAlpha) || 0.1;
    ctx.save();
    for (var r = 0; r < CFG.ROWS; r++) {
      for (var c = 0; c < CFG.COLS; c++) {
        if ((r + c) % 2 === 0) {
          ctx.fillStyle = "rgba(255,255,255," + alpha + ")";
          ctx.fillRect(g.left + c * CFG.cellW, g.top + r * CFG.cellH, CFG.cellW, CFG.cellH);
        }
      }
    }
    // 格子细线
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 1;
    for (var i = 1; i < CFG.ROWS; i++) {
      ctx.beginPath();
      ctx.moveTo(g.left, g.top + i * CFG.cellH);
      ctx.lineTo(g.right, g.top + i * CFG.cellH);
      ctx.stroke();
    }
    for (var j = 1; j < CFG.COLS; j++) {
      ctx.beginPath();
      ctx.moveTo(g.left + j * CFG.cellW, g.top);
      ctx.lineTo(g.left + j * CFG.cellW, g.bottom);
      ctx.stroke();
    }
    ctx.restore();

    // 当前悬停格
    var hover = game.hoverCell;
    if (hover && (game.selected || game.shovel)) {
      var hx = g.left + hover.col * CFG.cellW;
      var hy = g.top + hover.row * CFG.cellH;
      var ok = game.shovel ? !!game.world.grid[hover.row][hover.col]
                           : game.world.canPlant(hover.row, hover.col, game.selected).ok;
      ctx.save();
      ctx.fillStyle = ok ? "rgba(255,255,255,0.22)" : "rgba(200,60,60,0.22)";
      ctx.fillRect(hx, hy, CFG.cellW, CFG.cellH);
      ctx.strokeStyle = ok ? "rgba(255,255,255,0.85)" : "rgba(255,120,120,0.9)";
      ctx.lineWidth = 3;
      ctx.strokeRect(hx + 1.5, hy + 1.5, CFG.cellW - 3, CFG.cellH - 3);
      ctx.restore();
    }
  };

  // 种植预览：半透明植物
  R.drawHoverGhost = function (ctx, game) {
    var hover = game.hoverCell;
    if (!hover || !game.selected || game.shovel) return;
    var check = game.world.canPlant(hover.row, hover.col, game.selected);
    if (!check.ok) return;
    var spec = check.spec;
    var img = PVZ.Assets.images[spec.id];
    var c = U.cellCenter(hover.row, hover.col);
    R.sprite(ctx, img, c.x, c.y + CFG.cellH * 0.36, CFG.cellH * 1.02 * (spec.scale || 1), { alpha: 0.42 });
  };

  R.drawPlants = function (ctx, world) {
    for (var r = 0; r < CFG.ROWS; r++) {
      for (var c = 0; c < CFG.COLS; c++) {
        var p = world.grid[r][c];
        if (!p) continue;
        var img = PVZ.Assets.images[p.spec.id];
        var h = CFG.cellH * 1.04 * (p.spec.scale || 1);
        var baseY = p.y + CFG.cellH * 0.36;
        var alpha = 1;

        if (p.spec.kind === "mine" && !p.armed) {
          alpha = 0.62;
        }
        if (p.hitFlash > 0) alpha = 0.72;

        // 摇摆
        var tilt = Math.sin(p.swing) * 0.03;
        R.sprite(ctx, img, p.x, baseY, h, { alpha: alpha, rotate: tilt });

        // 土豆地雷武装后的红光
        if (p.spec.kind === "mine" && p.armed) {
          ctx.save();
          ctx.globalAlpha = 0.35 + Math.sin(p.swing * 2) * 0.12;
          ctx.fillStyle = "#ff5a3c";
          ctx.beginPath();
          ctx.arc(p.x, baseY - h * 0.82, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // 可升级提示：阳光够时在植物头顶亮一个脉动的金色小箭头
        var up = p.upgradeInfo ? p.upgradeInfo() : null;
        if (up && world.sun >= up.cost) {
          var ax = p.x + CFG.cellW * 0.26;
          var ay = baseY - h * 0.94;
          ctx.save();
          ctx.globalAlpha = 0.55 + Math.sin(p.swing * 1.7) * 0.35;
          ctx.fillStyle = "#ffd452";
          ctx.beginPath();
          ctx.moveTo(ax, ay - 7);
          ctx.lineTo(ax + 6, ay + 2);
          ctx.lineTo(ax - 6, ay + 2);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }

        // 血条（坚果墙等有护甲的植物）
        if (p.spec.armorBar && p.hp < p.maxHp) {
          var w = CFG.cellW * 0.66;
          var ratio = Math.max(0, p.hp / p.maxHp);
          var bx = p.x - w / 2;
          var by = baseY - h - 6;
          ctx.save();
          ctx.fillStyle = "rgba(0,0,0,0.45)";
          ctx.fillRect(bx, by, w, 6);
          ctx.fillStyle = ratio > 0.5 ? "#8ddc62" : (ratio > 0.22 ? "#e8c34a" : "#e2664a");
          ctx.fillRect(bx, by, w * ratio, 6);
          ctx.restore();
        }
      }
    }
  };

  R.drawZombies = function (ctx, world, game) {
    // 按行排序，越靠下越后画
    var list = world.zombies.slice().sort(function (a, b) { return a.row - b.row; });
    for (var i = 0; i < list.length; i++) {
      var z = list[i];
      if (z.dead) continue;
      var img = PVZ.Assets.images["z_" + z.type];
      var h = CFG.cellH * 1.1 * z.scale;
      var bob = Math.sin(z.walkPhase) * 2.2;
      var lean = z.eating ? Math.sin(z.walkPhase * 3) * 0.05 : Math.sin(z.walkPhase) * 0.018;
      var baseY = z.y + CFG.cellH * 0.44;

      ctx.save();
      if (z.hitFlash > 0) ctx.globalAlpha = 0.78;
      R.sprite(ctx, img, z.x, baseY + bob, h, { rotate: lean });
      ctx.restore();

      // 血量条
      if (z.hp < z.maxHp) {
        var w = CFG.cellW * (z.boss ? 0.9 : 0.62);
        var ratio = Math.max(0, z.hp / z.maxHp);
        var bx = z.x - w / 2;
        var by = baseY - h - 10;
        ctx.save();
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(bx, by, w, 7);
        ctx.fillStyle = ratio > 0.55 ? "#e0574a" : "#f0a03c";
        ctx.fillRect(bx, by, w * ratio, 7);
        ctx.restore();
      }
    }
  };

  R.drawProjectiles = function (ctx, world) {
    for (var i = 0; i < world.projectiles.length; i++) {
      var p = world.projectiles[i];
      if (p.dead) continue;
      if (p.kind === "lob") {
        ctx.save();
        ctx.fillStyle = "#8fdc6a";
        ctx.strokeStyle = "rgba(40,80,30,0.7)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      } else if (p.kind === "pierce") {
        ctx.save();
        var grad = ctx.createLinearGradient(p.x - 26, p.y, p.x + 8, p.y);
        grad.addColorStop(0, "rgba(255,240,180,0)");
        grad.addColorStop(0.6, "rgba(255,236,140,0.85)");
        grad.addColorStop(1, "#fffbe0");
        ctx.strokeStyle = grad;
        ctx.lineWidth = 4;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(p.x - 26, p.y);
        ctx.lineTo(p.x + 6, p.y);
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.save();
        ctx.fillStyle = p.explosive ? "#ffb347" : "#a8e05c";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.explosive ? 8 : 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.beginPath();
        ctx.arc(p.x - 2, p.y - 2, 2.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  };

  R.drawSuns = function (ctx, world) {
    for (var i = 0; i < world.suns.length; i++) {
      var s = world.suns[i];
      if (s.collected) continue;
      var pulse = 1 + Math.sin(s.spin) * 0.06;
      var r = 22 * pulse;

      ctx.save();
      var glow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r * 2.6);
      glow.addColorStop(0, "rgba(255,226,110,0.55)");
      glow.addColorStop(1, "rgba(255,226,110,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r * 2.6, 0, Math.PI * 2);
      ctx.fill();

      // 光芒
      ctx.translate(s.x, s.y);
      ctx.rotate(s.spin * 0.4);
      ctx.fillStyle = "rgba(255,214,80,0.85)";
      for (var k = 0; k < 8; k++) {
        ctx.rotate(Math.PI / 4);
        ctx.beginPath();
        ctx.moveTo(0, -r * 1.55);
        ctx.lineTo(4, -r * 0.85);
        ctx.lineTo(-4, -r * 0.85);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      ctx.save();
      var core = ctx.createRadialGradient(s.x - 5, s.y - 5, 2, s.x, s.y, r);
      core.addColorStop(0, "#fffbe8");
      core.addColorStop(0.55, "#ffd24d");
      core.addColorStop(1, "#f0a720");
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  };

  R.drawMowers = function (ctx, world) {
    for (var i = 0; i < world.mowers.length; i++) {
      var m = world.mowers[i];
      if (m.state === "done") continue;
      var x = m.x, y = m.y;
      ctx.save();
      // 车身
      ctx.fillStyle = "#3f8f43";
      ctx.fillRect(x - 26, y - 26, 52, 28);
      ctx.fillStyle = "#e8e8e8";
      ctx.fillRect(x - 20, y - 22, 26, 10);
      // 把手
      ctx.strokeStyle = "#2a5d2c";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x - 22, y - 26);
      ctx.lineTo(x - 32, y - 46);
      ctx.stroke();
      // 轮子
      ctx.fillStyle = "#1f1f1f";
      ctx.beginPath(); ctx.arc(x - 14, y + 2, 8, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 14, y + 2, 8, 0, Math.PI * 2); ctx.fill();
      // 刀片
      ctx.fillStyle = "#c9d2c0";
      ctx.beginPath();
      ctx.moveTo(x + 24, y - 18);
      ctx.lineTo(x + 40, y - 8);
      ctx.lineTo(x + 24, y + 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  };

  R.drawParticles = function (ctx, world) {
    for (var i = 0; i < world.particles.length; i++) {
      var p = world.particles[i];
      if (p.dead) continue;
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  };

  R.drawVignette = function (ctx) {
    var W = CFG.W, H = CFG.H;
    var v = ctx.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 0.92);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,0.35)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  };

  PVZ.Render = R;
})(window.PVZ);
