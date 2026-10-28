import { addDays, daysBetween } from "../dates.ts";
import { cv, lowerMedian, lowerMedianBig, round } from "../stats.ts";
import type { LocalDate } from "../types.ts";

export type Cadence = "weekly" | "biweekly" | "monthly";

export interface SeriesPoint {
  id: string;
  date: LocalDate;
  amountMinor: bigint;
}

export interface Recurrence {
  cadence: Cadence;
  nextExpectedDate: LocalDate;
  expectedAmountMinor: bigint;
  confidence: number;
  shown: boolean;
  medianGapDays: number;
  cvGap: number;
  cvAmount: number;
  n: number;
}

const MIN_POINTS = 3;
const MAX_CV_GAP = 0.25;
const MAX_CV_AMOUNT = 0.2;
const SHOW_CONFIDENCE = 0.5;

function cadenceFor(medianGap: number): Cadence | null {
  if (medianGap >= 5 && medianGap <= 9) return "weekly";
  if (medianGap >= 12 && medianGap <= 16) return "biweekly";
  if (medianGap >= 26 && medianGap <= 34) return "monthly";
  return null;
}

/** R2: detects a recurring series. `points` are one (category, payee-key) series. */
export function detectRecurrence(points: readonly SeriesPoint[]): Recurrence | null {
  if (points.length < MIN_POINTS) return null;
  const sorted = [...points].sort((a, b) => (a.date === b.date ? (a.id < b.id ? -1 : 1) : a.date < b.date ? -1 : 1));

  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) gaps.push(daysBetween(sorted[i - 1]!.date, sorted[i]!.date));

  const medianGap = lowerMedian(gaps);
  const cadence = cadenceFor(medianGap);
  if (!cadence) return null;

  const cvGap = round(cv(gaps), 4);
  const cvAmount = round(cv(sorted.map((p) => Number(p.amountMinor))), 4);
  if (cvGap > MAX_CV_GAP || cvAmount > MAX_CV_AMOUNT) return null;

  const n = sorted.length;
  const confidence = round(Math.min(1, n / 6) * (1 - cvGap) * (1 - cvAmount), 2);
  return {
    cadence,
    nextExpectedDate: addDays(sorted[n - 1]!.date, medianGap),
    expectedAmountMinor: lowerMedianBig(sorted.map((p) => p.amountMinor)),
    confidence,
    shown: confidence >= SHOW_CONFIDENCE,
    medianGapDays: medianGap,
    cvGap,
    cvAmount,
    n,
  };
}
