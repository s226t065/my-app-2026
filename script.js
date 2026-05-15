const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const currentScoreEl = document.getElementById('current-score');
const highScoreEl = document.getElementById('high-score');
const finalScoreEl = document.getElementById('final-score');
const overlay = document.getElementById('overlay');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const headUpload = document.getElementById('head-image-upload');
const obstacleModeToggle = document.getElementById('obstacle-mode');
const speedInputs = document.getElementsByName('speed');
const statusDisplay = document.getElementById('status-display');

// Constants
const GRID_SIZE = 20;
const MIN_MOVE_INTERVAL = 40;
const MAX_OBSTACLES = 15;
const POISON_DURATION = 10000; // 10 seconds

// Audio Context
let audioCtx = null;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playSound(type) {
    if (!audioCtx) return;
    
    // Resume audio context if it's suspended (browser security)
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const now = audioCtx.currentTime;

    if (type === 'eat') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    } else if (type === 'poison') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.2);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
    } else if (type === 'gameOver') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.5);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
    } else if (type === 'scissors') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(660, now);
        osc.frequency.setValueAtTime(880, now + 0.05);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    }
}

// Game State
let snake = [];
let food = {};
let poisonApple = null;
let scissors = null;
let obstacles = [];
let direction = { x: 1, y: 0 };
let nextDirection = { x: 1, y: 0 };
let score = 0;
let highScore = localStorage.getItem('snakeHighScore') || 0;
let lastMoveTime = 0;
let lastObstacleAddTime = 0;
let moveInterval = 150;
let isGameOver = false;
let isPaused = true;
let animationId = null;
let headImage = null;
let isObstacleMode = false;

let isReversed = false;
let poisonTimeout = null;
let scissorsSpawned = false;

// Handle Image Upload
headUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => { headImage = img; };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }
});

function resizeCanvas() {
    const size = Math.min(window.innerWidth - 40, 400);
    canvas.width = Math.floor(size / GRID_SIZE) * GRID_SIZE;
    canvas.height = canvas.width;
}

function initGame() {
    resizeCanvas();
    snake = [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
        { x: 3, y: 5 }
    ];
    obstacles = [];
    poisonApple = null;
    scissors = null;
    direction = { x: 1, y: 0 };
    nextDirection = { x: 1, y: 0 };
    score = 0;
    isReversed = false;
    scissorsSpawned = false;
    statusDisplay.classList.add('hidden');
    clearTimeout(poisonTimeout);

    let selectedSpeed = 150;
    speedInputs.forEach(input => {
        if (input.checked) selectedSpeed = parseInt(input.value);
    });
    moveInterval = selectedSpeed;

    isGameOver = false;
    isPaused = true;
    currentScoreEl.textContent = score;
    highScoreEl.textContent = highScore;
    isObstacleMode = obstacleModeToggle.checked;
    createFood();
}

function getSafeRandomPos() {
    const cols = canvas.width / GRID_SIZE;
    const rows = canvas.height / GRID_SIZE;
    const pos = {
        x: Math.floor(Math.random() * cols),
        y: Math.floor(Math.random() * rows)
    };
    const isOnSnake = snake.some(seg => seg.x === pos.x && seg.y === pos.y);
    const isOnObstacle = obstacles.some(obs => obs.x === pos.x && obs.y === pos.y);
    const isOnFood = food && food.x === pos.x && food.y === pos.y;
    const isOnPoison = poisonApple && poisonApple.x === pos.x && poisonApple.y === pos.y;
    const isOnScissors = scissors && scissors.x === pos.x && scissors.y === pos.y;

    if (isOnSnake || isOnObstacle || isOnFood || isOnPoison || isOnScissors) {
        return getSafeRandomPos();
    }
    return pos;
}

function createFood() {
    food = getSafeRandomPos();
    if (Math.random() < 0.2 && !poisonApple) {
        poisonApple = getSafeRandomPos();
    }
}

function spawnScissors() {
    if (!scissorsSpawned && score >= 300) {
        scissors = getSafeRandomPos();
        scissorsSpawned = true;
    }
}

