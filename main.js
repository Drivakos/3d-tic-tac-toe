import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Import modular components
import { GameState } from './js/game/GameState.js';
import { getGameStatus } from './js/game/GameLogic.js';
import { AIController } from './js/game/AI.js';
import { PLAYERS, GAME_MODES } from './js/game/constants.js';
import { 
    PeerManager, 
    MESSAGE_TYPES, 
    getRoomCodeFromUrl, 
    clearRoomCodeFromUrl,
    checkWebRTCSupport,
    getWebRTCDiagnostics
} from './js/multiplayer/PeerManager.js';
import { Timer, TIMER_PRESETS } from './js/game/Timer.js';

// ============================================
// GAME CONTROLLER
// ============================================
class GameController {
    constructor() {
        this.gameState = new GameState();
        this.scores = { X: 0, O: 0 };
        this.mode = null;
        this.aiController = null;
        this.peerManager = null;
        this.timerSeconds = 0;
        this.timer = null;
        this.onTimerTick = null;
        this.onTimerTimeout = null;
        
        // Bind methods
        this.handleMove = this.handleMove.bind(this);
        this.resetGame = this.resetGame.bind(this);
    }

    /**
     * Initialize a new game
     */
    startGame(mode, difficulty = null, timerSeconds = 0) {
        this.mode = mode;
        this.scores = { X: 0, O: 0 };
        this.timerSeconds = timerSeconds;
        this.gameState.resetGameNumber();
        this.gameState.reset(false);

        // Setup AI controller if needed
        if (mode === GAME_MODES.AI && difficulty) {
            this.aiController = new AIController(difficulty, PLAYERS.O);
            // Set timer based on difficulty if not specified
            if (timerSeconds === 0) {
                this.timerSeconds = TIMER_PRESETS[difficulty.toUpperCase()] || 0;
            }
        } else {
            this.aiController = null;
        }

        // Setup timer
        this.setupTimer();

        // Cleanup any existing peer connection
        if (this.peerManager && mode !== GAME_MODES.PVP_REMOTE) {
            this.peerManager.destroy();
            this.peerManager = null;
        }
    }

    /**
     * Start a remote multiplayer game
     */
    startRemoteGame(peerManager, timerSeconds = 0) {
        this.mode = GAME_MODES.PVP_REMOTE;
        this.peerManager = peerManager;
        this.scores = { X: 0, O: 0 };
        this.timerSeconds = timerSeconds;
        this.gameState.resetGameNumber();
        this.gameState.reset(false);
        this.aiController = null;
        this.setupTimer();
    }

    /**
     * Setup the move timer
     */
    setupTimer() {
        if (this.timer) {
            this.timer.stop();
        }

        if (this.timerSeconds > 0) {
            this.timer = new Timer(
                this.timerSeconds,
                (remaining, total) => {
                    if (this.onTimerTick) {
                        this.onTimerTick(remaining, total);
                    }
                },
                () => {
                    if (this.onTimerTimeout) {
                        this.onTimerTimeout();
                    }
                }
            );
        } else {
            this.timer = null;
        }
    }

    /**
     * Start the timer for current turn
     */
    startTimer() {
        if (this.timer && !this.gameState.isGameOver()) {
            this.timer.start();
        }
    }

    /**
     * Stop the timer
     */
    stopTimer() {
        if (this.timer) {
            this.timer.stop();
        }
    }

    /**
     * Check if timer is enabled
     */
    hasTimer() {
        return this.timerSeconds > 0 && this.timer !== null;
    }

    /**
     * Handle a move attempt
     */
    handleMove(cellIndex, isRemoteMove = false) {
        const currentPlayer = this.gameState.getCurrentPlayer();
        
        if (!this.gameState.placePiece(cellIndex, currentPlayer)) {
            return false;
        }

        // Send move to remote player
        if (this.isRemote() && !isRemoteMove) {
            this.peerManager.sendMove(cellIndex);
        }

        // Check game status
        const status = getGameStatus(this.gameState.getBoard());
        
        if (status.isOver) {
            this.gameState.setGameOver(status.winner, status.pattern);
            if (status.winner) {
                this.scores[status.winner]++;
            }
            return { moved: true, status };
        }

        this.gameState.switchPlayer();
        return { moved: true, status };
    }

    /**
     * Reset the current game
     * @param {boolean} sendToRemote - Whether to sync with remote player
     * @param {boolean} newRound - Whether this is a new round (alternates starting player)
     */
    resetGame(sendToRemote = true, newRound = true) {
        this.gameState.reset(newRound);
        
        // Host sends reset signal + full state sync for robustness
        if (this.isRemote() && sendToRemote && this.peerManager.isHost) {
            this.peerManager.sendReset();
            this.syncFullState();
        }
    }

    /**
     * Get full game state for syncing
     * @returns {Object} Complete game state
     */
    getFullState() {
        return {
            gameState: this.gameState.toJSON(),
            scores: { ...this.scores },
            timerSeconds: this.timerSeconds,
            gameStarted: gameStarted
        };
    }

    /**
     * Apply full game state from host
     * @param {Object} state - Complete game state
     */
    applyFullState(state) {
        if (state.gameState) {
            this.gameState.fromJSON(state.gameState);
        }
        if (state.scores) {
            this.scores = { ...state.scores };
        }
        if (state.timerSeconds !== undefined) {
            this.timerSeconds = state.timerSeconds;
        }
        if (state.gameStarted !== undefined) {
            gameStarted = state.gameStarted;
        }
    }

    /**
     * Send full state sync to remote player (Host only)
     */
    syncFullState() {
        if (!this.isRemote() || !this.peerManager.isHost) return;
        
        this.peerManager.sendFullSync(this.getFullState());
    }

    /**
     * Full reset for new match (resets game number too)
     */
    resetMatch() {
        this.stopTimer();
        this.gameState.resetGameNumber();
        this.gameState.reset(false);
        this.scores = { X: 0, O: 0 };
        this.timerSeconds = 0;
        this.timer = null;
    }

    /**
     * Check if it's a remote game
     */
    isRemote() {
        return this.mode === GAME_MODES.PVP_REMOTE && this.peerManager?.isConnected;
    }

    /**
     * Check if it's my turn (for remote games)
     */
    isMyTurn() {
        if (!this.isRemote()) return true;
        
        // In remote games, we need to account for role swapping each round
        // Host is always "physical P1", Guest is always "physical P2"
        // getPlayerAsX() returns 1 if P1 is X this round, 2 if P2 is X
        const currentPlayer = this.gameState.getCurrentPlayer();
        const playerAsX = this.gameState.getPlayerAsX();
        const amIHost = this.peerManager.isHost;
        
        // Determine if I'm currently X or O based on round
        const myCurrentRole = amIHost 
            ? (playerAsX === 1 ? PLAYERS.X : PLAYERS.O)  // Host is P1
            : (playerAsX === 2 ? PLAYERS.X : PLAYERS.O); // Guest is P2
        
        return currentPlayer === myCurrentRole;
    }

    /**
     * Get my role in remote game
     */
    getMyRole() {
        return this.peerManager?.myRole || null;
    }

    /**
     * Check if it's the AI's turn
     */
    isAITurn() {
        return this.mode === GAME_MODES.AI && 
               this.gameState.getCurrentPlayer() === PLAYERS.O &&
               !this.gameState.isGameOver();
    }

