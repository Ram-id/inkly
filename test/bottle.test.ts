import { describe, expect, it } from 'vitest';
import { drawSlip, randomQuestion, slipsFor } from '../src/domain/bottle';
import { MOODS } from '../src/domain/catalog';
import { SLIPS } from '../src/domain/slips';

describe('feelings bottle', () => {
  it('has papers of every kind for every colour', () => {
    for (const m of MOODS) {
      const kinds = new Set(slipsFor(m.id).map((s) => s.kind));
      expect([...kinds].sort(), m.id).toEqual(['afirmasi', 'langkah', 'penyemangat', 'pertanyaan']);
      expect(slipsFor(m.id).length, m.id).toBeGreaterThanOrEqual(30);
    }
  });

  it('slip ids are unique and texts are short enough for the paper', () => {
    expect(new Set(SLIPS.map((s) => s.id)).size).toBe(SLIPS.length);
    for (const s of SLIPS) expect(s.text.length, s.text).toBeLessThanOrEqual(130);
  });

  it('draws the chosen colour and does not repeat until the colour runs out', () => {
    const pool = slipsFor('sedih');
    let recent: string[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < pool.length; i++) {
      const res = drawSlip('sedih', recent);
      expect(res.slip.emotion).toBe('sedih');
      expect(seen.has(res.slip.id)).toBe(false);
      seen.add(res.slip.id);
      recent = res.recent;
    }
    // everything drawn recently: still returns a paper instead of failing
    expect(drawSlip('sedih', pool.map((s) => s.id)).slip.emotion).toBe('sedih');
  });

  it('random question matches the feeling when given', () => {
    const q = randomQuestion('cemas');
    expect(q.kind).toBe('pertanyaan');
    expect(q.emotion).toBe('cemas');
  });
});
