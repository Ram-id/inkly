import { useMemo, useState } from 'preact/hooks';
import { SLIPS } from '../../domain/slips';
import { onThisDay, searchEntries, streaks, topTags } from '../../domain/stats';
import { Icon } from '../icons';
import { go } from '../router';
import { services, useSync, useVault } from '../services';
import { Empty, EntryCard, groupByMonth } from '../components/common';
import { InstallCard } from '../components/InstallCard';
import { Jar } from '../components/Paper';

function greeting(h: number): string {
  if (h < 4) return 'Selamat malam';
  if (h < 11) return 'Selamat pagi';
  if (h < 15) return 'Selamat siang';
  if (h < 18) return 'Selamat sore';
  return 'Selamat malam';
}

export function Home() {
  const vault = useVault();
  const { status, linked } = useSync();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<string>('all');

  const all = vault.list();
  const s = streaks(all);
  const tags = useMemo(() => topTags(all, 6), [vault.version]);
  const memories = useMemo(() => onThisDay(all).slice(0, 2), [vault.version]);
  const name = vault.settings.displayName;

  let shown = searchEntries(all, query);
  if (filter === 'fav') shown = shown.filter((e) => e.favorite);
  else if (filter.startsWith('#')) shown = shown.filter((e) => e.tags.includes(filter.slice(1)));

  return (
    <main class="screen stack-lg">
      <header class="row-between" style={{ paddingTop: '8px' }}>
        <div>
          <p class="small muted">{new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1 class="greeting">
            {greeting(new Date().getHours())}
            {name ? `, ${name}` : ''} 👋
          </h1>
        </div>
        <div class="row" style={{ gap: '2px' }}>
          {linked && (
            <button class="icon-btn" aria-label="Status sinkronisasi" onClick={() => go('settings/sync')}>
              <span class={`sync-dot ${status?.state ?? ''}`} />
            </button>
          )}
          <button class="icon-btn" aria-label="Kunci jurnal" onClick={() => services.vault.lock()}>
            <Icon name="lock" />
          </button>
        </div>
      </header>

      <div class="card streak-card">
        <div style={{ fontSize: '34px' }}>{s.current > 0 ? '🔥' : '🌱'}</div>
        <div class="grow">
          <div class="row" style={{ gap: '6px', alignItems: 'baseline' }}>
            <span class="streak-num">{s.current}</span>
            <span class="muted small">hari beruntun</span>
          </div>
          <p class="small muted">
            {s.wroteToday ? 'Kamu sudah menulis hari ini. Hebat!' : all.length ? 'Belum ada catatan hari ini.' : 'Mulai kebiasaan menulis pertamamu.'}
          </p>
        </div>
        {!s.wroteToday && (
          <button class="btn small" onClick={() => go('new')}>
            Tulis
          </button>
        )}
      </div>

      {!vault.prefs.recoveryConfirmed && (
        <button class="card warn row" style={{ gap: '12px', textAlign: 'left' }} onClick={() => go('settings/security')}>
          <span style={{ fontSize: '26px' }}>🔑</span>
          <span class="grow small">
            <b>Recovery key belum dicatat.</b> Tanpa 24 kata itu, jurnal tidak bisa dibuka kalau kamu lupa password. Ketuk untuk melihatnya.
          </span>
        </button>
      )}

      <button class="card tinted bottle-card" onClick={() => go('bottle')}>
        <Jar size={78} />
        <span class="grow stack" style={{ gap: '4px' }}>
          <span class="tiny bold" style={{ color: 'var(--accent)', letterSpacing: '0.04em' }}>
            BOTOL PERASAAN
          </span>
          <span class="hand" style={{ fontSize: '24px', lineHeight: 1.15, color: 'var(--accent-strong)' }}>
            Ambil satu kertas sesuai perasaanmu hari ini
          </span>
          <span class="small muted row" style={{ gap: '4px' }}>
            {SLIPS.length} gulungan menunggu <Icon name="next" size={16} />
          </span>
        </span>
      </button>

      <InstallCard />

      {memories.length > 0 && (
        <section class="stack">
          <h2 class="section-title">✨ Kenangan di tanggal ini</h2>
          {memories.map((e) => (
            <EntryCard key={e.id} entry={e} />
          ))}
        </section>
      )}

      <section class="stack">
        <div class="input-wrap">
          <input class="input" type="search" placeholder="Cari jurnal, tag, atau mood…" value={query} onInput={(e) => setQuery(e.currentTarget.value)} aria-label="Cari jurnal" />
          <span class="icon-btn" style={{ pointerEvents: 'none', color: 'var(--text-3)' }}>
            <Icon name="search" size={20} />
          </span>
        </div>
        {all.length > 0 && (
          <div class="chips">
            <button class={`chip ${filter === 'all' ? 'on' : ''}`} onClick={() => setFilter('all')}>
              Semua
            </button>
            <button class={`chip ${filter === 'fav' ? 'on' : ''}`} onClick={() => setFilter('fav')}>
              ⭐ Favorit
            </button>
            {tags.map((t) => (
              <button key={t.tag} class={`chip ${filter === `#${t.tag}` ? 'on' : ''}`} onClick={() => setFilter(`#${t.tag}`)}>
                #{t.tag}
              </button>
            ))}
          </div>
        )}
      </section>

      {all.length === 0 ? (
        <Empty emoji="📔" title="Belum ada jurnal">
          <p class="small">Ketuk tombol + di bawah untuk menulis cerita pertamamu.</p>
        </Empty>
      ) : shown.length === 0 ? (
        <Empty emoji="🔎" title="Tidak ada yang cocok" />
      ) : (
        groupByMonth(shown).map((g) => (
          <section class="stack" key={g.label}>
            <h2 class="section-title">{g.label}</h2>
            {g.items.map((e) => (
              <EntryCard key={e.id} entry={e} />
            ))}
          </section>
        ))
      )}
    </main>
  );
}
