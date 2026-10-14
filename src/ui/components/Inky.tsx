/** Inky, the little ink-drop mascot. */
export type InkyFace = 'happy' | 'sleepy' | 'wink' | 'love';

export function Inky({ face = 'happy', size = 72, bounce = false }: { face?: InkyFace; size?: number; bounce?: boolean }) {
  return (
    <svg class={`inky ${bounce ? 'bounce' : ''}`} viewBox="0 0 120 130" width={size} height={(size * 130) / 120} aria-hidden="true">
      <defs>
        <linearGradient id="inky-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#FFA8CA" />
          <stop offset="1" stop-color="#E9558F" />
        </linearGradient>
      </defs>
      <ellipse cx="60" cy="124" rx="30" ry="5" fill="var(--jar-shadow)" />
      <path d="M60 6 C74 30 104 52 104 80 a44 44 0 0 1 -88 0 C16 52 46 30 60 6z" fill="url(#inky-body)" />
      <path d="M38 60 c-6 8 -8 16 -7 24" stroke="#ffffff" stroke-width="6" stroke-linecap="round" fill="none" opacity="0.45" />
      {/* cheeks */}
      <ellipse cx="38" cy="92" rx="8" ry="5" fill="#C2306A" opacity="0.35" />
      <ellipse cx="82" cy="92" rx="8" ry="5" fill="#C2306A" opacity="0.35" />
      {/* eyes */}
      {face === 'sleepy' ? (
        <>
          <path d="M40 80 q6 6 12 0" stroke="#2B2633" stroke-width="4" stroke-linecap="round" fill="none" />
          <path d="M68 80 q6 6 12 0" stroke="#2B2633" stroke-width="4" stroke-linecap="round" fill="none" />
        </>
      ) : face === 'love' ? (
        <>
          <path d="M46 84 l-6 -6 a4 4 0 0 1 6 -5 a4 4 0 0 1 6 5z" fill="#B02A5E" />
          <path d="M74 84 l-6 -6 a4 4 0 0 1 6 -5 a4 4 0 0 1 6 5z" fill="#B02A5E" />
        </>
      ) : (
        <>
          <ellipse cx="46" cy="79" rx="5" ry="6.5" fill="#2B2633" />
          <circle cx="47.5" cy="76.5" r="1.8" fill="#fff" />
          {face === 'wink' ? (
            <path d="M68 80 q6 -5 12 0" stroke="#2B2633" stroke-width="4" stroke-linecap="round" fill="none" />
          ) : (
            <>
              <ellipse cx="74" cy="79" rx="5" ry="6.5" fill="#2B2633" />
              <circle cx="75.5" cy="76.5" r="1.8" fill="#fff" />
            </>
          )}
        </>
      )}
      {/* mouth */}
      {face === 'sleepy' ? (
        <ellipse cx="60" cy="96" rx="3.5" ry="3" fill="#2B2633" />
      ) : (
        <path d="M53 93 q7 7 14 0" stroke="#2B2633" stroke-width="3.5" stroke-linecap="round" fill="none" />
      )}
      {face === 'sleepy' && (
        <text x="92" y="40" font-size="18" font-family="Nunito, sans-serif" font-weight="800" fill="#FF8FB8">
          z
        </text>
      )}
    </svg>
  );
}
