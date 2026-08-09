import { useState, type FormEvent } from "react";
import { LogIn } from "lucide-react";
import { trpc } from "@/providers/trpc";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const localLogin = trpc.auth.localLogin.useMutation({
    onSuccess: () => {
      window.location.href = "/";
    },
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    localLogin.mutate({ email: email.trim(), password });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper-base px-4 py-8" dir="rtl">
      <section className="w-full max-w-md rounded-3xl border border-line bg-paper-surface p-5 shadow-pop sm:p-8">
        <div className="text-center">
          <img src="/logo.svg" alt="أفراح الجمعية" className="mx-auto size-20" />
          <h1 className="mt-4 font-kufi text-[22px] font-bold text-ink-900">أفراح الجمعية</h1>
          <p className="mt-1 text-[13px] text-ink-500">دفتر النقوط الرقمي — سجّل دخولك للمتابعة</p>
        </div>

        <form onSubmit={submit} className="mt-7 space-y-4">
          <label className="block text-[13px] font-semibold text-ink-700">
            البريد الإلكتروني
            <input type="email" required autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" className="mt-1.5 h-12 w-full border border-line-strong bg-paper-base px-3.5 text-[14px] text-ink-900 outline-none transition-colors focus:border-primary-500" dir="ltr" />
          </label>
          <label className="block text-[13px] font-semibold text-ink-700">
            كلمة المرور
            <input type="password" required minLength={8} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" className="mt-1.5 h-12 w-full border border-line-strong bg-paper-base px-3.5 text-[14px] text-ink-900 outline-none transition-colors focus:border-primary-500" dir="ltr" />
          </label>
          {localLogin.error && <p role="alert" className="rounded-xl bg-redink-bg px-3 py-2.5 text-[12.5px] font-medium text-redink">تعذر تسجيل الدخول. راجع البريد وكلمة المرور وحاول مرة أخرى.</p>}
          <button type="submit" disabled={localLogin.isPending} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary-500 px-4 text-[14px] font-semibold text-white shadow-card transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60">
            <LogIn className="size-4" />
            {localLogin.isPending ? "جاري تسجيل الدخول…" : "تسجيل الدخول"}
          </button>
        </form>
      </section>
    </main>
  );
}
