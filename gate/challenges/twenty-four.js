/* ============================================================
 * challenges/twenty-four.js —— 24 点题型
 * 依赖：core.js、board.js、gate.js
 * ============================================================ */
(function (global) {
  "use strict";

  var TF24 = global.TF24;
  var Board = global.TF24Board;
  var Gate = global.Gate;
  if (!TF24 || !Board || !Gate) throw new Error("twenty-four.js 需要先加载 core.js、board.js、gate.js");

  // 通过次数越多，题目越难：经典 → 进阶 → 高手
  var LADDER = ["classic", "classic", "hard", "hard", "expert", "expert"];

  function modeFor(api) {
    var mode = (api.options && api.options.mode) || "auto";
    if (mode === "auto") mode = LADDER[Math.min(api.passed, LADDER.length - 1)];
    return TF24.MODES[mode] ? mode : "classic";
  }

  function create(api) {
    var target = api.target || 24;
    var mode = modeFor(api);

    var el = document.createElement("div");
    el.className = "ch24";
    el.innerHTML =
      '<div class="ch24-board"></div>' +
      '<div class="ch24-tools">' +
      '  <button type="button" data-ch24="hint">提示一步</button>' +
      '  <button type="button" data-ch24="undo">撤销</button>' +
      '  <button type="button" data-ch24="reset">重开</button>' +
      "</div>" +
      '<form class="ch24-type" autocomplete="off">' +
      '  <label for="ch24-input">也可以直接输入完整算式</label>' +
      '  <div class="ch24-type-row">' +
      '    <input id="ch24-input" type="text" inputmode="text" spellcheck="false" placeholder="例如 (6 + 6) × (2 - 1)">' +
      '    <button type="submit">验证</button>' +
      "  </div>" +
      '  <p class="ch24-msg" role="status" aria-live="polite"></p>' +
      "</form>";

    var puzzle = null;
    try {
      puzzle = TF24.generate({ mode: mode, target: target });
    } catch (e) {
      puzzle = null;
    }
    if (!puzzle || !puzzle.solvable) puzzle = TF24.analyze([6, 6, 6, 6], target);

    var boardEl = el.querySelector(".ch24-board");
    var toolsEl = el.querySelector(".ch24-tools");
    var formEl = el.querySelector(".ch24-type");
    var inputEl = el.querySelector("#ch24-input");
    var msgEl = el.querySelector(".ch24-msg");
    var hintBtn = el.querySelector('[data-ch24="hint"]');

    var board = Board.create(boardEl, {
      target: target,
      onSolved: function (info) {
        api.pass({
          summary: (info.expression || "") + " = " + target,
          expression: info.expression,
          seconds: info.seconds
        });
      },
      onMistake: function () {
        msgEl.textContent = "";
      }
    });
    board.load(puzzle);

    var solved = false;
    var hintUsed = false;

    function setMsg(text, tone) {
      msgEl.textContent = text || "";
      msgEl.setAttribute("data-tone", tone || "idle");
    }

    function disableAll() {
      solved = true;
      board.setLocked(true);
      Array.prototype.forEach.call(toolsEl.querySelectorAll("button"), function (b) {
        b.disabled = true;
      });
      inputEl.disabled = true;
      formEl.querySelector('button[type="submit"]').disabled = true;
    }

    toolsEl.addEventListener("click", function (ev) {
      var btn = ev.target.closest("[data-ch24]");
      if (!btn || solved) return;
      var act = btn.getAttribute("data-ch24");
      if (act === "hint") {
        if (hintUsed) return;
        hintUsed = true;
        btn.disabled = true;
        var h = board.hint();
        setMsg(h.text, "hint");
      } else if (act === "undo") {
        board.undo();
        setMsg("已撤销一步", "idle");
      } else if (act === "reset") {
        board.reset();
        setMsg("重新开始", "idle");
      }
    });

    formEl.addEventListener("submit", function (ev) {
      ev.preventDefault();
      if (solved) return;
      var text = inputEl.value;
      var res = board.submitExpression(text);
      if (res.ok) {
        inputEl.value = "";
        setMsg("", "idle");
      } else {
        setMsg(res.error || "再想一想", "bad");
      }
    });

    el.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter" && ev.target === inputEl) {
        ev.preventDefault();
        formEl.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      }
    });

    var modeInfo = TF24.MODES[mode];

    return {
      el: el,
      meta: function () {
        return modeInfo.name + " · " + (puzzle.difficultyLabel || "适中");
      },
      focus: function () {
        board.root.focus({ preventScroll: true });
      },
      lock: disableAll,
      destroy: function () {
        board.destroy();
      }
    };
  }

  Gate.register("twenty-four", {
    name: "24 点",
    desc: "四张牌各用一次，四则运算凑出 24。",
    weight: 1,
    create: create
  });
})(typeof window !== "undefined" ? window : globalThis);
