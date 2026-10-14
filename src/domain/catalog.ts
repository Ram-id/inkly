import type { MoodId } from './types';

export interface Mood {
  id: MoodId;
  label: string;
  emoji: string;
  /** 1 (berat) … 5 (sangat baik) — used for the trend chart */
  score: number;
  color: string;
}

export const MOODS: Mood[] = [
  { id: 'senang', label: 'Senang', emoji: '😊', score: 5, color: '#F2B544' },
  { id: 'semangat', label: 'Semangat', emoji: '🤩', score: 5, color: '#EE8B5A' },
  { id: 'tenang', label: 'Tenang', emoji: '😌', score: 4, color: '#6BB592' },
  { id: 'biasa', label: 'Biasa', emoji: '😐', score: 3, color: '#9C9AA8' },
  { id: 'lelah', label: 'Lelah', emoji: '😮‍💨', score: 2, color: '#8C7BC4' },
  { id: 'cemas', label: 'Cemas', emoji: '😟', score: 2, color: '#C98BB8' },
  { id: 'sedih', label: 'Sedih', emoji: '😢', score: 1, color: '#5B8FD0' },
  { id: 'marah', label: 'Marah', emoji: '😠', score: 1, color: '#D9625B' }
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

export const PROMPTS: string[] = [
  'Apa yang membuatmu tersenyum hari ini?',
  'Ceritakan satu hal kecil yang berjalan baik hari ini.',
  'Apa yang sedang kamu nantikan minggu ini?',
  'Siapa orang yang membuat harimu lebih ringan belakangan ini?',
  'Kalau hari ini punya judul film, apa judulnya?',
  'Apa satu hal yang ingin kamu lepaskan?',
  'Kapan terakhir kali kamu merasa benar-benar tenang?',
  'Apa yang kamu pelajari tentang dirimu bulan ini?',
  'Tulis surat singkat untuk dirimu setahun lagi.',
  'Apa kebiasaan kecil yang ingin kamu mulai?',
  'Tempat mana yang membuatmu merasa “pulang”?',
  'Apa yang akan kamu katakan pada dirimu 5 tahun lalu?',
  'Lagu apa yang menggambarkan perasaanmu sekarang?',
  'Apa yang kamu butuhkan tapi belum kamu minta?',
  'Ceritakan percakapan yang masih kamu pikirkan.',
  'Apa pencapaian kecil yang belum sempat kamu rayakan?',
  'Hal apa yang membuatmu penasaran akhir-akhir ini?',
  'Kalau besok hari libur penuh, apa yang akan kamu lakukan?',
  'Apa yang membuatmu merasa dihargai?',
  'Tulis tiga kata yang menggambarkan hari ini, lalu jelaskan.',
  'Apa ketakutan yang ingin kamu hadapi pelan-pelan?',
  'Makanan apa yang punya kenangan khusus untukmu?',
  'Apa yang ingin kamu lakukan lebih sering?',
  'Kapan kamu terakhir kali tertawa lepas?',
  'Apa batasan yang ingin kamu jaga untuk dirimu sendiri?',
  'Tuliskan hal yang kamu banggakan dari dirimu.',
  'Apa yang sedang kamu syukuri dari tubuhmu hari ini?',
  'Apa mimpi kecil yang masih kamu simpan?',
  'Kalau kamu bisa mengulang satu momen hari ini, momen apa itu?',
  'Apa yang akan membuat besok sedikit lebih baik?'
];

export function promptOfTheDay(date = new Date()): string {
  const day = Math.floor(date.getTime() / 86_400_000);
  return PROMPTS[day % PROMPTS.length];
}

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
