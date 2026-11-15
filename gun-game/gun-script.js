document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const scoreElement = document.getElementById('score');
    const startBtn = document.getElementById('startBtn');

    // 游戏常量
const PLAYER_SIZE = 30;
const ENEMY_SIZE = 40;
const BULLET_SIZE = 5;
const BASE_PLAYER_SPEED = 5;
const BASE_ENEMY_SPEED = 2;
const BASE_BULLET_SPEED = 10;
const ENEMY_SPAWN_RATE = 1500; // 毫秒
const MAX_ENEMIES = 10;
const BASE_PLAYER_HEALTH = 100;

    // 游戏变量
    let score = 0;
    let gameRunning = false;
    let playRecorded = false;
    let lastTime = 0;
    let lastEnemySpawn = 0;
    let animationId;

    // 24 点局间门禁：每玩满 5 分钟，解出一道 24 点才继续
    let gate = null;
    let gatePaused = false;
    let pcResume = false;

    // 游戏对象
let player = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    width: PLAYER_SIZE,
    height: PLAYER_SIZE,
    color: '#4CAF50',
    velocity: { x: 0, y: 0 },
    health: BASE_PLAYER_HEALTH,
    maxHealth: BASE_PLAYER_HEALTH,
    name: '战士',
    upgrades: {
        speed: 0,
        damage: 0,
        health: 0
    }
};

// 商店相关变量
let storePanel;
let storeOpen = false;
const UPGRADE_COSTS = {
    speed: 50,
    damage: 100,
    health: 150
};
const UPGRADE_BONUSES = {
    speed: 0.2, // 每次升级提升20%
    damage: 0.5, // 每次升级提升50%
    health: 0.3 // 每次升级提升30%
};

    let bullets = [];
    let enemies = [];
    let keys = {};

    // 初始化游戏
    function init() {
        score = 0;
        scoreElement.textContent = score;
        player.x = canvas.width / 2;
        player.y = canvas.height / 2;
        bullets = [];
        enemies = [];
        gameRunning = true;
        playRecorded = false;
        gatePaused = false;
        lastEnemySpawn = Date.now();
        animationId = requestAnimationFrame(gameLoop);
        createGate();
    }

    // 游戏循环
    function gameLoop(timestamp) {
        if (!gameRunning) return;

        // 计算时间差
        const deltaTime = timestamp - lastTime || 0;
        lastTime = timestamp;

        if (gate && deltaTime > 0) {
            gate.tick(Math.min(deltaTime, 1000) / 1000);
        }
        if (gatePaused) return;

        // 清空画布
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 更新游戏状态
        update(deltaTime);

        // 绘制游戏元素
        draw();

        // 继续游戏循环
        animationId = requestAnimationFrame(gameLoop);
    }

    // 24 点门禁：进入游戏时挂一个计时器，到点暂停游戏弹题
    function createGate() {
        if (!window.Gate) return;
        if (gate) {
            gate.destroy();
            gate = null;
        }
        gate = window.Gate.create({
            everyMinutes: 5,
            challenges: ['twenty-four', 'poem'],
            showBadge: true,
            badgePosition: 'bottom-left',
            openOnStart: /[?&]tf24demo=1/.test(location.search),
            kicker: '局间门禁 · 枪战游戏',
            title: '先过一道关卡',
            note: '枪战打了 5 分钟。完成这道题，再回到战场。',
            onLock: function () {
                if (!gameRunning) return;
                gatePaused = true;
                cancelAnimationFrame(animationId);
                keys = {};
            },
            onUnlock: function () {
                if (!gameRunning) return;
                gatePaused = false;
                keys = {};
                if (storeOpen) return; // 商店还开着，关店时再恢复
                lastTime = performance.now();
                animationId = requestAnimationFrame(gameLoop);
            }
        });
    }

    function stopGate() {
        if (gate) {
            gate.destroy();
            gate = null;
        }
        gatePaused = false;
    }

    // 更新游戏状态
    function update(deltaTime) {
        // 移动玩家
        handlePlayerMovement();

        // 生成敌人
        if (Date.now() - lastEnemySpawn > ENEMY_SPAWN_RATE && enemies.length < MAX_ENEMIES) {
            spawnEnemy();
            lastEnemySpawn = Date.now();
        }

        // 更新子弹
        updateBullets();

        // 更新敌人
        updateEnemies();

        // 检测碰撞
        checkCollisions();
    }

    // 处理玩家移动
