import fixture from "../../../fixtures/lagos-flat.json";
import type { Category, Expense, Ledger } from "../src/index.ts";

export const asOf = fixture.now;

export const ledger: Ledger = {
  members: fixture.members,
  settlements: fixture.settlements,
  expenses: fixture.expenses.map(
    (e): Expense => ({ ...e, amountMinor: BigInt(e.amountMinor), currency: "NGN", category: e.category as Category }),
  ),
};
