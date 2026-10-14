import { useEffect, useRef, useState } from 'preact/hooks';
import { canvasToBlob, downloadBlob, drawPaper, drawStrokes, PAPERS, stamp, type PaperStyle, type Stroke } from '../../media/ink';
import { processPhoto } from '../../media/image';
import { emptyEntry, newId } from '../../domain/types';
import { Icon } from '../icons';
import { back, go } from '../router';
import { services } from '../services';
import { InkSurface } from '../components/InkSurface';
import { DEFAULT_INK, InkTools, type InkSettings } from '../components/InkTools';
import { busy, confirmDialog, errorMessage, toast } from '../components/feedback';

/** Renders the drawing (paper + strokes) to a fresh canvas at a good export resolution. */
function renderDrawing(strokes: Stroke[], paper: PaperStyle, aspect: number, width = 1440): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = Math.round(width * aspect);
  const ctx = c.getContext('2d')!;
  drawPaper(ctx, paper, c.width, c.height);
  // strokes are erased against a transparent layer, then laid over the paper
  const ink = document.createElement('canvas');
  ink.width = c.width;
  ink.height = c.height;
  drawStrokes(ink.getContext('2d')!, strokes, ink.width);
  ctx.drawImage(ink, 0, 0);
  return c;
}

export function DrawPad({ forEntry }: { forEntry?: string }) {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [redo, setRedo] = useState<Stroke[]>([]);
  const [ink, setInk] = useState<InkSettings>(DEFAULT_INK);
  const [paper, setPaper] = useState<PaperStyle>('krem');
  const stage = useRef<HTMLDivElement>(null);
  const bg = useRef<HTMLCanvasElement>(null);

  // paper background follows the stage size
  useEffect(() => {
    const el = stage.current!;
    const paint = () => {
      const r = el.getBoundingClientRect();
      const c = bg.current!;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      c.width = Math.round(r.width * dpr);
      c.height = Math.round(r.height * dpr);
      drawPaper(c.getContext('2d')!, paper, c.width, c.height);
    };
    paint();
    const ro = new ResizeObserver(paint);
    ro.observe(el);
    return () => ro.disconnect();
  }, [paper]);

  const aspect = () => {
    const r = stage.current!.getBoundingClientRect();
    return r.height / r.width;
  };

  const leave = async () => {
    if (strokes.length && !(await confirmDialog({ title: 'Buang coretan ini?', ok: 'Buang', danger: true }))) return;
    back('');
  };

  const download = async () => {
    const blob = await canvasToBlob(renderDrawing(strokes, paper, aspect()));
    downloadBlob(blob, `inkly-coretan-${stamp()}.png`);
    toast('Gambar diunduh 🎨');
  };

  const saveToJournal = async () => {
    try {
      await busy('Menyimpan…', async () => {
        const blob = await canvasToBlob(renderDrawing(strokes, paper, aspect(), 1200), 'image/jpeg', 0.9);
        const photo = await processPhoto(blob);
        const pid = newId();
        await services.vault.addPhoto(pid, photo.bytes);
        const p = { id: pid, w: photo.w, h: photo.h, thumb: photo.thumb };
        const target = forEntry ? services.vault.get(forEntry) : undefined;
        if (target) {
          await services.vault.saveEntry({ ...target, photos: [...target.photos, p] });
          back(`edit/${target.id}`);
        } else {
          const e = await services.vault.saveEntry({ ...emptyEntry(), title: 'Coretan', photos: [p] });
          go(`edit/${e.id}?fresh=1`, { replace: true });
        }
      });
      toast('Coretan disimpan ke jurnal 💜');
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  const empty = strokes.length === 0;

  return (
    <main class="draw-screen">
      <header class="topbar draw-top">
        <button class="icon-btn" aria-label="Kembali" onClick={leave}>
          <Icon name="back" />
        </button>
        <h1>Coretan</h1>
        <button class="icon-btn" aria-label="Urungkan" disabled={empty} onClick={() => {
          setRedo([strokes[strokes.length - 1], ...redo]);
          setStrokes(strokes.slice(0, -1));
        }}>
          <Icon name="undo" />
        </button>
        <button class="icon-btn" aria-label="Ulangi" disabled={!redo.length} onClick={() => {
          setStrokes([...strokes, redo[0]]);
          setRedo(redo.slice(1));
        }}>
          <Icon name="redo" />
        </button>
        <button class="icon-btn" aria-label="Unduh gambar" disabled={empty} onClick={download}>
          <Icon name="download" />
        </button>
      </header>

      <div class="draw-stage" ref={stage}>
        <canvas class="draw-paper" ref={bg} />
        <InkSurface
          strokes={strokes}
          tool={ink.tool}
          color={ink.color}
          size={ink.size}
          onStroke={(s) => {
            setStrokes((prev) => [...prev, s]);
            setRedo([]);
          }}
        />
      </div>

      <div class="draw-panel">
        <InkTools value={ink} onChange={setInk} />
        <div class="chips" style={{ margin: 0, padding: '2px 0' }}>
          {PAPERS.map((p) => (
            <button key={p.id} class={`chip paper-chip ${paper === p.id ? 'on' : ''}`} onClick={() => setPaper(p.id)}>
              <i style={{ background: p.bg }} /> {p.label}
            </button>
          ))}
        </div>
        <div class="row">
          <button
            class="btn secondary"
            disabled={empty}
            onClick={async () => {
              if (await confirmDialog({ title: 'Hapus semua coretan?', ok: 'Hapus', danger: true })) {
                setRedo([]);
                setStrokes([]);
              }
            }}
          >
            <Icon name="trash" size={18} />
          </button>
          <button class="btn grow" disabled={empty} onClick={saveToJournal}>
            <Icon name="heart" size={18} /> Simpan ke jurnal
          </button>
        </div>
      </div>
    </main>
  );
}