function addObstacle() {
    if (obstacles.length >= MAX_OBSTACLES) return;
    obstacles.push(getSafeRandomPos());
}

function update(currentTime) {
    if (isGameOver || isPaused) return;

    if (!lastMoveTime) {
        lastMoveTime = currentTime;
        lastObstacleAddTime = currentTime;
    }
    
    const deltaTime = currentTime - lastMoveTime;

    if (isObstacleMode && obstacles.length < MAX_OBSTACLES) {
        if (currentTime - lastObstacleAddTime >= 10000) {
            addObstacle();
            lastObstacleAddTime = currentTime;
        }
    }

    if (score >= 300 && !scissorsSpawned) {
        spawnScissors();
    }

    if (deltaTime >= moveInterval) {
        move();
        lastMoveTime = currentTime;
    }

    draw(currentTime);
    animationId = requestAnimationFrame(update);
}

function move() {
    direction = nextDirection;
    const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };

    const cols = canvas.width / GRID_SIZE;
    const rows = canvas.height / GRID_SIZE;
    if (head.x < 0 || head.x >= cols || head.y < 0 || head.y >= rows) return gameOver();
    if (snake.some(seg => seg.x === head.x && seg.y === head.y)) return gameOver();
    if (isObstacleMode && obstacles.some(obs => obs.x === head.x && obs.y === head.y)) return gameOver();

    snake.unshift(head);

    if (head.x === food.x && head.y === food.y) {
        handleScore(10);
        playSound('eat');
        createFood();
        if (moveInterval > MIN_MOVE_INTERVAL) moveInterval -= 2;
    } 
    else if (poisonApple && head.x === poisonApple.x && head.y === poisonApple.y) {
        handleScore(30);
        playSound('poison');
        activatePoison();
        poisonApple = null;
    }
    else if (scissors && head.x === scissors.x && head.y === scissors.y) {
        playSound('scissors');
        const newLength = Math.max(3, Math.floor(snake.length / 2));
        while (snake.length > newLength) snake.pop();
        scissors = null;
    }
    else {
        snake.pop();
    }
}

function handleScore(pts) {
    score += pts;
    currentScoreEl.textContent = score;
    if (score > highScore) {
        highScore = score;
        highScoreEl.textContent = highScore;
        localStorage.setItem('snakeHighScore', highScore);
    }
}

function activatePoison() {
    isReversed = true;
    statusDisplay.classList.remove('hidden');
    clearTimeout(poisonTimeout);
    poisonTimeout = setTimeout(() => {
        isReversed = false;
        statusDisplay.classList.add('hidden');
    }, POISON_DURATION);
}

function draw(currentTime) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const progress = Math.min((currentTime - lastMoveTime) / moveInterval, 1);

    if (isObstacleMode) {
        ctx.fillStyle = '#FFA500';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#FFA500';
        obstacles.forEach(obs => {
            ctx.fillRect(obs.x * GRID_SIZE + 2, obs.y * GRID_SIZE + 2, GRID_SIZE - 4, GRID_SIZE - 4);
        });
    }

    if (poisonApple) {
        ctx.fillStyle = '#9D00FF';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#9D00FF';
        ctx.fillRect(poisonApple.x * GRID_SIZE + 4, poisonApple.y * GRID_SIZE + 4, GRID_SIZE - 8, GRID_SIZE - 8);
    }

    if (scissors) {
        ctx.fillStyle = '#00D4FF';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#00D4FF';
        ctx.font = `${GRID_SIZE}px Arial`;
        ctx.fillText('✂️', scissors.x * GRID_SIZE, (scissors.y + 1) * GRID_SIZE - 2);
    }

    ctx.fillStyle = '#FF007F';
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#FF007F';
    ctx.beginPath();
    ctx.arc(food.x * GRID_SIZE + GRID_SIZE / 2, food.y * GRID_SIZE + GRID_SIZE / 2, GRID_SIZE / 2 - 2, 0, Math.PI * 2);
    ctx.fill();

    snake.forEach((seg, i) => {
        let drawX, drawY;
        if (i === 0) {
            const prevX = seg.x - direction.x;
            const prevY = seg.y - direction.y;
            drawX = (prevX + (seg.x - prevX) * progress) * GRID_SIZE;
            drawY = (prevY + (seg.y - prevY) * progress) * GRID_SIZE;
            if (headImage) {
                ctx.save();
                ctx.translate(drawX + GRID_SIZE / 2, drawY + GRID_SIZE / 2);
                ctx.rotate(Math.atan2(direction.y, direction.x));
                ctx.drawImage(headImage, -GRID_SIZE / 2 + 1, -GRID_SIZE / 2 + 1, GRID_SIZE - 2, GRID_SIZE - 2);
                ctx.restore();
                return;
            }
        } else {
            const target = snake[i - 1];
            drawX = (seg.x + (target.x - seg.x) * progress) * GRID_SIZE;
            drawY = (seg.y + (target.y - seg.y) * progress) * GRID_SIZE;
        }
        ctx.fillStyle = i === 0 ? '#39FF14' : '#2ecc71';
        ctx.shadowBlur = i === 0 ? 15 : 5;
        ctx.shadowColor = '#39FF14';
        ctx.fillRect(drawX + 1, drawY + 1, GRID_SIZE - 2, GRID_SIZE - 2);
    });
    ctx.shadowBlur = 0;
}

