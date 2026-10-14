import { useEffect, useRef, useState } from 'preact/hooks';
import type { Photo, ScrapbookLayout, ScrapItem } from '../../domain/types';
import type { Stroke } from '../../media/ink';
import { STAMP_BY_ID, stampUrl, clearStampCache } from '../../media/stamps';
import { InkSurface } from './InkSurface';
import type { InkSettings } from './InkTools';
import { useItemGestures } from './itemGestures';

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
  onChange,
  inkMode,
  onInk,
  onTapEmpty
}: {
  layout: ScrapbookLayout;
  photos: Photo[];
  readOnly?: boolean;
  selected?: string | null;
  onSelect?: (id: string | null) => void;
  onChange?: (items: ScrapItem[]) => void;
  /** when set, the page is in pen mode and finger strokes draw instead of moving items */
  inkMode?: InkSettings | null;
  onInk?: (strokes: Stroke[]) => void;
  /** tap on an empty spot (fractions of width/height), e.g. to place a stamp */
  onTapEmpty?: (x: number, y: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { shown, itemDown, handlers } = useItemGestures({ ref, items: layout.items, readOnly, onSelect, onChange, onTapEmpty });

  return (
    <div ref={ref} class={`scrap-canvas pattern-${layout.pattern}`} style={{ backgroundColor: layout.bg, containerType: 'inline-size' }} {...handlers}>
      {(layout.ink?.length || inkMode) && (
        <div class="scrap-ink" style={{ pointerEvents: inkMode ? 'auto' : 'none' }}>
          <InkSurface
            strokes={layout.ink ?? []}
            enabled={!!inkMode}
            tool={inkMode?.tool ?? 'pen'}
            color={inkMode?.color ?? '#000'}
            size={inkMode?.size ?? 0.01}
            onStroke={(s) => onInk?.([...(layout.ink ?? []), s])}
          />
        </div>
      )}
      {shown.map((it) => (
        <div
          key={it.id}
          class={`scrap-item ${!readOnly && selected === it.id ? 'selected' : ''} ${it.kind === 'stamp' ? 'is-stamp' : ''}`}
          style={{
            left: `${it.x * 100}%`,
            top: `${it.y * 100}%`,
            transform: `translate(-50%, -50%) rotate(${it.rot}deg) scale(${it.scale})`,
            zIndex: it.z
          }}
          onPointerDown={(e) => itemDown(e as PointerEvent, it)}
        >
          <ItemBody item={it} photos={photos} />
        </div>
      ))}
    </div>
  );
}

let fontsReady = false;
const fontWaiters = new Set<() => void>();
if (typeof document !== 'undefined') {
  Promise.all([document.fonts.load('800 40px Nunito'), document.fonts.load('600 40px Caveat')])
    .catch(() => {})
    .finally(() => {
      fontsReady = true;
      clearStampCache();
      fontWaiters.forEach((fn) => fn());
    });
}

/** A stamp picture; redrawn once the stamp fonts have loaded. */
export function StampImg({ id, color, text, height = 220, class: cls = 'scrap-stamp' }: { id: string; color: string; text?: string; height?: number; class?: string }) {
  const [, force] = useState(0);
  useEffect(() => {
    if (fontsReady) return;
    const fn = () => force((n) => n + 1);
    fontWaiters.add(fn);
    return () => fontWaiters.delete(fn);
  }, []);
  const def = STAMP_BY_ID[id];
  return (
    <img
      class={cls}
      src={stampUrl(id, color, text ?? '', height)}
      alt={def?.label ?? 'cap'}
      draggable={false}
      style={cls === 'scrap-stamp' ? { width: `${26 * Math.sqrt(def?.aspect ?? 1)}cqw` } : undefined}
    />
  );
}

export function ItemBody({ item, photos }: { item: ScrapItem; photos: Photo[] }) {
  switch (item.kind) {
    case 'sticker':
      return <div class="scrap-sticker">{item.content}</div>;
    case 'stamp':
      return <StampImg id={item.content} color={item.color ?? '#D13A72'} text={item.text} />;
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
