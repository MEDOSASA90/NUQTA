import { asc, eq } from "drizzle-orm";
import { regions, type Region } from "@db/schema";
import { getDb } from "./connection";
import { canonicalRegionName, regionKey } from "../domain/regions";

export async function listRegions(): Promise<Region[]> {
  return getDb().select().from(regions).orderBy(asc(regions.name));
}

export async function getRegionByKey(normalizedName: string): Promise<Region | undefined> {
  const rows = await getDb().select().from(regions).where(eq(regions.normalizedName, normalizedName)).limit(1);
  return rows.at(0);
}

export async function getOrCreateRegion(name: string, createdByUserId: number): Promise<Region> {
  const canonical = canonicalRegionName(name);
  const key = regionKey(canonical);
  const existing = await getRegionByKey(key);
  if (existing) return existing;
  const [{ id }] = await getDb().insert(regions).values({
    name: canonical,
    normalizedName: key,
    createdByUserId,
  }).$returningId();
  const created = await getRegionByKey(key);
  if (!created || created.id !== id) throw new Error("Failed to create region");
  return created;
}

