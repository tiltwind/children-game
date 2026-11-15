/* 关卡静态校验：连通性、目标数量、出生点合法性
 * 用法：node tools/validate-levels.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

['util.js', 'config.js', 'map.js'].forEach((f) => {
  vm.runInThisContext(fs.readFileSync(path.join(__dirname, '../js', f), 'utf8'), { filename: f });
});

const C = globalThis.GG.C;
const TILE = C.TILE;
let errors = 0;
const warn = (m) => { console.log('  ✗ ' + m); errors++; };

C.MISSIONS.forEach((m) => {
  const map = globalThis.GG.Map.create(m);
  console.log(`\n[${m.no}] ${m.name}  ${map.w}x${map.h}  主题:${m.theme}`);

  // BFS 可达性
  const seen = new Uint8Array(map.w * map.h);
  const px = Math.floor(map.playerStart.x / TILE);
  const py = Math.floor(map.playerStart.y / TILE);
  const q = [[px, py]];
  seen[py * map.w + px] = 1;
  while (q.length) {
    const [x, y] = q.shift();
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
      const nx = x + dx, ny = y + dy;
      if (!map.inside(nx, ny) || seen[ny * map.w + nx] || !map.walkable(nx, ny)) return;
      seen[ny * map.w + nx] = 1;
      q.push([nx, ny]);
    });
  }
  const reach = (cx, cy, label) => {
    if (!map.walkable(cx, cy)) warn(`${label} 在不可走格 (${cx},${cy})`);
    else if (!seen[cy * map.w + cx]) warn(`${label} 不可达 (${cx},${cy})`);
  };

  if (!map.walkable(px, py)) warn('玩家出生点不可走');
  map.enemySpawns.forEach((e, i) => reach(e.cx, e.cy, `敌人#${i + 1}(${e.type})`));
  map.pickups.forEach((p, i) => reach(p.cx, p.cy, `补给#${i + 1}(${p.type})`));
  map.wavePoints.forEach((p, i) => reach(p.cx, p.cy, `波次点#${i + 1}`));
  map.props.filter((p) => p.type === 'terminal').forEach((p, i) => {
    const around = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
      const nx = p.cx + dx, ny = p.cy + dy;
      return map.walkable(nx, ny) && seen[ny * map.w + nx];
    });
    if (!around) warn(`终端#${i + 1} 四周不可达 (${p.cx},${p.cy})`);
  });
  if (map.extract) {
    const ex = Math.floor((map.extract.x + map.extract.w / 2) / TILE);
    const ey = Math.floor((map.extract.y + map.extract.h / 2) / TILE);
    reach(ex, ey, '撤离点');
  } else warn('缺少撤离点');
  if (map.zone) {
    const zx = Math.floor(map.zone.x / TILE), zy = Math.floor(map.zone.y / TILE);
    if (!map.walkable(zx, zy)) warn('防守圈中心不可走');
  }

  // 目标数量
  const tCount = map.props.filter((p) => p.type === 'terminal').length;
  if (m.objective.type === 'hack' && tCount !== m.objective.count) {
    warn(`骇入目标 ${m.objective.count} 个，地图终端 ${tCount} 个`);
  }
  if (m.objective.type === 'defend' && !map.zone) warn('防守关缺少 zone');
  if (m.objective.type === 'boss' && !map.enemySpawns.some((e) => e.type === 'b')) warn('Boss 关没有 boss');
  const boss = map.enemySpawns.filter((e) => e.type === 'b').length;
  if (boss > 1) warn('Boss 数量 > 1');

  // 波次点索引
  (m.waves || []).forEach((w, i) => {
    if (!map.wavePoints[w.point]) warn(`波次#${i + 1} 指向不存在的出生点 ${w.point}`);
    if (w.at > (m.objective.seconds || 0) + 1 && m.objective.type !== 'survive' && m.objective.type !== 'defend') {
      warn(`波次#${i + 1} 时间 ${w.at}s 超出任务时长`);
    }
  });

  // 敌人类型
  map.enemySpawns.forEach((e) => {
    if (!C.ENEMIES[e.type]) warn(`未知敌人类型 ${e.type}`);
  });

  // 可走面积占比
  let walk = 0;
  for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) if (map.walkable(x, y)) walk++;
  const ratio = (walk / (map.w * map.h) * 100).toFixed(1);
  console.log(`  敌人 ${map.enemySpawns.length} / 补给 ${map.pickups.length} / 终端 ${tCount} / 可走 ${ratio}% / 波次 ${(m.waves || []).length}`);
  if (walk / (map.w * map.h) < 0.18) warn('可走面积过小，动线可能拥挤');
});

// 武器数值检查
Object.values(C.WEAPONS).forEach((w) => {
  const dps = w.auto ? w.dmg * w.pellets / w.interval : w.dmg * w.pellets / w.interval;
  console.log(`武器 ${w.short}: 单发 ${w.dmg}x${w.pellets}，理论 DPS ${dps.toFixed(0)}`);
  if (w.mag <= 0 || w.reserve <= 0) warn(`${w.name} 弹药配置异常`);
});

console.log('\n' + (errors ? `校验失败：${errors} 个问题` : '全部关卡校验通过'));
process.exit(errors ? 1 : 0);
