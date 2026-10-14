import { describe, expect, it } from 'vitest';
import { pushPoint, type Stroke } from '../src/media/ink';

describe('pen strokes', () => {
  it('stores rounded points and skips points that barely moved', () => {
    const s: Stroke = { tool: 'pen', color: '#000', size: 0.01, points: [] };
    expect(pushPoint(s, 0.123456, 0.5, 0.333)).toBe(true);
    expect(pushPoint(s, 0.1235, 0.5, 0.5)).toBe(false);
    expect(pushPoint(s, 0.2, 0.6, 0.5)).toBe(true);
    expect(s.points).toEqual([0.1235, 0.5, 0.33, 0.2, 0.6, 0.5]);
  });
});
