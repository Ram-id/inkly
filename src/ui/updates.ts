import { useEffect, useState } from 'preact/hooks';

/**
 * New app versions download in the background but are only switched on when the owner taps
 * "Perbarui" (or on the next fresh start), so an update never interrupts writing.
 */

let apply: ((reload?: boolean) => Promise<void>) | null = null;
let ready = false;
const listeners = new Set<() => void>();

export function setUpdater(fn: (reload?: boolean) => Promise<void>): void {
  apply = fn;
}

export function markUpdateReady(): void {
  ready = true;
  listeners.forEach((l) => l());
}

export async function applyUpdate(): Promise<void> {
  await apply?.(true);
}

export function useUpdateReady(): boolean {
  const [, set] = useState(0);
  useEffect(() => {
    const fn = () => set((n) => n + 1);
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);
  return ready;
}
