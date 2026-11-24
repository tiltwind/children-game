/* ============================================================
 * tools/test-core.js —— 核心引擎自检（node tools/test-core.js）
 * 覆盖：分数求解、判重、四种模式约束、算式校验、提示、每日题复现
 * ============================================================ */
"use strict";

require("../js/core.js");
var TF24 = globalThis.TF24;

var pass = 0;
var fail = 0;

function ok(cond, name, extra) {
  if (cond) {
    pass++;
    console.log("  ok   " + name);
  } else {
    fail++;
    console.log("  FAIL " + name + (extra ? "  → " + extra : ""));
  }
}

function section(title) {
  console.log("\n" + title);
}

/* ---------------- 求解 ---------------- */
section("求解与判重");

var classic = TF24.analyze([6, 6, 6, 6], 24);
ok(classic.solvable, "6 6 6 6 有解");

var fractions = TF24.analyze([3, 3, 8, 8], 24);
ok(fractions.solvable, "3 3 8 8 有解");
ok(
  fractions.solutions.some(function (s) { return s.indexOf("÷") >= 0 || s.indexOf("/") >= 0; }),
  "3 3 8 8 的解法里出现除法"
);
ok(fractions.requiresFraction, "3 3 8 8 必须用分数");

var unsolvable = TF24.analyze([1, 1, 1, 1], 24);
ok(!unsolvable.solvable, "1 1 1 1 无解");
ok(unsolvable.solutionCount === 0, "无解时解法数为 0");

var many = TF24.analyze([1, 2, 3, 4], 24);
ok(many.solutionCount > 0, "1 2 3 4 有解");
ok(many.integerSolutionCount > 0, "1 2 3 4 有整数解法");

var dup = TF24.analyze([1, 5, 5, 5], 24);
ok(dup.solvable, "1 5 5 5 有解");
ok(dup.solutions.length === new Set(dup.solutions).size, "返回的解法无重复");

// 结果必须真的等于 24
var allGood = true;
[classic, fractions, many, dup].forEach(function (p) {
  p.solutions.forEach(function (expr) {
    var res = TF24.checkExpression(expr, p.numbers, 24);
    if (!res.ok) {
      allGood = false;
      console.log("      表达式不自洽: " + expr + " → " + res.error);
    }
  });
});
ok(allGood, "所有返回解法都能通过算式校验");

/* ---------------- 各模式出题 ---------------- */
section("多模式随机出题");

var modes = ["intro", "classic", "hard", "expert", "noDiv", "cards"];
var samples = {};

modes.forEach(function (mode) {
  var cfg = TF24.MODES[mode];
  var works = true;
  var detail = "";
  var t0 = Date.now();
  for (var i = 0; i < 30; i++) {
    var p = TF24.generate({ mode: mode, seed: mode + "-" + i });
    if (!p.solvable) {
      works = false;
      detail = "第 " + i + " 题无解：" + p.numbers;
      break;
    }
    if (p.numbers.length !== 4) {
      works = false;
      detail = "数字个数不对";
      break;
    }
    if (cfg.minSolutions && p.solutionCount < cfg.minSolutions) {
      works = false;
      detail = "解法太少：" + p.numbers + " " + p.solutionCount;
      break;
    }
    if (cfg.maxSolutions && p.solutionCount > cfg.maxSolutions) {
      works = false;
      detail = "解法太多：" + p.numbers + " " + p.solutionCount;
      break;
    }
    if (cfg.requireFraction && !p.requiresFraction) {
      works = false;
      detail = "没用分数：" + p.numbers;
      break;
    }
    // 不需要分数的场景必须保证有整数解法，且参考答案走整数路线
    if (!cfg.requireFraction && p.integerSolutionCount === 0) {
      works = false;
      detail = "只有分数解法：" + p.numbers;
      break;
    }
    if (!cfg.requireFraction && p.allSolutions[0].hasFraction) {
      works = false;
      detail = "参考答案含分数中间结果：" + p.numbers;
      break;
    }
    if (cfg.deck) {
      // 每种点数最多 4 张
      var counts = {};
      p.numbers.forEach(function (n) { counts[n] = (counts[n] || 0) + 1; });
      if (Object.keys(counts).some(function (k) { return counts[k] > 4; })) {
        works = false;
        detail = "超过四张同点：" + p.numbers;
        break;
      }
    }
  }
  samples[mode] = TF24.generate({ mode: mode, seed: "sample" });
  ok(works, mode + " 连续 30 题满足约束", detail);
  console.log(
    "       例：" + samples[mode].numbers.join(" ") +
    " · " + samples[mode].solutionCount + " 解 · " +
    samples[mode].difficultyLabel + " · " + samples[mode].bestSolution +
    " · " + (Date.now() - t0) + "ms/30题"
  );
});

