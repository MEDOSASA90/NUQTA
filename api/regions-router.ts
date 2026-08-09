import { z } from "zod";
import { createRouter, tenantQuery } from "./middleware";
import { getOrCreateRegion, listRegions } from "./queries/regions";

export const regionsRouter = createRouter({
  list: tenantQuery.query(() => listRegions()),
  create: tenantQuery
    .input(z.object({ name: z.string().min(2).max(100) }))
    .mutation(({ ctx, input }) => getOrCreateRegion(input.name, ctx.user.id)),
});

