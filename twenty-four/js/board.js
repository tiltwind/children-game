/* ============================================================
 * board.js —— 24 点棋盘组件（独立页面和门禁共用）
 * 交互：点两张牌 → 选运算符 → 合成一张，直到只剩一张等于目标数。
 * 用法：var board = TF24Board.create(el, { target: 24, onSolved: fn })
 * ============================================================ */
(function (global) {
  "use strict";

  var TF24 = global.TF24;
  if (!TF24) throw new Error("board.js 需要先加载 core.js");

  var OPS = [
    { op: "+", label: "+", name: "加" },
    { op: "-", label: "−", name: "减" },
    { op: "*", label: "×", name: "乘" },
    { op: "/", label: "÷", name: "除" }
  ];

  function opName(op) {
    for (var i = 0; i < OPS.length; i++) if (OPS[i].op === op) return OPS[i].name;
    return op;
  }

  function Board(root, options) {
    this.root = root;
    this.options = options || {};
    this.target = this.options.target || TF24.DEFAULT_TARGET;
    this.puzzle = null;
    this.tiles = [];
    this.selected = [];
    this.history = [];
    this.solved = false;
    this.moves = 0;
    this.hintLevel = 0;
    this.startAt = 0;
    this.solvedAt = 0;
    this.message = { text: "", tone: "idle" };
    this._build();
    this._bind();
  }

  Board.prototype._build = function () {
    var root = this.root;
    root.classList.add("tf24-board");
    root.tabIndex = -1;
    root.innerHTML =
      '<div class="tf24-tiles" role="group" aria-label="牌面"></div>' +
      '<div class="tf24-ops" role="group" aria-label="运算符">' +
      OPS.map(function (o) {
        return (
          '<button type="button" class="tf24-op" data-op="' + o.op +
          '" aria-label="' + o.name + '" disabled>' + o.label + "</button>"
        );
      }).join("") +
      "</div>" +
      '<p class="tf24-status" role="status" aria-live="polite"></p>';

    this.tilesEl = root.querySelector(".tf24-tiles");
    this.opsEl = root.querySelector(".tf24-ops");
    this.statusEl = root.querySelector(".tf24-status");
    this.opEls = Array.prototype.slice.call(root.querySelectorAll(".tf24-op"));
  };

  Board.prototype._bind = function () {
    var self = this;

    this.root.addEventListener("click", function (ev) {
      var tileEl = ev.target.closest(".tf24-tile");
      if (tileEl && self.root.contains(tileEl)) {
        self.selectTile(parseInt(tileEl.getAttribute("data-tile"), 10));
        return;
      }
      var opEl = ev.target.closest(".tf24-op");
      if (opEl && self.root.contains(opEl)) {
        self.applyOp(opEl.getAttribute("data-op"));
        return;
      }
    });

    this.root.addEventListener("keydown", function (ev) {
      if (self.solved) return;
      var key = ev.key;
      if (key >= "1" && key <= "4") {
        ev.preventDefault();
        self.selectTile(parseInt(key, 10) - 1);
        return;
      }
      if (key === "+" || key === "-" || key === "*" || key === "/") {
        ev.preventDefault();
        self.applyOp(key);
      } else if (key === "Backspace") {
        ev.preventDefault();
        self.undo();
      } else if (key === "r" || key === "R") {
        ev.preventDefault();
        self.reset();
      } else if (key === "Enter" && self.solved && self.options.onNext) {
        ev.preventDefault();
        self.options.onNext();
      }
    });
  };

  Board.prototype.load = function (puzzle) {
    this.puzzle = puzzle;
    this.target = puzzle.target || this.target;
    this.solved = false;
    this.solvedAt = 0;
    this.moves = 0;
    this.hintLevel = 0;
    this.history = [];
    this.selected = [];
    this.startAt = Date.now();
    this.allowFraction = this.options.allowFraction != null
      ? !!this.options.allowFraction
      : !!(puzzle && puzzle.requiresFraction);
    this.tiles = puzzle.numbers.map(function (n, i) {
      return { id: i, value: TF24.F(n, 1), tree: { num: n } };
    });
    this.message = {
      text: "点两张牌，再选一个运算符，顺序豆豆来排～",
      tone: "idle"
    };
    this.render();
    this.root.focus({ preventScroll: true });
  };

  Board.prototype.reset = function () {
    if (!this.puzzle) return;
    this.load(this.puzzle);
    this.message = { text: "已重新开始", tone: "idle" };
    this.render();
  };

  Board.prototype.elapsed = function () {
    if (!this.startAt) return 0;
    var end = this.solved && this.solvedAt ? this.solvedAt : Date.now();
    return Math.max(0, Math.floor((end - this.startAt) / 1000));
  };

  Board.prototype.tileById = function (id) {
    for (var i = 0; i < this.tiles.length; i++) {
      if (this.tiles[i].id === id) return this.tiles[i];
    }
    return null;
  };

  Board.prototype.selectTile = function (index) {
    if (this.solved || this.locked) return;
    var tile = this.tiles[index];
    if (!tile) return;

    var at = this.selected.indexOf(tile.id);
    if (at >= 0) {
      this.selected.splice(at, 1);
    } else {
      if (this.selected.length >= 2) this.selected.shift();
      this.selected.push(tile.id);
    }

    if (this.selected.length === 2) {
      var a = this.tileById(this.selected[0]);
      var b = this.tileById(this.selected[1]);
      this.message = {
        text:
          "已选 " + TF24.fText(a.value) + " 和 " + TF24.fText(b.value) +
          "，再选一个运算符吧，顺序豆豆来排",
        tone: "ready"
      };
    } else if (this.selected.length === 1) {
      var one = this.tileById(this.selected[0]);
      this.message = { text: "已选 " + TF24.fText(one.value) + "，再点一张牌", tone: "idle" };
    } else {
      this.message = { text: "点两张牌，再选一个运算符，顺序豆豆来排～", tone: "idle" };
    }
    this.render();
  };

  Board.prototype.applyOp = function (op) {
    if (this.solved || this.locked) return;
    if (this.selected.length !== 2) {
      this.message = { text: "先点两张牌，再选运算符", tone: "bad" };
      this.render();
      return;
    }

    var a = this.tileById(this.selected[0]);
    var b = this.tileById(this.selected[1]);
    if (!a || !b) return;

    // 顺序由牌面自动决定，用户不需要关心谁先谁后。
    var left = a;
    var right = b;
    var value = null;
    var note = "";

    if (op === "-") {
      // 减法永远大数减小数，不出现负数
      if (TF24.fSub(a.value, b.value).n < 0) {
        left = b;
        right = a;
        note = "（自动大数减小数）";
      }
      value = TF24.fSub(left.value, right.value);
    } else if (op === "+") {
      value = TF24.fAdd(a.value, b.value);
    } else if (op === "*") {
      value = TF24.fMul(a.value, b.value);
    } else {
      var q1 = TF24.fDiv(a.value, b.value);
      var q2 = TF24.fDiv(b.value, a.value);

      if (!q1 && !q2) {
        this.message = { text: "不能除以 0 哦，换一对牌试试", tone: "bad" };
        this.render();
        return;
      }

      // 优先选能整除的方向
      if (q1 && q1.d === 1) {
        value = q1;
      } else if (q2 && q2.d === 1) {
        left = b;
        right = a;
        value = q2;
        note = "（自动调整顺序整除）";
      } else if (!this.allowFraction) {
        this.message = {
          text:
            TF24.fText(a.value) + " 和 " + TF24.fText(b.value) +
            " 除不尽。换一对牌，或者试试加、减、乘。",
          tone: "bad"
        };
        this.render();
        return;
      } else {
        // 这题本身必须用分数，仍按大数在前，顺序不用用户操心
        if (TF24.fSub(b.value, a.value).n > 0) {
          left = b;
          right = a;
        }
        value = TF24.fDiv(left.value, right.value);
        note = "（先算出分数，后面还能接着用）";
      }
    }

    if (!value) {
      this.message = { text: "这一步没算出来，换一对牌试试看", tone: "bad" };
      this.render();
      return;
    }

    this.history.push({
      tiles: this.tiles.map(function (t) {
        return { id: t.id, value: t.value, tree: t.tree };
      }),
      selected: this.selected.slice(),
      message: this.message
    });

    var tree = { op: op, a: left.tree, b: right.tree };
    var remaining = this.tiles.filter(function (t) {
      return t.id !== a.id && t.id !== b.id;
    });
    remaining.push({ id: a.id, value: value, tree: tree, merged: true });
    remaining.sort(function (x, y) {
      return x.id - y.id;
    });

    this.tiles = remaining;
    this.selected = [];
    this.moves++;

    if (this.tiles.length === 1) {
      if (TF24.fEqualsNumber(value, this.target)) {
        this._succeed(TF24.formatTree(tree), "merge");
        return;
      }
      this.message = {
        text: "牌用完啦，结果是 " + TF24.fText(value) + "，还不是 " + this.target + "。撤销一步再试试～",
        tone: "bad"
      };
    } else {
      var leftCount = this.tiles.length;
      var text = "变成 " + TF24.fText(value) + " 啦！还剩 " + leftCount + " 张牌" + note;
      if (value.d !== 1) text += "（分数也能接着算）";
      this.message = { text: text, tone: "idle" };
    }
    this.render();
  };

  Board.prototype.undo = function () {
    if (!this.history.length || this.solved) return;
    var snap = this.history.pop();
    this.tiles = snap.tiles;
    this.selected = [];
    this.moves = Math.max(0, this.moves - 1);
    this.message = { text: "退回来啦，再试一次～", tone: "idle" };
    this.render();
  };

  Board.prototype.hint = function () {
    if (this.solved) return { text: "已经解出来了", solution: "" };
    this.hintLevel++;
    var h = TF24.hint(this.puzzle, this.hintLevel);
    this.message = { text: h.text, tone: "hint" };
    this.render();
    if (this.options.onHint) this.options.onHint(h, this.hintLevel);
    return h;
  };

  Board.prototype.showMessage = function (text, tone) {
    this.message = { text: text, tone: tone || "idle" };
    this.render();
  };

  /**
   * 直接提交完整算式
   * @returns {ok:boolean, error?:string}
   */
  Board.prototype.submitExpression = function (text) {
    if (this.solved) return { ok: false, error: "这题已经解出来了" };
    var res = TF24.checkExpression(text, this.puzzle.numbers, this.target);
    if (res.ok) {
      this.tiles = [{ id: 0, value: TF24.F(this.target, 1), tree: res.tree, merged: true }];
      this._succeed(res.expression, "typed");
      return { ok: true };
    }
    this.message = { text: res.error, tone: "bad" };
    this.render();
    if (this.options.onMistake) this.options.onMistake(res.error);
    return { ok: false, error: res.error };
  };

  Board.prototype._succeed = function (expression, via) {
    this.solved = true;
    this.solvedAt = Date.now();
    this.message = {
      text: "解出来了：" + expression + " = " + this.target,
      tone: "ok"
    };
    this.render();
    if (this.options.onSolved) {
      this.options.onSolved({
        expression: expression,
        seconds: this.elapsed(),
        moves: this.moves,
        via: via,
        puzzle: this.puzzle
      });
    }
  };

  Board.prototype.revealAnswer = function () {
    var text = this.puzzle && this.puzzle.bestSolution ? this.puzzle.bestSolution : "";
    this.message = { text: "参考答案：" + text + " = " + this.target, tone: "hint" };
    this.render();
    return text;
  };

  Board.prototype.setLocked = function (locked) {
    this.locked = !!locked;
    this.render();
  };

  Board.prototype.render = function () {
    var target = this.target;
    var selected = this.selected;
    var self = this;

    this.tilesEl.innerHTML = this.tiles
      .map(function (t, i) {
        var isSel = selected.indexOf(t.id) >= 0;
        var text = TF24.fText(t.value);
        var cls =
          "tf24-tile" +
          (isSel ? " is-selected" : "") +
          (t.merged ? " is-merged" : "") +
          (text.length > 2 ? " is-long" : "");
        return (
          '<button type="button" class="' + cls + '" data-tile="' + i +
          '" aria-pressed="' + (isSel ? "true" : "false") + '">' +
          '<span class="tf24-tile-key">' + (i + 1) + "</span>" +
          '<span class="tf24-tile-value">' + text + "</span>" +
          "</button>"
        );
      })
      .join("");

    var ready = selected.length === 2 && !this.solved;
    this.opEls.forEach(function (el) {
      el.disabled = !ready;
    });
    this.opsEl.classList.toggle("is-ready", ready);

    this.statusEl.textContent = this.message.text;
    this.statusEl.setAttribute(
      "data-tone",
      this.message.tone + (this.solved ? " is-solved" : "")
    );
    this.root.setAttribute("data-target", String(target));
    if (self.options.onRender) self.options.onRender(this);
  };

  Board.prototype.destroy = function () {
    this.root.innerHTML = "";
    this.root.classList.remove("tf24-board");
  };

  function create(root, options) {
    return new Board(root, options);
  }

  // 供外部做无 DOM 校验
  function check(text, numbers, target) {
    return TF24.checkExpression(text, numbers, target);
  }

  global.TF24Board = {
    create: create,
    Board: Board,
    opName: opName,
    check: check
  };
})(typeof window !== "undefined" ? window : globalThis);