    /**
     * Check if player can make a move
     */
    canMove() {
        if (this.gameState.isGameOver()) return false;
        if (this.aiController?.isThinking) return false;
        if (this.mode === GAME_MODES.AI && this.gameState.getCurrentPlayer() === PLAYERS.O) return false;
        if (this.isRemote() && !this.isMyTurn()) return false;
        return true;
    }

    /**
     * Trigger AI move if it's AI's turn
     */
    async triggerAIMove() {
        if (this.mode !== GAME_MODES.AI) return;
        if (this.gameState.getCurrentPlayer() !== PLAYERS.O) return;
        if (this.gameState.isGameOver()) return;

        const move = await this.aiController.getMove(this.gameState.getBoard());
        if (move !== null) {
            return this.handleMove(move);
        }
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        this.stopTimer();
        if (this.peerManager) {
            this.peerManager.destroy();
            this.peerManager = null;
        }
    }
}

// Create game controller instance
const game = new GameController();

// UI state
let selectedPvpType = null;
window.selectedRemoteTimer = 0;

/**
 * Get player label (P1 or P2) for a given piece (X or O)
 * This accounts for role swapping each round
 */
function getPlayerLabel(piece) {
    const playerAsX = game.gameState.getPlayerAsX();
    if (piece === PLAYERS.X) {
        return `P${playerAsX}`;
    } else {
        return `P${playerAsX === 1 ? 2 : 1}`;
    }
}

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
    alpha: true,
    powerPreference: 'high-performance'
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.outputColorSpace = THREE.SRGBColorSpace;

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
// Subtle ambient for base illumination
const ambientLight = new THREE.AmbientLight(0x1a1a2e, 0.4);
scene.add(ambientLight);

// Hemisphere light for natural sky/ground color variation
const hemiLight = new THREE.HemisphereLight(0x0a0a1a, 0x000000, 0.3);
scene.add(hemiLight);

// Main directional light with improved shadows
const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
mainLight.position.set(5, 12, 7);
mainLight.castShadow = true;
mainLight.shadow.mapSize.width = 4096;
mainLight.shadow.mapSize.height = 4096;
mainLight.shadow.camera.near = 0.5;
mainLight.shadow.camera.far = 50;
mainLight.shadow.camera.left = -10;
mainLight.shadow.camera.right = 10;
mainLight.shadow.camera.top = 10;
mainLight.shadow.camera.bottom = -10;
mainLight.shadow.bias = -0.0001;
mainLight.shadow.normalBias = 0.02;
mainLight.shadow.radius = 2;
scene.add(mainLight);

// Secondary fill light (softer, from opposite side)
const fillLight = new THREE.DirectionalLight(0x4466aa, 0.4);
fillLight.position.set(-5, 8, -5);
scene.add(fillLight);

// Cyan accent light with shadows
const cyanLight = new THREE.PointLight(0x00f5ff, 1.5, 25);
cyanLight.position.set(-4, 4, -4);
cyanLight.castShadow = true;
cyanLight.shadow.mapSize.width = 1024;
cyanLight.shadow.mapSize.height = 1024;
cyanLight.shadow.bias = -0.001;
scene.add(cyanLight);

// Magenta accent light with shadows
const magentaLight = new THREE.PointLight(0xff00aa, 1.2, 25);
magentaLight.position.set(4, 4, 4);
magentaLight.castShadow = true;
magentaLight.shadow.mapSize.width = 1024;
magentaLight.shadow.mapSize.height = 1024;
magentaLight.shadow.bias = -0.001;
scene.add(magentaLight);

// Rim light from behind for edge definition
const rimLight = new THREE.SpotLight(0x6644ff, 0.8, 30, Math.PI / 6, 0.5);
rimLight.position.set(0, 8, -8);
rimLight.target.position.set(0, 0, 0);
scene.add(rimLight);
scene.add(rimLight.target);

// ============================================
// MATERIALS
// ============================================
// Create a simple environment map for reflections
const envMapTexture = new THREE.CubeTextureLoader().load([
    // px, nx, py, ny, pz, nz - using data URLs for small gradient colors
    createGradientDataURL(0x0a0a1a, 0x00f5ff),
    createGradientDataURL(0x0a0a1a, 0xff00aa),
    createGradientDataURL(0x1a1a3a, 0x2a2a4a),
    createGradientDataURL(0x000000, 0x0a0a1a),
    createGradientDataURL(0x0a0a1a, 0x00f5ff),
    createGradientDataURL(0x0a0a1a, 0xff00aa)
]);

// Helper to create simple gradient images for env map
function createGradientDataURL(color1, color2) {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 64, 64);
    gradient.addColorStop(0, `#${color1.toString(16).padStart(6, '0')}`);
    gradient.addColorStop(1, `#${color2.toString(16).padStart(6, '0')}`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    return canvas.toDataURL();
}

// Custom procedural env map
const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();

// Create scene environment from gradient
const envScene = new THREE.Scene();
const envGeometry = new THREE.SphereGeometry(50, 32, 32);
const envMaterial = new THREE.MeshBasicMaterial({
    side: THREE.BackSide,
    vertexColors: true
});

// Add vertex colors for gradient effect
const colors = [];
const positions = envGeometry.attributes.position;
for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i);
    const t = (y + 50) / 100;
    // Dark purple at bottom, dark blue at top
    colors.push(
        THREE.MathUtils.lerp(0.02, 0.04, t),
        THREE.MathUtils.lerp(0.02, 0.03, t),
        THREE.MathUtils.lerp(0.05, 0.12, t)
    );
}
envGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
const envMesh = new THREE.Mesh(envGeometry, envMaterial);
envScene.add(envMesh);

const envMap = pmremGenerator.fromScene(envScene, 0.04).texture;
scene.environment = envMap;

const materials = {
    board: new THREE.MeshStandardMaterial({
        color: 0x12121f,
        metalness: 0.6,
        roughness: 0.35,
        envMapIntensity: 0.8
    }),
    boardTop: new THREE.MeshStandardMaterial({
        color: 0x0d0d18,
        metalness: 0.7,
        roughness: 0.25,
        envMapIntensity: 1.0
    }),
    gridLine: new THREE.MeshStandardMaterial({
        color: 0x00f5ff,
        emissive: 0x00f5ff,
        emissiveIntensity: 0.4,
        metalness: 0.95,
        roughness: 0.05,
        envMapIntensity: 1.5
    }),
    playerX: new THREE.MeshPhysicalMaterial({
        color: 0x00f5ff,
        emissive: 0x00f5ff,
        emissiveIntensity: 0.6,
        metalness: 1.0,
        roughness: 0.08,
        clearcoat: 0.8,
        clearcoatRoughness: 0.1,
        envMapIntensity: 2.0,
        reflectivity: 1.0
    }),
    playerO: new THREE.MeshPhysicalMaterial({
        color: 0xff00aa,
        emissive: 0xff00aa,
        emissiveIntensity: 0.6,
        metalness: 1.0,
        roughness: 0.08,
        clearcoat: 0.8,
        clearcoatRoughness: 0.1,
        envMapIntensity: 2.0,
        reflectivity: 1.0
    }),
    winHighlight: new THREE.MeshPhysicalMaterial({
        color: 0xffd700,
        emissive: 0xffd700,
        emissiveIntensity: 1.0,
        metalness: 1.0,
        roughness: 0.05,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05,
        envMapIntensity: 2.5,
        reflectivity: 1.0
    }),
    ground: new THREE.MeshStandardMaterial({
        color: 0x050508,
        metalness: 0.9,
        roughness: 0.15,
        envMapIntensity: 0.5
    })
};

