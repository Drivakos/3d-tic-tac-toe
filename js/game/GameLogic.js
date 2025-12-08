/**
 * GameLogic - Pure functions for game rule evaluation
 */

import { WIN_PATTERNS, PLAYERS } from './constants.js';

/**
 * Check if there's a winner on the board
 * @param {Array} board - The game board array
 * @returns {Object|null} { winner, pattern } or null if no winner
 */
export function checkWinner(board) {
    for (const pattern of WIN_PATTERNS) {
        const [a, b, c] = pattern;
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return {
                winner: board[a],
                pattern: pattern
            };
        }
    }
    return null;
}

/**
 * Check if the game is a draw (board full, no winner)
 * @param {Array} board - The game board array
 * @returns {boolean}
 */
export function checkDraw(board) {
    return !checkWinner(board) && board.every(cell => cell !== null);
}

/**
 * Get all empty cell indices
 * @param {Array} board - The game board array
 * @returns {number[]}
 */
export function getEmptyCells(board) {
    return board
        .map((cell, index) => cell === null ? index : null)
        .filter(index => index !== null);
}

/**
 * Check if a move is valid
 * @param {Array} board - The game board array
 * @param {number} index - Cell index to check
 * @returns {boolean}
 */
export function isValidMove(board, index) {
    return index >= 0 && index < board.length && board[index] === null;
}

/**
 * Simulate a move on a board copy
 * @param {Array} board - The game board array
 * @param {number} index - Cell index
 * @param {string} player - Player symbol
 * @returns {Array} New board with the move applied
 */
export function simulateMove(board, index, player) {
    const newBoard = [...board];
    newBoard[index] = player;
    return newBoard;
}

/**
 * Get the opponent of a player
 * @param {string} player
 * @returns {string}
 */
export function getOpponent(player) {
    return player === PLAYERS.X ? PLAYERS.O : PLAYERS.X;
}

/**
 * Evaluate if a player can win in one move
 * @param {Array} board - The game board array
 * @param {string} player - Player to check for
 * @returns {number|null} Cell index for winning move, or null
 */
export function findWinningMove(board, player) {
    const emptyCells = getEmptyCells(board);
    
    for (const index of emptyCells) {
        const testBoard = simulateMove(board, index, player);
        const result = checkWinner(testBoard);
        if (result && result.winner === player) {
            return index;
        }
    }
    
    return null;
}

/**
 * Get the game status
 * @param {Array} board - The game board array
 * @returns {Object} { isOver, winner, pattern, isDraw }
 */
export function getGameStatus(board) {
    const winResult = checkWinner(board);
    
    if (winResult) {
        return {
            isOver: true,
            winner: winResult.winner,
            pattern: winResult.pattern,
            isDraw: false
        };
    }
    
    if (checkDraw(board)) {
        return {
            isOver: true,
            winner: null,
            pattern: null,
            isDraw: true
        };
    }
    
    return {
        isOver: false,
        winner: null,
        pattern: null,
        isDraw: false
    };
}

