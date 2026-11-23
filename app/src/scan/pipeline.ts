import { simd } from 'wasm-feature-detect';
import zxingWasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';
import type { Holder, HolderId } from '../db/types';
import { configureZXing, findCode, readCode, type FoundCode } from './barcode';
import { findCardNumber, findEndDate, findHolder, guessCompany, type Guess, type OcrLine } from './guess';
import { recognizeLines, type OcrPaths } from './ocr';
import { KNOWN_STORES, STORE_ALIASES } from './stores';
import { codeCropQuad, fullQuad, quadSize, warpQuad, type Pixels, type Quad } from './warp';

/**
 * Photo → suggestions for Pārbaude, all on the phone (SPEC 6.5 Apstrāde):
 * decode & shrink the photo, find the code (zxing), crop around it, read the text
 * (tesseract) and guess company, end date and holder.
 */

const WORKING_SIZE = 1600; // long side of the stored photo (SPEC 3)
const JPEG_QUALITY = 0.85;

const abs = (path: string) => new URL(path, document.baseURI).href;

let zxingReady = false;
function ensureZXing() {
  if (zxingReady) return;
  configureZXing({
    locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? abs(zxingWasmUrl) : prefix + path),
  });
  zxingReady = true;
}

let ocrPaths: Promise<OcrPaths> | undefined;
const getOcrPaths = () =>
  (ocrPaths ??= simd().then((hasSimd) => ({
    workerPath: abs('ocr/worker.min.js'),
    corePath: abs(hasSimd ? 'ocr/tesseract-core-simd-lstm.wasm.js' : 'ocr/tesseract-core-lstm.wasm.js'),
    langPath: abs('ocr'),
  })));

/* ---------- Image helpers ---------- */

export async function decodeImage(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(blob, { imageOrientation: 'from-image' });
  } catch {
    // Fallback for formats createImageBitmap can't read in this browser.
    const url = URL.createObjectURL(blob);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

const sizeOf = (img: ImageBitmap | HTMLImageElement) =>
  'naturalWidth' in img ? { w: img.naturalWidth, h: img.naturalHeight } : { w: img.width, h: img.height };

/** Draws the image so its long side is at most `maxSide` (never enlarged). */
export function drawScaled(img: CanvasImageSource & (ImageBitmap | HTMLImageElement), maxSide: number): HTMLCanvasElement {
  const { w, h } = sizeOf(img);
  const k = Math.min(1, maxSide / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * k));
  canvas.height = Math.max(1, Math.round(h * k));
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export const pixelsOf = (canvas: HTMLCanvasElement): ImageData =>
  canvas.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, canvas.width, canvas.height);

export function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', JPEG_QUALITY),
  );
}

function pixelsToCanvas(p: Pixels): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = p.width;
  canvas.height = p.height;
  canvas.getContext('2d')!.putImageData(new ImageData(p.data as Uint8ClampedArray<ArrayBuffer>, p.width, p.height), 0, 0);
  return canvas;
}

/** Straightened crop of the photo inside `quad`, as JPEG — plus its pixels (for re-scanning). */
export async function cropToJpeg(photo: Blob, quad: Quad): Promise<{ blob: Blob; pixels: Pixels }> {
  const img = await decodeImage(photo);
  const canvas = drawScaled(img, WORKING_SIZE);
  if ('close' in img) img.close();
  const { width, height } = quadSize(quad, 1400);
  const pixels = warpQuad(pixelsOf(canvas), quad, width, height);
  return { blob: await canvasToJpeg(pixelsToCanvas(pixels)), pixels };
}

