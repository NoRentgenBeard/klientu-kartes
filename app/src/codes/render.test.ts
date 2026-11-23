import { describe, expect, it } from 'vitest';
import { SAMPLE_CARDS } from '../db/seed';
import { renderCode } from './render';

describe('renderCode', () => {
  it.each(SAMPLE_CARDS.map((s) => [s.company, s.codeValue, s.codeFormat] as const))(
    '%s (%s, %s) renders in its own format',
    (_company, value, format) => {
      const r = renderCode(value, format);
      expect(r).not.toBeNull();
      expect(r!.format).toBe(format);
      expect(r!.svg.startsWith('<svg')).toBe(true);
      expect(r!.svg).toMatch(/viewBox="0 0 \d+ \d+"/);
      expect(r!.svg).not.toMatch(/\swidth="/);
    },
  );

  it('includes the quiet zone in the SVG', () => {
    // bwip-js draws 1 module = 2 units; the first bar's left edge must be ≥ 12 modules in.
    const firstX = (svg: string) => Number(svg.match(/d="M(\d+(?:\.\d+)?) /)![1]);
    const bar = renderCode('LV000012345', 'code128')!.svg;
    expect(firstX(bar) - 2).toBeGreaterThanOrEqual(24); // stroke is centred on x, 4 units wide
    const qr = renderCode('X-1', 'qr')!.svg;
    expect(firstX(qr)).toBeGreaterThanOrEqual(8); // 4 modules
  });

  it('marks 2D codes', () => {
    expect(renderCode('X-1', 'qr')!.twoD).toBe(true);
    expect(renderCode('123', 'code128')!.twoD).toBe(false);
  });

  it('falls back to Code 128 when the value does not fit the stored 1D format', () => {
    const r = renderCode('2690012345678', 'ean13'); // wrong check digit
    expect(r!.format).toBe('code128');
  });

  it('draws the other scanner formats', () => {
    expect(renderCode('CODE39TEST', 'code39')!.format).toBe('code39');
    expect(renderCode('12345678', 'itf')!.format).toBe('itf');
    expect(renderCode('A12345B', 'codabar')!.format).toBe('codabar');
    expect(renderCode('HELLO', 'datamatrix')!.format).toBe('datamatrix');
  });

  it('returns null for empty values', () => {
    expect(renderCode('  ', 'code128')).toBeNull();
  });
});
