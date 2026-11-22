import type { HolderId } from '../db/types';
import { fnv1a, normalizeKey } from './text';

const COUNT = 8;

/** Same store → same contour layout (SPEC 4). */
export function defaultLayoutIndex(company: string): number {
  return fnv1a(normalizeKey(company)) % COUNT;
}

interface Sibling {
  company: string;
  holder: HolderId;
  colorIndex: number;
}

/**
 * Colour from company + holder, so the same store looks the same, but cards of the
 * same store for different holders never share a colour (e.g. the two DEPO cards).
 */
export function defaultColorIndex(company: string, holder: HolderId, existing: readonly Sibling[] = []): number {
  const key = normalizeKey(company);
  const taken = new Set(
    existing.filter((c) => c.holder !== holder && normalizeKey(c.company) === key).map((c) => c.colorIndex),
  );
  let color = fnv1a(`${key}|${holder}`) % COUNT;
  for (let i = 0; i < COUNT && taken.has(color); i++) color = (color + 1) % COUNT;
  return color;
}
