import { createWorker, OEM, PSM, type Worker } from 'tesseract.js';
import type { OcrLine } from './guess';

/**
 * On-device text recognition (tesseract.js, Latvian + English).
 * All engine and language files come from the app itself (public/ocr), never a CDN.
 */

export interface OcrPaths {
  workerPath?: string;
  corePath?: string;
  langPath: string;
}

export type OcrInput = HTMLCanvasElement | Blob | string | Uint8Array;

let workerPromise: Promise<Worker> | undefined;

export function startOcr(paths: OcrPaths): Promise<Worker> {
  return (workerPromise ??= (async () => {
    const worker = await createWorker(['lav', 'eng'], OEM.LSTM_ONLY, {
      ...paths,
      workerBlobURL: false, // load the worker file directly so the service worker serves it offline
      cacheMethod: 'none', // the service worker already caches the language files
      gzip: true,
    });
    // Cards have scattered text, not paragraphs.
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
    return worker;
  })().catch((e) => {
    workerPromise = undefined;
    throw e;
  }));
}

/**
 * Tesseract binarisation methods, tried in turn (results merged):
 * 0 = global Otsu (best for clean, evenly lit cards), 1 = adaptive Otsu (cards on a
 * table, shadows, coloured text), 2 = Sauvola (light text on dark backgrounds).
 */
export const DEFAULT_PASSES: readonly string[] = ['0', '1', '2'];

/**
 * Reads the text, one pass per method, merging the lines. `enough(lines)` is checked
 * after each pass, so easy cards stop after the first pass and only hard ones pay
 * for all three.
 */
export async function recognizeLines(
  paths: OcrPaths,
  image: OcrInput,
  passes: readonly string[] = DEFAULT_PASSES,
  enough: (lines: OcrLine[], passesDone: number) => boolean = () => false,
): Promise<OcrLine[]> {
  const worker = await startOcr(paths);
  const byText = new Map<string, OcrLine>();
  for (const [i, method] of passes.entries()) {
    await worker.setParameters({ thresholding_method: method } as Record<string, string>);
    const { data } = await worker.recognize(image, {}, { blocks: true, text: false });
    for (const block of data.blocks ?? [])
      for (const para of block.paragraphs)
        for (const line of para.lines) {
          const text = line.text.trim();
          if (!text) continue;
          const found: OcrLine = { text, confidence: line.confidence, height: line.bbox.y1 - line.bbox.y0 };
          const key = text.toLowerCase().replace(/\s+/g, ' ');
          const prev = byText.get(key);
          if (!prev || prev.confidence < found.confidence) byText.set(key, found);
        }
    if (enough([...byText.values()], i + 1)) break;
  }
  return [...byText.values()];
}

export async function stopOcr(): Promise<void> {
  const w = await workerPromise?.catch(() => undefined);
  workerPromise = undefined;
  await w?.terminate();
}
