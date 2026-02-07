/**
 * Timer - Move timer for timed games
 */

export const TIMER_PRESETS: { readonly HARD: number; readonly MEDIUM: number; readonly EASY: number; readonly RELAXED: number; readonly NONE: number } = {
  HARD: 3,
  MEDIUM: 5,
  EASY: 10,
  RELAXED: 15,
  NONE: 0
} as const;

export class Timer {
  private initialSeconds: number;
  private remainingSeconds: number;
  private isRunning: boolean;
  private intervalId: ReturnType<typeof setInterval> | null;
  private onTick: ((remaining: number, total: number) => void) | null;
  private onTimeout: (() => void) | null;
  private lastTickTime: number | null;

  constructor(
    seconds: number = 0,
    onTick: ((remaining: number, total: number) => void) | null = null,
    onTimeout: (() => void) | null = null
  ) {
    this.initialSeconds = seconds;
    this.remainingSeconds = seconds;
    this.isRunning = false;
    this.intervalId = null;
    this.onTick = onTick;
    this.onTimeout = onTimeout;
    this.lastTickTime = null;
  }

  setDuration(seconds: number): void {
    this.initialSeconds = seconds;
    this.remainingSeconds = seconds;
  }

  start(): void {
    this.stop();

    if (this.initialSeconds <= 0) return;

    this.remainingSeconds = this.initialSeconds;
    this.isRunning = true;
    this.lastTickTime = Date.now();

    this.tick();

    this.intervalId = setInterval((): void => {
      this.updateTime();
    }, 250);

    if (this.onTick) {
      this.onTick(this.remainingSeconds, this.initialSeconds);
    }
  }

  private tick(): void {
    if (!this.isRunning) return;

    this.updateTime();

    if (this.isRunning) {
      requestAnimationFrame((): void => this.tick());
    }
  }

  private updateTime(): void {
    if (!this.isRunning || this.lastTickTime === null) return;

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

  stop(): void {
    this.isRunning = false;
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  pause(): void {
    this.isRunning = false;
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  resume(): void {
    if (this.remainingSeconds > 0 && !this.isRunning) {
      this.isRunning = true;
      this.lastTickTime = Date.now();
      this.tick();
      this.intervalId = setInterval((): void => {
        this.updateTime();
      }, 250);
    }
  }

  reset(): void {
    this.stop();
    this.remainingSeconds = this.initialSeconds;
    if (this.onTick) {
      this.onTick(this.remainingSeconds, this.initialSeconds);
    }
  }

  getRemaining(): number {
    return this.remainingSeconds;
  }

  getProgress(): number {
    if (this.initialSeconds <= 0) return 1;
    return this.remainingSeconds / this.initialSeconds;
  }

  isActive(): boolean {
    return this.initialSeconds > 0;
  }

  formatTime(): string {
    const seconds = Math.ceil(this.remainingSeconds);
    return seconds.toString();
  }
}
