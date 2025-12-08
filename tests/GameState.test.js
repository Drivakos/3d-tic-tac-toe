import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../js/game/GameState.js';
import { PLAYERS, BOARD_SIZE } from '../js/game/constants.js';

describe('GameState', () => {
    let gameState;

    beforeEach(() => {
        gameState = new GameState();
    });

    describe('initialization', () => {
        it('should initialize with empty board', () => {
            const board = gameState.getBoard();
            expect(board).toHaveLength(BOARD_SIZE);
            expect(board.every(cell => cell === null)).toBe(true);
        });

        it('should start with X as current player', () => {
            expect(gameState.getCurrentPlayer()).toBe(PLAYERS.X);
        });

        it('should not be game over initially', () => {
            expect(gameState.isGameOver()).toBe(false);
        });
    });

    describe('placePiece', () => {
        it('should place a piece on empty cell', () => {
            const result = gameState.placePiece(0, PLAYERS.X);
            expect(result).toBe(true);
            expect(gameState.getCell(0)).toBe(PLAYERS.X);
        });

        it('should not place a piece on occupied cell', () => {
            gameState.placePiece(0, PLAYERS.X);
            const result = gameState.placePiece(0, PLAYERS.O);
            expect(result).toBe(false);
            expect(gameState.getCell(0)).toBe(PLAYERS.X);
        });

        it('should not place piece when game is over', () => {
            gameState.setGameOver(PLAYERS.X);
            const result = gameState.placePiece(0, PLAYERS.X);
            expect(result).toBe(false);
        });

        it('should reject invalid cell indices', () => {
            expect(gameState.placePiece(-1, PLAYERS.X)).toBe(false);
            expect(gameState.placePiece(9, PLAYERS.X)).toBe(false);
            expect(gameState.placePiece(100, PLAYERS.X)).toBe(false);
        });
    });

    describe('isCellEmpty', () => {
        it('should return true for empty cells', () => {
            expect(gameState.isCellEmpty(0)).toBe(true);
            expect(gameState.isCellEmpty(4)).toBe(true);
        });

        it('should return false for occupied cells', () => {
            gameState.placePiece(0, PLAYERS.X);
            expect(gameState.isCellEmpty(0)).toBe(false);
        });
    });

    describe('getEmptyCells', () => {
        it('should return all cells initially', () => {
            const emptyCells = gameState.getEmptyCells();
            expect(emptyCells).toHaveLength(9);
            expect(emptyCells).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
        });

        it('should exclude occupied cells', () => {
            gameState.placePiece(0, PLAYERS.X);
            gameState.placePiece(4, PLAYERS.O);
            const emptyCells = gameState.getEmptyCells();
            expect(emptyCells).toHaveLength(7);
            expect(emptyCells).not.toContain(0);
            expect(emptyCells).not.toContain(4);
        });

        it('should return empty array when board is full', () => {
            for (let i = 0; i < BOARD_SIZE; i++) {
                gameState.placePiece(i, i % 2 === 0 ? PLAYERS.X : PLAYERS.O);
            }
            expect(gameState.getEmptyCells()).toHaveLength(0);
        });
    });

    describe('switchPlayer', () => {
        it('should switch from X to O', () => {
            expect(gameState.getCurrentPlayer()).toBe(PLAYERS.X);
            gameState.switchPlayer();
            expect(gameState.getCurrentPlayer()).toBe(PLAYERS.O);
        });

        it('should switch from O to X', () => {
            gameState.switchPlayer();
            gameState.switchPlayer();
            expect(gameState.getCurrentPlayer()).toBe(PLAYERS.X);
        });
    });

    describe('setGameOver', () => {
        it('should mark game as over with winner', () => {
            gameState.setGameOver(PLAYERS.X, [0, 1, 2]);
            expect(gameState.isGameOver()).toBe(true);
            expect(gameState.winner).toBe(PLAYERS.X);
            expect(gameState.winningPattern).toEqual([0, 1, 2]);
        });

        it('should mark game as over without winner (draw)', () => {
            gameState.setGameOver(null, null);
            expect(gameState.isGameOver()).toBe(true);
            expect(gameState.winner).toBe(null);
        });
    });

    describe('isBoardFull', () => {
        it('should return false for empty board', () => {
            expect(gameState.isBoardFull()).toBe(false);
        });

        it('should return false for partially filled board', () => {
            gameState.placePiece(0, PLAYERS.X);
            gameState.placePiece(4, PLAYERS.O);
            expect(gameState.isBoardFull()).toBe(false);
        });

        it('should return true for full board', () => {
            for (let i = 0; i < BOARD_SIZE; i++) {
                gameState.placePiece(i, i % 2 === 0 ? PLAYERS.X : PLAYERS.O);
            }
            expect(gameState.isBoardFull()).toBe(true);
        });
    });

    describe('reset', () => {
        it('should reset all state to initial values', () => {
            // Make some moves
            gameState.placePiece(0, PLAYERS.X);
            gameState.placePiece(4, PLAYERS.O);
            gameState.switchPlayer();
            gameState.setGameOver(PLAYERS.X, [0, 1, 2]);

            // Reset without new round
            gameState.reset(false);

            expect(gameState.getBoard().every(cell => cell === null)).toBe(true);
            expect(gameState.getCurrentPlayer()).toBe(PLAYERS.X);
            expect(gameState.isGameOver()).toBe(false);
            expect(gameState.winner).toBe(null);
        });

        it('should always start with X on new round', () => {
            // X always starts every round
            expect(gameState.getCurrentPlayer()).toBe(PLAYERS.X);
            
            gameState.reset(true);
            expect(gameState.getCurrentPlayer()).toBe(PLAYERS.X);
            
            gameState.reset(true);
            expect(gameState.getCurrentPlayer()).toBe(PLAYERS.X);
        });

        it('should alternate who is X each round via getPlayerAsX', () => {
            // Game 0: P1 is X
            expect(gameState.getPlayerAsX()).toBe(1);
            
            // Game 1: P2 is X
            gameState.reset(true);
            expect(gameState.getPlayerAsX()).toBe(2);
            
            // Game 2: P1 is X
            gameState.reset(true);
            expect(gameState.getPlayerAsX()).toBe(1);
            
            // Game 3: P2 is X
            gameState.reset(true);
            expect(gameState.getPlayerAsX()).toBe(2);
        });

        it('should reset game number with resetGameNumber', () => {
            gameState.reset(true); // game 1
            gameState.reset(true); // game 2
            expect(gameState.gameNumber).toBe(2);
            
            gameState.resetGameNumber();
            expect(gameState.gameNumber).toBe(0);
            
            gameState.reset(false);
            expect(gameState.getCurrentPlayer()).toBe(PLAYERS.X);
        });
    });

    describe('toJSON and fromJSON', () => {
        it('should serialize and deserialize state correctly', () => {
            gameState.placePiece(0, PLAYERS.X);
            gameState.placePiece(4, PLAYERS.O);
            gameState.switchPlayer();

            const json = gameState.toJSON();
            
            const newState = new GameState();
            newState.fromJSON(json);

            expect(newState.getBoard()).toEqual(gameState.getBoard());
            expect(newState.getCurrentPlayer()).toBe(gameState.getCurrentPlayer());
            expect(newState.isGameOver()).toBe(gameState.isGameOver());
        });
    });
});

