const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('scoreDisplay');
const floorDisplay = document.getElementById('floorDisplay');
const comboDisplay = document.getElementById('comboDisplay');
const comboMultiplierSpan = document.getElementById('comboMultiplier');
const gameOverScreen = document.getElementById('gameOver');
const finalScoreDisplay = document.getElementById('finalScore');
const finalFloorDisplay = document.getElementById('finalFloor');
const finalComboDisplay = document.getElementById('finalCombo');
const restartBtn = document.getElementById('restartBtn');
const screenFlash = document.getElementById('screenFlash');

const startMenu = document.getElementById('startMenu');
const startBtn = document.getElementById('startBtn');
const musicToggleBtn = document.getElementById('musicToggleBtn');


const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playTone(freq, dur, type, vol, detune) {
    const g = audioCtx.createGain();
    const o = audioCtx.createOscillator();
    o.type = type || 'square';
    o.frequency.value = freq;
    if (detune) o.detune.value = detune;
    g.gain.setValueAtTime(vol || 0.15, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + dur);
}

function sfxJump() {
    playTone(300, 0.15, 'square', 0.12);
    playTone(500, 0.12, 'square', 0.08);
    setTimeout(() => playTone(700, 0.1, 'sine', 0.06), 40);
}

function sfxLand() {
    playTone(120, 0.08, 'triangle', 0.15);
    playTone(80, 0.12, 'sawtooth', 0.06);
}

function sfxWallBounce() {
    playTone(200, 0.1, 'sawtooth', 0.1);
    playTone(350, 0.08, 'square', 0.08);
}

function sfxCombo(level) {
    const base = 400 + level * 80;
    playTone(base, 0.2, 'square', 0.12);
    setTimeout(() => playTone(base * 1.25, 0.15, 'square', 0.1), 60);
    setTimeout(() => playTone(base * 1.5, 0.12, 'sine', 0.08), 120);
    if (level >= 5) setTimeout(() => playTone(base * 2, 0.2, 'sine', 0.1), 180);
}

function sfxGameOver() {
    [400,350,300,200,150].forEach((f,i) => {
        setTimeout(() => playTone(f, 0.25, 'square', 0.12 - i*0.015), i * 120);
    });
    setTimeout(() => playTone(80, 0.6, 'sawtooth', 0.1), 600);
}

function sfxStep() {
    playTone(100 + Math.random()*40, 0.04, 'triangle', 0.03);
}


const menuMusic = new Audio('audio/main_menu.mp3');
menuMusic.loop = true;
const gameMusic = new Audio('audio/GameMusic.mp3');
gameMusic.loop = true;
let gameMusicEnabled = false;

musicToggleBtn.addEventListener('click', () => {
    gameMusicEnabled = !gameMusicEnabled;
    musicToggleBtn.innerText = gameMusicEnabled ? 'Music: ON' : 'Music: OFF';
    gameMusicEnabled ? musicToggleBtn.classList.add('on') : musicToggleBtn.classList.remove('on');
    if (gameMusicEnabled && gameState === 'playing') gameMusic.play();
    else gameMusic.pause();
});

let gameState = 'start';

function attemptPlayMenuMusic() {
    audioCtx.resume();
    if (gameState === 'start' && menuMusic.paused) menuMusic.play().catch(() => {});
}
document.addEventListener('click', attemptPlayMenuMusic, { once: true });
document.addEventListener('keydown', attemptPlayMenuMusic, { once: true });


let bgPattern = null;
let logicalHeight = 800, scale = 1, logicalWidth = 800;
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    let tH = 800;
    scale = window.innerHeight / tH;
    logicalWidth = window.innerWidth / scale;
    logicalHeight = tH;
    if (logicalWidth > 900) { logicalWidth = 900; scale = window.innerWidth / logicalWidth; logicalHeight = window.innerHeight / scale; }
    bgPattern = null;
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

let tiltEnabled = false;
const TILT_THRESHOLD = 8; 

function enableTiltControls() {
    if (tiltEnabled) return;
    tiltEnabled = true;


    window.addEventListener('deviceorientation', (e) => {
        if (gameState !== 'playing') return;
        const gamma = e.gamma || 0; 
        if (gamma < -TILT_THRESHOLD) {
            keys.ArrowLeft = true;
            keys.ArrowRight = false;
        } else if (gamma > TILT_THRESHOLD) {
            keys.ArrowRight = true;
            keys.ArrowLeft = false;
        } else {
            keys.ArrowLeft = false;
            keys.ArrowRight = false;
        }
    });

    
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        keys.Space = true;
    });
    canvas.addEventListener('touchend', (e) => {
        e.preventDefault();
        keys.Space = false;
    });
}


