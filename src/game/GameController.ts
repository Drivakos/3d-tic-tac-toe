import { GameState } from './GameState';
import { getGameStatus } from './GameLogic';
import { AIController } from './AI';
import { PLAYERS, GAME_MODES } from './constants';
import { PeerManager, MESSAGE_TYPES } from '../multiplayer/PeerManager';
import { Timer, TIMER_PRESETS } from './Timer';
import type { Player, GameMode, AIDifficulty, GameStatus, Score, CellIndex, GameState as GameStateType } from '../types';

export interface GameSettings {
    timerSeconds: number;
}

export class GameController {
    gameState: GameState;
    scores: Score;
    mode: GameMode | null;
    aiController: AIController | null;
    peerManager: PeerManager | null;
    timerSeconds: number;
    timer: Timer | null;
    onTimerTick: ((remaining: number, total: number) => void) | null;
    onTimerTimeout: (() => void) | null;

    // Track game started state internally
    private gameStarted: boolean = false;

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
                // Use safer type access or default to 0 if not found
                const preset = TIMER_PRESETS[difficulty.toUpperCase() as keyof typeof TIMER_PRESETS];
                this.timerSeconds = preset || 0;
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
            this.peerManager!.sendMove(cellIndex as CellIndex);
        }

        const status = getGameStatus(this.gameState.getBoard());

        if (status.isOver) {
            this.gameState.setGameOver(status.winner, status.pattern ?? null);
            if (status.winner) {
                const winnerPlayer = this.getPlayerNumberFromSymbol(status.winner);
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

    getFullState(): { gameState: GameStateType; scores: Score; timerSeconds: number; gameStarted: boolean } {
        return {
            gameState: this.gameState.toJSON(),
            scores: { ...this.scores },
            timerSeconds: this.timerSeconds,
            gameStarted: this.gameStarted
        };
    }

    applyFullState(state: { gameState?: GameStateType; scores?: Score; timerSeconds?: number; gameStarted?: boolean }): void {
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
            this.gameStarted = state.gameStarted;
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
        return this.mode === GAME_MODES.PVP_REMOTE && (this.peerManager?.isConnected ?? false);
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
        if (this.aiController?.thinking) return false;
        if (this.mode === GAME_MODES.AI && this.gameState.getCurrentPlayer() === PLAYERS.O) return false;
        if (this.isRemote() && !this.isMyTurn()) return false;
        return true;
    }

    async triggerAIMove(): Promise<{ moved: boolean; status: GameStatus } | false | null> {
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

    getPlayerNumberFromSymbol(symbol: string): 1 | 2 {
        // Helper to avoid circular dependency or simple utility
        // Assuming Player type is string 'X' | 'O'
        const playerAsX = this.gameState.getPlayerAsX();
        return symbol === PLAYERS.X ? playerAsX : (playerAsX === 1 ? 2 : 1);
    }
}
