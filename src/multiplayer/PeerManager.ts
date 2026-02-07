/**
 * PeerManager - Handles peer-to-peer connections for remote multiplayer
 */

import Peer from 'peerjs';
import { PLAYERS } from '../game/constants';
import type { Player, GameState, Score, CellIndex } from '../types/game';
import type {
  MessageType,
  PeerMessage,
  ConnectionStatus,
  WebRTCSupport,
  WebRTCDiagnostics,
  MoveMessage,
  ResetMessage,
  SyncMessage,
  FullSyncMessage,
  TimerSyncMessage,
  TimerTimeoutMessage,
  GameStartMessage,
  RematchRequestMessage,
  RematchResponseMessage
} from '../types/multiplayer';

export const MESSAGE_TYPES: Record<string, MessageType> = {
  GAME_START: 'game-start',
  MOVE: 'move',
  RESET: 'reset',
  SYNC: 'sync',
  FULL_SYNC: 'full-sync',
  TIMER_SYNC: 'timer-sync',
  TIMER_TIMEOUT: 'timer-timeout',
  REMATCH_REQUEST: 'rematch-request',
  REMATCH_RESPONSE: 'rematch-response'
} as const;

export function generateRoomCode(length: number = 8): string {
  const uuid = crypto.randomUUID().replace(/-/g, '').toUpperCase();
  return uuid.substring(0, length);
}

export function checkWebRTCSupport(): WebRTCSupport {
  if (typeof window === 'undefined') {
    return { supported: true };
  }

  const isSecure = window.isSecureContext ||
    window.location.protocol === 'https:' ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';

  if (!isSecure) {
    return {
      supported: false,
      reason: `Remote play requires HTTPS or localhost. Current: ${window.location.protocol}//${window.location.hostname}`
    };
  }

  const hasRTCPeer = typeof RTCPeerConnection !== 'undefined' ||
    typeof (window as unknown as { webkitRTCPeerConnection: unknown }).webkitRTCPeerConnection !== 'undefined';

  if (!hasRTCPeer) {
    return {
      supported: false,
      reason: 'WebRTC is blocked or disabled. Check: 1) Disable ad-blockers/privacy extensions (they often block WebRTC), 2) Check chrome://flags for WebRTC settings, 3) Try Incognito mode.'
    };
  }

  return { supported: true };
}

export function getWebRTCDiagnostics(): WebRTCDiagnostics | { environment: string } {
  if (typeof window === 'undefined') {
    return { environment: 'node' };
  }

  return {
    protocol: window.location.protocol,
    hostname: window.location.hostname,
    isSecureContext: window.isSecureContext,
    hasRTCPeerConnection: typeof RTCPeerConnection !== 'undefined',
    hasWebkitRTC: typeof (window as unknown as { webkitRTCPeerConnection: unknown }).webkitRTCPeerConnection !== 'undefined',
    userAgent: navigator.userAgent
  };
}

interface GameSettings {
  timerSeconds: number;
}

interface ConnectInfo {
  isHost: boolean;
  myRole: Player;
  timerSeconds?: number;
}

type ConnectCallback = (info: ConnectInfo) => void;
type DisconnectCallback = () => void;
type MessageCallback = (data: PeerMessage) => void;
type ErrorCallback = (err: Error) => void;

interface PeerConnection {
  on(event: string, callback: (...args: unknown[]) => void): void;
  send(data: unknown): void;
  close(): void;
  open: boolean;
  peer: string;
}

export class PeerManager {
  private peer: Peer | null = null;
  private connection: PeerConnection | null = null;
  private roomCode: string | null = null;
  private _isHost: boolean = false;
  private _myRole: Player | null = null;
  private _isConnected: boolean = false;
  private gameSettings: GameSettings | null = null;

  onConnect: ConnectCallback | null = null;
  onDisconnect: DisconnectCallback | null = null;
  onMessage: MessageCallback | null = null;
  onError: ErrorCallback | null = null;
  onGameStart: ConnectCallback | null = null;

  get isHost(): boolean {
    return this._isHost;
  }