// ============================================
// SCENE ATMOSPHERE
// ============================================
// Add subtle fog for depth
scene.fog = new THREE.FogExp2(0x050510, 0.025);

// Ground plane for reflections
const groundGeometry = new THREE.PlaneGeometry(100, 100);
const groundPlane = new THREE.Mesh(groundGeometry, materials.ground);
groundPlane.rotation.x = -Math.PI / 2;
groundPlane.position.y = -0.5;
groundPlane.receiveShadow = true;
scene.add(groundPlane);

// ============================================
// GAME BOARD
// ============================================
const boardGroup = new THREE.Group();
scene.add(boardGroup);

const CELL_SIZE = 2;
const BOARD_SIZE = CELL_SIZE * 3;
const GAP = 0.1;

// Base platform with beveled edges (using multiple layers)
function createPlatform() {
    const group = new THREE.Group();
    
    // Main platform body
    const mainGeometry = new THREE.BoxGeometry(BOARD_SIZE + 0.8, 0.25, BOARD_SIZE + 0.8);
    const main = new THREE.Mesh(mainGeometry, materials.board);
    main.position.y = -0.25;
    main.castShadow = true;
    main.receiveShadow = true;
    group.add(main);
    
    // Top surface (slightly smaller, darker)
    const topGeometry = new THREE.BoxGeometry(BOARD_SIZE + 0.6, 0.08, BOARD_SIZE + 0.6);
    const top = new THREE.Mesh(topGeometry, materials.boardTop);
    top.position.y = -0.08;
    top.receiveShadow = true;
    group.add(top);
    
    // Bevel/edge trim (glowing accent)
    const edgeGeometry = new THREE.BoxGeometry(BOARD_SIZE + 0.85, 0.02, BOARD_SIZE + 0.85);
    const edgeMaterial = new THREE.MeshStandardMaterial({
        color: 0x00f5ff,
        emissive: 0x00f5ff,
        emissiveIntensity: 0.15,
        metalness: 0.9,
        roughness: 0.2
    });
    const edge = new THREE.Mesh(edgeGeometry, edgeMaterial);
    edge.position.y = -0.12;
    group.add(edge);
    
    // Corner accents
    const cornerGeometry = new THREE.CylinderGeometry(0.15, 0.15, 0.3, 8);
    const cornerMaterial = new THREE.MeshPhysicalMaterial({
        color: 0x00f5ff,
        emissive: 0x00f5ff,
        emissiveIntensity: 0.3,
        metalness: 1.0,
        roughness: 0.1,
        clearcoat: 0.5
    });
    
    const cornerPositions = [
        [-BOARD_SIZE/2 - 0.3, -0.2, -BOARD_SIZE/2 - 0.3],
        [BOARD_SIZE/2 + 0.3, -0.2, -BOARD_SIZE/2 - 0.3],
        [-BOARD_SIZE/2 - 0.3, -0.2, BOARD_SIZE/2 + 0.3],
        [BOARD_SIZE/2 + 0.3, -0.2, BOARD_SIZE/2 + 0.3]
    ];
    
    cornerPositions.forEach(pos => {
        const corner = new THREE.Mesh(cornerGeometry, cornerMaterial);
        corner.position.set(...pos);
        corner.castShadow = true;
        group.add(corner);
    });
    
    return group;
}

const platform = createPlatform();
boardGroup.add(platform);

// Grid lines with improved geometry
function createGridLines() {
    const gridGroup = new THREE.Group();
    
    // Vertical lines
    const vLineGeometry = new THREE.BoxGeometry(0.06, 0.12, BOARD_SIZE - 0.3);
    for (let i = -1; i <= 1; i += 2) {
        const line = new THREE.Mesh(vLineGeometry, materials.gridLine.clone());
        line.position.set(i * (CELL_SIZE / 2 + GAP / 2), 0.02, 0);
        line.castShadow = true;
        line.receiveShadow = true;
        gridGroup.add(line);
    }
    
    // Horizontal lines
    const hLineGeometry = new THREE.BoxGeometry(BOARD_SIZE - 0.3, 0.12, 0.06);
    for (let i = -1; i <= 1; i += 2) {
        const line = new THREE.Mesh(hLineGeometry, materials.gridLine.clone());
        line.position.set(0, 0.02, i * (CELL_SIZE / 2 + GAP / 2));
        line.castShadow = true;
        line.receiveShadow = true;
        gridGroup.add(line);
    }
    
    return gridGroup;
}

const gridLines = createGridLines();
boardGroup.add(gridLines);

// Click targets
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
// AMBIENT PARTICLES
// ============================================
const particleCount = 150;
const particleGeometry = new THREE.BufferGeometry();
const particlePositions = new Float32Array(particleCount * 3);
const particleSizes = new Float32Array(particleCount);

for (let i = 0; i < particleCount; i++) {
    particlePositions[i * 3] = (Math.random() - 0.5) * 30;
    particlePositions[i * 3 + 1] = Math.random() * 15;
    particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 30;
    particleSizes[i] = Math.random() * 0.05 + 0.02;
}

particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
particleGeometry.setAttribute('size', new THREE.BufferAttribute(particleSizes, 1));

const particleMaterial = new THREE.PointsMaterial({
    color: 0x00f5ff,
    size: 0.08,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true
});

const particles = new THREE.Points(particleGeometry, particleMaterial);
scene.add(particles);

// ============================================
// GAME PIECES
// ============================================
const pieces = [];

