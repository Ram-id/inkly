/**
 * Photos are re-drawn onto a canvas and re-encoded as JPEG before encryption. Re-encoding
 * drops *all* embedded metadata (EXIF, GPS location, camera serial, XMP), not just one marker.
 */

const MAX_SIDE = 1600;
const THUMB_SIDE = 360;

export interface ProcessedPhoto {
  bytes: Uint8Array;
  w: number;
  h: number;
  thumb: string;
}

async function decode(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // fall through to <img> decoding (older Safari)
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function draw(src: ImageBitmap | HTMLImageElement, maxSide: number): HTMLCanvasElement {
  const sw = 'naturalWidth' in src ? src.naturalWidth : src.width;
  const sh = 'naturalHeight' in src ? src.naturalHeight : src.height;
  const scale = Math.min(1, maxSide / Math.max(sw, sh));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Gagal memproses foto.'))), 'image/jpeg', quality)
  );
}

export async function processPhoto(file: Blob): Promise<ProcessedPhoto> {
  const src = await decode(file);
  const full = draw(src, MAX_SIDE);
  const thumb = draw(src, THUMB_SIDE);
  if ('close' in src) src.close();
  const blob = await toJpeg(full, 0.85);
  return {
    bytes: new Uint8Array(await blob.arrayBuffer()),
    w: full.width,
    h: full.height,
    thumb: thumb.toDataURL('image/jpeg', 0.72)
  };
}
