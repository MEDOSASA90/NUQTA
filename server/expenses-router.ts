import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, tenantQuery } from "./middleware.js";
import { writeAudit } from "./queries/audit.js";
import {
  createExpense,
  deleteExpense,
  expenseSummary,
  getExpense,
  listExpensesByEvent,
  updateExpense,
} from "./queries/expenses.js";
import { getEvent } from "./queries/events.js";
import { assertCanRecord } from "./queries/lifecycle.js";

const amountSchema = z.number().int().positive("المبلغ لازم يكون أكبر من صفر");

/**
 * المصروفات — صاحب الفرح (أو أي حد من طرفه) بيستلم فلوس من الشنطة
 * أثناء الفرح. تتسجل باسم المستلم ومين سلّمها من فريق الكاتب.
 */
export const expensesRouter = createRouter({
  create: tenantQuery
    .input(
      z.object({
        eventId: z.number().int().positive(),
        receiverName: z.string().min(1, "لازم اسم اللي استلم الفلوس").max(255),
        receiverPersonId: z.number().int().positive().nullish(),
        amount: amountSchema,
        note: z.string().max(2000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const event = await getEvent(ctx.tenant.id, input.eventId);
      if (!event) throw new TRPCError({ code: "NOT_FOUND", message: "الفرحة غير موجودة" });
      await assertCanRecord(event, {
        userId: ctx.user.id,
        memberRole: ctx.membership.role,
        permissions: ctx.membership.permissions ?? [],
      });
      const expense = await createExpense({
        tenantId: ctx.tenant.id,
        eventId: input.eventId,
        receiverName: input.receiverName.trim(),
        receiverPersonId: input.receiverPersonId ?? null,
        amount: input.amount,
        handedByUserId: ctx.user.id,
        note: input.note ?? null,
      });
      await writeAudit({
        tenantId: ctx.tenant.id,
        actorUserId: ctx.user.id,
        entityType: "expense",
        entityId: expense.id,
        action: "create",
        beforeJson: null,
        afterJson: expense,
        note: `مصروف من شنطة «${event.hostName}» — استلمه ${expense.receiverName}`,
      });
      return expense;
    }),

  listByEvent: tenantQuery
    .input(z.object({ eventId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      return listExpensesByEvent(ctx.tenant.id, input.eventId);
    }),

  eventSummary: tenantQuery
    .input(z.object({ eventId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      return expenseSummary(ctx.tenant.id, input.eventId);
    }),

  update: tenantQuery
    .input(
      z.object({
        id: z.number().int().positive(),
        receiverName: z.string().min(1).max(255).optional(),
        receiverPersonId: z.number().int().positive().nullish(),
        amount: amountSchema.optional(),
        note: z.string().max(2000).nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const before = await getExpense(ctx.tenant.id, input.id);
      if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "المصروف غير موجود" });
      const event = await getEvent(ctx.tenant.id, before.eventId);
      if (event) {
        await assertCanRecord(event, {
          userId: ctx.user.id,
          memberRole: ctx.membership.role,
          permissions: ctx.membership.permissions ?? [],
        });
      }
      const updated = await updateExpense(ctx.tenant.id, input.id, {
        ...(input.receiverName !== undefined ? { receiverName: input.receiverName.trim() } : {}),
        ...(input.receiverPersonId !== undefined ? { receiverPersonId: input.receiverPersonId } : {}),
        ...(input.amount !== undefined ? { amount: input.amount } : {}),
        ...(input.note !== undefined ? { note: input.note } : {}),
      });
      await writeAudit({
        tenantId: ctx.tenant.id,
        actorUserId: ctx.user.id,
        entityType: "expense",
        entityId: input.id,
        action: "update",
        beforeJson: before,
        afterJson: updated ?? null,
        note: null,
      });
      return updated;
    }),

  delete: tenantQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const before = await getExpense(ctx.tenant.id, input.id);
      if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "المصروف غير موجود" });
      const event = await getEvent(ctx.tenant.id, before.eventId);
      if (event) {
        await assertCanRecord(event, {
          userId: ctx.user.id,
          memberRole: ctx.membership.role,
          permissions: ctx.membership.permissions ?? [],
        });
      }
      await deleteExpense(ctx.tenant.id, input.id);
      await writeAudit({
        tenantId: ctx.tenant.id,
        actorUserId: ctx.user.id,
        entityType: "expense",
        entityId: input.id,
        action: "delete",
        beforeJson: before,
        afterJson: null,
        note: null,
      });
      return { success: true };
    }),
});