function createX(cellIndex) {
    const group = new THREE.Group();
    
    // Create X using two crossed rounded cylinders for proper shadows and reflections
    const armLength = 1.1;      // Total length of each arm
    const tubeRadius = 0.1;     // Same tube radius as the O's torus
    const radialSegments = 24;  // Smooth curved surface for nice reflections
    const capSegments = 12;     // Rounded end caps
    
    // Create a capsule-like geometry (cylinder with hemisphere caps)
    function createRoundedArm() {
        const armGroup = new THREE.Group();
        
        // Main cylinder body
        const cylinderGeometry = new THREE.CylinderGeometry(
            tubeRadius, tubeRadius, armLength - tubeRadius * 2, radialSegments
        );
        const cylinder = new THREE.Mesh(cylinderGeometry, materials.playerX.clone());
        cylinder.castShadow = true;
        cylinder.receiveShadow = true;
        armGroup.add(cylinder);
        
        // Top hemisphere cap
        const topCapGeometry = new THREE.SphereGeometry(
            tubeRadius, radialSegments, capSegments, 0, Math.PI * 2, 0, Math.PI / 2
        );
        const topCap = new THREE.Mesh(topCapGeometry, materials.playerX.clone());
        topCap.position.y = (armLength - tubeRadius * 2) / 2;
        topCap.castShadow = true;
        topCap.receiveShadow = true;
        armGroup.add(topCap);
        
        // Bottom hemisphere cap
        const bottomCapGeometry = new THREE.SphereGeometry(
            tubeRadius, radialSegments, capSegments, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2
        );
        const bottomCap = new THREE.Mesh(bottomCapGeometry, materials.playerX.clone());
        bottomCap.position.y = -(armLength - tubeRadius * 2) / 2;
        bottomCap.castShadow = true;
        bottomCap.receiveShadow = true;
        armGroup.add(bottomCap);
        
        return armGroup;
    }
    
    // First diagonal arm (top-left to bottom-right)
    const arm1 = createRoundedArm();
    arm1.rotation.z = Math.PI / 4;  // 45 degrees
    arm1.rotation.x = Math.PI / 2;  // Lay flat
    group.add(arm1);
    
    // Second diagonal arm (top-right to bottom-left)
    const arm2 = createRoundedArm();
    arm2.rotation.z = -Math.PI / 4; // -45 degrees
    arm2.rotation.x = Math.PI / 2;  // Lay flat
    group.add(arm2);
    
    // Add subtle X-shaped glow using two crossed rounded rectangles
    const glowArmLength = armLength * 0.85;  // Slightly smaller than actual X
    const glowArmWidth = tubeRadius * 2.5;   // Slightly wider than tube for soft glow
    
    const glowMaterial = new THREE.MeshBasicMaterial({
        color: 0x00f5ff,
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide
    });
    
    // First glow arm (diagonal)
    const glowArm1Geometry = new THREE.PlaneGeometry(glowArmWidth, glowArmLength);
    const glowArm1 = new THREE.Mesh(glowArm1Geometry, glowMaterial);
    glowArm1.rotation.x = -Math.PI / 2;
    glowArm1.rotation.z = Math.PI / 4;
    glowArm1.position.y = -0.08;
    glowArm1.castShadow = false;
    glowArm1.receiveShadow = false;
    group.add(glowArm1);
    
    // Second glow arm (diagonal, crossed)
    const glowArm2Geometry = new THREE.PlaneGeometry(glowArmWidth, glowArmLength);
    const glowArm2 = new THREE.Mesh(glowArm2Geometry, glowMaterial);
    glowArm2.rotation.x = -Math.PI / 2;
    glowArm2.rotation.z = -Math.PI / 4;
    glowArm2.position.y = -0.08;
    glowArm2.castShadow = false;
    glowArm2.receiveShadow = false;
    group.add(glowArm2);
    
    const row = Math.floor(cellIndex / 3);
    const col = cellIndex % 3;
    group.position.set((col - 1) * CELL_SIZE, 0.15, (row - 1) * CELL_SIZE);
    
    group.scale.set(0, 0, 0);
    group.userData.targetScale = 1;
    group.userData.cellIndex = cellIndex;
    
    return group;
}

