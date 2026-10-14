import { useEffect, useRef, useState } from 'preact/hooks';
import { PAGE_COLORS, STICKERS, TAPE_COLORS, WORD_STICKERS } from '../../domain/catalog';
import { newId, type ScrapbookLayout, type ScrapItem, type ScrapItemKind } from '../../domain/types';
import { Icon } from '../icons';
import { useVault } from '../services';
import { Empty, TopBar } from '../components/common';
import { Sheet } from '../components/feedback';
import { ScrapCanvas } from '../components/ScrapCanvas';
import { DEFAULT_INK, InkTools, type InkSettings } from '../components/InkTools';
import { StampPicker, type ArmedStamp } from '../components/Decor';
import { todayStampText } from '../../media/stamps';
import { busy, toast } from '../components/feedback';
import { renderScrapbook } from '../../media/scrapRender';
import { canvasToBlob, downloadBlob, stamp } from '../../media/ink';

type Tab = 'sticker' | 'cap' | 'kata' | 'foto' | 'teks' | 'washi' | 'pena' | 'latar';

const TABS: { id: Tab; label: string }[] = [
  { id: 'sticker', label: 'Stiker' },
  { id: 'cap', label: 'Cap' },
  { id: 'kata', label: 'Kata' },
  { id: 'foto', label: 'Foto' },
  { id: 'teks', label: 'Teks' },
  { id: 'washi', label: 'Washi' },
  { id: 'pena', label: 'Pena' },
  { id: 'latar', label: 'Latar' }
];

const EMPTY_LAYOUT: ScrapbookLayout = { bg: PAGE_COLORS[0], pattern: 'dots', items: [] };
const TEXT_COLORS = ['#24222b', '#6c54b3', '#c4413b', '#2f8a5b', '#2b64b5', '#b7791f', '#ffffff'];

