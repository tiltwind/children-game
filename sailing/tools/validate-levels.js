/* ============================================================
 * tools/validate-levels.js —— 碧海扬帆关卡校验
 *
 * 跑法：node sailing/tools/validate-levels.js
 *
 * 做两件事：
 *   1. 静态检查：终点在界内、起点和终点不压礁石、星级时间合法
 *   2. 用「理想自动驾驶」按同一套物理模拟每关，看能不能到、要多久
 *      —— 用来校准三星 / 二星时间，保证写进 config 的目标不是死数
 * ============================================================ */
"use strict";

var fs = require("fs");
var path = require("path");

/* ---- 把 config.js 灌进全局 ---- */
var code = fs.readFileSync(path.join(__dirname, "..", "config.js"), "utf8");
var sandbox = { globalThis: null };
new Function("global", code)(globalThis);

var SAIL = globalThis.SAIL;
var T = SAIL.TUNE;
var LEVELS = SAIL.LEVELS;

function rad(d) { return d * Math.PI / 180; }
function deg(r) { return r * 180 / Math.PI; }

function normDeg(d) {
    d = d % 360;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d;
}
function normRad(r) {
    r = r % (Math.PI * 2);
    if (r > Math.PI) r -= Math.PI * 2;
    if (r < -Math.PI) r += Math.PI * 2;
    return r;
}
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function dist(ax, ay, bx, by) { return Math.sqrt((ax - bx) * (ax - bx) + (ay - by) * (ay - by)); }
function bearingTo(fx, fy, tx, ty) { return deg(Math.atan2(tx - fx, -(ty - fy))); }
function hvec(h) { return { x: Math.sin(h), y: -Math.cos(h) }; }
function rvec(h) { return { x: Math.cos(h), y: Math.sin(h) }; }

/* ---- 与 game.js 完全一致的帆况模型 ---- */
function sailState(heading, speed, boomDeg, windX, windY) {
    var h = hvec(heading), r = rvec(heading);
    var vx = h.x * speed, vy = h.y * speed;
    var ax = windX - vx, ay = windY - vy;
    var appSpeed = Math.sqrt(ax * ax + ay * ay);
    var awx = ax * h.x + ay * h.y;
    var awy = ax * r.x + ay * r.y;
    var downDeg = deg(Math.atan2(awy, awx));
    var awaDeg = normDeg(downDeg + 180);
    var delta = normDeg(downDeg - boomDeg);
    var alpha = Math.abs(delta);
    var reverse = false;
    /* 只有攻角超过 90°（帆兜到背面）才算背风；顺风 / 顶风时横向分量接近 0，
     * 不能再拿 boomDeg * awy 的符号判反向，否则顺风直航会被误判成背风 */
    if (alpha > 90) { alpha = 180 - alpha; reverse = true; }

    var arad = rad(alpha);
    /* 顺风（视风从正后方来）没有可用的升力，只能兜风 */
    var runK = Math.max(0, Math.min(1, (Math.abs(awaDeg) - 140) / 25));
    var drive = T.liftK * (Math.sin(2 * arad) / 2) * (1 - runK) + T.dragK * Math.sin(arad);
    if (reverse) drive *= 0.12;
    if (alpha < T.luffDeg) drive *= Math.pow(Math.max(0.02, alpha / T.luffDeg), 1.6);

    var awaAbs = Math.abs(awaDeg);
    var noGo = awaAbs < T.noGo;
    if (noGo) { var ng = awaAbs / T.noGo; drive *= ng * ng * 0.9; }

    return {
        drive: drive,
        noGo: noGo,
        lateral: Math.abs(Math.sin(rad(awaDeg))),
        toSide: awy > 0.4 ? 1 : (awy < -0.4 ? -1 : 0),
        appSpeed: appSpeed,
        awaDeg: awaDeg
    };
}

function bestBoom(heading, speed, wx, wy) {
    var best = 0, bestDrive = -1;
    for (var b = -T.sailMax; b <= T.sailMax; b += 2) {
        var d = sailState(heading, speed, b, wx, wy).drive;
        if (d > bestDrive) { bestDrive = d; best = b; }
    }
    return best;
}

/* ---- 阵风 / 风摆 ---- */
function windAt(t, cfg) {
    var from = cfg.from;
    if (cfg.shift) from += Math.sin(t / cfg.shiftPeriod * Math.PI * 2) * cfg.shift;
    var factor = 1;
    if (cfg.gust) {
        var phase = t % cfg.gust.period;
        var gs = cfg.gust.period - cfg.gust.dur;
        if (phase >= gs) {
            factor = 1 + (cfg.gust.mult - 1) * Math.sin((phase - gs) / cfg.gust.dur * Math.PI);
        }
    }
    return { from: from, speed: cfg.speed * factor };
}

