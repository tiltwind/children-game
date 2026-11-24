# 共享模块：gate / limit / playclock

> 规则口径见 [rules.md](rules.md)，目录分层见 [architecture.md](architecture.md)。

三个模块都是 IIFE，挂到 `window` 上，**无外部依赖**，引入即用。接入一律用相对路径 `../`。

---

## 1. `gate/` · 局间门禁

全局：`window.Gate`（兼容别名 `TF24Gate`）。

### 接入

```html
<link rel="stylesheet" href="../gate/gate.css">
<link rel="stylesheet" href="../gate/challenges.css">

<script src="../gate/gate.js"></script>
<script src="../poem/poem-data.js"></script>       <!-- poem 题型必需 -->
<script src="../english/english-data.js"></script>  <!-- english 题型必需 -->
<script src="../gate/challenges/quick-math.js"></script>
<script src="../gate/challenges/poem.js"></script>
<script src="../gate/challenges/english.js"></script>
```

```js
var gate = Gate.create({
  everyMinutes: 5,
  challenges: ["quick-math", "poem"],
  kicker: "局间门禁 · 我的游戏",
  title: "先过一道关卡",
  onLock: function () { pauseGame(); },     // 必须真的停主循环
  onUnlock: function () { resumeGame(); }   // 恢复时重置计时基准为 performance.now()
});

function frame(ts) {
  var dt = Math.min((ts - last) / 1000, 0.25);
  last = ts;
  if (playing) gate.tick(dt);   // 菜单 / 暂停 / 结算不要调用
}
```

### 参数

| 参数 | 默认 | 说明 |
| --- | --- | --- |
| `everyMinutes` | `5` | 累计游玩多少分钟触发 |
| `challenges` | `"all"` | 题型 id 数组、单个 id 或 `"all"` |
| `challengeOptions` | `{}` | 按题型传参，如 `{ poem: { group: "low" } }` |
| `allowSkip` | `false` | 是否显示「换一题」 |
| `target` | `24` | 透传给题型的通用目标值 |
| `title` / `note` / `kicker` | — | 面板文案 |
| `showBadge` / `badgePosition` | `true` / `"bottom-left"` | 倒计时徽标；可选 `top-left` `top-right` `raised` |
| `unlockDelay` | `1000` | 通过后自动关闭延时 |
| `autoTick` | `false` | 门禁自计时，不依赖宿主循环 |
| `openOnStart` | `false` | 创建后立即弹题 |
| `random` | `Math.random` | 注入固定函数便于测试 |
| `storage` / `storageKey` / `game` | `true` / `"shutu.gate.v1"` / 页面路径 | 存档开关、键名、分档标识 |
| `onLock` / `onUnlock` / `onOpen` / `onPass` / `onSkip` | — | 生命周期回调 |

### 实例与全局

- 实例：`tick(dt)`、`openNow()`、`skipPuzzle()`、`describe()`、`clearState()`、`destroy()`；属性 `passed` `opens` `locked` `seconds` `challengeId`。
- 全局：`Gate.clearStore()`、`Gate.register(id, def)`。
- 事件：`gate:lock`、`gate:unlock`、`gate:pass`、`gate:skip`。

### 内置题型

| id | 名称 | 依赖 |
| --- | --- | --- |
| `twenty-four` | 24 点 | `twenty-four/js/core.js`、`board.js`、`css/board.css` |
| `poem` | 唐诗接下句 | `poem/poem-data.js` |
| `quick-math` | 口算填空 | 无 |
| `english` | 英语单词 | `english/english-data.js` |

新增题型：`Gate.register(id, { name, weight, create(api) })`，`create` 必须返回 `{ el, meta?, focus?, lock?, destroy? }`，判对时调用 `api.pass({ summary })`。

### 调试

`?tf24demo=1` 立刻弹题；`?gate=poem` / `?gate=twenty-four` / `?gate=quick-math` / `?gate=english` 指定题型；可组合。

---

## 2. `limit/` · 单游戏限次

全局：`window.GameLimit`。

```html
<link rel="stylesheet" href="../limit/limit.css">
<script src="../limit/limit.js" data-game="tetris"></script>
```

首页：`<script src="limit/limit.js" data-game="index"></script>`。

### API

| 调用 | 作用 |
| --- | --- |
| `GameLimit.count(id)` | 记一次完整通关（省略 id 用当前页 `data-game`）；达上限后不再累加 |
| `GameLimit.status(id)` | `{ plays, remaining, lockUntil, locked, limit }` |
| `GameLimit.all()` | 全部游戏状态 |
| `GameLimit.limit` / `limit` `lockMs` / `currentGame` | 常量与当前页标识 |

### 注意

- **新增游戏必须把 id 与中文名登记到 `limit.js` 的 `GAMES`**，否则首页卡片不会显示限次状态。
- 页面上的卡片必须是 `a.card[data-game]`，`limit.js` 靠它扫描与挂锁屏。
- 存档 `shutu.limit.v1`；`count` 应绑定在「一局真正走完」的位置，不要绑在开局或失败。

---

## 3. `playclock/` · 全站强制休息

全局：`window.PlayClock`。

```html
<link rel="stylesheet" href="../playclock/playclock.css">
<script src="../playclock/playclock.js"></script>
```

首页用 `data-count="off"`：只显示休息状态，不计入游戏时长。

### 事件与暂停

```js
document.addEventListener('playclock:breakstart', pauseGame);
document.addEventListener('playclock:breakend', resumeGame);
```

- 自动处理：遮罩、输入拦截、跨标签同步、跨天清零。
- 自带徽标（左下角，最后 5 分钟暖橙、最后 1 分钟闪烁）；位置在门禁徽标上方，互不遮挡。
- `PlayClock.status()` → `{ playedMs, breakRemainingMs, breaking, playLimitMs, breakMs }`。
- 存档 `shutu.playclock.v1`。

---

## 4. 当前接入矩阵

| 游戏 | gate | limit | playclock | 门禁题型 | 徽标位置 |
| --- | --- | --- | --- | --- | --- |
| 俄罗斯方块 | ✓ | ✓ | ✓ | 24 点 / 唐诗 / 英语 | 左下 |
| 枪战游戏 | ✓ | ✓ | ✓ | 24 点 / 唐诗 / 英语 | 左下 |
| 键盘探险 | — | ✓ | ✓ | — | — |
| 草坪守卫战 | ✓ | ✓ | ✓ | 24 点 / 唐诗 / 英语 | 种子栏上方（raised） |
| 24 点 | — | ✓ | ✓ | 本身即题型来源 | — |
| 唐诗小状元 | — | ✓ | ✓ | 本身即题型来源 | — |
| 穿云战机 | ✓ | ✓ | ✓ | 24 点 / 唐诗 / 英语 | 左下 |
| 霓虹狂飙 | ✓ | ✓ | ✓ | 口算 / 唐诗 / 英语 | 左下 |
| 钢铁防线 | ✓ | ✓ | ✗ | 口算 / 唐诗 / 英语 | — |
| 英语小勇士 | — | ✓ | ✓ | 本身即题型来源 | — |

> 钢铁防线是单文件实现，目前**未接入 playclock**；补齐时按上面第 3 节接入，并监听两个休息事件暂停主循环。
