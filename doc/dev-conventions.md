# 开发与视觉规范

> 上层索引见 [../AGENTS.md](../AGENTS.md)。本文是可执行的约定，新建或改游戏时逐条对照。

## 1. 工程底线

- **纯静态**：双击 HTML 就能跑；不引入 npm、打包器、ESM、TypeScript、外部 UI 框架。
- **可离线**：音效一律 WebAudio 现场合成，不依赖音频文件（`twenty-four/assets/bgm.m4a` 是唯一历史例外）。
- **不新增第三方 CDN**：现有 `zombie-defense` 引了 `miaoda.feishu.cn` 的字体样式，属既有实现；新页面用系统字体栈。
- **中文注释、中文字面文案**；程序主体保持英文标识符。

## 2. 文件与命名

| 对象 | 约定 |
| --- | --- |
| 游戏目录 | 小写短横线：`gun-game/`、`typing-game/`、`twenty-four/` |
| 游戏 id | 与目录同名，且必须与 `index.html` 的 `data-game`、`limit/limit.js` 的 `GAMES`、封面文件名三者一致 |
| 文件名 | **只用英文（ASCII）字符**，一律小写短横线，禁止中文文件名；新增文件不得带中文、空格、大写 |
| 主页面 | `<id>.html`（如 `zombie-defense/zombie-defense.html`） |
| 分模块 | `config.js` `util.js` `audio.js` `assets.js` `entities.js` `world.js` `render.js` `hud.js` `ui.js` `game.js` `app.js` |
| 样式 | 单页一份 `<game>.css`；组件样式进 `css/`（如 `twenty-four/css/board.css`） |
| 工具脚本 | `tools/` 下，Node 校验用 `validate-levels.js` / `test-*.js`，素材处理用 `prepare_*.py` |
| 中间产物 | `_work/`（各自游戏内）或根目录 `_*`，不提交 |

## 3. 代码风格

- **IIFE + 单一命名空间**：`(function (global) { ... })(window)`，内部挂 `global.PVZ = ...`，不污染其他全局。
- **严格模式**：IIFE 内首行 `"use strict";`。
- **ES5 为主**：现网大量使用 `var`、`function`、字符串拼接；新代码可局部用 `let`/`const` 与箭头函数，但**不要在同一文件里混两种范式**，也不要引入 `class` 字段、可选链等高阶语法。
- **事件总线而非直接互调**：`world.on("sun", fn)`、`gate:lock` 这类自定义事件优先。
- **数值集中**：所有可调参数（速度、血量、冷却、像素尺寸、关卡表）放 `config.js` 或文件顶部常量，不散落在渲染与逻辑里。
- **渲染只读**：`render.js` 不修改游戏状态；`world.js` 是唯一权威状态源。
- **注释标「为什么」**：如 `// 门禁打开时按 Esc 不能关闭，只能解题或换题`，不写「这里是循环」这类废话。

## 4. 视觉规范

**全站底色是深咖啡 + 金 / 琥珀**，各游戏在此基调上换强调色。

索引页变量（`index.css`）：

```css
--bg-deep: #15100c;   --bg-soft: #241a13;   --card: #2c2018;
--card-hover: #35271d; --line: #4a3628;
--gold: #c9a56b;      --gold-soft: #e0c79b;
--text: #f2ebe2;      --text-dim: #b3a091;
```

- 标题用金渐变（`#fff8ee → gold-soft → #a9834b`），正文用 `--text`，次级信息用 `--text-dim`。
- 强调色组合参考：咖啡 + 琥珀 + 青绿（racing / gun-game），避免使用大面积紫 / 靛色。
- 字体：`"PingFang SC", "Helvetica Neue", "Microsoft YaHei", Arial, sans-serif`；数字与 kicker 用等宽 `"SF Mono", Menlo, Consolas, monospace`。
- 卡片：`1px solid var(--line)`，圆角，封面 + 编号 + 名称 + 描述 + 标签 + 进入箭头；hover 提亮到 `--card-hover` 并轻微上浮。
- 封面统一 **900×675（4:3）jpg**，放 `covers/<id>.jpg`，首屏用 `loading="eager"`，其余 `loading="lazy"`。

## 5. 响应式与触屏

- 断点：索引页 `700px`（双列 → 单列）、`560px`（卡片内封面与正文 40% / 1fr）；pvz 为 `760px` / `480px`；racing 在低高度视口（≤880px）压缩菜单留白，保证一屏可见。
- 画布类游戏用固定逻辑分辨率（racing `W=1280` `H=720`）等比缩放，按 DPR 处理清晰度。
- **所有操作必须有触屏等价路径**：拖动、按钮、点按；不能只靠键盘。触屏按钮放右下角或拇指区，尺寸 ≥ 44px。
- 移动端必须关掉 `-webkit-tap-highlight-color`，防止点击闪蓝。

## 6. 音效

- `audio.js` 统一暴露 `play(name)`，内部 `switch` 分派；用 `tone()` / `noise()` 组合波形。
- 首次用户交互后再 `resume()` AudioContext（浏览器自动播放策略）。
- 音效与背景音乐**两个开关**，状态分别存档；默认开，可一键静音。
- 音量克制：打击类短促、反馈类轻柔；不做持续高频蜂鸣。

## 7. 存档

- 新游戏键名：`shutu.<id>.v1`；开关类：`shutu.<id>.mute.v1`。
- 一律包一层 `try/catch`，`localStorage` 不可用时退化内存存档。
- 存档结构带版本号；升级时新增字段用默认值兜底，**不要清空玩家已有进度**。
- 首页与共享模块的键（`shutu.playclock.v1`、`shutu.limit.v1`、`shutu.gate.v1`）**不得在游戏代码里直接读写**，只用对外 API。

## 8. 新增一款游戏的检查清单

- [ ] 目录 `<id>/`，入口 `<id>.html`，可双击运行
- [ ] 引入 `../playclock/`、`../limit/`（`data-game="<id>"`）、`../gate/`（按需）
- [ ] `GameLimit.count("<id>")` 绑定在「一局真正结束」处
- [ ] 门禁 `onLock` 真停主循环，`onUnlock` 重置 `performance.now()`
- [ ] 监听 `playclock:breakstart` / `breakend`
- [ ] 存档键 `shutu.<id>.v1`，禁用存储可降级
- [ ] 键鼠 + 触屏双通道，移动端可玩
- [ ] 封面 `covers/<id>.jpg`（900×675）
- [ ] `index.html` 加卡片（`data-game` 正确）+ 更新页脚「共 N 个游戏」
- [ ] `limit/limit.js` 的 `GAMES` 登记中文名
- [ ] 根目录 `AGENTS.md` 游戏表、`doc/` 相关表格同步
- [ ] 写 `README.md`（玩法、操作、目录、存档、调试参数）
