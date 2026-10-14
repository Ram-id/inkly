import { useMemo, useState } from 'preact/hooks';
import { syncAvailable } from '../../config';
import { normalizeWords } from '../../crypto/recovery';
import { enablePin, isValidPin } from '../../storage/pin';
import { Icon } from '../icons';
import { go } from '../router';
import { services } from '../services';
import { busy, errorMessage, toast } from '../components/feedback';
import { MIN_PASSWORD, PasswordInput, StrengthMeter, downloadText } from '../components/common';
import { RecoveryWords } from '../components/RecoveryWords';
import { Jar } from '../components/Paper';
import { Inky } from '../components/Inky';

type Step = 'welcome' | 'password' | 'words' | 'verify' | 'pin' | 'name' | 'login' | 'forgot' | 'restore';

export function Onboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<Step>('welcome');
  const [words, setWords] = useState<string[]>([]);

  const finish = async () => {
    // Whatever happens here, leave onboarding: if the journal got locked meanwhile,
    // the app simply shows the unlock screen next.
    await services.refreshSync().catch(() => {});
    go('', { replace: true });
    onDone();
  };

  switch (step) {
    case 'welcome':
      return <Welcome onNew={() => setStep('password')} onLogin={() => setStep('login')} onRestore={() => setStep('restore')} />;
    case 'password':
      return (
        <CreatePassword
          onBack={() => setStep('welcome')}
          onCreated={(w) => {
            setWords(w);
            setStep('words');
          }}
        />
      );
    case 'words':
      return <ShowWords words={words} onNext={() => setStep('verify')} />;
    case 'verify':
      return <VerifyWords words={words} onBack={() => setStep('words')} onNext={() => setStep('pin')} />;
    case 'pin':
      return <SetupPin onNext={() => setStep('name')} />;
    case 'name':
      return <AskName onNext={finish} />;
    case 'login':
      return <Login onBack={() => setStep('welcome')} onForgot={() => setStep('forgot')} onDone={finish} />;
    case 'forgot':
      return <ForgotAccount onBack={() => setStep('login')} onDone={finish} />;
    case 'restore':
      return <RestoreBackup onBack={() => setStep('welcome')} onDone={finish} />;
  }
}

function Welcome({ onNew, onLogin, onRestore }: { onNew: () => void; onLogin: () => void; onRestore: () => void }) {
  return (
    <main class="screen no-nav stack-lg">
      <div class="hero center stack" style={{ alignItems: 'center', gap: '14px', paddingTop: '40px' }}>
        <div class="row" style={{ alignItems: 'flex-end', gap: '0' }}>
          <Inky size={96} bounce face="wink" />
          <Jar size={150} />
        </div>
        <div class="brand" style={{ fontSize: '42px' }}>
          inkly
        </div>
        <h1 style={{ marginTop: 0 }}>Ruang kecil untuk cerita harianmu.</h1>
      </div>
      <div class="stack">
        <button class="btn block" onClick={onNew}>
          Mulai jurnal baru
        </button>
        {syncAvailable() && (
          <button class="btn block secondary" onClick={onLogin}>
            Saya sudah punya akun
          </button>
        )}
        <button class="btn block ghost" onClick={onRestore}>
          Pulihkan dari file backup
        </button>
      </div>
    </main>
  );
}

function CreatePassword({ onBack, onCreated }: { onBack: () => void; onCreated: (words: string[]) => void }) {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState('');

  const submit = async (e: Event) => {
    e.preventDefault();
    if (pw.length < MIN_PASSWORD) return setErr(`Password minimal ${MIN_PASSWORD} karakter.`);
    if (pw !== pw2) return setErr('Kedua password tidak sama.');
    try {
      const words = await busy('Membuat kunci jurnal…', () => services.vault.create(pw));
      onCreated(words);
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
        <h1>Buat password</h1>
      </header>
      <form class="stack-lg" onSubmit={submit}>
        <label class="field">
          <span>Password</span>
          <PasswordInput value={pw} onInput={setPw} autoComplete="new-password" autoFocus />
          <StrengthMeter pw={pw} />
        </label>
        <label class="field">
          <span>Ulangi password</span>
          <PasswordInput value={pw2} onInput={setPw2} autoComplete="new-password" placeholder="Ketik ulang" />
        </label>
        {err && <p class="error-text">{err}</p>}
        <button class="btn block" type="submit" disabled={!pw || !pw2}>
          Lanjut
        </button>
      </form>
    </main>
  );
}

function ShowWords({ words, onNext }: { words: string[]; onNext: () => void }) {
  const [saved, setSaved] = useState(false);
  return (
    <main class="screen no-nav stack-lg">
      <div class="hero" style={{ paddingTop: '12px' }}>
        <div class="hero-art">🔑</div>
        <h1 style={{ fontSize: '24px' }}>Simpan 24 kata ini</h1>
      </div>
      <RecoveryWords words={words} />
      <button
        class="btn block secondary"
        onClick={() => downloadText('inkly-recovery-key.txt', `Recovery key Inkly (simpan di tempat aman):\n\n${words.map((w, i) => `${i + 1}. ${w}`).join('\n')}\n`, 'text/plain')}
      >
        <Icon name="download" size={18} /> Unduh sebagai file teks
      </button>
      <label class="row" style={{ alignItems: 'flex-start', gap: '10px' }}>
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.currentTarget.checked)} style={{ width: '22px', height: '22px', marginTop: '1px' }} />
        <span class="small">Sudah kusimpan.</span>
      </label>
      <button class="btn block" disabled={!saved} onClick={onNext}>
        Lanjut
      </button>
    </main>
  );
}

