import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { GameState } from './game/GameState';
import { getGameStatus } from './game/GameLogic';
import { AIController } from './game/AI';
import { PLAYERS, GAME_MODES } from './game/constants';
import {
  PeerManager,
  MESSAGE_TYPES,
  getRoomCodeFromUrl,
  clearRoomCodeFromUrl,
  checkWebRTCSupport,
  getWebRTCDiagnostics
} from './multiplayer/PeerManager';
import { Timer, TIMER_PRESETS } from './game/Timer';
import type { Player, GameMode, AIDifficulty, CellIndex, GameStatus, Score } from './types';

interface GameSettings {
  timerSeconds: number;
}

class GameController {
  gameState: GameState;
  scores: Score;
  mode: GameMode | null;
  aiController: AIController | null;
  peerManager: PeerManager | null;
  timerSeconds: number;
  timer: Timer | null;
  onTimerTick: ((remaining: number, total: number) => void) | null;
  onTimerTimeout: (() => void) | null;

  constructor() {
    this.gameState = new GameState();
    this.scores = { 1: 0, 2: 0 };
    this.mode = null;
    this.aiController = null;
    this.peerManager = null;
    this.timerSeconds = 0;
    this.timer = null;
    this.onTimerTick = null;
    this.onTimerTimeout = null;

    this.handleMove = this.handleMove.bind(this);
    this.resetGame = this.resetGame.bind(this);
  }

  startGame(mode: GameMode, difficulty?: AIDifficulty, timerSeconds: number = 0): void {
    this.mode = mode;
    this.scores = { 1: 0, 2: 0 };
    this.timerSeconds = timerSeconds;
    this.gameState.resetGameNumber();
    this.gameState.reset(false);

    if (mode === GAME_MODES.AI && difficulty) {
      this.aiController = new AIController(difficulty, PLAYERS.O);
      if (timerSeconds === 0) {
        this.timerSeconds = TIMER_PRESETS[difficulty.toUpperCase() as keyof typeof TIMER_PRESETS] || 0;
      }
    } else {
      this.aiController = null;
    }

    this.setupTimer();

    if (this.peerManager && mode !== GAME_MODES.PVP_REMOTE) {
      this.peerManager.destroy();
      this.peerManager = null;
    }
  }

  startRemoteGame(peerManager: PeerManager, timerSeconds: number = 0): void {
    this.mode = GAME_MODES.PVP_REMOTE;
    this.peerManager = peerManager;
    this.scores = { 1: 0, 2: 0 };
    this.timerSeconds = timerSeconds;
    this.gameState.resetGameNumber();
    this.gameState.reset(false);
    this.aiController = null;
    this.setupTimer();
  }

  setupTimer(): void {
    if (this.timer) {
      this.timer.stop();
    }

    if (this.timerSeconds > 0) {
      this.timer = new Timer(
        this.timerSeconds,
        (remaining, total): void => {
          if (this.onTimerTick) {
            this.onTimerTick(remaining, total);
          }
        },
        (): void => {
          if (this.onTimerTimeout) {
            this.onTimerTimeout();
          }
        }
      );
    } else {
      this.timer = null;
    }
  }

  startTimer(): void {
    if (this.timer && !this.gameState.isGameOver()) {
      this.timer.start();
    }
  }

  stopTimer(): void {
    if (this.timer) {
      this.timer.stop();
    }
  }

  hasTimer(): boolean {
    return this.timerSeconds > 0 && this.timer !== null;
  }

  handleMove(cellIndex: number, isRemoteMove: boolean = false): { moved: boolean; status: GameStatus } | false {
    const currentPlayer = this.gameState.getCurrentPlayer();

    if (!this.gameState.placePiece(cellIndex, currentPlayer)) {
      return false;
    }

    if (this.isRemote() && !isRemoteMove) {
      this.peerManager!.sendMove(cellIndex);
    }

    const status = getGameStatus(this.gameState.getBoard());

    if (status.isOver) {
      this.gameState.setGameOver(status.winner, status.pattern ?? null);
      if (status.winner) {
        const winnerPlayer = getPlayerNumberFromSymbol(status.winner);
        this.scores[winnerPlayer]++;
      }
      this.stopTimer();
      return { moved: true, status };
    }

    this.gameState.switchPlayer();
    this.startTimer();
    return { moved: true, status };
  }

  resetGame(sendToRemote: boolean = true, newRound: boolean = true): void {
    this.gameState.reset(newRound);

    if (this.isRemote() && sendToRemote && this.peerManager!.isHost) {
      this.peerManager!.sendReset();
      this.syncFullState();
    }
  }

  getFullState(): { gameState: ReturnType<typeof this.gameState.toJSON>; scores: Score; timerSeconds: number; gameStarted: boolean } {
    return {
      gameState: this.gameState.toJSON(),
      scores: { ...this.scores },
      timerSeconds: this.timerSeconds,
      gameStarted: gameStartedVar
    };
  }

  applyFullState(state: { gameState?: ReturnType<typeof this.gameState.toJSON>; scores?: Score; timerSeconds?: number; gameStarted?: boolean }): void {
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
      gameStartedVar = state.gameStarted;
    }
  }

  syncFullState(): void {
    if (!this.isRemote() || !this.peerManager!.isHost) return;

    this.peerManager!.sendFullSync(this.getFullState());
  }

  resetMatch(): void {
    this.stopTimer();
    this.gameState.resetGameNumber();
    this.gameState.reset(false);
    this.scores = { 1: 0, 2: 0 };
    this.timerSeconds = 0;
    this.timer = null;
  }

  isRemote(): boolean {
    return this.mode === GAME_MODES.PVP_REMOTE && this.peerManager?.isConnected;
  }

  isMyTurn(): boolean {
    if (!this.isRemote()) return true;

    const currentPlayer = this.gameState.getCurrentPlayer();
    const playerAsX = this.gameState.getPlayerAsX();
    const amIHost = this.peerManager!.isHost;

    const myCurrentRole = amIHost
      ? (playerAsX === 1 ? PLAYERS.X : PLAYERS.O)
      : (playerAsX === 2 ? PLAYERS.X : PLAYERS.O);

    return currentPlayer === myCurrentRole;
  }

  getMyRole(): Player | null {
    return this.peerManager?.myRole ?? null;
  }

  isAITurn(): boolean {
    return this.mode === GAME_MODES.AI &&
      this.gameState.getCurrentPlayer() === PLAYERS.O &&
      !this.gameState.isGameOver();
  }

  canMove(): boolean {
    if (this.gameState.isGameOver()) return false;
    if (this.aiController?.isThinking) return false;
    if (this.mode === GAME_MODES.AI && this.gameState.getCurrentPlayer() === PLAYERS.O) return false;
    if (this.isRemote() && !this.isMyTurn()) return false;
    return true;
  }

  async triggerAIMove(): Promise<number | null | false> {
    if (this.mode !== GAME_MODES.AI) return null;
    if (this.gameState.getCurrentPlayer() !== PLAYERS.O) return null;
    if (this.gameState.isGameOver()) return null;

    const move = await this.aiController!.getMove(this.gameState.getBoard());
    if (move !== null) {
      return this.handleMove(move);
    }
    return null;
  }

  cleanup(): void {
    this.stopTimer();
    if (this.peerManager) {
      this.peerManager.destroy();
      this.peerManager = null;
    }
  }
}

const game = new GameController();

let selectedPvpType: string | null = null;
let selectedRemoteTimer = 0;

function getPlayerLabel(piece: Player): string {
  const playerAsX = game.gameState.getPlayerAsX();
  if (piece === PLAYERS.X) {
    return `P${playerAsX}`;
  } else {
    return `P${playerAsX === 1 ? 2 : 1}`;
  }
}

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

const CAMERA_POSITIONS: {
  desktop: { y: number; z: number; fov: number; minDist: number };
  mobile: { y: number; z: number; fov: number; minDist: number };
} = {
  desktop: { y: 8, z: 10, fov: 45, minDist: 8 },
  mobile: { y: 12, z: 18, fov: 55, minDist: 12 }
};

