import type { Player, GameState, Score } from './game';

export type MessageType =
  | 'game-start'
  | 'move'
  | 'reset'
  | 'sync'
  | 'full-sync'
  | 'chat'
  | 'timer-sync'
  | 'timer-timeout'
  | 'rematch-request'
  | 'rematch-response';

export interface BaseMessage {
  type: MessageType;
}

export interface MoveMessage extends BaseMessage {
  type: 'move';
  cellIndex: number;
}

export interface ResetMessage extends BaseMessage {
  type: 'reset';
}

export interface SyncMessage extends BaseMessage {
  type: 'sync';
  board: ReadonlyArray<Player | null>;
  currentPlayer: Player;
  gameOver: boolean;
}

export interface FullSyncMessage extends BaseMessage {
  type: 'full-sync';
  gameState: GameState;
  scores: Score;
  timerSeconds: number;
  gameStarted: boolean;
}

export interface TimerSyncMessage extends BaseMessage {
  type: 'timer-sync';
  remaining: number;
  player: Player;
}

export interface TimerTimeoutMessage extends BaseMessage {
  type: 'timer-timeout';
  timedOutPlayer: Player;
}

export interface GameStartMessage extends BaseMessage {
  type: 'game-start';
  role: Player;
  timerSeconds: number;
}

export interface RematchRequestMessage extends BaseMessage {
  type: 'rematch-request';
  playerNum: 1 | 2;
}

export interface RematchResponseMessage extends BaseMessage {
  type: 'rematch-response';
  accepted: boolean;
}

export interface ChatMessage extends BaseMessage {
  type: 'chat';
  text: string;
}

export type PeerMessage =
  | MoveMessage
  | ResetMessage
  | SyncMessage
  | FullSyncMessage
  | TimerSyncMessage
  | TimerTimeoutMessage
  | GameStartMessage
  | RematchRequestMessage
  | RematchResponseMessage
  | ChatMessage
  | BaseMessage;

export interface ConnectionStatus {
  readonly isConnected: boolean;
  readonly isHost: boolean;
  readonly myRole: Player | null;
  readonly roomCode: string | null;
}

export interface WebRTCSupport {
  readonly supported: boolean;
  readonly reason?: string;
}

export interface WebRTCDiagnostics {
  readonly protocol: string;
  readonly hostname: string;
  readonly isSecureContext: boolean;
  readonly hasRTCPeerConnection: boolean;
  readonly hasWebkitRTC: boolean;
  readonly userAgent: string;
}
