'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getStoredChordEnabled,
  setStoredChordEnabled,
  getStoredBackingVolume,
  setStoredBackingVolume,
  STORAGE_KEYS,
} from '@/lib/storage';
import { audioEngine } from '@/lib/audioEngine';

export const CHORD_SETTINGS_EVENT = 'taigi_composer_chord_settings_change';

export function useChordPlayback() {
  const [chordEnabled, setChordEnabledState] = useState<boolean>(() => {
    return getStoredChordEnabled(true);
  });

  const [chordVolume, setChordVolumeState] = useState<number>(() => {
    return getStoredBackingVolume(0.6);
  });

  // Ensure AudioEngine options stay synchronized initially
  useEffect(() => {
    audioEngine.setOptions({
      chordEnabled,
      backingVolume: chordVolume,
    });
  }, [chordEnabled, chordVolume]);

  const updateChordEnabled = useCallback((enabled: boolean) => {
    setChordEnabledState(enabled);
    setStoredChordEnabled(enabled);
    audioEngine.setOptions({ chordEnabled: enabled });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(CHORD_SETTINGS_EVENT, {
          detail: { chordEnabled: enabled, chordVolume },
        })
      );
    }
  }, [chordVolume]);

  const toggleChordEnabled = useCallback(() => {
    updateChordEnabled(!chordEnabled);
  }, [chordEnabled, updateChordEnabled]);

  const updateChordVolume = useCallback((vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    setChordVolumeState(clamped);
    setStoredBackingVolume(clamped);
    audioEngine.setOptions({ backingVolume: clamped });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(CHORD_SETTINGS_EVENT, {
          detail: { chordEnabled, chordVolume: clamped },
        })
      );
    }
  }, [chordEnabled]);

  // Synchronize across components in the same window and across browser tabs
  useEffect(() => {
    const handleCustomChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ chordEnabled?: boolean; chordVolume?: number }>;
      if (customEvent.detail) {
        if (typeof customEvent.detail.chordEnabled === 'boolean') {
          setChordEnabledState(customEvent.detail.chordEnabled);
        }
        if (typeof customEvent.detail.chordVolume === 'number') {
          setChordVolumeState(customEvent.detail.chordVolume);
        }
      }
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.CHORD_ENABLED && e.newValue !== null) {
        const enabled = e.newValue === 'true';
        setChordEnabledState(enabled);
        audioEngine.setOptions({ chordEnabled: enabled });
      } else if (e.key === STORAGE_KEYS.BACKING_VOLUME && e.newValue !== null) {
        const num = parseFloat(e.newValue);
        if (!isNaN(num)) {
          setChordVolumeState(num);
          audioEngine.setOptions({ backingVolume: num });
        }
      }
    };

    window.addEventListener(CHORD_SETTINGS_EVENT, handleCustomChange);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(CHORD_SETTINGS_EVENT, handleCustomChange);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  return {
    chordEnabled,
    chordVolume,
    setChordEnabled: updateChordEnabled,
    toggleChordEnabled,
    setChordVolume: updateChordVolume,
  };
}
