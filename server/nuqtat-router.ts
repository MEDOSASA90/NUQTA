import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, tenantQuery } from "./middleware.js";
import { writeAudit } from "./queries/audit.js";
import { computeSettlement } from "./queries/balance-core.js";
import { getEvent } from "./queries/events.js";
import {
  createNuqta,
  getNuqta,
  listNuqtatByEvent,
  listRecentNuqtat,
  listTenantNuqtatJoined,
  updateNuqta,
} from "./queries/nuqtat.js";
import { getPerson } from "./queries/persons.js";
import { getTenantById } from "./queries/tenants.js";
import { assertCanEditLedger, assertCanRecord } from "./queries/lifecycle.js";
import { enqueueNotificationJob } from "./queries/notification-jobs.js";
import {
  composeConfirmationBody,
  composeCorrectionBody,
} from "./services/whatsapp-messages.js";

const amountSchema = z.number().int().positive("المبلغ لازم يكون أكبر من صفر");

/** النظام ب — تأكيد فوري (لو مفعّل والتليفون مؤكد) */
async function enqueueConfirmation(params: {
  tenantId: number;
  eventId: number;
  nuqtaId: number;
  payerId: number;
  amount: number;
}): Promise<boolean> {
  const { tenantId, eventId, nuqtaId, payerId, amount } = params;
  const [tenant, event, payer] = await Promise.all([
    getTenantById(tenantId),
    getEvent(tenantId, eventId),
    getPerson(tenantId, payerId),
  ]);
  if (!tenant || !event || !payer) return false;
  if (tenant.settings?.confirmationsEnabled === false) return false;
  if (!payer.phoneVerified) return false;

  const joined = await listTenantNuqtatJoined(tenantId);
  // الحالة بعد الحفظ: نحسبها من السجل الكامل مع استبعاد النقطة نفسها
  const settlement = computeSettlement(
    joined.filter((n) => n.id !== nuqtaId),
    payerId,
    event.hostPersonId ?? -1,
    amount,
  );
  const body = composeConfirmationBody({
    brand: tenant.name,
    payerName: payer.name,
    hostName: event.hostName,
    amount,
    eventDate: new Date(event.eventDate),
    settlement,
  });
  await enqueueNotificationJob({
    tenantId,
    kind: "confirmation",
    idempotencyKey: `confirmation:${nuqtaId}`,
    payload: { tenantId, personId: payer.id, phone: payer.phone, body, eventId, nuqtaId },
    status: "queued",
    attempts: 0,
    nextAttemptAt: new Date(),
  });
  return true;
}

async function enqueueCorrection(params: {
  tenantId: number;
  payerId: number;
  phone: string;
  body: string;
  eventId: number;
  nuqtaId: number;
  idempotencyKey: string;
}): Promise<void> {
  await enqueueNotificationJob({
    tenantId: params.tenantId,
    kind: "correction",
    idempotencyKey: params.idempotencyKey,
    payload: {
      tenantId: params.tenantId,
      personId: params.payerId,
      phone: params.phone,
      body: params.body,
      eventId: params.eventId,
      nuqtaId: params.nuqtaId,
    },
    status: "queued",
    attempts: 0,
    nextAttemptAt: new Date(),
  });
}

