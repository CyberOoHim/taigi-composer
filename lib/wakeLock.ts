/**
 * Screen Wake Lock Manager
 * Keeps the screen awake during active karaoke playback, and automatically
 * releases the wake lock when paused, stopped, finished, or when the tab is hidden.
 */

class WakeLockManager {
  private sentinel: WakeLockSentinel | null = null;
  private isRequested = false;
  private isSupported = typeof window !== 'undefined' && 'wakeLock' in navigator;

  constructor() {
    if (typeof window !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }

  private handleVisibilityChange = async () => {
    if (document.hidden) {
      // Release wake lock when tab is hidden or device locked
      if (this.sentinel) {
        try {
          await this.sentinel.release();
        } catch {
          // ignore
        }
        this.sentinel = null;
      }
    } else {
      // Re-acquire wake lock if playback is still active and tab becomes visible again
      if (this.isRequested && !this.sentinel) {
        await this.acquire();
      }
    }
  };

  /**
   * Request screen wake lock for playback
   */
  public async request(): Promise<boolean> {
    this.isRequested = true;
    return this.acquire();
  }

  private async acquire(): Promise<boolean> {
    if (!this.isSupported || typeof navigator === 'undefined' || !navigator.wakeLock) {
      return false;
    }

    try {
      if (this.sentinel && !this.sentinel.released) {
        return true;
      }

      this.sentinel = await navigator.wakeLock.request('screen');
      this.sentinel.addEventListener('release', () => {
        this.sentinel = null;
      });
      return true;
    } catch {
      // Wake lock request may be denied or not allowed (e.g. low battery / background)
      this.sentinel = null;
      return false;
    }
  }

  /**
   * Release screen wake lock immediately
   */
  public async release(): Promise<void> {
    this.isRequested = false;
    if (this.sentinel) {
      try {
        await this.sentinel.release();
      } catch {
        // ignore
      }
      this.sentinel = null;
    }
  }

  public getIsActive(): boolean {
    return Boolean(this.sentinel && !this.sentinel.released);
  }
}

export const wakeLockManager = new WakeLockManager();