function VerifyWords({ words, onBack, onNext }: { words: string[]; onBack: () => void; onNext: () => void }) {
  const picks = useMemo(() => {
    const idx = new Set<number>();
    while (idx.size < 3) idx.add(crypto.getRandomValues(new Uint32Array(1))[0] % 24);
    return [...idx].sort((a, b) => a - b);
  }, [words]);
  const [answers, setAnswers] = useState<string[]>(['', '', '']);
  const [err, setErr] = useState('');

  const check = (e: Event) => {
    e.preventDefault();
    const ok = picks.every((p, i) => normalizeWords(answers[i]) === words[p]);
    if (!ok) return setErr('Ada kata yang belum cocok. Periksa lagi catatanmu.');
    void services.vault.savePrefs({ recoveryConfirmed: true });
    onNext();
  };

  return (
    <main class="screen no-nav">
      <header class="topbar">
        <button class="icon-btn" aria-label="Kembali" onClick={onBack}>
          <Icon name="back" />
        </button>
        <h1>Cek catatanmu</h1>
      </header>
      <form class="stack-lg" onSubmit={check}>
        {picks.map((p, i) => (
          <label class="field" key={p}>
            <span>Kata ke-{p + 1}</span>
            <input
              class="input"
              autoCapitalize="off"
              autoComplete="off"
              spellcheck={false}
              value={answers[i]}
              onInput={(e) => {
                const v = e.currentTarget.value;
                setAnswers((prev) => prev.map((x, j) => (j === i ? v : x)));
              }}
            />
          </label>
        ))}
        {err && <p class="error-text">{err}</p>}
        <button class="btn block" type="submit">
          Konfirmasi
        </button>
      </form>
    </main>
  );
}

function SetupPin({ onNext }: { onNext: () => void }) {
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const save = async (e: Event) => {
    e.preventDefault();
    if (!isValidPin(pin)) return setErr('PIN harus 6 angka.');
    if (services.vault.unlocked) await busy('Menyiapkan PIN…', () => enablePin(services.vault, pin)).catch(() => {});
    onNext();
  };
  return (
    <main class="screen no-nav">
      <form class="stack-lg" onSubmit={save}>
        <div class="hero" style={{ paddingTop: '12px' }}>
          <div class="hero-art">🔢</div>
          <h1 style={{ fontSize: '24px' }}>Pakai PIN?</h1>
        </div>
        <label class="field">
          <span>PIN 6 angka</span>
          <input
            class="input"
            inputMode="numeric"
            type="password"
            maxLength={6}
            autoComplete="off"
            value={pin}
            onInput={(e) => setPin(e.currentTarget.value.replace(/\D/g, ''))}
            style={{ letterSpacing: '0.5em', textAlign: 'center', fontSize: '22px' }}
          />
        </label>
        {err && <p class="error-text">{err}</p>}
        <button class="btn block" type="submit" disabled={pin.length !== 6}>
          Aktifkan PIN
        </button>
        <button class="btn block ghost" type="button" onClick={onNext}>
          Lewati
        </button>
      </form>
    </main>
  );
}

