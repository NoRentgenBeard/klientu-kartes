import type { Holder, HolderId } from '../db/types';
import { parseEndDate } from '../lib/dates';
import { normalizeKey, similarity } from '../lib/text';

/**
 * Turns OCR text into suggestions for Pārbaude (SPEC 6.5). Each guess says whether
 * the app is confident; anything not confident gets the yellow "Pārbaudi" flag.
 */

export interface OcrLine {
  text: string;
  /** 0–100 */
  confidence: number;
  /** Text height in pixels — big text is more likely the store name. */
  height: number;
}

export interface Guess<T> {
  value: T;
  confident: boolean;
}

// Words of a text; dots stay inside words ("cenuklubs.lv") but not at the ends ("DEPO.").
const words = (s: string) =>
  normalizeKey(s)
    .split(/[^a-z0-9&!.]+/)
    .map((w) => w.replace(/^\.+|\.+$/g, ''))
    .filter(Boolean);

/** Best fuzzy match of `phrase` against any same-length run of words in `tokens`. */
function bestWindowSimilarity(tokens: string[], phrase: string): number {
  const target = words(phrase);
  if (!target.length || !tokens.length) return 0;
  const joined = target.join(' ');
  const squashed = target.join('');
  let best = 0;
  for (let n = Math.max(1, target.length - 1); n <= target.length + 1; n++) {
    for (let i = 0; i + n <= tokens.length; i++) {
      const window = tokens.slice(i, i + n);
      best = Math.max(best, similarity(window.join(' '), joined), similarity(window.join(''), squashed));
    }
  }
  return best;
}

// Lines with these words describe the card ("KLIENTA KARTE", "Kartes numurs") — not the store's name.
const GENERIC_WORDS = /\b(kart\w*|klient\w*|numur\w*|nummur\w*|ludz\w*|uzradi\w*|deriga|lidz|sia|insider|card)\b/;

/** Store name: a known store found in the text, else the largest plausible text line. */
export function guessCompany(
  lines: OcrLine[],
  known: readonly string[],
  aliases: Readonly<Record<string, readonly string[]>> = {},
): Guess<string> | null {
  const tokens = lines.flatMap((l) => words(l.text));
  const text = ` ${tokens.join(' ')} `;

  const squashedText = text.replace(/[^a-z0-9]/g, '');

  // A short form or web address printed on the card identifies the store for sure.
  for (const [name, list] of Object.entries(aliases)) {
    for (const alias of list) {
      const a = words(alias).join(' ');
      const sq = a.replace(/[^a-z0-9]/g, '');
      if (text.includes(` ${a} `) || (sq.length >= 6 && squashedText.includes(sq))) return { value: name, confident: true };
    }
  }

  let best: { name: string; score: number } | null = null;
  for (const name of known) {
    const key = words(name).join(' ');
    if (!key) continue;
    const exact = text.includes(` ${key} `) || (key.includes(' ') && text.replace(/ /g, '').includes(key.replace(/ /g, '')));
    // Very short names ("Top!", "H&M") only count when they appear exactly.
    const score = exact ? 1 : key.length <= 4 ? 0 : bestWindowSimilarity(tokens, name);
    if (!best || score > best.score || (score === best.score && key.length > words(best.name).join(' ').length)) {
      best = { name, score };
    }
  }
  // Longer names tolerate a couple of misread letters ("[OUGLAS" → Douglas); always flagged then.
  const threshold = best && words(best.name).join('').length >= 6 ? 0.7 : 0.8;
  if (best && best.score >= threshold) return { value: best.name, confident: best.score === 1 };

  // Fallback: the biggest readable line that looks like a name.
  const candidates = lines
    .map((l) => ({ ...l, clean: l.text.replace(/\s+/g, ' ').trim() }))
    .filter((l) => {
      const letters = (l.clean.match(/\p{L}/gu) ?? []).length;
      const digits = (l.clean.match(/\d/g) ?? []).length;
      return (
        l.confidence >= 60 &&
        letters >= 4 &&
        letters > digits * 2 &&
        l.clean.length <= 32 &&
        !/(www\.|https?:|@|\.lv\b|\.com\b)/i.test(l.clean) &&
        !GENERIC_WORDS.test(normalizeKey(l.clean))
      );
    })
    .sort((a, b) => b.height - a.height);
  const top = candidates[0];
  return top ? { value: top.clean, confident: false } : null;
}

