// ---------- DOM ----------
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const menu = document.getElementById('menu');
const levelSelect = document.getElementById('level-select');
const gameDiv = document.getElementById('game');
const gameoverDiv = document.getElementById('gameover');
const livesDisplay = document.getElementById('lives-display');
const scoreDisplay = document.getElementById('score-display');
const totalDisplay = document.getElementById('total-display');
const levelDisplay = document.getElementById('level-display');
const finalScore = document.getElementById('final-score');
const startBtn = document.getElementById('start-btn');
const levelsBtn = document.getElementById('levels-btn');
const backMenuBtn = document.getElementById('back-menu-btn');
const restartBtn = document.getElementById('restart-btn');
const toMenuBtn = document.getElementById('to-menu-btn');
const musicToggle = document.getElementById('music-toggle');

// ---------- Константы ----------
const W = 800, H = 900;
const MOVE_SPEED = 7.5; // Быстрее
const ACCEL = 0.8;      // Более отзывчивое ускорение
let FRICTION = 0.85;

// ---------- Состояние ----------
let lives = 3;
let score = 0;
let level = 1;
let gameActive = false;
let animationId = null;
let cameraX = 0;
let gravity = 0.6;

// СОХРАНЕНИЕ: получаем максимальный открытый уровень (по умолчанию 1)
let maxUnlockedLevel = parseInt(localStorage.getItem('chickenMaxLevel')) || 1;

let chicken = { x: 100, y: 700, vx: 0, vy: 0, w: 50, h: 60, onGround: false, facing: 1, walkTimer: 0 };
let platforms = [];
let spikes = [];
let corns = [];
let springs = [];
let flag = { x: 2000, y: 700, w: 40, h: 100 };
let currentBg = ['#4a2c1a', '#8b5a2b', '#d4a373'];

let keys = { left: false, right: false, jump: false };

// ---------- АУДИО ----------
let audioCtx = null;
let musicInterval = null;
let isMusicPlaying = true;

