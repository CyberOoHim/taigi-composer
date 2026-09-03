import { Song } from '@/types/song';

export const PRESET_SONGS: Song[] = [
  {
    id: 'u-ia-hoe',
    title: '雨夜花 (Hō͘-iā-hoe)',
    subtitle: '周添旺 詞 / 鄧雨賢 曲 (鄧麗君 演唱版)',
    composer: '鄧雨賢 (Tēng Ú-hiân)',
    lyricist: '周添旺 (Chiu Thiam-ōng)',
    key: 'Bb',
    timeSignature: '2/4',
    bpm: 72,
    notesPerLine: 4,
    description: '經典台語名曲。鄧麗君演唱降B調版 (2/4拍)，五聲音階旋律優美，含「雨夜花」、「花落土」二段完整唱段與歌詞。',
    measures: [
      {
        id: 'u_m1',
        measureNumber: 1,
        chord: 'Bb',
        section: 'Verse 1',
        notes: [
          { id: 'u_n1', pitch: 5, octave: -1, duration: 0.5, lyric: { hanji: '雨', poj: 'Hō͘', pij: 'Hōo', custom: '雨' } },
          { id: 'u_n2', pitch: 6, octave: -1, duration: 0.5, isTied: true, lyric: { hanji: '', poj: '', pij: '', custom: '' } },
          { id: 'u_n3', pitch: 5, octave: -1, duration: 1.0, lyric: { hanji: '夜', poj: 'iā', pij: 'iā', custom: '夜' } },
        ],
      },
      {
        id: 'u_m2',
        measureNumber: 2,
        chord: 'Gm',
        notes: [
          { id: 'u_n4', pitch: 3, octave: 0, duration: 2.0, lyric: { hanji: '花', poj: 'hoe', pij: 'hue', custom: '花' } },
        ],
      },
      {
        id: 'u_m3',
        measureNumber: 3,
        chord: 'Eb',
        notes: [
          { id: 'u_n5', pitch: 3, octave: 0, duration: 0.25, lyric: { hanji: '雨', poj: 'hō͘', pij: 'hōo', custom: '雨' } },
          { id: 'u_n6', pitch: 2, octave: 0, duration: 0.25, isTied: true, lyric: { hanji: '', poj: '', pij: '', custom: '' } },
          { id: 'u_n7', pitch: 1, octave: 0, duration: 0.5, lyric: { hanji: '夜', poj: 'iā', pij: 'iā', custom: '夜' } },
          { id: 'u_n8', pitch: 6, octave: -1, duration: 0.5, isTied: true, lyric: { hanji: '', poj: '', pij: '', custom: '' } },
          { id: 'u_n9', pitch: 5, octave: -1, duration: 0.5, lyric: { hanji: '花', poj: 'hoe', pij: 'hue', custom: '花' } },
        ],
      },
      {
        id: 'u_m4',
        measureNumber: 4,
        chord: 'F7',
        notes: [
          { id: 'u_n10', pitch: 1, octave: 0, duration: 0.5, lyric: { hanji: '受', poj: 'siū', pij: 'siū', custom: '受' } },
          { id: 'u_n11', pitch: 2, octave: 0, duration: 0.5, lyric: { hanji: '風', poj: 'hong', pij: 'hong', custom: '風' } },
          { id: 'u_n12', pitch: 3, octave: 0, duration: 1.0, lyric: { hanji: '雨', poj: 'hō͘', pij: 'hōo', custom: '雨' } },
        ],
      },
      {
        id: 'u_m5',
        measureNumber: 5,
        chord: 'Bb',
        notes: [
          { id: 'u_n13', pitch: 0, octave: 0, duration: 1.0, lyric: { hanji: '', poj: '', pij: '', custom: '' } },
          { id: 'u_n14', pitch: 5, octave: 0, duration: 0.5, lyric: { hanji: '', poj: '', pij: '', custom: '' }, annotation: '口笛' },
          { id: 'u_n15', pitch: 1, octave: 1, duration: 0.25, lyric: { hanji: '', poj: '', pij: '', custom: '' } },
          { id: 'u_n16', pitch: 2, octave: 1, duration: 0.25, lyric: { hanji: '', poj: '', pij: '', custom: '' } },
        ],
      },
      {
        id: 'u_m6',
        measureNumber: 6,
        chord: 'Dm',
        notes: [
          { id: 'u_n17', pitch: 3, octave: 0, duration: 0.5, lyric: { hanji: '吹', poj: 'chhoe', pij: 'tshue', custom: '吹' } },
          { id: 'u_n18', pitch: 3, octave: 0, duration: 0.5, lyric: { hanji: '落', poj: 'lo̍h', pij: 'lo̍h', custom: '落' } },
          { id: 'u_n19', pitch: 2, octave: 0, duration: 1.0, isTied: true, lyric: { hanji: '地', poj: 'tē', pij: 'tē', custom: '地' } },
        ],
      },
      {
        id: 'u_m7',
        measureNumber: 7,
        chord: 'F7',
        notes: [
          { id: 'u_n20', pitch: 2, octave: 0, duration: 2.0, lyric: { hanji: '', poj: '', pij: '', custom: '' } },
        ],
      },
      {
        id: 'u_m8',
        measureNumber: 8,
        chord: 'Gm',
        notes: [
          { id: 'u_n21', pitch: 0, octave: 0, duration: 1.0, lyric: { hanji: '', poj: '', pij: '', custom: '' } },
          { id: 'u_n22', pitch: 5, octave: 0, duration: 0.5, lyric: { hanji: '無', poj: 'Bô', pij: 'Bô', custom: '無' } },
          { id: 'u_n23', pitch: 5, octave: 0, duration: 0.5, lyric: { hanji: '人', poj: 'lâng', pij: 'lâng', custom: '人' } },
        ],
      },
      {
        id: 'u_m9',
        measureNumber: 9,
        chord: 'Cm',
        notes: [
          { id: 'u_n24', pitch: 5, octave: 0, duration: 0.5, lyric: { hanji: '看', poj: 'khòaⁿ', pij: 'khuànn', custom: '看' } },
          { id: 'u_n25', pitch: 3, octave: 0, duration: 0.25, isTied: true, lyric: { hanji: '', poj: '', pij: '', custom: '' } },
          { id: 'u_n26', pitch: 5, octave: 0, duration: 0.25, isTied: true, lyric: { hanji: '', poj: '', pij: '', custom: '' } },
          { id: 'u_n27', pitch: 3, octave: 0, duration: 1.0, lyric: { hanji: '見', poj: 'kìⁿ', pij: 'kìnn', custom: '見' } },
        ],
      },
      {
        id: 'u_m10',
        measureNumber: 10,
        chord: 'F7',
        notes: [
          { id: 'u_n28', pitch: 3, octave: 0, duration: 0.5, lyric: { hanji: '每', poj: 'múi', pij: 'múi', custom: '每' } },
          { id: 'u_n29', pitch: 2, octave: 0, duration: 0.25, lyric: { hanji: '日', poj: 'ji̍t', pij: 'ji̍t', custom: '日' } },
          { id: 'u_n30', pitch: 3, octave: 0, duration: 0.125, isTied: true, lyric: { hanji: '', poj: '', pij: '', custom: '' } },
          { id: 'u_n31', pitch: 2, octave: 0, duration: 0.125, isTied: true, lyric: { hanji: '', poj: '', pij: '', custom: '' } },
          { id: 'u_n32', pitch: 1, octave: 0, duration: 0.5, lyric: { hanji: '怨', poj: 'oàn', pij: 'uàn', custom: '怨' } },
          { id: 'u_n33', pitch: 6, octave: -1, duration: 0.5, isTied: true, lyric: { hanji: '嗟', poj: 'chhe', pij: 'tshe', custom: '嗟' } },
        ],
      },
      {
        id: 'u_m11',
        measureNumber: 11,
        chord: 'F7',
        notes: [
          { id: 'u_n34', pitch: 6, octave: -1, duration: 1.0, lyric: { hanji: '', poj: '', pij: '', custom: '' } },
          { id: 'u_n35', pitch: 0, octave: 0, duration: 1.0, lyric: { hanji: '', poj: '', pij: '', custom: '' } },
        ],
      },
      {
        id: 'u_m12',
        measureNumber: 12,
        chord: 'Bb',
        notes: [
          { id: 'u_n36', pitch: 5, octave: -1, duration: 0.5, lyric: { hanji: '花', poj: 'hoe', pij: 'hue', custom: '花' } },
          { id: 'u_n37', pitch: 6, octave: -1, duration: 0.5, lyric: { hanji: '謝', poj: 'siā', pij: 'siā', custom: '謝' } },
          { id: 'u_n38', pitch: 5, octave: -1, duration: 1.0, lyric: { hanji: '落', poj: 'lo̍h', pij: 'lo̍h', custom: '落' } },
        ],
      },
      {
        id: 'u_m13',
        measureNumber: 13,
        chord: 'Gm',
        notes: [
          { id: 'u_n39', pitch: 3, octave: 0, duration: 2.0, lyric: { hanji: '土', poj: 'thô͘', pij: 'thôo', custom: '土' } },
        ],
      },
      {
        id: 'u_m14',
        measureNumber: 14,
        chord: 'F7',
        notes: [
          { id: 'u_n40', pitch: 3, octave: 0, duration: 0.5, lyric: { hanji: '不', poj: 'put', pij: 'put', custom: '不' } },
          { id: 'u_n41', pitch: 2, octave: 0, duration: 0.5, lyric: { hanji: '再', poj: 'chài', pij: 'tsài', custom: '再' } },
          { id: 'u_n42', pitch: 1, octave: 0, duration: 1.0, isTied: true, lyric: { hanji: '回', poj: 'hôe', pij: 'huê', custom: '回' } },
        ],
      },
      {
        id: 'u_m15',
        measureNumber: 15,
        chord: 'Bb',
        notes: [
          { id: 'u_n43', pitch: 1, octave: 0, duration: 2.0, lyric: { hanji: '', poj: '', pij: '', custom: '' } },
        ],
      },
      {
        id: 'u_m16',
        measureNumber: 16,
        chord: 'Bb',
        section: 'Verse 2',
        notes: [
          { id: 'u_n44', pitch: 5, octave: -1, duration: 0.5, lyric: { hanji: '花', poj: 'Hoe', pij: 'Hue', custom: '花' } },
          { id: 'u_n45', pitch: 6, octave: -1, duration: 0.5, isTied: true, lyric: { hanji: '', poj: '', pij: '', custom: '' } },
          { id: 'u_n46', pitch: 5, octave: -1, duration: 1.0, lyric: { hanji: '落', poj: 'lo̍h', pij: 'lo̍h', custom: '落' } },
        ],
      },
      {
        id: 'u_m17',
        measureNumber: 17,
        chord: 'Gm',
        notes: [
          { id: 'u_n47', pitch: 3, octave: 0, duration: 2.0, lyric: { hanji: '土', poj: 'thô͘', pij: 'thôo', custom: '土' } },
        ],
      },
      {
        id: 'u_m18',
        measureNumber: 18,
        chord: 'Eb',
        notes: [
          { id: 'u_n48', pitch: 3, octave: 0, duration: 0.25, lyric: { hanji: '花', poj: 'hoe', pij: 'hue', custom: '花' } },
          { id: 'u_n49', pitch: 2, octave: 0, duration: 0.25, isTied: true, lyric: { hanji: '', poj: '', pij: '', custom: '' } },
          { id: 'u_n50', pitch: 1, octave: 0, duration: 0.5, lyric: { hanji: '落', poj: 'lo̍h', pij: 'lo̍h', custom: '落' } },
          { id: 'u_n51', pitch: 6, octave: -1, duration: 0.5, isTied: true, lyric: { hanji: '', poj: '', pij: '', custom: '' } },
          { id: 'u_n52', pitch: 5, octave: -1, duration: 0.5, lyric: { hanji: '土', poj: 'thô͘', pij: 'thôo', custom: '土' } },
        ],
      },
      {
        id: 'u_m19',
        measureNumber: 19,
        chord: 'F7',
        notes: [
          { id: 'u_n53', pitch: 1, octave: 0, duration: 0.5, lyric: { hanji: '有', poj: 'ū', pij: 'ū', custom: '有' } },
          { id: 'u_n54', pitch: 2, octave: 0, duration: 0.5, lyric: { hanji: '誰', poj: 'siáⁿ', pij: 'siánn', custom: '誰' } },
          { id: 'u_n55', pitch: 3, octave: 0, duration: 1.0, lyric: { hanji: '人', poj: 'lâng', pij: 'lâng', custom: '人' } },
        ],
      },
      {
        id: 'u_m20',
        measureNumber: 20,
        chord: 'Bb',
        notes: [
          { id: 'u_n56', pitch: 0, octave: 0, duration: 1.0, lyric: { hanji: '', poj: '', pij: '', custom: '' } },
          { id: 'u_n57', pitch: 5, octave: 0, duration: 0.5, lyric: { hanji: '', poj: '', pij: '', custom: '' }, annotation: '口笛' },
          { id: 'u_n58', pitch: 1, octave: 1, duration: 0.25, lyric: { hanji: '', poj: '', pij: '', custom: '' } },
          { id: 'u_n59', pitch: 2, octave: 1, duration: 0.25, lyric: { hanji: '', poj: '', pij: '', custom: '' } },
        ],
      },
      {
        id: 'u_m21',
        measureNumber: 21,
        chord: 'Dm',
        notes: [
          { id: 'u_n60', pitch: 3, octave: 0, duration: 0.5, lyric: { hanji: '通', poj: 'thang', pij: 'thang', custom: '通' } },
          { id: 'u_n61', pitch: 3, octave: 0, duration: 0.5, lyric: { hanji: '看', poj: 'khòaⁿ', pij: 'khuànn', custom: '看' } },
          { id: 'u_n62', pitch: 2, octave: 0, duration: 1.0, isTied: true, lyric: { hanji: '顧', poj: 'kò͘', pij: 'kòo', custom: '顧' } },
        ],
      },
      {
        id: 'u_m22',
        measureNumber: 22,
        chord: 'F7',
        notes: [
          { id: 'u_n63', pitch: 2, octave: 0, duration: 2.0, lyric: { hanji: '', poj: '', pij: '', custom: '' } },
        ],
      },
      {
        id: 'u_m23',
        measureNumber: 23,
        chord: 'Gm',
        notes: [
          { id: 'u_n64', pitch: 0, octave: 0, duration: 1.0, lyric: { hanji: '', poj: '', pij: '', custom: '' } },
          { id: 'u_n65', pitch: 5, octave: 0, duration: 0.5, lyric: { hanji: '無', poj: 'Bô', pij: 'Bô', custom: '無' } },
          { id: 'u_n66', pitch: 5, octave: 0, duration: 0.5, lyric: { hanji: '情', poj: 'chêng', pij: 'tsîng', custom: '情' } },
        ],
      },
      {
        id: 'u_m24',
        measureNumber: 24,
        chord: 'Cm',
        notes: [
          { id: 'u_n67', pitch: 5, octave: 0, duration: 0.5, lyric: { hanji: '風', poj: 'hong', pij: 'hong', custom: '風' } },
          { id: 'u_n68', pitch: 3, octave: 0, duration: 0.25, isTied: true, lyric: { hanji: '', poj: '', pij: '', custom: '' } },
          { id: 'u_n69', pitch: 5, octave: 0, duration: 0.25, isTied: true, lyric: { hanji: '', poj: '', pij: '', custom: '' } },
          { id: 'u_n70', pitch: 3, octave: 0, duration: 1.0, lyric: { hanji: '雨', poj: 'hō͘', pij: 'hōo', custom: '雨' } },
        ],
      },
      {
        id: 'u_m25',
        measureNumber: 25,
        chord: 'F7',
        notes: [
          { id: 'u_n71', pitch: 3, octave: 0, duration: 0.5, lyric: { hanji: '誤', poj: 'gō͘', pij: 'gōo', custom: '誤' } },
          { id: 'u_n72', pitch: 2, octave: 0, duration: 0.25, lyric: { hanji: '阮', poj: 'gún', pij: 'gún', custom: '阮' } },
          { id: 'u_n73', pitch: 3, octave: 0, duration: 0.125, isTied: true, lyric: { hanji: '', poj: '', pij: '', custom: '' } },
          { id: 'u_n74', pitch: 2, octave: 0, duration: 0.125, isTied: true, lyric: { hanji: '', poj: '', pij: '', custom: '' } },
          { id: 'u_n75', pitch: 1, octave: 0, duration: 0.5, lyric: { hanji: '前', poj: 'chiân', pij: 'tsiân', custom: '前' } },
          { id: 'u_n76', pitch: 6, octave: -1, duration: 0.5, isTied: true, lyric: { hanji: '途', poj: 'tô͘', pij: 'tôo', custom: '途' } },
        ],
      },
      {
        id: 'u_m26',
        measureNumber: 26,
        chord: 'F7',
        notes: [
          { id: 'u_n77', pitch: 6, octave: -1, duration: 1.0, lyric: { hanji: '', poj: '', pij: '', custom: '' } },
          { id: 'u_n78', pitch: 0, octave: 0, duration: 1.0, lyric: { hanji: '', poj: '', pij: '', custom: '' } },
        ],
      },
      {
        id: 'u_m27',
        measureNumber: 27,
        chord: 'Bb',
        notes: [
          { id: 'u_n79', pitch: 5, octave: -1, duration: 0.5, lyric: { hanji: '花', poj: 'hoe', pij: 'hue', custom: '花' } },
          { id: 'u_n80', pitch: 6, octave: -1, duration: 0.5, lyric: { hanji: '蕊', poj: 'lúi', pij: 'luí', custom: '蕊' } },
          { id: 'u_n81', pitch: 5, octave: -1, duration: 1.0, lyric: { hanji: '若', poj: 'nā', pij: 'nā', custom: '若' } },
        ],
      },
      {
        id: 'u_m28',
        measureNumber: 28,
        chord: 'Gm',
        notes: [
          { id: 'u_n82', pitch: 3, octave: 0, duration: 2.0, lyric: { hanji: '落', poj: 'lo̍h', pij: 'lo̍h', custom: '落' } },
        ],
      },
      {
        id: 'u_m29',
        measureNumber: 29,
        chord: 'F7',
        notes: [
          { id: 'u_n83', pitch: 3, octave: 0, duration: 0.5, lyric: { hanji: '要', poj: 'beh', pij: 'beh', custom: '要' } },
          { id: 'u_n84', pitch: 2, octave: 0, duration: 0.5, lyric: { hanji: '如', poj: 'jû', pij: 'jû', custom: '如' } },
          { id: 'u_n85', pitch: 1, octave: 0, duration: 1.0, isTied: true, lyric: { hanji: '何', poj: 'hô', pij: 'hô', custom: '何' } },
        ],
      },
      {
        id: 'u_m30',
        measureNumber: 30,
        chord: 'Bb',
        notes: [
          { id: 'u_n86', pitch: 1, octave: 0, duration: 2.0, lyric: { hanji: '', poj: '', pij: '', custom: '' } },
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
          { id: `n-${timestamp}-1`, pitch: 1, octave: 0, duration: 1, lyric: { hanji: '', poj: '', pij: '', custom: '' } },
          { id: `n-${timestamp}-2`, pitch: 2, octave: 0, duration: 1, lyric: { hanji: '', poj: '', pij: '', custom: '' } },
          { id: `n-${timestamp}-3`, pitch: 3, octave: 0, duration: 1, lyric: { hanji: '', poj: '', pij: '', custom: '' } },
          { id: `n-${timestamp}-4`, pitch: 5, octave: 0, duration: 1, lyric: { hanji: '', poj: '', pij: '', custom: '' } },
        ],
      },
    ],
  };
}

