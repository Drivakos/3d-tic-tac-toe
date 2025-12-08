/**
 * Game constants and configuration
 */

export const PLAYERS = {
    X: 'X',
    O: 'O'
};

export const GAME_MODES = {
    PVP_LOCAL: 'pvp-local',
    PVP_REMOTE: 'pvp-remote',
    AI: 'ai'
};

export const AI_DIFFICULTY = {
    EASY: 'easy',
    MEDIUM: 'medium',
    HARD: 'hard'
};

export const WIN_PATTERNS = [
    [0, 1, 2], // Row 1
    [3, 4, 5], // Row 2
    [6, 7, 8], // Row 3
    [0, 3, 6], // Column 1
    [1, 4, 7], // Column 2
    [2, 5, 8], // Column 3
    [0, 4, 8], // Diagonal 1
    [2, 4, 6]  // Diagonal 2
];

export const BOARD_SIZE = 9;

// Board cell positions
export const CENTER = 4;
export const CORNERS = [0, 2, 6, 8];
export const EDGES = [1, 3, 5, 7];

