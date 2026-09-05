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
export function safeGetItem(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(key);
  } catch (err) {
    console.warn(`[storage] Failed to read key "${key}":`, err);
    return null;
  }
}

/**
 * Safe local storage setter with boolean success status
 */
export function safeSetItem(key: string, value: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    console.error(`[storage] Storage quota exceeded or blocked for key "${key}":`, err);
    return false;
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
  if (val === 'poj_only' || val === 'tl_only') return 'roman';
  if (val === 'hanji_only' || val === 'custom_only') return 'hanlo';
  if (val === 'hanji_poj') return 'hanlo_major_roman';
  if (val === 'all' || val === 'hanji_tl' || val === 'hanji_pij') return 'roman_major_hanlo';

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
        // If the stored song is preset 'u-ia-hoe' but still has old 2/4 durations (duration < 0.5 on first note), refresh to updated preset
        if (parsed.id === 'u-ia-hoe') {
          const firstPitchedNote = parsed.measures[0]?.notes?.find(
            (n: any) => typeof n.pitch === 'number' && n.pitch > 0
          );
          if (firstPitchedNote && typeof firstPitchedNote.duration === 'number' && firstPitchedNote.duration < 0.5) {
            return PRESET_SONGS[0];
          }
        }

        const song = parsed as Song;
        song.measures.forEach(m => {
          if (Array.isArray(m.notes)) {
            m.notes.forEach(n => {
              if (n && n.lyric) {
                if (!n.lyric.poj && n.lyric.tl) n.lyric.poj = n.lyric.tl;
                if (!n.lyric.hanlo) {
                  n.lyric.hanlo = n.lyric.custom || n.lyric.hanji || '';
                }
              }
            });
          }
        });
        return song;
      }
    } catch {
      // JSON parse error, fallback
    }
  }
  return PRESET_SONGS[0];
}

export function setStoredCurrentSong(song: Song): boolean {
  try {
    return safeSetItem(STORAGE_KEYS.CURRENT_SONG, JSON.stringify(song));
  } catch {
    return false;
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

export function setStoredCustomLibrary(songs: Song[]): boolean {
  try {
    return safeSetItem(STORAGE_KEYS.CUSTOM_LIBRARY, JSON.stringify(songs));
  } catch (err) {
    console.error('[storage] Failed to serialize custom library:', err);
    return false;
  }
}

export interface SaveSongResult {
  success: boolean;
  library: Song[];
  error?: string;
}

export function saveSongToCustomLibraryWithResult(song: Song): SaveSongResult {
  const library = getStoredCustomLibrary();
  const existingIdx = library.findIndex(s => s.id === song.id);
  let updated: Song[];
  if (existingIdx !== -1) {
    updated = [...library];
    updated[existingIdx] = song;
  } else {
    updated = [song, ...library];
  }
  const success = setStoredCustomLibrary(updated);
  return {
    success,
    library: success ? updated : library,
    error: success ? undefined : '儲存失敗：本機儲存空間（localStorage）已滿，請清理或改用 JSON 匯出備份。',
  };
}

export function saveSongToCustomLibrary(song: Song): Song[] {
  const res = saveSongToCustomLibraryWithResult(song);
  return res.library;
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
