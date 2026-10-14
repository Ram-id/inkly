/**
 * Sync server settings, filled in at build time (see README → "Menyiapkan Supabase").
 * The anon key is public by design: it only identifies the project. Access to rows is
 * enforced by Row Level Security, and every row only ever contains ciphertext.
 */
export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY: string = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export const syncAvailable = (): boolean => !!SUPABASE_URL && !!SUPABASE_ANON_KEY;
