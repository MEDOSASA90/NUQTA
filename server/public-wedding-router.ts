import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type {
  PublicWeddingPerson,
  PublicWeddingRegion,
  PublicWeddingStatement,
} from "@contracts/afrah";
import { createRouter, publicQuery } from "./middleware.js";
import { getEventByToken } from "./queries/events.js";
import { listNuqtatByEvent } from "./queries/nuqtat.js";
import { getTenantById } from "./queries/tenants.js";

export const publicWeddingRouter = createRouter({
  /**
   * كشف حساب صاحب الفرح read-only عبر الرابط العام /w/:token —
   * نقوط فرحه مصنفة بالمناطق + الإجمالي + التعديلات اللاحقة موسومة.
   */
  getByToken: publicQuery
    .input(z.object({ token: z.string().min(8).max(64) }))
    .query(async ({ input }) => {
      const event = await getEventByToken(input.token);
      if (!event) {
        throw new TRPCError({ code: "NOT_FOUND", message: "الرابط غير صحيح أو انتهت صلاحيته" });
      }
      const [tenant, nuqtat] = await Promise.all([
        getTenantById(event.tenantId),
        listNuqtatByEvent(event.tenantId, event.id),
      ]);

      const regionMap = new Map<string, PublicWeddingPerson[]>();
      for (const n of nuqtat) {
        const region = n.payerRegion?.trim() || "بدون منطقة";
        const list = regionMap.get(region) ?? [];
        list.push({
          name: n.payerName,
          phone: n.payerPhone,
          amount: n.amount,
          editedAfterDone: n.editedAfterDone,
          paidAt: n.createdAt,
          invitedBy: n.invitedBy,
        });
        regionMap.set(region, list);
      }

      const regions: PublicWeddingRegion[] = [...regionMap.entries()]
        .map(([region, persons]) => ({
          region,
          personsCount: persons.length,
          totalAmount: persons.reduce((s, p) => s + p.amount, 0),
          persons: persons.sort((a, b) => b.amount - a.amount),
        }))
        .sort((a, b) => b.totalAmount - a.totalAmount);

      const statement: PublicWeddingStatement = {
        brand: tenant?.name ?? "دفتر الأفراح",
        hostName: event.hostName,
        eventDate: new Date(event.eventDate),
        place: event.place,
        status: event.status,
        grandTotal: nuqtat.reduce((s, n) => s + n.amount, 0),
        personsCount: new Set(nuqtat.map((n) => n.payerPersonId)).size,
        regions,
        issuedAt: new Date(),
      };
      return statement;
    }),
});
