import { useEffect, useState } from 'preact/hooks';
import { syncAvailable } from '../../config';
import { disablePin, enablePin, hasPin, isValidPin } from '../../storage/pin';
import type { SyncMeta } from '../../storage/db';
import { Icon, type IconName } from '../icons';
import { go } from '../router';
import { services, useSync, useVault } from '../services';
import { MIN_PASSWORD, PasswordInput, StrengthMeter, Switch, TopBar, downloadText } from '../components/common';
import { Sheet, busy, confirmDialog, errorMessage, toast } from '../components/feedback';
import { RecoveryWords } from '../components/RecoveryWords';
import { InstallCard } from '../components/InstallCard';
import { unlockWithPassword } from '../../crypto/keys';

function Item({ icon, label, hint, onClick, right, danger }: { icon: IconName; label: string; hint?: string; onClick?: () => void; right?: preact.ComponentChildren; danger?: boolean }) {
  const body = (
    <>
      <span class="icon-badge" style={danger ? { background: 'var(--danger-soft)', color: 'var(--danger)' } : undefined}>
        <Icon name={icon} size={19} />
      </span>
      <span class="label" style={danger ? { color: 'var(--danger)' } : undefined}>
        <b style={{ fontWeight: 600 }}>{label}</b>
        {hint && <small>{hint}</small>}
      </span>
      {right ?? (onClick && <Icon name="next" size={18} style={{ color: 'var(--text-3)' }} />)}
    </>
  );
  return onClick ? (
    <button class="list-item" onClick={onClick}>
      {body}
    </button>
  ) : (
    <div class="list-item">{body}</div>
  );
}

const LOCK_OPTIONS = [
  { v: 0, label: 'Langsung' },
  { v: 1, label: '1 mnt' },
  { v: 5, label: '5 mnt' },
  { v: 15, label: '15 mnt' }
];

export function Settings() {
  const vault = useVault();
  const { status, linked } = useSync();
  const [name, setName] = useState(vault.settings.displayName);

  return (
    <main class="screen stack-lg">
      <h1 class="greeting" style={{ paddingTop: '8px' }}>
        Pengaturan
      </h1>

      <section class="stack">
        <h2 class="section-title">Profil</h2>
        <div class="card flat row">
          <input
            class="input grow"
            value={name}
            placeholder="Nama panggilan"
            onInput={(e) => setName(e.currentTarget.value)}
            onBlur={() => name !== vault.settings.displayName && vault.saveSettings({ displayName: name.trim() })}
            aria-label="Nama panggilan"
          />
        </div>
      </section>

      <section class="stack">
        <h2 class="section-title">Keamanan & privasi</h2>
        <div class="list">
          <Item icon="shield" label="Keamanan" hint="Password, PIN, recovery key, kunci otomatis" onClick={() => go('settings/security')} />
          <Item icon="eye" label="Apa yang bisa dilihat developer?" hint="Penjelasan jujur tentang privasimu" onClick={() => go('privacy')} />
        </div>
      </section>

      <section class="stack">
        <h2 class="section-title">Data</h2>
        <div class="list">
          {syncAvailable() && (
            <Item
              icon="cloud"
              label="Sinkronisasi"
              hint={linked ? syncLabel(status?.state, status?.lastSyncAt ?? null) : 'Mati · jurnal hanya ada di HP ini'}
              onClick={() => go('settings/sync')}
            />
          )}
          <Item icon="download" label="Backup & ekspor" hint="File backup terenkripsi, pulihkan, ekspor teks" onClick={() => go('settings/backup')} />
          <Item icon="bell" label="Pengingat menulis" hint={`Setiap hari pukul ${vault.settings.reminderTime}`} onClick={() => go('settings/reminder')} />
        </div>
      </section>

      <section class="stack">
        <h2 class="section-title">Tampilan</h2>
        <div class="segmented">
          {(['system', 'light', 'dark'] as const).map((t) => (
            <button key={t} class={vault.prefs.theme === t ? 'on' : ''} onClick={() => vault.savePrefs({ theme: t })}>
              {{ system: 'Ikuti HP', light: 'Terang', dark: 'Gelap' }[t]}
            </button>
          ))}
        </div>
        <div class="list">
          <Item icon="calendar" label="Minggu dimulai hari Senin" right={<Switch label="Minggu dimulai Senin" on={vault.settings.weekStartsMonday} onChange={(v) => vault.saveSettings({ weekStartsMonday: v })} />} />
        </div>
      </section>

      <InstallCard always />

      <button class="btn block secondary" onClick={() => vault.lock()}>
        <Icon name="lock" size={18} /> Kunci jurnal sekarang
      </button>
      <p class="tiny faint center">Inkly {__APP_VERSION__} · enkripsi XChaCha20-Poly1305 + Argon2id</p>
    </main>
  );
}

