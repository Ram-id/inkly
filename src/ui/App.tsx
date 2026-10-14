import { useEffect, useState } from 'preact/hooks';
import { go, useRoute } from './router';
import { services, useVault } from './services';
import { BottomNav } from './components/common';
import { FeedbackHost } from './components/feedback';
import { Onboarding } from './screens/Onboarding';
import { Unlock } from './screens/Unlock';
import { Home } from './screens/Home';
import { Editor, TemplateSheet } from './screens/Editor';
import { EntryView } from './screens/EntryView';
import { Scrapbook } from './screens/Scrapbook';
import { Bottle } from './screens/Bottle';
import { Calendar } from './screens/Calendar';
import { Stats } from './screens/Stats';
import { BackupSettings, Privacy, ReminderSettings, SecuritySettings, Settings, SyncSettings } from './screens/Settings';

function useTheme(theme: 'system' | 'light' | 'dark') {
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
    const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg || '#FAF7F2');
  }, [theme]);
}

/**
 * Locks the journal (wiping keys from memory) when the app is left in the background or
 * untouched for the chosen time. Also blurs the screen while hidden so the app switcher
 * preview does not show an open entry.
 */
function useAutoLock() {
  const vault = services.vault;
  useEffect(() => {
    let hiddenAt = 0;
    let last = Date.now();
    const limit = () => vault.prefs.autoLockMinutes * 60_000;
    const touch = () => (last = Date.now());
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
        document.body.classList.add('privacy-blur');
        if (vault.prefs.autoLockMinutes === 0) {
          // give the editor's own "save on hide" a moment to run first
          setTimeout(() => document.visibilityState === 'hidden' && vault.unlocked && vault.lock(), 400);
        }
      } else {
        document.body.classList.remove('privacy-blur');
        if (vault.unlocked && hiddenAt && Date.now() - hiddenAt >= limit()) vault.lock();
        touch();
      }
    };
    const tick = setInterval(() => {
      if (vault.unlocked && document.visibilityState === 'visible' && Date.now() - last > Math.max(limit(), 5 * 60_000)) vault.lock();
    }, 15_000);
    const evs = ['pointerdown', 'keydown', 'scroll'] as const;
    evs.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(tick);
      evs.forEach((e) => window.removeEventListener(e, touch));
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);
}

/** Sync when coming back online, when the app returns to the foreground, and every few minutes. */
function useBackgroundSync() {
  useEffect(() => {
    const run = () => document.visibilityState === 'visible' && void services.syncNow();
    window.addEventListener('online', run);
    document.addEventListener('visibilitychange', run);
    const t = setInterval(run, 5 * 60_000);
    return () => {
      window.removeEventListener('online', run);
      document.removeEventListener('visibilitychange', run);
      clearInterval(t);
    };
  }, []);
}

export function App() {
  const vault = useVault();
  // Stay in onboarding until it finishes: the vault exists (and is unlocked) as soon as the
  // password is set, but the recovery words still have to be shown and confirmed.
  const [onboarding, setOnboarding] = useState(() => !vault.exists);
  useTheme(vault.prefs.theme);
  useAutoLock();
  useBackgroundSync();

  let body;
  if (onboarding || !vault.exists) body = <Onboarding onDone={() => setOnboarding(false)} />;
  else if (!vault.unlocked) body = <Unlock />;
  else body = <Main />;

  return (
    <>
      {body}
      <FeedbackHost />
    </>
  );
}

function Main() {
  const { path, query } = useRoute();
  const [compose, setCompose] = useState(false);
  const [section, id] = path;

  let screen;
  let nav = false;
  switch (section) {
    case undefined:
    case '':
      screen = <Home />;
      nav = true;
      break;
    case 'calendar':
      screen = <Calendar />;
      nav = true;
      break;
    case 'stats':
      screen = <Stats />;
      nav = true;
      break;
    case 'settings':
      if (id === 'security') screen = <SecuritySettings />;
      else if (id === 'sync') screen = <SyncSettings />;
      else if (id === 'backup') screen = <BackupSettings />;
      else if (id === 'reminder') screen = <ReminderSettings />;
      else {
        screen = <Settings />;
        nav = true;
      }
      break;
    case 'privacy':
      screen = <Privacy />;
      break;
    case 'new':
      screen = <Editor key={`new-${query.toString()}`} query={query} />;
      break;
    case 'edit':
      screen = <Editor key={`edit-${id}`} id={id} query={query} />;
      break;
    case 'entry':
      screen = <EntryView id={id} />;
      break;
    case 'bottle':
      screen = <Bottle />;
      break;
    case 'scrap':
      screen = <Scrapbook key={id} id={id} />;
      break;
    default:
      screen = <Home />;
      nav = true;
  }

  return (
    <>
      {screen}
      {nav && <BottomNav current={section === 'settings' ? 'settings' : section ?? ''} onCompose={() => setCompose(true)} />}
      {compose && (
        <TemplateSheet
          onClose={() => setCompose(false)}
          onBottle={() => {
            setCompose(false);
            go('bottle');
          }}
          onPick={(t) => {
            setCompose(false);
            go(t.id === 'bebas' ? 'new' : `new?template=${t.id}`);
          }}
        />
      )}
    </>
  );
}
