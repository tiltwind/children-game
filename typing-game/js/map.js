/* 地图：按章分行的关卡格、总进度与关卡详情 */
/* ---------- 关卡地图 ---------- */
function isUnlocked(i) { return i === 0 || st.levels[LEVELS[i - 1].id].completed; }

function levelGroups() {
    var groups = [];
    LEVELS.forEach(function (l, i) {
        var g = groups[l.chapterIndex];
        if (!g) {
            g = groups[l.chapterIndex] = { no: l.chapterNo, name: l.chapterName, sub: l.chapterSub, items: [] };
        }
        g.items.push({ level: l, index: i });
    });
    return groups;
}

function bossLevels() { return LEVELS.filter(function (l) { return l.review; }); }

function tileHtml(it) {
    var l = it.level, s = st.levels[l.id], i = it.index;
    var unlocked = isUnlocked(i);
    var cls = 'lvl-tile' + (l.review ? ' is-boss' : '') + (s.completed ? ' is-done' : '') +
        (unlocked ? '' : ' is-locked') + (S.selected === l.id ? ' is-selected' : '');
    var mark = s.completed ? CHECK : (!unlocked ? LOCK : (l.review ? CROWN : (s.practicePassed ? '<span class="lvl-dot"></span>' : '')));
    return '<button class="' + cls + '" type="button" data-action="select" data-level="' + l.id + '" aria-label="第 ' + l.no + ' 关 ' + l.name + (s.completed ? '，已通关' : '') + '">' +
        '<span class="lvl-mark">' + mark + '</span>' +
        '<span class="lvl-no">' + l.no + '</span>' +
        '<span class="lvl-nm">' + l.name + '</span>' +
        (l.review ? '<span class="lvl-tag">总结</span>' : '') +
        '</button>';
}

function renderMap() {
    var r = rankIndex(st.xp);
    var cur = RANKS[r], next = RANKS[r + 1];
    els.rankName.textContent = cur.name;
    els.rankXp.textContent = next ? st.xp + ' / ' + next.xp + ' XP' : st.xp + ' XP · 已到顶';
    els.rankBar.style.width = next ? Math.min(100, (st.xp - cur.xp) / (next.xp - cur.xp) * 100) + '%' : '100%';

    els.miniStats.innerHTML =
        '<div><b>' + st.totalScore + '</b><span>累计得分</span></div>' +
        '<div><b>' + st.totalKeys + '</b><span>累计击键</span></div>' +
        '<div><b>' + st.totalPractice + '</b><span>练习次数</span></div>';

    els.flowToken.textContent = '练习券 ' + st.tokens + ' / 1';
    var steps = document.querySelectorAll('.flow-step');
    Array.prototype.forEach.call(steps, function (el) {
        var key = el.getAttribute('data-flow');
        el.classList.toggle('is-on', (key === 'token' && st.tokens > 0) || (key === 'practice' && st.tokens === 0));
    });

    if (LEVELS.map(function (l) { return l.id; }).indexOf(S.selected) < 0) S.selected = defaultLevelId();

    var done = LEVELS.filter(function (l) { return st.levels[l.id].completed; }).length;
    var bosses = bossLevels();
    var bossDone = bosses.filter(function (l) { return st.levels[l.id].completed; }).length;
    els.mapCount.textContent = '已通过 ' + done + ' / ' + LEVELS.length + ' 关 · 总结关 ' + bossDone + ' / ' + bosses.length;
    els.mapBar.style.width = (done / LEVELS.length * 100) + '%';

    els.levelGrid.innerHTML = levelGroups().map(function (g) {
        var gDone = g.items.filter(function (it) { return st.levels[it.level.id].completed; }).length;
        return '<section class="chapter-row">' +
            '<div class="chapter-head">' +
            '<span class="ch-no">' + g.no + '</span>' +
            '<span class="ch-name">' + g.name + '</span>' +
            '<span class="ch-sub">' + g.sub + '</span>' +
            '<b class="ch-meta">' + gDone + ' / ' + g.items.length + '</b>' +
            '</div>' +
            '<div class="level-grid">' + g.items.map(tileHtml).join('') + '</div>' +
            '</section>';
    }).join('');

}

function defaultLevelId() {
    for (var i = 0; i < LEVELS.length; i++) {
        if (isUnlocked(i) && !st.levels[LEVELS[i].id].completed) return LEVELS[i].id;
    }
    return LEVELS[LEVELS.length - 1].id;
}

/* 点击关卡直接进关：已练习过且手上有券 → 直接开局；否则先练习 */
function enterLevel(id) {
    var idx = LEVELS.map(function (l) { return l.id; }).indexOf(id);
    if (idx < 0) return;
    if (!isUnlocked(idx)) {
        var prev = idx > 0 ? LEVELS[idx - 1] : null;
        toast('先通关第 ' + (prev ? prev.no : '01') + ' 关，这一关才会解锁。', true);
        return;
    }
    S.selected = id;
    renderMap();
    var s = st.levels[id];
    if (s.practicePassed && st.tokens > 0) startGame(id);
    else startPractice(id);
}