function syncLabel(state: string | undefined, last: number | null): string {
  if (state === 'syncing') return 'Menyinkronkan…';
  if (state === 'error') return 'Gagal sinkron, ketuk untuk detail';
  if (state === 'offline') return 'Offline, akan sinkron saat online';
  if (state === 'needs-login') return 'Perlu masuk lagi';
  return last ? `Tersinkron ${new Date(last).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}` : 'Aktif';
}

// ------------------------------------------------------------------ security

export function SecuritySettings() {
  const vault = useVault();
  const [pin, setPin] = useState<boolean | null>(null);
  const [sheet, setSheet] = useState<'password' | 'pin' | 'reveal' | 'rotate' | null>(null);
  useEffect(() => {
    hasPin(vault).then(setPin);
  }, [sheet]);

  return (
    <main class="screen no-nav stack-lg">
      <TopBar title="Keamanan" backTo="settings" />
      <section class="stack">
        <h2 class="section-title">Membuka jurnal</h2>
        <div class="list">
          <Item icon="key" label="Ganti password" onClick={() => setSheet('password')} />
          <Item
            icon="grid"
            label="Buka cepat dengan PIN"
            hint="Hanya berlaku di perangkat ini"
            right={
              <Switch
                label="PIN"
                on={!!pin}
                onChange={async (v) => {
                  if (v) setSheet('pin');
                  else {
                    await disablePin(vault);
                    setPin(false);
                    toast('PIN dinonaktifkan.');
                  }
                }}
              />
            }
          />
        </div>
      </section>
      <section class="stack">
        <h2 class="section-title">Kunci otomatis saat ditinggal</h2>
        <div class="segmented">
          {LOCK_OPTIONS.map((o) => (
            <button key={o.v} class={vault.prefs.autoLockMinutes === o.v ? 'on' : ''} onClick={() => vault.savePrefs({ autoLockMinutes: o.v })}>
              {o.label}
            </button>
          ))}
        </div>
        <p class="tiny faint">Jurnal terkunci dan kuncinya dihapus dari memori setelah aplikasi tidak dipakai selama waktu ini.</p>
      </section>
      <section class="stack">
        <h2 class="section-title">Recovery key</h2>
        <div class="list">
          <Item icon="eye" label="Lihat recovery key" hint="Perlu password" onClick={() => setSheet('reveal')} />
          <Item icon="refresh" label="Buat recovery key baru" hint="Kalau 24 kata lama mungkin dilihat orang lain" onClick={() => setSheet('rotate')} />
        </div>
      </section>

      {sheet === 'password' && <ChangePasswordSheet onClose={() => setSheet(null)} />}
      {sheet === 'pin' && <PinSheet onClose={() => setSheet(null)} />}
      {(sheet === 'reveal' || sheet === 'rotate') && <RecoverySheet rotate={sheet === 'rotate'} onClose={() => setSheet(null)} />}
    </main>
  );
}

