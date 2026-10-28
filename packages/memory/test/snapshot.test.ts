import { describe, expect, it } from "vitest";
import { readSnapshot, refreshSnapshot, type Sql } from "../src/index.ts";

const ns = "ss_g_0123456789abcdef";

function fakeDb(): Sql {
  const rows = new Map<string, Record<string, unknown>>();
  return {
    async query(text, params = []) {
      const [namespace, ...rest] = params as [string, ...unknown[]];
      if (text.startsWith("SELECT")) return { rows: rows.has(namespace) ? [rows.get(namespace)] : [] };
      if (text.startsWith("UPDATE")) {
        if (rows.has(namespace)) rows.set(namespace, { ...rows.get(namespace), error: rest[0], attempted_at: new Date() });
        return { rows: [] };
      }
      const [recalled, recall_ms, relayer_count, degraded, error] = rest;
      const now = new Date();
      rows.set(namespace, { namespace, recalled: JSON.parse(recalled as string), recalled_at: now, recall_ms, relayer_count, degraded, error, attempted_at: now });
      return { rows: [] };
    },
  };
}

const memory = (kind: string, n: number) => ({ text: `SPLITSENSE v1 | kind=${kind} | #${n}`, blob_id: `${kind}-${n}`, created_at: null });
const client = (failing: string[] = []) => ({
  async recall({ query }: { query: string }) {
    const kind = /kind=(\w+)/.exec(query)![1]!;
    if (failing.includes(kind)) throw new Error(`${kind} timed out`);
    return { results: [memory(kind, 1), memory(kind, 2)], total: 2 } as never;
  },
  async listNamespaces() {
    return { namespaces: [{ name: ns, memory_count: 8 }] } as never;
  },
});

describe("refreshSnapshot", () => {
  it("stores every memory from a complete recall", async () => {
    const db = fakeDb();
    expect(await refreshSnapshot(db, client(), ns)).toMatchObject({ ok: true, recalled: 8, error: null });
    expect((await readSnapshot(db, ns))?.recalled).toHaveLength(8);
  });

  it("keeps what the last snapshot had when part of a refresh fails", async () => {
    const db = fakeDb();
    await refreshSnapshot(db, client(), ns);
    const partial = await refreshSnapshot(db, client(["pattern_snapshot"]), ns);
    expect(partial).toMatchObject({ ok: true, recalled: 8, error: "pattern_snapshot timed out" });
    const snapshot = await readSnapshot(db, ns);
    expect(snapshot?.recalled.map((m) => m.blob_id)).toContain("pattern_snapshot-1");
    expect(snapshot?.degraded).toBe(true);
  });

  it("keeps the previous texts when every recall fails", async () => {
    const db = fakeDb();
    await refreshSnapshot(db, client(), ns);
    const failed = await refreshSnapshot(db, client(["pattern_snapshot", "member_habit", "ledger_checkpoint", "settlement_receipt"]), ns);
    expect(failed.ok).toBe(false);
    expect(await readSnapshot(db, ns)).toMatchObject({ error: expect.stringContaining("timed out"), recalled: expect.arrayContaining([memory("member_habit", 2)]) });
  });
});
