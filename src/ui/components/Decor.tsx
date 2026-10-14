import type { ComponentChildren } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { STICKERS, WORD_STICKERS } from '../../domain/catalog';
import type { ScrapItem } from '../../domain/types';
import { STAMP_BY_ID, STAMP_GROUPS, STAMP_INKS, STAMPS, todayStampText, type StampGroup } from '../../media/stamps';
import { Icon } from '../icons';
import { useItemGestures } from './itemGestures';
import { ItemBody, StampImg } from './ScrapCanvas';

/**
 * Stickers and stamps laid over a page whose height follows its content (the journal page).
 * x is a fraction of the width; y is measured in page widths so items stay put when the
 * text reflows on another phone.
 */
export function DecorLayer({
  items,
  editing,
  selected,
  onSelect,
  onChange,
  onTapEmpty,
  children
}: {
  items: ScrapItem[];
  editing: boolean;
  selected: string | null;
  onSelect: (id: string | null) => void;
  onChange: (items: ScrapItem[]) => void;
  onTapEmpty?: (x: number, y: number) => void;
  children: ComponentChildren;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { shown, itemDown, handlers } = useItemGestures({ ref, items, readOnly: !editing, yByWidth: true, onSelect, onChange, onTapEmpty });
  return (
    <div class={`decor-page ${editing ? 'editing' : ''}`} style={{ containerType: 'inline-size' }}>
      {children}
      <div ref={ref} class="decor-layer" style={{ pointerEvents: editing ? 'auto' : 'none' }} {...handlers}>
        {shown.map((it) => (
          <div
            key={it.id}
            class={`scrap-item ${editing && selected === it.id ? 'selected' : ''} ${it.kind === 'stamp' ? 'is-stamp' : ''}`}
            style={{
              left: `${it.x * 100}%`,
              top: `calc(${it.y} * 100cqw)`,
              transform: `translate(-50%, -50%) rotate(${it.rot}deg) scale(${it.scale})`,
              zIndex: it.z,
              pointerEvents: editing ? 'auto' : 'none'
            }}
            onPointerDown={(e) => itemDown(e as PointerEvent, it)}
          >
            <ItemBody item={it} photos={[]} />
          </div>
        ))}
      </div>
    </div>
  );
}

export interface ArmedStamp {
  id: string;
  color: string;
}

/** Stamp drawer: pick a stamp and an ink colour, then tap anywhere on the page to stamp it. */
export function StampPicker({ armed, onArm, row }: { armed: ArmedStamp; onArm: (a: ArmedStamp) => void; row?: boolean }) {
  const [group, setGroup] = useState<StampGroup>(STAMP_BY_ID[armed.id]?.group ?? 'bunga');
  return (
    <div class="stack" style={{ gap: '10px' }}>
      <div class="chips" style={{ margin: 0, padding: '2px 0' }}>
        {STAMP_GROUPS.map((g) => (
          <button key={g.id} class={`chip ${group === g.id ? 'on' : ''}`} onClick={() => setGroup(g.id)}>
            {g.label}
          </button>
        ))}
      </div>
      <div class="ink-colors" role="radiogroup" aria-label="Warna tinta">
        {STAMP_INKS.map((c) => (
          <button
            key={c}
            role="radio"
            aria-checked={armed.color === c}
            aria-label={`Tinta ${c}`}
            class={`ink-color ${armed.color === c ? 'on' : ''}`}
            style={{ background: c }}
            onClick={() => onArm({ ...armed, color: c })}
          />
        ))}
      </div>
      <div class={row ? 'stamp-row' : 'stamp-grid'}>
        {STAMPS.filter((s) => s.group === group).map((s) => (
          <button key={s.id} class={`stamp-pick ${armed.id === s.id ? 'on' : ''}`} onClick={() => onArm({ ...armed, id: s.id })} aria-pressed={armed.id === s.id}>
            <StampImg id={s.id} color={armed.color} text={s.id === 'tanggal' ? todayStampText() : ''} height={120} class="stamp-preview" />
            <span>{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function StickerPicker({ onPick }: { onPick: (kind: 'sticker' | 'label', content: string) => void }) {
  return (
    <div class="stack" style={{ gap: '10px' }}>
      {STICKERS.map((g) => (
        <div key={g.name} class="palette">
          {g.items.map((s) => (
            <button key={s} onClick={() => onPick('sticker', s)} aria-label={`Tempel ${s}`}>
              {s}
            </button>
          ))}
        </div>
      ))}
      <div class="row wrap" style={{ gap: '8px' }}>
        {WORD_STICKERS.map((w) => (
          <button key={w} class="scrap-word" style={{ fontSize: '21px' }} onClick={() => onPick('label', w)}>
            {w}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Size / rotate / bring-forward / delete for the selected item. */
export function ItemControls({ item, onPatch, onDelete, onDone, topZ }: { item: ScrapItem; onPatch: (p: Partial<ScrapItem>) => void; onDelete: () => void; onDone: () => void; topZ: number }) {
  return (
    <div class="item-controls">
      <button class="icon-btn" aria-label="Perkecil" onClick={() => onPatch({ scale: Math.max(0.3, item.scale / 1.15) })}>
        <Icon name="minus" />
      </button>
      <button class="icon-btn" aria-label="Perbesar" onClick={() => onPatch({ scale: Math.min(4, item.scale * 1.15) })}>
        <Icon name="plus" />
      </button>
      <button class="icon-btn" aria-label="Putar" onClick={() => onPatch({ rot: item.rot + 15 })}>
        <Icon name="rotate" />
      </button>
      <button class="icon-btn" aria-label="Bawa ke depan" onClick={() => onPatch({ z: topZ })}>
        <Icon name="layers" />
      </button>
      <button class="icon-btn" aria-label="Hapus" style={{ color: 'var(--danger)' }} onClick={onDelete}>
        <Icon name="trash" />
      </button>
      <button class="icon-btn" aria-label="Selesai" onClick={onDone}>
        <Icon name="check" />
      </button>
    </div>
  );
}
