# 全站游戏计时

所有游戏共用一套计时：**累计玩满 30 分钟，强制休息 10 分钟**。休息期间任何游戏都不能操作，页面只显示一个 10 分钟倒计时；休息结束后自动恢复，并重新开始累计。

## 目录

```
playclock/
├── playclock.js     计时、存档、徽标、休息遮罩
├── playclock.css    徽标与遮罩样式
└── README.md
```

## 接入

在每个游戏页的 `<head>` 加样式，在 `</body>` 前加脚本：

```html
<link rel="stylesheet" href="../playclock/playclock.css">
...
<script src="../playclock/playclock.js"></script>
```

首页只展示休息状态、不累计游戏时间，脚本加 `data-count="off"`：

```html
<script src="playclock/playclock.js" data-count="off"></script>
```

已接入：俄罗斯方块、枪战、草坪守卫战、键盘探险、24 点、合集首页。

## 规则与存档

- 累计时间：`30 分钟`（`PLAY_MS`）
- 休息时间：`10 分钟`（`BREAK_MS`）
- 存储键：`shutu.playclock.v1`
- 存档字段：`day`（本地日期）、`playedMs`（当天累计游戏毫秒）、`breakUntil`（休息结束时间戳）
- 跨天自动把当日累计清零；正在进行的休息不受影响
- 只在页面可见、窗口有焦点时累计，避免后台标签页和双窗口重复计时
- 多标签页通过 `storage` 事件同步，休息在全局生效

常量写在 `playclock.js` 顶部，需要改成「玩 20 分钟休息 5 分钟」时直接改这两个值。

## 强制与游戏暂停

休息开始时：

- 全屏遮罩盖住所有内容，`z-index` 高于门禁与奖励弹窗
- 捕获阶段拦截键盘、鼠标、触摸、滚轮输入，游戏收不到操作
- 派发 `playclock:breakstart`，各游戏自行暂停主循环
- 休息结束派发 `playclock:breakend`，各游戏恢复；原本就手动暂停的游戏不会被强行恢复
- 24 点页额外暂停背景音乐，并在休息结束后把休息时长从答题计时里扣掉

事件：

```js
document.addEventListener('playclock:breakstart', pauseGame);
document.addEventListener('playclock:breakend', resumeGame);
```

## 对外接口

```js
window.PlayClock.status();
// { playedMs, breakRemainingMs, breaking, playLimitMs, breakMs }
```

## 徽标

左下角常驻「⏳ 还能玩 29:59」，最后 5 分钟变暖橙，最后 1 分钟轻微闪烁；休息时变成「🌙 休息 09:59」。徽标位于门禁徽标上方，互不遮挡。
