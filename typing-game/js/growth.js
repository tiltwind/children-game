/* 成长档案：统计、七天记录、徽章 */
/* ---------- 成长档案 ---------- */
function renderGrowth() {
    var r = rankIndex(st.xp);
    var cur = RANKS[r], next = RANKS[r + 1];
    els.gRankName.textContent = cur.name;
    els.gRankXp.textContent = next ? st.xp + ' / ' + next.xp + ' XP' : st.xp + ' XP · 已到顶';
    els.gRankBar.style.width = next ? Math.min(100, (st.xp - cur.xp) / (next.xp - cur.xp) * 100) + '%' : '100%';

    var cleared = LEVELS.filter(function (l) { return st.levels[l.id].completed; }).length;
    var cells = [
        [st.totalScore, '累计得分'],
        [st.totalKeys, '累计击键'],
        [st.totalPractice, '完成练习'],
        [st.totalGames, '打完的局数'],
        [st.bestCombo, '最高连击'],
        [st.bestCpm, '最快字/分'],
        [cleared + ' / ' + LEVELS.length, '通关关卡'],
        [st.tokens, '手上的练习券']
    ];
    els.gStats.innerHTML = cells.map(function (c) {
        return '<div class="stat-cell"><b>' + c[0] + '</b><span>' + c[1] + '</span></div>';
    }).join('');

    /* 七天记录 */
    var days = [];
    for (var i = 6; i >= 0; i--) {
        var d = new Date();
        d.setDate(d.getDate() - i);
        days.push({ key: dayKey(d), label: (d.getMonth() + 1) + '/' + d.getDate(), today: i === 0 });
    }
    var maxKeys = Math.max.apply(null, days.map(function (d) { return (st.daily[d.key] && st.daily[d.key].keys) || 0; }).concat([1]));
    els.gChart.innerHTML = days.map(function (d) {
        var v = (st.daily[d.key] && st.daily[d.key].keys) || 0;
        var h = Math.max(4, Math.round(v / maxKeys * 118));
        return '<div class="chart-col' + (v ? '' : ' is-empty') + (d.today ? ' is-today' : '') + '">' +
            '<span class="chart-num">' + (v || '') + '</span>' +
            '<i class="chart-bar" style="height:' + h + 'px"></i>' +
            '<span class="chart-day">' + d.label + '</span>' +
            '</div>';
    }).join('');

    /* 成就 */
    var unlockedCount = Object.keys(st.badges).length;
    els.gBadgeCount.textContent = unlockedCount + ' / ' + BADGES.length;
    els.gBadges.innerHTML = BADGES.map(function (b) {
        var on = !!st.badges[b.id];
        return '<div class="badge ' + (on ? 'is-on' : 'is-off') + '">' +
            '<span class="badge-icon">' + b.icon + '</span>' +
            '<div class="badge-text"><b>' + b.name + '</b><span>' + b.desc + '</span></div>' +
            '</div>';
    }).join('');

    /* 每关成绩 */
    els.gRecords.innerHTML = LEVELS.map(function (l) {
        var s = st.levels[l.id];
        return '<div class="rec-row' + (l.review ? ' is-boss' : '') + '">' +
            '<span>第 ' + l.no + ' 关 · ' + l.name + (l.review ? '（总结）' : '') + '</span>' +
            '<b>' + (s.gameBest || '—') + ' 分' + (s.completed ? ' · 已通关' : '') + '</b>' +
            '</div>';
    }).join('');
}
