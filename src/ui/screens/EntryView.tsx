import { useState } from 'preact/hooks';
import { wordCount } from '../../domain/stats';
import { Icon } from '../icons';
import { back, go } from '../router';
import { useVault } from '../services';
import { Empty, SecureImg, TopBar } from '../components/common';
import { confirmDialog, toast } from '../components/feedback';
import { ScrapCanvas } from '../components/ScrapCanvas';
import { SlipCard } from '../components/Paper';

export function EntryView({ id }: { id: string }) {
  const vault = useVault();
  const entry = vault.get(id);
  const [viewing, setViewing] = useState<string | null>(null);

  if (!entry) {
    return (
      <main class="screen no-nav">
        <TopBar title="Jurnal" />
        <Empty emoji="🫥" title="Jurnal ini tidak ditemukan" />
      </main>
    );
  }

  const d = new Date(entry.date);

  const remove = async () => {
    const ok = await confirmDialog({
      title: 'Hapus jurnal ini?',
      body: 'Jurnal beserta fotonya akan dihapus dari semua perangkat yang tersinkron. Tindakan ini tidak bisa dibatalkan.',
      ok: 'Hapus',
      danger: true
    });
    if (!ok) return;
    await vault.deleteEntry(entry.id);
    toast('Jurnal dihapus.');
    back('');
  };

  return (
    <main class="screen no-nav">
      <TopBar
        title=""
        right={
          <>
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
        }
      />
      <article class="stack-lg">
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

        {entry.scrapbook?.items.length ? (
          <div class="stack">
            <h2 class="section-title">Halaman scrapbook</h2>
            <ScrapCanvas layout={entry.scrapbook} photos={entry.photos} readOnly />
            <button class="btn block secondary" onClick={() => go(`scrap/${entry.id}`)}>
              <Icon name="sparkle" size={18} /> Ubah hiasan
            </button>
          </div>
        ) : (
          <button class="card tinted row" style={{ gap: '12px', textAlign: 'left' }} onClick={() => go(`scrap/${entry.id}`)}>
            <span style={{ fontSize: '28px' }}>🎨</span>
            <span class="grow">
              <b>Hias jadi halaman scrapbook</b>
              <span class="small muted" style={{ display: 'block' }}>
                Tempel stiker, foto polaroid, washi tape, dan tulisan tangan.
              </span>
            </span>
            <Icon name="next" size={18} />
          </button>
        )}

        <p class="tiny faint center">
          {wordCount(entry.body)} kata · terakhir diubah {new Date(entry.updatedAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
        </p>
      </article>

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