function adjustCameraForDevice(updateControls: boolean = true): void {
  const isMobile = window.innerWidth < 768 || window.innerWidth < window.innerHeight;
  const pos = isMobile ? CAMERA_POSITIONS.mobile : CAMERA_POSITIONS.desktop;

  camera.position.set(0, pos.y, pos.z);
  camera.fov = pos.fov;
  camera.updateProjectionMatrix();
  camera.lookAt(0, 0, 0);

  if (updateControls && typeof controls !== 'undefined' && controls.minDistance !== undefined) {
    controls.minDistance = pos.minDist;
  }
}

adjustCameraForDevice(false);
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

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enablePan = false;
controls.maxDistance = 25;
controls.maxPolarAngle = Math.PI / 2.2;

const isMobileInit = window.innerWidth < 768 || window.innerWidth < window.innerHeight;
controls.minDistance = isMobileInit ? CAMERA_POSITIONS.mobile.minDist : CAMERA_POSITIONS.desktop.minDist;

const ambientLight = new THREE.AmbientLight(0x1a1a2e, 0.4);
scene.add(ambientLight);

const hemiLight = new THREE.HemisphereLight(0x0a0a1a, 0x000000, 0.3);
scene.add(hemiLight);

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

const fillLight = new THREE.DirectionalLight(0x4466aa, 0.4);
fillLight.position.set(-5, 8, -5);
scene.add(fillLight);

const cyanLight = new THREE.PointLight(0x00f5ff, 0.6, 25);
cyanLight.position.set(-4, 4, -4);
cyanLight.castShadow = true;
cyanLight.shadow.mapSize.width = 1024;
cyanLight.shadow.mapSize.height = 1024;
cyanLight.shadow.bias = -0.001;
scene.add(cyanLight);

const magentaLight = new THREE.PointLight(0xff00aa, 0.5, 25);
magentaLight.position.set(4, 4, 4);
magentaLight.castShadow = true;
magentaLight.shadow.mapSize.width = 1024;
magentaLight.shadow.mapSize.height = 1024;
magentaLight.shadow.bias = -0.001;
scene.add(magentaLight);

const rimLight = new THREE.SpotLight(0x6644ff, 0.8, 30, Math.PI / 6, 0.5);
rimLight.position.set(0, 8, -8);
rimLight.target.position.set(0, 0, 0);
scene.add(rimLight);
scene.add(rimLight.target);

const topLight = new THREE.SpotLight(0xffeedd, 8.0, 40, Math.PI / 5, 0.25, 1.0);
topLight.position.set(8, 10, 8);
topLight.target.position.set(0, 0, 0);
topLight.castShadow = true;
topLight.shadow.mapSize.width = 2048;
topLight.shadow.mapSize.height = 2048;
topLight.shadow.bias = -0.0001;
scene.add(topLight);
scene.add(topLight.target);

const envMapTexture = new THREE.CubeTextureLoader().load([
  createGradientDataURL(0x0a0a1a, 0x00f5ff),
  createGradientDataURL(0x0a0a1a, 0xff00aa),
  createGradientDataURL(0x1a1a3a, 0x2a2a4a),
  createGradientDataURL(0x000000, 0x0a0a1a),
  createGradientDataURL(0x0a0a1a, 0x00f5ff),
  createGradientDataURL(0x0a0a1a, 0xff00aa)
]);

function createGradientDataURL(color1: number, color2: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const gradient = ctx.createLinearGradient(0, 0, 64, 64);
  gradient.addColorStop(0, `#${color1.toString(16).padStart(6, '0')}`);
  gradient.addColorStop(1, `#${color2.toString(16).padStart(6, '0')}`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  return canvas.toDataURL();
}

const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();

const envScene = new THREE.Scene();
const envGeometry = new THREE.SphereGeometry(50, 32, 32);
const envMaterial = new THREE.MeshBasicMaterial({
  side: THREE.BackSide,
  vertexColors: true
});

const colors: number[] = [];
const positions = envGeometry.attributes.position;
for (let i = 0; i < positions.count; i++) {
  const y = positions.getY(i);
  const t = (y + 50) / 100;
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

const materials: Record<string, THREE.Material> = {
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
    color: 0x8a9a8a,
    emissive: 0x8a9a8a,
    emissiveIntensity: 0.3,
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

const X_ARM_LENGTH = 1.1;
const X_TUBE_RADIUS = 0.1;
const X_RADIAL_SEGMENTS = 24;
const X_CAP_SEGMENTS = 12;
const xCylinderGeometry = new THREE.CylinderGeometry(X_TUBE_RADIUS, X_TUBE_RADIUS, X_ARM_LENGTH - X_TUBE_RADIUS * 2, X_RADIAL_SEGMENTS);
const xTopCapGeometry = new THREE.SphereGeometry(X_TUBE_RADIUS, X_RADIAL_SEGMENTS, X_CAP_SEGMENTS, 0, Math.PI * 2, 0, Math.PI / 2);
const xBottomCapGeometry = new THREE.SphereGeometry(X_TUBE_RADIUS, X_RADIAL_SEGMENTS, X_CAP_SEGMENTS, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
const xGlowArmGeometry = new THREE.PlaneGeometry(X_TUBE_RADIUS * 2.5, X_ARM_LENGTH * 0.85);

const O_TORUS_RADIUS = 0.5;
const O_TUBE_RADIUS = 0.1;
const oTorusGeometry = new THREE.TorusGeometry(O_TORUS_RADIUS, O_TUBE_RADIUS, 24, 48);
const oGlowInnerRadius = O_TORUS_RADIUS - O_TUBE_RADIUS * 1.2;
const oGlowOuterRadius = O_TORUS_RADIUS + O_TUBE_RADIUS * 1.2;
const oGlowGeometry = new THREE.RingGeometry(oGlowInnerRadius, oGlowOuterRadius, 48);

const xGlowMaterial = new THREE.MeshBasicMaterial({
  color: 0x00f5ff,
  transparent: true,
  opacity: 0.15,
  side: THREE.DoubleSide
});
const oGlowMaterial = new THREE.MeshBasicMaterial({
  color: 0xff00aa,
  transparent: true,
  opacity: 0.15,
  side: THREE.DoubleSide
});

const urgencyColorRed = new THREE.Color(0xff2200);
const urgencyColorOrange = new THREE.Color(0xff6600);

scene.fog = new THREE.FogExp2(0x050510, 0.025);

const groundGeometry = new THREE.PlaneGeometry(100, 100);
const groundPlane = new THREE.Mesh(groundGeometry, materials.ground);
groundPlane.rotation.x = -Math.PI / 2;
groundPlane.position.y = -0.5;
groundPlane.receiveShadow = true;
scene.add(groundPlane);

const boardGroup = new THREE.Group();
scene.add(boardGroup);

const CELL_SIZE = 2;
const BOARD_SIZE = CELL_SIZE * 3;
const GAP = 0.1;

let platformEdgeMaterial: THREE.MeshStandardMaterial | null = null;
let platformCornerMaterial: THREE.MeshPhysicalMaterial | null = null;

function createPlatform(): THREE.Group {
  const group = new THREE.Group();

  const mainGeometry = new THREE.BoxGeometry(BOARD_SIZE + 0.8, 0.25, BOARD_SIZE + 0.8);
  const main = new THREE.Mesh(mainGeometry, materials.board);
  main.position.y = -0.25;
  main.castShadow = true;
  main.receiveShadow = true;
  group.add(main);

  const topGeometry = new THREE.BoxGeometry(BOARD_SIZE + 0.6, 0.08, BOARD_SIZE + 0.6);
  const top = new THREE.Mesh(topGeometry, materials.boardTop);
  top.position.y = -0.08;
  top.receiveShadow = true;
  group.add(top);

  const edgeGeometry = new THREE.BoxGeometry(BOARD_SIZE + 0.85, 0.02, BOARD_SIZE + 0.85);
  platformEdgeMaterial = new THREE.MeshStandardMaterial({
    color: 0x8a9a8a,
    emissive: 0x8a9a8a,
    emissiveIntensity: 0.1,
    metalness: 0.9,
    roughness: 0.2
  });
  const edge = new THREE.Mesh(edgeGeometry, platformEdgeMaterial);
  edge.position.y = -0.12;
  group.add(edge);

  const cornerGeometry = new THREE.CylinderGeometry(0.15, 0.15, 0.3, 8);
  platformCornerMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x8a9a8a,
    emissive: 0x8a9a8a,
    emissiveIntensity: 0.2,
    metalness: 1.0,
    roughness: 0.1,
    clearcoat: 0.5
  });

  const cornerPositions = [
    [-BOARD_SIZE / 2 - 0.3, -0.2, -BOARD_SIZE / 2 - 0.3],
    [BOARD_SIZE / 2 + 0.3, -0.2, -BOARD_SIZE / 2 - 0.3],
    [-BOARD_SIZE / 2 - 0.3, -0.2, BOARD_SIZE / 2 + 0.3],
    [BOARD_SIZE / 2 + 0.3, -0.2, BOARD_SIZE / 2 + 0.3]
  ];

  cornerPositions.forEach((pos): void => {
    const corner = new THREE.Mesh(cornerGeometry, platformCornerMaterial);
    corner.position.set(pos[0], pos[1], pos[2]);
    corner.castShadow = true;
    group.add(corner);
  });

  return group;
}

const platform = createPlatform();
boardGroup.add(platform);

const vLineGeometry = new THREE.BoxGeometry(0.06, 0.12, BOARD_SIZE - 0.3);
const hLineGeometry = new THREE.BoxGeometry(BOARD_SIZE - 0.3, 0.12, 0.06);

function createGridLines(): THREE.Group {
  const gridGroup = new THREE.Group();

  for (let i = -1; i <= 1; i += 2) {
    const line = new THREE.Mesh(vLineGeometry, materials.gridLine);
    line.position.set(i * (CELL_SIZE / 2 + GAP / 2), 0.02, 0);
    line.castShadow = true;
    line.receiveShadow = true;
    gridGroup.add(line);
  }

  for (let i = -1; i <= 1; i += 2) {
    const line = new THREE.Mesh(hLineGeometry, materials.gridLine);
    line.position.set(0, 0.02, i * (CELL_SIZE / 2 + GAP / 2));
    line.castShadow = true;
    line.receiveShadow = true;
    gridGroup.add(line);
  }

  return gridGroup;
}

const gridLines = createGridLines();
boardGroup.add(gridLines);

const clickTargets: THREE.Mesh[] = [];
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
  target.userData = { cellIndex: i };

  clickTargets.push(target);
  boardGroup.add(target);
}

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

particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3).setUsage(THREE.StaticDrawUsage));
particleGeometry.setAttribute('size', new THREE.BufferAttribute(particleSizes, 1).setUsage(THREE.StaticDrawUsage));

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

