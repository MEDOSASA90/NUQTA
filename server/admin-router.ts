import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { users, tenants, tenantMembers } from "@db/schema";
import { adminQuery, createRouter } from "./middleware";
import { getDb } from "./queries/connection";

export const adminRouter = createRouter({
  users: adminQuery.query(() => getDb().select().from(users)),
  tenants: adminQuery.query(() => getDb().select().from(tenants)),
  memberships: adminQuery
    .input(z.object({ tenantId: z.number().int().positive() }))
    .query(({ input }) => getDb().select().from(tenantMembers).where(eq(tenantMembers.tenantId, input.tenantId))),
  setUserStatus: adminQuery
    .input(z.object({ userId: z.number().int().positive(), status: z.enum(["active", "suspended"]) }))
    .mutation(async ({ input }) => {
      await getDb().update(users).set({ status: input.status }).where(eq(users.id, input.userId));
      const rows = await getDb().select().from(users).where(eq(users.id, input.userId)).limit(1);
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
      await getDb().update(tenantMembers)
        .set({ role: input.role, permissions: input.permissions })
        .where(and(eq(tenantMembers.tenantId, input.tenantId), eq(tenantMembers.userId, input.userId)));
      const rows = await getDb().select().from(tenantMembers)
        .where(and(eq(tenantMembers.tenantId, input.tenantId), eq(tenantMembers.userId, input.userId))).limit(1);
      return rows.at(0);
    }),
});
