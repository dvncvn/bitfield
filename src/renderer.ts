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
import { fillDots } from './rules/dots';
import { fillChecker } from './rules/checker';
import {
  isInvertActive,
  scanlineY,
  isRuleSwapped,
  applyScanline,
  invertBitmap,
} from './events';
import { renderCalm } from './calm';

/* ── Colour helpers ── */

/** Convert "#RRGGBB" hex string to ABGR packed uint32 */
export function hexToABGR(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0xFF000000 | (b << 16) | (g << 8) | r;
}

/* ── Rect state ── */

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
  fgColor: number;  // ABGR packed
  bgColor: number;  // ABGR packed
  eventsEnabled: boolean;
  mouseEnabled: boolean;
  mouseGX: number;  // grid-space mouse coords, -1 = inactive
  mouseGY: number;
  mousePressed: boolean;
  mouseRadius: number;   // fraction of short side (0.05–0.5)
  mouseStrength: number; // push strength (0.1–2)
  zoom: number;          // 1.0 = normal, >1 = zoomed in, <1 = zoomed out
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
  dots: fillDots,
  checker: fillChecker,
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
  if (opts.subdivOverride !== undefined && !config.calm) {
    (config as any).subdivDepth = opts.subdivOverride;
  }
  if (opts.periodOverride !== undefined) {
    (config as any).periodMs = opts.periodOverride;
  }

  const cssW = window.innerWidth;
  const cssH = window.innerHeight;

  // Grid cells are square. gridRes controls the short axis cell count.
  const shortSide = Math.min(cssW, cssH);
  const gridStep = Math.max(1, Math.floor(shortSide / config.gridRes));
  const gridW = Math.floor(cssW / gridStep);
  const gridH = Math.floor(cssH / gridStep);

  // Canvas at grid resolution — CSS image-rendering: pixelated handles upscale
  canvas.width = gridW;
  canvas.height = gridH;

  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

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

  const totalPixels = gridW * gridH;
  const gridBuffer = new Uint8Array(totalPixels);
  const warpBuffer = new Uint8Array(totalPixels);
  const imageData = ctx.createImageData(canvas.width, canvas.height);

  return {
    config, rects, canvas, ctx,
    gridBuffer, warpBuffer,
    gridW, gridH, imageData,
    cssW, cssH, gridStep, dpr: 1,
    playing: true,
    speed: 1,
    noiseAmount: 0.5,
    scale: 1.0,
    density: 0.5,
    warp: 0,
    fgColor: 0xFFFFFFFF,  // white
    bgColor: 0xFF000000,  // black
    eventsEnabled: true,
    mouseEnabled: true,
    mouseGX: -1,
    mouseGY: -1,
    mousePressed: false,
    mouseRadius: 0.18,
    mouseStrength: 0.7,
    zoom: 1.0,
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
  const { ctx, config, rects, gridBuffer, warpBuffer, gridW, gridH } = state;

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

  if (config.calm) {
    // Calm interstitial — simple geometric composition, bypass BSP
    renderCalm(gridBuffer, gridW, gridH, config.seed, t);
  } else {
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
        const srcRow = y * rs.bw;
        const dstRow = (ry + y) * gridW + rx;
        for (let x = 0; x < rs.bw; x++) {
          gridBuffer[dstRow + x] = rs.bitmap[srcRow + x];
        }
      }
    }
  }

  // Apply scanning warp
  applyWarp(gridBuffer, warpBuffer, gridW, gridH, t, state.warp, config.seed);
  const finalBuffer = state.warp > 0 ? warpBuffer : gridBuffer;

  // Blit with zoom + optional mouse distortion
  const { imageData } = state;
  const data32 = new Uint32Array(imageData.data.buffer);
  const fg = state.fgColor;
  const bg = state.bgColor;

  const zoom = state.zoom;
  const cx = gridW * 0.5;
  const cy = gridH * 0.5;
  const invZ = 1 / zoom;

  const mx = state.mouseGX;
  const my = state.mouseGY;
  const mouseActive = state.mouseEnabled && mx >= 0 && my >= 0;

  if (!mouseActive && zoom === 1) {
    // Fast path — no zoom, no mouse
    const totalPixels = gridW * gridH;
    for (let i = 0; i < totalPixels; i++) {
      data32[i] = finalBuffer[i] ? fg : bg;
    }
  } else {
    const radius = mouseActive ? Math.min(gridW, gridH) * state.mouseRadius : 0;
    const r2 = radius * radius;
    const strength = state.mouseStrength;
    const direction = state.mousePressed ? 1 : -1;

    for (let gy = 0; gy < gridH; gy++) {
      for (let gx = 0; gx < gridW; gx++) {
        // Zoom: map output pixel back to source
        let sx = cx + (gx - cx) * invZ;
        let sy = cy + (gy - cy) * invZ;

        // Mouse distortion (applied in zoomed space)
        if (mouseActive) {
          const dx = gx - mx;
          const dy = gy - my;
          const d2 = dx * dx + dy * dy;
          if (d2 < r2 && d2 > 0) {
            const dist = Math.sqrt(d2);
            const falloff = 1 - dist / radius;
            const push = falloff * falloff * strength * radius * direction;
            sx += (dx / dist) * push * invZ;
            sy += (dy / dist) * push * invZ;
          }
        }

        const ix = Math.round(sx);
        const iy = Math.round(sy);
        if (ix < 0 || ix >= gridW || iy < 0 || iy >= gridH) {
          data32[gy * gridW + gx] = bg;
        } else {
          data32[gy * gridW + gx] = finalBuffer[iy * gridW + ix] ? fg : bg;
        }
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
}
