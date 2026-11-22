# Klientu kartes — app

iPhone loyalty-card PWA. Spec: `../SPEC.md`. Deviations: `../DECISIONS.md`.

```bash
npm install
npm run dev       # http://localhost:5173 — dev mode seeds the 14 sample cards
npm test          # unit tests (dates, codes, styles, IndexedDB repository)
npm run build     # type-check + production build into dist/ (no sample data)
npm run preview   # serve dist/ at http://localhost:4173 with the service worker
npm run icons     # regenerate PNG icons from public/icon.svg
npm run deploy    # build and publish to GitHub Pages (commit first)
```

Live app: https://norentgenbeard.github.io/klientu-kartes/ (served from the `gh-pages` branch).

Reset the dev sample data: delete the `klientu-kartes` IndexedDB database in the browser's dev tools and reload.

## Structure

```
src/
  main.tsx            start-up: theme, persistent storage, dev seed, render
  App.tsx             milestone-1 shell (replaced by the designed Sākums in M2)
  pwa.ts              persistent storage, standalone detection
  components/         UpdateBanner (service worker update prompt)
  db/                 types, IndexedDB repository, sample data
  lib/                dates, codes (EAN checks), default card style, text helpers
  theme/              theme = token set → CSS variables (Default theme)
  i18n/lv.ts          all Latvian UI strings
  styles/base.css     base styles, typography, safe areas
```
