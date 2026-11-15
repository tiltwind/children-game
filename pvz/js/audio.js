/* ============================================================
 * audio.js —— 全部音效用 WebAudio 现场合成，不依赖音频文件
 * 击打类：shot / hit / sniper / boom / mine / groan / shovel
 * 反馈类：sun / plant / warn / win / lose / levelup / click / error
 * ============================================================ */
window.PVZ = window.PVZ || {};

(function (PVZ) {
  "use strict";

  var Ctx = window.AudioContext || window.webkitAudioContext;

  // 高频音效做最小间隔节流，避免多株植物同时开火时糊成一片
  var THROTTLE = { shot: 1, gatling: 1, hit: 1, chomp: 1, sniperHit: 1, burst: 1 };
  var THROTTLE_MS = 110;

  function AudioKit() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.noiseBuf = null;
    this.ready = false;
    this._lastPlay = {};
  }

  AudioKit.prototype.init = function () {
    if (this.ctx || !Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.85;
    this.master.connect(this.ctx.destination);
    this.ready = true;
    // 预生成一段噪声，供打击/爆炸复用
    var len = Math.floor(this.ctx.sampleRate * 1.2);
    var buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
  };

  AudioKit.prototype.resume = function () {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
  };

  AudioKit.prototype.setMuted = function (m) {
    this.muted = !!m;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.85;
  };

  // ============ 背景音乐：WebAudio 现场合成的循环小调 ============
  var BGM_STEP = 0.46;          // 每个音符的时值（秒）
  var BGM_MEL = [               // 以半音为单位的旋律，相对 C5
    3, 5, 7, 8, 7, 5, 3, 1,
    3, 5, 7, 10, 7, 5, 3, 3,
    7, 8, 10, 8, 7, 5, 7, 7,
    5, 3, 1, 0, 3, 5, 3, 3
  ];

  AudioKit.prototype.setMusic = function (on) {
    this.musicOn = !!on;
    if (!on) this.stopBGM();
  };

  AudioKit.prototype.startBGM = function () {
    if (!this.ctx || this.bgmOn || this.musicOn === false) return;
    this.bgmOn = true;
    if (!this.bgmGain) {
      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.value = 0;
      this.bgmGain.connect(this.ctx.destination);
    }
    var t = this.ctx.currentTime;
    this.bgmGain.gain.cancelScheduledValues(t);
    this.bgmGain.gain.setValueAtTime(0, t);
    this.bgmGain.gain.linearRampToValueAtTime(0.6, t + 1.2);
    this.bgmStep = 0;
    this.bgmNext = t + 0.15;
    var self = this;
    if (this.bgmTimer) clearInterval(this.bgmTimer);
    this.bgmTimer = setInterval(function () { self.pumpBGM(); }, 260);
    this.pumpBGM();
  };

  // 提前 1 秒把音符排进时间轴，避免 setInterval 抖动造成的节奏漂移
  AudioKit.prototype.pumpBGM = function () {
    if (!this.ctx || !this.bgmOn) return;
    var horizon = this.ctx.currentTime + 1.1;
    while (this.bgmNext < horizon) {
      var i = this.bgmStep % BGM_MEL.length;
      var n = BGM_MEL[i];
      this.bgmNote(523.25 * Math.pow(2, n / 12), this.bgmNext, BGM_STEP * 0.82, 0.05);
      if (i % 8 === 0) {
        this.bgmNote(130.81 * Math.pow(2, n / 12), this.bgmNext, BGM_STEP * 1.7, 0.04);
      }
      this.bgmNext += BGM_STEP;
      this.bgmStep++;
    }
  };

  AudioKit.prototype.bgmNote = function (freq, at, dur, gain) {
    var osc = this.ctx.createOscillator();
    var g = this.ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(gain, at + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0008, at + dur);
    osc.connect(g);
    g.connect(this.bgmGain);
    osc.start(at);
    osc.stop(at + dur + 0.05);
  };

  AudioKit.prototype.stopBGM = function () {
    this.bgmOn = false;
    if (this.bgmTimer) { clearInterval(this.bgmTimer); this.bgmTimer = null; }
    if (this.bgmGain && this.ctx) {
      var t = this.ctx.currentTime;
      var g = this.bgmGain.gain;
      g.cancelScheduledValues(t);
      g.linearRampToValueAtTime(0, t + 0.4);
    }
  };

  // 单音：频率从 f0 滑到 f1
  AudioKit.prototype.tone = function (opt) {
    if (!this.ctx || this.muted) return;
    var t0 = this.ctx.currentTime + (opt.delay || 0);
    var osc = this.ctx.createOscillator();
    var g = this.ctx.createGain();
    osc.type = opt.type || "sine";
    osc.frequency.setValueAtTime(opt.f0, t0);
    if (opt.f1 && opt.f1 !== opt.f0) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, opt.f1), t0 + opt.dur);
    }
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(opt.gain || 0.2, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + opt.dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + opt.dur + 0.02);
  };

  // 噪声：用于打击、爆炸
  AudioKit.prototype.noise = function (opt) {
    if (!this.ctx || this.muted || !this.noiseBuf) return;
    var t0 = this.ctx.currentTime + (opt.delay || 0);
    var src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    var filter = this.ctx.createBiquadFilter();
    filter.type = opt.filter || "lowpass";
    filter.frequency.setValueAtTime(opt.cut0 || 1200, t0);
    if (opt.cut1) filter.frequency.exponentialRampToValueAtTime(opt.cut1, t0 + opt.dur);
    var g = this.ctx.createGain();
    g.gain.setValueAtTime(opt.gain || 0.2, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + opt.dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t0);
    src.stop(t0 + opt.dur + 0.02);
  };

  AudioKit.prototype.play = function (name) {
    if (!this.muted) this.resume();
    if (!this.ctx) return;
    if (THROTTLE[name]) {
      var now = performance.now();
      if (now - (this._lastPlay[name] || 0) < THROTTLE_MS) return;
      this._lastPlay[name] = now;
    }
    switch (name) {
      // ---------- 击打类 ----------
      case "shot": // 豌豆发射
        this.tone({ type: "triangle", f0: 620, f1: 260, dur: 0.1, gain: 0.18 });
        break;
      case "sniper": // 狙击枪：脆响 + 尾音
        this.noise({ dur: 0.16, gain: 0.26, filter: "highpass", cut0: 2200, cut1: 600 });
        this.tone({ type: "square", f0: 1400, f1: 380, dur: 0.14, gain: 0.14 });
        break;
      case "hit": // 豌豆命中
        this.noise({ dur: 0.07, gain: 0.16, filter: "lowpass", cut0: 900, cut1: 300 });
        break;
      case "sniperHit": // 穿甲命中
        this.noise({ dur: 0.11, gain: 0.24, filter: "bandpass", cut0: 1600, cut1: 500 });
        this.tone({ type: "square", f0: 240, f1: 120, dur: 0.09, gain: 0.12 });
        break;
      case "chomp": // 僵尸啃植物
        this.noise({ dur: 0.1, gain: 0.12, filter: "lowpass", cut0: 700, cut1: 220 });
        break;
      case "boom": // 樱桃炸弹
        this.noise({ dur: 0.6, gain: 0.42, filter: "lowpass", cut0: 1400, cut1: 90 });
        this.tone({ type: "sine", f0: 120, f1: 40, dur: 0.5, gain: 0.3 });
        this.tone({ type: "sawtooth", f0: 420, f1: 90, dur: 0.35, gain: 0.16, delay: 0.02 });
        break;
      case "mine": // 土豆地雷
        this.noise({ dur: 0.34, gain: 0.34, filter: "lowpass", cut0: 1000, cut1: 80 });
        this.tone({ type: "sine", f0: 200, f1: 50, dur: 0.3, gain: 0.24 });
        break;
      case "groan": // 僵尸倒地
        this.tone({ type: "sawtooth", f0: 150, f1: 70, dur: 0.34, gain: 0.16 });
        this.noise({ dur: 0.18, gain: 0.1, filter: "lowpass", cut0: 500, cut1: 160 });
        break;
      case "shovel": // 铲除植物
        this.noise({ dur: 0.12, gain: 0.14, filter: "lowpass", cut0: 800, cut1: 240 });
        this.tone({ type: "triangle", f0: 340, f1: 180, dur: 0.12, gain: 0.1 });
        break;
      case "gatling": // 机枪连发
        this.noise({ dur: 0.06, gain: 0.13, filter: "bandpass", cut0: 1800, cut1: 700 });
        this.tone({ type: "square", f0: 520, f1: 300, dur: 0.05, gain: 0.1 });
        break;
      case "burst": // 爆炸弹炸开
        this.noise({ dur: 0.14, gain: 0.18, filter: "lowpass", cut0: 1000, cut1: 180 });
        this.tone({ type: "sine", f0: 220, f1: 90, dur: 0.12, gain: 0.12 });
        break;
      case "doom": // 毁灭菇：压倒性的大爆炸
        this.noise({ dur: 0.95, gain: 0.5, filter: "lowpass", cut0: 1800, cut1: 60 });
        this.tone({ type: "sine", f0: 170, f1: 28, dur: 0.85, gain: 0.36 });
        this.tone({ type: "sawtooth", f0: 520, f1: 70, dur: 0.5, gain: 0.2, delay: 0.03 });
        break;

      // ---------- 反馈类 ----------
      case "sun": // 收集阳光
        this.tone({ type: "sine", f0: 880, f1: 1180, dur: 0.14, gain: 0.2 });
        this.tone({ type: "sine", f0: 1320, f1: 1600, dur: 0.16, gain: 0.14, delay: 0.06 });
        break;
      case "plant": // 种下植物
        this.tone({ type: "triangle", f0: 300, f1: 560, dur: 0.14, gain: 0.2 });
        this.noise({ dur: 0.08, gain: 0.08, filter: "lowpass", cut0: 600 });
        break;
      case "warn": // 一大波僵尸来袭
        this.tone({ type: "sawtooth", f0: 260, f1: 300, dur: 0.45, gain: 0.16 });
        this.tone({ type: "sawtooth", f0: 200, f1: 230, dur: 0.45, gain: 0.14, delay: 0.28 });
        break;
      case "win": // 通关：上行琶音
        this.tone({ type: "triangle", f0: 523, f1: 523, dur: 0.22, gain: 0.2 });
        this.tone({ type: "triangle", f0: 659, f1: 659, dur: 0.24, gain: 0.2, delay: 0.16 });
        this.tone({ type: "triangle", f0: 784, f1: 784, dur: 0.26, gain: 0.2, delay: 0.32 });
        this.tone({ type: "triangle", f0: 1047, f1: 1047, dur: 0.42, gain: 0.22, delay: 0.48 });
        break;
      case "lose": // 失守：下行
        this.tone({ type: "sawtooth", f0: 420, f1: 200, dur: 0.5, gain: 0.2 });
        this.tone({ type: "sawtooth", f0: 300, f1: 110, dur: 0.6, gain: 0.16, delay: 0.3 });
        break;
      case "levelup": // 奖励弹窗
        this.tone({ type: "sine", f0: 660, f1: 990, dur: 0.2, gain: 0.22 });
        this.tone({ type: "sine", f0: 990, f1: 1480, dur: 0.24, gain: 0.18, delay: 0.12 });
        this.noise({ dur: 0.2, gain: 0.08, filter: "highpass", cut0: 3000, delay: 0.2 });
        break;
      case "click":
        this.tone({ type: "square", f0: 620, f1: 500, dur: 0.05, gain: 0.1 });
        break;
      case "error":
        this.tone({ type: "square", f0: 170, f1: 150, dur: 0.12, gain: 0.16 });
        this.tone({ type: "square", f0: 130, f1: 110, dur: 0.12, gain: 0.14, delay: 0.1 });
        break;
      case "mower": // 割草机
        this.noise({ dur: 0.5, gain: 0.24, filter: "bandpass", cut0: 800, cut1: 400 });
        this.tone({ type: "sawtooth", f0: 220, f1: 320, dur: 0.5, gain: 0.12 });
        break;
      case "wave": // 新一波提示
        this.tone({ type: "triangle", f0: 440, f1: 660, dur: 0.16, gain: 0.16 });
        break;
      default:
        break;
    }
  };

  PVZ.Audio = new AudioKit();
})(window.PVZ);
