// Generates the PWA icons in public/ from one SVG. Run: node scripts/icons.mjs
import { Resvg } from '@resvg/resvg-js';
import { writeFileSync } from 'node:fs';

const glyph = (scale) => {
  // A fountain-pen nib over an ink drop, centred; `scale` shrinks it for the maskable safe zone.
  const t = `translate(256 256) scale(${scale}) translate(-256 -256)`;
  return `
  <g transform="${t}">
    <path d="M256 92c58 74 104 132 104 196a104 104 0 0 1-208 0c0-64 46-122 104-196z" fill="#FAF7F2"/>
    <path d="M256 196l44 70-44 112-44-112z" fill="#D13A72"/>
    <circle cx="256" cy="282" r="13" fill="#FAF7F2"/>
    <path d="M256 295v62" stroke="#FAF7F2" stroke-width="7" stroke-linecap="round"/>
  </g>`;
};

const svg = (rounded, scale) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${rounded ? 116 : 0}" fill="#D13A72"/>
  ${glyph(scale)}
</svg>`;

const png = (src, size) => new Resvg(src, { fitTo: { mode: 'width', value: size } }).render().asPng();

writeFileSync('public/icon.svg', svg(true, 1));
writeFileSync('public/icon-192.png', png(svg(true, 1), 192));
writeFileSync('public/icon-512.png', png(svg(true, 1), 512));
writeFileSync('public/icon-maskable-512.png', png(svg(false, 0.78), 512));
writeFileSync('public/apple-touch-icon.png', png(svg(false, 0.9), 180));
console.log('icons written to public/');