  set isHost(value: boolean) {
    this._isHost = value;
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  set isConnected(value: boolean) {
    this._isConnected = value;
  }

  get myRole(): Player | null {
    return this._myRole;
  }

  set myRole(value: Player | null) {
    this._myRole = value;
  }

  setGameSettings(settings: GameSettings): void {
    this.gameSettings = settings;
  }

  async initialize(customId?: string): Promise<string> {
    return new Promise((resolve, reject): void => {

      const peerId = customId || `ttt-${generateRoomCode()}`;
      this.peer = new Peer(peerId, { debug: 1 });
      this.peer.on('open', (id: string): void => {

        this.roomCode = id.replace('ttt-', '');
        resolve(id);
      });

      this.peer.on('error', (err: { type: string; message?: string }): void => {

        if (err.type === 'unavailable-id') {
          this.destroy();
          this.initialize().then(resolve).catch(reject);
        } else {
          if (this.onError) this.onError(new Error(err.message || err.type));
          reject(new Error(err.message || err.type));
        }
      });

      this.peer.on('connection', (conn: PeerConnection): void => {
        this._handleIncomingConnection(conn);
      });
    });
  }

  private _handleIncomingConnection(conn: PeerConnection): void {
    this.connection = conn;
    this._isHost = true;
    this.myRole = PLAYERS.X;

    conn.on('open', (): void => {

      this._isConnected = true;

      setTimeout(() => {

        this.send({
          type: MESSAGE_TYPES.GAME_START,
          role: PLAYERS.O,
          timerSeconds: this.gameSettings?.timerSeconds || 0
        } as GameStartMessage);

        if (this.onConnect) {
          this.onConnect({
            isHost: true,
            myRole: PLAYERS.X
          });
        }
      }, 500);
    });

    conn.on('data', (data: unknown): void => {
      if (this.onMessage) this.onMessage(data as PeerMessage);
    });

    conn.on('close', (): void => {
      this._handleDisconnect();
    });

    conn.on('error', (err: Error): void => {
      if (this.onError) this.onError(err);
    });
  }

  async connect(roomCode: string): Promise<void> {
    return new Promise((resolve, reject): void => {
      try {
        if (!this.peer) {
          reject(new Error('Peer not initialized'));
          return;
        }

        const fullPeerId = roomCode.startsWith('ttt-') ? roomCode : `ttt-${roomCode}`;
        this.connection = this.peer.connect(fullPeerId, { reliable: true }) as unknown as PeerConnection;

        const timeout = setTimeout((): void => {
          if (!this._isConnected) {
            reject(new Error('Connection timeout'));
          }
        }, 15000);

        this.connection.on('open', (): void => {
          clearTimeout(timeout);
          this._isConnected = true;
          this._isHost = false;
          resolve();
        });

        this.connection.on('data', (data: unknown): void => {

          try {
            const message = data as PeerMessage;
            if (message.type === MESSAGE_TYPES.GAME_START) {
              const gameStartMsg = message as GameStartMessage;
              this.myRole = gameStartMsg.role;
              this.gameSettings = { timerSeconds: gameStartMsg.timerSeconds || 0 };
              if (this.onConnect) {
                this.onConnect({
                  isHost: false,
                  myRole: gameStartMsg.role,
                  timerSeconds: gameStartMsg.timerSeconds || 0
                });
              }
            }
            if (this.onMessage) this.onMessage(message);
          } catch (e) {

          }
        });

        this.connection.on('close', (): void => {
          this._handleDisconnect();
        });

        this.connection.on('error', (err: Error): void => {
          clearTimeout(timeout);
          if (this.onError) this.onError(err);
          reject(err);
        });
      } catch (err) {

        reject(err);
      }
    });
  }

  private _handleDisconnect(): void {

    this._isConnected = false;
    if (this.onDisconnect) this.onDisconnect();
  }

  send(data: PeerMessage): boolean {
    if (this.connection && this.connection.open) {
      this.connection.send(data);
      return true;
    }
    return false;
  }

  sendMove(cellIndex: CellIndex): void {
    this.send({
      type: MESSAGE_TYPES.MOVE,
      cellIndex
    } as MoveMessage);
  }

  sendReset(): void {
    this.send({
      type: MESSAGE_TYPES.RESET
    } as ResetMessage);
  }

  sendFullSync(state: { gameState: GameState; scores: Score; timerSeconds: number; gameStarted: boolean }): void {
    this.send({
      type: MESSAGE_TYPES.FULL_SYNC,
      ...state
    } as FullSyncMessage);
  }

  sendSync(state: { board: ReadonlyArray<Player | null>; currentPlayer: Player; gameOver: boolean }): void {
    this.send({
      type: MESSAGE_TYPES.SYNC,
      ...state
    } as SyncMessage);
  }

  sendTimerSync(remaining: number, player: Player): void {
    this.send({
      type: MESSAGE_TYPES.TIMER_SYNC,
      remaining,
      player
    } as TimerSyncMessage);
  }

  sendTimerTimeout(timedOutPlayer: Player): void {
    this.send({
      type: MESSAGE_TYPES.TIMER_TIMEOUT,
      timedOutPlayer
    } as TimerTimeoutMessage);
  }

  sendRematchRequest(playerNum: 1 | 2): void {
    this.send({
      type: MESSAGE_TYPES.REMATCH_REQUEST,
      playerNum
    } as RematchRequestMessage);
  }

  sendRematchResponse(accepted: boolean): void {
    this.send({
      type: MESSAGE_TYPES.REMATCH_RESPONSE,
      accepted
    } as RematchResponseMessage);
  }

  getShareableLink(): string {
    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}?room=${this.roomCode}`;
  }

  isMyTurn(currentPlayer: Player): boolean {
    return currentPlayer === this.myRole;
  }

  destroy(): void {
    if (this.connection) {
      this.connection.close();
      this.connection = null;
    }
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this._isConnected = false;
    this._isHost = false;
    this.myRole = null;
    this.roomCode = null;
  }

  getStatus(): ConnectionStatus {
    return {
      isConnected: this._isConnected,
      isHost: this._isHost,
      myRole: this.myRole,
      roomCode: this.roomCode
    };
  }
}

export function getRoomCodeFromUrl(): string | null {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('room');
}

export function clearRoomCodeFromUrl(): void {
  window.history.replaceState({}, document.title, window.location.pathname);
}
