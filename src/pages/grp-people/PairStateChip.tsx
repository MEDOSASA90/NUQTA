import { motion } from 'framer-motion'
import { ArrowUp, CircleDashed, Percent } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatMoney } from '@/lib/format'
import type { PairStatus } from '@contracts/afrah'

/**
 * شريحة حالة مضغوطة للجداول — نسخة محلية مصغّرة من StateStamp:
 * - «مفتوح» رمادي دافئ محايد تمامًا (بلا إحساس تأخير — لا التزام زمني)
 * - «سداد جزئي» كهرماني + شريط تقدم رفيع
 * - «صفّى حسابه» ختم بيضاوي أخضر مائل -4deg بخط Aref Ruqaa (يدخل بنابض)
 * - «زيادة» ذهبية + ↑ بنبضة خفيفة كل 4s (balances.md §٥.٣)
 */

export interface PairStateChipProps {
  status: PairStatus
  /** للمفتوح: نص محايد «منذ ١٤ شهرًا» */
  sinceLabel?: string
  /** للجزئي: المسدد / الإجمالي */
  paidAmount?: number
  totalAmount?: number
  /** للزيادة: مقدار الرصيد الجديد */
  overAmount?: number
  animate?: boolean
  className?: string
}

export default function PairStateChip({
  status,
  sinceLabel,
  paidAmount = 0,
  totalAmount = 0,
  overAmount = 0,
  animate = true,
  className,
}: PairStateChipProps) {
  if (status === 'settled') {
    return (
      <motion.span
        initial={animate ? { scale: 2.4, rotate: -10, opacity: 0 } : false}
        animate={{ scale: 1, rotate: -4, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 18 }}
        className={cn(
          'inline-flex items-center rounded-[8px] border-2 border-dashed border-laha-solid/70 px-3 py-1 font-ruqaa text-[13px] leading-none text-laha-text opacity-85 select-none',
          className,
        )}
      >
        صفّى حسابه
      </motion.span>
    )
  }

  if (status === 'partial') {
    const pct = totalAmount > 0 ? Math.min(100, Math.round((paidAmount / totalAmount) * 100)) : 0
    return (
      <span className={cn('inline-flex min-w-[132px] flex-col gap-1', className)}>
        <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-partial-text">
          <Percent className="size-3" strokeWidth={2.4} />
          سدّد <span className="num-ltr font-semibold">{formatMoney(paidAmount)}</span> من{' '}
          <span className="num-ltr font-semibold">{formatMoney(totalAmount)}</span>
        </span>
        <span className="h-1 overflow-hidden rounded-full bg-paper-sunken">
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

  if (status === 'overpaid') {
    return (
      <motion.span
        animate={animate ? { boxShadow: ['0 0 0 0 rgba(194,155,60,0)', '0 0 0 6px rgba(194,155,60,.18)', '0 0 0 0 rgba(194,155,60,0)'] } : undefined}
        transition={animate ? { duration: 1.6, repeat: Infinity, repeatDelay: 2.4 } : undefined}
        className={cn(
          'inline-flex items-center gap-1 rounded-full bg-over-bg px-2.5 py-1 text-[11.5px] font-medium text-over-text',
          className,
        )}
      >
        <ArrowUp className="size-3" strokeWidth={2.6} />
        زيادة <span className="num-ltr font-semibold">{formatMoney(overAmount)}</span> ج.م
      </motion.span>
    )
  }

  // open — محايد تمامًا، بلا عدّاد أيام أحمر ولا «متأخر»
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-open-bg px-2.5 py-1 text-[11.5px] text-open-text',
        className,
      )}
      title="مفيش استعجال — الحساب محفوظ"
    >
      <CircleDashed className="size-3" strokeWidth={2.2} />
      مفتوح
      {sinceLabel && <span className="text-ink-400">· {sinceLabel}</span>}
    </span>
  )
}
