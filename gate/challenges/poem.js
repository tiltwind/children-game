/* ============================================================
 * challenges/poem.js —— 唐诗接下句题型
 * 依赖：gate.js + poem/poem-data.js；题库内置，不访问网络
 *
 * 门禁模式规则：
 * - 只能选一次；答错立即公布正确答案，停留 8 秒后自动换新题
 * - 不能跳过题目，答对才通过
 * ============================================================ */
(function (global) {
  "use strict";

  var Gate = global.Gate;
  if (!Gate) throw new Error("poem.js 需要先加载 gate.js");

  var Data = global.PoemData;
  if (!Data || !Data.pickQuestion) {
    throw new Error("poem.js 需要先加载 poem/poem-data.js");
  }

  var RETRY_SECONDS = 8;

  function create(api) {
    var random = api.random || Math.random;
    var answer = Data.pickQuestion(random, {
      group: (api.options && api.options.group) || "all"
    });
    if (!answer) throw new Error("唐诗题库为空");

    var options = answer.options;

    var el = document.createElement("div");
    el.className = "chpoem";

    var optionsHtml = options
      .map(function (opt, i) {
        return (
          '<button type="button" class="chpoem-opt" data-right="' +
          (opt.right ? "1" : "0") +
          '"><span class="chpoem-key">' +
          (i + 1) +
          "</span><span>" +
          opt.text +
          "</span></button>"
        );
      })
      .join("");

    el.innerHTML =
      '<p class="chpoem-label">唐诗 · 接下句</p>' +
      '<p class="chpoem-q">“' +
      answer.up +
      '”</p>' +
      '<p class="chpoem-ask">下一句是？</p>' +
      '<div class="chpoem-opts" role="group" aria-label="选项">' +
      optionsHtml +
      "</div>" +
      '<div class="chpoem-result" hidden>' +
      '  <span class="chpoem-result-label">正确答案</span>' +
      '  <strong class="chpoem-result-text"></strong>' +
      '  <span class="chpoem-result-meta">《' +
      answer.title +
      "》 · " +
      answer.author +
      "</span>" +
      '  <span class="chpoem-count"></span>' +
      "</div>" +
      '<p class="chpoem-msg" role="status" aria-live="polite"></p>';

    var optEls = Array.prototype.slice.call(el.querySelectorAll(".chpoem-opt"));
    var msgEl = el.querySelector(".chpoem-msg");
    var resultEl = el.querySelector(".chpoem-result");
    var resultTextEl = el.querySelector(".chpoem-result-text");
    var countEl = el.querySelector(".chpoem-count");
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
      optEls.forEach(function (b) {
        b.disabled = true;
      });
      msgEl.textContent = "对了，出自《" + answer.title + "》· " + answer.author;
      api.pass({ summary: "《" + answer.title + "》 · " + answer.author });
    }

    function revealAnswer(selected) {
      answered = true;
      optEls.forEach(function (b) {
        b.disabled = true;
        if (b.getAttribute("data-right") === "1") b.classList.add("is-right");
      });
      selected.classList.add("is-wrong");
      msgEl.textContent = "答错了，记住这句，下一题马上来。";
      resultTextEl.textContent = "“" + answer.down + "”";
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
      var btn = ev.target.closest(".chpoem-opt");
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
        return "名句接龙";
      },
      focus: function () {
        var first = optEls.filter(function (b) {
          return !b.disabled;
        })[0];
        if (first) first.focus();
        else el.focus();
      },
      lock: function () {
        stopTimer();
        optEls.forEach(function (b) {
          b.disabled = true;
        });
      },
      destroy: function () {
        stopTimer();
      }
    };
  }

  Gate.register("poem", {
    name: "唐诗",
    desc: "给出上句，从四个选项里选出正确下句；答错公布答案，8 秒后自动换题。",
    weight: 1,
    create: create
  });
})(typeof window !== "undefined" ? window : globalThis);
