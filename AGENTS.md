# AGENTS.md · 索引

> 这是「shutu 游戏合集」的入口索引。给人看，也给 AI / 协作代理看。
> **任何改动前先读本文件，再按下面的链接读对应文档；不要在没读规则的情况下新增游戏或改共享模块。**

## 一句话定位

纯静态网页小游戏合集：11 个独立游戏 + 1 个索引页 + 3 个全站共享模块（计时、限次、局间门禁）。
无构建、无包管理、无框架，浏览器直接打开即可运行。

## 快速开始

```bash
cd /Users/tiltwind/workspace/shutu

# 方式一：直接双击 index.html
# 方式二：本地静态服务（推荐，避免 file:// 限制）
python3 -m http.server 8123
# http://127.0.0.1:8123/index.html
```

## 目录地图

| 路径 | 作用 | 文档 |
| --- | --- | --- |
| `index.html` / `index.css` | 合集首页：每行两张卡片（封面在上、信息在下）+ 11 张游戏卡片 + 规则说明 | [doc/architecture.md](doc/architecture.md) |
| `covers/` | 首页卡片封面图（11 张 jpg，900×675，按游戏 id 命名） | — |
| `gate/` | 局间门禁引擎 + 4 种题型（24 点 / 唐诗 / 口算 / 英语） | [doc/shared-modules.md](doc/shared-modules.md) |
| `limit/` | 单游戏「玩满 4 次锁 30 分钟」 | [doc/shared-modules.md](doc/shared-modules.md) |
| `playclock/` | 全站「玩 30 分钟歇 10 分钟」 | [doc/shared-modules.md](doc/shared-modules.md) |
| `tetris/` `gun-game/` `typing-game/` `pvz/` `twenty-four/` `poem/` `plane/` `racing/` `zombie-defense/` `english/` `1024/` | 11 个独立游戏，各自页面 + 脚本 + 资源 | 见下表 |
| `_build_zombie/` | 钢铁防线的生成工作区（`build.py` / 截图 / 校验脚本），**不是正式页面** | — |
| `_seed.html` `_test-*.html` `shot_menu.png` | 开发期自检页与截图，`.gitignore` 已排除 `_*` | [doc/quality.md](doc/quality.md) |
| `https:/` | 历史误创建的目录（URL 被当成路径），`https:/*` 已忽略，可直接删 | — |

## 游戏清单

| # | 游戏 | 目录 / 入口 | 局间门禁题型 | 单独文档 |
| --- | --- | --- | --- | --- |
| 01 | 俄罗斯方块 | `tetris/tetris.html` | 24 点 / 唐诗 | — |
| 02 | 枪战游戏（铁幕街区） | `gun-game/gun-game.html` | 24 点 / 唐诗 | [gun-game/README.md](gun-game/README.md) |
| 03 | 键盘探险 | `typing-game/typing.html` | — | — |
| 04 | 草坪守卫战 | `pvz/pvz.html` | 24 点 / 唐诗 | [pvz/README.md](pvz/README.md) |
| 05 | 24 点 | `twenty-four/twenty-four.html` | 本身即题型来源 | [twenty-four/README.md](twenty-four/README.md) |
| 06 | 唐诗小状元 | `poem/poem.html` | 本身即题型来源 | [poem/README.md](poem/README.md) |
| 07 | 穿云战机 | `plane/plane.html` | 24 点 / 唐诗 | — |
| 08 | 霓虹狂飙 | `racing/racing.html` | 口算 / 唐诗 | [racing/README.md](racing/README.md) |
| 09 | 钢铁防线 | `zombie-defense/士兵打僵尸.html` | 口算 / 唐诗 | — |
| 10 | 英语小勇士 | `english/english.html` | 本身即题型来源 | — |
| 11 | 1024 陶片牌局 | `1024/1024.html` | —（回合制，未接门禁） | — |

> 门禁引擎细节见 [gate/README.md](gate/README.md)；新增游戏后必须同步更新本表、`index.html` 卡片、`covers/` 封面、`limit/limit.js` 的 `GAMES`。

## 全站规则速查（务必遵守）

| 规则 | 参数 | 实现 | 说明 |
| --- | --- | --- | --- |
| 强制休息 | 累计玩 **30 分钟** → 全站休息 **10 分钟** | `playclock/` | 全屏遮罩 + 拦截输入 + 派发 `playclock:breakstart/breakend` |
| 单游戏限次 | 单游戏完整玩满 **4 次** → 锁 **30 分钟** | `limit/` | 失败 / 中途退出不计数；首页显示倒计时 |
| 局间门禁 | 累计玩 **5 分钟** → 全屏答题，答对才继续 | `gate/` | 按页分档存档，**刷新不能绕过**；未答对状态全站共享 |

详细口径、边界条件与文案要求见 [doc/rules.md](doc/rules.md)。

## 共享模块（`window.Gate` / `window.GameLimit` / `window.PlayClock`）

