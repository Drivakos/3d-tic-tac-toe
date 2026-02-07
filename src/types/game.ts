export type Player = 'X' | 'O';
export type CellIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type GameMode = 'pvp-local' | 'pvp-remote' | 'ai';
export type AIDifficulty = 'easy' | 'medium' | 'hard';
export type Cell = Player | null;

export type Board = readonly Cell[];
export type WinPattern = readonly [CellIndex, CellIndex, CellIndex];
export type WinPatterns = readonly WinPattern[];

export interface GameStatus {
  readonly isOver: boolean;
  readonly winner: Player | null;
  readonly pattern: WinPattern | null;
  readonly isDraw: boolean;
}

export interface GameState {
  readonly board: Board;
  readonly currentPlayer: Player;
  readonly gameOver: boolean;
  readonly winner: Player | null;
  readonly winningPattern: WinPattern | null;
  readonly gameNumber: number;
}

export interface Score {
  1: number;
  2: number;
}

export interface TimerConfig {
  readonly initialSeconds: number;
  readonly remainingSeconds: number;
  readonly isRunning: boolean;
}

export type TimerTickCallback = (remaining: number, total: number) => void;
export type TimerTimeoutCallback = () => void;
