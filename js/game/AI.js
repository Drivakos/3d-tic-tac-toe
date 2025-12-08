/**
 * AI - Artificial Intelligence for computer opponent
 */

import { PLAYERS, AI_DIFFICULTY, CENTER, CORNERS } from './constants.js';
import { 
    checkWinner, 
    getEmptyCells, 
    simulateMove,
    findWinningMove 
} from './GameLogic.js';

/**
 * Minimax algorithm with alpha-beta pruning
 * @param {Array} board - Current board state
 * @param {number} depth - Current search depth
 * @param {boolean} isMaximizing - True if maximizing player (AI)
 * @param {number} alpha - Alpha value for pruning
 * @param {number} beta - Beta value for pruning
 * @param {string} aiPlayer - The AI's player symbol
 * @returns {number} Score for this board state
 */
export function minimax(board, depth, isMaximizing, alpha, beta, aiPlayer) {
    const humanPlayer = aiPlayer === PLAYERS.X ? PLAYERS.O : PLAYERS.X;
    const result = checkWinner(board);
    
    // Terminal states
    if (result) {
        if (result.winner === aiPlayer) return 10 - depth;
        if (result.winner === humanPlayer) return depth - 10;
    }
    
    const emptyCells = getEmptyCells(board);
    if (emptyCells.length === 0) return 0; // Draw
    
    if (isMaximizing) {
        let maxEval = -Infinity;
        for (const cell of emptyCells) {
            const newBoard = simulateMove(board, cell, aiPlayer);
            const evalScore = minimax(newBoard, depth + 1, false, alpha, beta, aiPlayer);
            maxEval = Math.max(maxEval, evalScore);
            alpha = Math.max(alpha, evalScore);
            if (beta <= alpha) break;
        }
        return maxEval;
    } else {
        let minEval = Infinity;
        for (const cell of emptyCells) {
            const newBoard = simulateMove(board, cell, humanPlayer);
            const evalScore = minimax(newBoard, depth + 1, true, alpha, beta, aiPlayer);
            minEval = Math.min(minEval, evalScore);
            beta = Math.min(beta, evalScore);
            if (beta <= alpha) break;
        }
        return minEval;
    }
}

/**
 * Get the best move using minimax algorithm
 * @param {Array} board - Current board state
 * @param {string} aiPlayer - The AI's player symbol
 * @returns {number|null} Best cell index or null if no moves
 */
export function getBestMove(board, aiPlayer = PLAYERS.O) {
    const emptyCells = getEmptyCells(board);
    if (emptyCells.length === 0) return null;
    
    let bestScore = -Infinity;
    let bestMove = null;
    
    for (const cell of emptyCells) {
        const newBoard = simulateMove(board, cell, aiPlayer);
        const score = minimax(newBoard, 0, false, -Infinity, Infinity, aiPlayer);
        
        if (score > bestScore) {
            bestScore = score;
            bestMove = cell;
        }
    }
    
    return bestMove;
}

/**
 * Get a random valid move
 * @param {Array} board - Current board state
 * @returns {number|null} Random empty cell index or null
 */
export function getRandomMove(board) {
    const emptyCells = getEmptyCells(board);
    if (emptyCells.length === 0) return null;
    return emptyCells[Math.floor(Math.random() * emptyCells.length)];
}

/**
 * Get a medium difficulty move
 * Strategy: Block wins, take wins, prefer center and corners
 * @param {Array} board - Current board state
 * @param {string} aiPlayer - The AI's player symbol
 * @returns {number|null} Cell index for move
 */
export function getMediumMove(board, aiPlayer = PLAYERS.O) {
    const humanPlayer = aiPlayer === PLAYERS.X ? PLAYERS.O : PLAYERS.X;
    const emptyCells = getEmptyCells(board);
    
    if (emptyCells.length === 0) return null;
    
    // 1. Take winning move if available
    const winMove = findWinningMove(board, aiPlayer);
    if (winMove !== null) return winMove;
    
    // 2. Block opponent's winning move
    const blockMove = findWinningMove(board, humanPlayer);
    if (blockMove !== null) return blockMove;
    
    // 3. 50% chance to play optimally, 50% random strategic
    if (Math.random() > 0.5) {
        return getBestMove(board, aiPlayer);
    }
    
    // 4. Prefer center
    if (board[CENTER] === null) return CENTER;
    
    // 5. Prefer corners
    const emptyCorners = CORNERS.filter(i => board[i] === null);
    if (emptyCorners.length > 0) {
        return emptyCorners[Math.floor(Math.random() * emptyCorners.length)];
    }
    
    // 6. Random from remaining
    return getRandomMove(board);
}

/**
 * Get AI move based on difficulty
 * @param {Array} board - Current board state
 * @param {string} difficulty - Difficulty level
 * @param {string} aiPlayer - The AI's player symbol
 * @returns {number|null} Cell index for move
 */
export function getAIMove(board, difficulty, aiPlayer = PLAYERS.O) {
    switch (difficulty) {
        case AI_DIFFICULTY.EASY:
            return getRandomMove(board);
        case AI_DIFFICULTY.MEDIUM:
            return getMediumMove(board, aiPlayer);
        case AI_DIFFICULTY.HARD:
            return getBestMove(board, aiPlayer);
        default:
            return getRandomMove(board);
    }
}

/**
 * Create an AI controller with delayed moves
 */
export class AIController {
    constructor(difficulty = AI_DIFFICULTY.MEDIUM, player = PLAYERS.O) {
        this.difficulty = difficulty;
        this.player = player;
        this.isThinking = false;
        this.minDelay = 400;
        this.maxDelay = 800;
    }

    /**
     * Set difficulty level
     * @param {string} difficulty
     */
    setDifficulty(difficulty) {
        this.difficulty = difficulty;
    }

    /**
     * Get a move with simulated "thinking" delay
     * @param {Array} board - Current board state
     * @returns {Promise<number|null>} Cell index
     */
    async getMove(board) {
        this.isThinking = true;
        
        const delay = this.minDelay + Math.random() * (this.maxDelay - this.minDelay);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        const move = getAIMove(board, this.difficulty, this.player);
        this.isThinking = false;
        
        return move;
    }

    /**
     * Get move synchronously (for testing)
     * @param {Array} board
     * @returns {number|null}
     */
    getMoveSync(board) {
        return getAIMove(board, this.difficulty, this.player);
    }
}

