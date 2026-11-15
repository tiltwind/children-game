/* ============================================================
 * ui.js —— 全屏界面与战斗 HUD（只负责渲染 DOM，不推进游戏逻辑）
 * ============================================================ */
(function (root) {
  'use strict';
  var GG = (root.GG = root.GG || {});
  var C = GG.C, U = GG.U, UI = (GG.UI = {});

  var layer = null;
  var hud = null;
  var refs = {};
  var world = null;
  var lastHud = 0;

  var TYPE_LABEL = {
    eliminate: '清剿', hack: '骇入', defend: '防守', survive: '生存', boss: 'BOSS'
  };
  var GRADE_RANK = { C: 1, B: 2, A: 3, S: 4 };

  UI.init = function () {
    layer = document.getElementById('screenLayer');
    hud = document.getElementById('hud');
    refs = {
      code: document.getElementById('hudCode'),
      name: document.getElementById('hudName'),
      timer: document.getElementById('hudTimer'),
      objective: document.getElementById('hudObjective'),
      objBar: document.getElementById('objBar'),
      stealth: document.getElementById('hudStealth'),
      hpBar: document.getElementById('hpBar'),
      hpNum: document.getElementById('hpNum'),
      armorBar: document.getElementById('armorBar'),
      armorNum: document.getElementById('armorNum'),
      staminaBar: document.getElementById('staminaBar'),
      nadeNum: document.getElementById('nadeNum'),
      medNum: document.getElementById('medNum'),
      weaponName: document.getElementById('weaponName'),
      magNum: document.getElementById('magNum'),
      reserveNum: document.getElementById('reserveNum'),
      weaponSlots: document.getElementById('weaponSlots'),
      toasts: document.getElementById('toasts'),
      hint: document.getElementById('hudHint'),
      banner: document.getElementById('banner'),
      bossHud: document.getElementById('bossHud'),
      bossBar: document.getElementById('bossBar'),
      minimap: document.getElementById('minimap')
    };
    UI.mctx = refs.minimap.getContext('2d');
  };

  /* ---------------- 通用 ---------------- */
  function gradeClass(g) { return g ? 'grade-' + g : ''; }

  function bestGrade(a, b) {
    if (!a) return b || '';
    if (!b) return a;
    return (GRADE_RANK[b] || 0) > (GRADE_RANK[a] || 0) ? b : a;
  }
  UI.bestGrade = bestGrade;

  function cleared(profile) {
    return C.MISSIONS.filter(function (m) { return profile.missions[m.id] && profile.missions[m.id].done; }).length;
  }

  function unlocked(profile, idx) {
    if (idx <= 0) return true;
    var prev = C.MISSIONS[idx - 1];
    return !!(profile.missions[prev.id] && profile.missions[prev.id].done);
  }
  UI.unlocked = unlocked;

  function typeLabel(m) {
    return TYPE_LABEL[m.objective.type] || '行动';
  }

  function showScreen(html) {
    layer.innerHTML = html;
    layer.scrollTop = 0;
    layer.classList.remove('is-hidden');
  }
  UI.showScreen = showScreen;

  UI.hideScreens = function () {
    layer.innerHTML = '';
    layer.classList.add('is-hidden');
  };

  UI.showHUD = function () { hud.classList.remove('is-hidden'); };
  UI.hideHUD = function () { hud.classList.add('is-hidden'); };

  UI.setWorld = function (w) {
    world = w;
    refs.code.textContent = w.mission.code;
    refs.name.textContent = w.mission.name;
    refs.timer.textContent = '00:00';
    refs.stealth.textContent = '潜行中';
    refs.stealth.classList.remove('is-combat');
    refs.bossHud.classList.add('is-hidden');
    refs.bossBar.style.width = '100%';
    refs.toasts.innerHTML = '';
    refs.hint.textContent = '';
    refs.weaponSlots.innerHTML = w.player.weapons.map(function (wp, i) {
      return '<span class="slot-chip" data-slot="' + i + '">' + (i + 1) + ' ' + wp.def.short + '</span>';
    }).join('');
    UI.refreshHud();
  };

  UI.toast = function (text) {
    if (!refs.toasts) return;
    var div = document.createElement('div');
    div.className = 'toast';
    div.textContent = text;
    refs.toasts.appendChild(div);
    while (refs.toasts.children.length > 3) refs.toasts.removeChild(refs.toasts.firstChild);
    setTimeout(function () {
      if (div.parentNode) div.parentNode.removeChild(div);
    }, 3200);
  };

  UI.banner = function (text) {
    if (!refs.banner) return;
    refs.banner.textContent = text;
    refs.banner.classList.add('is-show');
    clearTimeout(UI._bannerT);
    UI._bannerT = setTimeout(function () {
      refs.banner.classList.remove('is-show');
    }, 2400);
  };

  /* ---------------- 战役菜单 ---------------- */
  UI.showMenu = function (profile, difficulty) {
    var done = cleared(profile);
    var cards = C.MISSIONS.map(function (m, i) {
      var st = profile.missions[m.id] || null;
      var open = unlocked(profile, i);
      var best = st && st.best ? st.best : '';
      var label = m.objective.type === 'eliminate' ? '清除全部守卫'
        : m.objective.type === 'hack' ? '接入 ' + m.objective.count + ' 个节点'
        : m.objective.type === 'defend' ? '坚守 ' + m.objective.seconds + ' 秒'
        : m.objective.type === 'survive' ? '撑过 ' + m.objective.seconds + ' 秒'
        : '击杀「铁颚」';
      if (!open) label = '完成上一关后解锁';
      return '' +
        '<button type="button" class="mission-card' + (open ? '' : ' is-locked') + (st && st.done ? ' is-done' : '') + '"' +
        (open ? ' data-act="mission" data-id="' + m.id + '"' : ' disabled') + '>' +
        '  <span class="mc-top"><span class="mc-no">' + m.code + '</span>' +
        (best ? '<span class="mc-grade ' + gradeClass(best) + '">' + best + '</span>' : '<span class="mc-grade grade-C">—</span>') +
        '  </span>' +
        '  <span class="mc-name">' + m.name + '</span>' +
        '  <span class="mc-place">' + m.place + ' · ' + m.clock + '</span>' +
        '  <span class="mc-obj">' + label + '</span>' +
        '  <span class="mc-tags"><span class="mc-tag">' + m.difficulty + '</span>' +
        '  <span class="mc-tag">' + typeLabel(m) + '</span></span>' +
        (open ? '' : '<span class="mc-lock">LOCKED</span>') +
        '</button>';
    }).join('');

    showScreen('' +
      '<div class="screen">' +
      '  <div class="screen-inner">' +
      '    <div class="menu-head">' +
      '      <div>' +
      '        <div class="screen-kicker">SHUTU TACTICAL / 8 OPERATIONS</div>' +
      '        <h1>铁幕街区</h1>' +
      '        <p class="desc">俯视角战术射击。视野只有一盏灯的距离，枪声会把整层楼的人叫来。用掩体、消音枪、手雷和翻滚，把八个街区一寸一寸拿下来。</p>' +
      '      </div>' +
      '      <div class="menu-meta">信用点 <b>' + profile.credits + '</b><br>已通关 <b>' + done + ' / 8</b><br>难度 <b>' + difficulty.name + '</b></div>' +
      '    </div>' +
      '    <div class="mission-grid">' + cards + '</div>' +
      '    <div class="menu-actions">' +
      '      <button type="button" class="btn is-primary" data-act="shop">战前整备</button>' +
      '      <button type="button" class="btn" data-act="difficulty">难度 · ' + difficulty.name + '</button>' +
      '      <button type="button" class="btn btn-ghost" data-act="mute">音效 · ' + (GG.Audio && GG.Audio.isMuted() ? '关' : '开') + '</button>' +
      '      <span class="spacer"></span>' +
      '      <span class="controls-line" style="margin:0">WASD 移动 · 左键射击 · R 换弹 · E 接入 · F 处决</span>' +
      '    </div>' +
      '    <div class="controls-line">每完成 1 关计 1 次游玩；4 次后按站内规则休息 30 分钟。每 5 分钟插入一道 24 点 / 古诗门禁。</div>' +
      '  </div>' +
      '</div>');
  };

  /* ---------------- 任务简报 ---------------- */
  UI.showBriefing = function (mission, profile, difficulty) {
    var weapons = profile.loadout.map(function (id) {
      var w = C.WEAPONS[id];
      return w ? '<div class="gear-item"><b>' + w.short + '</b><em>' + w.name + '</em></div>' : '';
    }).join('');
    var intel = mission.intel.map(function (t) { return '<li>' + t + '</li>'; }).join('');
    var tips = mission.tips.map(function (t) { return '<li>' + t + '</li>'; }).join('');

    showScreen('' +
      '<div class="screen">' +
      '  <div class="screen-inner">' +
      '    <div class="brief-grid">' +
      '      <div class="brief-main">' +
      '        <div class="screen-kicker">' + mission.code + ' / 任务简报</div>' +
      '        <h1>' + mission.name + '</h1>' +
      '        <div class="brief-meta">' + mission.place + ' · ' + mission.clock + ' · 评级目标 ' + U.fmt(mission.par) + ' 内完成</div>' +
      '        <p class="brief-text">' + mission.brief + '</p>' +
      '        <div class="section-label">已知情报</div>' +
      '        <ul class="bullet-list">' + intel + '</ul>' +
      '        <div class="section-label">行动建议</div>' +
      '        <ul class="bullet-list">' + tips + '</ul>' +
      '      </div>' +
      '      <aside class="brief-side">' +
      '        <div class="section-label" style="margin-top:0">行动目标</div>' +
      '        <p style="font-size:12px;line-height:1.7;color:#c9bda9;margin-bottom:14px">' + mission.objective.text + '</p>' +
      '        <div class="section-label">携带装备</div>' +
      '        <div class="gear-list">' + weapons +
      '          <div class="gear-item"><b>手雷 ' + (2 + (profile.supplies.grenade || 0)) + '</b><em>G 投掷</em></div>' +
      '          <div class="gear-item"><b>医疗包 ' + (1 + (profile.supplies.medkit || 0)) + '</b><em>V 使用</em></div>' +
      '        </div>' +
      '        <div class="gear-item" style="border-bottom:0"><span>难度</span><b>' + difficulty.name + '</b></div>' +
      '        <div class="brief-actions">' +
      '          <button type="button" class="btn is-primary" data-act="start" data-id="' + mission.id + '">开始行动</button>' +
      '          <button type="button" class="btn" data-act="shop">调整装备</button>' +
      '          <button type="button" class="btn btn-ghost" data-act="menu">返回战役地图</button>' +
      '        </div>' +
      '        <p class="muted" style="margin-top:12px;font-size:10px">提示：G 手雷、V 医疗包、空格翻滚可在被压制时救命。</p>' +
      '      </aside>' +
      '    </div>' +
      '  </div>' +
      '</div>');
  };

  /* ---------------- 整备 / 商店 ---------------- */
  UI.showShop = function (profile, difficulty) {
    var shop = C.SHOP;

    var weaponItems = C.WEAPON_ORDER.map(function (id) {
      var w = C.WEAPONS[id];
      var owned = id === 'pistol' || !!profile.unlocked[id];
      var equipped = profile.loadout.indexOf(id) >= 0;
      var item = null;
      for (var i = 0; i < shop.length; i++) if (shop[i].weapon === id) item = shop[i];
      var cost = item ? item.cost : 0;
      var action = owned
        ? '<button type="button" class="shop-buy' + (equipped ? ' is-on' : '') + '" data-act="toggle-weapon" data-id="' + id + '"' + (owned && !equipped && profile.loadout.length >= 3 ? ' disabled' : '') + '>' + (equipped ? '已携带' : '携带') + '</button>'
        : '<button type="button" class="shop-buy" data-act="buy-weapon" data-id="' + id + '"' + (profile.credits < cost ? ' disabled' : '') + '>' + cost + ' CP</button>';
      return '' +
        '<div class="shop-item ' + (owned ? 'is-owned' : '') + ' ' + (equipped ? 'is-equipped' : '') + '">' +
        '  <div class="shop-info"><div class="shop-name">' + w.name + '</div>' +
        '    <div class="shop-desc">' + w.desc + '</div>' +
        '    <div class="shop-level">' + (owned ? (id === 'pistol' ? '常备武器' : '已解锁') : '未解锁') + ' · 弹匣 ' + w.mag + ' · 备弹 ' + w.reserve + '</div>' +
        '  </div>' + action + '</div>';
    }).join('');

    var upItems = shop.filter(function (s) { return s.kind === 'upgrade'; }).map(function (s) {
      var lvl = profile.upgrades[s.key] || 0;
      var cost = s.cost + lvl * s.step;
      var maxed = lvl >= s.max;
      var dots = '<span class="dots">';
      for (var d = 0; d < s.max; d++) dots += '<i class="' + (d < lvl ? 'on' : '') + '"></i>';
      dots += '</span>';
      return '' +
        '<div class="shop-item">' +
        '  <div class="shop-info"><div class="shop-name">' + s.name + dots + '</div>' +
        '    <div class="shop-desc">' + s.desc + '</div>' +
        '    <div class="shop-level">等级 <b>' + lvl + '/' + s.max + '</b></div></div>' +
        '  <button type="button" class="shop-buy" data-act="buy-upgrade" data-id="' + s.key + '"' +
        (maxed || profile.credits < cost ? ' disabled' : '') + '>' + (maxed ? '已满级' : cost + ' CP') + '</button>' +
        '</div>';
    }).join('');

    var supItems = shop.filter(function (s) { return s.kind === 'supply'; }).map(function (s) {
      var have = profile.supplies[s.item] || 0;
      return '' +
        '<div class="shop-item">' +
        '  <div class="shop-info"><div class="shop-name">' + s.name + '</div>' +
        '    <div class="shop-desc">' + s.desc + '</div>' +
        '    <div class="shop-level">现有 <b>' + have + '</b> · 下局额外补给</div></div>' +
        '  <button type="button" class="shop-buy" data-act="buy-supply" data-id="' + s.item + '"' +
        (profile.credits < s.cost ? ' disabled' : '') + '>' + s.cost + ' CP</button>' +
        '</div>';
    }).join('');

    showScreen('' +
      '<div class="screen">' +
      '  <div class="screen-inner">' +
      '    <div class="loadout-head">' +
      '      <div><div class="screen-kicker">LOADOUT / 战前整备</div><h1 style="font-size:26px">装备与强化</h1>' +
      '        <p class="muted">每次任务结束都会带回信用点。护甲与体能是长期收益，弹药与手雷只在下一局生效。</p></div>' +
      '      <div class="menu-meta">信用点 <b>' + profile.credits + '</b><br>难度 <b>' + difficulty.name + '</b></div>' +
      '    </div>' +
      '    <div class="shop-section"><div class="section-label" style="margin-top:0">武器 · 最多携带 3 把（手枪常备）</div>' +
      '      <div class="shop-grid">' + weaponItems + '</div></div>' +
      '    <div class="shop-section"><div class="section-label">永久强化</div>' +
      '      <div class="shop-grid">' + upItems + '</div></div>' +
      '    <div class="shop-section"><div class="section-label">下一局补给</div>' +
      '      <div class="shop-grid">' + supItems + '</div></div>' +
      '    <div class="menu-actions">' +
      '      <button type="button" class="btn is-primary" data-act="menu">返回战役地图</button>' +
      '      <span class="spacer"></span>' +
      '      <span class="controls-line" style="margin:0">护甲吸收 60% 伤害 · 升级即时生效</span>' +
      '    </div>' +
      '  </div>' +
      '</div>');
  };

  /* ---------------- 结算 ---------------- */
  UI.showResults = function (data) {
    if (data.failed) {
      showScreen('' +
        '<div class="screen">' +
        '  <div class="screen-inner">' +
        '    <div class="result-wrap">' +
        '      <div class="grade-box"><div class="grade-letter" style="color:#cd5b45;text-shadow:0 0 40px rgba(205,91,69,.25)">✕</div>' +
        '        <div class="grade-label">MISSION FAILED</div>' +
        '        <div class="grade-note">行动终止<br>' + data.mission.name + '</div></div>' +
        '      <div class="result-head">' +
        '        <div class="screen-kicker">' + data.mission.code + ' / 行动记录</div>' +
        '        <h1 style="font-size:28px">任务失败</h1>' +
        '        <p class="muted">' + data.reason + '</p>' +
        UHStats(data.stats) +
        '        <div class="result-actions">' +
        '          <button type="button" class="btn is-primary" data-act="start" data-id="' + data.mission.id + '">再次尝试</button>' +
        '          <button type="button" class="btn" data-act="shop">战前整备</button>' +
        '          <button type="button" class="btn btn-ghost" data-act="menu">返回战役地图</button>' +
        '        </div>' +
        '        <p class="result-tip">提示：先清掉落单的敌人，尽量用消音手枪和处决打开缺口；被包围时用手雷和油桶破局。</p>' +
        '      </div>' +
        '    </div>' +
        '  </div>' +
        '</div>');
      return;
    }

    var grade = data.grade;
    showScreen('' +
      '<div class="screen">' +
      '  <div class="screen-inner">' +
      '    <div class="result-wrap">' +
      '      <div class="grade-box">' +
      '        <div class="grade-letter ' + gradeClass(grade) + '">' + grade + '</div>' +
      '        <div class="grade-label">MISSION RATING</div>' +
      '        <div class="grade-note">' + data.mission.name + '<br>' + data.mission.place + '</div>' +
      '      </div>' +
      '      <div class="result-head">' +
      '        <div class="screen-kicker">' + data.mission.code + ' / 行动完成</div>' +
      '        <h1 style="font-size:28px">任务完成</h1>' +
      '        <p class="muted">' + (data.first ? '首次通关，全额行动奖励。' : '重复行动，奖励按 40% 结算。') + '</p>' +
      UHStats(data.stats) +
      '        <div class="reward-row"><span>行动奖励</span><b>+' + data.reward + ' CP</b></div>' +
      '        <div class="reward-row"><span>评级加成</span><b>+' + data.gradeBonus + ' CP</b></div>' +
      '        <div class="reward-row"><span>难度加成</span><b>+' + data.diffBonus + ' CP</b></div>' +
      '        <div class="reward-row" style="border-bottom:0"><span>信用点合计</span><b>+' + data.total + ' CP</b></div>' +
      '        <div class="result-actions">' +
      (data.nextId ? '<button type="button" class="btn is-primary" data-act="mission" data-id="' + data.nextId + '">下一关 · ' + data.nextName + '</button>' : '') +
      '          <button type="button" class="btn" data-act="start" data-id="' + data.mission.id + '">再打一次</button>' +
      '          <button type="button" class="btn" data-act="shop">战前整备</button>' +
      '          <button type="button" class="btn btn-ghost" data-act="menu">返回战役地图</button>' +
      '        </div>' +
      '        <p class="result-tip">' + (data.nextId ? '下一关已解锁，建议先去整备补充手雷与护甲。' : '全部行动已完成。可以重复挑战刷新评级。') + '</p>' +
      '      </div>' +
      '    </div>' +
      '  </div>' +
      '</div>');
  };

  function UHStats(stats) {
    if (!stats) return '';
    return '' +
      '<div class="result-stats">' +
      '  <div class="stat"><span>TIME</span><b>' + U.fmt(stats.time) + '</b></div>' +
      '  <div class="stat"><span>KILLS</span><b>' + stats.kills + '</b></div>' +
      '  <div class="stat"><span>ACCURACY</span><b>' + stats.accuracy + '<small>%</small></b></div>' +
      '  <div class="stat"><span>ALERTS</span><b>' + stats.alerts + '</b></div>' +
      '  <div class="stat"><span>DAMAGE</span><b>' + stats.damage + '</b></div>' +
      '  <div class="stat"><span>STEALTH KILLS</span><b>' + stats.stealthKills + '</b></div>' +
      '</div>';
  }

  /* ---------------- 暂停 ---------------- */
  UI.showPause = function () {
    showScreen('' +
      '<div class="screen">' +
      '  <div class="pause-card">' +
      '    <div class="screen-kicker">OPERATION PAUSED</div>' +
      '    <h1>行动暂停</h1>' +
      '    <p class="muted">战场已冻结。门禁与强制休息也会从暂停处继续。</p>' +
      '    <div class="pause-keys">' +
      '      <span><b>WASD</b> 移动</span><span><b>Shift</b> 冲刺</span>' +
      '      <span><b>空格</b> 翻滚闪避</span><span><b>左键</b> 射击</span>' +
      '      <span><b>R</b> 换弹</span><span><b>1-4</b> 切换武器</span>' +
      '      <span><b>G</b> 手雷</span><span><b>V</b> 医疗包</span>' +
      '      <span><b>E</b> 接入节点</span><span><b>F</b> 近战 / 处决</span>' +
      '    </div>' +
      '    <div class="pause-actions">' +
      '      <button type="button" class="btn is-primary" data-act="resume">继续行动</button>' +
      '      <button type="button" class="btn" data-act="start" data-id="' + (world ? world.mission.id : '') + '">重新开始</button>' +
      '      <button type="button" class="btn btn-ghost" data-act="abort">放弃任务</button>' +
      '    </div>' +
      '  </div>' +
      '</div>');
  };

  /* ---------------- HUD ---------------- */
  UI.refreshHud = function () {
    if (!world || !refs.code) return;
    var w = world, p = w.player, o = w.mission.objective, st = w.objective;

    refs.timer.textContent = U.fmt(w.elapsed);
    var alive = 0;
    for (var i = 0; i < w.enemies.length; i++) if (w.enemies[i].alive) alive++;
    var progress = 0, text = '', bar = 0;
    if (o.type === 'eliminate') {
      var total = Math.max(1, w.enemyTotal);
      progress = (total - alive) / total;
      text = st.done ? '撤离点已开放，前往西南侧门' : '剩余敌人 ' + alive + ' / ' + total;
      bar = progress;
    } else if (o.type === 'hack') {
      progress = st.hacked / st.required;
      text = st.done ? '撤离点已开放，撤回一层大厅' : '数据节点 ' + st.hacked + ' / ' + st.required;
      bar = progress;
    } else if (o.type === 'defend') {
      var inZone = w.map.zone && U.dist(p.x, p.y, w.map.zone.x, w.map.zone.y) <= w.map.zone.r;
      progress = st.holdT / o.seconds;
      text = st.done ? '撤离点已开放，登机撤离' : (inZone ? '坚守 ' + U.fmt(st.remain) : '回到降落圈内才计时 · ' + U.fmt(st.remain));
      bar = progress;
    } else if (o.type === 'survive') {
      progress = (o.seconds - st.remain) / o.seconds;
      text = st.done ? '撤离点已开放，从东口登车' : '撑住 ' + U.fmt(st.remain);
      bar = progress;
    } else if (o.type === 'boss') {
      var boss = null;
      for (var b = 0; b < w.enemies.length; b++) if (w.enemies[b].boss && w.enemies[b].alive) boss = w.enemies[b];
      if (boss) {
        progress = 1 - boss.hp / boss.maxHp;
        bar = progress;
        text = '击杀「铁颚」 · 血量 ' + Math.max(0, Math.round(boss.hp));
        refs.bossHud.classList.remove('is-hidden');
        refs.bossBar.style.width = (100 - progress * 100) + '%';
      } else {
        progress = 1;
        bar = 1;
        text = '撤离点已开放，从南侧升降台撤离';
        refs.bossHud.classList.add('is-hidden');
      }
    }
    refs.objective.textContent = text;
    refs.objBar.style.width = Math.min(100, Math.max(0, bar * 100)) + '%';

    refs.hpBar.style.width = Math.max(0, p.hp / p.maxHp * 100) + '%';
    refs.hpNum.textContent = Math.max(0, Math.round(p.hp));
    refs.armorBar.style.width = Math.max(0, p.armor / Math.max(1, p.maxArmor) * 100) + '%';
    refs.armorNum.textContent = Math.max(0, Math.round(p.armor));
    refs.staminaBar.style.width = Math.max(0, p.stamina / C.PLAYER.stamina * 100) + '%';
    refs.nadeNum.textContent = p.grenades;
    refs.medNum.textContent = p.medkits;

    var wp = p.weapon;
    if (wp) {
      refs.weaponName.textContent = wp.def.name;
      refs.magNum.textContent = wp.mag;
      refs.reserveNum.textContent = wp.reserve;
    }
    var chips = refs.weaponSlots.children;
    for (var c = 0; c < chips.length; c++) {
      var chipWp = p.weapons[c];
      chips[c].className = 'slot-chip' + (c === p.cur ? ' is-active' : '') + (chipWp && chipWp.mag + chipWp.reserve === 0 ? ' is-empty' : '');
    }

    if (w.stats.alerts > 0) {
      refs.stealth.textContent = '交火 · 警报 ' + w.stats.alerts;
      refs.stealth.classList.add('is-combat');
    } else if (w.elapsed > 2) {
      refs.stealth.textContent = '未被发现';
      refs.stealth.classList.remove('is-combat');
    }

    // 提示
    var hint = '';
    if (w.elapsed < 4.5 && w.stats.shots === 0) hint = 'WASD 移动 · 左键射击 · F 处决 · G 手雷';
    else if (w.interact) hint = '按住 E 接入节点';
    else if (w.extractionOpen) hint = '前往撤离点撤离';
    else if (wp && wp.mag === 0 && wp.reserve > 0) hint = 'R 换弹';
    else {
      for (var e = 0; e < w.enemies.length; e++) {
        var en = w.enemies[e];
        if (!en.alive) continue;
        if (U.dist(p.x, p.y, en.x, en.y) < C.PLAYER.takedownRange) {
          hint = en.alerted ? 'F 近战' : 'F 无声处决';
          break;
        }
      }
    }
    if (hint !== UI._hint) {
      refs.hint.textContent = hint;
      refs.hint.style.opacity = hint ? '1' : '0';
      UI._hint = hint;
    }
  };

  UI.tick = function (dt, nowMs) {
    if (!world) return;
    lastHud += dt;
    if (lastHud > 0.1) {
      lastHud = 0;
      UI.refreshHud();
      if (GG.Render && UI.mctx) GG.Render.minimap(world, UI.mctx);
    }
  };

  UI.reset = function () {
    world = null;
    UI._hint = null;
  };
})(typeof window !== 'undefined' ? window : globalThis);
