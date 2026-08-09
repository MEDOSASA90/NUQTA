import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { users, tenants, tenantMembers } from "@db/schema";
import { adminQuery, createRouter } from "./middleware";
import { getDb } from "./queries/connection";
import { hashPassword } from "./services/password";

export const adminRouter = createRouter({
  createUser: adminQuery
    .input(z.object({
      name: z.string().trim().min(2).max(255),
      email: z.string().email(),
      password: z.string().min(8).max(128),
      role: z.enum(["user", "admin"]).default("user"),
    }))
    .mutation(async ({ input }) => {
      const email = input.email.trim().toLowerCase();
      const existing = await getDb().select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
      if (existing.length > 0) {
        throw new TRPCError({ code: "CONFLICT", message: "البريد الإلكتروني مستخدم بالفعل" });
      }
      const [{ id }] = await getDb().insert(users).values({
        unionId: `local-${randomUUID()}`,
        name: input.name,
        email,
        passwordHash: hashPassword(input.password),
        role: input.role,
        status: "active",
        lastSignInAt: new Date(),
      }).$returningId();
      return { id, email, name: input.name, role: input.role, status: "active" as const };
    }),
  users: adminQuery.query(() => getDb().select({
    id: users.id,
    unionId: users.unionId,
    name: users.name,
    email: users.email,
    avatar: users.avatar,
    role: users.role,
    status: users.status,
    createdAt: users.createdAt,
    updatedAt: users.updatedAt,
    lastSignInAt: users.lastSignInAt,
  }).from(users)),
  tenants: adminQuery.query(() => getDb().select().from(tenants)),
  memberships: adminQuery
    .input(z.object({ tenantId: z.number().int().positive() }))
    .query(({ input }) => getDb().select().from(tenantMembers).where(eq(tenantMembers.tenantId, input.tenantId))),
  setUserStatus: adminQuery
    .input(z.object({ userId: z.number().int().positive(), status: z.enum(["active", "suspended"]) }))
    .mutation(async ({ input }) => {
      await getDb().update(users).set({ status: input.status }).where(eq(users.id, input.userId));
      const rows = await getDb().select({
        id: users.id,
        unionId: users.unionId,
        name: users.name,
        email: users.email,
        avatar: users.avatar,
        role: users.role,
        status: users.status,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        lastSignInAt: users.lastSignInAt,
      }).from(users).where(eq(users.id, input.userId)).limit(1);
      return rows.at(0);
    }),
  setMembership: adminQuery
    .input(z.object({
      tenantId: z.number().int().positive(),
      userId: z.number().int().positive(),
      role: z.enum(["scribe", "team"]),
      permissions: z.array(z.enum(["record", "review", "edit", "reports", "manage_events", "manage_team"])).max(20),
    }))
    .mutation(async ({ input }) => {
      const existing = await getDb().select({ id: tenantMembers.id }).from(tenantMembers)
        .where(and(eq(tenantMembers.tenantId, input.tenantId), eq(tenantMembers.userId, input.userId))).limit(1);
      if (existing.length > 0) {
        await getDb().update(tenantMembers)
          .set({ role: input.role, permissions: input.permissions })
          .where(eq(tenantMembers.id, existing[0].id));
      } else {
        await getDb().insert(tenantMembers).values({
          tenantId: input.tenantId,
          userId: input.userId,
          role: input.role,
          permissions: input.permissions,
        });
      }
      const rows = await getDb().select().from(tenantMembers)
        .where(and(eq(tenantMembers.tenantId, input.tenantId), eq(tenantMembers.userId, input.userId))).limit(1);
      return rows.at(0);
    }),
});