// Words that usually stand right before an end date.
const DATE_KEYWORDS = /(deriga|derigs|lidz|valid|exp|beidz|termin)/;

/** End date such as "09/2027", "30.09.2026", "09.2027". */
export function findEndDate(lines: OcrLine[], today = new Date()): Guess<string> | null {
  const minYear = today.getFullYear() - 3;
  const found: Array<{ iso: string; keyword: boolean }> = [];

  for (const line of lines) {
    // OCR often reads 0 as O in numbers.
    const text = line.text.replace(/(?<=\d)[Oo]|[Oo](?=\d)/g, '0');
    const keyword = DATE_KEYWORDS.test(normalizeKey(line.text));
    const re = /(?<![\d/.-])(\d{1,2}[./-]\d{1,2}[./-](?:\d{4}|\d{2})|\d{1,2}[./-]\d{4}|\d{1,2}\/\d{2})(?![\d/.-])/g;
    for (const m of text.matchAll(re)) {
      const iso = parseEndDate(m[1]);
      if (iso && Number(iso.slice(0, 4)) >= minYear) found.push({ iso, keyword });
    }
  }
  if (!found.length) return null;
  const withKeyword = found.find((f) => f.keyword);
  if (withKeyword) return { value: withKeyword.iso, confident: true };
  // Without a keyword, take the latest date (cards rarely print other future dates).
  const latest = found.sort((a, b) => b.iso.localeCompare(a.iso))[0];
  return { value: latest.iso, confident: false };
}

const HOLDER_ALIASES: Record<Exclude<HolderId, 'pe'>, string[]> = {
  hf: ['Happy Fish'],
  zj: ['Zaļā josta'],
};

/** Company holder printed or written on the card ("Happy Fish SIA", "Zaļā josta"). */
export function findHolder(lines: OcrLine[], holders: readonly Holder[]): Guess<HolderId> | null {
  const tokens = lines.flatMap((l) => words(l.text));
  let best: { id: HolderId; score: number } | null = null;
  for (const h of holders) {
    if (h.id === 'pe') continue;
    const names = new Set([h.name, ...HOLDER_ALIASES[h.id]]);
    for (const name of names) {
      const score = bestWindowSimilarity(tokens, name);
      if (!best || score > best.score) best = { id: h.id, score };
    }
  }
  if (!best || best.score < 0.75) return null;
  return { value: best.id, confident: best.score >= 0.95 };
}

/**
 * Card number printed as text — used when no barcode could be read (e.g. the code is
 * damaged, or a paper slip has only a number). Always flagged for checking.
 * Picks the longest well-read run of 6–20 digits, optionally with a short letter prefix
 * ("LV000012345", "L00012345"), that isn't a date or phone number.
 */
export function findCardNumber(lines: OcrLine[]): Guess<string> | null {
  const candidates: Array<{ value: string; score: number }> = [];
  for (const line of lines) {
    if (line.confidence < 60) continue;
    if (/(t[aā]lr|tel|phone|\+371)/i.test(line.text)) continue;
    const text = line.text.replace(/(?<=\d) (?=\d{3,})/g, '');
    for (const m of text.matchAll(/(?<![\p{L}\d])([A-Z]{0,3}\d{6,20})(?![\p{L}\d])/gu)) {
      const value = m[1];
      const digits = value.replace(/\D/g, '').length;
      candidates.push({ value, score: digits + line.confidence / 100 });
    }
  }
  const best = candidates.sort((a, b) => b.score - a.score)[0];
  return best ? { value: best.value, confident: false } : null;
}
