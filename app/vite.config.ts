/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json' with { type: 'json' };

// Two builds from the same code:
//   npm run build       → dist/        the real app (starts empty)
//   npm run build:demo  → dist/demo/   sample cards for testing on the iPhone (DECISIONS.md D8)
// Relative base so each works at any URL path (e.g. GitHub Pages at /<repo>/ and /<repo>/demo/).
export default defineConfig(({ mode }) => {
  const demo = mode === 'demo';
  return {
    base: './',
    // Iestatījumi → Versija: "0.5.0 (3c4b6fa)"; the commit comes from VITE_COMMIT (package.json scripts).
    define: { __APP_VERSION__: JSON.stringify(pkg.version) },
    build: demo ? { outDir: 'dist/demo', emptyOutDir: true } : undefined,
    plugins: [
      preact(),
      {
        // iOS names the Home Screen icon from this meta tag, not the manifest.
        name: 'demo-home-screen-title',
        transformIndexHtml: (html: string) =>
          demo
            ? html
                .replace('name="apple-mobile-web-app-title" content="Kartes"', 'name="apple-mobile-web-app-title" content="Kartes demo"')
                .replace('<title>Klientu kartes</title>', '<title>Klientu kartes (demo)</title>')
            : html,
      },
      VitePWA({
        registerType: 'prompt', // show "Pieejama jauna versija — Pārlādēt" instead of silent reload
        injectRegister: false, // registered from src/components/UpdateBanner.tsx
        includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'icon.svg'],
        manifest: {
          id: './',
          name: demo ? 'Klientu kartes (demo)' : 'Klientu kartes',
          short_name: demo ? 'Kartes demo' : 'Kartes',
          description: 'Lojalitātes un klientu kartes telefonā',
          lang: 'lv',
          start_url: './',
          scope: './',
          display: 'standalone',
          // No "orientation": Kasē has a landscape layout (SPEC 3).
          background_color: '#FFFFFF',
          theme_color: '#FFFFFF',
          icons: [
            { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          // Precache everything so the app works offline from the first install,
          // including the scanner/OCR engines added in milestone 4.
          globPatterns: ['**/*.{js,mjs,css,html,svg,png,ico,webmanifest,wasm,traineddata,gz,json}'],
          // The plain (non-SIMD) OCR engine is only for very old devices: served, not precached.
          globIgnores: ['demo/**', 'ocr/tesseract-core-lstm.wasm.js'],
          maximumFileSizeToCacheInBytes: 40 * 1024 * 1024,
          cleanupOutdatedCaches: true,
          // The real app's service worker must not answer for the demo pages.
          navigateFallbackDenylist: demo ? [] : [/\/demo\//],
          cacheId: demo ? 'klientu-kartes-demo' : 'klientu-kartes',
        },
      }),
    ],
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  };
});
