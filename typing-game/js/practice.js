/* 练习：生成题、判定、结果结算 */
/* ---------- 练习 ---------- */
function makePractice(level) {
    if (level.words) return shuffle(level.words).slice(0, Math.min(level.practice.len, level.words.length));
    var n = level.practice.len;
    var out = [];
    var pool = [];
    for (var i = 0; i < n; i++) {
        if (!pool.length) pool = shuffle(level.keys);
        var k = pool.shift();
        if (k === out[out.length - 1] && pool.length) {
            var t = pool[0]; pool[0] = k; k = t;
        }
        out.push(k);
    }
    return out;
}

function startPractice(levelId) {
    var level = LEVELS.filter(function (l) { return l.id === levelId; })[0];
    if (!level) return;
    S.level = level;
    S.selected = level.id;
    pr = { tokens: makePractice(level), ti: 0, ci: 0, correct: 0, errors: 0, combo: 0, maxCombo: 0, start: 0, elapsed: 0, done: false, keyEls: {} };
    els.pracNo.textContent = level.no;
    els.pracName.textContent = level.name;
    if (els.pracDesc) els.pracDesc.textContent = level.desc;
    els.pracToken.textContent = st.tokens;
    els.pracOverlay.hidden = true;
    els.pracOverlay.innerHTML = '';
    els.pracHint.className = 'prac-hint';
    els.pracHint.textContent = (level.caps ? '这一课要按住 Shift 打大写。' : '') + level.hint + '正确率要到 ' + level.practice.acc + '% 才算过关。';
    els.keyFocus.classList.remove('is-error', 'is-hit');
    buildKeyboard();
    renderPractice();
    showScreen('practice');
}

function practiceTotal() {
    return pr.tokens.reduce(function (a, t) { return a + t.length; }, 0);
}

function currentChar() {
    var t = pr.tokens[pr.ti];
    return t ? t.charAt(pr.ci) : null;
}

function fingerOf(ch) {
    var f = HAND[lv(ch)] || ['左手', '食指'];
    return f[0] + ' · ' + f[1];
}

function buildKeyboard() {
    var keyset = {};
    S.level.keys.forEach(function (k) { keyset[lv(k)] = true; });
    els.pracKb.innerHTML = '';
    pr.keyEls = {};

    var grid = document.createElement('div');
    grid.className = 'kb-grid';

    KB_LAYOUT.forEach(function (row, rowIndex) {
        var col = 1;
        row.forEach(function (k) {
            if (k.gap) { col += Math.round(k.gap * 4); return; }
            var span = Math.round(k.w * 4);
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'kb-key';
            b.style.gridRow = rowIndex + 1;
            b.style.gridColumn = col + ' / span ' + span;
            if (k.title) b.title = k.title;

            if (k.sub) {
                var subEl = document.createElement('span');
                subEl.className = 'kb-sub';
                subEl.textContent = k.sub;
                b.appendChild(subEl);
            }
            var labelEl = document.createElement('span');
            labelEl.className = 'kb-label';
            /* 窄屏上键太小，长名字换成一个符号 */
            labelEl.textContent = (window.innerWidth <= 560 && k.labelSm) ? k.labelSm : k.label;
            b.appendChild(labelEl);

            if (k.kind === 'fn') {
                /* 功能键：Shift、Tab、Enter、空格……这一课用不到的先按下去没反应，只解释它是干什么的 */
                b.classList.add('is-fn');
                if (rowIndex === 0) b.classList.add('is-fn-row');
                if (k.id === ' ') b.classList.add('is-space');
                if (S.level.caps && (k.id === 'ShiftLeft' || k.id === 'ShiftRight')) b.classList.add('is-mod');
                b.addEventListener('click', function () {
                    els.pracHint.className = 'prac-hint';
                    els.pracHint.textContent = k.title ? '这是' + k.title + '。' : '这一课还用不到这个键。';
                });
            } else if (keyset[k.id]) {
                var hand = HAND[k.id] || ['左手', '食指'];
                b.classList.add(hand[0] === '左手' ? 'is-left' : 'is-right', 'is-on');
                b.addEventListener('click', function () {
                    inputPractice(S.level.caps ? k.id.toUpperCase() : k.id);
                });
                pr.keyEls[k.id] = b;
            } else {
                /* 键盘上先摆出来，但这个键还没学到，灰着 */
                b.classList.add('is-off');
                b.addEventListener('click', function () {
                    els.pracHint.className = 'prac-hint';
                    els.pracHint.textContent = '「' + k.label + '」这个键还没学到，先把这一课的键打熟。';
                });
            }

            col += span;
            grid.appendChild(b);
        });
    });
    els.pracKb.appendChild(grid);
}

