/* ============================================================
 * hud.js —— DOM 界面：阳光计数、种子卡、波次条、弹窗、提示
 * 与 canvas 分离，便于单独改界面不动玩法
 * ============================================================ */
window.PVZ = window.PVZ || {};

(function (PVZ) {
  "use strict";

  var HUD = {};
  var game = null;
  var els = {};
  var lastCdPaint = 0;

  function $(id) { return document.getElementById(id); }

  HUD.init = function (g) {
    game = g;
    els.sunCount = $("sunCount");
    els.levelName = $("levelName");
    els.waveFill = $("waveFill");
    els.waveText = $("waveText");
    els.seedBar = $("seedBar");
    els.shovelBtn = $("shovelBtn");
    els.modalLayer = $("modalLayer");
    els.modalBox = $("modalBox");
    els.toastLayer = $("toastLayer");
    els.banner = $("waveBanner");
    els.btnPause = $("btnPause");
    els.btnMute = $("btnMute");
    els.btnMenu = $("btnMenu");

    els.btnPause.addEventListener("click", function () { game.togglePause(); });
    els.btnMute.addEventListener("click", function () { game.toggleMute(); });
    els.btnMusic = $("btnMusic");
    if (els.btnMusic) els.btnMusic.addEventListener("click", function () { game.toggleMusic(); });
    els.btnMenu.addEventListener("click", function () { HUD.showLevelSelect(); });
    els.shovelBtn.addEventListener("click", function () { game.toggleShovel(); });
    var helpBtn = $("btnHelp");
    if (helpBtn) helpBtn.addEventListener("click", function () { HUD.showHelp(); });

    els.modalBox.addEventListener("click", function (ev) {
      var el = ev.target.closest("[data-action]");
      if (!el) return;
      var action = el.getAttribute("data-action");
      var value = el.getAttribute("data-value");
      PVZ.Audio.play("click");
      switch (action) {
        case "next": game.nextLevel(); break;
        case "retry": game.restartLevel(); break;
        case "menu": HUD.showLevelSelect(); break;
        case "resume": game.togglePause(); break;
        case "help": HUD.showHelp(); break;
        case "close": HUD.hideModal(); if (game.state === "paused") game.state = "playing"; break;
        case "pick-level": game.startLevel(parseInt(value, 10)); break;
        case "level-done": HUD.showLevelDone(parseInt(value, 10)); break;
        default: break;
      }
    });
  };

  // ---------- 顶部状态 ----------
  HUD.setSun = function (v) {
    if (els.sunCount) els.sunCount.textContent = Math.round(v);
  };

  HUD.setLevel = function (level) {
    if (els.levelName) els.levelName.textContent = level.name;
    var chapter = PVZ.CHAPTERS[level.chapter - 1];
    if (els.levelName) els.levelName.title = chapter ? chapter.note : "";
  };

  HUD.setWave = function (current, total) {
    if (!els.waveFill) return;
    var pct = total ? Math.min(100, (current / total) * 100) : 0;
    els.waveFill.style.width = pct + "%";
    els.waveText.textContent = current + " / " + total;
  };

  HUD.setMute = function (muted) {
    if (els.btnMute) els.btnMute.textContent = muted ? "音效关" : "音效开";
  };

  HUD.setMusic = function (on) {
    if (els.btnMusic) els.btnMusic.textContent = on ? "音乐开" : "音乐关";
  };

  // ---------- 种子卡 ----------
  function starSvg(n) {
    var stars = "";
    for (var i = 0; i < 3; i++) {
      stars += '<svg class="star' + (i < n ? " on" : "") + '" viewBox="0 0 24 24" aria-hidden="true">' +
        '<path d="M12 3l2.7 6.1 6.6.6-5 4.4 1.5 6.5L12 17.2 5.7 20.6 7.2 14.1 2.2 9.7l6.6-.6z"/></svg>';
    }
    return stars;
  }

  HUD.renderSeeds = function (level) {
    if (!els.seedBar) return;
    els.seedBar.innerHTML = "";
    var unlocked = level.unlock.map(function (id) { return PVZ.PLANT_MAP[id]; });
    unlocked.forEach(function (spec) {
      var btn = document.createElement("button");
      btn.className = "seed";
      btn.type = "button";
      btn.setAttribute("data-id", spec.id);
      btn.title = spec.name + "：" + spec.desc;
      btn.innerHTML =
        '<span class="seed-cd"></span>' +
        '<img class="seed-img" src="' + spec.img + '" alt="' + spec.name + '">' +
        '<span class="seed-cost"><svg class="sun-dot" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/></svg>' +
        spec.cost + '</span>';
      btn.addEventListener("click", function () { game.selectSeed(spec.id); });
      els.seedBar.appendChild(btn);
    });
  };

  HUD.updateCooldowns = function (world) {
    var now = performance.now();
    if (now - lastCdPaint < 90) return;
    lastCdPaint = now;
    if (!els.seedBar) return;
    var cards = els.seedBar.children;
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      var id = card.getAttribute("data-id");
      var spec = PVZ.PLANT_MAP[id];
      if (!spec) continue;
      var total = spec.cooldown * (world.cooldownMul || 1);
      var left = world.cooldowns[id] || 0;
      var ratio = total > 0 ? Math.max(0, Math.min(1, left / total)) : 0;
      var cdEl = card.querySelector(".seed-cd");
      if (cdEl) cdEl.style.height = (ratio * 100) + "%";
      var afford = world.sun >= spec.cost && left <= 0;
      card.classList.toggle("off", !afford);
      card.classList.toggle("active", game.selected === id);
    }
  };

  HUD.updateShovel = function (on) {
    if (els.shovelBtn) els.shovelBtn.classList.toggle("active", !!on);
  };

  // ---------- 提示 ----------
  HUD.toast = function (msg) {
    if (!els.toastLayer) return;
    var el = document.createElement("div");
    el.className = "toast";
    el.textContent = msg;
    els.toastLayer.appendChild(el);
    setTimeout(function () {
      el.classList.add("out");
      setTimeout(function () { el.remove(); }, 320);
    }, 1200);
  };

  HUD.banner = function (text, ms) {
    if (!els.banner) return;
    els.banner.textContent = text;
    els.banner.classList.remove("hidden");
    els.banner.classList.add("pop");
    clearTimeout(HUD._bannerTimer);
    HUD._bannerTimer = setTimeout(function () {
      els.banner.classList.add("hidden");
      els.banner.classList.remove("pop");
    }, ms || 2200);
  };

  // ---------- 弹窗 ----------
  function pauseForModal() {
    if (game && game.state === "playing") {
      game.state = "paused";
      game.pausedByModal = true;
    }
  }

  function openModal(html, cls) {
    els.modalBox.innerHTML = html;
    els.modalLayer.className = "modal-layer" + (cls ? " " + cls : "");
    els.modalLayer.classList.remove("hidden");
  }

  HUD.hideModal = function () {
    if (els.modalLayer) els.modalLayer.classList.add("hidden");
    if (game && game.pausedByModal) {
      game.pausedByModal = false;
      if (game.state === "paused") game.state = "playing";
    }
    // 还没开局就关掉弹窗，回到开始页
    if (game && game.state === "menu") {
      var start = $("startScreen");
      if (start) start.classList.remove("hidden");
    }
  };

  // 通关两次后的锁定提示，主按钮直接跳下一关
  HUD.showLevelDone = function (id) {
    var level = PVZ.LEVEL_MAP[id];
    if (!level) return;
    var next = PVZ.LEVEL_MAP[id + 1];
    var html = '<div class="modal-card">' +
      '<div class="modal-tag">已通关两次</div>' +
      '<h2 class="modal-title">' + level.name + '</h2>' +
      '<p class="modal-note">这一关已经通过两次，记录已锁定，不能再重复挑战。去下一关继续推进吧。</p>' +
      '<div class="modal-actions">' +
      (next
        ? '<button class="btn primary" data-action="pick-level" data-value="' + next.id + '">前往第 ' + next.id + ' 关</button>'
        : '<button class="btn primary" data-action="menu">全部通关，回到选关</button>') +
      '<button class="btn ghost" data-action="menu">选关</button>' +
      '</div></div>';
    openModal(html, "done-layer");
  };

  HUD.showWin = function (data) {
    var level = data.level;
    var next = PVZ.LEVEL_MAP[level.id + 1];
    var rewardId = PVZ.UNLOCK_REWARDS[level.id];
    var rewardSpec = rewardId ? PVZ.PLANT_MAP[rewardId] : null;
    var stars = starSvg(data.stars);
    var clears = PVZ.Util.Progress.clears(PVZ.Util.Progress.read(), level.id);
    var locked = clears >= 2;
    var html =
      '<div class="modal-card win">' +
      '<div class="modal-tag">关卡通过</div>' +
      '<h2 class="modal-title">' + level.name + '</h2>' +
      '<div class="star-row">' + stars + '</div>' +
      '<dl class="stat-grid">' +
      '<div><dt>用时</dt><dd>' + data.timeText + '</dd></div>' +
      '<div><dt>消灭僵尸</dt><dd>' + data.stats.kills + '</dd></div>' +
      '<div><dt>剩余阳光</dt><dd>' + Math.round(data.sun) + '</dd></div>' +
      '<div><dt>损失植物</dt><dd>' + data.stats.plantsLost + '</dd></div>' +
      '</dl>';

    if (rewardSpec) {
      html += '<div class="reward">' +
        '<img src="' + rewardSpec.img + '" alt="' + rewardSpec.name + '">' +
        '<div><span class="reward-label">新植物解锁</span>' +
        '<strong>' + rewardSpec.name + '</strong>' +
        '<p>' + rewardSpec.desc + '</p></div></div>';
    }

    if (locked) {
      html += '<p class="modal-note">本关已通关两次，记录锁定，不能再重复打。去下一关继续推进吧。</p>';
    }

    html += '<div class="modal-actions">' +
      (next ? '<button class="btn primary" data-action="next">进入第 ' + next.id + ' 关</button>' : '<button class="btn primary" data-action="menu">全部通关，回到选关</button>') +
      (locked ? '' : '<button class="btn" data-action="retry">重玩本关</button>') +
      '<button class="btn ghost" data-action="menu">选关</button>' +
      '</div></div>';
    openModal(html, "win-layer");
    PVZ.Audio.play("levelup");
  };

  HUD.showLose = function (data) {
    var level = data.level;
    var html =
      '<div class="modal-card lose">' +
      '<div class="modal-tag">草坪失守</div>' +
      '<h2 class="modal-title">第 ' + level.id + ' 关 · ' + level.name + '</h2>' +
      '<p class="modal-note">僵尸从第 ' + (data.row + 1) + ' 行突破了防线。再试一次，把坚果墙提前铺在那条压力最大的通道上。</p>' +
      '<dl class="stat-grid">' +
      '<div><dt>坚持时间</dt><dd>' + Math.round(data.time) + ' 秒</dd></div>' +
      '<div><dt>消灭僵尸</dt><dd>' + data.stats.kills + '</dd></div>' +
      '<div><dt>损失植物</dt><dd>' + data.stats.plantsLost + '</dd></div>' +
      '<div><dt>已过波次</dt><dd>' + data.waveIndex + ' / ' + data.totalWaves + '</dd></div>' +
      '</dl>' +
      '<div class="modal-actions">' +
      '<button class="btn primary" data-action="retry">再来一次</button>' +
      '<button class="btn ghost" data-action="menu">选关</button>' +
      '</div></div>';
    openModal(html, "lose-layer");
    PVZ.Audio.play("lose");
  };

  HUD.showPause = function () {
    var html =
      '<div class="modal-card">' +
      '<div class="modal-tag">已暂停</div>' +
      '<h2 class="modal-title">先喘口气</h2>' +
      '<p class="modal-note">阳光不会停止生长，但僵尸也一样。</p>' +
      '<div class="modal-actions">' +
      '<button class="btn primary" data-action="resume">继续游戏</button>' +
      '<button class="btn" data-action="retry">重新开始本关</button>' +
      '<button class="btn ghost" data-action="menu">选关</button>' +
      '</div></div>';
    openModal(html, "");
  };

  HUD.showHelp = function () {
    var html =
      '<div class="modal-card help">' +
      '<div class="modal-tag">玩法说明</div>' +
      '<h2 class="modal-title">守住这五条通道</h2>' +
      '<ul class="help-list">' +
      '<li><b>收集阳光</b>：点击场上飘落的阳光；向日葵会持续产出。</li>' +
      '<li><b>种植</b>：点选种子卡，再点草坪格子。卡片冷却期间不能重复种植。</li>' +
      '<li><b>铲子</b>：点铲子再点植物，可以撤掉一格重新布置。</li>' +
      '<li><b>升级</b>：不选卡片时直接点已种下的植物，花阳光升到下一级（豌豆可升成双发、三发）。</li>' +
      '<li><b>割草机</b>：每行最左有一台，僵尸突破时会自动启动，每行只救一次。</li>' +
      '<li><b>僵尸特性</b>：路障更耐打，撑杆会跳过第一株植物，铁桶最硬。</li>' +
      '<li><b>过关</b>：撑过所有波次并清空场上僵尸。剩余阳光与植物损失会影响星级。</li>' +
      '</ul>' +
      '<div class="modal-actions"><button class="btn primary" data-action="close">知道了</button></div>' +
      '</div>';
    pauseForModal();
    openModal(html, "");
  };

  // ---------- 关卡选择 ----------
  HUD.showLevelSelect = function () {
    pauseForModal();
    PVZ.Audio.stopBGM();
    var progress = PVZ.Util.Progress.read();
    var chapters = {};
    PVZ.LEVELS.forEach(function (l) {
      (chapters[l.chapter] = chapters[l.chapter] || []).push(l);
    });

    var html = '<div class="modal-card levels">' +
      '<div class="modal-head">' +
      '<div><div class="modal-tag">选关</div>' +
      '<h2 class="modal-title">僵尸草坪 · 12 关</h2></div>' +
      '<button class="icon-btn" data-action="close" title="关闭">×</button>' +
      '</div>' +
      '<p class="modal-note">逐关推进：每一关的僵尸更快、更硬，可用的植物也在变化。通关后自动解锁下一关。</p>';

    for (var cid = 1; cid <= PVZ.CHAPTERS.length; cid++) {
      var ch = PVZ.CHAPTERS[cid - 1];
      var list = chapters[cid] || [];
      html += '<section class="chapter">' +
        '<header class="chapter-head"><span class="chapter-no">第 ' + cid + ' 章</span>' +
        '<h3>' + ch.name + '</h3><span class="chapter-note">' + ch.note + '</span></header>' +
        '<div class="level-grid">';
      list.forEach(function (l) {
        var unlocked = PVZ.Util.Progress.isUnlocked(progress, l.id);
        var stars = progress.stars[l.id] || 0;
        var clears = PVZ.Util.Progress.clears(progress, l.id);
        var done = clears >= 2;
        var action = !unlocked ? "close" : (done ? "level-done" : "pick-level");
        var starText = done ? ("已通关 ×" + clears) : (unlocked ? starSvg(stars) : "未解锁");
        html += '<button class="level-card' + (unlocked ? "" : " locked") +
          (done ? " done" : "") + '" data-action="' + action +
          '" data-value="' + l.id + '"' + (unlocked ? "" : ' disabled') + '>' +
          '<span class="level-no">' + (l.id < 10 ? "0" + l.id : l.id) + '</span>' +
          '<span class="level-name">' + l.name + '</span>' +
          '<span class="level-stars">' + starText + '</span>' +
          '</button>';
      });
      html += '</div></section>';
    }

    html += '<div class="modal-actions"><button class="btn ghost" data-action="close">返回</button></div></div>';
    openModal(html, "levels-layer");
  };

  HUD.showLoading = function (text) {
    openModal('<div class="modal-card loading"><div class="modal-tag">载入中</div>' +
      '<h2 class="modal-title">' + (text || "正在准备草坪") + '</h2>' +
      '<div class="load-bar"><span></span></div></div>', "loading-layer");
  };

  PVZ.HUD = HUD;
})(window.PVZ);
