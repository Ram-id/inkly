import { MOOD_BY_ID, MOODS } from './catalog';
import type { Entry, MoodId } from './types';

/** All statistics are computed on the device from decrypted entries; nothing is sent anywhere. */

export function dayKey(ts: number | Date): string {
  const d = new Date(ts);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function wordCount(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

export interface Streaks {
  current: number;
  longest: number;
  wroteToday: boolean;
}

export function streaks(entries: Entry[], today = new Date()): Streaks {
  const days = new Set(entries.map((e) => dayKey(e.date)));
  const wroteToday = days.has(dayKey(today));

  // The current streak survives until the end of today: if nothing is written yet today,
  // count back from yesterday.
  let current = 0;
  let cursor = wroteToday ? today : addDays(today, -1);
  while (days.has(dayKey(cursor))) {
    current++;
    cursor = addDays(cursor, -1);
  }

  const sorted = [...days].sort();
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const k of sorted) {
    if (prev && dayKey(addDays(new Date(`${prev}T12:00:00`), 1)) === k) run++;
    else run = 1;
    longest = Math.max(longest, run);
    prev = k;
  }
  return { current, longest, wroteToday };
}

export interface MoodSlice {
  id: MoodId;
  count: number;
  pct: number;
}

export function moodDistribution(entries: Entry[]): MoodSlice[] {
  const counts = new Map<MoodId, number>();
  for (const e of entries) if (e.mood) counts.set(e.mood, (counts.get(e.mood) ?? 0) + 1);
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  return MOODS.filter((m) => counts.has(m.id))
    .map((m) => ({ id: m.id, count: counts.get(m.id)!, pct: total ? Math.round((counts.get(m.id)! / total) * 100) : 0 }))
    .sort((a, b) => b.count - a.count);
}

export interface TrendPoint {
  day: string;
  /** average mood score that day, or null when no mood was logged */
  score: number | null;
}

export function moodTrend(entries: Entry[], days = 30, today = new Date()): TrendPoint[] {
  const byDay = new Map<string, number[]>();
  for (const e of entries) {
    if (!e.mood) continue;
    const k = dayKey(e.date);
    byDay.set(k, [...(byDay.get(k) ?? []), MOOD_BY_ID[e.mood].score]);
  }
  const out: TrendPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const k = dayKey(addDays(today, -i));
    const scores = byDay.get(k);
    out.push({ day: k, score: scores ? scores.reduce((a, b) => a + b, 0) / scores.length : null });
  }
  return out;
}

export function weekdayCounts(entries: Entry[]): number[] {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const e of entries) counts[new Date(e.date).getDay()]++;
  return counts;
}

export function topTags(entries: Entry[], limit = 8): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const e of entries) for (const t of e.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, limit);
}

export interface Totals {
  entries: number;
  words: number;
  photos: number;
  avgWords: number;
}

export function totals(entries: Entry[]): Totals {
  const words = entries.reduce((n, e) => n + wordCount(e.body) + wordCount(e.title), 0);
  const photos = entries.reduce((n, e) => n + e.photos.length, 0);
  return { entries: entries.length, words, photos, avgWords: entries.length ? Math.round(words / entries.length) : 0 };
}

/** Entries written on this calendar day in previous years or months ("kenangan"). */
export function onThisDay(entries: Entry[], today = new Date()): Entry[] {
  const todayKey = dayKey(today);
  return entries
    .filter((e) => {
      const d = new Date(e.date);
      if (dayKey(d) === todayKey) return false;
      return d.getDate() === today.getDate() && d < today;
    })
    .sort((a, b) => b.date - a.date);
}

export function searchEntries(entries: Entry[], query: string): Entry[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return entries;
  return entries.filter((e) => {
    const hay = `${e.title}\n${e.body}\n${e.tags.join(' ')}\n${e.mood ? MOOD_BY_ID[e.mood].label : ''}`.toLowerCase();
    return terms.every((t) => hay.includes(t.replace(/^#/, '')));
  });
}

export function normalizeTag(raw: string): string {
  return raw.trim().replace(/^#+/, '').toLowerCase().replace(/\s+/g, '-').slice(0, 32);
}
