import { defineConfig } from '@vite-pwa/assets-generator/config';

// Generates the PNG icons from public/icon.svg:  npm run icons
// The icon is full-bleed dark, so no padding and a matching background.
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    transparent: { sizes: [64, 192, 512], favicons: [[48, 'favicon.ico']], padding: 0 },
    maskable: { sizes: [512], padding: 0, resizeOptions: { background: '#1F2328' } },
    apple: { sizes: [180], padding: 0, resizeOptions: { background: '#1F2328' } },
  },
  images: ['public/icon.svg'],
});
