import { LogIn } from 'lucide-react'
import { useLocation } from 'react-router'
import { LOGIN_PATH } from '@/const'
import { cn } from '@/lib/utils'

/**
 * مساعدات «أخطاء المصادقة» — خط دفاع احتياطي خلف بوابة Layout:
 * لو وصلت للواجهة رسالة UNAUTHORIZED / "Authentication required" من tRPC
 * (مثلًا انتهت الجلسة أثناء الاستخدام) نعرض بطاقة دافئة بزر «تسجيل الدخول»
 * بدل عرض الخطأ الخام مع زر «حاول تاني».
 */

/** يكشف خطأ مصادقة قادم من tRPC: كود UNAUTHORIZED أو رسالة "Authentication required" */
export function isAuthError(error: unknown): boolean {
  if (error == null) return false
  const code = (error as { data?: { code?: unknown } }).data?.code
  if (code === 'UNAUTHORIZED') return true
  const message =
    typeof error === 'string'
      ? error
      : ((error as { message?: unknown }).message ?? '')
  return (
    typeof message === 'string' &&
    /authentication required|unauthorized/i.test(message)
  )
}

/**
 * بطاقة «محتاج تسجّل دخولك» — زر يوجّه لصفحة الدخول مع حفظ الصفحة
 * الحالية في ?from= للعودة إليها بعد نجاح الدخول.
 */
export function AuthErrorState({ className }: { className?: string }) {
  const { pathname, search } = useLocation()
  const from = pathname + search
  const loginUrl =
    from && from !== LOGIN_PATH
      ? `${LOGIN_PATH}?from=${encodeURIComponent(from)}`
      : LOGIN_PATH

  return (
    <div
      role="alert"
      className={cn(
        'surface-card flex flex-col items-center justify-center px-6 py-12 text-center',
        className,
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-primary-100 text-primary-700">
        <LogIn className="size-6" />
      </span>
      <h3 className="mt-4 font-kufi font-semibold text-[17px] text-ink-900">
        محتاج تسجّل دخولك الأول
      </h3>
      <p className="mt-1.5 max-w-[380px] text-[13px] text-ink-500">
        الجلسة انتهت أو لم يتم تسجيل الدخول — سجّل دخولك وكمّل شغلك من حيث وقفت.
      </p>
      {/* تنقّل كامل (full reload) لضمان مسح أي كاش قديم للجلسة */}
      <a
        href={loginUrl}
        className="mt-5 inline-flex items-center gap-2 rounded-[10px] bg-primary-500 px-[18px] py-2.5 text-[14px] font-semibold text-[#FFFDF8] shadow-card transition-colors hover:bg-primary-600"
      >
        <LogIn className="size-4" />
        تسجيل الدخول
      </a>
    </div>
  )
}
