# 局间门禁 · 标准库

给任意网页游戏加一道「玩满 N 分钟必须答对才能继续」的关卡。门禁只负责计时、遮罩、暂停/恢复和随机选题；题目由可注册的题型提供，可随时增加新题型。

内置四种题型：**24 点**、**唐诗接下句**、**口算填空**、**英语单词**。

## 目录

```
gate/
├── gate.js               门禁引擎（window.Gate）
├── gate.css              遮罩、面板、倒计时徽标
├── challenges.css        题面通用样式
├── challenges/
│   ├── twenty-four.js    24 点题型（依赖 twenty-four/js/core.js、board.js）
│   ├── poem.js           唐诗接下句题型（依赖 poem/poem-data.js）
│   ├── quick-math.js     口算填空题型（输入数字交卷，无额外依赖）
│   └── english.js        英语单词题型（依赖 english/english-data.js）
└── README.md
```

## 三层结构

1. **门禁引擎**：累计游玩时间、到点弹全屏遮罩、暂停宿主、随机选题、处理通过/关闭。
2. **题型**：自己渲染题面、自己判题，解出时调用 `api.pass()`。用 `Gate.register(id, def)` 注册。
3. **宿主游戏**：创建门禁，把 `onLock` / `onUnlock` 接到自己的暂停逻辑，主循环里 `tick(dt)`。

门禁不依赖 24 点，`core.js`、`board.js` 只有 24 点题型需要。

## 内置题型

| id | 名称 | 权重 | 说明 |
| --- | --- | --- | --- |
| `twenty-four` | 24 点 | 1 | 四张牌凑 24；按通过次数从经典升到进阶。门禁只用整数题，最高停在进阶，配 `mode: "expert"` 也会降级 |
| `poem` | 唐诗 | 1 | 给出上句，四选一接下句；共享小学 1-6 年级 64 首唐诗、210 道随机题；门禁里只能选一次，答错公布答案并停留 8 秒后自动换题 |
| `quick-math` | 口算 | 1 | 必须输入数字并交卷；答错不公布答案，连错两次给拆分提示；难度随通过次数从两位数加减升到两位数乘法 |
| `english` | 英语单词 | 1 | 小学 1-3 年级词库随机抽「英翻中 / 中翻英 / 补全单词」四选一；答错公布单词、音标与拼读，8 秒后换题 |

题型按 `weight` 加权随机；默认不显示「换一题」，必须答对才能通过。唐诗题库在 `poem/poem-data.js`，英语词库在 `english/english-data.js`，独立游戏和门禁共用，新增内容只需要改这两处。

## 接入

**1. 引样式和脚本**

`quick-math` 不依赖其他脚本，引入 `gate/challenges/quick-math.js` 即可。

```html
<!-- 门禁本体 -->
<link rel="stylesheet" href="../gate/gate.css">
<link rel="stylesheet" href="../gate/challenges.css">

<!-- 24 点题型还要棋盘样式；只用唐诗可删 -->
<link rel="stylesheet" href="../twenty-four/css/board.css">

<!-- 24 点题型依赖；只用唐诗可删 -->
<script src="../twenty-four/js/core.js"></script>
<script src="../twenty-four/js/board.js"></script>

<!-- 门禁引擎 -->
<script src="../gate/gate.js"></script>

<!-- 唐诗题库（poem 题型必需） -->
<script src="../poem/poem-data.js"></script>

<!-- 英语词库（english 题型必需） -->
<script src="../english/english-data.js"></script>

<!-- 需要的题型 -->
<script src="../gate/challenges/twenty-four.js"></script>
<script src="../gate/challenges/poem.js"></script>
<script src="../gate/challenges/english.js"></script>
```

**2. 创建门禁**

```js
var gate = Gate.create({
  everyMinutes: 5,
  challenges: ["twenty-four", "poem"], // 省略 = 所有已注册题型
  kicker: "局间门禁 · 我的游戏",
  title: "先过一道关卡",
  onLock: function () { 暂停游戏(); },
  onUnlock: function () { 恢复游戏(); }
});
```

**3. 只在真正游玩时计时**

```js
function frame(ts) {
  var dt = Math.min((ts - last) / 1000, 0.25);
  last = ts;
  if (playing) gate.tick(dt); // 菜单、暂停、结算时不要调用
  ...
}
```

要点：

- `onLock` 必须真的停掉主循环（取消 `requestAnimationFrame` 或切到暂停状态），否则题目弹着，游戏还在后台跑。
- `onUnlock` 恢复时把计时基准重置为 `performance.now()`，避免第一帧跳一大步。
- 门禁打开时按 Esc 不能关闭，只能解题或换题。
- 通过后重新计满 5 分钟，通过次数会累计给题型使用。

## 状态持久化（刷新不能绕过）

计时进度和「门禁没答对」的状态都存在 `localStorage`（键 `shutu.gate.v1`，按游戏分条），因此：

- 玩到 4 分 50 秒刷新 / 关标签 / 第二天再来，**不会清零**，接着往下计；
- 门禁已经弹出但**没答对就刷新**，重新进入页面会**立刻再次弹出**同一类题，提示「上一道题还没答对」，
  只有答对才放行 —— 靠刷新躲门禁这条路被堵住了；
- 待通过状态是**全站共享**的：在 A 游戏没答对就跑去看 B 游戏，B 的页面挂载门禁时同样会先把这一关拦下来；
  答对一次，全站的待通过标记一起清掉，不会在别的页面被二次拦；
