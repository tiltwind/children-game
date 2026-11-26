/* ============================================================
 * game.js —— 碧海扬帆 · 主逻辑
 *
 * 结构：
 *   1. 数学 / 存档
 *   2. 风与帆的物理（纯函数，玩家与 AI 共用）
 *   3. 关卡装载与主循环
 *   4. 渲染（俯视海图）
 *   5. HUD / 菜单 / 结算
 *   6. 输入、门禁、限次、强制休息
 *
 * 坐标系：世界 x 向东、y 向南；方位角 0 = 北、90 = 东。
 * 船坐标：本地 +x = 船首，本地 +y = 右舷。
 * ============================================================ */
(function (global) {
    "use strict";

    var SAIL = global.SAIL;
    var T = SAIL.TUNE;
    var LEVELS = SAIL.LEVELS;
    var Audio = SAIL.Audio;

    var W = T.viewW;
    var H = T.viewH;

    var SAVE_KEY = "shutu.sailing.v1";
    var MUTE_KEY = "shutu.sailing.mute.v1";
    var MUSIC_KEY = "shutu.sailing.music.v1";

    var MAX_DRIVE = T.liftK * 0.5 + T.dragK * 1.0; // 通用驱动上限，只在最佳帆角还没算出来时兜底

    var canvas, ctx, roseCanvas, roseCtx;
    var DPR = 1;

    /* ---------------- 数学 ---------------- */

    function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
    function lerp(a, b, t) { return a + (b - a) * t; }
    function deg2rad(d) { return d * Math.PI / 180; }
    function rad2deg(r) { return r * 180 / Math.PI; }

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

    function dist(ax, ay, bx, by) {
        var dx = ax - bx, dy = ay - by;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /* 世界方位角（0 = 北，顺时针）*/
    function bearingTo(fromX, fromY, toX, toY) {
        return rad2deg(Math.atan2(toX - fromX, -(toY - fromY)));
    }

    /* 航向单位向量与右舷单位向量 */
    function headingVec(h) { return { x: Math.sin(h), y: -Math.cos(h) }; }
    function rightVec(h) { return { x: Math.cos(h), y: Math.sin(h) }; }

    /* 按最大角速度把当前朝向转向目标 */
    function turnToward(cur, target, maxDelta) {
        var diff = normRad(target - cur);
        if (Math.abs(diff) <= maxDelta) return cur + diff;
        return cur + (diff > 0 ? maxDelta : -maxDelta);
    }

    /* ---------------- 存档 ---------------- */

    var save = { v: 1, stars: {}, best: {}, assist: 1 };

    function loadSave() {
        try {
            var raw = localStorage.getItem(SAVE_KEY);
            if (raw) {
                var parsed = JSON.parse(raw);
                if (parsed && typeof parsed === "object") {
                    save.stars = parsed.stars || {};
                    save.best = parsed.best || {};
                    save.assist = parsed.assist === 0 ? 0 : 1;
                }
            }
        } catch (e) { /* 存档损坏就按新档来 */ }
    }

    function writeSave() {
        try {
            localStorage.setItem(SAVE_KEY, JSON.stringify({
                v: 1, stars: save.stars, best: save.best, assist: save.assist
            }));
        } catch (e) { /* 无存储时静默降级 */ }
    }

    function loadFlag(key, dflt) {
        try {
            var v = localStorage.getItem(key);
            if (v === null) return dflt;
            return Number(v) === 1;
        } catch (e) { return dflt; }
    }

    function saveFlag(key, val) {
        try { localStorage.setItem(key, val ? "1" : "0"); } catch (e) { /* ignore */ }
    }

    /* ---------------- 游戏状态 ---------------- */

    var G = {
        mode: "menu",              // menu / countdown / playing / paused / result / cup
        levelIndex: 0,
        level: null,
        clock: 0,
        elapsed: 0,
        countdown: 0,
        gatePaused: false,
        breakPaused: false,
        manualPaused: false,
        finishedBy: "",            // player / rival
        trimTime: 0,
        bumps: 0,
        cam: { x: 0, y: 0 },
        shake: 0,
        flipTimer: 0,
        hintTimer: 0,
        toastText: "",
        toastTimer: 0,
        warnTimer: 0,
        wind: null,
        ship: null,
        rival: null,
        particles: [],
        sea: null,
        windLines: [],
        goalPulse: 0,
        bumpTimer: 0,
        warnTimer: 0,
        assistState: null,     // 本帧的帆况，渲染用
        assistBest: null,      // 最佳帆角提示
        assistTick: 0,
        roseTick: 0,
        debug: false               // ?debug=1 时在画面左下角显示物理读数
    };

    var keys = { left: false, right: false, fwd: false, back: false };

    function isFrozen() {
        return G.gatePaused || G.breakPaused || G.manualPaused ||
            (typeof document !== "undefined" && document.hidden);
    }

    /* ---------------- 风 ---------------- */

    function createWindState(cfg) {
        return {
            cfg: cfg,
            fromDeg: cfg.from,
            speed: cfg.speed,
            clock: 0,
            gustFactor: 1,
            gustStage: "calm",     // calm / warn / gust
            warnDone: false,
            gustDone: false,
            toX: 0,
            toY: 0,
            _lastStage: "calm"
        };
    }

    function updateWind(dt) {
        var w = G.wind;
        var cfg = w.cfg;
        w.clock += dt;

        var from = cfg.from;
        if (cfg.shift) {
            from += Math.sin(w.clock / cfg.shiftPeriod * Math.PI * 2) * cfg.shift;
        }
        w.fromDeg = from;

        /* 阵风：周期末尾 dur 秒为阵风，阵风前预警告 */
        var factor = 1;
        var stage = "calm";
        if (cfg.gust) {
            var phase = w.clock % cfg.gust.period;
            var gustStart = cfg.gust.period - cfg.gust.dur;
            var warnStart = gustStart - T.gustWarnSeconds;
            if (phase >= gustStart) {
                var p = (phase - gustStart) / cfg.gust.dur;
                factor = 1 + (cfg.gust.mult - 1) * Math.sin(Math.min(1, p) * Math.PI);
                stage = "gust";
            } else if (phase >= warnStart) {
                stage = "warn";
            }
        }
        w.gustFactor = factor;
        w.gustStage = stage;

        if (stage !== w._lastStage) {
            if (stage === "warn") {
                Audio.play("gust");
                toast("阵风将至，往船尾坐、把帆松一点", 2.6, "warn");
            } else if (stage === "gust") {
                toast("阵风来了！压住船", 1.8, "warn");
            }
            w._lastStage = stage;
        }

        w.speed = cfg.speed * factor;
    }

    /* 船所在位置的实际风速倍率：岛屿下风向会形成风影 */
    function windAt(x, y) {
        var w = G.wind;
        var mult = 1;
        var islands = (G.level && G.level.islands) || [];
        var to = deg2rad(w.fromDeg + 180);       // 风吹去的方向
        var tx = Math.sin(to), ty = -Math.cos(to);

        for (var i = 0; i < islands.length; i++) {
            var s = islands[i];
            var dx = x - s.x, dy = y - s.y;
            var proj = dx * tx + dy * ty;                    // 下风侧为正
            if (proj <= 0) continue;
            var perp = Math.abs(dx * (-ty) + dy * tx);
            var coneLen = s.r * 2.6;
            var coneWide = s.r * 1.05 + proj * 0.28;
            if (proj < coneLen && perp < coneWide) {
                var k = (1 - proj / coneLen) * (1 - perp / coneWide);
                mult = Math.min(mult, 1 - 0.68 * k);
            }
        }

        var calm = (G.level && G.level.calm) || [];
        for (var j = 0; j < calm.length; j++) {
            var c = calm[j];
            var cd = dist(x, y, c.x, c.y);
            if (cd < c.r) {
                var ck = 1 - cd / c.r;
                mult = Math.min(mult, 1 - 0.5 * ck);
            }
        }

        var speed = w.speed * mult;
        return {
            speed: speed,
            x: tx * speed,
            y: ty * speed,
            mult: mult
        };
    }

    /* ---------------- 帆与船体的物理 ----------------
     * 返回当前这一帧的帆况：
     *   awaDeg    视风来向（相对船首，0 = 正前，正 = 右舷来风）
     *   appSpeed  视风速度（节）
     *   alpha     帆的攻角（0..90，90 = 完全兜风）
     *   drive     驱动系数（乘上力系数才是推力）
     *   reverse   帆放到了错误的一侧
     *   luffing   攻角太小，帆在抖
     *   noGo      落在顶风死区
     *   lateral   横向分量（0..1），决定横倾与侧漂
     *   toSide    风吹向的右舷分量方向 -1 / 0 / 1
     * ---------------------------------------------------------- */
    function sailState(heading, speed, boomDeg, windX, windY) {
        var h = headingVec(heading);
        var r = rightVec(heading);

        var vx = h.x * speed, vy = h.y * speed;
        var ax = windX - vx, ay = windY - vy;

        var appSpeed = Math.sqrt(ax * ax + ay * ay);
        var awx = ax * h.x + ay * h.y;      // 前向分量（正 = 顺风）
        var awy = ax * r.x + ay * r.y;      // 右舷分量

        var downDeg = rad2deg(Math.atan2(awy, awx)); // 风吹去的方向（船坐标）
        var awaDeg = normDeg(downDeg + 180);         // 风来的方向（相对船首）

        var delta = normDeg(downDeg - boomDeg);
        var alpha = Math.abs(delta);
        var reverse = false;
        /* 帆被吹到「上风侧」才算背风：攻角超过 90° 说明帆面兜的是背面。
         * 顺风 / 顶风时风吹向几乎与船中线平行，横向分量接近 0，此时左右摆帆
         * 是对称的，不能再拿它的符号去判反向 —— 否则顺风一走就把整片帆判成背风。 */
        if (alpha > 90) { alpha = 180 - alpha; reverse = true; }

        var arad = deg2rad(alpha);
        /* 帆的受力 = 薄翼升力 + 兜风阻力。
         * 但视风从正后方来时（顺风），升力在船首方向上没有分量，只剩兜风 ——
         * 这正是「顺风要把帆放横」的原因，也让横风比顺风更快的常识成立。 */
        var runK = clamp((Math.abs(awaDeg) - 140) / 25, 0, 1);
        var lift = Math.sin(2 * arad) / 2 * (1 - runK);
        var drag = Math.sin(arad);
        var drive = T.liftK * lift + T.dragK * drag;

        if (reverse) drive *= 0.12;

        var luffing = false;
        if (alpha < T.luffDeg) {
            luffing = true;
            drive *= Math.pow(Math.max(0.02, alpha / T.luffDeg), 1.6);
        }

        var awaAbs = Math.abs(awaDeg);
        var noGo = awaAbs < T.noGo;
        if (noGo) {
            var ng = awaAbs / T.noGo;
            drive *= ng * ng * 0.9;
        }

        var lateral = Math.abs(Math.sin(deg2rad(awaDeg)));

        return {
            awaDeg: awaDeg,
            awaAbs: awaAbs,
            appSpeed: appSpeed,
            alpha: alpha,
            drive: drive,
            reverse: reverse,
            luffing: luffing,
            noGo: noGo,
            lateral: lateral,
            toSide: awy > 0.4 ? 1 : (awy < -0.4 ? -1 : 0),
            speed: speed
        };
    }

    /* 在给定航向下搜索力度最大的帆角（用于提示与 AI） */
    function bestBoomFor(heading, speed, wx, wy) {
        var best = 0, bestDrive = -1;
        for (var b = -T.sailMax; b <= T.sailMax; b += 3) {
            var st = sailState(heading, speed, b, wx, wy);
            if (st.drive > bestDrive) { bestDrive = st.drive; best = b; }
        }
        return { boom: best, drive: bestDrive };
    }

    /* 帆效 = 当前力度 ÷ 这个航向上船手能达到的最好力度。
     * 顺风只有兜风可用，理论最大值本来就比横风小；用固定上限会让顺风的环永远填不满，
     * 玩家怎么调都看不到金色，反而以为调错了。 */
    function driveNorm(st) {
        if (!st) return 0;
        var best = G.assistBest ? G.assistBest.drive : MAX_DRIVE;
        var den = Math.max(0.55, best);
        return clamp(st.drive / den, 0, 1);
    }

    /* ---------------- 关卡装载 ---------------- */

    function makeShip(cfg, wind) {
        var h = deg2rad(cfg.heading);
        var st = sailState(h, 0, 45, 0, 0);
        return {
            x: cfg.x, y: cfg.y,
            heading: h,
            speed: 3,
            boom: 40,
            boomTarget: 40,
            crew: 0,
            heel: 0,
            heelDir: 1,
            flip: 0,
            tack: 0,
            tackSide: 0,
            sailSoundTimer: 0,
            luffSoundTimer: 0,
            trailTimer: 0,
            lastAwaSign: 0,
            finished: false
        };
    }

    function loadLevel(index) {
        var lv = LEVELS[index];
        G.levelIndex = index;
        G.level = lv;
        G.wind = createWindState(lv.wind);
        G.ship = makeShip({ x: lv.start.x, y: lv.start.y, heading: lv.start.heading }, G.wind);
        G.ship.speed = 2;
        /* 开局把帆摆到当前航向好用的角度，但只给七成 —— 玩家一上手就该有速度，
         * 同时帆效环还没满，正好有「再调一点」的动力 */
        var wv0 = windAt(G.ship.x, G.ship.y);
        var bs0 = bestBoomFor(G.ship.heading, G.ship.speed, wv0.x, wv0.y);
        G.ship.boom = G.ship.boomTarget = bs0.boom * 0.7;
        G.elapsed = 0;
        G.trimTime = 0;
        G.bumps = 0;
        G.flipTimer = 0;
        G.particles.length = 0;
        G.goalPulse = 0;
        G.finishedBy = "";
        G.toastText = "";
        G.toastTimer = 0;
        G.hintTimer = 6.5;
        G.shake = 0;
        G.rival = null;

        if (lv.rival) {
            G.rival = {
                x: lv.start.x - 90,
                y: lv.start.y + 70,
                heading: deg2rad(lv.start.heading),
                speed: 3,
                boom: 30,
                boomBest: 30,
                crew: 0,
                tack: 0,
                think: 0,
                heel: 0,
                trailTimer: 0,
                finished: false
            };
        }

        /* 相机先对准船，避免开局从左上角滑过来 */
        var s = G.ship;
        G.cam.x = clamp(s.x - W / 2, 0, Math.max(0, lv.world.w - W));
        G.cam.y = clamp(s.y - H / 2, 0, Math.max(0, lv.world.h - H));

        G.mode = "countdown";
        G.countdown = 3.2;
        G.countdownN = 4;

        showHud(true);
        updateLevelLabel();
        hidePanels();
        refreshHud(true);
    }

    /* ---------------- 更新 ---------------- */

    function update(dt) {
        G.clock += dt;
        G.elapsed += dt;
        G.goalPulse += dt;
        if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 26);
        if (G.hintTimer > 0) G.hintTimer -= dt;
        if (G.toastTimer > 0) {
            G.toastTimer -= dt;
            if (G.toastTimer <= 0) { G.toastText = ""; paintToast(); }
        }

        updateWind(dt);
        updateInput(dt);
        updateShip(dt);
        if (G.rival) updateRival(dt);

        /* 最佳帆角提示：每 0.25 秒重算一次就够，玩家看不出来 */
        G.assistTick -= dt;
        if (G.assistTick <= 0) {
            G.assistTick = 0.25;
            var wa = windAt(G.ship.x, G.ship.y);
            G.assistBest = bestBoomFor(G.ship.heading, G.ship.speed, wa.x, wa.y);
        }

        updateParticles(dt);
        updateCamera(dt);
        checkGoal();
        refreshHud(false);
    }

    function updateInput(dt) {
        var s = G.ship;

        /* 键盘调帆：按住 ← → 连续改变目标角 */
        if (keys.left || keys.right) {
            var dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
            s.boomTarget = clamp(s.boomTarget + dir * T.sailKeyRate * dt, -T.sailMax, T.sailMax);
        }

        /* 人位：前后移动 */
        if (keys.fwd || keys.back) {
            var cdir = (keys.fwd ? 1 : 0) - (keys.back ? 1 : 0);
            s.crew = clamp(s.crew + cdir * T.crewRate * dt, -1, 1);
        }

        /* 帆的实际角度追随目标角，换舷时自然会慢一拍 */
        var rate = T.sailFollowRate * dt;
        var d = s.boomTarget - s.boom;
        if (Math.abs(d) <= rate) s.boom = s.boomTarget;
        else s.boom += (d > 0 ? rate : -rate);

        /* 帆过中线 = 换舷，给一声响 */
        var signNow = s.boom > 2 ? 1 : (s.boom < -2 ? -1 : 0);
        if (signNow && s.lastAwaSign && signNow !== s.lastAwaSign) {
            Audio.play("tack");
        }
        if (signNow) s.lastAwaSign = signNow;
    }

    function updateShip(dt) {
        var s = G.ship;
        var w = windAt(s.x, s.y);
        var st = sailState(s.heading, s.speed, s.boom, w.x, w.y);
        G.assistState = st;

        /* 自动舵：默认朝目标，抢风模式则沿风来向 ±48° */
        var tgtHeading = desiredHeading(s);
        var turn = T.turnRate * (1 - s.crew * 0.2);
        s.heading = turnToward(s.heading, tgtHeading, turn * dt);
        s.heading = normRad(s.heading);

        /* 横倾：横风最狠；人站船尾能压住，站船头压不住 */
        var resist = 1 - s.crew * 0.35;            // 船尾 crew=-1 → 1.35
        var heelTarget = st.drive * Math.pow(st.appSpeed, 1.5) * T.heelK * st.lateral / Math.max(0.5, resist);
        heelTarget *= (G.flipTimer > 0 ? 0.4 : 1);
        s.heel = lerp(s.heel, Math.min(60, heelTarget), Math.min(1, dt * 2.2));
        if (st.toSide !== 0) s.heelDir = st.toSide;

        /* 效率上限：横倾太大要掉力 */
        var heelPenalty = 1;
        if (s.heel > T.heelWarn) {
            heelPenalty = 1 - (s.heel - T.heelWarn) / (T.heelFlip - T.heelWarn) * 0.55;
        }

        /* 完美配帆：连续高效 2 秒，给一点速度奖励 */
        var eff = driveNorm(st);
        if (eff > 0.88 && s.speed > 1) G.trimTime += dt;
        else G.trimTime = Math.max(0, G.trimTime - dt * 2);
        var trimBonus = G.trimTime > 2 ? 1.06 : 1;

        /* 推力与阻力 */
        var thrust = st.drive * T.forceK * Math.pow(st.appSpeed / 10, 1.6) *
            heelPenalty * trimBonus * (1 + s.crew * 0.07);
        if (G.flipTimer > 0) thrust *= 0.15;

        var drag = s.speed * s.speed / T.hullDrag + T.baseDrag;
        s.speed = Math.max(0, s.speed + (thrust - drag) * dt);

        /* 侧漂：横风时被推到下风侧，人站船头能顶住一点 */
        var leeway = st.lateral * st.drive * T.leewayK * (1 - s.crew * 0.3) * s.speed;
        var hv = headingVec(s.heading);
        var rv = rightVec(s.heading);
        var latSign = st.toSide;
        var mul = T.pxPerKnot;

        s.x += (hv.x * s.speed + rv.x * latSign * leeway) * dt * mul;
        s.y += (hv.y * s.speed + rv.y * latSign * leeway) * dt * mul;

        /* 压不住船：横倾冲破阈值 */
        if (s.heel > T.heelFlip && G.flipTimer <= 0) {
            triggerFlip();
        }
        if (G.flipTimer > 0) {
            G.flipTimer -= dt;
            if (G.flipTimer <= 0) {
                G.flipTimer = 0;
                toast("船稳住了，继续走", 1.4, "ok");
            }
        }

        /* 撞岸、撞礁、擦边 */
        handleCollisions(dt);

        /* 帆的反馈音 */
        s.sailSoundTimer -= dt;
        s.luffSoundTimer -= dt;
        if (st.luffing && s.luffSoundTimer <= 0 && s.speed > 0.5) {
            s.luffSoundTimer = 0.55;
            Audio.play("sailLuff");
        }
        if (!st.luffing && eff > 0.9 && s.sailSoundTimer <= 0) {
            s.sailSoundTimer = 2.4;
            Audio.play("sailFill");
        }

        /* 横倾警报 */
        if (s.heel > T.heelWarn && G.warnTimer <= 0) {
            G.warnTimer = 1.6;
            Audio.play("heelWarn");
            toast("横倾过大！按 S 往船尾坐", 1.6, "warn");
        }
        G.warnTimer -= dt;

        /* 顶风死区提示 */
        if (st.noGo && s.speed < 1.2 && G.warnTimer <= -1) {
            G.warnTimer = 2.2;
            toast("顶风走不动：按 T 抢风，斜着走", 2.4, "warn");
        }

        /* 尾迹 */
        s.trailTimer -= dt;
        if (s.speed > 1.5 && s.trailTimer <= 0) {
            s.trailTimer = 0.045;
            spawnTrail(s.x, s.y, s.heading, s.speed, st);
        }
    }

    function triggerFlip() {
        var s = G.ship;
        G.flipTimer = 2.2;
        s.speed *= 0.3;
        s.heel = T.heelFlip * 0.55;
        // 帆被吹到顺风侧松掉，玩家得重新调
        s.boomTarget = clamp(s.boom + (s.heelDir > 0 ? 34 : -34), -T.sailMax, T.sailMax);
        G.shake = 14;
        spawnBurst(s.x, s.y, 26, "rgba(224,199,155,0.8)", 90);
        Audio.play("flip");
        toast("被阵风压翻了！2 秒后重新起航", 2.2, "bad");
    }

    function desiredHeading(s) {
        var lv = G.level;
        var goalB = bearingTo(s.x, s.y, lv.goal.x, lv.goal.y);

        /* 已经很近了就直接冲，不再斜着走 */
        if (s.tack !== 0 && dist(s.x, s.y, lv.goal.x, lv.goal.y) < 260) {
            s.tack = 0;
        }
        /* 目标已经脱离死区，自动切回直航 */
        if (s.tack !== 0 && Math.abs(normDeg(goalB - G.wind.fromDeg)) > T.noGo + 26) {
            s.tack = 0;
        }

        if (s.tack === 0) return deg2rad(goalB);
        return deg2rad(G.wind.fromDeg + s.tack * T.tackOffset);
    }

    /* 抢风按钮：0 → 贴近目标那一侧 → 另一侧 → 回直航 */
    function pressTack() {
        var s = G.ship;
        if (G.mode !== "playing" || !s) return;
        var lv = G.level;
        var goalB = bearingTo(s.x, s.y, lv.goal.x, lv.goal.y);
        var toGoalSide = normDeg(goalB - G.wind.fromDeg) >= 0 ? 1 : -1;

        if (s.tack === 0) {
            s.tack = toGoalSide;
        } else if (s.tack === toGoalSide) {
            s.tack = -toGoalSide;
        } else {
            s.tack = 0;
        }

        /* 换舷的同时把帆摆到当前航向的吃风角，代价是帆要扫过中线 */
        var nextHeading = deg2rad(s.tack === 0 ? goalB : G.wind.fromDeg + s.tack * T.tackOffset);
        var wa = windAt(s.x, s.y);
        var best = bestBoomFor(nextHeading, s.speed, wa.x, wa.y);
        s.boomTarget = best.boom;

        Audio.play("tack");
        var label = s.tack === 0 ? "回到直航" : (s.tack > 0 ? "右舷抢风" : "左舷抢风");
        toast("换舷：" + label, 1.6, "ok");
    }

    /* ---------------- 碰撞 ---------------- */

    function handleCollisions(dt) {
        var s = G.ship;
        var lv = G.level;
        var changed = false;

        /* 岛/沙滩：软一点，只是蹭掉速度 */
        for (var i = 0; i < lv.islands.length; i++) {
            var isl = lv.islands[i];
            var d = dist(s.x, s.y, isl.x, isl.y);
            var need = isl.r + 18;
            if (d < need) {
                var nx = (s.x - isl.x) / (d || 1);
                var ny = (s.y - isl.y) / (d || 1);
                s.x = isl.x + nx * need;
                s.y = isl.y + ny * need;
                s.speed *= 0.55;
                G.shake = 8;
                toast("蹭上沙滩了，速度掉了一半", 1.6, "warn");
                spawnBurst(s.x, s.y, 12, "rgba(224,206,170,0.7)", 60);
                changed = true;
            }
        }

        /* 礁石：硬一点，水花 + 画面震 */
        for (var j = 0; j < lv.reefs.length; j++) {
            var rf = lv.reefs[j];
            var rd = dist(s.x, s.y, rf.x, rf.y);
            var rneed = rf.r + 14;
            if (rd < rneed) {
                var rx = (s.x - rf.x) / (rd || 1);
                var ry = (s.y - rf.y) / (rd || 1);
                s.x = rf.x + rx * rneed;
                s.y = rf.y + ry * rneed;
                if (G.bumpTimer > 0) return;
                G.bumpTimer = 0.7;
                s.speed *= T.reefHit;
                G.shake = 12;
                G.bumps++;
                Audio.play("reef");
                toast("撞上礁石！速度掉了七成", 1.8, "bad");
                spawnBurst(s.x, s.y, 22, "rgba(240,232,214,0.85)", 110);
                changed = true;
            }
        }
        G.bumpTimer = Math.max(0, (G.bumpTimer || 0) - dt);

        /* 世界边界：外面是岸 */
        var pad = 16;
        if (s.x < pad) { s.x = pad; s.speed *= 0.8; changed = true; }
        if (s.y < pad) { s.y = pad; s.speed *= 0.8; changed = true; }
        if (s.x > lv.world.w - pad) { s.x = lv.world.w - pad; s.speed *= 0.8; changed = true; }
        if (s.y > lv.world.h - pad) { s.y = lv.world.h - pad; s.speed *= 0.8; changed = true; }
        if (changed && G.warnTimer <= -1) {
            G.warnTimer = 2;
            toast("前面是海岸线，调头", 1.4, "warn");
        }
    }

    /* ---------------- 对手 ---------------- */

    function updateRival(dt) {
        var r = G.rival;
        var lv = G.level;
        var w = windAt(r.x, r.y);

        r.think -= dt;
        if (r.think <= 0) {
            r.think = 0.35;
            var goalB = bearingTo(r.x, r.y, lv.goal.x, lv.goal.y);
            var away = Math.abs(normDeg(goalB - G.wind.fromDeg));
            if (away < T.noGo + 10 && dist(r.x, r.y, lv.goal.x, lv.goal.y) > 300) {
                r.tack = normDeg(goalB - G.wind.fromDeg) >= 0 ? 1 : -1;
            } else {
                r.tack = 0;
            }
            r.crew = G.wind.gustFactor > 1.2 ? -1 : 0.2;
            var probeHeading = r.tack === 0 ? deg2rad(goalB) : deg2rad(G.wind.fromDeg + r.tack * T.tackOffset);
            r.boomBest = bestBoomFor(probeHeading, r.speed, w.x, w.y).boom;
        }

        var tgt = r.tack === 0
            ? deg2rad(bearingTo(r.x, r.y, lv.goal.x, lv.goal.y))
            : deg2rad(G.wind.fromDeg + r.tack * T.tackOffset);
        r.heading = turnToward(r.heading, tgt, T.turnRate * dt);
        r.heading = normRad(r.heading);

        var d = r.boomBest - r.boom;
        var rate = T.sailFollowRate * dt * 1.5;
        r.boom = Math.abs(d) <= rate ? r.boomBest : r.boom + (d > 0 ? rate : -rate);

        var st = sailState(r.heading, r.speed, r.boom, w.x, w.y);
        var thrust = st.drive * T.forceK * Math.pow(st.appSpeed / 10, 1.6) * T.rivalRate;
        var drag = r.speed * r.speed / T.hullDrag + T.baseDrag;
        r.speed = Math.max(0, r.speed + (thrust - drag) * dt);

        var hv = headingVec(r.heading);
        var rv = rightVec(r.heading);
        var leeway = st.lateral * st.drive * T.leewayK * r.speed;
        r.x += (hv.x * r.speed + rv.x * st.toSide * leeway) * dt * T.pxPerKnot;
        r.y += (hv.y * r.speed + rv.y * st.toSide * leeway) * dt * T.pxPerKnot;
        r.heel = lerp(r.heel, Math.min(40, st.drive * Math.pow(st.appSpeed, 1.5) * T.heelK * st.lateral), dt * 2);

        r.trailTimer -= dt;
        if (r.speed > 1.5 && r.trailTimer <= 0) {
            r.trailTimer = 0.08;
            spawnTrail(r.x, r.y, r.heading, r.speed, st, true);
        }

        if (!r.finished && dist(r.x, r.y, lv.goal.x, lv.goal.y) < lv.goal.r + T.finishR) {
            r.finished = true;
            if (G.mode === "playing") {
                G.finishedBy = "rival";
                toast("对手先到终点了！", 2.4, "warn");
            }
        }
    }

    /* ---------------- 粒子 ---------------- */

    function spawn(x, y, vx, vy, life, r, color, kind) {
        if (G.particles.length > 340) G.particles.shift();
        G.particles.push({ x: x, y: y, vx: vx, vy: vy, life: life, max: life, r: r, c: color, k: kind || "dot" });
    }

    function spawnTrail(x, y, heading, speed, st, isRival) {
        var hv = headingVec(heading);
        var bx = x - hv.x * 24;
        var by = y - hv.y * 24;
        var rv = rightVec(heading);
        var spread = (Math.random() - 0.5) * 14;
        var drifts = st ? st.toSide : 0;
        var col = isRival ? "rgba(160,206,190,0.42)" : "rgba(232,246,238,0.44)";
        spawn(bx + rv.x * spread, by + rv.y * spread,
            -hv.x * speed * 0.6 + (Math.random() - 0.5) * 8 + rv.x * drifts * 6,
            -hv.y * speed * 0.6 + (Math.random() - 0.5) * 8 + rv.y * drifts * 6,
            1.0 + Math.random() * 0.6, 1.4 + Math.random() * 2.2, col, "foam");
    }

    function spawnBurst(x, y, n, color, force) {
        for (var i = 0; i < n; i++) {
            var a = Math.random() * Math.PI * 2;
            var sp = force * (0.3 + Math.random() * 0.8);
            spawn(x, y, Math.cos(a) * sp, Math.sin(a) * sp,
                0.6 + Math.random() * 0.7, 2 + Math.random() * 4, color, "spray");
        }
    }

    function updateParticles(dt) {
        for (var i = G.particles.length - 1; i >= 0; i--) {
            var p = G.particles[i];
            p.life -= dt;
            if (p.life <= 0) { G.particles.splice(i, 1); continue; }
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vx *= 0.965;
            p.vy *= 0.965;
            if (p.k === "foam") p.r += dt * 0.9;
        }
    }

    /* ---------------- 相机 ---------------- */

    function updateCamera(dt) {
        var s = G.ship;
        var lv = G.level;
        var lead = headingVec(s.heading);
        var tx = s.x + lead.x * 30 - W / 2;
        var ty = s.y + lead.y * 30 - H / 2;
        var k = Math.min(1, dt * 3.2);
        G.cam.x = lerp(G.cam.x, tx, k);
        G.cam.y = lerp(G.cam.y, ty, k);
        G.cam.x = clamp(G.cam.x, 0, Math.max(0, lv.world.w - W));
        G.cam.y = clamp(G.cam.y, 0, Math.max(0, lv.world.h - H));
    }

    /* ---------------- 终点 ---------------- */

    function checkGoal() {
        if (G.mode !== "playing") return;
        var s = G.ship;
        var lv = G.level;
        if (dist(s.x, s.y, lv.goal.x, lv.goal.y) < lv.goal.r + T.finishR) {
            finishLevel();
        }
    }

    function finishLevel() {
        var lv = G.level;
        var s = G.ship;
        var t = G.elapsed;
        var stars = t <= lv.par ? 3 : (t <= lv.par2 ? 2 : 1);
        var key = String(lv.id);

        var prevStars = save.stars[key] || 0;
        var prevBest = save.best[key] || 0;
        var isBest = !prevBest || t < prevBest;
        if (stars > prevStars) save.stars[key] = stars;
        if (isBest) save.best[key] = Math.round(t * 10) / 10;
        writeSave();

        G.mode = "result";
        G.finishedBy = G.finishedBy || "player";

        G.shake = 10;
        spawnBurst(s.x, s.y, 70, "rgba(224,199,155,0.95)", 150);
        spawnBurst(s.x, s.y, 30, "rgba(255,245,220,0.95)", 90);
        Audio.play("finish");

        try { if (window.GameLimit) window.GameLimit.count("sailing"); } catch (e) { /* 存档异常不影响游戏 */ }

        showResult({ stars: stars, time: t, isBest: isBest, prevBest: prevBest, finishedBy: G.finishedBy });
        refreshLevelGrid();
    }

    /* ---------------- 渲染 ---------------- */

    function makeSeaTile(size, seed, alpha) {
        var c = document.createElement("canvas");
        c.width = c.height = size;
        var g = c.getContext("2d");
        var rand = mulberry(seed);
        g.clearRect(0, 0, size, size);

        for (var i = 0; i < 90; i++) {
            var x = rand() * size;
            var y = rand() * size;
            var len = 6 + rand() * 22;
            var tilt = (rand() - 0.5) * 8;
            g.beginPath();
            g.strokeStyle = "rgba(214,190,146," + (alpha * (0.25 + rand() * 0.75)).toFixed(3) + ")";
            g.lineWidth = 0.6 + rand() * 1.4;
            g.moveTo(x, y);
            g.quadraticCurveTo(x + len * 0.5, y + tilt * 0.5, x + len, y + tilt);
            g.stroke();
        }
        return c;
    }

    function mulberry(a) {
        return function () {
            a |= 0; a = a + 0x6D2B79F5 | 0;
            var t = Math.imul(a ^ a >>> 15, 1 | a);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }

    function buildSea() {
        if (G.sea) return;
        G.sea = {
            tiles: [
                { img: makeSeaTile(512, 7, 0.16), size: 512, par: 0.35, drift: 0.22, pat: null },
                { img: makeSeaTile(384, 23, 0.12), size: 384, par: 0.62, drift: 0.42, pat: null },
                { img: makeSeaTile(256, 91, 0.10), size: 256, par: 0.9, drift: 0.7, pat: null }
            ]
        };
        for (var i = 0; i < G.sea.tiles.length; i++) {
            G.sea.tiles[i].pat = ctx.createPattern(G.sea.tiles[i].img, "repeat");
        }
    }

    function drawSea() {
        /* 深海底色：中间稍亮，四周压暗，像傍晚的金色海面 */
        var grd = ctx.createRadialGradient(W * 0.5, H * 0.42, 80, W * 0.5, H * 0.5, W * 0.78);
        grd.addColorStop(0, "#1e3733");
        grd.addColorStop(0.52, "#162a28");
        grd.addColorStop(1, "#0a1413");
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, W, H);

        var to = deg2rad((G.wind ? G.wind.fromDeg : 0) + 180);
        var driftX = Math.sin(to), driftY = -Math.cos(to);

        for (var i = 0; i < G.sea.tiles.length; i++) {
            var L = G.sea.tiles[i];
            if (!L.pat) continue;
            var ox = -G.cam.x * L.par + G.clock * driftX * L.drift * 10;
            var oy = -G.cam.y * L.par + G.clock * driftY * L.drift * 10;
            ctx.save();
            ctx.translate(ox % L.size, oy % L.size);
            ctx.fillStyle = L.pat;
            ctx.fillRect(-L.size, -L.size, W + L.size * 2, H + L.size * 2);
            ctx.restore();
        }

        /* 涌浪：几条缓慢横过的长波，给海面「呼吸感」 */
        ctx.save();
        ctx.lineWidth = 2;
        for (var k = 0; k < 7; k++) {
            var yy = ((k * 128 + G.clock * 12 + G.cam.y * 0.1) % (H + 200)) - 100;
            var amp = 10 + k * 2;
            ctx.beginPath();
            ctx.strokeStyle = "rgba(226,199,155," + (0.045 + k * 0.004) + ")";
            for (var x = -40; x <= W + 40; x += 24) {
                var y2 = yy + Math.sin(x * 0.012 + G.clock * 0.5 + k) * amp;
                if (x === -40) ctx.moveTo(x, y2); else ctx.lineTo(x, y2);
            }
            ctx.stroke();
        }
        ctx.restore();
    }

    function drawWindShadows() {
        if (!G.level || !G.level.islands.length) return;
        var to = deg2rad(G.wind.fromDeg + 180);
        var tx = Math.sin(to), ty = -Math.cos(to);
        ctx.save();
        for (var i = 0; i < G.level.islands.length; i++) {
            var s = G.level.islands[i];
            var sx = s.x - G.cam.x, sy = s.y - G.cam.y;
            var len = s.r * 2.6;
            ctx.beginPath();
            var nx = -ty, ny = tx;
            ctx.moveTo(sx + nx * s.r * 0.9, sy + ny * s.r * 0.9);
            ctx.lineTo(sx + tx * len + nx * s.r * 1.7, sy + ty * len + ny * s.r * 1.7);
            ctx.lineTo(sx + tx * len - nx * s.r * 1.7, sy + ty * len - ny * s.r * 1.7);
            ctx.lineTo(sx - nx * s.r * 0.9, sy - ny * s.r * 0.9);
            var g = ctx.createLinearGradient(sx, sy, sx + tx * len, sy + ty * len);
            g.addColorStop(0, "rgba(8,14,12,0.34)");
            g.addColorStop(1, "rgba(8,14,12,0)");
            ctx.fillStyle = g;
            ctx.fill();
        }
        ctx.restore();
    }

    function islandShape(isl) {
        if (isl._pts) return isl._pts;
        var pts = [];
        var n = 20;
        var seed = isl.x * 0.13 + isl.y * 0.07;
        for (var i = 0; i < n; i++) {
            var a = i / n * Math.PI * 2;
            var jitter = Math.sin(i * 12.9898 + seed) * 43758.5453;
            jitter = (jitter - Math.floor(jitter)) * 0.34 - 0.17;
            var r = isl.r * (1 + jitter);
            pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
        }
        isl._pts = pts;
        return pts;
    }

    /* 用二次贝塞尔把海岸线顶点平滑连起来，避免出现生硬的多边形折角 */
    function pathIsland(pts, sx, sy, k) {
        var n = pts.length;
        var mid = function (i) {
            var a = pts[i % n], b = pts[(i + 1) % n];
            return {
                x: sx + (a.x + b.x) * 0.5 * k,
                y: sy + (a.y + b.y) * 0.5 * k
            };
        };
        var m0 = mid(0);
        ctx.beginPath();
        ctx.moveTo(m0.x, m0.y);
        for (var i = 1; i <= n; i++) {
            var p = pts[i % n];
            var m1 = mid(i);
            ctx.quadraticCurveTo(sx + p.x * k, sy + p.y * k, m1.x, m1.y);
        }
        ctx.closePath();
    }

    function drawIslands() {
        var list = G.level.islands || [];
        ctx.save();
        for (var i = 0; i < list.length; i++) {
            var isl = list[i];
            var sx = isl.x - G.cam.x, sy = isl.y - G.cam.y;
            if (sx < -isl.r * 2 || sx > W + isl.r * 2 || sy < -isl.r * 2 || sy > H + isl.r * 2) continue;
            var pts = islandShape(isl);

            /* 浅滩光晕 */
            pathIsland(pts, sx, sy, 1.16);
            ctx.fillStyle = "rgba(207,181,133,0.12)";
            ctx.fill();

            /* 环形浪：浅滩外圈的一道白边 */
            ctx.strokeStyle = "rgba(232,246,238,0.16)";
            ctx.lineWidth = 2;
            pathIsland(pts, sx, sy, 1.1);
            ctx.stroke();

            /* 沙岸 */
            pathIsland(pts, sx, sy, 1.06);
            ctx.fillStyle = "#c2a273";
            ctx.fill();

            /* 陆地 */
            pathIsland(pts, sx, sy, 1);
            var g = ctx.createRadialGradient(sx - isl.r * 0.3, sy - isl.r * 0.35, 8, sx, sy, isl.r * 1.05);
            g.addColorStop(0, "#6f5436");
            g.addColorStop(0.55, "#4f3d28");
            g.addColorStop(1, "#33261a");
            ctx.fillStyle = g;
            ctx.fill();
            ctx.strokeStyle = "rgba(20,14,10,0.55)";
            ctx.lineWidth = 2;
            ctx.stroke();

            /* 植被层：往中心收一圈的深色，让岛有高低差 */
            pathIsland(pts, sx, sy, 0.74);
            var veg = ctx.createRadialGradient(sx - isl.r * 0.2, sy - isl.r * 0.25, 4, sx, sy, isl.r * 0.8);
            veg.addColorStop(0, "rgba(76,96,60,0.5)");
            veg.addColorStop(1, "rgba(52,66,42,0.22)");
            ctx.fillStyle = veg;
            ctx.fill();

            /* 岛上的几丛草木 */
            var rand = mulberry(Math.floor(isl.x + isl.y));
            for (var d = 0; d < 9; d++) {
                var ang = rand() * Math.PI * 2;
                var rr = rand() * isl.r * 0.62;
                var bx = sx + Math.cos(ang) * rr;
                var by = sy + Math.sin(ang) * rr;
                ctx.beginPath();
                ctx.arc(bx, by, 5 + rand() * 11, 0, Math.PI * 2);
                ctx.fillStyle = "rgba(40,62,44," + (0.45 + rand() * 0.3).toFixed(2) + ")";
                ctx.fill();
            }
        }
        ctx.restore();
    }

    function drawReefs() {
        var list = G.level.reefs || [];
        ctx.save();
        for (var i = 0; i < list.length; i++) {
            var rf = list[i];
            var sx = rf.x - G.cam.x, sy = rf.y - G.cam.y;
            if (sx < -rf.r * 2 || sx > W + rf.r * 2 || sy < -rf.r * 2 || sy > H + rf.r * 2) continue;

            /* 礁石周围的碎浪：两圈，外圈更大更淡，随时间轻轻起伏 */
            var waveK = Math.sin(G.clock * 2 + i);
            ctx.beginPath();
            ctx.arc(sx, sy, rf.r + 16 + waveK * 5, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(226,212,184,0.10)";
            ctx.lineWidth = 4;
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(sx, sy, rf.r + 8 + waveK * 3, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(238,246,240,0.24)";
            ctx.lineWidth = 2.5;
            ctx.stroke();

            var pts = [];
            var n = 11;
            var rand = mulberry(i * 37 + rf.x);
            for (var k = 0; k < n; k++) {
                var a = k / n * Math.PI * 2;
                pts.push({
                    x: sx + Math.cos(a) * rf.r * (0.72 + rand() * 0.4),
                    y: sy + Math.sin(a) * rf.r * (0.72 + rand() * 0.4)
                });
            }
            ctx.beginPath();
            for (var j = 0; j < pts.length; j++) {
                if (j === 0) ctx.moveTo(pts[j].x, pts[j].y); else ctx.lineTo(pts[j].x, pts[j].y);
            }
            ctx.closePath();
            var g2 = ctx.createRadialGradient(sx - 6, sy - 8, 4, sx, sy, rf.r);
            g2.addColorStop(0, "#6b6154");
            g2.addColorStop(1, "#2a2721");
            ctx.fillStyle = g2;
            ctx.fill();
            ctx.strokeStyle = "rgba(12,10,8,0.6)";
            ctx.lineWidth = 2;
            ctx.stroke();

            /* 岩石的亮面与裂纹，让它像块石头而不是一块色板 */
            ctx.beginPath();
            ctx.arc(sx - rf.r * 0.28, sy - rf.r * 0.3, rf.r * 0.32, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(176,160,138,0.16)";
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(sx - rf.r * 0.48, sy - rf.r * 0.06);
            ctx.lineTo(sx + rf.r * 0.08, sy + rf.r * 0.08);
            ctx.lineTo(sx + rf.r * 0.4, sy - rf.r * 0.32);
            ctx.strokeStyle = "rgba(16,14,12,0.42)";
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
        ctx.restore();
    }

    function drawGoal() {
        var lv = G.level;
        var sx = lv.goal.x - G.cam.x, sy = lv.goal.y - G.cam.y;
        var r = lv.goal.r;
        var pulse = 1 + Math.sin(G.clock * 2.4) * 0.06;

        ctx.save();
        var g = ctx.createRadialGradient(sx, sy, r * 0.2, sx, sy, r * 2.1);
        g.addColorStop(0, "rgba(224,199,155,0.30)");
        g.addColorStop(0.5, "rgba(201,165,107,0.10)");
        g.addColorStop(1, "rgba(201,165,107,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(sx, sy, r * 2.1, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(sx, sy, r * pulse, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(240,220,180,0.85)";
        ctx.lineWidth = 3;
        ctx.stroke();

        /* 内侧的虚线，暗示「进圈即到」 */
        ctx.setLineDash([10, 12]);
        ctx.beginPath();
        ctx.arc(sx, sy, r * 0.62 * pulse, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(224,199,155,0.55)";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.setLineDash([]);

        /* 浮标 */
        var bob = Math.sin(G.clock * 2.2) * 2;
        ctx.beginPath();
        ctx.arc(sx, sy + bob, 9, 0, Math.PI * 2);
        ctx.fillStyle = "#e0c79b";
        ctx.fill();
        ctx.strokeStyle = "#8a6a3c";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(sx, sy + bob - 8);
        ctx.lineTo(sx, sy + bob - 30);
        ctx.strokeStyle = "#e0c79b";
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(sx, sy + bob - 30);
        ctx.lineTo(sx + 18, sy + bob - 24);
        ctx.lineTo(sx, sy + bob - 17);
        ctx.closePath();
        ctx.fillStyle = "rgba(224,199,155,0.85)";
        ctx.fill();
        ctx.restore();
    }

    function drawDots() {
        for (var i = 0; i < G.particles.length; i++) {
            var p = G.particles[i];
            var sx = p.x - G.cam.x, sy = p.y - G.cam.y;
            if (sx < -20 || sx > W + 20 || sy < -20 || sy > H + 20) continue;
            var lifeK = p.life / p.max;
            ctx.globalAlpha = Math.min(1, lifeK * 1.2);
            ctx.fillStyle = p.c;
            ctx.beginPath();
            ctx.arc(sx, sy, p.r * (p.k === "foam" ? 1 : lifeK), 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    function drawWindLines() {
        if (!G.windLines) G.windLines = [];
        var lines = G.windLines;

        /* 生成 / 回收风痕：屏幕范围内随机撒 */
        var target = 34 + Math.round(Math.min(26, G.wind.speed * 1.2));
        while (lines.length < target) {
            lines.push({
                x: G.cam.x + Math.random() * W - 300,
                y: G.cam.y + Math.random() * H - 300,
                len: 20 + Math.random() * 40,
                a: 0.10 + Math.random() * 0.22,
                sp: 0.7 + Math.random() * 0.6
            });
        }

        var to = deg2rad(G.wind.fromDeg + 180);
        var tx = Math.sin(to), ty = -Math.cos(to);
        var spd = G.wind.speed * 5.5;
        var dt = G.dt || 0.016;

        ctx.save();
        ctx.lineCap = "round";
        for (var i = 0; i < lines.length; i++) {
            var L = lines[i];
            L.x += tx * spd * L.sp * dt;
            L.y += ty * spd * L.sp * dt;

            /* 离开相机范围就从上风侧重生 */
            var sx = L.x - G.cam.x, sy = L.y - G.cam.y;
            if (sx < -320 || sx > W + 320 || sy < -320 || sy > H + 320) {
                L.x = G.cam.x + Math.random() * W - tx * 260;
                L.y = G.cam.y + Math.random() * H - ty * 260;
                continue;
            }
            ctx.beginPath();
            ctx.strokeStyle = "rgba(224,199,155," + L.a + ")";
            ctx.lineWidth = 1.1;
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx + tx * L.len, sy + ty * L.len);
            ctx.stroke();
        }
        ctx.restore();
    }

    function drawAssist(sx, sy, heading, boomDeg) {
        /* 吃风角提示：一段金色弧 + 一条指向最佳帆角的虚线 */
        var best = G.assistBest;
        if (!best) return;
        var refAng = heading - Math.PI / 2;   // 船首在屏幕上的角度
        var span = deg2rad(best.boom);
        /* 帆杆在船尾侧：中线方向 = 船首反方向，boom 为正再顺时针偏 */
        var a0 = refAng + Math.PI;
        var a1 = a0 - span;

        ctx.save();
        ctx.beginPath();
        ctx.arc(sx, sy, 60, Math.min(a0, a1), Math.max(a0, a1));
        ctx.strokeStyle = "rgba(224,199,155,0.26)";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(sx, sy);
        var tipX = sx + Math.cos(a1) * 62;
        var tipY = sy + Math.sin(a1) * 62;
        ctx.lineTo(tipX, tipY);
        ctx.setLineDash([4, 5]);
        ctx.strokeStyle = "rgba(255,226,170,0.5)";
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }

    /* 船按 1.55 倍绘制：物理世界不变，只是让船在画面上更大、帆看得清 */
    var SHIP_SCALE = 1.55;

    function drawBoat(s, isRival) {
        var sx = s.x - G.cam.x, sy = s.y - G.cam.y;
        if (sx < -120 || sx > W + 120 || sy < -120 || sy > H + 120) return;

        var spd = s.speed || 0;
        var speedK = clamp(spd / 9, 0, 1);

        /* 船影 + 尾流：先在未缩放的船坐标里画，避免和船体一起被放大 */
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(s.heading - Math.PI / 2);

        ctx.beginPath();
        ctx.ellipse(0, 4, 44, 16, 0, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(6,20,18,0.32)";
        ctx.fill();

        if (spd > 1.2) {
            var wakeLen = 26 + speedK * 46;
            ctx.beginPath();
            ctx.moveTo(-30, -7);
            ctx.lineTo(-30 - wakeLen, -9 - wakeLen * 0.36);
            ctx.moveTo(-30, 7);
            ctx.lineTo(-30 - wakeLen, 9 + wakeLen * 0.36);
            ctx.strokeStyle = "rgba(226,242,234," + (0.10 + speedK * 0.2).toFixed(3) + ")";
            ctx.lineWidth = 2.2;
            ctx.stroke();
        }
        ctx.restore();

        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(s.heading - Math.PI / 2);

        /* 横倾：船身稍微倾斜一点（俯视图里表现为整体旋转 + 帆偏移） */
        var heelRoll = deg2rad(s.heel) * 0.16 * (s.heelDir || 1);
        ctx.rotate(heelRoll);
        ctx.scale(SHIP_SCALE, SHIP_SCALE);

        var hullGrad = ctx.createLinearGradient(-26, -10, 26, 10);
        if (isRival) {
            hullGrad.addColorStop(0, "#3c5a52");
            hullGrad.addColorStop(1, "#22332f");
        } else {
            hullGrad.addColorStop(0, "#d8c3a5");
            hullGrad.addColorStop(0.55, "#bfa27c");
            hullGrad.addColorStop(1, "#8a6a48");
        }
        ctx.beginPath();
        ctx.moveTo(27, 0);
        ctx.quadraticCurveTo(12, -10, -12, -8.5);
        ctx.lineTo(-24, -6.5);
        ctx.quadraticCurveTo(-27, 0, -24, 6.5);
        ctx.lineTo(-12, 8.5);
        ctx.quadraticCurveTo(12, 10, 27, 0);
        ctx.closePath();
        ctx.fillStyle = hullGrad;
        ctx.fill();
        ctx.strokeStyle = isRival ? "rgba(10,18,16,0.8)" : "rgba(58,36,20,0.85)";
        ctx.lineWidth = 2.2;
        ctx.stroke();

        /* 甲板木纹：三条横板，给船体一点厚度 */
        ctx.strokeStyle = isRival ? "rgba(20,34,30,0.4)" : "rgba(110,78,48,0.32)";
        ctx.lineWidth = 1;
        for (var board = -1; board <= 1; board++) {
            if (board === 0) continue;
            ctx.beginPath();
            ctx.moveTo(-16, board * 4.4);
            ctx.lineTo(18, board * 3.2);
            ctx.stroke();
        }

        /* 船首浪：速度越快，船头两侧荡开的水花越明显 */
        if (spd > 2) {
            var sprayA = (0.16 + speedK * 0.3).toFixed(3);
            ctx.strokeStyle = "rgba(244,252,247," + sprayA + ")";
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.moveTo(23, -5);
            ctx.quadraticCurveTo(28, -8, 31 + speedK * 5, -11 - speedK * 5);
            ctx.moveTo(23, 5);
            ctx.quadraticCurveTo(28, 8, 31 + speedK * 5, 11 + speedK * 5);
            ctx.stroke();
        }

        /* 甲板中线与座位 */
        ctx.beginPath();
        ctx.moveTo(20, 0);
        ctx.lineTo(-19, 0);
        ctx.strokeStyle = "rgba(60,40,22,0.35)";
        ctx.lineWidth = 1.2;
        ctx.stroke();

        /* 帆：帆杆从桅杆向船尾摆，boom 为正表示摆向右舷 */
        var boomRad = deg2rad(s.boom);
        var mx = 4, my = 0;
        var sailLen = 42;
        var ex = mx - Math.cos(boomRad) * sailLen;
        var ey = my + Math.sin(boomRad) * sailLen;

        var bulge = 0;
        if (G.assistState && !isRival) {
            bulge = driveNorm(G.assistState);
        } else {
            bulge = 0.6;
        }
        var luff = (!isRival && G.assistState && G.assistState.luffing) ? Math.sin(G.clock * 34) * 3 : 0;
        var windSide = (!isRival && G.assistState && G.assistState.toSide) || 1;
        /* 帆弦方向是 (-cos, +sin)，它的法线是 (sin, cos)，别再用朝船首时的旧公式 */
        var perpX = Math.sin(boomRad) * windSide;
        var perpY = Math.cos(boomRad) * windSide;
        var cx = mx + (ex - mx) * 0.5 + perpX * (15 * bulge + luff);
        var cy = my + (ey - my) * 0.5 + perpY * (15 * bulge + luff);

        ctx.beginPath();
        ctx.moveTo(mx, my);
        ctx.quadraticCurveTo(cx, cy, ex, ey);
        ctx.lineTo(mx, my);
        var sg = ctx.createLinearGradient(mx, my, ex, ey);
        if (isRival) {
            sg.addColorStop(0, "#c3e0d4");
            sg.addColorStop(1, "#7fa99a");
        } else {
            sg.addColorStop(0, "#fffaf0");
            sg.addColorStop(1, "#ecd6ae");
        }
        ctx.fillStyle = sg;
        ctx.fill();
        ctx.strokeStyle = "rgba(120,92,58,0.72)";
        ctx.lineWidth = 1.2;
        ctx.stroke();

        /* 帆骨：三条沿帆面斜拉的线，让帆看起来是有骨架的布 */
        ctx.strokeStyle = isRival ? "rgba(60,90,82,0.32)" : "rgba(158,124,78,0.3)";
        ctx.lineWidth = 0.9;
        for (var rib = 1; rib <= 3; rib++) {
            var rk = rib / 4;
            var rx = mx + (ex - mx) * rk + perpX * 15 * bulge * 0.8 * rk;
            var ry = my + (ey - my) * rk + perpY * 15 * bulge * 0.8 * rk;
            ctx.beginPath();
            ctx.moveTo(mx, my);
            ctx.lineTo(rx, ry);
            ctx.stroke();
        }

        /* 帆杆 */
        ctx.beginPath();
        ctx.moveTo(mx, my);
        ctx.lineTo(ex, ey);
        ctx.strokeStyle = "rgba(90,64,40,0.9)";
        ctx.lineWidth = 2;
        ctx.stroke();

        /* 桅杆：小圆 + 一圈亮边，方便一眼找到转帆的支点 */
        ctx.beginPath();
        ctx.arc(mx, my, 3.6, 0, Math.PI * 2);
        ctx.fillStyle = "#5d4227";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(mx, my, 1.4, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,238,206,0.7)";
        ctx.fill();

        /* 完美配帆的金色光晕 */
        if (!isRival && G.trimTime > 2) {
            ctx.beginPath();
            ctx.arc(mx + (ex - mx) * 0.5, my + (ey - my) * 0.5, 14, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(255,226,150," + (0.35 + Math.sin(G.clock * 8) * 0.15) + ")";
            ctx.lineWidth = 1.6;
            ctx.stroke();
        }

        /* 船员：沿中线前后移动 —— 往前站压低船头，往后坐压住横倾 */
        var px = 2 + (s.crew || 0) * 13;
        ctx.beginPath();
        ctx.ellipse(px, 0, 5.2, 3.4, 0, 0, Math.PI * 2);
        ctx.fillStyle = isRival ? "#a8c9bd" : "#e9cf9f";
        ctx.fill();
        ctx.strokeStyle = isRival ? "rgba(30,54,46,0.6)" : "rgba(96,64,34,0.65)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(px, 0, 2.1, 0, Math.PI * 2);
        ctx.fillStyle = isRival ? "#39544c" : "#8a5f38";
        ctx.fill();

        ctx.restore();

        if (!isRival && save.assist) drawAssist(sx, sy, s.heading, s.boom);
    }

    function drawGoalPointer() {
        var lv = G.level;
        var sx = lv.goal.x - G.cam.x, sy = lv.goal.y - G.cam.y;
        if (sx > 40 && sx < W - 40 && sy > 40 && sy < H - 40) return;

        var cx = W / 2, cy = H / 2;
        var ang = Math.atan2(sy - cy, sx - cx);
        var pad = 92;
        /* 沿方向推到屏幕边缘内侧 */
        var halfW = W / 2 - pad, halfH = H / 2 - pad;
        var t = Math.min(halfW / Math.abs(Math.cos(ang)), halfH / Math.abs(Math.sin(ang)));
        var px = cx + Math.cos(ang) * t;
        var py = cy + Math.sin(ang) * t;

        /* 让指示器躲开三块 HUD：顶部提示条、右侧仪表、左下角门禁徽标 */
        if (py < 84) py = 84;
        if (px > W - 205 && py < H - 210) px = W - 205;
        if (px < 210 && py > H - 150) py = H - 150;

        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(ang);
        ctx.beginPath();
        ctx.moveTo(16, 0);
        ctx.lineTo(-8, -9);
        ctx.lineTo(-4, 0);
        ctx.lineTo(-8, 9);
        ctx.closePath();
        ctx.fillStyle = "rgba(224,199,155,0.9)";
        ctx.fill();
        ctx.restore();

        var s = G.ship;
        var d = Math.round(dist(s.x, s.y, lv.goal.x, lv.goal.y));
        ctx.save();
        ctx.font = "600 13px 'SF Mono', Menlo, monospace";
        ctx.fillStyle = "rgba(240,228,206,0.85)";
        ctx.textAlign = "center";
        ctx.fillText(d + "", px, py + 30);
        ctx.restore();
    }

    function render() {
        var shakeX = 0, shakeY = 0;
        if (G.shake > 0.2) {
            shakeX = (Math.random() - 0.5) * G.shake;
            shakeY = (Math.random() - 0.5) * G.shake;
        }

        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        if (G.level) {
            ctx.save();
            ctx.translate(shakeX, shakeY);
            drawSea();
            drawWindShadows();
            drawIslands();
            drawReefs();
            drawGoal();
            drawDots();
            drawWindLines();
            if (G.rival) drawBoat(G.rival, true);
            if (G.ship) drawBoat(G.ship, false);
            if (G.ship) drawGoalPointer();
            ctx.restore();

            /* 阵风时的整体暖色压光 */
            if (G.wind && G.wind.gustFactor > 1.05) {
                var k = Math.min(1, (G.wind.gustFactor - 1) / 0.6);
                ctx.fillStyle = "rgba(255,214,160," + (0.035 + k * 0.05) + ")";
                ctx.fillRect(0, 0, W, H);
            }
        } else {
            ctx.fillStyle = "#0e1a18";
            ctx.fillRect(0, 0, W, H);
        }

        /* 边框暗角 */
        var vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
        vg.addColorStop(0, "rgba(0,0,0,0)");
        vg.addColorStop(1, "rgba(0,0,0,0.45)");
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, W, H);
    }

    /* ---------------- 风玫瑰 ---------------- */

    function drawRose() {
        if (!roseCtx) return;
        var size = 116, dpr = 2;
        if (roseCanvas.width !== size * dpr) {
            roseCanvas.width = size * dpr;
            roseCanvas.height = size * dpr;
        }
        roseCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        roseCtx.clearRect(0, 0, size, size);

        var cx = size / 2, cy = size / 2, R = 44;
        roseCtx.beginPath();
        roseCtx.arc(cx, cy, R, 0, Math.PI * 2);
        roseCtx.fillStyle = "rgba(18,30,28,0.55)";
        roseCtx.fill();
        roseCtx.strokeStyle = "rgba(201,165,107,0.45)";
        roseCtx.lineWidth = 1.2;
        roseCtx.stroke();

        /* 四个方位刻度 */
        roseCtx.font = "600 9px 'SF Mono', Menlo, monospace";
        roseCtx.fillStyle = "rgba(240,228,206,0.55)";
        roseCtx.textAlign = "center";
        roseCtx.fillText("N", cx, cy - R + 10);
        roseCtx.fillText("S", cx, cy + R - 2);
        roseCtx.fillText("E", cx + R - 6, cy + 3);
        roseCtx.fillText("W", cx - R + 6, cy + 3);

        var from = G.wind ? G.wind.fromDeg : 0;
        var a = deg2rad(from - 90);   // 屏幕角度：0° 方位 = 正上

        /* 风的来向：从外圈指向中心 */
        var tipX = cx + Math.cos(a) * 26;
        var tipY = cy + Math.sin(a) * 26;
        var baseX = cx + Math.cos(a) * (R - 6);
        var baseY = cy + Math.sin(a) * (R - 6);

        roseCtx.beginPath();
        roseCtx.moveTo(tipX, tipY);
        roseCtx.lineTo(baseX + Math.cos(a + 2.4) * 9, baseY + Math.sin(a + 2.4) * 9);
        roseCtx.lineTo(baseX + Math.cos(a - 2.4) * 9, baseY + Math.sin(a - 2.4) * 9);
        roseCtx.closePath();
        roseCtx.fillStyle = G.wind && G.wind.gustFactor > 1.05 ? "#ffb677" : "rgba(224,199,155,0.95)";
        roseCtx.fill();

        /* 船首朝向的小三角（相对世界） */
        if (G.ship) {
            var b = G.ship.heading;
            var bx = cx + Math.sin(b) * 14;
            var by = cy - Math.cos(b) * 14;
            roseCtx.beginPath();
            roseCtx.arc(bx, by, 3.4, 0, Math.PI * 2);
            roseCtx.fillStyle = "rgba(148,196,178,0.95)";
            roseCtx.fill();
        }
    }

    /* ---------------- HUD ---------------- */

    var hud = {};
    var hudTimer = 0;

    function cacheHud() {
        hud.panel = document.getElementById("hud");
        hud.levelName = document.getElementById("hudLevel");
        hud.levelSub = document.getElementById("hudSub");
        hud.time = document.getElementById("hudTime");
        hud.dist = document.getElementById("hudDist");
        hud.speed = document.getElementById("hudSpeed");
        hud.effNum = document.getElementById("effNum");
        hud.effRing = document.getElementById("effRing");
        hud.heelFill = document.getElementById("heelFill");
        hud.heelNum = document.getElementById("heelNum");
        hud.windTxt = document.getElementById("windTxt");
        hud.crewDots = document.querySelectorAll(".crew-dot");
        hud.toast = document.getElementById("toastBar");
        hud.hint = document.getElementById("hintBar");
        hud.trim = document.getElementById("trimChip");
        hud.rivalRow = document.getElementById("rivalRow");
        hud.rivalTxt = document.getElementById("rivalTxt");
        hud.tackChip = document.getElementById("tackChip");
        hud.dbg = document.getElementById("dbgOut");
    }

    function showHud(on) {
        if (hud.panel) hud.panel.hidden = !on;
    }

    function fmtTime(t) {
        var m = Math.floor(t / 60);
        var s = Math.floor(t % 60);
        var ds = Math.floor((t * 10) % 10);
        return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s + "." + ds;
    }

    function updateLevelLabel() {
        if (!hud.levelName) return;
        var lv = G.level;
        hud.levelName.textContent = lv.id + " · " + lv.name;
        hud.levelSub.textContent = lv.sub;
        if (hud.hint) {
            hud.hint.textContent = lv.hint || "";
            hud.hint.classList.add("is-on");
        }
    }

    function refreshHud(force) {
        hudTimer -= 0.016;
        if (!force && hudTimer > 0) return;
        hudTimer = 0.08;

        var s = G.ship;
        if (!s || !G.level) return;
        var st = G.assistState || { drive: 0, appSpeed: 0 };

        if (hud.time) {
            if (G.mode === "playing" || G.mode === "countdown") {
                hud.time.textContent = fmtTime(G.elapsed);
                hud.time.classList.toggle("is-over", G.elapsed > G.level.par2);
            }
        }
        if (hud.dist) {
            hud.dist.textContent = Math.round(dist(s.x, s.y, G.level.goal.x, G.level.goal.y)) + "";
        }
        if (hud.speed) hud.speed.textContent = s.speed.toFixed(1);

        var eff = driveNorm(st);
        if (hud.effNum) hud.effNum.textContent = Math.round(eff * 100) + "%";
        if (hud.effRing) {
            hud.effRing.style.setProperty("--pct", (eff * 100).toFixed(0) + "%");
            hud.effRing.classList.toggle("is-good", eff > 0.85);
            hud.effRing.classList.toggle("is-bad", eff < 0.25);
        }
        if (hud.heelFill) {
            var hp = clamp(s.heel / 60, 0, 1);
            hud.heelFill.style.width = (hp * 100).toFixed(1) + "%";
            hud.heelFill.classList.toggle("is-warn", s.heel > T.heelWarn);
            hud.heelFill.classList.toggle("is-danger", s.heel > T.heelFlip - 6);
        }
        if (hud.heelNum) hud.heelNum.textContent = Math.round(s.heel) + "°";
        if (hud.windTxt) {
            var knots = Math.round(G.wind.speed);
            hud.windTxt.textContent = windName(G.wind.fromDeg) + " " + knots + " 节";
        }
        if (hud.crewDots && hud.crewDots.length === 5) {
            var active = Math.round((s.crew + 1) / 2 * 4);
            for (var i = 0; i < 5; i++) {
                hud.crewDots[i].classList.toggle("is-on", i === active);
            }
        }
        if (hud.trim) {
            var onTrim = G.trimTime > 2;
            hud.trim.classList.toggle("is-on", onTrim);
        }
        if (hud.tackChip) {
            var label = s.tack === 0 ? "直航" : (s.tack > 0 ? "右舷抢风" : "左舷抢风");
            hud.tackChip.textContent = label;
            hud.tackChip.classList.toggle("is-tack", s.tack !== 0);
        }
        if (hud.rivalRow && G.rival) {
            hud.rivalRow.hidden = false;
            var rd = Math.round(dist(G.rival.x, G.rival.y, G.level.goal.x, G.level.goal.y));
            hud.rivalTxt.textContent = G.rival.finished ? "已到达" : rd + "";
        } else if (hud.rivalRow) {
            hud.rivalRow.hidden = true;
        }

        if (hud.hint) {
            hud.hint.classList.toggle("is-on", G.hintTimer > 0);
        }

        /* 调试读数：?debug=1 时把关键物理量写进画面左下角 */
        if (G.debug && hud.dbg) {
            var wv = windAt(s.x, s.y);
            hud.dbg.hidden = false;
            hud.dbg.textContent =
                "航向 " + Math.round(rad2deg(s.heading)) + "°  帆角 " + Math.round(s.boom) + "°\n" +
                "AWA " + Math.round(st.awaDeg) + "°  攻角 " + Math.round(st.alpha) + "°  视风 " +
                st.appSpeed.toFixed(1) + " 节  实风 " + wv.speed.toFixed(1) + "\n" +
                "drive " + st.drive.toFixed(2) + "  eff " + Math.round(eff * 100) + "%  船速 " +
                s.speed.toFixed(1) + " 节  横倾 " + Math.round(s.heel) + "°";
        }
    }

    function windName(fromDeg) {
        var d = ((fromDeg % 360) + 360) % 360;
        var names = ["北风", "东北风", "东风", "东南风", "南风", "西南风", "西风", "西北风"];
        var idx = Math.round(d / 45) % 8;
        return names[idx];
    }

    function paintToast() {
        if (!hud.toast) return;
        hud.toast.textContent = G.toastText;
        hud.toast.classList.toggle("is-on", !!G.toastText);
    }

    function toast(text, seconds, tone) {
        G.toastText = text;
        G.toastTimer = seconds || 2;
        if (hud.toast) {
            hud.toast.className = "toast-bar is-on" + (tone ? " is-" + tone : "");
            hud.toast.textContent = text;
        }
    }

    /* ---------------- 菜单 / 结算面板 ---------------- */

    function hidePanels() {
        ["menuOv", "pauseOv", "resultOv", "cupOv"].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.hidden = true;
        });
    }

    function buildLevelGrid() {
        var grid = document.getElementById("levelGrid");
        if (!grid) return;
        grid.innerHTML = "";
        LEVELS.forEach(function (lv, i) {
            var card = document.createElement("button");
            card.type = "button";
            card.className = "level-card";
            card.dataset.level = String(i);
            card.innerHTML =
                '<span class="lv-no">' + (lv.id < 10 ? "0" + lv.id : lv.id) + '</span>' +
                '<span class="lv-name">' + lv.name + '</span>' +
                '<span class="lv-sub">' + lv.sub + '</span>' +
                '<span class="lv-stars"></span>' +
                '<span class="lv-best"></span>';
            card.addEventListener("click", function () {
                Audio.init();
                Audio.play("click");
                loadLevel(i);
            });
            grid.appendChild(card);
        });
        refreshLevelGrid();
    }

    function refreshLevelGrid() {
        var grid = document.getElementById("levelGrid");
        if (!grid) return;
        Array.prototype.forEach.call(grid.children, function (card, i) {
            var lv = LEVELS[i];
            var stars = save.stars[String(lv.id)] || 0;
            var best = save.best[String(lv.id)];
            var starEl = card.querySelector(".lv-stars");
            starEl.innerHTML = "";
            for (var k = 0; k < 3; k++) {
                var s = document.createElement("span");
                s.textContent = "★";
                s.className = k < stars ? "on" : "";
                starEl.appendChild(s);
            }
            card.querySelector(".lv-best").textContent = best ? "最佳 " + fmtTime(best) : "未通关";
        });
        var total = 0;
        LEVELS.forEach(function (lv) { total += save.stars[String(lv.id)] || 0; });
        var totalEl = document.getElementById("menuStars");
        if (totalEl) totalEl.textContent = total + " / " + (LEVELS.length * 3);
    }

    function showResult(r) {
        var ov = document.getElementById("resultOv");
        if (!ov) return;
        document.getElementById("resTitle").textContent =
            r.finishedBy === "rival" ? "晚了一步" : (r.stars === 3 ? "完美航行" : "顺利抵达");
        document.getElementById("resKicker").textContent =
            r.finishedBy === "rival" ? "RIVAL FIRST · 对手先到" : "STAGE CLEAR · 抵达终点";

        var starWrap = document.getElementById("resStars");
        starWrap.innerHTML = "";
        for (var i = 0; i < 3; i++) {
            var sp = document.createElement("span");
            sp.textContent = "★";
            sp.className = i < r.stars ? "on" : "";
            starWrap.appendChild(sp);
        }

        var lv = G.level;
        document.getElementById("resTime").textContent = fmtTime(r.time);
        document.getElementById("resPar").textContent = fmtTime(lv.par);
        document.getElementById("resPar2").textContent = fmtTime(lv.par2);
        document.getElementById("resBump").textContent = G.bumps + " 次";
        document.getElementById("resRecord").hidden = !r.isBest;
        document.getElementById("resHint").textContent =
            r.stars === 3 ? "三星到手！要不要试试关掉「最佳帆角提示」再快一点？"
                : (r.stars === 2 ? "差 " + (r.time - lv.par).toFixed(1) + " 秒就是三星。抢风切得早一点、阵风里别松太多帆。"
                    : "三星时间 " + fmtTime(lv.par) + "。多利用横风，别一直顺着风直跑。");

        var nextBtn = document.getElementById("nextBtn");
        nextBtn.textContent = G.levelIndex + 1 < LEVELS.length ? "下一关" : "查看总成绩";

        var starsOn = 0;
        LEVELS.forEach(function (l) { starsOn += save.stars[String(l.id)] || 0; });
        var allDone = LEVELS.every(function (l) { return (save.stars[String(l.id)] || 0) > 0; });
        document.getElementById("resAllDone").hidden = !allDone;

        showHud(false);
        ov.hidden = false;
        refreshLevelGrid();
    }

    function showCup() {
        G.mode = "cup";
        var total = 0;
        LEVELS.forEach(function (lv) { total += save.stars[String(lv.id)] || 0; });
        var el = document.getElementById("cupStars");
        if (el) el.textContent = total + " / " + (LEVELS.length * 3);
        var bestSum = 0;
        LEVELS.forEach(function (lv) { bestSum += save.best[String(lv.id)] || 0; });
        var bEl = document.getElementById("cupTime");
        if (bEl) bEl.textContent = fmtTime(bestSum);
        document.getElementById("resultOv").hidden = true;
        document.getElementById("cupOv").hidden = false;
        showHud(false);
    }

    function pauseGame() {
        if (G.mode !== "playing" && G.mode !== "countdown") return;
        G.manualPaused = true;
        keys.left = keys.right = keys.fwd = keys.back = false;
        document.getElementById("pauseOv").hidden = false;
        showHud(false);
    }

    function resumeGame() {
        G.manualPaused = false;
        document.getElementById("pauseOv").hidden = true;
        showHud(true);
        lastTs = performance.now();
        if (G.mode === "menu") return;
        if (G.mode === "result" || G.mode === "cup") return;
        G.mode = "playing";
    }

    /* ---------------- 输入 ---------------- */

    var lastTs = 0;
    var pointer = { down: false, x: 0, y: 0, sx: 0, sy: 0, dragging: false };

    function canvasPos(ev) {
        var rect = canvas.getBoundingClientRect();
        return {
            x: (ev.clientX - rect.left) / rect.width * W,
            y: (ev.clientY - rect.top) / rect.height * H
        };
    }

    /* 鼠标/触屏拖拽：帆杆指向指针，直接改目标帆角 */
    function setBoomFromPointer(p) {
        if (!G.ship) return;
        var sx = G.ship.x - G.cam.x;
        var sy = G.ship.y - G.cam.y;
        var dx = p.x - sx, dy = p.y - sy;
        if (Math.sqrt(dx * dx + dy * dy) < 12) return;

        var screenAng = Math.atan2(dy, dx);
        var hullAng = G.ship.heading - Math.PI / 2;
        var rel = normRad(screenAng - hullAng);
        /* 帆杆从桅杆向船尾摆：指针在船尾正后方 = 帆在中线，指针偏右舷 = 帆摆向右舷 */
        var deg = normDeg(180 - rad2deg(rel));
        if (deg > 0 && deg > T.sailMax) deg = T.sailMax;
        if (deg < 0 && deg < -T.sailMax) deg = -T.sailMax;
        G.ship.boomTarget = deg;
    }

    function bindEvents() {
        window.addEventListener("keydown", function (e) {
            var k = e.key;
            if (k === "ArrowLeft" || k === "a" || k === "A") {
                keys.left = true;
                if (G.mode === "playing") {
                    e.preventDefault();
                    /* 点一下也有 4° 的最小步进，不用一直按住 */
                    if (!e.repeat && G.ship) {
                        G.ship.boomTarget = clamp(G.ship.boomTarget - 4, -T.sailMax, T.sailMax);
                    }
                }
            } else if (k === "ArrowRight" || k === "d" || k === "D") {
                keys.right = true;
                if (G.mode === "playing") {
                    e.preventDefault();
                    if (!e.repeat && G.ship) {
                        G.ship.boomTarget = clamp(G.ship.boomTarget + 4, -T.sailMax, T.sailMax);
                    }
                }
            } else if (k === "ArrowUp" || k === "w" || k === "W") {
                keys.fwd = true;
                if (G.mode === "playing") {
                    e.preventDefault();
                    if (!e.repeat && G.ship) G.ship.crew = clamp(G.ship.crew + 0.1, -1, 1);
                }
            } else if (k === "ArrowDown" || k === "s" || k === "S") {
                keys.back = true;
                if (G.mode === "playing") {
                    e.preventDefault();
                    if (!e.repeat && G.ship) G.ship.crew = clamp(G.ship.crew - 0.1, -1, 1);
                }
            } else if (k === "t" || k === "T") {
                if (G.mode === "playing") { e.preventDefault(); pressTack(); }
            } else if (k === "p" || k === "P" || k === "Escape") {
                if (G.mode === "playing" || G.mode === "countdown") {
                    e.preventDefault();
                    if (G.manualPaused) resumeGame(); else pauseGame();
                }
            } else if (k === "m" || k === "M") {
                toggleMute();
            } else if (k === "Enter") {
                if (G.mode === "result") nextLevelOrCup();
                else if (G.mode === "cup") { document.getElementById("cupOv").hidden = true; toMenu(); }
            }
        });

        window.addEventListener("keyup", function (e) {
            var k = e.key;
            if (k === "ArrowLeft" || k === "a" || k === "A") keys.left = false;
            else if (k === "ArrowRight" || k === "d" || k === "D") keys.right = false;
            else if (k === "ArrowUp" || k === "w" || k === "W") keys.fwd = false;
            else if (k === "ArrowDown" || k === "s" || k === "S") keys.back = false;
        });

        canvas.addEventListener("pointerdown", function (e) {
            if (G.mode !== "playing" || isFrozen()) return;
            if (e.cancelable) e.preventDefault();
            canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
            var p0 = canvasPos(e);
            pointer.down = true;
            pointer.dragging = false;
            pointer.sx = p0.x;
            pointer.sy = p0.y;
        });

        canvas.addEventListener("pointermove", function (e) {
            if (!pointer.down || G.mode !== "playing" || isFrozen()) return;
            if (e.cancelable) e.preventDefault();
            var p = canvasPos(e);
            /* 先要走够 10px 才开始接管帆角，否则随手点一下画面就会把帆甩走 */
            if (!pointer.dragging) {
                if (Math.abs(p.x - pointer.sx) + Math.abs(p.y - pointer.sy) < 10) return;
                pointer.dragging = true;
            }
            setBoomFromPointer(p);
        });

        canvas.addEventListener("pointerup", function () { pointer.down = false; pointer.dragging = false; });
        canvas.addEventListener("pointercancel", function () { pointer.down = false; pointer.dragging = false; });

        var tb = document.getElementById("tackBtn");
        if (tb) {
            tb.addEventListener("click", function () {
                Audio.init();
                pressTack();
            });
        }

        bindHoldButton("crewFwd", function () { keys.fwd = true; }, function () { keys.fwd = false; });
        bindHoldButton("crewAft", function () { keys.back = true; }, function () { keys.back = false; });

        window.addEventListener("blur", function () {
            keys.left = keys.right = keys.fwd = keys.back = false;
            pointer.down = false;
            if (G.mode === "playing" && !isFrozen() && !(gate && gate.locked)) pauseGame();
        });

        document.addEventListener("visibilitychange", function () {
            if (document.hidden && G.mode === "playing" && !isFrozen()) pauseGame();
        });

        document.addEventListener("playclock:breakstart", function () {
            G.breakPaused = true;
            keys.left = keys.right = keys.fwd = keys.back = false;
        });
        document.addEventListener("playclock:breakend", function () {
            G.breakPaused = false;
            lastTs = performance.now();
        });

        window.addEventListener("resize", setupCanvas);

        /* 按钮 */
        document.getElementById("resumeBtn").addEventListener("click", resumeGame);
        document.getElementById("pauseRestartBtn").addEventListener("click", function () {
            document.getElementById("pauseOv").hidden = true;
            G.manualPaused = false;
            loadLevel(G.levelIndex);
        });
        document.getElementById("pauseMenuBtn").addEventListener("click", function () {
            document.getElementById("pauseOv").hidden = true;
            G.manualPaused = false;
            toMenu();
        });
        document.getElementById("nextBtn").addEventListener("click", nextLevelOrCup);
        document.getElementById("retryBtn").addEventListener("click", function () { loadLevel(G.levelIndex); });
        document.getElementById("resultMenuBtn").addEventListener("click", toMenu);
        document.getElementById("cupAgainBtn").addEventListener("click", function () { loadLevel(0); });
        document.getElementById("cupMenuBtn").addEventListener("click", toMenu);
        document.getElementById("allDoneBtn").addEventListener("click", showCup);

        document.getElementById("menuStart").addEventListener("click", function () {
            Audio.init();
            Audio.play("click");
            var next = firstUnfinished();
            loadLevel(next);
        });

        /* 开关 */
        var sfxBtn = document.getElementById("sfxBtn");
        var musicBtn = document.getElementById("musicBtn");
        var assistBtn = document.getElementById("assistBtn");
        var pauseBtn = document.getElementById("pauseBtn");

        sfxBtn.addEventListener("click", function () { Audio.init(); toggleSfx(); });
        musicBtn.addEventListener("click", function () { Audio.init(); toggleMusic(); });
        assistBtn.addEventListener("click", function () {
            save.assist = save.assist ? 0 : 1;
            writeSave();
            refreshToggles();
            Audio.play("click");
        });
        pauseBtn.addEventListener("click", function () {
            if (G.manualPaused) resumeGame(); else pauseGame();
        });

        refreshToggles();
    }

    function bindHoldButton(id, onDown, onUp) {
        var el = document.getElementById(id);
        if (!el) return;
        var stop = function (e) {
            e.preventDefault();
            onUp();
        };
        el.addEventListener("pointerdown", function (e) {
            e.preventDefault();
            Audio.init();
            onDown();
        });
        el.addEventListener("pointerup", stop);
        el.addEventListener("pointerleave", stop);
        el.addEventListener("pointercancel", stop);
    }

    function toggleMute() {
        Audio.init();
        toggleSfx();
    }

    function toggleSfx() {
        Audio.setSfx(Audio.muted);
        saveFlag(MUTE_KEY, !Audio.muted);
        refreshToggles();
    }

    function toggleMusic() {
        Audio.setMusic(!Audio.musicOn);
        saveFlag(MUSIC_KEY, Audio.musicOn);
        refreshToggles();
    }

    function refreshToggles() {
        var sfxBtn = document.getElementById("sfxBtn");
        var musicBtn = document.getElementById("musicBtn");
        var assistBtn = document.getElementById("assistBtn");
        if (sfxBtn) {
            sfxBtn.textContent = Audio.muted ? "🔇" : "🔊";
            sfxBtn.classList.toggle("is-off", Audio.muted);
        }
        if (musicBtn) {
            musicBtn.textContent = Audio.musicOn ? "♪" : "♪̶";
            musicBtn.classList.toggle("is-off", !Audio.musicOn);
        }
        if (assistBtn) {
            assistBtn.classList.toggle("is-off", !save.assist);
            assistBtn.textContent = save.assist ? "提示开" : "提示关";
        }
    }

    /* ---------------- 菜单 / 结算流转 ---------------- */

    function firstUnfinished() {
        for (var i = 0; i < LEVELS.length; i++) {
            if (!(save.stars[String(LEVELS[i].id)] > 0)) return i;
        }
        return 0;
    }

    function nextLevelOrCup() {
        document.getElementById("resultOv").hidden = true;
        if (G.levelIndex + 1 < LEVELS.length) {
            loadLevel(G.levelIndex + 1);
        } else {
            showCup();
        }
    }

    function toMenu() {
        hidePanels();
        G.mode = "menu";
        G.ship = null;
        G.rival = null;
        G.particles.length = 0;
        /* 菜单背后用第一关的海图当背景，不摆船 */
        G.level = LEVELS[0];
        G.wind = createWindState({ from: 270, speed: 13 });
        G.cam.x = clamp(LEVELS[0].start.x - W / 2, 0, LEVELS[0].world.w - W);
        G.cam.y = clamp(LEVELS[0].start.y - H / 2, 0, LEVELS[0].world.h - H);
        G.shake = 0;
        showHud(false);
        var menu = document.getElementById("menuOv");
        if (menu) menu.hidden = false;
        refreshLevelGrid();
        refreshToggles();
    }

    /* ---------------- 主循环 ---------------- */

    function frame(ts) {
        var dt = (ts - lastTs) / 1000;
        if (!(dt > 0)) dt = 0.016;
        if (dt > 0.05) dt = 0.05;
        lastTs = ts;
        G.clock += dt;
        G.dt = dt;

        if (G.mode === "countdown" && !isFrozen()) {
            G.countdown -= dt;
            var n = G.countdown > 0.2 ? Math.ceil(G.countdown - 0.2) : 0;
            if (n !== G.countdownN) {
                G.countdownN = n;
                Audio.play(n === 0 ? "go" : "count");
            }
            if (G.countdown <= 0) {
                G.mode = "playing";
                lastTs = ts;
            }
        } else if (G.mode === "playing" && !isFrozen()) {
            update(dt);
            if (gate) gate.tick(dt);
        }

        if (G.mode === "playing" || G.mode === "countdown") {
            Audio.setEnvironment(
                G.wind ? G.wind.speed : 0,
                G.ship ? G.ship.speed : 0,
                G.mode === "playing" && !isFrozen()
            );
        } else {
            Audio.setEnvironment(12, 0, false);
        }

        render();
        G.roseTick -= dt;
        if (G.roseTick <= 0) {
            G.roseTick = 0.16;
            drawRose();
        }

        requestAnimationFrame(frame);
    }

    /* ---------------- 门禁 ---------------- */

    var gate = null;

    function ensureGate() {
        if (!window.Gate || gate) return;
        gate = window.Gate.create({
            everyMinutes: 5,
            challenges: ["quick-math", "poem"],
            showBadge: true,
            badgePosition: "bottom-left",
            kicker: "局间门禁 · 碧海扬帆",
            title: "先过一道关卡",
            note: "已经航行了 5 分钟，答完这道题才能回到船上。",
            onLock: function () {
                G.gatePaused = true;
                keys.left = keys.right = keys.fwd = keys.back = false;
                pointer.down = false;
            },
            onUnlock: function () {
                G.gatePaused = false;
                lastTs = performance.now();
            }
        });
    }

    /* ---------------- 启动 ---------------- */

    function setupCanvas() {
        DPR = Math.min(T.maxDpr, window.devicePixelRatio || 1);
        canvas.width = Math.round(W * DPR);
        canvas.height = Math.round(H * DPR);
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        ctx.imageSmoothingEnabled = true;
        drawRose();
    }

    function boot() {
        canvas = document.getElementById("game");
        if (!canvas) return;
        ctx = canvas.getContext("2d");
        roseCanvas = document.getElementById("rose");
        if (roseCanvas) roseCtx = roseCanvas.getContext("2d");

        setupCanvas();
        loadSave();
        buildSea();
        cacheHud();
        buildLevelGrid();
        ensureGate();
        bindEvents();

        Audio.muted = !loadFlag(MUTE_KEY, true);
        Audio.musicOn = loadFlag(MUSIC_KEY, true);
        if (Audio.muted) Audio.setSfx(false);
        if (!Audio.musicOn) Audio.setMusic(false);

        G.wind = createWindState({ from: 270, speed: 13 });
        toMenu();

        lastTs = performance.now();
        requestAnimationFrame(frame);

        /* 调试：?level=3 直接开某关，?autostart=1 开第一关，?debug=1 显示物理读数 */
        var m = /[?&]level=(\d+)/.exec(location.search);
        var auto = /[?&]autostart=1/.test(location.search);
        G.debug = /[?&]debug=1/.test(location.search);
        if (hud.dbg && !G.debug) hud.dbg.hidden = true;
        if (m) {
            var idx = clamp(Number(m[1]) - 1, 0, LEVELS.length - 1);
            loadLevel(idx);
        } else if (auto) {
            loadLevel(0);
        }

        /* 控制台自检：打开页面可执行 SAIL.checkLevels() */
        window.SAIL.checkLevels = function () {
            var p = SAIL.validateLevels();
            if (!p.length) console.log("%c关卡数据全部通过", "color:#7fd6a0");
            else p.forEach(function (s) { console.warn(s); });
            return p;
        };

        /* 首次交互解锁音频 */
        var unlockAudio = function () {
            Audio.init();
            window.removeEventListener("pointerdown", unlockAudio);
            window.removeEventListener("keydown", unlockAudio);
        };
        window.addEventListener("pointerdown", unlockAudio);
        window.addEventListener("keydown", unlockAudio);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
    } else {
        boot();
    }

})(window);