function ChangePasswordSheet({ onClose }: { onClose: () => void }) {
  const [cur, setCur] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState('');
  const save = async (e: Event) => {
    e.preventDefault();
    setErr('');
    if (pw.length < MIN_PASSWORD) return setErr(`Password minimal ${MIN_PASSWORD} karakter.`);
    if (pw !== pw2) return setErr('Kedua password baru tidak sama.');
    try {
      await busy('Mengganti password…', async () => {
        if (services.account) await services.account.changePassword(cur, pw);
        else {
          await unlockWithPassword(services.vault.keyBlob!, cur);
          await services.vault.changePassword(pw);
        }
      });
      toast('Password berhasil diganti.');
      onClose();
    } catch (e) {
      setErr(errorMessage(e));
    }
  };
  return (
    <Sheet onClose={onClose}>
      <form class="stack" onSubmit={save}>
        <h2>Ganti password</h2>
        <p class="small muted">Isi jurnal tidak perlu dienkripsi ulang. Hanya “gembok” kuncinya yang diganti.</p>
        <PasswordInput value={cur} onInput={setCur} placeholder="Password sekarang" />
        <PasswordInput value={pw} onInput={setPw} placeholder="Password baru" autoComplete="new-password" />
        <StrengthMeter pw={pw} />
        <PasswordInput value={pw2} onInput={setPw2} placeholder="Ulangi password baru" autoComplete="new-password" />
        {err && <p class="error-text">{err}</p>}
        <button class="btn block" type="submit" disabled={!cur || !pw || !pw2}>
          Simpan
        </button>
      </form>
    </Sheet>
  );
}

function PinSheet({ onClose }: { onClose: () => void }) {
  const [pin, setPin] = useState('');
  const save = async (e: Event) => {
    e.preventDefault();
    if (!isValidPin(pin)) return;
    await busy('Menyiapkan PIN…', () => enablePin(services.vault, pin));
    toast('PIN aktif di perangkat ini.');
    onClose();
  };
  return (
    <Sheet onClose={onClose}>
      <form class="stack" onSubmit={save}>
        <h2>Atur PIN 6 angka</h2>
        <input
          class="input"
          inputMode="numeric"
          type="password"
          maxLength={6}
          autofocus
          value={pin}
          onInput={(e) => setPin(e.currentTarget.value.replace(/\D/g, ''))}
          style={{ letterSpacing: '0.5em', textAlign: 'center', fontSize: '22px' }}
        />
        <button class="btn block" type="submit" disabled={pin.length !== 6}>
          Aktifkan
        </button>
      </form>
    </Sheet>
  );
}

function RecoverySheet({ rotate, onClose }: { rotate: boolean; onClose: () => void }) {
  const [pw, setPw] = useState('');
  const [words, setWords] = useState<string[] | null>(null);
  const [err, setErr] = useState('');
  const submit = async (e: Event) => {
    e.preventDefault();
    setErr('');
    try {
      const w = await busy(rotate ? 'Membuat recovery key baru…' : 'Memeriksa password…', async () => {
        if (rotate) {
          if (services.account) return services.account.newRecoveryKey(pw);
          await unlockWithPassword(services.vault.keyBlob!, pw);
          return (await services.vault.newRecoveryKey()).words;
        }
        await unlockWithPassword(services.vault.keyBlob!, pw);
        return services.vault.recoveryWords();
      });
      setWords(w);
      void services.vault.savePrefs({ recoveryConfirmed: true });
    } catch (e) {
      setErr(errorMessage(e));
    }
  };
  return (
    <Sheet onClose={onClose}>
      {words ? (
        <div class="stack">
          <h2>{rotate ? 'Recovery key baru' : 'Recovery key-mu'}</h2>
          {rotate && <p class="card warn small">24 kata lama sudah tidak berlaku. Simpan 24 kata baru ini di tempat aman.</p>}
          <RecoveryWords words={words} />
          <button class="btn block" onClick={onClose}>
            Sudah saya simpan
          </button>
        </div>
      ) : (
        <form class="stack" onSubmit={submit}>
          <h2>{rotate ? 'Buat recovery key baru' : 'Lihat recovery key'}</h2>
          <p class="small muted">Masukkan password untuk melanjutkan. Pastikan tidak ada orang yang melihat layarmu.</p>
          <PasswordInput value={pw} onInput={setPw} autoFocus />
          {err && <p class="error-text">{err}</p>}
          <button class="btn block" type="submit" disabled={!pw}>
            Lanjut
          </button>
        </form>
      )}
    </Sheet>
  );
}

