import { Song } from '@/types/song';

export const PRESET_SONGS: Song[] = [
  {
    id: 'u-ia-hoe',
    title: '雨夜花 (Ú-iā-hoe)',
    subtitle: '周添旺 詞 / 鄧雨賢 曲 (信望愛白話字 POJ 對齊·全四段)',
    composer: '鄧雨賢 (Tēng Ú-hiân)',
    lyricist: '周添旺 (Chiu Thiam-ōng)',
    key: 'Bb',
    timeSignature: '2/4',
    bpm: 72,
    notesPerLine: 4,
    description: '經典臺灣歌謠《雨夜花》，降B調 (2/4拍)，完整收錄白話字 (POJ) 與漢字字字對齊之四段（共32小節）。',
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
          { id: 'u_v1_n1', pitch: 5, octave: -1, duration: 0.25, slurToNext: true, lyric: { hanji: '雨', poj: 'Ú', tl: 'Ú', custom: '雨' } },
          { id: 'u_v1_n2', pitch: 6, octave: -1, duration: 0.25, lyric: { hanji: '', poj: '', tl: '', custom: '' } },
          { id: 'u_v1_n3', pitch: 5, octave: -1, duration: 0.5, lyric: { hanji: '夜', poj: 'iā', tl: 'iā', custom: '夜' } },
          { id: 'u_v1_n4', pitch: 3, octave: 0, duration: 1.0, lyric: { hanji: '花', poj: 'hoe', tl: 'hue', custom: '花' } },
        ],
      },
      {
        id: 'u_m2',
        measureNumber: 2,
        chord: 'Gm',
        notes: [
          { id: 'u_v1_n5', pitch: 3, octave: 0, duration: 0.25, slurToNext: true, lyric: { hanji: '雨', poj: 'ú', tl: 'ú', custom: '雨' } },
          { id: 'u_v1_n6', pitch: 2, octave: 0, duration: 0.25, lyric: { hanji: '', poj: '', tl: '', custom: '' } },
          { id: 'u_v1_n7', pitch: 1, octave: 0, duration: 0.25, slurToNext: true, lyric: { hanji: '夜', poj: 'iā', tl: 'iā', custom: '夜' } },
          { id: 'u_v1_n8', pitch: 6, octave: -1, duration: 0.25, lyric: { hanji: '', poj: '', tl: '', custom: '' } },
          { id: 'u_v1_n9', pitch: 5, octave: -1, duration: 1.0, lyric: { hanji: '花', poj: 'hoe', tl: 'hue', custom: '花' } },
        ],
      },
      {
        id: 'u_m3',
        measureNumber: 3,
        chord: 'Eb',
        notes: [
          { id: 'u_v1_n10', pitch: 1, octave: 0, duration: 0.25, slurToNext: true, lyric: { hanji: '受', poj: 'siū', tl: 'siū', custom: '受' } },
          { id: 'u_v1_n11', pitch: 2, octave: 0, duration: 0.25, lyric: { hanji: '', poj: '', tl: '', custom: '' } },
          { id: 'u_v1_n12', pitch: 3, octave: 0, duration: 0.5, lyric: { hanji: '風', poj: 'hong', tl: 'hong', custom: '風' } },
          { id: 'u_v1_n13', pitch: 5, octave: 0, duration: 0.5, lyric: { hanji: '雨', poj: 'hō͘', tl: 'hōo', custom: '雨' } },
          { id: 'u_v1_n14', pitch: 1, octave: 1, duration: 0.25, slurToNext: true, annotation: '過門', lyric: { hanji: '', poj: '', tl: '', custom: '' } },
          { id: 'u_v1_n15', pitch: 2, octave: 1, duration: 0.25, lyric: { hanji: '', poj: '', tl: '', custom: '' } },
        ],
      },
      {
        id: 'u_m4',
        measureNumber: 4,
        chord: 'F7',
        isLineBreak: true,
        notes: [
          { id: 'u_v1_n16', pitch: 3, octave: 0, duration: 0.5, lyric: { hanji: '吹', poj: 'chhoe', tl: 'tshue', custom: '吹' } },
          { id: 'u_v1_n17', pitch: 3, octave: 0, duration: 0.5, lyric: { hanji: '落', poj: 'lo̍h', tl: 'lo̍h', custom: '落' } },
          { id: 'u_v1_n18', pitch: 2, octave: 0, duration: 1.0, lyric: { hanji: '地', poj: 'tē', tl: 'tē', custom: '地' } },
        ],
      },
      {
        id: 'u_m5',
        measureNumber: 5,
        chord: 'Bb',
        notes: [
          { id: 'u_v1_n19', pitch: 5, octave: 0, duration: 0.5, lyric: { hanji: '無', poj: 'Bô', tl: 'Bô', custom: '無' } },
          { id: 'u_v1_n20', pitch: 5, octave: 0, duration: 0.5, lyric: { hanji: '人', poj: 'lâng', tl: 'lâng', custom: '人' } },
          { id: 'u_v1_n21', pitch: 5, octave: 0, duration: 0.25, slurToNext: true, lyric: { hanji: '看', poj: 'khòaⁿ', tl: 'khuànn', custom: '看' } },
          { id: 'u_v1_n22', pitch: 3, octave: 0, duration: 0.125, slurToNext: true, lyric: { hanji: '', poj: '', tl: '', custom: '' } },
          { id: 'u_v1_n23', pitch: 5, octave: 0, duration: 0.125, lyric: { hanji: '', poj: '', tl: '', custom: '' } },
          { id: 'u_v1_n24', pitch: 3, octave: 0, duration: 0.5, lyric: { hanji: '見', poj: 'kìⁿ', tl: 'kìnn', custom: '見' } },
        ],
      },
      {
        id: 'u_m6',
        measureNumber: 6,
        chord: 'Cm',
        notes: [
          { id: 'u_v1_n25', pitch: 3, octave: 0, duration: 0.25, slurToNext: true, lyric: { hanji: '暝', poj: 'mî', tl: 'mî', custom: '暝' } },
          { id: 'u_v1_n26', pitch: 2, octave: 0, duration: 0.25, lyric: { hanji: '', poj: '', tl: '', custom: '' } },
          { id: 'u_v1_n27', pitch: 3, octave: 0, duration: 0.25, slurToNext: true, lyric: { hanji: '日', poj: 'ji̍t', tl: 'ji̍t', custom: '日' } },
          { id: 'u_v1_n28', pitch: 2, octave: 0, duration: 0.25, lyric: { hanji: '', poj: '', tl: '', custom: '' } },
          { id: 'u_v1_n29', pitch: 1, octave: 0, duration: 0.5, lyric: { hanji: '怨', poj: 'oàn', tl: 'uàn', custom: '怨' } },
          { id: 'u_v1_n30', pitch: 6, octave: -1, duration: 0.5, lyric: { hanji: '嗟', poj: 'chhè', tl: 'tshè', custom: '嗟' } },
        ],
      },
      {
        id: 'u_m7',
        measureNumber: 7,
        chord: 'Gm',
        notes: [
          { id: 'u_v1_n31', pitch: 5, octave: -1, duration: 0.5, lyric: { hanji: '花', poj: 'Hoe', tl: 'Hue', custom: '花' } },
          { id: 'u_v1_n32', pitch: 6, octave: -1, duration: 0.5, lyric: { hanji: '謝', poj: 'siā', tl: 'siā', custom: '謝' } },
          { id: 'u_v1_n33', pitch: 5, octave: -1, duration: 0.5, lyric: { hanji: '落', poj: 'lo̍h', tl: 'lo̍h', custom: '落' } },
          { id: 'u_v1_n34', pitch: 3, octave: 0, duration: 0.5, lyric: { hanji: '土', poj: 'thô͘', tl: 'thôo', custom: '土' } },
        ],
      },
      {
        id: 'u_m8',
        measureNumber: 8,
        chord: 'Bb',
        barlineType: 'double',
        isLineBreak: true,
        notes: [
          { id: 'u_v1_n35', pitch: 3, octave: 0, duration: 0.5, lyric: { hanji: '不', poj: 'put', tl: 'put', custom: '不' } },
          { id: 'u_v1_n36', pitch: 2, octave: 0, duration: 0.5, lyric: { hanji: '再', poj: 'chài', tl: 'tsài', custom: '再' } },
          { id: 'u_v1_n37', pitch: 1, octave: 0, duration: 1.0, lyric: { hanji: '回', poj: 'hôe', tl: 'huê', custom: '回' } },
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
          { id: 'u_v2_n1', pitch: 5, octave: -1, duration: 0.25, slurToNext: true, lyric: { hanji: '花', poj: 'Hoe', tl: 'Hue', custom: '花' } },
          { id: 'u_v2_n2', pitch: 6, octave: -1, duration: 0.25, lyric: { hanji: '', poj: '', tl: '', custom: '' } },
          { id: 'u_v2_n3', pitch: 5, octave: -1, duration: 0.5, lyric: { hanji: '落', poj: 'lo̍h', tl: 'lo̍h', custom: '落' } },
          { id: 'u_v2_n4', pitch: 3, octave: 0, duration: 1.0, lyric: { hanji: '土', poj: 'thô͘', tl: 'thôo', custom: '土' } },
        ],
      },
      {
        id: 'u_m10',
        measureNumber: 10,
        chord: 'Gm',
        notes: [
          { id: 'u_v2_n5', pitch: 3, octave: 0, duration: 0.25, slurToNext: true, lyric: { hanji: '花', poj: 'hoe', tl: 'hue', custom: '花' } },
          { id: 'u_v2_n6', pitch: 2, octave: 0, duration: 0.25, lyric: { hanji: '', poj: '', tl: '', custom: '' } },
          { id: 'u_v2_n7', pitch: 1, octave: 0, duration: 0.25, slurToNext: true, lyric: { hanji: '落', poj: 'lo̍h', tl: 'lo̍h', custom: '落' } },
          { id: 'u_v2_n8', pitch: 6, octave: -1, duration: 0.25, lyric: { hanji: '', poj: '', tl: '', custom: '' } },
          { id: 'u_v2_n9', pitch: 5, octave: -1, duration: 1.0, lyric: { hanji: '土', poj: 'thô͘', tl: 'thôo', custom: '土' } },
        ],
      },
      {
        id: 'u_m11',
        measureNumber: 11,
        chord: 'Eb',
        notes: [
          { id: 'u_v2_n10', pitch: 1, octave: 0, duration: 0.25, lyric: { hanji: '有', poj: 'ū', tl: 'ū', custom: '有' } },
          { id: 'u_v2_n11', pitch: 2, octave: 0, duration: 0.25, lyric: { hanji: '啥', poj: 'siáⁿ', tl: 'siánn', custom: '啥' } },
          { id: 'u_v2_n12', pitch: 3, octave: 0, duration: 0.5, lyric: { hanji: '人', poj: 'lâng', tl: 'lâng', custom: '人' } },
          { id: 'u_v2_n13', pitch: 5, octave: 0, duration: 0.5, lyric: { hanji: 'thang', poj: 'thang', tl: 'thang', custom: 'thang' } },
          { id: 'u_v2_n14', pitch: 1, octave: 1, duration: 0.25, slurToNext: true, annotation: '過門', lyric: { hanji: '', poj: '', tl: '', custom: '' } },
          { id: 'u_v2_n15', pitch: 2, octave: 1, duration: 0.25, lyric: { hanji: '', poj: '', tl: '', custom: '' } },
        ],
      },
      {
        id: 'u_m12',
        measureNumber: 12,
        chord: 'F7',
        isLineBreak: true,
        notes: [
          { id: 'u_v2_n16', pitch: 3, octave: 0, duration: 0.5, lyric: { hanji: '看', poj: 'khòaⁿ', tl: 'khuànn', custom: '看' } },
          { id: 'u_v2_n17', pitch: 3, octave: 0, duration: 0.5, lyric: { hanji: '顧', poj: 'kò͘', tl: 'kòo', custom: '顧' } },
          { id: 'u_v2_n18', pitch: 2, octave: 0, duration: 1.0, lyric: { hanji: '──', poj: '', tl: '', custom: '──' } },
        ],
      },
      {
        id: 'u_m13',
        measureNumber: 13,
        chord: 'Bb',
        notes: [
          { id: 'u_v2_n19', pitch: 5, octave: 0, duration: 0.5, lyric: { hanji: '無', poj: 'Bô', tl: 'Bô', custom: '無' } },
          { id: 'u_v2_n20', pitch: 5, octave: 0, duration: 0.5, lyric: { hanji: '情', poj: 'chêng', tl: 'tsîng', custom: '情' } },
          { id: 'u_v2_n21', pitch: 5, octave: 0, duration: 0.25, slurToNext: true, lyric: { hanji: '風', poj: 'hong', tl: 'hong', custom: '風' } },
          { id: 'u_v2_n22', pitch: 3, octave: 0, duration: 0.125, slurToNext: true, lyric: { hanji: '', poj: '', tl: '', custom: '' } },
          { id: 'u_v2_n23', pitch: 5, octave: 0, duration: 0.125, lyric: { hanji: '', poj: '', tl: '', custom: '' } },
          { id: 'u_v2_n24', pitch: 3, octave: 0, duration: 0.5, lyric: { hanji: '雨', poj: 'hō͘', tl: 'hōo', custom: '雨' } },
        ],
      },
      {
        id: 'u_m14',
        measureNumber: 14,
        chord: 'Cm',
        notes: [
          { id: 'u_v2_n25', pitch: 3, octave: 0, duration: 0.25, slurToNext: true, lyric: { hanji: '誤', poj: 'gō͘', tl: 'gōo', custom: '誤' } },
          { id: 'u_v2_n26', pitch: 2, octave: 0, duration: 0.25, lyric: { hanji: '', poj: '', tl: '', custom: '' } },
          { id: 'u_v2_n27', pitch: 3, octave: 0, duration: 0.25, slurToNext: true, lyric: { hanji: '阮', poj: 'goán', tl: 'guán', custom: '阮' } },
          { id: 'u_v2_n28', pitch: 2, octave: 0, duration: 0.25, lyric: { hanji: '', poj: '', tl: '', custom: '' } },
          { id: 'u_v2_n29', pitch: 1, octave: 0, duration: 0.5, lyric: { hanji: '前', poj: 'chiân', tl: 'tsiân', custom: '前' } },
          { id: 'u_v2_n30', pitch: 6, octave: -1, duration: 0.5, lyric: { hanji: '途', poj: 'tô͘', tl: 'tôo', custom: '途' } },
        ],
      },
      {
        id: 'u_m15',
        measureNumber: 15,
        chord: 'Gm',
        notes: [
          { id: 'u_v2_n31', pitch: 5, octave: -1, duration: 0.5, lyric: { hanji: '花', poj: 'hoe', tl: 'hue', custom: '花' } },
          { id: 'u_v2_n32', pitch: 6, octave: -1, duration: 0.5, lyric: { hanji: '蕊', poj: 'lúi', tl: 'luí', custom: '蕊' } },
          { id: 'u_v2_n33', pitch: 5, octave: -1, duration: 0.5, lyric: { hanji: '凋', poj: 'tiau', tl: 'tiau', custom: '凋' } },
          { id: 'u_v2_n34', pitch: 3, octave: 0, duration: 0.5, lyric: { hanji: '落', poj: 'lo̍h', tl: 'lo̍h', custom: '落' } },
        ],
      },
      {
        id: 'u_m16',
        measureNumber: 16,
        chord: 'Bb',
        barlineType: 'double',
        isLineBreak: true,
        notes: [
          { id: 'u_v2_n35', pitch: 3, octave: 0, duration: 0.5, lyric: { hanji: 'beh', poj: 'beh', tl: 'beh', custom: 'beh' } },
          { id: 'u_v2_n36', pitch: 2, octave: 0, duration: 0.5, lyric: { hanji: '如', poj: 'jû', tl: 'jû', custom: '如' } },
          { id: 'u_v2_n37', pitch: 1, octave: 0, duration: 1.0, lyric: { hanji: '何', poj: 'hô', tl: 'hô', custom: '何' } },
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
          { id: 'u_v3_n1', pitch: 5, octave: -1, duration: 0.25, slurToNext: true, lyric: { hanji: '雨', poj: 'Ú', tl: 'Ú', custom: '雨' } },
          { id: 'u_v3_n2', pitch: 6, octave: -1, duration: 0.25, lyric: { hanji: '', poj: '', tl: '', custom: '' } },
          { id: 'u_v3_n3', pitch: 5, octave: -1, duration: 0.5, lyric: { hanji: '無', poj: 'bô', tl: 'bô', custom: '無' } },
          { id: 'u_v3_n4', pitch: 3, octave: 0, duration: 1.0, lyric: { hanji: '情', poj: 'chêng', tl: 'tsîng', custom: '情' } },
        ],
      },
      {
        id: 'u_m18',
        measureNumber: 18,
        chord: 'Gm',
        notes: [
          { id: 'u_v3_n5', pitch: 3, octave: 0, duration: 0.25, slurToNext: true, lyric: { hanji: '雨', poj: 'ú', tl: 'ú', custom: '雨' } },
          { id: 'u_v3_n6', pitch: 2, octave: 0, duration: 0.25, lyric: { hanji: '', poj: '', tl: '', custom: '' } },
          { id: 'u_v3_n7', pitch: 1, octave: 0, duration: 0.25, slurToNext: true, lyric: { hanji: '無', poj: 'bô', tl: 'bô', custom: '無' } },
          { id: 'u_v3_n8', pitch: 6, octave: -1, duration: 0.25, lyric: { hanji: '', poj: '', tl: '', custom: '' } },
          { id: 'u_v3_n9', pitch: 5, octave: -1, duration: 1.0, lyric: { hanji: '情', poj: 'chêng', tl: 'tsîng', custom: '情' } },
        ],
      },
      {
        id: 'u_m19',
        measureNumber: 19,
        chord: 'Eb',
        notes: [
          { id: 'u_v3_n10', pitch: 1, octave: 0, duration: 0.25, lyric: { hanji: '無', poj: 'bô', tl: 'bô', custom: '無' } },
          { id: 'u_v3_n11', pitch: 2, octave: 0, duration: 0.25, lyric: { hanji: '想', poj: 'siūⁿ', tl: 'siūnn', custom: '想' } },
          { id: 'u_v3_n12', pitch: 3, octave: 0, duration: 0.5, lyric: { hanji: '阮', poj: 'gún', tl: 'gún', custom: '阮' } },
          { id: 'u_v3_n13', pitch: 5, octave: 0, duration: 0.5, lyric: { hanji: 'ê', poj: 'ê', tl: 'ê', custom: 'ê' } },
          { id: 'u_v3_n14', pitch: 1, octave: 1, duration: 0.25, slurToNext: true, annotation: '過門', lyric: { hanji: '', poj: '', tl: '', custom: '' } },
          { id: 'u_v3_n15', pitch: 2, octave: 1, duration: 0.25, lyric: { hanji: '', poj: '', tl: '', custom: '' } },
        ],
      },
      {
        id: 'u_m20',
        measureNumber: 20,
        chord: 'F7',
        isLineBreak: true,
        notes: [
          { id: 'u_v3_n16', pitch: 3, octave: 0, duration: 0.5, lyric: { hanji: '前', poj: 'chiân', tl: 'tsiân', custom: '前' } },
          { id: 'u_v3_n17', pitch: 3, octave: 0, duration: 0.5, lyric: { hanji: '途', poj: 'tô͘', tl: 'tôo', custom: '途' } },
          { id: 'u_v3_n18', pitch: 2, octave: 0, duration: 1.0, lyric: { hanji: '──', poj: '', tl: '', custom: '──' } },
        ],
      },
      {
        id: 'u_m21',
        measureNumber: 21,
        chord: 'Bb',
        notes: [
          { id: 'u_v3_n19', pitch: 5, octave: 0, duration: 0.5, lyric: { hanji: '並', poj: 'Pēng', tl: 'Pīng', custom: '並' } },
          { id: 'u_v3_n20', pitch: 5, octave: 0, duration: 0.5, lyric: { hanji: '無', poj: 'bô', tl: 'bô', custom: '無' } },
          { id: 'u_v3_n21', pitch: 5, octave: 0, duration: 0.25, slurToNext: true, lyric: { hanji: '看', poj: 'khòaⁿ', tl: 'khuànn', custom: '看' } },
          { id: 'u_v3_n22', pitch: 3, octave: 0, duration: 0.125, slurToNext: true, lyric: { hanji: '', poj: '', tl: '', custom: '' } },
          { id: 'u_v3_n23', pitch: 5, octave: 0, duration: 0.125, lyric: { hanji: '', poj: '', tl: '', custom: '' } },
          { id: 'u_v3_n24', pitch: 3, octave: 0, duration: 0.5, lyric: { hanji: '護', poj: 'hō͘', tl: 'hōo', custom: '護' } },
        ],
      },
      {
        id: 'u_m22',
        measureNumber: 22,
        chord: 'Cm',
        notes: [
          { id: 'u_v3_n25', pitch: 3, octave: 0, duration: 0.25, slurToNext: true, lyric: { hanji: '軟', poj: 'nńg', tl: 'nńg', custom: '軟' } },
          { id: 'u_v3_n26', pitch: 2, octave: 0, duration: 0.25, lyric: { hanji: '', poj: '', tl: '', custom: '' } },
          { id: 'u_v3_n27', pitch: 3, octave: 0, duration: 0.25, slurToNext: true, lyric: { hanji: '弱', poj: 'jio̍k', tl: 'jio̍k', custom: '弱' } },
          { id: 'u_v3_n28', pitch: 2, octave: 0, duration: 0.25, lyric: { hanji: '', poj: '', tl: '', custom: '' } },
          { id: 'u_v3_n29', pitch: 1, octave: 0, duration: 0.5, lyric: { hanji: '心', poj: 'sim', tl: 'sim', custom: '心' } },
          { id: 'u_v3_n30', pitch: 6, octave: -1, duration: 0.5, lyric: { hanji: '性', poj: 'sèng', tl: 'sìng', custom: '性' } },
        ],
      },
      {
        id: 'u_m23',
        measureNumber: 23,
        chord: 'Gm',
        notes: [
          { id: 'u_v3_n31', pitch: 5, octave: -1, duration: 0.5, lyric: { hanji: 'Hō͘', poj: 'Hō͘', tl: 'Hōo', custom: 'Hō͘' } },
          { id: 'u_v3_n32', pitch: 6, octave: -1, duration: 0.5, lyric: { hanji: '阮', poj: 'gún', tl: 'gún', custom: '阮' } },
          { id: 'u_v3_n33', pitch: 5, octave: -1, duration: 0.5, lyric: { hanji: '前', poj: 'chiân', tl: 'tsiân', custom: '前' } },
          { id: 'u_v3_n34', pitch: 3, octave: 0, duration: 0.5, lyric: { hanji: '途', poj: 'tô͘', tl: 'tôo', custom: '途' } },
        ],
      },
      {
        id: 'u_m24',
        measureNumber: 24,
        chord: 'Bb',
        barlineType: 'double',
        isLineBreak: true,
        notes: [
          { id: 'u_v3_n35', pitch: 3, octave: 0, duration: 0.5, lyric: { hanji: '失', poj: 'sit', tl: 'sit', custom: '失' } },
          { id: 'u_v3_n36', pitch: 2, octave: 0, duration: 0.5, lyric: { hanji: '光', poj: 'kong', tl: 'kong', custom: '光' } },
          { id: 'u_v3_n37', pitch: 1, octave: 0, duration: 1.0, lyric: { hanji: '明', poj: 'bêng', tl: 'bîng', custom: '明' } },
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
          { id: 'u_v4_n1', pitch: 5, octave: -1, duration: 0.25, slurToNext: true, lyric: { hanji: '雨', poj: 'Ú', tl: 'Ú', custom: '雨' } },
          { id: 'u_v4_n2', pitch: 6, octave: -1, duration: 0.25, lyric: { hanji: '', poj: '', tl: '', custom: '' } },
          { id: 'u_v4_n3', pitch: 5, octave: -1, duration: 0.5, lyric: { hanji: '水', poj: 'chúi', tl: 'tsuí', custom: '水' } },
          { id: 'u_v4_n4', pitch: 3, octave: 0, duration: 1.0, lyric: { hanji: '滴', poj: 'tih', tl: 'tih', custom: '滴' } },
        ],
      },
      {
        id: 'u_m26',
        measureNumber: 26,
        chord: 'Gm',
        notes: [
          { id: 'u_v4_n5', pitch: 3, octave: 0, duration: 0.25, slurToNext: true, lyric: { hanji: '雨', poj: 'ú', tl: 'ú', custom: '雨' } },
          { id: 'u_v4_n6', pitch: 2, octave: 0, duration: 0.25, lyric: { hanji: '', poj: '', tl: '', custom: '' } },
          { id: 'u_v4_n7', pitch: 1, octave: 0, duration: 0.25, slurToNext: true, lyric: { hanji: '水', poj: 'chúi', tl: 'tsuí', custom: '水' } },
          { id: 'u_v4_n8', pitch: 6, octave: -1, duration: 0.25, lyric: { hanji: '', poj: '', tl: '', custom: '' } },
          { id: 'u_v4_n9', pitch: 5, octave: -1, duration: 1.0, lyric: { hanji: '滴', poj: 'tih', tl: 'tih', custom: '滴' } },
        ],
      },
      {
        id: 'u_m27',
        measureNumber: 27,
        chord: 'Eb',
        notes: [
          { id: 'u_v4_n10', pitch: 1, octave: 0, duration: 0.25, slurToNext: true, lyric: { hanji: '引', poj: 'ín', tl: 'ín', custom: '引' } },
          { id: 'u_v4_n11', pitch: 2, octave: 0, duration: 0.25, lyric: { hanji: '', poj: '', tl: '', custom: '' } },
          { id: 'u_v4_n12', pitch: 3, octave: 0, duration: 0.5, lyric: { hanji: '阮', poj: 'gún', tl: 'gún', custom: '阮' } },
          { id: 'u_v4_n13', pitch: 5, octave: 0, duration: 0.5, lyric: { hanji: '入', poj: 'ji̍p', tl: 'ji̍p', custom: '入' } },
          { id: 'u_v4_n14', pitch: 1, octave: 1, duration: 0.25, slurToNext: true, annotation: '過門', lyric: { hanji: '', poj: '', tl: '', custom: '' } },
          { id: 'u_v4_n15', pitch: 2, octave: 1, duration: 0.25, lyric: { hanji: '', poj: '', tl: '', custom: '' } },
        ],
      },
      {
        id: 'u_m28',
        measureNumber: 28,
        chord: 'F7',
        isLineBreak: true,
        notes: [
          { id: 'u_v4_n16', pitch: 3, octave: 0, duration: 0.5, lyric: { hanji: '受', poj: 'siū', tl: 'siū', custom: '受' } },
          { id: 'u_v4_n17', pitch: 3, octave: 0, duration: 0.5, lyric: { hanji: '難', poj: 'lān', tl: 'lān', custom: '難' } },
          { id: 'u_v4_n18', pitch: 2, octave: 0, duration: 1.0, lyric: { hanji: '池', poj: 'tî', tl: 'tî', custom: '池' } },
        ],
      },
      {
        id: 'u_m29',
        measureNumber: 29,
        chord: 'Bb',
        notes: [
          { id: 'u_v4_n19', pitch: 5, octave: 0, duration: 0.5, lyric: { hanji: '怎', poj: 'Chóaⁿ', tl: 'Tsuánn', custom: '怎' } },
          { id: 'u_v4_n20', pitch: 5, octave: 0, duration: 0.5, lyric: { hanji: '樣', poj: 'iūⁿ', tl: 'iūnn', custom: '樣' } },
          { id: 'u_v4_n21', pitch: 5, octave: 0, duration: 0.25, slurToNext: true, lyric: { hanji: 'hō͘', poj: 'hō͘', tl: 'hōo', custom: 'hō͘' } },
          { id: 'u_v4_n22', pitch: 3, octave: 0, duration: 0.125, slurToNext: true, lyric: { hanji: '', poj: '', tl: '', custom: '' } },
          { id: 'u_v4_n23', pitch: 5, octave: 0, duration: 0.125, lyric: { hanji: '', poj: '', tl: '', custom: '' } },
          { id: 'u_v4_n24', pitch: 3, octave: 0, duration: 0.5, lyric: { hanji: '阮', poj: 'gún', tl: 'gún', custom: '阮' } },
        ],
      },
      {
        id: 'u_m30',
        measureNumber: 30,
        chord: 'Cm',
        notes: [
          { id: 'u_v4_n25', pitch: 3, octave: 0, duration: 0.25, slurToNext: true, lyric: { hanji: '離', poj: 'lī', tl: 'lī', custom: '離' } },
          { id: 'u_v4_n26', pitch: 2, octave: 0, duration: 0.25, lyric: { hanji: '', poj: '', tl: '', custom: '' } },
          { id: 'u_v4_n27', pitch: 3, octave: 0, duration: 0.25, slurToNext: true, lyric: { hanji: '葉', poj: 'hio̍h', tl: 'hio̍h', custom: '葉' } },
          { id: 'u_v4_n28', pitch: 2, octave: 0, duration: 0.25, lyric: { hanji: '', poj: '', tl: '', custom: '' } },
          { id: 'u_v4_n29', pitch: 1, octave: 0, duration: 0.5, lyric: { hanji: '離', poj: 'lī', tl: 'lī', custom: '離' } },
          { id: 'u_v4_n30', pitch: 6, octave: -1, duration: 0.5, lyric: { hanji: '枝', poj: 'ki', tl: 'ki', custom: '枝' } },
        ],
      },
      {
        id: 'u_m31',
        measureNumber: 31,
        chord: 'Gm',
        notes: [
          { id: 'u_v4_n31', pitch: 5, octave: -1, duration: 0.5, lyric: { hanji: '永', poj: 'Éng', tl: 'Íng', custom: '永' } },
          { id: 'u_v4_n32', pitch: 6, octave: -1, duration: 0.5, lyric: { hanji: '遠', poj: 'oán', tl: 'uán', custom: '遠' } },
          { id: 'u_v4_n33', pitch: 5, octave: -1, duration: 0.5, lyric: { hanji: '無', poj: 'bô', tl: 'bô', custom: '無' } },
          { id: 'u_v4_n34', pitch: 3, octave: 0, duration: 0.5, lyric: { hanji: '人', poj: 'lâng', tl: 'lâng', custom: '人' } },
        ],
      },
      {
        id: 'u_m32',
        measureNumber: 32,
        chord: 'Bb',
        barlineType: 'end',
        isLineBreak: true,
        notes: [
          { id: 'u_v4_n35', pitch: 3, octave: 0, duration: 0.5, lyric: { hanji: 'thang', poj: 'thang', tl: 'thang', custom: 'thang' } },
          { id: 'u_v4_n36', pitch: 2, octave: 0, duration: 0.5, lyric: { hanji: '看', poj: 'khòaⁿ', tl: 'khuànn', custom: '看' } },
          { id: 'u_v4_n37', pitch: 1, octave: 0, duration: 1.0, lyric: { hanji: '見', poj: 'kìⁿ', tl: 'kìnn', custom: '見' } },
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
          { id: `n-${timestamp}-1`, pitch: 1, octave: 0, duration: 1, lyric: { hanji: '', poj: '', tl: '', custom: '' } },
          { id: `n-${timestamp}-2`, pitch: 2, octave: 0, duration: 1, lyric: { hanji: '', poj: '', tl: '', custom: '' } },
          { id: `n-${timestamp}-3`, pitch: 3, octave: 0, duration: 1, lyric: { hanji: '', poj: '', tl: '', custom: '' } },
          { id: `n-${timestamp}-4`, pitch: 5, octave: 0, duration: 1, lyric: { hanji: '', poj: '', tl: '', custom: '' } },
        ],
      },
    ],
  };
}
