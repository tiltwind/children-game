/* ============================================================
 * map.js —— 关卡网格、碰撞、视线、射线、可见多边形、寻路流场
 * 依赖：config.js / util.js
 * ============================================================ */
(function (root) {
  'use strict';
  var GG = (root.GG = root.GG || {});
  var C = GG.C;
  var U = GG.U;
  var TILE = C.TILE;

  var FLOOR = 0, WALL = 1, CRATE = 2, BARREL = 3, TERMINAL = 4, EXTRACT = 5;

  function Map(w, h, mission) {
    this.w = w;
    this.h = h;
    this.mission = mission;
    this.grid = new Uint8Array(w * h);
    this.grid.fill(WALL);
    this.props = [];
    this.explored = new Uint8Array(w * h);
    this.flow = null;
    this.flowTarget = null;
    this.staticDirty = true;
    this.theme = C.THEMES[mission.theme] || C.THEMES.warehouse;
    this.build(mission);
  }

  Map.prototype.idx = function (cx, cy) { return cy * this.w + cx; };
  Map.prototype.inside = function (cx, cy) { return cx >= 0 && cy >= 0 && cx < this.w && cy < this.h; };
  Map.prototype.code = function (cx, cy) {
    if (!this.inside(cx, cy)) return WALL;
    return this.grid[cy * this.w + cx];
  };
  Map.prototype.walkable = function (cx, cy) {
    var c = this.code(cx, cy);
    return c === FLOOR || c === EXTRACT;
  };
  Map.prototype.blocked = function (cx, cy) { return !this.walkable(cx, cy); };

  Map.prototype.build = function (m) {
    var self = this;
    function carve(r) {
      for (var y = r.y; y < r.y + r.h; y++) {
        for (var x = r.x; x < r.x + r.w; x++) {
          if (self.inside(x, y)) self.grid[y * self.w + x] = FLOOR;
        }
      }
    }
    (m.rooms || []).forEach(carve);
    (m.corridors || []).forEach(carve);

    // 外圈强制为墙
    for (var x = 0; x < this.w; x++) {
      this.grid[x] = WALL;
      this.grid[(this.h - 1) * this.w + x] = WALL;
    }
    for (var y = 0; y < this.h; y++) {
      this.grid[y * this.w] = WALL;
      this.grid[y * this.w + this.w - 1] = WALL;
    }

    (m.pillars || []).forEach(function (p) {
      if (self.inside(p[0], p[1])) self.grid[p[1] * self.w + p[0]] = WALL;
    });

    (m.crates || []).forEach(function (p) {
      self.placeProp('crate', p[0], p[1], 62);
    });
    (m.barrels || []).forEach(function (p) {
      self.placeProp('barrel', p[0], p[1], 30);
    });
    (m.terminals || []).forEach(function (p) {
      self.placeProp('terminal', p[0], p[1], 9999);
    });

    if (m.extract) {
      for (var ey = m.extract.y; ey < m.extract.y + m.extract.h; ey++) {
        for (var ex = m.extract.x; ex < m.extract.x + m.extract.w; ex++) {
          if (this.inside(ex, ey)) this.grid[ey * this.w + ex] = EXTRACT;
        }
      }
      this.extract = {
        x: m.extract.x * TILE, y: m.extract.y * TILE,
        w: m.extract.w * TILE, h: m.extract.h * TILE
      };
    }

    // 出生点
    var ps = m.player || [20, 18];
    var start = this.findFloor(ps[0], ps[1]);
    this.playerStart = { x: (start[0] + 0.5) * TILE, y: (start[1] + 0.5) * TILE };

    this.enemySpawns = (m.enemies || []).map(function (e) {
      var f = self.findFloor(e.x, e.y);
      return { type: e.t, cx: f[0], cy: f[1] };
    });

    this.pickups = (m.pickups || []).map(function (p) {
      var f = self.findFloor(p.x, p.y);
      return { type: p.t, cx: f[0], cy: f[1], x: (f[0] + 0.5) * TILE, y: (f[1] + 0.5) * TILE, alive: true };
    });

    this.wavePoints = (m.wavePoints || []).map(function (p) {
      var f = self.findFloor(p[0], p[1]);
      return { cx: f[0], cy: f[1], x: (f[0] + 0.5) * TILE, y: (f[1] + 0.5) * TILE };
    });

    if (m.objective && m.objective.zone) {
      var z = m.objective.zone;
      this.zone = { x: (z.x + 0.5) * TILE, y: (z.y + 0.5) * TILE, r: z.r * TILE };
    }
  };

  Map.prototype.placeProp = function (type, cx, cy, hp) {
    if (!this.inside(cx, cy)) return null;
    var code = type === 'crate' ? CRATE : type === 'barrel' ? BARREL : TERMINAL;
    this.grid[cy * this.w + cx] = code;
    var p = {
      type: type, cx: cx, cy: cy,
      x: (cx + 0.5) * TILE, y: (cy + 0.5) * TILE,
      r: type === 'terminal' ? 17 : type === 'barrel' ? 14 : 17,
      hp: hp, maxHp: hp, alive: true, hacked: false, flash: 0
    };
    this.props.push(p);
    return p;
  };

  Map.prototype.destroyProp = function (p) {
    if (!p || !p.alive) return;
    p.alive = false;
    if (p.type !== 'terminal') {
      var i = p.cy * this.w + p.cx;
      if (this.grid[i] === CRATE || this.grid[i] === BARREL) this.grid[i] = FLOOR;
      this.staticDirty = true;
    }
    this.flow = null;
  };

  Map.prototype.findFloor = function (cx, cy) {
    cx = U.clamp(Math.round(cx), 1, this.w - 2);
    cy = U.clamp(Math.round(cy), 1, this.h - 2);
    if (this.walkable(cx, cy)) return [cx, cy];
    for (var r = 1; r < Math.max(this.w, this.h); r++) {
      for (var dy = -r; dy <= r; dy++) {
        for (var dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          if (this.walkable(cx + dx, cy + dy)) return [cx + dx, cy + dy];
        }
      }
    }
    return [cx, cy];
  };

  Map.prototype.cellAt = function (x, y) {
    return [Math.floor(x / TILE), Math.floor(y / TILE)];
  };
  Map.prototype.blockedAt = function (x, y) {
    return this.blocked(Math.floor(x / TILE), Math.floor(y / TILE));
  };

  /* ---------------- 圆形碰撞 ---------------- */
  Map.prototype.circleHits = function (x, y, r) {
    var c0x = Math.floor((x - r) / TILE), c1x = Math.floor((x + r) / TILE);
    var c0y = Math.floor((y - r) / TILE), c1y = Math.floor((y + r) / TILE);
    for (var cy = c0y; cy <= c1y; cy++) {
      for (var cx = c0x; cx <= c1x; cx++) {
        if (!this.blocked(cx, cy)) continue;
        var rx = cx * TILE, ry = cy * TILE;
        var nx = U.clamp(x, rx, rx + TILE);
        var ny = U.clamp(y, ry, ry + TILE);
        var dx = x - nx, dy = y - ny;
        if (dx * dx + dy * dy < r * r) return true;
      }
    }
    return false;
  };

  // 轴分离移动，分 5px 小步避免高速穿透
  Map.prototype.moveCircle = function (ent, dx, dy) {
    var steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 5));
    var sx = dx / steps, sy = dy / steps;
    var hitX = false, hitY = false;
    for (var i = 0; i < steps; i++) {
      if (!this.circleHits(ent.x + sx, ent.y, ent.r)) {
        ent.x += sx;
      } else {
        hitX = true;
      }
      if (!this.circleHits(ent.x, ent.y + sy, ent.r)) {
        ent.y += sy;
      } else {
        hitY = true;
      }
    }
    ent.x = U.clamp(ent.x, ent.r, this.w * TILE - ent.r);
    ent.y = U.clamp(ent.y, ent.r, this.h * TILE - ent.r);
    return { hitX: hitX, hitY: hitY };
  };

  /* ---------------- 视线 / 射线 ---------------- */
  Map.prototype.los = function (x1, y1, x2, y2, maxDist) {
    var dx = x2 - x1, dy = y2 - y1;
    var dist = Math.hypot(dx, dy);
    if (maxDist && dist > maxDist) return false;
    var steps = Math.max(1, Math.ceil(dist / 6));
    var ux = dx / steps, uy = dy / steps;
    for (var i = 1; i < steps; i++) {
      if (this.blockedAt(x1 + ux * i, y1 + uy * i)) return false;
    }
    return true;
  };

  Map.prototype.raycast = function (x, y, dx, dy, maxDist) {
    var len = Math.hypot(dx, dy);
    if (len < 0.0001) return { dist: 0, x: x, y: y, hit: false };
    dx /= len; dy /= len;
    var step = 5;
    var last = 0;
    for (var d = step; d <= maxDist; d += step) {
      var px = x + dx * d, py = y + dy * d;
      if (this.blockedAt(px, py)) {
        return { dist: Math.max(0, d - step * 0.6), x: px, y: py, hit: true };
      }
      last = d;
    }
    return { dist: Math.min(last, maxDist), x: x + dx * Math.min(last, maxDist), y: y + dy * Math.min(last, maxDist), hit: false };
  };

  Map.prototype.visibility = function (x, y, radius, rays) {
    rays = rays || 170;
    var pts = [];
    var step = 6;
    for (var i = 0; i < rays; i++) {
      var a = (i / rays) * Math.PI * 2;
      var dx = Math.cos(a), dy = Math.sin(a);
      var last = 0;
      for (var d = step; d <= radius; d += step) {
        if (this.blockedAt(x + dx * d, y + dy * d)) break;
        last = d;
      }
      if (last < step) last = step * 0.4;
      pts.push([x + dx * last, y + dy * last]);
    }
    return pts;
  };

  /* ---------------- 探索（小地图） ---------------- */
  Map.prototype.reveal = function (x, y, radius) {
    var c0x = Math.floor((x - radius) / TILE), c1x = Math.floor((x + radius) / TILE);
    var c0y = Math.floor((y - radius) / TILE), c1y = Math.floor((y + radius) / TILE);
    for (var cy = c0y; cy <= c1y; cy++) {
      for (var cx = c0x; cx <= c1x; cx++) {
        if (!this.inside(cx, cy)) continue;
        var px = (cx + 0.5) * TILE, py = (cy + 0.5) * TILE;
        if (U.dist(px, py, x, y) > radius) continue;
        if (this.los(x, y, px, py, radius)) this.explored[cy * this.w + cx] = 1;
      }
    }
  };

  /* ---------------- 寻路流场 ---------------- */
  Map.prototype.buildFlow = function (tx, ty) {
    var c = this.cellAt(tx, ty);
    var cx = c[0], cy = c[1];
    if (!this.walkable(cx, cy)) {
      var f = this.findFloor(cx, cy);
      cx = f[0]; cy = f[1];
    }
    var w = this.w, h = this.h;
    var dist = new Int16Array(w * h);
    dist.fill(-1);
    var queue = new Int32Array(w * h);
    var head = 0, tail = 0;
    var start = cy * w + cx;
    dist[start] = 0;
    queue[tail++] = start;
    while (head < tail) {
      var id = queue[head++];
      var x0 = id % w, y0 = (id - x0) / w;
      var d0 = dist[id];
      var nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (var k = 0; k < 4; k++) {
        var nx = x0 + nb[k][0], ny = y0 + nb[k][1];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        var ni = ny * w + nx;
        if (dist[ni] !== -1 || !this.walkable(nx, ny)) continue;
        dist[ni] = d0 + 1;
        queue[tail++] = ni;
      }
    }
    this.flow = dist;
    this.flowTarget = { cx: cx, cy: cy };
    return dist;
  };

  Map.prototype.flowDir = function (cx, cy) {
    if (!this.flow || !this.inside(cx, cy)) return null;
    var best = this.flow[cy * this.w + cx];
    if (best < 0) return null;
    if (best === 0) return { cx: cx, cy: cy, done: true };
    var bx = cx, by = cy, bd = best;
    for (var dy = -1; dy <= 1; dy++) {
      for (var dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        var nx = cx + dx, ny = cy + dy;
        if (!this.walkable(nx, ny)) continue;
        if (dx && dy && (!this.walkable(cx + dx, cy) || !this.walkable(cx, cy + dy))) continue;
        var v = this.flow[ny * this.w + nx];
        if (v >= 0 && v < bd) { bd = v; bx = nx; by = ny; }
      }
    }
    if (bx === cx && by === cy) return null;
    return { cx: bx, cy: by, x: (bx + 0.5) * TILE, y: (by + 0.5) * TILE };
  };

  Map.prototype.findCover = function (ex, ey, tx, ty, maxTiles) {
    var c0 = this.cellAt(ex, ey);
    var best = null, bestScore = Infinity;
    for (var dy = -maxTiles; dy <= maxTiles; dy++) {
      for (var dx = -maxTiles; dx <= maxTiles; dx++) {
        var cx = c0[0] + dx, cy = c0[1] + dy;
        if (!this.walkable(cx, cy)) continue;
        var px = (cx + 0.5) * TILE, py = (cy + 0.5) * TILE;
        // 必须挡住来自玩家的视线，否则不算掩体
        if (this.los(px, py, tx, ty)) continue;
        var d = U.dist(px, py, ex, ey);
        if (d > maxTiles * TILE) continue;
        var score = d + U.dist(px, py, tx, ty) * 0.12;
        if (score < bestScore) { bestScore = score; best = { x: px, y: py, cx: cx, cy: cy }; }
      }
    }
    return best;
  };

  Map.prototype.randomFloorNear = function (cx, cy, radius) {
    for (var i = 0; i < 30; i++) {
      var x = cx + Math.round(U.rand(-radius, radius));
      var y = cy + Math.round(U.rand(-radius, radius));
      if (this.walkable(x, y)) return { cx: x, cy: y };
    }
    return { cx: cx, cy: cy };
  };

  Map.prototype.inExtract = function (x, y) {
    if (!this.extract) return false;
    return x >= this.extract.x && x <= this.extract.x + this.extract.w &&
      y >= this.extract.y && y <= this.extract.y + this.extract.h;
  };

  GG.Map = {
    create: function (mission) {
      return new Map(mission.map.w, mission.map.h, mission);
    },
    FLOOR: FLOOR, WALL: WALL, CRATE: CRATE, BARREL: BARREL,
    TERMINAL: TERMINAL, EXTRACT: EXTRACT
  };
})(typeof window !== 'undefined' ? window : globalThis);
