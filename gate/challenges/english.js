/* ============================================================
 * challenges/english.js —— 英语单词题型（5 分钟门禁用）
 * 依赖：gate.js + english/english-data.js
 *
 * 门禁模式规则：
 * - 随机从三个年级抽一个单词，出「英翻中 / 中翻英 / 补全单词」选择题
 * - 只能选一次；答错立即公布完整单词、音标与拼读，停留 8 秒后自动换题
 * - 不能跳过，答对才通过
 * ============================================================ */
(function (global) {
    "use strict";

    var Gate = global.Gate;
    if (!Gate) throw new Error("english.js 需要先加载 gate.js");

    var Data = global.EnglishData;
    if (!Data || !Data.makeQuestion) {
        throw new Error("gate/challenges/english.js 需要先加载 english/english-data.js");
    }

    var RETRY_SECONDS = 8;
    var TYPES = ["en2zh", "zh2en", "fill-choice"];

    function create(api) {
        var random = api.random || Math.random;
        var grades = (api.options && api.options.grades) || [1, 2, 3];
        var type = TYPES[Math.floor(random() * TYPES.length)];
        var q = Data.makeQuestion(type, { grades: grades, random: random });
        if (!q) q = Data.makeQuestion("en2zh", { grades: [1, 2, 3], random: random });
        if (!q) throw new Error("英语词库为空");

        var el = document.createElement("div");
        el.className = "chen";

        var promptHtml;
        if (q.type === "fill-choice") {
            promptHtml = '<span class="chen-q">' + q.head +
                '<span class="chen-blank">' + "_".repeat(q.answer.length) + "</span></span>" +
                '<p class="chen-sub">' + escapeHtml(q.word.zh) + " · " + escapeHtml(q.word.ipa) + "</p>";
        } else if (q.type === "en2zh") {
            promptHtml = '<span class="chen-q is-en">' + escapeHtml(q.word.w) + "</span>" +
                '<p class="chen-sub">' + escapeHtml(Data.phonText(q.word)) + "</p>";
        } else {
            promptHtml = '<span class="chen-q is-zh">' + escapeHtml(q.word.zh) + "</span>" +
                '<p class="chen-sub">' + q.gradeText + " · " + escapeHtml(q.word.c) + "</p>";
        }

        el.innerHTML =
            '<p class="chen-label">英语 · ' + q.label + "</p>" +
            '<p class="chen-ask">' + escapeHtml(q.ask) + "</p>" +
            promptHtml +
            '<div class="chen-opts" role="group" aria-label="选项">' +
            q.options.map(function (opt, i) {
                var cls = q.type === "zh2en" ? ' class="chen-en"' : "";
                return (
                    '<button type="button" class="chen-opt" data-right="' +
                    (opt.right ? "1" : "0") +
                    '"><span class="chen-key">' + (i + 1) + "</span><span" + cls + ">" +
                    escapeHtml(opt.text) + "</span></button>"
                );
            }).join("") +
            "</div>" +
            '<div class="chen-result" hidden>' +
            '  <span class="chen-result-label">正确答案</span>' +
            '  <strong class="chen-result-word"></strong>' +
            '  <span class="chen-result-meta"></span>' +
            '  <span class="chen-count"></span>' +
            "</div>" +
            '<p class="chen-msg" role="status" aria-live="polite"></p>';

        var optEls = Array.prototype.slice.call(el.querySelectorAll(".chen-opt"));
        var msgEl = el.querySelector(".chen-msg");
        var resultEl = el.querySelector(".chen-result");
        var resultWordEl = el.querySelector(".chen-result-word");
        var resultMetaEl = el.querySelector(".chen-result-meta");
        var countEl = el.querySelector(".chen-count");
        var answered = false;
        var timer = null;
        var secondsLeft = RETRY_SECONDS;

        function stopTimer() {
            if (timer) {
                clearInterval(timer);
                timer = null;
            }
        }

        function finish(btn) {
            answered = true;
            btn.classList.add("is-right");
            optEls.forEach(function (b) { b.disabled = true; });
            msgEl.className = "chen-msg is-ok";
            msgEl.textContent = "对了！" + q.word.w + " = " + q.word.zh;
            api.pass({ summary: q.word.w + " = " + q.word.zh });
        }

        function revealAnswer(selected) {
            answered = true;
            optEls.forEach(function (b) {
                b.disabled = true;
                if (b.getAttribute("data-right") === "1") b.classList.add("is-right");
            });
            selected.classList.add("is-wrong");
            msgEl.className = "chen-msg is-bad";
            msgEl.textContent = "答错了，这个单词读两遍，下一题马上来。";

            resultWordEl.textContent = q.word.w + " = " + q.word.zh;
            resultMetaEl.textContent = Data.phonText(q.word) + " · " + q.hint;
            resultEl.hidden = false;

            secondsLeft = RETRY_SECONDS;
            countEl.textContent = secondsLeft + " 秒后换一题";
            timer = setInterval(function () {
                secondsLeft--;
                if (secondsLeft <= 0) {
                    stopTimer();
                    api.next();
                    return;
                }
                countEl.textContent = secondsLeft + " 秒后换一题";
            }, 1000);
        }

        function choose(btn) {
            if (answered || btn.disabled) return;
            if (btn.getAttribute("data-right") === "1") {
                finish(btn);
                return;
            }
            revealAnswer(btn);
        }

        el.addEventListener("click", function (ev) {
            var btn = ev.target.closest(".chen-opt");
            if (btn && el.contains(btn)) choose(btn);
        });

        el.addEventListener("keydown", function (ev) {
            var n = parseInt(ev.key, 10);
            if (n >= 1 && n <= optEls.length) {
                ev.preventDefault();
                choose(optEls[n - 1]);
            }
        });

        return {
            el: el,
            meta: function () {
                return q.gradeText + " · " + q.label;
            },
            focus: function () {
                var first = optEls.filter(function (b) { return !b.disabled; })[0];
                if (first) first.focus();
                else el.focus();
            },
            lock: function () {
                stopTimer();
                optEls.forEach(function (b) { b.disabled = true; });
            },
            destroy: function () {
                stopTimer();
            }
        };
    }

    function escapeHtml(text) {
        return String(text).replace(/[&<>"']/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
        });
    }

    Gate.register("english", {
        name: "英语单词",
        desc: "小学 1-3 年级单词：英翻中、中翻英或补全单词，四选一；答错公布答案，8 秒后换题。",
        weight: 1,
        create: create
    });
})(typeof window !== "undefined" ? window : globalThis);