// ------------------------------------------------------------------ sync

export function SyncSettings() {
  const { status, linked } = useSync();
  const [meta, setMeta] = useState<SyncMeta | undefined>();
  const [mode, setMode] = useState<'register' | 'signin' | 'confirm' | null>(null);
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    services.account?.meta().then(setMeta);
  }, [linked, status?.lastSyncAt]);

  if (!services.account) {
    return (
      <main class="screen no-nav">
        <TopBar title="Sinkronisasi" backTo="settings" />
        <p class="muted">Server sinkronisasi belum dikonfigurasi untuk aplikasi ini.</p>
      </main>
    );
  }
  const account = services.account;

  const afterLink = async () => {
    await services.refreshSync();
    await services.syncNow();
    setMode(null);
    setPw('');
    toast('Sinkronisasi aktif.');
  };

  const submit = async (e: Event) => {
    e.preventDefault();
    setErr('');
    try {
      if (mode === 'register') {
        const res = await busy('Membuat akun…', () => account.register(email, pw));
        if (res === 'confirm-email') return setMode('confirm');
        await afterLink();
      } else {
        await busy('Masuk…', () => account.signInAndLink(email, pw));
        await afterLink();
      }
    } catch (e) {
      setErr(errorMessage(e));
    }
  };

  if (!linked) {
    return (
      <main class="screen no-nav stack-lg">
        <TopBar title="Sinkronisasi" backTo="settings" />
        {mode === null && (
          <>
            <div class="card tinted stack">
              <p class="bold">Simpan jurnal di cloud, tetap privat</p>
              <p class="small muted">
                Jurnal dikunci di HP ini lalu dikirim sebagai data acak. Server hanya bisa melihat email, jumlah & ukuran data, dan waktu sinkron, tidak pernah isi jurnal. Gunakan password yang sama dengan password jurnalmu.
              </p>
            </div>
            <button class="btn block" onClick={() => setMode('register')}>
              Buat akun sinkronisasi
            </button>
            <button class="btn block secondary" onClick={() => setMode('signin')}>
              Saya sudah punya akun
            </button>
          </>
        )}
        {mode === 'confirm' && (
          <div class="stack">
            <div class="card stack">
              <p class="bold">📬 Cek emailmu</p>
              <p class="small muted">Kami mengirim tautan konfirmasi ke {email}. Klik tautannya, lalu kembali ke sini dan ketuk tombol di bawah.</p>
            </div>
            <PasswordInput value={pw} onInput={setPw} placeholder="Password jurnal" />
            {err && <p class="error-text">{err}</p>}
            <button
              class="btn block"
              onClick={async () => {
                setErr('');
                try {
                  await busy('Masuk…', () => account.signInAndLink(email, pw));
                  await afterLink();
                } catch (e) {
                  setErr(errorMessage(e));
                }
              }}
            >
              Saya sudah konfirmasi
            </button>
          </div>
        )}
        {(mode === 'register' || mode === 'signin') && (
          <form class="stack" onSubmit={submit}>
            <label class="field">
              <span>Email</span>
              <input class="input" type="email" autoComplete="email" value={email} onInput={(e) => setEmail(e.currentTarget.value)} />
            </label>
            <label class="field">
              <span>{mode === 'register' ? 'Password jurnalmu saat ini' : 'Password akun'}</span>
              <PasswordInput value={pw} onInput={setPw} />
            </label>
            {mode === 'signin' && (
              <p class="tiny faint">Kalau akun ini sudah punya jurnal dari perangkat lain, jurnal di HP ini akan digabungkan ke sana dan password akun menjadi password jurnalmu.</p>
            )}
            {err && <p class="error-text">{err}</p>}
            <button class="btn block" type="submit" disabled={!email || !pw}>
              {mode === 'register' ? 'Buat akun' : 'Masuk & hubungkan'}
            </button>
            <button class="btn block ghost" type="button" onClick={() => setMode(null)}>
              Batal
            </button>
          </form>
        )}
      </main>
    );
  }

  return (
    <main class="screen no-nav stack-lg">
      <TopBar title="Sinkronisasi" backTo="settings" />
      <div class="card stack">
        <div class="row">
          <span class={`sync-dot ${status?.state}`} />
          <b class="grow">{syncLabel(status?.state, status?.lastSyncAt ?? meta?.lastSyncAt ?? null)}</b>
        </div>
        <p class="small muted">Akun: {meta?.email}</p>
        {status?.message && <p class="error-text">{status.message}</p>}
        {!!status?.conflicts && (
          <p class="small muted">
            {status.conflicts} jurnal diedit di dua perangkat sekaligus. Kedua versi disimpan; cari yang berjudul “(salinan dari perangkat ini)”.
          </p>
        )}
        <button class="btn block secondary" onClick={() => services.syncNow()} disabled={status?.state === 'syncing'}>
          <Icon name="refresh" size={18} /> Sinkronkan sekarang
        </button>
      </div>
      {status?.state === 'needs-login' && (
        <form
          class="card stack"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await busy('Masuk…', () => account.signInAndLink(meta!.email, pw));
              await afterLink();
            } catch (e) {
              setErr(errorMessage(e));
            }
          }}
        >
          <p class="bold">Masuk lagi</p>
          <PasswordInput value={pw} onInput={setPw} />
          {err && <p class="error-text">{err}</p>}
          <button class="btn block" type="submit" disabled={!pw}>
            Masuk
          </button>
        </form>
      )}
      <div class="list">
        <Item
          icon="logout"
          label="Putuskan perangkat ini"
          hint="Jurnal tetap ada di HP ini dan di server"
          onClick={async () => {
            if (!(await confirmDialog({ title: 'Putuskan sinkronisasi?', body: 'HP ini berhenti sinkron. Jurnal yang sudah ada tetap tersimpan di sini dan di server.', ok: 'Putuskan' }))) return;
            await account.unlink();
            await services.refreshSync();
          }}
        />
        <Item
          icon="trash"
          danger
          label="Hapus akun & data di server"
          hint="Jurnal di HP ini tidak ikut terhapus"
          onClick={async () => {
            if (
              !(await confirmDialog({
                title: 'Hapus akun sinkronisasi?',
                body: 'Semua data terenkripsi di server dan akunmu dihapus permanen. Perangkat lain tidak akan bisa sinkron lagi. Jurnal di HP ini tetap ada.',
                ok: 'Hapus akun',
                danger: true
              }))
            )
              return;
            try {
              await busy('Menghapus akun…', () => account.deleteAccount());
              await services.refreshSync();
              toast('Akun dan data server sudah dihapus.');
            } catch (e) {
              toast(errorMessage(e), 'error');
            }
          }}
        />
      </div>
    </main>
  );
}