function createO(cellIndex) {
    const group = new THREE.Group();
    
    // Main torus with higher detail
    const torusRadius = 0.5;
    const tubeRadius = 0.1;
    const geometry = new THREE.TorusGeometry(torusRadius, tubeRadius, 24, 48);
    const mesh = new THREE.Mesh(geometry, materials.playerO.clone());
    mesh.rotation.x = -Math.PI / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    
    // Add subtle glow ring underneath - proportional to the torus
    const glowInnerRadius = torusRadius - tubeRadius * 1.2;  // Slightly inside inner edge
    const glowOuterRadius = torusRadius + tubeRadius * 1.2;  // Slightly outside outer edge
    const glowGeometry = new THREE.RingGeometry(glowInnerRadius, glowOuterRadius, 48);
    const glowMaterial = new THREE.MeshBasicMaterial({
        color: 0xff00aa,
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = -0.08;
    glow.castShadow = false;
    glow.receiveShadow = false;
    group.add(glow);
    
    const row = Math.floor(cellIndex / 3);
    const col = cellIndex % 3;
    group.position.set((col - 1) * CELL_SIZE, 0.2, (row - 1) * CELL_SIZE);
    
    group.scale.set(0, 0, 0);
    group.userData.targetScale = 1;
    group.userData.cellIndex = cellIndex;
    
    return group;
}

function addPieceToBoard(cellIndex, player) {
    const piece = player === PLAYERS.X ? createX(cellIndex) : createO(cellIndex);
    boardGroup.add(piece);
    pieces.push(piece);
    return piece;
}

function clearPieces() {
    pieces.forEach(piece => boardGroup.remove(piece));
    pieces.length = 0;
}

function highlightWinningPieces(pattern) {
    pieces.forEach(piece => {
        if (pattern.includes(piece.userData.cellIndex)) {
            // Both X and O are now groups
            piece.children.forEach(child => {
                if (child.material && child.material.color) {
                    // Skip glow meshes (keep them subtle)
                    if (child.material.opacity && child.material.opacity < 1) {
                        child.material = child.material.clone();
                        child.material.color.setHex(0xffd700);
                        child.material.opacity = 0.3;
                    } else {
                        child.material = materials.winHighlight.clone();
                    }
                }
            });
            piece.userData.isWinning = true;
        }
    });
}

function rebuildBoardFromState() {
    clearPieces();
    const board = game.gameState.getBoard();
    board.forEach((cell, index) => {
        if (cell) {
            const piece = addPieceToBoard(index, cell);
            piece.scale.set(1, 1, 1);
        }
    });
}

// ============================================
// UI MANAGEMENT
// ============================================
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
    const currentPlayer = game.gameState.getCurrentPlayer();
    
    if (game.mode === GAME_MODES.AI) {
        if (currentPlayer === PLAYERS.X) {
            playerEl.textContent = getPlayerLabel(PLAYERS.X);
        } else {
            playerEl.textContent = game.aiController?.isThinking ? 'AI...' : 'AI';
        }
    } else {
        // Show which player's turn it is
        playerEl.textContent = getPlayerLabel(currentPlayer);
    }
    
    playerEl.className = `player-${currentPlayer.toLowerCase()}`;
    
    document.getElementById('score-x').textContent = game.scores.X;
    document.getElementById('score-o').textContent = game.scores.O;
    
    const scoreLabelX = document.querySelector('.player-x-score .score-label');
    const scoreLabelO = document.querySelector('.player-o-score .score-label');
    
    if (game.mode === GAME_MODES.AI) {
        scoreLabelX.textContent = getPlayerLabel(PLAYERS.X);
        scoreLabelO.textContent = 'AI';
    } else {
        // Show which player is X and which is O this round
        scoreLabelX.textContent = getPlayerLabel(PLAYERS.X);
        scoreLabelO.textContent = getPlayerLabel(PLAYERS.O);
    }
    
    if (game.isRemote()) {
        updateRemoteTurnIndicator();
    }
}

function updateRemoteTurnIndicator() {
    const turnIndicator = document.getElementById('turn-indicator');
    const turnText = document.getElementById('turn-text');
    const isMyTurn = game.isMyTurn();
    const currentPlayer = game.gameState.getCurrentPlayer();
    const playerLabel = getPlayerLabel(currentPlayer);
    
    turnIndicator.className = isMyTurn ? 'your-turn' : 'waiting';
    turnText.textContent = isMyTurn ? 'Your turn!' : `${playerLabel}'s turn...`;
}

function hideAllModeScreens() {
    document.getElementById('mode-buttons').classList.remove('hidden');
    document.getElementById('pvp-type-select').classList.add('hidden');
    document.getElementById('timer-select').classList.add('hidden');
    document.getElementById('remote-setup').classList.add('hidden');
    document.getElementById('waiting-room').classList.add('hidden');
    document.getElementById('connection-status').classList.add('hidden');
    document.getElementById('difficulty-select').classList.add('hidden');
}

// ============================================
// DUAL TIMER UI
// ============================================
// Track remaining time for both players
const playerTimers = {
    X: { remaining: 0, total: 0 },
    O: { remaining: 0, total: 0 }
};

// Track if first move has been made (for delayed timer start)
let gameStarted = false;
let lastTimerSync = 0;

// Timer UI constants
const TIMER_SYNC_INTERVAL = 500; // Throttle sync to every 500ms
const TIMER_CRITICAL_SECONDS = 2;
const TIMER_WARNING_THRESHOLD = 0.4; // 40% remaining

function initializePlayerTimers(total) {
    playerTimers.X = { remaining: total, total };
    playerTimers.O = { remaining: total, total };
}

function updateTimerUI(remaining, total) {
    const timersContainer = document.getElementById('timers-container');
    
    if (!game.hasTimer()) {
        timersContainer.classList.add('hidden');
        return;
    }
    
    timersContainer.classList.remove('hidden');
    
    // Update current player's remaining time
    const currentPlayer = game.gameState.getCurrentPlayer();
    playerTimers[currentPlayer].remaining = remaining;
    playerTimers[currentPlayer].total = total;
    
    // Sync timer to remote opponent (throttled to avoid network flooding)
    const now = Date.now();
    if (game.isRemote() && game.peerManager && game.isMyTurn() && 
        now - lastTimerSync > TIMER_SYNC_INTERVAL) {
        game.peerManager.sendTimerSync(remaining, currentPlayer);
        lastTimerSync = now;
    }
    
    // Update both timer displays
    updatePlayerTimerDisplay('p1', PLAYERS.X);
    updatePlayerTimerDisplay('p2', PLAYERS.O);
    
    // Highlight active player
    const timerP1 = document.getElementById('timer-p1');
    const timerP2 = document.getElementById('timer-p2');
    
    timerP1.classList.toggle('active', currentPlayer === PLAYERS.X);
    timerP2.classList.toggle('active', currentPlayer === PLAYERS.O);
}

function updatePlayerTimerDisplay(timerId, player) {
    const timerEl = document.getElementById(`timer-${timerId}`);
    const timerFill = timerEl.querySelector('.timer-fill');
    const timerText = timerEl.querySelector('.timer-text');
    
    const { remaining, total } = playerTimers[player];
    const progress = total > 0 ? remaining / total : 1;
    
    timerFill.style.width = `${progress * 100}%`;
    timerText.textContent = Math.ceil(remaining);
    
    // Color based on time remaining
    timerFill.classList.remove('warning', 'critical');
    timerText.classList.remove('warning', 'critical');
    
    // Only show warning colors for the active player
    if (game.gameState.getCurrentPlayer() === player) {
        if (remaining <= TIMER_CRITICAL_SECONDS) {
            timerFill.classList.add('critical');
            timerText.classList.add('critical');
        } else if (remaining <= total * TIMER_WARNING_THRESHOLD) {
            timerFill.classList.add('warning');
            timerText.classList.add('warning');
        }
    }
}

function hideTimerUI() {
    document.getElementById('timers-container').classList.add('hidden');
}

function resetTimerDisplays() {
    const total = game.timerSeconds;
    initializePlayerTimers(total);
    
    const timersContainer = document.getElementById('timers-container');
    
    if (game.hasTimer()) {
        // Show the timers container
        timersContainer.classList.remove('hidden');
        
        // Update timer labels based on who is X this round
        const timerP1Label = document.querySelector('#timer-p1 .timer-label');
        const timerP2Label = document.querySelector('#timer-p2 .timer-label');
        timerP1Label.textContent = getPlayerLabel(PLAYERS.X);
        timerP2Label.textContent = getPlayerLabel(PLAYERS.O);
        
        updatePlayerTimerDisplay('p1', PLAYERS.X);
        updatePlayerTimerDisplay('p2', PLAYERS.O);
        
        // Reset active states
        document.getElementById('timer-p1').classList.remove('active');
        document.getElementById('timer-p2').classList.remove('active');
        
        // Set initial active player (X always starts)
        document.getElementById('timer-p1').classList.add('active');
    } else {
        timersContainer.classList.add('hidden');
    }
}

function handleTimerTimeout() {
    // Time ran out - current player loses
    const currentPlayer = game.gameState.getCurrentPlayer();
    const winner = currentPlayer === PLAYERS.X ? PLAYERS.O : PLAYERS.X;
    
    // Notify remote opponent about timeout
    if (game.isRemote() && game.peerManager) {
        game.peerManager.sendTimerTimeout(currentPlayer);
    }
    
    applyTimerTimeout(currentPlayer);
}

function applyTimerTimeout(timedOutPlayer) {
    const winner = timedOutPlayer === PLAYERS.X ? PLAYERS.O : PLAYERS.X;
    
    game.gameState.setGameOver(winner, null);
    game.scores[winner]++;
    
    if (game.mode === GAME_MODES.AI) {
        if (winner === PLAYERS.O) {
            showMessage('TIME UP! AI WINS!');
        } else {
            showMessage(`TIME UP! ${getPlayerLabel(winner)} WINS!`);
        }
    } else {
        showMessage(`TIME UP! ${getPlayerLabel(winner)} WINS!`);
    }
    
    updateUI();
}

// Setup timer callbacks
game.onTimerTick = updateTimerUI;
game.onTimerTimeout = handleTimerTimeout;

function showConnectionStatus(message) {
    hideAllModeScreens();
    document.getElementById('connection-status').classList.remove('hidden');
    document.getElementById('connection-message').textContent = message;
}

function hideConnectionStatus() {
    document.getElementById('connection-status').classList.add('hidden');
}

function showWaitingRoom() {
    hideAllModeScreens();
    document.getElementById('waiting-room').classList.remove('hidden');
}

// ============================================
// GAME FLOW
// ============================================
async function handleCellClick(cellIndex) {
    if (!game.canMove()) return;
    
    // Stop timer on move
    game.stopTimer();
    
    // Mark game as started (for delayed timer start in remote games)
    gameStarted = true;
    
    const result = game.handleMove(cellIndex);
    if (!result || !result.moved) return;
    
    addPieceToBoard(cellIndex, game.gameState.getBoard()[cellIndex]);
    
    // Note: Move is sent in game.handleMove() - no duplicate send needed
    
    if (result.status.isOver) {
        if (result.status.winner) {
            highlightWinningPieces(result.status.pattern);
            
            if (game.mode === GAME_MODES.AI) {
                showMessage(result.status.winner === PLAYERS.X ? `${getPlayerLabel(PLAYERS.X)} WINS!` : 'AI WINS!');
            } else {
                showMessage(`${getPlayerLabel(result.status.winner)} WINS!`);
            }
        } else {
            showMessage('DRAW!');
        }
    } else {
        // Game continues - start timer for next player (if not AI turn)
        if (!game.isAITurn() && game.hasTimer()) {
            game.startTimer();
        }
    }
    
    updateUI();
    
    // Trigger AI move if needed
    if (game.mode === GAME_MODES.AI && !game.gameState.isGameOver()) {
        // AI doesn't need timer running during its turn
        const aiResult = await game.triggerAIMove();
        if (aiResult?.moved) {
            const board = game.gameState.getBoard();
            const aiCellIndex = board.findIndex((cell, idx) => 
                cell === PLAYERS.O && !pieces.some(p => p.userData.cellIndex === idx)
            );
            if (aiCellIndex !== -1) {
                addPieceToBoard(aiCellIndex, PLAYERS.O);
            }
            
            if (aiResult.status.isOver) {
                if (aiResult.status.winner) {
                    highlightWinningPieces(aiResult.status.pattern);
                    showMessage(aiResult.status.winner === PLAYERS.X ? `${getPlayerLabel(PLAYERS.X)} WINS!` : 'AI WINS!');
                } else {
                    showMessage('DRAW!');
                }
            } else {
                // Start timer for player's turn after AI move
                if (game.hasTimer()) {
                    game.startTimer();
                }
            }
            updateUI();
        }
    }
}

function handleRemoteMove(cellIndex) {
    // Stop timer when opponent moves
    game.stopTimer();
    
    // Mark game as started
    gameStarted = true;
    
    const result = game.handleMove(cellIndex, true);
    if (result?.moved) {
        addPieceToBoard(cellIndex, game.gameState.getBoard()[cellIndex]);
        
        if (result.status.isOver) {
            if (result.status.winner) {
                highlightWinningPieces(result.status.pattern);
                showMessage(`${getPlayerLabel(result.status.winner)} WINS!`);
            } else {
                showMessage('DRAW!');
            }
        } else {
            // My turn now - start timer
            if (game.hasTimer()) {
                game.startTimer();
            }
        }
        updateUI();
    }
}

function resetGameUI() {
    clearPieces();
    hideMessage();
    
    // Reset timer displays for both players
    if (game.hasTimer()) {
        resetTimerDisplays();
    } else {
        hideTimerUI();
    }
    
    // Update role display color for remote games
    if (game.isRemote()) {
        updateRoleDisplay();
    }
    
    updateUI();
}

function updateRoleDisplay() {
    const roleValue = document.getElementById('role-value');
    if (!roleValue || !game.peerManager) return;
    
    const amIHost = game.peerManager.isHost;
    const playerAsX = game.gameState.getPlayerAsX();
    
    // Am I X this round?
    const amIX = (amIHost && playerAsX === 1) || (!amIHost && playerAsX === 2);
    
    // Update color to show what piece I'm playing
    roleValue.className = amIX ? 'player-x' : 'player-o';
}

function startLocalGame(mode, difficulty = null, timerSeconds = 0) {
    game.startGame(mode, difficulty, timerSeconds);
    
    const modeLabel = document.getElementById('game-mode-label');
    if (mode === GAME_MODES.PVP_LOCAL) {
        const timerLabel = timerSeconds > 0 ? ` (${timerSeconds}s)` : '';
        modeLabel.textContent = `LOCAL${timerLabel}`;
    } else if (mode === GAME_MODES.AI) {
        modeLabel.textContent = `VS AI (${difficulty.toUpperCase()})`;
    }
    
    document.getElementById('your-role').classList.add('hidden');
    document.getElementById('turn-indicator').classList.add('hidden');
    
    document.getElementById('mode-select-overlay').classList.add('hidden');
    document.getElementById('ui-overlay').classList.remove('hidden');
    
    // Initialize both player timers
    if (timerSeconds > 0) {
        initializePlayerTimers(timerSeconds);
    }
    
    resetGameUI();
    
    // Start timer for first turn
    if (game.hasTimer()) {
        game.startTimer();
    }
}

function startRemoteGameUI(peerManager, timerSeconds = 0) {
    game.startRemoteGame(peerManager, timerSeconds);
    gameStarted = false; // Timer starts on first move
    
    const timerLabel = timerSeconds > 0 ? ` (${timerSeconds}s)` : '';
    document.getElementById('game-mode-label').textContent = `REMOTE${timerLabel}`;
    
    // Show role as P1 or P2 (Host = P1, Guest = P2)
    document.getElementById('your-role').classList.remove('hidden');
    const amIHost = peerManager.isHost;
    const myPlayerNum = amIHost ? 1 : 2;
    document.getElementById('role-value').textContent = `P${myPlayerNum}`;
    // Color will be updated in updateRoleDisplay()
    
    document.getElementById('turn-indicator').classList.remove('hidden');
    
    hideAllModeScreens();
    document.getElementById('mode-select-overlay').classList.add('hidden');
    document.getElementById('ui-overlay').classList.remove('hidden');
    
    // Initialize both player timers
    if (timerSeconds > 0) {
        initializePlayerTimers(timerSeconds);
    }
    
    resetGameUI();
    
    // Don't start timer yet - wait for first move
    // Timer will start when P1 makes their first move
}

function goToMainMenu() {
    game.cleanup();
    game.resetMatch();
    game.mode = null;
    gameStarted = false;
    window.selectedRemoteTimer = 0;
    selectedPvpType = null;
    
    document.getElementById('your-role').classList.add('hidden');
    document.getElementById('turn-indicator').classList.add('hidden');
    hideTimerUI();
    hideRematchModals();
    
    document.getElementById('mode-select-overlay').classList.remove('hidden');
    document.getElementById('ui-overlay').classList.add('hidden');
    
    hideAllModeScreens();
    document.getElementById('mode-buttons').classList.remove('hidden');
    
    document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('selected'));
    document.querySelectorAll('.timer-btn').forEach(btn => btn.classList.remove('selected'));
    
    resetGameUI();
}

