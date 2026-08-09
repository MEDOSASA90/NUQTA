import { ArrowDownLeft, ArrowUpRight, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatMoney } from '@/lib/format'

/**
 * شريحة رصيد (design.md §٨.٦) — كبسولة تحمل الاتجاه والمبلغ:
 * «له 1,200 ج.م» زيتونية / «عليه 800 ج.م» طوبية. المبلغ tnum.
 * القاعدة: لون + أيقونة + نص معًا (إتاحة).
 */
export interface BalanceChipProps {
  /** صافي المبلغ: موجب = له، سالب = عليه، صفر = متصفّى */
  amount: number
  size?: 'sm' | 'md'
  className?: string
}

export default function BalanceChip({ amount, size = 'md', className }: BalanceChipProps) {
  const settled = amount === 0
  const forYou = amount > 0
  const Icon = settled ? Check : forYou ? ArrowDownLeft : ArrowUpRight

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap',
        size === 'sm' ? 'px-2 py-0.5 text-[11.5px]' : 'px-3 py-1 text-[13px]',
        settled && 'bg-open-bg text-open-text',
        !settled && forYou && 'bg-laha-bg text-laha-text',
        !settled && !forYou && 'bg-aleh-bg text-aleh-text',
        className,
      )}
    >
      <Icon className={size === 'sm' ? 'size-3' : 'size-3.5'} strokeWidth={2.4} />
      <span>{settled ? 'متصفّى' : forYou ? 'له' : 'عليه'}</span>
      {!settled && (
        <span className="num-ltr font-semibold">
          {formatMoney(amount)} ج.م
        </span>
      )}
    </span>
  )
}