// ------------------------------------------------------------------ backup

export function BackupSettings() {
  const vault = useVault();
  const [importing, setImporting] = useState(false);
  const stamp = () => new Date().toISOString().slice(0, 10);

  return (
    <main class="screen no-nav stack-lg">
      <TopBar title="Backup & ekspor" backTo="settings" />
      <section class="stack">
        <div class="list">
          <Item
            icon="download"
            label="Unduh backup terenkripsi"
            hint="File .inkly, hanya bisa dibuka dengan password atau 24 kata"
            onClick={async () => {
              const json = await busy('Menyiapkan backup…', () => vault.exportBackup());
              downloadText(`inkly-backup-${stamp()}.inkly`, json);
            }}
          />
          <Item icon="upload" label="Pulihkan / gabungkan backup" hint="Jurnal yang lebih baru tetap dipertahankan" onClick={() => setImporting(true)} />
        </div>
        <p class="tiny faint">Backup berisi jurnal & foto yang tersimpan di HP ini. Foto dari perangkat lain yang belum pernah dibuka di sini tidak ikut.</p>
      </section>
      <section class="stack">
        <h2 class="section-title">Ekspor tanpa enkripsi</h2>
        <div class="list">
          <Item
            icon="file"
            label="Ekspor sebagai teks (Markdown)"
            hint="Bisa dibaca siapa saja yang memegang filenya"
            onClick={async () => {
              const ok = await confirmDialog({
                title: 'Ekspor tanpa enkripsi?',
                body: 'File ini berisi seluruh isi jurnalmu dalam bentuk teks biasa. Siapa pun yang memegang file ini bisa membacanya.',
                ok: 'Saya mengerti, ekspor'
              });
              if (ok) downloadText(`inkly-jurnal-${stamp()}.md`, vault.exportMarkdown(), 'text/markdown');
            }}
          />
        </div>
      </section>
      <section class="stack">
        <h2 class="section-title">Zona berbahaya</h2>
        <div class="list">
          <Item
            icon="trash"
            danger
            label="Hapus semua data di HP ini"
            hint="Server & perangkat lain tidak terpengaruh"
            onClick={async () => {
              const ok = await confirmDialog({
                title: 'Hapus semua data di HP ini?',
                body: 'Semua jurnal, foto, dan kunci di perangkat ini dihapus. Tanpa sinkronisasi atau file backup, jurnal tidak bisa dikembalikan.',
                ok: 'Hapus semuanya',
                danger: true
              });
              if (!ok) return;
              if (services.account) await services.account.unlink().catch(() => {});
              await vault.destroyLocal();
              location.hash = '';
              location.reload();
            }}
          />
        </div>
      </section>
      {importing && <ImportSheet onClose={() => setImporting(false)} />}
    </main>
  );
}

