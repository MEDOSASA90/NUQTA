import { and, desc, eq } from "drizzle-orm";
import { expenses, users, type Expense, type InsertExpense } from "@db/schema";
import { getDb } from "./connection.js";

export async function createExpense(
  data: Omit<InsertExpense, "id">,
): Promise<Expense> {
  const [{ id }] = await getDb().insert(expenses).values(data).$returningId();
  const rows = await getDb().select().from(expenses).where(eq(expenses.id, id)).limit(1);
  return rows[0];
}

export async function listExpensesByEvent(tenantId: number, eventId: number) {
  const rows = await getDb()
    .select({ expense: expenses, handedByName: users.name })
    .from(expenses)
    .leftJoin(users, eq(users.id, expenses.handedByUserId))
    .where(and(eq(expenses.tenantId, tenantId), eq(expenses.eventId, eventId)))
    .orderBy(desc(expenses.createdAt));
  return rows.map((r) => ({ ...r.expense, handedByName: r.handedByName ?? null }));
}

export async function getExpense(tenantId: number, id: number) {
  const rows = await getDb()
    .select()
    .from(expenses)
    .where(and(eq(expenses.tenantId, tenantId), eq(expenses.id, id)))
    .limit(1);
  return rows.at(0);
}

export async function updateExpense(
  tenantId: number,
  id: number,
  data: Partial<Pick<Expense, "receiverName" | "receiverPersonId" | "amount" | "note">>,
) {
  await getDb()
    .update(expenses)
    .set(data)
    .where(and(eq(expenses.tenantId, tenantId), eq(expenses.id, id)));
  return getExpense(tenantId, id);
}

export async function deleteExpense(tenantId: number, id: number) {
  await getDb()
    .delete(expenses)
    .where(and(eq(expenses.tenantId, tenantId), eq(expenses.id, id)));
}

export async function expenseSummary(tenantId: number, eventId: number) {
  const rows = await listExpensesByEvent(tenantId, eventId);
  return {
    totalExpenses: rows.reduce((s, e) => s + e.amount, 0),
    count: rows.length,
  };
}
