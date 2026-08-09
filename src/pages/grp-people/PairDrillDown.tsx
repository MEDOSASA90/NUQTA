import { motion } from 'framer-motion'
import { ArrowDownLeft, ArrowUpRight, LoaderCircle, UserPlus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatMoney } from '@/lib/format'
import { trpc } from '@/providers/trpc'
import StateStamp from '@/components/StateStamp'
import PairStateChip from '@/pages/grp-people/PairStateChip'
import { formatDate } from '@/pages/grp-people/helpers'

/**
 * صف الـ Drill-down (balances.md §٥.٢) — يتوسع أسفل الصف عند الضغط على «/»:
 * خط زمني أفقي مصغّر لكل مرة (مبلغ بإشارة + لون الاتجاه + الفرح + التاريخ
 * + «دعاه: …») متصلة بخط يُرسم scaleX، وأسفله معادلة الصافي بخط عريض
 * + شريحة الحالة. «صفا» يُطبع بختم مطاطي، و«زيادة» لها بطاقة ذهبية.
 * يُستخدم في جدول الأرصدة وفي accordion بطاقة الشخص.
 */
export interface PairDrillDownProps {
  /** الترتيب الكنسي: الأصغر id */
  a: number
  b: number
  /** الشخص صاحب المنظور (تُحسب الإشارات بالنسبة له) — في جدول الأرصدة = A */
  perspectiveId: number
  /** اسم صاحب المنظور (لصياغة «في فرحتك») — اختياري */
  perspectiveName?: string
  className?: string
}

export default function PairDrillDown({ a, b, perspectiveId, perspectiveName, className }: PairDrillDownProps) {
  const details = trpc.balances.pairDetails.useQuery({ a, b })

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="overflow-hidden"
    >
      <div className={cn('m-3 rounded-xl border border-gold-500/30 bg-[#FAF5EA] p-4', className)}>
        {details.isLoading && (
          <div className="flex items-center gap-2 py-6 justify-center text-[13px] text-ink-500">
            <LoaderCircle className="size-4 animate-spin" />
            بنجيب تفاصيل كل مرة…
          </div>
        )}
        {details.isError && (
          <div className="py-6 text-center text-[13px] text-redink">
            حصلت مشكلة في تحميل التفاصيل — جرّب تاني
          </div>
        )}
        {details.data && (
          <DrillContent
            a={a}
            perspectiveId={perspectiveId}
            perspectiveName={perspectiveName}
            interactions={details.data.interactions}
            balance={details.data.balance}
          />
        )}
      </div>
    </motion.div>
  )
}

