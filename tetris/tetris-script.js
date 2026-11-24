/* ============================================================
 * tetris-script.js —— 俄罗斯方块
 *
 * 五种模式：经典 / 冲刺 / 上升 / 挖洞 / 隐形
 * 主循环由 requestAnimationFrame 常驻驱动：只要没暂停、没结束，
 * 方块就会按当前模式的「重力速度」自动往下掉。
 * 对外衔接：window.Gate（局间门禁）、window.GameLimit（局数上限）、
 *          playclock:breakstart / breakend（全站休息）。
 * ============================================================ */
document.addEventListener('DOMContentLoaded', function () {
    'use strict';

    /* ---------------- DOM ---------------- */
    var canvas = document.getElementById('gameCanvas');
    var ctx = canvas.getContext('2d');
    var nextCanvas = document.getElementById('nextCanvas');
    var nextCtx = nextCanvas.getContext('2d');
    var scoreEl = document.getElementById('score');
    var goalLabelEl = document.getElementById('goalLabel');
    var goalValueEl = document.getElementById('goalValue');
    var timeEl = document.getElementById('timeValue');
    var tipEl = document.getElementById('modeTip');
    var pauseBtn = document.getElementById('pauseBtn');
    var restartBtn = document.getElementById('restartBtn');
    var soundBtn = document.getElementById('soundBtn');
    var toastEl = document.getElementById('toast');
    var pad = document.getElementById('pad');
    var modeTabs = Array.prototype.slice.call(document.querySelectorAll('.mode-tab'));

    /* ---------------- 常量 ---------------- */
    var BLOCK_SIZE = 30;
    var BOARD_WIDTH = 10;
    var BOARD_HEIGHT = 20;
    var NEXT_BLOCK_SIZE = 20;
    var GARBAGE_COLOR = '#8d8478';

    // 方块形状（统一用方阵，保证旋转中心正确）
    var SHAPES = [
        [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], // I
        [[1, 1], [1, 1]],                                          // O
        [[0, 1, 0], [1, 1, 1], [0, 0, 0]],                          // T
        [[0, 0, 1], [1, 1, 1], [0, 0, 0]],                          // L
        [[1, 0, 0], [1, 1, 1], [0, 0, 0]],                          // J
        [[0, 1, 1], [1, 1, 0], [0, 0, 0]],                          // S
        [[1, 1, 0], [0, 1, 1], [0, 0, 0]]                           // Z
    ];

    var COLORS = [
        '#5ec8d8', // I 青
        '#f0c05a', // O 黄
        '#b07ad9', // T 紫
        '#ef9a4d', // L 橙
        '#5b8ee6', // J 蓝
        '#6ec77a', // S 绿
        '#e9665c'  // Z 红
    ];

    var LINE_SCORE = [0, 100, 300, 500, 800];
    var LINE_NAME = ['', '单行', '双行', '三行', '四行'];

    /* ---------------- 模式定义 ---------------- */
    var MODES = {
        classic: {
            name: '经典',
            tip: '经典玩法：消行升级，下落越来越快，堆到顶就结束。',
            goal: '等级',
            gravity: function (level) { return Math.max(90, 820 - (level - 1) * 70); }
        },
        sprint: {
            name: '冲刺',
            tip: '40 行竞速：从空场开始，最快清满 40 行，比的是用时。',
            goal: '行数',
            target: 40,
            gravity: function (level) { return Math.max(110, 540 - (level - 1) * 45); }
        },
        riser: {
            name: '上升',
            tip: '垃圾上升：每 8 秒从底部顶上一行带洞垃圾，撑得越久分数越高。',
            goal: '等级',
            riseEvery: 8000,
            gravity: function (level) { return Math.max(120, 700 - (level - 1) * 55); }
        },
        dig: {
            name: '挖洞',
            tip: '清理垃圾：开局铺 6 行带洞垃圾，全部清干净就算通关。',
            goal: '垃圾',
            gravity: function (level) { return Math.max(100, 640 - (level - 1) * 50); }
        },
        invisible: {
            name: '隐形',
            tip: '记忆模式：方块落定立刻隐去，只短暂显形，靠记忆继续堆。',
            goal: '等级',
            revealMs: 900,
            gravity: function (level) { return Math.max(160, 880 - (level - 1) * 80); }
        }
    };

    /* ---------------- 游戏状态 ---------------- */
    var modeId = 'classic';
    var board = createEmptyBoard();
    var score = 0;
    var lines = 0;
    var level = 1;
    var elapsed = 0;
    var dropCounter = 0;
    var riseClock = 0;
    var combo = 0;
    var currentPiece = null;
    var nextPiece = null;
    var bag = [];

    var gameOver = false;
    var win = false;
    var isPaused = false;
    var playRecorded = false;
    var revealUntil = 0;

    var rafId = 0;
    var lastTime = 0;
    var hudSecond = -1;

    var gate = null;
    var gateResume = false;
    var pcResume = false;

    var toastTimer = 0;

    /* ---------------- 音效 ---------------- */
    var audioCtx = null;
    var soundOn = readSoundPref();

    function readSoundPref() {
        try {
            return localStorage.getItem('shutu.tetris.sound') !== 'off';
        } catch (e) {
            return true;
        }
    }

    function ensureAudio() {
        if (audioCtx) return;
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        try {
            audioCtx = new AC();
        } catch (e) {
            audioCtx = null;
        }
    }

    function tone(freq, dur, type, vol) {
        if (!soundOn) return;
        ensureAudio();
        if (!audioCtx) return;
        if (audioCtx.state === 'suspended' && audioCtx.resume) {
            audioCtx.resume();
        }
        var t = audioCtx.currentTime;
        var osc = audioCtx.createOscillator();
        var gain = audioCtx.createGain();
        osc.type = type || 'square';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(vol || 0.05, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(t);
        osc.stop(t + dur + 0.02);
    }

    function sfx(kind) {
        if (!soundOn) return;
        switch (kind) {
            case 'move':
                tone(240, 0.04, 'square', 0.025);
                break;
            case 'rotate':
                tone(360, 0.05, 'square', 0.035);
                break;
            case 'lock':
                tone(130, 0.08, 'triangle', 0.05);
                break;
            case 'clear':
                tone(520, 0.12, 'sine', 0.06);
                window.setTimeout(function () { tone(690, 0.12, 'sine', 0.05); }, 90);
                break;
            case 'tetris':
                [523, 659, 784, 988].forEach(function (f, i) {
                    window.setTimeout(function () { tone(f, 0.16, 'sine', 0.06); }, i * 80);
                });
                break;
            case 'rise':
                tone(95, 0.16, 'sawtooth', 0.045);
                break;
            case 'over':
                [440, 330, 262].forEach(function (f, i) {
                    window.setTimeout(function () { tone(f, 0.22, 'triangle', 0.055); }, i * 140);
                });
                break;
            case 'win':
                [523, 659, 784, 1046].forEach(function (f, i) {
                    window.setTimeout(function () { tone(f, 0.2, 'triangle', 0.06); }, i * 120);
                });
                break;
        }
    }

    /* ---------------- 棋盘 / 方块 ---------------- */
    function createEmptyBoard() {
        return Array(BOARD_HEIGHT).fill().map(function () {
            return Array(BOARD_WIDTH).fill(0);
        });
    }

    function nextType() {
        if (!bag || bag.length === 0) {
            bag = [0, 1, 2, 3, 4, 5, 6];
            for (var i = bag.length - 1; i > 0; i--) {
                var j = Math.floor(Math.random() * (i + 1));
                var tmp = bag[i];
                bag[i] = bag[j];
                bag[j] = tmp;
            }
        }
        return bag.pop();
    }

    function makePiece() {
        var type = nextType();
        var matrix = SHAPES[type].map(function (row) { return row.slice(); });
        var n = matrix.length;
        return {
            type: type,
            matrix: matrix,
            color: COLORS[type],
            x: Math.floor((BOARD_WIDTH - n) / 2),
            y: 0
        };
    }

    function collidesAt(matrix, px, py) {
        for (var y = 0; y < matrix.length; y++) {
            for (var x = 0; x < matrix[y].length; x++) {
                if (!matrix[y][x]) continue;
                var nx = px + x;
                var ny = py + y;
                if (nx < 0 || nx >= BOARD_WIDTH || ny >= BOARD_HEIGHT) return true;
                if (ny >= 0 && board[ny][nx]) return true;
            }
        }
        return false;
    }

    function checkCollision(piece, moveX, moveY) {
        if (!piece) return false;
        return collidesAt(piece.matrix, piece.x + (moveX || 0), piece.y + (moveY || 0));
    }

    function canPlay() {
        return !!currentPiece && !isPaused && !gameOver;
    }

    function countGarbage() {
        var n = 0;
        for (var y = 0; y < BOARD_HEIGHT; y++) {
            for (var x = 0; x < BOARD_WIDTH; x++) {
                if (board[y][x] === GARBAGE_COLOR) n++;
            }
        }
        return n;
    }

    /* ---------------- 操作 ---------------- */
    function movePiece(direction) {
        if (!canPlay()) return;
        var dx = direction === 'left' ? -1 : 1;
        if (!checkCollision(currentPiece, dx, 0)) {
            currentPiece.x += dx;
            sfx('move');
        }
    }

    function rotatePiece() {
        if (!canPlay()) return;
        var m = currentPiece.matrix;
        var n = m.length;
        var rotated = [];
        for (var y = 0; y < n; y++) {
            rotated.push([]);
            for (var x = 0; x < n; x++) {
                rotated[y][x] = m[n - 1 - x][y];
            }
        }
        var kicks = [0, -1, 1, -2, 2];
        var oldMatrix = currentPiece.matrix;
        for (var i = 0; i < kicks.length; i++) {
            var testX = currentPiece.x + kicks[i];
            currentPiece.matrix = rotated;
            if (!collidesAt(rotated, testX, currentPiece.y)) {
                currentPiece.x = testX;
                sfx('rotate');
                return;
            }
        }
        currentPiece.matrix = oldMatrix;
    }

    // isPlayer = 玩家主动软降（加 1 分）
    function softDrop(isPlayer) {
        if (!canPlay()) return;
        if (!checkCollision(currentPiece, 0, 1)) {
            currentPiece.y += 1;
            if (isPlayer) score += 1;
            dropCounter = 0;
            return;
        }
        lockPiece();
        dropCounter = 0;
    }

    function hardDrop() {
        if (!canPlay()) return;
        var dist = 0;
        while (dist < BOARD_HEIGHT && !checkCollision(currentPiece, 0, 1)) {
            currentPiece.y += 1;
            dist += 1;
        }
        score += dist * 2;
        lockPiece();
        dropCounter = 0;
    }

    /* ---------------- 落定 / 消行 ---------------- */
    function lockPiece() {
        if (!currentPiece) return;
        var piece = currentPiece;
        var overflow = false;

        for (var y = 0; y < piece.matrix.length; y++) {
            for (var x = 0; x < piece.matrix[y].length; x++) {
                if (!piece.matrix[y][x]) continue;
                var ny = piece.y + y;
                var nx = piece.x + x;
                if (ny < 0) { overflow = true; continue; }
                if (nx < 0 || nx >= BOARD_WIDTH) continue;
                board[ny][nx] = piece.color;
            }
        }

        if (MODES[modeId].revealMs) {
            revealUntil = performance.now() + MODES[modeId].revealMs;
        }

        currentPiece = null;
        sfx('lock');

        if (overflow) {
            endRound(false);
            return;
        }

        clearLines();
        updateHud();

        // 各模式的通关判定
        if (modeId === 'sprint' && lines >= MODES.sprint.target) {
            endRound(true);
            return;
        }
        if (modeId === 'dig' && countGarbage() === 0) {
            endRound(true);
            return;
        }

        spawnPiece();
    }

    function clearLines() {
        var count = 0;
        for (var y = BOARD_HEIGHT - 1; y >= 0; y--) {
            var full = true;
            for (var x = 0; x < BOARD_WIDTH; x++) {
                if (!board[y][x]) { full = false; break; }
            }
            if (full) {
                board.splice(y, 1);
                board.unshift(Array(BOARD_WIDTH).fill(0));
                y += 1;
                count += 1;
            }
        }

        if (count > 0) {
            lines += count;
            level = 1 + Math.floor(lines / 10);
            combo += 1;

            var base = LINE_SCORE[count] || 800;
            var gain = base * level;
            if (combo > 1) gain += (combo - 1) * 50 * level;
            score += gain;

            showToast((LINE_NAME[count] || count + ' 行') + '消除 +' + gain + (combo > 1 ? ' x' + combo : ''), 'is-good');
            sfx(count >= 4 ? 'tetris' : 'clear');
        } else {
            combo = 0;
        }

        return count;
    }

    function spawnPiece() {
        currentPiece = nextPiece || makePiece();
        nextPiece = makePiece();
        drawNextPiece();
        if (checkCollision(currentPiece)) {
            currentPiece = null;
            endRound(false);
        }
    }

    /* ---------------- 上升模式的垃圾行 ---------------- */
    function pushGarbageRow() {
        if (gameOver) return;

        // 顶行已经被占，再顶就出界
        var topUsed = false;
        for (var x = 0; x < BOARD_WIDTH; x++) {
            if (board[0][x]) { topUsed = true; break; }
        }
        if (topUsed) {
            endRound(false);
            return;
        }

        var holes = Math.random() < 0.62 ? 1 : 2;
        var row = Array(BOARD_WIDTH).fill(GARBAGE_COLOR);
        var holeSet = {};
        while (Object.keys(holeSet).length < holes) {
            holeSet[Math.floor(Math.random() * BOARD_WIDTH)] = true;
        }
        Object.keys(holeSet).forEach(function (k) {
            row[Number(k)] = 0;
        });

        board.shift();
        board.push(row);

        // 正在下落的方块被顶起来
        var guard = 0;
        while (currentPiece && checkCollision(currentPiece) && guard < 25) {
            currentPiece.y -= 1;
            guard += 1;
        }
        if (currentPiece && (currentPiece.y < 0 || checkCollision(currentPiece))) {
            endRound(false);
            return;
        }

        sfx('rise');
        showToast('垃圾上升 +1 行', 'is-warn');
        updateHud();
    }

    /* ---------------- 一局结束 ---------------- */
    function endRound(isWin) {
        if (gameOver) return;
        gameOver = true;
        win = !!isWin;
        stopGate();
        sfx(win ? 'win' : 'over');

        if (!playRecorded && window.GameLimit) {
            playRecorded = true;
            try {
                window.GameLimit.count('tetris');
            } catch (e) {}
        }

        updateHud();
        render();
    }

    /* ---------------- 新开一局 ---------------- */
    function newGame(id) {
        stopGate();

        modeId = MODES[id] ? id : 'classic';
        modeTabs.forEach(function (tab) {
            var active = tab.getAttribute('data-mode') === modeId;
            tab.classList.toggle('is-active', active);
            tab.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        tipEl.textContent = MODES[modeId].tip;

        // 清掉上一局残留的提示条
        if (toastEl) {
            window.clearTimeout(toastTimer);
            toastEl.className = 'toast';
            toastEl.textContent = '';
        }

        board = createEmptyBoard();
        score = 0;
        lines = 0;
        level = 1;
        elapsed = 0;
        dropCounter = 0;
        riseClock = 0;
        combo = 0;
        revealUntil = 0;
        hudSecond = -1;

        gameOver = false;
        win = false;
        isPaused = false;
        playRecorded = false;
        bag = [];
        currentPiece = null;
        nextPiece = makePiece();
        pauseBtn.textContent = '暂停';

        if (modeId === 'dig') seedDigBoard();

        spawnPiece();
        updateHud();
        drawNextPiece();
        render();

        createGate();

        // 局数上限锁定中：先停着，等遮罩上的倒计时结束
        if (isLimitLocked()) {
            isPaused = true;
            pauseBtn.textContent = '继续';
        }

        lastTime = performance.now();
        startLoop();
    }

    function seedDigBoard() {
        for (var y = BOARD_HEIGHT - 6; y < BOARD_HEIGHT; y++) {
            var holes = Math.random() < 0.6 ? 1 : 2;
            var holeSet = {};
            while (Object.keys(holeSet).length < holes) {
                holeSet[Math.floor(Math.random() * BOARD_WIDTH)] = true;
            }
            for (var x = 0; x < BOARD_WIDTH; x++) {
                board[y][x] = holeSet[x] ? 0 : GARBAGE_COLOR;
            }
        }
    }

    function isLimitLocked() {
        if (!window.GameLimit || typeof window.GameLimit.status !== 'function') return false;
        try {
            return !!window.GameLimit.status().locked;
        } catch (e) {
            return false;
        }
    }

    /* ---------------- 主循环 ---------------- */
    function startLoop() {
        if (rafId) return;
        lastTime = performance.now();
        rafId = window.requestAnimationFrame(frame);
    }

    function frame(t) {
        rafId = window.requestAnimationFrame(frame);

        var dt = t - lastTime;
        lastTime = t;
        if (!(dt > 0)) dt = 0;
        if (dt > 120) dt = 120;

        if (!isPaused && !gameOver) update(dt);
        render();
    }

    function update(dt) {
        elapsed += dt;

        var sec = Math.floor(elapsed / 1000);
        if (sec !== hudSecond) {
            hudSecond = sec;
            updateHud();
        }

        // 自动下落：不同模式不同重力
        var interval = MODES[modeId].gravity(level);
        dropCounter += dt;
        if (dropCounter >= interval) {
            dropCounter = 0;
            softDrop(false);
            if (gameOver) return;
        }

        // 上升模式：定时顶垃圾行
        if (modeId === 'riser') {
            riseClock += dt;
            if (riseClock >= MODES.riser.riseEvery) {
                riseClock = 0;
                pushGarbageRow();
                if (gameOver) return;
            }
        }

        // 局间门禁计时（只在实际游玩时走）
        if (gate && dt > 0) {
            gate.tick(Math.min(dt, 1000) / 1000);
        }
    }

    /* ---------------- 绘制 ---------------- */
    function drawBlock(context, x, y, color, size) {
        context.fillStyle = color;
        context.fillRect(x, y, size - 1, size - 1);
        context.fillStyle = 'rgba(255,255,255,0.24)';
        context.fillRect(x + 2, y + 2, size - 5, 3);
        context.strokeStyle = 'rgba(0,0,0,0.32)';
        context.lineWidth = 1;
        context.strokeRect(x + 0.5, y + 0.5, size - 2, size - 2);
    }

    function drawPiece(context, piece, size) {
        for (var y = 0; y < piece.matrix.length; y++) {
            for (var x = 0; x < piece.matrix[y].length; x++) {
                if (!piece.matrix[y][x]) continue;
                if (piece.y + y < 0) continue;
                drawBlock(context, (piece.x + x) * size, (piece.y + y) * size, piece.color, size);
            }
        }
    }

    function drawGhost() {
        if (!currentPiece) return;
        var matrix = currentPiece.matrix;
        var gy = currentPiece.y;
        while (gy < BOARD_HEIGHT && !collidesAt(matrix, currentPiece.x, gy + 1)) gy += 1;
        if (gy === currentPiece.y) return;

        ctx.save();
        ctx.globalAlpha = 0.26;
        for (var y = 0; y < matrix.length; y++) {
            for (var x = 0; x < matrix[y].length; x++) {
                if (!matrix[y][x]) continue;
                if (gy + y < 0) continue;
                ctx.fillStyle = currentPiece.color;
                ctx.fillRect((currentPiece.x + x) * BLOCK_SIZE, (gy + y) * BLOCK_SIZE, BLOCK_SIZE - 1, BLOCK_SIZE - 1);
            }
        }
        ctx.restore();
    }

    function drawGrid() {
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1;
        for (var x = 1; x < BOARD_WIDTH; x++) {
            ctx.beginPath();
            ctx.moveTo(x * BLOCK_SIZE + 0.5, 0);
            ctx.lineTo(x * BLOCK_SIZE + 0.5, canvas.height);
            ctx.stroke();
        }
        for (var y = 1; y < BOARD_HEIGHT; y++) {
            ctx.beginPath();
            ctx.moveTo(0, y * BLOCK_SIZE + 0.5);
            ctx.lineTo(canvas.width, y * BLOCK_SIZE + 0.5);
            ctx.stroke();
        }
    }

    function drawNextPiece() {
        nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
        if (!nextPiece) return;

        var minX = 99, maxX = -1, minY = 99, maxY = -1;
        for (var y = 0; y < nextPiece.matrix.length; y++) {
            for (var x = 0; x < nextPiece.matrix[y].length; x++) {
                if (!nextPiece.matrix[y][x]) continue;
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
        if (maxX < 0) return;

        var w = maxX - minX + 1;
        var h = maxY - minY + 1;
        var offsetX = (nextCanvas.width - w * NEXT_BLOCK_SIZE) / 2;
        var offsetY = (nextCanvas.height - h * NEXT_BLOCK_SIZE) / 2;

        for (var y2 = minY; y2 <= maxY; y2++) {
            for (var x2 = minX; x2 <= maxX; x2++) {
                if (!nextPiece.matrix[y2][x2]) continue;
                drawBlock(
                    nextCtx,
                    offsetX + (x2 - minX) * NEXT_BLOCK_SIZE,
                    offsetY + (y2 - minY) * NEXT_BLOCK_SIZE,
                    nextPiece.color,
                    NEXT_BLOCK_SIZE
                );
            }
        }
    }

    function render() {
        var now = performance.now();

        ctx.fillStyle = '#120d09';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 隐形模式：只有落定后的一小段时间显示已堆叠的方块
        var showLocked = modeId !== 'invisible' || now < revealUntil;
        if (showLocked) {
            for (var y = 0; y < BOARD_HEIGHT; y++) {
                for (var x = 0; x < BOARD_WIDTH; x++) {
                    if (board[y][x]) {
                        drawBlock(ctx, x * BLOCK_SIZE, y * BLOCK_SIZE, board[y][x], BLOCK_SIZE);
                    }
                }
            }
        }

        drawGrid();

        if (currentPiece && !gameOver) {
            if (modeId !== 'invisible') drawGhost();
            drawPiece(ctx, currentPiece, BLOCK_SIZE);
        }

        if (isPaused && !gameOver) {
            overlay('已暂停', ['按 P 或点「继续」接着玩']);
        } else if (gameOver) {
            if (win) {
                overlay(winTitle(), winLines());
            } else {
                overlay('游戏结束', [
                    '分数 ' + score + ' · ' + fmtTime(elapsed),
                    '点「再来一局」或按 R 重开'
                ]);
            }
        }

        if (modeId === 'invisible' && !showLocked && !gameOver && !isPaused) {
            ctx.fillStyle = 'rgba(224,199,155,0.55)';
            ctx.font = '12px "PingFang SC", Arial';
            ctx.textAlign = 'center';
            ctx.fillText('记忆模式 · 堆叠已隐去', canvas.width / 2, 18);
            ctx.textAlign = 'left';
        }
    }

    function overlay(title, subtitleLines) {
        ctx.fillStyle = 'rgba(10, 7, 4, 0.82)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.textAlign = 'center';
        ctx.fillStyle = '#e0c79b';
        ctx.font = '600 34px "PingFang SC", "Helvetica Neue", Arial';
        ctx.fillText(title, canvas.width / 2, canvas.height / 2 - 30);

        ctx.fillStyle = 'rgba(224, 199, 155, 0.78)';
        ctx.font = '14px "PingFang SC", "Helvetica Neue", Arial';
        (subtitleLines || []).forEach(function (line, i) {
            ctx.fillText(line, canvas.width / 2, canvas.height / 2 + 10 + i * 26);
        });
        ctx.textAlign = 'left';
    }

    function winTitle() {
        if (modeId === 'sprint') return '冲刺完成';
        if (modeId === 'dig') return '垃圾清空';
        return '过关';
    }

    function winLines() {
        if (modeId === 'sprint') {
            return ['40 行 · 用时 ' + fmtTime(elapsed), '分数 ' + score, '点「再来一局」或按 R'];
        }
        if (modeId === 'dig') {
            return ['用时 ' + fmtTime(elapsed), '分数 ' + score, '点「再来一局」或按 R'];
        }
        return ['分数 ' + score];
    }

    /* ---------------- HUD ---------------- */
    function fmtTime(ms) {
        var total = Math.max(0, Math.floor(ms / 1000));
        var m = Math.floor(total / 60);
        var s = total % 60;
        return m + ':' + (s < 10 ? '0' + s : s);
    }

    function updateHud() {
        scoreEl.textContent = score;

        if (modeId === 'sprint') {
            goalLabelEl.textContent = '行数';
            goalValueEl.textContent = Math.min(lines, MODES.sprint.target) + '/' + MODES.sprint.target;
        } else if (modeId === 'dig') {
            goalLabelEl.textContent = '垃圾';
            goalValueEl.textContent = countGarbage();
        } else {
            goalLabelEl.textContent = '等级';
            goalValueEl.textContent = level;
        }

        timeEl.textContent = fmtTime(elapsed);
    }

    function showToast(text, cls) {
        if (!toastEl) return;
        toastEl.textContent = text;
        toastEl.className = 'toast is-show' + (cls ? ' ' + cls : '');
        window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(function () {
            toastEl.className = 'toast';
        }, 1400);
    }

    /* ---------------- 暂停 ---------------- */
    function togglePause() {
        if (gameOver) return;
        if (gate && gate.locked) return; // 门禁答题中，由门禁自己控制节奏
        isPaused = !isPaused;
        pauseBtn.textContent = isPaused ? '继续' : '暂停';
        if (!isPaused) lastTime = performance.now();
        render();
        updateHud();
    }

    /* ---------------- 局间门禁 ---------------- */
    function isTouchDevice() {
        try {
            return !!(window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches);
        } catch (e) {
            return false;
        }
    }

    function createGate() {
        if (!window.Gate) return;
        gate = window.Gate.create({
            everyMinutes: 5,
            challenges: ['twenty-four', 'poem', 'english'],
            // 触屏上徽标会压住底部触控键，交给门禁弹层本身提示即可
            showBadge: !isTouchDevice(),
            badgePosition: 'bottom-left',
            openOnStart: /[?&]tf24demo=1/.test(location.search),
            kicker: '局间门禁 · 俄罗斯方块',
            title: '先过一道关卡',
            note: '方块已经堆了 5 分钟。完成这道题，节奏接着走。',
            onLock: function () {
                if (gameOver) return;
                gateResume = !isPaused;
                isPaused = true;
                pauseBtn.textContent = '继续';
                render();
            },
            onUnlock: function () {
                if (!gateResume || gameOver) return;
                gateResume = false;
                isPaused = false;
                pauseBtn.textContent = '暂停';
                lastTime = performance.now();
                render();
            }
        });
    }

    function stopGate() {
        if (gate) {
            var g = gate;
            gate = null;
            g.destroy();
        }
        gateResume = false;
    }

    /* ---------------- 事件 ---------------- */
    modeTabs.forEach(function (tab) {
        tab.addEventListener('click', function () {
            ensureAudio();
            newGame(tab.getAttribute('data-mode'));
        });
    });

    pauseBtn.addEventListener('click', function () {
        ensureAudio();
        togglePause();
    });

    restartBtn.addEventListener('click', function () {
        ensureAudio();
        newGame(modeId);
    });

    soundBtn.addEventListener('click', function () {
        soundOn = !soundOn;
        try {
            localStorage.setItem('shutu.tetris.sound', soundOn ? 'on' : 'off');
        } catch (e) {}
        soundBtn.textContent = soundOn ? '🔊' : '🔇';
        soundBtn.setAttribute('aria-label', soundOn ? '关闭音效' : '开启音效');
        if (soundOn) sfx('rotate');
    });

    if (pad) {
        pad.addEventListener('pointerdown', function (e) {
            var btn = e.target.closest ? e.target.closest('button') : null;
            if (!btn) return;
            e.preventDefault();
            ensureAudio();
            var act = btn.getAttribute('data-act');
            if (act === 'left') movePiece('left');
            else if (act === 'right') movePiece('right');
            else if (act === 'rotate') rotatePiece();
            else if (act === 'down') softDrop(true);
            else if (act === 'drop') hardDrop();
        });
    }

    document.addEventListener('keydown', function (e) {
        var key = e.key;

        if (key === 'p' || key === 'P') {
            e.preventDefault();
            togglePause();
            return;
        }
        if (key === 'r' || key === 'R') {
            e.preventDefault();
            newGame(modeId);
            return;
        }
        if (gameOver || isPaused) return;

        switch (key) {
            case 'ArrowLeft':
                e.preventDefault();
                movePiece('left');
                break;
            case 'ArrowRight':
                e.preventDefault();
                movePiece('right');
                break;
            case 'ArrowDown':
                e.preventDefault();
                softDrop(true);
                break;
            case 'ArrowUp':
                e.preventDefault();
                rotatePiece();
                break;
            case ' ':
            case 'Spacebar':
                e.preventDefault();
                hardDrop();
                break;
            default:
                return;
        }
        ensureAudio();
    });

    // 全站强制休息：暂停游戏，休息结束后自动接着玩
    document.addEventListener('playclock:breakstart', function () {
        if (gameOver || isPaused) {
            pcResume = false;
            return;
        }
        pcResume = true;
        isPaused = true;
        pauseBtn.textContent = '继续';
        render();
    });

    document.addEventListener('playclock:breakend', function () {
        if (!pcResume || gameOver) return;
        pcResume = false;
        isPaused = false;
        pauseBtn.textContent = '暂停';
        lastTime = performance.now();
        render();
    });

    /* ---------------- 调试钩子（仅 ?debug=1 时挂载，正常游玩不暴露） ---------------- */
    if (/[?&]debug=1/.test(location.search)) {
        window.__tetris = {
            snapshot: function () {
                return {
                    modeId: modeId,
                    score: score,
                    lines: lines,
                    level: level,
                    elapsed: elapsed,
                    gameOver: gameOver,
                    win: win,
                    isPaused: isPaused,
                    board: board.map(function (row) { return row.slice(); }),
                    current: currentPiece
                        ? { x: currentPiece.x, y: currentPiece.y, type: currentPiece.type }
                        : null
                };
            },
            newGame: newGame,
            hardDrop: hardDrop,
            move: movePiece,
            rotate: rotatePiece,
            endRound: endRound,
            setLines: function (v) { lines = v; },
            setBoard: function (rows) { board = rows; },
            openGate: function () { if (gate) gate.openNow(); },
            closeGate: function () { if (gate) gate.close(); }
        };
    }

    /* ---------------- 启动 ---------------- */
    soundBtn.textContent = soundOn ? '🔊' : '🔇';
    soundBtn.setAttribute('aria-label', soundOn ? '关闭音效' : '开启音效');
    newGame('classic');
});
