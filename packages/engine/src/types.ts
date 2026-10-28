export type MemberId = string;

/** Local calendar date in WAT, `YYYY-MM-DD`. Never derived from the system clock inside the engine. */
export type LocalDate = string;

export type Category =
  | "fuel"
  | "power"
  | "data"
  | "groceries"
  | "housing"
  | "utilities"
  | "food"
  | "transport"
  | "tickets"
  | "stay"
  | "other";

export interface Expense {
  id: string;
  date: LocalDate;
  amountMinor: bigint;
  currency: "NGN";
  payerId: MemberId;
  category: Category;
  description: string;
  /** Whole-number weights: basis points summing to 10_000, or one share per person for an exact equal split. */
  split: Record<MemberId, number>;
}

export interface Fact {
  label: string;
  value: string;
}

export interface Explanation {
  summary: string;
  facts: Fact[];
  formula: string;
  threshold: string;
  evidenceExpenseIds: string[];
}
