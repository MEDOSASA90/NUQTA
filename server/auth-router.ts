import * as cookie from "cookie";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { Session } from "@contracts/constants";
import { getSessionCookieOptions } from "./lib/cookies.js";
import { createRouter, authedQuery, publicQuery } from "./middleware.js";
import { findUserByEmail } from "./queries/users.js";
import { verifyPassword } from "./services/password.js";
import { signSessionToken } from "./kimi/session.js";
import type { User } from "@db/schema";

function toPublicUser(user: User) {
  return {
    id: user.id,
    unionId: user.unionId,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    lastSignInAt: user.lastSignInAt,
  };
}

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
      return toPublicUser(user);
    }),
  me: authedQuery.query((opts) => toPublicUser(opts.ctx.user)),
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
