import { createPRNG, type PRNGHelper } from './prng';
import { subdivide, type Rect } from './subdivide';
import { getLoopT, valueNoise2D } from './loop';
import { getVariantConfig, type RuleType, type VariantConfig, type EventDef } from './variant';
import type { FillParams } from './rules/types';
import { fillNoise } from './rules/noise';
import { fillDither } from './rules/dither';
import { fillAutomata } from './rules/automata';
import { fillReaction } from './rules/reaction';
import { fillLines } from './rules/lines';
import { fillStreak } from './rules/streak';
import { fillColumns } from './rules/columns';
import { fillGradient } from './rules/gradient';
import {
  isInvertActive,
  scanlineY,
  isRuleSwapped,
  applyScanline,
  invertBitmap,
} from './events';

interface RectState {
  rect: Rect;
  rule: RuleType;
  altRule: RuleType;
  bw: number;
  bh: number;
  bitmap: Uint8Array;
  rng: PRNGHelper;
  rngSeed: number;
  events: EventDef[];
}

export interface RendererState {
  config: VariantConfig;
  rects: RectState[];
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  gridBuffer: Uint8Array;
  warpBuffer: Uint8Array;
  gridW: number;
  gridH: number;
  imageData: ImageData;
  cssW: number;
  cssH: number;
  gridStep: number;
  dpr: number;
  playing: boolean;
  speed: number;
  noiseAmount: number;
  scale: number;
  density: number;
  warp: number;
  eventsEnabled: boolean;
  startTime: number;
  pauseOffset: number;
}

type FillFn = (
  bitmap: Uint8Array,
  bw: number,
  bh: number,
  rect: Rect,
  t: number,
  rng: PRNGHelper,
  params: FillParams,
) => void;

const FILL_FNS: Record<RuleType, FillFn> = {
  noise: fillNoise,
  dither: fillDither,
  automata: fillAutomata,
  reaction: fillReaction,
  lines: fillLines,
  streak: fillStreak,
  columns: fillColumns,
  gradient: fillGradient,
};

export interface InitOptions {
  gridOverride?: number;
  subdivOverride?: number;
  periodOverride?: number;
}

export function initRenderer(
  canvas: HTMLCanvasElement,
  seed: number,
  opts: InitOptions = {},
): RendererState {
  const config = getVariantConfig(seed);
  if (opts.gridOverride) {
    (config as any).gridRes = opts.gridOverride;
  }
  if (opts.subdivOverride !== undefined) {
    (config as any).subdivDepth = opts.subdivOverride;
  }
  if (opts.periodOverride !== undefined) {
    (config as any).periodMs = opts.periodOverride;
  }

  const dpr = window.devicePixelRatio || 1;
  const cssW = window.innerWidth;
  const cssH = window.innerHeight;

  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';
  canvas.width = cssW * dpr;
  canvas.height = cssH * dpr;

  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  // Grid cells are square. gridRes controls the short axis cell count.
  const shortSide = Math.min(cssW, cssH);
  const gridStep = Math.max(1, Math.floor(shortSide / config.gridRes));
  const gridW = Math.floor(cssW / gridStep);
  const gridH = Math.floor(cssH / gridStep);

  // Subdivide a rectangular region
  const rng = createPRNG(seed);
  const region: Rect = { x: 0, y: 0, w: gridW, h: gridH };
  const subRects = subdivide(region, {
    gridStep: 1,
    minCells: config.minRectCells,
    maxDepth: config.subdivDepth,
    stopProb: config.stopProb,
  }, rng);

  const rects: RectState[] = subRects.map((rect, i) => {
    const ruleIdx = i % config.activeRules.length;
    const rule = config.activeRules[ruleIdx];
    const altRule = config.activeRules[(ruleIdx + 1) % config.activeRules.length];
    const bw = rect.w;
    const bh = rect.h;
    const rngSeed = seed * 1000 + i * 37;
    const events = config.events.filter(
      (e) => e.rectIndex % subRects.length === i,
    );
    return {
      rect, rule, altRule, bw, bh,
      bitmap: new Uint8Array(bw * bh),
      rng: createPRNG(rngSeed),
      rngSeed, events,
    };
  });

  const gridBuffer = new Uint8Array(gridW * gridH);
  const warpBuffer = new Uint8Array(gridW * gridH);
  const imageData = ctx.createImageData(canvas.width, canvas.height);

  return {
    config, rects, canvas, ctx,
    gridBuffer, warpBuffer, gridW, gridH, imageData,
    cssW, cssH, gridStep, dpr,
    playing: true,
    speed: 1,
    noiseAmount: 0.5,
    scale: 1.0,
    density: 0.5,
    warp: 0,
    eventsEnabled: true,
    startTime: performance.now(),
    pauseOffset: 0,
  };
}

/**
 * Scanning warp: a band of horizontal displacement that sweeps
 * vertically through the grid, snapping in and out.
 */
