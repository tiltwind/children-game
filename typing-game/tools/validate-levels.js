/* 关卡结构校验：node tools/validate-levels.js
   检查 50 关 / 每章 5 关 / 总结关不新增内容 / 章内难度单调 */
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var code = fs.readFileSync(path.join(__dirname, '..', 'js', 'config.js'), 'utf8');
var sandbox = { console: console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

var LEVELS = sandbox.LEVELS, CHAPTERS = sandbox.CHAPTERS;
var problems = [];
function bad(msg) { problems.push(msg); }

/* 1. 关数与分章 */
if (LEVELS.length !== 50) bad('总关数应为 50，实际 ' + LEVELS.length);
if (CHAPTERS.length !== 10) bad('章节数应为 10，实际 ' + CHAPTERS.length);
if (LEVELS.length !== CHAPTERS.length * 5) bad('关卡数不是每章 5 关');

var ids = {};
LEVELS.forEach(function (l) {
    if (ids[l.id]) bad('关卡 id 重复：' + l.id);
    ids[l.id] = true;
});

/* 2. 每章 5 关：前 4 关新内容，第 5 关总结 */
LEVELS.forEach(function (l, i) {
    var pos = i % 5;
    if (pos === 4 && !l.review) bad('第 ' + l.no + ' 关应为总结关');
    if (pos !== 4 && l.review) bad('第 ' + l.no + ' 关不应是总结关');
    if (l.chapterIndex !== Math.floor(i / 5)) bad('第 ' + l.no + ' 关章节编号错误');
    if (!l.keys.length) bad('第 ' + l.no + ' 关没有键位');
    if (l.words && l.words.length < 8) bad('第 ' + l.no + ' 关词库过小：' + l.words.length);
    if (l.practice.len < 6 || l.practice.len > 40) bad('第 ' + l.no + ' 练习题量异常：' + l.practice.len);
    if (l.practice.acc < 70 || l.practice.acc > 95) bad('第 ' + l.no + ' 练习正确率不合理：' + l.practice.acc);
    if (l.game.lives < 1) bad('第 ' + l.no + ' 关生命值异常');
});

/* 3. 章内难度单调（第 1–4 关） */
for (var ci = 0; ci < CHAPTERS.length; ci++) {
    var lessons = LEVELS.slice(ci * 5, ci * 5 + 4);
    for (var k = 1; k < lessons.length; k++) {
        var prev = lessons[k - 1], cur = lessons[k];
        if (cur.game.target < prev.game.target) bad('章 ' + (ci + 1) + ' 目标分下降：' + prev.no + '→' + cur.no);
        if (cur.game.speed < prev.game.speed) bad('章 ' + (ci + 1) + ' 下落速度下降：' + prev.no + '→' + cur.no);
        if (cur.game.spawn > prev.game.spawn) bad('章 ' + (ci + 1) + ' 出现间隔变长：' + prev.no + '→' + cur.no);
    }
}

/* 4. 总结关：只能考本行前四关的内容，参数必须更严 */
for (var cj = 0; cj < CHAPTERS.length; cj++) {
    var base = cj * 5;
    var boss = LEVELS[base + 4];
    var four = LEVELS.slice(base, base + 4);
    var taughtKeys = [];
    var taughtWords = [];
    four.forEach(function (l) {
        l.keys.forEach(function (key) { if (taughtKeys.indexOf(key) < 0) taughtKeys.push(key); });
        if (l.words) l.words.forEach(function (w) { if (taughtWords.indexOf(w) < 0) taughtWords.push(w); });
    });

    boss.keys.forEach(function (key) {
        if (taughtKeys.indexOf(key) < 0) bad('总结关 ' + boss.no + ' 出现未教键位：' + key);
    });
    if (boss.words) {
        boss.words.forEach(function (w) {
            if (taughtWords.indexOf(w) < 0) bad('总结关 ' + boss.no + ' 出现未教单词：' + w);
        });
    }

    var maxTarget = Math.max.apply(null, four.map(function (l) { return l.game.target; }));
    if (boss.game.target <= maxTarget) bad('总结关 ' + boss.no + ' 目标分没有高于前四关（' + boss.game.target + ' vs ' + maxTarget + '）');
    if (boss.game.time < four[3].game.time) bad('总结关 ' + boss.no + ' 时长没有加长');
    if (boss.game.speed < four[3].game.speed) bad('总结关 ' + boss.no + ' 速度没有加快');
}

/* 5. 输出 */
var lines = [];
lines.push('章节 | 第 1–4 关（新内容） | 第 5 关（总结战，目标分 / 秒数 / 下落速度）');
lines.push('---- | ---- | ----');
for (var ck = 0; ck < CHAPTERS.length; ck++) {
    var lv4 = LEVELS.slice(ck * 5, ck * 5 + 4).map(function (l) { return l.no + ' ' + l.name; });
    var bs = LEVELS[ck * 5 + 4];
    lines.push(CHAPTERS[ck].no + ' ' + CHAPTERS[ck].name + ' | ' + lv4.join('、') + ' | ' + bs.no + ' ' + bs.name + '（' + bs.game.target + ' 分 / ' + bs.game.time + ' 秒 / 速度 ' + bs.game.speed + '）');
}
console.log(lines.join('\n'));
console.log('\n总关卡：' + LEVELS.length + '，总结关：' + LEVELS.filter(function (l) { return l.review; }).length);
if (problems.length) {
    console.error('\n校验失败 ' + problems.length + ' 项：');
    problems.forEach(function (p) { console.error(' - ' + p); });
    process.exitCode = 1;
} else {
    console.log('校验通过：50 关、每章 5 关、总结关不含新内容、章内难度单调。');
}
