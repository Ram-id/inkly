/**
 * Pen strokes. Points are stored relative to the drawing width (x, y in 0..1 of the width,
 * so a portrait page goes past 1 on y) which keeps drawings sharp at any screen size.
 */

export type InkTool = 'pen' | 'marker' | 'eraser';

export interface Stroke {
  tool: InkTool;
  color: string;
  /** line width as a fraction of the drawing width */
  size: number;
  /** flat list: x, y, pressure, x, y, pressure, … */
  points: number[];
}

export const INK_COLORS = [
  '#2B2633',
  '#D13A72',
  '#FF7AAE',
  '#8C5BD8',
  '#E9473F',
  '#F08A3C',
  '#F2C23A',
  '#4FAE7C',
  '#3E8ED0',
  '#8A5A3C',
  '#FFFFFF'
];

export const INK_SIZES: { id: string; label: string; size: number }[] = [
  { id: 'kecil', label: 'Tipis', size: 0.006 },
  { id: 'sedang', label: 'Sedang', size: 0.012 },
  { id: 'besar', label: 'Tebal', size: 0.024 }
];

const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;

/** Adds a point unless it is too close to the previous one (keeps stored drawings small). */
export function pushPoint(stroke: Stroke, x: number, y: number, p: number): boolean {
  const n = stroke.points.length;
  if (n >= 3) {
    const dx = x - stroke.points[n - 3];
    const dy = y - stroke.points[n - 2];
    if (dx * dx + dy * dy < 0.0015 * 0.0015) return false;
  }
  stroke.points.push(round(x, 4), round(y, 4), round(p, 2));
  return true;
}

function widthFor(s: Stroke, p: number, w: number): number {
  const base = s.size * w;
  if (s.tool === 'marker') return base * 2.2;
  if (s.tool === 'eraser') return base * 2.5;
  return base * (0.45 + p * 1.1);
}

/** Draws one stroke onto a 2D context whose drawing width is `w` pixels. */
export function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke, w: number): void {
  const pts = s.points;
  const n = pts.length / 3;
  if (!n) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;
  if (s.tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = ctx.fillStyle = '#000';
  }
  if (s.tool === 'marker') ctx.globalAlpha = 0.38;

  const X = (i: number) => pts[i * 3] * w;
  const Y = (i: number) => pts[i * 3 + 1] * w;
  const P = (i: number) => pts[i * 3 + 2];

  if (n === 1) {
    ctx.beginPath();
    ctx.arc(X(0), Y(0), widthFor(s, P(0), w) / 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (s.tool === 'pen') {
    // Pressure-sensitive: draw smoothed segments with their own width.
    let mx = X(0);
    let my = Y(0);
    for (let i = 1; i < n; i++) {
      const nx = i < n - 1 ? (X(i) + X(i + 1)) / 2 : X(i);
      const ny = i < n - 1 ? (Y(i) + Y(i + 1)) / 2 : Y(i);
      ctx.beginPath();
      ctx.lineWidth = widthFor(s, (P(i - 1) + P(i)) / 2, w);
      ctx.moveTo(mx, my);
      ctx.quadraticCurveTo(X(i), Y(i), nx, ny);
      ctx.stroke();
      mx = nx;
      my = ny;
    }
  } else {
    // Marker and eraser: one continuous path so overlaps don't darken.
    ctx.beginPath();
    ctx.lineWidth = widthFor(s, 0.5, w);
    ctx.moveTo(X(0), Y(0));
    for (let i = 1; i < n - 1; i++) ctx.quadraticCurveTo(X(i), Y(i), (X(i) + X(i + 1)) / 2, (Y(i) + Y(i + 1)) / 2);
    ctx.lineTo(X(n - 1), Y(n - 1));
    ctx.stroke();
  }
  ctx.restore();
}

export function drawStrokes(ctx: CanvasRenderingContext2D, strokes: Stroke[], w: number): void {
  for (const s of strokes) drawStroke(ctx, s, w);
}

export type PaperStyle = 'polos' | 'krem' | 'garis' | 'titik' | 'kotak' | 'papan';

export const PAPERS: { id: PaperStyle; label: string; bg: string; mark?: string }[] = [
  { id: 'polos', label: 'Polos', bg: '#FFFFFF' },
  { id: 'krem', label: 'Krem', bg: '#FFF6E6' },
  { id: 'garis', label: 'Garis', bg: '#FFFDF8', mark: 'rgba(120,150,210,0.35)' },
  { id: 'titik', label: 'Titik', bg: '#FFFDF8', mark: 'rgba(60,50,80,0.22)' },
  { id: 'kotak', label: 'Kotak', bg: '#FFFFFF', mark: 'rgba(120,150,210,0.25)' },
  { id: 'papan', label: 'Papan', bg: '#2F3A34', mark: 'rgba(255,255,255,0.05)' }
];

/** Paints a paper background (used both on screen and for the downloaded image). */
export function drawPaper(ctx: CanvasRenderingContext2D, style: PaperStyle, w: number, h: number): void {
  const paper = PAPERS.find((p) => p.id === style) ?? PAPERS[0];
  ctx.save();
  ctx.fillStyle = paper.bg;
  ctx.fillRect(0, 0, w, h);
  const step = w / 18;
  if (paper.mark) {
    ctx.strokeStyle = ctx.fillStyle = paper.mark;
    ctx.lineWidth = Math.max(1, w / 600);
    if (style === 'garis') {
      for (let y = step * 1.6; y < h; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
    } else if (style === 'kotak') {
      for (let x = step; x < w; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = step; y < h; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
    } else if (style === 'titik') {
      const r = Math.max(1, w / 400);
      for (let y = step; y < h; y += step)
        for (let x = step; x < w; x += step) {
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
    }
  }
  ctx.restore();
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png', quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Gagal membuat gambar.'))), type, quality));
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

export function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}
