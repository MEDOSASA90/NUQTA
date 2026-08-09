import * as cookie from "cookie";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { Session } from "@contracts/constants";
import { getSessionCookieOptions } from "./lib/cookies";
import { createRouter, authedQuery, publicQuery } from "./middleware";
import { findUserByEmail } from "./queries/users";
import { verifyPassword } from "./services/password";
import { signSessionToken } from "./kimi/session";

export const authRouter = createRouter({
  localLogin: publicQuery
    .input(z.object({ email: z.string().email(), password: z.string().min(8).max(128) }))
    .mutation(async ({ ctx, input }) => {
      const user = await findUserByEmail(input.email);
      if (!user || user.status !== "active" || !verifyPassword(input.password, user.passwordHash)) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "البريد الإلكتروني أو كلمة المرور غير صحيحة" });
      }

      const token = await signSessionToken({ unionId: user.unionId, clientId: "local" });
      const options = getSessionCookieOptions(ctx.req.headers);
      ctx.resHeaders.append(
        "set-cookie",
        cookie.serialize(Session.cookieName, token, {
          httpOnly: options.httpOnly,
          path: options.path,
          sameSite: options.sameSite?.toLowerCase() as "lax" | "none",
          secure: options.secure,
          maxAge: Session.maxAgeMs / 1000,
        }),
      );
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
      };
    }),
  me: authedQuery.query((opts) => opts.ctx.user),
  logout: authedQuery.mutation(async ({ ctx }) => {
    const opts = getSessionCookieOptions(ctx.req.headers);
    ctx.resHeaders.append(
      "set-cookie",
      cookie.serialize(Session.cookieName, "", {
        httpOnly: opts.httpOnly,
        path: opts.path,
        sameSite: opts.sameSite?.toLowerCase() as "lax" | "none",
        secure: opts.secure,
        maxAge: 0,
      }),
    );
    return { success: true };
  }),
});
