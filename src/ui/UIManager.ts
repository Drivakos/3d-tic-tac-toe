/**
 * UIManager - Screen management, messages, and DOM interactions
 * Handles all DOM-based UI elements and screen transitions
 */

// ============================================================================
// Types
// ============================================================================

export interface UIElements {
    messageEl: HTMLElement | null;
    currentPlayerEl: HTMLElement | null;
    scoreP1El: HTMLElement | null;
    scoreP2El: HTMLElement | null;
    turnIndicatorEl: HTMLElement | null;
    turnTextEl: HTMLElement | null;
    modeSelectOverlay: HTMLElement | null;
    modeButtons: HTMLElement | null;
    pvpTypeSelect: HTMLElement | null;
    timerSelect: HTMLElement | null;
    remoteSetup: HTMLElement | null;
    waitingRoom: HTMLElement | null;
    connectionStatus: HTMLElement | null;
    difficultySelect: HTMLElement | null;
    timerBar: HTMLElement | null;
    timerFill: HTMLElement | null;
    timerLabel: HTMLElement | null;
}

// ============================================================================
// UI Element Cache
// ============================================================================

let cachedElements: UIElements | null = null;

/**
 * Get cached UI elements, initializing them if needed
 */
export function getUIElements(): UIElements {
    if (cachedElements) return cachedElements;

    cachedElements = {
        messageEl: document.getElementById('message'),
        currentPlayerEl: document.getElementById('current-player'),
        scoreP1El: document.getElementById('score-p1'),
        scoreP2El: document.getElementById('score-p2'),
        turnIndicatorEl: document.getElementById('turn-indicator'),
        turnTextEl: document.getElementById('turn-text'),
        modeSelectOverlay: document.getElementById('mode-select-overlay'),
        modeButtons: document.getElementById('mode-buttons'),
        pvpTypeSelect: document.getElementById('pvp-type-select'),
        timerSelect: document.getElementById('timer-select'),
        remoteSetup: document.getElementById('remote-setup'),
        waitingRoom: document.getElementById('waiting-room'),
        connectionStatus: document.getElementById('connection-status'),
        difficultySelect: document.getElementById('difficulty-select'),
        timerBar: document.getElementById('timer-bar'),
        timerFill: document.getElementById('timer-fill'),
        timerLabel: document.getElementById('timer-label')
    };

    return cachedElements;
}

/**
 * Clear cached elements (useful for testing or dynamic content changes)
 */
export function clearUICache(): void {
    cachedElements = null;
}

// ============================================================================
// Message Display
// ============================================================================

/**
 * Show a message in the game message element
 */
export function showMessage(text: string): void {
    const { messageEl } = getUIElements();
    if (messageEl) {
        messageEl.textContent = text;
        messageEl.classList.remove('hidden');
    }
}

/**
 * Hide the game message element
 */
export function hideMessage(): void {
    const { messageEl } = getUIElements();
    if (messageEl) {
        messageEl.classList.add('hidden');
    }
}

// ============================================================================
// Screen Management
// ============================================================================

/**
 * Hide all mode selection screens
 */
export function hideAllModeScreens(): void {
    const elements = getUIElements();

    if (elements.modeSelectOverlay) elements.modeSelectOverlay.classList.add('hidden');
    if (elements.modeButtons) elements.modeButtons.classList.add('hidden');
    if (elements.pvpTypeSelect) elements.pvpTypeSelect.classList.add('hidden');
    if (elements.timerSelect) elements.timerSelect.classList.add('hidden');
    if (elements.remoteSetup) elements.remoteSetup.classList.add('hidden');
    if (elements.waitingRoom) elements.waitingRoom.classList.add('hidden');
    if (elements.connectionStatus) elements.connectionStatus.classList.add('hidden');
    if (elements.difficultySelect) elements.difficultySelect.classList.add('hidden');
    // Hide AI timer select
    const aiTimerSelect = document.getElementById('ai-timer-select');
    if (aiTimerSelect) aiTimerSelect.classList.add('hidden');
    // Hide remote timer select
    const remoteTimerSelect = document.getElementById('remote-timer-select');
    if (remoteTimerSelect) remoteTimerSelect.classList.add('hidden');
}

