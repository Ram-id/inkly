import { useEffect, useState } from 'preact/hooks';
import { getMeta } from '../../storage/db';
import { hasPin, unlockWithPin, WrongPinError } from '../../storage/pin';
import { Icon } from '../icons';
import { services } from '../services';
import { busy, errorMessage, toast } from '../components/feedback';
import { MIN_PASSWORD, PasswordInput, StrengthMeter } from '../components/common';
import { deriveAuthSecret } from '../../crypto/keys';

type Mode = 'loading' | 'pin' | 'password' | 'recover';

export function Unlock() {
  const [mode, setMode] = useState<Mode>('loading');
  useEffect(() => {
    hasPin(services.vault).then((p) => setMode(p ? 'pin' : 'password'));
  }, []);

  const unlocked = async () => {
    await services.refreshSync();
    void services.syncNow();
  };

  if (mode === 'loading') return <div class="lock-screen" />;
  if (mode === 'pin') return <PinPad onUnlocked={unlocked} onPassword={() => setMode('password')} />;
  if (mode === 'recover') return <LocalRecover onBack={() => setMode('password')} onUnlocked={unlocked} />;
  return <PasswordUnlock onUnlocked={unlocked} onForgot={() => setMode('recover')} />;
}

function LockHeader({ subtitle }: { subtitle: string }) {
  return (
    <div class="center stack" style={{ alignItems: 'center', gap: '8px' }}>
      <div class="brand" style={{ fontSize: '40px' }}>
        inkly
      </div>
      <p class="muted small" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Icon name="lock" size={15} /> {subtitle}
      </p>
    </div>
  );
}

function PinPad({ onUnlocked, onPassword }: { onUnlocked: () => void; onPassword: () => void }) {
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const [shake, setShake] = useState(false);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (pin.length !== 6 || working) return;
    setWorking(true);
    unlockWithPin(services.vault, pin)
      .then(onUnlocked)
      .catch((e) => {
        setShake(true);
        setTimeout(() => setShake(false), 400);
        setPin('');
        setErr(errorMessage(e));
        if (e instanceof WrongPinError && e.attemptsLeft <= 0) onPassword();
        else if (!(e instanceof WrongPinError)) onPassword();
      })
      .finally(() => setWorking(false));
  }, [pin]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) setPin((p) => (p.length < 6 ? p + e.key : p));
      if (e.key === 'Backspace') setPin((p) => p.slice(0, -1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const press = (d: string) => setPin((p) => (p.length < 6 ? p + d : p));
  return (
    <main class="lock-screen">
      <LockHeader subtitle="Masukkan PIN" />
      <div class={`pin-dots ${shake ? 'shake' : ''}`} aria-label={`${pin.length} dari 6 angka`}>
        {Array.from({ length: 6 }, (_, i) => (
          <i key={i} class={i < pin.length ? 'on' : ''} />
        ))}
      </div>
      <p class="error-text" style={{ minHeight: '20px' }}>
        {working ? <span class="muted">Membuka…</span> : err}
      </p>
      <div class="keypad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} class="key" onClick={() => press(d)}>
            {d}
          </button>
        ))}
        <button class="key plain" onClick={onPassword}>
          Password
        </button>
        <button class="key" onClick={() => press('0')}>
          0
        </button>
        <button class="key plain" aria-label="Hapus" onClick={() => setPin((p) => p.slice(0, -1))}>
          ⌫
        </button>
      </div>
    </main>
  );
}

function PasswordUnlock({ onUnlocked, onForgot }: { onUnlocked: () => void; onForgot: () => void }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const submit = async (e: Event) => {
    e.preventDefault();
    setErr('');
    try {
      await busy('Membuka jurnal…', () => services.vault.unlockPassword(pw));
      await onUnlocked();
    } catch (e) {
      setErr(errorMessage(e));
    }
  };
  return (
    <main class="lock-screen">
      <LockHeader subtitle="Jurnalmu terkunci" />
      <form class="stack" style={{ width: '100%' }} onSubmit={submit}>
        <PasswordInput value={pw} onInput={setPw} autoFocus />
        {err && <p class="error-text">{err}</p>}
        <button class="btn block" type="submit" disabled={!pw}>
          Buka jurnal
        </button>
        <button class="btn block ghost" type="button" onClick={onForgot}>
          Lupa password? Pakai recovery key
        </button>
      </form>
    </main>
  );
}

function LocalRecover({ onBack, onUnlocked }: { onBack: () => void; onUnlocked: () => void }) {
  const [words, setWords] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const submit = async (e: Event) => {
    e.preventDefault();
    setErr('');
    if (pw.length < MIN_PASSWORD) return setErr(`Password baru minimal ${MIN_PASSWORD} karakter.`);
    try {
      await busy('Membuka dengan recovery key…', async () => {
        const vault = services.vault;
        await vault.unlockRecovery(words);
        const blob = await vault.changePassword(pw);
        // Keep the sync account login in step with the new password when possible.
        const meta = await getMeta(vault.db, 'sync');
        if (meta && services.account) {
          try {
            await services.account.auth.updateSecret(await deriveAuthSecret(meta.email, pw));
            await services.account.auth.remoteFor(meta.userId).putKeyBlob(blob);
          } catch {
            toast('Password di perangkat ini sudah diganti. Untuk akun sinkronisasi, gunakan "Lupa password" saat masuk di perangkat lain.', 'error');
          }
        }
      });
      toast('Password baru sudah aktif.');
      await onUnlocked();
    } catch (e) {
      setErr(errorMessage(e));
    }
  };
  return (
    <main class="screen no-nav">
      <header class="topbar">
        <button class="icon-btn" aria-label="Kembali" onClick={onBack}>
          <Icon name="back" />
        </button>
        <h1>Pulihkan dengan recovery key</h1>
      </header>
      <form class="stack-lg" onSubmit={submit}>
        <label class="field">
          <span>24 kata recovery key</span>
          <textarea class="textarea" rows={4} autoCapitalize="off" spellcheck={false} value={words} placeholder="kata1 kata2 kata3 …" onInput={(e) => setWords(e.currentTarget.value)} />
        </label>
        <label class="field">
          <span>Password baru</span>
          <PasswordInput value={pw} onInput={setPw} autoComplete="new-password" placeholder="Password baru" />
          <StrengthMeter pw={pw} />
        </label>
        {err && <p class="error-text">{err}</p>}
        <button class="btn block" type="submit" disabled={!words || !pw}>
          Buka & ganti password
        </button>
      </form>
    </main>
  );
}
