/* ============================================================
 * audio.js —— 碧海扬帆：全部音效用 WebAudio 现场合成
 *
 * 无外部音频文件。分三块：
 *   1. 环境层：海浪底噪（低通白噪）+ 风声（带通白噪），随风速和船速变化
 *   2. 事件音：帆布、换舷、撞礁、横倾警告、翻船、到点
 *   3. 背景音乐：D 调五声音阶的慢板循环，音量克制
 *
 * 浏览器不允许自动播放，必须等第一次用户交互后 init()。
 * ============================================================ */
(function (global) {
    "use strict";

    var SAIL = global.SAIL = global.SAIL || {};
    var A = SAIL.Audio = {};

    var ctx = null;
    var master = null;
    var sfxGain = null;
    var musicGain = null;
    var seaGain = null;
    var windGain = null;
    var noiseBuf = null;
    var started = false;
    var melodyTimer = null;
    var nextNoteTime = 0;
    var step = 0;

    A.muted = false;      // 音效开关（默认开）
    A.musicOn = true;     // 音乐开关（默认开）

    /* 五声音阶旋律：D4 为基音，单位是半音 */
    var MELODY = [0, 5, 7, 5, 0, 7, 10, 7, 0, 5, 7, 12, 10, 7, 5, 3, -2, 3, 5, 7, 5, 3, 0, 3];
    var STEP_TIME = 0.78;
    var BASE_HZ = 293.66;

    function hz(semi) {
        return BASE_HZ * Math.pow(2, semi / 12);
    }

    /* ---------------- 初始化 ---------------- */

    function makeNoise(seconds) {
        var len = Math.floor(ctx.sampleRate * seconds);
        var buf = ctx.createBuffer(1, len, ctx.sampleRate);
        var data = buf.getChannelData(0);
        var last = 0;
        for (var i = 0; i < len; i++) {
            var white = Math.random() * 2 - 1;
            // 轻微的一阶平滑，去掉最刺耳的高频
            last = last * 0.6 + white * 0.4;
            data[i] = last;
        }
        return buf;
    }

    function init() {
        if (ctx) {
            if (ctx.state === "suspended") ctx.resume();
            return;
        }
        var AC = global.AudioContext || global.webkitAudioContext;
        if (!AC) return;

        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 1;
        master.connect(ctx.destination);

        sfxGain = ctx.createGain();
        sfxGain.gain.value = 1;
        sfxGain.connect(master);

        musicGain = ctx.createGain();
        musicGain.gain.value = 0.9;
        musicGain.connect(master);

        /* 环境层：海浪 */
        noiseBuf = makeNoise(2.0);
        var sea = ctx.createBufferSource();
        sea.buffer = noiseBuf;
        sea.loop = true;
        var seaFilter = ctx.createBiquadFilter();
        seaFilter.type = "lowpass";
        seaFilter.frequency.value = 520;
        seaFilter.Q.value = 0.4;
        seaGain = ctx.createGain();
        seaGain.gain.value = 0.10;
        sea.connect(seaFilter);
        seaFilter.connect(seaGain);
        seaGain.connect(master);
        sea.start(0);

        /* 环境层：风 */
        var wind = ctx.createBufferSource();
        wind.buffer = noiseBuf;
        wind.loop = true;
        wind.playbackRate.value = 0.7;
        var windFilter = ctx.createBiquadFilter();
        windFilter.type = "bandpass";
        windFilter.frequency.value = 1400;
        windFilter.Q.value = 0.8;
        windGain = ctx.createGain();
        windGain.gain.value = 0.05;
        wind.connect(windFilter);
        windFilter.connect(windGain);
        windGain.connect(master);
        wind.start(0);
        A._windFilter = windFilter;

        started = true;
        resumeMusic();
    }

    A.init = init;

    A.resume = function () {
        if (!ctx) init();
        if (ctx && ctx.state === "suspended") ctx.resume();
    };

    /* ---------------- 基础音色 ---------------- */

    function tone(freq, dur, type, gain, slideTo, delay) {
        if (!ctx || A.muted) return;
        var t0 = ctx.currentTime + (delay || 0);
        var osc = ctx.createOscillator();
        var g = ctx.createGain();
        osc.type = type || "sine";
        osc.frequency.setValueAtTime(freq, t0);
        if (slideTo) {
            osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
        }
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(gain, t0 + Math.min(0.06, dur * 0.3));
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(g);
        g.connect(sfxGain);
        osc.start(t0);
        osc.stop(t0 + dur + 0.02);
    }

    function noiseBurst(dur, gain, freq, q, type, delay) {
        if (!ctx || A.muted) return;
        var t0 = ctx.currentTime + (delay || 0);
        var src = ctx.createBufferSource();
        src.buffer = noiseBuf;
        var f = ctx.createBiquadFilter();
        f.type = type || "bandpass";
        f.frequency.value = freq;
        f.Q.value = q || 1;
        var g = ctx.createGain();
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(gain, t0 + 0.04);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        src.connect(f);
        f.connect(g);
        g.connect(sfxGain);
        src.start(t0);
        src.stop(t0 + dur + 0.02);
    }

    /* ---------------- 事件音 ---------------- */

    A.play = function (name) {
        if (!ctx) return;
        switch (name) {
            case "click":
                tone(520, 0.08, "square", 0.05);
                break;
            case "sailFill":            // 帆吃住风：一声轻「呼」
                noiseBurst(0.25, 0.10, 900, 0.7);
                break;
            case "sailLuff":            // 帆在抖动
                noiseBurst(0.18, 0.05, 2200, 0.5, "highpass");
                break;
            case "tack":                // 换舷：帆从一侧荡到另一侧
                noiseBurst(0.55, 0.14, 700, 0.6);
                tone(880, 0.12, "sine", 0.05, 1100, 0.04);
                break;
            case "reef":                // 撞礁
                noiseBurst(0.5, 0.2, 420, 0.5, "lowpass");
                tone(150, 0.3, "sine", 0.10, 90);
                break;
            case "heelWarn":
                tone(700, 0.1, "triangle", 0.07);
                tone(700, 0.1, "triangle", 0.07, null, 0.16);
                break;
            case "flip":                // 被阵风压翻
                tone(240, 0.7, "sawtooth", 0.10, 70);
                noiseBurst(0.8, 0.18, 500, 0.4, "lowpass");
                break;
            case "gust":                // 阵风预警
                tone(920, 0.12, "sine", 0.06);
                tone(1180, 0.16, "sine", 0.05, null, 0.14);
                break;
            case "finish":
                tone(523, 0.22, "triangle", 0.10);
                tone(659, 0.22, "triangle", 0.10, null, 0.16);
                tone(784, 0.34, "triangle", 0.12, null, 0.32);
                break;
            case "fail":
                tone(330, 0.35, "sine", 0.08, 220);
                break;
            case "count":
                tone(660, 0.12, "square", 0.04);
                break;
            case "go":
                tone(990, 0.3, "triangle", 0.08);
                break;
            default:
                break;
        }
    };

    /* ---------------- 环境参数 ---------------- */

    /* 每帧调用：windKnots 0..30，speedKnots 0..20 */
    A.setEnvironment = function (windKnots, speedKnots, playing) {
        if (!ctx || !seaGain) return;
        var targetSea = playing ? 0.07 + Math.min(speedKnots, 18) / 18 * 0.09 : 0.09;
        var targetWind = playing ? 0.02 + Math.min(windKnots, 30) / 30 * 0.16 : 0.05;
        seaGain.gain.setTargetAtTime(targetSea, ctx.currentTime, 0.25);
        windGain.gain.setTargetAtTime(targetWind, ctx.currentTime, 0.25);
        if (A._windFilter) {
            A._windFilter.frequency.setTargetAtTime(1100 + windKnots * 55, ctx.currentTime, 0.4);
        }
    };

    /* ---------------- 背景音乐 ---------------- */

    function playNote(semi, when, dur, gain, type) {
        var osc = ctx.createOscillator();
        var g = ctx.createGain();
        osc.type = type || "triangle";
        osc.frequency.value = hz(semi);
        g.gain.setValueAtTime(0, when);
        g.gain.linearRampToValueAtTime(gain, when + 0.12);
        g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
        osc.connect(g);
        g.connect(musicGain);
        osc.start(when);
        osc.stop(when + dur + 0.05);
    }

    function schedule() {
        if (!ctx || !A.musicOn) return;
        var lookahead = 1.2;
        while (nextNoteTime < ctx.currentTime + lookahead) {
            var semi = MELODY[step % MELODY.length];
            playNote(semi, nextNoteTime, 1.4, 0.055);
            // 每 4 拍落一个低音，把旋律托住
            if (step % 4 === 0) {
                playNote(semi - 12, nextNoteTime, 2.2, 0.035, "sine");
            }
            // 偶尔加一个高八度的点缀
            if (step % 8 === 3) {
                playNote(semi + 12, nextNoteTime + 0.1, 0.9, 0.025, "sine");
            }
            step++;
            nextNoteTime += STEP_TIME;
        }
    }

    function resumeMusic() {
        if (!ctx) return;
        if (melodyTimer) return;
        nextNoteTime = ctx.currentTime + 0.4;
        melodyTimer = setInterval(schedule, 250);
        schedule();
    }

    A.setMusic = function (on) {
        A.musicOn = !!on;
        if (!ctx) return;
        if (on) {
            resumeMusic();
        } else if (melodyTimer) {
            clearInterval(melodyTimer);
            melodyTimer = null;
        }
    };

    A.setSfx = function (on) {
        A.muted = !on;
        if (sfxGain) sfxGain.gain.value = on ? 1 : 0;
    };

})(typeof window !== "undefined" ? window : globalThis);
