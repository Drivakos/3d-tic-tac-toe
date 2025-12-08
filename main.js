import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ============================================
// GAME STATE
// ============================================
const gameState = {
    board: Array(9).fill(null),
    currentPlayer: 'X',
    gameOver: false,
    scores: { X: 0, O: 0 },
    winningLine: null,
    mode: null,        // 'pvp' or 'ai'
    difficulty: null,  // 'easy', 'medium', 'hard'
    isAIThinking: false
};

const winPatterns = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
    [0, 4, 8], [2, 4, 6]             // Diagonals
];

// ============================================
// THREE.JS SETUP
// ============================================
const canvas = document.getElementById('game-canvas');
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
camera.position.set(0, 8, 10);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Orbit Controls
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enablePan = false;
controls.minDistance = 8;
controls.maxDistance = 20;
controls.maxPolarAngle = Math.PI / 2.2;

// ============================================
// LIGHTING
// ============================================
const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
scene.add(ambientLight);

const mainLight = new THREE.DirectionalLight(0xffffff, 1);
mainLight.position.set(5, 10, 7);
mainLight.castShadow = true;
mainLight.shadow.mapSize.width = 2048;
mainLight.shadow.mapSize.height = 2048;
mainLight.shadow.camera.near = 0.5;
mainLight.shadow.camera.far = 50;
scene.add(mainLight);

// Accent lights for the cyberpunk feel
const cyanLight = new THREE.PointLight(0x00f5ff, 0.8, 20);
cyanLight.position.set(-5, 5, -5);
scene.add(cyanLight);

const magentaLight = new THREE.PointLight(0xff00aa, 0.6, 20);
magentaLight.position.set(5, 5, 5);
scene.add(magentaLight);

// ============================================
// MATERIALS
// ============================================
const materials = {
    board: new THREE.MeshStandardMaterial({
        color: 0x1a1a2e,
        metalness: 0.3,
        roughness: 0.7
    }),
    gridLine: new THREE.MeshStandardMaterial({
        color: 0x00f5ff,
        emissive: 0x00f5ff,
        emissiveIntensity: 0.3,
        metalness: 0.8,
        roughness: 0.2
    }),
    cellHover: new THREE.MeshStandardMaterial({
        color: 0x2a2a4e,
        transparent: true,
        opacity: 0.5
    }),
    playerX: new THREE.MeshStandardMaterial({
        color: 0x00f5ff,
        emissive: 0x00f5ff,
        emissiveIntensity: 0.5,
        metalness: 0.9,
        roughness: 0.1
    }),
    playerO: new THREE.MeshStandardMaterial({
        color: 0xff00aa,
        emissive: 0xff00aa,
        emissiveIntensity: 0.5,
        metalness: 0.9,
        roughness: 0.1
    }),
    winHighlight: new THREE.MeshStandardMaterial({
        color: 0xffd700,
        emissive: 0xffd700,
        emissiveIntensity: 0.8,
        metalness: 0.9,
        roughness: 0.1
    })
};

// ============================================
// GAME BOARD
// ============================================
const boardGroup = new THREE.Group();
scene.add(boardGroup);

const CELL_SIZE = 2;
const BOARD_SIZE = CELL_SIZE * 3;
const GAP = 0.1;

// Base platform
const platformGeometry = new THREE.BoxGeometry(BOARD_SIZE + 1, 0.3, BOARD_SIZE + 1);
const platform = new THREE.Mesh(platformGeometry, materials.board);
platform.position.y = -0.2;
platform.receiveShadow = true;
boardGroup.add(platform);

// Grid lines
function createGridLines() {
    const lineGeometry = new THREE.BoxGeometry(0.08, 0.15, BOARD_SIZE - 0.2);
    
    // Vertical lines
    for (let i = -1; i <= 1; i += 2) {
        const line = new THREE.Mesh(lineGeometry, materials.gridLine);
        line.position.set(i * (CELL_SIZE / 2 + GAP / 2), 0.05, 0);
        boardGroup.add(line);
    }
    
    // Horizontal lines
    const hLineGeometry = new THREE.BoxGeometry(BOARD_SIZE - 0.2, 0.15, 0.08);
    for (let i = -1; i <= 1; i += 2) {
        const line = new THREE.Mesh(hLineGeometry, materials.gridLine);
        line.position.set(0, 0.05, i * (CELL_SIZE / 2 + GAP / 2));
        boardGroup.add(line);
    }
}
createGridLines();

// Invisible click targets for each cell
const clickTargets = [];
const clickTargetGeometry = new THREE.PlaneGeometry(CELL_SIZE - GAP * 2, CELL_SIZE - GAP * 2);