function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playSound(type) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;

    if (type === 'jump') {
        osc.type = 'square'; osc.frequency.setValueAtTime(300, now); osc.frequency.exponentialRampToValueAtTime(600, now + 0.1);
        gain.gain.setValueAtTime(0.1, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.start(); osc.stop(now + 0.15);
    } else if (type === 'collect') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(800, now); osc.frequency.setValueAtTime(1200, now + 0.05);
        gain.gain.setValueAtTime(0.1, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(); osc.stop(now + 0.2);
    } else if (type === 'death') {
        osc.type = 'sawtooth'; osc.frequency.setValueAtTime(400, now); osc.frequency.exponentialRampToValueAtTime(100, now + 0.4);
        gain.gain.setValueAtTime(0.2, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        osc.start(); osc.stop(now + 0.4);
    } else if (type === 'spring') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(200, now); osc.frequency.exponentialRampToValueAtTime(800, now + 0.2);
        gain.gain.setValueAtTime(0.15, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(); osc.stop(now + 0.3);
    } else if (type === 'win') {
        const notes = [400, 500, 600, 800];
        notes.forEach((freq, i) => {
            const o = audioCtx.createOscillator(), g = audioCtx.createGain();
            o.connect(g); g.connect(audioCtx.destination);
            o.type = 'triangle'; o.frequency.value = freq;
            g.gain.setValueAtTime(0.1, now + i*0.1);
            g.gain.exponentialRampToValueAtTime(0.01, now + i*0.1 + 0.2);
            o.start(now + i*0.1); o.stop(now + i*0.1 + 0.2);
        });
    }
}

function startMusic(lvl) {
    if (!isMusicPlaying || !audioCtx) return;
    stopMusic();
    let notes;
    if (lvl === 1) notes = [261.63, 329.63, 392.00, 523.25, 392.00, 329.63];
    else if (lvl === 2) notes = [293.66, 349.23, 440.00, 587.33, 440.00, 349.23]; 
    else if (lvl === 3) notes = [329.63, 392.00, 493.88, 659.25, 493.88, 392.00]; 
    else if (lvl === 4) notes = [349.23, 440.00, 523.25, 698.46, 523.25, 440.00]; 
    else notes = [392.00, 493.88, 587.33, 783.99, 587.33, 493.88]; 
    
    let noteIndex = 0;
    musicInterval = setInterval(() => {
        if (!gameActive || !isMusicPlaying) return;
        const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.type = 'triangle'; osc.frequency.setValueAtTime(notes[noteIndex], audioCtx.currentTime);
        gain.gain.setValueAtTime(0.03, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
        osc.start(); osc.stop(audioCtx.currentTime + 0.25);
        noteIndex = (noteIndex + 1) % notes.length;
    }, 300);
}
function stopMusic() { if (musicInterval) { clearInterval(musicInterval); musicInterval = null; } }

musicToggle.addEventListener('click', () => {
    isMusicPlaying = !isMusicPlaying;
    musicToggle.textContent = isMusicPlaying ? '🔊' : '🔇';
    if (isMusicPlaying && gameActive) startMusic(level); else stopMusic();
});

// ---------- ДАННЫЕ УРОВНЕЙ (УРОВЕНЬ 2 ИСПРАВЛЕН!) ----------
const levels = [
    { // 1. Осенний лес
        bg: ['#ff9a9e', '#fecfef', '#a1c4fd'],
        gravity: 0.6, friction: 0.85,
        platforms: [
            { x: 0, y: 800, w: 800, h: 100 },
            { x: 250, y: 650, w: 150, h: 30 },
            { x: 500, y: 500, w: 150, h: 30 },
            { x: 750, y: 650, w: 150, h: 30 },
            { x: 1000, y: 800, w: 1000, h: 100 },
            { x: 1250, y: 600, w: 150, h: 30 },
            { x: 1500, y: 450, w: 150, h: 30 },
        ],
        spikes: [{ x: 400, y: 770, w: 30, h: 30 }, { x: 1100, y: 570, w: 30, h: 30 }],
        corns: [{ x: 300, y: 600 }, { x: 550, y: 450 }, { x: 800, y: 600 }, { x: 1300, y: 550 }, { x: 1550, y: 400 }],
        springs: [],
        flag: { x: 1800, y: 700, w: 40, h: 100 }
    },
    { // 2. Зимние горы (ИСПРАВЛЕНО: Меньше скольжения, платформы ближе)
        bg: ['#89f7fe', '#66a6ff', '#e0eafc'],
        gravity: 0.6, friction: 0.88, // Было 0.96, стало проще
        platforms: [
            { x: 0, y: 800, w: 600, h: 100 },
            { x: 350, y: 650, w: 150, h: 30 }, // Ближе
            { x: 550, y: 500, w: 150, h: 30 }, 
            { x: 750, y: 350, w: 150, h: 30 },
            { x: 1000, y: 500, w: 150, h: 30 },
            { x: 1200, y: 650, w: 150, h: 30 },
            { x: 1350, y: 800, w: 650, h: 100 },
        ],
        spikes: [
            { x: 250, y: 770, w: 40, h: 30 }, 
            { x: 1300, y: 620, w: 40, h: 30 } // Убрал шип наверху, оставил внизу
        ],
        corns: [
            { x: 400, y: 600 }, { x: 600, y: 450 }, { x: 800, y: 300 }, 
            { x: 1050, y: 450 }, { x: 1250, y: 600 }, { x: 1500, y: 750 }
        ],
        springs: [],
        flag: { x: 1800, y: 700, w: 40, h: 100 }
    },
    { // 3. Весенняя роща
        bg: ['#d4fc79', '#96e6a1', '#fdfbfb'],
        gravity: 0.6, friction: 0.85,
        platforms: [
            { x: 0, y: 800, w: 500, h: 100 },
            { x: 600, y: 700, w: 120, h: 30, moveY: true, minY: 500, maxY: 700, speed: 1.5 },
            { x: 850, y: 500, w: 120, h: 30 },
            { x: 1050, y: 400, w: 120, h: 30, moveX: true, minX: 1000, maxX: 1250, speed: 2 },
            { x: 1350, y: 600, w: 150, h: 30 },
            { x: 1550, y: 800, w: 450, h: 100 },
        ],
        spikes: [{ x: 520, y: 770, w: 30, h: 30 }, { x: 900, y: 470, w: 30, h: 30 }],
        corns: [{ x: 250, y: 750 }, { x: 650, y: 450 }, { x: 900, y: 450 }, { x: 1100, y: 350 }, { x: 1400, y: 550 }, { x: 1650, y: 750 }],
        springs: [],
        flag: { x: 1850, y: 700, w: 40, h: 100 }
    },
    { // 4. Летний пляж
        bg: ['#f6d365', '#fda085', '#fdfbfb'],
        gravity: 0.6, friction: 0.85,
        platforms: [
            { x: 0, y: 800, w: 800, h: 100 },
            { x: 250, y: 650, w: 100, h: 30 },
            { x: 450, y: 500, w: 100, h: 30 },
            { x: 700, y: 350, w: 100, h: 30 },
            { x: 950, y: 500, w: 100, h: 30 },
            { x: 1150, y: 650, w: 150, h: 30 },
            { x: 1350, y: 800, w: 650, h: 100 },
        ],
        spikes: [{ x: 150, y: 770, w: 40, h: 30 }, { x: 850, y: 470, w: 40, h: 30 }, { x: 1250, y: 770, w: 40, h: 30 }],
        corns: [{ x: 300, y: 600 }, { x: 500, y: 450 }, { x: 750, y: 300 }, { x: 1000, y: 450 }, { x: 1200, y: 600 }, { x: 1450, y: 750 }],
        springs: [{ x: 380, y: 770, w: 40, h: 30 }],
        flag: { x: 1800, y: 700, w: 40, h: 100 }
    },
    { // 5. Космос
        bg: ['#4facfe', '#00f2fe', '#0d47a1'],
        gravity: 0.35, friction: 0.85, // Низкая гравитация
        platforms: [
            { x: 0, y: 800, w: 400, h: 100 },
            { x: 500, y: 650, w: 100, h: 30 },
            { x: 700, y: 500, w: 100, h: 30 },
            { x: 900, y: 350, w: 100, h: 30 },
            { x: 1100, y: 500, w: 100, h: 30 },
            { x: 1300, y: 650, w: 100, h: 30 },
            { x: 1500, y: 800, w: 500, h: 100 },
        ],
        spikes: [{ x: 450, y: 770, w: 40, h: 30 }, { x: 800, y: 470, w: 40, h: 30 }, { x: 1200, y: 620, w: 40, h: 30 }],
        corns: [{ x: 150, y: 750 }, { x: 550, y: 600 }, { x: 750, y: 450 }, { x: 950, y: 300 }, { x: 1150, y: 450 }, { x: 1350, y: 600 }, { x: 1600, y: 750 }],
        springs: [],
        flag: { x: 1850, y: 700, w: 40, h: 100 }
    }
];

// ---------- ЛОГИКА ВЫБОРА И СОХРАНЕНИЯ ----------
function updateLevelSelect() {
    document.querySelectorAll('.level-btn').forEach(btn => {
        const lvl = parseInt(btn.dataset.level);
        btn.disabled = lvl > maxUnlockedLevel;
    });
}

function loadLevel(levelNum) {
    const data = levels[levelNum - 1];
    currentBg = data.bg;
    gravity = data.gravity;
    FRICTION = data.friction;
    
    platforms = JSON.parse(JSON.stringify(data.platforms));
    spikes = JSON.parse(JSON.stringify(data.spikes));
    corns = data.corns.map(c => ({ x: c.x, y: c.y, collected: false }));
    springs = JSON.parse(JSON.stringify(data.springs || []));
    flag = { ...data.flag };
    
    platforms.forEach(p => {
        if (p.moveY) { p.dir = 1; p.origY = p.y; }
        if (p.moveX) { p.dir = 1; p.origX = p.x; }
    });

    chicken.x = 100; chicken.y = 700; chicken.vx = 0; chicken.vy = 0;
    cameraX = 0;
    score = 0;
    
    levelDisplay.textContent = levelNum;
    totalDisplay.textContent = corns.length;
    updateUI();
}

function updateUI() {
    livesDisplay.textContent = '❤️'.repeat(Math.max(0, lives)) + '🖤'.repeat(Math.max(0, 3 - lives));
    scoreDisplay.textContent = score;
}

function startGame(selectedLevel = 1) {
    initAudio();
    menu.style.display = 'none';
    levelSelect.style.display = 'none';
    gameoverDiv.style.display = 'none';
    gameDiv.style.display = 'block';
    lives = 3;
    level = selectedLevel;
    loadLevel(level);
    gameActive = true;
    if (isMusicPlaying) startMusic(level);
    if (animationId) cancelAnimationFrame(animationId);
    gameLoop();
}

// ---------- РИСОВАНИЕ КУРОЧКИ ----------
function drawChicken() {
    const px = chicken.x - cameraX;
    const py = chicken.y;
    let legOffset = 0;
    
    if (Math.abs(chicken.vx) > 0.5 && chicken.onGround) { 
        chicken.walkTimer += 0.35; legOffset = Math.sin(chicken.walkTimer) * 14; 
    }

    let shadowY = H - 100;
    let closestDist = Infinity;
    platforms.forEach(p => {
        if (chicken.x + 20 > p.x && chicken.x - 20 < p.x + p.w) {
            if (p.y >= chicken.y && p.y < closestDist) { closestDist = p.y; shadowY = p.y; }
        }
    });
    let heightDiff = shadowY - (chicken.y + chicken.h);
    let shadowScale = Math.max(0.2, 1 - heightDiff / 300);
    let shadowAlpha = Math.max(0.1, 0.5 - heightDiff / 500);
    
    ctx.fillStyle = `rgba(0,0,0,${shadowAlpha})`;
    ctx.beginPath(); ctx.ellipse(px, shadowY, 30 * shadowScale, 10 * shadowScale, 0, 0, Math.PI*2); ctx.fill();

    ctx.save();
    if (chicken.facing === -1) { ctx.scale(-1, 1); ctx.translate(-px * 2, 0); }

    ctx.strokeStyle = '#ff8c00'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(px - 12, py + 40); ctx.lineTo(px - 12 + legOffset, py + 65);
    ctx.moveTo(px + 12, py + 40); ctx.lineTo(px + 12 - legOffset, py + 65); ctx.stroke();

    ctx.fillStyle = '#ffdf00'; ctx.beginPath(); ctx.ellipse(px, py + 10, 38, 32, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(px + 12, py + 5, 20, 18, 0, 0, Math.PI*2); ctx.fill(); 

    let wingAngle = Math.sin(chicken.walkTimer) * 0.3;
    if (!chicken.onGround) wingAngle = -0.8;
    ctx.save(); ctx.translate(px - 18, py + 10); ctx.rotate(wingAngle);
    ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.ellipse(0, 0, 20, 12, -0.2, 0, Math.PI*2); ctx.fill(); ctx.restore();

    ctx.fillStyle = '#ffdf00'; ctx.beginPath(); ctx.arc(px + 22, py - 30, 24, 0, Math.PI*2); ctx.fill();
    
    // Повязка ниндзя
    ctx.fillStyle = '#e63946'; 
    ctx.beginPath(); ctx.moveTo(px - 2, py - 45); ctx.lineTo(px + 46, py - 45); ctx.lineTo(px + 46, py - 35); ctx.lineTo(px - 2, py - 35); ctx.fill();
    ctx.beginPath(); ctx.moveTo(px - 2, py - 40); ctx.lineTo(px - 25, py - 50); ctx.lineTo(px - 20, py - 35); ctx.fill();

    ctx.fillStyle = '#ff8c00'; ctx.beginPath(); ctx.moveTo(px + 40, py - 32); ctx.lineTo(px + 60, py - 25); ctx.lineTo(px + 40, py - 18); ctx.fill();
    ctx.fillStyle = '#e63946'; ctx.beginPath(); ctx.arc(px + 40, py - 10, 6, 0, Math.PI*2); ctx.fill();

    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.ellipse(px + 30, py - 38, 7, 11, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px + 33, py - 42, 3, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(px + 27, py - 34, 1.5, 0, Math.PI*2); ctx.fill();

    ctx.fillStyle = 'rgba(255, 100, 100, 0.5)'; ctx.beginPath(); ctx.ellipse(px + 42, py - 20, 6, 4, 0, 0, Math.PI*2); ctx.fill();

    ctx.restore();
}

// ---------- ИГРОВОЙ ЦИКЛ ----------
function gameLoop() {
    if (!gameActive) return;
    ctx.clearRect(0, 0, W, H);

    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, currentBg[0]);
    grad.addColorStop(0.5, currentBg[1]);
    grad.addColorStop(1, currentBg[2]);
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);

    if (level === 1) { 
        for (let i = 0; i < 8; i++) {
            const tx = (i * 250) - (cameraX * 0.2);
            ctx.fillStyle = 'rgba(139, 69, 19, 0.4)'; ctx.beginPath(); ctx.moveTo(tx, H-80); ctx.lineTo(tx-50, H-250); ctx.lineTo(tx+50, H-250); ctx.fill();
        }
    } else if (level === 2) { 
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.beginPath(); ctx.moveTo(0, H*0.6);
        for(let i=0; i<5; i++) { ctx.lineTo(W*0.2 + i*W*0.25 - (cameraX*0.1)%W, H*0.2); ctx.lineTo(W*0.35 + i*W*0.25 - (cameraX*0.1)%W, H*0.6); }
        ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();
    } else if (level === 3) { 
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        for(let i=0; i<6; i++) { ctx.beginPath(); ctx.arc((i*200 - cameraX*0.1)%W, 100 + (i%2)*80, 40, 0, Math.PI*2); ctx.fill(); }
    } else if (level === 4) { 
        ctx.fillStyle = 'rgba(255, 255, 100, 0.6)'; ctx.shadowColor = '#ffb347'; ctx.shadowBlur = 50;
        ctx.beginPath(); ctx.arc(W-150, 150, 80, 0, Math.PI*2); ctx.fill(); ctx.shadowBlur = 0;
    } else if (level === 5) { 
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        for(let i=0; i<80; i++) { const sx = (i*137)%W; const sy = (i*73)%H; ctx.beginPath(); ctx.arc(sx, sy, Math.sin(i)*1.5+1.5, 0, Math.PI*2); ctx.fill(); }
    }

    cameraX = chicken.x - W / 3;
    if (cameraX < 0) cameraX = 0;

    platforms.forEach(p => {
        if (p.moveY) {
            p.y += p.speed * p.dir;
            if (p.y > p.maxY || p.y < p.minY) p.dir *= -1;
        }
        if (p.moveX) {
            p.x += p.speed * p.dir;
            if (p.x > p.maxX || p.x < p.minX) p.dir *= -1;
        }

        const px = p.x - cameraX;
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(px + 5, p.y + 5, p.w, p.h); 
        ctx.fillStyle = '#8b5a2b'; ctx.fillRect(px, p.y, p.w, p.h); 
        ctx.fillStyle = '#d4a373'; ctx.fillRect(px, p.y, p.w, 8); 
    });

    springs.forEach(s => {
        const sx = s.x - cameraX;
        ctx.fillStyle = '#e63946'; ctx.fillRect(sx, s.y, s.w, s.h);
        ctx.fillStyle = '#ffb347'; ctx.fillRect(sx + 5, s.y - 5, s.w - 10, 5);
    });

    spikes.forEach(s => {
        const sx = s.x - cameraX;
        ctx.fillStyle = '#333'; 
        ctx.beginPath(); ctx.moveTo(sx, s.y + s.h); ctx.lineTo(sx + s.w/2, s.y); ctx.lineTo(sx + s.w, s.y + s.h); ctx.fill();
    });

    corns.forEach(c => {
        if (c.collected) return;
        const cx = c.x - cameraX;
        ctx.font = '45px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('🌽', cx, c.y);
    });

    const fx = flag.x - cameraX;
    ctx.fillStyle = '#8b5a2b'; ctx.fillRect(fx, flag.y, 10, flag.h);
    ctx.fillStyle = '#00FF00'; ctx.beginPath(); ctx.moveTo(fx + 10, flag.y); ctx.lineTo(fx + 60, flag.y + 25); ctx.lineTo(fx + 10, flag.y + 50); ctx.fill();

    // Плавная физика
    if (keys.left) { chicken.vx -= ACCEL; chicken.facing = -1; }
    if (keys.right) { chicken.vx += ACCEL; chicken.facing = 1; }
    
    if (chicken.vx > MOVE_SPEED) chicken.vx = MOVE_SPEED;
    if (chicken.vx < -MOVE_SPEED) chicken.vx = -MOVE_SPEED;

    if (!keys.left && !keys.right) chicken.vx *= FRICTION;
    if (Math.abs(chicken.vx) < 0.1) chicken.vx = 0;

    chicken.x += chicken.vx;
    chicken.vy += gravity;
    chicken.y += chicken.vy;

    chicken.onGround = false;
    platforms.forEach(p => {
        if (chicken.x + 20 > p.x && chicken.x - 20 < p.x + p.w) {
            if (chicken.y + chicken.h > p.y && chicken.y + chicken.h < p.y + p.h + 20 && chicken.vy >= 0) {
                chicken.y = p.y - chicken.h;
                chicken.vy = 0;
                chicken.onGround = true;
                
                if (p.moveY) chicken.y += p.speed * p.dir;
                if (p.moveX) chicken.x += p.speed * p.dir;
            }
        }
    });

    if (chicken.x < 30) chicken.x = 30;

    if (keys.jump && chicken.onGround) {
        chicken.vy = -14; chicken.onGround = false; keys.jump = false; playSound('jump');
    }

    if (chicken.y > H + 100) loseLife();

    spikes.forEach(s => {
        if (chicken.x + 15 > s.x && chicken.x - 15 < s.x + s.w &&
            chicken.y + chicken.h > s.y && chicken.y < s.y + s.h) {
            loseLife();
        }
    });

    springs.forEach(s => {
        if (chicken.x + 15 > s.x && chicken.x - 15 < s.x + s.w &&
            chicken.y + chicken.h > s.y && chicken.y < s.y + s.h) {
            chicken.vy = -22; 
            playSound('spring');
        }
    });

    corns.forEach(c => {
        if (c.collected) return;
        if (Math.abs(chicken.x - c.x) < 40 && Math.abs(chicken.y - c.y) < 50) {
            c.collected = true; score++; updateUI(); playSound('collect');
        }
    });

    // Достижение флага
    if (chicken.x + 20 > flag.x && chicken.x - 20 < flag.x + 60 &&
        chicken.y + chicken.h > flag.y && chicken.y < flag.y + flag.h) {
        
        // СОХРАНЕНИЕ: если уровень пройден впервые
        if (level >= maxUnlockedLevel) {
            maxUnlockedLevel = level + 1;
            localStorage.setItem('chickenMaxLevel', maxUnlockedLevel);
        }
        
        level++;
        if (level > levels.length) {
            gameOver(true);
        } else {
            playSound('win');
            loadLevel(level);
            startMusic(level);
        }
    }

    drawChicken();
    animationId = requestAnimationFrame(gameLoop);
}

function loseLife() {
    lives--;
    updateUI();
    playSound('death');
    
    if (lives <= 0) {
        gameOver(false);
    } else {
        chicken.x = 100; chicken.y = 700; chicken.vx = 0; chicken.vy = 0;
    }
}

function gameOver(win) {
    gameActive = false;
    gameoverDiv.style.display = 'block';
    stopMusic();
    
    if (win) {
        document.getElementById('gameover-title').textContent = 'ПОБЕДА! 🎉';
        document.getElementById('gameover-title').style.color = '#FFD700';
        document.getElementById('fried-chicken').textContent = '🏆';
        maxUnlockedLevel = 5; // Все пройдено
        localStorage.setItem('chickenMaxLevel', 5);
    } else {
        document.getElementById('gameover-title').textContent = 'курочка пожарилась...';
        document.getElementById('gameover-title').style.color = '#ff4444';
        document.getElementById('fried-chicken').textContent = '🍗';
    }
    
    finalScore.textContent = score;
    if (animationId) cancelAnimationFrame(animationId);
}

// ---------- УПРАВЛЕНИЕ ----------
document.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') { e.preventDefault(); keys.left = true; }
    if (e.code === 'ArrowRight' || e.code === 'KeyD') { e.preventDefault(); keys.right = true; }
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); keys.jump = true; }
});

document.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') keys.jump = false;
});

window.addEventListener('blur', () => { keys.left = false; keys.right = false; keys.jump = false; });

// ---------- КНОПКИ ----------
startBtn.addEventListener('click', () => startGame(1)); // Всегда начинаем с 1-го

levelsBtn.addEventListener('click', () => {
    menu.style.display = 'none';
    levelSelect.style.display = 'block';
    updateLevelSelect();
});

backMenuBtn.addEventListener('click', () => {
    levelSelect.style.display = 'none';
    menu.style.display = 'block';
});

document.querySelectorAll('.level-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const lvl = parseInt(e.target.dataset.level);
        if (lvl <= maxUnlockedLevel) startGame(lvl);
    });
});

restartBtn.addEventListener('click', () => { gameoverDiv.style.display = 'none'; startGame(level); });
toMenuBtn.addEventListener('click', () => { gameoverDiv.style.display = 'none'; menu.style.display = 'block'; });