import { useMemo, useState } from 'preact/hooks';
import { dayKey, onThisDay, searchEntries, streaks, topTags } from '../../domain/stats';
import { Icon } from '../icons';
import { go } from '../router';
import { services, useSync, useVault } from '../services';
import { Empty, EntryCard, groupByMonth } from '../components/common';
import { InstallCard } from '../components/InstallCard';
import { Jar } from '../components/Paper';
import { Inky } from '../components/Inky';
import { TemplateSheet } from './Editor';

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
  const [templates, setTemplates] = useState(false);

  const all = vault.list();
  const s = streaks(all);
  const tags = useMemo(() => topTags(all, 6), [vault.version]);
  const memories = useMemo(() => onThisDay(all).slice(0, 2), [vault.version]);
  const todayCount = all.filter((e) => dayKey(e.date) === dayKey(new Date())).length;
  const name = vault.settings.displayName;
  const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });

  let shown = searchEntries(all, query);
  if (filter === 'fav') shown = shown.filter((e) => e.favorite);
  else if (filter.startsWith('#')) shown = shown.filter((e) => e.tags.includes(filter.slice(1)));

  return (
    <main class="screen stack-lg">
      <header class="home-head">
        <Inky size={58} bounce face={s.wroteToday ? 'love' : 'happy'} />
        <div class="grow">
          <h1 class="hand-title">{name ? `Hai, ${name}!` : `${greeting(new Date().getHours())}!`}</h1>
          <span class="streak-pill">
            <span class="streak-flame">{s.current > 0 ? '🔥' : '🌱'}</span> {s.current} hari beruntun
          </span>
        </div>
        <div class="row" style={{ gap: '2px', alignSelf: 'flex-start' }}>
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

      {/* The journal comes first: today's page, ready to write on. */}
      <button class="today-page" onClick={() => go('new')}>
        <span class="today-date">{today}</span>
        <span class="today-prompt">{todayCount ? 'Mau menulis lagi?' : 'Apa ceritamu hari ini?'}</span>
        {todayCount > 0 && <span class="today-count">{todayCount} cerita hari ini 💗</span>}
        <span class="today-pen" aria-hidden="true">
          <Icon name="pen" size={24} />
        </span>
      </button>

      <div class="extras">
        <button class="extra" onClick={() => go('bottle')}>
          <Jar size={34} />
          <span>Botol perasaan</span>
        </button>
        <button class="extra" onClick={() => go('draw')}>
          <span class="extra-icon">
            <Icon name="pen" size={20} />
          </span>
          <span>Coretan</span>
        </button>
        <button class="extra" onClick={() => setTemplates(true)}>
          <span class="extra-icon">
            <Icon name="file" size={20} />
          </span>
          <span>Template</span>
        </button>
      </div>

      {!vault.prefs.recoveryConfirmed && (
        <button class="card warn row" style={{ gap: '12px', textAlign: 'left' }} onClick={() => go('settings/security')}>
          <span style={{ fontSize: '26px' }}>🔑</span>
          <span class="grow small bold">Simpan 24 kata cadanganmu</span>
        </button>
      )}

      <InstallCard />

      {memories.length > 0 && (
        <section class="stack">
          <h2 class="section-title">✨ Kenangan di tanggal ini</h2>
          {memories.map((e) => (
            <EntryCard key={e.id} entry={e} />
          ))}
        </section>
      )}

      {all.length > 0 && (
        <section class="stack">
          <div class="input-wrap">
            <input class="input" type="search" placeholder="Cari jurnal atau tag…" value={query} onInput={(e) => setQuery(e.currentTarget.value)} aria-label="Cari jurnal" />
            <span class="icon-btn" style={{ pointerEvents: 'none', color: 'var(--text-3)' }}>
              <Icon name="search" size={20} />
            </span>
          </div>
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
        </section>
      )}

      {all.length === 0 ? (
        <Empty title="Belum ada jurnal" />
      ) : shown.length === 0 ? (
        <Empty title="Tidak ada yang cocok" />
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

      {templates && (
        <TemplateSheet
          onClose={() => setTemplates(false)}
          onPick={(t) => {
            setTemplates(false);
            go(t.id === 'bebas' ? 'new' : `new?template=${t.id}`);
          }}
        />
      )}
    </main>
  );
}