// ============================================
// REMOTE MULTIPLAYER
// ============================================
async function createRoom() {
    // Check WebRTC support first
    const webrtcCheck = checkWebRTCSupport();
    console.log('WebRTC check:', webrtcCheck);
    console.log('WebRTC diagnostics:', getWebRTCDiagnostics());
    
    if (!webrtcCheck.supported) {
        showConnectionStatus(webrtcCheck.reason);
        setTimeout(() => {
            hideConnectionStatus();
            document.getElementById('remote-setup').classList.remove('hidden');
        }, 5000);
        return;
    }
    
    showConnectionStatus('Creating room...');
    
    const timerSeconds = window.selectedRemoteTimer || 0;
    
    try {
        const peerManager = new PeerManager();
        
        // Set game settings so they're sent to joiner
        peerManager.setGameSettings({ timerSeconds });
        
        peerManager.onConnect = (info) => {
            startRemoteGameUI(peerManager, timerSeconds);
        };
        
        peerManager.onMessage = (data) => {
            handleRemoteMessage(data, peerManager);
        };
        
        peerManager.onDisconnect = () => {
            hideRematchModals();
            if (!game.gameState.isGameOver()) {
                showMessage('OPPONENT DISCONNECTED');
                game.gameState.setGameOver();
            }
        };
        
        peerManager.onError = (err) => {
            console.error('PeerManager error:', err);
            console.log('Diagnostics:', getWebRTCDiagnostics());
        };
        
        await peerManager.initialize();
        
        document.getElementById('room-code-value').textContent = peerManager.roomCode;
        document.getElementById('share-link').value = peerManager.getShareableLink();
        
        hideConnectionStatus();
        showWaitingRoom();
        
        game.peerManager = peerManager;
    } catch (err) {
        console.error('Failed to create room:', err);
        console.log('Diagnostics:', getWebRTCDiagnostics());
        
        let errorMsg = 'Failed to create room. Please try again.';
        if (err.message?.includes('WebRTC')) {
            errorMsg = 'WebRTC error. Make sure you are using HTTPS or localhost.';
        } else if (err.type === 'browser-incompatible') {
            errorMsg = 'Browser not compatible. Try Chrome, Firefox, or Safari.';
        }
        
        showConnectionStatus(errorMsg);
        setTimeout(() => {
            hideConnectionStatus();
            document.getElementById('remote-setup').classList.remove('hidden');
        }, 4000);
    }
}

