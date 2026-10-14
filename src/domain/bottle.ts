import { SLIPS } from './slips';
import type { MoodId, Slip, SlipKind } from './types';

export const KIND_LABEL: Record<SlipKind, string> = {
  afirmasi: 'Afirmasi untukmu',
  pertanyaan: 'Pertanyaan untukmu',
  penyemangat: 'Pesan kecil untukmu',
  langkah: 'Langkah kecil'
};

const RECENT_LIMIT = 60;

export function slipsFor(emotion: MoodId): Slip[] {
  return SLIPS.filter((s) => s.emotion === emotion);
}

/**
 * Draws one paper of the given colour, avoiding the ones drawn recently.
 * Returns the slip and the updated "recently drawn" list to store (encrypted) in settings.
 */
export function drawSlip(emotion: MoodId, recent: string[] = [], rand: () => number = Math.random): { slip: Slip; recent: string[] } {
  const pool = slipsFor(emotion);
  const fresh = pool.filter((s) => !recent.includes(s.id));
  const from = fresh.length ? fresh : pool;
  const slip = from[Math.floor(rand() * from.length)];
  const next = [slip.id, ...recent.filter((id) => id !== slip.id)].slice(0, RECENT_LIMIT);
  return { slip, recent: next };
}

export function randomQuestion(emotion?: MoodId, rand: () => number = Math.random): Slip {
  const pool = SLIPS.filter((s) => s.kind === 'pertanyaan' && (!emotion || s.emotion === emotion));
  return pool[Math.floor(rand() * pool.length)];
}