function applyWarp(
  src: Uint8Array,
  dst: Uint8Array,
  gridW: number,
  gridH: number,
  t: number,
  warpAmount: number,
  seed: number,
): void {
  if (warpAmount <= 0) {
    dst.set(src);
    return;
  }

  const maxShift = warpAmount * gridW * 0.35;

  // Scanning band: center sweeps up and down over the loop
  // Band width is ~30% of the grid height
  const bandWidth = gridH * 0.3;
  const bandCenter = (Math.sin(t * Math.PI * 2) * 0.5 + 0.5) * gridH;

  // Secondary band for more complexity
  const band2Center = (Math.cos(t * Math.PI * 2 + 1.0) * 0.5 + 0.5) * gridH;
  const band2Width = gridH * 0.15;

  for (let y = 0; y < gridH; y++) {
    // Distance from band center, normalized to [0,1] within band
    const d1 = Math.abs(y - bandCenter) / (bandWidth * 0.5);
    const d2 = Math.abs(y - band2Center) / (band2Width * 0.5);

    // Sharp falloff: snap in/out with a steep curve
    const intensity1 = d1 < 1 ? Math.pow(1 - d1, 0.3) : 0;
    const intensity2 = d2 < 1 ? Math.pow(1 - d2, 0.3) : 0;
    const intensity = Math.min(1, intensity1 + intensity2 * 0.6);

    if (intensity < 0.01) {
      // No warp — copy row directly
      const rowStart = y * gridW;
      for (let x = 0; x < gridW; x++) {
        dst[rowStart + x] = src[rowStart + x];
      }
      continue;
    }

    // Displacement within the band
    const wave1 = Math.sin(y * 0.03 + t * Math.PI * 2) * 0.7;
    const wave2 = Math.sin(y * 0.11 + t * Math.PI * 6 + 2.0) * 0.3;
    const noise = valueNoise2D(y * 0.025 + seed * 7.1, t * 3 + seed) * 2 - 1;
    const rawShift = (wave1 + wave2 + noise * 0.5) * maxShift * intensity;
    const shift = Math.round(rawShift);

    const rowStart = y * gridW;
    for (let x = 0; x < gridW; x++) {
      let sx = x - shift;
      sx = ((sx % gridW) + gridW) % gridW;
      dst[rowStart + x] = src[rowStart + sx];
    }
  }
}

export function renderFrame(state: RendererState): void {
  const { canvas, ctx, gridStep, dpr, config, rects, gridBuffer, warpBuffer, gridW, gridH } = state;

  const elapsed = state.playing
    ? (performance.now() - state.startTime) * state.speed + state.pauseOffset
    : state.pauseOffset;
  const t = getLoopT(elapsed, config.periodMs);

  const params: FillParams = {
    noiseAmount: state.noiseAmount,
    scale: state.scale,
    density: state.density,
  };

  gridBuffer.fill(0);

  for (const rs of rects) {
    rs.rng = createPRNG(rs.rngSeed);

    let currentRule = rs.rule;
    if (state.eventsEnabled) {
      for (const ev of rs.events) {
        if (ev.type === 'ruleSwap' && isRuleSwapped(ev, t)) {
          currentRule = rs.altRule;
          break;
        }
      }
    }

    FILL_FNS[currentRule](rs.bitmap, rs.bw, rs.bh, rs.rect, t, rs.rng, params);

    if (state.eventsEnabled) {
      for (const ev of rs.events) {
        if (ev.type === 'invert' && isInvertActive(ev, t)) {
          invertBitmap(rs.bitmap);
        }
        if (ev.type === 'scanline') {
          const sy = scanlineY(ev, t);
          if (sy >= 0) applyScanline(rs.bitmap, rs.bw, rs.bh, sy);
        }
      }
    }

    const rx = rs.rect.x;
    const ry = rs.rect.y;
    for (let y = 0; y < rs.bh; y++) {
      for (let x = 0; x < rs.bw; x++) {
        gridBuffer[(ry + y) * gridW + (rx + x)] = rs.bitmap[y * rs.bw + x];
      }
    }
  }

  // Apply scanning warp
  applyWarp(gridBuffer, warpBuffer, gridW, gridH, t, state.warp, config.seed);
  const finalBuffer = state.warp > 0 ? warpBuffer : gridBuffer;

  // Blit to canvas
  const pxWidth = canvas.width;
  const pxHeight = canvas.height;
  const { imageData } = state;
  const data = imageData.data;

  // Clear to black with alpha
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 0;
    data[i + 1] = 0;
    data[i + 2] = 0;
    data[i + 3] = 255;
  }

  const pxStep = Math.round(gridStep * dpr);

  for (let gy = 0; gy < gridH; gy++) {
    for (let gx = 0; gx < gridW; gx++) {
      if (!finalBuffer[gy * gridW + gx]) continue;
      const px0 = gx * pxStep;
      const py0 = gy * pxStep;
      const px1 = px0 + pxStep;
      const py1 = py0 + pxStep;
      for (let py = py0; py < py1 && py < pxHeight; py++) {
        const rowOff = py * pxWidth * 4;
        for (let px = px0; px < px1 && px < pxWidth; px++) {
          const off = rowOff + px * 4;
          data[off] = 255;
          data[off + 1] = 255;
          data[off + 2] = 255;
        }
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
}
