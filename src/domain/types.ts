import type { Stroke } from '../media/ink';

/** The feeling behind each paper colour in the bottle. */
export type MoodId = 'senang' | 'semangat' | 'tenang' | 'rindu' | 'lelah' | 'cemas' | 'sedih' | 'marah';

export type SlipKind = 'afirmasi' | 'pertanyaan' | 'penyemangat' | 'langkah';

/** A rolled paper from the bottle. Copied into the entry so it survives catalogue changes. */
export interface Slip {
  id: string;
  emotion: MoodId;
  kind: SlipKind;
  text: string;
}

export interface Photo {
  id: string;
  w: number;
  h: number;
  /** small JPEG data URL, stored inside the (encrypted) entry so lists render offline */
  thumb: string;
}

export type ScrapItemKind = 'sticker' | 'label' | 'text' | 'photo' | 'tape' | 'stamp';

export interface ScrapItem {
  id: string;
  kind: ScrapItemKind;
  /** position of the item's centre, as a fraction of canvas width/height */
  x: number;
  y: number;
  scale: number;
  /** degrees */
  rot: number;
  z: number;
  /** emoji, label/text, photo id, or tape colour */
  content: string;
  color?: string;
  font?: 'hand' | 'sans' | 'serif';
  /** extra text for stamps that carry one (e.g. the date stamp) */
  text?: string;
}

export interface ScrapbookLayout {
  bg: string;
  pattern: 'none' | 'dots' | 'grid' | 'lines';
  items: ScrapItem[];
  /** pen drawings on top of the page */
  ink?: Stroke[];
}

export interface Entry {
  id: string;
  /** the moment the journal is about (user-editable) */
  date: number;
  createdAt: number;
  updatedAt: number;
  title: string;
  body: string;
  /** set from the colour of the paper drawn from the bottle */
  mood?: MoodId;
  slip?: Slip;
  tags: string[];
  photos: Photo[];
  favorite?: boolean;
  templateId?: string;
  scrapbook?: ScrapbookLayout;
  /** stickers and stamps placed anywhere on the journal page (y is a fraction of the page width) */
  decor?: ScrapItem[];
}

export interface UserSettings {
  displayName: string;
  /** recently drawn slip ids, so the bottle does not repeat itself too soon */
  drawnSlips?: string[];
  reminderTime: string;
  weekStartsMonday: boolean;
}

export const DEFAULT_SETTINGS: UserSettings = {
  displayName: '',
  reminderTime: '20:00',
  weekStartsMonday: true
};

/** What gets encrypted inside a synced object. The server never sees the `type`. */
export type ObjectPayload =
  | { type: 'entry'; entry: Entry }
  | { type: 'settings'; settings: UserSettings };

export function newId(): string {
  return crypto.randomUUID();
}

export function emptyEntry(date = Date.now()): Entry {
  return {
    id: newId(),
    date,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    title: '',
    body: '',
    tags: [],
    photos: []
  };
}
