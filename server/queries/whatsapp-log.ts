import { and, desc, eq, gte, type SQL } from "drizzle-orm";
import {
  whatsappMessages,
  type InsertWhatsappMessage,
  type WhatsappMessage,
} from "@db/schema";
import { getDb } from "./connection.js";

export async function logWhatsappMessage(
  data: Omit<InsertWhatsappMessage, "id">,
): Promise<WhatsappMessage> {
  const [{ id }] = await getDb()
    .insert(whatsappMessages)
    .values(data)
    .$returningId();
  const rows = await getDb()
    .select()
    .from(whatsappMessages)
    .where(eq(whatsappMessages.id, id))
    .limit(1);
  return rows[0];
}

export async function updateWhatsappStatus(
  id: number,
  status: WhatsappMessage["status"],
) {
  await getDb()
    .update(whatsappMessages)
    .set({ status })
    .where(eq(whatsappMessages.id, id));
}

export async function listWhatsappMessages(
  tenantId: number,
  filters?: {
    kind?: WhatsappMessage["kind"];
    direction?: WhatsappMessage["direction"];
    eventId?: number;
    personId?: number;
    since?: Date;
    limit?: number;
  },
) {
  const conds: SQL[] = [eq(whatsappMessages.tenantId, tenantId)];
  if (filters?.kind) conds.push(eq(whatsappMessages.kind, filters.kind));
  if (filters?.direction)
    conds.push(eq(whatsappMessages.direction, filters.direction));
  if (filters?.eventId)
    conds.push(eq(whatsappMessages.eventId, filters.eventId));
  if (filters?.personId)
    conds.push(eq(whatsappMessages.personId, filters.personId));
  if (filters?.since) conds.push(gte(whatsappMessages.createdAt, filters.since));
  return getDb()
    .select()
    .from(whatsappMessages)
    .where(and(...conds))
    .orderBy(desc(whatsappMessages.createdAt))
    .limit(filters?.limit ?? 200);
}

/** هل أُرسل تذكير لهذا الشخص عن هذا الفرح اليوم؟ (منع التكرار اليومي) */
export async function reminderSentToday(
  tenantId: number,
  eventId: number,
  personId: number,
): Promise<boolean> {
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const rows = await getDb()
    .select({ id: whatsappMessages.id })
    .from(whatsappMessages)
    .where(
      and(
        eq(whatsappMessages.tenantId, tenantId),
        eq(whatsappMessages.eventId, eventId),
        eq(whatsappMessages.personId, personId),
        eq(whatsappMessages.kind, "reminder"),
        eq(whatsappMessages.direction, "out"),
        gte(whatsappMessages.createdAt, dayStart),
      ),
    )
    .limit(1);
  return rows.length > 0;
}
