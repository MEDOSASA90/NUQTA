/**
 * طبقة الأرصدة فوق قاعدة البيانات — تجلب النقوط وتستخدم balance-core النقي.
 */
import type {
  BalanceRow,
  PairInteraction,
  PersonNet,
  SettledNotice,
} from "@contracts/afrah";
import {
  computeAllPairs,
  computePair,
  computePersonNet,
  findSettlements,
  nuqtatBetween,
} from "./balance-core";
import { listTenantNuqtatJoined, type NuqtaJoined } from "./nuqtat";
import { listPersons } from "./persons";

function eventLabelOf(n: NuqtaJoined): string {
  return `فرحة ${n.hostName}`;
}

/** كل الأرصدة الثنائية في الشبكة مع الصافي وعدد التفاعلات والحالة */
export async function computeMatrix(tenantId: number): Promise<BalanceRow[]> {
  const [joined, persons] = await Promise.all([
    listTenantNuqtatJoined(tenantId),
    listPersons(tenantId),
  ]);
  const byId = new Map(persons.map((p) => [p.id, p]));
  const pairs = computeAllPairs(joined);
  return pairs.map((p) => {
    const a = byId.get(p.personAId);
    const b = byId.get(p.personBId);
    return {
      ...p,
      personAName: a?.name ?? `#${p.personAId}`,
      personARegion: a?.region ?? "",
      personBName: b?.name ?? `#${p.personBId}`,
      personBRegion: b?.region ?? "",
    };
  });
}

/** تفاصيل كل مرة بين شخصين في الاتجاهين (مبلغ + تاريخ + فرح) */
export async function computePairDetails(
  tenantId: number,
  aId: number,
  bId: number,
): Promise<{ balance: BalanceRow | null; interactions: PairInteraction[] }> {
  const [joined, persons] = await Promise.all([
    listTenantNuqtatJoined(tenantId),
    listPersons(tenantId),
  ]);
  const byId = new Map(persons.map((p) => [p.id, p]));
  const lo = Math.min(aId, bId);
  const hi = Math.max(aId, bId);
  const between = nuqtatBetween(joined, lo, hi);
  const interactions: PairInteraction[] = between.map((n) => ({
    nuqtaId: n.id,
    direction: n.payerId === lo ? "a_to_b" : "b_to_a",
    payerId: n.payerId,
    payerName: n.payerName,
    hostId: n.hostId,
    hostName: n.hostName,
    amount: n.amount,
    eventId: n.eventId,
    eventLabel: eventLabelOf(n),
    eventDate: n.eventDate,
    invitedBy: n.invitedBy,
    createdAt: n.createdAt,
  }));

  if (between.length === 0) return { balance: null, interactions };
  const comp = computePair(lo, hi, between);
  const a = byId.get(lo);
  const b = byId.get(hi);
  return {
    balance: {
      ...comp,
      personAName: a?.name ?? `#${lo}`,
      personARegion: a?.region ?? "",
      personBName: b?.name ?? `#${hi}`,
      personBRegion: b?.region ?? "",
    },
    interactions,
  };
}

/** الصافي الكلي لشخص عبر الشبكة */
export async function computePersonNetDb(
  tenantId: number,
  personId: number,
): Promise<PersonNet> {
  const joined = await listTenantNuqtatJoined(tenantId);
  return computePersonNet(joined, personId);
}

/** قائمة «فلان صفّى حسابه معاك» بالأسماء محلولة */
export async function computeSettledNotices(
  tenantId: number,
): Promise<SettledNotice[]> {
  const [joined, persons] = await Promise.all([
    listTenantNuqtatJoined(tenantId),
    listPersons(tenantId),
  ]);
  const byId = new Map(persons.map((p) => [p.id, p]));
  const eventLabelByEventId = new Map<number, string>();
  for (const n of joined) eventLabelByEventId.set(n.eventId, eventLabelOf(n));
  return findSettlements(joined).map((s) => ({
    ...s,
    settlerName: byId.get(s.settlerId)?.name ?? `#${s.settlerId}`,
    hostName: byId.get(s.hostId)?.name ?? `#${s.hostId}`,
    eventLabel: eventLabelByEventId.get(s.eventId) ?? `فرحة #${s.eventId}`,
  }));
}
