/**
 * النظام أ — تذكير ما قبل الفرح (Broadcast يومي).
 * endpoint الـ cron في boot.ts يستدعي sendDailyReminders()،
 * وأيضًا متاح يدويًا للاختبار عبر whatsapp.sendRemindersNow.
 */
import { DEFAULT_REMINDER_DAYS } from "@contracts/afrah";
import { eventsWithinDays, getEvent } from "../queries/events";
import { listPersons } from "../queries/persons";
import { counterpartiesOf, listTenantNuqtatJoined } from "../queries/nuqtat";
import { getTenantById, listTenants } from "../queries/tenants";
import { reminderSentToday } from "../queries/whatsapp-log";
import { computeSettlement } from "../queries/balance-core";
import { sendWhatsapp } from "./whatsapp";
import { composeReminderBody } from "./whatsapp-messages";

export type ReminderSummary = {
  tenantId: number;
  eventId: number;
  hostName: string;
  sent: number;
  skippedAlreadySentToday: number;
  skippedUnverified: number;
};

function daysUntil(date: Date): number {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/** يرسل تذكيرات فرحة واحدة لمن سبق وتعامل مع صاحبها */
export async function sendEventReminders(
  tenantId: number,
  eventId: number,
): Promise<ReminderSummary> {
  const [event, tenant, persons, joined] = await Promise.all([
    getEvent(tenantId, eventId),
    getTenantById(tenantId),
    listPersons(tenantId),
    listTenantNuqtatJoined(tenantId),
  ]);
  if (!event) throw new Error(`Event ${eventId} not found in tenant ${tenantId}`);
  const summary: ReminderSummary = {
    tenantId,
    eventId,
    hostName: event.hostName,
    sent: 0,
    skippedAlreadySentToday: 0,
    skippedUnverified: 0,
  };
  if (!event.hostPersonId) return summary;

  const byId = new Map(persons.map((p) => [p.id, p]));
  const targets = await counterpartiesOf(tenantId, event.hostPersonId);
  const left = daysUntil(new Date(event.eventDate));

  for (const personId of targets) {
    const person = byId.get(personId);
    if (!person) continue;
    if (!person.phoneVerified) {
      summary.skippedUnverified += 1;
      continue;
    }
    if (await reminderSentToday(tenantId, eventId, personId)) {
      summary.skippedAlreadySentToday += 1;
      continue;
    }
    const settlement = computeSettlement(joined, personId, event.hostPersonId, 0);
    const body = composeReminderBody({
      brand: tenant?.name ?? "دفتر الأفراح",
      personName: person.name,
      hostName: event.hostName,
      eventDate: new Date(event.eventDate),
      place: event.place,
      daysLeft: left,
      outstanding: settlement.outstandingBefore,
    });
    await sendWhatsapp({
      tenantId,
      personId,
      phone: person.phone,
      kind: "reminder",
      body,
      eventId,
    });
    summary.sent += 1;
  }
  return summary;
}

/** الـ cron اليومي: كل المستأجرين اللي مفعّلين النظام أ */
export async function sendDailyReminders(): Promise<ReminderSummary[]> {
  const results: ReminderSummary[] = [];
  const tenants = await listTenants();
  for (const tenant of tenants) {
    const settings = tenant.settings ?? {};
    if (settings.remindersEnabled === false) continue;
    const days = settings.reminderDays ?? DEFAULT_REMINDER_DAYS;
    const upcoming = await eventsWithinDays(tenant.id, days);
    for (const ev of upcoming) {
      results.push(await sendEventReminders(tenant.id, ev.id));
    }
  }
  return results;
}
