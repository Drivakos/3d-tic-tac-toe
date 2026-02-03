/**
 * EventManager - Centralized event handling with callback pattern
 * Decouples DOM event listeners from game logic through callbacks
 */

import * as THREE from 'three';

// ============================================================================
// Types
// ============================================================================

export interface EventCallbacks {
    // Mode selection
    onModeSelect: (mode: 'pvp' | 'ai') => void;
    onPvPTypeSelect: (type: 'local' | 'remote') => void;
    onDifficultySelect: (difficulty: string, timer: number) => void;

    // Navigation
    onBackToPvPType: () => void;
    onBackToPvPTypeFromTimer: () => void;

    // Game controls
    onResetGame: () => void;
    onMenuClick: () => void;

    // Rematch
    onAcceptRematch: () => void;
    onDeclineRematch: () => void;
    onCancelRematch: () => void;

    // Game board
    onCellClick: (cellIndex: number) => void;

    // Window events
    onResize: () => void;
}

export interface GameBoardDependencies {
    canvas: HTMLCanvasElement;
    camera: THREE.PerspectiveCamera;
    clickTargets: THREE.Mesh[];
    canMove: () => boolean;
}

// ============================================================================
// EventManager Class
// ============================================================================

export class EventManager {
    private callbacks: EventCallbacks;
    private boardDeps: GameBoardDependencies | null = null;
    private cleanupFunctions: (() => void)[] = [];

    constructor(callbacks: EventCallbacks) {
        this.callbacks = callbacks;
    }

    /**
     * Set game board dependencies for raycasting
     */
    setBoardDependencies(deps: GameBoardDependencies): void {
        this.boardDeps = deps;
    }

    /**
     * Attach all event listeners
     */
    attach(): void {
        console.log('[EventManager] Attaching event listeners...');

        this.attachModeButtons();
        this.attachPvPTypeButtons();
        this.attachDifficultyButtons();
        this.attachBackButtons();
        this.attachGameControlButtons();
        this.attachRematchButtons();
        this.attachCanvasEvents();
        this.attachWindowEvents();
    }

    /**
     * Detach all event listeners
     */
    detach(): void {
        console.log('[EventManager] Detaching event listeners...');
        this.cleanupFunctions.forEach(cleanup => cleanup());
        this.cleanupFunctions = [];
    }

    /**
     * Mode button handlers
     */
    private attachModeButtons(): void {
        document.querySelectorAll('.mode-btn').forEach((btn) => {
            const handler = () => {
                const mode = btn.getAttribute('data-mode');
                console.log('[EventManager] Mode button clicked:', mode);

                // Hide intermediate screens
                document.getElementById('mode-buttons')?.classList.add('hidden');
                document.getElementById('pvp-type-select')?.classList.add('hidden');
                document.getElementById('timer-select')?.classList.add('hidden');
                document.getElementById('remote-setup')?.classList.add('hidden');
                document.getElementById('difficulty-select')?.classList.add('hidden');

                if (mode === 'pvp' || mode === 'ai') {
                    this.callbacks.onModeSelect(mode);
                }
            };

            btn.addEventListener('click', handler);
            this.cleanupFunctions.push(() => btn.removeEventListener('click', handler));
        });
    }

    /**
     * PvP type button handlers
     */
    private attachPvPTypeButtons(): void {
        document.querySelectorAll('.pvp-type-btn').forEach((btn) => {
            const handler = () => {
                const type = btn.getAttribute('data-pvp-type');
                console.log('[EventManager] PvP type button clicked:', type);

                if (type === 'local' || type === 'remote') {
                    this.callbacks.onPvPTypeSelect(type);
                }
            };

            btn.addEventListener('click', handler);
            this.cleanupFunctions.push(() => btn.removeEventListener('click', handler));
        });
    }

    /**
     * Difficulty button handlers
     */
    private attachDifficultyButtons(): void {
        document.querySelectorAll('.difficulty-btn').forEach((btn) => {
            const handler = () => {
                const difficulty = btn.getAttribute('data-difficulty') || 'medium';
                const timer = parseInt(btn.getAttribute('data-timer') || '0');
                console.log('[EventManager] Difficulty button clicked:', difficulty, 'timer:', timer);

                this.callbacks.onDifficultySelect(difficulty, timer);
            };

            btn.addEventListener('click', handler);
            this.cleanupFunctions.push(() => btn.removeEventListener('click', handler));
        });
    }

