import { loopSin, loopCos } from '../loop';
import type { Rect } from '../subdivide';
import type { PRNGHelper } from '../prng';
import type { FillParams } from './types';

/**
 * Fine parallel lines at a per-rect angle, with animated phase drift.
 * Scale controls line spacing; density controls line thickness.
 */
export function fillLines(
  bitmap: Uint8Array,
  bw: number,
  bh: number,
  _rect: Rect,
  t: number,
  rng: PRNGHelper,
  params: FillParams,
): void {
  const angle = rng.random() * Math.PI;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);

  // Spacing: 2 cells (very fine) → 16 cells (chunky)
  const baseSpacing = 2 + rng.random() * 4;
  const spacing = Math.max(1.2, baseSpacing * Math.pow(params.scale, 1.5));

  // Line thickness as fraction of spacing
  const thickness = 0.15 + params.density * 0.35; // 0.15–0.50

  // Phase drifts with time
  const phase = loopSin(t) * spacing * 0.8;

  // Optional second set of lines (cross-hatch)
  const crossHatch = rng.random() < 0.3;
  const angle2 = angle + Math.PI * (0.3 + rng.random() * 0.4);
  const dx2 = Math.cos(angle2);
  const dy2 = Math.sin(angle2);
  const phase2 = loopCos(t) * spacing * 0.6;

  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      const proj = x * dx + y * dy + phase;
      const pos = ((proj % spacing) + spacing) % spacing;
      let on = pos < spacing * thickness;

      if (crossHatch) {
        const proj2 = x * dx2 + y * dy2 + phase2;
        const pos2 = ((proj2 % spacing) + spacing) % spacing;
        on = on || pos2 < spacing * thickness;
      }

      bitmap[y * bw + x] = on ? 1 : 0;
    }
  }
}
