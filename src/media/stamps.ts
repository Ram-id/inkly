/**
 * Cute rubber stamps, drawn on a canvas so the same artwork is used on screen and in
 * downloaded pictures. A seeded speckle pass gives each stamp an inked, slightly patchy look.
 */

export type StampGroup = 'bunga' | 'hewan' | 'kata' | 'lainnya';

export interface StampDef {
  id: string;
  label: string;
  group: StampGroup;
  /** width / height */
  aspect: number;
}

export const STAMP_GROUPS: { id: StampGroup; label: string }[] = [
  { id: 'bunga', label: 'Bunga' },
  { id: 'hewan', label: 'Hewan' },
  { id: 'kata', label: 'Kata' },
  { id: 'lainnya', label: 'Lainnya' }
];

export const STAMPS: StampDef[] = [
  { id: 'bunga', label: 'Bunga', group: 'bunga', aspect: 1 },
  { id: 'tulip', label: 'Tulip', group: 'bunga', aspect: 1 },
  { id: 'sakura', label: 'Sakura', group: 'bunga', aspect: 1 },
  { id: 'daisy', label: 'Daisy', group: 'bunga', aspect: 1 },
  { id: 'mawar', label: 'Mawar', group: 'bunga', aspect: 1 },
  { id: 'daun', label: 'Daun', group: 'bunga', aspect: 1 },
  { id: 'kucing', label: 'Kucing', group: 'hewan', aspect: 1 },
  { id: 'kucingduduk', label: 'Kucing duduk', group: 'hewan', aspect: 1 },
  { id: 'kelinci', label: 'Kelinci', group: 'hewan', aspect: 1 },
  { id: 'beruang', label: 'Beruang', group: 'hewan', aspect: 1 },
  { id: 'anjing', label: 'Anjing', group: 'hewan', aspect: 1 },
  { id: 'bebek', label: 'Bebek', group: 'hewan', aspect: 1 },
  { id: 'pinguin', label: 'Pinguin', group: 'hewan', aspect: 1 },
  { id: 'cakar', label: 'Cakar', group: 'hewan', aspect: 1 },
  { id: 'haribaik', label: 'Hari baik', group: 'kata', aspect: 1 },
  { id: 'sayang', label: 'Sayang', group: 'kata', aspect: 1.7 },
  { id: 'peluk', label: 'Peluk', group: 'kata', aspect: 1.7 },
  { id: 'kamuhebat', label: 'Kamu hebat', group: 'kata', aspect: 1.9 },
  { id: 'rindu', label: 'Rindu', group: 'kata', aspect: 1.5 },
  { id: 'oke', label: 'Oke!', group: 'kata', aspect: 1.3 },
  { id: 'lulus', label: 'Lulus', group: 'kata', aspect: 1 },
  { id: 'bintang', label: 'Hebat', group: 'kata', aspect: 1 },
  { id: 'tanggal', label: 'Tanggal', group: 'kata', aspect: 1.9 },
  { id: 'hati', label: 'Hati', group: 'lainnya', aspect: 1 },
  { id: 'pos', label: 'Perangko', group: 'lainnya', aspect: 0.82 },
  { id: 'senyum', label: 'Senyum', group: 'lainnya', aspect: 1 },
  { id: 'mahkota', label: 'Mahkota', group: 'lainnya', aspect: 1.3 }
];

export const STAMP_BY_ID: Record<string, StampDef> = Object.fromEntries(STAMPS.map((s) => [s.id, s]));

export const STAMP_INKS = ['#D13A72', '#E9473F', '#8C5BD8', '#2F6FD6', '#2F9E6A', '#F08A3C', '#2B2633'];

export function todayStampText(d = new Date()): string {
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase().replace('.', '');
}

const TAU = Math.PI * 2;

function heartPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(cx, cy + r * 0.9);
  ctx.bezierCurveTo(cx - r * 1.5, cy - r * 0.1, cx - r * 0.75, cy - r * 1.25, cx, cy - r * 0.45);
  ctx.bezierCurveTo(cx + r * 0.75, cy - r * 1.25, cx + r * 1.5, cy - r * 0.1, cx, cy + r * 0.9);
  ctx.closePath();
}

function starPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, inner = 0.48) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * inner : r;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Writes text along the top (or bottom) of a circle. */
function arcText(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, r: number, bottom = false) {
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) / r;
  let a = bottom ? Math.PI / 2 + total / 2 : -Math.PI / 2 - total / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  chars.forEach((c, i) => {
    const step = widths[i] / r;
    a += bottom ? -step / 2 : step / 2;
    ctx.save();
    ctx.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.rotate(bottom ? a - Math.PI / 2 : a + Math.PI / 2);
    ctx.fillText(c, 0, 0);
    ctx.restore();
    a += bottom ? -step / 2 : step / 2;
  });
}

function ring(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, lw: number) {
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.stroke();
}

function seeded(seed: number) {
  let s = seed || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

function hash(str: string): number {
  let h = 2166136261;
  for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return Math.abs(h);
}

/** Draws a stamp filling a w×h box at the origin. */
export function drawStamp(ctx: CanvasRenderingContext2D, id: string, color: string, w: number, h: number, text = ''): void {
  const u = Math.min(w, h) / 100; // design unit
  const cx = w / 2;
  const cy = h / 2;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const bold = (px: number) => `800 ${px * u}px Nunito, system-ui, sans-serif`;
  const hand = (px: number) => `600 ${px * u}px Caveat, cursive`;

  switch (id) {
    case 'hati':
      heartPath(ctx, cx, cy + 4 * u, 40 * u);
      ctx.fill();
      ctx.globalCompositeOperation = 'destination-out';
      heartPath(ctx, cx, cy + 4 * u, 30 * u);
      ctx.lineWidth = 3 * u;
      ctx.stroke();
      break;
    case 'haribaik':
      ring(ctx, cx, cy, 46 * u, 5 * u);
      ring(ctx, cx, cy, 30 * u, 2.5 * u);
      ctx.font = bold(12);
      arcText(ctx, 'HARI BAIK', cx, cy, 38 * u);
      arcText(ctx, '★ ★ ★', cx, cy, 38 * u, true);
      heartPath(ctx, cx, cy + 2 * u, 15 * u);
      ctx.fill();
      break;
    case 'lulus':
      ring(ctx, cx, cy, 46 * u, 4 * u);
      ring(ctx, cx, cy, 40 * u, 1.5 * u);
      ctx.font = bold(10.5);
      arcText(ctx, 'LULUS HARI INI', cx, cy, 33 * u);
      ctx.lineWidth = 8 * u;
      ctx.beginPath();
      ctx.moveTo(cx - 16 * u, cy + 6 * u);
      ctx.lineTo(cx - 3 * u, cy + 18 * u);
      ctx.lineTo(cx + 19 * u, cy - 8 * u);
      ctx.stroke();
      break;
    case 'sayang':
    case 'peluk': {
      roundRect(ctx, 4 * u, 6 * u, w - 8 * u, h - 12 * u, 12 * u);
      ctx.lineWidth = 5 * u;
      ctx.stroke();
      roundRect(ctx, 10 * u, 12 * u, w - 20 * u, h - 24 * u, 8 * u);
      ctx.lineWidth = 1.8 * u;
      ctx.stroke();
      ctx.font = bold(26);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const word = id === 'sayang' ? 'SAYANG' : 'PELUK';
      const tw = ctx.measureText(word).width;
      ctx.fillText(word, cx - 10 * u, cy + 2 * u);
      heartPath(ctx, cx + tw / 2 + 4 * u, cy + 2 * u, 10 * u);
      ctx.fill();
      break;
    }
    case 'pos': {
      // perforated postage stamp
      const r = 4 * u;
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'destination-out';
      for (let x = r * 2; x < w; x += r * 3) {
        ctx.beginPath();
        ctx.arc(x, 0, r, 0, TAU);
        ctx.arc(x, h, r, 0, TAU);
        ctx.fill();
      }
      for (let y = r * 2; y < h; y += r * 3) {
        ctx.beginPath();
        ctx.arc(0, y, r, 0, TAU);
        ctx.arc(w, y, r, 0, TAU);
        ctx.fill();
      }
      ctx.fillRect(10 * u, 10 * u, w - 20 * u, h - 20 * u);
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineWidth = 2 * u;
      ctx.strokeRect(14 * u, 14 * u, w - 28 * u, h - 28 * u);
      heartPath(ctx, cx, cy - 6 * u, 20 * u);
      ctx.fill();
      ctx.font = bold(13);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('LOVE', cx, h - 28 * u);
      break;
    }
    case 'tanggal': {
      ctx.lineWidth = 4 * u;
      ctx.strokeRect(4 * u, 8 * u, w - 8 * u, h - 16 * u);
      ctx.lineWidth = 1.5 * u;
      ctx.strokeRect(9 * u, 13 * u, w - 18 * u, h - 26 * u);
      ctx.font = bold(22);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text || todayStampText(), cx, cy + u, w - 26 * u);
      break;
    }
    case 'cakar':
      ctx.beginPath();
      ctx.ellipse(cx, cy + 14 * u, 22 * u, 18 * u, 0, 0, TAU);
      ctx.fill();
      for (const [dx, dy, rx] of [
        [-30, -10, 9],
        [-12, -28, 10],
        [12, -28, 10],
        [30, -10, 9]
      ]) {
        ctx.beginPath();
        ctx.ellipse(cx + dx * u, cy + dy * u, rx * u, rx * 1.25 * u, dx * 0.02, 0, TAU);
        ctx.fill();
      }
      break;
    case 'bunga':
      for (let i = 0; i < 6; i++) {
        const a = (i * TAU) / 6;
        ctx.beginPath();
        ctx.ellipse(cx + Math.cos(a) * 24 * u, cy + Math.sin(a) * 24 * u, 17 * u, 13 * u, a, 0, TAU);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(cx, cy, 14 * u, 0, TAU);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.beginPath();
      ctx.arc(cx, cy, 8 * u, 0, TAU);
      ctx.fill();
      break;
    case 'bintang':
      starPath(ctx, cx, cy + 3 * u, 47 * u);
      ctx.fill();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.font = bold(14);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('HEBAT', cx, cy + 8 * u);
      break;
    case 'senyum':
      ring(ctx, cx, cy, 43 * u, 6 * u);
      ctx.beginPath();
      ctx.ellipse(cx - 15 * u, cy - 10 * u, 5 * u, 8 * u, 0, 0, TAU);
      ctx.ellipse(cx + 15 * u, cy - 10 * u, 5 * u, 8 * u, 0, 0, TAU);
      ctx.fill();
      ctx.lineWidth = 6 * u;
      ctx.beginPath();
      ctx.arc(cx, cy + 2 * u, 22 * u, 0.2 * Math.PI, 0.8 * Math.PI);
      ctx.stroke();
      break;
    case 'kucing': {
      ctx.lineWidth = 5.5 * u;
      ctx.beginPath();
      ctx.moveTo(cx - 36 * u, cy + 6 * u);
      ctx.lineTo(cx - 34 * u, cy - 38 * u);
      ctx.lineTo(cx - 12 * u, cy - 20 * u);
      ctx.quadraticCurveTo(cx, cy - 24 * u, cx + 12 * u, cy - 20 * u);
      ctx.lineTo(cx + 34 * u, cy - 38 * u);
      ctx.lineTo(cx + 36 * u, cy + 6 * u);
      ctx.bezierCurveTo(cx + 36 * u, cy + 44 * u, cx - 36 * u, cy + 44 * u, cx - 36 * u, cy + 6 * u);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx - 14 * u, cy + 2 * u, 5 * u, 0, TAU);
      ctx.arc(cx + 14 * u, cy + 2 * u, 5 * u, 0, TAU);
      ctx.fill();
      ctx.lineWidth = 3 * u;
      ctx.beginPath();
      ctx.moveTo(cx - 6 * u, cy + 14 * u);
      ctx.quadraticCurveTo(cx - 3 * u, cy + 19 * u, cx, cy + 14 * u);
      ctx.quadraticCurveTo(cx + 3 * u, cy + 19 * u, cx + 6 * u, cy + 14 * u);
      ctx.stroke();
      break;
    }
    case 'mahkota':
      ctx.beginPath();
      ctx.moveTo(cx - 44 * u, cy + 22 * u);
      ctx.lineTo(cx - 48 * u, cy - 22 * u);
      ctx.lineTo(cx - 22 * u, cy);
      ctx.lineTo(cx, cy - 34 * u);
      ctx.lineTo(cx + 22 * u, cy);
      ctx.lineTo(cx + 48 * u, cy - 22 * u);
      ctx.lineTo(cx + 44 * u, cy + 22 * u);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(cx - 44 * u, cy + 27 * u, 88 * u, 9 * u);
      ctx.globalCompositeOperation = 'destination-out';
      for (const dx of [-24, 0, 24]) {
        ctx.beginPath();
        ctx.arc(cx + dx * u, cy + 10 * u, 5 * u, 0, TAU);
        ctx.fill();
      }
      break;
    case 'oke': {
      roundRect(ctx, 6 * u, 6 * u, w - 12 * u, h - 30 * u, 18 * u);
      ctx.lineWidth = 5 * u;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(26 * u, h - 25 * u);
      ctx.lineTo(18 * u, h - 6 * u);
      ctx.lineTo(42 * u, h - 25 * u);
      ctx.stroke();
      ctx.font = bold(30);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('OKE!', cx, (h - 24 * u) / 2 + 4 * u);
      break;
    }
    case 'rindu': {
      ctx.lineWidth = 5 * u;
      ctx.beginPath();
      const b = h * 0.68;
      ctx.moveTo(18 * u, b);
      ctx.bezierCurveTo(-4 * u, b, 0, b - 34 * u, 24 * u, b - 32 * u);
      ctx.bezierCurveTo(28 * u, b - 62 * u, 70 * u, b - 66 * u, 80 * u, b - 40 * u);
      ctx.bezierCurveTo(96 * u, b - 64 * u, 136 * u, b - 52 * u, 128 * u, b - 26 * u);
      ctx.bezierCurveTo(152 * u, b - 24 * u, 150 * u, b, 130 * u, b);
      ctx.closePath();
      ctx.stroke();
      ctx.font = hand(34);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('rindu', cx, b - 20 * u);
      break;
    }
    case 'kamuhebat': {
      // ribbon banner
      ctx.beginPath();
      ctx.moveTo(4 * u, 20 * u);
      ctx.lineTo(w - 4 * u, 20 * u);
      ctx.lineTo(w - 18 * u, cy + 2 * u);
      ctx.lineTo(w - 4 * u, h - 20 * u);
      ctx.lineTo(4 * u, h - 20 * u);
      ctx.lineTo(18 * u, cy + 2 * u);
      ctx.closePath();
      ctx.fill();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.font = hand(36);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('kamu hebat!', cx, cy + 2 * u);
      break;
    }
    // ------------------------------------------------------------ flowers
    case 'tulip': {
      ctx.lineWidth = 5 * u;
      ctx.beginPath();
      ctx.moveTo(cx, cy + 46 * u);
      ctx.quadraticCurveTo(cx - 3 * u, cy + 20 * u, cx, cy - 4 * u);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(cx - 15 * u, cy + 28 * u, 15 * u, 6 * u, -0.6, 0, TAU);
      ctx.ellipse(cx + 14 * u, cy + 20 * u, 14 * u, 5.5 * u, 0.65, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx - 25 * u, cy - 38 * u);
      ctx.lineTo(cx - 12 * u, cy - 24 * u);
      ctx.lineTo(cx, cy - 42 * u);
      ctx.lineTo(cx + 12 * u, cy - 24 * u);
      ctx.lineTo(cx + 25 * u, cy - 38 * u);
      ctx.quadraticCurveTo(cx + 28 * u, cy + 2 * u, cx, cy + 2 * u);
      ctx.quadraticCurveTo(cx - 28 * u, cy + 2 * u, cx - 25 * u, cy - 38 * u);
      ctx.closePath();
      ctx.fill();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = 2.2 * u;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 30 * u);
      ctx.quadraticCurveTo(cx - 3 * u, cy - 14 * u, cx, cy - 2 * u);
      ctx.stroke();
      break;
    }
    case 'sakura':
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i * TAU) / 5;
        ctx.beginPath();
        ctx.ellipse(cx + Math.cos(a) * 23 * u, cy + Math.sin(a) * 23 * u, 13 * u, 20 * u, a + Math.PI / 2, 0, TAU);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i * TAU) / 5;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * 44 * u, cy + Math.sin(a) * 44 * u, 5 * u, 0, TAU);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(cx, cy, 9 * u, 0, TAU);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + Math.PI / 5 + (i * TAU) / 5;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * 5 * u, cy + Math.sin(a) * 5 * u, 2.2 * u, 0, TAU);
        ctx.fill();
      }
      break;
    case 'daisy':
      for (let i = 0; i < 14; i++) {
        const a = (i * TAU) / 14;
        ctx.beginPath();
        ctx.ellipse(cx + Math.cos(a) * 28 * u, cy + Math.sin(a) * 28 * u, 17 * u, 5.5 * u, a, 0, TAU);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(cx, cy, 14 * u, 0, TAU);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.beginPath();
      ctx.arc(cx, cy, 10.5 * u, 0, TAU);
      ctx.fill();
      ctx.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 7; i++) {
        const a = (i * TAU) / 7;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * 5.5 * u, cy + Math.sin(a) * 5.5 * u, 1.4 * u, 0, TAU);
        ctx.fill();
      }
      break;
    case 'mawar': {
      // leaves
      ctx.beginPath();
      ctx.ellipse(cx - 24 * u, cy + 33 * u, 17 * u, 7.5 * u, -0.55, 0, TAU);
      ctx.ellipse(cx + 24 * u, cy + 33 * u, 17 * u, 7.5 * u, 0.55, 0, TAU);
      ctx.fill();
      // scalloped bloom
      const hy = cy - 6 * u;
      ctx.beginPath();
      ctx.arc(cx, hy, 27 * u, 0, TAU);
      ctx.fill();
      for (let i = 0; i < 9; i++) {
        const a = (i * TAU) / 9;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * 26 * u, hy + Math.sin(a) * 26 * u, 10 * u, 0, TAU);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = 3 * u;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let t = 0.6; t < 4.6 * Math.PI; t += 0.08) {
        const r = (2 + t * 2) * u;
        const x = cx + Math.cos(t) * r;
        const y = hy + Math.sin(t) * r * 0.9;
        if (t === 0.6) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      break;
    }
    case 'daun': {
      // a sprig: curved stem with almond leaves on alternating sides
      const P0 = [cx - 6 * u, cy + 47 * u];
      const P1 = [cx + 12 * u, cy + 4 * u];
      const P2 = [cx + 2 * u, cy - 36 * u];
      const at = (t: number) => [
        (1 - t) ** 2 * P0[0] + 2 * (1 - t) * t * P1[0] + t * t * P2[0],
        (1 - t) ** 2 * P0[1] + 2 * (1 - t) * t * P1[1] + t * t * P2[1]
      ];
      ctx.lineWidth = 5 * u;
      ctx.beginPath();
      ctx.moveTo(P0[0], P0[1]);
      ctx.quadraticCurveTo(P1[0], P1[1], P2[0], P2[1]);
      ctx.stroke();
      const leaves: [number, number, number][] = [
        [0.2, -2.6, 36],
        [0.36, -0.5, 36],
        [0.53, -2.5, 32],
        [0.69, -0.6, 29],
        [0.84, -2.4, 24],
        [1, -1.75, 20]
      ];
      for (const [t, ang, len] of leaves) {
        const [x, y] = at(t);
        const L = len * u;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(ang);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(L * 0.5, -L * 0.42, L, 0);
        ctx.quadraticCurveTo(L * 0.5, L * 0.42, 0, 0);
        ctx.fill();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = 1.6 * u;
        ctx.beginPath();
        ctx.moveTo(L * 0.18, 0);
        ctx.lineTo(L * 0.8, 0);
        ctx.stroke();
        ctx.restore();
      }
      break;
    }
    // ------------------------------------------------------------ animals
    case 'kucingduduk': {
      ctx.lineWidth = 7 * u;
      ctx.beginPath();
      ctx.moveTo(cx + 18 * u, cy + 40 * u);
      ctx.bezierCurveTo(cx + 46 * u, cy + 40 * u, cx + 46 * u, cy + 4 * u, cx + 34 * u, cy - 2 * u);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(cx, cy + 20 * u, 24 * u, 26 * u, 0, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy - 16 * u, 18 * u, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx - 17 * u, cy - 22 * u);
      ctx.lineTo(cx - 15 * u, cy - 44 * u);
      ctx.lineTo(cx - 3 * u, cy - 32 * u);
      ctx.moveTo(cx + 17 * u, cy - 22 * u);
      ctx.lineTo(cx + 15 * u, cy - 44 * u);
      ctx.lineTo(cx + 3 * u, cy - 32 * u);
      ctx.fill();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.ellipse(cx - 7 * u, cy - 17 * u, 2.6 * u, 3.6 * u, 0, 0, TAU);
      ctx.ellipse(cx + 7 * u, cy - 17 * u, 2.6 * u, 3.6 * u, 0, 0, TAU);
      ctx.fill();
      ctx.lineWidth = 2 * u;
      ctx.beginPath();
      ctx.moveTo(cx - 4 * u, cy - 9 * u);
      ctx.quadraticCurveTo(cx - 2 * u, cy - 6 * u, cx, cy - 9 * u);
      ctx.quadraticCurveTo(cx + 2 * u, cy - 6 * u, cx + 4 * u, cy - 9 * u);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - 8 * u, cy + 38 * u);
      ctx.lineTo(cx - 8 * u, cy + 30 * u);
      ctx.moveTo(cx + 8 * u, cy + 38 * u);
      ctx.lineTo(cx + 8 * u, cy + 30 * u);
      ctx.stroke();
      break;
    }
    case 'kelinci': {
      ctx.beginPath();
      ctx.ellipse(cx - 13 * u, cy - 26 * u, 9.5 * u, 24 * u, -0.18, 0, TAU);
      ctx.ellipse(cx + 13 * u, cy - 26 * u, 9.5 * u, 24 * u, 0.18, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx, cy + 16 * u, 30 * u, 27 * u, 0, 0, TAU);
      ctx.fill();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.ellipse(cx - 13 * u, cy - 28 * u, 4 * u, 15 * u, -0.18, 0, TAU);
      ctx.ellipse(cx + 13 * u, cy - 28 * u, 4 * u, 15 * u, 0.18, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx - 11 * u, cy + 10 * u, 3.8 * u, 0, TAU);
      ctx.arc(cx + 11 * u, cy + 10 * u, 3.8 * u, 0, TAU);
      ctx.fill();
      heartPath(ctx, cx, cy + 19 * u, 3.4 * u);
      ctx.fill();
      ctx.lineWidth = 2 * u;
      ctx.beginPath();
      ctx.moveTo(cx - 6 * u, cy + 25 * u);
      ctx.quadraticCurveTo(cx - 3 * u, cy + 29 * u, cx, cy + 24 * u);
      ctx.quadraticCurveTo(cx + 3 * u, cy + 29 * u, cx + 6 * u, cy + 25 * u);
      ctx.stroke();
      break;
    }
    case 'beruang': {
      ctx.beginPath();
      ctx.arc(cx - 27 * u, cy - 24 * u, 13 * u, 0, TAU);
      ctx.arc(cx + 27 * u, cy - 24 * u, 13 * u, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy + 4 * u, 34 * u, 0, TAU);
      ctx.fill();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(cx - 27 * u, cy - 24 * u, 6.5 * u, 0, TAU);
      ctx.arc(cx + 27 * u, cy - 24 * u, 6.5 * u, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx - 13 * u, cy - 4 * u, 4.2 * u, 0, TAU);
      ctx.arc(cx + 13 * u, cy - 4 * u, 4.2 * u, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx, cy + 17 * u, 14 * u, 11 * u, 0, 0, TAU);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.beginPath();
      ctx.ellipse(cx, cy + 13 * u, 5.5 * u, 4 * u, 0, 0, TAU);
      ctx.fill();
      ctx.lineWidth = 2.2 * u;
      ctx.beginPath();
      ctx.moveTo(cx, cy + 16 * u);
      ctx.lineTo(cx, cy + 21 * u);
      ctx.moveTo(cx - 5 * u, cy + 22 * u);
      ctx.quadraticCurveTo(cx, cy + 25 * u, cx + 5 * u, cy + 22 * u);
      ctx.stroke();
      break;
    }
    case 'anjing': {
      ctx.beginPath();
      ctx.ellipse(cx, cy + 6 * u, 27 * u, 30 * u, 0, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx - 30 * u, cy - 2 * u, 11 * u, 24 * u, 0.45, 0, TAU);
      ctx.ellipse(cx + 30 * u, cy - 2 * u, 11 * u, 24 * u, -0.45, 0, TAU);
      ctx.fill();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = 2.5 * u;
      ctx.beginPath();
      ctx.ellipse(cx - 30 * u, cy - 2 * u, 11 * u, 24 * u, 0.45, -0.2, 1.2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(cx + 30 * u, cy - 2 * u, 11 * u, 24 * u, -0.45, Math.PI - 1.2, Math.PI + 0.2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx - 11 * u, cy - 2 * u, 4.2 * u, 0, TAU);
      ctx.arc(cx + 11 * u, cy - 2 * u, 4.2 * u, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx, cy + 16 * u, 13 * u, 10 * u, 0, 0, TAU);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.beginPath();
      ctx.ellipse(cx, cy + 12 * u, 5.5 * u, 4 * u, 0, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx, cy + 22 * u, 3.5 * u, 4.5 * u, 0, 0, Math.PI);
      ctx.fill();
      break;
    }
    case 'bebek': {
      ctx.beginPath();
      ctx.ellipse(cx + 6 * u, cy + 18 * u, 34 * u, 21 * u, 0, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx + 36 * u, cy + 10 * u);
      ctx.lineTo(cx + 46 * u, cy - 2 * u);
      ctx.lineTo(cx + 40 * u, cy + 18 * u);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx - 14 * u, cy - 14 * u, 18 * u, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx - 36 * u, cy - 9 * u, 11 * u, 5.5 * u, 0.1, 0, TAU);
      ctx.fill();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(cx - 17 * u, cy - 18 * u, 3.6 * u, 0, TAU);
      ctx.fill();
      ctx.lineWidth = 2.4 * u;
      ctx.beginPath();
      ctx.moveTo(cx - 44 * u, cy - 9 * u);
      ctx.lineTo(cx - 28 * u, cy - 9 * u);
      ctx.stroke();
      ctx.lineWidth = 3 * u;
      ctx.beginPath();
      ctx.moveTo(cx - 4 * u, cy + 14 * u);
      ctx.quadraticCurveTo(cx + 12 * u, cy + 28 * u, cx + 26 * u, cy + 12 * u);
      ctx.stroke();
      break;
    }
    case 'pinguin': {
      ctx.beginPath();
      ctx.ellipse(cx - 12 * u, cy + 44 * u, 9 * u, 4.5 * u, 0, 0, TAU);
      ctx.ellipse(cx + 12 * u, cy + 44 * u, 9 * u, 4.5 * u, 0, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx, cy + 4 * u, 27 * u, 38 * u, 0, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx - 27 * u, cy + 12 * u, 7 * u, 18 * u, 0.35, 0, TAU);
      ctx.ellipse(cx + 27 * u, cy + 12 * u, 7 * u, 18 * u, -0.35, 0, TAU);
      ctx.fill();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.moveTo(cx, cy - 16 * u);
      ctx.bezierCurveTo(cx - 24 * u, cy - 26 * u, cx - 24 * u, cy + 40 * u, cx, cy + 38 * u);
      ctx.bezierCurveTo(cx + 24 * u, cy + 40 * u, cx + 24 * u, cy - 26 * u, cx, cy - 16 * u);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx - 9 * u, cy - 18 * u, 3.6 * u, 0, TAU);
      ctx.arc(cx + 9 * u, cy - 18 * u, 3.6 * u, 0, TAU);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.beginPath();
      ctx.moveTo(cx - 6 * u, cy - 8 * u);
      ctx.lineTo(cx + 6 * u, cy - 8 * u);
      ctx.lineTo(cx, cy);
      ctx.closePath();
      ctx.fill();
      break;
    }
  }

  // ink speckle: tiny random gaps so it looks pressed by hand
  ctx.globalCompositeOperation = 'destination-out';
  const rnd = seeded(hash(id + color + text));
  for (let i = 0; i < 140; i++) {
    ctx.globalAlpha = 0.25 + rnd() * 0.6;
    ctx.beginPath();
    ctx.arc(rnd() * w, rnd() * h, (0.4 + rnd() * 1.6) * u, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

const cache = new Map<string, string>();

/** PNG data URL of a stamp for display (cached). */
export function stampUrl(id: string, color: string, text = '', height = 220): string {
  const key = `${id}|${color}|${text}|${height}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const def = STAMP_BY_ID[id] ?? STAMPS[0];
  const c = document.createElement('canvas');
  c.height = height;
  c.width = Math.round(height * def.aspect);
  drawStamp(c.getContext('2d')!, def.id, color, c.width, c.height, text);
  const url = c.toDataURL('image/png');
  cache.set(key, url);
  return url;
}

export function clearStampCache(): void {
  cache.clear();
}