const pieces: THREE.Group[] = [];

function createX(cellIndex: number): THREE.Group {
  const group = new THREE.Group();

  function createRoundedArm(): THREE.Group {
    const armGroup = new THREE.Group();

    const cylinder = new THREE.Mesh(xCylinderGeometry, materials.playerX.clone());
    cylinder.castShadow = true;
    cylinder.receiveShadow = true;
    armGroup.add(cylinder);

    const topCap = new THREE.Mesh(xTopCapGeometry, materials.playerX.clone());
    topCap.position.y = (X_ARM_LENGTH - X_TUBE_RADIUS * 2) / 2;
    topCap.castShadow = true;
    topCap.receiveShadow = true;
    armGroup.add(topCap);

    const bottomCap = new THREE.Mesh(xBottomCapGeometry, materials.playerX.clone());
    bottomCap.position.y = -(X_ARM_LENGTH - X_TUBE_RADIUS * 2) / 2;
    bottomCap.castShadow = true;
    bottomCap.receiveShadow = true;
    armGroup.add(bottomCap);

    return armGroup;
  }

  const arm1 = createRoundedArm();
  arm1.rotation.z = Math.PI / 4;
  arm1.rotation.x = Math.PI / 2;
  group.add(arm1);

  const arm2 = createRoundedArm();
  arm2.rotation.z = -Math.PI / 4;
  arm2.rotation.x = Math.PI / 2;
  group.add(arm2);

  const glowArm1 = new THREE.Mesh(xGlowArmGeometry, xGlowMaterial);
  glowArm1.rotation.x = -Math.PI / 2;
  glowArm1.rotation.z = Math.PI / 4;
  glowArm1.position.y = -0.08;
  glowArm1.castShadow = false;
  glowArm1.receiveShadow = false;
  group.add(glowArm1);

  const glowArm2 = new THREE.Mesh(xGlowArmGeometry, xGlowMaterial);
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
  group.userData = { targetScale: 1, cellIndex };
  group.userData.cellIndex = cellIndex;

  return group;
}

function createO(cellIndex: number): THREE.Group {
  const group = new THREE.Group();

  const mesh = new THREE.Mesh(oTorusGeometry, materials.playerO.clone());
  mesh.rotation.x = -Math.PI / 2;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);

  const glow = new THREE.Mesh(oGlowGeometry, oGlowMaterial);
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = -0.08;
  glow.castShadow = false;
  glow.receiveShadow = false;
  group.add(glow);

  const row = Math.floor(cellIndex / 3);
  const col = cellIndex % 3;
  group.position.set((col - 1) * CELL_SIZE, 0.2, (row - 1) * CELL_SIZE);

  group.scale.set(0, 0, 0);
  group.userData = { targetScale: 1, cellIndex };
  group.userData.cellIndex = cellIndex;

  return group;
}

function addPieceToBoard(cellIndex: number, player: Player): THREE.Group {
  const piece = player === PLAYERS.X ? createX(cellIndex) : createO(cellIndex);
  boardGroup.add(piece);
  pieces.push(piece);
  return piece;
}

function clearPieces(): void {
  pieces.forEach((piece): void => {
    boardGroup.remove(piece);
  });
  pieces.length = 0;
}

function highlightWinningPieces(pattern: number[]): void {
  pieces.forEach((piece): void => {
    if (pattern.includes(piece.userData.cellIndex)) {
      piece.children.forEach((child): void => {
        if (child.material && 'color' in child.material) {
          if ('opacity' in child.material && (child.material as { opacity: number }).opacity < 1) {
            if (!(child.material as { _originalColor?: THREE.Color })._originalColor) {
              (child.material as THREE.Material & { _originalColor?: THREE.Color })._originalColor = (child.material as THREE.MeshStandardMaterial).color.clone();
            }
            (child.material as THREE.MeshStandardMaterial).color.setHex(0xffd700);
            (child.material as THREE.MeshStandardMaterial).opacity = 0.3;
          } else {
            child.material = materials.winHighlight.clone();
          }
        }
      });
      piece.userData.isWinning = true;
    }
  });
}

function rebuildBoardFromState(): void {
  clearPieces();
  const board = game.gameState.getBoard();
  board.forEach((cell, index): void => {
    if (cell) {
      const piece = addPieceToBoard(index, cell);
      piece.scale.set(1, 1, 1);
    }
  });
}

function showMessage(text: string): void {
  const messageEl = document.getElementById('message');
  if (messageEl) {
    messageEl.textContent = text;
    messageEl.classList.remove('hidden');
  }
}

function hideMessage(): void {
  const messageEl = document.getElementById('message');
  if (messageEl) {
    messageEl.classList.add('hidden');
  }
}

function getPlayerNumberFromSymbol(symbol: Player): 1 | 2 {
  const playerAsX = game.gameState.getPlayerAsX();
  return symbol === PLAYERS.X ? playerAsX : (playerAsX === 1 ? 2 : 1);
}

function updateUI(): void {
  const playerEl = document.getElementById('current-player');
  const currentPlayer = game.gameState.getCurrentPlayer();

  if (playerEl) {
    if (game.mode === GAME_MODES.AI) {
      if (currentPlayer === PLAYERS.X) {
        playerEl.textContent = getPlayerLabel(PLAYERS.X);
      } else {
        playerEl.textContent = game.aiController?.isThinking ? 'AI...' : 'AI';
      }
    } else {
      playerEl.textContent = getPlayerLabel(currentPlayer);
    }

    playerEl.className = `player-${currentPlayer.toLowerCase()}`;
  }

  const scoreP1El = document.getElementById('score-p1');
  const scoreP2El = document.getElementById('score-p2');
  if (scoreP1El) scoreP1El.textContent = `P1:${game.scores[1]}`;
  if (scoreP2El) scoreP2El.textContent = `P2:${game.scores[2]}`;

  if (game.isRemote()) {
    updateRemoteTurnIndicator();
  }
}

