/* ============================================================
 * app.js —— 启动：创建游戏、预加载图片、绑定入口按钮
 * ============================================================ */
(function (PVZ) {
  "use strict";

  function boot() {
    var canvas = document.getElementById("stage");
    var startScreen = document.getElementById("startScreen");
    var btnStart = document.getElementById("btnStart");
    var btnStartHelp = document.getElementById("btnStartHelp");

    var game = new PVZ.Game(canvas);
    PVZ.game = game;
    PVZ.HUD.init(game);
    PVZ.Audio.setMuted(game.muted);
    PVZ.Audio.setMusic(game.music);
    PVZ.HUD.setMute(game.muted);
    PVZ.HUD.setMusic(game.music);

    // 预加载期间先盖住开始页
    startScreen.classList.add("hidden");
    PVZ.HUD.showLoading("正在铺设草坪");

    PVZ.Assets.load(function () {
      PVZ.HUD.hideModal();
      if (PVZ.Assets.failed.length) {
        PVZ.HUD.toast("有 " + PVZ.Assets.failed.length + " 张素材加载失败");
      }
    }, function (done, total) {
      var bar = document.querySelector(".load-bar span");
      if (bar) bar.style.width = (done / total * 100) + "%";
    });

    btnStart.addEventListener("click", function () {
      PVZ.Audio.resume();
      PVZ.Audio.play("click");
      startScreen.classList.add("hidden");
      PVZ.HUD.showLevelSelect();
    });

    btnStartHelp.addEventListener("click", function () {
      PVZ.Audio.resume();
      PVZ.Audio.play("click");
      PVZ.HUD.showHelp();
    });

    // 任何一次点击都尝试唤醒音频上下文（浏览器要求用户手势）
    document.addEventListener("pointerdown", function once() {
      PVZ.Audio.resume();
      document.removeEventListener("pointerdown", once);
    });

    game.start();

    // 24 点门禁：第一次进入关卡时才挂计时器，避免停在开始页就出现徽标
    PVZ.ensureGate = function () {
      if (PVZ.gate || !window.Gate) return;
      PVZ.gate = window.Gate.create({
        everyMinutes: 5,
        challenges: ["twenty-four", "poem", "english"],
        showBadge: true,
        badgePosition: "raised",
        openOnStart: /[?&]tf24demo=1/.test(location.search),
        kicker: "局间门禁 · 草坪守卫战",
        title: "先过一道关卡",
        note: "草坪已经守了 5 分钟。完成这道题，再回去挡僵尸。",
        onLock: function () {
          game.gateLock();
        },
        onUnlock: function () {
          game.gateUnlock();
        }
      });
    };


    // 全站强制休息：暂停关卡，休息结束后继续
    document.addEventListener("playclock:breakstart", function () {
      game.breakLock();
    });
    document.addEventListener("playclock:breakend", function () {
      game.breakUnlock();
    });

    // 演示用：?tf24demo=1 直接进第一关并弹出 24 点门禁
    if (/[?&]tf24demo=1/.test(location.search)) {
      PVZ.ensureGate();
      game.startLevel(PVZ.LEVELS[0].id);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(window.PVZ);
