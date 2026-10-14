import { useEffect, useRef, useState } from 'preact/hooks';
import { wordCount } from '../../domain/stats';
import { newId, type ScrapItem } from '../../domain/types';
import { todayStampText } from '../../media/stamps';
import { Icon } from '../icons';
import { back, go } from '../router';
import { useVault } from '../services';
import { Empty, SecureImg, TopBar } from '../components/common';
import { busy, confirmDialog, toast } from '../components/feedback';
import { renderScrapbook } from '../../media/scrapRender';
import { canvasToBlob, downloadBlob, stamp } from '../../media/ink';
import { ScrapCanvas } from '../components/ScrapCanvas';
import { SlipCard } from '../components/Paper';
import { DecorLayer, ItemControls, StampPicker, StickerPicker, type ArmedStamp } from '../components/Decor';

type DecorTab = 'stiker' | 'cap';

export function EntryView({ id, query }: { id: string; query?: URLSearchParams }) {
  const vault = useVault();
  const entry = vault.get(id);
  const [viewing, setViewing] = useState<string | null>(null);
  const [decorating, setDecorating] = useState(query?.get('decor') === '1');
  const [decorTab, setDecorTab] = useState<DecorTab>('stiker');
  const [selected, setSelected] = useState<string | null>(null);
  const [armed, setArmed] = useState<ArmedStamp>({ id: 'sakura', color: '#D13A72' });
  const [decor, setDecor] = useState<ScrapItem[]>(() => entry?.decor ?? []);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(decor);
  const page = useRef<HTMLDivElement>(null);

  const persist = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const current = vault.get(id);
    if (current && current.decor !== latest.current) void vault.saveEntry({ ...current, decor: latest.current });
  };
  useEffect(() => () => persist(), []);

  if (!entry) {
    return (
      <main class="screen no-nav">
        <TopBar title="Jurnal" />
        <Empty title="Jurnal ini tidak ditemukan" />
      </main>
    );
  }

  const commit = (next: ScrapItem[]) => {
    latest.current = next;
    setDecor(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(persist, 700);
  };
  const topZ = () => decor.reduce((z, it) => Math.max(z, it.z), 0) + 1;

  /** y (in page widths) of the middle of what is currently on screen */
  const visibleMiddle = () => {
    const r = page.current?.getBoundingClientRect();
    if (!r) return 0.5;
    const mid = window.innerHeight * (decorating ? 0.3 : 0.5) - r.top;
    return Math.max(0.1, Math.min(mid, r.height) / r.width);
  };

  const addSticker = (kind: 'sticker' | 'label', content: string) => {
    const item: ScrapItem = {
      id: newId(),
      kind,
      content,
      x: 0.3 + Math.random() * 0.4,
      y: visibleMiddle(),
      scale: kind === 'sticker' ? 1 : 0.9,
      rot: Math.round((Math.random() - 0.5) * 20),
      z: topZ()
    };
    commit([...decor, item]);
    setSelected(item.id);
  };

  const stampAt = (x: number, y: number) => {
    if (decorTab !== 'cap') return;
    const item: ScrapItem = {
      id: newId(),
      kind: 'stamp',
      content: armed.id,
      color: armed.color,
      text: armed.id === 'tanggal' ? todayStampText(new Date(entry.date)) : undefined,
      x,
      y,
      scale: 1.1,
      rot: Math.round((Math.random() - 0.5) * 24),
      z: topZ()
    };
    commit([...decor, item]);
    navigator.vibrate?.(15);
  };

  const sel = decor.find((it) => it.id === selected) ?? null;
  const d = new Date(entry.date);

  const remove = async () => {
    const ok = await confirmDialog({ title: 'Hapus jurnal ini?', ok: 'Hapus', danger: true });
    if (!ok) return;
    await vault.deleteEntry(entry.id);
    toast('Jurnal dihapus.');
    back('');
  };

  const finishDecor = () => {
    persist();
    setSelected(null);
    setDecorating(false);
  };

  return (
    <main class={`screen no-nav ${decorating ? 'decor-mode' : ''}`}>
      <TopBar
        title={decorating ? 'Tempel & cap' : ''}
        onBack={decorating ? finishDecor : undefined}
        right={
          decorating ? (
            <button class="btn small" onClick={finishDecor}>
              Selesai
            </button>
          ) : (
            <>
              <button class="icon-btn" aria-label="Tempel stiker & cap" onClick={() => setDecorating(true)}>
                <Icon name="heart" />
              </button>
              <button
                class="icon-btn"
                aria-label={entry.favorite ? 'Hapus dari favorit' : 'Tandai favorit'}
                style={entry.favorite ? { color: 'var(--warn)' } : undefined}
                onClick={() => vault.saveEntry({ ...entry, favorite: !entry.favorite })}
              >
                <Icon name="star" solid={entry.favorite} />
              </button>
              <button class="icon-btn" aria-label="Hapus" onClick={remove}>
                <Icon name="trash" />
              </button>
              <button class="btn small" onClick={() => go(`edit/${entry.id}`)}>
                <Icon name="edit" size={16} /> Ubah
              </button>
            </>
          )
        }
      />

      <div ref={page}>
        <DecorLayer items={decor} editing={decorating} selected={selected} onSelect={setSelected} onChange={commit} onTapEmpty={stampAt}>
          <article class="stack-lg journal-page">
            <div class="stack" style={{ gap: '6px' }}>
              <p class="small muted">
                {d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} ·{' '}
                {d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
              </p>
              {(entry.title || !entry.slip) && (
                <h1 class="serif" style={{ fontSize: '28px', lineHeight: 1.2 }}>
                  {entry.title || 'Tanpa judul'}
                </h1>
              )}
              <div class="row wrap" style={{ gap: '6px' }}>
                {entry.tags.map((t) => (
                  <span key={t} class="chip tag">
                    #{t}
                  </span>
                ))}
              </div>
            </div>

            {entry.slip && <SlipCard slip={entry.slip} compact />}

            {entry.body && <div class="entry-body">{entry.body}</div>}

            {entry.photos.length > 0 && (
              <div class="photo-grid">
                {entry.photos.map((p) => (
                  <button key={p.id} onClick={() => setViewing(p.id)} aria-label="Lihat foto">
                    <SecureImg id={p.id} thumb={p.thumb} />
                  </button>
                ))}
              </div>
            )}

            {entry.scrapbook?.items.length || entry.scrapbook?.ink?.length ? (
              <div class="stack">
                <h2 class="section-title">Halaman scrapbook</h2>
                <ScrapCanvas layout={entry.scrapbook} photos={entry.photos} readOnly />
                  <div class="row">
                    <button class="btn secondary grow" onClick={() => go(`scrap/${entry.id}`)}>
                      <Icon name="sparkle" size={18} /> Ubah hiasan
                    </button>
                    <button
                      class="btn secondary"
                      aria-label="Unduh halaman"
                      onClick={async () => {
                        const blob = await busy('Menyiapkan gambar…', async () =>
                          canvasToBlob(await renderScrapbook(entry.scrapbook!, entry.photos, (pid) => vault.photoUrl(pid)))
                        );
                        downloadBlob(blob, `inkly-scrapbook-${stamp()}.png`);
                        toast('Halaman diunduh 🎨');
                      }}
                    >
                      <Icon name="download" size={18} />
                    </button>
                  </div>
              </div>
            ) : (
                <button class="card tinted row" style={{ gap: '12px', textAlign: 'left' }} onClick={() => go(`scrap/${entry.id}`)}>
                  <span style={{ fontSize: '28px' }}>🎨</span>
                  <b class="grow">Hias jadi scrapbook</b>
                  <Icon name="next" size={18} />
                </button>
            )}

            <p class="tiny faint center">
              {wordCount(entry.body)} kata · terakhir diubah {new Date(entry.updatedAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          </article>
        </DecorLayer>
      </div>

      {decorating && (
        <div class="decor-panel">
          {sel ? (
            <ItemControls
              item={sel}
              topZ={topZ()}
              onPatch={(p) => commit(decor.map((it) => (it.id === sel.id ? { ...it, ...p } : it)))}
              onDelete={() => {
                commit(decor.filter((it) => it.id !== sel.id));
                setSelected(null);
              }}
              onDone={() => setSelected(null)}
            />
          ) : (
            <div class="segmented">
              <button class={decorTab === 'stiker' ? 'on' : ''} onClick={() => setDecorTab('stiker')}>
                Stiker
              </button>
              <button class={decorTab === 'cap' ? 'on' : ''} onClick={() => setDecorTab('cap')}>
                Cap
              </button>
            </div>
          )}
          <div class="decor-panel-body">
            {decorTab === 'stiker' ? <StickerPicker onPick={addSticker} /> : <StampPicker armed={armed} onArm={setArmed} />}
          </div>
        </div>
      )}

      {viewing && (
        <div class="viewer" onClick={() => setViewing(null)}>
          <SecureImg id={viewing} thumb={entry.photos.find((p) => p.id === viewing)?.thumb} />
          <button class="icon-btn" aria-label="Tutup">
            <Icon name="x" />
          </button>
        </div>
      )}
    </main>
  );
}
