import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { DEFAULT_REMINDER_DAYS } from "@contracts/afrah";
import type { TenantSettings } from "@db/schema";
import { createRouter, tenantQuery } from "./middleware";
import { getEvent } from "./queries/events";
import { updateTenantSettings } from "./queries/tenants";
import { listWhatsappMessages } from "./queries/whatsapp-log";
import { handleBotMessage } from "./services/whatsapp-bot";
import { isCloudConfigured } from "./services/whatsapp";
import { sendEventReminders } from "./services/reminders";

export const whatsappRouter = createRouter({
  /** سجل رسائل واتساب (الأنظمة أ/ب/ج) */
  log: tenantQuery
    .input(
      z
        .object({
          kind: z
            .enum(["reminder", "confirmation", "phone_verification", "correction", "bot_reply", "bot_query"])
            .optional(),
          direction: z.enum(["out", "in"]).optional(),
          eventId: z.number().int().positive().optional(),
          personId: z.number().int().positive().optional(),
          limit: z.number().int().min(1).max(500).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      return listWhatsappMessages(ctx.tenant.id, {
        kind: input?.kind,
        direction: input?.direction,
        eventId: input?.eventId,
        personId: input?.personId,
        limit: input?.limit,
      });
    }),

  /** إعدادات واتساب: أيام التذكير (3 افتراضيًا) + تفعيل الأنظمة أ/ب/ج */
  getSettings: tenantQuery.query(async ({ ctx }) => {
    const s = ctx.tenant.settings ?? {};
    return {
      reminderDays: s.reminderDays ?? DEFAULT_REMINDER_DAYS,
      remindersEnabled: s.remindersEnabled ?? true,
      confirmationsEnabled: s.confirmationsEnabled ?? true,
      botEnabled: s.botEnabled ?? true,
      cloudConfigured: isCloudConfigured(),
      mode: isCloudConfigured() ? ("cloud" as const) : ("simulation" as const),
    };
  }),

  updateSettings: tenantQuery
    .input(
      z.object({
        reminderDays: z.number().int().min(1).max(30).optional(),
        remindersEnabled: z.boolean().optional(),
        confirmationsEnabled: z.boolean().optional(),
        botEnabled: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const next: TenantSettings = {
        ...(ctx.tenant.settings ?? {}),
        ...input,
      };
      await updateTenantSettings(ctx.tenant.id, next);
      return {
        reminderDays: next.reminderDays ?? DEFAULT_REMINDER_DAYS,
        remindersEnabled: next.remindersEnabled ?? true,
        confirmationsEnabled: next.confirmationsEnabled ?? true,
        botEnabled: next.botEnabled ?? true,
        cloudConfigured: isCloudConfigured(),
        mode: isCloudConfigured() ? ("cloud" as const) : ("simulation" as const),
      };
    }),

  /**
   * محاكاة البوت: يستقبل نصًا (أو نصًا مفرّغًا من صوتية) + تليفون
   * ويرد برد البوت — الرسائل تتسجل في السجل.
   */
  simulateBot: tenantQuery
    .input(
      z.object({
        phone: z.string().min(6).max(32),
        text: z.string().min(1).max(2000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.tenant.settings?.botEnabled === false) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "البوت متعطل من الإعدادات" });
      }
      return handleBotMessage(ctx.tenant.id, input.phone, input.text);
    }),

  /** إرسال تذكيرات فرحة معينة الآن (اختبار يدوي للنظام أ) */
  sendRemindersNow: tenantQuery
    .input(z.object({ eventId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const event = await getEvent(ctx.tenant.id, input.eventId);
      if (!event) throw new TRPCError({ code: "NOT_FOUND", message: "الفرحة غير موجودة" });
      return sendEventReminders(ctx.tenant.id, input.eventId);
    }),
});
