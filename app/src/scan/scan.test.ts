import { describe, expect, it } from 'vitest';
import { DEFAULT_HOLDERS } from '../db/repo';
import { mapFormat } from './barcode';
import { findCardNumber, findEndDate, findHolder, guessCompany, type OcrLine } from './guess';
import { KNOWN_STORES, STORE_ALIASES } from './stores';
import { applyHomography, codeCropQuad, fullQuad, homography, quadSize, warpQuad, type Quad } from './warp';

// Made-up OCR output shaped like real cards (no real card data).
const L = (text: string, confidence = 92, height = 40): OcrLine => ({ text, confidence, height });

describe('guessCompany', () => {
  it('finds a known store in the text', () => {
    expect(guessCompany([L('Lūdzu, uzrādiet karti'), L('Iepērkoties ar DEPO karti')], KNOWN_STORES)).toEqual({
      value: 'DEPO',
      confident: true,
    });
  });
  it('uses short forms and web addresses', () => {
    expect(guessCompany([L('Cash&Carry', 84, 80)], KNOWN_STORES, STORE_ALIASES)?.value).toBe('PROMO Cash&Carry');
    expect(guessCompany([L('www.cenuklubs.lv/kontakti')], KNOWN_STORES, STORE_ALIASES)?.value).toBe('Cenu klubs');
  });
  it('accepts a misread long name but flags it', () => {
    expect(guessCompany([L('[OUGLAS', 72, 139)], KNOWN_STORES)).toEqual({ value: 'Douglas', confident: false });
  });
  it('ignores punctuation around words', () => {
    expect(guessCompany([L('DEPO.')], KNOWN_STORES)).toEqual({ value: 'DEPO', confident: true });
  });
  it('ignores diacritics', () => {
    expect(guessCompany([L('MENESS APTIEKA')], KNOWN_STORES)?.value).toBe('Mēness aptieka');
  });
  it('falls back to the biggest plausible line, flagged', () => {
    expect(guessCompany([L('Small print here', 95, 20), L('Kafijas Nams', 90, 90)], KNOWN_STORES)).toEqual({
      value: 'Kafijas Nams',
      confident: false,
    });
  });
  it('never suggests card words or junk', () => {
    const junk = [L('KLIENTA KARTE', 94, 53), L('Jūsu INSIDER karte', 93, 51), L('ENE', 71, 344), L("' klienta nummurs:", 78, 45)];
    expect(guessCompany(junk, KNOWN_STORES)).toBeNull();
  });
});

describe('findEndDate', () => {
  const today = new Date(2026, 10, 23);
  it('reads month/year as the last day of the month', () => {
    expect(findEndDate([L('* 09/2027')], today)).toEqual({ value: '2027-09-30', confident: false });
  });
  it('is confident next to a keyword', () => {
    expect(findEndDate([L('Derīga līdz 31.12.2027')], today)).toEqual({ value: '2027-12-31', confident: true });
  });
  it('fixes O read instead of 0', () => {
    expect(findEndDate([L('Derīga līdz O9/2O27')], today)?.value).toBe('2027-09-30');
  });
  it('ignores phone numbers, card numbers and old dates', () => {
    expect(findEndDate([L('tālr. 67 021 221'), L('L00012345'), L('Izsniegta 01.02.2015')], today)).toBeNull();
  });
});

describe('findHolder', () => {
  it('finds printed company holders', () => {
    expect(findHolder([L('Happy Fish SIA')], DEFAULT_HOLDERS)).toEqual({ value: 'hf', confident: true });
    expect(findHolder([L('ZALA JOSTA SIA')], DEFAULT_HOLDERS)).toEqual({ value: 'zj', confident: true });
  });
  it('flags a near miss', () => {
    expect(findHolder([L('Hapy Fsh')], DEFAULT_HOLDERS)).toEqual({ value: 'hf', confident: false });
  });
  it('uses renamed holders', () => {
    const renamed = DEFAULT_HOLDERS.map((h) => (h.id === 'hf' ? { ...h, name: 'Laimīgā Zivs' } : h));
    expect(findHolder([L('LAIMĪGĀ ZIVS')], renamed)?.value).toBe('hf');
  });
  it('returns null when nothing matches', () => {
    expect(findHolder([L('Lūdzu, uzrādiet karti kasierim')], DEFAULT_HOLDERS)).toBeNull();
  });
});

describe('findCardNumber', () => {
  it('picks the card number, not phones or short numbers', () => {
    expect(findCardNumber([L('tālr. 67021221'), L('0.39'), L('9233000011112222', 90), L('Kartes numurs 4726092')])).toEqual({
      value: '9233000011112222',
      confident: false,
    });
  });
  it('keeps a letter prefix', () => {
    expect(findCardNumber([L('LV000012345')])?.value).toBe('LV000012345');
  });
  it('ignores badly read lines', () => {
    expect(findCardNumber([L('2830011345108', 34)])).toBeNull();
  });
});

describe('mapFormat', () => {
  it.each([
    ['EAN-13', 'ean13'],
    ['EAN13', 'ean13'],
    ['Code128', 'code128'],
    ['Code 39', 'code39'],
    ['QRCode', 'qr'],
    ['Micro QR Code', 'qr'],
    ['ITF-14', 'itf'],
    ['DataBar', 'other'],
  ])('%s → %s', (from, to) => expect(mapFormat(from)).toBe(to));
});

describe('warp', () => {
  it('homography maps corners exactly', () => {
    const to: Quad = [
      { x: 10, y: 20 },
      { x: 300, y: 40 },
      { x: 280, y: 220 },
      { x: 30, y: 200 },
    ];
    const H = homography(fullQuad(100, 50), to);
    fullQuad(100, 50).forEach((p, i) => {
      const q = applyHomography(H, p);
      expect(q.x).toBeCloseTo(to[i].x, 6);
      expect(q.y).toBeCloseTo(to[i].y, 6);
    });
  });

  it('warpQuad copies a straight crop exactly', () => {
    const w = 8;
    const h = 6;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) data.set([i, 255 - i, i % 7, 255], i * 4);
    const out = warpQuad({ data, width: w, height: h }, [{ x: 2, y: 1 }, { x: 6, y: 1 }, { x: 6, y: 4 }, { x: 2, y: 4 }], 4, 3);
    // Output pixel (0,0) is source pixel (2,1).
    expect(Array.from(out.data.slice(0, 4))).toEqual(Array.from(data.slice((1 * w + 2) * 4, (1 * w + 2) * 4 + 4)));
  });

  it('quadSize keeps proportions and caps the long side', () => {
    expect(quadSize(fullQuad(3000, 1500), 1400)).toEqual({ width: 1400, height: 700 });
  });

  it('codeCropQuad pads a thin 1D code and stays inside the image', () => {
    const line: Quad = [
      { x: 100, y: 200 },
      { x: 500, y: 200 },
      { x: 500, y: 204 },
      { x: 100, y: 204 },
    ];
    const q = codeCropQuad(line, 640, 480, false);
    const size = quadSize(q, 10_000);
    expect(size.width).toBeGreaterThan(400);
    expect(size.height).toBeGreaterThan(150); // at least ~0.42 × width
    for (const p of q) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(640);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(480);
    }
  });
});
