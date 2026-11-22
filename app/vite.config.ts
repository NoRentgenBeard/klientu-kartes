/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

// Relative base so the same build works at any URL path
// (e.g. GitHub Pages at /<repo>/ or a custom domain at /).
export default defineConfig({
  base: './',
  plugins: [
    preact(),
    VitePWA({
      registerType: 'prompt', // show "Pieejama jauna versija — Pārlādēt" instead of silent reload
      injectRegister: false, // registered from src/pwa.ts
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'icon.svg'],
      manifest: {
        id: './',
        name: 'Klientu kartes',
        short_name: 'Kartes',
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
        maximumFileSizeToCacheInBytes: 40 * 1024 * 1024,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
