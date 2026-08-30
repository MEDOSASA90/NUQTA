import { Hono } from "hono";
import type { HttpBindings } from "@hono/node-server";
import { z } from "zod";
import { appRouter } from "./router.js";
import { authenticateRequest } from "./kimi/auth.js";
import type { TrpcContext } from "./context.js";

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
      "/events": { get: { operationId: "listEvents", security: [{ cookieAuth: [] }], responses: { "200": { description: "Events visible to the current organization" } } } },
      "/persons": { get: { operationId: "listPersons", security: [{ cookieAuth: [] }], responses: { "200": { description: "People visible to the current organization" } } } },
      "/contributions": { post: { operationId: "createContribution", security: [{ cookieAuth: [] }], requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/ContributionRequest" } } } }, responses: { "201": { description: "Contribution recorded" }, "409": { description: "Duplicate contribution" } } } },
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
  return c.json({ ok: true, database: "up" });
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
