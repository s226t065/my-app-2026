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

// Constants
const GRID_SIZE = 20;
const INITIAL_SPEED = 150;
const MIN_SPEED = 60;

// Game State
let snake = [];
let food = {};
let dx = GRID_SIZE;
let dy = 0;
let nextDx = GRID_SIZE;
let nextDy = 0;
let score = 0;
let highScore = localStorage.getItem('snakeHighScore') || 0;
let gameLoop = null;
let speed = INITIAL_SPEED;

// Initialize canvas size
function resizeCanvas() {
    const size = Math.min(window.innerWidth - 40, 400);
    // Ensure size is a multiple of GRID_SIZE
    canvas.width = Math.floor(size / GRID_SIZE) * GRID_SIZE;
    canvas.height = canvas.width;
}

function initGame() {
    resizeCanvas();
    snake = [
        { x: GRID_SIZE * 5, y: GRID_SIZE * 5 },
        { x: GRID_SIZE * 4, y: GRID_SIZE * 5 },
        { x: GRID_SIZE * 3, y: GRID_SIZE * 5 }
    ];
    dx = GRID_SIZE;
    dy = 0;
    nextDx = GRID_SIZE;
    nextDy = 0;
    score = 0;
    speed = INITIAL_SPEED;
    currentScoreEl.textContent = score;
    highScoreEl.textContent = highScore;
    createFood();
}

function createFood() {
    food = {
        x: Math.floor(Math.random() * (canvas.width / GRID_SIZE)) * GRID_SIZE,
        y: Math.floor(Math.random() * (canvas.height / GRID_SIZE)) * GRID_SIZE
    };
    // Check if food is on snake
    if (snake.some(segment => segment.x === food.x && segment.y === food.y)) {
        createFood();
    }
}

function draw() {
    // Clear canvas
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw snake
    snake.forEach((segment, index) => {
        ctx.fillStyle = index === 0 ? '#39FF14' : '#2ecc71';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#39FF14';
        ctx.fillRect(segment.x + 1, segment.y + 1, GRID_SIZE - 2, GRID_SIZE - 2);
    });

    // Draw food
    ctx.fillStyle = '#FF007F';
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#FF007F';
    ctx.beginPath();
    ctx.arc(food.x + GRID_SIZE/2, food.y + GRID_SIZE/2, GRID_SIZE/2 - 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Reset shadow for performance
    ctx.shadowBlur = 0;
}

function move() {
    dx = nextDx;
    dy = nextDy;
    
    const head = { x: snake[0].x + dx, y: snake[0].y + dy };

    // Wall collision
    if (head.x < 0 || head.x >= canvas.width || head.y < 0 || head.y >= canvas.height) {
        return gameOver();
    }

    // Self collision
    if (snake.some(segment => segment.x === head.x && segment.y === head.y)) {
        return gameOver();
    }

    snake.unshift(head);

    // Eat food
    if (head.x === food.x && head.y === food.y) {
        score += 10;
        currentScoreEl.textContent = score;
        if (score > highScore) {
            highScore = score;
            highScoreEl.textContent = highScore;
            localStorage.setItem('snakeHighScore', highScore);
        }
        createFood();
        // Speed up
        if (speed > MIN_SPEED) speed -= 2;
    } else {
        snake.pop();
    }

    draw();
    gameLoop = setTimeout(move, speed);
}

function gameOver() {
    clearTimeout(gameLoop);
    gameLoop = null;
    finalScoreEl.textContent = score;
    gameOverScreen.classList.remove('hidden');
    startScreen.classList.add('hidden');
    overlay.classList.remove('hidden');
}

function startGame() {
    overlay.classList.add('hidden');
    initGame();
    move();
}

// Input handling
document.addEventListener('keydown', (e) => {
    if (overlay.classList.contains('hidden')) {
        const key = e.key;
        if ((key === 'ArrowUp' || key === 'w') && dy === 0) { nextDx = 0; nextDy = -GRID_SIZE; }
        if ((key === 'ArrowDown' || key === 's') && dy === 0) { nextDx = 0; nextDy = GRID_SIZE; }
        if ((key === 'ArrowLeft' || key === 'a') && dx === 0) { nextDx = -GRID_SIZE; nextDy = 0; }
        if ((key === 'ArrowRight' || key === 'd') && dx === 0) { nextDx = GRID_SIZE; nextDy = 0; }
    } else if (gameLoop === null) {
        startGame();
    }
});

// Touch handling for mobile
let touchStartX = 0;
let touchStartY = 0;

document.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
}, false);

document.addEventListener('touchmove', e => {
    if (!touchStartX || !touchStartY) return;

    let touchEndX = e.touches[0].clientX;
    let touchEndY = e.touches[0].clientY;

    let diffX = touchStartX - touchEndX;
    let diffY = touchStartY - touchEndY;

    if (Math.abs(diffX) > Math.abs(diffY)) {
        if (diffX > 0 && dx === 0) { nextDx = -GRID_SIZE; nextDy = 0; }
        else if (dx === 0) { nextDx = GRID_SIZE; nextDy = 0; }
    } else {
        if (diffY > 0 && dy === 0) { nextDx = 0; nextDy = -GRID_SIZE; }
        else if (dy === 0) { nextDx = 0; nextDy = GRID_SIZE; }
    }

    touchStartX = 0;
    touchStartY = 0;
    e.preventDefault();
}, { passive: false });

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

// Initial draw
initGame();
draw();
window.addEventListener('resize', () => {
    if (gameLoop === null) {
        resizeCanvas();
        draw();
    }
});
