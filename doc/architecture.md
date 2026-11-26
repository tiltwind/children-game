# 架构与目录

> 上层索引见 [../AGENTS.md](../AGENTS.md)。本文说明「东西放在哪、谁依赖谁、页面怎么装起来」。

## 1. 分层

```
index.html / index.css                 ← 索引层：只做导航与规则展示
covers/*.jpg                           ← 索引资源：卡片封面
gate/  limit/  playclock/              ← 共享层：横向被所有游戏引用
<game>/                                 ← 游戏层：每个游戏自成一个独立单元
_build_zombie/  _test-*.html           ← 开发层：生成工作区与自检页，不对外
```

依赖方向是**单向**的：

- 游戏页 → 共享模块（`../gate/`、`../limit/`、`../playclock/`）
- 共享模块 →（尽量）不反向依赖具体游戏；唯一例外是题型：`gate/challenges/twenty-four.js` 依赖 `twenty-four/js/core.js`、`board.js`，`gate/challenges/poem.js` 依赖 `poem/poem-data.js`，`gate/challenges/english.js` 依赖 `english/english-data.js`。
- 索引页 → 只引样式与 `playclock`/`limit`，不引任何游戏脚本。

新增游戏时不要从共享模块里 import 游戏逻辑；要让共享模块复用你的数据，就**把数据文件抽成独立脚本**（参考 `poem/poem-data.js` 被独立页与门禁共用）。

## 2. 游戏单元的两种形态

| 形态 | 代表 | 特征 |
| --- | --- | --- |
| 单文件 | `zombie-defense/zombie-defense.html`（≈100 KB，内联 CSS/JS） | 便于整份拷走、分享；但改动定位难，搜索靠关键字 |
| 分模块 | `pvz/` `gun-game/` `typing-game/` `twenty-four/` `sailing/` | `config → util → audio → assets → entities → world → render → ui → game → app` 顺序加载，全部挂在一个 `window.XXX` 命名空间下（`sailing/` 精简为 `config → audio → game`） |

分模块形态的固定约定：

1. **脚本顺序即依赖顺序**，全部写在页面底部，不用 `defer`/`async`，不用 ESM。
2. **单一全局命名空间**（`window.PVZ`、`window.GG`、`window.TF24`、`window.PoemData`、`window.SAIL`），跨文件通信走它，不散落全局变量。
3. `config.js` 只放数值与关卡表；`render.js` 只读状态、不改逻辑；`world.js` 是唯一权威状态。
4. 需要外部工具（校验、批处理）时放 `tools/`，用 Node/Python 直接跑，不进入页面。

## 3. 页面装配顺序（以游戏页为准）

```html
<head>
  <link rel="stylesheet" href="../playclock/playclock.css">  <!-- 全站计时 -->
  <link rel="stylesheet" href="../limit/limit.css">          <!-- 限次徽标/锁屏 -->
  <link rel="stylesheet" href="../gate/gate.css">            <!-- 门禁遮罩 -->
  <link rel="stylesheet" href="../gate/challenges.css">      <!-- 题面通用样式 -->
  <!-- 游戏自己的样式 -->
</head>
<body>
  ...游戏界面...
  <script src="../playclock/playclock.js"></script>
  <script src="../gate/gate.js"></script>
  <script src="../gate/challenges/quick-math.js"></script>
  <script src="../gate/challenges/poem.js"></script>
  <script src="../poem/poem-data.js"></script>
  <script src="../limit/limit.js" data-game="<game-id>"></script>
  <!-- 游戏自己的脚本 -->
</body>
```

- `limit.js` 必须带 `data-game`，否则无法按游戏分档；首页用 `data-game="index"`。
- `playclock.js` 在首页带 `data-count="off"`（只显示休息状态，不计入游戏时长）。
- 门禁只加载实际要用的题型脚本，不必全量引入。

## 4. 存档分层

所有持久化都走 `localStorage`，禁用存储时各模块退化为内存态，不影响游玩。

| 键 | 归属 | 内容 |
| --- | --- | --- |
| `shutu.playclock.v1` | 共享 | `day`、`playedMs`、`breakUntil` |
| `shutu.limit.v1` | 共享 | `games.<id>.{plays, lockUntil}` |
| `shutu.gate.v1` | 共享 | 按页面路径分档的计时 / `passed` / `pending`，以及全站 `pending` |
| `shutu.gun-game.v2`(+`.mute`) | 游戏 | 信用点、评级、解锁、强化 |
| `shutu.racing.v1`(+`.mute.v1`) | 游戏 | `best`、`stars`、`unlocked`、`car`、`surface` |
| `shutu.plane.best.v1` / `shutu.plane.mute.v1` | 游戏 | 最高分 / 静音 |
| `shutu.tetris.sound` | 游戏 | 音效开关 |
| `tf24.mode.v1` / `tf24.music.v1` / `tf24.stats.v1` | 游戏 | 模式、音乐、战绩 |
| `poem.best.v1` / `poem.sound.v1` | 游戏 | 最高连对 / 音效 |
| `shutu.english.v1` | 游戏 | 八关进度：`levels.<id>.{best, stars, plays}` |
| `shutu.sailing.v1` / `.mute.v1` / `.music.v1` | 游戏 | `stars`、`best`（各关最佳用时）、`assist`（帆角提示开关）/ 音效 / BGM |

约定：共享键用 `shutu.<模块>.v1`；游戏键用 `shutu.<game-id>.v<N>`；早期小游戏用 `<game>.<field>.v1`（如 `poem.*`、`tf24.*`）属历史遗留，**新游戏统一走 `shutu.<id>.vN`**。

## 5. 索引页结构

`index.html` 由两块组成，改卡片时两块都要照顾到：

1. **页头**：标题、副标题、两条规则文案（必须与实际参数一致：30/10、5 次/15 分钟）。
2. **卡片网格**（`main.grid`）：每张卡 `a.card[data-game]`，含封面、`card-index` 编号、名称、描述、标签、进入提示；封面固定取自 `covers/<id>.jpg`。网格下方是页脚，硬编码「共 N 个游戏」，新增游戏时需手动改。

`limit.js` 在首页会扫描所有 `a.card` 挂锁屏与倒计时，因此**卡片必须带 `data-game`，且 id 与 `limit/limit.js` 的 `GAMES` 表一致**，否则该游戏的限次状态不会在首页显示。

## 6. 开发层文件

- `_build_zombie/`：钢铁防线的生成工作区，含 `build.py`（拼装单文件）、`shot*.html` 与 `check.js`（无头渲染自检）、多张验收截图。可整体删除而不影响线上页面。
- `_seed.html`、`_test-*.html`、`shot_menu.png`：一次性调试页面与截图，已被 `.gitignore` 的 `_*` 规则排除。其中 `_test-gate-persist.html` 是门禁持久化自检页，仍有价值，见 [quality.md](quality.md)。
- `https:/github.com/...`：把 URL 当路径误建的目录，已忽略，可删。