for (let i = 0; i < 9; i++) {
    const row = Math.floor(i / 3);
    const col = i % 3;
    
    const x = (col - 1) * CELL_SIZE;
    const z = (row - 1) * CELL_SIZE;
    
    const target = new THREE.Mesh(
        clickTargetGeometry,
        new THREE.MeshBasicMaterial({ visible: false })
    );
    target.rotation.x = -Math.PI / 2;
    target.position.set(x, 0.01, z);
    target.userData.cellIndex = i;
    
    clickTargets.push(target);
    boardGroup.add(target);
}

// ============================================
// GAME PIECES
// ============================================
const pieces = [];

function createX(cellIndex) {
    const group = new THREE.Group();
    const barGeometry = new THREE.BoxGeometry(0.15, 0.3, 1.4);
    
    const bar1 = new THREE.Mesh(barGeometry, materials.playerX.clone());
    bar1.rotation.y = Math.PI / 4;
    bar1.castShadow = true;
    
    const bar2 = new THREE.Mesh(barGeometry, materials.playerX.clone());
    bar2.rotation.y = -Math.PI / 4;
    bar2.castShadow = true;
    
    group.add(bar1, bar2);
    
    // Position
    const row = Math.floor(cellIndex / 3);
    const col = cellIndex % 3;
    group.position.set((col - 1) * CELL_SIZE, 0.15, (row - 1) * CELL_SIZE);
    
    // Animate entry
    group.scale.set(0, 0, 0);
    group.userData.targetScale = 1;
    group.userData.cellIndex = cellIndex;
    
    return group;
}

function createO(cellIndex) {
    const geometry = new THREE.TorusGeometry(0.55, 0.12, 16, 32);
    const mesh = new THREE.Mesh(geometry, materials.playerO.clone());
    mesh.rotation.x = -Math.PI / 2;
    mesh.castShadow = true;
    
    // Position
    const row = Math.floor(cellIndex / 3);
    const col = cellIndex % 3;
    mesh.position.set((col - 1) * CELL_SIZE, 0.15, (row - 1) * CELL_SIZE);
    
    // Animate entry
    mesh.scale.set(0, 0, 0);
    mesh.userData.targetScale = 1;
    mesh.userData.cellIndex = cellIndex;
    
    return mesh;
}

function placePiece(cellIndex) {
    if (gameState.board[cellIndex] || gameState.gameOver) return false;
    
    const piece = gameState.currentPlayer === 'X' 
        ? createX(cellIndex) 
        : createO(cellIndex);
    
    boardGroup.add(piece);
    pieces.push(piece);
    gameState.board[cellIndex] = gameState.currentPlayer;
    
    return true;
}

// ============================================
// GAME LOGIC
// ============================================
function checkWinner() {
    for (const pattern of winPatterns) {
        const [a, b, c] = pattern;
        if (
            gameState.board[a] &&
            gameState.board[a] === gameState.board[b] &&
            gameState.board[a] === gameState.board[c]
        ) {
            return { winner: gameState.board[a], pattern };
        }
    }
    return null;
}

function checkDraw() {
    return gameState.board.every(cell => cell !== null);
}

// ============================================
// AI LOGIC
// ============================================
function getEmptyCells(board) {
    return board.map((cell, index) => cell === null ? index : null).filter(i => i !== null);
}

function checkWinnerForBoard(board) {
    for (const pattern of winPatterns) {
        const [a, b, c] = pattern;
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a];
        }
    }
    return null;
}

// Minimax algorithm for unbeatable AI
function minimax(board, depth, isMaximizing, alpha, beta) {
    const winner = checkWinnerForBoard(board);
    
    // Terminal states
    if (winner === 'O') return 10 - depth; // AI wins
    if (winner === 'X') return depth - 10; // Player wins
    if (getEmptyCells(board).length === 0) return 0; // Draw
    
    if (isMaximizing) {
        let maxEval = -Infinity;
        for (const cell of getEmptyCells(board)) {
            board[cell] = 'O';
            const eval_ = minimax(board, depth + 1, false, alpha, beta);
            board[cell] = null;
            maxEval = Math.max(maxEval, eval_);
            alpha = Math.max(alpha, eval_);
            if (beta <= alpha) break; // Alpha-beta pruning
        }
        return maxEval;
    } else {
        let minEval = Infinity;
        for (const cell of getEmptyCells(board)) {
            board[cell] = 'X';
            const eval_ = minimax(board, depth + 1, true, alpha, beta);
            board[cell] = null;
            minEval = Math.min(minEval, eval_);
            beta = Math.min(beta, eval_);
            if (beta <= alpha) break; // Alpha-beta pruning
        }
        return minEval;
    }
}

