/**
 * Web MIDI Hardware Keyboard Adapter & Hook
 *
 * Implements Stage 4 Web MIDI integration:
 * - Detects browser Web MIDI API support (navigator.requestMIDIAccess)
 * - Automatically enumerates and binds to all connected MIDI input devices (USB/Bluetooth)
 * - Listens for dynamic device connection/disconnection state changes
 * - Forwards standard MIDI NoteOn (0x90) and NoteOff (0x80) events to KeyEventEngine
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export interface WebMidiDeviceInfo {
  id: string;
  name: string;
  manufacturer: string;
  state: string; // 'connected' | 'disconnected'
  connection: string; // 'open' | 'closed' | 'pending'
}

export interface WebMidiState {
  isSupported: boolean;
  devices: WebMidiDeviceInfo[];
  activeDevice: string | null;
  isConnected: boolean;
  error: string | null;
}

/**
 * Checks whether the current runtime environment supports Web MIDI.
 */
export function isWebMidiSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.requestMIDIAccess === 'function'
  );
}

/**
 * Standalone helper to set up Web MIDI listeners outside of React or in tests.
 */
export async function setupWebMidiListener(
  onMidiMessage: (event: { data: Uint8Array | number[] }) => void,
  onDevicesChange?: (devices: WebMidiDeviceInfo[]) => void
): Promise<(() => void) | null> {
  if (!isWebMidiSupported()) return null;

  try {
    const midiAccess = await navigator.requestMIDIAccess({ sysex: false });

    const getDeviceList = (): WebMidiDeviceInfo[] => {
      const list: WebMidiDeviceInfo[] = [];
      for (const input of midiAccess.inputs.values()) {
        list.push({
          id: input.id,
          name: input.name || `MIDI Input ${input.id}`,
          manufacturer: input.manufacturer || 'Generic',
          state: input.state,
          connection: input.connection,
        });
      }
      return list;
    };

    const attachInputs = () => {
      for (const input of midiAccess.inputs.values()) {
        input.onmidimessage = (e: MIDIMessageEvent) => {
          if (e.data) {
            onMidiMessage({ data: e.data });
          }
        };
      }
      onDevicesChange?.(getDeviceList());
    };

    // Attach to initially available inputs
    attachInputs();

    // Re-bind and notify when devices are hot-plugged or unplugged
    midiAccess.onstatechange = () => {
      attachInputs();
    };

    return () => {
      midiAccess.onstatechange = null;
      for (const input of midiAccess.inputs.values()) {
        input.onmidimessage = null;
      }
    };
  } catch (err) {
    console.warn('[WebMidi] Failed to request MIDI access:', err);
    return null;
  }
}

/**
 * React hook for seamless Web MIDI hardware integration in KeyboardToScoreModal.
 */
export function useWebMidi(
  onMidiMessage: (event: { data: Uint8Array | number[] }) => void,
  enabled: boolean = true
): WebMidiState {
  const [state, setState] = useState<WebMidiState>(() => ({
    isSupported: isWebMidiSupported(),
    devices: [],
    activeDevice: null,
    isConnected: false,
    error: null,
  }));

  const messageHandlerRef = useRef(onMidiMessage);
  useEffect(() => {
    messageHandlerRef.current = onMidiMessage;
  }, [onMidiMessage]);

  const handleMidiEvent = useCallback((event: { data: Uint8Array | number[] }) => {
    messageHandlerRef.current(event);
  }, []);

  useEffect(() => {
    if (!enabled || !isWebMidiSupported()) {
      return;
    }

    let isSubscribed = true;
    let cleanupFn: (() => void) | null = null;

    const initMidi = async () => {
      try {
        const cleanup = await setupWebMidiListener(
          event => {
            if (isSubscribed) {
              handleMidiEvent(event);
            }
          },
          devices => {
            if (isSubscribed) {
              const connected = devices.filter(d => d.state === 'connected');
              setState(prev => ({
                ...prev,
                devices,
                isConnected: connected.length > 0,
                activeDevice: connected[0]?.name || null,
                error: null,
              }));
            }
          }
        );

        if (isSubscribed) {
          cleanupFn = cleanup;
        } else if (cleanup) {
          cleanup();
        }
      } catch (err) {
        if (isSubscribed) {
          const msg = err instanceof Error ? err.message : String(err);
          setState(prev => ({
            ...prev,
            error: msg,
            isConnected: false,
          }));
        }
      }
    };

    void initMidi();

    return () => {
      isSubscribed = false;
      if (cleanupFn) {
        cleanupFn();
      }
    };
  }, [enabled, handleMidiEvent]);

  return state;
}
