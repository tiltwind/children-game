/* ============================================================
 * playclock.js —— 全站游戏计时与强制休息
 *
 * 规则：累计玩满 30 分钟，强制休息 10 分钟；休息结束后重新计时。
 * 状态存在 localStorage，所有游戏页面共享。
 *
 * 对外：
 *   window.PlayClock.status()       当前状态
 *   playclock:breakstart            休息开始（游戏应自行暂停）
 *   playclock:breakend              休息结束
 *
 * 页面接入：<script src="../playclock/playclock.js"></script>
 * 首页不累计游戏时间：data-count="off"
 * ============================================================ */

(function () {
    "use strict";

    var KEY = "shutu.playclock.v1";
    var PLAY_MS = 30 * 60 * 1000;
    var BREAK_MS = 10 * 60 * 1000;
    var TICK_MS = 500;

    var script = document.currentScript;
    var countEnabled = !(script && script.getAttribute("data-count") === "off");

    var state = null;
    var breakOn = false;
    var lastTick = Date.now();
    var lastSave = 0;
    var warned = false;
    var ui = {};

    /* ---------------- 存档 ---------------- */

    function pad(n) {
        return (n < 10 ? "0" : "") + n;
    }

    function today() {
        var d = new Date();
        return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
    }

    function blank() {
        return { v: 1, day: today(), playedMs: 0, breakUntil: 0 };
    }

    function readState() {
        try {
            var raw = localStorage.getItem(KEY);
            if (!raw) return blank();
            var parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== "object") return blank();
            var s = {
                v: 1,
                day: String(parsed.day || today()),
                playedMs: Math.max(0, Number(parsed.playedMs) || 0),
                breakUntil: Math.max(0, Number(parsed.breakUntil) || 0)
            };
            // 跨天重新累计，但保留正在进行的休息
            if (s.day !== today()) {
                s.day = today();
                s.playedMs = 0;
            }
            if (s.playedMs > PLAY_MS) s.playedMs = PLAY_MS;
            return s;
        } catch (e) {
            return blank();
        }
    }

    function saveState(force) {
        var now = Date.now();
        if (!force && now - lastSave < 2000) return;
        lastSave = now;
        try {
            localStorage.setItem(KEY, JSON.stringify(state));
        } catch (e) {
            /* 忽略存储失败 */
        }
    }

    /* ---------------- UI ---------------- */

    function buildUI() {
        if (ui.badge || !document.body) return;

        var badge = document.createElement("div");
        badge.className = "pc-badge";
        badge.setAttribute("role", "status");
        badge.innerHTML =
            '<span class="pc-icon" aria-hidden="true">⏳</span>' +
            '<span class="pc-copy">' +
            '<span class="pc-label">还能玩</span>' +
            '<b class="pc-time">30:00</b>' +
            "</span>" +
            '<span class="pc-bar" aria-hidden="true"><i></i></span>';
        document.body.appendChild(badge);
        if (!countEnabled) badge.hidden = true;

        var overlay = document.createElement("div");
        overlay.className = "pc-break";
        overlay.hidden = true;
        overlay.innerHTML =
            '<div class="pc-break-card" role="dialog" aria-modal="true" aria-labelledby="pcBreakTitle">' +
            '<div class="pc-moon" aria-hidden="true">🌙</div>' +
            '<p class="pc-kicker">PLAY CLOCK · 休息时间</p>' +
            '<h2 class="pc-break-title" id="pcBreakTitle">先玩到这里啦</h2>' +
            '<p class="pc-break-note">已经玩满 30 分钟。休息 10 分钟，所有游戏都会等你。</p>' +
            '<div class="pc-count" aria-live="off">10:00</div>' +
            '<div class="pc-track" aria-hidden="true"><i></i></div>' +
            '<p class="pc-break-tip">🐻 豆豆说：看看远处、喝口水、伸个懒腰。</p>' +
            "</div>";
        document.body.appendChild(overlay);

        var toast = document.createElement("div");
        toast.className = "pc-toast";
        toast.hidden = true;
        toast.innerHTML = "☀️ 休息结束，继续玩吧！";
        document.body.appendChild(toast);

        ui.badge = badge;
        ui.icon = badge.querySelector(".pc-icon");
        ui.label = badge.querySelector(".pc-label");
        ui.time = badge.querySelector(".pc-time");
        ui.fill = badge.querySelector(".pc-bar i");
        ui.overlay = overlay;
        ui.count = overlay.querySelector(".pc-count");
        ui.track = overlay.querySelector(".pc-track i");
        ui.toast = toast;
    }

    function fmtClock(ms) {
        var sec = Math.max(0, Math.ceil(ms / 1000));
        var m = Math.floor(sec / 60);
        var s = sec % 60;
        return m + ":" + (s < 10 ? "0" : "") + s;
    }

    function renderBadge(now) {
        if (!ui.badge) return;
        now = now || Date.now();

        if (breakOn && state.breakUntil > now) {
            var left = state.breakUntil - now;
            ui.badge.classList.add("is-break");
            ui.icon.textContent = "🌙";
            ui.label.textContent = "休息";
            ui.time.textContent = fmtClock(left);
            ui.fill.style.width = Math.max(0, (left / BREAK_MS) * 100) + "%";
            return;
        }

        var remain = Math.max(0, PLAY_MS - state.playedMs);
        ui.badge.classList.remove("is-break");
        ui.badge.classList.toggle("is-warn", remain <= 5 * 60 * 1000);
        ui.badge.classList.toggle("is-hurry", remain <= 60 * 1000);
        ui.icon.textContent = "⏳";
        ui.label.textContent = "还能玩";
        ui.time.textContent = fmtClock(remain);
        ui.fill.style.width = Math.max(0, (remain / PLAY_MS) * 100) + "%";
    }

    function dispatch(name, detail) {
        try {
            document.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
        } catch (e) {
            /* 旧浏览器忽略 */
        }
    }

    function showBreakUI(now) {
        if (breakOn) return;
        breakOn = true;
        buildUI();
        ui.overlay.hidden = false;
        document.body.classList.add("pc-breaking");
        renderBadge(now);
        dispatch("playclock:breakstart", {
            breakUntil: state.breakUntil,
            totalMs: BREAK_MS
        });
    }

    function hideBreakUI(now) {
        if (!breakOn) return;
        breakOn = false;
        if (ui.overlay) ui.overlay.hidden = true;
        document.body.classList.remove("pc-breaking");
        dispatch("playclock:breakend", {});
        showToast();
        renderBadge(now);
    }

    function showToast() {
        if (!ui.toast) return;
        ui.toast.hidden = false;
        ui.toast.classList.remove("is-show");
        /* 强制重排以便重播动画 */
        void ui.toast.offsetWidth;
        ui.toast.classList.add("is-show");
        setTimeout(function () {
            ui.toast.classList.remove("is-show");
            setTimeout(function () {
                ui.toast.hidden = true;
            }, 260);
        }, 3200);
    }

    function updateBreakUI(now) {
        if (!ui.overlay) return;
        var left = Math.max(0, state.breakUntil - now);
        ui.count.textContent = fmtClock(left);
        ui.track.style.width = Math.max(0, (left / BREAK_MS) * 100) + "%";
    }

    /* ---------------- 计时 ---------------- */

    function startBreak(now) {
        state.breakUntil = now + BREAK_MS;
        state.playedMs = 0;
        saveState(true);
        warned = false;
        showBreakUI(now);
    }

    function endBreak(now) {
        state.breakUntil = 0;
        state.playedMs = 0;
        saveState(true);
        hideBreakUI(now);
    }

    function tick() {
        var now = Date.now();
        var dt = now - lastTick;
        lastTick = now;
        if (!isFinite(dt) || dt < 0) dt = 0;
        if (dt > 2000) dt = 2000;

        if (state.day !== today() && state.breakUntil <= now) {
            state.day = today();
            state.playedMs = 0;
            warned = false;
            saveState(true);
        }

        if (state.breakUntil > now) {
            showBreakUI(now);
            updateBreakUI(now);
            renderBadge(now);
            saveState();
            return;
        }

        if (breakOn) endBreak(now);

        if (countEnabled && !document.hidden && document.hasFocus() && dt > 0) {
            state.playedMs += dt;

            if (!warned && state.playedMs >= PLAY_MS - 2 * 60 * 1000) {
                warned = true;
            }

            if (state.playedMs >= PLAY_MS) {
                startBreak(now);
                return;
            }
            saveState();
        }

        renderBadge(now);
    }

    /* ---------------- 输入封锁 ---------------- */

    var BLOCKED = [
        "keydown", "keyup", "keypress",
        "mousedown", "mouseup", "click", "dblclick",
        "pointerdown", "pointerup", "pointermove", "mousemove",
        "touchstart", "touchend", "touchmove",
        "wheel", "contextmenu", "dragstart"
    ];

    function blockInput(e) {
        if (!breakOn) return;
        e.stopImmediatePropagation();
        e.preventDefault();
    }

    BLOCKED.forEach(function (type) {
        document.addEventListener(type, blockInput, true);
    });

    /* ---------------- 多标签同步 ---------------- */

    window.addEventListener("storage", function (e) {
        if (e.key !== KEY) return;
        state = readState();
        lastTick = Date.now();
        if (state.breakUntil > Date.now()) showBreakUI(Date.now());
        else if (breakOn) endBreak(Date.now());
        renderBadge();
    });

    document.addEventListener("visibilitychange", function () {
        lastTick = Date.now();
        if (!document.hidden) tick();
    });

    window.addEventListener("pageshow", function () {
        state = readState();
        lastTick = Date.now();
        tick();
    });

    window.addEventListener("beforeunload", function () {
        saveState(true);
    });

    /* ---------------- 启动 ---------------- */

    function init() {
        state = readState();
        if (state.breakUntil && state.breakUntil <= Date.now()) {
            state.breakUntil = 0;
            saveState(true);
        }
        buildUI();
        lastTick = Date.now();
        tick();
        setInterval(tick, TICK_MS);
    }

    window.PlayClock = {
        status: function () {
            return {
                playedMs: state ? state.playedMs : 0,
                breakRemainingMs: state ? Math.max(0, state.breakUntil - Date.now()) : 0,
                breaking: !!breakOn,
                playLimitMs: PLAY_MS,
                breakMs: BREAK_MS
            };
        }
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
