/**
 * Cute rubber stamps, drawn on a canvas so the same artwork is used on screen and in
 * downloaded pictures. A seeded speckle pass gives each stamp an inked, slightly patchy look.
 */

export interface StampDef {
  id: string;
  label: string;
  /** width / height */
  aspect: number;
}

export const STAMPS: StampDef[] = [
  { id: 'hati', label: 'Hati', aspect: 1 },
  { id: 'haribaik', label: 'Hari baik', aspect: 1 },
  { id: 'sayang', label: 'Sayang', aspect: 1.7 },
  { id: 'pos', label: 'Perangko', aspect: 0.82 },
  { id: 'lulus', label: 'Lulus', aspect: 1 },
  { id: 'tanggal', label: 'Tanggal', aspect: 1.9 },
  { id: 'cakar', label: 'Cakar', aspect: 1 },
  { id: 'bunga', label: 'Bunga', aspect: 1 },
  { id: 'bintang', label: 'Hebat', aspect: 1 },
  { id: 'peluk', label: 'Peluk', aspect: 1.7 },
  { id: 'senyum', label: 'Senyum', aspect: 1 },
  { id: 'kucing', label: 'Kucing', aspect: 1 },
  { id: 'mahkota', label: 'Mahkota', aspect: 1.3 },
  { id: 'oke', label: 'Oke!', aspect: 1.3 },
  { id: 'rindu', label: 'Rindu', aspect: 1.5 },
  { id: 'kamuhebat', label: 'Kamu hebat', aspect: 1.9 }
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