function handlePlayerMovement() {
    const playerSpeed = BASE_PLAYER_SPEED * (1 + player.upgrades.speed * UPGRADE_BONUSES.speed);
    player.velocity.x = 0;
    player.velocity.y = 0;

    if (keys['KeyW']) player.velocity.y = -playerSpeed;
    if (keys['KeyS']) player.velocity.y = playerSpeed;
    if (keys['KeyA']) player.velocity.x = -playerSpeed;
    if (keys['KeyD']) player.velocity.x = playerSpeed;

        // 更新玩家位置
        player.x += player.velocity.x;
        player.y += player.velocity.y;

        // 边界检测
        player.x = Math.max(player.width / 2, Math.min(canvas.width - player.width / 2, player.x));
        player.y = Math.max(player.height / 2, Math.min(canvas.height - player.height / 2, player.y));
    }

    // 生成敌人
    function spawnEnemy() {
        // 随机选择屏幕边缘生成敌人
        const edge = Math.floor(Math.random() * 4);
        let x, y;

        switch (edge) {
            case 0: // 顶部
                x = Math.random() * canvas.width;
                y = -ENEMY_SIZE;
                break;
            case 1: // 右侧
                x = canvas.width + ENEMY_SIZE;
                y = Math.random() * canvas.height;
                break;
            case 2: // 底部
                x = Math.random() * canvas.width;
                y = canvas.height + ENEMY_SIZE;
                break;
            case 3: // 左侧
                x = -ENEMY_SIZE;
                y = Math.random() * canvas.height;
                break;
        }

        enemies.push({
            x: x,
            y: y,
            width: ENEMY_SIZE,
            height: ENEMY_SIZE,
            color: '#ff4500',
            speed: BASE_ENEMY_SPEED
        });
    }

    // 更新子弹
    function updateBullets() {
        for (let i = bullets.length - 1; i >= 0; i--) {
            const bullet = bullets[i];
            bullet.x += bullet.velocity.x;
            bullet.y += bullet.velocity.y;

            // 移除超出画布的子弹
            if (
                bullet.x < 0 || bullet.x > canvas.width ||
                bullet.y < 0 || bullet.y > canvas.height
            ) {
                bullets.splice(i, 1);
            }
        }
    }

    // 更新敌人
    function updateEnemies() {
        for (let enemy of enemies) {
            // 敌人追踪玩家
            const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
            enemy.x += Math.cos(angle) * enemy.speed;
            enemy.y += Math.sin(angle) * enemy.speed;
        }
    }

    // 检测碰撞
function checkCollisions() {
    // 子弹与敌人碰撞
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];

        for (let j = enemies.length - 1; j >= 0; j--) {
            const enemy = enemies[j];

            if (
                bullet.x < enemy.x + enemy.width &&
                bullet.x + bullet.width > enemy.x &&
                bullet.y < enemy.y + enemy.height &&
                bullet.y + bullet.height > enemy.y
            ) {
                // 移除子弹和敌人
                bullets.splice(i, 1);
                enemies.splice(j, 1);

                // 根据伤害升级增加分数
                const damageMultiplier = 1 + player.upgrades.damage * UPGRADE_BONUSES.damage;
                const pointsGained = Math.floor(10 * damageMultiplier);
                score += pointsGained;
                scoreElement.textContent = score;
                updateStoreUI();
                break;
            }
        }
    }

        // 敌人与玩家碰撞
