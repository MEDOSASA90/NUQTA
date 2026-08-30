import { z } from "zod";
import { updateNuqta } from "../queries/nuqtat.js";
import { listReadyNotificationJobs, markNotificationFailed, markNotificationProcessing, markNotificationSent, reclaimStaleNotificationJobs } from "../queries/notification-jobs.js";
import { sendWhatsapp } from "./whatsapp.js";

const payloadSchema = z.object({
  tenantId: z.number().int().positive(),
  personId: z.number().int().positive(),
  phone: z.string().min(6),
  body: z.string().min(1),
  eventId: z.number().int().positive(),
  nuqtaId: z.number().int().positive(),
});

export type NotificationWorkerSummary = {
  processed: number;
  sent: number;
  failed: number;
};

export async function processNotificationJobs(limit = 20): Promise<NotificationWorkerSummary> {
  const summary: NotificationWorkerSummary = { processed: 0, sent: 0, failed: 0 };
  await reclaimStaleNotificationJobs();
  const jobs = await listReadyNotificationJobs(limit);
  for (const job of jobs) {
    summary.processed += 1;
    const attempts = job.attempts + 1;
    const claimed = await markNotificationProcessing(job.id, attempts);
    if (!claimed) {
      summary.processed -= 1;
      continue;
    }
    try {
      const payload = payloadSchema.parse(job.payload);
      const result = await sendWhatsapp({ ...payload, kind: job.kind });
      if (result.status === "failed") throw new Error("WhatsApp provider rejected the message");
      await markNotificationSent(job.id);
      await updateNuqta(payload.tenantId, payload.nuqtaId, { whatsappNotified: true, notificationSentAt: new Date() });
      summary.sent += 1;
    } catch (error) {
      summary.failed += 1;
      await markNotificationFailed(job.id, attempts, error instanceof Error ? error.message : "Notification failed");
    }
  }
  return summary;
}
