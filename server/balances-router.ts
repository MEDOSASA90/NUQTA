import { z } from "zod";
import { createRouter, tenantQuery } from "./middleware";
import {
  computeMatrix,
  computePairDetails,
  computePersonNetDb,
  computeSettledNotices,
} from "./queries/balances";

export const balancesRouter = createRouter({
  /** كل الأرصدة الثنائية في الشبكة: صافي + عدد تفاعلات + حالة */
  matrix: tenantQuery.query(async ({ ctx }) => {
    return computeMatrix(ctx.tenant.id);
  }),

  /** تفاصيل كل مرة بين شخصين (مبلغ + تاريخ + فرح) في الاتجاهين */
  pairDetails: tenantQuery
    .input(
      z.object({
        a: z.number().int().positive(),
        b: z.number().int().positive(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return computePairDetails(ctx.tenant.id, input.a, input.b);
    }),

  /** الصافي الكلي لشخص عبر الشبكة */
  personNet: tenantQuery
    .input(z.object({ personId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      return computePersonNetDb(ctx.tenant.id, input.personId);
    }),

  /** قائمة «فلان صفّى حسابه معاك» */
  settledNotice: tenantQuery.query(async ({ ctx }) => {
    return computeSettledNotices(ctx.tenant.id);
  }),
});
