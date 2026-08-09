import { motion } from 'framer-motion'
import { ArrowUp, CircleDashed } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatMoney } from '@/lib/format'
import type { SettlementState } from '@/lib/seed-data'

/**
 * ختم الحالة (design.md §٨.٦) — حالات السداد الأربع:
 * - «صفّى حسابه»: ختم مطاطي بيضاوي أخضر مائل -4deg بخط Aref Ruqaa
 *   يدخل بحركة الطبع على الورق (scale 2.4→1 + spring — §٦.٢).
 * - «سداد جزئي»: شريط تقدم كهرماني بنسبة.
 * - «زيادة»: شارة ذهبية + سهم ↑.
 * - «مفتوح»: شارة رمادية دافئة هادئة — بلا أي إحساس تأخير.
 */
export interface StateStampProps {
  state: SettlementState
  /** للسداد الجزئي */
  paidAmount?: number
  totalAmount?: number
  /** للزيادة: مقدار الرصيد الجديد له */
  overAmount?: number
  /** للمفتوح: نص محايد مثل «منذ ١٤ شهرًا» */
  sinceLabel?: string
  animate?: boolean
  className?: string
}

export default function StateStamp({
  state,
  paidAmount = 0,
  totalAmount = 0,
  overAmount = 0,
  sinceLabel,
  animate = true,
  className,
}: StateStampProps) {
  if (state === 'settled') {
    return (
      <motion.span
        initial={animate ? { scale: 2.4, rotate: -10, opacity: 0 } : false}
        animate={{ scale: 1, rotate: -4, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 18 }}
        className={cn(
          'relative inline-flex items-center justify-center px-7 py-3 min-w-[148px] select-none',
          className,
        )}
      >
        <img src="/stamp-settled.svg" alt="" className="absolute inset-0 w-full h-full fill-current" aria-hidden />
        <span className="relative font-ruqaa text-laha-text text-[16px] leading-none">
          صفّى حسابه
        </span>
      </motion.span>
    )
  }

  if (state === 'partial') {
    const pct = totalAmount > 0 ? Math.min(100, Math.round((paidAmount / totalAmount) * 100)) : 0
    return (
      <span className={cn('inline-flex flex-col gap-1 min-w-[150px]', className)}>
        <span className="text-[12px] text-partial-text font-medium">
          سدّد <span className="num-ltr font-semibold">{formatMoney(paidAmount)}</span> من{' '}
          <span className="num-ltr font-semibold">{formatMoney(totalAmount)}</span> — باقي{' '}
          <span className="num-ltr font-semibold">{formatMoney(totalAmount - paidAmount)}</span>
        </span>
        <span className="h-1.5 rounded-full bg-paper-sunken overflow-hidden">
          <motion.span
            className="block h-full rounded-full bg-partial-solid"
            initial={animate ? { width: 0 } : false}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          />
        </span>
      </span>
    )
  }

  if (state === 'overpaid') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full bg-over-bg text-over-text px-3 py-1 text-[13px] font-medium',
          className,
        )}
      >
        <ArrowUp className="size-3.5" strokeWidth={2.4} />
        <span className="num-ltr font-semibold">{formatMoney(overAmount)}</span>
        ج.م رصيد جديد له
      </span>
    )
  }

  // open — رمادي دافئ محايد، بلا ضغط ولا إنذار (لا التزام زمني)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-open-bg text-open-text px-3 py-1 text-[13px]',
        className,
      )}
    >
      <CircleDashed className="size-3.5" strokeWidth={2.2} />
      <span>مفتوح</span>
      {sinceLabel && <span className="text-ink-400">· {sinceLabel}</span>}
    </span>
  )
}
