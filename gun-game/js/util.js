/* ============================================================
 * util.js —— 数学、随机、存档小工具
 * ============================================================ */
(function (root) {
  'use strict';
  var GG = (root.GG = root.GG || {});
  var U = (GG.U = {});

  U.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  U.lerp = function (a, b, t) { return a + (b - a) * t; };
  U.dist = function (x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); };
  U.dist2 = function (x1, y1, x2, y2) { var dx = x2 - x1, dy = y2 - y1; return dx * dx + dy * dy; };
  U.rand = function (a, b) { return a + Math.random() * (b - a); };
  U.randInt = function (a, b) { return Math.floor(a + Math.random() * (b - a + 1)); };
  U.chance = function (p) { return Math.random() < p; };
  U.pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
  U.noise = function (seed) {
    var s = seed || 0;
    return function () {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  };
  U.angleTo = function (x1, y1, x2, y2) { return Math.atan2(y2 - y1, x2 - x1); };
  U.angleDiff = function (a, b) {
    var d = a - b;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  };
  U.fmt = function (sec) {
    sec = Math.max(0, Math.floor(sec));
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  };
  U.uid = function () { return Math.random().toString(36).slice(2, 9); };

  // 屏幕上「往哪走」的统一口径：八方向文案 + 米数（1 格 = 40px = 1 米）
  U.DIR8 = ['东', '东南', '南', '西南', '西', '西北', '北', '东北'];
  U.dir8 = function (dx, dy) {
    var oct = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
    return U.DIR8[(oct + 8) % 8];
  };
  U.meters = function (px) {
    var tile = (GG.C && GG.C.TILE) || 40;
    return Math.max(1, Math.round(px / tile));
  };

  U.load = function (key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  };
  U.save = function (key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* 忽略隐私模式写入失败 */ }
  };
  U.dpr = function () { return Math.min(2, (root.devicePixelRatio || 1)); };

  GG.U = U;
})(typeof window !== 'undefined' ? window : globalThis);
