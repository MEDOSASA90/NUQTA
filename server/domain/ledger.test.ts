import { describe, expect, it } from "vitest";
import { calculateBalance, isDuplicateEntry } from "./ledger.js";
import type { LedgerEntry } from "./types.js";

const entry = (id: number, eventId: number, payerNuqtaId: string, hostNuqtaId: string, amount: number): LedgerEntry => ({
  id,
  eventId,
  payerNuqtaId,
  hostNuqtaId,
  amount,
  occurredAt: new Date("2026-01-01T10:00:00Z"),
  recordedByUserId: 1,
  notificationSentAt: null,
  voidedAt: null,
});

describe("append-only ledger rules", () => {
  it("computes partial settlement and interaction count", () => {
    const entries = [entry(1, 10, "A", "B", 1000), entry(2, 11, "B", "A", 400)];
    expect(calculateBalance(entries, "A", "B")).toEqual({ creditorNuqtaId: "A", debtorNuqtaId: "B", netAmount: 600, interactions: 2 });
  });

  it("ignores voided entries", () => {
    const removed = { ...entry(1, 10, "A", "B", 1000), voidedAt: new Date() };
    expect(calculateBalance([removed], "A", "B").netAmount).toBe(0);
  });

  it("detects duplicate active entries for the same event and person", () => {
    const entries = [entry(1, 10, "A", "B", 1000)];
    expect(isDuplicateEntry(entries, 10, "A")).toBe(true);
    expect(isDuplicateEntry(entries, 11, "A")).toBe(false);
  });
});