function AskName({ onNext }: { onNext: () => void }) {
  const [name, setName] = useState('');
  const save = async (e: Event) => {
    e.preventDefault();
    if (name.trim() && services.vault.unlocked) await services.vault.saveSettings({ displayName: name.trim() }).catch(() => {});
    onNext();
  };
  return (
    <main class="screen no-nav">
      <form class="stack-lg" onSubmit={save}>
        <div class="hero" style={{ paddingTop: '12px' }}>
          <div class="hero-art">👋</div>
          <h1 style={{ fontSize: '24px' }}>Mau dipanggil siapa?</h1>
        </div>
        <input class="input" value={name} placeholder="Nama panggilan" onInput={(e) => setName(e.currentTarget.value)} />
        <button class="btn block" type="submit">
          {name.trim() ? 'Mulai menulis' : 'Lewati'}
        </button>
      </form>
    </main>
  );
}

function Login({ onBack, onForgot, onDone }: { onBack: () => void; onForgot: () => void; onDone: () => void }) {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const submit = async (e: Event) => {
    e.preventDefault();
    setErr('');
    try {
      await busy('Masuk & membuka jurnal…', () => services.account!.signInFresh(email, pw));
      await services.refreshSync();
      void services.syncNow();
      toast('Jurnal berhasil dibuka di perangkat ini.');
      onDone();
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
        <h1>Masuk</h1>
      </header>
      <form class="stack-lg" onSubmit={submit}>
        <label class="field">
          <span>Email</span>
          <input class="input" type="email" autoComplete="email" value={email} onInput={(e) => setEmail(e.currentTarget.value)} />
        </label>
        <label class="field">
          <span>Password</span>
          <PasswordInput value={pw} onInput={setPw} />
        </label>
        {err && <p class="error-text">{err}</p>}
        <button class="btn block" type="submit" disabled={!email || !pw}>
          Masuk
        </button>
        <button class="btn block ghost" type="button" onClick={onForgot}>
          Lupa password?
        </button>
      </form>
    </main>
  );
}

function ForgotAccount({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [words, setWords] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');

  const send = async (e: Event) => {
    e.preventDefault();
    setErr('');
    try {
      await busy('Mengirim kode…', () => services.account!.sendRecoveryCode(email));
      setSent(true);
    } catch (e) {
      setErr(errorMessage(e));
    }
  };
  const recover = async (e: Event) => {
    e.preventDefault();
    setErr('');
    if (pw.length < MIN_PASSWORD) return setErr(`Password baru minimal ${MIN_PASSWORD} karakter.`);
    try {
      await busy('Membuka jurnal dengan recovery key…', () => services.account!.recoverWithCode(email, code, words, pw));
      await services.refreshSync();
      void services.syncNow();
      toast('Password baru sudah aktif.');
      onDone();
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
        <h1>Lupa password</h1>
      </header>
      {!sent ? (
        <form class="stack-lg" onSubmit={send}>
          <label class="field">
            <span>Email akun</span>
            <input class="input" type="email" autoComplete="email" value={email} onInput={(e) => setEmail(e.currentTarget.value)} />
          </label>
          {err && <p class="error-text">{err}</p>}
          <button class="btn block" type="submit" disabled={!email}>
            Kirim kode
          </button>
        </form>
      ) : (
        <form class="stack-lg" onSubmit={recover}>
          <label class="field">
            <span>Kode dari email</span>
            <input class="input" inputMode="numeric" autoComplete="one-time-code" value={code} onInput={(e) => setCode(e.currentTarget.value)} />
          </label>
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
          <button class="btn block" type="submit" disabled={!code || !words || !pw}>
            Pulihkan jurnal
          </button>
        </form>
      )}
    </main>
  );
}

function RestoreBackup({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [secret, setSecret] = useState('');
  const [err, setErr] = useState('');
  const submit = async (e: Event) => {
    e.preventDefault();
    if (!file) return;
    setErr('');
    try {
      const n = await busy('Memulihkan backup…', async () => services.vault.importBackup(await file.text(), secret));
      toast(`${n} jurnal dipulihkan.`);
      onDone();
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
        <h1>Pulihkan backup</h1>
      </header>
      <form class="stack-lg" onSubmit={submit}>
        <label class="btn block secondary">
          <Icon name="file" size={18} /> {file ? file.name : 'Pilih file backup'}
          <input type="file" accept=".inkly,application/json" class="sr-only" onChange={(e) => setFile(e.currentTarget.files?.[0] ?? null)} />
        </label>
        <label class="field">
          <span>Password atau 24 kata</span>
          <textarea class="textarea" rows={3} autoCapitalize="off" spellcheck={false} value={secret} onInput={(e) => setSecret(e.currentTarget.value)} />
        </label>
        {err && <p class="error-text">{err}</p>}
        <button class="btn block" type="submit" disabled={!file || !secret}>
          Pulihkan
        </button>
      </form>
    </main>
  );
}