function ImportSheet({ onClose }: { onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [secret, setSecret] = useState('');
  const [err, setErr] = useState('');
  const submit = async (e: Event) => {
    e.preventDefault();
    if (!file) return;
    setErr('');
    try {
      const n = await busy('Memulihkan…', async () => services.vault.importBackup(await file.text(), secret));
      toast(`${n} jurnal dipulihkan.`);
      onClose();
    } catch (e) {
      setErr(errorMessage(e));
    }
  };
  return (
    <Sheet onClose={onClose}>
      <form class="stack" onSubmit={submit}>
        <h2>Pulihkan backup</h2>
        <label class="btn block secondary">
          <Icon name="file" size={18} /> {file ? file.name : 'Pilih file .inkly'}
          <input type="file" accept=".inkly,application/json" class="sr-only" onChange={(e) => setFile(e.currentTarget.files?.[0] ?? null)} />
        </label>
        <textarea class="textarea" rows={3} placeholder="Password atau 24 kata dari backup tersebut" value={secret} autoCapitalize="off" spellcheck={false} onInput={(e) => setSecret(e.currentTarget.value)} />
        {err && <p class="error-text">{err}</p>}
        <button class="btn block" type="submit" disabled={!file || !secret}>
          Pulihkan
        </button>
      </form>
    </Sheet>
  );
}

// ------------------------------------------------------------------ reminder

function icsFor(time: string): string {
  const [hh, mm] = time.split(':');
  const start = new Date();
  start.setDate(start.getDate() + (new Date().getHours() * 60 + new Date().getMinutes() >= Number(hh) * 60 + Number(mm) ? 1 : 0));
  const ymd = `${start.getFullYear()}${String(start.getMonth() + 1).padStart(2, '0')}${String(start.getDate()).padStart(2, '0')}`;
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const appUrl = location.href.split('#')[0];
  // Floating local time (no Z) so the reminder follows the phone's time zone.
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Inkly//Pengingat//ID',
    'BEGIN:VEVENT',
    `UID:inkly-reminder-${stamp}@inkly`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${ymd}T${hh}${mm}00`,
    'DURATION:PT10M',
    'RRULE:FREQ=DAILY',
    'SUMMARY:Waktunya menulis jurnal ✍️',
    `DESCRIPTION:Buka Inkly: ${appUrl}`,
    `URL:${appUrl}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Waktunya menulis jurnal',
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    ''
  ].join('\r\n');
}

