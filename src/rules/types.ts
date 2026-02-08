/** Shared parameters passed from UI to all fill rules */
export interface FillParams {
  /** Noise influence amount (0–1) */
  noiseAmount: number;
  /** Pattern scale: <1 = finer detail, >1 = chunkier (default 1) */
  scale: number;
  /** Density / threshold bias: 0 = mostly black, 1 = mostly white (default 0.5) */
  density: number;
}