function requestTilt() {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission().then(state => {
            if (state === 'granted') enableTiltControls();
        }).catch(() => {});
    } else if ('DeviceOrientationEvent' in window) {
        enableTiltControls();
    }
}




let player = {}, platforms = [], particles = [], fxParticles = [];
let cameraY = 0, score = 0, gameSpeed = 1;
let lastPlatformY = 0, floorCounter = 0, highestFloor = 0;
let combo = 0, bestCombo = 0, lastFloorTouched = 0, comboTimer = 0;
let shakeX = 0, shakeY = 0, shakeMag = 0;
let stepTimer = 0;


function triggerScreenFlash(color) {
    screenFlash.style.background = color;
    screenFlash.style.opacity = '0.3';
    setTimeout(() => screenFlash.style.opacity = '0', 80);
}

function spawnComboPopup(text, level) {
    const el = document.createElement('div');
    el.className = 'combo-popup' + (level >= 12 ? ' ultra' : level >= 6 ? ' mega' : '');
    el.textContent = text;
    el.style.left = '50%';
    el.style.top = '40%';
    document.getElementById('ui').appendChild(el);
    setTimeout(() => el.remove(), 1300);
}

function addFxParticles(x, y, count, color, speed, life) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spd = Math.random() * speed + speed * 0.3;
        fxParticles.push({
            x, y, dx: Math.cos(angle) * spd, dy: Math.sin(angle) * spd - 1,
            life: life || 30, maxLife: life || 30,
            size: Math.random() * 3 + 1.5, color
        });
    }
}

function addTrailParticle() {
    if (Math.abs(player.dx) < 1 && player.onGround) return;
    const c = combo >= 12 ? '#ff00ff' : combo >= 6 ? '#ff4444' : combo > 0 ? '#ffdc00' : '#7fdbff';
    fxParticles.push({
        x: player.x + player.width/2 + (Math.random()-0.5)*8,
        y: player.y + player.height,
        dx: -player.dx * 0.1, dy: 0.3,
        life: 15, maxLife: 15, size: Math.random()*2+1, color: c
    });
}

function updateFxParticles() {
    for (let p of fxParticles) { p.x += p.dx; p.y += p.dy; p.dy += 0.08; p.life--; }
    fxParticles = fxParticles.filter(p => p.life > 0);
}

