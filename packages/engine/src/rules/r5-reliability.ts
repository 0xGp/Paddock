import { clamp, lowerMedian, round } from "../stats.ts";

export type ReliabilityLabel = "fast" | "steady" | "slow";

export interface Reliability {
  medianDelay: number;
  ewmaDelay: number;
  score: number;
  label: ReliabilityLabel;
  history: number[];
}

const ALPHA = 0.3;

/** R5: `delaysDays` are settle delays in settlement order. The EWMA is seeded with the first delay. */
export function scoreReliability(delaysDays: readonly number[]): Reliability | null {
  if (delaysDays.length === 0) return null;
  const history: number[] = [];
  let ewma = delaysDays[0]!;
  history.push(round(ewma, 4));
  for (const delay of delaysDays.slice(1)) {
    ewma = ALPHA * delay + (1 - ALPHA) * ewma;
    history.push(round(ewma, 4));
  }
  const ewmaDelay = round(ewma, 4);
  const score = Math.round(clamp(100 - 8 * ewmaDelay, 0, 100));
  return {
    medianDelay: lowerMedian(delaysDays),
    ewmaDelay,
    score,
    label: score >= 80 ? "fast" : score >= 50 ? "steady" : "slow",
    history,
  };
}
