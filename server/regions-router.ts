import { z } from "zod";
import { createRouter, tenantQuery } from "./middleware.js";
import { getOrCreateRegion, listRegions } from "./queries/regions.js";

export const regionsRouter = createRouter({
  list: tenantQuery.query(() => listRegions()),
  create: tenantQuery
    .input(z.object({ name: z.string().min(2).max(100) }))
    .mutation(({ ctx, input }) => getOrCreateRegion(input.name, ctx.user.id)),
});

