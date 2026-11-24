/* ============================================================
 * english.js —— 英语小勇士
 *
 * 玩法：
 * - 8 个关卡，每关 10 题，题型按关卡组合（英翻中 / 中翻英 / 补全单词，各含选择与手写）
 * - 第一次答对 8 题即过关，解锁下一关；三颗星按 10 / 9 / 8 划分
 * - 自由练习：可选年级与题型，10 题一轮，不计入闯关进度
 * - 单词表：按年级浏览、搜索，可听发音
 * - 进度存在 localStorage，刷新不丢
 * ============================================================ */
(function (global) {
    "use strict";

    var Data = global.EnglishData;
    if (!Data) throw new Error("english.js 需要先加载 english-data.js");

    var STORE_KEY = "shutu.english.v1";
    var PASS_SCORE = 8;

    var LEVELS = [
        {
            id: 1, name: "认识新词", sub: "一年级 · 英翻中 + 中翻英",
            grades: [1], types: ["en2zh", "zh2en"]
        },
        {
            id: 2, name: "中英配对", sub: "一年级 · 中翻英 + 补全 + 英翻中",
            grades: [1], types: ["zh2en", "fill-choice", "en2zh"]
        },
        {
            id: 3, name: "补全单词", sub: "一、二年级 · 补全（选择 / 手写）",
            grades: [1, 2], types: ["fill-choice", "fill-write", "en2zh"]
        },
        {
            id: 4, name: "二年级词库", sub: "二年级 · 英翻中 + 中翻英",
            grades: [2], types: ["en2zh", "zh2en"]
        },
        {
            id: 5, name: "动手拼写", sub: "二年级 · 手写为主 + 英翻中",
            grades: [2], types: ["zh2en-write", "fill-write", "en2zh"]
        },
        {
            id: 6, name: "三年级词库", sub: "三年级 · 三种选择题",
            grades: [3], types: ["en2zh", "zh2en", "fill-choice"]
        },
        {
            id: 7, name: "三年级拼写", sub: "三年级 · 手写为主 + 中翻英",
            grades: [3], types: ["zh2en-write", "fill-write", "zh2en"]
        },
        {
            id: 8, name: "终极挑战", sub: "全年级 · 五种题型混合",
            grades: [1, 2, 3], types: ["en2zh", "zh2en", "zh2en-write", "fill-choice", "fill-write"]
        }
    ];

    var PRACTICE_TYPES = {
        mix: ["en2zh", "zh2en", "zh2en-write", "fill-choice", "fill-write"],
        choice: ["en2zh", "zh2en", "fill-choice"],
        write: ["zh2en-write", "fill-write"],
        fill: ["fill-choice", "fill-write"]
    };

    var state = {
        view: "home",
        mode: "level",
        levelIndex: 0,
        qIndex: 0,
        total: 10,
        score: 0,
        attempted: 0,
        streak: 0,
        bestStreak: 0,
        used: [],
        wrong: [],
        q: null,
        answered: false,
        hintUsed: false,
        startTs: 0,
        practiceGrades: "all",
        practiceType: "mix",
        typePlan: []
    };

    var progress = loadProgress();
    var soundOn = true;
    var audioCtx = null;
    var lastResult = null;

    /* ---------------- DOM ---------------- */
    var el = {};

    function $(id) {
        return document.getElementById(id);
    }

    function cacheDom() {
        [
            "wordCount", "statLevels", "statStars", "statWords", "levelGrid",
            "continueBtn", "practiceBtn",
            "homeView", "quizView", "resultView", "lexView",
            "quizLevel", "quizMode", "qIndex", "qTotal", "progressFill",
            "qScore", "qStreak", "qPracticeCount", "qType", "qGrade", "qAsk",
            "qPrompt", "qSub", "speakBtn", "optionsBox", "writeBox", "answerInput",
            "submitBtn", "hintLine", "hintBtn", "feedback", "nextBtn", "quitBtn", "quizCard",
            "resultStars", "resultKicker", "resultTitle", "resultText", "resultScore",
            "resultTime", "resultRate", "wrongBox", "wrongList", "nextLevelBtn",
            "retryBtn", "resultHomeBtn",
            "lexBtn", "lexBackBtn", "lexTabs", "lexSearch", "lexList", "lexCount",
            "soundBtn",
            "practiceModal", "practiceGrades", "practiceTypes", "practiceStart", "practiceCancel"
        ].forEach(function (id) {
            el[id] = $(id);
        });
    }

    /* ---------------- 存储 ---------------- */

    function loadProgress() {
        var base = { v: 1, levels: {} };
        try {
            var raw = global.localStorage.getItem(STORE_KEY);
            if (!raw) return base;
            var data = JSON.parse(raw);
            if (!data || !data.levels) return base;
            return { v: 1, levels: data.levels };
        } catch (e) {
            return base;
        }
    }

    function saveProgress() {
        try {
            global.localStorage.setItem(STORE_KEY, JSON.stringify({ v: 1, levels: progress.levels }));
        } catch (e) {
            /* 隐私模式下退化为内存进度 */
        }
    }

    function levelRecord(id) {
        return progress.levels[id] || null;
    }

    function levelStars(id) {
        var rec = levelRecord(id);
        return rec ? rec.stars || 0 : 0;
    }

    /* 已解锁到第几个（0 表示只有第一关） */
    function unlockedIndex() {
        var n = 0;
        for (var i = 0; i < LEVELS.length; i++) {
            if (levelStars(LEVELS[i].id) > 0) n = i + 1;
            else break;
        }
        return Math.min(n, LEVELS.length - 1);
    }

    function isLocked(i) {
        return i > unlockedIndex();
    }

    function totalStars() {
        var sum = 0;
        for (var i = 0; i < LEVELS.length; i++) sum += levelStars(LEVELS[i].id);
        return sum;
    }

    function clearedLevels() {
        var n = 0;
        for (var i = 0; i < LEVELS.length; i++) if (levelStars(LEVELS[i].id) > 0) n++;
        return n;
    }

    /* ---------------- 音效与朗读 ---------------- */

    function ensureAudio() {
        if (!audioCtx) {
            try {
                var Ctx = global.AudioContext || global.webkitAudioContext;
                if (Ctx) audioCtx = new Ctx();
            } catch (e) {
                audioCtx = null;
            }
        }
        if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
        return audioCtx;
    }

    function tone(freq, duration, offset) {
        if (!soundOn) return;
        var ctx = ensureAudio();
        if (!ctx) return;
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.value = 0.0001;
        osc.connect(gain);
        gain.connect(ctx.destination);
        var t0 = ctx.currentTime + (offset || 0);
        gain.gain.exponentialRampToValueAtTime(0.16, t0 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
        osc.start(t0);
        osc.stop(t0 + duration + 0.02);
    }

    function sfxOk() {
        tone(660, 0.16, 0);
        tone(920, 0.22, 0.12);
    }

    function sfxBad() {
        if (!soundOn) return;
        var ctx = ensureAudio();
        if (!ctx) return;
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.value = 220;
        osc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.25);
        gain.gain.value = 0.12;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.28);
    }

    function speak(text) {
        if (!soundOn) return;
        if (!global.speechSynthesis || !global.SpeechSynthesisUtterance) return;
        try {
            global.speechSynthesis.cancel();
            var u = new global.SpeechSynthesisUtterance(String(text));
            u.lang = "en-US";
            u.rate = 0.82;
            u.pitch = 1.02;
            var voices = global.speechSynthesis.getVoices() || [];
            for (var i = 0; i < voices.length; i++) {
                if (/en[-_]US|en[-_]GB/i.test(voices[i].lang)) {
                    u.voice = voices[i];
                    break;
                }
            }
            global.speechSynthesis.speak(u);
        } catch (e) {
            /* 部分环境不支持朗读，静默跳过 */
        }
    }

    /* ---------------- 视图 ---------------- */

    function showView(name) {
        state.view = name;
        el.homeView.hidden = name !== "home";
        el.quizView.hidden = name !== "quiz";
        el.resultView.hidden = name !== "result";
        el.lexView.hidden = name !== "lex";
        el.practiceModal.hidden = true;
    }

    /* ---------------- 首页 ---------------- */

    function renderHome() {
        var unlocked = unlockedIndex();
        el.wordCount.textContent = Data.words.length;
        el.statWords.textContent = Data.words.length;
        el.statLevels.textContent = clearedLevels();
        el.statStars.textContent = totalStars();

        // 继续闯关：第一个还没通关的已解锁关卡
        var target = -1;
        for (var i = 0; i <= unlocked; i++) {
            if (levelStars(LEVELS[i].id) === 0) {
                target = i;
                break;
            }
        }
        if (target < 0) target = LEVELS.length - 1;
        el.continueBtn.textContent = clearedLevels() >= LEVELS.length
            ? "再玩最后一关 · " + LEVELS[target].name
            : "继续闯关 · 第 " + (target + 1) + " 关";
        el.continueBtn.dataset.target = target;

        var html = "";
        LEVELS.forEach(function (lv, index) {
            var stars = levelStars(lv.id);
            var rec = levelRecord(lv.id);
            var locked = isLocked(index);
            var isCurrent = index === target && !locked;
            var starHtml = "";
            for (var s = 0; s < 3; s++) {
                starHtml += s < stars ? "<b>★</b>" : "★";
            }
            html +=
                '<button type="button" class="level-card' +
                (locked ? " is-locked" : "") +
                (isCurrent ? " is-current" : "") +
                '" data-index="' + index + '"' +
                (locked ? ' aria-disabled="true"' : "") + ">" +
                '<div class="level-no">Level<span>' + String(lv.id).padStart(2, "0") + "</span></div>" +
                '<div class="level-name">' + lv.name + "</div>" +
                '<div class="level-sub">' + lv.sub + "</div>" +
                '<div class="level-stars">' + starHtml + "</div>" +
                (locked ? '<span class="level-lock" aria-hidden="true">🔒</span>' : "") +
                (rec && rec.best > 0 ? '<span class="level-best">最好 ' + rec.best + "/10</span>" : "") +
                "</button>";
        });
        el.levelGrid.innerHTML = html;
    }

    /* ---------------- 开始一关 ---------------- */

    function startLevel(index) {
        var lv = LEVELS[index];
        state.mode = "level";
        state.levelIndex = index;
        state.qIndex = 0;
        state.total = 10;
        state.score = 0;
        state.attempted = 0;
        state.streak = 0;
        state.bestStreak = 0;
        state.used = [];
        state.wrong = [];
        state.startTs = Date.now();
        state.typePlan = buildTypePlan(lv.types, state.total);
        showView("quiz");
        nextQuestion();
    }

    function startPractice(grades, typeKey) {
        state.mode = "practice";
        state.levelIndex = -1;
        state.qIndex = 0;
        state.total = 10;
        state.score = 0;
        state.attempted = 0;
        state.streak = 0;
        state.bestStreak = 0;
        state.used = [];
        state.wrong = [];
        state.startTs = Date.now();
        state.practiceGrades = grades;
        state.practiceType = typeKey;
        state.typePlan = buildTypePlan(currentTypes(), state.total);
        showView("quiz");
        nextQuestion();
    }

    function currentGrades() {
        if (state.mode === "practice") {
            return state.practiceGrades === "all" ? [1, 2, 3] : [Number(state.practiceGrades)];
        }
        return LEVELS[state.levelIndex].grades;
    }

    /* 一轮里均衡分配题型，并保证相邻两题不重复 */
    function buildTypePlan(types, total) {
        if (!types || !types.length) return [];
        if (types.length === 1) {
            var same = [];
            for (var k = 0; k < total; k++) same.push(types[0]);
            return same;
        }
        var quota = {};
        var base = Math.floor(total / types.length);
        types.forEach(function (t) { quota[t] = base; });
        for (var r = 0; r < total % types.length; r++) quota[types[r]]++;

        var plan = [];
        var last = null;
        for (var i = 0; i < total; i++) {
            var maxLeft = 0;
            types.forEach(function (t) { if (quota[t] > maxLeft) maxLeft = quota[t]; });
            // 优先消化剩余数量最多的题型，避免最后几题被同一种题型包尾
            var cand = types.filter(function (t) { return quota[t] === maxLeft && t !== last; });
            if (!cand.length) cand = types.filter(function (t) { return quota[t] === maxLeft; });
            if (!cand.length) cand = types.filter(function (t) { return quota[t] > 0 && t !== last; });
            if (!cand.length) cand = types;
            var pickType = cand[Math.floor(Math.random() * cand.length)];
            plan.push(pickType);
            if (quota[pickType] > 0) quota[pickType]--;
            last = pickType;
        }
        return plan;
    }

    function currentTypes() {
        if (state.mode === "practice") {
            return PRACTICE_TYPES[state.practiceType] || PRACTICE_TYPES.mix;
        }
        return LEVELS[state.levelIndex].types;
    }

    function nextQuestion() {
        if (state.qIndex >= state.total) {
            finishRound();
            return;
        }

        var types = currentTypes();
        var grades = currentGrades();
        var type = state.typePlan[state.qIndex];
        if (!type || types.indexOf(type) < 0) {
            type = types[Math.floor(Math.random() * types.length)];
        }
        var q = Data.makeQuestion(type, {
            grades: grades,
            exclude: state.used,
            random: Math.random
        });
        if (!q) {
            // 该范围词太少时清空排除表，再按本题计划题型重来
            state.used = [];
            q = Data.makeQuestion(type, { grades: grades, random: Math.random });
        }
        if (!q) {
            // 兜底：全库任意一题
            q = Data.makeQuestion("en2zh", { grades: [1, 2, 3], random: Math.random });
        }
        if (!q) return;

        state.used.push(q.word.w);
        state.q = q;
        state.answered = false;
        state.hintUsed = false;
        renderQuestion();
    }

    function renderQuestion() {
        var q = state.q;
        var lv = state.mode === "practice" ? null : LEVELS[state.levelIndex];

        el.quizLevel.textContent = state.mode === "practice" ? "自由练习" : "第 " + lv.id + " 关 · " + lv.name;
        el.quizMode.textContent = state.mode === "practice" ? practiceScopeText() : "闯关";
        el.qIndex.textContent = String(state.qIndex + 1);
        el.qTotal.textContent = String(state.total);
        el.progressFill.style.width = ((state.qIndex + 1) / state.total) * 100 + "%";

        el.qScore.textContent = state.score;
        el.qStreak.textContent = "连对 " + state.streak;
        if (state.mode === "practice") {
            el.qPracticeCount.hidden = false;
            el.qPracticeCount.textContent = "已答 " + state.attempted + " 题";
        } else {
            el.qPracticeCount.hidden = true;
        }

        el.qType.textContent = q.label;
        el.qGrade.textContent = q.gradeText + " · " + q.word.c;
        el.qAsk.textContent = q.ask;

        // 题面
        el.qPrompt.className = "prompt" + (q.type === "zh2en" || q.type === "zh2en-write" ? " is-zh" : "");
        el.qPrompt.innerHTML = "";
        if (q.type === "fill-choice" || q.type === "fill-write") {
            el.qPrompt.appendChild(document.createTextNode(q.head));
            var blank = document.createElement("span");
            blank.className = "blank";
            blank.textContent = "_".repeat(q.answer.length);
            el.qPrompt.appendChild(blank);
        } else {
            el.qPrompt.textContent = q.promptMain;
        }

        el.qSub.textContent = q.promptSub || "";

        // 朗读按钮：英翻中可直接听；其他题型答完再听，避免直接送答案
        if (q.type === "en2zh") {
            el.speakBtn.hidden = false;
            el.speakBtn.dataset.say = q.word.w;
        } else {
            el.speakBtn.hidden = true;
            el.speakBtn.dataset.say = "";
        }

        // 选项
        el.optionsBox.innerHTML = "";
        el.optionsBox.hidden = q.mode !== "choice";
        el.writeBox.hidden = q.mode !== "write";
        if (q.mode === "choice") {
            q.options.forEach(function (opt, i) {
                var btn = document.createElement("button");
                btn.type = "button";
                btn.className = "option";
                btn.dataset.index = i;
                btn.dataset.right = opt.right ? "1" : "0";
                var key = document.createElement("span");
                key.className = "option-key";
                key.textContent = String.fromCharCode(65 + i);
                var txt = document.createElement("span");
                txt.className = "option-text" + (q.type === "zh2en" ? " is-word" : "");
                txt.textContent = opt.text;
                btn.appendChild(key);
                btn.appendChild(txt);
                el.optionsBox.appendChild(btn);
            });
        } else {
            el.answerInput.value = "";
            el.answerInput.disabled = false;
            el.answerInput.className = "answer-input";
            el.answerInput.placeholder = q.type === "fill-write" ? "补出缺的后半段" : "写出英文单词";
            el.submitBtn.disabled = false;
            setTimeout(function () {
                if (state.view === "quiz") el.answerInput.focus();
            }, 80);
        }

        el.hintLine.hidden = true;
        el.hintLine.textContent = "";
        el.feedback.className = "feedback";
        el.feedback.textContent = "";
        el.nextBtn.hidden = true;
        el.hintBtn.hidden = false;
        el.quizCard.classList.remove("is-answered");
    }

    function practiceScopeText() {
        var g = state.practiceGrades === "all" ? "全年级" : Data.gradeText(Number(state.practiceGrades));
        var t = { mix: "混合题型", choice: "选择题", write: "手写拼写", fill: "补全单词" }[state.practiceType] || "混合题型";
        return g + " · " + t;
    }

    /* ---------------- 判题 ---------------- */

    function checkWrite(q, raw) {
        var norm = Data.norm(raw);
        if (!norm) return false;
        if (q.type === "fill-write") {
            if (norm === Data.norm(q.answer)) return true;
            // 也接受完整单词
            return norm === Data.norm(q.head + q.answer) || norm === Data.norm(q.word.w);
        }
        return norm === Data.norm(q.answer);
    }

    function answerChoice(btn) {
        if (state.answered || btn.disabled) return;
        var q = state.q;
        var isRight = btn.dataset.right === "1";
        state.attempted++;

        if (isRight) {
            state.score++;
            state.streak++;
            if (state.streak > state.bestStreak) state.bestStreak = state.streak;
            settleChoice(btn, true);
        } else {
            state.streak = 0;
            state.wrong.push(q.word);
            settleChoice(btn, false);
        }
    }

    function settleChoice(btn, isRight) {
        state.answered = true;
        var q = state.q;
        Array.prototype.forEach.call(el.optionsBox.children, function (b) {
            b.disabled = true;
            if (b.dataset.right === "1") b.classList.add("is-right");
            else if (b !== btn) b.classList.add("is-dim");
        });
        if (!isRight) btn.classList.add("is-wrong");

        if (isRight) {
            sfxOk();
            feedbackOk(q);
            speak(q.word.w);
        } else {
            sfxBad();
            feedbackBad(q);
        }
        afterAnswer();
    }

    function submitWrite() {
        if (state.answered) return;
        var q = state.q;
        var raw = el.answerInput.value;
        if (!Data.norm(raw)) {
            el.feedback.className = "feedback is-info";
            el.feedback.textContent = "先写出答案，再提交。";
            el.answerInput.focus();
            return;
        }
        state.attempted++;
        var ok = checkWrite(q, raw);

        state.answered = true;
        el.answerInput.disabled = true;
        el.submitBtn.disabled = true;

        if (ok) {
            state.score++;
            state.streak++;
            if (state.streak > state.bestStreak) state.bestStreak = state.streak;
            el.answerInput.classList.add("is-right");
            sfxOk();
            feedbackOk(q);
            speak(q.word.w);
        } else {
            state.streak = 0;
            state.wrong.push(q.word);
            el.answerInput.classList.add("is-wrong");
            sfxBad();
            feedbackBad(q);
        }
        afterAnswer();
    }

    function feedbackOk(q) {
        el.feedback.className = "feedback is-ok";
        el.feedback.innerHTML = "";

        var line = document.createElement("span");
        line.textContent = state.streak >= 3
            ? "太棒了，连对 " + state.streak + " 题！"
            : "答对啦！";
        el.feedback.appendChild(line);

        var detail = document.createElement("span");
        detail.className = "fb-word";
        detail.textContent = q.word.w + " = " + q.word.zh + "　" + Data.phonText(q.word);
        el.feedback.appendChild(detail);
    }

    function feedbackBad(q) {
        el.feedback.className = "feedback is-bad";
        el.feedback.innerHTML = "";

        var line = document.createElement("span");
        line.textContent = q.type === "fill-write" || q.type === "fill-choice"
            ? "还差一点，完整单词是 " + q.word.w
            : "这题答案是 " + (q.type === "en2zh" ? q.word.zh : q.word.w);
        el.feedback.appendChild(line);

        var detail = document.createElement("span");
        detail.className = "fb-word";
        detail.textContent = q.word.w + " = " + q.word.zh + "　" + Data.phonText(q.word) + "　" + q.hint;
        el.feedback.appendChild(detail);
    }

    function afterAnswer() {
        el.hintLine.hidden = true;
        el.hintBtn.hidden = true;
        el.speakBtn.hidden = false;
        el.speakBtn.dataset.say = state.q.word.w;

        var last = state.qIndex + 1 >= state.total;
        el.nextBtn.hidden = false;
        el.nextBtn.textContent = last
            ? (state.mode === "practice" ? "看练习结果 →" : "看本关结果 →")
            : "下一题 →";
        el.quizCard.classList.add("is-answered");
        el.qScore.textContent = state.score;
        el.qStreak.textContent = "连对 " + state.streak;
    }

    function goNext() {
        if (!state.answered) return;
        state.qIndex++;
        if (state.mode === "practice") el.qPracticeCount.textContent = "已答 " + state.attempted + " 题";
        nextQuestion();
    }

    function showHint() {
        if (state.answered) return;
        var q = state.q;
        state.hintUsed = true;
        el.hintBtn.hidden = true;
        el.hintLine.hidden = false;
        var extra = q.type === "fill-write" || q.type === "fill-choice"
            ? "缺 " + q.answer.length + " 个字母，从 " + q.head + " 往后接。"
            : "这个词有 " + Data.norm(q.word.w).length + " 个字母，首字母是 " + q.word.w.charAt(0) + "。";
        el.hintLine.textContent = "拼读提示：" + q.hint + "　" + extra;
    }

    /* ---------------- 结算 ---------------- */

    function finishRound() {
        var elapsed = Math.max(0, Date.now() - state.startTs);
        var score = state.score;
        var pass = score >= PASS_SCORE;
        var stars = score >= 10 ? 3 : score >= 9 ? 2 : score >= PASS_SCORE ? 1 : 0;
        var lv = state.mode === "level" ? LEVELS[state.levelIndex] : null;

        lastResult = {
            mode: state.mode,
            levelIndex: state.levelIndex,
            score: score,
            stars: stars,
            pass: pass,
            elapsed: elapsed,
            wrong: dedupeWords(state.wrong)
        };

        if (lv) {
            var existing = levelRecord(lv.id);
            if (existing || score > 0) {
                var rec = existing || { best: 0, stars: 0, plays: 0 };
                rec.plays = (rec.plays || 0) + 1;
                if (score > rec.best) rec.best = score;
                if (stars > rec.stars) rec.stars = stars;
                progress.levels[lv.id] = rec;
                saveProgress();
            }
        }

        renderResult();
        showView("result");

        // 完整玩完一关才记一次局数（练习不计）
        if (state.mode === "level" && global.GameLimit) {
            global.GameLimit.count();
        }
    }

    function dedupeWords(list) {
        var seen = {};
        return list.filter(function (w) {
            if (seen[w.w]) return false;
            seen[w.w] = true;
            return true;
        });
    }

    function renderResult() {
        var r = lastResult;
        var lv = r.mode === "level" ? LEVELS[r.levelIndex] : null;

        el.resultStars.innerHTML = "";
        for (var i = 0; i < 3; i++) {
            var s = document.createElement(i < r.stars ? "b" : "span");
            s.textContent = "★";
            if (i >= r.stars) s.style.color = "rgba(211,170,114,0.25)";
            el.resultStars.appendChild(s);
        }

        el.resultKicker.textContent = r.mode === "practice"
            ? "自由练习 · " + practiceScopeText()
            : "第 " + lv.id + " 关 · " + lv.name;

        if (r.mode === "practice") {
            el.resultTitle.textContent = "练习完成";
            el.resultText.textContent = "这轮练习第一次答对 " + r.score + " 题。错过的词可以在单词表里再读一遍。";
        } else if (r.pass) {
            var isLast = r.levelIndex >= LEVELS.length - 1;
            el.resultTitle.textContent = isLast ? "全部通关！" : "闯关成功！";
            el.resultText.textContent = isLast
                ? "八关全部走完，单词和拼读都练过一遍了。可以回单词表复习，或挑一关重拿三星。"
                : "第 " + lv.id + " 关通过，第 " + (lv.id + 1) + " 关已解锁。";
        } else {
            el.resultTitle.textContent = "差一点点";
            el.resultText.textContent = "第一次答对 " + r.score + " 题，需要 " + PASS_SCORE + " 题才能过关。把下面的词读两遍，再来一次。";
        }

        el.resultScore.textContent = r.score + " / 10";
        el.resultTime.textContent = formatTime(r.elapsed);
        el.resultRate.textContent = Math.round((r.score / 10) * 100) + "%";

        el.wrongBox.hidden = r.wrong.length === 0;
        el.wrongList.innerHTML = "";
        r.wrong.forEach(function (w) {
            var li = document.createElement("li");
            li.className = "wrong-item";
            li.innerHTML =
                '<span class="wrong-word">' + escapeHtml(w.w) + "</span>" +
                '<span class="wrong-meta">' + escapeHtml(w.zh) + "　" + escapeHtml(Data.phonText(w)) +
                "　" + escapeHtml(w.c) + "</span>";
            var say = document.createElement("button");
            say.type = "button";
            say.className = "wrong-say";
            say.textContent = "🔊";
            say.setAttribute("aria-label", "朗读 " + w.w);
            say.addEventListener("click", function () { speak(w.w); });
            li.appendChild(say);
            el.wrongList.appendChild(li);
        });

        var nextIndex = r.mode === "level" ? r.levelIndex + 1 : -1;
        el.nextLevelBtn.hidden = !(r.mode === "level" && r.pass && nextIndex < LEVELS.length);
        if (r.mode === "level" && r.levelIndex >= LEVELS.length - 1 && r.pass) {
            el.nextLevelBtn.hidden = true;
        }
        el.retryBtn.textContent = r.mode === "practice" ? "再练一轮" : "再玩一次";
    }

    function formatTime(ms) {
        var total = Math.round(ms / 1000);
        var m = Math.floor(total / 60);
        var s = total % 60;
        if (m <= 0) return s + " 秒";
        return m + " 分 " + (s < 10 ? "0" + s : s) + " 秒";
    }

    function escapeHtml(text) {
        return String(text).replace(/[&<>"']/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
        });
    }

    /* ---------------- 单词表 ---------------- */

    var lexGrade = "all";

    function renderLex() {
        var keyword = (el.lexSearch.value || "").trim().toLowerCase();
        var list = Data.words.filter(function (w) {
            if (lexGrade !== "all" && String(w.g) !== String(lexGrade)) return false;
            if (!keyword) return true;
            return (
                w.w.toLowerCase().indexOf(keyword) >= 0 ||
                w.zh.indexOf(keyword) >= 0 ||
                w.c.indexOf(keyword) >= 0 ||
                w.syl.toLowerCase().indexOf(keyword) >= 0
            );
        });

        el.lexCount.textContent = "共 " + list.length + " 个单词";
        el.lexList.innerHTML = "";

        if (!list.length) {
            el.lexList.innerHTML = '<div class="lex-empty">没有找到匹配的单词，换个关键词试试。</div>';
            return;
        }

        var frag = document.createDocumentFragment();
        list.forEach(function (w) {
            var row = document.createElement("div");
            row.className = "lex-row";
            var left = document.createElement("div");
            left.innerHTML =
                '<div class="lex-word">' + escapeHtml(w.w) + "</div>" +
                '<div class="lex-phon">' + escapeHtml(Data.phonText(w)) + "</div>";
            var mid = document.createElement("div");
            mid.className = "lex-mean";
            mid.innerHTML = escapeHtml(w.zh) +
                "<span>" + Data.gradeText(w.g) + " · " + escapeHtml(w.c) + "</span>";
            var say = document.createElement("button");
            say.type = "button";
            say.className = "lex-say";
            say.textContent = "🔊";
            say.setAttribute("aria-label", "朗读 " + w.w);
            say.addEventListener("click", function () { speak(w.w); });
            row.appendChild(left);
            row.appendChild(mid);
            row.appendChild(say);
            frag.appendChild(row);
        });
        el.lexList.appendChild(frag);
    }

    /* ---------------- 练习设置弹窗 ---------------- */

    var practiceChoice = { grade: "all", type: "mix" };

    function openPractice() {
        practiceChoice = { grade: "all", type: "mix" };
        syncPracticeChips();
        el.practiceModal.hidden = false;
    }

    function syncPracticeChips() {
        Array.prototype.forEach.call(el.practiceGrades.children, function (b) {
            b.classList.toggle("is-active", b.dataset.value === practiceChoice.grade);
        });
        Array.prototype.forEach.call(el.practiceTypes.children, function (b) {
            b.classList.toggle("is-active", b.dataset.value === practiceChoice.type);
        });
    }

    /* ---------------- 事件 ---------------- */

    function bindEvents() {
        el.continueBtn.addEventListener("click", function () {
            var idx = Number(el.continueBtn.dataset.target || 0);
            if (!isLocked(idx)) startLevel(idx);
        });

        el.levelGrid.addEventListener("click", function (ev) {
            var card = ev.target.closest(".level-card");
            if (!card) return;
            var idx = Number(card.dataset.index);
            if (isLocked(idx)) {
                return;
            }
            startLevel(idx);
        });

        el.quitBtn.addEventListener("click", function () {
            if (state.answered || state.qIndex === 0) {
                renderHome();
                showView("home");
                return;
            }
            // 中途退出直接放弃本关，不计成绩
            renderHome();
            showView("home");
        });

        el.nextBtn.addEventListener("click", goNext);
        el.hintBtn.addEventListener("click", showHint);
        el.speakBtn.addEventListener("click", function () {
            var say = el.speakBtn.dataset.say;
            if (say) speak(say);
        });

        el.optionsBox.addEventListener("click", function (ev) {
            var btn = ev.target.closest(".option");
            if (btn && !btn.disabled) answerChoice(btn);
        });

        el.submitBtn.addEventListener("click", submitWrite);
        el.answerInput.addEventListener("keydown", function (ev) {
            if (ev.key === "Enter") {
                ev.preventDefault();
                if (!state.answered) submitWrite();
            }
        });

        document.addEventListener("keydown", function (ev) {
            if (state.view !== "quiz" || state.answered) return;
            var tag = (ev.target && ev.target.tagName) || "";
            if (tag === "INPUT" || tag === "TEXTAREA") return;
            if (state.q && state.q.mode === "choice") {
                var n = parseInt(ev.key, 10);
                if (n >= 1 && n <= 4) {
                    var btn = el.optionsBox.children[n - 1];
                    if (btn && !btn.disabled) {
                        ev.preventDefault();
                        answerChoice(btn);
                    }
                }
            }
        });

        el.retryBtn.addEventListener("click", function () {
            var r = lastResult;
            if (!r) return;
            if (r.mode === "practice") startPractice(state.practiceGrades, state.practiceType);
            else startLevel(r.levelIndex);
        });

        el.nextLevelBtn.addEventListener("click", function () {
            var r = lastResult;
            if (!r) return;
            var next = r.levelIndex + 1;
            if (next < LEVELS.length) startLevel(next);
        });

        el.resultHomeBtn.addEventListener("click", function () {
            renderHome();
            showView("home");
        });

        el.lexBtn.addEventListener("click", function () {
            renderLex();
            showView("lex");
        });

        el.lexBackBtn.addEventListener("click", function () {
            renderHome();
            showView("home");
        });

        el.lexTabs.addEventListener("click", function (ev) {
            var tab = ev.target.closest(".tab");
            if (!tab) return;
            lexGrade = tab.dataset.grade;
            Array.prototype.forEach.call(el.lexTabs.children, function (b) {
                b.classList.toggle("is-active", b === tab);
            });
            renderLex();
        });

        el.lexSearch.addEventListener("input", renderLex);

        el.soundBtn.addEventListener("click", function () {
            soundOn = !soundOn;
            el.soundBtn.textContent = soundOn ? "🔊" : "🔇";
            el.soundBtn.setAttribute("aria-pressed", soundOn ? "true" : "false");
            if (!soundOn && global.speechSynthesis) global.speechSynthesis.cancel();
            if (soundOn) tone(520, 0.12, 0);
        });

        el.practiceBtn.addEventListener("click", openPractice);
        el.practiceCancel.addEventListener("click", function () {
            el.practiceModal.hidden = true;
        });
        el.practiceModal.addEventListener("click", function (ev) {
            if (ev.target === el.practiceModal) el.practiceModal.hidden = true;
        });

        el.practiceGrades.addEventListener("click", function (ev) {
            var b = ev.target.closest("[data-value]");
            if (!b) return;
            practiceChoice.grade = b.dataset.value;
            syncPracticeChips();
        });

        el.practiceTypes.addEventListener("click", function (ev) {
            var b = ev.target.closest("[data-value]");
            if (!b) return;
            practiceChoice.type = b.dataset.value;
            syncPracticeChips();
        });

        el.practiceStart.addEventListener("click", function () {
            el.practiceModal.hidden = true;
            startPractice(practiceChoice.grade, practiceChoice.type);
        });
    }

    /* ---------------- 启动 ---------------- */

    function boot() {
        cacheDom();
        bindEvents();
        renderHome();
        showView("home");

        // 调试入口：?level=3 直接进入第 3 关，?practice=1 直接开一轮混合练习
        var search = global.location.search;
        var m = /[?&]level=(\d+)/.exec(search);
        if (m) {
            var idx = Number(m[1]) - 1;
            if (idx >= 0 && idx < LEVELS.length) startLevel(idx);
        } else if (/[?&]practice=1/.test(search)) {
            startPractice("all", "mix");
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
    } else {
        boot();
    }

    // 暴露少量接口，便于自检页调试
    global.EnglishGame = {
        levels: LEVELS,
        startLevel: startLevel,
        startPractice: startPractice,
        state: state,
        progress: progress
    };
})(typeof window !== "undefined" ? window : globalThis);
