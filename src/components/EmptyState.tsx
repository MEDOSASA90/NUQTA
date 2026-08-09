import { Link } from 'react-router'
import { motion } from 'framer-motion'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * حالة فارغة (design.md §٨.٨) — رسم خطي دافئ + عنوان Kufi + نص مساعد + زر إجراء.
 * مثال: «لسه مفيش نقوط متسجلة — ابدأ بتسجيل أول نقطة».
 */
export interface EmptyStateProps {
  /** مسار رسم SVG من public/ — مثل /empty-ledger.svg */
  image?: string
  title: string
  description?: string
  actionLabel?: string
  actionHref?: string
  onAction?: () => void
  className?: string
}

export default function EmptyState({
  image = '/empty-ledger.svg',
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  className,
}: EmptyStateProps) {
  const action = actionLabel ? (
    actionHref ? (
      <Link
        to={actionHref}
        className="inline-flex items-center gap-2 rounded-[10px] bg-primary-500 px-[18px] py-2.5 text-[14px] font-semibold text-[#FFFDF8] shadow-card transition-all hover:bg-primary-600 hover:-translate-y-px active:bg-primary-700 active:scale-[0.97]"
      >
        <Plus className="size-4" />
        {actionLabel}
      </Link>
    ) : (
      <button
        type="button"
        onClick={onAction}
        className="inline-flex items-center gap-2 rounded-[10px] bg-primary-500 px-[18px] py-2.5 text-[14px] font-semibold text-[#FFFDF8] shadow-card transition-all hover:bg-primary-600 hover:-translate-y-px active:bg-primary-700 active:scale-[0.97]"
      >
        <Plus className="size-4" />
        {actionLabel}
      </button>
    )
  ) : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
      className={cn('flex flex-col items-center justify-center text-center py-12 px-6', className)}
    >
      <img src={image} alt="" className="w-[220px] max-w-full opacity-95 select-none" draggable={false} />
      <h3 className="font-kufi font-semibold text-[17px] leading-6 text-ink-900 mt-5">{title}</h3>
      {description && <p className="text-[13px] text-ink-500 mt-1.5 max-w-[380px]">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  )
}
