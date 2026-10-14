// Generates the PWA icons in public/ from one SVG: Inky the ink-drop mascot on a blush tile.
// Run: node scripts/icons.mjs
import { Resvg } from '@resvg/resvg-js';
import { writeFileSync } from 'node:fs';

const inky = `
  <defs>
    <linearGradient id="body" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFA8CA"/>
      <stop offset="1" stop-color="#E24F8B"/>
    </linearGradient>
  </defs>
  <path d="M60 6 C74 30 104 52 104 80 a44 44 0 0 1 -88 0 C16 52 46 30 60 6z" fill="url(#body)"/>
  <path d="M38 58 c-6 8 -8 16 -7 24" stroke="#ffffff" stroke-width="6" stroke-linecap="round" fill="none" opacity="0.55"/>
  <ellipse cx="37" cy="93" rx="8.5" ry="5.5" fill="#C2306A" opacity="0.32"/>
  <ellipse cx="83" cy="93" rx="8.5" ry="5.5" fill="#C2306A" opacity="0.32"/>
  <ellipse cx="45" cy="79" rx="5.5" ry="7" fill="#2B2633"/>
  <circle cx="46.8" cy="76.2" r="2.1" fill="#fff"/>
  <ellipse cx="75" cy="79" rx="5.5" ry="7" fill="#2B2633"/>
  <circle cx="76.8" cy="76.2" r="2.1" fill="#fff"/>
  <path d="M52 92 q8 8 16 0" stroke="#2B2633" stroke-width="3.8" stroke-linecap="round" fill="none"/>`;

const heart = (x, y, s, fill) =>
  `<path transform="translate(${x} ${y}) scale(${s})" d="M0 9 C-14 -1 -7 -13 0 -5 C7 -13 14 -1 0 9z" fill="${fill}"/>`;
const sparkle = (x, y, s, fill) =>
  `<path transform="translate(${x} ${y}) scale(${s})" d="M0 -10 Q1.5 -1.5 10 0 Q1.5 1.5 0 10 Q-1.5 1.5 -10 0 Q-1.5 -1.5 0 -10z" fill="${fill}"/>`;

/** `scale` shrinks the artwork for the maskable safe zone; `rounded` gives the tile its corners. */
const svg = (rounded, scale) => {
  const art = 2.75 * scale;
  const ix = 256 - 60 * art;
  const iy = 270 - 68 * art;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="bg" cx="0.5" cy="0.38" r="0.75">
      <stop offset="0" stop-color="#FFF6F9"/>
      <stop offset="1" stop-color="#FFC9DC"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" rx="${rounded ? 116 : 0}" fill="url(#bg)"/>
  <ellipse cx="256" cy="${iy + 124 * art}" rx="${36 * art}" ry="${6 * art}" fill="#E24F8B" opacity="0.14"/>
  <g transform="translate(${ix} ${iy}) scale(${art})">${inky}</g>
  ${heart(256 + 128 * scale, 256 - 112 * scale, 2.6 * scale, '#FF7AAE')}
  ${heart(256 - 140 * scale, 256 + 30 * scale, 1.6 * scale, '#FFA8CA')}
  ${sparkle(256 - 118 * scale, 256 - 118 * scale, 2.2 * scale, '#FFB3D0')}
  ${sparkle(256 + 140 * scale, 256 + 70 * scale, 1.5 * scale, '#FF9DC2')}
</svg>`;
};

const png = (src, size) => new Resvg(src, { fitTo: { mode: 'width', value: size } }).render().asPng();

writeFileSync('public/icon.svg', svg(true, 1));
writeFileSync('public/icon-192.png', png(svg(true, 1), 192));
writeFileSync('public/icon-512.png', png(svg(true, 1), 512));
writeFileSync('public/icon-maskable-512.png', png(svg(false, 0.72), 512));
writeFileSync('public/apple-touch-icon.png', png(svg(false, 0.9), 180));
console.log('icons written to public/');