function getBestMove(board) {
    let bestScore = -Infinity;
    let bestMove = null;
    
    for (const cell of getEmptyCells(board)) {
        board[cell] = 'O';
        const score = minimax(board, 0, false, -Infinity, Infinity);
        board[cell] = null;
        
        if (score > bestScore) {
            bestScore = score;
            bestMove = cell;
        }
    }
    
    return bestMove;
}

function getRandomMove(board) {
    const emptyCells = getEmptyCells(board);
    return emptyCells[Math.floor(Math.random() * emptyCells.length)];
}

function getMediumMove(board) {
    // 50% chance of making the best move, 50% chance of random
    // But always block winning moves and take winning opportunities
    const emptyCells = getEmptyCells(board);
    
    // Check if AI can win
    for (const cell of emptyCells) {
        board[cell] = 'O';
        if (checkWinnerForBoard(board) === 'O') {
            board[cell] = null;
            return cell;
        }
        board[cell] = null;
    }
    
    // Check if player can win and block
    for (const cell of emptyCells) {
        board[cell] = 'X';
        if (checkWinnerForBoard(board) === 'X') {
            board[cell] = null;
            return cell;
        }
        board[cell] = null;
    }
    
    // 50% best move, 50% random
    if (Math.random() > 0.5) {
        return getBestMove(board);
    }
    
    // Prefer center, then corners, then edges
    if (board[4] === null) return 4;
    
    const corners = [0, 2, 6, 8].filter(i => board[i] === null);
    if (corners.length > 0) {
        return corners[Math.floor(Math.random() * corners.length)];
    }
    
    return getRandomMove(board);
}

function getAIMove() {
    const boardCopy = [...gameState.board];
    
    switch (gameState.difficulty) {
        case 'easy':
            return getRandomMove(boardCopy);
        case 'medium':
            return getMediumMove(boardCopy);
        case 'hard':
            return getBestMove(boardCopy);
        default:
            return getRandomMove(boardCopy);
    }
}

function makeAIMove() {
    if (gameState.gameOver || gameState.currentPlayer !== 'O' || gameState.mode !== 'ai') {
        return;
    }
    
    gameState.isAIThinking = true;
    
    // Add a small delay to make it feel more natural
    setTimeout(() => {
        const move = getAIMove();
        if (move !== null) {
            handleMove(move);
        }
        gameState.isAIThinking = false;
    }, 500 + Math.random() * 500);
}

function highlightWinningPieces(pattern) {
    pieces.forEach(piece => {
        if (pattern.includes(piece.userData.cellIndex)) {
            // Apply golden highlight
            if (piece.isGroup) {
                piece.children.forEach(child => {
                    child.material = materials.winHighlight.clone();
                });
            } else {
                piece.material = materials.winHighlight.clone();
            }
            piece.userData.isWinning = true;
        }
    });
}

function showMessage(text) {
    const messageEl = document.getElementById('message');
    messageEl.textContent = text;
    messageEl.classList.remove('hidden');
}

function hideMessage() {
    document.getElementById('message').classList.add('hidden');
}

function updateUI() {
    const playerEl = document.getElementById('current-player');
    
    // Show "AI" or "YOU" in AI mode
    if (gameState.mode === 'ai') {
        if (gameState.currentPlayer === 'X') {
            playerEl.textContent = 'YOU';
        } else {
            playerEl.textContent = gameState.isAIThinking ? 'AI...' : 'AI';
        }
    } else {
        playerEl.textContent = gameState.currentPlayer;
    }
    
    playerEl.className = `player-${gameState.currentPlayer.toLowerCase()}`;
    
    document.getElementById('score-x').textContent = gameState.scores.X;
    document.getElementById('score-o').textContent = gameState.scores.O;
    
    // Update score labels for AI mode
    const scoreLabelX = document.querySelector('.player-x-score .score-label');
    const scoreLabelO = document.querySelector('.player-o-score .score-label');
    
    if (gameState.mode === 'ai') {
        scoreLabelX.textContent = 'YOU';
        scoreLabelO.textContent = 'AI';
    } else {
        scoreLabelX.textContent = 'X';
        scoreLabelO.textContent = 'O';
    }
}

function switchPlayer() {
    gameState.currentPlayer = gameState.currentPlayer === 'X' ? 'O' : 'X';
    updateUI();
}

function handleMove(cellIndex) {
    if (!placePiece(cellIndex)) return;
    
    const result = checkWinner();
    if (result) {
        gameState.gameOver = true;
        gameState.winningLine = result.pattern;
        gameState.scores[result.winner]++;
        highlightWinningPieces(result.pattern);
        
        // Custom message for AI mode
        if (gameState.mode === 'ai') {
            const msg = result.winner === 'X' ? 'YOU WIN!' : 'AI WINS!';
            showMessage(msg);
        } else {
            showMessage(`${result.winner} WINS!`);
        }
        updateUI();
        return;
    }
    
    if (checkDraw()) {
        gameState.gameOver = true;
        showMessage("DRAW!");
        return;
    }
    
    switchPlayer();
    
    // Trigger AI move if it's AI's turn
    if (gameState.mode === 'ai' && gameState.currentPlayer === 'O') {
        makeAIMove();
    }
}

