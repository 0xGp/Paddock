export function lowerMedian(values: readonly number[]): number {
  if (values.length === 0) throw new Error("lowerMedian of empty list");
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[(sorted.length - 1) >> 1]!;
}

export function lowerMedianBig(values: readonly bigint[]): bigint {
  if (values.length === 0) throw new Error("lowerMedian of empty list");
  const sorted = [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return sorted[(sorted.length - 1) >> 1]!;
}

export function mean(values: readonly number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Population standard deviation. */
export function stdev(values: readonly number[]): number {
  const m = mean(values);
  return Math.sqrt(mean(values.map((v) => (v - m) ** 2)));
}

/** Coefficient of variation; 0 when the mean is 0. */
export function cv(values: readonly number[]): number {
  const m = mean(values);
  return m === 0 ? 0 : stdev(values) / m;
}

/** Fixed-decimal rounding so float noise never changes a comparison or a hash. */
export function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
