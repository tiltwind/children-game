/* ============================================================
 * poem.js —— 唐诗小状元 · 独立随机接句游戏
 * 依赖：poem-data.js
 * ============================================================ */
(function () {
    "use strict";

    var Data = window.PoemData;
    if (!Data) {
        document.body.innerHTML = '<p style="padding:40px;color:#fff">唐诗题库加载失败。</p>';
        return;
    }

    var BEST_KEY = "poem.best.v1";
    var SOUND_KEY = "poem.sound.v1";

    var els = {
        score: document.getElementById("score"),
        streak: document.getElementById("streak"),
        best: document.getElementById("best"),
        levelTabs: document.getElementById("levelTabs"),
        questionNo: document.getElementById("questionNo"),
        gradeTag: document.getElementById("gradeTag"),
        lengthTag: document.getElementById("lengthTag"),
        upLine: document.getElementById("upLine"),
        options: document.getElementById("options"),
        feedback: document.getElementById("feedback"),
        nextBtn: document.getElementById("nextBtn"),
        speakBtn: document.getElementById("speakBtn"),
        quizCard: document.querySelector(".quiz-card"),
        soundBtn: document.getElementById("soundBtn"),
        restartBtn: document.getElementById("restartBtn"),
        poemCount: document.getElementById("poemCount"),
        questionCount: document.getElementById("questionCount"),
        reward: document.getElementById("reward"),
        rewardTitle: document.getElementById("rewardTitle"),
        rewardText: document.getElementById("rewardText"),
        rewardBtn: document.getElementById("rewardBtn")
    };

    var state = {
        group: "all",
        score: 0,
        streak: 0,
        best: readBest(),
        qNo: 0,
        qWrong: 0,
        answered: false
    };
    var current = null;
    var lastUp = "";
    var autoTimer = null;
    var rewardOpen = false;
    var soundOn = readSound();
    var audioCtx = null;
    var speechSupported = "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;

    /* ---------------- 存档与音效 ---------------- */

    function readBest() {
        try {
            return Math.max(0, Number(localStorage.getItem(BEST_KEY)) || 0);
        } catch (e) {
            return 0;
        }
    }

    function saveBest() {
        try {
            localStorage.setItem(BEST_KEY, String(state.best));
        } catch (e) {
            /* 忽略 */
        }
    }

    function readSound() {
        try {
            return localStorage.getItem(SOUND_KEY) !== "off";
        } catch (e) {
            return true;
        }
    }

    function renderSound() {
        els.soundBtn.textContent = soundOn ? "🔊" : "🔇";
        els.soundBtn.setAttribute("aria-pressed", soundOn ? "true" : "false");
        els.soundBtn.title = soundOn ? "关闭音效" : "打开音效";
    }

    function ensureAudio() {
        if (!soundOn) return null;
        var Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return null;
        if (!audioCtx) audioCtx = new Ctx();
        if (audioCtx.state === "suspended") audioCtx.resume();
        return audioCtx;
    }

    function tone(freq, offset, duration, type) {
        var ctx = ensureAudio();
        if (!ctx) return;
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = type || "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + offset);
        gain.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + offset + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + offset);
        osc.stop(ctx.currentTime + offset + duration + 0.02);
    }

    function playRight() {
        tone(660, 0, 0.16, "sine");
        tone(880, 0.14, 0.2, "sine");
    }

    function playWrong() {
        tone(220, 0, 0.16, "triangle");
    }

    /* ---------------- 界面 ---------------- */

    function gradeText(grade) {
        return Data.gradeText(grade) || "";
    }

    function lengthText(length) {
        if (length === 5) return "五言";
        if (length === 7) return "七言";
        return length + "言";
    }

    function updateStats() {
        els.score.textContent = state.score;
        els.streak.textContent = state.streak;
        els.best.textContent = state.best;
    }

    function updateCount() {
        els.poemCount.textContent = Data.count;
        els.questionCount.textContent = Data.questionCount(state.group);
    }

    function setGroupActive() {
        var tabs = els.levelTabs.querySelectorAll(".level-tab");
        Array.prototype.forEach.call(tabs, function (tab) {
            tab.classList.toggle("is-active", tab.getAttribute("data-group") === state.group);
        });
    }

    function renderQuestion() {
        clearTimeout(autoTimer);
        autoTimer = null;
        state.answered = false;
        state.qWrong = 0;

        current = Data.pickQuestion(Math.random, {
            group: state.group,
            excludeUp: lastUp
        });
        if (!current) return;
        lastUp = current.up;
        state.qNo++;

        els.questionNo.textContent = "第 " + state.qNo + " 题";
        els.gradeTag.textContent = gradeText(current.grade);
        els.lengthTag.textContent = lengthText(current.length);
        els.upLine.textContent = "“" + current.up + "”";
        els.feedback.className = "feedback";
        els.feedback.textContent = "";
        els.nextBtn.hidden = true;
        els.speakBtn.textContent = "🔊 读上句";
        els.speakBtn.hidden = !speechSupported;
        els.options.innerHTML = "";

        current.options.forEach(function (opt, index) {
            var btn = document.createElement("button");
            btn.type = "button";
            btn.className = "option";
            btn.setAttribute("data-right", opt.right ? "1" : "0");
            btn.innerHTML =
                '<span class="option-key">' + (index + 1) + "</span>" +
                '<span class="option-text"></span>';
            btn.querySelector(".option-text").textContent = opt.text;
            btn.addEventListener("click", function () {
                choose(btn, opt);
            });
            els.options.appendChild(btn);
        });

        els.quizCard.classList.remove("is-shake");
    }

    function choose(btn, opt) {
        if (state.answered || btn.disabled) return;

        if (opt.right) {
            state.answered = true;
            state.score++;
            state.streak++;
            /* 每答满 10 题记一次完整游戏：玩满 4 次，本游戏休息 30 分钟 */
            if (state.qNo > 0 && state.qNo % 10 === 0 && window.GameLimit) {
                window.GameLimit.count('poem');
            }
            state.best = Math.max(state.best, state.streak);
            saveBest();
            updateStats();

            btn.classList.add("is-right");
            var buttons = els.options.querySelectorAll(".option");
            Array.prototype.forEach.call(buttons, function (b) {
                b.disabled = true;
            });

            els.feedback.className = "feedback is-good";
            els.feedback.textContent =
                "答对啦！这句出自《" + current.title + "》 · " + current.author;
            els.nextBtn.hidden = false;
            els.speakBtn.textContent = "🔊 读整句";
            playRight();

            if (state.streak > 0 && state.streak % 5 === 0) {
                showReward(state.streak);
            } else {
                autoTimer = setTimeout(renderQuestion, 1700);
            }
            return;
        }

        state.streak = 0;
        state.qWrong++;
        updateStats();
        btn.classList.add("is-wrong");
        btn.disabled = true;
        playWrong();
        els.quizCard.classList.remove("is-shake");
        void els.quizCard.offsetWidth;
        els.quizCard.classList.add("is-shake");

        els.feedback.className = "feedback is-bad";
        if (state.qWrong >= 2) {
            els.feedback.textContent =
                "小提示：这句出自《" + current.title + "》 · " + current.author + "，再读读上句。";
        } else {
            els.feedback.textContent = "这句不太对，再读读上句～";
        }
    }

    function nextQuestion() {
        if (rewardOpen) return;
        clearTimeout(autoTimer);
        autoTimer = null;
        renderQuestion();
    }

    /* ---------------- 奖励 ---------------- */

    function showReward(streak) {
        rewardOpen = true;
        els.rewardTitle.textContent = "连对 " + streak + " 题！";
        els.rewardText.textContent = streak >= 10
            ? "十题连对，诗句都难不倒你，真是小小状元郎！"
            : "你把诗句记得真牢，送你一颗小星星。";

        var old = els.reward.querySelectorAll(".confetti");
        Array.prototype.forEach.call(old, function (el) {
            el.remove();
        });
        var colors = ["#c9a56b", "#b34a32", "#2e7657", "#e5cd9f", "#8e3324"];
        for (var i = 0; i < 24; i++) {
            var bit = document.createElement("span");
            bit.className = "confetti";
            bit.style.setProperty("--x", (Math.random() * 100).toFixed(1) + "%");
            bit.style.setProperty("--delay", (Math.random() * 0.8).toFixed(2) + "s");
            bit.style.setProperty("--rot", Math.floor(Math.random() * 180) + "deg");
            bit.style.setProperty("--color", colors[i % colors.length]);
            els.reward.appendChild(bit);
        }

        els.reward.hidden = false;
        requestAnimationFrame(function () {
            els.reward.classList.add("is-open");
        });
        setTimeout(function () {
            els.rewardBtn.focus();
        }, 120);
    }

    function hideReward() {
        if (!rewardOpen) return;
        rewardOpen = false;
        els.reward.classList.remove("is-open");
        setTimeout(function () {
            if (!rewardOpen) els.reward.hidden = true;
        }, 260);
        renderQuestion();
    }

    /* ---------------- 朗读 ---------------- */

    function speakCurrent() {
        if (!speechSupported || !current) return;
        var text = state.answered
            ? current.up + "，" + current.down
            : current.up;
        window.speechSynthesis.cancel();
        var utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "zh-CN";
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
    }

    /* ---------------- 回合 ---------------- */

    function startRound() {
        clearTimeout(autoTimer);
        autoTimer = null;
        state.score = 0;
        state.streak = 0;
        state.qNo = 0;
        lastUp = "";
        updateStats();
        updateCount();
        renderQuestion();
    }

    function bind() {
        els.levelTabs.addEventListener("click", function (ev) {
            var tab = ev.target.closest(".level-tab");
            if (!tab) return;
            var group = tab.getAttribute("data-group");
            if (!group || group === state.group) return;
            state.group = group;
            setGroupActive();
            startRound();
        });

        els.nextBtn.addEventListener("click", nextQuestion);
        els.speakBtn.addEventListener("click", speakCurrent);

        els.soundBtn.addEventListener("click", function () {
            soundOn = !soundOn;
            renderSound();
            try {
                localStorage.setItem(SOUND_KEY, soundOn ? "on" : "off");
            } catch (e) {
                /* 忽略 */
            }
            if (soundOn) playRight();
        });

        els.restartBtn.addEventListener("click", startRound);
        els.rewardBtn.addEventListener("click", hideReward);

        els.reward.addEventListener("keydown", function (ev) {
            if (ev.key === "Escape") {
                ev.preventDefault();
                hideReward();
            }
        });

        document.addEventListener("keydown", function (ev) {
            if (rewardOpen || ev.ctrlKey || ev.metaKey || ev.altKey) return;
            var n = parseInt(ev.key, 10);
            if (n >= 1 && n <= 4 && current && !state.answered) {
                var buttons = els.options.querySelectorAll(".option");
                var btn = buttons[n - 1];
                if (btn && !btn.disabled) {
                    ev.preventDefault();
                    btn.click();
                }
            }
        });

        document.addEventListener("playclock:breakstart", function () {
            if (speechSupported) window.speechSynthesis.cancel();
        });
    }

    renderSound();
    els.best.textContent = state.best;
    updateCount();
    bind();
    renderQuestion();
})();
