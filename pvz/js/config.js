/* ============================================================
 * config.js —— 全局常量、植物表、僵尸表、章节表、关卡表
 * 只放数据，不放逻辑。新增植物/僵尸/关卡都在这里加数据即可。
 * ============================================================ */
window.PVZ = window.PVZ || {};

(function (PVZ) {
  "use strict";

  // ---------- 画布与网格 ----------
  var CFG = {
    W: 1280,
    H: 720,
    ROWS: 5,
    COLS: 9,
    // 网格与背景草坪对齐（背景图草地纵向约在 16%~83%）
    grid: { top: 126, bottom: 588, left: 74, right: 1258 },

    // 阳光
    sunMinInterval: 9,        // 自然掉落最短间隔（秒）
    sunMaxInterval: 13,
    sunValue: 25,
    sunLife: 12,             // 阳光在场上停留秒数

    // 僵尸
    zombieStartGap: 2,       // 出生点在网格右侧多远处（格）
    attackDps: 42,           // 僵尸啃咬植物的每秒伤害
    lawnmowerSpeed: 2.6,     // 割草机推进速度（格/秒）

    // 表现
    particleLimit: 260,
    hoverAlpha: 0.5
  };
  CFG.cellW = (CFG.grid.right - CFG.grid.left) / CFG.COLS;
  CFG.cellH = (CFG.grid.bottom - CFG.grid.top) / CFG.ROWS;
  PVZ.CFG = CFG;

  // ---------- 植物表 ----------
  // kind 决定行为分支：producer / shooter / sniper / lobber / wall / mine / bomb
  PVZ.PLANTS = [
    {
      id: "sunflower", name: "向日葵", kind: "producer",
      cost: 50, cooldown: 7, hp: 300, img: "assets/plant_sunflower.png",
      scale: 1.0, produce: 25, produceInterval: 11,
      upgrades: [{ name: "双生向日葵", cost: 125, produceInterval: 7 }],
      desc: "每隔一段时间产出阳光，是全部经济的基础。"
    },
    {
      id: "peashooter", name: "豌豆射手", kind: "shooter",
      cost: 100, cooldown: 7, hp: 300, img: "assets/plant_peashooter.png",
      scale: 1.05, damage: 40, interval: 1.4, bulletSpeed: 11,
      upgrades: [
        { name: "双发豌豆", cost: 125, damage: 40, interval: 1.0, shots: 2 },
        { name: "三发豌豆", cost: 175, damage: 40, interval: 0.85, shots: 3 }
      ],
      desc: "向本行最前方的僵尸连续发射豌豆，点它可以花阳光升级。"
    },
    {
      id: "wallnut", name: "坚果墙", kind: "wall",
      cost: 50, cooldown: 20, hp: 3200, img: "assets/plant_wallnut.png",
      scale: 0.98, armorBar: true,
      upgrades: [{ name: "钢铁坚果", cost: 100, hpMul: 2.2 }],
      desc: "耐打的肉盾，把僵尸挡在固定一格上。"
    },
    {
      id: "potato", name: "土豆地雷", kind: "mine",
      cost: 25, cooldown: 12, hp: 260, img: "assets/plant_potato.png",
      scale: 0.78, armDelay: 10, damage: 1800, blastRadius: 0.9,
      desc: "埋下后需要时间武装，触发即炸，适合补漏。"
    },
    {
      id: "cabbage", name: "卷心菜投手", kind: "lobber",
      cost: 100, cooldown: 9, hp: 300, img: "assets/plant_cabbage.png",
      scale: 1.0, damage: 60, interval: 2.4, arc: 0.42,
      upgrades: [{ name: "重型卷心菜", cost: 150, damage: 100, interval: 2.0 }],
      desc: "抛射攻击，越过前排植物打到后面的僵尸。"
    },
    {
      id: "cherry", name: "樱桃炸弹", kind: "bomb",
      cost: 150, cooldown: 30, hp: 99999, img: "assets/plant_cherry.png",
      scale: 0.88, fuse: 1.0, damage: 1800, blastGrid: 1,
      desc: "放下后一秒爆炸，清掉周围九格的所有僵尸。"
    },
    {
      id: "sniper", name: "狙击枪射手", kind: "sniper",
      cost: 200, cooldown: 15, hp: 360, img: "assets/plant_sniper.png",
      scale: 0.92, damage: 90, interval: 2.6, bulletSpeed: 18,
      upgrades: [{ name: "穿甲狙击枪", cost: 200, damage: 180, interval: 2.2 }],
      desc: "高伤害穿甲弹，沿本行穿透所有僵尸。"
    },
    {
      id: "gatling", name: "爆炸机枪射手", kind: "shooter",
      cost: 250, cooldown: 20, hp: 340, img: "assets/plant_gatling.png",
      scale: 1.02, damage: 22, interval: 0.45, bulletSpeed: 16,
      gatling: true, explosive: true, splashDamage: 56, splashRadius: 1.0,
      desc: "四管连发，豌豆命中后还会小范围爆炸，专治成群的僵尸。"
    },
    {
      id: "doom", name: "毁灭菇", kind: "bomb",
      cost: 150, cooldown: 45, hp: 99999, img: "assets/plant_doom.png",
      scale: 1.15, fuse: 1.2, damage: 2600, blastGrid: 2,
      desc: "落地一秒多后引爆，五格范围寸草不生，代价是极长的冷却。"
    }
  ];

  PVZ.PLANT_MAP = {};
  PVZ.PLANTS.forEach(function (p) { PVZ.PLANT_MAP[p.id] = p; });

  // ---------- 僵尸表 ----------
  PVZ.ZOMBIES = {
    normal: {
      id: "normal", name: "普通僵尸",
      hp: 200, speed: 0.20, img: "assets/zombie_normal.png", scale: 1.28
    },
    cone: {
      id: "cone", name: "路障僵尸",
      hp: 420, speed: 0.205, img: "assets/zombie_cone.png", scale: 1.28
    },
    pole: {
      id: "pole", name: "撑杆僵尸",
      hp: 330, speed: 0.30, img: "assets/zombie_pole.png", scale: 1.3,
      vault: true, vaultDistance: 1.6, poletSpeed: 0.32
    },
    bucket: {
      id: "bucket", name: "铁桶僵尸",
      hp: 860, speed: 0.185, img: "assets/zombie_bucket.png", scale: 1.38
    }
  };

  // ---------- 章节（用色调区分场景，共用同一张背景） ----------
  PVZ.CHAPTERS = [
    {
      id: 1, name: "白天前院",
      palette: { tint: null, darkness: 0, gridAlpha: 0.10 },
      note: "阳光充足，适合熟悉种植节奏。"
    },
    {
      id: 2, name: "黄昏草坪",
      palette: { tint: "rgba(255,150,60,0.20)", darkness: 0.12, gridAlpha: 0.10 },
      note: "光线变暖，僵尸走得更快。"
    },
    {
      id: 3, name: "夜色后院",
      palette: { tint: "rgba(40,70,150,0.34)", darkness: 0.42, gridAlpha: 0.13 },
      note: "视野变暗，阳光来得更慢。"
    },
    {
      id: 4, name: "血色暴走",
      palette: { tint: "rgba(150,30,30,0.30)", darkness: 0.34, gridAlpha: 0.14 },
      note: "尸潮全面压上，守到最后。"
    }
  ];

  // ---------- 关卡表 ----------
  // waves[].groups: [类型, 数量, 出生间隔]，rows 可选，指定行（0 起）
  PVZ.LEVELS = [
    {
      id: 1, chapter: 1, name: "第一排草坪",
      sunStart: 185, sunInterval: 9, cooldownMul: 1,
      speedMul: 1, hpMul: 1, unlock: ["sunflower", "peashooter"],
      brief: "先种向日葵攒阳光，再补豌豆射手。",
      waves: [
        { at: 9, groups: [["normal", 1]] },
        { at: 22, groups: [["normal", 2, 3.6]] },
        { at: 38, groups: [["normal", 3, 2.9]] },
        { at: 54, groups: [["normal", 2, 2.4], ["normal", 2, 1.9]] }
      ]
    },
    {
      id: 2, chapter: 1, name: "路障来袭",
      sunStart: 175, sunInterval: 9, cooldownMul: 1,
      speedMul: 1.025, hpMul: 1.01, unlock: ["sunflower", "peashooter", "wallnut"],
      brief: "路障僵尸更耐打，用坚果墙拖住它。",
      waves: [
        { at: 8, groups: [["normal", 2, 3.6]] },
        { at: 22, groups: [["normal", 2, 3], ["cone", 1]] },
        { at: 38, groups: [["cone", 2, 3.6], ["normal", 2, 2.4]] },
        { at: 54, groups: [["cone", 2, 2.4], ["normal", 3, 2.2]] },
        { at: 70, groups: [["cone", 2, 1.9], ["normal", 3, 1.7]] }
      ]
    },
    {
      id: 3, chapter: 1, name: "撑杆跳选手",
      sunStart: 165, sunInterval: 9, cooldownMul: 1,
      speedMul: 1.04, hpMul: 1.025, unlock: ["sunflower", "peashooter", "wallnut", "potato"],
      brief: "撑杆僵尸会跳过第一株植物，留一层土豆地雷。",
      waves: [
        { at: 8, groups: [["normal", 2, 3.6]] },
        { at: 24, groups: [["pole", 1], ["normal", 2, 2.9]] },
        { at: 40, groups: [["pole", 2, 3.6], ["cone", 1]] },
        { at: 56, groups: [["normal", 3, 2.2], ["pole", 2, 2.4]] },
        { at: 72, groups: [["pole", 2, 1.9], ["cone", 2, 1.9], ["normal", 2, 1.7]] }
      ]
    },
    {
      id: 4, chapter: 2, name: "铁桶阵",
      sunStart: 155, sunInterval: 9, cooldownMul: 1.025,
      speedMul: 1.05, hpMul: 1.05, unlock: ["sunflower", "peashooter", "wallnut", "potato", "cabbage"],
      brief: "铁桶僵尸硬得像墙，卷心菜投手能越过肉盾。",
      waves: [
        { at: 8, groups: [["normal", 1, 3]] },
        { at: 24, groups: [["cone", 1, 2.9], ["normal", 1, 2.4]] },
        { at: 40, groups: [["bucket", 1], ["normal", 2, 2.2]] },
        { at: 56, groups: [["bucket", 1, 3.6], ["cone", 1, 2.4]] },
        { at: 74, groups: [["bucket", 1, 2.4], ["pole", 1, 2.4], ["normal", 1, 1.9]] }
      ]
    },
    {
      id: 5, chapter: 2, name: "双线压制",
      sunStart: 155, sunInterval: 9, cooldownMul: 1.025,
      speedMul: 1.07, hpMul: 1.07,
      unlock: ["sunflower", "peashooter", "wallnut", "potato", "cabbage", "cherry"],
      brief: "僵尸开始同时压两行，樱桃炸弹是唯一的解围手段。",
      waves: [
        { at: 8, groups: [["normal", 1, 2.9], ["cone", 1]] },
        { at: 24, groups: [["cone", 1, 2.6], ["normal", 1, 2.4], ["pole", 1]] },
        { at: 40, groups: [["bucket", 1], ["normal", 2, 1.9], ["cone", 1, 2.2]] },
        { at: 58, groups: [["bucket", 1, 2.9], ["pole", 1, 2.4], ["normal", 2, 1.7]] },
        { at: 76, groups: [["bucket", 1, 2.2], ["cone", 2, 1.8], ["normal", 2, 1.4]] }
      ]
    },
    {
      id: 6, chapter: 2, name: "黄昏突围",
      sunStart: 145, sunInterval: 10, cooldownMul: 1.05,
      speedMul: 1.1, hpMul: 1.1,
      unlock: ["sunflower", "peashooter", "wallnut", "potato", "cabbage", "cherry"],
      brief: "太阳落山前撑住最后一波总攻。",
      waves: [
        { at: 8, groups: [["normal", 2, 2.4]] },
        { at: 24, groups: [["pole", 1, 2.6], ["cone", 1, 2.4]] },
        { at: 42, groups: [["bucket", 1, 2.9], ["normal", 2, 1.9]] },
        { at: 60, groups: [["bucket", 1, 2.4], ["pole", 1, 2.2], ["cone", 1, 1.9]] },
        { at: 80, groups: [["bucket", 2, 1.9], ["cone", 2, 1.7], ["normal", 2, 1.4]] },
        { at: 98, groups: [["bucket", 2, 1.7], ["pole", 2, 1.6], ["cone", 2, 1.4], ["normal", 2, 1.2]] }
      ]
    },
    {
      id: 7, chapter: 3, name: "夜袭",
      sunStart: 135, sunInterval: 11, cooldownMul: 1.075,
      speedMul: 1.12, hpMul: 1.11,
      unlock: ["sunflower", "peashooter", "wallnut", "potato", "cabbage", "cherry", "sniper"],
      brief: "夜里的阳光更少，狙击枪射手负责清理硬目标。",
      waves: [
        { at: 8, groups: [["normal", 2, 2.4]] },
        { at: 26, groups: [["cone", 2, 2.6], ["pole", 1]] },
        { at: 44, groups: [["bucket", 1, 2.9], ["normal", 2, 1.9]] },
        { at: 62, groups: [["bucket", 1, 2.4], ["pole", 2, 2.2]] },
        { at: 82, groups: [["bucket", 2, 2.2], ["cone", 2, 1.7], ["normal", 2, 1.4]] },
        { at: 100, groups: [["bucket", 2, 1.8], ["pole", 2, 1.6], ["cone", 2, 1.4]] }
      ]
    },
    {
      id: 8, chapter: 3, name: "铁流",
      sunStart: 135, sunInterval: 11, cooldownMul: 1.075,
      speedMul: 1.14, hpMul: 1.13,
      unlock: ["sunflower", "peashooter", "wallnut", "potato", "cabbage", "cherry", "sniper"],
      brief: "铁桶僵尸成群涌来，别把阳光全花在输出上。",
      waves: [
        { at: 8, groups: [["cone", 2, 2.6]] },
        { at: 26, groups: [["bucket", 1, 3.1], ["normal", 2, 1.9]] },
        { at: 44, groups: [["bucket", 2, 2.6], ["pole", 1, 2.4]] },
        { at: 64, groups: [["bucket", 2, 2.4], ["cone", 2, 1.9], ["normal", 2, 1.4]] },
        { at: 84, groups: [["bucket", 3, 1.9], ["pole", 2, 1.7]] },
        { at: 104, groups: [["bucket", 3, 1.7], ["cone", 3, 1.4], ["normal", 3, 1.2]] }
      ]
    },
    {
      id: 9, chapter: 3, name: "三面夹击",
      sunStart: 125, sunInterval: 12, cooldownMul: 1.1,
      speedMul: 1.165, hpMul: 1.15,
      unlock: ["sunflower", "peashooter", "wallnut", "potato", "cabbage", "cherry", "sniper", "gatling"],
      brief: "五条通道同时受压力，坚果墙要提前铺。",
      waves: [
        { at: 8, groups: [["normal", 3, 2.2]] },
        { at: 26, groups: [["cone", 2, 2.4], ["pole", 1, 2.6]] },
        { at: 46, groups: [["bucket", 2, 2.6], ["normal", 2, 1.7]] },
        { at: 66, groups: [["bucket", 2, 2.2], ["pole", 2, 1.9], ["cone", 2, 1.7]] },
        { at: 86, groups: [["bucket", 3, 1.8], ["cone", 3, 1.6], ["normal", 3, 1.3]] },
        { at: 106, groups: [["bucket", 3, 1.6], ["pole", 3, 1.4], ["cone", 3, 1.3], ["normal", 3, 1.2]] }
      ]
    },
    {
      id: 10, chapter: 4, name: "破晓之前",
      sunStart: 135, sunInterval: 12, cooldownMul: 1.125,
      speedMul: 1.19, hpMul: 1.17,
      unlock: ["sunflower", "peashooter", "wallnut", "potato", "cabbage", "cherry", "sniper", "gatling", "doom"],
      brief: "尸潮开始连绵不绝，冷却比之前更长。",
      waves: [
        { at: 8, groups: [["cone", 3, 2.2]] },
        { at: 28, groups: [["bucket", 2, 2.4], ["pole", 1, 2.4]] },
        { at: 48, groups: [["bucket", 3, 2.2], ["normal", 3, 1.4]] },
        { at: 68, groups: [["bucket", 3, 1.9], ["pole", 3, 1.7]] },
        { at: 88, groups: [["bucket", 3, 1.7], ["cone", 3, 1.4]] },
        { at: 108, groups: [["bucket", 3, 1.4], ["pole", 3, 1.3], ["normal", 3, 1.2]] }
      ]
    },
    {
      id: 11, chapter: 4, name: "尸潮",
      sunStart: 125, sunInterval: 13, cooldownMul: 1.15,
      speedMul: 1.22, hpMul: 1.21,
      unlock: ["sunflower", "peashooter", "wallnut", "potato", "cabbage", "cherry", "sniper", "gatling", "doom"],
      brief: "每一行都在被压，任何一格空着都会漏。",
      waves: [
        { at: 8, groups: [["cone", 2, 2.2], ["normal", 1, 2.4]] },
        { at: 28, groups: [["cone", 3, 1.9], ["pole", 2, 2.2]] },
        { at: 48, groups: [["bucket", 3, 2.2], ["normal", 3, 1.4]] },
        { at: 68, groups: [["bucket", 3, 1.8], ["pole", 3, 1.7]] },
        { at: 88, groups: [["bucket", 3, 1.6], ["cone", 3, 1.4], ["normal", 3, 1.2]] },
        { at: 108, groups: [["bucket", 4, 1.3], ["pole", 3, 1.3], ["cone", 3, 1.2]] }
      ]
    },
    {
      id: 12, chapter: 4, name: "最终防线",
      sunStart: 115, sunInterval: 13, cooldownMul: 1.175,
      speedMul: 1.25, hpMul: 1.23,
      unlock: ["sunflower", "peashooter", "wallnut", "potato", "cabbage", "cherry", "sniper", "gatling", "doom"],
      brief: "五条通道全线告急，顶住这一波就结束了。",
      boss: { type: "bucket", hpMul: 1.4, scale: 1.45, name: "铁桶巨尸" },
      waves: [
        { at: 8, groups: [["cone", 2, 2.2], ["normal", 1, 2.2]] },
        { at: 28, groups: [["pole", 3, 1.9], ["cone", 3, 1.9]] },
        { at: 48, groups: [["bucket", 3, 1.9], ["normal", 3, 1.3]] },
        { at: 68, groups: [["bucket", 3, 1.7], ["pole", 3, 1.6]] },
        { at: 88, groups: [["bucket", 4, 1.4], ["cone", 4, 1.3], ["normal", 4, 1.2]] },
        { at: 108, boss: true, groups: [["bucket", 4, 1.3], ["pole", 4, 1.2], ["cone", 4, 1.2]] }
      ]
    }
  ];

  PVZ.LEVEL_MAP = {};
  PVZ.LEVELS.forEach(function (l) { PVZ.LEVEL_MAP[l.id] = l; });

  // 每关胜利后解锁的植物（用于奖励弹窗文案）
  PVZ.UNLOCK_REWARDS = {
    1: "wallnut",
    2: "potato",
    3: "cabbage",
    4: "cherry",
    6: "sniper",
    8: "gatling",
    9: "doom"
  };
})(window.PVZ);