- 通过后 `pending` 清掉、计时归 0 并写回，刷新回到正常游玩；
- 每 2 秒落一次盘，页面关闭 / 切后台（`pagehide`、`beforeunload`、`visibilitychange`）立即落盘；
- 浏览器禁用存储（隐私模式）时自动退化为内存计时，不影响游戏本身。

默认按页面路径分键（`/tetris/tetris.html` 与 `/pvz/pvz.html` 各算各的）；同页多实例时用 `game` 指定不同名字，
`storage: false` 可完全关掉存档（自检页 / 单元测试用）。

存储结构大致是：

```json
{"v":1,
 "games":{"\/tetris\/tetris.html":{"seconds":231.5,"passed":3,"opens":2,"pending":true,"challenge":"poem"}},
 "pending":{"game":"\/tetris\/tetris.html","challenge":"poem","at":1700000000000}}
```

计时只丢了 2 秒以内（每累计 2 秒落盘一次，关页面/切后台会立即补写）。

想清掉存档：`Gate.clearStore()` 清空全部游戏；实例上 `gate.clearState()` 只清本游戏。

## 参数

| 参数 | 默认 | 说明 |
| --- | --- | --- |
| `everyMinutes` | `5` | 累计游玩多少分钟触发 |
| `challenges` | `"all"` | 题型 id 数组、单个 id，或 `"all"` |
| `challengeOptions` | `{}` | 按题型 id 传参，如 `{ "twenty-four": { mode: "hard" }, "poem": { group: "low" } }` |
| `allowSkip` | `false` | 是否显示「换一题」；默认关闭，玩家必须尝试当前题目 |
| `target` | `24` | 透传给题型的通用目标值 |
| `title` / `note` / `kicker` | — | 面板文案 |
| `showBadge` | `true` | 是否显示倒计时徽标 |
| `badgePosition` | `"bottom-left"` | `bottom-left` / `top-left` / `top-right` / `raised` |
| `unlockDelay` | `1000` | 通过后多久自动关闭 |
| `autoTick` | `false` | 门禁自己计时，不依赖宿主循环 |
| `openOnStart` | `false` | 创建后立即弹题 |
| `random` | `Math.random` | 可注入固定函数，便于测试 |
| `storage` | `true` | 是否把计时 / 待通过状态写进 localStorage |
| `storageKey` | `"shutu.gate.v1"` | 存档键名，多个游戏共用一个键、按 `game` 分条 |
| `game` | 页面路径 | 存档里的游戏标识；同页多实例时手动指定 |
| `onLock` / `onUnlock` / `onOpen` / `onPass` / `onSkip` | — | 生命周期回调 |

实例方法：`tick(dtSeconds)`、`openNow()`、`skipPuzzle()`（仅在 `allowSkip: true` 时可用）、`describe()`、`clearState()`、`destroy()`。
全局：`Gate.clearStore()` 清空所有存档。

属性：`passed`、`opens`、`locked`、`seconds`、`challengeId`。

事件：`gate:lock`、`gate:unlock`、`gate:pass`、`gate:skip`（`tf24:lock` / `tf24:unlock` 作为兼容别名仍会派发）。`TF24Gate` 是 `Gate` 的兼容别名。

## 新增题型

```js
Gate.register("poem", {
  name: "唐诗",
  weight: 1,
  create: function (api) {
    var el = document.createElement("div");
    el.innerHTML = "<p>上句……</p>";

    // 判对后：api.pass({ summary: "《静夜思》· 李白" });
    // 出错时：api.fail("再想想")  /  api.clear()
    // 可用：api.target、api.passed、api.options、api.random、api.solved()

    return {
      el: el,
      meta: function () { return "名句接龙"; }, // 显示在题型标签后
      focus: function () { el.focus(); },        // 打开时聚焦
      lock: function () { /* 通过后禁用题面 */ },
      destroy: function () { /* 解绑事件、清理定时器 */ }
    };
  }
});
```

`el` 必须返回；其余方法可选。判题、重开、提示都属于题型内部逻辑，门禁不干预。

## 调试

- `?tf24demo=1`：进入游戏立刻弹题，不用等 5 分钟。
- `?gate=poem`：强制只用唐诗；也支持 `?gate=twenty-four`、`?gate=quick-math`、`?gate=english`。

可组合，如 `tetris/tetris.html?tf24demo=1&gate=poem`。

持久化自检：打开仓库根目录的 `_test-gate-persist.html`，3 秒自动弹门禁，不答题直接刷新 —— 门禁应当立刻重新出现。

## 已接入

| 游戏 | 间隔 | 题型 | 徽标位置 |
| --- | --- | --- | --- |
| 俄罗斯方块 | 5 分钟 | 24 点 / 唐诗 / 英语随机 | 左下角 |
| 枪战游戏 | 5 分钟 | 24 点 / 唐诗 / 英语随机 | 左下角 |
| 草坪守卫战 | 5 分钟 | 24 点 / 唐诗 / 英语随机 | 种子栏上方 |
| 穿云战机 | 5 分钟 | 24 点 / 唐诗 / 英语随机 | 左下角 |
| 霓虹狂飙 | 5 分钟 | 口算 / 唐诗 / 英语随机 | 左下角 |
| 钢铁防线 | 5 分钟 | 口算 / 唐诗 / 英语随机 | 左下角 |

接入代码在各游戏脚本的 `createGate()` / `PVZ.ensureGate()` 里。

## 自检

浏览器打开 `../twenty-four/tools/ui-test.html`，覆盖棋盘、自动排列顺序、除不尽的除法不可操作、分数题常驻提示、题型注册、随机与换题、门禁不出分数题与两种题型的通过流程，共 66 项断言。