/* ---------------- 种子复现 ---------------- */
section("种子与每日题");

var a = TF24.generate({ mode: "classic", seed: "same-seed" });
var b = TF24.generate({ mode: "classic", seed: "same-seed" });
ok(a.numbers.join(",") === b.numbers.join(","), "同种子出同一题", a.numbers + " vs " + b.numbers);

var d1 = TF24.daily("2026-11-14");
var d2 = TF24.daily("2026-11-14");
ok(d1.numbers.join(",") === d2.numbers.join(","), "每日题同日稳定");
ok(d1.solvable, "每日题有解");

/* ---------------- 算式校验 ---------------- */
section("算式校验");

var sum = TF24.checkExpression("(6+6)+(6+6)", [6, 6, 6, 6], 24);
ok(sum.ok, "合法算式通过", sum.error);
ok(sum.valueText === "24", "结果文本为 24");

var fullWidth = TF24.checkExpression("（8 ÷ 3）× 9 × 1", [8, 3, 9, 1], 24);
ok(fullWidth.ok, "全角算式可识别", fullWidth.error);

var wrongValue = TF24.checkExpression("6*6-6*6", [6, 6, 6, 6], 24);
ok(!wrongValue.ok, "结果不对会被拦下");
ok(wrongValue.error.indexOf("0") >= 0, "错误提示带出实际结果", wrongValue.error);

var wrongNums = TF24.checkExpression("6*4", [6, 6, 6, 6], 24);
ok(!wrongNums.ok, "少用数字会被拦下", wrongNums.error);

var badSyntax = TF24.checkExpression("6+*6", [6, 6, 6, 6], 24);
ok(!badSyntax.ok, "语法错误会被拦下", badSyntax.error);

var divZero = TF24.checkExpression("6/(2-2)", [6, 2, 2, 1], 24);
ok(!divZero.ok, "除以 0 会被拦下", divZero.error);

var notUsed = TF24.checkExpression("(6+6)*(6-6)", [6, 6, 6, 6], 24);
ok(!notUsed.ok, "结果为 0 会被拦下", notUsed.error);

/* ---------------- 中间过程不许出现分数 ---------------- */
section("中间过程不许出现分数");

var fracBlocked = TF24.checkExpression("8/(3-8/3)", [3, 3, 8, 8], 24, { allowFraction: false });
ok(!fracBlocked.ok, "allowFraction:false 时分数中间结果被拦下");
ok(fracBlocked.error.indexOf("分数") >= 0, "拦下时说明原因", fracBlocked.error);

var fracAllowed = TF24.checkExpression("8/(3-8/3)", [3, 3, 8, 8], 24, { allowFraction: true });
ok(fracAllowed.ok, "allowFraction:true 时仍允许分数中间结果", fracAllowed.error);

var intExpr = TF24.checkExpression("1*2*3*4", [1, 2, 3, 4], 24, { allowFraction: false });
ok(intExpr.ok, "纯整数算式照常通过", intExpr.error);

/* ---------------- 提示 ---------------- */
section("提示");

var h1 = TF24.hint(fractions, 1);
ok(!!h1.text && h1.text.indexOf("先算") >= 0, "一级提示给出第一步", h1.text);
var h2 = TF24.hint(fractions, 2);
ok(h2.text.indexOf("参考答案") >= 0, "二级提示给出完整答案", h2.text);

var intPuzzle = TF24.generate({ mode: "classic", seed: "hint-int" });
var hInt = TF24.hint(intPuzzle, 1);
ok(hInt.text.indexOf("/") < 0 && hInt.text.indexOf("分数") < 0, "整数题的提示不出现分数", hInt.text);

/* ---------------- 汇总 ---------------- */
console.log("\n结果：" + pass + " 通过，" + fail + " 失败");
process.exit(fail ? 1 : 0);
