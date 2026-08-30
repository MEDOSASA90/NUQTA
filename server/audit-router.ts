import { z } from "zod";
import { createRouter, tenantQuery } from "./middleware.js";
import { listAudit } from "./queries/audit.js";
import { listTenantNuqtatJoined } from "./queries/nuqtat.js";

export const auditRouter = createRouter({
  /**
   * سجل التدقيق مع فلاتر النوع/الإجراء/التاريخ —
   * كل سجل مرتبط بنقطة اتعدلت بعد قفل الفرحة يحمل editedAfterDone=true (حبر أحمر).
   */
  list: tenantQuery
    .input(
      z
        .object({
          entityType: z.enum(["nuqta", "person", "event"]).optional(),
          action: z.enum(["create", "update", "delete"]).optional(),
          from: z.coerce.date().optional(),
          to: z.coerce.date().optional(),
          limit: z.number().int().min(1).max(500).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const entries = await listAudit(ctx.tenant.id, {
        entityType: input?.entityType,
        action: input?.action,
        from: input?.from,
        to: input?.to,
        limit: input?.limit,
      });
      // علم الحبر الأحمر للسجلات المرتبطة بنقوط
      const joined = await listTenantNuqtatJoined(ctx.tenant.id);
      const redNuqtaIds = new Set(
        joined.filter((n) => n.editedAfterDone || n.eventStatus === "done").map((n) => n.id),
      );
      return entries.map((e) => ({
        ...e,
        editedAfterDone: e.entityType === "nuqta" && redNuqtaIds.has(e.entityId),
      }));
    }),
});
