import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { phoneVerificationChallenges } from "@db/schema";
import { createRouter, tenantQuery } from "./middleware.js";
import { writeAudit } from "./queries/audit.js";
import { computeMatrix, computePersonNetDb } from "./queries/balances.js";
import { listTenantNuqtatJoined } from "./queries/nuqtat.js";
import {
  createPerson,
  deletePerson,
  findPersonByPhone,
  getPerson,
  listPersons,
  findPersonByNuqtaId,
  findPersonsByPhoneAnyTenant,
  searchGlobalPersons,
  searchTenantPersons,
  updatePerson,
} from "./queries/persons.js";
import { normalizePhone } from "./queries/person-search.js";
import { getOrCreateRegion } from "./queries/regions.js";
import { getDb } from "./queries/connection.js";
import { sendWhatsapp } from "./services/whatsapp.js";
import {
  canAttemptVerification,
  createVerificationCode,
  hashVerificationCode,
  verificationExpiresAt,
} from "./services/phone-verification.js";

export const personsRouter = createRouter({
  /** بحث فوري بالاسم/تليفون/منطقة — يميّز المتشابهين بالاسم */
  search: tenantQuery
    .input(z.object({ query: z.string().min(1), limit: z.number().int().min(1).max(50).optional() }))
    .query(async ({ ctx, input }) => {
      return searchTenantPersons(ctx.tenant.id, input.query, input.limit ?? 20);
    }),

  searchGlobal: tenantQuery
    .input(z.object({ query: z.string().min(1), limit: z.number().int().min(1).max(20).optional() }))
    .query(async ({ input }) => {
      const results = await searchGlobalPersons(input.query, input.limit ?? 10);
      return results.map((person) => ({
        nuqtaId: person.nuqtaId,
        name: person.name,
        phone: person.phone,
        region: person.region,
        phoneVerified: person.phoneVerified,
      }));
    }),

  list: tenantQuery.query(async ({ ctx }) => {
    return listPersons(ctx.tenant.id);
  }),

  /** بطاقة شخص: بياناته + صافيه الكلي + أرصدته الثنائية + نقوطه */
  get: tenantQuery
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const person = await getPerson(ctx.tenant.id, input.id);
      if (!person) throw new TRPCError({ code: "NOT_FOUND", message: "الشخص غير موجود" });
      const [net, matrix, joined] = await Promise.all([
        computePersonNetDb(ctx.tenant.id, person.id),
        computeMatrix(ctx.tenant.id),
        listTenantNuqtatJoined(ctx.tenant.id),
      ]);
      const pairs = matrix.filter(
        (p) => p.personAId === person.id || p.personBId === person.id,
      );
      const nuqtat = joined
        .filter((n) => n.payerId === person.id)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return { person, net, pairs, nuqtat };
    }),

  /** إنشاء شخص — التليفون فريد داخل المستأجر ويبقى غير مؤكد حتى verifyPhone */
  create: tenantQuery
    .input(
      z.object({
        name: z.string().min(2, "الاسم قصير").max(255),
        phone: z.string().min(6, "رقم التليفون غير صحيح").max(32),
        region: z.string().max(255).optional().default(""),
        nuqtaId: z.string().regex(/^NQ-[A-Z0-9]{10,32}$/).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const phone = normalizePhone(input.phone);
      const existing = await findPersonByPhone(ctx.tenant.id, phone);
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `الرقم ده مسجل باسم «${existing.name}» — مفيش داعي تضيفه تاني`,
        });
      }
      const phoneMatches = await findPersonsByPhoneAnyTenant(phone);
      const distinctGlobalIds = new Set(phoneMatches.map((person) => person.nuqtaId).filter((id): id is string => id !== null));
      if (!input.nuqtaId && distinctGlobalIds.size > 1) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "رقم الهاتف مرتبط بأكثر من هوية؛ لازم تأكيد NUQTA ID يدويًا قبل الربط",
        });
      }
      const existingGlobal = input.nuqtaId
        ? await findPersonByNuqtaId(input.nuqtaId)
        : phoneMatches.at(0);
      if (input.nuqtaId && !existingGlobal) {
        throw new TRPCError({ code: "NOT_FOUND", message: "NUQTA ID غير موجود" });
      }
      const canonicalRegion = input.region.trim()
        ? await getOrCreateRegion(input.region, ctx.user.id)
        : null;
      const person = await createPerson({
        tenantId: ctx.tenant.id,
        name: existingGlobal?.name ?? input.name.trim(),
        phone: existingGlobal?.phone ?? phone,
        region: existingGlobal?.region ?? input.region.trim(),
        regionId: canonicalRegion?.id ?? existingGlobal?.regionId ?? null,
        nuqtaId: existingGlobal?.nuqtaId ?? input.nuqtaId,
        phoneVerified: false,
      });
      await writeAudit({
        tenantId: ctx.tenant.id,
        actorUserId: ctx.user.id,
        entityType: "person",
        entityId: person.id,
        action: "create",
        beforeJson: null,
        afterJson: person,
        note: null,
      });
      return person;
    }),

  /** تأكيد رقم التليفون (خطوة لازمة قبل إرسال رسائل واتساب له) */
  verifyPhone: tenantQuery
    .input(z.object({ id: z.number().int().positive(), verified: z.boolean().optional().default(true) }))
    .mutation(async ({ ctx, input }) => {
      const person = await getPerson(ctx.tenant.id, input.id);
      if (!person) throw new TRPCError({ code: "NOT_FOUND", message: "الشخص غير موجود" });
      const updated = await updatePerson(ctx.tenant.id, input.id, {
        phoneVerified: input.verified,
      });
      await writeAudit({
        tenantId: ctx.tenant.id,
        actorUserId: ctx.user.id,
        entityType: "person",
        entityId: person.id,
        action: "update",
        beforeJson: { phoneVerified: person.phoneVerified },
        afterJson: { phoneVerified: input.verified },
        note: "تأكيد رقم التليفون",
      });
      return updated;
    }),

  requestPhoneVerification: tenantQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const person = await getPerson(ctx.tenant.id, input.id);
      if (!person) throw new TRPCError({ code: "NOT_FOUND", message: "الشخص غير موجود" });
      const code = createVerificationCode();
      const [{ id }] = await getDb().insert(phoneVerificationChallenges).values({
        tenantId: ctx.tenant.id,
        personId: person.id,
        phone: person.phone,
        codeHash: "pending",
        expiresAt: verificationExpiresAt(),
        attempts: 0,
      }).$returningId();
      await getDb()
        .update(phoneVerificationChallenges)
        .set({ codeHash: hashVerificationCode(id, code) })
        .where(eq(phoneVerificationChallenges.id, id));
      const message = await sendWhatsapp({
        tenantId: ctx.tenant.id,
        personId: person.id,
        phone: person.phone,
        kind: "phone_verification",
        body: `كود تأكيد رقمك في NUQTA هو: ${code}. الكود صالح لمدة 10 دقائق.`,
      });
      return { challengeId: id, status: message.status };
    }),

  confirmPhoneVerification: tenantQuery
    .input(z.object({ challengeId: z.number().int().positive(), code: z.string().regex(/^\d{6}$/) }))
    .mutation(async ({ ctx, input }) => {
      const rows = await getDb()
        .select()
        .from(phoneVerificationChallenges)
        .where(and(eq(phoneVerificationChallenges.tenantId, ctx.tenant.id), eq(phoneVerificationChallenges.id, input.challengeId)))
        .orderBy(desc(phoneVerificationChallenges.createdAt))
        .limit(1);
      const challenge = rows.at(0);
      if (!challenge || !canAttemptVerification(challenge.expiresAt, challenge.attempts, challenge.consumedAt)) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "كود التحقق منتهي أو غير صالح" });
      }
      const valid = hashVerificationCode(challenge.id, input.code) === challenge.codeHash;
      if (!valid) {
        await getDb().update(phoneVerificationChallenges)
          .set({ attempts: challenge.attempts + 1 })
          .where(eq(phoneVerificationChallenges.id, challenge.id));
        throw new TRPCError({ code: "BAD_REQUEST", message: "كود التحقق غير صحيح" });
      }
      await getDb().update(phoneVerificationChallenges)
        .set({ consumedAt: new Date() })
        .where(eq(phoneVerificationChallenges.id, challenge.id));
      const updated = await updatePerson(ctx.tenant.id, challenge.personId, { phoneVerified: true });
      return updated;
    }),

  update: tenantQuery
    .input(
      z.object({
        id: z.number().int().positive(),
        name: z.string().min(2).max(255).optional(),
        phone: z.string().min(6).max(32).optional(),
        region: z.string().max(255).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const person = await getPerson(ctx.tenant.id, input.id);
      if (!person) throw new TRPCError({ code: "NOT_FOUND", message: "الشخص غير موجود" });
      const data: Parameters<typeof updatePerson>[2] = {};
      if (input.name !== undefined) data.name = input.name.trim();
      if (input.region !== undefined) {
        const canonicalRegion = input.region.trim()
          ? await getOrCreateRegion(input.region, ctx.user.id)
          : null;
        data.region = canonicalRegion?.name ?? "";
        data.regionId = canonicalRegion?.id ?? null;
      }
      if (input.phone !== undefined) {
        const phone = normalizePhone(input.phone);
        if (phone !== person.phone) {
          const clash = await findPersonByPhone(ctx.tenant.id, phone);
          if (clash && clash.id !== person.id) {
            throw new TRPCError({
              code: "CONFLICT",
              message: `الرقم ده مسجل باسم «${clash.name}»`,
            });
          }
          data.phone = phone;
          // تغيير الرقم يلغي التأكيد
          data.phoneVerified = false;
        }
      }
      const updated = await updatePerson(ctx.tenant.id, input.id, data);
      await writeAudit({
        tenantId: ctx.tenant.id,
        actorUserId: ctx.user.id,
        entityType: "person",
        entityId: person.id,
        action: "update",
        beforeJson: person,
        afterJson: updated ?? null,
        note: null,
      });
      return updated;
    }),

  /** الحذف ممنوع لو للشخص نقوط أو أفراح مرتبطة (حماية للدفاتر) */
  delete: tenantQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const person = await getPerson(ctx.tenant.id, input.id);
      if (!person) throw new TRPCError({ code: "NOT_FOUND", message: "الشخص غير موجود" });
      const joined = await listTenantNuqtatJoined(ctx.tenant.id);
      const involved = joined.some(
        (n) => n.payerId === person.id || n.hostId === person.id,
      );
      if (involved) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "ممنوع حذف شخص له نقوط أو أفراح مسجلة — عدّل بياناته بدل الحذف",
        });
      }
      await deletePerson(ctx.tenant.id, input.id);
      await writeAudit({
        tenantId: ctx.tenant.id,
        actorUserId: ctx.user.id,
        entityType: "person",
        entityId: person.id,
        action: "delete",
        beforeJson: person,
        afterJson: null,
        note: null,
      });
      return { success: true };
    }),
});
