/**
 * GameState - Manages the current state of the game
 */

import { PLAYERS, BOARD_SIZE } from './constants';
import type { Player, Board, CellIndex, WinPattern, GameState as GameStateType, Cell } from '../types/game';

export class GameState {
  private board!: Board;
  private gameOver!: boolean;
  private winner!: Player | null;
  private winningPattern!: WinPattern | null;
  private currentPlayer!: Player;
  private gameNumber!: number;

  constructor() {
    this.gameNumber = 0;
    this.reset();
  }

  reset(newRound: boolean = false): void {
    this.board = Array(BOARD_SIZE).fill(null) as Board;
    this.gameOver = false;
    this.winner = null;
    this.winningPattern = null;

    if (newRound) {
      this.gameNumber++;
    }

    this.currentPlayer = PLAYERS.X;
  }

  resetGameNumber(): void {
    this.gameNumber = 0;
  }

  getPlayerAsX(): 1 | 2 {
    return this.gameNumber % 2 === 0 ? 1 : 2;
  }

  getStartingPlayer(): Player {
    return PLAYERS.X;
  }

  getBoard(): Board {
    return this.board;
  }

  getCell(index: number): Player | null {
    return this.board[index];
  }

  isCellEmpty(index: number): boolean {
    return this.board[index] === null;
  }

  getEmptyCells(): CellIndex[] {
    const empty: CellIndex[] = [];
    for (let i = 0; i < this.board.length; i++) {
      if ((this.board as unknown as Array<Player | null>)[i] === null) {
        empty.push(i as CellIndex);
      }
    }
    return empty;
  }

  placePiece(index: number, player: Player): boolean {
    if (this.gameOver || !this.isCellEmpty(index)) {
      return false;
    }

    if (index < 0 || index >= BOARD_SIZE) {
      return false;
    }

    (this.board as Cell[])[index] = player;
    return true;
  }

  switchPlayer(): void {
    this.currentPlayer = this.currentPlayer === PLAYERS.X ? PLAYERS.O : PLAYERS.X;
  }

  getCurrentPlayer(): Player {
    return this.currentPlayer;
  }

  setGameOver(winner: Player | null = null, pattern: WinPattern | null = null): void {
    this.gameOver = true;
    this.winner = winner;
    this.winningPattern = pattern;
  }

  isGameOver(): boolean {
    return this.gameOver;
  }

  isBoardFull(): boolean {
    return this.board.every((cell): cell is Player => cell !== null);
  }

  toJSON(): GameStateType {
    return {
      board: [...this.board],
      currentPlayer: this.currentPlayer,
      gameOver: this.gameOver,
      winner: this.winner,
      winningPattern: this.winningPattern,
      gameNumber: this.gameNumber
    };
  }

  fromJSON(state: GameStateType): void {
    this.board = [...state.board] as Board;
    this.currentPlayer = state.currentPlayer;
    this.gameOver = state.gameOver;
    this.winner = state.winner;
    this.winningPattern = state.winningPattern;
    if (state.gameNumber !== undefined) {
      this.gameNumber = state.gameNumber;
    }
  }
}


