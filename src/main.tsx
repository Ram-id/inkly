import { render } from 'preact';
import { registerSW } from 'virtual:pwa-register';
import { Vault } from './storage/vault';
import { services } from './ui/services';
import { App } from './ui/App';
import { markUpdateReady, setUpdater } from './ui/updates';
import './ui/styles.css';

async function boot() {
  const root = document.getElementById('app')!;
  try {
    // Ask the browser not to evict the journal under storage pressure.
    void navigator.storage?.persist?.();
    const vault = await Vault.open();
    services.init(vault);
    // Dev-only handle for local testing; stripped from production builds.
    if (import.meta.env.DEV) (window as unknown as { __inkly: typeof services }).__inkly = services;
    render(<App />, root);
  } catch (e) {
    root.innerHTML = '';
    const p = document.createElement('p');
    p.style.cssText = 'padding:24px;font-family:system-ui';
    p.textContent = `Inkly tidak bisa dibuka di browser ini (${e instanceof Error ? e.message : e}). Pastikan tidak dalam mode penyamaran yang memblokir penyimpanan.`;
    root.appendChild(p);
  }
  if (import.meta.env.PROD) {
    const update = registerSW({
      immediate: true,
      onNeedRefresh: markUpdateReady,
      onRegisteredSW(_url, reg) {
        // look for a new version every hour while the app stays open
        if (reg) setInterval(() => void reg.update(), 60 * 60 * 1000);
      }
    });
    setUpdater(update);
  }
}

void boot();