async function joinRoom(roomCode) {
    // Check WebRTC support first
    const webrtcCheck = checkWebRTCSupport();
    console.log('WebRTC check:', webrtcCheck);
    console.log('WebRTC diagnostics:', getWebRTCDiagnostics());
    
    if (!webrtcCheck.supported) {
        showConnectionStatus(webrtcCheck.reason);
        setTimeout(() => {
            hideConnectionStatus();
            document.getElementById('remote-setup').classList.remove('hidden');
        }, 5000);
        return;
    }
    
    showConnectionStatus('Connecting to room...');
    
    try {
        const peerManager = new PeerManager();
        
        peerManager.onConnect = (info) => {
            // Use timer settings from host (info.timerSeconds), not local selection
            const timerSeconds = info.timerSeconds || 0;
            startRemoteGameUI(peerManager, timerSeconds);
        };
        
        peerManager.onMessage = (data) => {
            handleRemoteMessage(data, peerManager);
        };
        
        peerManager.onDisconnect = () => {
            hideRematchModals();
            if (!game.gameState.isGameOver()) {
                showMessage('OPPONENT DISCONNECTED');
                game.gameState.setGameOver();
            }
        };
        
        peerManager.onError = (err) => {
            console.error('PeerManager error:', err);
            console.log('Diagnostics:', getWebRTCDiagnostics());
        };
        
        await peerManager.initialize();
        await peerManager.connect(roomCode);
        
        hideConnectionStatus();
    } catch (err) {
        console.error('Failed to join room:', err);
        console.log('Diagnostics:', getWebRTCDiagnostics());
        
        let errorMsg = 'Failed to join room. Check the code and try again.';
        if (err.message?.includes('WebRTC')) {
            errorMsg = 'WebRTC error. Make sure you are using HTTPS or localhost.';
        } else if (err.message?.includes('timeout')) {
            errorMsg = 'Connection timeout. The room may no longer exist.';
        } else if (err.type === 'peer-unavailable') {
            errorMsg = 'Room not found. Check the code and try again.';
        }
        
        showConnectionStatus(errorMsg);
        setTimeout(() => {
            hideConnectionStatus();
            document.getElementById('remote-setup').classList.remove('hidden');
        }, 4000);
    }
}

function handleRemoteMessage(data, peerManager) {
    switch (data.type) {
        case MESSAGE_TYPES.MOVE:
            if (!game.isMyTurn()) {
                handleRemoteMove(data.cellIndex);
            }
            break;
            
        case MESSAGE_TYPES.RESET:
            // Host will send FULL_SYNC after this, just prepare
            gameStarted = false;
            break;
            
        case MESSAGE_TYPES.FULL_SYNC:
            // Apply complete state from host (single source of truth)
            game.applyFullState(data);
            rebuildBoardFromState();
            resetGameUI();
            
            // Start timer if it's my turn and game has started
            if (game.hasTimer() && gameStarted && game.isMyTurn()) {
                game.startTimer();
            }
            break;
            
        case MESSAGE_TYPES.SYNC:
            // Legacy sync - still useful for mid-game state recovery
            game.gameState.fromJSON(data);
            game.scores = data.scores || game.scores;
            rebuildBoardFromState();
            updateUI();
            break;
            
        case MESSAGE_TYPES.TIMER_SYNC:
            // Update opponent's timer display
            if (data.player && data.remaining !== undefined) {
                playerTimers[data.player].remaining = data.remaining;
                updatePlayerTimerDisplay(
                    data.player === PLAYERS.X ? 'p1' : 'p2', 
                    data.player
                );
            }
            break;
            
        case MESSAGE_TYPES.TIMER_TIMEOUT:
            // Opponent's timer ran out
            if (data.timedOutPlayer) {
                game.stopTimer();
                applyTimerTimeout(data.timedOutPlayer);
            }
            break;
            
        case MESSAGE_TYPES.REMATCH_REQUEST:
            // Opponent wants to play again
            showRematchRequest(data.playerNum);
            break;
            
        case MESSAGE_TYPES.REMATCH_RESPONSE:
            // Opponent responded to our rematch request
            handleRematchResponse(data.accepted);
            break;
    }
}

// ============================================
// REMATCH SYSTEM
// ============================================
let pendingRematch = false;

function requestRematch() {
    if (!game.isRemote() || !game.peerManager) return;
    
    // Prevent duplicate requests
    if (pendingRematch) return;
    
    // Show waiting modal
    pendingRematch = true;
    document.getElementById('waiting-rematch-modal').classList.remove('hidden');
    
    // Send rematch request with player number
    const myPlayerNum = game.peerManager.isHost ? 1 : 2;
    game.peerManager.sendRematchRequest(myPlayerNum);
}

function showRematchRequest(playerNum) {
    // If we already sent a request, both players want to play - auto-accept
    if (pendingRematch) {
        hideRematchModals();
        if (game.peerManager) {
            game.peerManager.sendRematchResponse(true);
        }
        startRematchGame();
        return;
    }
    
    const message = `P${playerNum} has requested to play again!`;
    document.getElementById('rematch-message').textContent = message;
    document.getElementById('rematch-modal').classList.remove('hidden');
}

function hideRematchModals() {
    document.getElementById('rematch-modal').classList.add('hidden');
    document.getElementById('waiting-rematch-modal').classList.add('hidden');
    pendingRematch = false;
}

function acceptRematch() {
    hideRematchModals();
    
    // Send acceptance to opponent
    if (game.peerManager) {
        game.peerManager.sendRematchResponse(true);
    }
    
    // Start new game
    startRematchGame();
}

function declineRematch() {
    hideRematchModals();
    
    // Send decline to opponent
    if (game.peerManager) {
        game.peerManager.sendRematchResponse(false);
    }
    
    // Show message that rematch was declined
    showMessage('REMATCH DECLINED');
    setTimeout(hideMessage, 2000);
}

function handleRematchResponse(accepted) {
    hideRematchModals();
    
    if (accepted) {
        // Opponent accepted, start new game
        startRematchGame();
    } else {
        // Opponent declined
        showMessage('OPPONENT DECLINED');
        setTimeout(hideMessage, 2000);
    }
}

function startRematchGame() {
    gameStarted = false;
    game.resetGame(true);
    resetGameUI();
    
    // In remote, only start timer if it's my turn
    if (game.hasTimer() && game.isMyTurn()) {
        game.startTimer();
    }
}

function cancelRematchRequest() {
    // Notify opponent that request was cancelled
    if (pendingRematch && game.peerManager) {
        game.peerManager.sendRematchResponse(false);
    }
    hideRematchModals();
}

// Rematch modal button listeners
document.getElementById('accept-rematch-btn').addEventListener('click', acceptRematch);
document.getElementById('decline-rematch-btn').addEventListener('click', declineRematch);
document.getElementById('cancel-rematch-btn').addEventListener('click', cancelRematchRequest);

// Keyboard shortcuts for rematch modals
document.addEventListener('keydown', (e) => {
    const rematchModal = document.getElementById('rematch-modal');
    const waitingModal = document.getElementById('waiting-rematch-modal');
    
    // Handle rematch request modal (Enter = Accept, Escape = Decline)
    if (!rematchModal.classList.contains('hidden')) {
        if (e.key === 'Enter') {
            e.preventDefault();
            acceptRematch();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            declineRematch();
        }
    }
    
    // Handle waiting modal (Escape = Cancel)
    if (!waitingModal.classList.contains('hidden')) {
        if (e.key === 'Escape') {
            e.preventDefault();
            cancelRematchRequest();
        }
    }
});

