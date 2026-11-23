import { prepareZXingModule, readBarcodes, type ReaderOptions } from 'zxing-wasm/reader';
import type { CodeFormat } from '../db/types';
import type { Pixels, Quad } from './warp';

/** A barcode/QR code found in a photo. */
export interface FoundCode {
  value: string;
  format: CodeFormat;
  /** Corners in the photo: top-left, top-right, bottom-right, bottom-left. */
  quad: Quad;
  twoD: boolean;
}

/** zxing format name (e.g. "EAN-13", "EAN13", "QRCode") → our format. */
export function mapFormat(zxingFormat: string): CodeFormat {
  const f = zxingFormat.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (f.startsWith('code128')) return 'code128';
  if (f.startsWith('code39')) return 'code39';
  if (f === 'code93') return 'code93';
  if (f === 'codabar') return 'codabar';
  if (f === 'ean13') return 'ean13';
  if (f === 'ean8') return 'ean8';
  if (f === 'upca') return 'upca';
  if (f === 'upce') return 'upce';
  if (f.startsWith('itf')) return 'itf';
  if (f.includes('qrcode')) return 'qr';
  if (f === 'datamatrix') return 'datamatrix';
  if (f.includes('pdf417')) return 'pdf417';
  if (f.startsWith('aztec')) return 'aztec';
  return 'other';
}

let configured = false;

/**
 * Tell zxing where its .wasm file is. The app passes its own bundled URL so nothing is
 * downloaded from a CDN (offline). Must run before the first scan.
 */
export function configureZXing(overrides: Record<string, unknown>): void {
  prepareZXingModule({ overrides, fireImmediately: false });
  configured = true;
}

const OPTIONS: ReaderOptions = {
  tryHarder: true,
  tryRotate: true,
  tryInvert: true,
  tryDownscale: true,
  maxNumberOfSymbols: 4,
  formats: [
    'Code128',
    'Code39',
    'Code93',
    'Codabar',
    'EAN13',
    'EAN8',
    'UPCA',
    'UPCE',
    'ITF',
    'QRCode',
    'MicroQRCode',
    'DataMatrix',
    'PDF417',
    'Aztec',
  ],
};

const area = (q: Quad) =>
  Math.abs(
    q.reduce((s, p, i) => {
      const n = q[(i + 1) % 4];
      return s + p.x * n.y - n.x * p.y;
    }, 0) / 2,
  );

/** Finds the main code in the image (the biggest readable one), or null. */
export async function readCode(image: Pixels): Promise<FoundCode | null> {
  if (!configured) throw new Error('configureZXing() must be called first');
  const results = await readBarcodes(image as ImageData, OPTIONS);
  const found = results
    .filter((r) => r.isValid && r.text.trim())
    .map((r): FoundCode => {
      const p = r.position;
      const quad: Quad = [p.topLeft, p.topRight, p.bottomRight, p.bottomLeft].map((pt) => ({ x: pt.x, y: pt.y })) as Quad;
      const format = mapFormat(r.format);
      return { value: r.text.trim(), format, quad, twoD: ['qr', 'datamatrix', 'pdf417', 'aztec'].includes(format) };
    })
    .sort((a, b) => area(b.quad) - area(a.quad));
  return found[0] ?? null;
}

/**
 * Tries a few image sizes: the 1600-px working image first, then full resolution
 * (small barcodes on big photos), then smaller (large, blurry codes).
 * `load(maxSide)` returns the photo scaled to fit maxSide; the result's corners are
 * given in the coordinates of the `baseWidth`-wide working image.
 */
export async function findCode(
  load: (maxSide: number) => Promise<Pixels>,
  baseWidth: number,
  sizes: readonly number[] = [1600, 3000, 1000],
): Promise<FoundCode | null> {
  const tried = new Set<number>();
  for (const side of sizes) {
    const pixels = await load(side);
    if (tried.has(pixels.width)) continue; // photo smaller than this size: same pixels as before
    tried.add(pixels.width);
    const found = await readCode(pixels);
    if (found) {
      const k = baseWidth / pixels.width;
      return { ...found, quad: found.quad.map((p) => ({ x: p.x * k, y: p.y * k })) as Quad };
    }
  }
  return null;
}
