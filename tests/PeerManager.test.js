import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    generateRoomCode,
    PeerManager,
    MESSAGE_TYPES,
    getRoomCodeFromUrl,
    clearRoomCodeFromUrl,
    checkWebRTCSupport
} from '../js/multiplayer/PeerManager.js';
import { PLAYERS } from '../js/game/constants.js';

describe('PeerManager utilities', () => {
    describe('generateRoomCode', () => {
        it('should generate code of default length (8)', () => {
            const code = generateRoomCode();
            expect(code).toHaveLength(8);
        });

        it('should generate code of specified length', () => {
            expect(generateRoomCode(4)).toHaveLength(4);
            expect(generateRoomCode(8)).toHaveLength(8);
            expect(generateRoomCode(12)).toHaveLength(12);
        });

        it('should only contain uppercase alphanumeric characters', () => {
            const validChars = '0123456789ABCDEF';
            const code = generateRoomCode();
            
            for (const char of code) {
                expect(validChars).toContain(char);
            }
        });

        it('should be uppercase', () => {
            const code = generateRoomCode();
            expect(code).toBe(code.toUpperCase());
        });

        it('should generate unique codes (UUID-based)', () => {
            const codes = new Set();
            
            // Generate 100 codes and check they're all unique
            for (let i = 0; i < 100; i++) {
                codes.add(generateRoomCode());
            }
            
            // UUID-based codes should be completely unique
            expect(codes.size).toBe(100);
        });
    });

    describe('MESSAGE_TYPES', () => {
        it('should have all required message types', () => {
            expect(MESSAGE_TYPES.GAME_START).toBe('game-start');
            expect(MESSAGE_TYPES.MOVE).toBe('move');
            expect(MESSAGE_TYPES.RESET).toBe('reset');
            expect(MESSAGE_TYPES.SYNC).toBe('sync');
        });
    });

    describe('checkWebRTCSupport', () => {
        it('should be a function', () => {
            expect(typeof checkWebRTCSupport).toBe('function');
        });

        it('should return an object with supported property', () => {
            const result = checkWebRTCSupport();
            expect(result).toHaveProperty('supported');
            expect(typeof result.supported).toBe('boolean');
        });

        it('should include reason when not supported', () => {
            // In Node.js test environment, WebRTC won't be supported
            const result = checkWebRTCSupport();
            if (!result.supported) {
                expect(result).toHaveProperty('reason');
                expect(typeof result.reason).toBe('string');
            }
        });
    });
});

