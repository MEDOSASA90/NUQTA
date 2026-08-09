import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CircleCheckBig, Copy, Info, TriangleAlert } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { subscribeToasts } from '@/pages/grp-people/toast-bus'
import type { ToastItem, ToastKind } from '@/pages/grp-people/toast-bus'

/**
 * حاوية التوستات (design.md §٨.٧) — كبسولة داكنة #3A3026 بنص كريمي أعلى يسار
 * الشاشة، دخول y:-12→0 وخروج تلقائي بعد 4s مع شريط زمني رفيع.
 * الرسائل تُرسل عبر toast() من toast-bus. ركّب <Toaster/> مرة بالصفحة.
 */

const ICONS: Record<ToastKind, LucideIcon> = {
  success: CircleCheckBig,
  info: Info,
  error: TriangleAlert,
  copy: Copy,
}

const ICON_TONE: Record<ToastKind, string> = {
  success: 'text-[#B7CF9C]',
  info: 'text-[#D2AB70]',
  error: 'text-[#E8A394]',
  copy: 'text-[#D2AB70]',
}

function ToastCard({ item, onDone }: { item: ToastItem; onDone: (id: number) => void }) {
  const Icon = ICONS[item.kind]
  useEffect(() => {
    const t = setTimeout(() => onDone(item.id), 4000)
    return () => clearTimeout(t)
  }, [item.id, onDone])

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="pointer-events-auto relative overflow-hidden rounded-full bg-[#3A3026] py-2.5 ps-4 pe-5 shadow-[0_2px_6px_rgba(44,36,24,.18),0_16px_40px_-12px_rgba(44,36,24,.35)]"
      role="status"
    >
      <span className="flex items-center gap-2 text-[13px] font-medium text-[#F6F1E7]">
        <Icon className={cn('size-4 shrink-0', ICON_TONE[item.kind])} strokeWidth={2.2} />
        {item.message}
      </span>
      {/* شريط زمني رفيع */}
      <motion.span
        className="absolute bottom-0 start-0 h-[2px] bg-[#A87438]/70"
        initial={{ width: '100%' }}
        animate={{ width: '0%' }}
        transition={{ duration: 4, ease: 'linear' }}
      />
    </motion.div>
  )
}

/** حاوية التوستات — ركّبها مرة واحدة في كل صفحة تستخدم toast() */
export default function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([])

  useEffect(() => {
    return subscribeToasts((t) => setItems((xs) => [...xs.slice(-2), t]))
  }, [])

  const remove = (id: number) => setItems((xs) => xs.filter((x) => x.id !== id))

  return (
    <div className="pointer-events-none fixed top-4 left-4 z-[90] flex flex-col items-start gap-2">
      <AnimatePresence>
        {items.map((t) => (
          <ToastCard key={t.id} item={t} onDone={remove} />
        ))}
      </AnimatePresence>
    </div>
  )
}
