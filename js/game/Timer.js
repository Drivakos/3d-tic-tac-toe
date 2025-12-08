/**
 * Timer - Move timer for timed games
 */

export const TIMER_PRESETS = {
    HARD: 3,
    MEDIUM: 5,
    EASY: 10,
    RELAXED: 15,
    NONE: 0
};

export class Timer {
    constructor(seconds = 0, onTick = null, onTimeout = null) {
        this.initialSeconds = seconds;
        this.remainingSeconds = seconds;
        this.isRunning = false;
        this.intervalId = null;
        this.onTick = onTick;
        this.onTimeout = onTimeout;
        this.lastTickTime = null;
    }

    /**
     * Set the timer duration
     * @param {number} seconds
     */
    setDuration(seconds) {
        this.initialSeconds = seconds;
        this.remainingSeconds = seconds;
    }

    /**
     * Start or restart the timer
     */
    start() {
        this.stop();
        
        if (this.initialSeconds <= 0) return;
        
        this.remainingSeconds = this.initialSeconds;
        this.isRunning = true;
        this.lastTickTime = Date.now();
        
        // Use requestAnimationFrame for smoother updates
        this.tick();
        
        // Also use interval as backup for when tab is inactive
        this.intervalId = setInterval(() => {
            this.updateTime();
        }, 100);
        
        if (this.onTick) {
            this.onTick(this.remainingSeconds, this.initialSeconds);
        }
    }

    /**
     * Internal tick using requestAnimationFrame
     */
    tick() {
        if (!this.isRunning) return;
        
        this.updateTime();
        
        if (this.isRunning) {
            requestAnimationFrame(() => this.tick());
        }
    }

    /**
     * Update remaining time
     */
    updateTime() {
        if (!this.isRunning) return;
        
        const now = Date.now();
        const elapsed = (now - this.lastTickTime) / 1000;
        this.lastTickTime = now;
        
        this.remainingSeconds = Math.max(0, this.remainingSeconds - elapsed);
        
        if (this.onTick) {
            this.onTick(this.remainingSeconds, this.initialSeconds);
        }
        
        if (this.remainingSeconds <= 0) {
            this.isRunning = false;
            this.stop();
            if (this.onTimeout) {
                this.onTimeout();
            }
        }
    }

    /**
     * Stop the timer
     */
    stop() {
        this.isRunning = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    /**
     * Pause the timer
     */
    pause() {
        this.isRunning = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    /**
     * Resume the timer
     */
    resume() {
        if (this.remainingSeconds > 0 && !this.isRunning) {
            this.isRunning = true;
            this.lastTickTime = Date.now();
            this.tick();
            this.intervalId = setInterval(() => {
                this.updateTime();
            }, 100);
        }
    }

    /**
     * Reset timer to initial value without starting
     */
    reset() {
        this.stop();
        this.remainingSeconds = this.initialSeconds;
        if (this.onTick) {
            this.onTick(this.remainingSeconds, this.initialSeconds);
        }
    }

    /**
     * Get remaining time
     * @returns {number}
     */
    getRemaining() {
        return this.remainingSeconds;
    }

    /**
     * Get progress (0-1)
     * @returns {number}
     */
    getProgress() {
        if (this.initialSeconds <= 0) return 1;
        return this.remainingSeconds / this.initialSeconds;
    }

    /**
     * Check if timer is active (has duration set)
     * @returns {boolean}
     */
    isActive() {
        return this.initialSeconds > 0;
    }

    /**
     * Format remaining time as string
     * @returns {string}
     */
    formatTime() {
        const seconds = Math.ceil(this.remainingSeconds);
        return seconds.toString();
    }
}

