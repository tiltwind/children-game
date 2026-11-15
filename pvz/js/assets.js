/* ============================================================
 * assets.js —— 图片预加载
 * 精灵 key 与 config 中的 img 字段、render 里的 "z_" 前缀对应
 * ============================================================ */
window.PVZ = window.PVZ || {};

(function (PVZ) {
  "use strict";

  var MANIFEST = [
    ["bg", "assets/bg_lawn.jpg"],
    ["sunflower", "assets/plant_sunflower.png"],
    ["peashooter", "assets/plant_peashooter.png"],
    ["wallnut", "assets/plant_wallnut.png"],
    ["potato", "assets/plant_potato.png"],
    ["cabbage", "assets/plant_cabbage.png"],
    ["cherry", "assets/plant_cherry.png"],
    ["sniper", "assets/plant_sniper.png"],
    ["gatling", "assets/plant_gatling.png"],
    ["doom", "assets/plant_doom.png"],
    ["z_normal", "assets/zombie_normal.png"],
    ["z_cone", "assets/zombie_cone.png"],
    ["z_pole", "assets/zombie_pole.png"],
    ["z_bucket", "assets/zombie_bucket.png"]
  ];

  PVZ.Assets = {
    images: {},
    loaded: 0,
    total: MANIFEST.length,
    failed: [],

    load: function (onDone, onProgress) {
      var self = this;
      var done = 0;
      MANIFEST.forEach(function (item) {
        var key = item[0], src = item[1];
        var img = new Image();
        img.onload = function () {
          self.images[key] = img;
          done++;
          if (onProgress) onProgress(done, MANIFEST.length);
          if (done === MANIFEST.length && onDone) onDone();
        };
        img.onerror = function () {
          self.failed.push(src);
          done++;
          if (onProgress) onProgress(done, MANIFEST.length);
          if (done === MANIFEST.length && onDone) onDone();
        };
        img.src = src;
      });
    }
  };
})(window.PVZ);
