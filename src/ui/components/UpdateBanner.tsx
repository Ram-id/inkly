import { useState } from 'preact/hooks';
import { applyUpdate, useUpdateReady } from '../updates';

/** A small pill shown when a new version has been downloaded. Nothing changes until it is tapped. */
export function UpdateBanner() {
  const ready = useUpdateReady();
  const [busy, setBusy] = useState(false);
  if (!ready) return null;
  return (
    <div class="update-banner" role="status">
      <span>Ada versi baru ✨</span>
      <button
        class="btn small"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          // let the editor's autosave finish before the page reloads
          (document.activeElement as HTMLElement | null)?.blur();
          await new Promise((r) => setTimeout(r, 1200));
          await applyUpdate();
        }}
      >
        {busy ? 'Memperbarui…' : 'Perbarui'}
      </button>
    </div>
  );
}
