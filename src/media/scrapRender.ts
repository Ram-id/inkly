import type { Photo, ScrapbookLayout, ScrapItem } from '../domain/types';
import { drawStrokes } from './ink';
import { drawStamp, STAMP_BY_ID } from './stamps';

/**
 * Draws a scrapbook page onto a canvas so it can be downloaded as a picture. Sizes mirror the
 * on-screen CSS, which uses container units (1cqw = 1% of the page width).
 */

const SCREEN_PX = 358; // typical on-screen page width the CSS pixel values were tuned for
const EMOJI = '"Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif';

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
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

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxW && line) {
        out.push(line);
        line = word;
      } else line = test;
    }
    out.push(line);
  }
  return out;
}

function drawPattern(ctx: CanvasRenderingContext2D, layout: ScrapbookLayout, W: number, H: number) {
  const k = W / SCREEN_PX;
  ctx.save();
  if (layout.pattern === 'dots') {
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (let y = 9 * k; y < H; y += 18 * k)
      for (let x = 9 * k; x < W; x += 18 * k) {
        ctx.beginPath();
        ctx.arc(x, y, 1.2 * k, 0, Math.PI * 2);
        ctx.fill();
      }
  } else if (layout.pattern === 'grid' || layout.pattern === 'lines') {
    const step = (layout.pattern === 'grid' ? 22 : 28) * k;
    ctx.strokeStyle = layout.pattern === 'grid' ? 'rgba(0,0,0,0.07)' : 'rgba(0,0,0,0.08)';
    ctx.lineWidth = k;
    for (let y = step; y < H; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    if (layout.pattern === 'grid')
      for (let x = step; x < W; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
  }
  ctx.restore();
}

export async function drawItem(ctx: CanvasRenderingContext2D, it: ScrapItem, W: number, photos: Photo[], photoSrc: (id: string) => Promise<string | null>) {
  const cq = W / 100;
  ctx.save();
  ctx.translate(it.x * W, it.y * (W * 4) / 3);
  ctx.rotate((it.rot * Math.PI) / 180);
  ctx.scale(it.scale, it.scale);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  switch (it.kind) {
    case 'sticker':
      ctx.font = `${15 * cq}px ${EMOJI}`;
      ctx.fillText(it.content, 0, cq);
      break;
    case 'label': {
      ctx.font = `600 ${7.5 * cq}px Caveat, cursive`;
      const w = ctx.measureText(it.content).width + 6 * cq;
      const h = 7.5 * cq * 1.3;
      ctx.shadowColor = 'rgba(0,0,0,0.14)';
      ctx.shadowBlur = 2 * cq;
      ctx.shadowOffsetY = 0.6 * cq;
      ctx.fillStyle = '#fff';
      roundRect(ctx, -w / 2, -h / 2, w, h, 2.5 * cq);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = '#b02a5e';
      ctx.fillText(it.content, 0, 0);
      break;
    }
    case 'text': {
      const size = it.font === 'hand' ? 8 * cq : 5.2 * cq;
      const family = it.font === 'hand' ? 'Caveat, cursive' : it.font === 'serif' ? 'Georgia, serif' : 'Nunito, sans-serif';
      ctx.font = `${it.font === 'hand' ? 600 : 500} ${size}px ${family}`;
      ctx.fillStyle = it.color ?? '#24222b';
      const lines = wrap(ctx, it.content, 62 * cq);
      const lh = size * 1.35;
      lines.forEach((l, i) => ctx.fillText(l, 0, (i - (lines.length - 1) / 2) * lh));
      break;
    }
    case 'photo': {
      const p = photos.find((x) => x.id === it.content);
      const iw = 36 * cq;
      const ih = p ? (iw * p.h) / p.w : iw;
      const pad = 2.2 * cq;
      const fw = iw + pad * 2;
      const fh = ih + pad + 7 * cq;
      ctx.shadowColor = 'rgba(0,0,0,0.22)';
      ctx.shadowBlur = 3 * cq;
      ctx.shadowOffsetY = cq;
      ctx.fillStyle = '#fff';
      ctx.fillRect(-fw / 2, -fh / 2, fw, fh);
      ctx.shadowColor = 'transparent';
      const src = p ? ((await photoSrc(p.id)) ?? p.thumb) : null;
      const img = src ? await loadImage(src) : null;
      if (img) ctx.drawImage(img, -fw / 2 + pad, -fh / 2 + pad, iw, ih);
      break;
    }
    case 'stamp': {
      const def = STAMP_BY_ID[it.content];
      if (!def) break;
      const w = 26 * Math.sqrt(def.aspect) * cq;
      const h = w / def.aspect;
      // stamps punch small holes for the ink texture, so draw them on their own layer first
      const layer = document.createElement('canvas');
      layer.width = Math.ceil(w);
      layer.height = Math.ceil(h);
      drawStamp(layer.getContext('2d')!, def.id, it.color ?? '#D13A72', layer.width, layer.height, it.text ?? '');
      ctx.globalAlpha = 0.92;
      ctx.drawImage(layer, -w / 2, -h / 2, w, h);
      break;
    }
    case 'tape': {
      const w = 34 * cq;
      const h = 8.5 * cq;
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = it.content;
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.rect(-w / 2, -h / 2, w, h);
      ctx.clip();
      for (let x = -w / 2 - h; x < w / 2 + h; x += 3.4 * cq) {
        ctx.beginPath();
        ctx.moveTo(x, h / 2);
        ctx.lineTo(x + h, -h / 2);
        ctx.lineTo(x + h + 1.7 * cq, -h / 2);
        ctx.lineTo(x + 1.7 * cq, h / 2);
        ctx.fill();
      }
      break;
    }
  }
  ctx.restore();
}

export async function renderScrapbook(
  layout: ScrapbookLayout,
  photos: Photo[],
  photoSrc: (id: string) => Promise<string | null>,
  width = 1080
): Promise<HTMLCanvasElement> {
  await Promise.all([document.fonts.load('600 40px Caveat'), document.fonts.load('500 40px Nunito')]).catch(() => {});
  const W = width;
  const H = Math.round((W * 4) / 3);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = layout.bg;
  ctx.fillRect(0, 0, W, H);
  drawPattern(ctx, layout, W, H);
  for (const it of [...layout.items].sort((a, b) => a.z - b.z)) await drawItem(ctx, it, W, photos, photoSrc);
  if (layout.ink?.length) {
    const ink = document.createElement('canvas');
    ink.width = W;
    ink.height = H;
    drawStrokes(ink.getContext('2d')!, layout.ink, W);
    ctx.drawImage(ink, 0, 0);
  }
  return c;
}
