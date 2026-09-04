'use client';

import { Song, LyricDisplayMode, InstrumentType, EditorEditMode, Measure, JianpuNote } from '@/types/song';
import { PRESET_SONGS } from '@/lib/presets';

export const STORAGE_KEYS = {
  ACTIVE_TAB: 'taigi_composer_active_tab',
  LYRIC_DISPLAY_MODE: 'taigi_composer_lyric_display_mode',
  CURRENT_SONG: 'taigi_composer_current_song',
  CUSTOM_LIBRARY: 'taigi_composer_custom_library',
  POWER_SAVE_MODE: 'taigi_composer_power_save_mode',
  INSTRUMENT: 'taigi_composer_instrument',
  MELODY_VOLUME: 'taigi_composer_melody_volume',
  BACKING_VOLUME: 'taigi_composer_backing_volume',
  METRONOME_VOLUME: 'taigi_composer_metronome_volume',
  TRANSPOSE: 'taigi_composer_transpose',
  TEMPO_MULTIPLIER: 'taigi_composer_tempo_multiplier',
  SHOW_MIXER: 'taigi_composer_show_mixer',
  STAGE_MODE_ZOOM: 'taigi_composer_stage_zoom',
  KARAOKE_LEAD_IN_ENABLED: 'taigi_karaoke_lead_in_enabled',
  EDITOR_EDIT_MODE: 'taigi_composer_editor_edit_mode',
  AUTO_STEP_ADVANCE: 'taigi_composer_auto_step_advance',
  DECK_TAB: 'taigi_composer_deck_tab',
  GEMINI_AUTH_VERIFIED: 'taigi_gemini_auth_verified',
  GEMINI_AUTH_PASSCODE: 'taigi_gemini_auth_passcode',
  GEMINI_MODEL: 'taigi_gemini_model',
  GEMINI_THINKING_EFFORT: 'taigi_gemini_thinking_effort',
} as const;

export type ActiveTabMode = 'karaoke' | 'editor' | 'split';
export type DeckTabMode = 'numpad' | 'piano' | 'ornaments' | 'lyrics';

/**
 * Safe local storage getter with fallback
 */
function safeGetItem(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Safe local storage setter
 */
function safeSetItem(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore quota/privacy errors
  }
}

// ============================================================================
// 1. ACTIVE VIEW TAB (Default: 'split')
// ============================================================================
export function getStoredActiveTab(): ActiveTabMode {
  const val = safeGetItem(STORAGE_KEYS.ACTIVE_TAB);
  if (val === 'split' || val === 'karaoke' || val === 'editor') {
    return val;
  }
  return 'split'; // Default to split view
}

export function setStoredActiveTab(tab: ActiveTabMode): void {
  safeSetItem(STORAGE_KEYS.ACTIVE_TAB, tab);
}

// ============================================================================
// 2. LYRIC DISPLAY MODE (Default: 'roman_major_hanlo')
// ============================================================================
export function getStoredDisplayMode(): LyricDisplayMode {
  const val = safeGetItem(STORAGE_KEYS.LYRIC_DISPLAY_MODE);
  if (val === 'roman' || val === 'hanlo' || val === 'roman_major_hanlo' || val === 'hanlo_major_roman') {
    return val;
  }
  // Migration support for legacy stored preferences:
  if (val === 'poj_only' || val === 'pij_only') return 'roman';
  if (val === 'hanji_only' || val === 'custom_only') return 'hanlo';
  if (val === 'hanji_poj') return 'hanlo_major_roman';
  if (val === 'all' || val === 'hanji_pij') return 'roman_major_hanlo';

  return 'roman_major_hanlo';
}

export function setStoredDisplayMode(mode: LyricDisplayMode): void {
  safeSetItem(STORAGE_KEYS.LYRIC_DISPLAY_MODE, mode);
}

