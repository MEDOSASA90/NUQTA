import type { Balance, LedgerEntry } from "./types.js";

export function calculateBalance(
  entries: readonly LedgerEntry[],
  firstNuqtaId: string,
  secondNuqtaId: string,
): Balance {
  let netAmount = 0;
  let interactions = 0;
  for (const entry of entries) {
    if (entry.voidedAt !== null) continue;
    const firstPaid = entry.payerNuqtaId === firstNuqtaId && entry.hostNuqtaId === secondNuqtaId;
    const secondPaid = entry.payerNuqtaId === secondNuqtaId && entry.hostNuqtaId === firstNuqtaId;
    if (!firstPaid && !secondPaid) continue;
    netAmount += firstPaid ? entry.amount : -entry.amount;
    interactions += 1;
  }
  return {
    creditorNuqtaId: netAmount > 0 ? firstNuqtaId : netAmount < 0 ? secondNuqtaId : null,
    debtorNuqtaId: netAmount > 0 ? secondNuqtaId : netAmount < 0 ? firstNuqtaId : null,
    netAmount: Math.abs(netAmount),
    interactions,
  };
}

export function isDuplicateEntry(
  entries: readonly LedgerEntry[],
  eventId: number,
  payerNuqtaId: string,
): boolean {
  return entries.some(
    (entry) => entry.eventId === eventId && entry.payerNuqtaId === payerNuqtaId && entry.voidedAt === null,
  );
}

export function assertValidAmount(amount: number): void {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error("Amount must be a positive safe integer");
  }
}

