import { describe, it, expect, beforeEach } from 'vitest';
import {
    minimax,
    getBestMove,
    getRandomMove,
    getMediumMove,
    getAIMove,
    AIController
} from '../src/game/AI.ts';
import { checkWinner } from '../src/game/GameLogic.ts';
import { PLAYERS, AI_DIFFICULTY } from '../src/game/constants.ts';

describe('AI', () => {
    describe('getRandomMove', () => {
        it('should return a valid empty cell index', () => {
            const board = ['X', null, 'O', null, 'X', null, null, null, null];
            const move = getRandomMove(board);
            
            expect(move).not.toBe(null);
            expect(board[move]).toBe(null);
        });

        it('should return null for full board', () => {
            const board = ['X', 'O', 'X', 'O', 'X', 'O', 'X', 'O', 'X'];
            expect(getRandomMove(board)).toBe(null);
        });

        it('should only return indices of empty cells', () => {
            const board = ['X', 'O', 'X', 'O', null, 'O', 'X', 'O', 'X'];
            
            // Run multiple times to ensure randomness works correctly
            for (let i = 0; i < 20; i++) {
                const move = getRandomMove(board);
                expect(move).toBe(4); // Only empty cell
            }
        });
    });

    describe('getBestMove (minimax)', () => {
        it('should take winning move when available', () => {
            // O can win by playing position 2
            const board = ['X', 'X', null, 'O', 'O', null, 'X', null, null];
            const move = getBestMove(board, PLAYERS.O);
            expect(move).toBe(5); // Complete the row
        });

        it('should block opponent winning move', () => {
            // X is about to win at position 2, O must block
            // Board setup ensures blocking is the only way to avoid losing
            const board = ['X', 'X', null, null, 'O', null, null, null, null];
            const move = getBestMove(board, PLAYERS.O);
            expect(move).toBe(2); // Block X's win
        });

        it('should return null for full board', () => {
            const board = ['X', 'O', 'X', 'O', 'X', 'O', 'X', 'O', 'X'];
            expect(getBestMove(board)).toBe(null);
        });

        it('should prefer center on empty board', () => {
            const board = Array(9).fill(null);
            const move = getBestMove(board, PLAYERS.O);
            // Center (4) is often the optimal first move
            expect([0, 2, 4, 6, 8]).toContain(move); // Should be center or corner
        });

        it('should never lose when playing optimally', () => {
            // Simulate a game where AI plays optimally
            const board = Array(9).fill(null);
            let currentPlayer = PLAYERS.X;
            
            // X makes a suboptimal move
            board[0] = PLAYERS.X;
            currentPlayer = PLAYERS.O;
            
            // AI (O) should play optimally and at least draw
            while (true) {
                if (currentPlayer === PLAYERS.O) {
                    const move = getBestMove(board, PLAYERS.O);
                    if (move === null) break;
                    board[move] = PLAYERS.O;
                } else {
                    // X plays first available
                    const emptyIdx = board.findIndex(c => c === null);
                    if (emptyIdx === -1) break;
                    board[emptyIdx] = PLAYERS.X;
                }
                
                const result = checkWinner(board);
                if (result) {
                    // AI should never lose
                    expect(result.winner).not.toBe(PLAYERS.X);
                    break;
                }
                
                if (board.every(c => c !== null)) break;
                currentPlayer = currentPlayer === PLAYERS.X ? PLAYERS.O : PLAYERS.X;
            }
        });
    });

    describe('getMediumMove', () => {
        it('should take winning move when available', () => {
            const board = [null, null, null, 'O', 'O', null, 'X', 'X', null];
            const move = getMediumMove(board, PLAYERS.O);
            expect(move).toBe(5); // Winning move
        });

        it('should block opponent winning move', () => {
            // X is about to win at position 5, O can't win and must block
            const board = [null, null, null, 'X', 'X', null, 'O', null, null];
            const move = getMediumMove(board, PLAYERS.O);
            expect(move).toBe(5); // Block X's win
        });

        it('should prefer center when available and no immediate threats', () => {
            const board = ['X', null, null, null, null, null, null, null, null];
            // Run multiple times - center should be common choice
            let centerCount = 0;
            for (let i = 0; i < 50; i++) {
                const move = getMediumMove(board, PLAYERS.O);
                if (move === 4) centerCount++;
            }
            // Should choose center at least sometimes
            expect(centerCount).toBeGreaterThan(0);
        });
    });

    describe('getAIMove', () => {
        it('should use random strategy for easy difficulty', () => {
            const board = ['X', null, null, null, null, null, null, null, null];
            const move = getAIMove(board, AI_DIFFICULTY.EASY, PLAYERS.O);
            
            expect(move).not.toBe(null);
            expect(board[move]).toBe(null);
        });

        it('should use medium strategy for medium difficulty', () => {
            // With winning move available, medium should always take it
            const board = ['X', 'X', null, 'O', 'O', null, null, null, null];
            const move = getAIMove(board, AI_DIFFICULTY.MEDIUM, PLAYERS.O);
            expect(move).toBe(5); // Should take winning move
        });

        it('should use minimax for hard difficulty', () => {
            const board = ['X', 'X', null, 'O', 'O', null, null, null, null];
            const move = getAIMove(board, AI_DIFFICULTY.HARD, PLAYERS.O);
            expect(move).toBe(5); // Should take winning move
        });
    });

    describe('minimax', () => {
        it('should return positive score for AI winning position', () => {
            const board = ['X', 'X', null, 'O', 'O', 'O', 'X', null, null];
            const score = minimax(board, 0, true, -Infinity, Infinity, PLAYERS.O);
            expect(score).toBeGreaterThan(0);
        });

        it('should return negative score for opponent winning position', () => {
            const board = ['X', 'X', 'X', 'O', 'O', null, null, null, null];
            const score = minimax(board, 0, true, -Infinity, Infinity, PLAYERS.O);
            expect(score).toBeLessThan(0);
        });

        it('should return 0 for draw position', () => {
            const board = ['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X'];
            const score = minimax(board, 0, true, -Infinity, Infinity, PLAYERS.O);
            expect(score).toBe(0);
        });
    });

    describe('AIController', () => {
        let controller;

        beforeEach(() => {
            controller = new AIController(AI_DIFFICULTY.HARD, PLAYERS.O);
        });

        it('should initialize with correct settings', () => {
            expect(controller.difficulty).toBe(AI_DIFFICULTY.HARD);
            expect(controller.player).toBe(PLAYERS.O);
            expect(controller.isThinking).toBe(false);
        });

        it('should change difficulty', () => {
            controller.setDifficulty(AI_DIFFICULTY.EASY);
            expect(controller.difficulty).toBe(AI_DIFFICULTY.EASY);
        });

        it('should return move synchronously with getMoveSync', () => {
            const board = ['X', null, null, null, null, null, null, null, null];
            const move = controller.getMoveSync(board);
            
            expect(move).not.toBe(null);
            expect(board[move]).toBe(null);
        });

        it('should return move asynchronously with getMove', async () => {
            const board = ['X', null, null, null, null, null, null, null, null];
            
            expect(controller.isThinking).toBe(false);
            
            const movePromise = controller.getMove(board);
            
            // Should be thinking while processing
            expect(controller.isThinking).toBe(true);
            
            const move = await movePromise;
            
            expect(controller.isThinking).toBe(false);
            expect(move).not.toBe(null);
            expect(board[move]).toBe(null);
        });
    });
});