/* ---- 绕行航点：直线航线上挡住岛的，先绕到侧面再奔向终点 ---- */
function planWaypoints(lv) {
    var pts = [];
    var cur = { x: lv.start.x, y: lv.start.y };
    var obstacles = [];
    (lv.islands || []).forEach(function (o) { obstacles.push({ x: o.x, y: o.y, r: o.r * 1.12 }); });
    (lv.reefs || []).forEach(function (o) { obstacles.push({ x: o.x, y: o.y, r: o.r }); });

    var guard = 0;
    while (guard++ < 6) {
        var dx = lv.goal.x - cur.x, dy = lv.goal.y - cur.y;
        var len = Math.sqrt(dx * dx + dy * dy);
        if (len < 1) break;
        var ux = dx / len, uy = dy / len;
        var hit = null, hitT = 1e9, hitSide = 0;

        obstacles.forEach(function (ob) {
            var vx = ob.x - cur.x, vy = ob.y - cur.y;
            var t = clamp(vx * ux + vy * uy, 0, len);
            var px = cur.x + ux * t, py = cur.y + uy * t;
            var off = Math.sqrt((ob.x - px) * (ob.x - px) + (ob.y - py) * (ob.y - py));
            if (off < ob.r + 55 && t < hitT) {
                hitT = t;
                var side = ((ob.x - px) * (-uy) + (ob.y - py) * ux) >= 0 ? 1 : -1;
                hit = { ob: ob, px: px, py: py, side: side, ux: ux, uy: uy };
            }
        });

        if (!hit) break;

        /* 绕到障碍的另一侧：法线方向取 -(hitSide) */
        var nx = -hit.uy, ny = hit.ux;
        var sx = -hit.side;
        var wx = hit.ob.x + nx * sx * (hit.ob.r + 78);
        var wy = hit.ob.y + ny * sx * (hit.ob.r + 78);
        pts.push({ x: wx, y: wy });
        cur = { x: wx, y: wy };
    }
    return pts;
}

