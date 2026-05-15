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

// Constants
const GRID_SIZE = 20;
const INITIAL_MOVE_INTERVAL = 150; // ms per grid move
const MIN_MOVE_INTERVAL = 60;

// Game State
let snake = []; // Array of {x, y} grid coordinates
let food = {};
let direction = { x: 1, y: 0 };
let nextDirection = { x: 1, y: 0 };
let score = 0;
let highScore = localStorage.getItem('snakeHighScore') || 0;
let lastMoveTime = 0;
let moveInterval = INITIAL_MOVE_INTERVAL;
let isGameOver = false;
let isPaused = true;
let animationId = null;
let headImage = null;

// Handle Image Upload
headUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                headImage = img;
            };
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
    // Snake body in grid coordinates
    snake = [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
        { x: 3, y: 5 }
    ];
    direction = { x: 1, y: 0 };
    nextDirection = { x: 1, y: 0 };
    score = 0;
    moveInterval = INITIAL_MOVE_INTERVAL;
    isGameOver = false;
    isPaused = true;
    currentScoreEl.textContent = score;
    highScoreEl.textContent = highScore;
    createFood();
}

function createFood() {
    const cols = canvas.width / GRID_SIZE;
    const rows = canvas.height / GRID_SIZE;
    food = {
        x: Math.floor(Math.random() * cols),
        y: Math.floor(Math.random() * rows)
    };
    if (snake.some(seg => seg.x === food.x && seg.y === food.y)) {
        createFood();
    }
}

function update(currentTime) {
    if (isGameOver || isPaused) return;

    if (!lastMoveTime) lastMoveTime = currentTime;
    const deltaTime = currentTime - lastMoveTime;

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

    // Wall collision
    const cols = canvas.width / GRID_SIZE;
    const rows = canvas.height / GRID_SIZE;
    if (head.x < 0 || head.x >= cols || head.y < 0 || head.y >= rows) {
        return gameOver();
    }

    // Self collision
    if (snake.some(seg => seg.x === head.x && seg.y === head.y)) {
        return gameOver();
    }

    snake.unshift(head);

    // Food collision
    if (head.x === food.x && head.y === food.y) {
        score += 10;
        currentScoreEl.textContent = score;
        if (score > highScore) {
            highScore = score;
            highScoreEl.textContent = highScore;
            localStorage.setItem('snakeHighScore', highScore);
        }
        createFood();
        if (moveInterval > MIN_MOVE_INTERVAL) moveInterval -= 2;
    } else {
        snake.pop();
    }
}

function draw(currentTime) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Calculate interpolation progress (0 to 1)
    const progress = Math.min((currentTime - lastMoveTime) / moveInterval, 1);

    // Draw Food
    ctx.fillStyle = '#FF007F';
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#FF007F';
    ctx.beginPath();
    ctx.arc(
        food.x * GRID_SIZE + GRID_SIZE / 2,
        food.y * GRID_SIZE + GRID_SIZE / 2,
        GRID_SIZE / 2 - 2, 0, Math.PI * 2
    );
    ctx.fill();

    // Draw Snake with interpolation
    snake.forEach((seg, i) => {
        let drawX, drawY;

        if (i === 0) {
            // Head: interpolate from previous to current
            const prevX = seg.x - direction.x;
            const prevY = seg.y - direction.y;
            drawX = (prevX + (seg.x - prevX) * progress) * GRID_SIZE;
            drawY = (prevY + (seg.y - prevY) * progress) * GRID_SIZE;

            if (headImage) {
                // Draw custom image for head
                ctx.save();
                ctx.translate(drawX + GRID_SIZE / 2, drawY + GRID_SIZE / 2);
                const angle = Math.atan2(direction.y, direction.x);
                ctx.rotate(angle);
                ctx.drawImage(headImage, -GRID_SIZE / 2 + 1, -GRID_SIZE / 2 + 1, GRID_SIZE - 2, GRID_SIZE - 2);
                ctx.restore();
                return;
            }
        } else {
            // Body segments: move towards the segment ahead
            const target = snake[i - 1];
            drawX = (seg.x + (target.x - seg.x) * progress) * GRID_SIZE;
            drawY = (seg.y + (target.y - seg.y) * progress) * GRID_SIZE;
        }

        ctx.fillStyle = i === 0 ? '#39FF14' : '#2ecc71';
        ctx.shadowBlur = i === 0 ? 15 : 5;
        ctx.shadowColor = '#39FF14';
        
        // Rounded snake body
        const padding = 1;
        ctx.fillRect(drawX + padding, drawY + padding, GRID_SIZE - padding * 2, GRID_SIZE - padding * 2);
    });

    ctx.shadowBlur = 0;
}

function gameOver() {
    isGameOver = true;
    finalScoreEl.textContent = score;
    gameOverScreen.classList.remove('hidden');
    startScreen.classList.add('hidden');
    overlay.classList.remove('hidden');
    cancelAnimationFrame(animationId);
}

function startGame() {
    overlay.classList.add('hidden');
    initGame();
    isPaused = false;
    lastMoveTime = 0;
    requestAnimationFrame(update);
}

// Input handling
const handleInput = (key) => {
    if (isPaused || isGameOver) return;
    
    if ((key === 'ArrowUp' || key === 'w') && direction.y === 0) nextDirection = { x: 0, y: -1 };
    if ((key === 'ArrowDown' || key === 's') && direction.y === 0) nextDirection = { x: 0, y: 1 };
    if ((key === 'ArrowLeft' || key === 'a') && direction.x === 0) nextDirection = { x: -1, y: 0 };
    if ((key === 'ArrowRight' || key === 'd') && direction.x === 0) nextDirection = { x: 1, y: 0 };
};

document.addEventListener('keydown', (e) => {
    if (overlay.classList.contains('hidden')) {
        handleInput(e.key);
    } else if (!isGameOver) {
        startGame();
    }
});

// Touch controls
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

    if (Math.abs(diffX) > Math.abs(diffY)) {
        handleInput(diffX > 0 ? 'ArrowLeft' : 'ArrowRight');
    } else {
        handleInput(diffY > 0 ? 'ArrowUp' : 'ArrowDown');
    }
    touchStartX = 0; touchStartY = 0;
    e.preventDefault();
}, { passive: false });

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

initGame();
draw(0);
window.addEventListener('resize', () => {
    if (isPaused) { resizeCanvas(); draw(0); }
});
