# 自检、调试与验收

> 上层索引见 [../AGENTS.md](../AGENTS.md)。改完任何游戏或共享模块，至少跑一遍对应的最低档自检。

## 1. 最低档：语法检查

```bash
cd /Users/tiltwind/workspace/shutu

node --check gate/gate.js
node --check limit/limit.js
node --check playclock/playclock.js
node --check racing/racing.js
node --check plane/plane.js
node --check poem/poem.js
node --check tetris/tetris-script.js
```

分模块的游戏逐个 `node --check` 对应 `js/*.js`；单文件 HTML（`zombie-defense`）用 `node --check` 跑不了，改用 `node _build_zombie/check.js` 或无头浏览器渲染。

## 2. 专项校验脚本

| 命令 | 覆盖 |
| --- | --- |
| `node gun-game/tools/validate-levels.js` | 8 关房间/走廊连通、敌人与终端是否落在可行走格、撤离点与波次点存在 |
| `node twenty-four/tools/test-core.js` | 24 点求解、判重、六模式出题约束、种子复现、算式校验、提示 |
| `node typing-game/tools/validate-levels.js` | 键盘探险 10 章 50 关的关卡表合法性 |
| `node _build_zombie/check.js` | 钢铁防线单文件构建产物的渲染 / 结构自检 |

浏览器自检页（直接打开）：

- `twenty-four/tools/ui-test.html`：棋盘、自动排列、题型注册、随机换题、两种题型通过流程，53 项断言。
- `_test-gate-persist.html`：3 秒自动弹门禁，**不答题直接刷新**，门禁应立刻重新出现（验证防绕过）。

## 3. 调试参数

| 参数 | 适用 | 作用 |
| --- | --- | --- |
| `?tf24demo=1` | 所有接门禁的游戏 | 进入立即弹门禁，不用等 5 分钟 |
| `?gate=poem` / `?gate=twenty-four` / `?gate=quick-math` / `?gate=english` | 同上 | 强制只用某题型 |
| `?nogate=1` | gun-game | 关闭门禁，方便连续测试 |
| `?mission=m1&start=1` | gun-game | 直接进入指定关卡 |
| `?unlock=1` | gun-game | 临时解锁全部关卡（不写存档） |
| `?level=N` | racing | 直接选中第 N 关，可越过解锁限制 |
| `?autostart=1` | racing | 700ms 后自动开赛 |
| `?warp=秒数` | racing | 跳过倒计时并快进赛道，用于验收结算 / 冠军页 |
| `?god=1` | racing | 免伤，只用于验收流程 |
| `?level=N` / `?practice=1` | english | 跳过锁进第 N 关 / 直接开一轮混合练习 |

组合示例：`racing/racing.html?level=6&autostart=1&god=1&warp=130` 直接跑到冠军赛终点。

控制台接口（gun-game）：`GG.Game.start(id)`、`GG.Game.world()`、`GG.Game.profile()`、`GG.Game.state()`、`GG.Game.debug()`。

## 4. 验收清单

**共享模块改动**

- [ ] 弹门禁时宿主游戏真停住（背景不动、计时不走）
- [ ] 答对后恢复，首帧不跳步
- [ ] 未答对刷新页面 → 门禁立刻重弹
- [ ] A 游戏未答对 → 切到 B 游戏 → B 同样被拦；答对一次全站放行
- [ ] 门禁打开时 `Esc` 无效
- [ ] 计时跨关卡累计，菜单 / 暂停 / 结算不计时
- [ ] 满 30 分钟 → 全站遮罩 10 分钟，输入全被拦截，结束后自动恢复
- [ ] 单游戏满 4 次 → 该游戏锁 30 分钟，首页卡片显示倒计时
- [ ] 隐私模式（禁用 localStorage）下不报错、可正常玩

**新游戏**

- [ ] 双击 `html` 可运行；`python3 -m http.server 8123` 下同样正常
- [ ] 键盘可玩、触屏可玩；390px 宽度下布局不溢出
- [ ] 背景标签不累计游玩时间；多标签同时开不出双倍计时
- [ ] 封面在首页正确显示，编号与顺序正确，页脚总数正确
- [ ] 满 4 次后回首页能看到锁定倒计时
- [ ] 静音开关生效且刷新后保留
- [ ] 按 [../AGENTS.md](../AGENTS.md)「文档同步规则」核对：受影响的文档已同批更新，无过期参数 / 清单

## 5. 无头验收（可选但推荐）

对画布类游戏，用无头 Chrome 跑一遍关键流程，比人肉点更可靠：

```bash
# 示例：截一张帧，确认渲染与 HUD 位置
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --screenshot=/tmp/shot.png \
  --window-size=1280,720 "http://127.0.0.1:8123/racing/racing.html?autostart=1&warp=20"
```

`_build_zombie/shot*.html` 里保留了可直接复用的截图宿主页写法。

## 6. 已知缺口

| 位置 | 现状 | 建议 |
| --- | --- | --- |
| `zombie-defense/士兵打僵尸.html` | 已接 gate + limit，**未接 playclock** | 按 [shared-modules.md](shared-modules.md) 第 3 节补齐，并监听休息事件暂停 |
| `tetris/README.md`、`limit/README.md` | 空文件 | 补玩法 / API 说明，或删除避免误导 |
| `https:/github.com/...` | URL 被当路径误建的目录 | 确认无用后删除（`https:/*` 已被忽略） |
| `_build_zombie/` | 生成工作区，含 700KB+ 截图 | 可整体移出仓库或保留但确认被忽略 |
| 首页页脚 | 硬编码「共 11 个游戏」 | 新增游戏时手动改，或改为由卡片数量生成 |
