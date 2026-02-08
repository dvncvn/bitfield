import type { EventDef } from './variant';

/**
 * Check whether an invert-pulse event is active at time t.
 * Pulse lasts for `duration` (normalised) centered on event.t.
 */
export function isInvertActive(event: EventDef, t: number, duration = 0.03): boolean {
  const half = duration / 2;
  const d = Math.abs(wrapDist(t, event.t));
  return d < half;
}

/**
 * Scanline progress: returns normalised y-position [0,1] of the scanline,
 * or -1 if the scanline event isn't active at time t.
 * Active for `duration` around event.t.
 */
export function scanlineY(event: EventDef, t: number, duration = 0.08): number {
  const half = duration / 2;
  const d = signedWrapDist(t, event.t);
  if (Math.abs(d) > half) return -1;
  return (d + half) / duration; // 0 → 1
}

/**
 * Rule swap: returns true if we should be using the swapped rule at time t.
 * Stays swapped for `duration` after event.t.
 */
export function isRuleSwapped(event: EventDef, t: number, duration = 0.15): boolean {
  const d = signedWrapDist(t, event.t);
  return d >= 0 && d < duration;
}

/** Shortest signed distance on a [0,1) loop */
function signedWrapDist(a: number, b: number): number {
  let d = a - b;
  if (d > 0.5) d -= 1;
  if (d < -0.5) d += 1;
  return d;
}

/** Shortest unsigned distance on a [0,1) loop */
function wrapDist(a: number, b: number): number {
  return Math.abs(signedWrapDist(a, b));
}

/**
 * Apply scanline flip to a bitmap row.
 * Flips all pixels in the row corresponding to scanline position.
 */
export function applyScanline(
  bitmap: Uint8Array,
  bw: number,
  bh: number,
  normalizedY: number,
): void {
  const row = Math.floor(normalizedY * bh);
  if (row < 0 || row >= bh) return;
  const start = row * bw;
  for (let x = 0; x < bw; x++) {
    bitmap[start + x] ^= 1;
  }
}

/** Invert entire bitmap */
export function invertBitmap(bitmap: Uint8Array): void {
  for (let i = 0; i < bitmap.length; i++) {
    bitmap[i] ^= 1;
  }
}
