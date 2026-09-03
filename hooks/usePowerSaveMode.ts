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
      // Default to true if user preferred reduced motion
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
      let batteryRef: BatteryManager | null = null;
      let handleLevelChange: (() => void) | null = null;
      let handleChargingChange: (() => void) | null = null;

      nav.getBattery().then(battery => {
        batteryRef = battery;
        setBatteryLevel(battery.level);
        setIsCharging(battery.charging);

        // If battery is low (<= 20%) and not charging, and no explicit preference is set, suggest/enable eco mode
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved === null && battery.level <= 0.2 && !battery.charging) {
          setIsEcoMode(true);
        }

        handleLevelChange = () => {
          setBatteryLevel(battery.level);
          if (localStorage.getItem(STORAGE_KEY) === null && battery.level <= 0.2 && !battery.charging) {
            setIsEcoMode(true);
          }
        };

        handleChargingChange = () => {
          setIsCharging(battery.charging);
        };

        battery.addEventListener('levelchange', handleLevelChange);
        battery.addEventListener('chargingchange', handleChargingChange);
      }).catch(() => {
        // Battery API not supported or permissions blocked
      });

      return () => {
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
      const saved = localStorage.getItem(STORAGE_KEY);
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
