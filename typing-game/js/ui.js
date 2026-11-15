/* 界面：元素引用、切页、提示条、弹窗 */
/* ---------- 页面引用 ---------- */
var screens = {};
Array.prototype.forEach.call(document.querySelectorAll('[data-screen]'), function (el) { screens[el.getAttribute('data-screen')] = el; });
var els = {
    rankName: $('#rankName'), rankBar: $('#rankBar'), rankXp: $('#rankXp'), miniStats: $('#miniStats'),
    flowToken: $('#flowToken'), levelGrid: $('#levelGrid'), mapCount: $('#mapCount'), mapBar: $('#mapBar'), typeDemo: $('#typeDemo'),
    pracNo: $('#pracLevelNo'), pracName: $('#pracLevelName'), pracToken: $('#pracToken'), pracDesc: $('#pracDesc'),
    pracKey: $('#pracKey'), pracFinger: $('#pracFinger'), pracAcc: $('#pracAcc'), pracCpm: $('#pracCpm'),
    pracCombo: $('#pracCombo'), pracCount: $('#pracCount'), pracBar: $('#pracBar'), pracChips: $('#pracChips'),
    pracHint: $('#pracHint'), pracKb: $('#pracKb'), keyFocus: $('#keyFocus'), pracOverlay: $('#practiceOverlay'),
    gScore: $('#gScore'), gCombo: $('#gCombo'), gTime: $('#gTime'), gLives: $('#gLives'),
    gGoalBar: $('#gGoalBar'), gGoalText: $('#gGoalText'), field: $('#field'), fieldTip: $('#fieldTip'),
    gameOverlay: $('#gameOverlay'), gameKeys: $('#gameKeys'),
    gRankName: $('#gRankName'), gRankBar: $('#gRankBar'), gRankXp: $('#gRankXp'), gStats: $('#gStats'),
    gChart: $('#gChart'), gBadges: $('#gBadges'), gBadgeCount: $('#gBadgeCount'), gRecords: $('#gRecords'),
    toasts: $('#toasts'), modal: $('#modal'), modalTitle: $('#modalTitle'), modalText: $('#modalText'),
    modalOk: $('#modalOk'), modalCancel: $('#modalCancel'), sfxBtn: $('#sfxBtn'), musicBtn: $('#musicBtn'), fx: $('#fx')
};

var S = { screen: 'map', level: LEVELS[0], selected: null };
var pr = null;
var gm = null;

/* ---------- 视图切换 ---------- */
function showScreen(name) {
    S.screen = name;
    musicMode = name === 'game' ? 'game' : 'calm';
    Object.keys(screens).forEach(function (k) { screens[k].classList.toggle('is-active', k === name); });
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ---------- 提示条 ---------- */
function toast(text, bad) {
    var el = document.createElement('div');
    el.className = 'toast' + (bad ? ' is-bad' : '');
    el.innerHTML = '<b>' + (bad ? '注意' : '提示') + '</b><span>' + text + '</span>';
    els.toasts.appendChild(el);
    setTimeout(function () {
        el.style.transition = 'opacity .3s, transform .3s';
        el.style.opacity = '0';
        el.style.transform = 'translateY(-8px)';
        setTimeout(function () { el.remove(); }, 320);
    }, 2600);
}

/* ---------- 确认弹窗 ---------- */
var modalCb = null;
function openModal(title, text, okText, cb) {
    els.modalTitle.textContent = title;
    els.modalText.textContent = text;
    els.modalOk.textContent = okText || '确定';
    els.modal.hidden = false;
    modalCb = cb;
}
function closeModal() { els.modal.hidden = true; modalCb = null; }
els.modalCancel.addEventListener('click', closeModal);
els.modalOk.addEventListener('click', function () {
    var cb = modalCb;
    els.modal.hidden = true;
    modalCb = null;
    if (cb) cb();
});
