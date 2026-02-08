import { loopSin, loopCos, valueNoise2D } from '../loop';
import type { Rect } from '../subdivide';
import type { PRNGHelper } from '../prng';
import type { FillParams } from './types';

/**
 * Fine gradient dithering: smooth tonal gradients rendered through
 * blue-noise-like error diffusion, producing much finer transitions
 * than Bayer dithering. Direction and phase animate with time.
 */
export function fillGradient(
  bitmap: Uint8Array,
  bw: number,
  bh: number,
  rect: Rect,
  t: number,
  rng: PRNGHelper,
  params: FillParams,
): void {
  const angle = rng.random() * Math.PI * 2;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);

  // Gradient cycles: more cycles = finer banding at scale boundaries
  const cycles = (0.5 + rng.random() * 1.5) / Math.max(0.1, params.scale);
  const phase = loopSin(t);
  const warp = loopCos(t + 0.3) * 0.15;

  // Noise-based dithering seed (deterministic)
  const noiseSeed = rng.random() * 1000;
  const density = params.density;

  const maxProj = Math.max(bw, bh) || 1;

  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      // Gradient value along the sweep direction
      const proj = (x * dx + y * dy) / maxProj * cycles + phase;
      // Add subtle warp from noise
      const warpN = valueNoise2D(
        (rect.x + x + noiseSeed) * 0.05,
        (rect.y + y + noiseSeed) * 0.05
      );
      const value = ((proj + warpN * warp) % 1 + 1) % 1;

      // Shift value by density
      const shifted = Math.max(0, Math.min(1, value + (density - 0.5) * 0.6));

      // Fine dithering: blue-noise-like pattern from two offset noise samples
      const d1 = valueNoise2D(
        (rect.x + x) * 0.97 + noiseSeed,
        (rect.y + y) * 0.97 + noiseSeed
      );
      const d2 = valueNoise2D(
        (rect.x + x) * 1.73 + noiseSeed + 50,
        (rect.y + y) * 1.73 + noiseSeed + 50
      );
      const dither = (d1 + d2) * 0.5; // average two uncorrelated samples

      bitmap[y * bw + x] = shifted > dither ? 1 : 0;
    }
  }
}
