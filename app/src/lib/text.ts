/** Case-, space- and diacritics-insensitive key: "  Zaļā  Josta " → "zala josta". */
export function normalizeKey(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Stable 32-bit FNV-1a hash with a final avalanche (murmur3 fmix32). Without the mix,
 * the low bits — which `% 8` uses — depend only on the low bits of each character,
 * so many store names landed on the same colour.
 */
export function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}