function updateRemoteTurnIndicator(): void {
  const turnIndicator = document.getElementById('turn-indicator');
  const turnText = document.getElementById('turn-text');
  const isMyTurn = game.isMyTurn();
  const currentPlayer = game.gameState.getCurrentPlayer();
  const playerLabel = getPlayerLabel(currentPlayer);

  if (turnIndicator) {
    turnIndicator.className = isMyTurn ? 'your-turn' : 'waiting';
  }
  if (turnText) {
    turnText.textContent = isMyTurn ? 'Your turn!' : `${playerLabel}'s turn...`;
  }
}

// Helper function to check for game over and display message
function checkGameOverAndShowMessage(): void {
  const status = game.gameState.isGameOver();
  if (status) {
    const board = game.gameState.getBoard();
    const gameStatus = getGameStatus(board);
    if (gameStatus.pattern) {
      highlightWinningPieces(gameStatus.pattern);
    }
    if (gameStatus.isDraw) {
      showMessage("IT'S A DRAW!");
    } else if (gameStatus.winner) {
      showMessage(`${getPlayerLabel(gameStatus.winner)} WINS!`);
    }
  }
}

function hideAllModeScreens(): void {
  const modeSelectOverlay = document.getElementById('mode-select-overlay');
  const modeButtons = document.getElementById('mode-buttons');
  const pvpTypeSelect = document.getElementById('pvp-type-select');
  const timerSelect = document.getElementById('timer-select');
  const remoteSetup = document.getElementById('remote-setup');
  const waitingRoom = document.getElementById('waiting-room');
  const connectionStatus = document.getElementById('connection-status');
  const difficultySelect = document.getElementById('difficulty-select');

  if (modeSelectOverlay) modeSelectOverlay.classList.add('hidden');
  if (modeButtons) modeButtons.classList.add('hidden');
  if (pvpTypeSelect) pvpTypeSelect.classList.add('hidden');
  if (timerSelect) timerSelect.classList.add('hidden');
  if (remoteSetup) remoteSetup.classList.add('hidden');
  if (waitingRoom) waitingRoom.classList.add('hidden');
  if (connectionStatus) connectionStatus.classList.add('hidden');
  if (difficultySelect) difficultySelect.classList.add('hidden');
}

function showModeSelectScreen(): void {
  const modeSelectOverlay = document.getElementById('mode-select-overlay');
  const modeButtons = document.getElementById('mode-buttons');
  const pvpTypeSelect = document.getElementById('pvp-type-select');
  const timerSelect = document.getElementById('timer-select');
  const remoteSetup = document.getElementById('remote-setup');
  const waitingRoom = document.getElementById('waiting-room');
  const connectionStatus = document.getElementById('connection-status');
  const difficultySelect = document.getElementById('difficulty-select');

  if (modeSelectOverlay) modeSelectOverlay.classList.remove('hidden');
  if (modeButtons) modeButtons.classList.remove('hidden');
  if (pvpTypeSelect) pvpTypeSelect.classList.add('hidden');
  if (timerSelect) timerSelect.classList.add('hidden');
  if (remoteSetup) remoteSetup.classList.add('hidden');
  if (waitingRoom) waitingRoom.classList.add('hidden');
  if (connectionStatus) connectionStatus.classList.add('hidden');
  if (difficultySelect) difficultySelect.classList.add('hidden');
}

const playerTimers: { X: { remaining: number; total: number }; O: { remaining: number; total: number } } = {
  X: { remaining: 0, total: 0 },
  O: { remaining: 0, total: 0 }
};

let gameStartedVar = false;
let lastTimerSync = 0;

const TIMER_SYNC_INTERVAL = 500;
const TIMER_CRITICAL_SECONDS = 2;
const TIMER_WARNING_THRESHOLD = 0.4;

const STAGE_COLOR_THRESHOLDS = {
  WARNING: 0.6,
  CRITICAL: 0.4,
  DANGER: 0.2
};

const STAGE_COLORS: Record<string, { fog: THREE.Color; ground: THREE.Color; ambient: THREE.Color; platformAccent: THREE.Color; gridLine: THREE.Color; accentMultiplier: number }> = {
  NORMAL: {
    fog: new THREE.Color(0x080808),
    ground: new THREE.Color(0x060606),
    ambient: new THREE.Color(0x1a1a1a),
    platformAccent: new THREE.Color(0x8a9a8a),
    gridLine: new THREE.Color(0x8a9a8a),
    accentMultiplier: 0.4
  },
  WARNING: {
    fog: new THREE.Color(0x121008),
    ground: new THREE.Color(0x0a0806),
    ambient: new THREE.Color(0x2e2a1a),
    platformAccent: new THREE.Color(0xccaa44),
    gridLine: new THREE.Color(0xccaa44),
    accentMultiplier: 0.5
  },
  CRITICAL: {
    fog: new THREE.Color(0x180a00),
    ground: new THREE.Color(0x100800),
    ambient: new THREE.Color(0x2e150a),
    platformAccent: new THREE.Color(0xff8800),
    gridLine: new THREE.Color(0xff8800),
    accentMultiplier: 0.4
  },
  DANGER: {
    fog: new THREE.Color(0x1a0000),
    ground: new THREE.Color(0x120000),
    ambient: new THREE.Color(0x2e0808),
    platformAccent: new THREE.Color(0xff2200),
    gridLine: new THREE.Color(0xff2200),
    accentMultiplier: 0.3
  }
};

const originalStageColors: {
  fog: THREE.Color;
  ground: THREE.Color;
  ambient: THREE.Color;
  platformAccent: THREE.Color;
  gridLine: THREE.Color;
  cyanIntensity: number;
  magentaIntensity: number;
} = {
  fog: new THREE.Color(0x080808),
  ground: new THREE.Color(0x060606),
  ambient: new THREE.Color(0x1a1a1a),
  platformAccent: new THREE.Color(0x8a9a8a),
  gridLine: new THREE.Color(0x8a9a8a),
  cyanIntensity: 0.6,
  magentaIntensity: 0.5
};

let currentStageColorProgress = 1.0;

function lerpColor(color1: THREE.Color, color2: THREE.Color, t: number): THREE.Color {
  const result = new THREE.Color();
  result.r = color1.r + (color2.r - color1.r) * t;
  result.g = color1.g + (color2.g - color1.g) * t;
  result.b = color1.b + (color2.b - color1.b) * t;
  return result;
}

