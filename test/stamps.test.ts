import { describe, expect, it } from 'vitest';
import { STAMP_GROUPS, STAMPS } from '../src/media/stamps';

describe('stamps', () => {
  it('every stamp has a unique id and belongs to a group that has stamps', () => {
    expect(new Set(STAMPS.map((s) => s.id)).size).toBe(STAMPS.length);
    for (const g of STAMP_GROUPS) expect(STAMPS.some((s) => s.group === g.id), g.id).toBe(true);
    expect(STAMPS.filter((s) => s.group === 'bunga').length).toBeGreaterThanOrEqual(6);
    expect(STAMPS.filter((s) => s.group === 'hewan').length).toBeGreaterThanOrEqual(8);
  });
});
