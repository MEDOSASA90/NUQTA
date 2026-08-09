import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { EventListItem } from "@contracts/afrah";
import { createRouter, tenantQuery } from "./middleware";
import { writeAudit } from "./queries/audit";
import {
  createEvent,
  getEvent,
  listEvents,
  regenerateShareToken as regenerateShareTokenQuery,
  updateEvent,
} from "./queries/events";
import {
  counterpartiesOf,
  listNuqtatByEvent,
  listTenantNuqtatJoined,
} from "./queries/nuqtat";
import { getPerson } from "./queries/persons";
import { expenseSummary } from "./queries/expenses";
import {
  listAssignees,
  listTenantUsers,
  setAssignees as setAssigneesQuery,
} from "./queries/lifecycle";
import { assertEventTransition } from "./domain/lifecycle";

const dateInput = z.coerce.date();

async function toListItem(
  ev: Awaited<ReturnType<typeof listEvents>>[number],
  joined: Awaited<ReturnType<typeof listTenantNuqtatJoined>>,
  expectedByHost: Map<number, number>,
): Promise<EventListItem> {
  const items = joined.filter((n) => n.eventId === ev.id);
  const payers = new Set(items.map((n) => n.payerId));
  return {
    ...ev,
    nuqtatCount: items.length,
    totalAmount: items.reduce((s, n) => s + n.amount, 0),
    payersCount: payers.size,
    expectedGuests: ev.hostPersonId ? (expectedByHost.get(ev.hostPersonId) ?? 0) : 0,
  };
}

