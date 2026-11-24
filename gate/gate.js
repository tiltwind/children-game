/* ============================================================
 * gate.js —— 通用局间门禁（标准库）
 *
 * 门禁本身只负责：计时、遮罩、暂停/恢复、随机选题、通过/失败反馈。
 * 具体题目由「题型」提供，题型用 Gate.register(id, def) 注册。
 *
 * 用法：
 *   var gate = Gate.create({
 *     everyMinutes: 5,
 *     challenges: ["twenty-four", "poem"], // 省略 = 所有已注册题型随机
 *     onLock: function () { 游戏暂停(); },
 *     onUnlock: function () { 游戏继续(); }
 *   });
 *   // 游戏主循环里：gate.tick(dtSeconds)
 *
 * 题型接口：
 *   Gate.register("my-quiz", {
 *     name: "我的题",
 *     weight: 1,                 // 随机权重，默认 1
 *     create: function (api) {
 *       var el = document.createElement("div");
 *       // api.pass({ summary: "..." }) 解出时调用
 *       // api.fail("再想想") 显示错误
 *       // api.next() 在门禁未通过时换一道新题（不能由玩家手动跳过）
 *       // api.target / api.passed / api.options / api.random
 *       return { el: el, meta: function () { return "说明"; }, focus: fn, destroy: fn };
 *     }
 *   });
 * ============================================================ */