function gameOver() {
    isGameOver = true;
    playSound('gameOver');
    finalScoreEl.textContent = score;
    gameOverScreen.classList.remove('hidden');
    startScreen.classList.add('hidden');
    overlay.classList.remove('hidden');
    cancelAnimationFrame(animationId);
}

function startGame() {
    initAudio();
    overlay.classList.add('hidden');
    initGame();
    isPaused = false;
    lastMoveTime = 0;
    lastObstacleAddTime = 0;
    requestAnimationFrame(update);
}

const handleInput = (key) => {
    if (isPaused || isGameOver) return;
    let moveKey = key;
    if (isReversed) {
        if (key === 'ArrowUp' || key === 'w') moveKey = 'ArrowDown';
        else if (key === 'ArrowDown' || key === 's') moveKey = 'ArrowUp';
        else if (key === 'ArrowLeft' || key === 'a') moveKey = 'ArrowRight';
        else if (key === 'ArrowRight' || key === 'd') moveKey = 'ArrowLeft';
    }

    if ((moveKey === 'ArrowUp' || moveKey === 'w') && direction.y === 0) nextDirection = { x: 0, y: -1 };
    if ((moveKey === 'ArrowDown' || moveKey === 's') && direction.y === 0) nextDirection = { x: 0, y: 1 };
    if ((moveKey === 'ArrowLeft' || moveKey === 'a') && direction.x === 0) nextDirection = { x: -1, y: 0 };
    if ((moveKey === 'ArrowRight' || moveKey === 'd') && direction.x === 0) nextDirection = { x: 1, y: 0 };
};

document.addEventListener('keydown', (e) => {
    if (overlay.classList.contains('hidden')) {
        handleInput(e.key);
    } else {
        const isRestartKey = e.key === ' ' || e.key === 'Enter';
        if (isGameOver) {
            if (isRestartKey) startGame();
        } else if (e.key !== 'Tab') {
            startGame();
        }
    }
});

let touchStartX = 0;
let touchStartY = 0;
document.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
}, false);
document.addEventListener('touchmove', e => {
    if (!touchStartX || !touchStartY || isPaused) return;
    const diffX = touchStartX - e.touches[0].clientX;
    const diffY = touchStartY - e.touches[0].clientY;
    if (Math.abs(diffX) > Math.abs(diffY)) handleInput(diffX > 0 ? 'ArrowLeft' : 'ArrowRight');
    else handleInput(diffY > 0 ? 'ArrowUp' : 'ArrowDown');
    touchStartX = 0; touchStartY = 0;
    e.preventDefault();
}, { passive: false });

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

initGame();
draw(0);
window.addEventListener('resize', () => { if (isPaused) { resizeCanvas(); draw(0); } });
