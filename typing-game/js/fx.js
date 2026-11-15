/* 特效：Canvas 撒花与粒子 */
/* ---------- 撒花 / 粒子 ---------- */
var fxCanvas = els.fx;
var fxCtx = fxCanvas.getContext('2d');
var particles = [];

function sizeFx() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    fxCanvas.width = Math.floor(window.innerWidth * dpr);
    fxCanvas.height = Math.floor(window.innerHeight * dpr);
    fxCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
sizeFx();
window.addEventListener('resize', sizeFx);

function burst(x, y, count, spread, colors) {
    var palette = colors || ['#d9b477', '#f2dcb4', '#7fbfa1', '#e3a95c', '#d4786a'];
    for (var i = 0; i < count; i++) {
        var a = Math.random() * Math.PI * 2;
        var v = 60 + Math.random() * (spread || 180);
        particles.push({
            x: x, y: y,
            vx: Math.cos(a) * v,
            vy: Math.sin(a) * v - 80,
            w: 3 + Math.random() * 4,
            h: 5 + Math.random() * 5,
            rot: Math.random() * Math.PI,
            vr: (Math.random() - 0.5) * 8,
            life: 1.4 + Math.random() * 0.6,
            color: palette[Math.floor(Math.random() * palette.length)]
        });
    }
}

function celebrate() {
    var w = window.innerWidth;
    burst(w * 0.2, 70, 46, 220);
    burst(w * 0.5, 40, 60, 260);
    burst(w * 0.8, 80, 46, 220);
}

function drawFx(dt) {
    if (!particles.length) return;
    fxCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    for (var i = particles.length - 1; i >= 0; i--) {
        var p = particles[i];
        p.vy += 320 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        p.life -= dt;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        fxCtx.save();
        fxCtx.translate(p.x, p.y);
        fxCtx.rotate(p.rot);
        fxCtx.globalAlpha = Math.max(0, Math.min(1, p.life));
        fxCtx.fillStyle = p.color;
        fxCtx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        fxCtx.restore();
    }
    if (!particles.length) fxCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
}
