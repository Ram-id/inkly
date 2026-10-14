import type { JSX } from 'preact';
import { KIND_LABEL } from '../../domain/bottle';
import { MOOD_BY_ID, MOODS } from '../../domain/catalog';
import type { MoodId, Slip } from '../../domain/types';

/** A small rolled-up paper, used as the colour marker for a feeling. */
export function PaperRoll({ emotion, size = 1, style }: { emotion: MoodId; size?: number; style?: JSX.CSSProperties }) {
  const m = MOOD_BY_ID[emotion];
  return (
    <span
      class="paper-roll"
      role="img"
      aria-label={m.label}
      title={m.label}
      style={{ '--paper': m.paper, '--edge': m.edge, width: `${30 * size}px`, height: `${12 * size}px`, ...style }}
    />
  );
}

/** An unrolled slip: the paper colour of its feeling, the message in handwriting. */
export function SlipCard({ slip, compact, children }: { slip: Slip; compact?: boolean; children?: preact.ComponentChildren }) {
  const m = MOOD_BY_ID[slip.emotion];
  return (
    <figure class={`slip-card ${compact ? 'compact' : ''}`} style={{ '--paper': m.paper, '--edge': m.edge }}>
      <figcaption class="slip-kind">
        {KIND_LABEL[slip.kind]} · {m.label}
      </figcaption>
      <blockquote class="slip-text">{slip.text}</blockquote>
      {children}
    </figure>
  );
}

// Deterministic pile of paper rolls inside the jar (so it looks the same on every render).
function pile() {
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const rolls: { x: number; y: number; r: number; m: (typeof MOODS)[number] }[] = [];
  const rows = [
    { y: 266, n: 5 },
    { y: 252, n: 5 },
    { y: 238, n: 5 },
    { y: 224, n: 5 },
    { y: 210, n: 5 },
    { y: 196, n: 4 },
    { y: 182, n: 4 },
    { y: 168, n: 5 },
    { y: 154, n: 4 },
    { y: 140, n: 3 }
  ];
  let k = 0;
  for (const row of rows) {
    for (let i = 0; i < row.n; i++) {
      const span = row.n === 5 ? 118 : row.n === 4 ? 104 : 84;
      const x = 120 - span / 2 + (span / (row.n - 1 || 1)) * i + (rnd() - 0.5) * 10;
      rolls.push({ x, y: row.y + (rnd() - 0.5) * 6, r: (rnd() - 0.5) * 70, m: MOODS[(k * 3 + Math.floor(rnd() * 3)) % MOODS.length] });
      k++;
    }
  }
  return rolls;
}
const ROLLS = pile();

/** The glass jar full of rolled papers. */
export function Jar({ shaking, size = 240, dim }: { shaking?: boolean; size?: number; dim?: MoodId | null }) {
  return (
    <svg class={`jar ${shaking ? 'shake' : ''}`} viewBox="0 0 240 300" width={size} height={(size * 300) / 240} role="img" aria-label="Botol kaca berisi gulungan kertas warna-warni">
      <defs>
        <clipPath id="jar-inside">
          <path d="M84 64 h72 v10 c0 8 28 16 28 40 v134 c0 20 -16 32 -36 32 h-56 c-20 0 -36 -12 -36 -32 v-134 c0 -24 28 -32 28 -40 z" />
        </clipPath>
        <linearGradient id="glass" x1="0" x2="1">
          <stop offset="0" stop-color="#ffffff" stop-opacity="0.55" />
          <stop offset="0.5" stop-color="#ffffff" stop-opacity="0.12" />
          <stop offset="1" stop-color="#ffffff" stop-opacity="0.4" />
        </linearGradient>
      </defs>
      {/* shadow */}
      <ellipse cx="120" cy="290" rx="72" ry="7" fill="var(--jar-shadow)" />
      {/* papers */}
      <g clip-path="url(#jar-inside)">
        {ROLLS.map((p, i) => (
          <g key={i} transform={`translate(${p.x} ${p.y}) rotate(${p.r})`} opacity={dim && dim !== p.m.id ? 0.35 : 1}>
            <rect x="-17" y="-6" width="34" height="12" rx="6" fill={p.m.paper} stroke={p.m.edge} stroke-width="1.2" />
            <ellipse cx="13" cy="0" rx="3" ry="5.2" fill={p.m.edge} opacity="0.55" />
            <line x1="-12" y1="-1.5" x2="6" y2="-1.5" stroke={p.m.edge} stroke-width="0.8" opacity="0.5" />
          </g>
        ))}
      </g>
      {/* glass body */}
      <path
        d="M84 64 h72 v10 c0 8 28 16 28 40 v134 c0 20 -16 32 -36 32 h-56 c-20 0 -36 -12 -36 -32 v-134 c0 -24 28 -32 28 -40 z"
        fill="url(#glass)"
        stroke="var(--jar-line)"
        stroke-width="3"
      />
      <path d="M66 126 c0 -10 6 -16 12 -20 v120 c-6 -4 -12 -10 -12 -18 z" fill="#ffffff" opacity="0.5" />
      <path d="M170 130 v40" stroke="#ffffff" stroke-width="4" stroke-linecap="round" opacity="0.45" />
      {/* lip + cork */}
      <rect x="78" y="56" width="84" height="12" rx="6" fill="url(#glass)" stroke="var(--jar-line)" stroke-width="3" />
      <path d="M90 22 h60 a4 4 0 0 1 4 4 l-3 30 h-62 l-3 -30 a4 4 0 0 1 4 -4 z" fill="#C9996A" stroke="#9C6F45" stroke-width="2.5" />
      <path d="M97 32 h46 M96 42 h48" stroke="#9C6F45" stroke-width="1.5" opacity="0.5" stroke-linecap="round" />
      {/* string */}
      <path d="M86 62 c-10 4 -14 14 -8 22" fill="none" stroke="#D96C8C" stroke-width="2.5" stroke-linecap="round" />
      <path d="M154 62 c10 4 14 14 8 22" fill="none" stroke="#D96C8C" stroke-width="2.5" stroke-linecap="round" />
    </svg>
  );
}
