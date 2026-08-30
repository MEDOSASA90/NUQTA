import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router.js";
import { createContext } from "./context.js";
import { env } from "./lib/env.js";
import { authenticateRequest, createOAuthCallbackHandler } from "./kimi/auth.js";
import { Paths } from "@contracts/constants";
import { sendDailyReminders } from "./services/reminders.js";
import { handleBotMessage } from "./services/whatsapp-bot.js";
import { getReportById } from "./queries/reports.js";
import { getEvent } from "./queries/events.js";
import { isMemberOfTenant } from "./queries/tenants.js";
import { reportFilePath } from "./services/report-pdf.js";
import { getDb } from "./queries/connection.js";
import { sql } from "drizzle-orm";

const app = new Hono<{ Bindings: HttpBindings }>();

app.get("/api/health", async (c) => {
  try {
    await getDb().execute(sql`select 1`);
    return c.json({ ok: true, database: "up" });
  } catch (error) {
    console.error(JSON.stringify({
      event: "health_check_failed",
      message: error instanceof Error ? error.message : "unknown error",
    }));
    return c.json({ ok: false, database: "down" }, 503);
  }
});

app.use(bodyLimit({ maxSize: 50 * 1024 * 1024 }));
app.get(Paths.oauthCallback, createOAuthCallbackHandler());

// ── النظام أ: cron يومي للتذكيرات (GET /api/cron/daily-reminders) ──
app.get("/api/cron/daily-reminders", async (c) => {
  const secret = process.env.CRON_SECRET;
  if (secret && c.req.header("x-cron-secret") !== secret) {
    return c.json({ error: "Forbidden" }, 403);
  }
  const results = await sendDailyReminders();
  return c.json({ ok: true, results });
});

// ── النظام ج: webhook البوت (استقبال رسائل Cloud API + نصوص مفرّغة) ──
app.get("/api/whatsapp/webhook", (c) => {
  // توثيق Meta webhook (hub.challenge)
  const mode = c.req.query("hub.mode");
  const token = c.req.query("hub.verify_token");
  const challenge = c.req.query("hub.challenge");
  const expected = process.env.WHATSAPP_VERIFY_TOKEN ?? "afrah-verify";
  if (mode === "subscribe" && token === expected && challenge) {
    return c.text(challenge);
  }
  return c.json({ error: "Forbidden" }, 403);
});

type WaCloudMessage = {
  from?: string;
  type?: string;
  text?: { body?: string };
  audio?: { transcript?: string };
  transcript?: string;
};

app.post("/api/whatsapp/webhook", async (c) => {
  const payload = await c.req.json().catch(() => null);
  if (!payload || typeof payload !== "object") {
    return c.json({ error: "Bad payload" }, 400);
  }

  // صيغة مبسطة للاختبار: { phone, text }
  const simple = payload as { phone?: string; text?: string };
  if (simple.phone && simple.text) {
    const reply = await handleBotMessage(null, simple.phone, simple.text);
    return c.json({ ok: true, reply });
  }

  // صيغة WhatsApp Cloud API
  const replies: unknown[] = [];
  const entries = (payload as { entry?: { changes?: { value?: { messages?: WaCloudMessage[] } }[] }[] })
    .entry ?? [];
  for (const entry of entries) {
    for (const change of entry.changes ?? []) {
      for (const msg of change.value?.messages ?? []) {
        const phone = msg.from;
        if (!phone) continue;
        let text = "";
        if (msg.type === "text") text = msg.text?.body ?? "";
        else if (msg.type === "audio")
          text = msg.audio?.transcript ?? msg.transcript ?? "";
        if (!text) {
          replies.push({
            phone,
            note: "رسالة غير نصية — نحتاج نصًا أو تفريغًا صوتيًا",
          });
          continue;
        }
        replies.push(await handleBotMessage(null, phone, text));
      }
    }
  }
  return c.json({ ok: true, replies });
});

// ── تقديم ملفات تقارير PDF (للأعضاء فقط) ──
app.get("/api/reports/file/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) return c.json({ error: "Bad id" }, 400);
  let user;
  try {
    user = await authenticateRequest(c.req.raw.headers);
  } catch {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const report = await getReportById(id);
  if (!report) return c.json({ error: "Not found" }, 404);
  if (!(await isMemberOfTenant(user.id, report.tenantId))) {
    return c.json({ error: "Forbidden" }, 403);
  }
  const file = await import("fs/promises")
    .then((fs) => fs.readFile(reportFilePath(report.id)))
    .catch(() => null);
  if (!file) return c.json({ error: "File missing" }, 404);
  // اسم ملف عربي منطقي: filename* بترميز UTF-8 (RFC 5987) يفضّله المتصفح،
  // مع filename لاتيني احتياطي للعملاء القدامى. inline ليفتح داخل المتصفح
  // ويبقى التحميل متاحًا من عارض PDF أو عبر سمة download في الروابط.
  const event = await getEvent(report.tenantId, report.eventId).catch(() => null);
  const host = event?.hostName?.trim().replace(/[\\/:*?"<>|]/g, "") ?? "";
  const utf8Name = encodeURIComponent(
    host ? `كشف-حساب-فرحة-${host}.pdf` : `تقرير-${report.id}.pdf`,
  ).replace(/['()*]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`);
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="report-${report.id}.pdf"; filename*=UTF-8''${utf8Name}`,
      "Cache-Control": "private, no-store",
    },
  });
});

app.use("/api/trpc/*", async (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
});
app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

app.onError((error, c) => {
  console.error(JSON.stringify({
    event: "unhandled_request_error",
    method: c.req.method,
    path: c.req.path,
    message: error.message,
  }));
  return c.json({ error: "Internal server error" }, 500);
});

export default app;

if (env.isProduction) {
  const { serveStaticFiles } = await import("./lib/vite.js");
  serveStaticFiles(app);

  if (!process.env.VERCEL) {
    const { serve } = await import("@hono/node-server");
    const port = parseInt(process.env.PORT || "3000");
    serve({ fetch: app.fetch, port }, () => {
      console.log(`Server running on http://localhost:${port}/`);
    });
  }
}
