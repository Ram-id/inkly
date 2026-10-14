import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { MOOD_BY_ID, MOODS } from '../../domain/catalog';
import type { Entry, MoodId } from '../../domain/types';
import { Icon, type IconName } from '../icons';
import { back, go } from '../router';
import { services } from '../services';

export function TopBar({
  title,
  onBack,
  backTo = '',
  right
}: {
  title?: ComponentChildren;
  onBack?: () => void;
  backTo?: string;
  right?: ComponentChildren;
}) {
  return (
    <header class="topbar">
      <button class="icon-btn" aria-label="Kembali" onClick={onBack ?? (() => back(backTo))}>
        <Icon name="back" />
      </button>
      <h1>{title}</h1>
      {right}
    </header>
  );
}

const NAV: { path: string; label: string; icon: IconName }[] = [
  { path: '', label: 'Beranda', icon: 'home' },
  { path: 'calendar', label: 'Kalender', icon: 'calendar' },
  { path: 'stats', label: 'Statistik', icon: 'chart' },
  { path: 'settings', label: 'Pengaturan', icon: 'settings' }
];

export function BottomNav({ current, onCompose }: { current: string; onCompose: () => void }) {
  const btn = (n: (typeof NAV)[number]) => (
    <button key={n.path} class={`nav-btn ${current === n.path ? 'on' : ''}`} onClick={() => go(n.path, { replace: true })}>
      <Icon name={n.icon} size={23} />
      {n.label}
    </button>
  );
  return (
    <nav class="bottom-nav" aria-label="Navigasi utama">
      <div class="bottom-nav-inner">
        {btn(NAV[0])}
        {btn(NAV[1])}
        <button class="fab" aria-label="Tulis jurnal baru" onClick={onCompose}>
          <Icon name="plus" size={28} stroke-width={2.4} />
        </button>
        {btn(NAV[2])}
        {btn(NAV[3])}
      </div>
    </nav>
  );
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button role="switch" aria-checked={on} aria-label={label} class={`switch ${on ? 'on' : ''}`} onClick={() => onChange(!on)} />;
}

export function PasswordInput({
  value,
  onInput,
  placeholder = 'Password',
  autoComplete = 'current-password',
  autoFocus
}: {
  value: string;
  onInput: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  autoFocus?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div class="input-wrap">
      <input
        class="input"
        type={show ? 'text' : 'password'}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        autofocus={autoFocus}
        autoCapitalize="off"
        spellcheck={false}
        onInput={(e) => onInput(e.currentTarget.value)}
      />
      <button type="button" class="icon-btn" aria-label={show ? 'Sembunyikan password' : 'Tampilkan password'} onClick={() => setShow(!show)}>
        <Icon name={show ? 'eyeOff' : 'eye'} size={20} />
      </button>
    </div>
  );
}

/** Rough strength estimate; the hard rule is the minimum length. */
export function passwordScore(pw: string): 0 | 1 | 2 | 3 | 4 {
  if (!pw) return 0;
  let classes = 0;
  if (/[a-z]/.test(pw)) classes++;
  if (/[A-Z]/.test(pw)) classes++;
  if (/\d/.test(pw)) classes++;
  if (/[^A-Za-z0-9]/.test(pw)) classes++;
  const words = pw.trim().split(/\s+/).length;
  if (pw.length < MIN_PASSWORD) return 1;
  if (/^(.)\1+$/.test(pw) || /^(12345|password|qwerty)/i.test(pw)) return 1;
  if (pw.length >= 16 || words >= 4) return classes >= 2 || words >= 4 ? 4 : 3;
  if (pw.length >= 12 && classes >= 3) return 3;
  return 2;
}
export const MIN_PASSWORD = 10;

export function StrengthMeter({ pw }: { pw: string }) {
  const s = passwordScore(pw);
  const label = ['', 'Terlalu lemah', 'Cukup', 'Kuat', 'Sangat kuat'][s];
  return (
    <div class="stack" style={{ gap: '6px' }}>
      <div class={`strength s${s}`} aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>
      {pw && <span class="tiny muted">{label}{pw.length < MIN_PASSWORD ? ` · minimal ${MIN_PASSWORD} karakter` : ''}</span>}
    </div>
  );
}

export function MoodPicker({ value, onChange }: { value?: MoodId; onChange: (m: MoodId | undefined) => void }) {
  return (
    <div class="mood-row" role="radiogroup" aria-label="Mood">
      {MOODS.map((m) => (
        <button
          key={m.id}
          role="radio"
          aria-checked={value === m.id}
          class={`mood-btn ${value === m.id ? 'on' : ''}`}
          onClick={() => onChange(value === m.id ? undefined : m.id)}
        >
          <span class="e">{m.emoji}</span>
          {m.label}
        </button>
      ))}
    </div>
  );
}

const WEEKDAY = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

export function EntryCard({ entry }: { entry: Entry }) {
  const d = new Date(entry.date);
  const mood = entry.mood ? MOOD_BY_ID[entry.mood] : null;
  const snippet = entry.body.replace(/\s+/g, ' ').trim();
  return (
    <button class="entry-card" onClick={() => go(`entry/${entry.id}`)}>
      <div class="date-block">
        <div class="d">{d.getDate()}</div>
        <div class="w">{WEEKDAY[d.getDay()]}</div>
        {mood && (
          <div style={{ fontSize: '18px', marginTop: '4px' }} title={mood.label} aria-label={`Mood ${mood.label}`}>
            {mood.emoji}
          </div>
        )}
      </div>
      <div class="grow stack" style={{ gap: '3px' }}>
        <div class="row" style={{ gap: '6px' }}>
          <span class="title grow">{entry.title || 'Tanpa judul'}</span>
          {entry.favorite && <Icon name="star" size={15} solid style={{ color: 'var(--warn)', flex: 'none' }} />}
        </div>
        {snippet && <p class="snippet">{snippet}</p>}
        <div class="row wrap" style={{ gap: '6px', marginTop: '2px' }}>
          <span class="tiny faint">{d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
          {entry.tags.slice(0, 3).map((t) => (
            <span key={t} class="chip tag">
              #{t}
            </span>
          ))}
        </div>
      </div>
      {entry.photos[0] && <img class="entry-thumb" src={entry.photos[0].thumb} alt="" />}
    </button>
  );
}

/** Decrypts a full-size photo on demand; shows the stored thumbnail meanwhile. */
export function SecureImg({ id, thumb, alt = '' }: { id: string; thumb?: string; alt?: string }) {
  const [src, setSrc] = useState<string | undefined>(thumb);
  useEffect(() => {
    let alive = true;
    services.vault
      .photoUrl(id)
      .then((u) => alive && u && setSrc(u))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [id]);
  return src ? <img src={src} alt={alt} /> : <div class="spinner" style={{ margin: 'auto' }} />;
}

export function Empty({ emoji, title, children }: { emoji: string; title: string; children?: ComponentChildren }) {
  return (
    <div class="empty stack" style={{ alignItems: 'center' }}>
      <div class="e">{emoji}</div>
      <p class="bold">{title}</p>
      {children}
    </div>
  );
}

export function groupByMonth(entries: Entry[]): { label: string; items: Entry[] }[] {
  const groups: { label: string; items: Entry[] }[] = [];
  for (const e of entries) {
    const label = new Date(e.date).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    const last = groups[groups.length - 1];
    if (last?.label === label) last.items.push(e);
    else groups.push({ label, items: [e] });
  }
  return groups;
}

export function downloadText(filename: string, text: string, type = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
