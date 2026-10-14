import { describe, expect, it } from 'vitest';
import { moodDistribution, searchEntries, streaks, topTags, totals } from '../src/domain/stats';
import { emptyEntry, type Entry } from '../src/domain/types';

const day = (iso: string) => new Date(`${iso}T09:00:00`).getTime();
const e = (iso: string, patch: Partial<Entry> = {}): Entry => ({ ...emptyEntry(day(iso)), ...patch });

describe('stats', () => {
  it('streaks count consecutive days and survive until today ends', () => {
    const entries = [e('2026-10-10'), e('2026-10-11'), e('2026-10-12'), e('2026-10-13'), e('2026-10-01'), e('2026-10-02')];
    const s = streaks(entries, new Date('2026-10-14T08:00:00'));
    expect(s).toEqual({ current: 4, longest: 4, wroteToday: false });
    expect(streaks(entries, new Date('2026-10-16T08:00:00')).current).toBe(0);
  });

  it('totals, moods, tags, search', () => {
    const entries = [
      e('2026-10-12', { title: 'Kopi pagi', body: 'satu dua tiga', mood: 'senang', tags: ['kopi'] }),
      e('2026-10-13', { body: 'empat lima', mood: 'senang', tags: ['kopi', 'kerja'] }),
      e('2026-10-14', { body: 'enam', mood: 'sedih' })
    ];
    expect(totals(entries).words).toBe(8);
    expect(moodDistribution(entries)[0]).toMatchObject({ id: 'senang', count: 2, pct: 67 });
    expect(topTags(entries)[0]).toEqual({ tag: 'kopi', count: 2 });
    expect(searchEntries(entries, 'kopi').length).toBe(2);
    expect(searchEntries(entries, '#kerja').length).toBe(1);
    expect(searchEntries(entries, 'sedih').length).toBe(1);
  });
});
