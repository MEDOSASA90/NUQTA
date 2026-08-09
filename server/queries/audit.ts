import { and, desc, eq, gte, lte, type SQL } from "drizzle-orm";
import { auditLog, type InsertAuditLogEntry } from "@db/schema";
import { getDb } from "./connection";

export async function writeAudit(entry: Omit<InsertAuditLogEntry, "id">) {
  await getDb().insert(auditLog).values(entry);
}

export async function listAudit(
  tenantId: number,
  filters?: {
    entityType?: string;
    action?: "create" | "update" | "delete";
    from?: Date;
    to?: Date;
    limit?: number;
  },
) {
  const conds: SQL[] = [eq(auditLog.tenantId, tenantId)];
  if (filters?.entityType) conds.push(eq(auditLog.entityType, filters.entityType));
  if (filters?.action) conds.push(eq(auditLog.action, filters.action));
  if (filters?.from) conds.push(gte(auditLog.createdAt, filters.from));
  if (filters?.to) conds.push(lte(auditLog.createdAt, filters.to));
  return getDb()
    .select()
    .from(auditLog)
    .where(and(...conds))
    .orderBy(desc(auditLog.createdAt))
    .limit(filters?.limit ?? 200);
}
