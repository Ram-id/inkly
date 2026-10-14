import { useMemo, useState } from 'preact/hooks';
import { MOOD_BY_ID } from '../../domain/catalog';
import { moodDistribution, moodTrend, streaks, topTags, totals, weekdayCounts, type TrendPoint } from '../../domain/stats';
import { useVault } from '../services';
import { Empty } from '../components/common';
import { PaperRoll } from '../components/Paper';

const LEVELS: { score: number; emoji: string; label: string }[] = [
  { score: 5, emoji: '😊', label: 'Sangat baik' },
  { score: 4, emoji: '😌', label: 'Baik' },
  { score: 3, emoji: '😐', label: 'Biasa' },
  { score: 2, emoji: '😮‍💨', label: 'Berat' },
  { score: 1, emoji: '😢', label: 'Sangat berat' }
];

export function Stats() {
  const vault = useVault();
  const entries = vault.list();
  const data = useMemo(
    () => ({
      t: totals(entries),
      s: streaks(entries),
      moods: moodDistribution(entries),
      trend: moodTrend(entries, 30),
      week: weekdayCounts(entries),
      tags: topTags(entries, 10)
    }),
    [vault.version]
  );

  if (!entries.length) {
    return (
      <main class="screen">
        <h1 class="greeting" style={{ paddingTop: '8px' }}>
          Statistik
        </h1>
        <Empty emoji="📊" title="Belum ada data">
          <p class="small">Statistik muncul setelah kamu menulis beberapa jurnal.</p>
        </Empty>
      </main>
    );
  }

  const { t, s, moods, trend, week, tags } = data;
  return (
    <main class="screen stack-lg">
      <header style={{ paddingTop: '8px' }}>
        <h1 class="greeting">Statistik</h1>
        <p class="small muted">Dihitung di HP-mu saja. Tidak ada data yang dikirim untuk analitik.</p>
      </header>

      <div class="tiles">
        <Tile k="Total jurnal" v={t.entries} />
        <Tile k="Hari beruntun" v={s.current} hint={`Terpanjang: ${s.longest} hari`} />
        <Tile k="Kata ditulis" v={t.words.toLocaleString('id-ID')} hint={`Rata-rata ${t.avgWords} per jurnal`} />
        <Tile k="Foto" v={t.photos} />
      </div>

      <section class="card stack">
        <h2 class="bold">Perasaan 30 hari terakhir</h2>
        <TrendChart points={trend} />
      </section>

      {moods.length > 0 && (
        <section class="card stack">
          <h2 class="bold">Warna kertas yang paling sering kamu ambil</h2>
          {moods.map((m) => {
            const mood = MOOD_BY_ID[m.id];
            return (
              <div class="bar-row" key={m.id}>
                <span class="row" style={{ gap: '8px' }}>
                  <PaperRoll emotion={m.id} size={0.7} /> {mood.label}
                </span>
                <div class="bar-track" role="img" aria-label={`${mood.label} ${m.pct} persen`}>
                  <div class="bar-fill" style={{ width: `${Math.max(m.pct, 3)}%` }} />
                </div>
                <span class="small muted" style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {m.pct}%
                </span>
              </div>
            );
          })}
        </section>
      )}

      <section class="card stack">
        <h2 class="bold">Hari favorit untuk menulis</h2>
        <WeekdayChart counts={week} />
      </section>

      {tags.length > 0 && (
        <section class="card stack">
          <h2 class="bold">Tag terpopuler</h2>
          <div class="row wrap" style={{ gap: '6px' }}>
            {tags.map((x) => (
              <span key={x.tag} class="chip tag">
                #{x.tag} · {x.count}
              </span>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function Tile({ k, v, hint }: { k: string; v: number | string; hint?: string }) {
  return (
    <div class="tile">
      <div class="v">{v}</div>
      <div class="k">{k}</div>
      {hint && <div class="tiny faint">{hint}</div>}
    </div>
  );
}

const W = 320;
const H = 170;
const PAD = { l: 30, r: 10, t: 12, b: 22 };

function TrendChart({ points }: { points: TrendPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const logged = points.map((p, i) => ({ ...p, i })).filter((p) => p.score !== null);
  const x = (i: number) => PAD.l + (i / (points.length - 1)) * (W - PAD.l - PAD.r);
  const y = (s: number) => PAD.t + ((5 - s) / 4) * (H - PAD.t - PAD.b);
  const path = logged.map((p, n) => `${n ? 'L' : 'M'}${x(p.i).toFixed(1)},${y(p.score!).toFixed(1)}`).join(' ');

  if (!logged.length) return <p class="small muted">Ambil kertas dari botol perasaan saat menulis untuk melihat grafiknya di sini.</p>;

  const pick = (clientX: number, rect: DOMRect) => {
    const px = ((clientX - rect.left) / rect.width) * W;
    let best: number | null = null;
    let bestD = Infinity;
    for (const p of logged) {
      const d = Math.abs(x(p.i) - px);
      if (d < bestD) {
        bestD = d;
        best = p.i;
      }
    }
    setHover(best);
  };
  const hp = hover !== null ? points[hover] : null;
  const fmt = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  const levelOf = (s: number) => LEVELS.reduce((a, b) => (Math.abs(b.score - s) < Math.abs(a.score - s) ? b : a));

  return (
    <div class="stack" style={{ gap: '8px' }}>
      <div style={{ position: 'relative' }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          role="img"
          aria-label={`Grafik perasaan harian, ${logged.length} hari tercatat dalam 30 hari terakhir`}
          style={{ display: 'block', touchAction: 'pan-y' }}
          onPointerMove={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect())}
          onPointerDown={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect())}
          onPointerLeave={() => setHover(null)}
        >
          {LEVELS.map((l) => (
            <g key={l.score}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(l.score)} y2={y(l.score)} stroke="var(--border)" stroke-width="1" />
              <text x={PAD.l - 8} y={y(l.score) + 5} text-anchor="end" font-size="13">
                {l.emoji}
              </text>
            </g>
          ))}
          <text x={PAD.l} y={H - 4} font-size="10" fill="var(--text-3)">
            {fmt(points[0].day)}
          </text>
          <text x={W - PAD.r} y={H - 4} font-size="10" fill="var(--text-3)" text-anchor="end">
            Hari ini
          </text>
          {hp && <line x1={x(hover!)} x2={x(hover!)} y1={PAD.t} y2={H - PAD.b} stroke="var(--text-3)" stroke-width="1" stroke-dasharray="3 3" />}
          <path d={path} fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
          {logged.map((p) => (
            <circle key={p.i} cx={x(p.i)} cy={y(p.score!)} r={hover === p.i ? 5.5 : 4} fill="var(--accent)" stroke="var(--surface)" stroke-width="2" />
          ))}
        </svg>
        {hp && hp.score !== null && (
          <div class="chart-tip" style={{ left: `${(x(hover!) / W) * 100}%`, top: `${(y(hp.score) / H) * 100 - 4}%` }}>
            {fmt(hp.day)} · {levelOf(hp.score).emoji} {levelOf(hp.score).label}
          </div>
        )}
      </div>
      <details class="small muted">
        <summary>Lihat sebagai tabel</summary>
        <table style={{ width: '100%', marginTop: '8px', borderCollapse: 'collapse' }}>
          <tbody>
            {logged.map((p) => (
              <tr key={p.day} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '4px 0' }}>{fmt(p.day)}</td>
                <td style={{ textAlign: 'right' }}>
                  {levelOf(p.score!).emoji} {levelOf(p.score!).label}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

function WeekdayChart({ counts }: { counts: number[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const order = [1, 2, 3, 4, 5, 6, 0];
  const names = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  const max = Math.max(...counts, 1);
  const best = counts.indexOf(Math.max(...counts));
  const bw = 28;
  const gap = (W - 7 * bw) / 8;
  const top = 18;
  const base = 120;
  return (
    <svg viewBox={`0 0 ${W} 146`} width="100%" role="img" aria-label={`Jumlah jurnal per hari dalam seminggu. Paling sering hari ${names[best]}.`} style={{ display: 'block' }}>
      <line x1={gap / 2} x2={W - gap / 2} y1={base} y2={base} stroke="var(--border)" />
      {order.map((d, n) => {
        const h = Math.max((counts[d] / max) * (base - top), counts[d] ? 4 : 0);
        const bx = gap + n * (bw + gap);
        const show = hover === d || (hover === null && d === best && counts[d] > 0);
        return (
          <g key={d} onPointerEnter={() => setHover(d)} onPointerDown={() => setHover(d)} onPointerLeave={() => setHover(null)}>
            <rect x={bx - gap / 2} y={0} width={bw + gap} height={146} fill="transparent" />
            {h > 0 && <path d={`M${bx},${base} V${base - h + 4} Q${bx},${base - h} ${bx + 4},${base - h} H${bx + bw - 4} Q${bx + bw},${base - h} ${bx + bw},${base - h + 4} V${base} Z`} fill="var(--accent)" opacity={hover === null || hover === d ? 1 : 0.45} />}
            {show && (
              <text x={bx + bw / 2} y={base - h - 6} text-anchor="middle" font-size="11" font-weight="700" fill="var(--text)">
                {counts[d]}
              </text>
            )}
            <text x={bx + bw / 2} y={base + 18} text-anchor="middle" font-size="11" fill="var(--text-2)">
              {names[d]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
