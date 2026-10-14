export type MoodId = 'senang' | 'semangat' | 'tenang' | 'biasa' | 'lelah' | 'sedih' | 'cemas' | 'marah';

export interface Photo {
  id: string;
  w: number;
  h: number;
  /** small JPEG data URL, stored inside the (encrypted) entry so lists render offline */
  thumb: string;
}

export type ScrapItemKind = 'sticker' | 'label' | 'text' | 'photo' | 'tape';

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
}

export interface ScrapbookLayout {
  bg: string;
  pattern: 'none' | 'dots' | 'grid' | 'lines';
  items: ScrapItem[];
}

export interface Entry {
  id: string;
  /** the moment the journal is about (user-editable) */
  date: number;
  createdAt: number;
  updatedAt: number;
  title: string;
  body: string;
  mood?: MoodId;
  tags: string[];
  photos: Photo[];
  favorite?: boolean;
  templateId?: string;
  scrapbook?: ScrapbookLayout;
}

export interface UserSettings {
  displayName: string;
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