/**
 * Show the mode selection screen
 */
export function showModeSelectScreen(): void {
    const elements = getUIElements();

    if (elements.modeSelectOverlay) elements.modeSelectOverlay.classList.remove('hidden');
    if (elements.modeButtons) elements.modeButtons.classList.remove('hidden');
    if (elements.pvpTypeSelect) elements.pvpTypeSelect.classList.add('hidden');
    if (elements.timerSelect) elements.timerSelect.classList.add('hidden');
    if (elements.remoteSetup) elements.remoteSetup.classList.add('hidden');
    if (elements.waitingRoom) elements.waitingRoom.classList.add('hidden');
    if (elements.connectionStatus) elements.connectionStatus.classList.add('hidden');
    if (elements.difficultySelect) elements.difficultySelect.classList.add('hidden');
    // Hide AI timer select
    const aiTimerSelect = document.getElementById('ai-timer-select');
    if (aiTimerSelect) aiTimerSelect.classList.add('hidden');
    // Hide remote timer select
    const remoteTimerSelect = document.getElementById('remote-timer-select');
    if (remoteTimerSelect) remoteTimerSelect.classList.add('hidden');
}

/**
 * Show the PvP type selection screen
 */
export function showPvPTypeScreen(): void {
    const elements = getUIElements();

    if (elements.modeSelectOverlay) elements.modeSelectOverlay.classList.remove('hidden');
    if (elements.modeButtons) elements.modeButtons.classList.add('hidden');
    if (elements.pvpTypeSelect) elements.pvpTypeSelect.classList.remove('hidden');
    if (elements.timerSelect) elements.timerSelect.classList.add('hidden');
    if (elements.remoteSetup) elements.remoteSetup.classList.add('hidden');
    if (elements.waitingRoom) elements.waitingRoom.classList.add('hidden');
    if (elements.connectionStatus) elements.connectionStatus.classList.add('hidden');
    if (elements.difficultySelect) elements.difficultySelect.classList.add('hidden');
}

/**
 * Show the timer selection screen
 */
export function showTimerSelectScreen(): void {
    const elements = getUIElements();

    if (elements.modeSelectOverlay) elements.modeSelectOverlay.classList.remove('hidden');
    if (elements.modeButtons) elements.modeButtons.classList.add('hidden');
    if (elements.pvpTypeSelect) elements.pvpTypeSelect.classList.add('hidden');
    if (elements.timerSelect) elements.timerSelect.classList.remove('hidden');
    if (elements.remoteSetup) elements.remoteSetup.classList.add('hidden');
    if (elements.waitingRoom) elements.waitingRoom.classList.add('hidden');
    if (elements.connectionStatus) elements.connectionStatus.classList.add('hidden');
    if (elements.difficultySelect) elements.difficultySelect.classList.add('hidden');
}

/**
 * Show the difficulty selection screen
 */
export function showDifficultyScreen(): void {
    const elements = getUIElements();

    if (elements.modeSelectOverlay) elements.modeSelectOverlay.classList.remove('hidden');
    if (elements.modeButtons) elements.modeButtons.classList.add('hidden');
    if (elements.pvpTypeSelect) elements.pvpTypeSelect.classList.add('hidden');
    if (elements.timerSelect) elements.timerSelect.classList.add('hidden');
    if (elements.remoteSetup) elements.remoteSetup.classList.add('hidden');
    if (elements.waitingRoom) elements.waitingRoom.classList.add('hidden');
    if (elements.connectionStatus) elements.connectionStatus.classList.add('hidden');
    if (elements.difficultySelect) elements.difficultySelect.classList.remove('hidden');
}

/**
 * Show the remote setup screen
 */
