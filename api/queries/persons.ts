import { and, desc, eq, isNotNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { persons, type InsertPerson, type Person } from "@db/schema";
import { getDb } from "./connection";
import { searchPersons } from "./person-search";

export async function listPersons(tenantId: number): Promise<Person[]> {
  return getDb()
    .select()
    .from(persons)
    .where(eq(persons.tenantId, tenantId))
    .orderBy(persons.name);
}

export async function searchTenantPersons(
  tenantId: number,
  query: string,
  limit = 20,
) {
  const all = await listPersons(tenantId);
  return searchPersons(all, query, limit);
}

export async function getPerson(tenantId: number, id: number) {
  const rows = await getDb()
    .select()
    .from(persons)
    .where(and(eq(persons.tenantId, tenantId), eq(persons.id, id)))
    .limit(1);
  return rows.at(0);
}

export async function findPersonByPhone(tenantId: number, phone: string) {
  const rows = await getDb()
    .select()
    .from(persons)
    .where(and(eq(persons.tenantId, tenantId), eq(persons.phone, phone)))
    .limit(1);
  return rows.at(0);
}

/** يبحث عن شخص بالتليفون عبر كل المستأجرين (للبوت الوارد) */
export async function findPersonByPhoneAnyTenant(phone: string) {
  const rows = await getDb()
    .select()
    .from(persons)
    .where(eq(persons.phone, phone))
    .limit(1);
  return rows.at(0);
}

export async function findPersonsByPhoneAnyTenant(phone: string): Promise<Person[]> {
  return getDb().select().from(persons).where(eq(persons.phone, phone));
}

export async function findPersonByNuqtaId(nuqtaId: string) {
  const rows = await getDb()
    .select()
    .from(persons)
    .where(eq(persons.nuqtaId, nuqtaId))
    .limit(1);
  return rows.at(0);
}

export async function searchGlobalPersons(query: string, limit = 20) {
  const all = await getDb().select().from(persons).where(isNotNull(persons.nuqtaId));
  const unique = new Map<string, Person>();
  for (const person of all) {
    if (person.nuqtaId && !unique.has(person.nuqtaId)) unique.set(person.nuqtaId, person);
  }
  return searchPersons([...unique.values()], query, limit);
}

function newNuqtaId(): string {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase();
  return `NQ-${suffix}`;
}

export async function createPerson(data: InsertPerson): Promise<Person> {
  const values: InsertPerson = {
    ...data,
    nuqtaId: data.nuqtaId ?? newNuqtaId(),
  };
  const [{ id }] = await getDb().insert(persons).values(values).$returningId();
  const created = await getPerson(data.tenantId, id);
  if (!created) throw new Error("Failed to create person");
  return created;
}

export async function updatePerson(
  tenantId: number,
  id: number,
  data: Partial<Pick<Person, "name" | "phone" | "region" | "regionId" | "phoneVerified">>,
) {
  await getDb()
    .update(persons)
    .set(data)
    .where(and(eq(persons.tenantId, tenantId), eq(persons.id, id)));
  return getPerson(tenantId, id);
}

export async function deletePerson(tenantId: number, id: number) {
  await getDb()
    .delete(persons)
    .where(and(eq(persons.tenantId, tenantId), eq(persons.id, id)));
}

export async function countPersons(tenantId: number) {
  const all = await getDb()
    .select({ id: persons.id })
    .from(persons)
    .where(eq(persons.tenantId, tenantId));
  return all.length;
}

export async function recentPersons(tenantId: number, limit = 8) {
  return getDb()
    .select()
    .from(persons)
    .where(eq(persons.tenantId, tenantId))
    .orderBy(desc(persons.createdAt))
    .limit(limit);
}
