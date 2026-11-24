/* ============================================================
 * core.js —— 24 点核心引擎
 * 职责：分数精确运算、全解枚举与去重、难度评级、
 *       多模式随机出题、算式校验、提示与每日题。
 * 用法：<script src="js/core.js"></script> 后使用 window.TF24
 * ============================================================ */
(function (global) {
  "use strict";

  var DEFAULT_TARGET = 24;
  var ALL_OPS = ["+", "-", "*", "/"];
  var PREC = { "+": 1, "-": 1, "*": 2, "/": 2 };
  var SYM = { "+": "+", "-": "−", "*": "×", "/": "÷" };

  /* ---------------- 分数 ---------------- */

  function gcd(a, b) {
    a = Math.abs(a);
    b = Math.abs(b);
    while (b) {
      var t = a % b;
      a = b;
      b = t;
    }
    return a || 1;
  }

  // 归一化分数：分母为正，约分到最简
  function F(n, d) {
    if (d === 0) return null;
    if (d < 0) {
      n = -n;
      d = -d;
    }
    var g = gcd(n, d);
    return { n: n / g, d: d / g };
  }

  function fAdd(a, b) {
    return F(a.n * b.d + b.n * a.d, a.d * b.d);
  }

  function fSub(a, b) {
    return F(a.n * b.d - b.n * a.d, a.d * b.d);
  }

  function fMul(a, b) {
    return F(a.n * b.n, a.d * b.d);
  }

  function fDiv(a, b) {
    if (b.n === 0) return null;
    return F(a.n * b.d, a.d * b.n);
  }

  function fEqualsNumber(f, value) {
    return f.n === value * f.d;
  }

  // 分数转显示文本：3、8/3、−7
  function fText(f) {
    if (!f) return "—";
    if (f.d === 1) return String(f.n);
    return f.n + "/" + f.d;
  }

  /* ---------------- 表达式树与格式化 ---------------- */

  function leaf(num) {
    return { num: num };
  }

  function node(op, a, b) {
    return { op: op, a: a, b: b };
  }

  // 按运算优先级输出最简括号
  function formatTree(t, parentOp, isRight) {
    if (t.num !== undefined) return String(t.num);
    var s =
      formatTree(t.a, t.op, false) + " " + SYM[t.op] + " " + formatTree(t.b, t.op, true);
    if (parentOp) {
      var p = PREC[t.op];
      var pp = PREC[parentOp];
      var need = p < pp;
      if (!need && p === pp && isRight && (parentOp === "-" || parentOp === "/")) need = true;
      if (need) s = "(" + s + ")";
    }
    return s;
  }

  // 规范形：加法/乘法链拍平并排序，用于判重
  function canon(t) {
    if (t.num !== undefined) return String(t.num);
    if (t.op === "+" || t.op === "*") {
      var parts = [];
      (function flat(n) {
        if (n.op === t.op) {
          flat(n.a);
          flat(n.b);
        } else {
          parts.push(canon(n));
        }
      })(t);
      parts.sort();
      return "(" + parts.join(t.op) + ")";
    }
    return "(" + canon(t.a) + t.op + canon(t.b) + ")";
  }

  function evalTree(t) {
    if (t.num !== undefined) return F(t.num, 1);
    var a = evalTree(t.a);
    var b = evalTree(t.b);
    if (!a || !b) return null;
    if (t.op === "+") return fAdd(a, b);
    if (t.op === "-") return fSub(a, b);
    if (t.op === "*") return fMul(a, b);
    return fDiv(a, b);
  }

  // 找出算式树里出现分数中间结果的步骤（叶子不算）
  function fractionalSteps(tree) {
    var out = [];
    (function walk(t) {
      if (!t || t.num !== undefined) return;
      walk(t.a);
      walk(t.b);
      var v = evalTree(t);
      if (v && v.d !== 1) out.push({ text: formatTree(t), value: v });
    })(tree);
    return out;
  }

  /* ---------------- 求解 ---------------- */

  function normalizeOps(ops) {
    if (!ops) return ALL_OPS.slice();
    if (typeof ops === "string") ops = ops.split("");
    var out = [];
    for (var i = 0; i < ops.length; i++) {
      var o = ops[i];
      if (o === "×") o = "*";
      if (o === "÷") o = "/";
      if (o === "−") o = "-";
      if (ALL_OPS.indexOf(o) >= 0 && out.indexOf(o) < 0) out.push(o);
    }
    return out.length ? out : ALL_OPS.slice();
  }

  /**
   * 枚举全部不同解法（数字按顺序各用一次，中间结果用分数精确计算）
   * @returns {Array<{key, tree, expr, hasFraction}>}
   */
  function enumerate(numbers, target, ops) {
    var allowed = normalizeOps(ops);
    var found = new Map();

    var items = numbers.map(function (n, i) {
      return { v: F(n, 1), t: leaf(n), hasFraction: false, idx: i };
    });

    function rec(list) {
      if (list.length === 1) {
        var it = list[0];
        if (fEqualsNumber(it.v, target)) {
          var key = canon(it.t);
          if (!found.has(key)) {
            found.set(key, {
              key: key,
              tree: it.t,
              expr: formatTree(it.t),
              hasFraction: it.hasFraction
            });
          }
        }
        return;
      }

      for (var i = 0; i < list.length; i++) {
        for (var j = i + 1; j < list.length; j++) {
          var rest = [];
          for (var k = 0; k < list.length; k++) {
            if (k !== i && k !== j) rest.push(list[k]);
          }
          var A = list[i];
          var B = list[j];

          for (var oi = 0; oi < allowed.length; oi++) {
            var op = allowed[oi];
            var variants = [];
            if (op === "+" || op === "*") {
              variants = [[A, B]];
            } else if (op === "-") {
              variants = [[A, B], [B, A]];
            } else if (op === "/") {
              variants = [];
              if (B.v.n !== 0) variants.push([A, B]);
              if (A.v.n !== 0) variants.push([B, A]);
            }

            for (var vi = 0; vi < variants.length; vi++) {
              var x = variants[vi][0];
              var y = variants[vi][1];
              var v;
              if (op === "+") v = fAdd(x.v, y.v);
              else if (op === "-") v = fSub(x.v, y.v);
              else if (op === "*") v = fMul(x.v, y.v);
              else v = fDiv(x.v, y.v);
              if (!v) continue;

              rec(
                rest.concat([
                  {
                    v: v,
                    t: node(op, x.t, y.t),
                    hasFraction: x.hasFraction || y.hasFraction || v.d !== 1
                  }
                ])
              );
            }
          }
        }
      }
    }

    rec(items);
    return Array.from(found.values());
  }

  /**
   * 带提前终止的解法扫描：只判断“够不够/多不多”，用于快速筛题。
   * limits: { minSolutions, maxSolutions, needInteger, forbidInteger, firstOnly }
   * 返回 { count, intCount, stopped, complete }
   */
  function scanSolutions(numbers, target, ops, limits) {
    limits = limits || {};
    var allowed = normalizeOps(ops);
    var found = new Set();
    var state = { stop: false, reason: null };
    var intCount = 0;

    function stop(reason) {
      state.stop = true;
      state.reason = reason;
    }

    function record(key, hasFraction) {
      if (found.has(key)) return;
      found.add(key);
      if (!hasFraction) intCount++;

      if (limits.forbidInteger && !hasFraction) {
        stop("hasInteger");
        return;
      }
      if (limits.maxSolutions && found.size > limits.maxSolutions) {
        stop("tooMany");
        return;
      }
      if (limits.firstOnly) {
        stop("first");
        return;
      }
      if (limits.minSolutions && found.size >= limits.minSolutions) {
        if (!limits.needInteger || intCount > 0) stop("enough");
      }
    }

    var items = numbers.map(function (n) {
      return { v: F(n, 1), t: leaf(n), hasFraction: false };
    });

    function rec(list) {
      if (state.stop) return;
      if (list.length === 1) {
        var it = list[0];
        if (fEqualsNumber(it.v, target)) record(canon(it.t), it.hasFraction);
        return;
      }

      for (var i = 0; i < list.length && !state.stop; i++) {
        for (var j = i + 1; j < list.length && !state.stop; j++) {
          var rest = [];
          for (var k = 0; k < list.length; k++) {
            if (k !== i && k !== j) rest.push(list[k]);
          }
          var A = list[i];
          var B = list[j];

          for (var oi = 0; oi < allowed.length && !state.stop; oi++) {
            var op = allowed[oi];
            var variants = [];
            if (op === "+" || op === "*") variants = [[A, B]];
            else if (op === "-") variants = [[A, B], [B, A]];
            else if (op === "/") {
              variants = [];
              if (B.v.n !== 0) variants.push([A, B]);
              if (A.v.n !== 0) variants.push([B, A]);
            }

            for (var vi = 0; vi < variants.length && !state.stop; vi++) {
              var x = variants[vi][0];
              var y = variants[vi][1];
              var v;
              if (op === "+") v = fAdd(x.v, y.v);
              else if (op === "-") v = fSub(x.v, y.v);
              else if (op === "*") v = fMul(x.v, y.v);
              else v = fDiv(x.v, y.v);
              if (!v) continue;

              rec(
                rest.concat([
                  {
                    v: v,
                    t: node(op, x.t, y.t),
                    hasFraction: x.hasFraction || y.hasFraction || v.d !== 1
                  }
                ])
              );
            }
          }
        }
      }
    }

    rec(items);
    return {
      count: found.size,
      intCount: intCount,
      stopped: state.reason,
      complete: !state.stop
    };
  }

  function difficultyOf(info, maxNum) {
    var base = 5;
    if (info.solutionCount >= 12) base = 1;
    else if (info.solutionCount >= 6) base = 2;
    else if (info.solutionCount >= 3) base = 3;
    else if (info.solutionCount === 2) base = 4;
    if (info.requiresFraction) base += 1;
    if (maxNum >= 11) base += 0.5;
    return Math.min(5, Math.max(1, Math.round(base * 10) / 10));
  }

  function difficultyLabel(score) {
    if (score <= 2) return "轻松";
    if (score <= 3) return "适中";
    if (score <= 4) return "烧脑";
    return "硬核";
  }

  function analyze(numbers, target, ops) {
    target = target || DEFAULT_TARGET;
    var solutions = enumerate(numbers, target, ops);
    var integerSolutions = solutions.filter(function (s) {
      return !s.hasFraction;
    });

    // 有整数解法时优先排在前面：提示与参考答案默认给整数路线
    var ordered = solutions.slice().sort(function (a, b) {
      if (a.hasFraction !== b.hasFraction) return a.hasFraction ? 1 : -1;
      return a.expr.length - b.expr.length;
    });

    var info = {
      numbers: numbers.slice(),
      target: target,
      solutions: ordered.slice(0, 40).map(function (s) {
        return s.expr;
      }),
      solutionTrees: ordered.slice(0, 40).map(function (s) {
        return s.tree;
      }),
      allSolutions: ordered,
      solutionCount: solutions.length,
      integerSolutionCount: integerSolutions.length,
      requiresFraction: solutions.length > 0 && integerSolutions.length === 0,
      solvable: solutions.length > 0,
      maxNumber: Math.max.apply(null, numbers),
      difficulty: 5,
      difficultyLabel: "硬核"
    };

    if (solutions.length) {
      info.difficulty = difficultyOf(info, info.maxNumber);
      info.difficultyLabel = difficultyLabel(info.difficulty);
      info.bestSolution = ordered[0].expr;
      info.bestTree = ordered[0].tree;
    } else {
      info.difficulty = 5;
      info.difficultyLabel = "无解";
      info.bestSolution = "";
      info.bestTree = null;
    }
    return info;
  }

  /* ---------------- 随机与模式 ---------------- */

  function hashSeed(seed) {
    if (typeof seed === "number") return seed >>> 0;
    var s = String(seed);
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function randomInt(rng, min, max) {
    return min + Math.floor(rng() * (max - min + 1));
  }

  function shuffle(arr, rng) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }

  var MODES = {
    intro: {
      key: "intro",
      name: "入门",
      desc: "1–9 的数字，只用加减乘，保证有整数解法。",
      range: [1, 9],
      ops: "+-*",
      integerOnly: true,
      minSolutions: 4,
      desired: 1.5,
      deck: false
    },
    classic: {
      key: "classic",
      name: "经典",
      desc: "1–13 的数字，四则运算，至少两种解法，保证有整数解法。",
      range: [1, 13],
      ops: "+-*/",
      minSolutions: 2,
      integerOnly: true,
      desired: 3,
      deck: false
    },
    hard: {
      key: "hard",
      name: "进阶",
      desc: "1–13 的数字，唯一解法，需要多绕一步，保证有整数解法。",
      range: [1, 13],
      ops: "+-*/",
      maxSolutions: 1,
      integerOnly: true,
      desired: 4,
      deck: false
    },
    expert: {
      key: "expert",
      name: "高手",
      desc: "唯一解法且必须用到分数，比如 3 3 8 8。",
      range: [1, 13],
      ops: "+-*/",
      maxSolutions: 1,
      requireFraction: true,
      desired: 5,
      deck: false
    },
    noDiv: {
      key: "noDiv",
      name: "禁除",
      desc: "只用加、减、乘，适合热身和低年级练习。",
      range: [1, 10],
      ops: "+-*",
      minSolutions: 2,
      desired: 2,
      deck: false
    },
    cards: {
      key: "cards",
      name: "扑克牌",
      desc: "从一副 52 张牌里抽四张，1 代表 A，11–13 代表 J/Q/K，保证有整数解法。",
      range: [1, 13],
      ops: "+-*/",
      minSolutions: 1,
      integerOnly: true,
      desired: 3,
      deck: true
    }
  };

  function modeOf(key) {
    if (key && MODES[key]) return MODES[key];
    return MODES.classic;
  }

  function randomNumbers(cfg, rng) {
    if (cfg.deck) {
      var deck = [];
      for (var v = 1; v <= 13; v++) {
        for (var s = 0; s < 4; s++) deck.push(v);
      }
      shuffle(deck, rng);
      return deck.slice(0, 4);
    }
    var lo = cfg.range[0];
    var hi = cfg.range[1];
    var nums = [];
    for (var i = 0; i < 4; i++) nums.push(randomInt(rng, lo, hi));
    return nums;
  }

  /**
   * 出题
   * 规则：只有显式 requireFraction（高手模式）才允许出「必须用分数」的题；
   *       其余场景一律保证存在纯整数加减乘除的解法。
   * @param {object} opts
   *   mode: intro/classic/hard/expert/noDiv/cards，或省略交给随机
   *   numbers: 直接指定四个数（会覆盖随机）
   *   target: 目标数，默认 24
   *   ops: 允许的运算符，如 "+-*"
   *   seed: 随机种子，同一种子结果可复现
   *   minSolutions / maxSolutions / requireFraction / integerOnly
   */
  function generate(opts) {
    opts = opts || {};
    var target = opts.target || DEFAULT_TARGET;
    var cfg = Object.assign({}, modeOf(opts.mode), opts);
    var seed = opts.seed;
    var rng = seed === undefined || seed === null ? Math.random : mulberry32(hashSeed(seed));

    if (opts.numbers && opts.numbers.length) {
      var fixed = analyze(opts.numbers.slice(0, 4), target, cfg.ops);
      fixed.mode = cfg.key || "custom";
      fixed.modeName = cfg.name || "自定";
      fixed.seed = seed;
      return fixed;
    }

    // 不需要分数的场景（除显式 requireFraction 外）都必须有整数解法
    var needInteger = !cfg.requireFraction;

    var candidates = [];
    var steps = 0;
    var limits = {
      minSolutions: cfg.minSolutions,
      maxSolutions: cfg.maxSolutions,
      needInteger: needInteger,
      forbidInteger: cfg.requireFraction
    };

    while (steps < 1200) {
      steps++;
      var nums = randomNumbers(cfg, rng);

      // 先用可提前终止的扫描器快速筛，命中约束才做完整求解
      var scan = scanSolutions(nums, target, cfg.ops, limits);
      if (scan.count === 0) continue;
      if (cfg.minSolutions && scan.count < cfg.minSolutions) continue;
      if (cfg.maxSolutions && scan.count > cfg.maxSolutions) continue;
      if (cfg.requireFraction && scan.stopped === "hasInteger") continue;
      if (needInteger && scan.intCount === 0) continue;

      var info = analyze(nums, target, cfg.ops);
      if (!info.solvable) continue;
      if (cfg.minSolutions && info.solutionCount < cfg.minSolutions) continue;
      if (cfg.maxSolutions && info.solutionCount > cfg.maxSolutions) continue;
      if (cfg.requireFraction && !info.requiresFraction) continue;
      if (needInteger && info.integerSolutionCount === 0) continue;

      info.mode = cfg.key;
      info.modeName = cfg.name;
      info.seed = seed;
      info.steps = steps;
      candidates.push(info);

      // 找到足够贴合目标难度的题就提前收手（留 1 级容差，避免唯一解模式空转）
      if (candidates.length >= 8) {
        var closestGap = Infinity;
        for (var ci = 0; ci < candidates.length; ci++) {
          var g = Math.abs(candidates[ci].difficulty - cfg.desired);
          if (g < closestGap) closestGap = g;
        }
        if (closestGap <= 1) break;
      }
    }

    if (!candidates.length) {
      // 放宽解法数量与难度，但「要不要分数」是硬约束，不能放宽
      for (var guard = 0; guard < 4000; guard++) {
        var fallbackNums = randomNumbers({ range: [1, 13], deck: false }, rng);
        var quick = scanSolutions(fallbackNums, target, cfg.ops, { firstOnly: true });
        if (!quick.count) continue;
        var fallbackInfo = analyze(fallbackNums, target, cfg.ops);
        if (cfg.requireFraction && !fallbackInfo.requiresFraction) continue;
        if (needInteger && fallbackInfo.integerSolutionCount === 0) continue;
        fallbackInfo.mode = cfg.key;
        fallbackInfo.modeName = cfg.name;
        fallbackInfo.seed = seed;
        fallbackInfo.relaxed = true;
        return fallbackInfo;
      }
      // 极端情况：按「要不要分数」挑一道固定的兜底题
      var pool = cfg.requireFraction
        ? [[3, 3, 8, 8], [1, 3, 4, 6], [1, 4, 5, 6]]
        : [[6, 6, 6, 6], [1, 2, 3, 4], [3, 3, 3, 3]];
      var lastResort = analyze(pool[0], target, cfg.ops);
      for (var pi = 1; pi < pool.length; pi++) {
        var tryInfo = analyze(pool[pi], target, cfg.ops);
        if (needInteger && tryInfo.integerSolutionCount === 0) continue;
        if (cfg.requireFraction && !tryInfo.requiresFraction) continue;
        lastResort = tryInfo;
        break;
      }
      lastResort.mode = cfg.key;
      lastResort.modeName = cfg.name;
      lastResort.seed = seed;
      lastResort.relaxed = true;
      return lastResort;
    }

    var desired = cfg.desired || 3;
    var best = candidates[0];
    var bestGap = Math.abs(best.difficulty - desired);
    for (var i = 1; i < candidates.length; i++) {
      var gap = Math.abs(candidates[i].difficulty - desired);
      if (gap < bestGap) {
        best = candidates[i];
        bestGap = gap;
      }
    }
    // 同等贴合时随机取一个，避免同种子下总出同一题
    var tied = candidates.filter(function (c) {
      return Math.abs(c.difficulty - desired) === bestGap;
    });
    best = tied[Math.floor(rng() * tied.length)];
    return best;
  }

  /* ---------------- 算式输入校验 ---------------- */

  function normalizeExpr(text) {
    return String(text || "")
      .replace(/[×✕]/g, "*")
      .replace(/÷/g, "/")
      .replace(/[−–—]/g, "-")
      .replace(/＋/g, "+")
      .replace(/－/g, "-")
      .replace(/（/g, "(")
      .replace(/）/g, ")")
      .replace(/[＝=]/g, "")
      .replace(/\s+/g, "");
  }

  function tokenize(text) {
    var tokens = [];
    var i = 0;
    while (i < text.length) {
      var c = text[i];
      if (c >= "0" && c <= "9") {
        var num = "";
        while (i < text.length && text[i] >= "0" && text[i] <= "9") {
          num += text[i];
          i++;
        }
        tokens.push({ type: "num", value: parseInt(num, 10), raw: num });
      } else if ("+-*/()".indexOf(c) >= 0) {
        tokens.push({ type: c });
        i++;
      } else {
        throw new Error("不认识的字符「" + c + "」");
      }
    }
    return tokens;
  }

  function parseExpression(tokens, numbers) {
    var pos = 0;
    var used = [];

    function peek() {
      return tokens[pos];
    }

    function next() {
      return tokens[pos++];
    }

    function parseExpr() {
      var left = parseTerm();
      while (peek() && (peek().type === "+" || peek().type === "-")) {
        var op = next().type;
        left = node(op, left, parseTerm());
      }
      return left;
    }

    function parseTerm() {
      var left = parseFactor();
      while (peek() && (peek().type === "*" || peek().type === "/")) {
        var op = next().type;
        left = node(op, left, parseFactor());
      }
      return left;
    }

    function parseFactor() {
      var t = peek();
      if (!t) throw new Error("算式还没写完");
      if (t.type === "num") {
        next();
        used.push(t.value);
        return leaf(t.value);
      }
      if (t.type === "(") {
        next();
        var inner = parseExpr();
        if (!peek() || peek().type !== ")") throw new Error("少了一个右括号");
        next();
        return inner;
      }
      throw new Error("「" + (t.raw || t.type) + "」前面缺数字或括号");
    }

    var tree = parseExpr();
    if (pos < tokens.length) throw new Error("算式里有没接上的部分");
    return { tree: tree, used: used };
  }

  /**
   * 校验用户输入的算式
   * @param opts {allowFraction:boolean} 传 false 时，中间过程出现分数直接判错
   * @returns {ok:true, value, valueText, expression} 或 {ok:false, error}
   */
  function checkExpression(input, numbers, target, opts) {
    opts = opts || {};
    target = target || DEFAULT_TARGET;
    var text = normalizeExpr(input);
    if (!text) return { ok: false, error: "先写一个算式" };

    var tokens;
    try {
      tokens = tokenize(text);
    } catch (e) {
      return { ok: false, error: e.message };
    }

    var parsed;
    try {
      parsed = parseExpression(tokens, numbers);
    } catch (e) {
      return { ok: false, error: e.message };
    }

    var sortedUsed = parsed.used.slice().sort(function (a, b) {
      return a - b;
    });
    var sortedNums = numbers.slice().sort(function (a, b) {
      return a - b;
    });
    if (sortedUsed.length !== sortedNums.length) {
      return { ok: false, error: "要把给出的 " + sortedNums.length + " 个数字都用到，一个也不能多、不能少" };
    }
    for (var i = 0; i < sortedUsed.length; i++) {
      if (sortedUsed[i] !== sortedNums[i]) {
        return { ok: false, error: "用的数字和牌面对不上，牌面是 " + numbers.join("、") };
      }
    }

    var value = evalTree(parsed.tree);
    if (!value) return { ok: false, error: "出现了除以 0" };

    var valueNum = value.n / value.d;
    if (!fEqualsNumber(value, target)) {
      return {
        ok: false,
        error: "结果是 " + fText(value) + "，不是 " + target,
        value: valueNum,
        valueText: fText(value)
      };
    }

    // 不需要分数的题：中间任何一步都不能是分数
    if (opts.allowFraction === false) {
      var steps = fractionalSteps(parsed.tree);
      if (steps.length) {
        return {
          ok: false,
          error:
            "中间过程不能出现分数（" + steps[0].text + " = " + fText(steps[0].value) +
            "），只能用整数的加、减、乘、除。",
          value: valueNum,
          valueText: fText(value)
        };
      }
    }

    return {
      ok: true,
      value: target,
      valueText: String(target),
      expression: formatTree(parsed.tree),
      tree: parsed.tree
    };
  }

  /* ---------------- 提示 ---------------- */

  function firstStep(tree) {
    // 找最靠上的一步：两个子节点都是原始数字
    if (!tree || tree.num !== undefined) return null;
    if (tree.a.num !== undefined && tree.b.num !== undefined) return tree;
    return firstStep(tree.a) || firstStep(tree.b);
  }

  /**
   * @param {object} puzzle analyze/generate 的结果
   * @param {number} level 1=第一步，2=完整答案
   */
  function hint(puzzle, level) {
    if (!puzzle || !puzzle.solvable) {
      return { text: "这道题没有解，换一题吧。", solution: "" };
    }
    var tree = puzzle.bestTree;
    if (level >= 2) {
      return {
        text: "参考答案：" + puzzle.bestSolution + " = " + puzzle.target,
        solution: puzzle.bestSolution
      };
    }
    var step = firstStep(tree);
    if (!step) {
      return { text: "就一步：用四个数直接算出 " + puzzle.target, solution: puzzle.bestSolution };
    }
    var left = evalTree(step.a);
    var right = evalTree(step.b);
    var result = evalTree(step);
    var tip = "先算 " + fText(left) + " " + SYM[step.op] + " " + fText(right) + " = " + fText(result);
    if (result.d !== 1) {
      tip += "，这里先保留分数，别急着取整";
    }
    return { text: tip, solution: puzzle.bestSolution };
  }

  /* ---------------- 每日题 ---------------- */

  function dateKey(d) {
    d = d || new Date();
    var y = d.getFullYear();
    var m = d.getMonth() + 1;
    var day = d.getDate();
    return y + "-" + (m < 10 ? "0" + m : m) + "-" + (day < 10 ? "0" + day : day);
  }

  function daily(key, mode) {
    var seed = "tf24-daily-" + (key || dateKey());
    var puzzle = generate({ mode: mode || "classic", seed: seed, target: DEFAULT_TARGET });
    puzzle.daily = key || dateKey();
    return puzzle;
  }

  global.TF24 = {
    VERSION: "1.0.0",
    DEFAULT_TARGET: DEFAULT_TARGET,
    MODES: MODES,
    ALL_OPS: ALL_OPS,
    // 分数工具（棋盘组件渲染需要）
    F: F,
    fAdd: fAdd,
    fSub: fSub,
    fMul: fMul,
    fDiv: fDiv,
    fEqualsNumber: fEqualsNumber,
    fText: fText,
    // 表达式
    formatTree: formatTree,
    evalTree: evalTree,
    // 主能力
    solve: enumerate,
    analyze: analyze,
    generate: generate,
    checkExpression: checkExpression,
    hint: hint,
    daily: daily,
    dateKey: dateKey
  };
})(typeof window !== "undefined" ? window : globalThis);
