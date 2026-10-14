import { useRef, useState } from 'preact/hooks';
import type { Photo, ScrapbookLayout, ScrapItem } from '../../domain/types';

interface Gesture {
  itemId: string;
  pointers: Map<number, { x: number; y: number }>;
  startPointers: Map<number, { x: number; y: number }>;
  startItem: ScrapItem;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function centroid(ps: Map<number, { x: number; y: number }>) {
  let x = 0;
  let y = 0;
  for (const p of ps.values()) {
    x += p.x;
    y += p.y;
  }
  return { x: x / ps.size, y: y / ps.size };
}

function spread(ps: Map<number, { x: number; y: number }>) {
  const [a, b] = [...ps.values()];
  return { dist: Math.hypot(b.x - a.x, b.y - a.y), angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI };
}

/**
 * Scrapbook page. Positions are stored as fractions of the page and sizes use container
 * units, so the same layout looks identical on any screen width.
 * Editing: drag with one finger, pinch with two fingers to resize and rotate.
 */
export function ScrapCanvas({
  layout,
  photos,
  readOnly,
  selected,
  onSelect,
  onChange
}: {
  layout: ScrapbookLayout;
  photos: Photo[];
  readOnly?: boolean;
  selected?: string | null;
  onSelect?: (id: string | null) => void;
  onChange?: (items: ScrapItem[]) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const [live, setLive] = useState<ScrapItem | null>(null);

  const items = layout.items.map((it) => (live && it.id === live.id ? live : it)).sort((a, b) => a.z - b.z);

  const restart = (g: Gesture, current: ScrapItem) => {
    g.startPointers = new Map(g.pointers);
    g.startItem = current;
  };

  const onItemDown = (e: PointerEvent, item: ScrapItem) => {
    if (readOnly) return;
    e.stopPropagation();
    ref.current!.setPointerCapture(e.pointerId);
    onSelect?.(item.id);
    const g = gesture.current;
    if (g && g.itemId === item.id) {
      g.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      restart(g, live ?? item);
      return;
    }
    const pointers = new Map([[e.pointerId, { x: e.clientX, y: e.clientY }]]);
    gesture.current = { itemId: item.id, pointers, startPointers: new Map(pointers), startItem: item };
    setLive(item);
  };

  const onCanvasDown = (e: PointerEvent) => {
    if (readOnly) return;
    const g = gesture.current;
    if (g && g.pointers.size === 1) {
      // second finger anywhere on the page joins the pinch
      ref.current!.setPointerCapture(e.pointerId);
      g.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      restart(g, live ?? g.startItem);
      return;
    }
    if (!g) onSelect?.(null);
  };

  const onMove = (e: PointerEvent) => {
    const g = gesture.current;
    if (!g || !g.pointers.has(e.pointerId)) return;
    g.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const rect = ref.current!.getBoundingClientRect();
    const c0 = centroid(g.startPointers);
    const c1 = centroid(g.pointers);
    const next: ScrapItem = {
      ...g.startItem,
      x: clamp(g.startItem.x + (c1.x - c0.x) / rect.width, 0, 1),
      y: clamp(g.startItem.y + (c1.y - c0.y) / rect.height, 0, 1)
    };
    if (g.pointers.size >= 2 && g.startPointers.size >= 2) {
      const s0 = spread(g.startPointers);
      const s1 = spread(g.pointers);
      next.scale = clamp(g.startItem.scale * (s1.dist / Math.max(s0.dist, 1)), 0.3, 4);
      next.rot = g.startItem.rot + (s1.angle - s0.angle);
    }
    setLive(next);
  };

  const onUp = (e: PointerEvent) => {
    const g = gesture.current;
    if (!g || !g.pointers.has(e.pointerId)) return;
    g.pointers.delete(e.pointerId);
    const current = live ?? g.startItem;
    if (g.pointers.size === 0) {
      gesture.current = null;
      setLive(null);
      onChange?.(layout.items.map((it) => (it.id === current.id ? current : it)));
    } else {
      restart(g, current);
    }
  };

  return (
    <div
      ref={ref}
      class={`scrap-canvas pattern-${layout.pattern}`}
      style={{ backgroundColor: layout.bg, containerType: 'inline-size' }}
      onPointerDown={onCanvasDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      {items.map((it) => (
        <div
          key={it.id}
          class={`scrap-item ${!readOnly && selected === it.id ? 'selected' : ''}`}
          style={{
            left: `${it.x * 100}%`,
            top: `${it.y * 100}%`,
            transform: `translate(-50%, -50%) rotate(${it.rot}deg) scale(${it.scale})`,
            zIndex: it.z
          }}
          onPointerDown={(e) => onItemDown(e as PointerEvent, it)}
        >
          <ItemBody item={it} photos={photos} />
        </div>
      ))}
    </div>
  );
}

function ItemBody({ item, photos }: { item: ScrapItem; photos: Photo[] }) {
  switch (item.kind) {
    case 'sticker':
      return <div class="scrap-sticker">{item.content}</div>;
    case 'tape':
      return <div class="scrap-tape" style={{ backgroundColor: item.content }} />;
    case 'photo': {
      const p = photos.find((x) => x.id === item.content);
      return <div class="scrap-photo">{p ? <img src={p.thumb} alt="" /> : <div style={{ width: '36cqw', height: '36cqw' }} />}</div>;
    }
    case 'label':
      return <div class="scrap-word">{item.content}</div>;
    case 'text':
      return (
        <div
          class={`scrap-text ${item.font === 'hand' ? 'hand' : item.font === 'serif' ? 'serif' : ''}`}
          style={{ color: item.color ?? '#24222b', fontSize: item.font === 'hand' ? '8cqw' : undefined }}
        >
          {item.content}
        </div>
      );
  }
}
