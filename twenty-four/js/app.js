/* ============================================================
 * app.js —— 24 点独立页面的交互
 * 负责：模式切换、计时、战绩存档、提示次数、算式输入、下一题
 * ============================================================ */
(function () {
    "use strict";

    var STORE_KEY = "tf24.stats.v1";
    var MODE_KEY = "tf24.mode.v1";
    var MUSIC_KEY = "tf24.music.v1";

    var els = {
        modeBar: document.getElementById("modeBar"),
        puzzleMeta: document.getElementById("puzzleMeta"),
        timer: document.getElementById("timer"),
        board: document.getElementById("board"),
        result: document.getElementById("result"),
        resultExpr: document.getElementById("resultExpr"),
        resultTime: document.getElementById("resultTime"),
        resultDifficulty: document.getElementById("resultDifficulty"),
        rewardTitle: document.getElementById("rewardTitle"),
        rewardStars: document.getElementById("rewardStars"),
        rewardStreak: document.getElementById("rewardStreak"),
        confetti: document.getElementById("confetti"),
        nextBtn: document.getElementById("nextBtn"),
        actions: document.getElementById("actions"),
        hintBtn: document.getElementById("hintBtn"),
        hintLeft: document.getElementById("hintLeft"),
        typeForm: document.getElementById("typeForm"),
        exprInput: document.getElementById("exprInput"),
        typeMsg: document.getElementById("typeMsg"),
        statSolved: document.getElementById("statSolved"),
        statStreak: document.getElementById("statStreak"),
        statBest: document.getElementById("statBest"),
        railMode: document.getElementById("railMode"),
        railDifficulty: document.getElementById("railDifficulty"),
        railSolutions: document.getElementById("railSolutions"),
        railMoves: document.getElementById("railMoves"),
        musicBtn: document.getElementById("musicBtn"),
        bgm: document.getElementById("bgm")
    };

    var state = {
        mode: "classic",
        puzzle: null,
        solved: false,
        hintsLeft: 2,
        timerId: null
    };

    /* ---------------- 存档 ---------------- */

    function readStats() {
        var blank = { solved: 0, streak: 0, best: {} };
        try {
            var raw = localStorage.getItem(STORE_KEY);
            if (!raw) return blank;
            var parsed = JSON.parse(raw);
            return {
                solved: Number(parsed.solved) || 0,
                streak: Number(parsed.streak) || 0,
                best: parsed.best || {}
            };
        } catch (e) {
            return blank;
        }
    }

    function writeStats(next) {
        try {
            localStorage.setItem(STORE_KEY, JSON.stringify(next));
        } catch (e) {
            /* 隐私模式下写不进去，忽略 */
        }
    }

    function readMode() {
        try {
            var m = localStorage.getItem(MODE_KEY);
            return m && TF24.MODES[m] ? m : "classic";
        } catch (e) {
            return "classic";
        }
    }

    function writeMode(mode) {
        try {
            localStorage.setItem(MODE_KEY, mode);
        } catch (e) {
            /* 忽略 */
        }
    }

    function fmtClock(seconds) {
        seconds = Math.max(0, Math.floor(seconds));
        var m = Math.floor(seconds / 60);
        var s = seconds % 60;
        return m + ":" + (s < 10 ? "0" + s : s);
    }

    function refreshScoreboard() {
        var stats = readStats();
        els.statSolved.textContent = stats.solved;
        els.statStreak.textContent = stats.streak;
        var best = stats.best[state.mode];
        els.statBest.textContent = best ? fmtClock(best) : "—";
    }

    /* ---------------- 模式栏 ---------------- */

    function buildModeBar() {
        var order = ["intro", "classic", "hard", "expert", "noDiv", "cards"];
        var emoji = {
            intro: "🌱",
            classic: "🎲",
            hard: "🔥",
            expert: "🧠",
            noDiv: "➕",
            cards: "🃏"
        };
        els.modeBar.innerHTML = order
            .map(function (key) {
                var mode = TF24.MODES[key];
                return (
                    '<button type="button" class="mode-btn" data-mode="' + key +
                    '" title="' + mode.desc + '">' +
                    '<span class="mode-emoji" aria-hidden="true">' + emoji[key] + "</span>" +
                    mode.name + "</button>"
                );
            })
            .join("");

        els.modeBar.addEventListener("click", function (ev) {
            var btn = ev.target.closest("[data-mode]");
            if (!btn) return;
            var mode = btn.getAttribute("data-mode");
            if (mode === state.mode) return;
            state.mode = mode;
            writeMode(mode);
            markMode();
            newPuzzle();
        });
    }

    function markMode() {
        var buttons = els.modeBar.querySelectorAll("[data-mode]");
        Array.prototype.forEach.call(buttons, function (btn) {
            btn.classList.toggle("is-active", btn.getAttribute("data-mode") === state.mode);
        });
    }

    /* ---------------- 棋盘 ---------------- */

    var board = TF24Board.create(els.board, {
        target: 24,
        onSolved: onSolved,
        onRender: function (b) {
            els.railMoves.textContent = b.moves;
            if (!state.solved) els.timer.textContent = fmtClock(b.elapsed());
        },
        onNext: nextPuzzle
    });

    /* ---------------- 出题 ---------------- */

    function newPuzzle() {
        state.solved = false;
        state.hintsLeft = 2;
        els.hintBtn.disabled = false;
        els.hintLeft.textContent = "2";
        els.typeMsg.textContent = "";
        els.exprInput.value = "";
        els.result.hidden = true;
        els.actions.hidden = false;
        els.typeForm.hidden = false;

        var puzzle = TF24.generate({ mode: state.mode, target: 24 });
        state.puzzle = puzzle;
        board.load(puzzle);

        els.puzzleMeta.textContent =
            (puzzle.modeName || "经典") + " · 难度 " + puzzle.difficultyLabel;
        els.railMode.textContent = puzzle.modeName || "经典";
        els.railDifficulty.textContent = puzzle.difficultyLabel;
        els.railSolutions.textContent = "—";
        els.railMoves.textContent = "0";
        els.timer.textContent = "0:00";
        refreshScoreboard();
    }

    /* ---------------- 通过 ---------------- */

    function pick(list) {
        return list[Math.floor(Math.random() * list.length)];
    }

    function renderStars(count) {
        var html = "";
        for (var i = 0; i < 3; i++) {
            html += '<span class="' + (i < count ? "is-on" : "") + '">' +
                (i < count ? "★" : "☆") + "</span>";
        }
        els.rewardStars.innerHTML = html;
        els.rewardStars.setAttribute("aria-label", count + " 颗星");
    }

    function burstConfetti() {
        if (!els.confetti) return;
        var colors = ["#ffd27a", "#ff9f7a", "#9fd8b4", "#f4b8c1", "#fff0c9", "#c9b6ff"];
        els.confetti.innerHTML = "";
        for (var i = 0; i < 28; i++) {
            var piece = document.createElement("span");
            piece.style.left = Math.random() * 100 + "%";
            piece.style.background = colors[i % colors.length];
            piece.style.animationDelay = Math.random() * 0.55 + "s";
            piece.style.animationDuration = 1.5 + Math.random() * 1.1 + "s";
            piece.style.width = 6 + Math.random() * 6 + "px";
            piece.style.height = 9 + Math.random() * 7 + "px";
            els.confetti.appendChild(piece);
        }
    }

    var audioCtx = null;

    function playChime() {
        try {
            var Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return;
            audioCtx = audioCtx || new Ctx();
            if (audioCtx.state === "suspended") audioCtx.resume();
            [880, 1174, 1568].forEach(function (freq, i) {
                var osc = audioCtx.createOscillator();
                var gain = audioCtx.createGain();
                var t = audioCtx.currentTime + i * 0.11;
                osc.type = "sine";
                osc.frequency.value = freq;
                gain.gain.setValueAtTime(0.0001, t);
                gain.gain.exponentialRampToValueAtTime(0.16, t + 0.03);
                gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start(t);
                osc.stop(t + 0.36);
            });
        } catch (e) {
            /* 声音不可用时静默 */
        }
    }

    function onSolved(info) {
        state.solved = true;
        /* 解出一题记一次完整游戏：玩满 4 题，本游戏休息 30 分钟 */
        if (window.GameLimit) window.GameLimit.count('twenty-four');

        var stats = readStats();
        stats.solved += 1;
        stats.streak += 1;
        var prevBest = stats.best[state.mode];
        if (!prevBest || info.seconds < prevBest) stats.best[state.mode] = info.seconds;
        writeStats(stats);
        refreshScoreboard();

        var stars = 3;
        if (state.hintsLeft < 2) stars -= 1;
        if (info.seconds > 120 || info.moves > 5) stars -= 1;
        stars = Math.max(1, stars);

        var titles = {
            3: ["太棒了！", "厉害厉害！", "小天才！"],
            2: ["做得很好！", "真不错！"],
            1: ["通过啦！", "继续加油！"]
        };
        els.rewardTitle.textContent = pick(titles[stars]);
        renderStars(stars);

        els.resultExpr.innerHTML =
            info.expression.replace(/</g, "&lt;") + ' <b>= 24</b>';
        els.resultTime.textContent =
            "用时 " + fmtClock(info.seconds) + " · " +
            (info.moves > 0 ? info.moves + " 步" : "直接写算式") + " · " +
            (state.puzzle.solutionCount || 1) + " 种解法";
        els.resultDifficulty.textContent =
            (state.puzzle.modeName || "") + " · " + state.puzzle.difficultyLabel;
        els.rewardStreak.textContent =
            stats.streak >= 2
                ? "连续答对 " + stats.streak + " 题，豆豆为你鼓掌！"
                : "答对 1 题，继续加油！";

        els.result.hidden = false;
        els.actions.hidden = true;
        els.typeForm.hidden = true;
        els.railSolutions.textContent = (state.puzzle.solutionCount || 1) + " 种";
        els.timer.textContent = fmtClock(info.seconds);

        burstConfetti();
        playChime();
        els.nextBtn.focus({ preventScroll: true });
    }

    function nextPuzzle() {
        if (!state.solved) return;
        newPuzzle();
    }

    els.nextBtn.addEventListener("click", nextPuzzle);

    /* ---------------- 操作行 ---------------- */

    els.actions.addEventListener("click", function (ev) {
        var btn = ev.target.closest("[data-act]");
        if (!btn) return;
        var act = btn.getAttribute("data-act");

        if (act === "undo") {
            board.undo();
        } else if (act === "reset") {
            board.reset();
            state.hintsLeft = 2;
            els.hintBtn.disabled = false;
            els.hintLeft.textContent = "2";
        } else if (act === "hint") {
            if (state.hintsLeft <= 0) return;
            state.hintsLeft -= 1;
            board.hint();
            els.hintLeft.textContent = state.hintsLeft;
            if (state.hintsLeft === 0) els.hintBtn.disabled = true;
        } else if (act === "skip") {
            var stats = readStats();
            stats.streak = 0;
            writeStats(stats);
            newPuzzle();
            board.showMessage("已换一题，连胜重新计算", "hint");
            refreshScoreboard();
        }
    });

    /* ---------------- 算式输入 ---------------- */

    els.typeForm.addEventListener("submit", function (ev) {
        ev.preventDefault();
        if (state.solved) return;
        var text = els.exprInput.value;
        if (!text.trim()) {
            els.typeMsg.textContent = "先写一个算式";
            return;
        }
        var res = board.submitExpression(text);
        if (!res.ok) {
            els.typeMsg.textContent = res.error || "再想一想";
            els.typeMsg.setAttribute("data-tone", "bad");
        } else {
            els.typeMsg.textContent = "";
            els.exprInput.value = "";
        }
    });

    /* ---------------- 计时 ---------------- */

    function tick() {
        if (state.solved || !state.puzzle) return;
        els.timer.textContent = fmtClock(board.elapsed());
    }

    /* ---------------- 背景音乐 ---------------- */

    function readMusic() {
        try {
            return localStorage.getItem(MUSIC_KEY) !== "off";
        } catch (e) {
            return true;
        }
    }

    var musicOn = readMusic();

    var pcBreakAt = 0;

    document.addEventListener("playclock:breakstart", function () {
        pcBreakAt = Date.now();
        if (els.bgm) els.bgm.pause();
    });

    document.addEventListener("playclock:breakend", function () {
        if (pcBreakAt && board) {
            board.startAt += Date.now() - pcBreakAt;
            pcBreakAt = 0;
            tick();
        }
        if (musicOn) playMusic();
    });

    function renderMusic() {
        els.musicBtn.classList.toggle("is-off", !musicOn);
        els.musicBtn.setAttribute("aria-pressed", musicOn ? "true" : "false");
        els.musicBtn.querySelector(".music-icon").textContent = musicOn ? "🎵" : "🔇";
        els.musicBtn.querySelector(".music-label").textContent = musicOn ? "音乐" : "静音";
    }

    function playMusic() {
        if (!musicOn || !els.bgm) return;
        els.bgm.volume = 0.32;
        var p = els.bgm.play();
        if (p && p.catch) {
            p.catch(function () {
                /* 浏览器要求先有一次点击，首次点击时会自动补播 */
            });
        }
    }

    els.musicBtn.addEventListener("click", function () {
        musicOn = !musicOn;
        try {
            localStorage.setItem(MUSIC_KEY, musicOn ? "on" : "off");
        } catch (e) {
            /* 忽略 */
        }
        renderMusic();
        if (musicOn) playMusic();
        else els.bgm.pause();
    });

    document.addEventListener("pointerdown", function () {
        if (musicOn && els.bgm && els.bgm.paused) playMusic();
    }, { once: true });

    document.addEventListener("keydown", function () {
        if (musicOn && els.bgm && els.bgm.paused) playMusic();
    }, { once: true });

    document.addEventListener("visibilitychange", function () {
        if (document.hidden) els.bgm.pause();
        else if (musicOn) playMusic();
    });

    document.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter" && !els.result.hidden) {
            ev.preventDefault();
            nextPuzzle();
        }
    });

    /* ---------------- 启动 ---------------- */

    renderMusic();
    buildModeBar();
    state.mode = readMode();
    markMode();
    refreshScoreboard();
    newPuzzle();
    state.timerId = setInterval(tick, 500);
    playMusic();
})();