function drawFxParticles() {
    for (let p of fxParticles) {
        const a = p.life / p.maxLife;
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y - cameraY, p.size * a, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}


function initGame() {
    menuMusic.pause(); menuMusic.currentTime = 0;
    if (gameMusicEnabled) gameMusic.play();
    audioCtx.resume();
    requestTilt();

    startMenu.classList.add('hidden');
    scoreDisplay.classList.remove('hidden');
    floorDisplay.classList.remove('hidden');
    musicToggleBtn.classList.remove('hidden');

    player = {
        x: logicalWidth/2-15, y: logicalHeight-200, width: 30, height: 40,
        dx: 0, dy: 0, speed: 0.35, maxSpeed: 8, gravity: 0.5,
        jumpStrength: -12, onGround: false, wasOnGround: false,
        wallJumpTimer: 0, facingRight: true, scaleX: 1, scaleY: 1, animTimer: 0
    };

    platforms = []; particles = []; fxParticles = [];
    floorCounter = 0; bestCombo = 0; stepTimer = 0;
    platforms.push({ x: 0, y: logicalHeight-60, width: Math.max(logicalWidth,3000), height: 60, type: 'base', floor: 0 });
    lastPlatformY = logicalHeight - 60;
    generatePlatforms();

    cameraY = 0; score = 0; highestFloor = 0; gameSpeed = 1.5;
    combo = 0; lastFloorTouched = 0; comboTimer = 0;
    shakeX = 0; shakeY = 0; shakeMag = 0;
    lastTime = 0; accumulator = 0;
    gameState = 'playing';
    scoreDisplay.innerText = 'Score: 0';
    floorDisplay.innerText = 'Floor: 0';
    comboDisplay.classList.add('hidden');
    comboDisplay.className = comboDisplay.className.replace(/mega|ultra/g, '').trim();
    gameOverScreen.classList.add('hidden');
    requestAnimationFrame(gameLoop);
}

function generatePlatforms() {
    while (lastPlatformY > cameraY - logicalHeight * 2.5) {
        let gap = Math.random() * 30 + 70;
        if (floorCounter > 30) gap += Math.min((floorCounter - 30) * 0.5, 25);
        lastPlatformY -= gap;
        let shrink = Math.min(floorCounter * 0.8, 60);
        let minW = Math.max(100, logicalWidth*0.18 - shrink), maxW = Math.min(280 - shrink, logicalWidth*0.35);
        if (maxW < minW) maxW = minW + 20;
        let w = Math.random()*(maxW-minW)+minW;
        let x = Math.random()*(logicalWidth-w);
        floorCounter++;
        platforms.push({ x, y: lastPlatformY, width: w, height: 25, type: 'normal', floor: floorCounter });
    }
}


function updateParticles() {
    if (Math.random() < 0.5) {
        particles.push({ x: Math.random()*logicalWidth, y: cameraY-20, size: Math.random()*3+1, speed: Math.random()*4+2, drift: Math.random()*2-1 });
    }
    for (let p of particles) { p.y += p.speed; p.x += p.drift; }
    particles = particles.filter(p => p.y < cameraY + logicalHeight + 40);
}



function createBackgroundPattern() {
    let c = document.createElement('canvas'); c.width=120; c.height=120;
    let p = c.getContext('2d');
    p.fillStyle = '#111827'; p.fillRect(0,0,120,120);
    p.strokeStyle = '#1f2937'; p.lineWidth = 3;
    for (let y=0;y<120;y+=30) {
        p.beginPath(); p.moveTo(0,y); p.lineTo(120,y); p.stroke();
        let off = (y%60===0)?0:30;
        for (let x=0;x<=120;x+=60) { p.beginPath(); p.moveTo(x+off,y); p.lineTo(x+off,y+30); p.stroke(); }
    }
    return c;
}

function drawBackground() {
    if (!bgPattern) bgPattern = ctx.createPattern(createBackgroundPattern(), 'repeat');
    ctx.save();
    ctx.translate(0, -(cameraY*0.5%120));
    ctx.fillStyle = bgPattern;
    ctx.fillRect(0,-120,logicalWidth,logicalHeight+240);
    ctx.restore();

    
    let hue = 210 + Math.sin(-cameraY*0.001)*30;
    let comboGlow = Math.min(combo * 3, 40);
    let grad = ctx.createLinearGradient(0,0,0,logicalHeight);
    grad.addColorStop(0, `hsla(${hue}, 60%, ${8+comboGlow}%, 0.6)`);
    grad.addColorStop(1, `hsla(${hue+30}, 50%, ${15+comboGlow/2}%, 0.4)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0,0,logicalWidth,logicalHeight);
}

function drawParticles() {
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (let p of particles) { ctx.beginPath(); ctx.arc(p.x, p.y-cameraY, p.size, 0, Math.PI*2); ctx.fill(); }
}


function updatePlayer() {
    let isMoving = keys.ArrowLeft || keys.ArrowRight;
    if (player.wallJumpTimer > 0) player.wallJumpTimer--;
    else {
        if (keys.ArrowLeft) { player.dx -= player.speed; player.facingRight = false; }
        else if (keys.ArrowRight) { player.dx += player.speed; player.facingRight = true; }
    }

    player.dx *= player.onGround ? (isMoving ? 0.97 : 0.92) : 0.99;
    if (player.dx > player.maxSpeed) player.dx = player.maxSpeed;
    if (player.dx < -player.maxSpeed) player.dx = -player.maxSpeed;

    player.dy += player.gravity;
    player.x += player.dx;
    player.y += player.dy;

    
    if (player.onGround && Math.abs(player.dx) > 2) {
        stepTimer++;
        if (stepTimer % 8 === 0) sfxStep();
    }

    
    if (player.x < 0) {
        player.x = 0;
        if (Math.abs(player.dx) > 3 && !player.onGround) {
            player.dx = Math.abs(player.dx)*0.9; player.wallJumpTimer = 10;
            player.facingRight = true; player.scaleX = 0.7; player.scaleY = 1.3;
            sfxWallBounce();
            addFxParticles(5, player.y+player.height/2, 6, '#7fdbff', 3, 20);
            shakeMag = 3;
        } else player.dx = 0;
    } else if (player.x + player.width > logicalWidth) {
        player.x = logicalWidth - player.width;
        if (Math.abs(player.dx) > 3 && !player.onGround) {
            player.dx = -Math.abs(player.dx)*0.9; player.wallJumpTimer = 10;
            player.facingRight = false; player.scaleX = 0.7; player.scaleY = 1.3;
            sfxWallBounce();
            addFxParticles(logicalWidth-5, player.y+player.height/2, 6, '#7fdbff', 3, 20);
            shakeMag = 3;
        } else player.dx = 0;
    }

    
    if (keys.Space && player.onGround) {
        let jumpBoost = Math.abs(player.dx) * 0.75;
        player.dy = player.jumpStrength - jumpBoost;
        player.onGround = false;
        player.scaleX = 0.8; player.scaleY = 1.3;
        sfxJump();
        addFxParticles(player.x+player.width/2, player.y+player.height, 8, '#ffffff', 2.5, 18);
    }

    
    player.wasOnGround = player.onGround;
    player.onGround = false;
    for (let p of platforms) {
        if (player.dy >= 0 && player.y+player.height >= p.y && player.y+player.height-player.dy <= p.y+p.height+10 && player.x+player.width > p.x && player.x < p.x+p.width) {
            player.y = p.y - player.height;
            player.dy = 0;
            player.onGround = true;

            if (p.floor > lastFloorTouched) {
                let diff = p.floor - lastFloorTouched;
                if (diff >= 3 && comboTimer > 0) {
                    combo += diff; comboTimer = 80;
                } else if (diff >= 3) {
                    combo = diff; comboTimer = 80;
                } else {
                    if (combo > 0) { score += combo*combo*10; if(combo>bestCombo)bestCombo=combo; }
                    combo = 0;
                }

                if (combo > 0) {
                    comboDisplay.classList.remove('hidden');
                    comboMultiplierSpan.innerText = `x${combo}`;
                    comboDisplay.classList.remove('mega','ultra');
                    if (combo >= 12) comboDisplay.classList.add('ultra');
                    else if (combo >= 6) comboDisplay.classList.add('mega');

                    sfxCombo(combo);
                    let comboColor = combo>=12?'#ff00ff':combo>=6?'#ff4444':'#ffdc00';
                    triggerScreenFlash(comboColor);
                    addFxParticles(player.x+player.width/2, player.y, 10+combo, comboColor, 3+combo*0.3, 30);
                    shakeMag = Math.min(combo * 1.5, 12);

                    let label = combo>=12?'ULTRA x'+combo:combo>=6?'MEGA x'+combo:'COMBO x'+combo;
                    spawnComboPopup(label, combo);
                } else {
                    comboDisplay.classList.add('hidden');
                }

                lastFloorTouched = p.floor;
                if (p.floor > highestFloor) { highestFloor = p.floor; score += 10; }
            } else if (p.floor === lastFloorTouched) {
                if (comboTimer <= 0 && combo > 0) {
                    score += combo*combo*10; if(combo>bestCombo)bestCombo=combo;
                    combo = 0; comboDisplay.classList.add('hidden');
                }
            }
        }
    }

    
    if (player.onGround && !player.wasOnGround) {
        player.scaleX = 1.3; player.scaleY = 0.7;
        sfxLand();
        addFxParticles(player.x+player.width/2, player.y+player.height, 5, '#aaddff', 2, 15);
    }

    
    if (player.dy > 1.5) { player.scaleX += (0.9-player.scaleX)*0.2; player.scaleY += (1.1-player.scaleY)*0.2; }
    else if (player.dy < -1.5) { player.scaleX += (0.8-player.scaleX)*0.2; player.scaleY += (1.2-player.scaleY)*0.2; }
    else { player.scaleX += (1-player.scaleX)*0.2; player.scaleY += (1-player.scaleY)*0.2; }

    
    if (Math.abs(player.dx) > 3 || !player.onGround) addTrailParticle();

    
    if (comboTimer > 0) {
        comboTimer--;
        if (comboTimer <= 0 && combo > 0) {
            score += combo*combo*10; if(combo>bestCombo)bestCombo=combo;
            combo = 0; comboDisplay.classList.add('hidden');
        }
    }

    scoreDisplay.innerText = `Score: ${score}`;
    floorDisplay.innerText = `Floor: ${highestFloor}`;

    
    if (player.y < cameraY + logicalHeight*0.35) cameraY = player.y - logicalHeight*0.35;
    let targetSpeed = 1.5 + score*0.003;
    if (gameSpeed < targetSpeed) gameSpeed += 0.002;
    cameraY -= gameSpeed;

    
    if (shakeMag > 0) {
        shakeX = (Math.random()-0.5)*shakeMag*2;
        shakeY = (Math.random()-0.5)*shakeMag*2;
        shakeMag *= 0.85;
        if (shakeMag < 0.3) { shakeMag = 0; shakeX = 0; shakeY = 0; }
    }

    
    if (player.y > cameraY + logicalHeight) {
        gameState = 'gameover';
        sfxGameOver();
        gameMusic.pause();
    }
}


let playerSprite = new Image();
playerSprite.src = 'player.png';
let spriteFrameW = 0, spriteFrameH = 0;
playerSprite.onload = function() { spriteFrameW = playerSprite.naturalWidth/5; spriteFrameH = playerSprite.naturalHeight; };

function drawPlayer() {
    if (!spriteFrameW) return;
    ctx.save();
    let cx = player.x+player.width/2, cy = player.y-cameraY+player.height;
    ctx.translate(cx, cy);
    if (!player.facingRight) ctx.scale(-1,1);

    let speedAbs = Math.abs(player.dx);
    player.animTimer = (player.animTimer||0) + speedAbs*0.15;
    if (!player.onGround) player.animTimer = 0;

    let fi = 0;
    if (!player.onGround) fi = player.dy < 0 ? 3 : 4;
    else if (speedAbs > 0.5) fi = 1 + (Math.floor(player.animTimer) % 2);

    let drawH = player.height*2.5, drawW = drawH*(spriteFrameW/spriteFrameH);
    let sW = drawW*player.scaleX, sH = drawH*player.scaleY;
    ctx.drawImage(playerSprite, fi*spriteFrameW, 0, spriteFrameW, spriteFrameH, -sW/2, -sH, sW, sH);
    ctx.restore();
}


function drawPlatforms() {
    for (let p of platforms) {
        let py = p.y - cameraY;
        if (py > logicalHeight + 50 || py < -100) continue;

        if (p.type === 'base') {
            ctx.fillStyle = '#555';
            ctx.fillRect(0, py, logicalWidth, p.height);
        } else {
            
            ctx.fillStyle = '#8b4513';
            ctx.fillRect(p.x, py+8, p.width, p.height-8);

            
            let glow = combo > 0 ? Math.min(combo*2, 20) : 0;
            if (glow > 0) {
                ctx.shadowColor = combo>=12?'#ff00ff':combo>=6?'#ff4444':'#ffdc00';
                ctx.shadowBlur = glow;
            }
            let grad = ctx.createLinearGradient(0, py, 0, py+10);
            grad.addColorStop(0, '#ffffff');
            grad.addColorStop(1, '#e0f7fa');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.roundRect(p.x-2, py, p.width+4, 10, 4);
            ctx.fill();
            ctx.shadowBlur = 0;

            
            ctx.fillStyle = '#ffffff';
            for (let j = 0; j < p.width-15; j += 20) {
                let len = (Math.sin(p.x+j*99)*0.5+0.5)*10+6;
                ctx.beginPath();
                ctx.moveTo(p.x+j, py+9);
                ctx.lineTo(p.x+j+12, py+9);
                ctx.lineTo(p.x+j+6, py+9+len);
                ctx.fill();
            }

            
            if (p.floor % 5 === 0 && p.floor > 0) {
                ctx.fillStyle = 'rgba(255,255,255,0.4)';
                ctx.font = '10px Orbitron, monospace';
                ctx.textAlign = 'center';
                ctx.fillText(p.floor, p.x+p.width/2, py+20);
            }
        }
    }
}

function cleanUpPlatforms() {
    platforms = platforms.filter(p => p.y < cameraY + logicalHeight + 150);
}


const TICK_RATE = 1000 / 60;
let lastTime = 0;
let accumulator = 0;

function fixedUpdate() {
    updatePlayer();
    updateParticles();
    updateFxParticles();
    generatePlatforms();
    cleanUpPlatforms();
}

function gameLoop(timestamp) {
    if (gameState === 'gameover') {
        finalScoreDisplay.innerText = score;
        finalFloorDisplay.innerText = highestFloor;
        finalComboDisplay.innerText = bestCombo;
        gameOverScreen.classList.remove('hidden');
        triggerScreenFlash('#ff0000');
        return;
    }

    if (!lastTime) lastTime = timestamp;
    let delta = timestamp - lastTime;
    lastTime = timestamp;
    if (delta > 100) delta = 100;
    accumulator += delta;

    while (accumulator >= TICK_RATE) {
        fixedUpdate();
        accumulator -= TICK_RATE;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(scale, scale);
    ctx.translate(shakeX, shakeY);

    drawBackground();
    drawParticles();
    drawPlatforms();
    drawFxParticles();
    drawPlayer();

    ctx.restore();
    requestAnimationFrame(gameLoop);
}

restartBtn.addEventListener('click', initGame);
startBtn.addEventListener('click', initGame);

gameState = 'start';
ctx.save(); ctx.scale(scale, scale); drawBackground(); ctx.restore();
attemptPlayMenuMusic();
