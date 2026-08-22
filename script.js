const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('scoreDisplay');
const comboDisplay = document.getElementById('comboDisplay');
const comboMultiplierSpan = document.getElementById('comboMultiplier');
const gameOverScreen = document.getElementById('gameOver');
const finalScoreDisplay = document.getElementById('finalScore');
const restartBtn = document.getElementById('restartBtn');

const btnLeft = document.getElementById('btnLeft');
const btnRight = document.getElementById('btnRight');
const btnJump = document.getElementById('btnJump');

let logicalHeight = 800;
let scale = window.innerHeight / logicalHeight;
let logicalWidth = window.innerWidth / scale;

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    scale = window.innerHeight / logicalHeight;
    logicalWidth = window.innerWidth / scale;
});

let keys = { ArrowLeft: false, ArrowRight: false, Space: false };

document.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.ArrowLeft = true;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.ArrowRight = true;
    if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') keys.Space = true;
});

document.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.ArrowLeft = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.ArrowRight = false;
    if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') keys.Space = false;
});

if (btnLeft) {
    btnLeft.addEventListener('touchstart', (e) => { e.preventDefault(); keys.ArrowLeft = true; });
    btnLeft.addEventListener('touchend', (e) => { e.preventDefault(); keys.ArrowLeft = false; });
    btnRight.addEventListener('touchstart', (e) => { e.preventDefault(); keys.ArrowRight = true; });
    btnRight.addEventListener('touchend', (e) => { e.preventDefault(); keys.ArrowRight = false; });
    btnJump.addEventListener('touchstart', (e) => { e.preventDefault(); keys.Space = true; });
    btnJump.addEventListener('touchend', (e) => { e.preventDefault(); keys.Space = false; });
}

let player = {};
let platforms = [];
let particles = [];
let cameraY = 0;
let score = 0;
let gameState = 'start';
let gameSpeed = 1;
let lastPlatformY = 0;
let floorCounter = 0;
let highestFloor = 0;
let combo = 0;
let lastFloorTouched = 0;
let comboTimer = 0;

function initGame() {
    player = {
        x: logicalWidth / 2 - 20,
        y: logicalHeight - 200,
        width: 40,
        height: 40,
        dx: 0,
        dy: 0,
        speed: 0.8,
        maxSpeed: 10,
        friction: 0.85,
        gravity: 0.6,
        jumpStrength: -16,
        onGround: false,
        wasOnGround: false,
        wallJumpTimer: 0,
        facingRight: true,
        scaleX: 1,
        scaleY: 1
    };

    platforms = [];
    particles = [];
    floorCounter = 0;
    
    platforms.push({ x: 0, y: logicalHeight - 60, width: Math.max(logicalWidth, 3000), height: 60, type: 'base', floor: 0 });
    lastPlatformY = logicalHeight - 60;
    generatePlatforms();

    cameraY = 0;
    score = 0;
    highestFloor = 0;
    gameSpeed = 1.0;
    combo = 0;
    lastFloorTouched = 0;
    comboTimer = 0;
    gameState = 'playing';
    
    scoreDisplay.innerText = `Score: ${score}`;
    comboDisplay.classList.add('hidden');
    gameOverScreen.classList.add('hidden');

    requestAnimationFrame(gameLoop);
}

function generatePlatforms() {
    while (lastPlatformY > cameraY - logicalHeight * 2.5) {
        lastPlatformY -= Math.random() * 80 + 100;
        let minWidth = Math.max(120, logicalWidth * 0.15);
        let maxWidth = Math.min(300, logicalWidth * 0.35);
        let width = Math.random() * (maxWidth - minWidth) + minWidth;
        let x = Math.random() * (logicalWidth - width);
        floorCounter++;
        platforms.push({ x: x, y: lastPlatformY, width: width, height: 25, type: 'normal', floor: floorCounter });
    }
}

function updateParticles() {
    if (Math.random() < 0.5) {
        particles.push({
            x: Math.random() * logicalWidth,
            y: cameraY - 20,
            size: Math.random() * 3 + 1,
            speed: Math.random() * 4 + 2,
            drift: Math.random() * 2 - 1
        });
    }
    for (let i = 0; i < particles.length; i++) {
        let p = particles[i];
        p.y += p.speed;
        p.x += p.drift;
    }
    particles = particles.filter(p => p.y < cameraY + logicalHeight + 40);
}

