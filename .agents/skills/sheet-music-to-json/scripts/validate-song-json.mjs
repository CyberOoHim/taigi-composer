#!/usr/bin/env node

/**
 * validate-song-json.mjs
 * 
 * Verifies that a generated Song JSON file is 100% compliant with the
 * Taigi Composer / Karaoke application before importing.
 * 
 * Usage:
 *   node validate-song-json.mjs <path-to-song.json>
 */

import fs from 'node:fs';
import path from 'node:path';

const VALID_KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const VALID_TIME_SIGS = ['4/4', '3/4', '2/4', '6/8'];

function getExpectedBeats(timeSignature) {
  const [num, den] = (timeSignature || '4/4').split('/').map(Number);
  return (num || 4) * (4 / (den || 4));
}

function validateSongFile(filePath) {
  console.log(`\n🔍 Validating Song JSON: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    console.error(`❌ Error: File not found at ${filePath}`);
    process.exit(1);
  }

  let data;
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    data = JSON.parse(raw);
  } catch (err) {
    console.error(`❌ Error: Invalid JSON syntax:`, err.message);
    process.exit(1);
  }

  const errors = [];
  const warnings = [];

  // Root fields validation
  if (!data.id || typeof data.id !== 'string') errors.push('Missing or invalid root "id" (string required)');
  if (!data.title || typeof data.title !== 'string') errors.push('Missing or invalid root "title" (string required)');
  if (!VALID_KEYS.includes(data.key)) errors.push(`Invalid root "key": "${data.key}". Expected one of: ${VALID_KEYS.join(', ')}`);
  if (!VALID_TIME_SIGS.includes(data.timeSignature)) errors.push(`Invalid root "timeSignature": "${data.timeSignature}". Expected one of: ${VALID_TIME_SIGS.join(', ')}`);
  if (typeof data.bpm !== 'number' || data.bpm <= 0) errors.push(`Invalid root "bpm": ${data.bpm}. Expected a positive number`);
  if (!Array.isArray(data.measures) || data.measures.length === 0) errors.push('Missing or empty root "measures" array');

  if (errors.length > 0) {
    console.error('\n❌ Critical Schema Errors Found:');
    errors.forEach(e => console.error(`   - ${e}`));
    process.exit(1);
  }

  const expectedBeats = getExpectedBeats(data.timeSignature);
  let totalNotes = 0;
  let totalLyrics = 0;
  let rhythmIssues = 0;

  data.measures.forEach((m, mIdx) => {
    const mNum = m.measureNumber ?? (mIdx + 1);
    if (!m.id) errors.push(`Measure ${mNum} missing "id"`);
    if (!Array.isArray(m.notes)) {
      errors.push(`Measure ${mNum} missing "notes" array`);
      return;
    }

    let measureBeats = 0;

    m.notes.forEach((n, nIdx) => {
      totalNotes++;
      if (!n.id) errors.push(`Measure ${mNum}, note index ${nIdx} missing "id"`);
      
      const pitch = n.pitch;
      if (pitch !== 'empty' && (typeof pitch !== 'number' || pitch < 0 || pitch > 7)) {
        errors.push(`Measure ${mNum}, note ${nIdx} has invalid pitch: ${pitch}. Must be 0..7 or 'empty'`);
      }

      if (typeof n.octave !== 'number' || n.octave < -2 || n.octave > 2) {
        errors.push(`Measure ${mNum}, note ${nIdx} has invalid octave: ${n.octave}. Expected -2..2`);
      }

      if (typeof n.duration !== 'number' || n.duration < 0) {
        errors.push(`Measure ${mNum}, note ${nIdx} has invalid duration: ${n.duration}`);
      } else if (pitch !== 'empty') {
        measureBeats += n.duration;
      }

      if (n.lyric && (n.lyric.hanlo || n.lyric.poj || n.lyric.hanji || n.lyric.custom)) {
        totalLyrics++;
      }
    });

    const diff = Math.abs(measureBeats - expectedBeats);
    if (diff > 0.05) {
      rhythmIssues++;
      warnings.push(`Measure ${mNum} total duration is ${measureBeats.toFixed(2)} beats, expected ${expectedBeats} beats.`);
    }
  });

  console.log(`\n📊 Analysis Results:`);
  console.log(`   Title:             ${data.title} ${data.subtitle ? `(${data.subtitle})` : ''}`);
  console.log(`   Composer / Lyric:  ${data.composer || '—'} / ${data.lyricist || '—'}`);
  console.log(`   Key & Time:        Key ${data.key}, Time ${data.timeSignature}, ${data.bpm} BPM`);
  console.log(`   Measures count:    ${data.measures.length}`);
  console.log(`   Notes count:       ${totalNotes}`);
  console.log(`   Syllables count:   ${totalLyrics}`);

  if (warnings.length > 0) {
    console.log(`\n⚠️  Rhythm Warnings (${warnings.length}):`);
    warnings.slice(0, 10).forEach(w => console.log(`   - ${w}`));
    if (warnings.length > 10) console.log(`   ... and ${warnings.length - 10} more.`);
  }

  if (errors.length > 0) {
    console.log(`\n❌ Validation FAILED with ${errors.length} error(s):`);
    errors.forEach(e => console.error(`   - ${e}`));
    process.exit(1);
  }

  console.log(`\n✅ Validation PASSED! File is fully ready for import into the Taigi Composer app.\n`);
}

const target = process.argv[2];
if (!target) {
  console.log('Usage: node validate-song-json.mjs <path-to-song.json>');
  process.exit(1);
}

validateSongFile(target);
