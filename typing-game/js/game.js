/* 游戏：下落块、判定、结算 */
/* ---------- 游戏 ---------- */
function startGame(levelId) {
    var level = LEVELS.filter(function (l) { return l.id === levelId; })[0];
    if (!level) return;
    if (st.tokens < 1) { toast('还没有练习券，先完成一遍练习再来。', true); return; }
    st.tokens -= 1;
    save();
    S.selected = level.id;
    renderMap();

    S.level = level;
    var g = level.game;
    gm = {
        level: level, mode: g.mode, target: g.target, score: 0, combo: 0, maxCombo: 0,
        lives: g.lives, time: g.time, elapsed: 0, active: true, paused: false,
        objects: [], spawnTimer: 0.5, hits: 0, errors: 0, misses: 0, chars: 0,
        lockedId: null, fieldW: 0, fieldH: 0, nextId: 1, maxObjs: g.mode === 'words' ? 3 : 4
    };
    els.gameOverlay.hidden = true;
    els.gameOverlay.innerHTML = '';
    els.pracOverlay.hidden = true;
    els.pracOverlay.innerHTML = '';
    els.field.classList.remove('is-shake', 'is-warn');
    els.fieldTip.hidden = false;
    els.fieldTip.textContent = g.mode === 'words' ? '看清楚整个单词，连着敲' : '看清字母，按对应的键';
    Array.prototype.forEach.call(els.field.querySelectorAll('.fall-obj, .fall-word, .float-score'), function (n) { n.remove(); });
    buildGameKeys();
    showScreen('game');
    measureField();
    updateGameHud(true);
}

function measureField() {
    if (!gm) return;
    gm.fieldW = els.field.clientWidth;
    gm.fieldH = els.field.clientHeight;
}

function buildGameKeys() {
    var uniq = [];
    S.level.keys.forEach(function (k) { var n = S.level.caps ? k : lv(k); if (uniq.indexOf(n) < 0) uniq.push(n); });
    /* 按真实键盘的左右顺序排，两只手的键不会混在一起 */
    uniq.sort(function (a, b) {
        var ia = KB_ORDER.hasOwnProperty(lv(a)) ? KB_ORDER[lv(a)] : 999;
        var ib = KB_ORDER.hasOwnProperty(lv(b)) ? KB_ORDER[lv(b)] : 999;
        return ia - ib;
    });
    els.gameKeys.innerHTML = uniq.map(function (k) {
        var hand = HAND[lv(k)] || ['左手', '食指'];
        return '<button class="kb-key ' + (hand[0] === '左手' ? 'is-left' : 'is-right') + '" type="button" data-gkey="' + k + '">' + k.toUpperCase() + '</button>';
    }).join('');
    Array.prototype.forEach.call(els.gameKeys.querySelectorAll('[data-gkey]'), function (b) {
        b.addEventListener('click', function () { inputGame(b.getAttribute('data-gkey')); });
    });
}

function spawnObject() {
    var g = gm.level.game;
    var lanes = gm.mode === 'words' ? 3 : 5;
    var lane = Math.floor(Math.random() * lanes);
    var text;
    if (gm.mode === 'words') {
        var onScreen = gm.objects.map(function (o) { return o.text; });
        var pool = S.level.words.filter(function (w) { return onScreen.indexOf(w) < 0; });
        text = pick(pool.length ? pool : S.level.words);
    } else {
        var used = gm.objects.map(function (o) { return lv(o.text); });
        var free = S.level.keys.filter(function (k) { return used.indexOf(lv(k)) < 0; });
        text = pick(free.length ? free : S.level.keys);
    }

    var el = document.createElement('div');
    el.className = gm.mode === 'words' ? 'fall-word' + (text.length > 7 ? ' is-long' : '') : 'fall-obj';
    el.textContent = text;
    els.field.appendChild(el);

    var o = {
        id: gm.nextId++,
        text: text,
        typed: 0,
        el: el,
        x: gm.fieldW * (lane + 0.5) / lanes,
        y: -50,
        dead: false
    };
    gm.objects.push(o);
    paintObj(o);
}

function moveObj(o) {
    o.el.style.transform = 'translate(' + o.x + 'px, ' + o.y + 'px) translateX(-50%)';
}

function paintObj(o) {
    if (gm.mode === 'words') {
        o.el.innerHTML = '<span class="done">' + o.text.slice(0, o.typed).toUpperCase() + '</span>' + o.text.slice(o.typed).toUpperCase();
    }
    moveObj(o);
}

function updateGame(dt) {
    var g = gm.level.game;
    gm.elapsed += dt;
    gm.time -= dt;
    gm.spawnTimer -= dt;

    if (gm.time <= 0) {
        gm.time = 0;
        updateGameHud();
        endGame(gm.score >= gm.target);
        return;
    }

    var speed = g.speed + g.ramp * gm.elapsed;
    if (gm.spawnTimer <= 0 && gm.objects.length < gm.maxObjs) {
        spawnObject();
        gm.spawnTimer = g.spawn;
    }

    for (var i = 0; i < gm.objects.length; i++) {
        var o = gm.objects[i];
        if (o.dead) continue;
        o.y += speed * dt;
        if (o.y > gm.fieldH - 30) {
            missObject(o);
            if (!gm.active) return;
        } else {
            moveObj(o);
        }
    }
    gm.objects = gm.objects.filter(function (o) { return !o.dead; });

    els.field.classList.toggle('is-warn', gm.time < 10);
    updateGameHud();
}