function drawBackground() {
    let progress = Math.min(1, Math.abs(cameraY) / 40000);
    let r1 = Math.floor(0 * (1 - progress) + 15 * progress);
    let g1 = Math.floor(31 * (1 - progress) + 20 * progress);
    let b1 = Math.floor(63 * (1 - progress) + 40 * progress);
    
    let r2 = Math.floor(0 * (1 - progress) + 0 * progress);
    let g2 = Math.floor(116 * (1 - progress) + 40 * progress);
    let b2 = Math.floor(217 * (1 - progress) + 80 * progress);
    
    let grad = ctx.createLinearGradient(0, 0, 0, logicalHeight);
    grad.addColorStop(0, `rgb(${r1}, ${g1}, ${b1})`);
    grad.addColorStop(1, `rgb(${r2}, ${g2}, ${b2})`);
    
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, logicalWidth, logicalHeight);
}

function drawParticles() {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    for (let p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y - cameraY, p.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

function updatePlayer() {
    if (player.wallJumpTimer > 0) {
        player.wallJumpTimer--;
    } else {
        if (keys.ArrowLeft) {
            player.dx -= player.speed;
            player.facingRight = false;
        } else if (keys.ArrowRight) {
            player.dx += player.speed;
            player.facingRight = true;
        }
    }

    player.dx *= player.friction;
    if (player.dx > player.maxSpeed) player.dx = player.maxSpeed;
    if (player.dx < -player.maxSpeed) player.dx = -player.maxSpeed;

    player.dy += player.gravity;
    player.x += player.dx;
    player.y += player.dy;

    if (player.x < 0) {
        player.x = 0;
        if (Math.abs(player.dx) > 3) {
            player.dx = Math.abs(player.dx) * 1.2;
            player.dy = player.jumpStrength * 0.9;
            player.wallJumpTimer = 12;
            player.facingRight = true;
            player.onGround = false;
            player.scaleX = 0.7;
            player.scaleY = 1.3;
        } else {
            player.dx = 0;
        }
    } else if (player.x + player.width > logicalWidth) {
        player.x = logicalWidth - player.width;
        if (Math.abs(player.dx) > 3) {
            player.dx = -Math.abs(player.dx) * 1.2;
            player.dy = player.jumpStrength * 0.9;
            player.wallJumpTimer = 12;
            player.facingRight = false;
            player.onGround = false;
            player.scaleX = 0.7;
            player.scaleY = 1.3;
        } else {
            player.dx = 0;
        }
    }

    if (keys.Space && player.onGround) {
        let jumpBoost = Math.abs(player.dx) * 0.35;
        player.dy = player.jumpStrength - jumpBoost;
        player.onGround = false;
        player.scaleX = 0.8;
        player.scaleY = 1.3;
    }

    player.wasOnGround = player.onGround;
    player.onGround = false;
    for (let i = 0; i < platforms.length; i++) {
        let p = platforms[i];
        if (player.dy >= 0 && player.y + player.height >= p.y && player.y + player.height - player.dy <= p.y + p.height + 10 && player.x + player.width > p.x && player.x < p.x + p.width) {
            player.y = p.y - player.height;
            player.dy = 0;
            player.onGround = true;
            
            if (p.floor > lastFloorTouched) {
                let diff = p.floor - lastFloorTouched;
                if (diff >= 2 && comboTimer > 0) {
                    combo += diff;
                    comboTimer = 120;
                    comboDisplay.classList.remove('hidden');
                    comboMultiplierSpan.innerText = `x${combo}`;
                } else if (diff >= 2) {
                    combo = diff;
                    comboTimer = 120;
                    comboDisplay.classList.remove('hidden');
                    comboMultiplierSpan.innerText = `x${combo}`;
                } else {
                    if (combo > 0) score += combo * combo * 10;
                    combo = 0;
                    comboDisplay.classList.add('hidden');
                }
                
                lastFloorTouched = p.floor;
                if (p.floor > highestFloor) {
                    highestFloor = p.floor;
                    score += 10;
                }
            } else if (p.floor === lastFloorTouched) {
                if (comboTimer <= 0 && combo > 0) {
                    score += combo * combo * 10;
                    combo = 0;
                    comboDisplay.classList.add('hidden');
                }
            }
        }
    }

    if (player.onGround && !player.wasOnGround) {
        player.scaleX = 1.3;
        player.scaleY = 0.7;
    }

    if (player.dy > 1.5) {
        player.scaleX += (0.9 - player.scaleX) * 0.2;
        player.scaleY += (1.1 - player.scaleY) * 0.2;
    } else if (player.dy < -1.5) {
        player.scaleX += (0.8 - player.scaleX) * 0.2;
        player.scaleY += (1.2 - player.scaleY) * 0.2;
    } else {
        player.scaleX += (1 - player.scaleX) * 0.2;
        player.scaleY += (1 - player.scaleY) * 0.2;
    }

    if (comboTimer > 0) {
        comboTimer--;
        if (comboTimer <= 0 && combo > 0) {
            score += combo * combo * 10;
            combo = 0;
            comboDisplay.classList.add('hidden');
        }
    }
    scoreDisplay.innerText = `Score: ${score}`;

    if (player.y < cameraY + logicalHeight * 0.4) {
        cameraY = player.y - logicalHeight * 0.4;
    }

    let targetSpeed = 1.0 + (score * 0.006);
    if (gameSpeed < targetSpeed) {
        gameSpeed += 0.002;
    }
    
    cameraY -= gameSpeed;

    if (player.y > cameraY + logicalHeight) {
        gameState = 'gameover';
    }
}

function drawPlayer() {
    ctx.save();
    let cx = player.x + player.width / 2;
    let cy = player.y - cameraY + player.height;
    
    ctx.translate(cx, cy);
    ctx.scale(player.scaleX, player.scaleY);
    
    ctx.fillStyle = '#ff4757';
    ctx.fillRect(-player.width / 2, -player.height, player.width, player.height);
    
    ctx.fillStyle = '#ffffff';
    let eyeOffsetX = player.facingRight ? 4 : -18;
    ctx.fillRect(eyeOffsetX, -player.height + 10, 14, 10);
    
    ctx.fillStyle = '#2f3542';
    let pupilOffsetX = player.facingRight ? 10 : -16;
    ctx.fillRect(pupilOffsetX, -player.height + 12, 6, 6);

    ctx.fillStyle = '#3742fa';
    ctx.fillRect(-player.width / 2 - 3, -player.height - 5, player.width + 6, 10);
    
    ctx.restore();
}

function drawPlatforms() {
    for (let i = 0; i < platforms.length; i++) {
        let p = platforms[i];
        let py = p.y - cameraY;
        
        if (p.type === 'base') {
            ctx.fillStyle = '#555';
            ctx.fillRect(0, py, logicalWidth, p.height);
        } else {
            ctx.fillStyle = '#8b4513';
            ctx.fillRect(p.x, py + 8, p.width, p.height - 8);
            
            let grad = ctx.createLinearGradient(0, py, 0, py + 10);
            grad.addColorStop(0, '#ffffff');
            grad.addColorStop(1, '#e0f7fa');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.roundRect(p.x - 2, py, p.width + 4, 10, 4);
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            for (let j = 0; j < p.width - 15; j += 20) {
                let length = (Math.sin(p.x + j * 99) * 0.5 + 0.5) * 10 + 6;
                ctx.beginPath();
                ctx.moveTo(p.x + j, py + 9);
                ctx.lineTo(p.x + j + 12, py + 9);
                ctx.lineTo(p.x + j + 6, py + 9 + length);
                ctx.fill();
            }
        }
    }
}

function cleanUpPlatforms() {
    platforms = platforms.filter(p => p.y < cameraY + logicalHeight + 150);
}

function gameLoop() {
    if (gameState === 'gameover') {
        finalScoreDisplay.innerText = score;
        gameOverScreen.classList.remove('hidden');
        return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    ctx.scale(scale, scale);
    
    drawBackground();
    
    updatePlayer();
    updateParticles();
    generatePlatforms();
    cleanUpPlatforms();
    
    drawParticles();
    drawPlatforms();
    drawPlayer();

    ctx.restore();

    requestAnimationFrame(gameLoop);
}

restartBtn.addEventListener('click', initGame);
initGame();
