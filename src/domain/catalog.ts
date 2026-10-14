import type { MoodId } from './types';

export interface Mood {
  id: MoodId;
  label: string;
  emoji: string;
  /** 1 (berat) … 5 (sangat baik) — used for the trend chart */
  score: number;
  /** pastel paper colour of this feeling in the bottle */
  paper: string;
  /** deeper shade for the rolled edge, dots and small marks */
  edge: string;
}

/** Paper colours. Identity is always also given by the label, never by colour alone. */
export const MOODS: Mood[] = [
  { id: 'senang', label: 'Senang', emoji: '😊', score: 5, paper: '#FFE48F', edge: '#E9B91F' },
  { id: 'semangat', label: 'Semangat', emoji: '🤩', score: 5, paper: '#FFC49B', edge: '#EE8340' },
  { id: 'tenang', label: 'Tenang', emoji: '😌', score: 4, paper: '#C3EAD3', edge: '#4FAE7C' },
  { id: 'rindu', label: 'Rindu', emoji: '🥺', score: 3, paper: '#FAC9DC', edge: '#E06C99' },
  { id: 'lelah', label: 'Lelah', emoji: '😮‍💨', score: 2, paper: '#E8DDCB', edge: '#B39468' },
  { id: 'cemas', label: 'Cemas', emoji: '😟', score: 2, paper: '#DCCFF6', edge: '#8C6FD6' },
  { id: 'sedih', label: 'Sedih', emoji: '😢', score: 1, paper: '#BFD8F7', edge: '#4F86D3' },
  { id: 'marah', label: 'Marah', emoji: '😠', score: 1, paper: '#F8B3AC', edge: '#D9534A' }
];

export const MOOD_BY_ID: Record<MoodId, Mood> = Object.fromEntries(MOODS.map((m) => [m.id, m])) as Record<
  MoodId,
  Mood
>;

export interface Template {
  id: string;
  name: string;
  emoji: string;
  title: string;
  body: string;
}

export const TEMPLATES: Template[] = [
  {
    id: 'bebas',
    name: 'Tulis bebas',
    emoji: '✍️',
    title: '',
    body: ''
  },
  {
    id: 'syukur',
    name: 'Rasa syukur',
    emoji: '🙏',
    title: 'Hal yang aku syukuri',
    body: 'Tiga hal yang aku syukuri hari ini:\n1. \n2. \n3. \n\nSatu orang yang ingin aku ucapkan terima kasih:\n'
  },
  {
    id: 'refleksi',
    name: 'Refleksi harian',
    emoji: '🌙',
    title: 'Refleksi hari ini',
    body: 'Momen terbaik hari ini:\n\nHal yang menantang:\n\nApa yang aku pelajari:\n\nBesok aku ingin:\n'
  },
  {
    id: 'pagi',
    name: 'Niat pagi',
    emoji: '🌅',
    title: 'Niat pagi ini',
    body: 'Hari ini aku ingin merasa:\n\nTiga prioritas utama:\n1. \n2. \n3. \n\nSatu hal kecil untuk diriku sendiri:\n'
  },
  {
    id: 'perasaan',
    name: 'Cek perasaan',
    emoji: '💭',
    title: 'Apa yang sedang aku rasakan',
    body: 'Perasaanku sekarang:\n\nYang memicu perasaan ini:\n\nYang aku butuhkan saat ini:\n\nKata-kata baik untuk diriku:\n'
  },
  {
    id: 'target',
    name: 'Target & rencana',
    emoji: '🎯',
    title: 'Target minggu ini',
    body: 'Target utama:\n\nLangkah-langkah kecil:\n- \n- \n- \n\nHambatan yang mungkin muncul & solusinya:\n'
  },
  {
    id: 'perjalanan',
    name: 'Catatan perjalanan',
    emoji: '🧳',
    title: 'Perjalanan ke ',
    body: 'Tempat yang aku kunjungi:\n\nMakanan yang aku coba:\n\nOrang yang aku temui:\n\nMomen yang paling berkesan:\n'
  },
  {
    id: 'curhat',
    name: 'Lepas beban',
    emoji: '🫧',
    title: 'Lepas beban',
    body: 'Hal yang sedang mengganggu pikiranku:\n\nYang bisa aku kendalikan:\n\nYang perlu aku lepaskan:\n'
  }
];

export interface StickerGroup {
  name: string;
  items: string[];
}

export const STICKERS: StickerGroup[] = [
  { name: 'Lucu', items: ['🐱', '🐶', '🐰', '🧸', '🐻', '🐼', '🐥', '🦊', '🐸', '🐨', '🦄', '🐝'] },
  { name: 'Alam', items: ['🌸', '🌷', '🌻', '🌿', '🍀', '🌙', '⭐', '☀️', '🌈', '☁️', '🌊', '⛰️'] },
  { name: 'Makanan', items: ['☕', '🍵', '🧋', '🍰', '🍩', '🍓', '🍜', '🍕', '🍦', '🥐', '🍪', '🍉'] },
  { name: 'Hati', items: ['💜', '💗', '💛', '💚', '💙', '🤍', '💖', '💌', '✨', '💫', '🎀', '🫶'] },
  { name: 'Aktivitas', items: ['📚', '✏️', '🎧', '📷', '🎨', '🏃', '🧘', '✈️', '🎮', '🎬', '🛍️', '💻'] }
];

export const WORD_STICKERS: string[] = [
  'good day ✨',
  'small steps',
  'kamu hebat!',
  'self love',
  'hari ini cukup',
  'pelan-pelan saja',
  'thank you',
  'memories'
];

export const TAPE_COLORS = ['#F7C8D0', '#C9E4DE', '#FAEDCB', '#C6DEF1', '#DBCDF0', '#F2C6DE', '#E8D5B7'];

export const PAGE_COLORS = ['#FFFDF8', '#FFF3F5', '#F1F7F2', '#F0F4FB', '#F6F1FB', '#FFF8E7', '#2E2B36'];
