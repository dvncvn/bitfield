import { loopTriangle } from '../loop';
import type { Rect } from '../subdivide';
import type { PRNGHelper } from '../prng';
import type { FillParams } from './types';

/**
 * Cheap reaction-diffusion fill: run diffusion iterations, blend
 * between adjacent iteration counts for smooth evolution.
 * Scale controls iteration depth; density controls initial concentration.
 */
export function fillReaction(
  bitmap: Uint8Array,
  bw: number,
  bh: number,
  _rect: Rect,
  t: number,
  rng: PRNGHelper,
  params: FillParams,
): void {
  const size = bw * bh;

  const fillRatio = 0.1 + params.density * 0.4; // 0.1–0.5
  // Cluster initial concentration into blobs proportional to scale
  const clusterSize = Math.max(1, Math.round(params.scale * 2));
  const initU = new Float32Array(size);
  for (let cy = 0; cy < bh; cy += clusterSize) {
    for (let cx = 0; cx < bw; cx += clusterSize) {
      const val = rng.random() < fillRatio ? 1.0 : 0.0;
      for (let dy = 0; dy < clusterSize && cy + dy < bh; dy++) {
        for (let dx = 0; dx < clusterSize && cx + dx < bw; dx++) {
          initU[(cy + dy) * bw + (cx + dx)] = val;
        }
      }
    }
  }

  const blendSeed = rng.random();

  const totalIter = Math.max(1, Math.round(3 + params.scale * 3));
  const continuous = loopTriangle(t) * totalIter;
  const iterLo = Math.floor(continuous);
  const iterHi = Math.ceil(continuous);
  const frac = continuous - iterLo;

  const u = new Float32Array(initU);
  const tmp = new Float32Array(size);
  const diffRate = 0.2;

  let snapshotLo: Float32Array | null = null;
  if (iterLo === 0) snapshotLo = new Float32Array(u);

  for (let iter = 0; iter < iterHi; iter++) {
    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        let sum = 0;
        let count = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = (x + dx + bw) % bw;
            const ny = (y + dy + bh) % bh;
            sum += u[ny * bw + nx];
            count++;
          }
        }
        const avg = sum / count;
        const val = u[y * bw + x];
        const reacted = val + diffRate * (avg - val) + 0.02 * (val * (1 - val) * (val - 0.3));
        tmp[y * bw + x] = Math.max(0, Math.min(1, reacted));
      }
    }
    u.set(tmp);
    if (iter + 1 === iterLo) snapshotLo = new Float32Array(u);
  }

  if (!snapshotLo) snapshotLo = u;

  for (let i = 0; i < size; i++) {
    const vLo = snapshotLo[i] > 0.5 ? 1 : 0;
    const vHi = u[i] > 0.5 ? 1 : 0;
    if (vLo === vHi) {
      bitmap[i] = vLo;
    } else {
      const px = i % bw;
      const py = (i / bw) | 0;
      const dither = ((px * 13 + py * 7 + (blendSeed * 256) | 0) & 0xff) / 256;
      bitmap[i] = frac > dither ? vHi : vLo;
    }
  }
}
