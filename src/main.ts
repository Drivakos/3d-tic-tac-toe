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
import {
  materials,
  xGeometries,
  oGeometries,
  glowMaterials,
  urgencyColors,
  X_CONFIG,
  BOARD_CONFIG
} from './rendering/Materials';
import {
  initializeScene,
  adjustCameraForDevice,
  handleWindowResize,
  CAMERA_POSITIONS,
  type SceneComponents
} from './rendering/SceneManager';
import {
  initializeBoard,
  addPieceToBoard as boardAddPiece,
  clearPieces as boardClearPieces,
  highlightWinningPieces as boardHighlightWinning,
  rebuildBoardFromState as boardRebuild,
  type BoardComponents
} from './rendering/BoardRenderer';
import {
  showMessage as uiShowMessage,
  hideMessage as uiHideMessage,
  hideAllModeScreens as uiHideAllModeScreens,
  showModeSelectScreen as uiShowModeSelectScreen,
  updateScoreDisplay,
  updateCurrentPlayerDisplay,
  updateTurnIndicator,
  updateTimerDisplay as uiUpdateTimerDisplay,
  hideTimerDisplay,
  showTimerDisplay
} from './ui/UIManager';
import {
  createStageColorManager,
  type StageColorManager,
  STAGE_COLOR_THRESHOLDS
} from './rendering/StageColorManager';
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

// ============================================================================
// Scene Setup (imported from ./rendering/SceneManager)
// ============================================================================

const sceneComponents = initializeScene('game-canvas');
const { scene, camera, renderer, controls, boardGroup } = sceneComponents;
const canvas = sceneComponents.canvas;

// Expose lights for stage effects (needed by updateStageColors)
const cyanLight = sceneComponents.lights.cyan;
const magentaLight = sceneComponents.lights.magenta;
const ambientLight = sceneComponents.lights.ambient;
const fillLight = sceneComponents.lights.fill;
const groundPlane = sceneComponents.groundPlane;

// Materials, geometries, and configs imported from ./rendering/Materials
// Local aliases for backward compatibility
const xCylinderGeometry = xGeometries.cylinder;
const xTopCapGeometry = xGeometries.topCap;
const xBottomCapGeometry = xGeometries.bottomCap;
const xGlowArmGeometry = xGeometries.glow;
const oTorusGeometry = oGeometries.torus;
const oGlowGeometry = oGeometries.glow;
const xGlowMaterial = glowMaterials.x;
const oGlowMaterial = glowMaterials.o;
const urgencyColorRed = urgencyColors.red;
const urgencyColorOrange = urgencyColors.orange;
const X_ARM_LENGTH = X_CONFIG.ARM_LENGTH;
const X_TUBE_RADIUS = X_CONFIG.TUBE_RADIUS;

// Fog already added by SceneManager

// Board configuration imported from Materials
const CELL_SIZE = BOARD_CONFIG.CELL_SIZE;

// ============================================================================
// Board Setup (imported from ./rendering/BoardRenderer)
// ============================================================================

const boardComponents = initializeBoard(boardGroup, scene);
const clickTargets = boardComponents.clickTargets;
const pieces = boardComponents.pieces;
const gridLines = boardComponents.gridLines;
const particleCount = boardComponents.particleCount;
const particlePositions = boardComponents.particlePositions;
const particleGeometry = boardComponents.particleGeometry;
let platformEdgeMaterial = boardComponents.platformEdgeMaterial;
let platformCornerMaterial = boardComponents.platformCornerMaterial;

// Wrapper functions for backward compatibility
function addPieceToBoard(cellIndex: number, player: Player): THREE.Group {
  return boardAddPiece(boardGroup, pieces, cellIndex, player);
}

function clearPieces(): void {
  boardClearPieces(boardGroup, pieces);
}

function highlightWinningPieces(pattern: number[]): void {
  boardHighlightWinning(pieces, pattern);
}

function rebuildBoardFromState(): void {
  boardRebuild(boardGroup, pieces, game.gameState.getBoard());
}

// ============================================================================
// UI Functions (imported from ./ui/UIManager)
// ============================================================================

function showMessage(text: string): void {
  uiShowMessage(text);
}

function hideMessage(): void {
  uiHideMessage();
}

function getPlayerNumberFromSymbol(symbol: Player): 1 | 2 {
  const playerAsX = game.gameState.getPlayerAsX();
  return symbol === PLAYERS.X ? playerAsX : (playerAsX === 1 ? 2 : 1);
}

function updateUI(): void {
  const currentPlayer = game.gameState.getCurrentPlayer();

  // Update current player display
  let playerLabel: string;
  if (game.mode === GAME_MODES.AI) {
    if (currentPlayer === PLAYERS.X) {
      playerLabel = getPlayerLabel(PLAYERS.X);
    } else {
      // Note: accessing isThinking requires making it public or using a getter
      playerLabel = 'AI';
    }
  } else {
    playerLabel = getPlayerLabel(currentPlayer);
  }
  updateCurrentPlayerDisplay(playerLabel, `player-${currentPlayer.toLowerCase()}`);

  // Update score display
  updateScoreDisplay(game.scores);

  // Update remote turn indicator
  if (game.isRemote()) {
    updateRemoteTurnIndicator();
  }
}

function updateRemoteTurnIndicator(): void {
  const isMyTurn = game.isMyTurn();
  const currentPlayer = game.gameState.getCurrentPlayer();
  const playerLabel = getPlayerLabel(currentPlayer);
  updateTurnIndicator(isMyTurn, playerLabel);
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
  uiHideAllModeScreens();
}

function showModeSelectScreen(): void {
  uiShowModeSelectScreen();
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

// ============================================================================
// Stage Color Manager (imported from ./rendering/StageColorManager)
// ============================================================================

const stageColorManager = createStageColorManager({
  scene,
  ambientLight,
  fillLight,
  cyanLight,
  magentaLight,
  groundMaterial: materials.ground as THREE.MeshStandardMaterial,
  gridLineMaterial: materials.gridLine as THREE.MeshStandardMaterial,
  gridLines,
  platformEdgeMaterial,
  platformCornerMaterial
});

function updateStageColors(progress: number): void {
  stageColorManager.update(progress);
}

function resetStageColors(): void {
  stageColorManager.reset();
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

      // Hide all intermediate screens first
      document.getElementById('mode-buttons')?.classList.add('hidden');
      document.getElementById('pvp-type-select')?.classList.add('hidden');
      document.getElementById('timer-select')?.classList.add('hidden');
      document.getElementById('remote-setup')?.classList.add('hidden');
      document.getElementById('difficulty-select')?.classList.add('hidden');

      if (mode === 'pvp') {
        document.getElementById('pvp-type-select')?.classList.remove('hidden');
      } else if (mode === 'ai') {
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