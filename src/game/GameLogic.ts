/**
 * GameLogic - Pure functions for game rule evaluation
 */

import { WIN_PATTERNS, PLAYERS } from './constants';
import type { Player, Board, CellIndex, GameStatus, WinPattern, Cell } from '../types/game';

interface WinResult {
  winner: Player;
  pattern: WinPattern;
}

export function checkWinner(board: Board): WinResult | null {
  for (const pattern of WIN_PATTERNS) {
    const [a, b, c] = pattern;
    const cellA = board[a];
    if (cellA && cellA === board[b] && cellA === board[c]) {
      return {
        winner: cellA,
        pattern: pattern
      };
    }
  }
  return null;
}

export function checkDraw(board: Board): boolean {
  return !checkWinner(board) && board.every((cell): cell is Player => cell !== null);
}

export function getEmptyCells(board: Board): CellIndex[] {
  const empty: CellIndex[] = [];
  for (let i = 0; i < board.length; i++) {
    if ((board as unknown as Array<Player | null>)[i] === null) {
      empty.push(i as CellIndex);
    }
  }
  return empty;
}

export function isValidMove(board: Board, index: number): boolean {
  return index >= 0 && index < board.length && board[index] === null;
}

export function simulateMove(board: Board, index: number, player: Player): Board {
  const newBoard = [...board] as Cell[];
  newBoard[index] = player;
  return newBoard;
}

export function getOpponent(player: Player): Player {
  return player === PLAYERS.X ? PLAYERS.O : PLAYERS.X;
}

export function findWinningMove(board: Board, player: Player): CellIndex | null {
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

export function getGameStatus(board: Board): GameStatus {
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
