/**
 * PeerManager - Handles peer-to-peer connections for remote multiplayer
 */

import { PLAYERS } from '../game/constants.js';

// Message types for P2P communication
export const MESSAGE_TYPES = {
    GAME_START: 'game-start',
    MOVE: 'move',
    RESET: 'reset',
    SYNC: 'sync',
    CHAT: 'chat',
    TIMER_SYNC: 'timer-sync',
    TIMER_TIMEOUT: 'timer-timeout'
};

/**
 * Generate a random room code using UUID
 * @param {number} length - Code length (default 8)
 * @returns {string} Uppercase alphanumeric code
 */
export function generateRoomCode(length = 8) {
    // Use crypto.randomUUID() and take first N characters (removing hyphens)
    const uuid = crypto.randomUUID().replace(/-/g, '').toUpperCase();
    return uuid.substring(0, length);
}

/**
 * Check if WebRTC is supported in the current browser/context
 * @returns {Object} { supported: boolean, reason?: string }
 */
export function checkWebRTCSupport() {
    // Running in Node.js (tests) - skip browser checks
    if (typeof window === 'undefined') {
        return { supported: true };
    }

    // Check for secure context FIRST (HTTPS or localhost)
    // This is the most common issue
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

    // Check for RTCPeerConnection support (including webkit prefix for older Safari)
    const RTCPeer = window.RTCPeerConnection || 
                    window.webkitRTCPeerConnection || 
                    window.mozRTCPeerConnection;
    
    if (!RTCPeer) {
        return {
            supported: false,
            reason: 'WebRTC is blocked or disabled. Check: 1) Disable ad-blockers/privacy extensions (they often block WebRTC), 2) Check chrome://flags for WebRTC settings, 3) Try Incognito mode.'
        };
    }

    return { supported: true };
}

/**
 * Get a more detailed WebRTC diagnostic
 * @returns {Object} Diagnostic information
 */
export function getWebRTCDiagnostics() {
    if (typeof window === 'undefined') {
        return { environment: 'node' };
    }

    return {
        protocol: window.location.protocol,
        hostname: window.location.hostname,
        isSecureContext: window.isSecureContext,
        hasRTCPeerConnection: typeof RTCPeerConnection !== 'undefined',
        hasWebkitRTC: typeof window.webkitRTCPeerConnection !== 'undefined',
        userAgent: navigator.userAgent
    };
}

/**
 * PeerManager class for handling WebRTC connections
 */
export class PeerManager {
    constructor() {
        this.peer = null;
        this.connection = null;
        this.roomCode = null;
        this.isHost = false;
        this.myRole = null;
        this.isConnected = false;
        this.gameSettings = null;
        
        // Event handlers
        this.onConnect = null;
        this.onDisconnect = null;
        this.onMessage = null;
        this.onError = null;
        this.onGameStart = null; // Called when game settings are received
    }

    /**
     * Set game settings to be shared with opponent
     * @param {Object} settings - Game settings (timerSeconds, etc.)
     */
    setGameSettings(settings) {
        this.gameSettings = settings;
    }

    /**
     * Initialize the peer connection
     * @param {string} customId - Optional custom peer ID
     * @returns {Promise<string>} The peer ID
     */
    async initialize(customId = null) {
        return new Promise((resolve, reject) => {
            // Check if Peer is available (PeerJS loaded)
            if (typeof Peer === 'undefined') {
                reject(new Error('PeerJS library not loaded'));
                return;
            }

            const peerId = customId || `ttt-${generateRoomCode()}`;
            
            this.peer = new Peer(peerId, { debug: 1 });
            
            this.peer.on('open', (id) => {
                console.log('Peer initialized with ID:', id);
                this.roomCode = id.replace('ttt-', '');
                resolve(id);
            });
            
            this.peer.on('error', (err) => {
                console.error('Peer error:', err);
                if (err.type === 'unavailable-id') {
                    // ID taken, try with new one
                    this.destroy();
                    this.initialize().then(resolve).catch(reject);
                } else {
                    if (this.onError) this.onError(err);
                    reject(err);
                }
            });
            
            this.peer.on('connection', (conn) => {
                this._handleIncomingConnection(conn);
            });
        });
    }

    /**
     * Handle incoming connection (when someone joins our room)
     * @param {Object} conn - PeerJS connection object
     * @private
     */
    _handleIncomingConnection(conn) {
        this.connection = conn;
        this.isHost = true;
        this.myRole = PLAYERS.X; // Host is always X
        
        conn.on('open', () => {
            console.log('Peer connected:', conn.peer);
            this.isConnected = true;
            
            // Send game start message with role assignment and settings
            // Timer will be added by the caller via sendGameStart
            this.send({
                type: MESSAGE_TYPES.GAME_START,
                role: PLAYERS.O, // Joiner is O
                timerSeconds: this.gameSettings?.timerSeconds || 0
            });
            
            if (this.onConnect) {
                this.onConnect({
                    isHost: true,
                    myRole: PLAYERS.X
                });
            }
        });
        
        conn.on('data', (data) => {
            if (this.onMessage) this.onMessage(data);
        });
        
        conn.on('close', () => {
            this._handleDisconnect();
        });
        
        conn.on('error', (err) => {
            console.error('Connection error:', err);
            if (this.onError) this.onError(err);
        });
    }

