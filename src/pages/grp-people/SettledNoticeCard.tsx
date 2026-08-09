import { motion } from 'framer-motion'
import { Stamp } from 'lucide-react'
import { formatMoney } from '@/lib/format'
import type { SettledNotice } from '@contracts/afrah'
import { formatDate } from '@/pages/grp-people/helpers'

/**
 * إشعار «فلان صفّى حسابه معاك» — بطاقة بالختم النابض (design.md §٦.٢.١:
 * scale 2.4→1 + rotate −10→−4deg بنابض spring stiffness 500 damping 18).
 * تظهر أعلى صفحة الأرصدة وفي بطاقة الشخص عند وجود تصفيات.
 */
export default function SettledNoticeCard({ notice, index = 0 }: { notice: SettledNotice; index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
      className="relative flex items-center gap-4 overflow-hidden rounded-[14px] border border-laha-solid/30 bg-laha-bg/40 p-4"
    >
      {/* الختم النابض */}
      <motion.span
        initial={{ scale: 2.4, rotate: -10, opacity: 0 }}
        animate={{ scale: 1, rotate: -4, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 18, delay: 0.15 + index * 0.07 }}
        className="relative inline-flex h-14 w-24 shrink-0 items-center justify-center select-none"
      >
        <img src="/stamp-settled.svg" alt="" className="absolute inset-0 h-full w-full" aria-hidden />
        <span className="relative font-ruqaa text-[12px] leading-none text-laha-text">صفّى حسابه</span>
      </motion.span>

      <div className="min-w-0">
        <div className="text-[14px] font-semibold text-ink-900 leading-6">
          {notice.settlerName} صفّى حسابه مع {notice.hostName}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-ink-500">
          <span className="num-ltr font-semibold text-laha-text">{formatMoney(notice.amount)} ج.م</span>
          <span aria-hidden>·</span>
          <span>{notice.eventLabel}</span>
          <span aria-hidden>·</span>
          <span>{formatDate(notice.settledAt)}</span>
        </div>
      </div>

      <Stamp className="ms-auto size-5 shrink-0 text-laha-solid/60" strokeWidth={1.8} aria-hidden />
    </motion.div>
  )
}
