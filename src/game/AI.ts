/**
 * AI - Artificial Intelligence for computer opponent
 */

import { PLAYERS, AI_DIFFICULTY, CENTER, CORNERS } from './constants';
import {
  checkWinner,
  getEmptyCells,
  simulateMove,
  findWinningMove
} from './GameLogic';
import type { Player, Board, AIDifficulty, CellIndex } from '../types/game';

export function minimax(
  board: Board,
  depth: number,
  isMaximizing: boolean,
  alpha: number,
  beta: number,
  aiPlayer: Player
): number {
  const humanPlayer = aiPlayer === PLAYERS.X ? PLAYERS.O : PLAYERS.X;
  const result = checkWinner(board);

  if (result !== null) {
    if (result.winner === aiPlayer) return 10 - depth;
    if (result.winner === humanPlayer) return depth - 10;
  }

  const emptyCells = getEmptyCells(board);
  if (emptyCells.length === 0) return 0;

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

export function getBestMove(board: Board, aiPlayer: Player = PLAYERS.O): CellIndex | null {
  const emptyCells = getEmptyCells(board);
  if (emptyCells.length === 0) return null;

  let bestScore = -Infinity;
  let bestMove: CellIndex | null = null;

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

export function getRandomMove(board: Board): CellIndex | null {
  const emptyCells = getEmptyCells(board);
  if (emptyCells.length === 0) return null;
  return emptyCells[Math.floor(Math.random() * emptyCells.length)];
}

export function getMediumMove(board: Board, aiPlayer: Player = PLAYERS.O): CellIndex | null {
  const humanPlayer = aiPlayer === PLAYERS.X ? PLAYERS.O : PLAYERS.X;
  const emptyCells = getEmptyCells(board);

  if (emptyCells.length === 0) return null;

  const winMove = findWinningMove(board, aiPlayer);
  if (winMove !== null) return winMove;

  const blockMove = findWinningMove(board, humanPlayer);
  if (blockMove !== null) return blockMove;

  if (Math.random() > 0.5) {
    return getBestMove(board, aiPlayer);
  }

  if (board[CENTER] === null) return CENTER;

  const emptyCorners = CORNERS.filter((i): boolean => board[i] === null);
  if (emptyCorners.length > 0) {
    return emptyCorners[Math.floor(Math.random() * emptyCorners.length)];
  }

  return getRandomMove(board);
}

export function getAIMove(board: Board, difficulty: AIDifficulty, aiPlayer: Player = PLAYERS.O): CellIndex | null {
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

export class AIController {
  private difficulty: AIDifficulty;
  private player: Player;
  private isThinking: boolean;
  private minDelay: number;
  private maxDelay: number;

  constructor(difficulty: AIDifficulty = AI_DIFFICULTY.MEDIUM, player: Player = PLAYERS.O) {
    this.difficulty = difficulty;
    this.player = player;
    this.isThinking = false;
    this.minDelay = 400;
    this.maxDelay = 800;
  }

  setDifficulty(difficulty: AIDifficulty): void {
    this.difficulty = difficulty;
  }

  async getMove(board: Board): Promise<CellIndex | null> {
    this.isThinking = true;

    const delay = this.minDelay + Math.random() * (this.maxDelay - this.minDelay);
    await new Promise((resolve): number => setTimeout(resolve, delay));

    const move = getAIMove(board, this.difficulty, this.player);
    this.isThinking = false;

    return move;
  }

  getMoveSync(board: Board): CellIndex | null {
    return getAIMove(board, this.difficulty, this.player);
  }
}
