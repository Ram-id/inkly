import { useEffect, useState } from 'preact/hooks';
import { Icon } from '../icons';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e as BeforeInstallPromptEvent;
  listeners.forEach((fn) => fn());
});

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const DISMISS_KEY = 'inkly-install-dismissed';

/** "Pasang di HP" helper: native prompt on Android/Chrome, instructions on iPhone. */
export function InstallCard({ always = false }: { always?: boolean }) {
  const [, force] = useState(0);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);

  if (isStandalone() || (!always && dismissed)) return null;
  if (!deferred && !isIos()) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* private mode */
    }
  };

  return (
    <div class="card row" style={{ gap: '12px', alignItems: 'flex-start' }}>
      <span class="icon-badge">
        <Icon name="phone" size={19} />
      </span>
      <div class="grow stack" style={{ gap: '6px' }}>
        <p class="bold">Pasang Inkly di layar utama</p>
        {deferred ? (
          <>
            <button
              class="btn small"
              style={{ alignSelf: 'flex-start' }}
              onClick={async () => {
                await deferred!.prompt();
                deferred = null;
                force((n) => n + 1);
              }}
            >
              Pasang sekarang
            </button>
          </>
        ) : (
          <p class="small muted">
            Di Safari, ketuk tombol <b>Bagikan</b> (kotak dengan panah ke atas), lalu pilih <b>Tambah ke Layar Utama</b>.
          </p>
        )}
      </div>
      {!always && (
        <button class="icon-btn" aria-label="Tutup" onClick={dismiss} style={{ marginTop: '-8px', marginRight: '-8px' }}>
          <Icon name="x" size={18} />
        </button>
      )}
    </div>
  );
}