export const nuqtatRouter = createRouter({
  /**
   * تسجيل نقطة: يحسب حالة السداد + يرسل تأكيد واتساب فوري (النظام ب)
   * + يسجل audit. لو الفرح status=done يتوسم editedAfterDone (حبر أحمر).
   */
  create: tenantQuery
    .input(
      z.object({
        eventId: z.number().int().positive(),
        payerPersonId: z.number().int().positive(),
        amount: amountSchema,
        invitedBy: z.string().max(255).optional().default(""),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [event, payer] = await Promise.all([
        getEvent(ctx.tenant.id, input.eventId),
        getPerson(ctx.tenant.id, input.payerPersonId),
      ]);
      if (!event) throw new TRPCError({ code: "NOT_FOUND", message: "الفرحة غير موجودة" });
      if (!payer) throw new TRPCError({ code: "NOT_FOUND", message: "الشخص غير موجود" });

      if (event.lifecycleStatus !== "live" && event.status !== "open") {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "تسجيل النقطة متاح أثناء الفرح الحي فقط" });
      }

      // قواعد دورة الحياة: الدفتر لازم يكون مفتوح (أو الكاتب بعد القفل)
      const { afterDone } = await assertCanRecord(event, {
        userId: ctx.user.id,
        memberRole: ctx.membership.role,
        permissions: ctx.membership.permissions ?? [],
      });

      // حالة السداد قبل الحفظ (للمعاينة والرسالة)
      const joined = await listTenantNuqtatJoined(ctx.tenant.id);
      const duplicate = joined.some(
        (item) => item.eventId === input.eventId && item.payerId === input.payerPersonId,
      );
      if (duplicate) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "النقطة مسجلة بالفعل لهذا الشخص في نفس الفرح",
        });
      }
      const settlement = computeSettlement(
        joined,
        input.payerPersonId,
        event.hostPersonId ?? -1,
        input.amount,
      );

      const nuqta = await createNuqta({
        tenantId: ctx.tenant.id,
        eventId: input.eventId,
        payerPersonId: input.payerPersonId,
        amount: input.amount,
        invitedBy: input.invitedBy,
        recordedByUserId: ctx.user.id,
        whatsappNotified: false,
        editedAfterDone: afterDone,
      });

      const notificationQueued = await enqueueConfirmation({
        tenantId: ctx.tenant.id,
        eventId: event.id,
        nuqtaId: nuqta.id,
        payerId: payer.id,
        amount: input.amount,
      });
      await writeAudit({
        tenantId: ctx.tenant.id,
        actorUserId: ctx.user.id,
        entityType: "nuqta",
        entityId: nuqta.id,
        action: "create",
        beforeJson: null,
        afterJson: { ...nuqta, whatsappNotified: false, notificationQueued },
        note: afterDone ? "نقطة مضافة بعد قفل الفرحة" : null,
      });

      return { nuqta, settlement, whatsappNotified: false, whatsappQueued: notificationQueued };
    }),

  /** معاينة حالة السداد قبل الحفظ (بدون أي كتابة) */
  previewSettlement: tenantQuery
    .input(
      z.object({
        eventId: z.number().int().positive(),
        payerPersonId: z.number().int().positive(),
        amount: amountSchema,
      }),
    )
    .query(async ({ ctx, input }) => {
      const event = await getEvent(ctx.tenant.id, input.eventId);
      if (!event) throw new TRPCError({ code: "NOT_FOUND", message: "الفرحة غير موجودة" });
      const joined = await listTenantNuqtatJoined(ctx.tenant.id);
      return computeSettlement(
        joined,
        input.payerPersonId,
        event.hostPersonId ?? -1,
        input.amount,
      );
    }),

  /**
   * تعديل نقطة. لو اتبعت لها إشعار واتساب ⇒ رسالة تصحيحية + audit بملاحظة.
   * لو الفرح اتقفلت ⇒ editedAfterDone=true (حبر أحمر).
   */
  update: tenantQuery
    .input(
      z.object({
        id: z.number().int().positive(),
        amount: amountSchema.optional(),
        invitedBy: z.string().max(255).optional(),
        note: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const old = await getNuqta(ctx.tenant.id, input.id);
      if (!old) throw new TRPCError({ code: "NOT_FOUND", message: "النقطة غير موجودة" });
      const [event, payer, tenant] = await Promise.all([
        getEvent(ctx.tenant.id, old.eventId),
        getPerson(ctx.tenant.id, old.payerPersonId),
        getTenantById(ctx.tenant.id),
      ]);
      if (event) {
        assertCanEditLedger({
          userId: ctx.user.id,
          memberRole: ctx.membership.role,
          permissions: ctx.membership.permissions ?? [],
        });
        if (event.status !== "done" && event.lifecycleStatus !== "live") {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "لا يمكن تعديل نقطة خارج دورة الفرح" });
        }
      }
      const wasNotified = old.whatsappNotified;
      const eventDone = event?.status === "done";

      const updated = await updateNuqta(ctx.tenant.id, input.id, {
        ...(input.amount !== undefined ? { amount: input.amount } : {}),
        ...(input.invitedBy !== undefined ? { invitedBy: input.invitedBy } : {}),
        ...(eventDone ? { editedAfterDone: true } : {}),
      });

      if (wasNotified && payer && tenant && input.amount !== undefined && input.amount !== old.amount) {
        const body = composeCorrectionBody({
          brand: tenant.name,
          payerName: payer.name,
          hostName: event?.hostName ?? "—",
          change: "updated",
          oldAmount: old.amount,
          newAmount: input.amount,
          note: input.note,
        });
        await enqueueCorrection({
          tenantId: ctx.tenant.id,
          payerId: payer.id,
          phone: payer.phone,
          body,
          eventId: old.eventId,
          nuqtaId: old.id,
          idempotencyKey: `correction:update:${old.id}:${input.amount}:${updated?.updatedAt?.getTime() ?? Date.now()}`,
        });
      }

      await writeAudit({
        tenantId: ctx.tenant.id,
        actorUserId: ctx.user.id,
        entityType: "nuqta",
        entityId: old.id,
        action: "update",
        beforeJson: old,
        afterJson: updated ?? null,
        note:
          input.note ??
          (wasNotified
            ? "تعديل بعد إرسال إشعار واتساب — اتبعتت رسالة تصحيحية"
            : eventDone
              ? "تعديل بعد قفل الفرحة"
              : null),
      });
      return updated;
    }),

  /** حذف نقطة — نفس قواعد التصحيح (رسالة لو كان اتبعت إشعار + audit) */
  delete: tenantQuery
    .input(z.object({ id: z.number().int().positive(), note: z.string().max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      const old = await getNuqta(ctx.tenant.id, input.id);
      if (!old) throw new TRPCError({ code: "NOT_FOUND", message: "النقطة غير موجودة" });
      const [event, payer, tenant] = await Promise.all([
        getEvent(ctx.tenant.id, old.eventId),
        getPerson(ctx.tenant.id, old.payerPersonId),
        getTenantById(ctx.tenant.id),
      ]);
      if (event) {
        assertCanEditLedger({
          userId: ctx.user.id,
          memberRole: ctx.membership.role,
          permissions: ctx.membership.permissions ?? [],
        });
        if (event.status !== "done" && event.lifecycleStatus !== "live") {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "لا يمكن حذف نقطة خارج دورة الفرح" });
        }
      }

      if (old.whatsappNotified && payer && tenant) {
        const body = composeCorrectionBody({
          brand: tenant.name,
          payerName: payer.name,
          hostName: event?.hostName ?? "—",
          change: "deleted",
          oldAmount: old.amount,
          note: input.note,
        });
        await enqueueCorrection({
          tenantId: ctx.tenant.id,
          payerId: payer.id,
          phone: payer.phone,
          body,
          eventId: old.eventId,
          nuqtaId: old.id,
          idempotencyKey: `correction:delete:${old.id}`,
        });
      }

      await updateNuqta(ctx.tenant.id, input.id, {
        voidedAt: new Date(),
        voidedByUserId: ctx.user.id,
        voidReason: input.note ?? "تصحيح وحذف نقطة",
      });
      await writeAudit({
        tenantId: ctx.tenant.id,
        actorUserId: ctx.user.id,
        entityType: "nuqta",
        entityId: old.id,
        action: "delete",
        beforeJson: old,
        afterJson: null,
        note:
          input.note ??
          (old.whatsappNotified
            ? "حذف بعد إرسال إشعار واتساب — اتبعتت رسالة تصحيحية"
            : null),
      });
      return { success: true };
    }),

  listByEvent: tenantQuery
    .input(z.object({ eventId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      return listNuqtatByEvent(ctx.tenant.id, input.eventId);
    }),

  listRecent: tenantQuery
    .input(z.object({ limit: z.number().int().min(1).max(50).optional() }).optional())
    .query(async ({ ctx, input }) => {
      return listRecentNuqtat(ctx.tenant.id, input?.limit ?? 10);
    }),
});