export const eventsRouter = createRouter({
  /** الأفراح مع إجمالياتها — filter: upcoming (تشمل open) | open | done | all */
  list: tenantQuery
    .input(
      z
        .object({
          filter: z.enum(["upcoming", "open", "done", "all"]).optional().default("all"),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const [events, joined] = await Promise.all([
        listEvents(ctx.tenant.id),
        listTenantNuqtatJoined(ctx.tenant.id),
      ]);
      // عدّ المدعوين المتوقعين لكل صاحب فرح (من تعاملوا معه سابقًا)
      const expectedByHost = new Map<number, number>();
      const hosts = [...new Set(events.map((e) => e.hostPersonId).filter((x): x is number => x != null))];
      await Promise.all(
        hosts.map(async (h) => {
          const cps = await counterpartiesOf(ctx.tenant.id, h);
          expectedByHost.set(h, cps.length);
        }),
      );
      const items = await Promise.all(
        events.map((ev) => toListItem(ev, joined, expectedByHost)),
      );
      const filter = input?.filter ?? "all";
      // توافق: «upcoming» تشمل القادمة والمفتوحة (الفرح الشغالة)
      const filtered =
        filter === "all"
          ? items
          : filter === "upcoming"
            ? items.filter((e) => e.status === "upcoming" || e.status === "open")
            : items.filter((e) => e.status === filter);
      // القادمة أقربها أولًا، السابقة أحدثها أولًا
      return filtered.sort((a, b) => {
        const ta = new Date(a.eventDate).getTime();
        const tb = new Date(b.eventDate).getTime();
        return a.status === "upcoming" ? ta - tb : tb - ta;
      });
    }),

  /** فرحة واحدة مع نقوطها وإجماليها وعدد المدعوين */
  get: tenantQuery
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const event = await getEvent(ctx.tenant.id, input.id);
      if (!event) throw new TRPCError({ code: "NOT_FOUND", message: "الفرحة غير موجودة" });
      const [nuqtat, assignees, expensesSummary] = await Promise.all([
        listNuqtatByEvent(ctx.tenant.id, event.id),
        listAssignees(event.id),
        expenseSummary(ctx.tenant.id, event.id),
      ]);
      const payers = new Set(nuqtat.map((n) => n.payerPersonId));
      const expectedGuests = event.hostPersonId
        ? (await counterpartiesOf(ctx.tenant.id, event.hostPersonId)).length
        : 0;
      const totalAmount = nuqtat.reduce((s, n) => s + n.amount, 0);
      return {
        event,
        nuqtat,
        totalAmount,
        payersCount: payers.size,
        expectedGuests,
        assignees,
        totalExpenses: expensesSummary.totalExpenses,
        expensesCount: expensesSummary.count,
        netTotal: totalAmount - expensesSummary.totalExpenses,
        sharePath: `/w/${event.shareToken}`,
      };
    }),

  create: tenantQuery
    .input(
      z.object({
        hostPersonId: z.number().int().positive().nullish(),
        hostName: z.string().max(255).optional(),
        eventDate: dateInput,
        place: z.string().max(255).optional().default(""),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      let hostName = input.hostName?.trim() ?? "";
      if (input.hostPersonId) {
        const host = await getPerson(ctx.tenant.id, input.hostPersonId);
        if (!host) throw new TRPCError({ code: "NOT_FOUND", message: "صاحب الفرح غير موجود" });
        if (!hostName) hostName = host.name;
      }
      if (!hostName) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "لازم اسم صاحب الفرح أو شخص مسجل" });
      }
      const event = await createEvent({
        tenantId: ctx.tenant.id,
        hostPersonId: input.hostPersonId ?? null,
        hostName,
        eventDate: input.eventDate,
        place: input.place,
        status: "upcoming",
      });
      await writeAudit({
        tenantId: ctx.tenant.id,
        actorUserId: ctx.user.id,
        entityType: "event",
        entityId: event.id,
        action: "create",
        beforeJson: null,
        afterJson: event,
        note: null,
      });
      return event;
    }),

  update: tenantQuery
    .input(
      z.object({
        id: z.number().int().positive(),
        hostName: z.string().max(255).optional(),
        hostPersonId: z.number().int().positive().nullish(),
        eventDate: dateInput.optional(),
        place: z.string().max(255).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const event = await getEvent(ctx.tenant.id, input.id);
      if (!event) throw new TRPCError({ code: "NOT_FOUND", message: "الفرحة غير موجودة" });
      const updated = await updateEvent(ctx.tenant.id, input.id, {
        ...(input.hostName !== undefined ? { hostName: input.hostName.trim() } : {}),
        ...(input.hostPersonId !== undefined ? { hostPersonId: input.hostPersonId } : {}),
        ...(input.eventDate !== undefined ? { eventDate: input.eventDate } : {}),
        ...(input.place !== undefined ? { place: input.place } : {}),
      });
      await writeAudit({
        tenantId: ctx.tenant.id,
        actorUserId: ctx.user.id,
        entityType: "event",
        entityId: event.id,
        action: "update",
        beforeJson: event,
        afterJson: updated ?? null,
        note: null,
      });
      return updated;
    }),

  /** فتح الدفتر — بداية الفرح رسميًا (upcoming → open) */
  openLedger: tenantQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const event = await getEvent(ctx.tenant.id, input.id);
      if (!event) throw new TRPCError({ code: "NOT_FOUND", message: "الفرحة غير موجودة" });
      if (event.status === "open") return event; // idempotent
      if (event.status !== "upcoming") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "الدفتر ده اتقفل خلاص — مينفعش يتفتح تاني",
        });
      }
      const updated = await updateEvent(ctx.tenant.id, input.id, {
        status: "open",
        lifecycleStatus: "live",
        openedAt: new Date(),
      });
      await writeAudit({
        tenantId: ctx.tenant.id,
        actorUserId: ctx.user.id,
        entityType: "event",
        entityId: event.id,
        action: "update",
        beforeJson: { status: event.status },
        afterJson: { status: "open" },
        note: "فتح الدفتر — بداية الفرح رسميًا",
      });
      return updated;
    }),

  /** إتمام الفرح وقفل الدفتر — للكاتب نفسه فقط (open → done) */
  closeLedger: tenantQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const event = await getEvent(ctx.tenant.id, input.id);
      if (!event) throw new TRPCError({ code: "NOT_FOUND", message: "الفرحة غير موجودة" });
      if (ctx.membership.role !== "scribe") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "قفل الدفتر متاح للكاتب فقط",
        });
      }
      if (event.status === "done") return event; // idempotent
      if (event.status !== "open") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "لازم الدفتر يكون مفتوح الأول — افتح الدفتر وبعدين اتم الفرح",
        });
      }
      const updated = await updateEvent(ctx.tenant.id, input.id, {
        status: "done",
        lifecycleStatus: "completed",
        closedAt: new Date(),
        closedByUserId: ctx.user.id,
      });
      await writeAudit({
        tenantId: ctx.tenant.id,
        actorUserId: ctx.user.id,
        entityType: "event",
        entityId: event.id,
        action: "update",
        beforeJson: { status: event.status },
        afterJson: { status: "done" },
        note: "إتمام الفرح وقفل الدفتر",
      });
      return updated;
    }),

  /** قفل الفرحة (توافق قديم) — أي تعديل بعد كده يتوسم بالحبر الأحمر */
  markDone: tenantQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const event = await getEvent(ctx.tenant.id, input.id);
      if (!event) throw new TRPCError({ code: "NOT_FOUND", message: "الفرحة غير موجودة" });
      if (event.status === "done") return event;
      const updated = await updateEvent(ctx.tenant.id, input.id, {
        status: "done",
        lifecycleStatus: "completed",
        closedAt: new Date(),
        closedByUserId: ctx.user.id,
      });
      await writeAudit({
        tenantId: ctx.tenant.id,
        actorUserId: ctx.user.id,
        entityType: "event",
        entityId: event.id,
        action: "update",
        beforeJson: { status: event.status },
        afterJson: { status: "done" },
        note: "قفل الفرحة",
      });
      return updated;
    }),

  /** تعيين مسؤولي إدخال البيانات أثناء الفرح — حد أقصى 2 */
  setAssignees: tenantQuery
    .input(
      z.object({
        id: z.number().int().positive(),
        userIds: z.array(z.number().int().positive()).max(2, "مسؤولو الإدخال حد أقصى 2 بس"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const event = await getEvent(ctx.tenant.id, input.id);
      if (!event) throw new TRPCError({ code: "NOT_FOUND", message: "الفرحة غير موجودة" });
      const assignees = await setAssigneesQuery(
        ctx.tenant.id,
        input.id,
        input.userIds,
        ctx.user.id,
      );
      await writeAudit({
        tenantId: ctx.tenant.id,
        actorUserId: ctx.user.id,
        entityType: "event",
        entityId: event.id,
        action: "update",
        beforeJson: null,
        afterJson: { assignees },
        note: "تعيين مسؤولي إدخال الفرح",
      });
      return assignees;
    }),

  /** أعضاء الفريق (لاختيار مسؤولي الإدخال) */
  teamMembers: tenantQuery.query(async ({ ctx }) => {
    return listTenantUsers(ctx.tenant.id);
  }),

  transition: tenantQuery
    .input(z.object({
      id: z.number().int().positive(),
      to: z.enum(["scheduled", "live", "completed", "archived"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const event = await getEvent(ctx.tenant.id, input.id);
      if (!event) throw new TRPCError({ code: "NOT_FOUND", message: "الفرحة غير موجودة" });
      if (ctx.membership.role !== "scribe") {
        throw new TRPCError({ code: "FORBIDDEN", message: "تغيير حالة الفرح متاح للكاتب فقط" });
      }
      assertEventTransition(event.lifecycleStatus, input.to);
      const updated = await updateEvent(ctx.tenant.id, event.id, {
        lifecycleStatus: input.to,
        status: input.to === "live" ? "open" : input.to === "completed" || input.to === "archived" ? "done" : "upcoming",
        openedAt: input.to === "live" ? new Date() : event.openedAt,
        closedAt: input.to === "completed" || input.to === "archived" ? new Date() : event.closedAt,
        closedByUserId: input.to === "completed" || input.to === "archived" ? ctx.user.id : event.closedByUserId,
      });
      await writeAudit({
        tenantId: ctx.tenant.id,
        actorUserId: ctx.user.id,
        entityType: "event",
        entityId: event.id,
        action: "update",
        beforeJson: { lifecycleStatus: event.lifecycleStatus },
        afterJson: { lifecycleStatus: input.to },
        note: "تغيير دورة حياة الفرح",
      });
      return updated;
    }),

  /** رابط عام جديد (القديم يبطل) */
  regenerateShareToken: tenantQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const event = await getEvent(ctx.tenant.id, input.id);
      if (!event) throw new TRPCError({ code: "NOT_FOUND", message: "الفرحة غير موجودة" });
      return regenerateShareTokenQuery(ctx.tenant.id, input.id);
    }),
});
