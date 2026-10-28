import type { MemWal, RecallParams, RecallResult } from "@mysten-incubation/memwal";

/** The slice of MemWal SplitSense depends on; `MemWalMock` satisfies it too. */
export type MemoryClient = Pick<MemWal, "rememberBulk" | "getRememberBulkStatus" | "restore" | "listNamespaces" | "health"> & Recaller;

export interface Recaller {
  recall(params: RecallParams): Promise<RecallResult>;
}
