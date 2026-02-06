import * as THREE from 'three'; // Import THREE for Raycaster

import { GameController } from '../game/GameController';
import { GameMode, AIDifficulty, Player, GameStatus } from '../types';
import { PLAYERS } from '../game/constants';
import { RenderManager } from '../rendering/RenderManager';
import {
    updateScoreDisplay,
    updateCurrentPlayerDisplay,
    updateTurnIndicator,
    hideMessage,
    showMessage,
    showModeSelectScreen,
    hideAllModeScreens
} from './UIManager';

export class InputManager {
    private game: GameController;
    private renderManager: RenderManager;
    private uiOverlay: HTMLElement | null;
    private raycaster: THREE.Raycaster;
    private mouse: THREE.Vector2;

    constructor(game: GameController, renderManager: RenderManager) {
        this.game = game;
        this.renderManager = renderManager;
        this.uiOverlay = document.getElementById('ui-overlay');
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
    }

    public attachAllEventListeners(): void {
        console.log('[Debug] Attaching event listeners...');

        // Canvas Click Listener (Raycasting)
        const canvas = this.renderManager.sceneComponents.renderer.domElement;
        canvas.addEventListener('click', (event) => this.handleCanvasClick(event));
        // Simple touch support (treat as click)
        // canvas.addEventListener('touchstart', (event) => this.handleCanvasClick(event), { passive: false });

        // Mode button handlers
        document.querySelectorAll('.mode-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const mode = btn.getAttribute('data-mode');
                this.handleModeSelection(mode);
            });
        });

        // PvP type handlers
        document.querySelectorAll('.pvp-type-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const type = btn.getAttribute('data-pvp-type');
                this.handlePvpTypeSelection(type);
            });
        });

        // Difficulty handlers
        document.querySelectorAll('.difficulty-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const difficulty = btn.getAttribute('data-difficulty') as AIDifficulty;
                const timer = parseInt(btn.getAttribute('data-timer') || '0');
                this.handleDifficultySelection(difficulty, timer);
            });
        });

        // Back button handlers
        this.attachBackButtons();

        // Game control buttons
        this.attachGameControls();

        // Remote setup handlers
        this.attachRemoteSetup();

        // Rematch modal handlers
        this.attachRematchHandlers();
    }

    private handleCanvasClick(event: MouseEvent | TouchEvent): void {
        event.preventDefault();

        const canvas = this.renderManager.sceneComponents.renderer.domElement;
        const rect = canvas.getBoundingClientRect();

        let clientX, clientY;

        if (window.TouchEvent && event instanceof TouchEvent) {
            clientX = event.touches[0].clientX;
            clientY = event.touches[0].clientY;
        } else {
            const mouseEvent = event as MouseEvent;
            clientX = mouseEvent.clientX;
            clientY = mouseEvent.clientY;
        }

        this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.renderManager.sceneComponents.camera);

        const intersects = this.raycaster.intersectObjects(this.renderManager.boardComponents.clickTargets);

        if (intersects.length > 0) {
            const index = intersects[0].object.userData.cellIndex;
            if (typeof index === 'number') {
                this.processMove(index);
            }
        }
    }

    private async processMove(index: number): Promise<void> {
        // Check if it's our turn (important for remote PvP)
        if (!this.game.canMove()) {
            console.log('[InputManager] Cannot move - not my turn or game is over');
            return;
        }

        // Human Move
        const result = this.game.handleMove(index);

        if (result && result.moved) {
            // Update View
            const player = this.game.gameState.getCell(index);
            if (player) {
                this.renderManager.addPiece(index, player);
                // Play sound?
            }
            this.updateUI();

            if (result.status.isOver) {
                this.handleGameOver(result.status);
            } else {
                // Check if AI turn
                if (this.game.mode === 'ai' && this.game.gameState.getCurrentPlayer() === PLAYERS.O) {
                    await this.processAIMove();
                }
            }
        }
    }

    private async processAIMove(): Promise<void> {
        // Small delay for realism
        setTimeout(async () => {
            const result = await this.game.triggerAIMove();
            if (result && result.moved) {
                // Since triggerAIMove doesn't return the cell index, we rebuild the board OR we could find the diff.
                // Rebuilding is reliable.
                this.renderManager.rebuildBoard(this.game.gameState.getBoard());
                this.updateUI();

                if (result.status.isOver) {
                    this.handleGameOver(result.status);
                }
            }
        }, 500);
    }

    private handleGameOver(status: GameStatus): void {
        if (status.winner) {
            this.renderManager.highlightWinning([...(status.pattern || [])]);
            const winnerText = status.winner === PLAYERS.X ? 'Player X Wins!' : 'Player O Wins!';
            // Better text: P1 Wins!
            const playerNum = this.game.getPlayerNumberFromSymbol(status.winner);
            showMessage(`Player ${playerNum} Wins!`);
        } else if (status.isDraw) {
            showMessage("It's a Draw!");
        }
    }

    private handleModeSelection(mode: string | null): void {
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
    }

    private handlePvpTypeSelection(type: string | null): void {
        if (type === 'local') {
            console.log('[Debug] Starting local PvP game...');
            this.game.startGame('pvp-local');
            hideAllModeScreens();
            hideMessage();
            this.uiOverlay?.classList.remove('hidden');

            this.renderManager.rebuildBoard(this.game.gameState.getBoard());
            this.updateUI();
            this.game.startTimer();
        } else if (type === 'remote') {
            document.getElementById('pvp-type-select')?.classList.add('hidden');
            document.getElementById('remote-setup')?.classList.remove('hidden');
        }
    }

    private handleDifficultySelection(difficulty: AIDifficulty, timer: number): void {
        console.log('[Debug] Starting AI game:', difficulty, 'timer:', timer);
        this.game.startGame('ai', difficulty, timer);
        hideAllModeScreens();
        hideMessage();
        this.uiOverlay?.classList.remove('hidden');
        this.renderManager.rebuildBoard(this.game.gameState.getBoard());
        this.updateUI();
        this.game.startTimer();
    }

    private attachBackButtons(): void {
        document.getElementById('back-to-pvp-type')?.addEventListener('click', () => {
            document.getElementById('remote-setup')?.classList.add('hidden');
            document.getElementById('pvp-type-select')?.classList.remove('hidden');
        });

        document.getElementById('back-to-pvp-type-from-timer')?.addEventListener('click', () => {
            document.getElementById('timer-select')?.classList.add('hidden');
            document.getElementById('pvp-type-select')?.classList.remove('hidden');
        });
    }

    private attachGameControls(): void {
        document.getElementById('reset-btn')?.addEventListener('click', () => {
            if (this.game.isRemote() && this.game.peerManager) {
                const myRole = this.game.getMyRole();
                const playerNum = myRole === PLAYERS.X ? 1 : 2;
                this.game.peerManager.sendRematchRequest(playerNum as 1 | 2);
                document.getElementById('waiting-rematch-modal')?.classList.remove('hidden');
            } else {
                this.game.resetGame(true, true);
                hideMessage();
                this.renderManager.rebuildBoard(this.game.gameState.getBoard());
                this.updateUI();
                this.game.startTimer();
            }
        });

        document.getElementById('menu-btn')?.addEventListener('click', () => {
            this.game.cleanup();
            showModeSelectScreen();
            this.uiOverlay?.classList.add('hidden');
            this.renderManager.clearPieces();
        });
    }

    private attachRemoteSetup(): void {
        document.getElementById('create-room-btn')?.addEventListener('click', async () => {
            const timer = 0;
            if (this.onCreateRoom) await this.onCreateRoom(timer);
        });

        document.getElementById('join-room-btn')?.addEventListener('click', () => {
            const codeInput = document.getElementById('room-code-input') as HTMLInputElement;
            const code = codeInput?.value.toUpperCase();
            if (code && code.length >= 4) {
                if (this.onJoinRoom) this.onJoinRoom(code);
            }
        });
        document.getElementById('copy-link-btn')?.addEventListener('click', () => {
            const shareLink = document.getElementById('share-link') as HTMLInputElement;
            if (shareLink) {
                shareLink.select();
                navigator.clipboard.writeText(shareLink.value).then(() => {
                    const btn = document.getElementById('copy-link-btn');
                    if (btn) {
                        const originalText = btn.innerHTML;
                        btn.innerHTML = '<span>✓</span> COPIED!';
                        setTimeout(() => {
                            btn.innerHTML = originalText;
                        }, 2000);
                    }
                }).catch(err => {
                    console.error('Failed to copy text: ', err);
                });
            }
        });

        // Cancel waiting for opponent
        document.getElementById('cancel-waiting-btn')?.addEventListener('click', () => {
            document.getElementById('waiting-room')?.classList.add('hidden');
            document.getElementById('remote-setup')?.classList.remove('hidden');
            // Cleanup peer connection
            if (this.game.peerManager) {
                this.game.peerManager.destroy();
            }
        });
    }

    private attachRematchHandlers(): void {
        document.getElementById('accept-rematch-btn')?.addEventListener('click', () => {
            if (this.game.peerManager) {
                this.game.peerManager.sendRematchResponse(true);
            }
            document.getElementById('rematch-modal')?.classList.add('hidden');
            this.game.resetGame(false, true);
            hideMessage();
            this.renderManager.rebuildBoard(this.game.gameState.getBoard());
            this.updateUI();
            this.game.startTimer();
        });

        document.getElementById('decline-rematch-btn')?.addEventListener('click', () => {
            if (this.game.peerManager) {
                this.game.peerManager.sendRematchResponse(false);
            }
            document.getElementById('rematch-modal')?.classList.add('hidden');
        });

        document.getElementById('cancel-rematch-btn')?.addEventListener('click', () => {
            document.getElementById('waiting-rematch-modal')?.classList.add('hidden');
        });
    }

    public updateUI(): void {
        const currentPlayer = this.game.gameState.getCurrentPlayer();
        let playerLabel: string;

        if (this.game.mode === 'ai') {
            if (currentPlayer === PLAYERS.X) {
                playerLabel = this.getPlayerLabel(PLAYERS.X);
            } else {
                playerLabel = 'AI';
            }
        } else {
            playerLabel = this.getPlayerLabel(currentPlayer);
        }

        updateCurrentPlayerDisplay(playerLabel, `player-${currentPlayer.toLowerCase()}`);
        updateScoreDisplay(this.game.scores);

        if (this.game.isRemote()) {
            const isMyTurn = this.game.isMyTurn();
            const label = this.getPlayerLabel(currentPlayer);
            updateTurnIndicator(isMyTurn, label);
        }
    }

    private getPlayerLabel(piece: Player): string {
        const playerAsX = this.game.gameState.getPlayerAsX();
        if (piece === PLAYERS.X) {
            return `P${playerAsX}`;
        } else {
            return `P${playerAsX === 1 ? 2 : 1}`;
        }
    }

    public onCreateRoom: ((timer: number) => Promise<void>) | null = null;
    public onJoinRoom: ((code: string) => Promise<void>) | null = null;
}
