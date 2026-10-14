import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { PROMPTS, TEMPLATES, type Template } from '../../domain/catalog';
import { normalizeTag, wordCount } from '../../domain/stats';
import { emptyEntry, newId, type Entry } from '../../domain/types';
import { processPhoto } from '../../media/image';
import { Icon } from '../icons';
import { back, go } from '../router';
import { services } from '../services';
import { MoodPicker } from '../components/common';
import { Sheet, errorMessage, toast } from '../components/feedback';

const MAX_PHOTOS = 12;

function toLocalInput(ts: number): string {
  const d = new Date(ts);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function hasContent(e: Entry): boolean {
  return !!(e.title.trim() || e.body.trim() || e.photos.length || e.mood || e.scrapbook?.items.length);
}

export function applyTemplate(e: Entry, t: Template): Entry {
  if (!e.body.trim() && !e.title.trim()) return { ...e, title: t.title, body: t.body, templateId: t.id };
  return { ...e, body: `${e.body.trimEnd()}\n\n${t.body}`, templateId: t.id };
}

export function Editor({ id, query }: { id?: string; query: URLSearchParams }) {
  const vault = services.vault;
  const [entry, setEntry] = useState<Entry>(() => {
    const existing = id ? vault.get(id) : undefined;
    if (existing) return existing;
    const date = Number(query.get('date')) || Date.now();
    let e = emptyEntry(date);
    const t = TEMPLATES.find((x) => x.id === query.get('template'));
    if (t) e = applyTemplate(e, t);
    const p = query.get('prompt');
    if (p) e = { ...e, title: p, body: '' };
    return e;
  });
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved'>(id ? 'saved' : 'idle');
  const [tagDraft, setTagDraft] = useState('');
  const [sheet, setSheet] = useState<'template' | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const dirty = useRef(false);
  const latest = useRef(entry);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const flush = async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!dirty.current || !hasContent(latest.current)) return;
    dirty.current = false;
    setSaved('saving');
    try {
      await vault.saveEntry(latest.current);
      setSaved('saved');
    } catch (e) {
      dirty.current = true;
      toast(errorMessage(e), 'error');
    }
  };

  const update = (patch: Partial<Entry>) => {
    const next = { ...latest.current, ...patch };
    latest.current = next;
    setEntry(next);
    dirty.current = true;
    setSaved('idle');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 900);
  };

  // Save whatever is pending when leaving the screen or when the app goes to the background.
  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && void flush();
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      void flush();
    };
  }, []);

  // Grow the textarea with its content.
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + 4}px`;
  }, [entry.body]);

  const addTag = (raw: string) => {
    const parts = raw.split(/[\s,]+/).map(normalizeTag).filter(Boolean);
    if (parts.length) update({ tags: [...new Set([...latest.current.tags, ...parts])] });
    setTagDraft('');
  };

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    const room = MAX_PHOTOS - latest.current.photos.length;
    if (room <= 0) return toast(`Maksimal ${MAX_PHOTOS} foto per jurnal.`, 'error');
    setPhotoBusy(true);
    try {
      const added = [];
      for (const f of [...files].slice(0, room)) {
        const p = await processPhoto(f);
        const pid = newId();
        await vault.addPhoto(pid, p.bytes);
        added.push({ id: pid, w: p.w, h: p.h, thumb: p.thumb });
      }
      update({ photos: [...latest.current.photos, ...added] });
    } catch (e) {
      toast(`Foto gagal ditambahkan: ${errorMessage(e)}`, 'error');
    } finally {
      setPhotoBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removePhoto = async (pid: string) => {
    update({ photos: latest.current.photos.filter((p) => p.id !== pid) });
    await vault.deleteMedia(pid);
  };

  const done = async () => {
    await flush();
    if (!hasContent(latest.current)) return back('');
    if (id) back(`entry/${entry.id}`);
    else go(`entry/${entry.id}`, { replace: true });
  };

  const decorate = async () => {
    dirty.current = true;
    if (!hasContent(latest.current)) update({ title: latest.current.title || 'Halaman scrapbook' });
    await flush();
    go(`scrap/${entry.id}`);
  };

  const words = wordCount(entry.body);

  return (
    <main class="screen no-nav" style={{ paddingBottom: 'calc(var(--safe-bottom) + 96px)' }}>
      <header class="topbar">
        <button class="icon-btn" aria-label="Kembali" onClick={done}>
          <Icon name="back" />
        </button>
        <h1 class="small muted" style={{ fontWeight: 600, fontSize: '13px' }}>
          {saved === 'saving' ? 'Menyimpan…' : saved === 'saved' ? 'Tersimpan & terenkripsi ✓' : hasContent(entry) ? 'Belum tersimpan' : ''}
        </h1>
        <button class="btn small" onClick={done}>
          Selesai
        </button>
      </header>

      <div class="stack-lg">
        <label class="row small muted" style={{ gap: '8px' }}>
          <Icon name="calendar" size={18} />
          <input
            type="datetime-local"
            class="input"
            style={{ minHeight: '40px', padding: '6px 10px', width: 'auto', fontSize: '14px' }}
            value={toLocalInput(entry.date)}
            onChange={(e) => {
              const t = new Date(e.currentTarget.value).getTime();
              if (!Number.isNaN(t)) update({ date: t });
            }}
            aria-label="Tanggal jurnal"
          />
        </label>

        <div class="stack" style={{ gap: '8px' }}>
          <span class="section-title">Bagaimana perasaanmu?</span>
          <MoodPicker value={entry.mood} onChange={(mood) => update({ mood })} />
        </div>

        <div>
          <input class="editor-title" placeholder="Judul" value={entry.title} onInput={(e) => update({ title: e.currentTarget.value })} aria-label="Judul" />
          <textarea
            ref={bodyRef}
            class="editor-body"
            placeholder="Ceritakan harimu…"
            value={entry.body}
            onInput={(e) => update({ body: e.currentTarget.value })}
            aria-label="Isi jurnal"
            autofocus={!id}
          />
          <p class="tiny faint">{words} kata</p>
        </div>

        <div class="stack" style={{ gap: '8px' }}>
          <span class="section-title">Tag</span>
          <div class="row wrap" style={{ gap: '6px' }}>
            {entry.tags.map((t) => (
              <button key={t} class="chip tag" onClick={() => update({ tags: entry.tags.filter((x) => x !== t) })} aria-label={`Hapus tag ${t}`}>
                #{t} <Icon name="x" size={12} />
              </button>
            ))}
          </div>
          <input
            class="input"
            placeholder="Tambah tag, lalu tekan Enter"
            value={tagDraft}
            autoCapitalize="off"
            onInput={(e) => {
              const v = e.currentTarget.value;
              if (/[\s,]$/.test(v)) addTag(v);
              else setTagDraft(v);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addTag(e.currentTarget.value);
              }
            }}
            onBlur={(e) => addTag(e.currentTarget.value)}
          />
        </div>

        <div class="stack" style={{ gap: '8px' }}>
          <span class="section-title">Foto</span>
          <div class="photo-strip">
            {entry.photos.map((p) => (
              <div class="photo-tile" key={p.id}>
                <img src={p.thumb} alt="" />
                <button class="remove" aria-label="Hapus foto" onClick={() => removePhoto(p.id)}>
                  <Icon name="x" size={16} />
                </button>
              </div>
            ))}
            <button class="photo-tile add-tile" onClick={() => fileRef.current?.click()} disabled={photoBusy} aria-label="Tambah foto">
              {photoBusy ? <div class="spinner" /> : <Icon name="plus" size={26} />}
            </button>
          </div>
          <p class="tiny faint">Lokasi GPS & data kamera dihapus, lalu foto dienkripsi sebelum disimpan.</p>
          <input ref={fileRef} type="file" accept="image/*" multiple class="sr-only" onChange={(e) => addPhotos(e.currentTarget.files)} />
        </div>
      </div>

      <div class="editor-toolbar">
        <div class="editor-toolbar-inner">
          <button class="tool" onClick={() => fileRef.current?.click()}>
            <Icon name="image" size={19} /> Foto
          </button>
          <button class="tool" onClick={decorate}>
            <Icon name="sparkle" size={19} /> Hias
          </button>
          <button class="tool" onClick={() => setSheet('template')}>
            <Icon name="file" size={19} /> Template
          </button>
          <button
            class="tool"
            onClick={() => {
              const p = PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
              update({ body: entry.body.trim() ? `${entry.body.trimEnd()}\n\n${p}\n` : `${p}\n` });
            }}
          >
            <Icon name="shuffle" size={19} /> Ide
          </button>
          <button class={`tool ${entry.favorite ? 'active' : ''}`} onClick={() => update({ favorite: !entry.favorite })} style={entry.favorite ? { color: 'var(--warn)' } : undefined}>
            <Icon name="star" size={19} solid={entry.favorite} /> Favorit
          </button>
        </div>
      </div>

      {sheet === 'template' && (
        <TemplateSheet
          onClose={() => setSheet(null)}
          onPick={(t) => {
            update(applyTemplate(latest.current, t));
            setSheet(null);
          }}
        />
      )}
    </main>
  );
}

export function TemplateSheet({ onClose, onPick }: { onClose: () => void; onPick: (t: Template) => void }) {
  return (
    <Sheet onClose={onClose}>
      <h2>Mulai dari template</h2>
      <p class="small muted" style={{ marginBottom: '12px' }}>
        Pilih kerangka tulisan, nanti bisa kamu ubah sesukamu.
      </p>
      <div class="list">
        {TEMPLATES.map((t) => (
          <button key={t.id} class="list-item" onClick={() => onPick(t)}>
            <span style={{ fontSize: '24px' }}>{t.emoji}</span>
            <span class="label">
              <b>{t.name}</b>
              <small>{t.body ? t.body.split('\n')[0] : 'Halaman kosong'}</small>
            </span>
            <Icon name="next" size={18} />
          </button>
        ))}
      </div>
    </Sheet>
  );
}
