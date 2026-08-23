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

const startMenu = document.getElementById('startMenu');
const startBtn = document.getElementById('startBtn');
const musicToggleBtn = document.getElementById('musicToggleBtn');

const menuMusic = new Audio('audio/main_menu.mp3');
menuMusic.loop = true;
const gameMusic = new Audio('audio/GameMusic.mp3');
gameMusic.loop = true;
let gameMusicEnabled = false;

musicToggleBtn.addEventListener('click', () => {
    gameMusicEnabled = !gameMusicEnabled;
    if (gameMusicEnabled) {
        musicToggleBtn.innerText = 'Music: ON';
        musicToggleBtn.classList.add('on');
        if (gameState === 'playing') gameMusic.play();
    } else {
        musicToggleBtn.innerText = 'Music: OFF';
        musicToggleBtn.classList.remove('on');
        gameMusic.pause();
    }
});

function attemptPlayMenuMusic() {
    if (gameState === 'start' && menuMusic.paused) {
        menuMusic.play().catch(e => console.log('Autoplay blocked'));
    }
}
document.addEventListener('click', attemptPlayMenuMusic, { once: true });
document.addEventListener('keydown', attemptPlayMenuMusic, { once: true });

let logicalHeight = 800;
let scale = 1;
let logicalWidth = 800;

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    let targetLogicalHeight = 800;
    scale = window.innerHeight / targetLogicalHeight;
    logicalWidth = window.innerWidth / scale;
    logicalHeight = targetLogicalHeight;

    if (logicalWidth > 900) {
        logicalWidth = 900;
        scale = window.innerWidth / logicalWidth;
        logicalHeight = window.innerHeight / scale;
    }
}
window.addEventListener('resize', resize);
resize();

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
    menuMusic.pause();
    menuMusic.currentTime = 0;
    if (gameMusicEnabled) {
        gameMusic.play();
    }

    startMenu.classList.add('hidden');
    scoreDisplay.classList.remove('hidden');
    musicToggleBtn.classList.remove('hidden');

    player = {
        x: logicalWidth / 2 - 15,
        y: logicalHeight - 200,
        width: 30,
        height: 40,
        dx: 0,
        dy: 0,
        speed: 0.25,
        maxSpeed: 8,
        gravity: 0.4,
        jumpStrength: -11.5,
        onGround: false,
        wasOnGround: false,
        wallJumpTimer: 0,
        facingRight: true,
        scaleX: 1,
        scaleY: 1,
        animTimer: 0
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
        lastPlatformY -= Math.random() * 30 + 70;
        let minWidth = Math.max(150, logicalWidth * 0.2);
        let maxWidth = Math.min(320, logicalWidth * 0.4);
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

let bgPattern = null;
function createBackgroundPattern() {
    let patCanvas = document.createElement('canvas');
    patCanvas.width = 120;
    patCanvas.height = 120;
    let pCtx = patCanvas.getContext('2d');
    pCtx.fillStyle = '#111827';
    pCtx.fillRect(0, 0, 120, 120);
    pCtx.strokeStyle = '#1f2937';
    pCtx.lineWidth = 3;
    for(let y=0; y<120; y+=30) {
        pCtx.beginPath(); pCtx.moveTo(0, y); pCtx.lineTo(120, y); pCtx.stroke();
        let offset = (y % 60 === 0) ? 0 : 30;
        for(let x=0; x<=120; x+=60) {
            pCtx.beginPath(); pCtx.moveTo(x + offset, y); pCtx.lineTo(x + offset, y + 30); pCtx.stroke();
        }
    }
    return patCanvas;
}

function drawBackground() {
    if (!bgPattern) {
        let patCanvas = createBackgroundPattern();
        bgPattern = ctx.createPattern(patCanvas, 'repeat');
    }
    ctx.save();
    let offsetY = -(cameraY * 0.5 % 120);
    ctx.translate(0, offsetY);
    ctx.fillStyle = bgPattern;
    ctx.fillRect(0, -120, logicalWidth, logicalHeight + 240);
    ctx.restore();
    let grad = ctx.createLinearGradient(0, 0, 0, logicalHeight);
    grad.addColorStop(0, 'rgba(10, 25, 50, 0.6)');
    grad.addColorStop(1, 'rgba(25, 50, 90, 0.4)');
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
    let isMoving = keys.ArrowLeft || keys.ArrowRight;
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

    if (player.onGround) {
        if (isMoving) {
            player.dx *= 0.97;
        } else {
            player.dx *= 0.92;
        }
    } else {
        player.dx *= 0.99;
    }

    if (player.dx > player.maxSpeed) player.dx = player.maxSpeed;
    if (player.dx < -player.maxSpeed) player.dx = -player.maxSpeed;

    player.dy += player.gravity;
    player.x += player.dx;
    player.y += player.dy;

    if (player.x < 0) {
        player.x = 0;
        if (Math.abs(player.dx) > 3 && !player.onGround) {
            player.dx = Math.abs(player.dx) * 0.9;
            player.wallJumpTimer = 10;
            player.facingRight = true;
            player.scaleX = 0.7;
            player.scaleY = 1.3;
        } else {
            player.dx = 0;
        }
    } else if (player.x + player.width > logicalWidth) {
        player.x = logicalWidth - player.width;
        if (Math.abs(player.dx) > 3 && !player.onGround) {
            player.dx = -Math.abs(player.dx) * 0.9;
            player.wallJumpTimer = 10;
            player.facingRight = false;
            player.scaleX = 0.7;
            player.scaleY = 1.3;
        } else {
            player.dx = 0;
        }
    }

    if (keys.Space && player.onGround) {
        let jumpBoost = Math.abs(player.dx) * 0.75;
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

    if (player.y < cameraY + logicalHeight * 0.35) {
        cameraY = player.y - logicalHeight * 0.35;
    }

    let targetSpeed = 1.0 + (score * 0.0015);
    if (gameSpeed < targetSpeed) {
        gameSpeed += 0.001;
    }
    
    cameraY -= gameSpeed;

    if (player.y > cameraY + logicalHeight) {
        gameState = 'gameover';
    }
}

let playerSprite = new Image();
playerSprite.src = 'player.png';
let spriteFrameW = 0;
let spriteFrameH = 0;
playerSprite.onload = function() {
    spriteFrameW = playerSprite.naturalWidth / 5;
    spriteFrameH = playerSprite.naturalHeight;
};

function drawPlayer() {
    if (!spriteFrameW) return;
    ctx.save();
    let cx = player.x + player.width / 2;
    let cy = player.y - cameraY + player.height;
    
    ctx.translate(cx, cy);
    if (!player.facingRight) {
        ctx.scale(-1, 1);
    }
    
    let speedAbs = Math.abs(player.dx);
    player.animTimer = (player.animTimer || 0) + speedAbs * 0.15;
    if (!player.onGround) {
        player.animTimer = 0;
    }
    
    let frameIndex = 0;
    if (!player.onGround) {
        if (player.dy < 0) {
            frameIndex = 3;
        } else {
            frameIndex = 4;
        }
    } else if (speedAbs > 0.5) {
        frameIndex = 1 + (Math.floor(player.animTimer) % 2);
    }
    
    let drawH = player.height * 2.5;
    let drawW = drawH * (spriteFrameW / spriteFrameH);
    let scaledW = drawW * player.scaleX;
    let scaledH = drawH * player.scaleY;
    ctx.drawImage(playerSprite, frameIndex * spriteFrameW, 0, spriteFrameW, spriteFrameH, -scaledW / 2, -scaledH, scaledW, scaledH);
    
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
startBtn.addEventListener('click', initGame);

gameState = 'start';
ctx.save();
ctx.scale(scale, scale);
drawBackground();
ctx.restore();
attemptPlayMenuMusic();
