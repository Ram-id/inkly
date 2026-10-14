import type { RefObject } from 'preact';
import { useRef, useState } from 'preact/hooks';
import type { ScrapItem } from '../../domain/types';

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
 * Drag with one finger, pinch with two to resize and rotate. Positions are fractions of the
 * container width; `y` is a fraction of the height for fixed pages, or of the width for
 * pages that grow with their content (`yByWidth`).
 */
export function useItemGestures({
  ref,
  items,
  readOnly,
  yByWidth = false,
  onSelect,
  onChange,
  onTapEmpty
}: {
  ref: RefObject<HTMLDivElement>;
  items: ScrapItem[];
  readOnly?: boolean;
  yByWidth?: boolean;
  onSelect?: (id: string | null) => void;
  onChange?: (items: ScrapItem[]) => void;
  onTapEmpty?: (x: number, y: number) => void;
}) {
  const gesture = useRef<Gesture | null>(null);
  const tap = useRef<{ id: number; x: number; y: number } | null>(null);
  const [live, setLive] = useState<ScrapItem | null>(null);

  const restart = (g: Gesture, current: ScrapItem) => {
    g.startPointers = new Map(g.pointers);
    g.startItem = current;
  };

  const itemDown = (e: PointerEvent, item: ScrapItem) => {
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

  const onPointerDown = (e: PointerEvent) => {
    if (readOnly) return;
    const g = gesture.current;
    if (g && g.pointers.size === 1) {
      // a second finger anywhere joins the pinch
      ref.current!.setPointerCapture(e.pointerId);
      g.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      restart(g, live ?? g.startItem);
      return;
    }
    if (!g) {
      onSelect?.(null);
      tap.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    }
  };

  const onPointerMove = (e: PointerEvent) => {
    const g = gesture.current;
    if (!g || !g.pointers.has(e.pointerId)) return;
    g.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const rect = ref.current!.getBoundingClientRect();
    const c0 = centroid(g.startPointers);
    const c1 = centroid(g.pointers);
    const yUnit = yByWidth ? rect.width : rect.height;
    const next: ScrapItem = {
      ...g.startItem,
      x: clamp(g.startItem.x + (c1.x - c0.x) / rect.width, 0, 1),
      y: clamp(g.startItem.y + (c1.y - c0.y) / yUnit, 0, rect.height / yUnit)
    };
    if (g.pointers.size >= 2 && g.startPointers.size >= 2) {
      const s0 = spread(g.startPointers);
      const s1 = spread(g.pointers);
      next.scale = clamp(g.startItem.scale * (s1.dist / Math.max(s0.dist, 1)), 0.3, 4);
      next.rot = g.startItem.rot + (s1.angle - s0.angle);
    }
    setLive(next);
  };

  const onPointerUp = (e: PointerEvent) => {
    const t = tap.current;
    if (t && t.id === e.pointerId) {
      tap.current = null;
      // a short tap on empty space (not a scroll) places something there
      if (e.type === 'pointerup' && Math.hypot(e.clientX - t.x, e.clientY - t.y) < 10 && onTapEmpty) {
        const rect = ref.current!.getBoundingClientRect();
        onTapEmpty((e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / (yByWidth ? rect.width : rect.height));
      }
    }
    const g = gesture.current;
    if (!g || !g.pointers.has(e.pointerId)) return;
    g.pointers.delete(e.pointerId);
    const current = live ?? g.startItem;
    if (g.pointers.size === 0) {
      gesture.current = null;
      setLive(null);
      onChange?.(items.map((it) => (it.id === current.id ? current : it)));
    } else {
      restart(g, current);
    }
  };

  const shown = items.map((it) => (live && it.id === live.id ? live : it)).sort((a, b) => a.z - b.z);
  return {
    shown,
    itemDown,
    handlers: {
      onPointerDown: (e: Event) => onPointerDown(e as PointerEvent),
      onPointerMove: (e: Event) => onPointerMove(e as PointerEvent),
      onPointerUp: (e: Event) => onPointerUp(e as PointerEvent),
      onPointerCancel: (e: Event) => onPointerUp(e as PointerEvent)
    }
  };
}
