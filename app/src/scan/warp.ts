/**
 * Perspective crop without OpenCV (SPEC 3): solve the homography between the
 * output rectangle and the 4 chosen corners, then sample the photo bilinearly.
 */

export interface Point {
  x: number;
  y: number;
}

/** Corners in order: top-left, top-right, bottom-right, bottom-left. */
export type Quad = [Point, Point, Point, Point];

/** Minimal ImageData shape, so this also runs in tests without a DOM. */
export interface Pixels {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export const fullQuad = (w: number, h: number): Quad => [
  { x: 0, y: 0 },
  { x: w, y: 0 },
  { x: w, y: h },
  { x: 0, y: h },
];

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** Output size that keeps the quad's proportions (longest side capped). */
export function quadSize(q: Quad, maxSide = 1400): { width: number; height: number } {
  const w = Math.max(dist(q[0], q[1]), dist(q[3], q[2]));
  const h = Math.max(dist(q[0], q[3]), dist(q[1], q[2]));
  const scale = Math.min(1, maxSide / Math.max(w, h, 1));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

/** Solves A·x = b (n×n) with Gaussian elimination and partial pivoting. */
function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const pivot = M[c][c] || 1e-12;
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / pivot;
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n];
    for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k];
    x[r] = s / (M[r][r] || 1e-12);
  }
  return x;
}

/** 3×3 homography H (row-major, h33 = 1) mapping `from` corners onto `to` corners. */
export function homography(from: Quad, to: Quad): number[] {
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = from[i];
    const { x: u, y: v } = to[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  return [...solve(A, b), 1];
}

export function applyHomography(H: number[], p: Point): Point {
  const w = H[6] * p.x + H[7] * p.y + H[8];
  return { x: (H[0] * p.x + H[1] * p.y + H[2]) / w, y: (H[3] * p.x + H[4] * p.y + H[5]) / w };
}

/** Straightens the area inside `quad` into a width × height image. */
export function warpQuad(src: Pixels, quad: Quad, width: number, height: number): Pixels {
  const H = homography(fullQuad(width, height), quad);
  const out = new Uint8ClampedArray(width * height * 4);
  const { data, width: sw, height: sh } = src;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const { x: fx, y: fy } = applyHomography(H, { x: x + 0.5, y: y + 0.5 });
      const sx = Math.min(sw - 1, Math.max(0, fx - 0.5));
      const sy = Math.min(sh - 1, Math.max(0, fy - 0.5));
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const x1 = Math.min(sw - 1, x0 + 1);
      const y1 = Math.min(sh - 1, y0 + 1);
      const ax = sx - x0;
      const ay = sy - y0;
      const o = (y * width + x) * 4;
      for (let c = 0; c < 4; c++) {
        const top = data[(y0 * sw + x0) * 4 + c] * (1 - ax) + data[(y0 * sw + x1) * 4 + c] * ax;
        const bottom = data[(y1 * sw + x0) * 4 + c] * (1 - ax) + data[(y1 * sw + x1) * 4 + c] * ax;
        out[o + c] = top * (1 - ay) + bottom * ay;
      }
    }
  }
  return { data: out, width, height };
}

/**
 * Crop area around a detected code: its own corners, widened along the code's own axes
 * (so it stays straight on angled photos) and clamped to the image.
 * 1D codes are often reported as a thin line, so they get a minimum height.
 */
export function codeCropQuad(code: Quad, imgW: number, imgH: number, twoD: boolean): Quad {
  const [tl, tr, br, bl] = code;
  const cx = (tl.x + tr.x + br.x + bl.x) / 4;
  const cy = (tl.y + tr.y + br.y + bl.y) / 4;
  // Unit vectors along the code's width and height.
  const wx = (tr.x - tl.x + br.x - bl.x) / 2;
  const wy = (tr.y - tl.y + br.y - bl.y) / 2;
  const width = Math.hypot(wx, wy) || 1;
  const ux = { x: wx / width, y: wy / width };
  const uy = { x: -ux.y, y: ux.x };
  const rawHeight = (Math.hypot(bl.x - tl.x, bl.y - tl.y) + Math.hypot(br.x - tr.x, br.y - tr.y)) / 2;

  const halfW = (width * (twoD ? 1.3 : 1.24)) / 2;
  const height = twoD ? rawHeight * 1.3 : Math.max(rawHeight * 1.4, width * 0.42);
  const halfH = height / 2;

  const corner = (sx: number, sy: number): Point => ({
    x: Math.min(imgW, Math.max(0, cx + ux.x * halfW * sx + uy.x * halfH * sy)),
    y: Math.min(imgH, Math.max(0, cy + ux.y * halfW * sx + uy.y * halfH * sy)),
  });
  return [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)];
}
