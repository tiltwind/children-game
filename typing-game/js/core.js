/* 核心：小工具与 localStorage 存档 */
/* ---------- 小工具 ---------- */
function $(sel, root) { return (root || document).querySelector(sel); }
function pad2(n) { return n < 10 ? '0' + n : '' + n; }
function dayKey(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function shuffle(arr) { arr = arr.slice(); for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; }
function lv(k) { return k.length === 1 ? k.toLowerCase() : k; }

/* 判定按键是否正确：大写关要求真的按住 Shift 打出大写；虚拟键盘在大写关直接送大写字符 */
function sameKey(ch, target) {
    if (S.level && S.level.caps) return ch === target;
    return lv(ch) === lv(target);
}
function rankIndex(xp) { var i = 0; for (var j = 0; j < RANKS.length; j++) { if (xp >= RANKS[j].xp) i = j; } return i; }

function blankLevel() {
    return { practicePassed: false, practiceCount: 0, practiceBestAcc: 0, gameBest: 0, gameCount: 0, completed: false, stars: 0 };
}
function blankState() {
    return {
        version: 1, totalScore: 0, totalKeys: 0, totalPractice: 0, totalGames: 0,
        bestCombo: 0, bestCpm: 0, tokens: 0, xp: 0,
        levels: {}, badges: {}, daily: {}, sfx: true, music: true
    };
}

/* ---------- 存档 ---------- */
function load() {
    var st = blankState();
    try {
        var raw = localStorage.getItem(STORE_KEY);
        if (raw) {
            var saved = JSON.parse(raw);
            if (saved && typeof saved === 'object') {
                for (var k in st) { if (saved[k] !== undefined) st[k] = saved[k]; }
                if (typeof saved.sfx !== 'boolean') st.sfx = true;
                if (typeof saved.music !== 'boolean') st.music = true;
                st.levels = st.levels || {};
                st.badges = st.badges || {};
                st.daily = st.daily || {};
            }
        }
    } catch (e) { /* 存档坏了就当新开局，不打断游戏 */ }
    LEVELS.forEach(function (l) { if (!st.levels[l.id]) st.levels[l.id] = blankLevel(); });
    return st;
}

var st = load();
var saveTimer = null;

function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(st)); } catch (e) { }
}
function saveSoon() {
    if (saveTimer) return;
    saveTimer = setTimeout(function () { saveTimer = null; save(); }, 1500);
}

function daily() {
    var k = dayKey(new Date());
    if (!st.daily[k]) st.daily[k] = { keys: 0, score: 0, practice: 0, game: 0 };
    return st.daily[k];
}

function trackKeys(n) {
    st.totalKeys += n;
    daily().keys += n;
    saveSoon();
}