    /**
     * Back button handlers
     */
    private attachBackButtons(): void {
        const backToPvP = document.getElementById('back-to-pvp-type');
        if (backToPvP) {
            const handler = () => {
                document.getElementById('remote-setup')?.classList.add('hidden');
                document.getElementById('pvp-type-select')?.classList.remove('hidden');
                this.callbacks.onBackToPvPType();
            };
            backToPvP.addEventListener('click', handler);
            this.cleanupFunctions.push(() => backToPvP.removeEventListener('click', handler));
        }

        const backFromTimer = document.getElementById('back-to-pvp-type-from-timer');
        if (backFromTimer) {
            const handler = () => {
                document.getElementById('timer-select')?.classList.add('hidden');
                document.getElementById('pvp-type-select')?.classList.remove('hidden');
                this.callbacks.onBackToPvPTypeFromTimer();
            };
            backFromTimer.addEventListener('click', handler);
            this.cleanupFunctions.push(() => backFromTimer.removeEventListener('click', handler));
        }
    }

    /**
     * Game control button handlers (reset, menu)
     */
    private attachGameControlButtons(): void {
        const resetBtn = document.getElementById('reset-btn');
        if (resetBtn) {
            const handler = () => this.callbacks.onResetGame();
            resetBtn.addEventListener('click', handler);
            this.cleanupFunctions.push(() => resetBtn.removeEventListener('click', handler));
        }

        const menuBtn = document.getElementById('menu-btn');
        if (menuBtn) {
            const handler = () => this.callbacks.onMenuClick();
            menuBtn.addEventListener('click', handler);
            this.cleanupFunctions.push(() => menuBtn.removeEventListener('click', handler));
        }
    }

    /**
     * Rematch modal button handlers
     */
    private attachRematchButtons(): void {
        const acceptBtn = document.getElementById('accept-rematch-btn');
        if (acceptBtn) {
            const handler = () => this.callbacks.onAcceptRematch();
            acceptBtn.addEventListener('click', handler);
            this.cleanupFunctions.push(() => acceptBtn.removeEventListener('click', handler));
        }

        const declineBtn = document.getElementById('decline-rematch-btn');
        if (declineBtn) {
            const handler = () => this.callbacks.onDeclineRematch();
            declineBtn.addEventListener('click', handler);
            this.cleanupFunctions.push(() => declineBtn.removeEventListener('click', handler));
        }

        const cancelBtn = document.getElementById('cancel-rematch-btn');
        if (cancelBtn) {
            const handler = () => this.callbacks.onCancelRematch();
            cancelBtn.addEventListener('click', handler);
            this.cleanupFunctions.push(() => cancelBtn.removeEventListener('click', handler));
        }
    }

    /**
     * Canvas click handler for game moves
     */
    private attachCanvasEvents(): void {
        if (!this.boardDeps) {
            console.warn('[EventManager] Board dependencies not set, skipping canvas events');
            return;
        }

        const { canvas, camera, clickTargets, canMove } = this.boardDeps;

        const handler = (event: MouseEvent) => {
            const rect = canvas.getBoundingClientRect();
            const mouse = new THREE.Vector2(
                ((event.clientX - rect.left) / rect.width) * 2 - 1,
                -((event.clientY - rect.top) / rect.height) * 2 + 1
            );

            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, camera);

            const intersects = raycaster.intersectObjects(clickTargets);

            if (intersects.length > 0 && canMove()) {
                const cellIndex = intersects[0].object.userData.cellIndex;
                this.callbacks.onCellClick(cellIndex);
            }
        };

        canvas.addEventListener('click', handler);
        this.cleanupFunctions.push(() => canvas.removeEventListener('click', handler));
    }

    /**
     * Window resize handler
     */
    private attachWindowEvents(): void {
        const handler = () => this.callbacks.onResize();
        window.addEventListener('resize', handler);
        this.cleanupFunctions.push(() => window.removeEventListener('resize', handler));
    }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createEventManager(callbacks: EventCallbacks): EventManager {
    return new EventManager(callbacks);
}
