import { Hono } from "hono";
import type { HttpBindings } from "@hono/node-server";
import { z } from "zod";
import { appRouter } from "./router.js";
import { authenticateRequest } from "./kimi/auth.js";
import type { TrpcContext } from "./context.js";
import { getDb } from "./queries/connection.js";
import { sql } from "drizzle-orm";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

const contributionSchema = z.object({
  eventId: z.number().int().positive(),
  payerPersonId: z.number().int().positive(),
  amount: z.number().int().positive(),
  invitedBy: z.string().max(255).optional(),
});

const personSchema = z.object({
  name: z.string().min(2).max(255),
  phone: z.string().min(6).max(32),
  region: z.string().max(255).optional(),
  nuqtaId: z.string().regex(/^NQ-[A-Z0-9]{10,32}$/).optional(),
});

const eventSchema = z.object({
  hostPersonId: z.number().int().positive().nullable().optional(),
  hostName: z.string().max(255).optional(),
  eventDate: z.coerce.date(),
  place: z.string().max(255).optional(),
});

const transitionSchema = z.object({
  to: z.enum(["scheduled", "live", "completed", "archived"]),
});

export const restApi = new Hono<{
  Bindings: HttpBindings;
  Variables: { requestId: string };
}>();

export function openApiDocument() {
  return {
    openapi: "3.0.3",
    info: { title: "NUQTA API", version: "1.0.0", description: "Versioned REST API for the NUQTA ledger platform." },
    servers: [{ url: "/api/v1" }],
    paths: {
      "/health": { get: { operationId: "health", responses: { "200": { description: "Database is available" } } } },
      "/auth/login": { post: { operationId: "login", requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/LoginRequest" } } } }, responses: { "200": { description: "Authenticated" }, "401": { description: "Invalid credentials" } } } },
      "/auth/me": { get: { operationId: "currentUser", security: [{ cookieAuth: [] }], responses: { "200": { description: "Current user" }, "401": { description: "Unauthenticated" } } } },
      "/auth/logout": { post: { operationId: "logout", security: [{ cookieAuth: [] }], responses: { "204": { description: "Logged out" } } } },
      "/events": { get: { operationId: "listEvents", security: [{ cookieAuth: [] }], responses: { "200": { description: "Events visible to the current organization" } } }, post: { operationId: "createEvent", security: [{ cookieAuth: [] }], responses: { "201": { description: "Event created" } } } },
      "/events/{id}/transition": { post: { operationId: "transitionEvent", security: [{ cookieAuth: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }], responses: { "200": { description: "Event transitioned" } } } },
      "/persons": { get: { operationId: "listPersons", security: [{ cookieAuth: [] }], responses: { "200": { description: "People visible to the current organization" } } }, post: { operationId: "createPerson", security: [{ cookieAuth: [] }], responses: { "201": { description: "Person created" } } } },
      "/contributions": { post: { operationId: "createContribution", security: [{ cookieAuth: [] }], requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/ContributionRequest" } } } }, responses: { "201": { description: "Contribution recorded" }, "409": { description: "Duplicate contribution" } } } },
      "/balances": { get: { operationId: "listBalances", security: [{ cookieAuth: [] }], responses: { "200": { description: "Relationship balances" } } } },
      "/balances/pair": { get: { operationId: "getPairBalance", security: [{ cookieAuth: [] }], parameters: [{ name: "a", in: "query", required: true, schema: { type: "integer" } }, { name: "b", in: "query", required: true, schema: { type: "integer" } }], responses: { "200": { description: "Pair transaction details" } } } },
      "/audit": { get: { operationId: "listAudit", security: [{ cookieAuth: [] }], responses: { "200": { description: "Tenant audit log" } } } },
      "/reports": { get: { operationId: "listReports", security: [{ cookieAuth: [] }], responses: { "200": { description: "Generated reports" } } }, post: { operationId: "generateReport", security: [{ cookieAuth: [] }], responses: { "201": { description: "Report generated" } } } },
      "/reports/{id}": { get: { operationId: "getReport", security: [{ cookieAuth: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }], responses: { "200": { description: "Generated report" } } } },
      "/whatsapp/messages": { get: { operationId: "listWhatsappMessages", security: [{ cookieAuth: [] }], responses: { "200": { description: "Outbound and inbound message status" } } } },
    },
    components: {
      securitySchemes: { cookieAuth: { type: "apiKey", in: "cookie", name: "nuqta_session" } },
      schemas: {
        LoginRequest: { type: "object", required: ["email", "password"], properties: { email: { type: "string", format: "email" }, password: { type: "string", minLength: 8 } } },
        ContributionRequest: { type: "object", required: ["eventId", "payerPersonId", "amount"], properties: { eventId: { type: "integer" }, payerPersonId: { type: "integer" }, amount: { type: "integer", minimum: 1 }, invitedBy: { type: "string" } } },
      },
    },
  };
}

restApi.get("/openapi.json", (c) => c.json(openApiDocument()));
restApi.get("/health", async (c) => {
  try {
    await getDb().execute(sql`select 1`);
    return c.json({ ok: true, database: "up" });
  } catch {
    return c.json({ ok: false, database: "down" }, 503);
  }
});

async function currentContext(request: Request): Promise<TrpcContext> {
  const resHeaders = new Headers();
  const user = await authenticateRequest(request.headers).catch(() => undefined);
  return { req: request, resHeaders, user };
}

function copyResponseHeaders(c: { header: (name: string, value: string) => void }, headers: Headers): void {
  headers.forEach((value, key) => c.header(key, value));
}

restApi.post("/auth/login", async (c) => {
  const parsed = loginSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Invalid login payload" }, 400);
  const context = await currentContext(c.req.raw);
  try {
    const user = await appRouter.createCaller(context).auth.localLogin(parsed.data);
    copyResponseHeaders(c, context.resHeaders);
    return c.json(user);
  } catch {
    return c.json({ error: "Invalid credentials" }, 401);
  }
});

restApi.get("/auth/me", async (c) => {
  const context = await currentContext(c.req.raw);
  if (!context.user) return c.json({ error: "Unauthenticated" }, 401);
  const user = await appRouter.createCaller(context).auth.me();
  return c.json(user);
});

restApi.post("/auth/logout", async (c) => {
  const context = await currentContext(c.req.raw);
  if (!context.user) return c.body(null, 204);
  await appRouter.createCaller(context).auth.logout();
  copyResponseHeaders(c, context.resHeaders);
  return c.body(null, 204);
});

restApi.get("/events", async (c) => {
  const context = await currentContext(c.req.raw);
  if (!context.user) return c.json({ error: "Unauthenticated" }, 401);
  const filter = c.req.query("filter");
  const events = await appRouter.createCaller(context).events.list({
    filter: filter === "upcoming" || filter === "open" || filter === "done" ? filter : "all",
  });
  return c.json(events);
});

restApi.get("/persons", async (c) => {
  const context = await currentContext(c.req.raw);
  if (!context.user) return c.json({ error: "Unauthenticated" }, 401);
  return c.json(await appRouter.createCaller(context).persons.list());
});

restApi.get("/persons/search", async (c) => {
  const query = c.req.query("q")?.trim();
  if (!query) return c.json({ error: "q is required" }, 400);
  const context = await currentContext(c.req.raw);
  if (!context.user) return c.json({ error: "Unauthenticated" }, 401);
  return c.json(await appRouter.createCaller(context).persons.search({ query, limit: 20 }));
});

restApi.post("/persons", async (c) => {
  const parsed = personSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Invalid person payload" }, 400);
  const context = await currentContext(c.req.raw);
  if (!context.user) return c.json({ error: "Unauthenticated" }, 401);
  try {
    return c.json(await appRouter.createCaller(context).persons.create(parsed.data), 201);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Person creation failed" }, 409);
  }
});

restApi.post("/events", async (c) => {
  const parsed = eventSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Invalid event payload" }, 400);
  const context = await currentContext(c.req.raw);
  if (!context.user) return c.json({ error: "Unauthenticated" }, 401);
  return c.json(await appRouter.createCaller(context).events.create(parsed.data), 201);
});

restApi.post("/events/:id/transition", async (c) => {
  const id = Number(c.req.param("id"));
  const parsed = transitionSchema.safeParse(await c.req.json().catch(() => null));
  if (!Number.isInteger(id) || !parsed.success) return c.json({ error: "Invalid transition payload" }, 400);
  const context = await currentContext(c.req.raw);
  if (!context.user) return c.json({ error: "Unauthenticated" }, 401);
  try {
    return c.json(await appRouter.createCaller(context).events.transition({ id, to: parsed.data.to }));
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Transition failed" }, 400);
  }
});

restApi.post("/contributions", async (c) => {
  const parsed = contributionSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Invalid contribution payload" }, 400);
  const context = await currentContext(c.req.raw);
  if (!context.user) return c.json({ error: "Unauthenticated" }, 401);
  try {
    const result = await appRouter.createCaller(context).nuqtat.create(parsed.data);
    return c.json(result, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Contribution failed";
    return c.json({ error: message }, message.includes("already") ? 409 : 400);
  }
});

restApi.get("/balances", async (c) => {
  const context = await currentContext(c.req.raw);
  if (!context.user) return c.json({ error: "Unauthenticated" }, 401);
  return c.json(await appRouter.createCaller(context).balances.matrix());
});

restApi.get("/balances/pair", async (c) => {
  const a = Number(c.req.query("a"));
  const b = Number(c.req.query("b"));
  if (!Number.isInteger(a) || !Number.isInteger(b) || a <= 0 || b <= 0) {
    return c.json({ error: "a and b must be positive integers" }, 400);
  }
  const context = await currentContext(c.req.raw);
  if (!context.user) return c.json({ error: "Unauthenticated" }, 401);
  return c.json(await appRouter.createCaller(context).balances.pairDetails({ a, b }));
});

restApi.get("/audit", async (c) => {
  const context = await currentContext(c.req.raw);
  if (!context.user) return c.json({ error: "Unauthenticated" }, 401);
  const entityType = c.req.query("entityType");
  const action = c.req.query("action");
  const limit = Number(c.req.query("limit") ?? 100);
  return c.json(await appRouter.createCaller(context).audit.list({
    entityType: entityType === "person" || entityType === "event" || entityType === "nuqta" ? entityType : undefined,
    action: action === "create" || action === "update" || action === "delete" ? action : undefined,
    limit: Number.isInteger(limit) && limit > 0 ? Math.min(limit, 500) : 100,
  }));
});

restApi.get("/reports", async (c) => {
  const context = await currentContext(c.req.raw);
  if (!context.user) return c.json({ error: "Unauthenticated" }, 401);
  return c.json(await appRouter.createCaller(context).reports.list());
});

restApi.get("/reports/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) return c.json({ error: "Invalid report id" }, 400);
  const context = await currentContext(c.req.raw);
  if (!context.user) return c.json({ error: "Unauthenticated" }, 401);
  try {
    return c.json(await appRouter.createCaller(context).reports.get({ id }));
  } catch {
    return c.json({ error: "Report not found" }, 404);
  }
});

restApi.post("/reports", async (c) => {
  const parsed = z.object({ eventId: z.number().int().positive() }).safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "eventId is required" }, 400);
  const context = await currentContext(c.req.raw);
  if (!context.user) return c.json({ error: "Unauthenticated" }, 401);
  return c.json(await appRouter.createCaller(context).reports.generate(parsed.data), 201);
});

restApi.get("/whatsapp/messages", async (c) => {
  const context = await currentContext(c.req.raw);
  if (!context.user) return c.json({ error: "Unauthenticated" }, 401);
  const kind = c.req.query("kind");
  const direction = c.req.query("direction");
  return c.json(await appRouter.createCaller(context).whatsapp.log({
    kind: kind === "reminder" || kind === "confirmation" || kind === "phone_verification" || kind === "correction" || kind === "bot_reply" || kind === "bot_query" ? kind : undefined,
    direction: direction === "in" || direction === "out" ? direction : undefined,
    limit: 100,
  }));
});