describe('PeerManager class', () => {
    let peerManager;

    beforeEach(() => {
        peerManager = new PeerManager();
    });

    describe('initialization', () => {
        it('should initialize with null/false default values', () => {
            expect(peerManager.peer).toBe(null);
            expect(peerManager.connection).toBe(null);
            expect(peerManager.roomCode).toBe(null);
            expect(peerManager.isHost).toBe(false);
            expect(peerManager.myRole).toBe(null);
            expect(peerManager.isConnected).toBe(false);
        });

        it('should have null event handlers initially', () => {
            expect(peerManager.onConnect).toBe(null);
            expect(peerManager.onDisconnect).toBe(null);
            expect(peerManager.onMessage).toBe(null);
            expect(peerManager.onError).toBe(null);
        });
    });

    describe('getStatus', () => {
        it('should return correct initial status', () => {
            const status = peerManager.getStatus();
            
            expect(status).toEqual({
                isConnected: false,
                isHost: false,
                myRole: null,
                roomCode: null
            });
        });

        it('should return updated status after changes', () => {
            peerManager.isConnected = true;
            peerManager.isHost = true;
            peerManager.myRole = PLAYERS.X;
            peerManager.roomCode = 'ABC123';

            const status = peerManager.getStatus();
            
            expect(status).toEqual({
                isConnected: true,
                isHost: true,
                myRole: PLAYERS.X,
                roomCode: 'ABC123'
            });
        });
    });

    describe('isMyTurn', () => {
        it('should return true when current player matches my role', () => {
            peerManager.myRole = PLAYERS.X;
            expect(peerManager.isMyTurn(PLAYERS.X)).toBe(true);
        });

        it('should return false when current player does not match my role', () => {
            peerManager.myRole = PLAYERS.X;
            expect(peerManager.isMyTurn(PLAYERS.O)).toBe(false);
        });
    });

    describe('getShareableLink', () => {
        it('should generate correct link format', () => {
            // Mock window.location
            const originalLocation = global.window?.location;
            global.window = {
                location: {
                    origin: 'https://example.com',
                    pathname: '/game/'
                }
            };

            peerManager.roomCode = 'ABC123';
            const link = peerManager.getShareableLink();
            
            expect(link).toBe('https://example.com/game/?room=ABC123');

            // Restore
            if (originalLocation) {
                global.window.location = originalLocation;
            }
        });
    });

    describe('destroy', () => {
        it('should reset all state', () => {
            // Set some values
            peerManager.isConnected = true;
            peerManager.isHost = true;
            peerManager.myRole = PLAYERS.X;
            peerManager.roomCode = 'ABC123';
            
            // Mock connection and peer
            peerManager.connection = { close: vi.fn() };
            peerManager.peer = { destroy: vi.fn() };

            peerManager.destroy();

            expect(peerManager.isConnected).toBe(false);
            expect(peerManager.isHost).toBe(false);
            expect(peerManager.myRole).toBe(null);
            expect(peerManager.roomCode).toBe(null);
            expect(peerManager.connection).toBe(null);
            expect(peerManager.peer).toBe(null);
        });
    });

    describe('send', () => {
        it('should return false when no connection', () => {
            expect(peerManager.send({ type: 'test' })).toBe(false);
        });

        it('should return false when connection not open', () => {
            peerManager.connection = { open: false, send: vi.fn() };
            expect(peerManager.send({ type: 'test' })).toBe(false);
        });

        it('should send data when connection is open', () => {
            const mockSend = vi.fn();
            peerManager.connection = { open: true, send: mockSend };
            
            const data = { type: 'test', value: 123 };
            const result = peerManager.send(data);
            
            expect(result).toBe(true);
            expect(mockSend).toHaveBeenCalledWith(data);
        });
    });

    describe('sendMove', () => {
        it('should send move message with correct format', () => {
            const mockSend = vi.fn();
            peerManager.connection = { open: true, send: mockSend };
            
            peerManager.sendMove(4);
            
            expect(mockSend).toHaveBeenCalledWith({
                type: MESSAGE_TYPES.MOVE,
                cellIndex: 4
            });
        });
    });

    describe('sendReset', () => {
        it('should send reset message', () => {
            const mockSend = vi.fn();
            peerManager.connection = { open: true, send: mockSend };
            
            peerManager.sendReset();
            
            expect(mockSend).toHaveBeenCalledWith({
                type: MESSAGE_TYPES.RESET
            });
        });
    });

    describe('sendSync', () => {
        it('should send sync message with state', () => {
            const mockSend = vi.fn();
            peerManager.connection = { open: true, send: mockSend };
            
            const state = {
                board: ['X', null, 'O', null, null, null, null, null, null],
                currentPlayer: PLAYERS.O,
                scores: { X: 1, O: 0 }
            };
            
            peerManager.sendSync(state);
            
            expect(mockSend).toHaveBeenCalledWith({
                type: MESSAGE_TYPES.SYNC,
                ...state
            });
        });
    });
});

describe('URL utilities', () => {
    // These tests would need DOM mocking for full coverage
    // Basic structure tests only
    
    describe('getRoomCodeFromUrl', () => {
        it('should be a function', () => {
            expect(typeof getRoomCodeFromUrl).toBe('function');
        });
    });

    describe('clearRoomCodeFromUrl', () => {
        it('should be a function', () => {
            expect(typeof clearRoomCodeFromUrl).toBe('function');
        });
    });
});

