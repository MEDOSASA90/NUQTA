import { and, asc, desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { events, type Event, type InsertEvent } from "@db/schema";
import { getDb } from "./connection";

export async function listEvents(tenantId: number): Promise<Event[]> {
  return getDb()
    .select()
    .from(events)
    .where(eq(events.tenantId, tenantId))
    .orderBy(asc(events.eventDate));
}

export async function listEventsDesc(tenantId: number): Promise<Event[]> {
  return getDb()
    .select()
    .from(events)
    .where(eq(events.tenantId, tenantId))
    .orderBy(desc(events.eventDate));
}

export async function getEvent(tenantId: number, id: number) {
  const rows = await getDb()
    .select()
    .from(events)
    .where(and(eq(events.tenantId, tenantId), eq(events.id, id)))
    .limit(1);
  return rows.at(0);
}

export async function getEventByToken(token: string) {
  const rows = await getDb()
    .select()
    .from(events)
    .where(eq(events.shareToken, token))
    .limit(1);
  return rows.at(0);
}

export async function createEvent(
  data: Omit<InsertEvent, "shareToken">,
): Promise<Event> {
  const [{ id }] = await getDb()
    .insert(events)
    .values({ ...data, shareToken: nanoid(24) })
    .$returningId();
  const created = await getEvent(data.tenantId, id);
  if (!created) throw new Error("Failed to create event");
  return created;
}

export async function updateEvent(
  tenantId: number,
  id: number,
  data: Partial<
    Pick<
      Event,
      | "hostPersonId"
      | "hostName"
      | "eventDate"
      | "place"
      | "status"
      | "lifecycleStatus"
      | "openedAt"
      | "closedAt"
      | "closedByUserId"
    >
  >,
) {
  await getDb()
    .update(events)
    .set(data)
    .where(and(eq(events.tenantId, tenantId), eq(events.id, id)));
  return getEvent(tenantId, id);
}

export async function regenerateShareToken(tenantId: number, id: number) {
  const shareToken = nanoid(24);
  await getDb()
    .update(events)
    .set({ shareToken })
    .where(and(eq(events.tenantId, tenantId), eq(events.id, id)));
  return getEvent(tenantId, id);
}

/** الأفراح القادمة التي يبعد تاريخها ≤ days من اليوم (للنظام أ) */
export async function eventsWithinDays(tenantId: number, days: number) {
  const all = await listEvents(tenantId);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return all.filter((e) => {
    if (e.status !== "upcoming") return false;
    const d = new Date(e.eventDate);
    const diffDays = Math.round(
      (d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );
    return diffDays >= 0 && diffDays <= days;
  });
}
