import {
  azteccode,
  code128,
  code39,
  code93,
  datamatrix,
  drawingSVG,
  ean13,
  ean8,
  interleaved2of5,
  pdf417,
  qrcode,
  rationalizedCodabar,
  upca,
  upce,
} from 'bwip-js/generic';
import type { DrawingContext, RenderOptions } from 'bwip-js/generic';
import type { CodeFormat } from '../db/types';
import { CODE_FORMATS_2D } from '../db/types';

/**
 * Generates the crisp, scannable code from Card.codeValue (SPEC 7: always render from
 * the value, never the photo). Pure black on transparent; the white box is CSS.
 * Loaded lazily from Kasē, so the app starts without the encoder.
 */

type Encoder = (opts: RenderOptions, drawing: DrawingContext<string>) => string;

/** Our format → [bwip-js encoder, bwip-js barcode id]. */
const ENCODERS: Record<Exclude<CodeFormat, 'other'>, [Encoder, string]> = {
  code128: [code128, 'code128'],
  code39: [code39, 'code39'],
  code93: [code93, 'code93'],
  codabar: [rationalizedCodabar, 'rationalizedCodabar'],
  ean13: [ean13, 'ean13'],
  ean8: [ean8, 'ean8'],
  upca: [upca, 'upca'],
  upce: [upce, 'upce'],
  itf: [interleaved2of5, 'interleaved2of5'],
  qr: [qrcode, 'qrcode'],
  datamatrix: [datamatrix, 'datamatrix'],
  pdf417: [pdf417, 'pdf417'],
  aztec: [azteccode, 'azteccode'],
};

export interface RenderedCode {
  /** SVG markup without width/height, ready to scale with CSS. */
  svg: string;
  /** The format actually drawn (may be code128 if the stored format couldn't encode the value). */
  format: CodeFormat;
  twoD: boolean;
}

function draw(format: Exclude<CodeFormat, 'other'>, value: string): string {
  const [encode, bcid] = ENCODERS[format];
  const twoD = CODE_FORMATS_2D.includes(format);
  // Quiet zone is part of the SVG (in modules), so it scales with the code at any size:
  // 12 modules left/right for barcodes (EAN needs ≥ 11), 4 modules all round for 2D codes.
  const opts: RenderOptions = {
    bcid,
    text: value,
    includetext: false,
    paddingwidth: twoD ? 4 : 12,
    paddingheight: twoD ? 4 : 0,
  };
  if (!twoD) opts.height = 12; // mm; stretched by CSS anyway
  return encode(opts, drawingSVG());
}

/** Draws the code; falls back to Code 128 for 1D values the stored format rejects. Null if impossible. */
export function renderCode(value: string, format: CodeFormat): RenderedCode | null {
  const v = value.trim();
  if (!v) return null;
  const first: Exclude<CodeFormat, 'other'> = format === 'other' ? 'code128' : format;
  const attempts: Array<Exclude<CodeFormat, 'other'>> = [first];
  if (first !== 'code128' && !CODE_FORMATS_2D.includes(first)) attempts.push('code128');

  for (const f of attempts) {
    try {
      const svg = draw(f, v).replace(/\s(width|height)="[^"]*"/g, '');
      return { svg, format: f, twoD: CODE_FORMATS_2D.includes(f) };
    } catch {
      // try the next format
    }
  }
  return null;
}
