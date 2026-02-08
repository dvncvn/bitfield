import { loopSin, loopCos, loopingNoise2D } from '../loop';
import type { Rect } from '../subdivide';
import type { PRNGHelper } from '../prng';
import type { FillParams } from './types';

/**
 * Vertical column/curtain fill: vertical stripes with noise-modulated
 * widths and density, creating a waterfall/drip texture.
 */
export function fillColumns(
  bitmap: Uint8Array,
  bw: number,
  bh: number,
  rect: Rect,
  t: number,
  rng: PRNGHelper,
  params: FillParams,
): void {
  const offsetX = rng.random() * 200;
  const offsetY = rng.random() * 200;

  const baseFreq = 0.2 + rng.random() * 0.4;
  const freq = baseFreq / Math.max(0.1, params.scale);
  const noiseScale = 0.03 + rng.random() * 0.05;
  const phase = loopCos(t) * 3;
  const yDrift = loopSin(t + 0.25) * 2;

  const duty = 0.15 + params.density * 0.55;

  for (let x = 0; x < bw; x++) {
    // Noise modulates column frequency
    const nx = (rect.x + x + offsetX) * noiseScale;
    const ny = (rect.y + offsetY) * noiseScale;
    const nMod = loopingNoise2D(nx, ny, t, 1, 1.2);
    const localFreq = freq * (0.4 + nMod * 1.6);

    const colPhase = (rect.x + x) * localFreq + phase;
    const colVal = ((colPhase % 1) + 1) % 1;
    const colOn = colVal < duty;

    for (let y = 0; y < bh; y++) {
      if (colOn) {
        // Vertical variation within bright columns
        const yNoise = loopingNoise2D(
          (rect.x + x + offsetX) * noiseScale * 0.5,
          (rect.y + y + offsetY + yDrift) * noiseScale * 2,
          t, 1, 1
        );
        bitmap[y * bw + x] = yNoise < 0.12 ? 0 : 1;
      } else {
        const yNoise = loopingNoise2D(
          (rect.x + x + offsetX) * noiseScale,
          (rect.y + y + offsetY + yDrift) * noiseScale * 3,
          t, 1, 1
        );
        bitmap[y * bw + x] = yNoise > 0.93 ? 1 : 0;
      }
    }
  }
}
