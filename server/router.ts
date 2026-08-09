import { authRouter } from "./auth-router";
import { createRouter, publicQuery } from "./middleware";
import { personsRouter } from "./persons-router";
import { eventsRouter } from "./events-router";
import { nuqtatRouter } from "./nuqtat-router";
import { balancesRouter } from "./balances-router";
import { auditRouter } from "./audit-router";
import { whatsappRouter } from "./whatsapp-router";
import { reportsRouter } from "./reports-router";
import { dashboardRouter } from "./dashboard-router";
import { publicWeddingRouter } from "./public-wedding-router";
import { expensesRouter } from "./expenses-router";
import { regionsRouter } from "./regions-router";
import { adminRouter } from "./admin-router";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,

  // نظام «أفراح الجمعية» — كلها مصفّاة بالمستأجر الحالي إلا public_wedding
  persons: personsRouter,
  events: eventsRouter,
  nuqtat: nuqtatRouter,
  balances: balancesRouter,
  audit: auditRouter,
  whatsapp: whatsappRouter,
  reports: reportsRouter,
  dashboard: dashboardRouter,
  public_wedding: publicWeddingRouter,
  expenses: expensesRouter,
  regions: regionsRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
