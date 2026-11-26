/* ============================================================
 * config.js —— 碧海扬帆：可调参数与关卡表
 *
 * 所有数值集中在这里，逻辑与渲染不写魔法数字。
 * 方位角统一用「度」表示：0 = 北，90 = 东，180 = 南，270 = 西。
 * 世界坐标 x 向东、y 向南（与俯视海图一致）。
 * ============================================================ */
(function (global) {
    "use strict";

    var SAIL = global.SAIL = global.SAIL || {};

    /* ---------------- 物理与手感参数 ---------------- */

    SAIL.TUNE = {
        /* 画面 */
        viewW: 1280,
        viewH: 720,
        maxDpr: 2,

        /* 单位换算：1 节航速 = 多少个世界像素/秒 */
        pxPerKnot: 10,

        /* 帆 */
        sailMax: 85,          // 帆杆相对船中线的最大张开角（度）
        sailKeyRate: 105,     // 键盘调帆速度（度/秒）
        sailFollowRate: 210,  // 帆实际角追随目标角的速度（度/秒），换舷时自然变慢
        luffDeg: 12,          // 攻角小于这个值算「帆没吃住风」，会抖动

        /* 人位 */
        crewRate: 1.35,       // 每秒移动 1.35 个单位，全程 2 个单位（约 1.5 秒）

        /* 舵 */
        turnRate: 0.60,       // 自动舵最大转向角速度（弧度/秒，约 34°/秒）

        /* 风与帆的力学 */
        noGo: 42,             // 顶风死区边界（度）：|AWA| < 42 时基本推不动
        tackOffset: 48,       // 抢风航向相对风来向的偏角（度）
        hullDrag: 24,         // 船体阻力：R = speed² / hullDrag
        baseDrag: 0.35,       // 基础摩擦
        forceK: 0.9,          // 总推力系数
        liftK: 1.8,           // 升力项系数（攻角 50° 上下最强）
        dragK: 1.05,          // 阻力项系数（顺风兜风）
        heelK: 0.24,          // 横倾系数
        heelWarn: 30,         // 横倾开始掉效率的角度
        heelFlip: 46,         // 超过这个角度就压不住船了
        leewayK: 0.10,        // 侧漂系数
        reefHit: 0.32,        // 撞礁后保留的速度比例

        /* 关卡节奏 */
        gustWarnSeconds: 2.2, // 阵风提前多久预警
        finishR: 10,          // 终点圈额外容差
        rivalRate: 0.92       // 对手的物理系数（低于 1 给玩家留机会）
    };

    /* ---------------- 关卡表 ----------------
     * 世界统一 2100 × 1250：航程 1500~1700 像素，
     * 横风约 8 节（80 px/s）时一关跑 25~35 秒，
     * 足够遇到两三次阵风，也不至于拖沓。
     *
     * wind: { from, speed, shift, shiftPeriod, gust: {period, dur, mult} }
     * reefs:  [{x, y, r}]      礁石，撞了掉七成速度
     * islands:[{x, y, r}]      岛，同时生成下风向的风影区
     * par = 3 星时间，par2 = 2 星时间
     * ------------------------------------------------------------ */

    SAIL.LEVELS = [
        {
            id: 1,
            name: "启航课",
            sub: "顺风直航",
            world: { w: 2100, h: 1250 },
            start: { x: 320, y: 660, heading: 90 },
            goal: { x: 1900, y: 630, r: 60 },
            wind: { from: 270, speed: 14 },
            reefs: [],
            islands: [{ x: 700, y: 200, r: 130 }, { x: 1500, y: 1090, r: 150 }],
            par: 50, par2: 66,
            hint: "顺风时帆要横过来放（接近 85°）。看右上角的帆效环，转成金色就是吃满了风。"
        },
        {
            id: 2,
            name: "横风穿行",
            sub: "侧风最快",
            world: { w: 2100, h: 1250 },
            start: { x: 320, y: 1050, heading: 35 },
            goal: { x: 1880, y: 360, r: 58 },
            wind: { from: 155, speed: 14 },
            reefs: [{ x: 1050, y: 760, r: 85 }, { x: 1500, y: 850, r: 65 }],
            islands: [{ x: 620, y: 300, r: 115 }],
            par: 26, par2: 36,
            hint: "横风时帆收到 50° 上下最有劲 —— 帆船在横风里跑得比顺风还快。"
        },
        {
            id: 3,
            name: "迎风抢风",
            sub: "第一次 tack",
            world: { w: 2100, h: 1250 },
            start: { x: 950, y: 1120, heading: 350 },
            goal: { x: 1220, y: 260, r: 52 },
            wind: { from: 10, speed: 13 },
            reefs: [{ x: 720, y: 780, r: 75 }, { x: 1520, y: 620, r: 80 }],
            islands: [{ x: 1750, y: 300, r: 160 }, { x: 400, y: 400, r: 140 }],
            par: 36, par2: 50,
            hint: "目标就在正顶风里，直着走会停住。按 T 抢风，沿左右 48° 的斜线走，快撞到目标再切回来。"
        },
        {
            id: 4,
            name: "风摆无常",
            sub: "跟着风转",
            world: { w: 2100, h: 1250 },
            start: { x: 320, y: 640, heading: 90 },
            goal: { x: 1900, y: 700, r: 58 },
            wind: { from: 20, speed: 12, shift: 34, shiftPeriod: 9 },
            reefs: [{ x: 1150, y: 420, r: 75 }],
            islands: [{ x: 760, y: 1080, r: 130 }, { x: 1850, y: 240, r: 110 }],
            par: 32, par2: 45,
            hint: "风在左右摆。盯着风玫瑰：指针往哪边偏，帆就往哪边多放一点，帆效环会立刻告诉你。"
        },
        {
            id: 5,
            name: "礁石航道",
            sub: "别蹭礁",
            world: { w: 2100, h: 1250 },
            start: { x: 320, y: 1150, heading: 40 },
            goal: { x: 1850, y: 280, r: 58 },
            wind: { from: 300, speed: 13 },
            reefs: [
                { x: 900, y: 900, r: 70 },
                { x: 1150, y: 750, r: 65 },
                { x: 1380, y: 600, r: 72 },
                { x: 820, y: 620, r: 58 },
                { x: 1600, y: 450, r: 62 }
            ],
            islands: [{ x: 200, y: 400, r: 120 }, { x: 2050, y: 1150, r: 150 }],
            par: 34, par2: 46,
            hint: "蹭到礁石会丢掉大半个船速。宁可斜着绕远一点，也别从礁石边上擦过去。"
        },
        {
            id: 6,
            name: "背风阴影",
            sub: "绕岛取胜",
            world: { w: 2100, h: 1250 },
            start: { x: 300, y: 300, heading: 100 },
            goal: { x: 1500, y: 900, r: 58 },
            wind: { from: 0, speed: 14 },
            reefs: [{ x: 1450, y: 400, r: 60 }],
            islands: [{ x: 1000, y: 600, r: 210 }],
            par: 28, par2: 38,
            hint: "大岛的背风侧被挡住，风几乎没了。绕到岛北边顺着风走，看着远，其实快得多。"
        },
        {
            id: 7,
            name: "阵风考验",
            sub: "压住船",
            world: { w: 2100, h: 1250 },
            start: { x: 320, y: 660, heading: 90 },
            goal: { x: 1950, y: 660, r: 58 },
            wind: { from: 355, speed: 12, gust: { period: 6.5, dur: 3, mult: 1.75 } },
            reefs: [{ x: 1150, y: 940, r: 90 }, { x: 1550, y: 380, r: 80 }],
            islands: [{ x: 620, y: 200, r: 115 }],
            par: 24, par2: 34,
            hint: "阵风一来帆力暴涨。按 S 往船尾坐压住船，同时把帆偏离最佳角卸掉一点力，别让横倾条冲到红区。"
        },
        {
            id: 8,
            name: "海峡决赛",
            sub: "对手与风",
            world: { w: 2100, h: 1250 },
            start: { x: 320, y: 660, heading: 90 },
            goal: { x: 1980, y: 660, r: 62 },
            wind: { from: 350, speed: 14, shift: 20, shiftPeriod: 11, gust: { period: 6, dur: 2.6, mult: 1.6 } },
            reefs: [{ x: 980, y: 900, r: 70 }, { x: 1300, y: 380, r: 65 }, { x: 1650, y: 930, r: 60 }],
            islands: [{ x: 1150, y: 1200, r: 120 }],
            par: 24, par2: 34,
            rival: true,
            hint: "决赛：对手会自己抢风配平。它不敢压得太狠，你敢在阵风里压住船、调准帆，就能赢它。"
        }
    ];

    /* ---------------- 关卡自检 ----------------
     * 只做静态检查，保证数据不会写成「目标在礁石里」这种死关。
     * ------------------------------------------------------------ */

    SAIL.validateLevels = function () {
        var problems = [];
        var T = SAIL.TUNE;
        var dist = function (a, b) {
            return Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y));
        };

        SAIL.LEVELS.forEach(function (lv, i) {
            var tag = "第 " + (i + 1) + " 关「" + lv.name + "」";

            if (!lv.world || lv.world.w < T.viewW || lv.world.h < T.viewH) {
                problems.push(tag + "：世界尺寸小于视野");
            }

            ["start", "goal"].forEach(function (k) {
                var p = lv[k];
                if (!p || typeof p.x !== "number" || typeof p.y !== "number") {
                    problems.push(tag + "：缺少 " + k);
                } else if (p.x < 0 || p.y < 0 || p.x > lv.world.w || p.y > lv.world.h) {
                    problems.push(tag + "：" + k + " 落在世界之外");
                }
            });

            (lv.reefs || []).forEach(function (r, j) {
                if (dist(r, lv.start) < r.r + 40) problems.push(tag + "：起点贴着第 " + (j + 1) + " 块礁石");
                if (dist(r, lv.goal) < r.r + lv.goal.r + 30) problems.push(tag + "：目标圈压在第 " + (j + 1) + " 块礁石上");
            });

            (lv.islands || []).forEach(function (s, j) {
                if (dist(s, lv.goal) < s.r + lv.goal.r + 20) problems.push(tag + "：目标圈压在第 " + (j + 1) + " 座岛上");
                if (dist(s, lv.start) < s.r + 30) problems.push(tag + "：起点压在第 " + (j + 1) + " 座岛上");
            });

            if (!(lv.par > 0) || !(lv.par2 > lv.par)) problems.push(tag + "：星级时间不合法");
        });

        return problems;
    };

})(typeof window !== "undefined" ? window : globalThis);
