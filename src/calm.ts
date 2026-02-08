/**
 * Calm interstitials — simple geometric compositions.
 * Bypasses the BSP subdivision system entirely.
 */

import { createPRNG } from './prng';

export type CalmType = 'circle' | 'triangle' | 'rect' | 'dotgrid' | 'hlines' | 'vlines' | 'cross' | 'ring';

const CALM_TYPES: CalmType[] = ['circle', 'triangle', 'rect', 'dotgrid', 'hlines', 'vlines', 'cross', 'ring'];

export function renderCalm(
  buffer: Uint8Array,
  w: number,
  h: number,
  seed: number,
  t: number,
): void {
  buffer.fill(0);

  const rng = createPRNG(seed * 3571 + 17);
  const type = CALM_TYPES[rng.randInt(0, CALM_TYPES.length)];

  // Very subtle drift — most are nearly static
  const drift = Math.sin(t * Math.PI * 2) * 0.008;

  const cx = w * 0.5;
  const cy = h * 0.5;
  const shortSide = Math.min(w, h);

  switch (type) {
    case 'circle': {
      const r = shortSide * (0.15 + rng.random() * 0.2);
      const r2 = r * r;
      for (let y = 0; y < h; y++) {
        const dy = y - cy + drift * h;
        for (let x = 0; x < w; x++) {
          const dx = x - cx;
          if (dx * dx + dy * dy <= r2) buffer[y * w + x] = 1;
        }
      }
      break;
    }

    case 'ring': {
      const outerR = shortSide * (0.18 + rng.random() * 0.15);
      const thickness = shortSide * (0.01 + rng.random() * 0.02);
      const innerR = outerR - thickness;
      const or2 = outerR * outerR;
      const ir2 = innerR * innerR;
      for (let y = 0; y < h; y++) {
        const dy = y - cy + drift * h;
        for (let x = 0; x < w; x++) {
          const dx = x - cx;
          const d2 = dx * dx + dy * dy;
          if (d2 <= or2 && d2 >= ir2) buffer[y * w + x] = 1;
        }
      }
      break;
    }

    case 'triangle': {
      const size = shortSide * (0.2 + rng.random() * 0.15);
      // Equilateral triangle centered
      const tipY = cy - size * 0.57 + drift * h;
      const baseY = cy + size * 0.43 + drift * h;
      const baseHalf = size * 0.5;
      for (let y = 0; y < h; y++) {
        if (y < tipY || y > baseY) continue;
        const progress = (y - tipY) / (baseY - tipY);
        const halfW = baseHalf * progress;
        const left = cx - halfW;
        const right = cx + halfW;
        for (let x = 0; x < w; x++) {
          if (x >= left && x <= right) buffer[y * w + x] = 1;
        }
      }
      break;
    }

    case 'rect': {
      const rw = shortSide * (0.15 + rng.random() * 0.25);
      const rh = shortSide * (0.08 + rng.random() * 0.15);
      const x0 = Math.floor(cx - rw * 0.5);
      const y0 = Math.floor(cy - rh * 0.5 + drift * h);
      const x1 = Math.floor(cx + rw * 0.5);
      const y1 = Math.floor(cy + rh * 0.5 + drift * h);
      for (let y = Math.max(0, y0); y <= Math.min(h - 1, y1); y++) {
        for (let x = Math.max(0, x0); x <= Math.min(w - 1, x1); x++) {
          buffer[y * w + x] = 1;
        }
      }
      break;
    }

    case 'dotgrid': {
      const spacing = Math.floor(shortSide * (0.04 + rng.random() * 0.06));
      const offsetX = drift * w * 2;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const gx = Math.round((x + offsetX) / spacing) * spacing - offsetX;
          const gy = Math.round(y / spacing) * spacing;
          const dx = x + offsetX - gx;
          const dy = y - gy;
          if (dx * dx + dy * dy <= 1.5) buffer[y * w + x] = 1;
        }
      }
      break;
    }

    case 'hlines': {
      const spacing = Math.floor(shortSide * (0.04 + rng.random() * 0.08));
      const offset = Math.floor(drift * h * 3);
      for (let y = 0; y < h; y++) {
        if (((y + offset) % spacing) === 0) {
          for (let x = 0; x < w; x++) {
            buffer[y * w + x] = 1;
          }
        }
      }
      break;
    }

    case 'vlines': {
      const spacing = Math.floor(shortSide * (0.04 + rng.random() * 0.08));
      const offset = Math.floor(drift * w * 3);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (((x + offset) % spacing) === 0) buffer[y * w + x] = 1;
        }
      }
      break;
    }

    case 'cross': {
      const thickness = Math.max(1, Math.floor(shortSide * (0.005 + rng.random() * 0.01)));
      const halfT = thickness * 0.5;
      const yOff = drift * h;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const dx = Math.abs(x - cx);
          const dy = Math.abs(y - cy + yOff);
          if (dx <= halfT || dy <= halfT) buffer[y * w + x] = 1;
        }
      }
      break;
    }
  }
}
