/* ============================================================
 * entities.js —— 场上所有实体：植物、僵尸、子弹、阳光、粒子、割草机
 * 每个实体只负责自己的状态推进，跨实体结算统一交给 world.js
 * ============================================================ */
window.PVZ = window.PVZ || {};

(function (PVZ) {
  "use strict";

  var U = PVZ.Util;
  var CFG = PVZ.CFG;
  var uid = 0;

  // ======================= 植物 =======================
  function Plant(spec, row, col) {
    this.uid = ++uid;
    this.base = spec;
    // 拷贝一份属性，升级时改的是这个实例自己的数值，不污染全局植物表
    this.spec = {};
    for (var k in spec) { this.spec[k] = spec[k]; }
    this.tier = 0;
    this.row = row;
    this.col = col;
    this.hp = spec.hp;
    this.maxHp = spec.hp;
    this.timer = 0;
    this.armed = false;      // 土豆地雷是否已武装
    this.fuse = spec.fuse || 0;
    this.dead = false;
    this.hitFlash = 0;
    this.swing = Math.random() * Math.PI * 2;   // 摇摆相位
    var c = U.cellCenter(row, col);
    this.x = c.x;
    this.y = c.y;
  }

  // 下一级升级信息，已升满返回 null
  Plant.prototype.upgradeInfo = function () {
    var list = this.base.upgrades;
    if (!list) return null;
    return list[this.tier] || null;
  };

  Plant.prototype.applyUpgrade = function () {
    var up = this.upgradeInfo();
    if (!up) return null;
    for (var k in up) {
      if (k === "cost" || k === "name") continue;
      if (k === "hpMul") {
        this.maxHp = this.maxHp * up.hpMul;
        this.hp = this.maxHp;
        continue;
      }
      this.spec[k] = up[k];
    }
    this.tier++;
    return up;
  };

  Plant.prototype.update = function (dt, world) {
    if (this.dead) return;
    var spec = this.spec;
    this.swing += dt * 2;
    if (this.hitFlash > 0) this.hitFlash -= dt;

    switch (spec.kind) {
      case "producer":
        this.timer += dt;
        if (this.timer >= spec.produceInterval) {
          this.timer = 0;
          world.spawnSunFromPlant(this);
        }
        break;

      case "shooter":
        if (world.hasTargetAhead(this.row, this.col)) {
          this.timer += dt;
          if (this.timer >= spec.interval) {
            this.timer = 0;
            world.fireStraight(this, spec, false);
          }
        } else {
          this.timer = 0;
        }
        break;

      case "sniper":
        if (world.hasTargetAhead(this.row, this.col)) {
          this.timer += dt;
          if (this.timer >= spec.interval) {
            this.timer = 0;
            world.fireStraight(this, spec, true);
          }
        } else {
          this.timer = 0;
        }
        break;

      case "lobber":
        if (world.hasTargetAhead(this.row, this.col)) {
          this.timer += dt;
          if (this.timer >= spec.interval) {
            this.timer = 0;
            world.fireLob(this, spec);
          }
        } else {
          this.timer = 0;
        }
        break;

      case "mine":
        if (!this.armed) {
          this.timer += dt;
          if (this.timer >= spec.armDelay) { this.armed = true; this.timer = 0; }
        } else {
          var z = world.zombieAtCell(this.row, this.col);
          if (z) world.explodeAt(this.row, this.col, spec.blastRadius, spec.damage, "mine", this);
        }
        break;

      case "bomb":
        this.fuse -= dt;
        if (this.fuse <= 0) world.blastGrid(this.row, this.col, spec.blastGrid, spec.damage, this);
        break;

      default:
        break;
    }
  };

  Plant.prototype.hurt = function (dmg) {
    this.hp -= dmg;
    this.hitFlash = 0.12;
    if (this.hp <= 0) this.dead = true;
  };

  // ======================= 僵尸 =======================
  function Zombie(typeId, row, opts) {
    opts = opts || {};
    var def = PVZ.ZOMBIES[typeId];
    this.uid = ++uid;
    this.type = typeId;
    this.def = def;
    this.name = opts.name || def.name;
    this.row = row;
    this.x = opts.x;                       // 像素坐标（身体中心）
    this.y = U.cellCenter(row, 0).y;
    this.maxHp = def.hp * (opts.hpMul || 1);
    this.hp = this.maxHp;
    this.speed = def.speed * (opts.speedMul || 1) * CFG.cellW; // px/s
    this.scale = (opts.scale || 1) * def.scale;
    this.hasPole = !!def.vault;
    this.vaultLeft = def.vaultDistance || 0;
    this.vaultTimer = 0;
    this.eating = null;
    this.eatTimer = 0;
    this.dead = false;
    this.hitFlash = 0;
    this.walkPhase = Math.random() * Math.PI * 2;
    this.frozen = 0;
    this.boss = !!opts.boss;
  }

  Zombie.prototype.update = function (dt, world) {
    if (this.dead) return;
    this.walkPhase += dt * 3.4;
    if (this.hitFlash > 0) this.hitFlash -= dt;

    // 撑杆跳：正在跳跃
    if (this.vaultTimer > 0) {
      this.vaultTimer -= dt;
      this.x -= (this.vaultLeft * CFG.cellW) / 0.45 * dt;
      if (this.vaultTimer <= 0) this.vaultTimer = 0;
      return;
    }

    // 找到嘴前方的植物
    var mouth = this.x - CFG.cellW * 0.3;
    var col = Math.floor((mouth - CFG.grid.left) / CFG.cellW);
    var plant = null;
    if (col >= 0 && col < CFG.COLS) plant = world.grid[this.row][col];

    if (plant && !plant.dead) {
      // 撑杆僵尸第一次遇到植物 → 直接跳过
      if (this.hasPole) {
        this.hasPole = false;
        this.vaultTimer = 0.45;
        this.x -= CFG.cellW * 0.1;
        world.onVault(this);
        return;
      }
      this.eating = plant;
      plant.hurt(CFG.attackDps * dt);
      this.eatTimer += dt;
      if (this.eatTimer > 0.45) {
        this.eatTimer = 0;
        world.emitChomp(this);
      }
      return;
    }

    this.eating = null;
    this.eatTimer = 0;
    this.x -= this.speed * dt;

    // 到达左边界
    if (this.x <= CFG.grid.left + CFG.cellW * 0.12) {
      world.onZombieReachHouse(this);
    }
  };

  Zombie.prototype.hurt = function (dmg, kind) {
    this.hp -= dmg;
    this.hitFlash = 0.1;
    if (this.hp <= 0) this.dead = true;
  };

  // ======================= 子弹 =======================
  // kind: "pea" 直线单体 / "pierce" 直线穿透 / "lob" 抛物线
  function Projectile(kind, opts) {
    this.uid = ++uid;
    this.kind = kind;
    this.row = opts.row;
    this.x = opts.x;
    this.y = opts.y;
    this.startY = opts.y;
    this.damage = opts.damage;
    this.speed = opts.speed;
    this.arc = opts.arc || 0;
    this.targetX = opts.targetX || 0;
    this.travel = 0;
    this.totalDist = Math.max(1, this.targetX - this.x);
    this.dead = false;
    this.hitSet = opts.pierce ? {} : null;
    this.img = opts.img || null;
    this.payload = opts.payload || null;
    // 爆炸弹（爆炸机枪射手）：命中后对周围再补一次范围伤害
    this.explosive = !!opts.explosive;
    this.splashDamage = opts.splashDamage || 0;
    this.splashRadius = opts.splashRadius || 1;
    this.gatling = !!opts.gatling;
  }

  Projectile.prototype.update = function (dt, world) {
    if (this.dead) return;

    if (this.kind === "lob") {
      this.travel += this.speed * dt;
      this.x += this.speed * dt;
      var t = U.clamp((this.x - (this.targetX - this.totalDist)) / this.totalDist, 0, 1);
      this.y = this.startY - Math.sin(t * Math.PI) * this.arc * CFG.cellH;
      if (t >= 1) {
        world.onLobLand(this);
      }
      return;
    }

    this.x += this.speed * dt;
    if (this.x > CFG.W + 40) { this.dead = true; return; }
    world.checkProjectileHit(this);
  };

  // ======================= 阳光 =======================
  function Sun(x, y, value, opts) {
    opts = opts || {};
    this.uid = ++uid;
    this.x = x;
    this.y = y;
    this.value = value;
    this.life = CFG.sunLife;
    this.vy = opts.vy === undefined ? 46 : opts.vy;
    this.tx = opts.tx === undefined ? x : opts.tx;
    this.ty = opts.ty === undefined ? y : opts.ty;
    this.collected = false;
    this.spin = Math.random() * Math.PI * 2;
    this.spawnT = 0;
  }

  Sun.prototype.update = function (dt) {
    this.spawnT += dt;
    this.spin += dt * 2.2;
    // 向目标点滑落
    this.x = U.lerp(this.x, this.tx, Math.min(1, dt * 2.4));
    this.y = U.lerp(this.y, this.ty, Math.min(1, dt * 2.6));
    if (this.y >= this.ty - 1) this.life -= dt;
  };

  // ======================= 粒子 =======================
  function Particle(x, y, opts) {
    opts = opts || {};
    this.x = x;
    this.y = y;
    this.vx = opts.vx || U.rand(-120, 120);
    this.vy = opts.vy || U.rand(-160, -40);
    this.g = opts.g === undefined ? 260 : opts.g;
    this.life = opts.life || U.rand(0.35, 0.7);
    this.max = this.life;
    this.r = opts.r || U.rand(2, 5);
    this.color = opts.color || "#ffffff";
    this.dead = false;
  }

  Particle.prototype.update = function (dt) {
    this.life -= dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vy += this.g * dt;
    if (this.life <= 0) this.dead = true;
  };

  // ======================= 割草机 =======================
  function Mower(row) {
    this.uid = ++uid;
    this.row = row;
    this.x = CFG.grid.left - 24;
    this.y = CFG.grid.top + (row + 0.5) * CFG.cellH + CFG.cellH * 0.18;
    this.state = "idle";   // idle / running / done
    this.speed = CFG.lawnmowerSpeed * CFG.cellW;
  }

  Mower.prototype.update = function (dt, world) {
    if (this.state !== "running") return;
    this.x += this.speed * dt;
    if (this.x > CFG.grid.right + 80) {
      this.state = "done";
    }
  };

  PVZ.Entities = {
    Plant: Plant,
    Zombie: Zombie,
    Projectile: Projectile,
    Sun: Sun,
    Particle: Particle,
    Mower: Mower
  };
})(window.PVZ);
