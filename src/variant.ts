import { createPRNG } from './prng';

export type RuleType = 'noise' | 'dither' | 'automata' | 'reaction' | 'lines' | 'streak' | 'columns' | 'gradient';

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
}

const GRID_OPTIONS: (64 | 96 | 128 | 192)[] = [64, 96, 128, 192];
const ALL_RULES: RuleType[] = ['noise', 'dither', 'automata', 'reaction', 'lines', 'streak', 'columns', 'gradient'];

/**
 * Deterministically derive a complete variant config from a seed (0–255).
 * Seeds are grouped into 4 families of 64, each biased toward a dominant rule.
 */
export function getVariantConfig(seed: number): VariantConfig {
  const rng = createPRNG(seed * 7919 + 31); // spread seeds

  // Family determines dominant rule
  const family = (seed >> 6) & 3; // 0–3
  // Map families to dominant rules, cycling through all 8
  const familyRules: RuleType[] = ['noise', 'streak', 'columns', 'gradient'];
  const dominantRule = familyRules[family];

  // Pick 3–5 active rules, always including the dominant one
  const others = ALL_RULES.filter((r) => r !== dominantRule);
  rng.shuffle(others);
  const ruleCount = rng.randInt(3, 6); // 3–5
  const activeRules: RuleType[] = [dominantRule, ...others.slice(0, ruleCount - 1)];

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
  };
}
