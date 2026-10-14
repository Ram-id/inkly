import { useMemo, useState } from 'preact/hooks';
import { MOOD_BY_ID } from '../../domain/catalog';
import { dayKey } from '../../domain/stats';
import type { Entry } from '../../domain/types';
import { Icon } from '../icons';
import { go } from '../router';
import { useVault } from '../services';
import { EntryCard } from '../components/common';

export function Calendar() {
  const vault = useVault();
  const entries = vault.list();
  const mondayFirst = vault.settings.weekStartsMonday;
  const today = new Date();
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<string>(dayKey(today));

  const byDay = useMemo(() => {
    const m = new Map<string, Entry[]>();
    for (const e of entries) {
      const k = dayKey(e.date);
      m.set(k, [...(m.get(k) ?? []), e]);
    }
    return m;
  }, [vault.version]);

  const firstDow = (month.getDay() + (mondayFirst ? 6 : 0)) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))
  ];
  const heads = mondayFirst ? ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'] : ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  const monthCount = cells.filter((d) => d && byDay.has(dayKey(d))).length;
  const selectedEntries = byDay.get(selected) ?? [];
  const selDate = new Date(`${selected}T12:00:00`);
  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));

  return (
    <main class="screen stack-lg">
      <header class="row-between" style={{ paddingTop: '8px' }}>
        <h1 class="greeting">Kalender</h1>
        <button
          class="btn small secondary"
          onClick={() => {
            setMonth(new Date(today.getFullYear(), today.getMonth(), 1));
            setSelected(dayKey(today));
          }}
        >
          Hari ini
        </button>
      </header>

      <div class="card stack">
        <div class="row-between">
          <button class="icon-btn" aria-label="Bulan sebelumnya" onClick={() => shift(-1)}>
            <Icon name="back" />
          </button>
          <div class="center">
            <p class="bold">{month.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</p>
            <p class="tiny muted">{monthCount} hari menulis</p>
          </div>
          <button class="icon-btn" aria-label="Bulan berikutnya" onClick={() => shift(1)}>
            <Icon name="next" />
          </button>
        </div>
        <div class="cal-grid">
          {heads.map((h) => (
            <div key={h} class="cal-head">
              {h}
            </div>
          ))}
          {cells.map((d, i) => {
            if (!d) return <div key={`b${i}`} />;
            const k = dayKey(d);
            const list = byDay.get(k);
            const mood = list?.find((e) => e.mood)?.mood;
            const cls = ['cal-day', list ? 'has' : '', k === dayKey(today) ? 'today' : '', k === selected ? 'sel' : '', d > today ? 'future' : '']
              .filter(Boolean)
              .join(' ');
            return (
              <button key={k} class={cls} onClick={() => setSelected(k)} aria-label={`${d.getDate()}${list ? `, ${list.length} jurnal` : ''}`}>
                {d.getDate()}
                {mood ? <span class="m">{MOOD_BY_ID[mood].emoji}</span> : list ? <span class="m">•</span> : null}
              </button>
            );
          })}
        </div>
      </div>

      <section class="stack">
        <div class="row-between">
          <h2 class="section-title">{selDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
          {selDate <= today && (
            <button class="btn small ghost" onClick={() => go(`new?date=${selDate.setHours(new Date().getHours(), new Date().getMinutes())}`)}>
              <Icon name="plus" size={16} /> Tulis
            </button>
          )}
        </div>
        {selectedEntries.length ? (
          selectedEntries.map((e) => <EntryCard key={e.id} entry={e} />)
        ) : (
          <p class="small muted card flat center">Tidak ada jurnal di tanggal ini.</p>
        )}
      </section>
    </main>
  );
}