for (let enemy of enemies) {
    if (
        player.x - player.width/2 < enemy.x + enemy.width/2 &&
        player.x + player.width/2 > enemy.x - enemy.width/2 &&
        player.y - player.height/2 < enemy.y + enemy.height/2 &&
        player.y + player.height/2 > enemy.y - enemy.height/2
    ) {
        // 玩家受到伤害
        player.health -= 20;
        // 应用受伤动画
        applyPlayerDamageAnimation();
        
        if (player.health <= 0) {
            // 游戏结束
            gameOver();
            break;
        }
    }
}
    }

    // 绘制游戏元素
    function draw() {
        // 绘制玩家
        drawPlayer();

        // 绘制子弹
        drawBullets();

        // 绘制敌人
        drawEnemies();
    }

    // 绘制玩家
function drawPlayer() {
    ctx.save();
    ctx.translate(player.x, player.y);

    // 绘制玩家主体
    ctx.fillStyle = player.color;
    ctx.beginPath();
    ctx.arc(0, 0, player.width/2, 0, Math.PI * 2);
    ctx.fill();

    // 绘制玩家方向（面向鼠标）
    const mouseAngle = Math.atan2(mouseY - player.y, mouseX - player.x);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(
        Math.cos(mouseAngle) * player.width,
        Math.sin(mouseAngle) * player.width
    );
    ctx.stroke();

    // 绘制生命值条
    const healthPercent = player.health / player.maxHealth;
    ctx.fillStyle = healthPercent > 0.5 ? '#4CAF50' : healthPercent > 0.2 ? '#ff9800' : '#f44336';
    ctx.fillRect(-player.width/2, -player.height/2 - 10, player.width * healthPercent, 5);
    ctx.strokeStyle = '#333';
    ctx.strokeRect(-player.width/2, -player.height/2 - 10, player.width, 5);

    // 绘制玩家名称
    ctx.fillStyle = '#fff';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(player.name, 0, player.height/2 + 20);

    ctx.restore();
}

    // 绘制子弹
    function drawBullets() {
        ctx.fillStyle = '#ffff00';
        for (let bullet of bullets) {
            ctx.beginPath();
            ctx.arc(bullet.x, bullet.y, BULLET_SIZE, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // 绘制敌人
    function drawEnemies() {
        for (let enemy of enemies) {
            ctx.fillStyle = enemy.color;
            ctx.beginPath();
            ctx.arc(enemy.x, enemy.y, enemy.width/2, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // 游戏结束
    function gameOver() {
        if (!gameRunning) return;
        gameRunning = false;
        stopGate();
        if (!playRecorded && window.GameLimit) {
            playRecorded = true;
            window.GameLimit.count('gun-game');
        }
        cancelAnimationFrame(animationId);

        // 显示游戏结束文字
        ctx.fillStyle = 'red';
        ctx.font = '48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('游戏结束', canvas.width / 2, canvas.height / 2);
        ctx.font = '24px Arial';
        ctx.fillText('点击开始按钮重新开始', canvas.width / 2, canvas.height / 2 + 50);
    }

    // 鼠标位置跟踪
    let mouseX = canvas.width / 2;
    let mouseY = canvas.height / 2;

    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        mouseX = e.clientX - rect.left;
        mouseY = e.clientY - rect.top;
    });

    // 鼠标点击射击
canvas.addEventListener('mousedown', (e) => {
    if (!gameRunning) return;

    // 计算子弹方向
    const angle = Math.atan2(mouseY - player.y, mouseX - player.x);
    const bulletSpeed = BASE_BULLET_SPEED * (1 + player.upgrades.damage * 0.2);

    // 创建子弹
    bullets.push({
        x: player.x,
        y: player.y,
        width: BULLET_SIZE,
        height: BULLET_SIZE,
        velocity: {
            x: Math.cos(angle) * bulletSpeed,
            y: Math.sin(angle) * bulletSpeed
        }
    });

    // 应用射击动画
    applyShootAnimation();
});

    // 键盘控制
window.addEventListener('keydown', (e) => {
    keys[e.code] = true;

    // B键打开商店
    if (e.code === 'KeyB' && gameRunning) {
        toggleStore();
    }
});

window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

    // 开始按钮
startBtn.addEventListener('click', () => {
    if (!gameRunning) {
        init();
    }
});

// 商店相关元素和事件
function initStore() {
    storePanel = document.getElementById('storePanel');
    const storeBtn = document.getElementById('storeBtn');
    const closeStoreBtn = document.getElementById('closeStoreBtn');
    const buyBtns = document.querySelectorAll('.buy-btn');

    // 商店按钮事件
    storeBtn.addEventListener('click', toggleStore);
    closeStoreBtn.addEventListener('click', toggleStore);

    // 购买按钮事件
    buyBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const item = btn.parentElement.dataset.item;
            buyUpgrade(item);
        });
    });
}

