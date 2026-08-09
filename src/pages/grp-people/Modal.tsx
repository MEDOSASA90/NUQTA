import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * مودال مركزي (design.md §٨.٧) — حد أقصى 520px، دخول scale 0.96→1, y: 10→0
 * خلال 240ms، خلفية معتمة دافئة rgba(44,36,24,.4) + blur 4px، إغلاق بـ Esc.
 */
export interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  subtitle?: string
  children: ReactNode
  className?: string
}

export default function Modal({ open, onClose, title, subtitle, children, className }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(44,36,24,.4)] backdrop-blur-[4px] p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.96, y: 10, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.97, y: 8, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            className={cn(
              'w-full max-w-[520px] max-h-[88dvh] overflow-y-auto rounded-[14px] border border-line bg-paper-surface p-6 shadow-[0_2px_6px_rgba(74,58,35,.08),0_24px_64px_-16px_rgba(74,58,35,.22)]',
              className,
            )}
          >
            {(title || subtitle) && (
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  {title && <h2 className="font-kufi font-semibold text-[18px] leading-7 text-ink-900">{title}</h2>}
                  {subtitle && <p className="mt-1 text-[12.5px] text-ink-500">{subtitle}</p>}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="إغلاق"
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg text-ink-500 hover:bg-primary-50 hover:text-primary-600 transition-colors"
                >
                  <X className="size-4" />
                </button>
              </div>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
