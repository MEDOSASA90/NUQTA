import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/utils'

/**
 * قائمة منسدلة بهوية «ورق وحبر» الدافئة (design.md §٢):
 * خلفية ورقية #FDFBF5، حدود #E5DAC6، نص حبري #2C2418، hover برونزي فاتح،
 * وظل دافئ shadow-pop. تُرسم عبر portal بإحداثيات viewport (position: fixed)
 * فلا تُقصّ أبدًا بحاوٍ له overflow-hidden (مثل ترويسة صفحة الفرح)،
 * وتعلو كل الطبقات (z-[130] فوق المودالات والترويسة اللزجة).
 */

export interface WarmMenuItem {
  key: string
  label: ReactNode
  icon?: ReactNode
  onSelect: () => void
  danger?: boolean
}

export interface WarmMenuProps {
  /** زر الفتح — render prop يستلم حالة الفتح ودالة التبديل */
  trigger: (ctl: { open: boolean; toggle: () => void }) => ReactNode
  /** عناصر جاهزة (أو مرّر children لمحتوى مخصص) */
  items?: WarmMenuItem[]
  /** محتوى مخصص للوحة — يستلم دالة الإغلاق */
  children?: (close: () => void) => ReactNode
  /** عرض اللوحة بالبكسل */
  width?: number
  /** محاذاة فيزيائية لحافة الزر: left (افتراضي) أو right */
  align?: 'left' | 'right'
  ariaLabel?: string
  onOpenChange?: (open: boolean) => void
  panelClassName?: string
}

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number]

export function WarmMenu({ trigger, items, children, width = 224, align = 'left', ariaLabel, onOpenChange, panelClassName }: WarmMenuProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLUListElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  const setOpenBoth = (v: boolean) => {
    setOpen(v)
    onOpenChange?.(v)
  }
  const toggle = () => setOpenBoth(!open)
  const close = () => setOpenBoth(false)

  /* حساب الموضع قبل الطلاء — بلا وميض */
  useLayoutEffect(() => {
    if (!open) {
      setPos(null)
      return
    }
    const compute = () => {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (!rect) return
      let left = align === 'right' ? rect.right - width : rect.left
      left = Math.max(8, Math.min(left, window.innerWidth - width - 8))
      const menuH = menuRef.current?.offsetHeight ?? (items?.length ?? 3) * 44 + 12
      let top = rect.bottom + 8
      if (top + menuH > window.innerHeight - 8) top = Math.max(8, rect.top - menuH - 8)
      setPos({ top, left })
    }
    compute()
  }, [open, align, width, items?.length])

  /* إغلاق: ضغطة خارجًا / Escape / تمرير أو تغيير حجم (الموضع fixed يبقى صحيحًا) */
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (menuRef.current?.contains(t) || triggerRef.current?.contains(t)) return
      setOpenBoth(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenBoth(false)
    }
    const onScroll = () => setOpenBoth(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <div ref={triggerRef} className="relative inline-block">
      {trigger({ open, toggle })}
      {createPortal(
        <AnimatePresence>
          {open && pos && (
            <motion.ul
              ref={menuRef}
              role="menu"
              aria-label={ariaLabel}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16, ease: EASE }}
              className={cn('fixed z-[130] overflow-hidden rounded-xl border border-line bg-paper-surface py-1 shadow-pop', panelClassName)}
              style={{ top: pos.top, left: pos.left, width }}
            >
              {children
                ? children(close)
                : items?.map((it) => (
                    <li key={it.key}>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          close()
                          it.onSelect()
                        }}
                        className={cn(
                          'flex w-full items-center gap-2.5 px-4 py-2.5 text-start text-[13px] font-medium transition-colors hover:bg-primary-50',
                          it.danger ? 'text-redink' : 'text-ink-900',
                        )}
                      >
                        {it.icon}
                        {it.label}
                      </button>
                    </li>
                  ))}
            </motion.ul>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  )
}

export default WarmMenu