function renderPractice() {
    if (!pr || pr.done) return;
    var token = pr.tokens[pr.ti];
    if (!token) return;

    if (token.length > 1) {
        els.pracKey.classList.add('is-word');
        els.pracKey.innerHTML = token.split('').map(function (c, i) {
            var cls = i < pr.ci ? 'done' : (i === pr.ci ? 'cur' : 'todo');
            return '<span class="' + cls + '">' + c + '</span>';
        }).join('');
    } else {
        els.pracKey.classList.remove('is-word');
        els.pracKey.textContent = S.level.caps ? token : token.toUpperCase();
    }

    els.pracFinger.textContent = fingerOf(currentChar());

    var total = practiceTotal();
    var typed = pr.correct;
    var acc = pr.correct + pr.errors ? Math.round(pr.correct / (pr.correct + pr.errors) * 100) : 100;
    var cpm = pr.elapsed > 1200 ? Math.round(pr.correct / (pr.elapsed / 60000)) : 0;
    els.pracAcc.textContent = acc + '%';
    els.pracCpm.textContent = cpm + ' 字/分';
    els.pracCombo.textContent = pr.combo;
    els.pracCount.textContent = typed + ' / ' + total;
    els.pracBar.style.width = Math.min(100, typed / total * 100) + '%';

    /* 亮点序列 */
    var rest = [];
    for (var t = pr.ti; t < pr.tokens.length; t++) {
        var s = pr.tokens[t];
        for (var c = (t === pr.ti ? pr.ci : 0); c < s.length; c++) rest.push(s.charAt(c));
    }
    rest = rest.slice(0, 9);
    els.pracChips.innerHTML = rest.map(function (ch, i) {
        var cls = i === 0 ? 'is-current' : (i === 1 ? 'is-next' : '');
        return '<span class="chip ' + cls + '">' + ch.toUpperCase() + '</span>';
    }).join('');

    /* 键盘高亮 */
    Object.keys(pr.keyEls).forEach(function (k) { pr.keyEls[k].classList.remove('is-target', 'is-error'); });
    var target = pr.keyEls[lv(currentChar())];
    if (target && !target.classList.contains('is-off')) target.classList.add('is-target');
}

function inputPractice(ch) {
    if (!pr || pr.done) return;
    var cur = currentChar();
    if (!cur) return;
    if (!pr.start) pr.start = performance.now();
    trackKeys(1);

    if (sameKey(ch, cur)) {
        pr.correct++;
        pr.combo++;
        if (pr.combo > pr.maxCombo) pr.maxCombo = pr.combo;
        sfx('key');
        els.keyFocus.classList.remove('is-error');
        els.keyFocus.classList.add('is-hit');
        setTimeout(function () { els.keyFocus.classList.remove('is-hit'); }, 220);
        els.pracHint.className = 'prac-hint is-good';
        els.pracHint.textContent = pr.combo >= 5 ? pr.combo + ' 连击，手别停。' : '对了。';

        pr.ci++;
        if (pr.ci >= pr.tokens[pr.ti].length) { pr.ti++; pr.ci = 0; }
        if (pr.ti >= pr.tokens.length) { finishPractice(); return; }
        renderPractice();
    } else {
        pr.errors++;
        pr.combo = 0;
        sfx('error');
        renderPractice();
        var target = pr.keyEls[lv(cur)];
        if (target) {
            target.classList.add('is-error');
            setTimeout(function () { target.classList.remove('is-error'); }, 260);
        }
        var focus = els.keyFocus;
        focus.classList.remove('is-error');
        void focus.offsetWidth;
        focus.classList.add('is-error');
        setTimeout(function () { focus.classList.remove('is-error'); }, 340);
        els.pracHint.className = 'prac-hint is-error';
        els.pracHint.textContent = '按错了。这个键用「' + fingerOf(cur) + '」按，再试一次。';
    }
}

function finishPractice() {
    pr.done = true;
    var acc = Math.round(pr.correct / (pr.correct + pr.errors) * 100);
    var cpm = Math.round(pr.correct / Math.max(0.6, pr.elapsed / 60000));
    var level = S.level;
    var pass = acc >= level.practice.acc;
    var lvSt = st.levels[level.id];
    var gotToken = false;

    lvSt.practiceCount++;
    lvSt.practiceBestAcc = Math.max(lvSt.practiceBestAcc, acc);
    st.totalPractice++;
    daily().practice++;

    if (pass) {
        lvSt.practicePassed = true;
        if (st.tokens < 1) { st.tokens = 1; gotToken = true; }
        st.totalScore += level.review ? 50 : 30;
        st.bestCpm = Math.max(st.bestCpm, cpm);
        addXp(20 + (acc >= 95 ? 10 : 0) + (level.review ? 10 : 0));
        sfx('win');
        setTimeout(function () { burst(window.innerWidth * 0.5, 90, 34, 170); }, 120);
    }

    save();
    renderMap();
    els.pracToken.textContent = st.tokens;
    checkBadges();

    var praise = pass ? (level.review ? pick(PRAISE.boss) : pick(acc >= 95 ? ['几乎全对，手型已经稳了。', '这一遍干净利落，一个错都没多犯。'] : PRAISE.pass)) : pick(PRAISE.fail);

    els.pracOverlay.hidden = false;
    els.pracOverlay.innerHTML =
        '<div class="result-body">' +
        '<span class="result-kicker">' + (pass ? '练习完成' : '还差一点') + '</span>' +
        '<h3 class="result-title">' + (pass ? '这一遍过关了' : '正确率没到 ' + level.practice.acc + '%') + '</h3>' +
        '<p class="result-praise">' + praise + '</p>' +
        (pass ? '<div class="token-gain"><b>' + (gotToken ? '+1' : '满') + '</b><span>' + (gotToken ? '练习券到手，去玩一局' : '练习券已经满了，先用掉手上这张') + '</span></div>' : '') +
        '<div class="result-grid">' +
        '<div><b>' + acc + '%</b><span>正确率</span></div>' +
        '<div><b>' + cpm + '</b><span>字 / 分</span></div>' +
        '<div><b>' + pr.maxCombo + '</b><span>最长连击</span></div>' +
        '</div>' +
        '<div class="result-actions">' +
        (pass ? '<button class="btn is-primary" type="button" data-action="play" data-level="' + level.id + '">进入游戏</button>' : '') +
        '<button class="btn' + (pass ? '' : ' is-primary') + '" type="button" data-action="practice" data-level="' + level.id + '">再练一遍</button>' +
        '<button class="btn" type="button" data-action="map">返回地图</button>' +
        '</div>' +
        '</div>';
}
