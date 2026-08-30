import { authRouter } from "./auth-router.js";
import { createRouter, publicQuery } from "./middleware.js";
import { personsRouter } from "./persons-router.js";
import { eventsRouter } from "./events-router.js";
import { nuqtatRouter } from "./nuqtat-router.js";
import { balancesRouter } from "./balances-router.js";
import { auditRouter } from "./audit-router.js";
import { whatsappRouter } from "./whatsapp-router.js";
import { reportsRouter } from "./reports-router.js";
import { dashboardRouter } from "./dashboard-router.js";
import { publicWeddingRouter } from "./public-wedding-router.js";
import { expensesRouter } from "./expenses-router.js";
import { regionsRouter } from "./regions-router.js";
import { adminRouter } from "./admin-router.js";

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
