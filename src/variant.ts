import { createPRNG } from './prng';

export type RuleType = 'noise' | 'dither' | 'automata' | 'reaction' | 'lines' | 'streak' | 'columns' | 'gradient' | 'dots' | 'checker';

export interface EventDef {
  /** Normalised time in [0, 1) when event fires */
  t: number;
  /** Which rect index (mod actual rect count) */
  rectIndex: number;
  /** Event type */
  type: 'invert' | 'scanline' | 'ruleSwap';
}

export interface VariantConfig {
  seed: number;
  gridRes: 64 | 96 | 128 | 192;
  subdivDepth: number;
  minRectCells: number;
  activeRules: RuleType[];
  periodMs: number;
  events: EventDef[];
  flickerProb: number;
  invertProb: number;
  stopProb: number;
  calm: boolean;
}

const GRID_OPTIONS: (64 | 96 | 128 | 192)[] = [64, 96, 128, 192];

// Organic/chaotic rules
const ORGANIC_RULES: RuleType[] = ['noise', 'streak', 'columns', 'gradient', 'automata', 'reaction'];
// Geometric/regular rules
const GEOMETRIC_RULES: RuleType[] = ['lines', 'dither', 'dots', 'checker'];
const ALL_RULES: RuleType[] = [...ORGANIC_RULES, ...GEOMETRIC_RULES];

/**
 * Deterministically derive a complete variant config from a seed (0–255).
 * Every variant gets a mix of organic and geometric rules for contrast.
 */
/** Calm rules — simple, sparse, geometric */
const CALM_RULES: RuleType[] = ['lines', 'dots', 'gradient', 'noise'];

export function getVariantConfig(seed: number): VariantConfig {
  const rng = createPRNG(seed * 7919 + 31); // spread seeds

  // ~20% chance of a calm interstitial
  const isCalm = rng.random() < 0.20;

  if (isCalm) {
    const rule = rng.randChoice(CALM_RULES);
    return {
      seed,
      gridRes: GRID_OPTIONS[rng.randInt(0, 4)],
      subdivDepth: 0, // 0 = single full-canvas rect
      minRectCells: 999, // prevent any splitting
      activeRules: [rule],
      periodMs: rng.randInt(10000, 20001), // very slow
      events: [],
      flickerProb: 0,
      invertProb: 0,
      stopProb: 1.0, // always stop — no splitting at all
      calm: true,
    };
  }

  // Pick a dominant rule — alternate between organic and geometric families
  const family = (seed >> 5) & 7; // 0–7, 8 families
  const familyRules: RuleType[] = [
    'noise', 'lines', 'streak', 'dots', 'columns', 'checker', 'gradient', 'dither',
  ];
  const dominantRule = familyRules[family % familyRules.length];

  // Build active rules: always include dominant + at least 1 geometric + 1 organic
  const ruleCount = rng.randInt(4, 7); // 4–6 active rules

  // Ensure mix: pick 1–2 from each category (excluding dominant)
  const geoPool = GEOMETRIC_RULES.filter(r => r !== dominantRule);
  const orgPool = ORGANIC_RULES.filter(r => r !== dominantRule);
  rng.shuffle(geoPool);
  rng.shuffle(orgPool);

  const geoCount = rng.randInt(1, 3); // 1–2 geometric
  const orgCount = Math.min(orgPool.length, ruleCount - 1 - geoCount);
  const activeRules: RuleType[] = [
    dominantRule,
    ...geoPool.slice(0, geoCount),
    ...orgPool.slice(0, orgCount),
  ];
  rng.shuffle(activeRules);

  // Grid resolution — weighted by seed bits
  const gridRes = GRID_OPTIONS[rng.randInt(0, 4)];

  // Subdivision
  const subdivDepth = rng.randInt(3, 7); // 3–6
  const minRectCells = rng.randInt(2, 6); // 2–5
  const stopProb = rng.randFloat(0.05, 0.3);

  // Timing
  const periodMs = rng.randInt(6000, 12001); // 6–12s

  // Events (1–3 per loop, subtle)
  const eventCount = rng.randInt(1, 4);
  const events: EventDef[] = [];
  // Bias toward scanline/ruleSwap; invert is rarer
  const eventTypes: EventDef['type'][] = ['scanline', 'ruleSwap', 'ruleSwap', 'scanline', 'invert'];
  for (let i = 0; i < eventCount; i++) {
    events.push({
      t: rng.random(),
      rectIndex: rng.randInt(0, 100), // mod'd at runtime
      type: rng.randChoice(eventTypes),
    });
  }
  events.sort((a, b) => a.t - b.t);

  const flickerProb = 0;
  const invertProb = 0;

  return {
    seed,
    gridRes,
    subdivDepth,
    minRectCells,
    activeRules,
    periodMs,
    events,
    flickerProb,
    invertProb,
    stopProb,
    calm: false,
  };
}
