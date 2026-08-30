import { and, eq, lte, lt, or, asc } from "drizzle-orm";
import {
  notificationJobs,
  type InsertNotificationJob,
  type NotificationJob,
} from "@db/schema";
import { getDb } from "./connection.js";

export async function enqueueNotificationJob(data: InsertNotificationJob): Promise<NotificationJob> {
  try {
    await getDb().insert(notificationJobs).values(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!message.toLowerCase().includes("duplicate")) throw error;
  }
  const rows = await getDb()
    .select()
    .from(notificationJobs)
    .where(eq(notificationJobs.idempotencyKey, data.idempotencyKey))
    .limit(1);
  const job = rows.at(0);
  if (!job) throw new Error("Notification job was not persisted");
  return job;
}

export async function listReadyNotificationJobs(limit = 20): Promise<NotificationJob[]> {
  const now = new Date();
  return getDb()
    .select()
    .from(notificationJobs)
    .where(
      and(
        lte(notificationJobs.nextAttemptAt, now),
        or(eq(notificationJobs.status, "queued"), eq(notificationJobs.status, "failed")),
      ),
    )
    .orderBy(asc(notificationJobs.nextAttemptAt), asc(notificationJobs.id))
    .limit(limit);
}

export async function reclaimStaleNotificationJobs(): Promise<void> {
  const cutoff = new Date(Date.now() - 10 * 60_000);
  await getDb()
    .update(notificationJobs)
    .set({ status: "failed", nextAttemptAt: new Date(), lastError: "Recovered after worker timeout" })
    .where(and(eq(notificationJobs.status, "processing"), lt(notificationJobs.updatedAt, cutoff)));
}

export async function markNotificationProcessing(id: number, attempts: number): Promise<boolean> {
  const result = await getDb()
    .update(notificationJobs)
    .set({ status: "processing", attempts })
    .where(and(eq(notificationJobs.id, id), or(eq(notificationJobs.status, "queued"), eq(notificationJobs.status, "failed"))));
  return result[0].affectedRows === 1;
}

export async function markNotificationSent(id: number): Promise<void> {
  await getDb().update(notificationJobs).set({ status: "sent", lastError: null }).where(eq(notificationJobs.id, id));
}

export async function markNotificationFailed(id: number, attempts: number, error: string): Promise<void> {
  const delayMinutes = Math.min(60, 2 ** Math.min(attempts, 5));
  const nextAttemptAt = new Date(Date.now() + delayMinutes * 60_000);
  await getDb().update(notificationJobs).set({ status: "failed", attempts, nextAttemptAt, lastError: error.slice(0, 1000) }).where(eq(notificationJobs.id, id));
}