// ============================================
// INTERACTION
// ============================================
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function onMouseMove(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

function onClick(event) {
    if (!game.canMove()) return;
    
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(clickTargets);
    
    if (intersects.length > 0) {
        const cellIndex = intersects[0].object.userData.cellIndex;
        handleCellClick(cellIndex);
    }
}

canvas.addEventListener('mousemove', onMouseMove);
canvas.addEventListener('click', onClick);

document.getElementById('reset-btn').addEventListener('click', () => {
    // In remote PvP, use rematch request system
    if (game.isRemote()) {
        requestRematch();
        return;
    }
    
    game.resetGame(true);
    resetGameUI();
    
    // Start timer for first turn of new round
    if (game.hasTimer()) {
        game.startTimer();
    }
});

document.getElementById('menu-btn').addEventListener('click', goToMainMenu);

// Touch support
canvas.addEventListener('touchstart', (event) => {
    event.preventDefault();
    const touch = event.touches[0];
    mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
    
    if (game.canMove()) {
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(clickTargets);
        if (intersects.length > 0) {
            handleCellClick(intersects[0].object.userData.cellIndex);
        }
    }
}, { passive: false });

// ============================================
// MODE SELECTION
// ============================================
document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        
        if (mode === 'pvp') {
            document.getElementById('mode-buttons').classList.add('hidden');
            document.getElementById('pvp-type-select').classList.remove('hidden');
        } else {
            document.getElementById('mode-buttons').classList.add('hidden');
            document.getElementById('difficulty-select').classList.remove('hidden');
        }
    });
});

document.querySelectorAll('.pvp-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        selectedPvpType = btn.dataset.pvpType;
        document.getElementById('pvp-type-select').classList.add('hidden');
        document.getElementById('timer-select').classList.remove('hidden');
    });
});

// Timer selection for PvP
document.querySelectorAll('.timer-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const timerSeconds = parseInt(btn.dataset.timer, 10);
        
        document.querySelectorAll('.timer-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        
        if (selectedPvpType === 'local') {
            startLocalGame(GAME_MODES.PVP_LOCAL, null, timerSeconds);
        } else {
            // Store timer for remote game
            window.selectedRemoteTimer = timerSeconds;
            document.getElementById('timer-select').classList.add('hidden');
            document.getElementById('remote-setup').classList.remove('hidden');
        }
    });
});

document.getElementById('back-to-pvp-type-from-timer').addEventListener('click', () => {
    document.getElementById('timer-select').classList.add('hidden');
    document.getElementById('pvp-type-select').classList.remove('hidden');
});

document.getElementById('back-to-pvp-type').addEventListener('click', () => {
    document.getElementById('remote-setup').classList.add('hidden');
    document.getElementById('timer-select').classList.remove('hidden');
});

document.getElementById('create-room-btn').addEventListener('click', createRoom);

document.getElementById('join-room-btn').addEventListener('click', () => {
    const roomCode = document.getElementById('room-code-input').value.trim().toUpperCase();
    if (roomCode.length >= 4) {
        joinRoom(roomCode);
    } else {
        // Use showConnectionStatus instead of alert for consistent UX
        showConnectionStatus('Please enter a valid room code (at least 4 characters)');
        setTimeout(() => {
            hideConnectionStatus();
            document.getElementById('remote-setup').classList.remove('hidden');
        }, 2000);
    }
});

document.getElementById('room-code-input').addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase();
});

document.getElementById('room-code-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        document.getElementById('join-room-btn').click();
    }
});

document.getElementById('copy-link-btn').addEventListener('click', async () => {
    const linkInput = document.getElementById('share-link');
    const copyBtn = document.getElementById('copy-link-btn');
    
    try {
        await navigator.clipboard.writeText(linkInput.value);
        copyBtn.textContent = '✓ COPIED!';
        copyBtn.classList.add('copied');
        setTimeout(() => {
            copyBtn.textContent = '📋 COPY';
            copyBtn.classList.remove('copied');
        }, 2000);
    } catch (err) {
        linkInput.select();
        document.execCommand('copy');
    }
});

document.getElementById('cancel-waiting-btn').addEventListener('click', () => {
    game.cleanup();
    document.getElementById('waiting-room').classList.add('hidden');
    document.getElementById('remote-setup').classList.remove('hidden');
});

document.querySelectorAll('.difficulty-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const difficulty = btn.dataset.difficulty;
        const timerSeconds = parseInt(btn.dataset.timer, 10) || 0;
        startLocalGame(GAME_MODES.AI, difficulty, timerSeconds);
    });
});

// Check URL for room code
function checkUrlForRoom() {
    const roomCode = getRoomCodeFromUrl();
    
    if (roomCode) {
        clearRoomCodeFromUrl();
        
        document.getElementById('mode-buttons').classList.add('hidden');
        document.getElementById('remote-setup').classList.remove('hidden');
        document.getElementById('room-code-input').value = roomCode.toUpperCase();
        
        setTimeout(() => {
            joinRoom(roomCode.toUpperCase());
        }, 500);
    }
}

checkUrlForRoom();

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
    
    controls.update();
    
    // Animate pieces
    pieces.forEach(piece => {
        if (piece.userData.targetScale && piece.scale.x < piece.userData.targetScale) {
            const newScale = Math.min(piece.scale.x + delta * 5, piece.userData.targetScale);
            piece.scale.set(newScale, newScale, newScale);
        }
        
        if (piece.userData.isWinning) {
            // Enhanced winning animation with rotation
            piece.position.y = 0.2 + Math.sin(time * 3) * 0.12;
            piece.rotation.y = time * 0.5;
        }
    });
    
    // Subtle board breathing animation
    if (!game.gameState.isGameOver()) {
        boardGroup.rotation.y = Math.sin(time * 0.3) * 0.04;
    }
    
    // Animate grid line glow
    materials.gridLine.emissiveIntensity = 0.35 + Math.sin(time * 2) * 0.15;
    
    // Animate ambient particles
    const positions = particles.geometry.attributes.position.array;
    for (let i = 0; i < particleCount; i++) {
        // Slow upward drift
        positions[i * 3 + 1] += delta * 0.3;
        
        // Add slight horizontal wobble
        positions[i * 3] += Math.sin(time + i) * delta * 0.1;
        positions[i * 3 + 2] += Math.cos(time + i * 0.5) * delta * 0.1;
        
        // Reset particles that drift too high
        if (positions[i * 3 + 1] > 15) {
            positions[i * 3 + 1] = 0;
            positions[i * 3] = (Math.random() - 0.5) * 30;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 30;
        }
    }
    particles.geometry.attributes.position.needsUpdate = true;
    
    // Subtle particle color pulse
    const hue = 0.5 + Math.sin(time * 0.5) * 0.05; // Cyan range
    particleMaterial.color.setHSL(hue, 1, 0.5);
    
    // Animate accent lights subtly
    cyanLight.intensity = 1.3 + Math.sin(time * 1.5) * 0.3;
    magentaLight.intensity = 1.0 + Math.sin(time * 1.2 + 1) * 0.3;
    
    // Animate corner accents on platform (if they exist)
    if (platform && platform.children) {
        platform.children.forEach((child, i) => {
            if (child.geometry && child.geometry.type === 'CylinderGeometry') {
                const pulseOffset = i * Math.PI / 2;
                if (child.material.emissiveIntensity !== undefined) {
                    child.material.emissiveIntensity = 0.25 + Math.sin(time * 2 + pulseOffset) * 0.15;
                }
            }
        });
    }
    
    renderer.render(scene, camera);
}

// Initialize
updateUI();
animate();
