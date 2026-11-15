/* 入口：事件委托、键盘、计时、主循环、启动 */
/* ---------- 点击动作 ---------- */
document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-action]');
    if (!el) return;
    var action = el.getAttribute('data-action');
    var levelId = el.getAttribute('data-level');

    if (e.target.closest('#modalOk') || e.target.closest('#modalCancel')) return;

    switch (action) {
        case 'select':
            enterLevel(levelId);
            break;
        case 'practice':
            startPractice(levelId);
            break;
        case 'play':
            startGame(levelId);
            break;
        case 'map':
            if (gm && gm.active) { gm.active = false; gm.objects.forEach(function (o) { o.el.remove(); }); gm.objects = []; }
            els.gameOverlay.hidden = true;
            els.pracOverlay.hidden = true;
            renderMap();
            showScreen('map');
            break;
        case 'growth':
            els.pracOverlay.hidden = true;
            renderGrowth();
            showScreen('growth');
            break;
        case 'reset':
            openModal('清空所有记录？', '段位、总分、成就、每关成绩都会归零，练习券也会消失。这一步不能撤回。', '确认清空', function () {
                st = blankState();
                LEVELS.forEach(function (l) { st.levels[l.id] = blankLevel(); });
                S.selected = null;
                save();
                renderMap();
                renderGrowth();
                toast('记录已清空，从第一关重新开始。');
            });
            break;
        case 'nextLevel':
            if (levelId) {
                S.selected = levelId;
                renderMap();
                enterLevel(levelId);
            } else {
                renderMap();
                showScreen('map');
            }
            break;
        case 'quitGame':
            openModal('放弃这一局？', '这张练习券不会退回来，想再玩要重新练一遍。', '放弃', function () {
                if (gm) {
                    gm.active = false;
                    gm.objects.forEach(function (o) { o.el.remove(); });
                    gm.objects = [];
                }
                els.gameOverlay.hidden = true;
                renderMap();
                showScreen('map');
            });
            break;
        case 'pause':
            togglePause();
            break;
        case 'resume':
            togglePause();
            break;
    }
});

/* ---------- 键盘输入 ---------- */
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        if (S.screen === 'game' && gm && gm.active && els.modal.hidden) { togglePause(); e.preventDefault(); }
        return;
    }
    if (e.repeat) return;
    if (!els.modal.hidden) return;
    if (e.key.length !== 1) return;

    if (S.screen === 'practice' && pr && !pr.done) {
        e.preventDefault();
        inputPractice(e.key);
    } else if (S.screen === 'game' && gm && gm.active && !gm.paused) {
        e.preventDefault();
        inputGame(e.key);
    }
});

/* ---------- 练习计时 ---------- */
var clockTick = 0;
function updatePracticeClock() {
    if (!pr || !pr.start || pr.done) return;
    pr.elapsed = performance.now() - pr.start;
    clockTick++;
    if (clockTick % 10 === 0) {
        var cpm = Math.round(pr.correct / Math.max(0.016, pr.elapsed / 60000));
        els.pracCpm.textContent = cpm + ' 字/分';
        var acc = pr.correct + pr.errors ? Math.round(pr.correct / (pr.correct + pr.errors) * 100) : 100;
        els.pracAcc.textContent = acc + '%';
    }
}

/* ---------- 主循环 ---------- */
var lastTs = 0;
function frame(ts) {
    var dt = lastTs ? Math.min((ts - lastTs) / 1000, 0.05) : 0;
    lastTs = ts;
    if (S.screen === 'practice') updatePracticeClock();
    if (S.screen === 'game' && gm && gm.active && !gm.paused) updateGame(dt);
    drawFx(dt);
    requestAnimationFrame(frame);
}

window.addEventListener('resize', function () {
    if (S.screen === 'game') measureField();
});

/* ---------- 首页打字演示 ---------- */
var demoLines = [
    '从 F 和 J 开始，食指会先摸到凸点。',
    '练一遍，换一张券，再玩一局。',
    '手不要飞起来，回到基准键再出发。'
];
function runTypeDemo() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        els.typeDemo.textContent = demoLines[0];
        return;
    }
    var li = 0;
    function typeLine() {
        var text = demoLines[li % demoLines.length];
        li++;
        var i = 0;
        els.typeDemo.textContent = '';
        var timer = setInterval(function () {
            els.typeDemo.textContent = text.slice(0, i);
            i++;
            if (i > text.length) {
                clearInterval(timer);
                setTimeout(eraseLine, 1800);
            }
        }, 85);
    }
    function eraseLine() {
        var text = els.typeDemo.textContent;
        var timer = setInterval(function () {
            text = text.slice(0, -1);
            els.typeDemo.textContent = text;
            if (!text.length) {
                clearInterval(timer);
                setTimeout(typeLine, 380);
            }
        }, 45);
    }
    typeLine();
}

/* ---------- 启动 ---------- */
renderMap();
showScreen('map');
runTypeDemo();
requestAnimationFrame(frame);

if (S.screen === 'practice') updatePracticeClock();
