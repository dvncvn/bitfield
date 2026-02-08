import { loopSin, loopCos } from '../loop';
import type { Rect } from '../subdivide';
import type { PRNGHelper } from '../prng';
import type { FillParams } from './types';

// 8×8 Bayer matrix (normalised to [0, 1))
const BAYER8 = [
  0, 48, 12, 60, 3, 51, 15, 63,
  32, 16, 44, 28, 35, 19, 47, 31,
  8, 56, 4, 52, 11, 59, 7, 55,
  40, 24, 36, 20, 43, 27, 39, 23,
  2, 50, 14, 62, 1, 49, 13, 61,
  34, 18, 46, 30, 33, 17, 45, 29,
  10, 58, 6, 54, 9, 57, 5, 53,
  42, 26, 38, 22, 41, 25, 37, 21,
].map((v) => v / 64);

/**
 * Ordered dithering fill: Bayer dithering over an animated gradient.
 * Scale controls gradient zoom; density shifts the value range.
 */
export function fillDither(
  bitmap: Uint8Array,
  bw: number,
  bh: number,
  _rect: Rect,
  t: number,
  rng: PRNGHelper,
  params: FillParams,
): void {
  const angle = rng.random() * Math.PI * 2;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const phase = loopSin(t);
  const phaseB = loopCos(t + 0.25);

  // Exponential scale: lower = many more gradient cycles, higher = broad sweep
  const gradScale = Math.pow(Math.max(0.1, params.scale), 1.5);
  const maxDim = (Math.max(bw, bh) || 1) * gradScale;

  // Density shifts the value bias
  const bias = (params.density - 0.5) * 0.4;

  // Bayer tile size varies: smaller scale → 4x4 effective, larger → 16x16 effective
  const tileShift = params.scale < 0.5 ? 2 : params.scale < 1.5 ? 3 : 4;
  const tileMask = (1 << tileShift) - 1;

  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      const grad = ((x * dx + y * dy) / maxDim + phase) % 1;
      const value = Math.min(1, Math.max(0, (grad + phaseB * 0.3) % 1 + bias));
      // Sample Bayer at effective tile size by scaling coordinates
      const bx = (x >> (tileShift - 3)) & 7;
      const by = (y >> (tileShift - 3)) & 7;
      const bayerVal = BAYER8[(by & 7) * 8 + (bx & 7)];
      bitmap[y * bw + x] = value < bayerVal ? 1 : 0;
    }
  }
}