// 切换商店显示
function toggleStore() {
    storeOpen = !storeOpen;
    storePanel.style.display = storeOpen ? 'block' : 'none';

    if (storeOpen) {
        // 暂停游戏
        cancelAnimationFrame(animationId);
    } else if (gameRunning) {
        // 恢复游戏
        lastTime = 0;
        animationId = requestAnimationFrame(gameLoop);
    }
}

// 更新商店UI
function updateStoreUI() {
    const storeItems = document.querySelectorAll('.store-item');
    storeItems.forEach(item => {
        const type = item.dataset.item;
        const levelElement = item.querySelector('.level');
        const priceElement = item.querySelector('.price');
        const buyBtn = item.querySelector('.buy-btn');

        // 更新等级
        levelElement.textContent = player.upgrades[type];

        // 计算价格（每次升级价格增加50%）
        const basePrice = UPGRADE_COSTS[type];
        const currentLevel = player.upgrades[type];
        const price = Math.floor(basePrice * Math.pow(1.5, currentLevel));
        priceElement.textContent = price;

        // 启用/禁用购买按钮
        buyBtn.disabled = score < price;
    });
}

// 购买升级
function buyUpgrade(type) {
    const basePrice = UPGRADE_COSTS[type];
    const currentLevel = player.upgrades[type];
    const price = Math.floor(basePrice * Math.pow(1.5, currentLevel));

    if (score >= price) {
        // 扣除分数
        score -= price;
        scoreElement.textContent = score;

        // 应用升级
        player.upgrades[type]++;

        // 根据升级类型更新玩家属性
        switch(type) {
            case 'speed':
                // 速度已在移动函数中应用
                break;
            case 'damage':
                // 伤害已在分数计算中应用
                break;
            case 'health':
                const healthIncrease = player.maxHealth * UPGRADE_BONUSES.health;
                player.maxHealth += healthIncrease;
                player.health = player.maxHealth; // 满血
                break;
        }

        // 更新商店UI
        updateStoreUI();
    }
}

// 应用射击动画
function applyShootAnimation() {
    const playerElement = document.createElement('div');
    // 使用CSS动画类
    player.color = '#FFD700'; // 射击时短暂变色
    setTimeout(() => {
        player.color = '#4CAF50';
    }, 100);
}

// 应用受伤动画
function applyPlayerDamageAnimation() {
    player.color = '#FF4500'; // 受伤时变红
    setTimeout(() => {
        player.color = '#4CAF50';
    }, 300);
}


    // 全站强制休息：暂停战场，休息结束后恢复
    document.addEventListener('playclock:breakstart', () => {
        if (!gameRunning || gatePaused) { pcResume = false; return; }
        pcResume = true;
        gatePaused = true;
        cancelAnimationFrame(animationId);
        keys = {};
    });

    document.addEventListener('playclock:breakend', () => {
        if (!pcResume) return;
        pcResume = false;
        gatePaused = false;
        keys = {};
        if (storeOpen) return;
        lastTime = 0;
        animationId = requestAnimationFrame(gameLoop);
    });

// 初始化商店

initStore();

// 演示用：?tf24demo=1 直接开局并弹出 24 点门禁
if (/[?&]tf24demo=1/.test(location.search)) init();
});