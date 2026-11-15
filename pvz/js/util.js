/* ============================================================
 * util.js —— 数学、随机、坐标换算、存档、事件总线
 * ============================================================ */
window.PVZ = window.PVZ || {};

(function (PVZ) {
  "use strict";

  var U = {};

  U.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  U.lerp = function (a, b, t) { return a + (b - a) * t; };
  U.rand = function (a, b) { return a + Math.random() * (b - a); };
  U.randInt = function (a, b) { return Math.floor(U.rand(a, b + 1)); };
  U.pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
  U.easeOut = function (t) { return 1 - Math.pow(1 - t, 3); };

  // 格子中心 → 画布坐标
  U.cellCenter = function (row, col) {
    var CFG = PVZ.CFG;
    return {
      x: CFG.grid.left + (col + 0.5) * CFG.cellW,
      y: CFG.grid.top + (row + 0.5) * CFG.cellH
    };
  };

  // 画布坐标 → 格子
  U.pointToCell = function (x, y) {
    var CFG = PVZ.CFG;
    var col = Math.floor((x - CFG.grid.left) / CFG.cellW);
    var row = Math.floor((y - CFG.grid.top) / CFG.cellH);
    if (row < 0 || row >= CFG.ROWS || col < 0 || col >= CFG.COLS) return null;
    return { row: row, col: col };
  };

  // 行内位置（以"格"为单位，0 = 第 1 列左边缘）
  U.xOfCol = function (col) {
    var CFG = PVZ.CFG;
    return CFG.grid.left + col * CFG.cellW;
  };

  // 简易事件总线
  function Emitter() { this._m = {}; }
  Emitter.prototype.on = function (name, fn) {
    (this._m[name] = this._m[name] || []).push(fn);
    return this;
  };
  Emitter.prototype.emit = function (name, payload) {
    var list = this._m[name];
    if (!list) return;
    for (var i = 0; i < list.length; i++) {
      try { list[i](payload); } catch (e) { console.warn(e); }
    }
  };
  U.Emitter = Emitter;

  // 进度存档
  var KEY = "pvz_shutu_progress_v1";
  U.Progress = {
    read: function () {
      try {
        var raw = localStorage.getItem(KEY);
        if (!raw) return { cleared: [1], stars: {}, muted: false, music: true, clears: {} };
        var data = JSON.parse(raw);
        if (!data.cleared || !data.cleared.length) data.cleared = [1];
        data.stars = data.stars || {};
        data.clears = data.clears || {};
        if (typeof data.muted !== "boolean") data.muted = false;
        if (typeof data.music !== "boolean") data.music = true;
        return data;
      } catch (e) {
        return { cleared: [1], stars: {}, muted: false, music: true, clears: {} };
      }
    },
    write: function (data) {
      try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {}
    },
    isUnlocked: function (data, levelId) {
      if (levelId === 1) return true;
      return data.cleared.indexOf(levelId - 1) >= 0 || data.cleared.indexOf(levelId) >= 0;
    },
    // 某关通关次数（超过 2 次即锁定，不能再进）
    clears: function (data, levelId) {
      return (data && data.clears && data.clears[levelId]) || 0;
    },
    isMaxed: function (data, levelId) {
      return this.clears(data, levelId) >= 2;
    },
    markCleared: function (data, levelId, stars) {
      if (data.cleared.indexOf(levelId) < 0) data.cleared.push(levelId);
      data.clears = data.clears || {};
      data.clears[levelId] = (data.clears[levelId] || 0) + 1;
      var prev = data.stars[levelId] || 0;
      if (stars > prev) data.stars[levelId] = stars;
      return data;
    }
  };

  PVZ.Util = U;
})(window.PVZ);
