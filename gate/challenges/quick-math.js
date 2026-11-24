/* ============================================================
 * challenges/quick-math.js —— 口算填空题型（输入答案）
 * 依赖：gate.js
 *
 * 规则：算对才能通过；答错不公布答案，重算即可，两次错误后给提示。
 * 难度随通过次数上升：两位数加减 → 三位数加减 / 乘法 → 两位数乘法。
 * ============================================================ */
(function (global) {
  "use strict";

  var Gate = global.Gate;
  if (!Gate) throw new Error("quick-math.js 需要先加载 gate.js");

  function pick(random, n) {
    return Math.floor(random() * n);
  }

  function makeQuestion(passed, random) {
    var stage = Math.min(2, Math.floor(passed / 2));

    if (stage === 0) {
      if (random() < 0.55) {
        var a1 = 21 + pick(random, 58); // 21-78
        var b1 = 12 + pick(random, 47); // 12-58
        return {
          text: a1 + " + " + b1 + " = ?",
          answer: a1 + b1,
          hint: "先加整十：" + a1 + " + " + (Math.floor(b1 / 10) * 10) + " = " + (a1 + Math.floor(b1 / 10) * 10) + "，再加 " + (b1 % 10) + "。"
        };
      }
      var a2 = 45 + pick(random, 50);
      var b2 = 9 + pick(random, 31);
      return {
        text: a2 + " − " + b2 + " = ?",
        answer: a2 - b2,
        hint: b2 >= 10
          ? "先减整十，再减个位：" + a2 + " − " + (Math.floor(b2 / 10) * 10) + " = " + (a2 - Math.floor(b2 / 10) * 10) + "，再减 " + (b2 % 10) + "。"
          : "直接减个位：" + a2 + " − " + b2 + "。"
      };
    }

    if (stage === 1) {
      var kind = random();
      if (kind < 0.4) {
        var a3 = 120 + pick(random, 560); // 120-679
        var b3 = 30 + pick(random, 260); // 30-289
        return {
          text: a3 + " + " + b3 + " = ?",
          answer: a3 + b3,
          hint: "按百位、十位、个位分开加，最后合起来。"
        };
      }
      if (kind < 0.75) {
        var a4 = 300 + pick(random, 490);
        var b4 = 60 + pick(random, 220);
        return {
          text: a4 + " − " + b4 + " = ?",
          answer: a4 - b4,
          hint: "先减百位和十位，再处理个位。"
        };
      }
      var a5 = 13 + pick(random, 76);
      var b5 = 3 + pick(random, 6); // 3-8
      return {
        text: a5 + " × " + b5 + " = ?",
        answer: a5 * b5,
        hint: "拆开算：" + a5 + " × " + b5 + " = " + a5 + " × " + (b5 - 1) + " + " + a5 + "。"
      };
    }

    var a6 = 12 + pick(random, 12); // 12-23
    var b6 = 11 + pick(random, 8); // 11-18
    return {
      text: a6 + " × " + b6 + " = ?",
      answer: a6 * b6,
      hint: "拆成整十：" + a6 + " × " + b6 + " = " + a6 + " × 10 + " + a6 + " × " + (b6 - 10) + "。"
    };
  }

  function create(api) {
    var random = api.random || Math.random;
    var q = makeQuestion(api.passed || 0, random);
    var wrong = 0;
    var done = false;

    var el = document.createElement("div");
    el.className = "chcalc";

    el.innerHTML =
      '<p class="chcalc-label">口算通行证 · 输入答案</p>' +
      '<p class="chcalc-q">' + q.text + '</p>' +
      '<div class="chcalc-row">' +
      '  <input class="chcalc-input" type="text" inputmode="numeric" autocomplete="off" ' +
      '    aria-label="答案" placeholder="输入数字" />' +
      '  <button type="button" class="chcalc-submit">交卷</button>' +
      "</div>" +
      '<p class="chcalc-hint" hidden></p>' +
      '<p class="chcalc-msg" role="status" aria-live="polite"></p>';

    var input = el.querySelector(".chcalc-input");
    var submit = el.querySelector(".chcalc-submit");
    var hintEl = el.querySelector(".chcalc-hint");
    var msgEl = el.querySelector(".chcalc-msg");

    function setMsg(text, kind) {
      msgEl.textContent = text;
      msgEl.classList.remove("is-ok", "is-bad");
      if (kind) msgEl.classList.add(kind);
    }

    function check() {
      if (done) return;
      var raw = String(input.value || "").trim();
      if (!raw) {
        setMsg("先写一个数字再交卷。", "is-bad");
        input.focus();
        return;
      }
      if (!/^-?\d+$/.test(raw)) {
        setMsg("只填数字就可以了。", "is-bad");
        input.focus();
        return;
      }
      var value = Number(raw);
      if (value === q.answer) {
        done = true;
        input.disabled = true;
        submit.disabled = true;
        el.classList.add("is-passed");
        setMsg("通过！" + q.text.replace("= ?", "= " + q.answer), "is-ok");
        api.pass({ summary: "口算 · " + q.text.replace("= ?", "= " + q.answer) });
        return;
      }

      wrong += 1;
      el.classList.remove("is-wrong");
      void el.offsetWidth;
      el.classList.add("is-wrong");
      if (wrong >= 2 && hintEl.hidden) {
        hintEl.hidden = false;
        hintEl.textContent = "提示：" + q.hint;
        setMsg("还差一点，按提示再算一次。", "is-bad");
      } else {
        setMsg("答案不对，再算一遍 —— 不用急，慢慢来。", "is-bad");
      }
      input.select();
      api.clear();
    }

    input.addEventListener("input", function () {
      api.clear();
      setMsg("", null);
    });

    input.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") {
        ev.preventDefault();
        check();
      }
    });

    submit.addEventListener("click", check);

    return {
      el: el,
      meta: function () {
        return wrong >= 2 ? "已给提示" : "算对才能继续";
      },
      focus: function () {
        input.focus();
        input.select();
      },
      destroy: function () {
        el.classList.remove("is-wrong");
      }
    };
  }

  Gate.register("quick-math", {
    name: "口算",
    weight: 1,
    create: create
  });
})(typeof window !== "undefined" ? window : globalThis);
