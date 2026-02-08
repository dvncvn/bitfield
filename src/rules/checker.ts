import { loopSin, loopCos } from '../loop';
import type { Rect } from '../subdivide';
import type { PRNGHelper } from '../prng';
import type { FillParams } from './types';

/**
 * Checkerboard / grid pattern: regular tiling at a per-rect angle.
 * Scale controls tile size; density controls the fill balance.
 * Animates with phase drift creating a marching effect.
 */
export function fillChecker(
  bitmap: Uint8Array,
  bw: number,
  bh: number,
  _rect: Rect,
  t: number,
  rng: PRNGHelper,
  params: FillParams,
): void {
  const angle = rng.random() * Math.PI;
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);

  // Tile size
  const baseTile = 3 + rng.random() * 6;
  const tile = Math.max(2, baseTile * Math.pow(params.scale, 1.2));

  // Duty cycle: how much of each tile is filled
  const duty = 0.25 + params.density * 0.5; // 0.25–0.75

  // Phase drift
  const phaseX = loopSin(t) * tile * 0.5;
  const phaseY = loopCos(t + 0.3) * tile * 0.5;

  // Variant: pure checker vs grid lines vs blocks
  const variant = rng.randInt(0, 3);

  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      const rx = x * cosA + y * sinA + phaseX;
      const ry = -x * sinA + y * cosA + phaseY;

      const cx = ((rx % tile) + tile) % tile;
      const cy = ((ry % tile) + tile) % tile;

      // Normalise to [0,1) within tile
      const nx = cx / tile;
      const ny = cy / tile;

      let on: boolean;
      if (variant === 0) {
        // Checkerboard
        const cellX = Math.floor(rx / tile);
        const cellY = Math.floor(ry / tile);
        on = ((cellX + cellY) & 1) === 0;
      } else if (variant === 1) {
        // Grid lines (cross pattern)
        on = nx < duty || ny < duty;
      } else {
        // Offset blocks (brick-like)
        const row = Math.floor(ry / tile);
        const offset = (row & 1) ? tile * 0.5 : 0;
        const bx = (((rx + offset) % tile) + tile) % tile / tile;
        on = bx < duty && ny < duty;
      }

      bitmap[y * bw + x] = on ? 1 : 0;
    }
  }
}
