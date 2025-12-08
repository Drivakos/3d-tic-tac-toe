/**
 * GameState - Manages the current state of the game
 */

import { PLAYERS, BOARD_SIZE } from './constants.js';

export class GameState {
    constructor() {
        this.gameNumber = 0;
        this.reset();
    }

    /**
     * Reset game state to initial values
     * @param {boolean} newRound - If true, increment game number for alternating starts
     */
    reset(newRound = false) {
        this.board = Array(BOARD_SIZE).fill(null);
        this.gameOver = false;
        this.winner = null;
        this.winningPattern = null;
        
        if (newRound) {
            this.gameNumber++;
        }
        
        // Alternate starting player: P1 (X) on odd games, P2 (O) on even games
        this.currentPlayer = this.gameNumber % 2 === 0 ? PLAYERS.X : PLAYERS.O;
    }

    /**
     * Reset game number (for new match/session)
     */
    resetGameNumber() {
        this.gameNumber = 0;
    }

    /**
     * Get the starting player for current game
     * @returns {string}
     */
    getStartingPlayer() {
        return this.gameNumber % 2 === 0 ? PLAYERS.X : PLAYERS.O;
    }

    /**
     * Get the current board state
     * @returns {Array} Copy of the board array
     */
    getBoard() {
        return [...this.board];
    }

    /**
     * Get cell value at index
     * @param {number} index - Cell index (0-8)
     * @returns {string|null} Player symbol or null
     */
    getCell(index) {
        return this.board[index];
    }

    /**
     * Check if a cell is empty
     * @param {number} index - Cell index
     * @returns {boolean}
     */
    isCellEmpty(index) {
        return this.board[index] === null;
    }

    /**
     * Get all empty cell indices
     * @returns {number[]} Array of empty cell indices
     */
    getEmptyCells() {
        return this.board
            .map((cell, index) => cell === null ? index : null)
            .filter(index => index !== null);
    }

    /**
     * Place a piece on the board
     * @param {number} index - Cell index
     * @param {string} player - Player symbol ('X' or 'O')
     * @returns {boolean} True if placement was successful
     */
    placePiece(index, player) {
        if (this.gameOver || !this.isCellEmpty(index)) {
            return false;
        }
        
        if (index < 0 || index >= BOARD_SIZE) {
            return false;
        }

        this.board[index] = player;
        return true;
    }

    /**
     * Switch to the next player
     */
    switchPlayer() {
        this.currentPlayer = this.currentPlayer === PLAYERS.X ? PLAYERS.O : PLAYERS.X;
    }

    /**
     * Get the current player
     * @returns {string}
     */
    getCurrentPlayer() {
        return this.currentPlayer;
    }

    /**
     * Set the game as over
     * @param {string|null} winner - The winning player or null for draw
     * @param {number[]|null} pattern - The winning pattern indices
     */
    setGameOver(winner = null, pattern = null) {
        this.gameOver = true;
        this.winner = winner;
        this.winningPattern = pattern;
    }

    /**
     * Check if game is over
     * @returns {boolean}
     */
    isGameOver() {
        return this.gameOver;
    }

    /**
     * Check if board is full (no empty cells)
     * @returns {boolean}
     */
    isBoardFull() {
        return this.board.every(cell => cell !== null);
    }

    /**
     * Create a snapshot of current state (for syncing)
     * @returns {Object}
     */
    toJSON() {
        return {
            board: [...this.board],
            currentPlayer: this.currentPlayer,
            gameOver: this.gameOver,
            winner: this.winner,
            winningPattern: this.winningPattern,
            gameNumber: this.gameNumber
        };
    }

    /**
     * Restore state from snapshot
     * @param {Object} state
     */
    fromJSON(state) {
        this.board = [...state.board];
        this.currentPlayer = state.currentPlayer;
        this.gameOver = state.gameOver;
        this.winner = state.winner;
        this.winningPattern = state.winningPattern;
        if (state.gameNumber !== undefined) {
            this.gameNumber = state.gameNumber;
        }
    }
}

