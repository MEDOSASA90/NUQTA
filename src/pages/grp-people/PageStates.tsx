import { motion } from 'framer-motion'
import { RefreshCw, TriangleAlert } from 'lucide-react'
import { AuthErrorState, isAuthError } from '@/components/AuthErrorBoundary'
import { cn } from '@/lib/utils'

/**
 * حالات التحميل والخطأ المشتركة لصفحات grp-people —
 * هيكل عظمي دافئ أثناء الجلب + صندوق خطأ بزر إعادة محاولة.
 */

export function TableSkeleton({ rows = 6, cols = 5, className }: { rows?: number; cols?: number; className?: string }) {
  return (
    <div className={cn('animate-pulse', className)} aria-busy="true" aria-label="جاري التحميل">
      <div className="h-11 rounded-t-xl bg-[#F1EADA]" />
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-4 border-t border-line px-4 py-3.5">
          {Array.from({ length: cols }, (_, c) => (
            <div
              key={c}
              className={cn('h-3.5 rounded-full bg-paper-sunken', c === 0 ? 'w-32' : 'flex-1')}
              style={{ opacity: 1 - r * 0.1 }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export function CardsSkeleton({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('grid gap-4 sm:grid-cols-3 animate-pulse', className)} aria-busy="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="surface-card h-32 p-5">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-[10px] bg-paper-sunken" />
            <div className="h-3.5 w-24 rounded-full bg-paper-sunken" />
          </div>
          <div className="mt-4 h-7 w-28 rounded-full bg-paper-sunken" />
        </div>
      ))}
    </div>
  )
}

export function ErrorBox({ message, onRetry, className, error }: { message?: string; onRetry?: () => void; className?: string; error?: unknown }) {
  // أخطاء المصادقة (جلسة منتهية) ⇒ بطاقة «تسجيل الدخول» بدل الخطأ الخام
  if (isAuthError(error) || isAuthError(message)) return <AuthErrorState className={className} />
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'surface-card flex flex-col items-center gap-3 px-6 py-10 text-center',
        className,
      )}
      role="alert"
    >
      <span className="flex size-11 items-center justify-center rounded-full bg-redink-bg text-redink">
        <TriangleAlert className="size-5" />
      </span>
      <p className="font-kufi font-semibold text-[15px] text-ink-900">حصلت مشكلة وإحنا بنجيب البيانات</p>
      {message && <p className="max-w-[380px] text-[12.5px] text-ink-500">{message}</p>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 inline-flex items-center gap-2 rounded-[10px] border border-line-strong px-4 py-2 text-[13px] font-medium text-ink-700 transition-colors hover:bg-primary-50"
        >
          <RefreshCw className="size-3.5" />
          حاول تاني
        </button>
      )}
    </motion.div>
  )
}