- **gate**：`Gate.create({ everyMinutes, challenges, onLock, onUnlock })`，只在真正游玩时 `gate.tick(dt)`；`onLock` 必须真的停主循环。
- **limit**：`GameLimit.count("game-id")` 记一次完整通关；`GameLimit.status(id)` / `all()` 查询。
- **playclock**：引入即生效；首页用 `data-count="off"` 只展示不累计；游戏监听休息事件暂停。

接入代码、完整参数表、事件与存档键见 [doc/shared-modules.md](doc/shared-modules.md)。

## 改代码前必读

- 视觉与代码约定（咖啡色主题、无外部依赖、WebAudio 合成音效、存档键命名、响应式断点）：[doc/dev-conventions.md](doc/dev-conventions.md)
- 目录分层与依赖方向（谁能引用谁、脚本加载顺序）：[doc/architecture.md](doc/architecture.md)
- 自检、校验脚本、调试参数、验收清单：[doc/quality.md](doc/quality.md)

## 常用命令

```bash
node --check racing/racing.js          # 单文件语法检查
node gun-game/tools/validate-levels.js # 关卡连通性校验
node twenty-four/tools/test-core.js    # 24 点引擎自检
node typing-game/tools/validate-levels.js
python3 -m http.server 8123            # 本地起服务
```

## 铁律（改错代价最高的几条）

1. **不引入构建链**：保持纯静态、无 npm、无打包器；新增游戏也必须双击可跑。
2. **不绕过门禁 / 限次**：不以清 `localStorage`、改键名、跳过 `tick` 的方式「修好」计时问题。
3. **共享模块只增不改语义**：`gate/` `limit/` `playclock/` 的默认参数和存档结构改动会影响全部 11 个游戏，改前先读各自 README。
4. **首页是索引，不是游戏**：不在首页实现玩法，每张卡片一跳即走。
5. **中文文案、中文注释**；面向小学生的游戏字号要大、操作要能触屏。
6. **代码与文档同步改**：代码是唯一事实来源，文档随代码同一批次更新，不允许「先改代码，文档回头再说」。改动与文档的对应关系见下方「文档同步规则」。

## 文档索引

| 文档 | 内容 |
| --- | --- |
| [doc/architecture.md](doc/architecture.md) | 分层结构、模块依赖、脚本加载顺序、命名空间、存档分层 |
| [doc/rules.md](doc/rules.md) | 全站玩法规则：计时休息、限次、门禁、关卡与星级设计原则 |
| [doc/shared-modules.md](doc/shared-modules.md) | `gate` / `limit` / `playclock` 接入步骤、API、事件、存档键、接入矩阵 |
| [doc/dev-conventions.md](doc/dev-conventions.md) | 文件命名、代码风格、视觉规范、音效、响应式、无障碍与性能 |
| [doc/quality.md](doc/quality.md) | 自检脚本、调试参数、验收清单、已知缺口 |

## 文档同步规则

改代码时按下表找到必须一起改的文档，**同一次提交内完成**；漏改视为改动未完成。

| 改了什么 | 必须同步 |
| --- | --- |
| 计时 / 限次 / 门禁的参数（30/10、4 次/30 分钟、5 分钟） | `playclock.js` 或 `limit.js` 常量、各游戏 `createGate()`、`index.html` 页头文案、[doc/rules.md](doc/rules.md)、本文件「规则速查」、对应模块 README |
| 共享模块的 API / 参数 / 事件 / 存档键 | [doc/shared-modules.md](doc/shared-modules.md)、`gate/README.md`、`playclock/README.md`、[doc/architecture.md](doc/architecture.md) 存档表 |
| 新增或下线游戏 | 本文件游戏表与目录地图、`index.html` 卡片与页脚总数、`covers/`、`limit/limit.js` 的 `GAMES`、[doc/shared-modules.md](doc/shared-modules.md) 接入矩阵、[doc/quality.md](doc/quality.md) 缺口、该游戏 `README.md` |
| 目录结构 / 脚本加载顺序 / 依赖方向 | [doc/architecture.md](doc/architecture.md) |
| 代码风格、配色、封面尺寸、断点、存档命名 | [doc/dev-conventions.md](doc/dev-conventions.md) |
| 校验脚本 / 调试参数 / 验收步骤 | [doc/quality.md](doc/quality.md) |

发现文档与代码不一致时：**以代码为准**，同一批次修文档；无法判定哪边是对的，先提出来，不要默默改一边。

## 维护约定

- 新增文档统一放 `doc/`，并在本文件「文档索引」登记；根目录只保留 `AGENTS.md` 一份总索引。
- 各游戏更细的玩法说明仍留在各自 `README.md`，不要复制进 `doc/`，避免两处维护；本文件与 `doc/` 只写状态、规则与索引，不写玩法细节。
- 文档只记录**当前状态**，不写「最近改了什么」；易变信息（参数、清单）尽量指向维护源文件，而不是抄一份可能过期的副本。