export function showRemoteSetupScreen(): void {
    const elements = getUIElements();

    if (elements.modeSelectOverlay) elements.modeSelectOverlay.classList.remove('hidden');
    if (elements.modeButtons) elements.modeButtons.classList.add('hidden');
    if (elements.pvpTypeSelect) elements.pvpTypeSelect.classList.add('hidden');
    if (elements.timerSelect) elements.timerSelect.classList.add('hidden');
    if (elements.remoteSetup) elements.remoteSetup.classList.remove('hidden');
    if (elements.waitingRoom) elements.waitingRoom.classList.add('hidden');
    if (elements.connectionStatus) elements.connectionStatus.classList.add('hidden');
    if (elements.difficultySelect) elements.difficultySelect.classList.add('hidden');
}

/**
 * Show the waiting room screen
 */
export function showWaitingRoomScreen(): void {
    const elements = getUIElements();

    if (elements.modeSelectOverlay) elements.modeSelectOverlay.classList.remove('hidden');
    if (elements.modeButtons) elements.modeButtons.classList.add('hidden');
    if (elements.pvpTypeSelect) elements.pvpTypeSelect.classList.add('hidden');
    if (elements.timerSelect) elements.timerSelect.classList.add('hidden');
    if (elements.remoteSetup) elements.remoteSetup.classList.add('hidden');
    if (elements.waitingRoom) elements.waitingRoom.classList.remove('hidden');
    if (elements.connectionStatus) elements.connectionStatus.classList.remove('hidden');
    if (elements.difficultySelect) elements.difficultySelect.classList.add('hidden');
}

// ============================================================================
// Score Display
// ============================================================================

/**
 * Update the score display
 */
export function updateScoreDisplay(scores: { 1: number; 2: number }): void {
    const { scoreP1El, scoreP2El } = getUIElements();
    if (scoreP1El) scoreP1El.textContent = `P1:${scores[1]}`;
    if (scoreP2El) scoreP2El.textContent = `P2:${scores[2]}`;
}

/**
 * Update the current player display
 */
export function updateCurrentPlayerDisplay(playerLabel: string, playerClass: string): void {
    const { currentPlayerEl } = getUIElements();
    if (currentPlayerEl) {
        currentPlayerEl.textContent = playerLabel;
        currentPlayerEl.className = playerClass;
    }
}

// ============================================================================
// Turn Indicator (for remote games)
// ============================================================================

/**
 * Update the remote turn indicator
 */
export function updateTurnIndicator(isMyTurn: boolean, playerLabel: string): void {
    const { turnIndicatorEl, turnTextEl } = getUIElements();

    if (turnIndicatorEl) {
        turnIndicatorEl.className = isMyTurn ? 'your-turn' : 'waiting';
    }
    if (turnTextEl) {
        turnTextEl.textContent = isMyTurn ? 'Your turn!' : `${playerLabel}'s turn...`;
    }
}

// ============================================================================
// Timer Display
// ============================================================================

/**
 * Update the timer bar display
 */
export function updateTimerDisplay(remaining: number, total: number): void {
    const { timerBar, timerFill, timerLabel } = getUIElements();
    const progress = total > 0 ? remaining / total : 1;

    if (timerBar) {
        timerBar.classList.remove('hidden');
    }

    if (timerFill) {
        timerFill.style.width = `${Math.max(0, Math.min(100, progress * 100))}%`;

        // Update color based on progress
        if (progress > 0.4) {
            timerFill.style.background = 'linear-gradient(90deg, #00f5ff, #00ff88)';
        } else if (progress > 0.2) {
            timerFill.style.background = 'linear-gradient(90deg, #ff6600, #ffaa00)';
        } else {
            timerFill.style.background = 'linear-gradient(90deg, #ff2200, #ff6600)';
        }
    }

    if (timerLabel) {
        const seconds = Math.ceil(remaining);
        timerLabel.textContent = `${seconds}s`;
    }
}

/**
 * Hide the timer bar
 */
export function hideTimerDisplay(): void {
    const { timerBar } = getUIElements();
    if (timerBar) {
        timerBar.classList.add('hidden');
    }
}

/**
 * Show the timer bar
 */
export function showTimerDisplay(): void {
    const { timerBar } = getUIElements();
    if (timerBar) {
        timerBar.classList.remove('hidden');
    }
}