function resetGame() {
    // Clear pieces
    pieces.forEach(piece => boardGroup.remove(piece));
    pieces.length = 0;
    
    // Reset state
    gameState.board = Array(9).fill(null);
    gameState.currentPlayer = 'X';
    gameState.gameOver = false;
    gameState.winningLine = null;
    gameState.isAIThinking = false;
    
    hideMessage();
    updateUI();
}

function goToMainMenu() {
    resetGame();
    gameState.mode = null;
    gameState.difficulty = null;
    gameState.scores = { X: 0, O: 0 };
    
    // Show mode selection, hide game UI
    document.getElementById('mode-select-overlay').classList.remove('hidden');
    document.getElementById('ui-overlay').classList.add('hidden');
    document.getElementById('difficulty-select').classList.add('hidden');
    
    // Reset mode button selection
    document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('selected'));
    
    updateUI();
}

function startGame(mode, difficulty = null) {
    gameState.mode = mode;
    gameState.difficulty = difficulty;
    gameState.scores = { X: 0, O: 0 };
    
    // Update mode label
    const modeLabel = document.getElementById('game-mode-label');
    if (mode === 'pvp') {
        modeLabel.textContent = '2 PLAYERS';
    } else {
        const difficultyText = difficulty.toUpperCase();
        modeLabel.textContent = `VS AI (${difficultyText})`;
    }
    
    // Hide mode selection, show game UI
    document.getElementById('mode-select-overlay').classList.add('hidden');
    document.getElementById('ui-overlay').classList.remove('hidden');
    
    resetGame();
}

// ============================================
// INTERACTION
// ============================================
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function onMouseMove(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

function canPlayerMove() {
    if (gameState.gameOver) return false;
    if (gameState.isAIThinking) return false;
    if (gameState.mode === 'ai' && gameState.currentPlayer === 'O') return false;
    return true;
}

function onClick(event) {
    if (!canPlayerMove()) return;
    
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(clickTargets);
    
    if (intersects.length > 0) {
        const cellIndex = intersects[0].object.userData.cellIndex;
        handleMove(cellIndex);
    }
}

canvas.addEventListener('mousemove', onMouseMove);
canvas.addEventListener('click', onClick);
document.getElementById('reset-btn').addEventListener('click', resetGame);
document.getElementById('menu-btn').addEventListener('click', goToMainMenu);

// Touch support
canvas.addEventListener('touchstart', (event) => {
    event.preventDefault();
    const touch = event.touches[0];
    mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
    
    if (canPlayerMove()) {
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(clickTargets);
        if (intersects.length > 0) {
            handleMove(intersects[0].object.userData.cellIndex);
        }
    }
}, { passive: false });

// ============================================
// MODE SELECTION
// ============================================
let selectedMode = null;

document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        selectedMode = mode;
        
        // Update selection visual
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        
        if (mode === 'pvp') {
            // Start 2 player game immediately
            startGame('pvp');
        } else {
            // Show difficulty selection
            document.getElementById('difficulty-select').classList.remove('hidden');
        }
    });
});

document.querySelectorAll('.difficulty-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const difficulty = btn.dataset.difficulty;
        startGame('ai', difficulty);
    });
});

// ============================================
// WINDOW RESIZE
// ============================================
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onWindowResize);

// ============================================
// ANIMATION LOOP
// ============================================
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    
    const delta = clock.getDelta();
    const time = clock.getElapsedTime();
    
    // Update controls
    controls.update();
    
    // Animate pieces scale (entry animation)
    pieces.forEach(piece => {
        if (piece.userData.targetScale && piece.scale.x < piece.userData.targetScale) {
            const newScale = Math.min(piece.scale.x + delta * 5, piece.userData.targetScale);
            piece.scale.set(newScale, newScale, newScale);
        }
        
        // Winning pieces float animation
        if (piece.userData.isWinning) {
            piece.position.y = 0.15 + Math.sin(time * 3) * 0.1;
        }
    });
    
    // Subtle board rotation when idle
    if (!gameState.gameOver) {
        boardGroup.rotation.y = Math.sin(time * 0.3) * 0.05;
    }
    
    // Pulsing grid lines
    materials.gridLine.emissiveIntensity = 0.3 + Math.sin(time * 2) * 0.1;
    
    renderer.render(scene, camera);
}

// Initialize
updateUI();
animate();


