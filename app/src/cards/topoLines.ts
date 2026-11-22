import { contours } from 'd3-contour';

/**
 * Topographic card pattern — SPEC 5.3.
 * Height fields live in a 340 × 214 design space. Contour levels come from the whole
 * card's min/max, so a card that is only partly visible (in a stack) shows the same lines.
 * Lines depend only on the layout, not the colour, so there are at most 8 cached results.
 */

export const TOPO_W = 340;
export const TOPO_H = 214;
export const LAYOUT_COUNT = 8;

const STEP = 2; // sampling grid in design units
const PAD = 12; // sample beyond the card so polygon edges fall outside the clipped area
const LEVELS = 18; // SPEC: 14–20
const INDEX_EVERY = 5; // every 5th line is an index line

type Field = (x: number, y: number) => number;

/** Rotated Gaussian. g(cx, cy, s) is round; g(cx, cy, sx, sy, rot) is elliptic. */
function g(cx: number, cy: number, sx: number, sy: number = sx, rot = 0): Field {
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  return (x, y) => {
    const dx = x - cx;
    const dy = y - cy;
    const u = dx * cos + dy * sin;
    const v = -dx * sin + dy * cos;
    return Math.exp(-((u * u) / (2 * sx * sx) + (v * v) / (2 * sy * sy)));
  };
}

const wob =
  (f: Field): Field =>
  (x, y) =>
    f(x, y) * (1 + 0.06 * Math.sin(x / 23) * Math.cos(y / 31));

const sum =
  (...parts: Array<[number, Field]>): Field =>
  (x, y) =>
    parts.reduce((acc, [w, f]) => acc + w * f(x, y), 0);

export const LAYOUTS: readonly Field[] = [
  // 0 — single peak right
  wob(g(250, 130, 90, 70)),
  // 1 — two peaks
  wob(sum([1, g(270, 60, 70)], [0.8, g(70, 190, 60)])),
  // 2 — diagonal ridge
  wob(g(200, 110, 170, 40, -0.45)),
  // 3 — peak from bottom-left corner
  wob(g(40, 214, 130, 110)),
  // 4 — stacked waves
  (x, y) => (y + 14 * Math.sin(x / 38) + 6 * Math.sin(x / 13 + y / 50)) / 214,
  // 5 — ring
  wob((x, y) => {
    const d = Math.hypot(x - 230, y - 120);
    return Math.exp(-((d - 55) ** 2) / (2 * 28 ** 2));
  }),
  // 6 — three peaks
  wob(sum([1, g(220, 80, 40)], [0.9, g(290, 150, 45)], [0.75, g(170, 170, 38)])),
  // 7 — saddle
  wob(sum([1, g(60, 30, 80)], [1, g(300, 200, 80)], [-0.3, g(180, 110, 60)])),
];

export interface TopoLine {
  /** SVG path in design-space coordinates. */
  d: string;
  /** Index line (every 5th): drawn stronger. */
  index: boolean;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

function computeTopo(layoutIndex: number): TopoLine[] {
  const field = LAYOUTS[layoutIndex];
  const nx = Math.round((TOPO_W + 2 * PAD) / STEP) + 1;
  const ny = Math.round((TOPO_H + 2 * PAD) / STEP) + 1;
  const values = new Float64Array(nx * ny);
  let min = Infinity;
  let max = -Infinity;

  for (let j = 0; j < ny; j++) {
    const y = -PAD + j * STEP;
    for (let i = 0; i < nx; i++) {
      const x = -PAD + i * STEP;
      const v = field(x, y);
      values[j * nx + i] = v;
      if (x >= 0 && x <= TOPO_W && y >= 0 && y <= TOPO_H) {
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
  }

  const thresholds = Array.from({ length: LEVELS }, (_, k) => min + ((max - min) * (k + 1)) / (LEVELS + 1));
  const generator = contours().size([nx, ny]).thresholds(thresholds);

  return generator(Array.from(values))
    .map((mp, k) => {
      let d = '';
      for (const polygon of mp.coordinates)
        for (const ring of polygon) {
          ring.forEach(([gx, gy], p) => {
            d += `${p === 0 ? 'M' : 'L'}${r1(-PAD + gx * STEP)} ${r1(-PAD + gy * STEP)}`;
          });
          d += 'Z';
        }
      return { d, index: (k + 1) % INDEX_EVERY === 0 };
    })
    .filter((line) => line.d.length > 0);
}

const cache = new Map<number, TopoLine[]>();

/** Contour lines for a layout (0–7), computed once and cached. */
export function topoLines(layoutIndex: number): TopoLine[] {
  const i = ((layoutIndex % LAYOUT_COUNT) + LAYOUT_COUNT) % LAYOUT_COUNT;
  let lines = cache.get(i);
  if (!lines) cache.set(i, (lines = computeTopo(i)));
  return lines;
}
