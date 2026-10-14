import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';

/** Global toast / busy overlay / confirm dialog, callable from anywhere. */

interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'error';
}
interface ConfirmReq {
  title: string;
  body?: string;
  ok: string;
  danger?: boolean;
  resolve: (v: boolean) => void;
}

let toasts: Toast[] = [];
let busyLabel: string | null = null;
let confirmReq: ConfirmReq | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());
let nextId = 1;

export function toast(text: string, kind: Toast['kind'] = 'info'): void {
  const t = { id: nextId++, text, kind };
  toasts = [...toasts, t];
  notify();
  setTimeout(() => {
    toasts = toasts.filter((x) => x !== t);
    notify();
  }, kind === 'error' ? 5000 : 2600);
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export async function busy<T>(label: string, fn: () => Promise<T>): Promise<T> {
  busyLabel = label;
  notify();
  // Let the overlay paint before heavy work (Argon2 blocks the thread for a moment).
  await new Promise((r) => setTimeout(r, 30));
  try {
    return await fn();
  } finally {
    busyLabel = null;
    notify();
  }
}

export function confirmDialog(opts: Omit<ConfirmReq, 'resolve'>): Promise<boolean> {
  return new Promise((resolve) => {
    confirmReq = { ...opts, resolve };
    notify();
  });
}

function useFeedback() {
  const [, set] = useState(0);
  useEffect(() => {
    const fn = () => set((n) => n + 1);
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);
}

export function FeedbackHost() {
  useFeedback();
  const close = (v: boolean) => {
    confirmReq?.resolve(v);
    confirmReq = null;
    notify();
  };
  return (
    <>
      <div class="toast-host" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} class={`toast ${t.kind === 'error' ? 'error' : ''}`}>
            {t.text}
          </div>
        ))}
      </div>
      {busyLabel !== null && (
        <div class="busy-overlay" aria-busy="true">
          <div class="stack center" style={{ alignItems: 'center' }}>
            <div class="spinner" />
            <p class="muted small">{busyLabel}</p>
          </div>
        </div>
      )}
      {confirmReq && (
        <Sheet onClose={() => close(false)}>
          <div class="stack">
            <h2>{confirmReq.title}</h2>
            {confirmReq.body && <p class="muted pre">{confirmReq.body}</p>}
            <button class={`btn block ${confirmReq.danger ? 'danger' : ''}`} onClick={() => close(true)}>
              {confirmReq.ok}
            </button>
            <button class="btn block secondary" onClick={() => close(false)}>
              Batal
            </button>
          </div>
        </Sheet>
      )}
    </>
  );
}

export function Sheet({ children, onClose }: { children: ComponentChildren; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div class="backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="sheet" role="dialog" aria-modal="true">
        <div class="sheet-handle" />
        {children}
      </div>
    </div>
  );
}