/* ---- 模拟：理想船手，自动抢风、自动配平 ---- */
function simulate(lv) {
    var ship = {
        x: lv.start.x, y: lv.start.y,
        heading: rad(lv.start.heading),
        speed: 2, boom: 30
    };
    var t = 0, dt = 0.05, tack = 0, lastTack = -99;
    var minDist = 1e9;
    var bumps = 0;
    var waypoints = planWaypoints(lv);
    var wpIndex = 0;

    while (t < 240) {
        var wa = windAt(t, lv.wind);
        var to = rad(wa.from + 180);
        var wx = Math.sin(to) * wa.speed, wy = -Math.cos(to) * wa.speed;

        /* 到航点就切下一个 */
        while (wpIndex < waypoints.length &&
            dist(ship.x, ship.y, waypoints[wpIndex].x, waypoints[wpIndex].y) < 70) {
            wpIndex++;
        }
        var aim = wpIndex < waypoints.length ? waypoints[wpIndex] : lv.goal;
        var goalB = bearingTo(ship.x, ship.y, lv.goal.x, lv.goal.y);
        var aimB = bearingTo(ship.x, ship.y, aim.x, aim.y);
        var away = Math.abs(normDeg(goalB - wa.from));
        var d = dist(ship.x, ship.y, lv.goal.x, lv.goal.y);
        minDist = Math.min(minDist, d);

        /* 直航落在死区就抢风；穿过风轴就换舷；目标脱困就回直航 */
        if (away < T.noGo + 7 && d > 180) {
            var side = normDeg(goalB - wa.from) >= 0 ? 1 : -1;
            if (tack === 0) {
                if (t - lastTack > 4) { tack = side; lastTack = t; }
            } else if (side !== tack && t - lastTack > 5) {
                tack = -tack;
                lastTack = t;
            }
        } else if (tack !== 0 && (away > T.noGo + 24 || d < 180)) {
            tack = 0;
            lastTack = t;
        }

        var tgt = tack === 0 ? rad(aimB) : rad(wa.from + tack * T.tackOffset);

        /* 兜底避障：真的贴上去了才偏一点，避免原地磨 */
        var avoid = 0;
        var obstacles = [];
        (lv.reefs || []).forEach(function (o) { obstacles.push(o); });
        (lv.islands || []).forEach(function (o) { obstacles.push({ x: o.x, y: o.y, r: o.r * 1.1 }); });
        obstacles.forEach(function (ob) {
            var dd = dist(ship.x, ship.y, ob.x, ob.y);
            if (dd > ob.r + 55 || dd < ob.r + 8) return;
            var br = bearingTo(ship.x, ship.y, ob.x, ob.y);
            var rel = normDeg(br - deg(ship.heading));
            if (Math.abs(rel) < 40) avoid = rel >= 0 ? -22 : 22;
        });
        if (avoid) tgt = rad(deg(tgt) + avoid);

        var maxTurn = T.turnRate * dt;
        var diff = normRad(tgt - ship.heading);
        ship.heading += Math.abs(diff) <= maxTurn ? diff : (diff > 0 ? maxTurn : -maxTurn);

        var best = bestBoom(ship.heading, ship.speed, wx, wy);
        var rate = T.sailFollowRate * dt;
        var bd = best - ship.boom;
        ship.boom += Math.abs(bd) <= rate ? bd : (bd > 0 ? rate : -rate);

        var st = sailState(ship.heading, ship.speed, ship.boom, wx, wy);
        var thrust = st.drive * T.forceK * Math.pow(st.appSpeed / 10, 1.6);
        var drag = ship.speed * ship.speed / T.hullDrag + T.baseDrag;
        ship.speed = Math.max(0, ship.speed + (thrust - drag) * dt);

        var hv = hvec(ship.heading), rv = rvec(ship.heading);
        var leeway = st.lateral * st.drive * T.leewayK * ship.speed;
        ship.x += (hv.x * ship.speed + rv.x * st.toSide * leeway) * dt * T.pxPerKnot;
        ship.y += (hv.y * ship.speed + rv.y * st.toSide * leeway) * dt * T.pxPerKnot;

        /* 粗略避障：擦到礁石按真实规则减速（模拟里不绕，只记录） */
        (lv.reefs || []).forEach(function (rf) {
            var dd = dist(ship.x, ship.y, rf.x, rf.y);
            if (dd < rf.r + 14) {
                var nx = (ship.x - rf.x) / (dd || 1), ny = (ship.y - rf.y) / (dd || 1);
                ship.x = rf.x + nx * (rf.r + 14);
                ship.y = rf.y + ny * (rf.r + 14);
                if (ship.bumpCD === undefined || t - ship.bumpCD > 0.7) {
                    ship.speed *= T.reefHit;
                    bumps++;
                    ship.bumpCD = t;
                }
            }
        });
        (lv.islands || []).forEach(function (s) {
            var dd = dist(ship.x, ship.y, s.x, s.y);
            if (dd < s.r + 18) {
                var nx2 = (ship.x - s.x) / (dd || 1), ny2 = (ship.y - s.y) / (dd || 1);
                ship.x = s.x + nx2 * (s.r + 18);
                ship.y = s.y + ny2 * (s.r + 18);
                ship.speed *= 0.55;
            }
        });

        if (dist(ship.x, ship.y, lv.goal.x, lv.goal.y) < lv.goal.r + T.finishR) {
            return { ok: true, time: t, bumps: bumps, minDist: minDist };
        }
        t += dt;
    }
    return { ok: false, time: t, bumps: bumps, minDist: minDist };
}

/* ---- 跑 ---- */

var problems = SAIL.validateLevels();
if (problems.length) {
    console.log("静态检查发现 " + problems.length + " 个问题：");
    problems.forEach(function (p) { console.log("  ✗ " + p); });
} else {
    console.log("静态检查：8 关数据全部通过\n");
}

console.log("关卡模拟（理想船手，含抢风与自动配平）：");
console.log("  关卡                 模拟用时   三星    二星   余量     撞礁");
console.log("  --------------------------------------------------------------");

var allOk = true;
LEVELS.forEach(function (lv) {
    var r = simulate(lv);
    var tag = (lv.id < 10 ? "0" + lv.id : lv.id) + " " + lv.name;
    var padLen = 18 - tag.length;
    var pad = padLen > 0 ? new Array(padLen + 1).join(" ") : "";
    if (!r.ok) {
        allOk = false;
        console.log("  " + tag + pad + "  超时未达（最近 " + Math.round(r.minDist) + "）");
        return;
    }
    var slack = lv.par > 0 ? ((lv.par - r.time) / r.time * 100) : 0;
    var flag = slack < 8 || r.time > lv.par2 ? "  ← 时间偏紧" : "";
    console.log("  " + tag + pad + "  " +
        r.time.toFixed(1) + "s   " +
        lv.par + "s   " + lv.par2 + "s   " +
        (slack > 0 ? "+" : "") + slack.toFixed(0) + "%   " +
        r.bumps + " 次" + flag);
});

console.log("");
if (!allOk) {
    console.log("有关卡模拟跑不到终点，检查航线或风向。");
    process.exitCode = 1;
} else if (problems.length) {
    process.exitCode = 1;
} else {
    console.log("全部关卡可通，时间留白见上表。");
}