function DrillContent({
  a,
  perspectiveId,
  perspectiveName,
  interactions,
  balance,
}: {
  a: number
  perspectiveId: number
  perspectiveName?: string
  interactions: {
    nuqtaId: number
    direction: 'a_to_b' | 'b_to_a'
    payerName: string
    hostName: string
    amount: number
    eventLabel: string
    eventDate: Date
    invitedBy: string
    createdAt: Date
  }[]
  balance: {
    aPaidToB: number
    bPaidToA: number
    net: number
    status: 'open' | 'partial' | 'settled' | 'overpaid'
  } | null
}) {
  const isPerspectiveA = perspectiveId === a

  // الإشارة بمنظور صاحب البطاقة: دفع في فرح الآخر = +له، الآخر دفع في فرحته = −عليه
  const signed = interactions.map((n) => {
    const aDelta = n.direction === 'a_to_b' ? n.amount : -n.amount
    const delta = isPerspectiveA ? aDelta : -aDelta
    return { ...n, delta }
  })

  const netForPerspective = balance ? (isPerspectiveA ? balance.net : -balance.net) : 0
  const paidFor = balance ? (isPerspectiveA ? balance.aPaidToB : balance.bPaidToA) : 0
  const paidAgainst = balance ? (isPerspectiveA ? balance.bPaidToA : balance.aPaidToB) : 0

  return (
    <div>
      {/* الخط الزمني الأفقي لكل مرة */}
      <div className="relative overflow-x-auto pb-1">
        <motion.div
          className="absolute top-[26px] right-6 left-6 h-[2px] origin-right bg-line-strong"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          aria-hidden
        />
        <div className="relative flex items-stretch gap-3 min-w-max">
          {signed.map((n, i) => {
            const incoming = n.delta > 0
            const Icon = incoming ? ArrowDownLeft : ArrowUpRight
            return (
              <motion.div
                key={n.nuqtaId}
                initial={{ scale: 0.85, opacity: 0, y: 6 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ duration: 0.26, delay: 0.1 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                className={cn(
                  'w-[168px] shrink-0 rounded-[10px] border bg-paper-surface p-3 shadow-card',
                  incoming ? 'border-laha-solid/40' : 'border-aleh-solid/40',
                )}
              >
                <div
                  className={cn(
                    'num-ltr flex items-center gap-1 font-kufi font-bold text-[15px]',
                    incoming ? 'text-laha-text' : 'text-aleh-text',
                  )}
                >
                  <Icon className="size-4" strokeWidth={2.5} />
                  {incoming ? '+' : '−'}
                  {formatMoney(n.amount)} ج.م
                </div>
                <div className="mt-1.5 text-[12px] font-medium text-ink-700 leading-5">
                  {n.payerName} دفع في {n.eventLabel}
                </div>
                <div className="mt-0.5 text-[11px] text-ink-500">{formatDate(n.eventDate)}</div>
                {n.invitedBy && (
                  <div className="mt-1 flex items-center gap-1 text-[11px] text-ink-400">
                    <UserPlus className="size-3" />
                    دعاه: {n.invitedBy}
                  </div>
                )}
              </motion.div>
            )
          })}

          {/* بطاقة الزيادة الذهبية آخر الخط */}
          {balance?.status === 'overpaid' && netForPerspective !== 0 && (
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.26, delay: 0.1 + signed.length * 0.08 }}
              className="flex w-[168px] shrink-0 flex-col justify-center rounded-[10px] border border-gold-500/50 bg-over-bg p-3"
            >
              <div className="num-ltr font-kufi font-bold text-[15px] text-over-text">
                +{formatMoney(Math.abs(netForPerspective))} ج.م
              </div>
              <div className="mt-1 text-[12px] text-over-text">زيادة — اتسجّلت رصيد جديد مستقل</div>
            </motion.div>
          )}
        </div>
      </div>

      {/* معادلة الصافي + الحالة */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, delay: 0.16 + signed.length * 0.06 }}
        className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-line pt-3"
      >
        <div className="text-[14px] font-semibold text-ink-900">
          معادلة الصافي:{' '}
          <span className="num-ltr">
            {formatMoney(paidFor)} − {formatMoney(paidAgainst)} ={' '}
            <span className={cn(netForPerspective > 0 && 'text-laha-text', netForPerspective < 0 && 'text-aleh-text')}>
              {formatMoney(Math.abs(netForPerspective))} ج.م
            </span>
          </span>{' '}
          {netForPerspective > 0
            ? `له${perspectiveName ? ` (${perspectiveName})` : ''}`
            : netForPerspective < 0
              ? `عليه${perspectiveName ? ` (${perspectiveName})` : ''}`
              : '— متصفّى بالكامل'}
        </div>
        <div className="ms-auto">
          {balance?.status === 'settled' ? (
            <StateStamp state="settled" />
          ) : (
            balance && (
              <PairStateChip
                status={balance.status}
                paidAmount={Math.min(paidFor, paidAgainst)}
                totalAmount={Math.max(paidFor, paidAgainst)}
                overAmount={Math.abs(netForPerspective)}
              />
            )
          )}
        </div>
      </motion.div>
    </div>
  )
}
