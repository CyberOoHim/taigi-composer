import { Song } from '@/types/song';

export const PRESET_SONGS: Song[] = [
  {
    id: 'u-ia-hoe',
    title: '雨夜花 (Ú-iā-hoe)',
    subtitle: '周添旺 詞 / 鄧雨賢 曲 (信望愛白話字 POJ 對齊·全四段)',
    composer: '鄧雨賢 (Tēng Ú-hiân)',
    lyricist: '周添旺 (Chiu Thiam-ōng)',
    key: 'Bb',
    timeSignature: '4/4',
    bpm: 72,
    notesPerLine: 2,
    description: '經典臺灣歌謠《雨夜花》，降B調 (4/4拍)，完整收錄白話字 (POJ) 與漢羅字字對齊之全四段（共32小節）。時值倍增且適時換行，短句好讀好唱。',
    measures: [
      // ======================================================================
      // VERSE 1 (Measures 1 - 8)
      // ======================================================================
      {
        id: 'u_m1',
        measureNumber: 1,
        chord: 'Bb',
        section: 'Verse 1',
        notes: [
          { id: 'u_v1_n1', pitch: 5, octave: -1, duration: 0.5, slurToNext: true, lyric: { poj: 'Ú', hanlo: '雨' } },
          { id: 'u_v1_n2', pitch: 6, octave: -1, duration: 0.5, lyric: { poj: '', hanlo: '' } },
          { id: 'u_v1_n3', pitch: 5, octave: -1, duration: 1.0, lyric: { poj: 'iā', hanlo: '夜' } },
          { id: 'u_v1_n4', pitch: 3, octave: 0, duration: 2.0, lyric: { poj: 'hoe', hanlo: '花' } },
        ],
      },
      {
        id: 'u_m2',
        measureNumber: 2,
        chord: 'Gm',
        isLineBreak: true,
        notes: [
          { id: 'u_v1_n5', pitch: 3, octave: 0, duration: 0.5, slurToNext: true, lyric: { poj: 'ú', hanlo: '雨' } },
          { id: 'u_v1_n6', pitch: 2, octave: 0, duration: 0.5, lyric: { poj: '', hanlo: '' } },
          { id: 'u_v1_n7', pitch: 1, octave: 0, duration: 0.5, slurToNext: true, lyric: { poj: 'iā', hanlo: '夜' } },
          { id: 'u_v1_n8', pitch: 6, octave: -1, duration: 0.5, lyric: { poj: '', hanlo: '' } },
          { id: 'u_v1_n9', pitch: 5, octave: -1, duration: 2.0, lyric: { poj: 'hoe', hanlo: '花' } },
          { id: 'u_v1_b1', pitch: 'empty', octave: 0, duration: 0, lyric: { poj: '\n', hanlo: '\n', hanji: '\n', custom: '\n' } },
        ],
      },
      {
        id: 'u_m3',
        measureNumber: 3,
        chord: 'Eb',
        notes: [
          { id: 'u_v1_n10', pitch: 1, octave: 0, duration: 0.5, slurToNext: true, lyric: { poj: 'siū', hanlo: '受' } },
          { id: 'u_v1_n11', pitch: 2, octave: 0, duration: 0.5, lyric: { poj: '', hanlo: '' } },
          { id: 'u_v1_n12', pitch: 3, octave: 0, duration: 1.0, lyric: { poj: 'hong', hanlo: '風' } },
          { id: 'u_v1_n13', pitch: 5, octave: 0, duration: 1.0, lyric: { poj: 'hō͘', hanlo: '雨' } },
          { id: 'u_v1_n14', pitch: 1, octave: 1, duration: 0.5, slurToNext: true, annotation: '過門', lyric: { poj: '', hanlo: '' } },
          { id: 'u_v1_n15', pitch: 2, octave: 1, duration: 0.5, lyric: { poj: '', hanlo: '' } },
        ],
      },
      {
        id: 'u_m4',
        measureNumber: 4,
        chord: 'F7',
        isLineBreak: true,
        notes: [
          { id: 'u_v1_n16', pitch: 3, octave: 0, duration: 1.0, lyric: { poj: 'chhoe', hanlo: '吹' } },
          { id: 'u_v1_n17', pitch: 3, octave: 0, duration: 1.0, lyric: { poj: 'lo̍h', hanlo: '落' } },
          { id: 'u_v1_n18', pitch: 2, octave: 0, duration: 2.0, lyric: { poj: 'tē', hanlo: '地' } },
          { id: 'u_v1_b2', pitch: 'empty', octave: 0, duration: 0, lyric: { poj: '\n', hanlo: '\n', hanji: '\n', custom: '\n' } },
        ],
      },
      {
        id: 'u_m5',
        measureNumber: 5,
        chord: 'Bb',
        notes: [
          { id: 'u_v1_n19', pitch: 5, octave: 0, duration: 1.0, lyric: { poj: 'Bô', hanlo: '無' } },
          { id: 'u_v1_n20', pitch: 5, octave: 0, duration: 1.0, lyric: { poj: 'lâng', hanlo: '人' } },
          { id: 'u_v1_n21', pitch: 5, octave: 0, duration: 0.5, slurToNext: true, lyric: { poj: 'khòaⁿ', hanlo: '看' } },
          { id: 'u_v1_n22', pitch: 3, octave: 0, duration: 0.25, slurToNext: true, lyric: { poj: '', hanlo: '' } },
          { id: 'u_v1_n23', pitch: 5, octave: 0, duration: 0.25, lyric: { poj: '', hanlo: '' } },
          { id: 'u_v1_n24', pitch: 3, octave: 0, duration: 1.0, lyric: { poj: 'kìⁿ', hanlo: '見' } },
        ],
      },
      {
        id: 'u_m6',
        measureNumber: 6,
        chord: 'Cm',
        isLineBreak: true,
        notes: [
          { id: 'u_v1_n25', pitch: 3, octave: 0, duration: 0.5, slurToNext: true, lyric: { poj: 'mî', hanlo: '暝' } },
          { id: 'u_v1_n26', pitch: 2, octave: 0, duration: 0.5, lyric: { poj: '', hanlo: '' } },
          { id: 'u_v1_n27', pitch: 3, octave: 0, duration: 0.5, slurToNext: true, lyric: { poj: 'ji̍t', hanlo: '日' } },
          { id: 'u_v1_n28', pitch: 2, octave: 0, duration: 0.5, lyric: { poj: '', hanlo: '' } },
          { id: 'u_v1_n29', pitch: 1, octave: 0, duration: 1.0, lyric: { poj: 'oàn', hanlo: '怨' } },
          { id: 'u_v1_n30', pitch: 6, octave: -1, duration: 1.0, lyric: { poj: 'chhè', hanlo: '嗟' } },
          { id: 'u_v1_b3', pitch: 'empty', octave: 0, duration: 0, lyric: { poj: '\n', hanlo: '\n', hanji: '\n', custom: '\n' } },
        ],
      },
      {
        id: 'u_m7',
        measureNumber: 7,
        chord: 'Gm',
        notes: [
          { id: 'u_v1_n31', pitch: 5, octave: -1, duration: 1.0, lyric: { poj: 'Hoe', hanlo: '花' } },
          { id: 'u_v1_n32', pitch: 6, octave: -1, duration: 1.0, lyric: { poj: 'siā', hanlo: '謝' } },
          { id: 'u_v1_n33', pitch: 5, octave: -1, duration: 1.0, lyric: { poj: 'lo̍h', hanlo: '落' } },
          { id: 'u_v1_n34', pitch: 3, octave: 0, duration: 1.0, lyric: { poj: 'thô͘', hanlo: '土' } },
        ],
      },
      {
        id: 'u_m8',
        measureNumber: 8,
        chord: 'Bb',
        barlineType: 'double',
        isLineBreak: true,
        notes: [
          { id: 'u_v1_n35', pitch: 3, octave: 0, duration: 1.0, lyric: { poj: 'put', hanlo: '不' } },
          { id: 'u_v1_n36', pitch: 2, octave: 0, duration: 1.0, lyric: { poj: 'chài', hanlo: '再' } },
          { id: 'u_v1_n37', pitch: 1, octave: 0, duration: 2.0, lyric: { poj: 'hôe', hanlo: '回' } },
          { id: 'u_v1_b4', pitch: 'empty', octave: 0, duration: 0, lyric: { poj: '\n', hanlo: '\n', hanji: '\n', custom: '\n' } },
        ],
      },

      // ======================================================================
      // VERSE 2 (Measures 9 - 16)
      // ======================================================================
      {
        id: 'u_m9',
        measureNumber: 9,
        chord: 'Bb',
        section: 'Verse 2',
        notes: [
          { id: 'u_v2_n1', pitch: 5, octave: -1, duration: 0.5, slurToNext: true, lyric: { poj: 'Hoe', hanlo: '花' } },
          { id: 'u_v2_n2', pitch: 6, octave: -1, duration: 0.5, lyric: { poj: '', hanlo: '' } },
          { id: 'u_v2_n3', pitch: 5, octave: -1, duration: 1.0, lyric: { poj: 'lo̍h', hanlo: '落' } },
          { id: 'u_v2_n4', pitch: 3, octave: 0, duration: 2.0, lyric: { poj: 'thô͘', hanlo: '土' } },
        ],
      },
      {
        id: 'u_m10',
        measureNumber: 10,
        chord: 'Gm',
        isLineBreak: true,
        notes: [
          { id: 'u_v2_n5', pitch: 3, octave: 0, duration: 0.5, slurToNext: true, lyric: { poj: 'hoe', hanlo: '花' } },
          { id: 'u_v2_n6', pitch: 2, octave: 0, duration: 0.5, lyric: { poj: '', hanlo: '' } },
          { id: 'u_v2_n7', pitch: 1, octave: 0, duration: 0.5, slurToNext: true, lyric: { poj: 'lo̍h', hanlo: '落' } },
          { id: 'u_v2_n8', pitch: 6, octave: -1, duration: 0.5, lyric: { poj: '', hanlo: '' } },
          { id: 'u_v2_n9', pitch: 5, octave: -1, duration: 2.0, lyric: { poj: 'thô͘', hanlo: '土' } },
          { id: 'u_v2_b1', pitch: 'empty', octave: 0, duration: 0, lyric: { poj: '\n', hanlo: '\n', hanji: '\n', custom: '\n' } },
        ],
      },
      {
        id: 'u_m11',
        measureNumber: 11,
        chord: 'Eb',
        notes: [
          { id: 'u_v2_n10', pitch: 1, octave: 0, duration: 0.5, lyric: { poj: 'ū', hanlo: '有' } },
          { id: 'u_v2_n11', pitch: 2, octave: 0, duration: 0.5, lyric: { poj: 'siáⁿ', hanlo: '啥' } },
          { id: 'u_v2_n12', pitch: 3, octave: 0, duration: 1.0, lyric: { poj: 'lâng', hanlo: '人' } },
          { id: 'u_v2_n13', pitch: 5, octave: 0, duration: 1.0, lyric: { poj: 'thang', hanlo: 'thang' } },
          { id: 'u_v2_n14', pitch: 1, octave: 1, duration: 0.5, slurToNext: true, annotation: '過門', lyric: { poj: '', hanlo: '' } },
          { id: 'u_v2_n15', pitch: 2, octave: 1, duration: 0.5, lyric: { poj: '', hanlo: '' } },
        ],
      },
      {
        id: 'u_m12',
        measureNumber: 12,
        chord: 'F7',
        isLineBreak: true,
        notes: [
          { id: 'u_v2_n16', pitch: 3, octave: 0, duration: 1.0, lyric: { poj: 'khòaⁿ', hanlo: '看' } },
          { id: 'u_v2_n17', pitch: 3, octave: 0, duration: 1.0, lyric: { poj: 'kò͘', hanlo: '顧' } },
          { id: 'u_v2_n18', pitch: 2, octave: 0, duration: 2.0, lyric: { poj: '', hanlo: '──' } },
          { id: 'u_v2_b2', pitch: 'empty', octave: 0, duration: 0, lyric: { poj: '\n', hanlo: '\n', hanji: '\n', custom: '\n' } },
        ],
      },
      {
        id: 'u_m13',
        measureNumber: 13,
        chord: 'Bb',
        notes: [
          { id: 'u_v2_n19', pitch: 5, octave: 0, duration: 1.0, lyric: { poj: 'Bô', hanlo: '無' } },
          { id: 'u_v2_n20', pitch: 5, octave: 0, duration: 1.0, lyric: { poj: 'chêng', hanlo: '情' } },
          { id: 'u_v2_n21', pitch: 5, octave: 0, duration: 0.5, slurToNext: true, lyric: { poj: 'hong', hanlo: '風' } },
          { id: 'u_v2_n22', pitch: 3, octave: 0, duration: 0.25, slurToNext: true, lyric: { poj: '', hanlo: '' } },
          { id: 'u_v2_n23', pitch: 5, octave: 0, duration: 0.25, lyric: { poj: '', hanlo: '' } },
          { id: 'u_v2_n24', pitch: 3, octave: 0, duration: 1.0, lyric: { poj: 'hō͘', hanlo: '雨' } },
        ],
      },
      {
        id: 'u_m14',
        measureNumber: 14,
        chord: 'Cm',
        isLineBreak: true,
        notes: [
          { id: 'u_v2_n25', pitch: 3, octave: 0, duration: 0.5, slurToNext: true, lyric: { poj: 'gō͘', hanlo: '誤' } },
          { id: 'u_v2_n26', pitch: 2, octave: 0, duration: 0.5, lyric: { poj: '', hanlo: '' } },
          { id: 'u_v2_n27', pitch: 3, octave: 0, duration: 0.5, slurToNext: true, lyric: { poj: 'goán', hanlo: '阮' } },
          { id: 'u_v2_n28', pitch: 2, octave: 0, duration: 0.5, lyric: { poj: '', hanlo: '' } },
          { id: 'u_v2_n29', pitch: 1, octave: 0, duration: 1.0, lyric: { poj: 'chiân', hanlo: '前' } },
          { id: 'u_v2_n30', pitch: 6, octave: -1, duration: 1.0, lyric: { poj: 'tô͘', hanlo: '途' } },
          { id: 'u_v2_b3', pitch: 'empty', octave: 0, duration: 0, lyric: { poj: '\n', hanlo: '\n', hanji: '\n', custom: '\n' } },
        ],
      },
      {
        id: 'u_m15',
        measureNumber: 15,
        chord: 'Gm',
        notes: [
          { id: 'u_v2_n31', pitch: 5, octave: -1, duration: 1.0, lyric: { poj: 'hoe', hanlo: '花' } },
          { id: 'u_v2_n32', pitch: 6, octave: -1, duration: 1.0, lyric: { poj: 'lúi', hanlo: '蕊' } },
          { id: 'u_v2_n33', pitch: 5, octave: -1, duration: 1.0, lyric: { poj: 'tiau', hanlo: '凋' } },
          { id: 'u_v2_n34', pitch: 3, octave: 0, duration: 1.0, lyric: { poj: 'lo̍h', hanlo: '落' } },
        ],
      },
      {
        id: 'u_m16',
        measureNumber: 16,
        chord: 'Bb',
        barlineType: 'double',
        isLineBreak: true,
        notes: [
          { id: 'u_v2_n35', pitch: 3, octave: 0, duration: 1.0, lyric: { poj: 'beh', hanlo: 'beh' } },
          { id: 'u_v2_n36', pitch: 2, octave: 0, duration: 1.0, lyric: { poj: 'jû', hanlo: '如' } },
          { id: 'u_v2_n37', pitch: 1, octave: 0, duration: 2.0, lyric: { poj: 'hô', hanlo: '何' } },
          { id: 'u_v2_b4', pitch: 'empty', octave: 0, duration: 0, lyric: { poj: '\n', hanlo: '\n', hanji: '\n', custom: '\n' } },
        ],
      },

      // ======================================================================
      // VERSE 3 (Measures 17 - 24)
      // ======================================================================
      {
        id: 'u_m17',
        measureNumber: 17,
        chord: 'Bb',
        section: 'Verse 3',
        notes: [
          { id: 'u_v3_n1', pitch: 5, octave: -1, duration: 0.5, slurToNext: true, lyric: { poj: 'Ú', hanlo: '雨' } },
          { id: 'u_v3_n2', pitch: 6, octave: -1, duration: 0.5, lyric: { poj: '', hanlo: '' } },
          { id: 'u_v3_n3', pitch: 5, octave: -1, duration: 1.0, lyric: { poj: 'bô', hanlo: '無' } },
          { id: 'u_v3_n4', pitch: 3, octave: 0, duration: 2.0, lyric: { poj: 'chêng', hanlo: '情' } },
        ],
      },
      {
        id: 'u_m18',
        measureNumber: 18,
        chord: 'Gm',
        isLineBreak: true,
        notes: [
          { id: 'u_v3_n5', pitch: 3, octave: 0, duration: 0.5, slurToNext: true, lyric: { poj: 'ú', hanlo: '雨' } },
          { id: 'u_v3_n6', pitch: 2, octave: 0, duration: 0.5, lyric: { poj: '', hanlo: '' } },
          { id: 'u_v3_n7', pitch: 1, octave: 0, duration: 0.5, slurToNext: true, lyric: { poj: 'bô', hanlo: '無' } },
          { id: 'u_v3_n8', pitch: 6, octave: -1, duration: 0.5, lyric: { poj: '', hanlo: '' } },
          { id: 'u_v3_n9', pitch: 5, octave: -1, duration: 2.0, lyric: { poj: 'chêng', hanlo: '情' } },
          { id: 'u_v3_b1', pitch: 'empty', octave: 0, duration: 0, lyric: { poj: '\n', hanlo: '\n', hanji: '\n', custom: '\n' } },
        ],
      },
      {
        id: 'u_m19',
        measureNumber: 19,
        chord: 'Eb',
        notes: [
          { id: 'u_v3_n10', pitch: 1, octave: 0, duration: 0.5, lyric: { poj: 'bô', hanlo: '無' } },
          { id: 'u_v3_n11', pitch: 2, octave: 0, duration: 0.5, lyric: { poj: 'siūⁿ', hanlo: '想' } },
          { id: 'u_v3_n12', pitch: 3, octave: 0, duration: 1.0, lyric: { poj: 'gún', hanlo: '阮' } },
          { id: 'u_v3_n13', pitch: 5, octave: 0, duration: 1.0, lyric: { poj: 'ê', hanlo: 'ê' } },
          { id: 'u_v3_n14', pitch: 1, octave: 1, duration: 0.5, slurToNext: true, annotation: '過門', lyric: { poj: '', hanlo: '' } },
          { id: 'u_v3_n15', pitch: 2, octave: 1, duration: 0.5, lyric: { poj: '', hanlo: '' } },
        ],
      },
      {
        id: 'u_m20',
        measureNumber: 20,
        chord: 'F7',
        isLineBreak: true,
        notes: [
          { id: 'u_v3_n16', pitch: 3, octave: 0, duration: 1.0, lyric: { poj: 'chiân', hanlo: '前' } },
          { id: 'u_v3_n17', pitch: 3, octave: 0, duration: 1.0, lyric: { poj: 'tô͘', hanlo: '途' } },
          { id: 'u_v3_n18', pitch: 2, octave: 0, duration: 2.0, lyric: { poj: '', hanlo: '──' } },
          { id: 'u_v3_b2', pitch: 'empty', octave: 0, duration: 0, lyric: { poj: '\n', hanlo: '\n', hanji: '\n', custom: '\n' } },
        ],
      },
      {
        id: 'u_m21',
        measureNumber: 21,
        chord: 'Bb',
        notes: [
          { id: 'u_v3_n19', pitch: 5, octave: 0, duration: 1.0, lyric: { poj: 'Pēng', hanlo: '並' } },
          { id: 'u_v3_n20', pitch: 5, octave: 0, duration: 1.0, lyric: { poj: 'bô', hanlo: '無' } },
          { id: 'u_v3_n21', pitch: 5, octave: 0, duration: 0.5, slurToNext: true, lyric: { poj: 'khòaⁿ', hanlo: '看' } },
          { id: 'u_v3_n22', pitch: 3, octave: 0, duration: 0.25, slurToNext: true, lyric: { poj: '', hanlo: '' } },
          { id: 'u_v3_n23', pitch: 5, octave: 0, duration: 0.25, lyric: { poj: '', hanlo: '' } },
          { id: 'u_v3_n24', pitch: 3, octave: 0, duration: 1.0, lyric: { poj: 'hō͘', hanlo: '護' } },
        ],
      },
      {
        id: 'u_m22',
        measureNumber: 22,
        chord: 'Cm',
        isLineBreak: true,
        notes: [
          { id: 'u_v3_n25', pitch: 3, octave: 0, duration: 0.5, slurToNext: true, lyric: { poj: 'nńg', hanlo: '軟' } },
          { id: 'u_v3_n26', pitch: 2, octave: 0, duration: 0.5, lyric: { poj: '', hanlo: '' } },
          { id: 'u_v3_n27', pitch: 3, octave: 0, duration: 0.5, slurToNext: true, lyric: { poj: 'jio̍k', hanlo: '弱' } },
          { id: 'u_v3_n28', pitch: 2, octave: 0, duration: 0.5, lyric: { poj: '', hanlo: '' } },
          { id: 'u_v3_n29', pitch: 1, octave: 0, duration: 1.0, lyric: { poj: 'sim', hanlo: '心' } },
          { id: 'u_v3_n30', pitch: 6, octave: -1, duration: 1.0, lyric: { poj: 'sèng', hanlo: '性' } },
          { id: 'u_v3_b3', pitch: 'empty', octave: 0, duration: 0, lyric: { poj: '\n', hanlo: '\n', hanji: '\n', custom: '\n' } },
        ],
      },
      {
        id: 'u_m23',
        measureNumber: 23,
        chord: 'Gm',
        notes: [
          { id: 'u_v3_n31', pitch: 5, octave: -1, duration: 1.0, lyric: { poj: 'Hō͘', hanlo: 'Hō͘' } },
          { id: 'u_v3_n32', pitch: 6, octave: -1, duration: 1.0, lyric: { poj: 'gún', hanlo: '阮' } },
          { id: 'u_v3_n33', pitch: 5, octave: -1, duration: 1.0, lyric: { poj: 'chiân', hanlo: '前' } },
          { id: 'u_v3_n34', pitch: 3, octave: 0, duration: 1.0, lyric: { poj: 'tô͘', hanlo: '途' } },
        ],
      },
      {
        id: 'u_m24',
        measureNumber: 24,
        chord: 'Bb',
        barlineType: 'double',
        isLineBreak: true,
        notes: [
          { id: 'u_v3_n35', pitch: 3, octave: 0, duration: 1.0, lyric: { poj: 'sit', hanlo: '失' } },
          { id: 'u_v3_n36', pitch: 2, octave: 0, duration: 1.0, lyric: { poj: 'kong', hanlo: '光' } },
          { id: 'u_v3_n37', pitch: 1, octave: 0, duration: 2.0, lyric: { poj: 'bêng', hanlo: '明' } },
          { id: 'u_v3_b4', pitch: 'empty', octave: 0, duration: 0, lyric: { poj: '\n', hanlo: '\n', hanji: '\n', custom: '\n' } },
        ],
      },

      // ======================================================================
      // VERSE 4 (Measures 25 - 32)
      // ======================================================================
      {
        id: 'u_m25',
        measureNumber: 25,
        chord: 'Bb',
        section: 'Verse 4',
        notes: [
          { id: 'u_v4_n1', pitch: 5, octave: -1, duration: 0.5, slurToNext: true, lyric: { poj: 'Ú', hanlo: '雨' } },
          { id: 'u_v4_n2', pitch: 6, octave: -1, duration: 0.5, lyric: { poj: '', hanlo: '' } },
          { id: 'u_v4_n3', pitch: 5, octave: -1, duration: 1.0, lyric: { poj: 'chúi', hanlo: '水' } },
          { id: 'u_v4_n4', pitch: 3, octave: 0, duration: 2.0, lyric: { poj: 'tih', hanlo: '滴' } },
        ],
      },
      {
        id: 'u_m26',
        measureNumber: 26,
        chord: 'Gm',
        isLineBreak: true,
        notes: [
          { id: 'u_v4_n5', pitch: 3, octave: 0, duration: 0.5, slurToNext: true, lyric: { poj: 'ú', hanlo: '雨' } },
          { id: 'u_v4_n6', pitch: 2, octave: 0, duration: 0.5, lyric: { poj: '', hanlo: '' } },
          { id: 'u_v4_n7', pitch: 1, octave: 0, duration: 0.5, slurToNext: true, lyric: { poj: 'chúi', hanlo: '水' } },
          { id: 'u_v4_n8', pitch: 6, octave: -1, duration: 0.5, lyric: { poj: '', hanlo: '' } },
          { id: 'u_v4_n9', pitch: 5, octave: -1, duration: 2.0, lyric: { poj: 'tih', hanlo: '滴' } },
          { id: 'u_v4_b1', pitch: 'empty', octave: 0, duration: 0, lyric: { poj: '\n', hanlo: '\n', hanji: '\n', custom: '\n' } },
        ],
      },
      {
        id: 'u_m27',
        measureNumber: 27,
        chord: 'Eb',
        notes: [
          { id: 'u_v4_n10', pitch: 1, octave: 0, duration: 0.5, slurToNext: true, lyric: { poj: 'ín', hanlo: '引' } },
          { id: 'u_v4_n11', pitch: 2, octave: 0, duration: 0.5, lyric: { poj: '', hanlo: '' } },
          { id: 'u_v4_n12', pitch: 3, octave: 0, duration: 1.0, lyric: { poj: 'gún', hanlo: '阮' } },
          { id: 'u_v4_n13', pitch: 5, octave: 0, duration: 1.0, lyric: { poj: 'ji̍p', hanlo: '入' } },
          { id: 'u_v4_n14', pitch: 1, octave: 1, duration: 0.5, slurToNext: true, annotation: '過門', lyric: { poj: '', hanlo: '' } },
          { id: 'u_v4_n15', pitch: 2, octave: 1, duration: 0.5, lyric: { poj: '', hanlo: '' } },
        ],
      },
      {
        id: 'u_m28',
        measureNumber: 28,
        chord: 'F7',
        isLineBreak: true,
        notes: [
          { id: 'u_v4_n16', pitch: 3, octave: 0, duration: 1.0, lyric: { poj: 'siū', hanlo: '受' } },
          { id: 'u_v4_n17', pitch: 3, octave: 0, duration: 1.0, lyric: { poj: 'lān', hanlo: '難' } },
          { id: 'u_v4_n18', pitch: 2, octave: 0, duration: 2.0, lyric: { poj: 'tî', hanlo: '池' } },
          { id: 'u_v4_b2', pitch: 'empty', octave: 0, duration: 0, lyric: { poj: '\n', hanlo: '\n', hanji: '\n', custom: '\n' } },
        ],
      },
      {
        id: 'u_m29',
        measureNumber: 29,
        chord: 'Bb',
        notes: [
          { id: 'u_v4_n19', pitch: 5, octave: 0, duration: 1.0, lyric: { poj: 'Chóaⁿ', hanlo: '怎' } },
          { id: 'u_v4_n20', pitch: 5, octave: 0, duration: 1.0, lyric: { poj: 'iūⁿ', hanlo: '樣' } },
          { id: 'u_v4_n21', pitch: 5, octave: 0, duration: 0.5, slurToNext: true, lyric: { poj: 'hō͘', hanlo: 'hō͘' } },
          { id: 'u_v4_n22', pitch: 3, octave: 0, duration: 0.25, slurToNext: true, lyric: { poj: '', hanlo: '' } },
          { id: 'u_v4_n23', pitch: 5, octave: 0, duration: 0.25, lyric: { poj: '', hanlo: '' } },
          { id: 'u_v4_n24', pitch: 3, octave: 0, duration: 1.0, lyric: { poj: 'gún', hanlo: '阮' } },
        ],
      },
      {
        id: 'u_m30',
        measureNumber: 30,
        chord: 'Cm',
        isLineBreak: true,
        notes: [
          { id: 'u_v4_n25', pitch: 3, octave: 0, duration: 0.5, slurToNext: true, lyric: { poj: 'lī', hanlo: '離' } },
          { id: 'u_v4_n26', pitch: 2, octave: 0, duration: 0.5, lyric: { poj: '', hanlo: '' } },
          { id: 'u_v4_n27', pitch: 3, octave: 0, duration: 0.5, slurToNext: true, lyric: { poj: 'hio̍h', hanlo: '葉' } },
          { id: 'u_v4_n28', pitch: 2, octave: 0, duration: 0.5, lyric: { poj: '', hanlo: '' } },
          { id: 'u_v4_n29', pitch: 1, octave: 0, duration: 1.0, lyric: { poj: 'lī', hanlo: '離' } },
          { id: 'u_v4_n30', pitch: 6, octave: -1, duration: 1.0, lyric: { poj: 'ki', hanlo: '枝' } },
          { id: 'u_v4_b3', pitch: 'empty', octave: 0, duration: 0, lyric: { poj: '\n', hanlo: '\n', hanji: '\n', custom: '\n' } },
        ],
      },
      {
        id: 'u_m31',
        measureNumber: 31,
        chord: 'Gm',
        notes: [
          { id: 'u_v4_n31', pitch: 5, octave: -1, duration: 1.0, lyric: { poj: 'Éng', hanlo: '永' } },
          { id: 'u_v4_n32', pitch: 6, octave: -1, duration: 1.0, lyric: { poj: 'oán', hanlo: '遠' } },
          { id: 'u_v4_n33', pitch: 5, octave: -1, duration: 1.0, lyric: { poj: 'bô', hanlo: '無' } },
          { id: 'u_v4_n34', pitch: 3, octave: 0, duration: 1.0, lyric: { poj: 'lâng', hanlo: '人' } },
        ],
      },
      {
        id: 'u_m32',
        measureNumber: 32,
        chord: 'Bb',
        barlineType: 'end',
        isLineBreak: true,
        notes: [
          { id: 'u_v4_n35', pitch: 3, octave: 0, duration: 1.0, lyric: { poj: 'thang', hanlo: 'thang' } },
          { id: 'u_v4_n36', pitch: 2, octave: 0, duration: 1.0, lyric: { poj: 'khòaⁿ', hanlo: '看' } },
          { id: 'u_v4_n37', pitch: 1, octave: 0, duration: 2.0, lyric: { poj: 'kìⁿ', hanlo: '見' } },
          { id: 'u_v4_b4', pitch: 'empty', octave: 0, duration: 0, lyric: { poj: '\n', hanlo: '\n', hanji: '\n', custom: '\n' } },
        ],
      },
    ],
  },
];

/**
 * Creates a brand-new empty/fresh song template ready for editing.
 */
export function createFreshSong(title = '未命名樂曲'): Song {
  const timestamp = Date.now();
  return {
    id: `song-${timestamp}`,
    title,
    subtitle: '',
    composer: '',
    lyricist: '',
    key: 'C',
    timeSignature: '4/4',
    bpm: 80,
    notesPerLine: 4,
    description: '',
    measures: [
      {
        id: `m-${timestamp}-1`,
        measureNumber: 1,
        chord: 'C',
        section: 'Verse 1',
        notes: [
          { id: `n-${timestamp}-1`, pitch: 1, octave: 0, duration: 1, lyric: { poj: '', hanlo: '' } },
          { id: `n-${timestamp}-2`, pitch: 2, octave: 0, duration: 1, lyric: { poj: '', hanlo: '' } },
          { id: `n-${timestamp}-3`, pitch: 3, octave: 0, duration: 1, lyric: { poj: '', hanlo: '' } },
          { id: `n-${timestamp}-4`, pitch: 5, octave: 0, duration: 1, lyric: { poj: '', hanlo: '' } },
        ],
      },
    ],
  };
}
