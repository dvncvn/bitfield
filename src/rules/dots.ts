import { loopSin, loopCos } from '../loop';
import type { Rect } from '../subdivide';
import type { PRNGHelper } from '../prng';
import type { FillParams } from './types';

/**
 * Regular dot grid: evenly spaced circles at a per-rect angle.
 * Scale controls spacing; density controls dot size.
 * Animates with a gentle phase drift.
 */
export function fillDots(
  bitmap: Uint8Array,
  bw: number,
  bh: number,
  _rect: Rect,
  t: number,
  rng: PRNGHelper,
  params: FillParams,
): void {
  // Grid angle (slight rotation for visual interest)
  const angle = rng.random() * Math.PI;
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);

  // Spacing between dot centers
  const baseSpacing = 3 + rng.random() * 5;
  const spacing = Math.max(2, baseSpacing * Math.pow(params.scale, 1.2));

  // Dot radius as fraction of spacing
  const radius = spacing * (0.1 + params.density * 0.35); // 0.1–0.45 of spacing
  const r2 = radius * radius;

  // Phase drift
  const phaseX = loopSin(t) * spacing * 0.4;
  const phaseY = loopCos(t + 0.25) * spacing * 0.4;

  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      // Rotate into grid space
      const rx = x * cosA + y * sinA + phaseX;
      const ry = -x * sinA + y * cosA + phaseY;

      // Distance to nearest grid point
      const gx = Math.round(rx / spacing) * spacing;
      const gy = Math.round(ry / spacing) * spacing;
      const dx = rx - gx;
      const dy = ry - gy;
      const d2 = dx * dx + dy * dy;

      bitmap[y * bw + x] = d2 < r2 ? 1 : 0;
    }
  }
}
