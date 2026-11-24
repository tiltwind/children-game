# 24 点

四张牌各用一次，用加、减、乘、除凑出 24。纯静态，原生 JS，无构建步骤。

## 目录

```
twenty-four/
├── twenty-four.html          游戏页
├── css/
│   ├── board.css             棋盘组件样式
│   └── style.css             页面版式
├── assets/
│   └── bgm.m4a               背景音乐（30 秒，AAC）
├── js/
│   ├── core.js               引擎（求解/出题/校验/提示）
│   ├── board.js              棋盘组件
│   └── app.js                页面交互
├── tools/
│   ├── test-core.js          引擎自检（Node）
│   └── ui-test.html          棋盘与门禁自检（浏览器）
└── README.md
```

## 玩法

六种模式：入门、经典、进阶、高手、禁除、扑克牌。随机出题，两级提示，也可以直接输入完整算式。页面用 localStorage 记录已解数量、连胜和当前模式最快用时。

**分数口径**：独立的 24 点页面保留「高手」模式作为唯一的分数题（唯一解法且必须用分数，例如 3 3 8 8），进入这类题时棋盘上方会常驻一条「这题要用分数」的说明，提示第一步也会点明分数。入门、经典、进阶、禁除、扑克牌这五个场景，出题时一律保证**存在纯整数加减乘除的解法**，提示与参考答案只给整数路线；棋盘在这类题上除不尽会禁用「÷」并在状态栏说明不能做，手输算式若中间结果出现分数也会被判错。

**局间门禁不碰分数**：门禁里的 24 点只用整数题，难度阶梯只到「进阶」，题面、提示、判题全程不出现分数中间结果。

面向小朋友的体验：整体字号放大、圆润字体与暖色牌桌；右下角可开关背景音乐（默认开，`tf24.music.v1` 记住偏好，首次点击页面时自动补播）；解出后弹出带星星和彩纸的奖励弹窗，按 Enter 或「再来一题」继续。

星级规则：基础三星；用过提示减一星；用时超过 120 秒或步数超过 5 步再减一星，最低一星。直接输入算式不记步数，奖励弹窗显示「直接写算式」。

合成顺序自动处理：减法永远大数减小数，不会出现负数；除法优先选能整除的方向，除不尽时提示换一对牌。只有题目本身必须用分数（高手模式）时才保留分数。

## 引擎 `window.TF24`

- `TF24.F(n, d)`：分数精确运算，避免浮点误差。
- `TF24.analyze(numbers, target)`：全解枚举，返回 `solutions`、`count`、`difficulty`、`bestSolution`。
- `TF24.scanSolutions(numbers, opts)`：带提前终止的扫描，出题快筛用。
- `TF24.generate({ mode, target, numbers, ops, seed, minSolutions, maxSolutions, requireFraction, integerOnly })`：按模式约束随机出题。
- `TF24.checkExpression(expr, numbers, target)`：校验算式，返回 `{ ok, value, error }`。
- `TF24.hint(puzzle, level)` / `TF24.daily(date)`：提示与每日题。

模式键：`intro` / `classic` / `hard` / `expert` / `noDiv` / `cards`，难度标签「轻松 / 适中 / 烧脑 / 硬核」。

出题分数规则：只有 `requireFraction`（`expert` 模式）才出「必须用分数」的题；其余调用（含门禁的经典 / 进阶）一律要求至少一条整数解法，兜底题也按这条硬约束挑。

## 棋盘 `window.TF24Board`

`create(root, { target, onSolved, allowFraction })`，实例方法：`load(puzzle)`、`reset()`、`undo()`、`hint()`、`submitExpression(text)`、`setLocked(flag)`、`destroy()`。

`allowFraction` 不传时按题目自动判断：只有本身必须用分数的题才允许分数中间结果，其余题目除法除不尽会直接提示换牌。

键盘：`1–4` 选牌，`+ - * /` 运算，`Backspace` 撤销，`R` 重开。

## 当作关卡

24 点已经注册成通用门禁的一种题型。门禁引擎在 `../gate/`，支持 24 点与唐诗接下句随机出题，接入方式见 [`../gate/README.md`](../gate/README.md)。

调试：`?tf24demo=1` 进入游戏立刻弹题，`?gate=twenty-four` 强制只用 24 点。

## 自检

```bash
node tools/test-core.js
```

覆盖求解、判重、六种模式的出题约束、种子复现、算式校验、分数中间结果的拦截、提示。浏览器打开 `tools/ui-test.html` 可检查棋盘、除不尽的除法不可操作、分数题的常驻提示、题型注册、门禁不出分数题与两种题型的通过流程（66 项断言）。
