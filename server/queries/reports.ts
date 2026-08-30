import { and, desc, eq } from "drizzle-orm";
import { reports, type InsertReport, type Report } from "@db/schema";
import { getDb } from "./connection.js";

export async function createReportRow(
  data: Omit<InsertReport, "id">,
): Promise<Report> {
  const [{ id }] = await getDb().insert(reports).values(data).$returningId();
  const rows = await getDb()
    .select()
    .from(reports)
    .where(eq(reports.id, id))
    .limit(1);
  return rows[0];
}

export async function updateReportFileUrl(id: number, fileUrl: string) {
  await getDb().update(reports).set({ fileUrl }).where(eq(reports.id, id));
}

export async function deleteReportRow(id: number) {
  await getDb().delete(reports).where(eq(reports.id, id));
}

export async function listReports(tenantId: number) {
  return getDb()
    .select()
    .from(reports)
    .where(eq(reports.tenantId, tenantId))
    .orderBy(desc(reports.issuedAt));
}

export async function getReport(tenantId: number, id: number) {
  const rows = await getDb()
    .select()
    .from(reports)
    .where(and(eq(reports.tenantId, tenantId), eq(reports.id, id)))
    .limit(1);
  return rows.at(0);
}

/** جلب تقرير بالـ id فقط — لمسار تقديم الملف (يتحقق الراوتر من الصلاحية) */
export async function getReportById(id: number) {
  const rows = await getDb()
    .select()
    .from(reports)
    .where(eq(reports.id, id))
    .limit(1);
  return rows.at(0);
}