function missObject(o) {
    o.dead = true;
    o.el.remove();
    gm.lives--;
    gm.combo = 0;
    gm.misses++;
    if (gm.lockedId === o.id) gm.lockedId = null;
    sfx('error');
    els.field.classList.remove('is-shake');
    void els.field.offsetWidth;
    els.field.classList.add('is-shake');
    updateGameHud();
    if (gm.lives <= 0) endGame(false);
}

function hitObject(o, points) {
    o.dead = true;
    o.el.classList.add('is-hit');
    setTimeout(function () { o.el.remove(); }, 280);
    gm.score += points;
    gm.hits++;
    gm.combo++;
    if (gm.combo > gm.maxCombo) gm.maxCombo = gm.combo;
    gm.chars += o.text.length;
    sfx('hit');
    var rect = els.field.getBoundingClientRect();
    burst(rect.left + o.x, rect.top + o.y + 20, 8, 90, ['#f2dcb4', '#7fbfa1', '#d9b477']);
    floatScore(o.x, o.y, '+' + points);
    updateGameHud();
    if (gm.score >= gm.target) endGame(true);
}

function floatScore(x, y, text) {
    var el = document.createElement('span');
    el.className = 'float-score';
    el.textContent = text;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    els.field.appendChild(el);
    setTimeout(function () { el.remove(); }, 750);
}

function comboPoints() {
    return 10 + Math.min(gm.combo, 8) * 2;
}

function inputGame(ch) {
    if (!gm || !gm.active || gm.paused) return;
    var key = S.level.caps ? ch : lv(ch);
    trackKeys(1);

    if (gm.mode === 'words') {
        var locked = null;
        if (gm.lockedId != null) {
            locked = gm.objects.filter(function (o) { return o.id === gm.lockedId && !o.dead; })[0] || null;
        }
        if (!locked) {
            var cands = gm.objects.filter(function (o) { return !o.dead && o.text.charAt(0) === key; });
            if (cands.length) {
                cands.sort(function (a, b) { return b.y - a.y; });
                locked = cands[0];
                gm.lockedId = locked.id;
            }
        }
        if (!locked) { gameError(); return; }
        var want = locked.text.charAt(locked.typed);
        if (want !== key) { gameError(); return; }

        locked.typed++;
        sfx('key');
        if (locked.typed >= locked.text.length) {
            var pts = 20 + locked.text.length * 8 + Math.min(gm.combo, 6) * 4;
            gm.lockedId = null;
            gm.combo++;
            hitObject(locked, pts);
        } else {
            paintObj(locked);
            gm.hits++;
            gm.score += comboPoints();
            gm.combo++;
            if (gm.combo > gm.maxCombo) gm.maxCombo = gm.combo;
            updateGameHud();
            if (gm.score >= gm.target) endGame(true);
        }
        return;
    }

    var target = gm.objects.filter(function (o) {
        if (o.dead) return false;
        return S.level.caps ? o.text === key : lv(o.text) === key;
    });
    if (!target.length) { gameError(); return; }
    target.sort(function (a, b) { return b.y - a.y; });
    hitObject(target[0], comboPoints());
}

function gameError() {
    gm.errors++;
    gm.combo = 0;
    sfx('error');
    els.fieldTip.hidden = false;
    els.fieldTip.textContent = S.level.caps ? '打错了，大写要按住 Shift' : '打错了，看清字母再按';
    clearTimeout(gm.tipTimer);
    gm.tipTimer = setTimeout(function () {
        if (gm && gm.active) {
            els.fieldTip.hidden = true;
        }
    }, 1200);
    updateGameHud();
}

var hudAt = 0;
function updateGameHud(force) {
    if (!gm) return;
    var now = performance.now();
    if (!force && now - hudAt < 120) return;
    hudAt = now;
    els.gScore.textContent = gm.score;
    els.gCombo.textContent = gm.combo;
    els.gTime.textContent = Math.ceil(gm.time) + 's';
    els.gGoalBar.style.width = Math.min(100, gm.score / gm.target * 100) + '%';
    els.gGoalText.textContent = gm.score + ' / ' + gm.target;
    var hearts = '';
    for (var i = 0; i < gm.level.game.lives; i++) {
        hearts += '<span' + (i < gm.lives ? '' : ' class="off"') + '>' + HEART + '</span>';
    }
    els.gLives.innerHTML = hearts;
}