    /**
     * Connect to a host's room
     * @param {string} roomCode - The room code to join
     * @returns {Promise<void>}
     */
    async connect(roomCode) {
        return new Promise((resolve, reject) => {
            if (!this.peer) {
                reject(new Error('Peer not initialized'));
                return;
            }
            
            const fullPeerId = roomCode.startsWith('ttt-') ? roomCode : `ttt-${roomCode}`;
            
            this.connection = this.peer.connect(fullPeerId, { reliable: true });
            
            const timeout = setTimeout(() => {
                if (!this.isConnected) {
                    reject(new Error('Connection timeout'));
                }
            }, 10000);
            
            this.connection.on('open', () => {
                clearTimeout(timeout);
                console.log('Connected to host:', fullPeerId);
                this.isConnected = true;
                this.isHost = false;
                resolve();
            });
            
            this.connection.on('data', (data) => {
                // Handle game start message
                if (data.type === MESSAGE_TYPES.GAME_START) {
                    this.myRole = data.role;
                    this.gameSettings = { timerSeconds: data.timerSeconds || 0 };
                    if (this.onConnect) {
                        this.onConnect({
                            isHost: false,
                            myRole: data.role,
                            timerSeconds: data.timerSeconds || 0
                        });
                    }
                }
                if (this.onMessage) this.onMessage(data);
            });
            
            this.connection.on('close', () => {
                this._handleDisconnect();
            });
            
            this.connection.on('error', (err) => {
                clearTimeout(timeout);
                console.error('Connection error:', err);
                if (this.onError) this.onError(err);
                reject(err);
            });
        });
    }

    /**
     * Handle disconnection
     * @private
     */
    _handleDisconnect() {
        console.log('Peer disconnected');
        this.isConnected = false;
        if (this.onDisconnect) this.onDisconnect();
    }

    /**
     * Send a message to the connected peer
     * @param {Object} data - Message data
     */
    send(data) {
        if (this.connection && this.connection.open) {
            this.connection.send(data);
            return true;
        }
        return false;
    }

    /**
     * Send a move to the opponent
     * @param {number} cellIndex - The cell that was played
     */
    sendMove(cellIndex) {
        this.send({
            type: MESSAGE_TYPES.MOVE,
            cellIndex
        });
    }

    /**
     * Send a game reset request
     */
    sendReset() {
        this.send({
            type: MESSAGE_TYPES.RESET
        });
    }

    /**
     * Send a state sync message
     * @param {Object} state - Game state to sync
     */
    sendSync(state) {
        this.send({
            type: MESSAGE_TYPES.SYNC,
            ...state
        });
    }

    /**
     * Send timer sync to opponent
     * @param {number} remaining - Remaining seconds
     * @param {string} player - Which player's timer (X or O)
     */
    sendTimerSync(remaining, player) {
        this.send({
            type: MESSAGE_TYPES.TIMER_SYNC,
            remaining,
            player
        });
    }

    /**
     * Send timer timeout notification
     * @param {string} timedOutPlayer - Which player timed out
     */
    sendTimerTimeout(timedOutPlayer) {
        this.send({
            type: MESSAGE_TYPES.TIMER_TIMEOUT,
            timedOutPlayer
        });
    }

    /**
     * Get the shareable room link
     * @returns {string}
     */
    getShareableLink() {
        const baseUrl = window.location.origin + window.location.pathname;
        return `${baseUrl}?room=${this.roomCode}`;
    }

    /**
     * Check if this is my turn
     * @param {string} currentPlayer - Current player symbol
     * @returns {boolean}
     */
    isMyTurn(currentPlayer) {
        return currentPlayer === this.myRole;
    }

    /**
     * Destroy the peer connection
     */
    destroy() {
        if (this.connection) {
            this.connection.close();
            this.connection = null;
        }
        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }
        this.isConnected = false;
        this.isHost = false;
        this.myRole = null;
        this.roomCode = null;
    }

    /**
     * Get connection status
     * @returns {Object}
     */
    getStatus() {
        return {
            isConnected: this.isConnected,
            isHost: this.isHost,
            myRole: this.myRole,
            roomCode: this.roomCode
        };
    }
}

/**
 * Extract room code from URL if present
 * @returns {string|null}
 */
export function getRoomCodeFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('room');
}

/**
 * Clear room code from URL
 */
export function clearRoomCodeFromUrl() {
    window.history.replaceState({}, document.title, window.location.pathname);
}