function updateStageColors(progress: number): void {
  currentStageColorProgress = progress;

  let targetColors: typeof STAGE_COLORS.NORMAL;
  let fromColors: typeof STAGE_COLORS.NORMAL;
  let lerpT: number;

  if (progress > STAGE_COLOR_THRESHOLDS.WARNING) {
    const range = 1.0 - STAGE_COLOR_THRESHOLDS.WARNING;
    lerpT = (progress - STAGE_COLOR_THRESHOLDS.WARNING) / range;
    fromColors = STAGE_COLORS.WARNING;
    targetColors = STAGE_COLORS.NORMAL;
  } else if (progress > STAGE_COLOR_THRESHOLDS.CRITICAL) {
    const range = STAGE_COLOR_THRESHOLDS.WARNING - STAGE_COLOR_THRESHOLDS.CRITICAL;
    lerpT = (progress - STAGE_COLOR_THRESHOLDS.CRITICAL) / range;
    fromColors = STAGE_COLORS.CRITICAL;
    targetColors = STAGE_COLORS.WARNING;
  } else if (progress > STAGE_COLOR_THRESHOLDS.DANGER) {
    const range = STAGE_COLOR_THRESHOLDS.CRITICAL - STAGE_COLOR_THRESHOLDS.DANGER;
    lerpT = (progress - STAGE_COLOR_THRESHOLDS.DANGER) / range;
    fromColors = STAGE_COLORS.DANGER;
    targetColors = STAGE_COLORS.CRITICAL;
  } else {
    const range = STAGE_COLOR_THRESHOLDS.DANGER;
    lerpT = Math.max(0, progress / range);
    fromColors = {
      fog: new THREE.Color(0x250000),
      ground: new THREE.Color(0x180000),
      ambient: new THREE.Color(0x350505),
      platformAccent: new THREE.Color(0xff0000),
      gridLine: new THREE.Color(0xff0000),
      accentMultiplier: 0.05
    };
    targetColors = STAGE_COLORS.DANGER;
  }

  const fogColor = lerpColor(fromColors.fog, targetColors.fog, lerpT);
  const groundColor = lerpColor(fromColors.ground, targetColors.ground, lerpT);
  const ambientColor = lerpColor(fromColors.ambient, targetColors.ambient, lerpT);
  const platformAccentColor = lerpColor(fromColors.platformAccent, targetColors.platformAccent, lerpT);
  const gridLineColor = lerpColor(fromColors.gridLine, targetColors.gridLine, lerpT);
  const accentMult = fromColors.accentMultiplier +
    (targetColors.accentMultiplier - fromColors.accentMultiplier) * lerpT;

  scene.fog!.color.copy(fogColor);
  (materials.ground as THREE.MeshStandardMaterial).color.copy(groundColor);
  ambientLight.color.copy(ambientColor);

  if (platformEdgeMaterial) {
    platformEdgeMaterial.color.copy(platformAccentColor);
    platformEdgeMaterial.emissive.copy(platformAccentColor);
  }
  if (platformCornerMaterial) {
    platformCornerMaterial.color.copy(platformAccentColor);
    platformCornerMaterial.emissive.copy(platformAccentColor);
  }

  (materials.gridLine as THREE.MeshStandardMaterial).color.copy(gridLineColor);
  (materials.gridLine as THREE.MeshStandardMaterial).emissive.copy(gridLineColor);

  if (gridLines) {
    gridLines.children.forEach((line): void => {
      if (line.material) {
        (line.material as THREE.MeshStandardMaterial).color.copy(gridLineColor);
        (line.material as THREE.MeshStandardMaterial).emissive.copy(gridLineColor);
      }
    });
  }

  cyanLight.intensity = originalStageColors.cyanIntensity * accentMult;
  magentaLight.intensity = originalStageColors.magentaIntensity * accentMult;

  if (progress < STAGE_COLOR_THRESHOLDS.CRITICAL) {
    const urgencyIntensity = 1.0 - (progress / STAGE_COLOR_THRESHOLDS.CRITICAL);

    const urgencyColor = progress < STAGE_COLOR_THRESHOLDS.DANGER
      ? urgencyColorRed
      : urgencyColorOrange;

    if (progress < STAGE_COLOR_THRESHOLDS.DANGER) {
      const pulseIntensity = 0.3 + Math.sin(Date.now() * 0.01) * 0.2;
      fillLight.color.copy(urgencyColor);
      fillLight.intensity = pulseIntensity * urgencyIntensity;

      const edgePulse = 0.3 + Math.sin(Date.now() * 0.015) * 0.25;
      if (platformEdgeMaterial) {
        platformEdgeMaterial.emissiveIntensity = edgePulse;
      }
      if (platformCornerMaterial) {
        platformCornerMaterial.emissiveIntensity = 0.5 + Math.sin(Date.now() * 0.015) * 0.3;
      }

      const gridPulse = 0.5 + Math.sin(Date.now() * 0.012) * 0.3;
      (materials.gridLine as THREE.MeshStandardMaterial).emissiveIntensity = gridPulse;
      if (gridLines) {
        gridLines.children.forEach((line): void => {
          if (line.material) {
            (line.material as THREE.MeshStandardMaterial).emissiveIntensity = gridPulse;
          }
        });
      }
    } else {
      fillLight.color.copy(urgencyColorOrange);
      fillLight.intensity = 0.2 * urgencyIntensity;

      if (platformEdgeMaterial) {
        platformEdgeMaterial.emissiveIntensity = 0.15;
      }
      if (platformCornerMaterial) {
        platformCornerMaterial.emissiveIntensity = 0.3;
      }
      (materials.gridLine as THREE.MeshStandardMaterial).emissiveIntensity = 0.4;
      if (gridLines) {
        gridLines.children.forEach((line): void => {
          if (line.material) {
            (line.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.4;
          }
        });
      }
    }
  } else {
    fillLight.color.set(0x4466aa);
    fillLight.intensity = 0.4;

    if (platformEdgeMaterial) {
      platformEdgeMaterial.emissiveIntensity = 0.15;
    }
    if (platformCornerMaterial) {
      platformCornerMaterial.emissiveIntensity = 0.3;
    }
    (materials.gridLine as THREE.MeshStandardMaterial).emissiveIntensity = 0.4;
    if (gridLines) {
      gridLines.children.forEach((line): void => {
        if (line.material) {
          (line.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.4;
        }
      });
    }
  }
}

function resetStageColors(): void {
  currentStageColorProgress = 1.0;

  scene.fog!.color.copy(originalStageColors.fog);
  (materials.ground as THREE.MeshStandardMaterial).color.copy(originalStageColors.ground);
  ambientLight.color.copy(originalStageColors.ambient);
  cyanLight.intensity = originalStageColors.cyanIntensity;
  magentaLight.intensity = originalStageColors.magentaIntensity;
  fillLight.color.set(0x4466aa);
  fillLight.intensity = 0.4;

  if (platformEdgeMaterial) {
    platformEdgeMaterial.color.copy(originalStageColors.platformAccent);
    platformEdgeMaterial.emissive.copy(originalStageColors.platformAccent);
    platformEdgeMaterial.emissiveIntensity = 0.15;
  }
  if (platformCornerMaterial) {
    platformCornerMaterial.color.copy(originalStageColors.platformAccent);
    platformCornerMaterial.emissive.copy(originalStageColors.platformAccent);
    platformCornerMaterial.emissiveIntensity = 0.3;
  }

  (materials.gridLine as THREE.MeshStandardMaterial).color.copy(originalStageColors.gridLine);
  (materials.gridLine as THREE.MeshStandardMaterial).emissive.copy(originalStageColors.gridLine);
  (materials.gridLine as THREE.MeshStandardMaterial).emissiveIntensity = 0.4;

  if (gridLines) {
    gridLines.children.forEach((line): void => {
      if (line.material) {
        (line.material as THREE.MeshStandardMaterial).color.copy(originalStageColors.gridLine);
        (line.material as THREE.MeshStandardMaterial).emissive.copy(originalStageColors.gridLine);
        (line.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.4;
      }
    });
  }
}

function initializePlayerTimers(total: number): void {
  playerTimers.X = { remaining: total, total };
  playerTimers.O = { remaining: total, total };
}

function updateTimerUI(remaining: number, total: number): void {
  const timersContainer = document.getElementById('timers-container');

  if (!game.hasTimer()) {
    if (timersContainer) timersContainer.classList.add('hidden');
    resetStageColors();
    return;
  }

  if (timersContainer) timersContainer.classList.remove('hidden');

  const currentPlayer = game.gameState.getCurrentPlayer();
  playerTimers[currentPlayer].remaining = remaining;
  playerTimers[currentPlayer].total = total;

  const progress = total > 0 ? remaining / total : 1;
  updateStageColors(progress);

  const now = Date.now();
  if (game.isRemote() && game.peerManager && game.isMyTurn() &&
    now - lastTimerSync > TIMER_SYNC_INTERVAL) {
    game.peerManager.sendTimerSync(remaining, currentPlayer);
    lastTimerSync = now;
  }

  updatePlayerTimerDisplay('p1', PLAYERS.X);
  updatePlayerTimerDisplay('p2', PLAYERS.O);

  const timerP1 = document.getElementById('timer-p1');
  const timerP2 = document.getElementById('timer-p2');

  if (timerP1) timerP1.classList.toggle('active', currentPlayer === PLAYERS.X);
  if (timerP2) timerP2.classList.toggle('active', currentPlayer === PLAYERS.O);
}

function updatePlayerTimerDisplay(timerId: string, player: Player): void {
  const timerEl = document.getElementById(`timer-${timerId}`);
  const timerFill = timerEl?.querySelector('.timer-fill') as HTMLElement;
  const timerText = timerEl?.querySelector('.timer-text') as HTMLElement;

  const { remaining, total } = playerTimers[player];
  const progress = total > 0 ? remaining / total : 1;

  if (timerFill) timerFill.style.width = `${progress * 100}%`;
  if (timerText) timerText.textContent = Math.ceil(remaining).toString();

  if (timerFill) timerFill.classList.remove('warning', 'critical');
  if (timerText) timerText.classList.remove('warning', 'critical');

  if (game.gameState.getCurrentPlayer() === player) {
    if (remaining <= TIMER_CRITICAL_SECONDS) {
      if (timerFill) timerFill.classList.add('critical');
      if (timerText) timerText.classList.add('critical');
    } else if (remaining <= total * TIMER_WARNING_THRESHOLD) {
      if (timerFill) timerFill.classList.add('warning');
      if (timerText) timerText.classList.add('warning');
    }
  }
}

function hideTimerUI(): void {
  const timersContainer = document.getElementById('timers-container');
  if (timersContainer) timersContainer.classList.add('hidden');
  resetStageColors();
}

function resetTimerDisplays(): void {
  const total = game.timerSeconds;
  initializePlayerTimers(total);
  resetStageColors();

  const timersContainer = document.getElementById('timers-container');

  if (game.hasTimer()) {
    if (timersContainer) timersContainer.classList.remove('hidden');

    const timerP1Label = document.querySelector('#timer-p1 .timer-label');
    const timerP2Label = document.querySelector('#timer-p2 .timer-label');

    if (timerP1Label) timerP1Label.textContent = getPlayerLabel(PLAYERS.X);
    if (timerP2Label) timerP2Label.textContent = getPlayerLabel(PLAYERS.O);

    updatePlayerTimerDisplay('p1', PLAYERS.X);
    updatePlayerTimerDisplay('p2', PLAYERS.O);

    const timerP1 = document.getElementById('timer-p1');
    const timerP2 = document.getElementById('timer-p2');

    if (timerP1) timerP1.classList.remove('active');
    if (timerP2) timerP2.classList.remove('active');
    if (timerP1) timerP1.classList.add('active');
  } else {
    if (timersContainer) timersContainer.classList.add('hidden');
  }
}

function handleTimerTimeout(): void {
  const currentPlayer = game.gameState.getCurrentPlayer();
  const winner = currentPlayer === PLAYERS.X ? PLAYERS.O : PLAYERS.X;

  if (game.isRemote() && game.peerManager) {
    game.peerManager.sendTimerTimeout(currentPlayer);
  }

  applyTimerTimeout(currentPlayer);
}

function applyTimerTimeout(timedOutPlayer: Player): void {
  const winner = timedOutPlayer === PLAYERS.X ? PLAYERS.O : PLAYERS.X;

  game.gameState.setGameOver(winner, null);
  const winnerPlayer = getPlayerNumberFromSymbol(winner);
  game.scores[winnerPlayer]++;

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

game.onTimerTick = updateTimerUI;
game.onTimerTimeout = handleTimerTimeout;

function showConnectionStatus(message: string): void {
  // Hide sub-screens but keep the overlay visible
  const modeButtons = document.getElementById('mode-buttons');
  const pvpTypeSelect = document.getElementById('pvp-type-select');
  const timerSelect = document.getElementById('timer-select');
  const remoteSetup = document.getElementById('remote-setup');
  const waitingRoom = document.getElementById('waiting-room');
  const difficultySelect = document.getElementById('difficulty-select');
  const connectionStatus = document.getElementById('connection-status');
  const connectionMessage = document.getElementById('connection-message');
  const modeSelectOverlay = document.getElementById('mode-select-overlay');

  if (modeButtons) modeButtons.classList.add('hidden');
  if (pvpTypeSelect) pvpTypeSelect.classList.add('hidden');
  if (timerSelect) timerSelect.classList.add('hidden');
  if (remoteSetup) remoteSetup.classList.add('hidden');
  if (waitingRoom) waitingRoom.classList.add('hidden');
  if (difficultySelect) difficultySelect.classList.add('hidden');

  // Make sure the overlay is visible and show the connection status
  if (modeSelectOverlay) modeSelectOverlay.classList.remove('hidden');
  if (connectionStatus) connectionStatus.classList.remove('hidden');
  if (connectionMessage) connectionMessage.textContent = message;
}

function hideConnectionStatus(): void {
  const connectionStatus = document.getElementById('connection-status');
  if (connectionStatus) connectionStatus.classList.add('hidden');
}

function showWaitingRoom(): void {
  // Hide sub-screens but keep the overlay visible
  const modeButtons = document.getElementById('mode-buttons');
  const pvpTypeSelect = document.getElementById('pvp-type-select');
  const timerSelect = document.getElementById('timer-select');
  const remoteSetup = document.getElementById('remote-setup');
  const connectionStatus = document.getElementById('connection-status');
  const difficultySelect = document.getElementById('difficulty-select');
  const waitingRoom = document.getElementById('waiting-room');
  const modeSelectOverlay = document.getElementById('mode-select-overlay');

  if (modeButtons) modeButtons.classList.add('hidden');
  if (pvpTypeSelect) pvpTypeSelect.classList.add('hidden');
  if (timerSelect) timerSelect.classList.add('hidden');
  if (remoteSetup) remoteSetup.classList.add('hidden');
  if (connectionStatus) connectionStatus.classList.add('hidden');
  if (difficultySelect) difficultySelect.classList.add('hidden');

  // Make sure the overlay is visible and show the waiting room
  if (modeSelectOverlay) modeSelectOverlay.classList.remove('hidden');
  if (waitingRoom) waitingRoom.classList.remove('hidden');
}

function hideWaitingRoom(): void {
  const waitingRoom = document.getElementById('waiting-room');
  if (waitingRoom) waitingRoom.classList.add('hidden');
}

// NOTE: All event handlers are now in attachAllEventListeners() function below
// This prevents duplicate event listeners

// Check for room code in URL
const urlRoomCode = new URLSearchParams(window.location.search).get('room');

function attachAllEventListeners(): void {
  console.log('[Debug] Attaching event listeners...');

  // Mode button handlers
  document.querySelectorAll('.mode-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      console.log('[Debug] Mode button clicked:', btn.getAttribute('data-mode'));
      const mode = btn.getAttribute('data-mode');
      if (mode === 'pvp') {
        document.getElementById('mode-buttons')?.classList.add('hidden');
        document.getElementById('pvp-type-select')?.classList.remove('hidden');
      } else if (mode === 'ai') {
        document.getElementById('mode-buttons')?.classList.add('hidden');
        document.getElementById('difficulty-select')?.classList.remove('hidden');
      }
    });
  });

  // PvP type handlers
  document.querySelectorAll('.pvp-type-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      console.log('[Debug] PvP type button clicked:', btn.getAttribute('data-pvp-type'));
      const type = btn.getAttribute('data-pvp-type');
      if (type === 'local') {
        console.log('[Debug] Starting local PvP game...');
        game.startGame('pvp-local');
        hideAllModeScreens();
        hideMessage();
        document.getElementById('ui-overlay')?.classList.remove('hidden');
        rebuildBoardFromState();
        updateUI();
        resetTimerDisplays();
        game.startTimer();
      } else if (type === 'remote') {
        document.getElementById('pvp-type-select')?.classList.add('hidden');
        document.getElementById('remote-setup')?.classList.remove('hidden');
      }
    });
  });

  // Difficulty handlers
  document.querySelectorAll('.difficulty-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      console.log('[Debug] Difficulty button clicked:', btn.getAttribute('data-difficulty'));
      const difficulty = btn.getAttribute('data-difficulty') as AIDifficulty;
      const timer = parseInt(btn.getAttribute('data-timer') || '0');
      console.log('[Debug] Starting AI game:', difficulty, 'timer:', timer);
      game.startGame('ai', difficulty, timer);
      hideAllModeScreens();
      hideMessage();
      document.getElementById('ui-overlay')?.classList.remove('hidden');
      rebuildBoardFromState();
      updateUI();
      resetTimerDisplays();
      game.startTimer();
    });
  });

  // Back button handlers
  document.getElementById('back-to-pvp-type')?.addEventListener('click', () => {
    document.getElementById('remote-setup')?.classList.add('hidden');
    document.getElementById('pvp-type-select')?.classList.remove('hidden');
  });

  document.getElementById('back-to-pvp-type-from-timer')?.addEventListener('click', () => {
    document.getElementById('timer-select')?.classList.add('hidden');
    document.getElementById('pvp-type-select')?.classList.remove('hidden');
  });

  // Game control buttons
  document.getElementById('reset-btn')?.addEventListener('click', () => {
    if (game.isRemote() && game.peerManager) {
      // For remote games, send a rematch request instead of directly resetting
      const myRole = game.getMyRole();
      const playerNum = myRole === PLAYERS.X ? 1 : 2;
      game.peerManager.sendRematchRequest(playerNum as 1 | 2);
      // Show waiting modal
      document.getElementById('waiting-rematch-modal')?.classList.remove('hidden');
    } else {
      // For local games, reset immediately
      game.resetGame(true, true);
      hideMessage();
      rebuildBoardFromState();
      updateUI();
      resetTimerDisplays();
      game.startTimer();
    }
  });

  document.getElementById('menu-btn')?.addEventListener('click', () => {
    game.cleanup();
    showModeSelectScreen();
    document.getElementById('ui-overlay')?.classList.add('hidden');
    clearPieces();
  });

  // Rematch modal handlers
  document.getElementById('accept-rematch-btn')?.addEventListener('click', () => {
    if (game.peerManager) {
      game.peerManager.sendRematchResponse(true);
    }
    document.getElementById('rematch-modal')?.classList.add('hidden');
    // Reset the game
    game.resetGame(false, true);
    hideMessage();
    rebuildBoardFromState();
    updateUI();
    resetTimerDisplays();
    game.startTimer();
  });

  document.getElementById('decline-rematch-btn')?.addEventListener('click', () => {
    if (game.peerManager) {
      game.peerManager.sendRematchResponse(false);
    }
    document.getElementById('rematch-modal')?.classList.add('hidden');
    // Go back to menu
    game.cleanup();
    showModeSelectScreen();
    document.getElementById('ui-overlay')?.classList.add('hidden');
    clearPieces();
  });

  document.getElementById('cancel-rematch-btn')?.addEventListener('click', () => {
    document.getElementById('waiting-rematch-modal')?.classList.add('hidden');
  });

  // Canvas click handler for game moves
  canvas.addEventListener('click', (event) => {
    const rect = canvas.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(clickTargets);

    if (intersects.length > 0 && game.canMove()) {
      const cellIndex = intersects[0].object.userData.cellIndex;
      game.handleMove(cellIndex);
      rebuildBoardFromState();
      updateUI();

      const status = game.gameState.isGameOver();
      if (status) {
        const board = game.gameState.getBoard();
        const gameStatus = getGameStatus(board);
        if (gameStatus.pattern) {
          highlightWinningPieces(gameStatus.pattern);
        }
        if (gameStatus.isDraw) {
          showMessage("IT'S A DRAW!");
        } else if (gameStatus.winner) {
          showMessage(`${getPlayerLabel(gameStatus.winner)} WINS!`);
        }
      }

      // Trigger AI move if needed
      if (game.isAITurn()) {
        setTimeout(() => {
          game.triggerAIMove().then((result) => {
            if (result && result !== false) {
              rebuildBoardFromState();
              updateUI();

              const board = game.gameState.getBoard();
              const gameStatus = getGameStatus(board);
              if (gameStatus.pattern) {
                highlightWinningPieces(gameStatus.pattern);
              }
              if (gameStatus.isDraw) {
                showMessage("IT'S A DRAW!");
              } else if (gameStatus.winner) {
                showMessage(`${getPlayerLabel(gameStatus.winner)} WINS!`);
              }
            }
          });
        }, 100);
      }
    }
  });

  // Handle window resize
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Create room button
  document.getElementById('create-room-btn')?.addEventListener('click', async () => {
    console.log('[Debug] Create room button clicked');
    const peerManager = new PeerManager();
    game.startRemoteGame(peerManager);

    showConnectionStatus('Creating room...');

    try {
      console.log('[Debug] Initializing peer...');
      await peerManager.initialize();
      console.log('[Debug] Peer initialized successfully');
      const roomCode = peerManager.getStatus().roomCode;
      console.log('[Debug] Room code:', roomCode);

      const roomCodeValue = document.getElementById('room-code-value');
      const shareLink = document.getElementById('share-link') as HTMLInputElement;
      if (roomCodeValue) roomCodeValue.textContent = roomCode || '';
      if (shareLink) shareLink.value = peerManager.getShareableLink();

      hideConnectionStatus();
      showWaitingRoom();
      console.log('[Debug] Waiting room should now be visible');

      // When guest connects, transition host from waiting room to game
      peerManager.onConnect = () => {
        hideConnectionStatus();
        hideWaitingRoom();
        hideAllModeScreens();
        document.getElementById('ui-overlay')?.classList.remove('hidden');
        rebuildBoardFromState();
        updateUI();
        resetTimerDisplays();
        game.startTimer();
      };

      peerManager.onDisconnect = () => {
        showMessage('Opponent disconnected');
        setTimeout(() => {
          game.cleanup();
          hideAllModeScreens();
          document.getElementById('mode-select-overlay')?.classList.remove('hidden');
        }, 2000);
      };

      peerManager.onMessage = (data) => {
        if (data.type === MESSAGE_TYPES.GAME_START) {
          hideConnectionStatus();
          hideWaitingRoom();
          hideAllModeScreens();
          document.getElementById('ui-overlay')?.classList.remove('hidden');
          rebuildBoardFromState();
          updateUI();
          resetTimerDisplays();
          game.startTimer();
        } else if (data.type === MESSAGE_TYPES.MOVE) {
          const moveData = data as { cellIndex: number };
          game.handleMove(moveData.cellIndex, true);
          rebuildBoardFromState();
          updateUI();
          checkGameOverAndShowMessage();
        } else if (data.type === MESSAGE_TYPES.RESET) {
          game.resetGame(false, true);
          rebuildBoardFromState();
          updateUI();
        } else if (data.type === MESSAGE_TYPES.TIMER_SYNC) {
          const timerData = data as { remaining: number; player: Player };
          playerTimers[timerData.player].remaining = timerData.remaining;
          updatePlayerTimerDisplay(timerData.player === PLAYERS.X ? 'p1' : 'p2', timerData.player);
        } else if (data.type === MESSAGE_TYPES.TIMER_TIMEOUT) {
          const timeoutData = data as { timedOutPlayer: Player };
          applyTimerTimeout(timeoutData.timedOutPlayer);
        } else if (data.type === MESSAGE_TYPES.FULL_SYNC) {
          const syncData = data as { state: ReturnType<typeof game.getFullState> };
          game.applyFullState(syncData.state);
          rebuildBoardFromState();
          updateUI();
        } else if (data.type === MESSAGE_TYPES.REMATCH_REQUEST) {
          // Show rematch request modal
          const rematchModal = document.getElementById('rematch-modal');
          const rematchMessage = document.getElementById('rematch-message');
          if (rematchMessage) rematchMessage.textContent = 'Opponent wants to play again!';
          if (rematchModal) rematchModal.classList.remove('hidden');
        } else if (data.type === MESSAGE_TYPES.REMATCH_RESPONSE) {
          const responseData = data as { accepted: boolean };
          document.getElementById('waiting-rematch-modal')?.classList.add('hidden');
          if (responseData.accepted) {
            // Reset the game
            game.resetGame(false, true);
            hideMessage();
            rebuildBoardFromState();
            updateUI();
            resetTimerDisplays();
            game.startTimer();
          } else {
            // Opponent declined, go back to menu
            showMessage('Opponent declined rematch');
            setTimeout(() => {
              game.cleanup();
              showModeSelectScreen();
              document.getElementById('ui-overlay')?.classList.add('hidden');
              clearPieces();
            }, 2000);
          }
        }
      };
    } catch (err) {
      console.error('Failed to create room:', err);
      showConnectionStatus('Failed to create room. Please try again.');
      setTimeout(hideConnectionStatus, 2000);
    }
  });

  // Join room button
  document.getElementById('join-room-btn')?.addEventListener('click', async () => {
    const roomCodeInput = document.getElementById('room-code-input') as HTMLInputElement;
    const roomCode = roomCodeInput?.value.trim().toUpperCase();

    if (!roomCode) {
      alert('Please enter a room code');
      return;
    }

    const peerManager = new PeerManager();
    game.startRemoteGame(peerManager);

    showConnectionStatus('Connecting to room...');

    peerManager.onDisconnect = () => {
      showMessage('Connection lost');
      setTimeout(() => {
        game.cleanup();
        hideAllModeScreens();
        document.getElementById('mode-select-overlay')?.classList.remove('hidden');
      }, 2000);
    };

    peerManager.onMessage = (data) => {
      if (data.type === MESSAGE_TYPES.GAME_START) {
        hideConnectionStatus();
        hideWaitingRoom();
        hideAllModeScreens();
        document.getElementById('ui-overlay')?.classList.remove('hidden');
        rebuildBoardFromState();
        updateUI();
        resetTimerDisplays();
        game.startTimer();
      } else if (data.type === MESSAGE_TYPES.MOVE) {
        const moveData = data as { cellIndex: number };
        game.handleMove(moveData.cellIndex, true);
        rebuildBoardFromState();
        updateUI();
        checkGameOverAndShowMessage();
      } else if (data.type === MESSAGE_TYPES.RESET) {
        game.resetGame(false, true);
        rebuildBoardFromState();
        updateUI();
      } else if (data.type === MESSAGE_TYPES.TIMER_SYNC) {
        const timerData = data as { remaining: number; player: Player };
        playerTimers[timerData.player].remaining = timerData.remaining;
        updatePlayerTimerDisplay(timerData.player === PLAYERS.X ? 'p1' : 'p2', timerData.player);
      } else if (data.type === MESSAGE_TYPES.TIMER_TIMEOUT) {
        const timeoutData = data as { timedOutPlayer: Player };
        applyTimerTimeout(timeoutData.timedOutPlayer);
      } else if (data.type === MESSAGE_TYPES.FULL_SYNC) {
        const syncData = data as { state: ReturnType<typeof game.getFullState> };
        game.applyFullState(syncData.state);
        rebuildBoardFromState();
        updateUI();
      } else if (data.type === MESSAGE_TYPES.REMATCH_REQUEST) {
        // Show rematch request modal
        const rematchModal = document.getElementById('rematch-modal');
        const rematchMessage = document.getElementById('rematch-message');
        if (rematchMessage) rematchMessage.textContent = 'Opponent wants to play again!';
        if (rematchModal) rematchModal.classList.remove('hidden');
      } else if (data.type === MESSAGE_TYPES.REMATCH_RESPONSE) {
        const responseData = data as { accepted: boolean };
        document.getElementById('waiting-rematch-modal')?.classList.add('hidden');
        if (responseData.accepted) {
          // Reset the game
          game.resetGame(false, true);
          hideMessage();
          rebuildBoardFromState();
          updateUI();
          resetTimerDisplays();
          game.startTimer();
        } else {
          // Opponent declined, go back to menu
          showMessage('Opponent declined rematch');
          setTimeout(() => {
            game.cleanup();
            showModeSelectScreen();
            document.getElementById('ui-overlay')?.classList.add('hidden');
            clearPieces();
          }, 2000);
        }
      }
    };

    try {
      // Must initialize peer before connecting
      await peerManager.initialize();
      await peerManager.connect(roomCode);
    } catch (err) {
      console.error('Failed to join room:', err);
      showConnectionStatus('Failed to join room. Please check the code.');
      setTimeout(hideConnectionStatus, 2000);
    }
  });

  // Copy link button
  document.getElementById('copy-link-btn')?.addEventListener('click', () => {
    const shareLink = document.getElementById('share-link') as HTMLInputElement;
    if (shareLink) {
      shareLink.select();
      document.execCommand('copy');
      const btn = document.getElementById('copy-link-btn');
      if (btn) btn.textContent = 'COPIED!';
      setTimeout(() => {
        if (btn) btn.textContent = '📋 COPY';
      }, 2000);
    }
  });

  // Cancel waiting button
  document.getElementById('cancel-waiting-btn')?.addEventListener('click', () => {
    game.cleanup();
    hideAllModeScreens();
    document.getElementById('mode-select-overlay')?.classList.remove('hidden');
  });
}

