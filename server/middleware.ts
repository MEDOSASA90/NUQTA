import { ErrorMessages } from "@contracts/constants";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context.js";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const createRouter = t.router;
export const publicQuery = t.procedure;

const requireAuth = t.middleware(async (opts) => {
  const { ctx, next } = opts;

  if (!ctx.user || ctx.user.status !== "active") {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: ErrorMessages.unauthenticated,
    });
  }

  return next({ ctx: { ...ctx, user: ctx.user } });
});

function requireRole(role: string) {
  return t.middleware(async (opts) => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.status !== "active" || ctx.user.role !== role) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: ErrorMessages.insufficientRole,
      });
    }

    return next({ ctx: { ...ctx, user: ctx.user } });
  });
}

export const authedQuery = t.procedure.use(requireAuth);
export const adminQuery = authedQuery.use(requireRole("admin"));

/**
 * إجراءات نظام «أفراح الجمعية»: تتطلب مستخدمًا مسجلًا وتحقن
 * المستأجر الحالي (ctx.tenant) وعضويته (ctx.membership) — أول مستخدم
 * يدخل ينشئ tenant تلقائيًا باسمه. كل البيانات تُصفّى بهذا المستأجر.
 */
const requireTenant = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  const { resolveTenantForUser } = await import("./queries/tenants.js");
  // user مضمون هنا لأن requireTenant يُربط بعد requireAuth دائمًا
  const user = ctx.user!;
  const { tenant, membership } = await resolveTenantForUser(user);
  return next({ ctx: { ...ctx, user, tenant, membership } });
});

export const tenantQuery = authedQuery.use(requireTenant);
