import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Timer, TIMER_PRESETS } from '../src/game/Timer.ts';

// Mock requestAnimationFrame for Node.js environment
global.requestAnimationFrame = vi.fn((cb) => setTimeout(cb, 16));

describe('Timer', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('TIMER_PRESETS', () => {
        it('should have correct preset values', () => {
            expect(TIMER_PRESETS.HARD).toBe(3);
            expect(TIMER_PRESETS.MEDIUM).toBe(5);
            expect(TIMER_PRESETS.EASY).toBe(10);
            expect(TIMER_PRESETS.RELAXED).toBe(15);
            expect(TIMER_PRESETS.NONE).toBe(0);
        });
    });

    describe('constructor', () => {
        it('should initialize with given seconds', () => {
            const timer = new Timer(10);
            expect(timer.initialSeconds).toBe(10);
            expect(timer.remainingSeconds).toBe(10);
            expect(timer.isRunning).toBe(false);
        });

        it('should initialize with callbacks', () => {
            const onTick = vi.fn();
            const onTimeout = vi.fn();
            const timer = new Timer(5, onTick, onTimeout);
            expect(timer.onTick).toBe(onTick);
            expect(timer.onTimeout).toBe(onTimeout);
        });

        it('should default to 0 seconds', () => {
            const timer = new Timer();
            expect(timer.initialSeconds).toBe(0);
        });
    });

    describe('setDuration', () => {
        it('should update timer duration', () => {
            const timer = new Timer(5);
            timer.setDuration(10);
            expect(timer.initialSeconds).toBe(10);
            expect(timer.remainingSeconds).toBe(10);
        });
    });

    describe('start', () => {
        it('should start the timer', () => {
            const timer = new Timer(5);
            timer.start();
            expect(timer.isRunning).toBe(true);
        });

        it('should reset remaining time on start', () => {
            const timer = new Timer(10);
            timer.remainingSeconds = 5;
            timer.start();
            expect(timer.remainingSeconds).toBe(10);
        });

        it('should call onTick immediately on start', () => {
            const onTick = vi.fn();
            const timer = new Timer(5, onTick);
            timer.start();
            expect(onTick).toHaveBeenCalledWith(5, 5);
        });

        it('should not start if duration is 0', () => {
            const timer = new Timer(0);
            timer.start();
            expect(timer.isRunning).toBe(false);
        });
    });

    describe('stop', () => {
        it('should stop the timer', () => {
            const timer = new Timer(5);
            timer.start();
            timer.stop();
            expect(timer.isRunning).toBe(false);
        });
    });

    describe('pause and resume', () => {
        it('should pause the timer', () => {
            const timer = new Timer(5);
            timer.start();
            timer.pause();
            expect(timer.isRunning).toBe(false);
        });

        it('should resume from paused state', () => {
            const timer = new Timer(5);
            timer.start();
            timer.remainingSeconds = 3;
            timer.pause();
            timer.resume();
            expect(timer.isRunning).toBe(true);
        });

        it('should not resume if remaining is 0', () => {
            const timer = new Timer(5);
            timer.remainingSeconds = 0;
            timer.resume();
            expect(timer.isRunning).toBe(false);
        });
    });

    describe('reset', () => {
        it('should reset to initial value', () => {
            const timer = new Timer(10);
            timer.remainingSeconds = 3;
            timer.reset();
            expect(timer.remainingSeconds).toBe(10);
            expect(timer.isRunning).toBe(false);
        });

        it('should call onTick on reset', () => {
            const onTick = vi.fn();
            const timer = new Timer(10, onTick);
            timer.reset();
            expect(onTick).toHaveBeenCalledWith(10, 10);
        });
    });

    describe('getRemaining', () => {
        it('should return remaining seconds', () => {
            const timer = new Timer(10);
            timer.remainingSeconds = 7;
            expect(timer.getRemaining()).toBe(7);
        });
    });

    describe('getProgress', () => {
        it('should return progress as ratio', () => {
            const timer = new Timer(10);
            timer.remainingSeconds = 5;
            expect(timer.getProgress()).toBe(0.5);
        });

        it('should return 1 for 0 duration timer', () => {
            const timer = new Timer(0);
            expect(timer.getProgress()).toBe(1);
        });

        it('should return 1 for full time', () => {
            const timer = new Timer(10);
            expect(timer.getProgress()).toBe(1);
        });

        it('should return 0 for no time left', () => {
            const timer = new Timer(10);
            timer.remainingSeconds = 0;
            expect(timer.getProgress()).toBe(0);
        });
    });

    describe('isActive', () => {
        it('should return true if timer has duration', () => {
            const timer = new Timer(5);
            expect(timer.isActive()).toBe(true);
        });

        it('should return false if timer has no duration', () => {
            const timer = new Timer(0);
            expect(timer.isActive()).toBe(false);
        });
    });

    describe('formatTime', () => {
        it('should format time as string', () => {
            const timer = new Timer(10);
            timer.remainingSeconds = 5.7;
            expect(timer.formatTime()).toBe('6'); // Ceil
        });

        it('should format 0 as string', () => {
            const timer = new Timer(10);
            timer.remainingSeconds = 0;
            expect(timer.formatTime()).toBe('0');
        });
    });
});