export function ReminderSettings() {
  const vault = useVault();
  const [time, setTime] = useState(vault.settings.reminderTime);
  return (
    <main class="screen no-nav stack-lg">
      <TopBar title="Pengingat menulis" backTo="settings" />
      <p class="muted">
        Pengingat dipasang lewat aplikasi kalender di HP-mu, jadi tetap muncul walau Inkly tertutup, dan tidak butuh server. Isi pengingatnya umum saja, tidak memuat isi jurnal.
      </p>
      <label class="field">
        <span>Jam pengingat</span>
        <input
          class="input"
          type="time"
          value={time}
          onInput={(e) => setTime(e.currentTarget.value)}
          onChange={(e) => vault.saveSettings({ reminderTime: e.currentTarget.value })}
        />
      </label>
      <button
        class="btn block"
        onClick={() => {
          void vault.saveSettings({ reminderTime: time });
          downloadText('inkly-pengingat.ics', icsFor(time), 'text/calendar');
          toast('Buka file yang diunduh untuk menambahkannya ke kalender.');
        }}
      >
        <Icon name="bell" size={18} /> Tambahkan ke kalender HP
      </button>
      <p class="tiny faint">Di beranda, Inkly juga mengingatkan kalau kamu belum menulis hari ini.</p>
    </main>
  );
}

// ------------------------------------------------------------------ privacy explainer

export function Privacy() {
  const rows: [string, string][] = [
    ['Judul, isi, mood, tag, tanggal jurnal', 'Tidak bisa dilihat'],
    ['Foto & hiasan scrapbook', 'Tidak bisa dilihat'],
    ['Nama panggilan & pengaturan', 'Tidak bisa dilihat'],
    ['Password & 24 kata recovery key', 'Tidak pernah dikirim'],
    ['Email akun sinkronisasi', 'Terlihat (untuk login)'],
    ['Jumlah & perkiraan ukuran data', 'Terlihat'],
    ['Waktu kamu sinkron', 'Terlihat']
  ];
  return (
    <main class="screen no-nav stack-lg">
      <TopBar title="Privasi" backTo="settings" />
      <div class="stack">
        <h2 class="serif" style={{ fontSize: '24px' }}>
          Apa yang bisa dilihat developer?
        </h2>
        <p class="muted">
          Semua isi jurnal dikunci (dienkripsi) di HP-mu dengan kunci yang hanya terbuka oleh password atau 24 kata recovery key-mu. Server hanya menerima data acak. Developer bisa melihat servernya, tapi tidak punya kuncinya.
        </p>
      </div>
      <div class="list">
        {rows.map(([k, v]) => (
          <div class="list-item" key={k}>
            <span class="label">{k}</span>
            <span class="small bold" style={{ color: v.startsWith('Terlihat') ? 'var(--warn)' : 'var(--good)', textAlign: 'right' }}>
              {v}
            </span>
          </div>
        ))}
      </div>
      <div class="card stack">
        <p class="bold">Hal yang perlu kamu tahu</p>
        <ul class="small muted" style={{ margin: 0, paddingLeft: '18px', display: 'grid', gap: '6px' }}>
          <li>Kalau password <b>dan</b> recovery key hilang, jurnal tidak bisa dibuka oleh siapa pun, termasuk developer.</li>
          <li>Password yang lemah bisa ditebak oleh orang yang mencuri data server. Gunakan kalimat panjang yang unik.</li>
          <li>Inkly adalah aplikasi web: keamanannya bergantung pada kode yang kamu muat. Kode Inkly bisa diperiksa di repositori GitHub-nya.</li>
          <li>Orang yang memegang HP-mu dalam keadaan jurnal terbuka bisa membacanya. Aktifkan kunci otomatis.</li>
        </ul>
      </div>
    </main>
  );
}
