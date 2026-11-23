// Copies the OCR engine and language data from node_modules into public/ocr/,
// so the app serves them itself (offline, no CDN). Runs before dev and build.
import { copyFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const nm = join(root, 'node_modules');
const out = join(root, 'public', 'ocr');
mkdirSync(out, { recursive: true });

const files = [
  // Worker script
  ['tesseract.js/dist/worker.min.js', 'worker.min.js'],
  // LSTM-only engine: SIMD build (all current iPhones) + plain fallback
  ['tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js'],
  ['tesseract.js-core/tesseract-core-lstm.wasm.js', 'tesseract-core-lstm.wasm.js'],
  // Compact LSTM language models (best_int)
  ['@tesseract.js-data/lav/4.0.0_best_int/lav.traineddata.gz', 'lav.traineddata.gz'],
  ['@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz', 'eng.traineddata.gz'],
];

for (const [from, to] of files) {
  const src = join(nm, from);
  const dst = join(out, to);
  if (!existsSync(src)) throw new Error(`Missing ${from} — run npm install`);
  if (!existsSync(dst) || statSync(dst).size !== statSync(src).size) copyFileSync(src, dst);
}
console.log(`OCR files ready in public/ocr (${files.length})`);