function endGame(success) {
    if (!gm || !gm.active) return;
    gm.active = false;
    /* 通过一关记一次完整游戏：玩满 4 关，本游戏休息 30 分钟 */
    if (success && window.GameLimit) window.GameLimit.count('typing');
    els.fieldTip.hidden = true;
    els.field.classList.remove('is-warn');
    var level = gm.level;
    var score = gm.score;
    var acc = gm.hits + gm.errors ? Math.round(gm.hits / (gm.hits + gm.errors) * 100) : 100;
    var cpm = Math.round(gm.chars / Math.max(0.6, gm.elapsed / 60000));

    gm.objects.forEach(function (o) { if (o.el) o.el.remove(); });
    gm.objects = [];

    var lvSt = st.levels[level.id];
    var prevBest = lvSt.gameBest;
    var isBest = score > prevBest;
    var stars = success ? (score >= gm.target * 2 ? 3 : (score >= gm.target * 1.5 ? 2 : 1)) : 0;

    st.totalScore += score;
    st.totalGames++;
    daily().score += score;
    daily().game++;
    lvSt.gameCount++;
    lvSt.gameBest = Math.max(prevBest, score);
    if (stars > lvSt.stars) lvSt.stars = stars;
    var firstClear = success && !lvSt.completed;
    if (success) lvSt.completed = true;
    st.bestCombo = Math.max(st.bestCombo, gm.maxCombo);
    st.bestCpm = Math.max(st.bestCpm, cpm);

    var gainedXp = Math.max(8, Math.floor(score / 10)) + (success ? 40 : 0) + (success && level.review ? 30 : 0);
    addXp(gainedXp);

    save();
    renderMap();
    checkBadges({ perfect: success && gm.errors === 0 });

    if (success) {
        sfx('win');
        setTimeout(celebrate, 120);
    }

    var praise = success
        ? pick(level.review ? PRAISE.boss.concat(isBest ? PRAISE.best : []) : (isBest ? PRAISE.win.concat(PRAISE.best) : PRAISE.win))
        : pick(PRAISE.fail);
    var starHtml = '';
    if (success) {
        starHtml = '<div class="stars-row">' + [0, 1, 2].map(function (i) {
            return starSvg(i < stars);
        }).join('') + '</div>';
    }

    var nextLevel = LEVELS[LEVELS.indexOf(level) + 1];
    els.gameOverlay.hidden = false;
    els.gameOverlay.innerHTML =
        '<div class="result-body">' +
        '<span class="result-kicker">' + (success ? '第 ' + level.no + ' 关 · ' + (level.review ? '总结关通关' : '通关') : '第 ' + level.no + ' 关 · 差一点') + '</span>' +
        '<h3 class="result-title">' + (success ? (level.review ? '总结关拿下！' : (isBest ? '新纪录！' : '这一关过了')) : '就差这一点点') + '</h3>' +
        starHtml +
        '<p class="result-praise">' + praise + '</p>' +
        '<div class="result-grid">' +
        '<div><b>' + score + '</b><span>本局得分</span></div>' +
        '<div><b>' + acc + '%</b><span>准确率</span></div>' +
        '<div><b>' + gm.maxCombo + '</b><span>最长连击</span></div>' +
        '</div>' +
        '<div class="result-actions">' +
        (success && nextLevel && st.levels[level.id].completed ? '<button class="btn is-primary" type="button" data-action="nextLevel" data-level="' + nextLevel.id + '">去第 ' + nextLevel.no + ' 关</button>' : '') +
        '<button class="btn' + (success ? '' : ' is-primary') + '" type="button" data-action="practice" data-level="' + level.id + '">' + (success ? '再练一遍' : '去练习换券') + '</button>' +
        '<button class="btn" type="button" data-action="map">返回地图</button>' +
        '</div>' +
        '</div>';

    if (firstClear && nextLevel) {
        setTimeout(function () { toast('第 ' + nextLevel.no + ' 关已解锁：' + nextLevel.name); }, 280);
    }
}

function togglePause() {
    if (!gm || !gm.active) return;
    gm.paused = !gm.paused;
    if (gm.paused) {
        els.gameOverlay.hidden = false;
        els.gameOverlay.innerHTML =
            '<div class="result-body">' +
            '<span class="result-kicker">暂停</span>' +
            '<h3 class="result-title">手先歇一下</h3>' +
            '<p class="result-praise">继续的话，字母会从刚才的位置接着往下走。</p>' +
            '<div class="result-actions">' +
            '<button class="btn is-primary" type="button" data-action="resume">继续</button>' +
            '<button class="btn" type="button" data-action="quitGame">放弃这一局</button>' +
            '</div></div>';
    } else {
        els.gameOverlay.hidden = true;
        els.gameOverlay.innerHTML = '';
    }
}

/* ---------- 全站强制休息 ---------- */
var pcPausedGame = false;
var pcPracticeAt = 0;

document.addEventListener('playclock:breakstart', function () {
    if (S.screen === 'game' && gm && gm.active && !gm.paused) {
        pcPausedGame = true;
        togglePause();
    }
    if (S.screen === 'practice' && pr && !pr.done) {
        pcPracticeAt = Date.now();
    }
});

document.addEventListener('playclock:breakend', function () {
    if (pcPausedGame) {
        pcPausedGame = false;
        if (gm && gm.active && gm.paused) togglePause();
    }
    if (pcPracticeAt) {
        if (pr && pr.start) pr.start += Date.now() - pcPracticeAt;
        pcPracticeAt = 0;
    }
});