/** The photo turned 90° clockwise. */
export async function rotatePhoto(photo: Blob): Promise<Blob> {
  const img = await decodeImage(photo);
  const { w, h } = sizeOf(img);
  const canvas = document.createElement('canvas');
  canvas.width = h;
  canvas.height = w;
  const ctx = canvas.getContext('2d')!;
  ctx.translate(h, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(img, 0, 0);
  if ('close' in img) img.close();
  return canvasToJpeg(canvas);
}

/** Looks for a code inside an already cropped image (after the user re-crops). */
export async function readCodeIn(pixels: Pixels): Promise<FoundCode | null> {
  ensureZXing();
  try {
    return await readCode(pixels);
  } catch {
    return null;
  }
}

/* ---------- The scan ---------- */

export type StepId = 'code' | 'text' | 'date' | 'holder';
export type StepState = 'waiting' | 'running' | 'done' | 'failed';

export interface ScanResult {
  photoOriginal: Blob;
  photoCropped: Blob;
  /** Size of photoOriginal in pixels; quads are in these coordinates. */
  size: { width: number; height: number };
  cropQuad: Quad;
  /** Crop suggested by the scan (for "Atiestatīt" in the crop editor). */
  autoQuad: Quad;
  code: FoundCode | null;
  /** Number read from the text when no code was found (always flagged). */
  numberFromText: Guess<string> | null;
  company: Guess<string> | null;
  endDate: Guess<string> | null;
  holder: Guess<HolderId> | null;
}

export interface ScanContext {
  /** Companies of cards already in the app — recognised like known stores. */
  companies: readonly string[];
  holders: readonly Holder[];
}

export async function scanPhoto(
  file: Blob,
  ctx: ScanContext,
  onStep: (step: StepId, state: StepState, detail?: string) => void,
): Promise<ScanResult> {
  ensureZXing();
  const img = await decodeImage(file);
  try {
    const base = drawScaled(img, WORKING_SIZE);
    const size = { width: base.width, height: base.height };
    const photoOriginal = await canvasToJpeg(base);
    const basePixels = pixelsOf(base);

    // 1. Code
    onStep('code', 'running');
    let code: FoundCode | null = null;
    try {
      code = await findCode((side) => Promise.resolve(side === WORKING_SIZE ? basePixels : pixelsOf(drawScaled(img, side))), base.width);
    } catch {
      code = null;
    }
    onStep('code', code ? 'done' : 'failed', code?.twoD ? 'qr' : undefined);

    const autoQuad = code ? codeCropQuad(code.quad, size.width, size.height, code.twoD) : fullQuad(size.width, size.height);
    const photoCropped = code
      ? await canvasToJpeg(pixelsToCanvas(warpQuad(basePixels, autoQuad, quadSize(autoQuad, 1400).width, quadSize(autoQuad, 1400).height)))
      : photoOriginal;

    // 2. Text (if OCR fails, e.g. files missing, the user simply fills the fields in)
    onStep('text', 'running');
    let lines: OcrLine[] = [];
    const known = [...new Set([...ctx.companies, ...KNOWN_STORES])];
    try {
      // Stop early: store and holder both found → done; store found → one more pass
      // (holder text and dates often show up there); otherwise all passes.
      const enough = (l: OcrLine[], done: number) =>
        !!guessCompany(l, known, STORE_ALIASES)?.confident && (!!findHolder(l, ctx.holders) || done >= 2);
      lines = await recognizeLines(await getOcrPaths(), base, undefined, enough);
      onStep('text', 'done');
    } catch {
      onStep('text', 'failed');
    }

    onStep('date', 'running');
    const endDate = findEndDate(lines);
    onStep('date', 'done');

    onStep('holder', 'running');
    const holder = findHolder(lines, ctx.holders);
    onStep('holder', 'done');

    return {
      photoOriginal,
      photoCropped,
      size,
      cropQuad: autoQuad,
      autoQuad,
      code,
      numberFromText: code ? null : findCardNumber(lines),
      company: guessCompany(lines, known, STORE_ALIASES),
      endDate,
      holder,
    };
  } finally {
    if ('close' in img) img.close();
  }
}

/** Start loading the OCR engine early (when the add sheet opens). */
export function warmUpOcr(): void {
  void getOcrPaths().then((paths) => import('./ocr').then((m) => m.startOcr(paths)).catch(() => {}));
}
