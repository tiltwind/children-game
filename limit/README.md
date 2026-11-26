# 单游戏限次与冷却

每个游戏单独计次：**完整玩满 5 次，该游戏锁定 15 分钟**。锁定期间可以继续玩别的游戏，回到首页能看到每张卡片的剩余次数或锁定倒计时；冷却结束后自动清零，重新从 5 次算起。

失败、中途退出、重开都不计数，只有「一局真正走完」才计 1 次。

## 目录

```
limit/
├── limit.js     计数、存档、首页卡片状态、游戏页徽标与锁屏
├── limit.css    卡片角标、徽标、锁屏与弹层样式
└── README.md
```

## 接入

游戏页在 `</body>` 前加样式与脚本，`data-game` 必须是该游戏 id：

```html
<link rel="stylesheet" href="../limit/limit.css">
...
<script src="../limit/limit.js" data-game="tetris"></script>
```

首页用固定 id `index`（只负责展示，不计数）：

```html
<script src="limit/limit.js" data-game="index"></script>
```

已接入：俄罗斯方块、枪战、键盘探险、草坪守卫战、24 点、唐诗小状元、穿云战机、霓虹狂飙、钢铁防线、英语小勇士、1024 陶片牌局、碧海扬帆、合集首页。

## 规则与存档

- 次数上限：`5 次`（`LIMIT`）
- 冷却时长：`15 分钟`（`LOCK_MS`）
- 存储键：`shutu.limit.v1`
- 存档结构：`{ v: 1, games: { "<id>": { plays, lockUntil } } }`
- `lockUntil` 到期后 `plays` 自动归零，无需手动清理
- 多标签页通过 `storage` 事件同步，首页与游戏页状态一致

常量写在 `limit.js` 顶部，需要改成「玩满 6 次锁 20 分钟」时直接改这两个值，并同步 `index.html` 页头文案与 `doc/rules.md`。

## 对外接口

```js
window.GameLimit.status('tetris');
// { id, name, plays, limit, remaining, locked, lockUntil, remainMs }

window.GameLimit.all();               // 全部游戏状态
window.GameLimit.count('tetris');     // 记一次完整通关（省略参数用当前页 data-game）
window.GameLimit.limit / lockMs;      // 常量
```

`count()` 只在真正走完一局的地方调用（过关、结算、答满题），不要绑在开局或失败回调上；`count` 在已达上限后不再累加。

## 界面

- 首页卡片：右上角角标显示「剩 N 次」，锁定时变成「休息 MM:SS」，整卡加锁屏遮罩，点击不会进入游戏，改为弹出倒计时说明。
- 游戏页：右下角徽标显示「本游戏还能玩 N 次」；已达上限时立即弹提示并给出「回首页挑别的游戏」入口，刷新后由锁屏接管，倒计时实时刷新。
- 新增游戏必须把 id 与中文名登记到 `limit.js` 的 `GAMES`，否则首页不会显示它的限次状态。
