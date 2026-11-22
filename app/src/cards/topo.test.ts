import { describe, expect, it } from 'vitest';
import { LAYOUT_COUNT, topoLines } from './topoLines';

describe('topographic layouts', () => {
  it.each(Array.from({ length: LAYOUT_COUNT }, (_, i) => i))('layout %i has 14–20 lines with index lines', (i) => {
    const lines = topoLines(i);
    expect(lines.length).toBeGreaterThanOrEqual(14);
    expect(lines.length).toBeLessThanOrEqual(20);
    expect(lines.filter((l) => l.index).length).toBeGreaterThanOrEqual(2);
    for (const l of lines) expect(l.d).toMatch(/^M-?[\d.]+ -?[\d.]+/);
  });

  it('caches per layout and wraps out-of-range indices', () => {
    expect(topoLines(3)).toBe(topoLines(3));
    expect(topoLines(11)).toBe(topoLines(3));
    expect(topoLines(-1)).toBe(topoLines(7));
  });

  it('layouts differ from each other', () => {
    const firsts = new Set(Array.from({ length: LAYOUT_COUNT }, (_, i) => topoLines(i)[0].d));
    expect(firsts.size).toBe(LAYOUT_COUNT);
  });
});
