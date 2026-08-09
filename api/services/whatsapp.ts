/**
 * خدمة واتساب — طبقة abstraction:
 * لو مضبوطين WHATSAPP_TOKEN + WHATSAPP_PHONE_ID ⇒ إرسال حقيقي عبر
 * WhatsApp Cloud API (graph.facebook.com)، وإلا وضع «محاكاة» يسجل
 * الرسالة في whatsapp_messages بحالة simulated — الكود جاهز للإنتاج
 * بمجرد ضبط المفاتيح.
 */
import type { WhatsappMessage } from "@db/schema";
import {
  logWhatsappMessage,
  updateWhatsappStatus,
} from "../queries/whatsapp-log";

const WA_TOKEN = process.env.WHATSAPP_TOKEN ?? "";
const WA_PHONE_ID = process.env.WHATSAPP_PHONE_ID ?? "";
const WA_API_VERSION = process.env.WHATSAPP_API_VERSION ?? "v21.0";

export function isCloudConfigured(): boolean {
  return Boolean(WA_TOKEN && WA_PHONE_ID);
}

export type SendWhatsappParams = {
  tenantId: number;
  personId?: number | null;
  phone: string;
  kind: WhatsappMessage["kind"];
  body: string;
  eventId?: number | null;
  nuqtaId?: number | null;
};

/** يسجل الرسالة ويرسلها (أو يحاكي الإرسال) ويعيد السجل النهائي */
export async function sendWhatsapp(
  params: SendWhatsappParams,
): Promise<WhatsappMessage> {
  const queued = await logWhatsappMessage({
    tenantId: params.tenantId,
    personId: params.personId ?? null,
    phone: params.phone,
    direction: "out",
    kind: params.kind,
    body: params.body,
    status: "queued",
    eventId: params.eventId ?? null,
    nuqtaId: params.nuqtaId ?? null,
  });

  if (!isCloudConfigured()) {
    await updateWhatsappStatus(queued.id, "simulated");
    return { ...queued, status: "simulated" };
  }

  try {
    const resp = await fetch(
      `https://graph.facebook.com/${WA_API_VERSION}/${WA_PHONE_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${WA_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: params.phone,
          type: "text",
          text: { preview_url: false, body: params.body },
        }),
      },
    );
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Cloud API ${resp.status}: ${text}`);
    }
    await updateWhatsappStatus(queued.id, "sent");
    return { ...queued, status: "sent" };
  } catch (err) {
    console.error("[whatsapp] send failed:", err);
    await updateWhatsappStatus(queued.id, "failed");
    return { ...queued, status: "failed" };
  }
}

// ─── تنسيق الأرقام والتواريخ للرسائل ────────────────────────────────────────

export function formatMoneyAr(n: number): string {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.abs(n))} ج.م`;
}

const AR_MONTHS = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

export function formatDateAr(d: Date): string {
  return `${d.getDate()} ${AR_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
