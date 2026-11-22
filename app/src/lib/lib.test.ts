import { describe, expect, it } from 'vitest';
import { expiryStatus, formatDate, parseEndDate } from './dates';
import { formatForTypedNumber, isValidEan13, isValidEan8 } from './codes';
import { defaultColorIndex, defaultLayoutIndex } from './style';
import { normalizeKey } from './text';
import { SAMPLE_CARDS } from '../db/seed';

describe('parseEndDate', () => {
  it.each([
    ['30.09.2026', '2026-09-30'],
    ['30/09/2026', '2026-09-30'],
    ['1.2.27', '2027-02-01'],
    ['09/2027', '2027-09-30'],
    ['09.2027', '2027-09-30'],
    ['2/28', '2028-02-29'], // leap year, month/year → last day
    ['2027-09-30', '2027-09-30'],
  ])('%s → %s', (input, iso) => expect(parseEndDate(input)).toBe(iso));

  it.each(['31.02.2026', '13/2027', 'hello', '', '00/2027'])('rejects %s', (input) =>
    expect(parseEndDate(input)).toBeNull(),
  );
});

describe('formatDate', () => {
  it('uses DD.MM.YYYY', () => expect(formatDate('2026-09-30')).toBe('30.09.2026'));
});

describe('expiryStatus', () => {
  const today = '2026-11-23';
  it('no end date → none', () => expect(expiryStatus(null, today)).toBeNull());
  it('past → expired', () => expect(expiryStatus('2026-11-22', today)).toBe('expired'));
  it('end date today is still valid → expiring', () => expect(expiryStatus('2026-11-23', today)).toBe('expiring'));
  it('exactly 30 days → expiring', () => expect(expiryStatus('2026-12-23', today)).toBe('expiring'));
  it('31 days → none', () => expect(expiryStatus('2026-12-24', today)).toBeNull());
});

describe('codes', () => {
  it('validates EAN check digits', () => {
    expect(isValidEan13('2690012345671')).toBe(true);
    expect(isValidEan13('2690012345678')).toBe(false);
    expect(isValidEan8('11223344')).toBe(true);
  });
  it('typed numbers: EAN-13 if valid, else Code 128', () => {
    expect(formatForTypedNumber('2690012345671')).toBe('ean13');
    expect(formatForTypedNumber('800111222')).toBe('code128');
    expect(formatForTypedNumber('LV000012345')).toBe('code128');
  });
  it('sample EAN numbers are valid', () => {
    for (const s of SAMPLE_CARDS) {
      if (s.codeFormat === 'ean13') expect(isValidEan13(s.codeValue), s.company).toBe(true);
      if (s.codeFormat === 'ean8') expect(isValidEan8(s.codeValue), s.company).toBe(true);
    }
  });
});

describe('style defaults', () => {
  it('normalizes case, spaces and diacritics', () => {
    expect(normalizeKey('  Zaļā   JOSTA ')).toBe('zala josta');
  });
  it('same store → same layout, regardless of spelling', () => {
    expect(defaultLayoutIndex('Mēness aptieka')).toBe(defaultLayoutIndex('meness  APTIEKA'));
  });
  it('indices are 0–7', () => {
    for (const s of SAMPLE_CARDS) {
      expect(defaultLayoutIndex(s.company)).toBeGreaterThanOrEqual(0);
      expect(defaultLayoutIndex(s.company)).toBeLessThan(8);
    }
  });
  it('same store for another holder never gets the same colour', () => {
    for (let i = 0; i < 200; i++) {
      const company = `Store ${i}`;
      const hf = defaultColorIndex(company, 'hf');
      const zj = defaultColorIndex(company, 'zj', [{ company, holder: 'hf', colorIndex: hf }]);
      expect(zj).not.toBe(hf);
    }
  });
});