export function Scrapbook({ id }: { id: string }) {
  const vault = useVault();
  const entry = vault.get(id);
  const [layout, setLayout] = useState<ScrapbookLayout>(() => entry?.scrapbook ?? EMPTY_LAYOUT);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('sticker');
  const [textSheet, setTextSheet] = useState<{ editing?: ScrapItem } | null>(null);
  const [ink, setInk] = useState<InkSettings>(DEFAULT_INK);
  const [armed, setArmed] = useState<ArmedStamp>({ id: 'sakura', color: '#D13A72' });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(layout);

  const persist = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const current = vault.get(id);
    if (current) void vault.saveEntry({ ...current, scrapbook: latest.current });
  };
  useEffect(() => () => persist(), []);

  if (!entry) {
    return (
      <main class="screen no-nav">
        <TopBar title="Hias halaman" />
        <Empty emoji="🫥" title="Jurnal tidak ditemukan" />
      </main>
    );
  }

  const commit = (next: ScrapbookLayout) => {
    latest.current = next;
    setLayout(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(persist, 800);
  };
  const setItems = (items: ScrapItem[]) => commit({ ...layout, items });
  const topZ = () => layout.items.reduce((z, it) => Math.max(z, it.z), 0) + 1;

  const add = (kind: ScrapItemKind, content: string, extra: Partial<ScrapItem> = {}) => {
    const item: ScrapItem = {
      id: newId(),
      kind,
      content,
      x: 0.3 + Math.random() * 0.4,
      y: 0.3 + Math.random() * 0.4,
      scale: 1,
      rot: Math.round((Math.random() - 0.5) * 16),
      z: topZ(),
      ...extra
    };
    setItems([...layout.items, item]);
    setSelected(item.id);
  };

  const sel = layout.items.find((it) => it.id === selected) ?? null;
  const patch = (p: Partial<ScrapItem>) => sel && setItems(layout.items.map((it) => (it.id === sel.id ? { ...it, ...p } : it)));

  return (
    <main class="screen no-nav" style={{ paddingBottom: 'calc(var(--safe-bottom) + 24px)' }}>
      <TopBar
        title="Hias halaman"
        onBack={() => {
          persist();
          history.back();
        }}
        right={
          <button
            class="icon-btn"
            aria-label="Unduh halaman"
            onClick={async () => {
              const blob = await busy('Menyiapkan gambar…', async () =>
                canvasToBlob(await renderScrapbook(layout, entry.photos, (pid) => vault.photoUrl(pid)))
              );
              downloadBlob(blob, `inkly-scrapbook-${stamp()}.png`);
              toast('Halaman diunduh 🎨');
            }}
          >
            <Icon name="download" />
          </button>
        }
      />
      <div class="stack">
        <ScrapCanvas
          layout={layout}
          photos={entry.photos}
          selected={tab === 'pena' ? null : selected}
          onSelect={setSelected}
          onChange={setItems}
          inkMode={tab === 'pena' ? ink : null}
          onInk={(strokes) => commit({ ...layout, ink: strokes })}
          onTapEmpty={(x, y) => {
            if (tab !== 'cap') return;
            add('stamp', armed.id, {
              x,
              y,
              color: armed.color,
              text: armed.id === 'tanggal' ? todayStampText(new Date(entry.date)) : undefined,
              scale: 0.75,
              rot: Math.round((Math.random() - 0.5) * 24)
            });
            setSelected(null);
          }}
        />

        {sel && tab !== 'pena' ? (
          <div class="card flat row wrap" style={{ gap: '4px', padding: '8px', justifyContent: 'center' }}>
            <button class="icon-btn" aria-label="Perkecil" onClick={() => patch({ scale: Math.max(0.3, sel.scale / 1.15) })}>
              <Icon name="minus" />
            </button>
            <button class="icon-btn" aria-label="Perbesar" onClick={() => patch({ scale: Math.min(4, sel.scale * 1.15) })}>
              <Icon name="plus" />
            </button>
            <button class="icon-btn" aria-label="Putar" onClick={() => patch({ rot: sel.rot + 15 })}>
              <Icon name="rotate" />
            </button>
            <button class="icon-btn" aria-label="Bawa ke depan" onClick={() => patch({ z: topZ() })}>
              <Icon name="layers" />
            </button>
            {sel.kind === 'text' && (
              <button class="icon-btn" aria-label="Ubah teks" onClick={() => setTextSheet({ editing: sel })}>
                <Icon name="edit" />
              </button>
            )}
            <button
              class="icon-btn"
              aria-label="Hapus"
              style={{ color: 'var(--danger)' }}
              onClick={() => {
                setItems(layout.items.filter((it) => it.id !== sel.id));
                setSelected(null);
              }}
            >
              <Icon name="trash" />
            </button>
            <button class="icon-btn" aria-label="Selesai" onClick={() => setSelected(null)}>
              <Icon name="check" />
            </button>
          </div>
        ) : null}

        <div class="segmented tabs-scroll" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} class={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'sticker' &&
          STICKERS.map((g) => (
            <div key={g.name} class="stack" style={{ gap: '6px' }}>
              <span class="section-title">{g.name}</span>
              <div class="palette">
                {g.items.map((s) => (
                  <button key={s} onClick={() => add('sticker', s)} aria-label={`Tempel ${s}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ))}

        {tab === 'kata' && (
          <div class="row wrap" style={{ gap: '8px' }}>
            {WORD_STICKERS.map((w) => (
              <button key={w} class="scrap-word" style={{ fontSize: '22px' }} onClick={() => add('label', w)}>
                {w}
              </button>
            ))}
          </div>
        )}

        {tab === 'foto' &&
          (entry.photos.length ? (
            <div class="photo-strip">
              {entry.photos.map((p) => (
                <button key={p.id} class="photo-tile" onClick={() => add('photo', p.id)} aria-label="Tempel foto">
                  <img src={p.thumb} alt="" />
                </button>
              ))}
            </div>
          ) : (
            <p class="small muted">Belum ada foto.</p>
          ))}

        {tab === 'teks' && (
          <button class="btn block secondary" onClick={() => setTextSheet({})}>
            <Icon name="type" size={18} /> Tambah tulisan
          </button>
        )}

        {tab === 'washi' && (
          <div class="swatches">
            {TAPE_COLORS.map((c) => (
              <button key={c} class="swatch" style={{ background: c, borderRadius: '6px', width: '56px' }} onClick={() => add('tape', c)} aria-label="Tempel washi tape" />
            ))}
          </div>
        )}

        {tab === 'cap' && <StampPicker armed={armed} onArm={setArmed} row />}

        {tab === 'pena' && (
          <div class="stack">
            <InkTools value={ink} onChange={setInk} />
            <div class="row">
              <button class="btn secondary small grow" disabled={!layout.ink?.length} onClick={() => commit({ ...layout, ink: (layout.ink ?? []).slice(0, -1) })}>
                <Icon name="undo" size={17} /> Urungkan
              </button>
              <button class="btn secondary small grow" disabled={!layout.ink?.length} onClick={() => commit({ ...layout, ink: [] })}>
                <Icon name="trash" size={17} /> Hapus coretan
              </button>
            </div>
          </div>
        )}

        {tab === 'latar' && (
          <div class="stack">
            <div class="swatches">
              {PAGE_COLORS.map((c) => (
                <button key={c} class={`swatch ${layout.bg === c ? 'on' : ''}`} style={{ background: c }} onClick={() => commit({ ...layout, bg: c })} aria-label={`Warna latar ${c}`} />
              ))}
            </div>
            <div class="segmented">
              {(['none', 'dots', 'grid', 'lines'] as const).map((p) => (
                <button key={p} class={layout.pattern === p ? 'on' : ''} onClick={() => commit({ ...layout, pattern: p })}>
                  {{ none: 'Polos', dots: 'Titik', grid: 'Kotak', lines: 'Garis' }[p]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {textSheet && (
        <TextSheet
          initial={textSheet.editing}
          onClose={() => setTextSheet(null)}
          onSave={(content, font, color) => {
            if (textSheet.editing) patch({ content, font, color });
            else add('text', content, { font, color, rot: 0 });
            setTextSheet(null);
          }}
        />
      )}
    </main>
  );
}

function TextSheet({
  initial,
  onClose,
  onSave
}: {
  initial?: ScrapItem;
  onClose: () => void;
  onSave: (content: string, font: ScrapItem['font'], color: string) => void;
}) {
  const [text, setText] = useState(initial?.content ?? '');
  const [font, setFont] = useState<ScrapItem['font']>(initial?.font ?? 'hand');
  const [color, setColor] = useState(initial?.color ?? TEXT_COLORS[0]);
  return (
    <Sheet onClose={onClose}>
      <div class="stack">
        <h2>{initial ? 'Ubah tulisan' : 'Tambah tulisan'}</h2>
        <textarea class="textarea" rows={3} value={text} autofocus onInput={(e) => setText(e.currentTarget.value)} placeholder="Tulis sesuatu…" />
        <div class="segmented">
          {(['hand', 'sans', 'serif'] as const).map((f) => (
            <button key={f} class={font === f ? 'on' : ''} onClick={() => setFont(f)}>
              {{ hand: 'Tulisan tangan', sans: 'Biasa', serif: 'Klasik' }[f]}
            </button>
          ))}
        </div>
        <div class="swatches">
          {TEXT_COLORS.map((c) => (
            <button key={c} class={`swatch ${color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setColor(c)} aria-label={`Warna ${c}`} />
          ))}
        </div>
        <button class="btn block" disabled={!text.trim()} onClick={() => onSave(text.trim(), font, color)}>
          Simpan
        </button>
      </div>
    </Sheet>
  );
}
