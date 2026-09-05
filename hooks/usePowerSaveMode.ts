'use client';

import { useState, useEffect, useCallback } from 'react';

interface BatteryManager extends EventTarget {
  charging: boolean;
  chargingTime: number;
  dischargingTime: number;
  level: number;
  onchargingchange: ((this: BatteryManager, ev: Event) => unknown) | null;
  onlevelchange: ((this: BatteryManager, ev: Event) => unknown) | null;
}

interface NavigatorWithBattery extends Navigator {
  getBattery?: () => Promise<BatteryManager>;
}

const STORAGE_KEY = 'taigi_composer_power_save_mode';

export function usePowerSaveMode() {
  const [isEcoMode, setIsEcoMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved !== null) {
        return saved === 'true';
      }
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return true;
      }
      const ua = navigator.userAgent || '';
      return (
        /iPad|iPhone|iPod/.test(ua) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
      );
    } catch {
      return false;
    }
  });

  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [isCharging, setIsCharging] = useState<boolean | null>(null);

  // Synchronize .eco-mode class on document element
  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (isEcoMode) {
        document.documentElement.classList.add('eco-mode');
      } else {
        document.documentElement.classList.remove('eco-mode');
      }
    }
  }, [isEcoMode]);

  // Battery status listener
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const nav = navigator as NavigatorWithBattery;
    if (typeof nav.getBattery === 'function') {
      let isMounted = true;
      let batteryRef: BatteryManager | null = null;
      let handleLevelChange: (() => void) | null = null;
      let handleChargingChange: (() => void) | null = null;

      nav.getBattery().then(battery => {
        if (!isMounted) return;
        batteryRef = battery;
        setBatteryLevel(battery.level);
        setIsCharging(battery.charging);

        // If battery is low (<= 20%) and not charging, and no explicit preference is set, suggest/enable eco mode
        let saved: string | null = null;
        try { saved = localStorage.getItem(STORAGE_KEY); } catch { /* storage blocked */ }
        if (saved === null && battery.level <= 0.2 && !battery.charging) {
          setIsEcoMode(true);
        }

        handleLevelChange = () => {
          if (!isMounted) return;
          setBatteryLevel(battery.level);
          let savedPref: string | null = null;
          try { savedPref = localStorage.getItem(STORAGE_KEY); } catch { /* storage blocked */ }
          if (savedPref === null && battery.level <= 0.2 && !battery.charging) {
            setIsEcoMode(true);
          }
        };

        handleChargingChange = () => {
          if (!isMounted) return;
          setIsCharging(battery.charging);
        };

        battery.addEventListener('levelchange', handleLevelChange);
        battery.addEventListener('chargingchange', handleChargingChange);
      }).catch(() => {
        // Battery API not supported or permissions blocked
      });

      return () => {
        isMounted = false;
        if (batteryRef) {
          if (handleLevelChange) batteryRef.removeEventListener('levelchange', handleLevelChange);
          if (handleChargingChange) batteryRef.removeEventListener('chargingchange', handleChargingChange);
        }
      };
    }
  }, []);

  // Listen to prefers-reduced-motion changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const handleChange = (e: MediaQueryListEvent) => {
      let saved: string | null = null;
      try { saved = localStorage.getItem(STORAGE_KEY); } catch { /* storage blocked */ }
      if (saved === null) {
        setIsEcoMode(e.matches);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const toggleEcoMode = useCallback(() => {
    setIsEcoMode(prev => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, []);

  const setEcoMode = useCallback((val: boolean) => {
    setIsEcoMode(val);
    try {
      localStorage.setItem(STORAGE_KEY, String(val));
    } catch {
      // ignore
    }
  }, []);

  return {
    isEcoMode,
    toggleEcoMode,
    setEcoMode,
    batteryLevel,
    isCharging,
    isLowBattery: batteryLevel !== null && batteryLevel <= 0.2 && !isCharging,
  };
}
