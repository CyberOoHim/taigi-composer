/**
 * Screen Wake Lock Manager
 * Keeps the screen awake during active karaoke playback, and automatically
 * releases the wake lock when paused, stopped, finished, or when the tab is hidden.
 */

class WakeLockManager {
  private sentinel: WakeLockSentinel | null = null;
  private isRequested = false;
  private isSupported = typeof window !== 'undefined' && 'wakeLock' in navigator;
  private reacquireTimer: NodeJS.Timeout | null = null;
  private activeRequest: Promise<boolean> | null = null;

  constructor() {
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
      window.addEventListener('pageshow', this.handlePageShow);
      window.addEventListener('focus', this.handleFocus);
    }
  }

  private handleVisibilityChange = async () => {
    if (document.hidden) {
      // Clear pending acquire attempts
      if (this.reacquireTimer) {
        clearTimeout(this.reacquireTimer);
        this.reacquireTimer = null;
      }
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
      this.scheduleReacquire();
    }
  };

  private handlePageShow = () => {
    if (!document.hidden && this.isRequested && !this.sentinel) {
      this.scheduleReacquire();
    }
  };

  private handleFocus = () => {
    if (!document.hidden && this.isRequested && !this.sentinel) {
      this.scheduleReacquire();
    }
  };

  private scheduleReacquire() {
    if (!this.isRequested || this.sentinel) return;
    if (this.reacquireTimer) clearTimeout(this.reacquireTimer);

    // On iPad / iOS Safari, requesting wakeLock immediately in visibilitychange often fails
    // because the document is not marked as active yet. A small delay ensures success.
    this.reacquireTimer = setTimeout(() => {
      this.reacquireTimer = null;
      if (this.isRequested && !this.sentinel && !document.hidden) {
        this.acquire().catch(() => {});
      }
    }, 250);
  }

  /**
   * Request screen wake lock for playback.
   * Skip when eco mode is on so iOS can dim/sleep the panel.
   */
  public async requestForPlayback(ecoMode: boolean): Promise<boolean> {
    if (ecoMode) {
      await this.release();
      return false;
    }
    return this.request();
  }

  public async request(): Promise<boolean> {
    this.isRequested = true;
    return this.acquire();
  }

  private async acquire(): Promise<boolean> {
    if (!this.isSupported || typeof navigator === 'undefined' || !navigator.wakeLock) {
      return false;
    }

    if (this.sentinel && !this.sentinel.released) {
      return true;
    }

    if (this.activeRequest) {
      return this.activeRequest;
    }

    this.activeRequest = (async () => {
      try {
        if (typeof document !== 'undefined' && document.hidden) {
          return false;
        }

        const sentinel = await navigator.wakeLock.request('screen');
        if (!this.isRequested) {
          // Was released while request was resolving
          await sentinel.release().catch(() => {});
          return false;
        }

        if (this.sentinel && this.sentinel !== sentinel) {
          await this.sentinel.release().catch(() => {});
        }

        this.sentinel = sentinel;
        this.sentinel.addEventListener('release', () => {
          if (this.sentinel === sentinel) {
            this.sentinel = null;
          }
        });
        return true;
      } catch {
        return false;
      } finally {
        this.activeRequest = null;
      }
    })();

    return this.activeRequest;
  }

  /**
   * Release screen wake lock immediately
   */
  public async release(): Promise<void> {
    this.isRequested = false;
    if (this.reacquireTimer) {
      clearTimeout(this.reacquireTimer);
      this.reacquireTimer = null;
    }
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
