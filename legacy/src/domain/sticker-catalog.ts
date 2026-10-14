export interface StickerItem {
  id: string;
  name: string;
  category: 'Lucu' | 'Motivasi' | 'Pemandangan';
  svgIcon: string;
}

export const STICKER_CATALOG: StickerItem[] = [
  // Stiker Lucu
  { id: 'stk-cat', name: 'Kucing Imut', category: 'Lucu', svgIcon: '🐱' },
  { id: 'stk-bear', name: 'Beruang Madu', category: 'Lucu', svgIcon: '🧸' },
  { id: 'stk-rabbit', name: 'Kelinci Cantik', category: 'Lucu', svgIcon: '🐰' },
  { id: 'stk-coffee', name: 'Kopi Hangat', category: 'Lucu', svgIcon: '☕' },
  { id: 'stk-camera', name: 'Kamera Retro', category: 'Lucu', svgIcon: '📷' },
  { id: 'stk-good-day', name: 'Good Day Badge', category: 'Lucu', svgIcon: '✨' },

  // Stiker Motivasi
  { id: 'stk-progress', name: 'Small Steps Big Progress', category: 'Motivasi', svgIcon: '🌱' },
  { id: 'stk-you-can', name: 'You Can Do It', category: 'Motivasi', svgIcon: '💪' },
  { id: 'stk-better-days', name: 'Better Days Ahead', category: 'Motivasi', svgIcon: '🌈' },
  { id: 'stk-slow', name: 'It is OK to be Slow', category: 'Motivasi', svgIcon: '🐢' },

  // Stiker Pemandangan
  { id: 'stk-mountain', name: 'Gunung Senja', category: 'Pemandangan', svgIcon: '⛰️' },
  { id: 'stk-flower', name: 'Bunga Sakura', category: 'Pemandangan', svgIcon: '🌸' },
  { id: 'stk-leaves', name: 'Daun Monstera', category: 'Pemandangan', svgIcon: '🌿' },
  { id: 'stk-tape', name: 'Washi Tape Kraft', category: 'Pemandangan', svgIcon: '🩹' }
];

export interface TemplateItem {
  id: string;
  name: string;
  category: 'Minimalis' | 'Aesthetic' | 'Cute';
  previewColor: string;
  defaultElements: any[];
}

export const TEMPLATE_CATALOG: TemplateItem[] = [
  {
    id: 'tpl-aesthetic-01',
    name: 'Aesthetic Scrapbook',
    category: 'Aesthetic',
    previewColor: '#F5EFEB',
    defaultElements: [
      { id: 'el-frame', type: 'tape', x: 40, y: 30, width: 220, height: 280, rotation: -2, zIndex: 1, content: 'polaroid' },
      { id: 'el-stk-flower', type: 'sticker', x: 210, y: 270, width: 60, height: 60, rotation: 15, zIndex: 2, content: 'stk-flower' },
      { id: 'el-text-quote', type: 'text', x: 30, y: 340, width: 260, height: 60, rotation: 0, zIndex: 3, content: 'Progress not perfection ✨' }
    ]
  },
  {
    id: 'tpl-minimalist-01',
    name: 'Clean Minimalist Diary',
    category: 'Minimalis',
    previewColor: '#FFFFFF',
    defaultElements: [
      { id: 'el-min-title', type: 'text', x: 20, y: 20, width: 280, height: 40, rotation: 0, zIndex: 1, content: 'Hari ini dalam tiga kata:' }
    ]
  },
  {
    id: 'tpl-cute-01',
    name: 'Pastel Cute Day',
    category: 'Cute',
    previewColor: '#FFF3F5',
    defaultElements: [
      { id: 'el-stk-bear', type: 'sticker', x: 180, y: 40, width: 80, height: 80, rotation: 8, zIndex: 2, content: 'stk-bear' },
      { id: 'el-stk-good-day', type: 'sticker', x: 30, y: 30, width: 100, height: 40, rotation: -5, zIndex: 2, content: 'stk-good-day' }
    ]
  }
];
