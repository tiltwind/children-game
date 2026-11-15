/* ============================================================
 * config.js —— 全部数值与 8 关关卡定义
 * 依赖：无（挂到 window.GG）
 * 说明：地图用「房间 + 走廊」矩形拼装，避免手写字符画出错，
 *       运行时再由 map.js 生成网格、掩体与导航数据。
 * ============================================================ */
(function (root) {
  'use strict';
  var GG = (root.GG = root.GG || {});
  var C = (GG.C = {});

  C.TILE = 40;
  C.VIEW = { w: 960, h: 600 };
  C.SAVE_KEY = 'shutu.gun-game.v2';
  C.VERSION = 2;

  /* ---------------- 玩家 ---------------- */
  C.PLAYER = {
    r: 12,
    hp: 120,
    armor: 20,
    speed: 148,          // 行走 px/s
    sprint: 222,         // 冲刺 px/s
    stamina: 100,
    staminaDrain: 22,    // 冲刺每秒消耗
    staminaRegen: 26,
    staminaDelay: 0.7,   // 停止冲刺后延迟回复
    dodgeSpeed: 430,
    dodgeTime: 0.24,
    dodgeCd: 0.9,
    dodgeIframes: 0.3,
    meleeRange: 46,
    meleeDamage: 42,
    takedownRange: 40,
    interactRange: 52,
    noiseWalk: 0,        // 走路不惊动
    noiseSprint: 250,
    grenadeRadius: 118,
    grenadeDamage: 110,
    grenadeMaxRange: 330,
    medkitHeal: 55,
    pickupRange: 34
  };

  /* ---------------- 武器 ---------------- */
  C.WEAPONS = {
    pistol: {
      id: 'pistol', name: 'MK23 消音手枪', short: 'MK23', slot: 1,
      dmg: 20, interval: 0.155, mag: 15, reserve: 150,
      spread: 0.012, bloom: 0.022, bloomMax: 0.075, recover: 0.22,
      reload: 1.35, noise: 150, pellets: 1, pierce: 0, auto: false,
      range: 620, recoil: 0.9, tracer: '#ffd98a', color: '#d7b46a',
      desc: '自带消音器，枪声只惊动身边敌人，适合潜行点名。'
    },
    smg: {
      id: 'smg', name: 'MP5 冲锋枪', short: 'MP5', slot: 2,
      dmg: 11, interval: 0.07, mag: 32, reserve: 220,
      spread: 0.042, bloom: 0.05, bloomMax: 0.16, recover: 0.3,
      reload: 1.9, noise: 430, pellets: 1, pierce: 0, auto: true,
      range: 460, recoil: 2.1, tracer: '#ffe9a8', color: '#c9a86a',
      desc: '近距离压制火力，射速快但扩散大，枪声会拉来整层楼的人。'
    },
    shotgun: {
      id: 'shotgun', name: 'M870 霰弹枪', short: 'M870', slot: 3,
      dmg: 9, interval: 0.74, mag: 6, reserve: 48,
      spread: 0.16, bloom: 0.08, bloomMax: 0.2, recover: 0.5,
      reload: 2.35, noise: 580, pellets: 8, pierce: 0, auto: false,
      range: 330, recoil: 4.2, tracer: '#ffcf8a', color: '#b9895c',
      desc: '8 颗弹丸，贴脸一枪一个；对盾兵的正面无效，得绕后。'
    },
    dmr: {
      id: 'dmr', name: 'SR-25 精确步枪', short: 'SR-25', slot: 4,
      dmg: 62, interval: 0.84, mag: 8, reserve: 48,
      spread: 0.006, bloom: 0.03, bloomMax: 0.09, recover: 0.45,
      reload: 2.2, noise: 740, pellets: 1, pierce: 1, auto: false,
      range: 1100, recoil: 5, tracer: '#fff2c8', color: '#9fb4b9',
      desc: '远距离一枪重创，可穿透一名敌人；开火位置会暴露。'
    }
  };

  C.WEAPON_ORDER = ['pistol', 'smg', 'shotgun', 'dmr'];

  /* ---------------- 敌人 ---------------- */
  C.ENEMIES = {
    g: {
      id: 'g', name: '步枪兵', hp: 52, speed: 84, r: 13,
      view: 520, fov: 105, hear: 300, dmg: 7, range: 420,
      interval: 1.15, burst: 3, gap: 0.09, aim: 0.45, spread: 0.06,
      behavior: 'cover', color: '#b8543f', alertDelay: 0.35,
      desc: '会找掩体、点射，枪法一般，但数量多。'
    },
    r: {
      id: 'r', name: '突击兵', hp: 44, speed: 142, r: 13,
      view: 460, fov: 120, hear: 340, dmg: 7, range: 180,
      interval: 1.5, burst: 1, pellets: 5, gap: 0.1, aim: 0.32, spread: 0.13,
      behavior: 'charge', color: '#c46a32', alertDelay: 0.25,
      desc: '持霰弹枪贴脸冲锋，必须拉开距离或用翻滚躲开。'
    },
    m: {
      id: 'm', name: '狙击手', hp: 36, speed: 62, r: 12,
      view: 920, fov: 72, hear: 260, dmg: 26, range: 920,
      interval: 2.1, burst: 1, gap: 0.1, aim: 0.95, spread: 0.012,
      behavior: 'sniper', color: '#8d5a76', laser: 1,
      desc: '红色激光预警一秒，随后一枪 26 点；被近身就后撤。'
    },
    h: {
      id: 'h', name: '重装兵', hp: 130, speed: 56, r: 16,
      view: 500, fov: 110, hear: 320, dmg: 9, range: 390,
      interval: 1.35, burst: 6, gap: 0.07, aim: 0.5, spread: 0.075,
      behavior: 'heavy', color: '#5e6a72', shield: 0.62,
      desc: '正面防弹盾削减 62% 伤害，绕后、手雷或油桶才解得动。'
    },
    k: {
      id: 'k', name: '指挥官', hp: 96, speed: 78, r: 14,
      view: 620, fov: 120, hear: 320, dmg: 8, range: 400,
      interval: 1.0, burst: 3, gap: 0.08, aim: 0.35, spread: 0.05,
      behavior: 'commander', color: '#c9a23c', buff: 1.18,
      desc: '给周围敌人加成射速与精度，还会呼叫增援，优先击杀。'
    },
    b: {
      id: 'b', name: '铁颚', hp: 560, speed: 48, r: 22,
      view: 820, fov: 360, hear: 999, dmg: 10, range: 520,
      interval: 0.9, burst: 10, gap: 0.06, aim: 0.38, spread: 0.085,
      behavior: 'boss', color: '#7b3f33', shield: 0.7, boss: true,
      desc: '装甲指挥官：正面装甲、机枪扫射、召唤增援，半血后进入狂暴。'
    }
  };

  /* ---------------- 场景配色 ---------------- */
  C.THEMES = {
    warehouse: {
      floor: '#211e1a', floor2: '#26221d', wall: '#121110', wallTop: '#2f2a24',
      edge: '#3d372f', grid: 'rgba(200,170,120,.045)', fog: '#05060a',
      accent: '#c9a56b'
    },
    refinery: {
      floor: '#241d19', floor2: '#2a221c', wall: '#151009', wallTop: '#35281e',
      edge: '#4a3627', grid: 'rgba(220,150,90,.05)', fog: '#060508',
      accent: '#d09255'
    },
    office: {
      floor: '#1d1f22', floor2: '#222529', wall: '#101214', wallTop: '#2c3138',
      edge: '#3a424b', grid: 'rgba(150,180,210,.05)', fog: '#04060a',
      accent: '#8fb0c9'
    },
    roof: {
      floor: '#202022', floor2: '#252527', wall: '#141416', wallTop: '#303034',
      edge: '#44444a', grid: 'rgba(180,190,210,.05)', fog: '#06070c',
      accent: '#b8b3a4'
    },
    power: {
      floor: '#171a18', floor2: '#1c201d', wall: '#0b0d0b', wallTop: '#252b26',
      edge: '#33533f', grid: 'rgba(120,220,150,.04)', fog: '#030605',
      accent: '#6fbf8a'
    },
    depot: {
      floor: '#221d1a', floor2: '#282119', wall: '#130f0c', wallTop: '#332820',
      edge: '#4a3728', grid: 'rgba(210,160,110,.05)', fog: '#050507',
      accent: '#cf955d'
    },
    alley: {
      floor: '#1b1c1e', floor2: '#202123', wall: '#0e0f11', wallTop: '#282a2d',
      edge: '#3a3d41', grid: 'rgba(180,190,200,.04)', fog: '#040507',
      accent: '#9aa3ad'
    },
    boss: {
      floor: '#231a18', floor2: '#291f1c', wall: '#120c0b', wallTop: '#38241f',
      edge: '#4f2f26', grid: 'rgba(220,130,90,.06)', fog: '#060304',
      accent: '#d97a5b'
    }
  };

  /* ---------------- 关卡 ----------------
   * 坐标单位：格子（40px）。房间 x/y 为左上角，w/h 为格数。
   * 出生点、掩体、敌人、终端、补给均为格子坐标，运行时取格子中心。
   * enemy.t 对应 C.ENEMIES 的键。
   * ---------------------------------------- */
  C.MISSIONS = [
    {
      id: 'm1', no: 1, name: '仓库清点', code: 'OP.01',
      place: '城郊废弃仓库', clock: '23:40', theme: 'warehouse',
      brief: '线报说这批货里藏着军火清单。仓库里只有零散守卫，先摸进去，把人和货一起清掉。',
      intel: ['守卫 5 名，全是步枪兵', '箱体可作掩体，也会被子弹打穿', '消音手枪不会引动远处的人'],
      tips: ['贴着箱子走，先解决落单的', '敌人背后的近身 F 键可以无声处决'],
      objective: { type: 'eliminate', text: '清除全部守卫，然后从西南侧门撤离' },
      par: 150, reward: 55, difficulty: '教学',
      map: { w: 40, h: 24 },
      player: [34, 18],
      rooms: [
        { x: 3, y: 3, w: 14, h: 10 },
        { x: 23, y: 3, w: 14, h: 10 },
        { x: 3, y: 15, w: 34, h: 6 }
      ],
      corridors: [
        { x: 17, y: 7, w: 6, h: 3 },
        { x: 19, y: 10, w: 3, h: 5 }
      ],
      pillars: [[6, 5], [14, 11], [30, 5], [34, 10], [17, 17], [22, 17]],
      crates: [[10, 5], [6, 11], [28, 5], [32, 9], [8, 18], [27, 18], [16, 18], [12, 18]],
      barrels: [],
      enemies: [
        { t: 'g', x: 8, y: 7 }, { t: 'g', x: 13, y: 10 },
        { t: 'g', x: 28, y: 7 }, { t: 'g', x: 33, y: 10 },
        { t: 'g', x: 19, y: 18 }
      ],
      terminals: [],
      extract: { x: 4, y: 17, w: 3, h: 2 },
      pickups: [{ t: 'ammo', x: 31, y: 18 }, { t: 'med', x: 5, y: 15 }],
      wavePoints: [],
      waves: []
    },

    {
      id: 'm2', no: 2, name: '油库突袭', code: 'OP.02',
      place: '临港油料中转站', clock: '01:15', theme: 'refinery',
      brief: '中转站囤着反对派下一批燃料。油桶是最好的炸药，也是最危险的掩体。打爆它们，别站在旁边。',
      intel: ['守卫 9 名，含 2 名霰弹突击兵', '场区内有多个易爆油桶', '高处有 1 名狙击手'],
      tips: ['把敌人引到油桶旁再点爆', '狙击手开火前有红色激光，先找墙'],
      objective: { type: 'eliminate', text: '清除全部守卫，从东侧装卸口撤离' },
      par: 210, reward: 70, difficulty: '进阶',
      map: { w: 40, h: 24 },
      player: [5, 17],
      rooms: [
        { x: 3, y: 3, w: 10, h: 8 },
        { x: 15, y: 3, w: 22, h: 8 },
        { x: 3, y: 14, w: 34, h: 6 }
      ],
      corridors: [
        { x: 3, y: 11, w: 34, h: 3 }
      ],
      pillars: [[6, 6], [20, 8], [8, 12], [30, 12], [18, 16], [26, 17]],
      crates: [[5, 4], [35, 10], [12, 15], [26, 15], [33, 14], [15, 9]],
      barrels: [[18, 5], [22, 8], [24, 6], [9, 16], [20, 18], [30, 17], [35, 6]],
      enemies: [
        { t: 'g', x: 7, y: 5 }, { t: 'g', x: 10, y: 8 },
        { t: 'g', x: 20, y: 6 }, { t: 'g', x: 28, y: 5 },
        { t: 'g', x: 26, y: 9 }, { t: 'g', x: 34, y: 8 },
        { t: 'r', x: 13, y: 12 }, { t: 'r', x: 15, y: 17 },
        { t: 'm', x: 36, y: 4 }
      ],
      terminals: [],
      extract: { x: 33, y: 15, w: 3, h: 2 },
      pickups: [{ t: 'ammo', x: 4, y: 12 }, { t: 'ammo', x: 24, y: 16 }, { t: 'med', x: 9, y: 18 }],
      wavePoints: [],
      waves: []
    },

    {
      id: 'm3', no: 3, name: '数据节点', code: 'OP.03',
      place: '环城商务楼 B 座', clock: '02:30', theme: 'office',
      brief: '三个节点分散在楼里，每接通一个都会触发警报。你只有一个人，接线时背后必须干净。',
      intel: ['3 个数据终端，需按住 E 接入 3 秒', '每次接入会从通风口涌进 2 名增援', '终端附近有掩体和弹药'],
      tips: ['先清空房间再接线，别在开阔地读条', '接线被打断不会丢失进度，可以反复尝试'],
      objective: { type: 'hack', count: 3, text: '接入 3 个数据节点，然后撤回一层大厅' },
      par: 240, reward: 80, difficulty: '进阶',
      map: { w: 40, h: 24 },
      player: [20, 19],
      rooms: [
        { x: 3, y: 4, w: 10, h: 8 },
        { x: 26, y: 4, w: 11, h: 8 },
        { x: 15, y: 3, w: 10, h: 7 },
        { x: 3, y: 15, w: 34, h: 6 }
      ],
      corridors: [
        { x: 3, y: 12, w: 34, h: 3 },
        { x: 22, y: 9, w: 2, h: 3 }
      ],
      pillars: [[6, 6], [10, 10], [30, 6], [34, 10], [18, 5], [22, 7], [8, 14], [32, 14], [20, 17]],
      crates: [[16, 5], [23, 8], [5, 14], [33, 13], [12, 18], [27, 18], [16, 18]],
      barrels: [[9, 14], [29, 15]],
      enemies: [
        { t: 'g', x: 5, y: 6 }, { t: 'g', x: 9, y: 10 },
        { t: 'g', x: 28, y: 6 }, { t: 'g', x: 34, y: 9 },
        { t: 'g', x: 16, y: 13 }, { t: 'g', x: 30, y: 14 },
        { t: 'r', x: 22, y: 12 }, { t: 'r', x: 6, y: 14 }
      ],
      terminals: [[7, 8], [32, 8], [19, 6]],
      extract: { x: 4, y: 17, w: 3, h: 2 },
      pickups: [{ t: 'ammo', x: 20, y: 15 }, { t: 'ammo', x: 7, y: 17 }, { t: 'med', x: 35, y: 17 }],
      wavePoints: [[12, 13], [24, 13], [36, 15]],
      waves: [],
      hackSpawn: [
        { type: 'g', count: 2 }, { type: 'r', count: 2 }, { type: 'g', count: 2 }
      ]
    },

    {
      id: 'm4', no: 4, name: '天台防守', code: 'OP.04',
      place: '旧货运楼天台', clock: '04:05', theme: 'roof',
      brief: '撤离直升机还要 80 秒。守住天台中央的降落标记，别让任何人靠近。',
      intel: ['计时只在标记圈内推进', '敌人从四个楼梯口分批上来', '带好手雷，成群的突击兵会冲圈'],
      tips: ['站在圈内但别站死，围着掩体转', '打爆油桶能一次清掉一圈人'],
      objective: { type: 'defend', seconds: 80, zone: { x: 20, y: 12, r: 3.4 }, text: '在降落区坚守 80 秒，守住后登机撤离' },
      par: 100, reward: 90, difficulty: '硬仗',
      map: { w: 40, h: 24 },
      player: [20, 19],
      rooms: [
        { x: 3, y: 3, w: 34, h: 19 }
      ],
      corridors: [],
      pillars: [
        [10, 6], [13, 6], [10, 9], [13, 9],
        [27, 6], [30, 6], [27, 9], [30, 9],
        [16, 12], [24, 12], [16, 14], [24, 14]
      ],
      crates: [[18, 5], [20, 5], [18, 7], [20, 7], [7, 17], [9, 17], [31, 17], [33, 17], [20, 16]],
      barrels: [[22, 19], [17, 19], [6, 6], [34, 6]],
      enemies: [],
      terminals: [],
      extract: { x: 19, y: 21, w: 3, h: 1 },
      pickups: [{ t: 'ammo', x: 5, y: 19 }, { t: 'ammo', x: 35, y: 19 }, { t: 'med', x: 20, y: 20 }, { t: 'med', x: 4, y: 4 }],
      wavePoints: [[5, 4], [35, 4], [5, 20], [35, 20], [20, 4]],
      waves: [
        { at: 0, type: 'g', count: 3, point: 0 },
        { at: 14, type: 'g', count: 3, point: 1 },
        { at: 28, type: 'g', count: 2, point: 2, mix: { type: 'r', count: 1 } },
        { at: 42, type: 'g', count: 3, point: 3, mix: { type: 'm', count: 1 } },
        { at: 56, type: 'g', count: 2, point: 4, mix: { type: 'r', count: 2 } },
        { at: 68, type: 'g', count: 3, point: 0, mix: { type: 'h', count: 1 } }
      ]
    },

    {
      id: 'm5', no: 5, name: '断电行动', code: 'OP.05',
      place: '南区配电站', clock: '05:20', theme: 'power',
      brief: '配电站还亮着，整片街区都在他们的监控下。切断三个节点，让黑暗替我们开路。',
      intel: ['3 个电力节点，接入即断电', '2 名狙击手占据高处，长走廊是死亡区', '1 名重装兵守着底层通道'],
      tips: ['贴着墙根走，别站在长廊中间', '断电后敌人视野会缩短'],
      objective: { type: 'hack', count: 3, text: '切断 3 个电力节点，从东侧检修门撤离' },
      par: 260, reward: 100, difficulty: '硬仗',
      map: { w: 40, h: 24 },
      player: [6, 20],
      rooms: [
        { x: 3, y: 3, w: 8, h: 16 },
        { x: 14, y: 3, w: 10, h: 6 },
        { x: 28, y: 3, w: 9, h: 16 },
        { x: 3, y: 19, w: 34, h: 2 }
      ],
      corridors: [
        { x: 11, y: 4, w: 3, h: 3 },
        { x: 24, y: 4, w: 4, h: 3 },
        { x: 18, y: 9, w: 2, h: 10 }
      ],
      pillars: [[6, 8], [6, 14], [9, 11], [31, 7], [34, 13], [16, 6], [21, 6], [16, 18], [24, 18]],
      crates: [[5, 5], [9, 16], [33, 5], [30, 17], [20, 7], [12, 20], [26, 20]],
      barrels: [[8, 12], [35, 10], [17, 5]],
      enemies: [
        { t: 'g', x: 7, y: 15 }, { t: 'g', x: 30, y: 15 },
        { t: 'g', x: 16, y: 20 }, { t: 'g', x: 33, y: 6 },
        { t: 'm', x: 9, y: 4 }, { t: 'm', x: 36, y: 18 }, { t: 'm', x: 15, y: 7 },
        { t: 'h', x: 26, y: 20 }
      ],
      terminals: [[5, 10], [34, 10], [19, 5]],
      extract: { x: 30, y: 19, w: 3, h: 2 },
      pickups: [{ t: 'ammo', x: 4, y: 19 }, { t: 'ammo', x: 36, y: 19 }, { t: 'med', x: 19, y: 21 }],
      wavePoints: [[12, 5], [26, 5], [20, 21]],
      waves: [],
      hackSpawn: [
        { type: 'g', count: 2 }, { type: 'g', count: 2 }, { type: 'r', count: 2 }
      ],
      blackout: true
    },

    {
      id: 'm6', no: 6, name: '双库区', code: 'OP.06',
      place: '北岭军需库', clock: '06:40', theme: 'depot',
      brief: '两个库区隔着一条通道，重装兵和指挥官都在里面。硬啃正面会崩牙，拆开他们。',
      intel: ['守卫 14 名，含 2 名重装盾兵', '指挥官会给周围人加射速', '库区之间有上下两条通道'],
      tips: ['先杀指挥官，再处理盾兵', '手雷和油桶能无视正面盾牌'],
      objective: { type: 'eliminate', text: '清除两个库区的全部守卫，从南侧通道撤离' },
      par: 300, reward: 115, difficulty: '恶战',
      map: { w: 40, h: 24 },
      player: [34, 19],
      rooms: [
        { x: 3, y: 3, w: 15, h: 12 },
        { x: 22, y: 3, w: 15, h: 12 },
        { x: 3, y: 17, w: 34, h: 4 }
      ],
      corridors: [
        { x: 18, y: 5, w: 4, h: 3 },
        { x: 18, y: 11, w: 4, h: 3 },
        { x: 6, y: 15, w: 2, h: 2 },
        { x: 32, y: 15, w: 2, h: 2 }
      ],
      pillars: [[7, 6], [13, 6], [7, 10], [13, 10], [26, 6], [32, 6], [26, 10], [32, 10], [12, 19], [27, 19]],
      crates: [[9, 7], [12, 11], [28, 8], [34, 12], [16, 18], [23, 19], [4, 18]],
      barrels: [[15, 5], [25, 10], [10, 18], [29, 18], [21, 15]],
      enemies: [
        { t: 'g', x: 6, y: 5 }, { t: 'g', x: 11, y: 8 }, { t: 'g', x: 16, y: 12 },
        { t: 'g', x: 27, y: 6 }, { t: 'g', x: 31, y: 9 }, { t: 'g', x: 35, y: 12 },
        { t: 'g', x: 8, y: 13 }, { t: 'g', x: 20, y: 12 },
        { t: 'r', x: 9, y: 13 }, { t: 'r', x: 29, y: 13 },
        { t: 'h', x: 5, y: 10 }, { t: 'h', x: 34, y: 6 },
        { t: 'm', x: 20, y: 6 }, { t: 'k', x: 24, y: 4 }
      ],
      terminals: [],
      extract: { x: 4, y: 18, w: 3, h: 2 },
      pickups: [{ t: 'ammo', x: 20, y: 18 }, { t: 'ammo', x: 5, y: 17 }, { t: 'med', x: 33, y: 17 }, { t: 'med', x: 21, y: 3 }],
      wavePoints: [],
      waves: []
    },

    {
      id: 'm7', no: 7, name: '撤离通道', code: 'OP.07',
      place: '旧城后巷', clock: '07:55', theme: 'alley',
      brief: '接应车在东口，但要等三波追兵过完才敢进来。巷子窄，拐角多，别被堵在死胡同。',
      intel: ['坚守 90 秒，三波追兵从北侧和东侧压来', '巷内油桶密集，注意别自爆', '东口是撤离点，时间到了才开放'],
      tips: ['利用拐角卡视线，打完就换位', '没子弹时优先捡敌人掉落的弹匣'],
      objective: { type: 'survive', seconds: 90, text: '撑过 90 秒追兵，从东口登车撤离' },
      par: 110, reward: 125, difficulty: '恶战',
      map: { w: 40, h: 24 },
      player: [5, 4],
      rooms: [
        { x: 3, y: 3, w: 7, h: 5 },
        { x: 12, y: 3, w: 8, h: 5 },
        { x: 22, y: 3, w: 7, h: 5 },
        { x: 31, y: 3, w: 6, h: 5 }
      ],
      corridors: [
        { x: 10, y: 4, w: 2, h: 2 },
        { x: 20, y: 4, w: 2, h: 2 },
        { x: 29, y: 4, w: 2, h: 2 },
        { x: 4, y: 8, w: 3, h: 8 },
        { x: 15, y: 8, w: 3, h: 8 },
        { x: 26, y: 8, w: 3, h: 8 },
        { x: 35, y: 8, w: 2, h: 8 },
        { x: 3, y: 16, w: 34, h: 2 }
      ],
      pillars: [[5, 10], [16, 12], [27, 10], [8, 16], [18, 17], [31, 17]],
      crates: [[7, 14], [22, 14], [34, 14], [12, 16], [24, 17]],
      barrels: [[9, 9], [20, 9], [31, 9], [12, 17], [24, 16], [36, 12]],
      enemies: [
        { t: 'g', x: 16, y: 5 }, { t: 'g', x: 26, y: 5 },
        { t: 'r', x: 5, y: 10 }, { t: 'g', x: 16, y: 12 },
        { t: 'g', x: 28, y: 14 }, { t: 'm', x: 35, y: 10 }
      ],
      terminals: [],
      extract: { x: 33, y: 16, w: 4, h: 2 },
      pickups: [{ t: 'ammo', x: 12, y: 17 }, { t: 'ammo', x: 23, y: 17 }, { t: 'med', x: 5, y: 6 }, { t: 'med', x: 33, y: 5 }],
      wavePoints: [[16, 4], [28, 4], [36, 16]],
      waves: [
        { at: 8, type: 'g', count: 3, point: 0, mix: { type: 'r', count: 1 } },
        { at: 20, type: 'g', count: 3, point: 1, mix: { type: 'r', count: 1 } },
        { at: 34, type: 'g', count: 3, point: 2, mix: { type: 'r', count: 1 } },
        { at: 48, type: 'g', count: 3, point: 0, mix: { type: 'm', count: 1 } },
        { at: 62, type: 'g', count: 3, point: 1, mix: { type: 'h', count: 1 } },
        { at: 76, type: 'g', count: 2, point: 2, mix: { type: 'r', count: 2 } }
      ]
    },

    {
      id: 'm8', no: 8, name: '铁颚', code: 'OP.08',
      place: '地下装卸场', clock: '09:10', theme: 'boss',
      brief: '整条线的负责人就在下面。他穿着正面装甲，机枪能压住整片场地。清掉他的护卫，然后从侧面拆了他。',
      intel: ['Boss「铁颚」血量 560，正面装甲减伤 70%', '每 22 秒召唤 2 名护卫，最多同时 6 名', '半血后进入狂暴，会连续扫射'],
      tips: ['优先清护卫，别被两面夹住', '手雷和绕后是破盾的唯一办法', '柱子能挡机枪，但挡不住他的冲锋'],
      objective: { type: 'boss', text: '击杀「铁颚」，从南侧升降台撤离' },
      par: 300, reward: 160, difficulty: '终局',
      map: { w: 40, h: 24 },
      player: [20, 19],
      rooms: [
        { x: 3, y: 3, w: 34, h: 18 }
      ],
      corridors: [],
      pillars: [
        [9, 7], [14, 7], [25, 7], [30, 7],
        [9, 12], [14, 12], [25, 12], [30, 12],
        [7, 10], [32, 10]
      ],
      crates: [[17, 5], [21, 5], [17, 15], [21, 15], [5, 17], [34, 16], [12, 17], [27, 17]],
      barrels: [[12, 19], [28, 19], [22, 8], [17, 11], [30, 5], [9, 15]],
      enemies: [
        { t: 'g', x: 8, y: 5 }, { t: 'r', x: 32, y: 5 },
        { t: 'm', x: 35, y: 9 }, { t: 'g', x: 28, y: 15 },
        { t: 'b', x: 20, y: 9 }
      ],
      terminals: [],
      extract: { x: 19, y: 20, w: 3, h: 1 },
      pickups: [{ t: 'ammo', x: 5, y: 5 }, { t: 'ammo', x: 35, y: 19 }, { t: 'med', x: 4, y: 19 }, { t: 'med', x: 36, y: 4 }],
      wavePoints: [[5, 4], [35, 4], [5, 19], [35, 19]],
      waves: [],
      bossAdds: { interval: 22, type: 'g', count: 2, max: 6 }
    }
  ];

  /* ---------------- 商店 / 整备 ---------------- */
  C.SHOP = [
    { id: 'w_shotgun', kind: 'weapon', weapon: 'shotgun', name: '解锁 M870 霰弹枪', cost: 95, desc: '贴脸清场，对盾兵正面无效。' },
    { id: 'w_dmr', kind: 'weapon', weapon: 'dmr', name: '解锁 SR-25 精确步枪', cost: 140, desc: '跨房间点名，枪声很响。' },
    { id: 'up_dmg', kind: 'upgrade', key: 'damage', name: '弹道强化', cost: 70, step: 35, max: 4, desc: '每级 +9% 伤害。' },
    { id: 'up_reload', kind: 'upgrade', key: 'reload', name: '快速换弹', cost: 55, step: 30, max: 3, desc: '每级 -10% 换弹时间。' },
    { id: 'up_speed', kind: 'upgrade', key: 'speed', name: '战术机动', cost: 55, step: 30, max: 3, desc: '每级 +6% 移动速度。' },
    { id: 'up_hp', kind: 'upgrade', key: 'hp', name: '体能强化', cost: 65, step: 35, max: 4, desc: '每级 +12 最大生命。' },
    { id: 'up_armor', kind: 'upgrade', key: 'armor', name: '加装护甲', cost: 60, step: 40, max: 3, desc: '每级 +10 护甲，护甲吸收六成伤害。' },
    { id: 's_grenade', kind: 'supply', item: 'grenade', amount: 2, max: 4, name: '补充手雷 ×2', cost: 45, desc: '破盾、清群、引爆油桶。' },
    { id: 's_medkit', kind: 'supply', item: 'medkit', amount: 1, max: 3, name: '补充医疗包 ×1', cost: 40, desc: '按 V 使用，回复 55 生命。' }
  ];

  C.DIFFICULTY = {
    standard: { id: 'standard', name: '标准', enemyDmg: 0.85, enemyHp: 1 },
    hard: { id: 'hard', name: '硬核', enemyDmg: 1.15, enemyHp: 1.12 }
  };

  GG.C = C;
})(typeof window !== 'undefined' ? window : globalThis);
