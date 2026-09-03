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
  {
    id: 'bang-chhun-hong',
    title: '望春風 (Bāng Chhun-hong)',
    subtitle: 'Taiwanese Classic Folk Song (鄧雨賢 曲 / 李臨秋 詞)',
    composer: '鄧雨賢 (Tēng Ú-hiân)',
    lyricist: '李臨秋 (Lí Lîm-chhiu)',
    key: 'F',
    timeSignature: '4/4',
    bpm: 76,
    notesPerLine: 4,
    description: 'The most iconic Taiwanese song. Authentic pentatonic melody with complete Hanji, POJ (Pe̍h-ōe-jī), and PIJ (Tâi-lô) aligned.',
    measures: [
      {
        id: 'm1',
        measureNumber: 1,
        chord: 'F',
        section: 'Verse 1',
        notes: [
          { id: 'n1', pitch: 5, octave: -1, duration: 0.5, lyric: { hanji: '獨', poj: 'To̍k', pij: 'To̍k', custom: '獨' } },
          { id: 'n2', pitch: 6, octave: -1, duration: 0.5, lyric: { hanji: '夜', poj: 'iā', pij: 'iā', custom: '夜' } },
          { id: 'n3', pitch: 1, octave: 0, duration: 1, lyric: { hanji: '無', poj: 'bô', pij: 'bô', custom: '無' } },
          { id: 'n4', pitch: 2, octave: 0, duration: 1, lyric: { hanji: '伴', poj: 'phōaⁿ', pij: 'phuānn', custom: '伴' } },
          { id: 'n5', pitch: 1, octave: 0, duration: 0.5, lyric: { hanji: '守', poj: 'siú', pij: 'siú', custom: '守' } },
          { id: 'n6', pitch: 2, octave: 0, duration: 0.5, lyric: { hanji: '燈', poj: 'teng', pij: 'ting', custom: '燈' } },
        ],
      },
      {
        id: 'm2',
        measureNumber: 2,
        chord: 'Dm',
        notes: [
          { id: 'n7', pitch: 3, octave: 0, duration: 2, lyric: { hanji: '下', poj: 'ē', pij: 'ē', custom: '下' } },
          { id: 'n8', pitch: 3, octave: 0, duration: 0.5, lyric: { hanji: '清', poj: 'chheng', pij: 'tshing', custom: '清' } },
          { id: 'n9', pitch: 5, octave: 0, duration: 0.5, lyric: { hanji: '風', poj: 'hong', pij: 'hong', custom: '風' } },
          { id: 'n10', pitch: 6, octave: 0, duration: 0.5, lyric: { hanji: '對', poj: 'tùi', pij: 'tuì', custom: '對' } },
          { id: 'n11', pitch: 5, octave: 0, duration: 0.5, lyric: { hanji: '面', poj: 'bīn', pij: 'bīn', custom: '面' } },
        ],
      },
      {
        id: 'm3',
        measureNumber: 3,
        chord: 'Gm',
        notes: [
          { id: 'n12', pitch: 3, octave: 0, duration: 1.5, isDotted: true, lyric: { hanji: '吹', poj: 'chhoe', pij: 'tshue', custom: '吹' } },
          { id: 'n13', pitch: 2, octave: 0, duration: 0.5, lyric: { hanji: '，', poj: '', pij: '', custom: '' } },
          { id: 'n14', pitch: 1, octave: 0, duration: 2, lyric: { hanji: '—', poj: '', pij: '', custom: '' } },
        ],
      },
      {
        id: 'm4',
        measureNumber: 4,
        chord: 'C7',
        notes: [
          { id: 'n15', pitch: 5, octave: -1, duration: 0.5, lyric: { hanji: '十', poj: 'Cha̍p', pij: 'Tsa̍p', custom: '十' } },
          { id: 'n16', pitch: 6, octave: -1, duration: 0.5, lyric: { hanji: '七', poj: 'chhit', pij: 'tshit', custom: '七' } },
          { id: 'n17', pitch: 1, octave: 0, duration: 1, lyric: { hanji: '八', poj: 'poeh', pij: 'pueh', custom: '八' } },
          { id: 'n18', pitch: 2, octave: 0, duration: 1, lyric: { hanji: '歲', poj: 'hòe', pij: 'huè', custom: '歲' } },
          { id: 'n19', pitch: 1, octave: 0, duration: 0.5, lyric: { hanji: '未', poj: 'bōe', pij: 'buē', custom: '未' } },
          { id: 'n20', pitch: 2, octave: 0, duration: 0.5, lyric: { hanji: '出', poj: 'chhut', pij: 'tshut', custom: '出' } },
        ],
      },
      {
        id: 'm5',
        measureNumber: 5,
        chord: 'F',
        notes: [
          { id: 'n21', pitch: 3, octave: 0, duration: 2, lyric: { hanji: '嫁', poj: 'kè', pij: 'kè', custom: '嫁' } },
          { id: 'n22', pitch: 2, octave: 0, duration: 0.5, lyric: { hanji: '見', poj: 'chìⁿ', pij: 'tsìnn', custom: '見' } },
          { id: 'n23', pitch: 3, octave: 0, duration: 0.5, lyric: { hanji: '著', poj: 'tio̍h', pij: 'tio̍h', custom: '著' } },
          { id: 'n24', pitch: 5, octave: 0, duration: 0.5, lyric: { hanji: '少', poj: 'siàu', pij: 'siàu', custom: '少' } },
          { id: 'n25', pitch: 6, octave: 0, duration: 0.5, lyric: { hanji: '年', poj: 'liân', pij: 'liân', custom: '年' } },
        ],
      },
      {
        id: 'm6',
        measureNumber: 6,
        chord: 'C7',
        notes: [
          { id: 'n26', pitch: 5, octave: 0, duration: 3, isDotted: true, lyric: { hanji: '家', poj: 'ke', pij: 'ke', custom: '家' } },
          { id: 'n27', pitch: 0, octave: 0, duration: 1, lyric: { hanji: '', poj: '', pij: '', custom: '' } },
        ],
      },
      {
        id: 'm7',
        measureNumber: 7,
        chord: 'F',
        section: 'Chorus',
        notes: [
          { id: 'n28', pitch: 6, octave: 0, duration: 1, lyric: { hanji: '透', poj: 'Thàu', pij: 'Thàu', custom: '透' } },
          { id: 'n29', pitch: 6, octave: 0, duration: 1, lyric: { hanji: '南', poj: 'lâm', pij: 'lâm', custom: '南' } },
          { id: 'n30', pitch: 5, octave: 0, duration: 0.5, lyric: { hanji: '風', poj: 'hong', pij: 'hong', custom: '風' } },
          { id: 'n31', pitch: 3, octave: 0, duration: 0.5, lyric: { hanji: '吹', poj: 'chhoe', pij: 'tshue', custom: '吹' } },
          { id: 'n32', pitch: 2, octave: 1, duration: 1, lyric: { hanji: '開', poj: 'khui', pij: 'khui', custom: '開' } },
        ],
      },
      {
        id: 'm8',
        measureNumber: 8,
        chord: 'Bb',
        notes: [
          { id: 'n33', pitch: 1, octave: 0, duration: 1.5, isDotted: true, lyric: { hanji: '花', poj: 'hoe', pij: 'hue', custom: '花' } },
          { id: 'n34', pitch: 2, octave: 0, duration: 0.5, lyric: { hanji: '，', poj: '', pij: '', custom: '' } },
          { id: 'n35', pitch: 3, octave: 0, duration: 2, lyric: { hanji: '—', poj: '', pij: '', custom: '' } },
        ],
      },
      {
        id: 'm9',
        measureNumber: 9,
        chord: 'F',
        notes: [
          { id: 'n36', pitch: 5, octave: 0, duration: 1, lyric: { hanji: '開', poj: 'Khui', pij: 'Khui', custom: '開' } },
          { id: 'n37', pitch: 3, octave: 0, duration: 1, lyric: { hanji: '開', poj: 'khui', pij: 'khui', custom: '開' } },
          { id: 'n38', pitch: 2, octave: 0, duration: 0.5, lyric: { hanji: '紅', poj: 'âng', pij: 'âng', custom: '紅' } },
          { id: 'n39', pitch: 1, octave: 0, duration: 0.5, lyric: { hanji: '蕊', poj: 'lúi', pij: 'luí', custom: '蕊' } },
          { id: 'n40', pitch: 2, octave: 0, duration: 1, lyric: { hanji: '給', poj: 'hō͘', pij: 'hōo', custom: 'hō͘' } },
        ],
      },
      {
        id: 'm10',
        measureNumber: 10,
        chord: 'C7',
        notes: [
          { id: 'n41', pitch: 3, octave: 0, duration: 3, isDotted: true, lyric: { hanji: '人', poj: 'lâng', pij: 'lâng', custom: '人' } },
          { id: 'n42', pitch: 2, octave: 0, duration: 1, lyric: { hanji: '摘', poj: 'tiah', pij: 'tiah', custom: '摘' } },
        ],
      },
      {
        id: 'm11',
        measureNumber: 11,
        chord: 'F',
        notes: [
          { id: 'n43', pitch: 1, octave: 0, duration: 1.5, isDotted: true, lyric: { hanji: '想', poj: 'Siūⁿ', pij: 'Siūnn', custom: '想' } },
          { id: 'n44', pitch: 2, octave: 0, duration: 0.5, lyric: { hanji: '欲', poj: 'beh', pij: 'beh', custom: '欲' } },
          { id: 'n45', pitch: 3, octave: 0, duration: 1, lyric: { hanji: '問', poj: 'mn̄g', pij: 'mn̄g', custom: '問' } },
          { id: 'n46', pitch: 5, octave: 0, duration: 1, lyric: { hanji: '伊', poj: 'i', pij: 'i', custom: '伊' } },
        ],
      },
      {
        id: 'm12',
        measureNumber: 12,
        chord: 'Dm',
        notes: [
          { id: 'n47', pitch: 6, octave: 0, duration: 2, lyric: { hanji: '驚', poj: 'kiaⁿ', pij: 'kiann', custom: '驚' } },
          { id: 'n48', pitch: 5, octave: 0, duration: 0.5, lyric: { hanji: '歹', poj: 'pháiⁿ', pij: 'pháinn', custom: '歹' } },
          { id: 'n49', pitch: 3, octave: 0, duration: 0.5, lyric: { hanji: '勢', poj: 'sè', pij: 'sè', custom: '勢' } },
          { id: 'n50', pitch: 2, octave: 0, duration: 1, lyric: { hanji: '，', poj: '', pij: '', custom: '' } },
        ],
      },
      {
        id: 'm13',
        measureNumber: 13,
        chord: 'Gm',
        notes: [
          { id: 'n51', pitch: 1, octave: 0, duration: 1.5, isDotted: true, lyric: { hanji: '心', poj: 'Sim', pij: 'Sim', custom: '心' } },
          { id: 'n52', pitch: 2, octave: 0, duration: 0.5, lyric: { hanji: '內', poj: 'lāi', pij: 'lāi', custom: '內' } },
          { id: 'n53', pitch: 3, octave: 0, duration: 0.5, lyric: { hanji: '彈', poj: 'tôaⁿ', pij: 'tuânn', custom: '彈' } },
          { id: 'n54', pitch: 2, octave: 0, duration: 0.5, lyric: { hanji: '琴', poj: 'khîm', pij: 'khîm', custom: '琴' } },
          { id: 'n55', pitch: 1, octave: 0, duration: 0.5, lyric: { hanji: '向', poj: 'hiòng', pij: 'hiòng', custom: '向' } },
          { id: 'n56', pitch: 2, octave: 0, duration: 0.5, lyric: { hanji: '春', poj: 'chhun', pij: 'tshun', custom: '春' } },
        ],
      },
      {
        id: 'm14',
        measureNumber: 14,
        chord: 'F',
        notes: [
          { id: 'n57', pitch: 1, octave: 0, duration: 3, isDotted: true, lyric: { hanji: '風', poj: 'hong', pij: 'hong', custom: '風' } },
          { id: 'n58', pitch: 0, octave: 0, duration: 1, lyric: { hanji: '', poj: '', pij: '', custom: '' } },
        ],
      },
    ],
  },
  {
    id: 'ai-pian-tsiah-e-iann',
    title: '愛拚才會贏 (Ài Piàⁿ Tsiah Ē Iâⁿ)',
    subtitle: 'Classic Han-lô Motivational Anthem (陳百潭 詞曲)',
    composer: '陳百潭 (Tân Pek-thâm)',
    lyricist: '陳百潭 (Tân Pek-thâm)',
    key: 'C',
    timeSignature: '4/4',
    bpm: 88,
    notesPerLine: 4,
    description: 'Hanji mixed with POJ/PIJ lyrics demonstrating authentic modern Han-lô notation and lively melody.',
    measures: [
      {
        id: 'a_m1',
        measureNumber: 1,
        chord: 'C',
        section: 'Verse 1',
        notes: [
          { id: 'a_n1', pitch: 3, octave: 0, duration: 0.5, lyric: { hanji: '一', poj: 'Chi̍t', pij: 'Tsi̍t', custom: 'Chi̍t' } },
          { id: 'a_n2', pitch: 5, octave: 0, duration: 0.5, lyric: { hanji: '時', poj: 'sî', pij: 'sî', custom: 'sî' } },
          { id: 'a_n3', pitch: 6, octave: 0, duration: 1, lyric: { hanji: '落', poj: 'lo̍h', pij: 'lo̍h', custom: 'lo̍h' } },
          { id: 'a_n4', pitch: 5, octave: 0, duration: 1, lyric: { hanji: '魄', poj: 'phek', pij: 'phik', custom: '魄' } },
          { id: 'a_n5', pitch: 3, octave: 0, duration: 0.5, lyric: { hanji: '不', poj: 'm̄', pij: 'm̄', custom: 'm̄' } },
          { id: 'a_n6', pitch: 2, octave: 0, duration: 0.5, lyric: { hanji: '免', poj: 'bián', pij: 'bián', custom: '免' } },
        ],
      },
      {
        id: 'a_m2',
        measureNumber: 2,
        chord: 'Am',
        notes: [
          { id: 'a_n7', pitch: 3, octave: 0, duration: 1, lyric: { hanji: '膽', poj: 'táⁿ', pij: 'tánn', custom: '膽' } },
          { id: 'a_n8', pitch: 1, octave: 0, duration: 2, lyric: { hanji: '寒', poj: 'hân', pij: 'hân', custom: '寒' } },
          { id: 'a_n9', pitch: 0, octave: 0, duration: 1, lyric: { hanji: '', poj: '', pij: '', custom: '' } },
        ],
      },
      {
        id: 'a_m3',
        measureNumber: 3,
        chord: 'F',
        notes: [
          { id: 'a_n10', pitch: 6, octave: 0, duration: 0.5, lyric: { hanji: '一', poj: 'chi̍t', pij: 'tsi̍t', custom: 'chi̍t' } },
          { id: 'a_n11', pitch: 1, octave: 1, duration: 0.5, lyric: { hanji: '時', poj: 'sî', pij: 'sî', custom: 'sî' } },
          { id: 'a_n12', pitch: 6, octave: 0, duration: 1, lyric: { hanji: '得', poj: 'tek', pij: 'tik', custom: '得' } },
          { id: 'a_n13', pitch: 5, octave: 0, duration: 1, lyric: { hanji: '意', poj: 'ì', pij: 'ì', custom: '意' } },
          { id: 'a_n14', pitch: 3, octave: 0, duration: 0.5, lyric: { hanji: '不', poj: 'm̄', pij: 'm̄', custom: 'm̄' } },
          { id: 'a_n15', pitch: 2, octave: 0, duration: 0.5, lyric: { hanji: '免', poj: 'bián', pij: 'bián', custom: '免' } },
        ],
      },
      {
        id: 'a_m4',
        measureNumber: 4,
        chord: 'G',
        notes: [
          { id: 'a_n16', pitch: 3, octave: 0, duration: 1, lyric: { hanji: '心', poj: 'sim', pij: 'sim', custom: '心' } },
          { id: 'a_n17', pitch: 2, octave: 0, duration: 2, lyric: { hanji: '狂', poj: 'kông', pij: 'kông', custom: '狂' } },
          { id: 'a_n18', pitch: 0, octave: 0, duration: 1, lyric: { hanji: '', poj: '', pij: '', custom: '' } },
        ],
      },
      {
        id: 'a_m5',
        measureNumber: 5,
        chord: 'C',
        section: 'Chorus',
        notes: [
          { id: 'a_n19', pitch: 1, octave: 0, duration: 1, lyric: { hanji: '三', poj: 'Saⁿ', pij: 'Sann', custom: 'Saⁿ' } },
          { id: 'a_n20', pitch: 2, octave: 0, duration: 1, lyric: { hanji: '分', poj: 'hun', pij: 'hun', custom: '分' } },
          { id: 'a_n21', pitch: 3, octave: 0, duration: 1, lyric: { hanji: '天', poj: 'thiⁿ', pij: 'thinn', custom: 'thiⁿ' } },
          { id: 'a_n22', pitch: 5, octave: 0, duration: 1, lyric: { hanji: '註', poj: 'chù', pij: 'tsù', custom: '註' } },
        ],
      },
      {
        id: 'a_m6',
        measureNumber: 6,
        chord: 'Am',
        notes: [
          { id: 'a_n23', pitch: 6, octave: 0, duration: 2, lyric: { hanji: '定', poj: 'tiāⁿ', pij: 'tiānn', custom: '定' } },
          { id: 'a_n24', pitch: 5, octave: 0, duration: 1, lyric: { hanji: '七', poj: 'chhit', pij: 'tshit', custom: '七' } },
          { id: 'a_n25', pitch: 3, octave: 0, duration: 1, lyric: { hanji: '分', poj: 'hun', pij: 'hun', custom: '分' } },
        ],
      },
      {
        id: 'a_m7',
        measureNumber: 7,
        chord: 'F',
        notes: [
          { id: 'a_n26', pitch: 2, octave: 0, duration: 1, lyric: { hanji: '靠', poj: 'khò', pij: 'khò', custom: '靠' } },
          { id: 'a_n27', pitch: 1, octave: 0, duration: 1, lyric: { hanji: '打', poj: 'phah', pij: 'phah', custom: 'phah' } },
          { id: 'a_n28', pitch: 2, octave: 0, duration: 2, lyric: { hanji: '拚', poj: 'piàⁿ', pij: 'piànn', custom: 'piàⁿ' } },
        ],
      },
      {
        id: 'a_m8',
        measureNumber: 8,
        chord: 'C',
        notes: [
          { id: 'a_n29', pitch: 1, octave: 0, duration: 0.5, lyric: { hanji: '愛', poj: 'Ài', pij: 'Ài', custom: 'Ài' } },
          { id: 'a_n30', pitch: 2, octave: 0, duration: 0.5, lyric: { hanji: '拚', poj: 'piàⁿ', pij: 'piànn', custom: 'piàⁿ' } },
          { id: 'a_n31', pitch: 3, octave: 0, duration: 0.5, lyric: { hanji: '才', poj: 'tsiah', pij: 'tsiah', custom: 'tsiah' } },
          { id: 'a_n32', pitch: 2, octave: 0, duration: 0.5, lyric: { hanji: '會', poj: 'ē', pij: 'ē', custom: 'ē' } },
          { id: 'a_n33', pitch: 1, octave: 0, duration: 2, lyric: { hanji: '贏', poj: 'iâⁿ', pij: 'iânn', custom: 'iâⁿ' } },
        ],
      },
    ],
  },
  {
    id: 'blank-composer',
    title: '我的台語新歌 (My Taigi Composition)',
    subtitle: 'Custom Composition Template',
    composer: 'Composer',
    lyricist: 'Lyricist',
    key: 'C',
    timeSignature: '4/4',
    bpm: 80,
    notesPerLine: 4,
    description: 'Empty starter score with 4 blank measures ready for your own Taigi melody and lyrics.',
    measures: [
      {
        id: 'b_m1',
        measureNumber: 1,
        chord: 'C',
        section: 'Verse 1',
        notes: [
          { id: 'b_n1', pitch: 1, octave: 0, duration: 1, lyric: { hanji: '阮', poj: 'Gún', pij: 'Gún', custom: '阮' } },
          { id: 'b_n2', pitch: 2, octave: 0, duration: 1, lyric: { hanji: 'ê', poj: 'ê', pij: 'ê', custom: 'ê' } },
          { id: 'b_n3', pitch: 3, octave: 0, duration: 1, lyric: { hanji: '故', poj: 'kò͘', pij: 'kòo', custom: '故' } },
          { id: 'b_n4', pitch: 5, octave: 0, duration: 1, lyric: { hanji: '鄉', poj: 'hiong', pij: 'hiong', custom: '鄉' } },
        ],
      },
      {
        id: 'b_m2',
        measureNumber: 2,
        chord: 'Am',
        notes: [
          { id: 'b_n5', pitch: 6, octave: 0, duration: 1, lyric: { hanji: '美', poj: 'Bí', pij: 'Bí', custom: '美' } },
          { id: 'b_n6', pitch: 5, octave: 0, duration: 1, lyric: { hanji: '麗', poj: 'lē', pij: 'lē', custom: '麗' } },
          { id: 'b_n7', pitch: 3, octave: 0, duration: 2, lyric: { hanji: '島', poj: 'tó', pij: 'tó', custom: '島' } },
        ],
      },
      {
        id: 'b_m3',
        measureNumber: 3,
        chord: 'F',
        notes: [
          { id: 'b_n8', pitch: 2, octave: 0, duration: 1, lyric: { hanji: '海', poj: 'Hái', pij: 'Hái', custom: '海' } },
          { id: 'b_n9', pitch: 3, octave: 0, duration: 1, lyric: { hanji: '風', poj: 'hong', pij: 'hong', custom: '風' } },
          { id: 'b_n10', pitch: 2, octave: 0, duration: 1, lyric: { hanji: '微', poj: 'bî', pij: 'bî', custom: '微' } },
          { id: 'b_n11', pitch: 1, octave: 0, duration: 1, lyric: { hanji: '微', poj: 'bî', pij: 'bî', custom: '微' } },
        ],
      },
      {
        id: 'b_m4',
        measureNumber: 4,
        chord: 'G',
        notes: [
          { id: 'b_n12', pitch: 2, octave: 0, duration: 3, isDotted: true, lyric: { hanji: '吹', poj: 'chhoe', pij: 'tshue', custom: '吹' } },
          { id: 'b_n13', pitch: 0, octave: 0, duration: 1, lyric: { hanji: '', poj: '', pij: '', custom: '' } },
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

