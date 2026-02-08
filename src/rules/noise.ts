import { loopingNoise2D, loopSin } from '../loop';
import type { Rect } from '../subdivide';
import type { PRNGHelper } from '../prng';
import type { FillParams } from './types';

/**
 * Thresholded noise fill: sample looping 2D noise, threshold to B/W.
 * Scale controls spatial frequency; density shifts the threshold.
 */
export function fillNoise(
  bitmap: Uint8Array,
  bw: number,
  bh: number,
  rect: Rect,
  t: number,
  rng: PRNGHelper,
  params: FillParams,
): void {
  const offsetX = rng.random() * 100;
  const offsetY = rng.random() * 100;
  const baseScale = 0.08 + rng.random() * 0.12;
  // Exponential mapping: scale=0.1 → 30x finer, scale=6 → 0.06x (huge blobs)
  const scale = baseScale * Math.pow(params.scale, -1.5);

  // Density shifts the threshold: low density = more black, high = more white
  const baseThreshold = 0.2 + params.density * 0.6; // 0.2–0.8
  const threshold = baseThreshold + loopSin(t) * 0.12 * params.noiseAmount;

  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      const nx = (rect.x + x + offsetX) * scale;
      const ny = (rect.y + y + offsetY) * scale;
      const n = loopingNoise2D(nx, ny, t, 1, 1.5);
      bitmap[y * bw + x] = n < threshold ? 1 : 0;
    }
  }
}
