# 唐诗小状元

小学一至六年级唐诗「接下句」游戏，同时作为 `gate/` 局间门禁的 `poem` 题型题库。

## 目录

```
poem/
├── poem.html       独立游戏页面
├── poem.css        诗卷风格、响应式、奖励弹窗
├── poem.js         随机答题、成绩、年级筛选、朗读、音效
├── poem-data.js    共享唐诗题库（独立页与门禁共用）
└── README.md
```

## 题库

- 64 首唐诗，按整首诗保存，自动拆成相邻两句的「上句 → 下句」题对，共 210 道。
- 按年级分组：一、二年级 `low` 60 题；三、四年级 `mid` 57 题；五、六年级 `high` 93 题；`all` 210 题。
- 范围以部编版小学语文课文和常见「日积月累」为主，包含《咏鹅》《静夜思》《春晓》《赠汪伦》《登鹳雀楼》《望庐山瀑布》《江雪》《夜宿山寺》《咏柳》《赋得古原草送别》《山行》《望天门山》《望洞庭》《早发白帝城》《清明》《九月九日忆山东兄弟》《滁州西涧》《大林寺桃花》《采莲曲》《浪淘沙》《鹿柴》《嫦娥》《出塞》《凉州词》《独坐敬亭山》《江南春》《江畔独步寻花》《蜂》《乞巧》《山居秋暝》《枫桥夜泊》《黄鹤楼送孟浩然之广陵》《闻官军收河南河北》《从军行》《别董大》《游子吟》《塞下曲》《宿建德江》《过故人庄》《春夜喜雨》《早春呈水部张十八员外》《夜雨寄北》《送元二使安西》《竹里馆》《芙蓉楼送辛渐》《鸟鸣涧》《逢雪宿芙蓉山主人》《秋浦歌》《小儿垂钓》《暮江吟》《蝉》《寒食》《十五夜望月》《马诗》等。
- 题库为当前实现版本，未逐条对照官方教材校勘；如教材版本或诗句用字不同，直接改 `poem-data.js` 中对应诗作即可，独立页和门禁会同时生效。

## 数据接口

全局暴露 `window.PoemData`：

```js
PoemData.count;                       // 诗作数量
PoemData.pairs();                     // 全部 { up, down, title, author, grade, length }
PoemData.gradeText(2);                // "二年级"
PoemData.inGroup(2, "low");           // true
PoemData.questionCount("low");        // 60
PoemData.pickQuestion(Math.random, {
  group: "all",                       // all / low / mid / high
  excludeUp: "床前明月光"              // 避免连续两题同一上句
});
// => { up, down, title, author, grade, length, options: [{ text, right }] }
```

`pickQuestion` 保证四个选项不重复、有且只有一个正确项；干扰项优先选「字数相同、不同诗作」的其他下句，不足时跨年级补齐。

## 独立游戏

- 入口：`poem/poem.html`，首页第 06 张卡片。
- 年级筛选：全部 / 一、二年级 / 三、四年级 / 五、六年级。
- 答错只禁用该错误项，连对清零，不直接公布答案；答错两次显示篇名和作者提示。
- 答对显示出处，1.7 秒后自动下一题，也可以点「下一题」；支持数字键 1–4。
- 连对 5 的倍数弹奖励，最高连对存 `poem.best.v1`，音效开关存 `poem.sound.v1`。
- 接入全站计时：`../playclock/playclock.css` 与 `../playclock/playclock.js`，受 30 分钟玩 / 10 分钟休息约束。

## 门禁接入

游戏页按顺序加载：

```html
<script src="../gate/gate.js"></script>
<script src="../poem/poem-data.js"></script>
<script src="../gate/challenges/poem.js"></script>
```

在 `Gate.create` 里可用 `challengeOptions.poem.group` 限定年级：

```js
challengeOptions: { poem: { group: "low" } }
```

门禁答题规则：每题只能选一次；答错立即公布正确答案，停留 8 秒后自动生成下一题；答对才通过。门禁默认不显示「换一题」，玩家不能跳过当前题目。

## 自测

```bash
node --check poem/poem-data.js
node --check poem/poem.js
node --check gate/challenges/poem.js
```

已验证：随机题四选一且唯一正确、答错/答对反馈、连对 5 题奖励、年级筛选、桌面与 390px 移动端布局、枪战游戏 `?gate=poem` 一次选择 / 公布答案 / 8 秒后换题 / 答对通过。
