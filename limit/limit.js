/* ============================================================
 * limit.js —— 单游戏局数上限与冷却
 *
 * 规则：每个游戏累计完整玩满 5 次（5 关 / 5 局），该游戏锁定 15 分钟，
 * 期间只能去玩别的游戏；回到首页可以看到倒计时。
 *
 * 状态存在 localStorage，所有页面共享。
 *
 * 对外：
 *   GameLimit.count(id)     记一次完整游戏（省略 id 用当前页游戏）
 *   GameLimit.status(id)    查询某个游戏的状态
 *   GameLimit.all()         查询全部游戏状态
 *
 * 页面接入：
 *   首页： <script src="limit/limit.js" data-game="index"></script>
 *   游戏： <script src="../limit/limit.js" data-game="tetris"></script>
 * ============================================================ */
(function (global) {
    "use strict";

    var LIMIT = 5;
    var LOCK_MS = 15 * 60 * 1000;
    var KEY = "shutu.limit.v1";

    var GAMES = {
        tetris: { name: "俄罗斯方块" },
        "gun-game": { name: "枪战游戏" },
        typing: { name: "键盘探险" },
        pvz: { name: "草坪守卫战" },
        "twenty-four": { name: "24 点" },
        poem: { name: "唐诗小状元" },
        plane: { name: "穿云战机" },
        racing: { name: "霓虹狂飙" },
        "zombie-defense": { name: "钢铁防线" },
        english: { name: "英语小勇士" },
        "1024": { name: "1024 陶片牌局" },
        sailing: { name: "碧海扬帆" }
    };

    var script = document.currentScript;
    var currentId = (script && script.getAttribute("data-game")) || "";
    var isIndex = currentId === "index";
    var scriptSrc = (script && script.getAttribute("src")) || "";
    var homeHref = /^\.\.\//.test(scriptSrc) ? "../index.html" : "index.html";

    var badgeEl = null;
    var lockScreen = null;
    var modal = null;
    var modalId = "";

    /* ---------------- 存档 ---------------- */

    function now() {
        return Date.now();
    }

    function normalize(entry) {
        var plays = Math.floor(Number(entry && entry.plays) || 0);
        var lockUntil = Math.floor(Number(entry && entry.lockUntil) || 0);
        if (plays < 0) plays = 0;
        if (plays > LIMIT) plays = LIMIT;
        if (lockUntil < 0) lockUntil = 0;
        return { plays: plays, lockUntil: lockUntil };
    }

    function readAll() {
        var games = {};
        try {
            var raw = localStorage.getItem(KEY);
            var parsed = raw ? JSON.parse(raw) : null;
            if (parsed && parsed.games && typeof parsed.games === "object") {
                Object.keys(parsed.games).forEach(function (id) {
                    if (GAMES[id]) games[id] = normalize(parsed.games[id]);
                });
            }
        } catch (e) {
            games = {};
        }
        return games;
    }

    function readEntry(id) {
        var entry = normalize(readAll()[id] || { plays: 0, lockUntil: 0 });
        /* 冷却结束：自动清零，重新计算 5 次 */
        if (entry.lockUntil && entry.lockUntil <= now()) {
            entry.plays = 0;
            entry.lockUntil = 0;
        }
        return entry;
    }

    function writeEntry(id, entry) {
        var games = readAll();
        games[id] = normalize(entry);
        try {
            localStorage.setItem(KEY, JSON.stringify({ v: 1, games: games }));
        } catch (e) {
            /* 存储失败时静默 */
        }
    }

    /* ---------------- 对外查询 ---------------- */

    function status(id) {
        id = id || currentId;
        var info = GAMES[id];
        var entry = readEntry(id);
        var remainMs = Math.max(0, entry.lockUntil - now());
        return {
            id: id,
            name: info ? info.name : id,
            plays: entry.plays,
            limit: LIMIT,
            remaining: Math.max(0, LIMIT - entry.plays),
            locked: remainMs > 0,
            lockUntil: entry.lockUntil,
            remainMs: remainMs
        };
    }

    function all() {
        var list = [];
        Object.keys(GAMES).forEach(function (id) {
            list.push(status(id));
        });
        return list;
    }

    /* ---------------- 计数 ---------------- */

    function count(id) {
        id = id || currentId;
        if (!GAMES[id]) return null;

        var entry = readEntry(id);
        if (entry.lockUntil > now()) {
            refresh();
            return status(id);
        }

        entry.plays += 1;
        if (entry.plays >= LIMIT) {
            entry.plays = LIMIT;
            entry.lockUntil = now() + LOCK_MS;
        }
        writeEntry(id, entry);
        refresh();

        var st = status(id);
        if (st.locked && id === currentId) showSwitchPrompt(id);
        return st;
    }

    /* ---------------- 小工具 ---------------- */

    function fmtClock(ms) {
        var sec = Math.max(0, Math.ceil(ms / 1000));
        var m = Math.floor(sec / 60);
        var s = sec % 60;
        return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
    }

    function make(tag, className, text) {
        var el = document.createElement(tag);
        if (className) el.className = className;
        if (text != null) el.textContent = text;
        return el;
    }

    /* ---------------- 首页：卡片状态 ---------------- */

    function buildIndex() {
        var cards = document.querySelectorAll(".card[data-game]");
        Array.prototype.forEach.call(cards, function (card) {
            var id = card.getAttribute("data-game");
            if (!GAMES[id]) return;

            var cover = card.querySelector(".card-cover");
            if (!cover) return;

            var chip = make("span", "limit-chip");
            cover.appendChild(chip);
            card.__limitChip = chip;

            var lock = make("div", "limit-lock");
            lock.innerHTML = "🔒<span>休息中</span>";
            cover.appendChild(lock);

            card.addEventListener("click", function (ev) {
                if (status(id).locked) {
                    ev.preventDefault();
                    openModal(id);
                }
            });
        });
    }

    function refreshIndex() {
        var cards = document.querySelectorAll(".card[data-game]");
        Array.prototype.forEach.call(cards, function (card) {
            var id = card.getAttribute("data-game");
            if (!GAMES[id] || !card.__limitChip) return;
            var st = status(id);
            card.classList.toggle("is-locked", st.locked);
            card.__limitChip.classList.toggle("is-locked", st.locked);
            card.__limitChip.textContent = st.locked
                ? "休息 " + fmtClock(st.remainMs)
                : "剩 " + st.remaining + " 次";
            card.setAttribute(
                "aria-label",
                (st.name || "游戏") +
                    (st.locked
                        ? "，休息中，还剩 " + fmtClock(st.remainMs)
                        : "，还可以玩 " + st.remaining + " 次")
            );
        });
    }

    /* ---------------- 游戏页：剩余次数徽标 ---------------- */

    function buildBadge() {
        if (isIndex || !GAMES[currentId] || badgeEl) return;
        badgeEl = make("div", "limit-badge");
        badgeEl.setAttribute("role", "status");
        badgeEl.innerHTML =
            '<span class="limit-badge-icon" aria-hidden="true">🎯</span>' +
            '<span class="limit-badge-text"></span>';
        document.body.appendChild(badgeEl);
        badgeEl.__text = badgeEl.querySelector(".limit-badge-text");
    }

    function refreshBadge() {
        if (!badgeEl) return;
        var st = status();
        badgeEl.classList.toggle("is-locked", st.locked);
        badgeEl.__text.textContent = st.locked
            ? "本游戏休息中 " + fmtClock(st.remainMs)
            : "本游戏还能玩 " + st.remaining + " 次";
    }

    /* ---------------- 游戏页：锁定拦截 ---------------- */

    function buildLockScreen() {
        var st = status();
        if (!st.locked || lockScreen) return;
        lockScreen = make("div", "limit-screen");
        lockScreen.innerHTML =
            '<div class="limit-panel" role="dialog" aria-modal="true">' +
            '  <div class="limit-icon" aria-hidden="true">🔒</div>' +
            '  <p class="limit-kicker">GAME REST · 游戏休息</p>' +
            '  <h2 class="limit-title">「' + st.name + "」先休息一下</h2>" +
            '  <p class="limit-text">这个游戏已经完整玩了 5 次，要休息 15 分钟才能再玩。先去别的游戏玩一会儿，玩完回到首页再来。</p>' +
            '  <div class="limit-count"></div>' +
            '  <p class="limit-tip">休息结束后，这里会自动恢复。</p>' +
            '  <div class="limit-actions">' +
            '    <a class="limit-btn is-primary" href="' + homeHref + '">回首页挑别的游戏</a>' +
            "  </div>" +
            "</div>";
        document.body.appendChild(lockScreen);
        lockScreen.__count = lockScreen.querySelector(".limit-count");
        refreshLockScreen();
    }

    function refreshLockScreen() {
        if (!lockScreen) return;
        var st = status();
        if (!st.locked) {
            lockScreen.remove();
            lockScreen = null;
            return;
        }
        lockScreen.__count.textContent = fmtClock(st.remainMs);
    }

    /* ---------------- 弹层：刚刚玩满 5 次 ---------------- */

    function buildModal() {
        if (modal) return modal;
        modal = make("div", "limit-modal");
        modal.hidden = true;
        var actions = isIndex
            ? '    <button type="button" class="limit-btn is-primary" data-act="stay">去玩别的游戏</button>'
            : '    <a class="limit-btn is-primary" href="' + homeHref + '">回首页挑别的游戏</a>' +
              '    <button type="button" class="limit-btn" data-act="stay">留在这里</button>';
        modal.innerHTML =
            '<div class="limit-panel" role="dialog" aria-modal="true">' +
            '  <div class="limit-icon" aria-hidden="true">🔒</div>' +
            '  <p class="limit-kicker">GAME REST · 游戏休息</p>' +
            '  <h2 class="limit-title"></h2>' +
            '  <p class="limit-text"></p>' +
            '  <div class="limit-count"></div>' +
            '  <p class="limit-tip">先去玩玩别的游戏，过一会儿回到首页，就能看到它恢复。</p>' +
            '  <div class="limit-actions">' +
            actions +
            "  </div>" +
            "</div>";
        document.body.appendChild(modal);
        modal.querySelector("[data-act=stay]").addEventListener("click", closeModal);
        modal.addEventListener("click", function (ev) {
            if (ev.target === modal) closeModal();
        });
        modal.__title = modal.querySelector(".limit-title");
        modal.__text = modal.querySelector(".limit-text");
        modal.__count = modal.querySelector(".limit-count");
        return modal;
    }

    function openModal(id, canStay) {
        var m = buildModal();
        var st = status(id);
        modalId = id;
        var stayBtn = m.querySelector("[data-act=stay]");
        if (stayBtn) stayBtn.hidden = canStay === false;
        m.__title.textContent = "「" + st.name + "」正在休息";
        m.__text.textContent =
            "这个游戏已经完整玩了 5 次，要休息 15 分钟。趁这会儿去玩玩别的游戏，玩完回到首页，再来这里看倒计时。";
        m.__count.textContent = fmtClock(st.remainMs);
        m.hidden = false;
    }

    function closeModal() {
        if (modal) modal.hidden = true;
        modalId = "";
    }

    function refreshModal() {
        if (!modal || modal.hidden || !modalId) return;
        var st = status(modalId);
        if (!st.locked) {
            closeModal();
            return;
        }
        modal.__count.textContent = fmtClock(st.remainMs);
    }

    /* 玩满 5 次时，在游戏页提示换游戏 */
    function showSwitchPrompt(id) {
        if (isIndex) return;
        var st = status(id);
        if (!st.locked) return;
        setTimeout(function () {
            openModal(id, false);
        }, 700);
    }

    /* ---------------- 刷新 ---------------- */

    function refresh() {
        if (isIndex) {
            refreshIndex();
        } else {
            refreshBadge();
            refreshLockScreen();
        }
        refreshModal();
    }

    /* ---------------- 初始化 ---------------- */

    function init() {
        if (isIndex) {
            buildIndex();
        } else {
            buildBadge();
            buildLockScreen();
        }
        refresh();
        setInterval(refresh, 1000);
    }

    window.addEventListener("storage", function (e) {
        if (e.key !== KEY) return;
        refresh();
    });

    window.addEventListener("pageshow", refresh);

    global.GameLimit = {
        count: count,
        status: status,
        all: all,
        limit: LIMIT,
        lockMs: LOCK_MS,
        currentGame: currentId
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})(typeof window !== "undefined" ? window : globalThis);
