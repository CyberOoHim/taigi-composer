'use client';

import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { supportsBatteryApi } from '@/lib/device';

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
const ECO_MODE_EVENT = 'taigi_composer_eco_mode_change';

function getEcoModeSnapshot(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) {
      return saved === 'true';
    }
    // Reduced motion only gates animations — it must not skip wake lock / enable eco.
    return false;
  } catch {
    return false;
  }
}

function getEcoModeServerSnapshot(): boolean {
  return false;
}

function subscribeEcoMode(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener(ECO_MODE_EVENT, callback);

  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(ECO_MODE_EVENT, callback);
  };
}

export function usePowerSaveMode() {
  const isEcoMode = useSyncExternalStore(
    subscribeEcoMode,
    getEcoModeSnapshot,
    getEcoModeServerSnapshot
  );

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

  const setEcoMode = useCallback((val: boolean) => {
    try {
      localStorage.setItem(STORAGE_KEY, String(val));
      window.dispatchEvent(new Event(ECO_MODE_EVENT));
    } catch {
      // ignore
    }
  }, []);

  const toggleEcoMode = useCallback(() => {
    const current = getEcoModeSnapshot();
    setEcoMode(!current);
  }, [setEcoMode]);

  // Battery status listener
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const nav = navigator as NavigatorWithBattery;
    // Battery Status API is Chromium-only; iPadOS Safari never exposes getBattery().
    if (supportsBatteryApi() && typeof nav.getBattery === 'function') {
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
          setEcoMode(true);
        }

        handleLevelChange = () => {
          if (!isMounted) return;
          setBatteryLevel(battery.level);
          let savedPref: string | null = null;
          try { savedPref = localStorage.getItem(STORAGE_KEY); } catch { /* storage blocked */ }
          if (savedPref === null && battery.level <= 0.2 && !battery.charging) {
            setEcoMode(true);
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
  }, [setEcoMode]);

  return {
    isEcoMode,
    toggleEcoMode,
    setEcoMode,
    batteryLevel,
    isCharging,
    isLowBattery: batteryLevel !== null && batteryLevel <= 0.2 && !isCharging,
    batterySupported: supportsBatteryApi(),
  };
}
