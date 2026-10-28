import type { LocalDate } from "./types.ts";

const MS_PER_DAY = 86_400_000;

function parse(date: LocalDate): [number, number, number] {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error(`Invalid LocalDate: ${date}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function dayNumber(date: LocalDate): number {
  const [y, m, d] = parse(date);
  return Date.UTC(y, m - 1, d) / MS_PER_DAY;
}

export function fromDayNumber(day: number): LocalDate {
  return new Date(day * MS_PER_DAY).toISOString().slice(0, 10);
}

export function addDays(date: LocalDate, days: number): LocalDate {
  return fromDayNumber(dayNumber(date) + days);
}

export function daysBetween(from: LocalDate, to: LocalDate): number {
  return dayNumber(to) - dayNumber(from);
}