// Attach event listeners when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', attachAllEventListeners);
} else {
  attachAllEventListeners();
}

// Handle URL room code after listeners are attached - auto join the room
if (urlRoomCode) {
  console.log('[Debug] Room code found in URL:', urlRoomCode);

  setTimeout(async () => {
    const peerManager = new PeerManager();
    game.startRemoteGame(peerManager);

    showConnectionStatus('Joining room...');

    peerManager.onDisconnect = () => {
      showMessage('Connection lost');
      setTimeout(() => {
        game.cleanup();
        hideAllModeScreens();
        document.getElementById('mode-select-overlay')?.classList.remove('hidden');
      }, 2000);
    };

    peerManager.onMessage = (data) => {
      if (data.type === MESSAGE_TYPES.GAME_START) {
        console.log('[Debug] Guest received GAME_START message');
        hideConnectionStatus();
        hideWaitingRoom();
        hideAllModeScreens();
        document.getElementById('ui-overlay')?.classList.remove('hidden');
        rebuildBoardFromState();
        updateUI();
        resetTimerDisplays();
        game.startTimer();
        clearRoomCodeFromUrl();
      } else if (data.type === MESSAGE_TYPES.MOVE) {
        const moveData = data as { cellIndex: number };
        game.handleMove(moveData.cellIndex, true);
        rebuildBoardFromState();
        updateUI();
        checkGameOverAndShowMessage();
      } else if (data.type === MESSAGE_TYPES.RESET) {
        game.resetGame(false, true);
        rebuildBoardFromState();
        updateUI();
      } else if (data.type === MESSAGE_TYPES.TIMER_SYNC) {
        const timerData = data as { remaining: number; player: Player };
        playerTimers[timerData.player].remaining = timerData.remaining;
        updatePlayerTimerDisplay(timerData.player === PLAYERS.X ? 'p1' : 'p2', timerData.player);
      } else if (data.type === MESSAGE_TYPES.TIMER_TIMEOUT) {
        const timeoutData = data as { timedOutPlayer: Player };
        applyTimerTimeout(timeoutData.timedOutPlayer);
      } else if (data.type === MESSAGE_TYPES.FULL_SYNC) {
        const syncData = data as { state: ReturnType<typeof game.getFullState> };
        game.applyFullState(syncData.state);
        rebuildBoardFromState();
        updateUI();
      } else if (data.type === MESSAGE_TYPES.REMATCH_REQUEST) {
        // Show rematch request modal
        const rematchModal = document.getElementById('rematch-modal');
        const rematchMessage = document.getElementById('rematch-message');
        if (rematchMessage) rematchMessage.textContent = 'Opponent wants to play again!';
        if (rematchModal) rematchModal.classList.remove('hidden');
      } else if (data.type === MESSAGE_TYPES.REMATCH_RESPONSE) {
        const responseData = data as { accepted: boolean };
        document.getElementById('waiting-rematch-modal')?.classList.add('hidden');
        if (responseData.accepted) {
          // Reset the game
          game.resetGame(false, true);
          hideMessage();
          rebuildBoardFromState();
          updateUI();
          resetTimerDisplays();
          game.startTimer();
        } else {
          // Opponent declined, go back to menu
          showMessage('Opponent declined rematch');
          setTimeout(() => {
            game.cleanup();
            showModeSelectScreen();
            document.getElementById('ui-overlay')?.classList.add('hidden');
            clearPieces();
          }, 2000);
        }
      }
    };

    try {
      console.log('[Debug] Initializing peer for joining...');
      await peerManager.initialize();
      console.log('[Debug] Connecting to room:', urlRoomCode);
      await peerManager.connect(urlRoomCode);
      console.log('[Debug] Connected to room, waiting for GAME_START');
    } catch (err) {
      console.error('Failed to join room:', err);
      showConnectionStatus('Failed to join room. Please check the code.');
      setTimeout(() => {
        hideConnectionStatus();
        showModeSelectScreen();
      }, 2000);
    }
  }, 500);
}

// Animation loop
function animate(): void {
  requestAnimationFrame(animate);

  // Update controls
  controls.update();

  // Animate particles
  const time = Date.now() * 0.001;
  for (let i = 0; i < particleCount; i++) {
    particlePositions[i * 3 + 1] += Math.sin(time * 0.5 + i * 0.1) * 0.003;
    if (particlePositions[i * 3 + 1] > 15) particlePositions[i * 3 + 1] = 0;
    if (particlePositions[i * 3 + 1] < 0) particlePositions[i * 3 + 1] = 15;
  }
  particleGeometry.attributes.position.needsUpdate = true;

  // Render scene
  renderer.render(scene, camera);
}

// Start animation loop
animate();