// ============================================================================
// 3. CURRENT ACTIVE SONG (Default: PRESET_SONGS[0])
// ============================================================================
export function getStoredCurrentSong(): Song {
  const raw = safeGetItem(STORAGE_KEYS.CURRENT_SONG);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.id && Array.isArray(parsed.measures) && parsed.measures.length > 0) {
        // If the user had the previous default ('bang-chhun-hong') or old/dirty 'u-ia-hoe',
        // refresh to the new cleaned default 'u-ia-hoe' (key 'Bb').
        const hasDirtyPunct =
          parsed.id === 'u-ia-hoe' &&
          (parsed.subtitle?.includes('范炎燁') ||
            parsed.measures.some((m: Measure) =>
              m.notes?.some(
                (n: JianpuNote) =>
                  n.lyric?.hanji === '—' || n.lyric?.hanji === '，' || n.lyric?.hanji === '。'
              )
            ));

        if (
          parsed.id === 'bang-chhun-hong' ||
          parsed.id === 'ai-pian-tsiah-e-iann' ||
          parsed.id === 'blank-composer' ||
          (parsed.id === 'u-ia-hoe' && (parsed.key !== 'Bb' || parsed.measures.length !== 32 || hasDirtyPunct))
        ) {
          setStoredCurrentSong(PRESET_SONGS[0]);
          return PRESET_SONGS[0];
        }
        return parsed as Song;
      }
    } catch {
      // JSON parse error, fallback
    }
  }
  return PRESET_SONGS[0];
}

export function setStoredCurrentSong(song: Song): void {
  try {
    safeSetItem(STORAGE_KEYS.CURRENT_SONG, JSON.stringify(song));
  } catch {
    // ignore storage limit error
  }
}

// ============================================================================
// 4. CUSTOM SONG LIBRARY (User-saved songs)
// ============================================================================
export function getStoredCustomLibrary(): Song[] {
  const raw = safeGetItem(STORAGE_KEYS.CUSTOM_LIBRARY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed as Song[];
      }
    } catch {
      // ignore
    }
  }
  return [];
}

export function setStoredCustomLibrary(songs: Song[]): void {
  try {
    safeSetItem(STORAGE_KEYS.CUSTOM_LIBRARY, JSON.stringify(songs));
  } catch {
    // ignore
  }
}

export function saveSongToCustomLibrary(song: Song): Song[] {
  const library = getStoredCustomLibrary();
  const existingIdx = library.findIndex(s => s.id === song.id);
  let updated: Song[];
  if (existingIdx !== -1) {
    updated = [...library];
    updated[existingIdx] = song;
  } else {
    updated = [song, ...library];
  }
  setStoredCustomLibrary(updated);
  return updated;
}

export function deleteSongFromCustomLibrary(songId: string): Song[] {
  const library = getStoredCustomLibrary();
  const updated = library.filter(s => s.id !== songId);
  setStoredCustomLibrary(updated);
  return updated;
}

// ============================================================================
// 5. AUDIO / KARAOKE CONTROLS
// ============================================================================
export function getStoredInstrument(): InstrumentType {
  const val = safeGetItem(STORAGE_KEYS.INSTRUMENT);
  if (val === 'piano' || val === 'flute' || val === 'whistle' || val === 'guitar' || val === 'synth' || val === 'bell') {
    return val;
  }
  return 'piano';
}

export function setStoredInstrument(inst: InstrumentType): void {
  safeSetItem(STORAGE_KEYS.INSTRUMENT, inst);
}

export function getStoredMelodyVolume(defaultVal = 0.85): number {
  const val = safeGetItem(STORAGE_KEYS.MELODY_VOLUME);
  if (val !== null) {
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0 && num <= 1) return num;
  }
  return defaultVal;
}

export function setStoredMelodyVolume(vol: number): void {
  safeSetItem(STORAGE_KEYS.MELODY_VOLUME, String(vol));
}

export function getStoredBackingVolume(defaultVal = 0.5): number {
  const val = safeGetItem(STORAGE_KEYS.BACKING_VOLUME);
  if (val !== null) {
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0 && num <= 1) return num;
  }
  return defaultVal;
}

