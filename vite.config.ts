/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Plugin } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json' with { type: 'json' };

/**
 * Content-Security-Policy for the production build: only this app's own code may run, and the
 * page may only talk to its own origin and the configured Supabase project. This is what keeps
 * a stray third-party script from ever seeing decrypted journals or keys.
 */
function csp(supabaseUrl: string): Plugin {
  const sb = supabaseUrl ? new URL(supabaseUrl) : null;
  const connect = ["'self'", sb ? `${sb.origin} wss://${sb.host}` : ''].filter(Boolean).join(' ');
  const policy = [
    "default-src 'self'",
    "script-src 'self' 'wasm-unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src ${connect}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'"
  ].join('; ');
  return {
    name: 'inkly-csp',
    apply: 'build',
    transformIndexHtml: (html) =>
      html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`)
  };
}

// Build output goes to docs/ because GitHub Pages serves this repo from main:/docs.
export default defineConfig(({ mode }) => ({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    csp(loadEnv(mode, process.cwd(), 'VITE_').VITE_SUPABASE_URL ?? ''),
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Inkly — Jurnal Pribadi',
        short_name: 'Inkly',
        description: 'Ruang kecil untuk menulis, menghias, dan mengenali perasaan setiap hari.',
        lang: 'id',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#FFF6F8',
        theme_color: '#FFF6F8',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,wasm}'],
        navigateFallback: 'index.html',
        // Never cache Supabase traffic: it is ciphertext anyway, but stale sync data is confusing.
        navigateFallbackDenylist: [/^\/rest\//, /^\/auth\//, /^\/storage\//]
      }
    })
  ],
  build: {
    outDir: 'docs',
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: false
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    setupFiles: ['test/setup.ts']
  }
}));
