/* ============================================================
 * test-ai.js —— 敌人 AI 回归测试
 * 用法：node tools/test-ai.js
 *
 * 检查四件事（针对 8 关的全部敌人）：
 *   1. 开局就要知道玩家在哪（全部进入警觉），不能站在原地发呆；
 *   2. 要主动赶来，45 秒内进入交战距离或拿到射击视线；
 *   3. 追击要能绕墙 / 绕拐角，不能顶墙卡死；
 *   4. 移动时身体不能背对玩家（旧版警觉后不转身，看起来像倒着走）。
 * 用固定随机种子跑，结果可复现。
 * ============================================================ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// 固定随机数：Math.random 被 U.rand / U.chance 使用
let seed = 20261126;
Math.random = () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};

['util.js', 'config.js', 'map.js', 'entities.js', 'world.js'].forEach((f) => {
  vm.runInThisContext(fs.readFileSync(path.join(__dirname, '../js', f), 'utf8'), { filename: f });
});

const GG = globalThis.GG;
const C = GG.C;
const TILE = C.TILE;
const DT = 1 / 60;
const DURATION = 45;

let failed = 0;
const fail = (label, msg) => { console.log('  ✗ ' + label + ': ' + msg); failed++; };

C.MISSIONS.forEach((mission) => {
  const world = new GG.World(mission, { upgrades: {} }, { weapons: ['smg'], grenades: 1, medkits: 1 }, C.DIFFICULTY.standard);
  const p = world.player;
  const input = { mx: p.x + 1, my: p.y };
  const track = world.enemies.map((e) => ({
    e, away: 0, last: { x: e.x, y: e.y }, from: GG.U.dist(e.x, e.y, p.x, p.y), closed: 0
  }));
  for (let t = 0; t < DURATION; t += DT) {
    p.hp = p.maxHp = 1e9;              // 测试只看走位，不看成败
    world.update(DT, input, {});
    track.forEach((s) => {
      const e = s.e;
      if (!e.alive) return;
      const dist = GG.U.dist(e.x, e.y, p.x, p.y);
      const moved = GG.U.dist(e.x, e.y, s.last.x, s.last.y);
      s.closed += moved;
      s.last.x = e.x; s.last.y = e.y;
      const off = Math.abs(GG.U.angleDiff(e.angle, Math.atan2(p.y - e.y, p.x - e.x)));
      if (e.alerted && off > Math.PI * 100 / 180 && moved > 0.05) s.away += DT;
    });
  }

  console.log(`\n[${mission.id}] ${mission.name}`);
  track.forEach((s) => {
    const e = s.e;
    if (!e.alive) return;
    const d = GG.U.dist(e.x, e.y, p.x, p.y);
    const canHit = GG.Ent.canSee(e, p, world.map) && d <= e.def.range;
    const tag = `${e.type} ${s.from.toFixed(0)}→${d.toFixed(0)}`;
    if (d > 420 && !canHit) fail(tag, `没有赶来（还差 ${(d / TILE).toFixed(0)} 格）`);
    if (s.away > 2.5) fail(tag, `背对玩家移动 ${s.away.toFixed(1)}s`);
    if (!e.alerted) fail(tag, '始终不知道玩家在哪');
  });
  const alive = track.filter((s) => s.e.alive);
  const near = alive.filter((s) => GG.U.dist(s.e.x, s.e.y, p.x, p.y) <= 420).length;
  console.log(`  抵达 ${near}/${alive.length}，平均距离 ${(alive.reduce((a, s) => a + GG.U.dist(s.e.x, s.e.y, p.x, p.y), 0) / (alive.length || 1)).toFixed(0)}px`);
});

console.log(failed ? `\nAI 回归测试失败：${failed} 项` : '\nAI 回归测试全部通过');
process.exit(failed ? 1 : 0);