export function setStoredBackingVolume(vol: number): void {
  safeSetItem(STORAGE_KEYS.BACKING_VOLUME, String(vol));
}

export function getStoredMetronomeVolume(defaultVal = 0.15): number {
  const val = safeGetItem(STORAGE_KEYS.METRONOME_VOLUME);
  if (val !== null) {
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0 && num <= 1) return num;
  }
  return defaultVal;
}

export function setStoredMetronomeVolume(vol: number): void {
  safeSetItem(STORAGE_KEYS.METRONOME_VOLUME, String(vol));
}

export function getStoredTranspose(defaultVal = 0): number {
  const val = safeGetItem(STORAGE_KEYS.TRANSPOSE);
  if (val !== null) {
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= -12 && num <= 12) return num;
  }
  return defaultVal;
}

export function setStoredTranspose(transpose: number): void {
  safeSetItem(STORAGE_KEYS.TRANSPOSE, String(transpose));
}

export function getStoredTempoMultiplier(defaultVal = 1.0): number {
  const val = safeGetItem(STORAGE_KEYS.TEMPO_MULTIPLIER);
  if (val !== null) {
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0.5 && num <= 2.0) return num;
  }
  return defaultVal;
}

export function setStoredTempoMultiplier(mul: number): void {
  safeSetItem(STORAGE_KEYS.TEMPO_MULTIPLIER, String(mul));
}

export function getStoredShowMixer(defaultVal = false): boolean {
  const val = safeGetItem(STORAGE_KEYS.SHOW_MIXER);
  if (val !== null) return val === 'true';
  return defaultVal;
}

export function setStoredShowMixer(show: boolean): void {
  safeSetItem(STORAGE_KEYS.SHOW_MIXER, String(show));
}

export function getStoredStageZoom(defaultVal = 1.0): number {
  const val = safeGetItem(STORAGE_KEYS.STAGE_MODE_ZOOM);
  if (val !== null) {
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 1.0 && num <= 2.0) return num;
  }
  return defaultVal;
}

export function setStoredStageZoom(zoom: number): void {
  safeSetItem(STORAGE_KEYS.STAGE_MODE_ZOOM, String(zoom));
}

// ============================================================================
// 6. COMPOSER EDITOR SETTINGS
// ============================================================================
export function getStoredEditorEditMode(): EditorEditMode {
  const val = safeGetItem(STORAGE_KEYS.EDITOR_EDIT_MODE);
  if (val === 'verse' || val === 'measure') return val;
  return 'verse';
}

export function setStoredEditorEditMode(mode: EditorEditMode): void {
  safeSetItem(STORAGE_KEYS.EDITOR_EDIT_MODE, mode);
}

export function getStoredAutoStepAdvance(defaultVal = false): boolean {
  const val = safeGetItem(STORAGE_KEYS.AUTO_STEP_ADVANCE);
  if (val !== null) return val === 'true';
  return defaultVal;
}

export function setStoredAutoStepAdvance(advance: boolean): void {
  safeSetItem(STORAGE_KEYS.AUTO_STEP_ADVANCE, String(advance));
}

export function getStoredDeckTab(): DeckTabMode {
  const val = safeGetItem(STORAGE_KEYS.DECK_TAB);
  if (val === 'numpad' || val === 'piano' || val === 'ornaments' || val === 'lyrics') return val;
  return 'numpad';
}

export function setStoredDeckTab(tab: DeckTabMode): void {
  safeSetItem(STORAGE_KEYS.DECK_TAB, tab);
}

export function getStoredLeadInEnabled(defaultVal = true): boolean {
  const val = safeGetItem(STORAGE_KEYS.KARAOKE_LEAD_IN_ENABLED);
  if (val !== null) return val === 'true';
  return defaultVal;
}

export function setStoredLeadInEnabled(enabled: boolean): void {
  safeSetItem(STORAGE_KEYS.KARAOKE_LEAD_IN_ENABLED, String(enabled));
}
