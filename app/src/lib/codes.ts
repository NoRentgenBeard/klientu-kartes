import type { CodeFormat } from '../db/types';

function gtinCheckDigitValid(digits: string): boolean {
  const body = digits.slice(0, -1);
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    // Weights 3,1,3,1… counted from the digit next to the check digit.
    const weight = (body.length - i) % 2 === 1 ? 3 : 1;
    sum += Number(body[i]) * weight;
  }
  return (10 - (sum % 10)) % 10 === Number(digits[digits.length - 1]);
}

export const isValidEan13 = (s: string) => /^\d{13}$/.test(s) && gtinCheckDigitValid(s);
export const isValidEan8 = (s: string) => /^\d{8}$/.test(s) && gtinCheckDigitValid(s);

/** SPEC 6.5: typed numbers become EAN-13 when valid, otherwise Code 128. */
export function formatForTypedNumber(value: string): CodeFormat {
  const v = value.replace(/\s+/g, '');
  return isValidEan13(v) ? 'ean13' : 'code128';
}
