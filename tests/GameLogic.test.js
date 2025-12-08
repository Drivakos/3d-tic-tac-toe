import { describe, it, expect } from 'vitest';
import {
    checkWinner,
    checkDraw,
    getEmptyCells,
    isValidMove,
    simulateMove,
    getOpponent,
    findWinningMove,
    getGameStatus
} from '../js/game/GameLogic.js';
import { PLAYERS } from '../js/game/constants.js';

describe('GameLogic', () => {
    describe('checkWinner', () => {
        it('should return null for empty board', () => {
            const board = Array(9).fill(null);
            expect(checkWinner(board)).toBe(null);
        });

        it('should detect horizontal win (top row)', () => {
            const board = ['X', 'X', 'X', null, 'O', 'O', null, null, null];
            const result = checkWinner(board);
            expect(result).not.toBe(null);
            expect(result.winner).toBe('X');
            expect(result.pattern).toEqual([0, 1, 2]);
        });

        it('should detect horizontal win (middle row)', () => {
            const board = ['O', null, null, 'X', 'X', 'X', 'O', null, null];
            const result = checkWinner(board);
            expect(result.winner).toBe('X');
            expect(result.pattern).toEqual([3, 4, 5]);
        });

        it('should detect horizontal win (bottom row)', () => {
            const board = [null, 'X', null, 'O', 'O', null, 'X', 'X', 'X'];
            const result = checkWinner(board);
            expect(result.winner).toBe('X');
            expect(result.pattern).toEqual([6, 7, 8]);
        });

        it('should detect vertical win (left column)', () => {
            const board = ['O', 'X', 'X', 'O', 'X', null, 'O', null, null];
            const result = checkWinner(board);
            expect(result.winner).toBe('O');
            expect(result.pattern).toEqual([0, 3, 6]);
        });

        it('should detect vertical win (middle column)', () => {
            const board = ['X', 'O', null, null, 'O', 'X', 'X', 'O', null];
            const result = checkWinner(board);
            expect(result.winner).toBe('O');
            expect(result.pattern).toEqual([1, 4, 7]);
        });

        it('should detect vertical win (right column)', () => {
            const board = [null, 'X', 'O', 'X', null, 'O', null, 'X', 'O'];
            const result = checkWinner(board);
            expect(result.winner).toBe('O');
            expect(result.pattern).toEqual([2, 5, 8]);
        });

        it('should detect diagonal win (top-left to bottom-right)', () => {
            const board = ['X', 'O', null, 'O', 'X', null, null, 'O', 'X'];
            const result = checkWinner(board);
            expect(result.winner).toBe('X');
            expect(result.pattern).toEqual([0, 4, 8]);
        });

        it('should detect diagonal win (top-right to bottom-left)', () => {
            const board = ['X', 'X', 'O', 'X', 'O', null, 'O', null, null];
            const result = checkWinner(board);
            expect(result.winner).toBe('O');
            expect(result.pattern).toEqual([2, 4, 6]);
        });

        it('should return null when no winner', () => {
            const board = ['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X'];
            expect(checkWinner(board)).toBe(null);
        });
    });

    describe('checkDraw', () => {
        it('should return false for empty board', () => {
            const board = Array(9).fill(null);
            expect(checkDraw(board)).toBe(false);
        });

        it('should return false when there is a winner', () => {
            const board = ['X', 'X', 'X', null, 'O', 'O', null, null, null];
            expect(checkDraw(board)).toBe(false);
        });

        it('should return true for full board with no winner', () => {
            // Classic draw position
            const board = ['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X'];
            expect(checkDraw(board)).toBe(true);
        });

        it('should return false for partially filled board', () => {
            const board = ['X', 'O', null, null, 'X', null, null, null, 'O'];
            expect(checkDraw(board)).toBe(false);
        });
    });

    describe('getEmptyCells', () => {
        it('should return all indices for empty board', () => {
            const board = Array(9).fill(null);
            expect(getEmptyCells(board)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
        });

        it('should return empty array for full board', () => {
            const board = ['X', 'O', 'X', 'O', 'X', 'O', 'X', 'O', 'X'];
            expect(getEmptyCells(board)).toEqual([]);
        });

        it('should return correct indices for partial board', () => {
            const board = ['X', null, 'O', null, 'X', null, 'O', null, 'X'];
            expect(getEmptyCells(board)).toEqual([1, 3, 5, 7]);
        });
    });

    describe('isValidMove', () => {
        const board = ['X', null, 'O', null, null, null, null, null, null];

        it('should return true for empty cell', () => {
            expect(isValidMove(board, 1)).toBe(true);
            expect(isValidMove(board, 4)).toBe(true);
        });

        it('should return false for occupied cell', () => {
            expect(isValidMove(board, 0)).toBe(false);
            expect(isValidMove(board, 2)).toBe(false);
        });

        it('should return false for out of bounds indices', () => {
            expect(isValidMove(board, -1)).toBe(false);
            expect(isValidMove(board, 9)).toBe(false);
            expect(isValidMove(board, 100)).toBe(false);
        });
    });

    describe('simulateMove', () => {
        it('should return new board with move applied', () => {
            const board = [null, null, null, null, null, null, null, null, null];
            const newBoard = simulateMove(board, 4, 'X');
            
            expect(newBoard[4]).toBe('X');
            expect(board[4]).toBe(null); // Original unchanged
        });

        it('should not modify original board', () => {
            const board = ['X', null, null, null, null, null, null, null, null];
            const originalBoard = [...board];
            simulateMove(board, 1, 'O');
            
            expect(board).toEqual(originalBoard);
        });
    });

    describe('getOpponent', () => {
        it('should return O for X', () => {
            expect(getOpponent(PLAYERS.X)).toBe(PLAYERS.O);
        });

        it('should return X for O', () => {
            expect(getOpponent(PLAYERS.O)).toBe(PLAYERS.X);
        });
    });

    describe('findWinningMove', () => {
        it('should find winning move in row', () => {
            const board = ['X', 'X', null, 'O', 'O', null, null, null, null];
            expect(findWinningMove(board, 'X')).toBe(2);
        });

        it('should find winning move in column', () => {
            const board = ['O', 'X', null, 'O', 'X', null, null, null, null];
            expect(findWinningMove(board, 'O')).toBe(6);
        });

        it('should find winning move in diagonal', () => {
            const board = ['X', 'O', null, 'O', 'X', null, null, null, null];
            expect(findWinningMove(board, 'X')).toBe(8);
        });

        it('should return null when no winning move exists', () => {
            const board = ['X', 'O', 'X', null, null, null, null, null, null];
            expect(findWinningMove(board, 'X')).toBe(null);
        });
    });

    describe('getGameStatus', () => {
        it('should return not over for empty board', () => {
            const board = Array(9).fill(null);
            const status = getGameStatus(board);
            
            expect(status.isOver).toBe(false);
            expect(status.winner).toBe(null);
            expect(status.isDraw).toBe(false);
        });

        it('should return winner when game is won', () => {
            const board = ['X', 'X', 'X', null, 'O', 'O', null, null, null];
            const status = getGameStatus(board);
            
            expect(status.isOver).toBe(true);
            expect(status.winner).toBe('X');
            expect(status.pattern).toEqual([0, 1, 2]);
            expect(status.isDraw).toBe(false);
        });

        it('should return draw for full board with no winner', () => {
            const board = ['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X'];
            const status = getGameStatus(board);
            
            expect(status.isOver).toBe(true);
            expect(status.winner).toBe(null);
            expect(status.isDraw).toBe(true);
        });
    });
});

