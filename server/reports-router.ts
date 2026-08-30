import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, tenantQuery } from "./middleware.js";
import { writeAudit } from "./queries/audit.js";
import { getEvent } from "./queries/events.js";
import { getReport, listReports } from "./queries/reports.js";
import { generateEventReport } from "./services/report-pdf.js";

export const reportsRouter = createRouter({
  /** يولّد PDF رسمي للفرحة ويخزنه ويعيد سجل التقرير (فيه fileUrl) */
  generate: tenantQuery
    .input(z.object({ eventId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const event = await getEvent(ctx.tenant.id, input.eventId);
      if (!event) throw new TRPCError({ code: "NOT_FOUND", message: "الفرحة غير موجودة" });
      let report;
      try {
        report = await generateEventReport(ctx.tenant.id, input.eventId);
      } catch (err) {
        console.error("[reports] فشل توليد التقرير:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "تعذّر توليد التقرير على الخادم — حاول مرة أخرى بعد قليل، ولو المشكلة مستمرة كلم الدعم.",
        });
      }
      await writeAudit({
        tenantId: ctx.tenant.id,
        actorUserId: ctx.user.id,
        entityType: "event",
        entityId: event.id,
        action: "create",
        beforeJson: null,
        afterJson: { reportId: report.id, fileUrl: report.fileUrl },
        note: "توليد تقرير PDF",
      });
      return report;
    }),

  list: tenantQuery.query(async ({ ctx }) => {
    return listReports(ctx.tenant.id);
  }),

  get: tenantQuery
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const report = await getReport(ctx.tenant.id, input.id);
      if (!report) throw new TRPCError({ code: "NOT_FOUND", message: "التقرير غير موجود" });
      return report;
    }),
});
