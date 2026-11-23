/**
 * Local-only check of the scanner against real card photos in ../paraugi (git-ignored).
 * Skipped unless SCAN_PHOTOS=1:   SCAN_PHOTOS=1 npx vitest run src/scan/real-photos
 * Prints results (or writes them to $SCAN_OUT, e.g. a scratch file); nothing is uploaded.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, it } from 'vitest';

const PHOTOS = resolve(__dirname, '../../../paraugi');
const OCR_DIR = resolve(__dirname, '../../public/ocr');
const enabled = process.env.SCAN_PHOTOS === '1' && existsSync(PHOTOS);

describe.runIf(enabled)('real card photos', () => {
  it('scans every photo', { timeout: 600_000 }, async () => {
    const { default: sharp } = await import('sharp');
    const { configureZXing, findCode } = await import('./barcode');
    const { recognizeLines, stopOcr } = await import('./ocr');
    const { guessCompany, findEndDate, findHolder, findCardNumber } = await import('./guess');
    const { KNOWN_STORES, STORE_ALIASES } = await import('./stores');
    const { DEFAULT_HOLDERS } = await import('../db/repo');

    configureZXing({
      wasmBinary: readFileSync(resolve(__dirname, '../../node_modules/zxing-wasm/dist/reader/zxing_reader.wasm')).buffer,
    });

    const files = readdirSync(PHOTOS).filter((f) => /\.(jpe?g|png|heic)$/i.test(f)).sort();
    const rows: string[] = [];
    for (const file of files) {
      const t0 = Date.now();
      const source = readFileSync(join(PHOTOS, file));
      const load = async (side: number) => {
        const { data, info } = await sharp(source)
          .rotate()
          .resize(side, side, { fit: 'inside', withoutEnlargement: true })
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
        return { data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), width: info.width, height: info.height };
      };
      const base = await load(1600);
      const jpeg = await sharp(source).rotate().resize(1600, 1600, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();

      const code = await findCode(load, base.width);
      const t1 = Date.now();
      const passes = process.env.OCR_PASSES ? process.env.OCR_PASSES.split(',') : undefined;
      const enough = (l: Parameters<typeof guessCompany>[0], done: number) =>
        !!guessCompany(l, KNOWN_STORES, STORE_ALIASES)?.confident && (!!findHolder(l, DEFAULT_HOLDERS) || done >= 2);
      const lines = await recognizeLines({ langPath: OCR_DIR }, jpeg, passes, enough);
      const t2 = Date.now();

      const company = guessCompany(lines, KNOWN_STORES, STORE_ALIASES);
      const number = code ? null : findCardNumber(lines);
      const date = findEndDate(lines);
      const holder = findHolder(lines, DEFAULT_HOLDERS);
      const flag = (g: { confident: boolean } | null) => (g ? (g.confident ? '' : ' (?)') : '');
      rows.push(
        [
          file,
          `code: ${code ? `${code.format} ${code.value}` : number ? `from text ${number.value} (?)` : '—'}`,
          `company: ${company ? company.value + flag(company) : '—'}`,
          `date: ${date ? date.value + flag(date) : '—'}`,
          `holder: ${holder ? holder.value + flag(holder) : '—'}`,
          `${t1 - t0}ms + ocr ${t2 - t1}ms`,
        ].join(' | '),
      );
      if (process.env.SCAN_DEBUG) rows.push('   ocr: ' + lines.map((l) => `${l.text} [${Math.round(l.confidence)}/${l.height}]`).join(' ¦ '));
    }
    await stopOcr();
    if (process.env.SCAN_OUT) writeFileSync(process.env.SCAN_OUT, rows.join('\n') + '\n');
    else process.stdout.write('\n' + rows.join('\n') + '\n');
  });
});
