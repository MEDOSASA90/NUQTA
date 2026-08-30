import { and, desc, eq, isNull } from "drizzle-orm";
import {
  events,
  nuqtat,
  persons,
  type InsertNuqta,
  type Nuqta,
} from "@db/schema";
import { getDb } from "./connection.js";
import type { NuqtaLike } from "./balance-core.js";

/** نقطة + بيانات محلولة (الدافع وصاحب الفرح) لحسابات الأرصدة */
export type NuqtaJoined = NuqtaLike & {
  payerName: string;
  payerRegion: string;
  hostName: string;
  hostPersonId: number | null;
  eventDate: Date;
  eventStatus: "upcoming" | "open" | "done";
  invitedBy: string;
  whatsappNotified: boolean;
  editedAfterDone: boolean;
};

/** كل نقوط المستأجر مع حلّ هوية صاحب الفرح (الشخص المسجل فقط يدخل حساب الأزواج) */
export async function listTenantNuqtatJoined(
  tenantId: number,
): Promise<NuqtaJoined[]> {
  const rows = await getDb()
    .select({ n: nuqtat, e: events, p: persons })
    .from(nuqtat)
    .innerJoin(events, eq(events.id, nuqtat.eventId))
    .innerJoin(persons, eq(persons.id, nuqtat.payerPersonId))
    .where(and(eq(nuqtat.tenantId, tenantId), isNull(nuqtat.voidedAt)))
    .orderBy(nuqtat.createdAt);

  return rows.map(({ n, e, p }) => ({
    id: n.id,
    payerId: n.payerPersonId,
    // لو صاحب الفرح مش مسجل كشخص، النقطة لا تصنع رصيدًا ثنائيًا
    hostId: e.hostPersonId ?? -1,
    hostPersonId: e.hostPersonId,
    hostName: e.hostName,
    amount: n.amount,
    eventId: n.eventId,
    eventDate: new Date(e.eventDate),
    eventStatus: e.status,
    invitedBy: n.invitedBy,
    whatsappNotified: n.whatsappNotified,
    editedAfterDone: n.editedAfterDone,
    createdAt: n.createdAt,
    payerName: p.name,
    payerRegion: p.region,
  }));
}

export async function listNuqtatByEvent(tenantId: number, eventId: number) {
  const rows = await getDb()
    .select({ n: nuqtat, p: persons })
    .from(nuqtat)
    .innerJoin(persons, eq(persons.id, nuqtat.payerPersonId))
    .where(and(eq(nuqtat.tenantId, tenantId), eq(nuqtat.eventId, eventId), isNull(nuqtat.voidedAt)))
    .orderBy(nuqtat.createdAt);
  return rows.map(({ n, p }) => ({
    ...n,
    payerName: p.name,
    payerRegion: p.region,
    payerPhone: p.phone,
  }));
}

export async function listRecentNuqtat(tenantId: number, limit = 10) {
  const rows = await getDb()
    .select({ n: nuqtat, p: persons, e: events })
    .from(nuqtat)
    .innerJoin(persons, eq(persons.id, nuqtat.payerPersonId))
    .innerJoin(events, eq(events.id, nuqtat.eventId))
    .where(and(eq(nuqtat.tenantId, tenantId), isNull(nuqtat.voidedAt)))
    .orderBy(desc(nuqtat.createdAt))
    .limit(limit);
  return rows.map(({ n, p, e }) => ({
    ...n,
    payerName: p.name,
    payerRegion: p.region,
    hostName: e.hostName,
    eventDate: new Date(e.eventDate),
  }));
}

export async function getNuqta(tenantId: number, id: number) {
  const rows = await getDb()
    .select()
    .from(nuqtat)
    .where(and(eq(nuqtat.tenantId, tenantId), eq(nuqtat.id, id)))
    .limit(1);
  return rows.at(0);
}

export async function createNuqta(data: InsertNuqta): Promise<Nuqta> {
  const [{ id }] = await getDb().insert(nuqtat).values(data).$returningId();
  const created = await getNuqta(data.tenantId, id);
  if (!created) throw new Error("Failed to create nuqta");
  return created;
}

export async function updateNuqta(
  tenantId: number,
  id: number,
  data: Partial<
    Pick<
      Nuqta,
      | "amount"
      | "invitedBy"
      | "payerPersonId"
      | "eventId"
      | "whatsappNotified"
      | "editedAfterDone"
      | "notificationSentAt"
      | "voidedAt"
      | "voidedByUserId"
      | "voidReason"
    >
  >,
) {
  await getDb()
    .update(nuqtat)
    .set(data)
    .where(and(eq(nuqtat.tenantId, tenantId), eq(nuqtat.id, id)));
  return getNuqta(tenantId, id);
}

export async function deleteNuqta(tenantId: number, id: number) {
  await getDb()
    .delete(nuqtat)
    .where(and(eq(nuqtat.tenantId, tenantId), eq(nuqtat.id, id)));
}

/** أشخاص تفاعلوا مع صاحب فرح سابقًا (دفعوا في أفراحه أو دفع في أفراحهم) */
export async function counterpartiesOf(
  tenantId: number,
  hostPersonId: number,
): Promise<number[]> {
  const joined = await listTenantNuqtatJoined(tenantId);
  const set = new Set<number>();
  for (const n of joined) {
    if (n.hostId === hostPersonId && n.payerId !== hostPersonId)
      set.add(n.payerId);
    if (n.payerId === hostPersonId && n.hostId > 0 && n.hostId !== hostPersonId)
      set.add(n.hostId);
  }
  return [...set];
}
