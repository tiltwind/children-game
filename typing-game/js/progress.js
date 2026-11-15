/* 进度：经验、段位、连续天数、成就 */
/* ---------- XP 与成就 ---------- */
function addXp(n) {
    if (!n) return;
    var before = rankIndex(st.xp);
    st.xp += n;
    var after = rankIndex(st.xp);
    if (after > before) {
        toast('段位提升：' + RANKS[after].name + '，你又进步了。');
        setTimeout(celebrate, 200);
    }
}

function streakDays() {
    var count = 0;
    for (var i = 0; i < 60; i++) {
        var d = new Date();
        d.setDate(d.getDate() - i);
        var rec = st.daily[dayKey(d)];
        if (rec && rec.keys > 0) count++;
        else if (i > 0) break;
        else if (i === 0) { /* 今天还没练，继续往前看一天 */ }
    }
    return count;
}

function checkBadges(extra) {
    extra = extra || {};
    var unlocked = [];
    function add(id) { if (!st.badges[id]) { st.badges[id] = Date.now(); unlocked.push(id); } }
    if (st.totalPractice >= 1) add('first-start');
    if (LEVELS.some(function (l) { return st.levels[l.id].completed; })) add('first-clear');
    if (st.bestCombo >= 10) add('combo10');
    if (st.bestCombo >= 25) add('combo25');
    if (extra.perfect) add('perfect');
    if (st.totalKeys >= 1000) add('keys1000');
    if (st.bestCpm >= 60) add('fast60');
    if (st.totalPractice >= 10) add('prac10');
    if (st.totalGames >= 10) add('game10');
    if (st.totalScore >= 1000) add('score1000');
    var bosses = LEVELS.filter(function (l) { return l.review; });
    if (bosses.some(function (l) { return st.levels[l.id].completed; })) add('boss-first');
    if (bosses.every(function (l) { return st.levels[l.id].completed; })) add('boss-all');
    if (LEVELS.every(function (l) { return st.levels[l.id].completed; })) add('clear-all');
    if (streakDays() >= 3) add('streak3');
    if (unlocked.length) {
        save();
        unlocked.forEach(function (id) {
            var b = BADGES.filter(function (x) { return x.id === id; })[0];
            if (b) toast('成就解锁：' + b.name + '（' + b.desc + '）');
        });
    }
}