(function (global) {
  "use strict";

  var registry = {};
  var order = [];

  function register(id, def) {
    if (!id || typeof id !== "string") throw new Error("题型需要一个字符串 id");
    if (!def || typeof def.create !== "function") throw new Error("题型 " + id + " 缺少 create()");
    def.id = id;
    def.name = def.name || id;
    if (!(def.weight > 0)) def.weight = 1;
    if (!registry[id]) order.push(id);
    registry[id] = def;
    return def;
  }

  function get(id) {
    return registry[id] || null;
  }

  function list() {
    return order.map(function (id) {
      return registry[id];
    });
  }

  function fmtClock(seconds) {
    seconds = Math.max(0, Math.floor(seconds));
    var m = Math.floor(seconds / 60);
    var s = seconds % 60;
    return m + ":" + (s < 10 ? "0" + s : s);
  }

  /* ============================================================
   * 持久化：计时进度 + 未通过的门禁状态
   *
   * 存在 localStorage，按「游戏」分键（默认用页面路径），所以：
   *   - 刷新 / 关标签 / 隔天再来，累计游玩时间不会清零；
   *   - 门禁已弹出但没答对就刷新，重新进入页面会立刻再次弹出同一道关卡，
   *     只有答对才放行 —— 刷新不能绕过门禁。
   * ============================================================ */

  var DEFAULT_STORE_KEY = "shutu.gate.v1";

  function storageAvailable() {
    try {
      var probe = "__shutu_gate_probe__";
      global.localStorage.setItem(probe, "1");
      global.localStorage.removeItem(probe);
      return true;
    } catch (e) {
      return false; // 隐私模式 / 禁用存储时退化为内存计时
    }
  }

  function Gate(options) {
    options = options || {};

    var challengeOptions = options.challengeOptions || {};
    // 兼容旧写法：{ mode: "hard" } 等价于只出 24 点、指定模式
    if (options.mode && !options.challenges) {
      options.challenges = ["twenty-four"];
      challengeOptions = { "twenty-four": { mode: options.mode } };
    }

    this.options = {
      everyMinutes: options.everyMinutes > 0 ? options.everyMinutes : 5,
      challenges: options.challenges == null ? "all" : options.challenges,
      challengeOptions: challengeOptions,
      target: options.target || 24,
      title: options.title || "先过一道关卡",
      note: options.note || "",
      kicker: options.kicker || "局间门禁",
      showBadge: options.showBadge !== false,
      badgePosition: options.badgePosition || "bottom-left",
      autoTick: options.autoTick === true,
      allowSkip: options.allowSkip === true,
      unlockDelay: options.unlockDelay || 1000,
      storage: options.storage !== false,
      storageKey: options.storageKey || DEFAULT_STORE_KEY,
      game: options.game || null,
      random: typeof options.random === "function" ? options.random : Math.random,
      onLock: options.onLock || null,
      onUnlock: options.onUnlock || null,
      onOpen: options.onOpen || null,
      onPass: options.onPass || null,
      onSkip: options.onSkip || null
    };

    // 调试：?gate=poem 可强制指定本次用哪种题型
    var forced = /[?&]gate=([^&]+)/.exec(global.location.search || "");
    if (forced) {
      var forcedId = decodeURIComponent(forced[1]);
      if (registry[forcedId]) this.options.challenges = [forcedId];
    }

    this.ids = this._resolveIds();
    if (!this.ids.length) throw new Error("gate.js：没有可用的门禁题型，请先加载 challenges/*.js");

    this.everySeconds = this.options.everyMinutes * 60;
    this.seconds = 0;
    this.passed = 0;
    this.attempts = 0;
    this.opens = 0;
    this.locked = false;
    this.destroyed = false;
    this.challenge = null;
    this.challengeId = null;
    this._passing = false;
    this._lastChallenge = null;
    this._resumeChallenge = null;
    this._lastBadge = "";
    this._openedAt = 0;
    this._timer = null;
    this._autoTimer = null;
    this._lastTick = 0;
    this._lastSave = 0;
    this._unsaved = 0;

    // 存档：按页面（或 options.game）分键
    this.storeKey = this.options.storageKey;
    this.gameId = this.options.game || (function () {
      var path = (global.location && global.location.pathname) || "";
      path = path.replace(/[?#].*$/, "");
      return path || "default";
    })();
    this._storeEnabled = this.options.storage && storageAvailable();
    this._pending = this._loadState();

    this._buildBadge();
    this._buildOverlay();
    this._updateBadge(true);
    this._bindFlush();

    if (this.options.autoTick) {
      var self = this;
      this._autoTimer = setInterval(function () {
        if (Date.now() - self._lastTick > 1500) self.tick(1);
      }, 1000);
    }

    // 上次没答对就离开：立刻把门禁重新立起来，刷新不能绕过
    if (this._pending) {
      var resumeSelf = this;
      setTimeout(function () {
        resumeSelf.open("resume");
      }, 0);
    }

    // 调试：openOnStart 或 ?tf24demo=1 时立即弹题
    if (options.openOnStart || /[?&]tf24demo=1/.test(global.location.search)) {
      var gateSelf = this;
      setTimeout(function () {
        gateSelf.open("demo");
      }, 0);
    }
  }

  /* ---------------- 存档读写 ---------------- */

  Gate.prototype._readStore = function () {
    var all = { v: 1, games: {} };
    if (!this._storeEnabled) return all;
    try {
      var raw = global.localStorage.getItem(this.storeKey);
      var parsed = raw ? JSON.parse(raw) : null;
      if (parsed && parsed.games && typeof parsed.games === "object") {
        return parsed;
      }
    } catch (e) {
      /* 存档损坏就当成没有，不影响游戏 */
    }
    return all;
  };

  // 返回 true 表示「上次门禁没通过」，需要立刻重新弹出
  Gate.prototype._loadState = function () {
    if (!this._storeEnabled) return false;
    var all = this._readStore();

    // 全局待通过：在别的游戏里没答对就跳过来，这里也要先过同一关
    var gp = all.pending;
    if (gp && typeof gp.game === "string" && gp.game !== this.gameId) {
      if (typeof gp.challenge === "string" && registry[gp.challenge]) {
        this._resumeChallenge = gp.challenge;
      }
      return true;
    }

    var st = all.games[this.gameId];
    if (!st) return false;

    var seconds = Number(st.seconds);
    if (seconds > 0 && seconds < 1e6) this.seconds = seconds;
    if (this.seconds > this.everySeconds) this.seconds = this.everySeconds;

    var passed = Math.floor(Number(st.passed) || 0);
    if (passed > 0) this.passed = passed;
    var opens = Math.floor(Number(st.opens) || 0);
    if (opens > 0) this.opens = opens;

    // 记录上一次的题型，避免回答中途刷新就换了题
    if (typeof st.challenge === "string" && registry[st.challenge]) {
      this._resumeChallenge = st.challenge;
    }
    return st.pending === true;
  };

  Gate.prototype._saveState = function () {
    if (!this._storeEnabled) return;
    var all = this._readStore();
    all.v = 1;
    var st = all.games[this.gameId] || {};
    st.seconds = Math.round(this.seconds * 10) / 10;
    st.passed = this.passed;
    st.opens = this.opens;
    // 门禁开着且还没答对 => 待通过，刷新 / 换页面都躲不掉
    st.pending = this.locked && !this._passing;
    st.challenge = this.challengeId || st.challenge || null;
    st.at = Date.now();
    all.games[this.gameId] = st;

    if (st.pending) {
      // 记一条全局待通过，其它游戏页读到也会拦
      all.pending = { game: this.gameId, challenge: st.challenge, at: st.at };
    } else if (all.pending) {
      // 这次已经答对：全站的待通过一起清掉，避免在别的页面被二次拦下
      delete all.pending;
      var ids = Object.keys(all.games);
      for (var i = 0; i < ids.length; i++) {
        if (all.games[ids[i]] && all.games[ids[i]].pending) all.games[ids[i]].pending = false;
      }
    }

    try {
      global.localStorage.setItem(this.storeKey, JSON.stringify(all));
      this._lastSave = Date.now();
      this._unsaved = 0;
    } catch (e) {
      /* 写失败就下次再写 */
    }
  };

  // 页面离开 / 切后台时把进度落盘
  Gate.prototype._bindFlush = function () {
    if (!this._storeEnabled) return;
    var self = this;
    this._flush = function () {
      self._saveState();
    };
    global.addEventListener("pagehide", this._flush);
    global.addEventListener("beforeunload", this._flush);
    this._visibilityHandler = function () {
      if (document.hidden) self._saveState();
    };
    document.addEventListener("visibilitychange", this._visibilityHandler);
  };

  // 清掉本局存下的进度与待通过状态（调试 / 重置用）
  Gate.prototype.clearState = function () {
    this.seconds = 0;
    this.passed = 0;
    this.opens = 0;
    if (!this._storeEnabled) return;
    try {
      var all = this._readStore();
      delete all.games[this.gameId];
      global.localStorage.setItem(this.storeKey, JSON.stringify(all));
    } catch (e) {
      /* ignore */
    }
  };

  /* ---------------- 题型选择 ---------------- */

  Gate.prototype._resolveIds = function () {
    var raw = this.options.challenges;
    var ids;
    if (raw === "all" || raw === "auto" || raw == null) ids = order.slice();
    else if (typeof raw === "string") ids = [raw];
    else if (Array.isArray(raw)) ids = raw.slice();
    else ids = order.slice();

    return ids.filter(function (id) {
      return !!registry[id];
    });
  };

  Gate.prototype._choose = function () {
    if (this.ids.length === 1) return this.ids[0];
    var pool = this.ids.filter(function (id) {
      return id !== this._lastChallenge;
    }, this);
    if (!pool.length) pool = this.ids.slice();

    var total = pool.reduce(function (sum, id) {
      return sum + registry[id].weight;
    }, 0);
    var r = this.options.random() * total;
    if (r >= total) r = total - 0.0001;
    for (var i = 0; i < pool.length; i++) {
      r -= registry[pool[i]].weight;
      if (r < 0) return pool[i];
    }
    return pool[pool.length - 1];
  };

  Gate.prototype._optionsFor = function (id) {
    var base = this.options.challengeOptions[id] || {};
    return base;
  };

  /* ---------------- 徽标 ---------------- */

  Gate.prototype._buildBadge = function () {
    var badge = document.createElement("button");
    badge.type = "button";
    badge.className = "gate-badge";
    var pos = this.options.badgePosition;
    if (pos === "top-left") badge.classList.add("is-top-left");
    else if (pos === "top-right") badge.classList.add("is-top-right");
    else if (pos === "raised") badge.classList.add("is-raised");
    badge.hidden = !this.options.showBadge;
    badge.innerHTML =
      '<span class="gate-badge-mark" aria-hidden="true">关</span>' +
      '<span class="gate-badge-label">局间门禁</span>' +
      '<span class="gate-badge-time"></span>';
    badge.setAttribute("aria-label", "打开局间门禁");
    var self = this;
    badge.addEventListener("click", function () {
      self.open("badge");
    });
    (document.body || document.documentElement).appendChild(badge);
    this.badge = badge;
    this.badgeTimeEl = badge.querySelector(".gate-badge-time");
  };

  Gate.prototype._updateBadge = function (force) {
    if (!this.badge) return;
    if (this.locked || !this.options.showBadge) {
      this.badge.hidden = true;
      return;
    }
    this.badge.hidden = false;
    var remain = Math.max(0, this.everySeconds - this.seconds);
    var text = fmtClock(remain);
    if (force || text !== this._lastBadge) {
      this._lastBadge = text;
      this.badgeTimeEl.textContent = text;
      this.badge.title = "还有 " + text + " 进入门禁，点击可立即挑战";
    }
  };

  /* ---------------- 遮罩与面板 ---------------- */

  Gate.prototype._buildOverlay = function () {
    var overlay = document.createElement("div");
    overlay.className = "gate";
    overlay.hidden = true;
    overlay.innerHTML =
      '<div class="gate-scrim"></div>' +
      '<section class="gate-panel" role="dialog" aria-modal="true" aria-labelledby="gate-title">' +
      '  <header class="gate-head">' +
      '    <p class="gate-kicker"></p>' +
      '    <h2 class="gate-title" id="gate-title"></h2>' +
      '    <p class="gate-note"></p>' +
      "  </header>" +
      '  <div class="gate-meta">' +
      '    <span class="gate-chip"></span>' +
      '    <span class="gate-time"></span>' +
      '    <span class="gate-count"></span>' +
      "  </div>" +
      '  <div class="gate-body"></div>' +
      '  <p class="gate-error" role="status" aria-live="polite"></p>' +
      '  <div class="gate-success" hidden>' +
      '    <strong>通过</strong><span class="gate-success-text"></span>' +
      "  </div>" +
      '  <footer class="gate-foot">' +
      '    <span class="gate-foot-tip">' +
      (this.options.allowSkip ? "答对才能继续" : "答对才能继续，不能跳过") +
      "</span>" +
      '    <button type="button" class="gate-skip">换一题</button>' +
      "  </footer>" +
      "</section>";

    (document.body || document.documentElement).appendChild(overlay);

    this.overlay = overlay;
    this.panel = overlay.querySelector(".gate-panel");
    this.panel.tabIndex = -1;
    this.bodyEl = overlay.querySelector(".gate-body");
    this.kickerEl = overlay.querySelector(".gate-kicker");
    this.titleEl = overlay.querySelector(".gate-title");
    this.noteEl = overlay.querySelector(".gate-note");
    this.chipEl = overlay.querySelector(".gate-chip");
    this.timeEl = overlay.querySelector(".gate-time");
    this.countEl = overlay.querySelector(".gate-count");
    this.errorEl = overlay.querySelector(".gate-error");
    this.successEl = overlay.querySelector(".gate-success");
    this.successTextEl = overlay.querySelector(".gate-success-text");
    this.skipBtn = overlay.querySelector(".gate-skip");

    this.kickerEl.textContent = this.options.kicker;
    this.titleEl.textContent = this.options.title;
    this.noteEl.textContent =
      this.options.note ||
      "已经玩了 " + this.options.everyMinutes + " 分钟。完成这道题，再继续。";
    this._defaultNote = this.noteEl.textContent;

    var self = this;
    this.skipBtn.hidden = !this.options.allowSkip;
    this.skipBtn.addEventListener("click", function () {
      self.skipPuzzle();
    });

    // 不能靠 Esc 逃出去，但也不打断输入
    overlay.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") {
        ev.preventDefault();
        self._nudge();
      }
      if (ev.key === "Tab") self._trapFocus(ev);
    });
  };

  Gate.prototype._trapFocus = function (ev) {
    var focusables = this.panel.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (!focusables.length) return;
    var first = focusables[0];
    var last = focusables[focusables.length - 1];
    if (ev.shiftKey && document.activeElement === first) {
      ev.preventDefault();
      last.focus();
    } else if (!ev.shiftKey && document.activeElement === last) {
      ev.preventDefault();
      first.focus();
    }
  };

  Gate.prototype._nudge = function () {
    var self = this;
    this.panel.classList.remove("is-nudge");
    void this.panel.offsetWidth;
    this.panel.classList.add("is-nudge");
    this._error("按 Esc 也走不了，答对才能继续。");
    setTimeout(function () {
      self.panel.classList.remove("is-nudge");
    }, 500);
  };

  /* ---------------- 题目挂载 ---------------- */

  Gate.prototype._safeMount = function (forcedId) {
    try {
      this._mount(forcedId);
      return true;
    } catch (err) {
      if (typeof console !== "undefined" && console.error) {
        console.error("[Gate] 题型挂载失败", err);
      }
      this._destroyChallenge();
      this.challengeId = null;
      this.bodyEl.innerHTML = "";
      this.chipEl.textContent = "题型加载失败";
      this.successEl.hidden = true;
      this._error("题目没有加载成功，请重新打开门禁。");
      return false;
    }
  };

  Gate.prototype._mount = function (forcedId) {
    this._destroyChallenge();

    var id = forcedId && registry[forcedId] ? forcedId : this._choose();
    var def = registry[id];
    this.challengeId = id;
    this._lastChallenge = id;

    var self = this;
    var api = {
      pass: function (detail) {
        self._pass(detail || {});
      },
      fail: function (message) {
        self._error(message);
      },
      clear: function () {
        self._error("");
      },
      target: this.options.target,
      passed: this.passed,
      opens: this.opens,
      options: this._optionsFor(id),
      random: this.options.random,
      solved: function () {
        return self._passing || !self.locked;
      },
      next: function () {
        self._nextQuestion();
      }
    };

    var inst = def.create(api);
    if (!inst || !inst.el) throw new Error("题型 " + id + " 没有返回 el");

    this.bodyEl.innerHTML = "";
    this.bodyEl.setAttribute("data-challenge", id);
    this.panel.setAttribute("aria-label", def.name + " 关卡");
    inst.el.classList.add("gate-challenge");
    this.bodyEl.appendChild(inst.el);

    this.challenge = inst;
    this.chipEl.textContent = def.name + (inst.meta ? " · " + inst.meta() : "");
    this.errorEl.textContent = "";
    this.successEl.hidden = true;
    this.panel.classList.remove("is-passed");
  };

  Gate.prototype._destroyChallenge = function () {
    if (!this.challenge) return;
    try {
      if (this.challenge.destroy) this.challenge.destroy();
    } catch (e) {
      /* 题型自己清理失败不应拦住门禁 */
    }
    this.challenge = null;
  };

  Gate.prototype._nextQuestion = function () {
    if (!this.locked || this.destroyed || this._passing) return;
    var id = this.challengeId;
    this._safeMount(id);
    this._openedAt = Date.now();
    this._updateMeta();
    if (this.challenge && this.challenge.focus) {
      try {
        this.challenge.focus();
      } catch (e) {
        /* ignore */
      }
    } else {
      this.panel.focus({ preventScroll: true });
    }
  };

  Gate.prototype._updateMeta = function () {
    if (!this.timeEl) return;
    var seconds = this._openedAt ? (Date.now() - this._openedAt) / 1000 : 0;
    this.timeEl.textContent = "本题 " + fmtClock(seconds);
    this.countEl.textContent = "已通过 " + this.passed + " 关";
  };

  /* ---------------- 开 / 关 ---------------- */

  Gate.prototype.open = function (reason) {
    if (this.locked || this.destroyed) return;
    this.locked = true;
    this.opens++;
    this.seconds = 0;
    this._passing = false;
    this._openedAt = Date.now();
    this._updateBadge(true);

    this.overlay.hidden = false;
    document.body.classList.add("gate-locked");

    // 接着刷新前没答完的那道题继续
    var resumed = reason === "resume" ? this._resumeChallenge : null;
    var mounted = this._safeMount(resumed);
    // 题型加载失败时换一个再试，别把人永久关在门外
    if (!mounted && this.ids.length > 1) {
      for (var i = 0; i < this.ids.length; i++) {
        if (this.ids[i] === this.challengeId) continue;
        if (this._safeMount(this.ids[i])) break;
      }
    }
    this._resumeChallenge = null;
    this.noteEl.textContent = reason === "resume"
      ? "上一道题还没答对，先把它做完才能继续。"
      : this._defaultNote;

    this._updateMeta();
    this._saveState();

    var self = this;
    requestAnimationFrame(function () {
      self.overlay.classList.add("is-open");
      if (self.challenge && self.challenge.focus) {
        try {
          self.challenge.focus();
        } catch (e) {
          /* 题型给的焦点目标可能暂时不可聚焦 */
        }
      } else {
        self.panel.focus({ preventScroll: true });
      }
    });

    this._timer = setInterval(function () {
      self._updateMeta();
    }, 500);

    if (this.options.onLock) this.options.onLock(reason || "timer");
    if (this.options.onOpen) this.options.onOpen(reason || "timer", this.challengeId);
    document.dispatchEvent(new CustomEvent("gate:lock", {
      detail: { reason: reason || "timer", challenge: this.challengeId }
    }));
    document.dispatchEvent(new CustomEvent("tf24:lock", {
      detail: { reason: reason || "timer", challenge: this.challengeId }
    }));
  };

  Gate.prototype._error = function (message) {
    if (this.errorEl) this.errorEl.textContent = message || "";
  };

  Gate.prototype._pass = function (detail) {
    if (!this.locked || this._passing) return;
    this._passing = true;
    this.passed++;

    var seconds = (Date.now() - this._openedAt) / 1000;
    if (this.challenge && this.challenge.lock) {
      try {
        this.challenge.lock();
      } catch (e) {
        /* ignore */
      }
    }

    this.panel.classList.add("is-passed");
    this.successEl.hidden = false;
    this.successTextEl.textContent =
      "用时 " + fmtClock(seconds) + (detail.summary ? " · " + detail.summary : "");
    this._updateMeta();

    if (this.options.onPass) this.options.onPass(detail, this.challengeId);
    document.dispatchEvent(new CustomEvent("gate:pass", {
      detail: { challenge: this.challengeId, seconds: seconds, summary: detail.summary || "" }
    }));

    var self = this;
    clearTimeout(this._closeTimer);
    this._saveState(); // 已通过：pending 落成 false，刷新后不再弹
    this._closeTimer = setTimeout(function () {
      self.close();
    }, this.options.unlockDelay);
  };

  Gate.prototype.close = function () {
    if (!this.locked || this.destroyed) return;
    this.locked = false;
    this._passing = false;
    clearInterval(this._timer);
    this._timer = null;
    clearTimeout(this._closeTimer);

    var self = this;
    this.overlay.classList.remove("is-open");
    document.body.classList.remove("gate-locked");
    setTimeout(function () {
      if (!self.locked) {
        self.overlay.hidden = true;
        self._destroyChallenge();
        self.bodyEl.innerHTML = "";
      }
    }, 240);

    this.seconds = 0;
    this._updateBadge(true);
    this._saveState(); // 重新开始 5 分钟计时，同时把待通过状态清掉

    if (this.options.onUnlock) this.options.onUnlock();
    document.dispatchEvent(new CustomEvent("gate:unlock"));
    document.dispatchEvent(new CustomEvent("tf24:unlock"));
  };

  /* ---------------- 外部接口 ---------------- */

  Gate.prototype.tick = function (dtSeconds) {
    if (this.destroyed) return;
    this._lastTick = Date.now();
    if (this.locked) return;
    var dt = Number(dtSeconds);
    if (!(dt > 0)) return;
    if (dt > 2) dt = 2; // 从暂停恢复时不要一次跳完
    this.seconds += dt;
    this._unsaved += dt;
    this._updateBadge(false);
    // 累计 2 秒或距上次落盘 2 秒写一次，避免每帧写 localStorage
    if (this._unsaved >= 2 || !this._lastSave || Date.now() - this._lastSave > 2000) {
      this._saveState();
    }
    if (this.seconds >= this.everySeconds) {
      this.open("timer");
    }
  };

  Gate.prototype.openNow = function () {
    this.open("manual");
  };

  Gate.prototype.skipPuzzle = function () {
    if (!this.options.allowSkip || !this.locked || this.destroyed || this._passing) return;
    this.attempts++;
    this._safeMount();
    this._updateMeta();
    if (this.options.onSkip) this.options.onSkip(this.challengeId);
    document.dispatchEvent(new CustomEvent("gate:skip", { detail: { challenge: this.challengeId } }));
    if (this.challenge && this.challenge.focus) this.challenge.focus();
    else this.panel.focus({ preventScroll: true });
  };

  Gate.prototype.describe = function () {
    return {
      seconds: this.seconds,
      remaining: Math.max(0, this.everySeconds - this.seconds),
      passed: this.passed,
      opens: this.opens,
      locked: this.locked,
      pending: this.locked && !this._passing,
      everyMinutes: this.options.everyMinutes,
      challenge: this.challengeId,
      available: this.ids.slice(),
      game: this.gameId,
      storage: this._storeEnabled
    };
  };

  Gate.prototype.destroy = function () {
    this.destroyed = true;
    // 退出时把当前进度（以及「还锁着」的状态）落盘
    this._saveState();
    clearInterval(this._timer);
    clearInterval(this._autoTimer);
    clearTimeout(this._closeTimer);
    if (this._flush) {
      global.removeEventListener("pagehide", this._flush);
      global.removeEventListener("beforeunload", this._flush);
    }
    if (this._visibilityHandler) {
      document.removeEventListener("visibilitychange", this._visibilityHandler);
    }
    this._destroyChallenge();
    if (this.overlay) this.overlay.remove();
    if (this.badge) this.badge.remove();
    document.body.classList.remove("gate-locked");
    // 如果销毁时还锁着，把控制权还给宿主，避免游戏永远停着
    if (this.locked) {
      this.locked = false;
      this._passing = false;
      if (this.options.onUnlock) this.options.onUnlock();
      document.dispatchEvent(new CustomEvent("gate:unlock"));
      document.dispatchEvent(new CustomEvent("tf24:unlock"));
    }
  };

  function create(options) {
    return new Gate(options);
  }

  // 整体清空门禁存档（比如家长想重置所有游戏的计时）
  function clearStore() {
    try {
      global.localStorage.removeItem(DEFAULT_STORE_KEY);
      return true;
    } catch (e) {
      return false;
    }
  }

  global.Gate = {
    create: create,
    register: register,
    get: get,
    list: list,
    Gate: Gate,
    fmtClock: fmtClock,
    clearStore: clearStore,
    storageKey: DEFAULT_STORE_KEY
  };

  // 兼容旧调用：TF24Gate === Gate
  global.TF24Gate = global.Gate;
})(typeof window !== "undefined" ? window : globalThis);
