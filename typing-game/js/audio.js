/* 声音：按键音效与程序化背景音乐 */
/* ---------- 音效与背景音乐 ---------- */
var audioCtx = null;

function ensureCtx() {
    if (!audioCtx) {
        var C = window.AudioContext || window.webkitAudioContext;
        if (!C) return null;
        audioCtx = new C();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
}

function beep(freq, dur, type, gain) {
    if (!st.sfx) return;
    var ctx = ensureCtx();
    if (!ctx) return;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    var t = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain || 0.04, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
}

function sfx(kind) {
    if (!st.sfx) return;
    if (kind === 'key') {
        beep(880 + Math.random() * 120, 0.045, 'triangle', 0.028);
        beep(1760, 0.02, 'sine', 0.01);
    } else if (kind === 'error') {
        beep(200, 0.14, 'square', 0.028);
    } else if (kind === 'hit') {
        beep(760 + Math.min(8, gm ? gm.combo : 0) * 45, 0.09, 'triangle', 0.04);
    } else if (kind === 'win') {
        beep(660, 0.12, 'triangle', 0.05);
        setTimeout(function () { beep(880, 0.14, 'triangle', 0.05); }, 130);
        setTimeout(function () { beep(1180, 0.2, 'triangle', 0.05); }, 280);
    }
}

/* 背景音乐：和弦垫 + 步进琶音，练习温和、游戏轻快 */
var CHORDS = [
    [261.63, 329.63, 392.00, 440.00],
    [220.00, 261.63, 329.63, 392.00],
    [174.61, 261.63, 349.23, 440.00],
    [196.00, 246.94, 293.66, 392.00]
];
var musicGain = null;
var musicTimer = null;
var musicNext = 0;
var musicStep = 0;
var musicMode = 'calm';

function musicTone(freq, t, dur, type, gain) {
    var ctx = audioCtx;
    if (!ctx || !musicGain) return;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(musicGain);
    osc.start(t);
    osc.stop(t + dur + 0.03);
}

function musicStepSound(t, step) {
    var bar = Math.floor(step / 8) % CHORDS.length;
    var chord = CHORDS[bar];
    var pos = step % 8;
    var fast = musicMode === 'game';
    if (pos === 0) {
        musicTone(chord[0] * 0.5, t + 0.02, fast ? 1.9 : 2.6, 'triangle', 0.032);
        musicTone(chord[1], t + 0.02, fast ? 1.9 : 2.6, 'triangle', 0.024);
        musicTone(chord[2], t + 0.05, fast ? 1.8 : 2.5, 'triangle', 0.02);
    }
    var arp = chord[(pos + bar) % chord.length];
    musicTone(arp, t, fast ? 0.16 : 0.22, 'sine', fast ? 0.07 : 0.05);
    if (fast && pos % 2 === 0) musicTone(130.81, t, 0.13, 'sine', 0.04);
    if (pos === 5) musicTone(chord[3] * 1.35, t + 0.01, 0.3, 'triangle', 0.028);
}

function musicSchedule() {
    if (!st.music || !musicGain || !audioCtx) return;
    var bpm = musicMode === 'game' ? 104 : 72;
    var stepDur = 60 / bpm / 2;
    while (musicNext < audioCtx.currentTime + 0.35) {
        musicStepSound(musicNext, musicStep);
        musicNext += stepDur;
        musicStep++;
    }
}

function startMusic() {
    var ctx = ensureCtx();
    if (!ctx || !st.music) return;
    if (!musicGain) {
        musicGain = ctx.createGain();
        musicGain.gain.value = 0;
        musicGain.connect(ctx.destination);
    }
    musicGain.gain.cancelScheduledValues(ctx.currentTime);
    musicGain.gain.setTargetAtTime(0.8, ctx.currentTime, 0.3);
    musicNext = ctx.currentTime + 0.15;
    musicStep = 0;
    if (musicTimer) clearInterval(musicTimer);
    musicTimer = setInterval(musicSchedule, 120);
}

function stopMusic() {
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
    if (musicGain && audioCtx) {
        musicGain.gain.cancelScheduledValues(audioCtx.currentTime);
        musicGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.25);
    }
}

/* 浏览器要求先有用户动作，才允许出声 */
function unlockAudio() {
    ensureCtx();
    if (st.music && !musicTimer) startMusic();
}
document.addEventListener('pointerdown', unlockAudio);
document.addEventListener('keydown', unlockAudio);

document.addEventListener('visibilitychange', function () {
    if (!audioCtx) return;
    if (document.hidden) {
        if (musicGain) musicGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.2);
    } else if (st.music && musicGain) {
        musicGain.gain.setTargetAtTime(0.8, audioCtx.currentTime, 0.3);
    }
});

function paintAudioButtons() {
    els.sfxBtn.textContent = '音效：' + (st.sfx ? '开' : '关');
    els.musicBtn.textContent = '音乐：' + (st.music ? '开' : '关');
    els.sfxBtn.classList.toggle('is-off', !st.sfx);
    els.musicBtn.classList.toggle('is-off', !st.music);
}

els.sfxBtn.addEventListener('click', function () {
    st.sfx = !st.sfx;
    save();
    paintAudioButtons();
    if (st.sfx) { ensureCtx(); beep(880, 0.08, 'sine', 0.04); }
});

els.musicBtn.addEventListener('click', function () {
    st.music = !st.music;
    save();
    paintAudioButtons();
    if (st.music) startMusic(); else stopMusic();
});

paintAudioButtons();
