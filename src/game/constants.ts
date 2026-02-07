/**
 * Game constants and configuration
 */

import type { Player, GameMode, AIDifficulty, WinPattern, CellIndex } from '../types/game';

export const PLAYERS: { readonly X: Player; readonly O: Player } = {
  X: 'X',
  O: 'O'
} as const;

export const GAME_MODES: { readonly PVP_LOCAL: GameMode; readonly PVP_REMOTE: GameMode; readonly AI: GameMode } = {
  PVP_LOCAL: 'pvp-local',
  PVP_REMOTE: 'pvp-remote',
  AI: 'ai'
} as const;

export const AI_DIFFICULTY: { readonly EASY: AIDifficulty; readonly MEDIUM: AIDifficulty; readonly HARD: AIDifficulty } = {
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard'
} as const;

export const WIN_PATTERNS: readonly WinPattern[] = [
  [0, 1, 2] as const,
  [3, 4, 5] as const,
  [6, 7, 8] as const,
  [0, 3, 6] as const,
  [1, 4, 7] as const,
  [2, 5, 8] as const,
  [0, 4, 8] as const,
  [2, 4, 6] as const
] as const;

export const BOARD_SIZE: 9 = 9;

export const CENTER: CellIndex = 4;
export const CORNERS: readonly CellIndex[] = [0, 2, 6, 8] as const;
export const EDGES: readonly CellIndex[] = [1, 3, 5, 7] as const;
