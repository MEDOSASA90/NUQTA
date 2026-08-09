import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { eventAssignments, users, type Event } from "@db/schema";
import { getDb } from "./connection";
import type { Permission } from "../domain/types";
import { hasPermission } from "../domain/lifecycle";

/** أعضاء فريق المستأجر (لتعيين مسؤولي الإدخال) */
export async function listTenantUsers(tenantId: number) {
  const { tenantMembers } = await import("@db/schema");
  return getDb()
    .select({
      userId: users.id,
      name: users.name,
      memberRole: tenantMembers.role,
      permissions: tenantMembers.permissions,
    })
    .from(tenantMembers)
    .innerJoin(users, eq(users.id, tenantMembers.userId))
    .where(eq(tenantMembers.tenantId, tenantId));
}

/** معيّنو الإدخال لفرحة (مع أسمائهم) */
export async function listAssignees(eventId: number) {
  const db = getDb();
  return db
    .select({ userId: eventAssignments.userId, name: users.name })
    .from(eventAssignments)
    .innerJoin(users, eq(users.id, eventAssignments.userId))
    .where(eq(eventAssignments.eventId, eventId));
}

export async function setAssignees(
  tenantId: number,
  eventId: number,
  userIds: number[],
  assignedBy: number,
) {
  if (userIds.length > 2) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "مسؤولو الإدخال للفرح حد أقصى 2 بس",
    });
  }
  const members = await listTenantUsers(tenantId);
  const memberIds = new Set(members.map((m) => m.userId));
  for (const uid of userIds) {
    if (!memberIds.has(uid)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "لازم المسؤولين يكونوا من فريق الكاتب",
      });
    }
  }
  const db = getDb();
  await db.delete(eventAssignments).where(eq(eventAssignments.eventId, eventId));
  for (const uid of userIds) {
    await db
      .insert(eventAssignments)
      .values({ tenantId, eventId, userId: uid, assignedBy });
  }
  return listAssignees(eventId);
}

export type RecordingContext = {
  userId: number;
  memberRole: string; // 'scribe' | 'team'
  permissions?: readonly Permission[];
};

/**
 * قواعد الإدخال في دفتر الفرح:
 * - upcoming: الدفتر لسه متفتحش → ممنوع التسجيل للكل
 * - done: الدفتر اتقفل → التعديل/الإضافة للكاتب فقط (وتُوسم بالحبر الأحمر)
 * - open مع معيّنين: التسجيل للمعيّنين + الكاتب فقط
 * يعيد { afterDone: true } لو الفرح مقفول (للتوسيم)
 */
export async function assertCanRecord(
  event: Event,
  ctx: RecordingContext,
): Promise<{ afterDone: boolean }> {
  if (ctx.memberRole === "team" && !hasPermission("team", ctx.permissions ?? [], "record")) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "عضو الفريق لا يملك صلاحية تسجيل النقاط لهذا الفرح",
    });
  }
  const lifecycle = event.lifecycleStatus;
  const isLive = lifecycle === "live" || event.status === "open";
  if (!isLive && lifecycle !== "completed" && lifecycle !== "archived" && event.status !== "done") {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "الدفتر لسه متفتحش — افتح الدفتر الأول",
    });
  }
  if (lifecycle === "completed" || lifecycle === "archived" || event.status === "done") {
    if (ctx.memberRole !== "scribe") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "الدفتر اتقفل — التعديل بعد القفل للكاتب فقط",
      });
    }
    return { afterDone: true };
  }
  // live
  const assignees = await listAssignees(event.id);
  if (assignees.length > 0) {
    const allowed =
      ctx.memberRole === "scribe" || assignees.some((a) => a.userId === ctx.userId);
    if (!allowed) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "مش من مسؤولي الإدخال للفرح دي",
      });
    }
  }
  return { afterDone: false };
}

export function assertCanEditLedger(ctx: RecordingContext): void {
  if (ctx.memberRole === "scribe") return;
  if (!hasPermission("team", ctx.permissions ?? [], "edit")) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "عضو الفريق لا يملك صلاحية تعديل النقاط",
    });
  }
}
