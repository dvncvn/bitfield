import { loopTriangle } from '../loop';
import type { Rect } from '../subdivide';
import type { PRNGHelper } from '../prng';
import type { FillParams } from './types';

/**
 * Cellular automata fill: initialise random state, run N steps of a
 * totalistic 2D rule. Blends between adjacent step counts for smooth motion.
 * Scale controls step count; density controls initial fill ratio.
 */
export function fillAutomata(
  bitmap: Uint8Array,
  bw: number,
  bh: number,
  _rect: Rect,
  t: number,
  rng: PRNGHelper,
  params: FillParams,
): void {
  const size = bw * bh;

  // Density controls initial fill ratio
  const fillRatio = 0.15 + params.density * 0.5; // 0.15–0.65
  // Cluster initial state into blobs proportional to scale
  const clusterSize = Math.max(1, Math.round(params.scale * 2));
  const initState = new Uint8Array(size);
  for (let cy = 0; cy < bh; cy += clusterSize) {
    for (let cx = 0; cx < bw; cx += clusterSize) {
      const on = rng.random() < fillRatio ? 1 : 0;
      for (let dy = 0; dy < clusterSize && cy + dy < bh; dy++) {
        for (let dx = 0; dx < clusterSize && cx + dx < bw; dx++) {
          initState[(cy + dy) * bw + (cx + dx)] = on;
        }
      }
    }
  }

  const blendSeed = rng.random();
  const birthMin = 3, birthMax = 3, surviveMin = 2, surviveMax = 3;

  // Scale controls max steps: lower scale → fewer steps (finer grain stays), higher → more evolution
  const maxSteps = Math.max(1, Math.round(3 + params.scale * 3)); // 4–6 typical
  const continuous = loopTriangle(t) * maxSteps;
  const stepsLo = Math.floor(continuous);
  const stepsHi = Math.ceil(continuous);
  const frac = continuous - stepsLo;

  const state = new Uint8Array(initState);
  const buf = new Uint8Array(size);
  let snapshotLo: Uint8Array | null = null;

  if (stepsLo === 0) snapshotLo = new Uint8Array(state);

  for (let s = 0; s < stepsHi; s++) {
    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        let neighbors = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = (x + dx + bw) % bw;
            const ny = (y + dy + bh) % bh;
            neighbors += state[ny * bw + nx];
          }
        }
        const alive = state[y * bw + x];
        if (alive) {
          buf[y * bw + x] = neighbors >= surviveMin && neighbors <= surviveMax ? 1 : 0;
        } else {
          buf[y * bw + x] = neighbors >= birthMin && neighbors <= birthMax ? 1 : 0;
        }
      }
    }
    state.set(buf);
    if (s + 1 === stepsLo) snapshotLo = new Uint8Array(state);
  }

  if (!snapshotLo) snapshotLo = state;
  const snapshotHi = state;

  for (let i = 0; i < size; i++) {
    if (snapshotLo[i] === snapshotHi[i]) {
      bitmap[i] = snapshotLo[i];
    } else {
      const px = i % bw;
      const py = (i / bw) | 0;
      const dither = ((px * 13 + py * 7 + (blendSeed * 256) | 0) & 0xff) / 256;
      bitmap[i] = frac > dither ? snapshotHi[i] : snapshotLo[i];
    }
  }
}
