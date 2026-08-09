/**
 * عدّة محلية مشتركة لصفحات grp-core (الرئيسية / تسجيل نقطة / الأفراح) —
 * لا تعدّل المكونات المشتركة في src/components، بل تكملها:
 * Toast داكن دافئ، Modal مركزي، ذرات ذهبية، هياكل تحميل، حالة خطأ،
 * منتقي تاريخ عربي، ومودال إضافة شخص سريع.
 * (الأدوات النقية في grp-utils.ts)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { AlertTriangle, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Info, UserPlus, X } from 'lucide-react'
import { trpc } from '@/providers/trpc'
import { AuthErrorState, isAuthError } from '@/components/AuthErrorBoundary'
import { cn } from '@/lib/utils'
import { toArabicDigits } from '@/lib/format'
import type { Person } from '@contracts/types'
import { AR_WEEKDAYS, arabicMonth, EASE, formatShortArabicDate, ToastCtx, useToast } from '@/pages/grp-utils'

/* ─────────────────────────── Toast ─────────────────────────── */

const TOAST_ICON = { success: CheckCircle2, error: AlertTriangle, info: Info } as const
const TOAST_TONE = { success: 'text-[#9DC08B]', error: 'text-[#E08A7B]', info: 'text-gold-500' } as const

/** مزوّد Toast — كبسولة داكنة أعلى يسار الشاشة تختفي بعد 4s مع شريط زمني (design.md §٨.٧) */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<{ id: number; kind: 'success' | 'error' | 'info'; text: string }[]>([])
  const nextId = useRef(0)

  const push = useCallback((kind: 'success' | 'error' | 'info', text: string) => {
    const id = ++nextId.current
    setToasts((t) => [...t.slice(-3), { id, kind, text }])
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000)
  }, [])

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed top-4 left-4 z-[120] flex w-[min(92vw,380px)] flex-col gap-2">
        <AnimatePresence>
          {toasts.map((t) => {
            const Icon = TOAST_ICON[t.kind]
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ y: -12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: EASE }}
                className="pointer-events-auto relative overflow-hidden rounded-[14px] bg-[#3A3026] py-3 ps-4 pe-3 text-[#F6F1E7] shadow-pop"
              >
                <div className="flex items-center gap-2.5 text-[13px] leading-5">
                  <Icon className={cn('size-[18px] shrink-0', TOAST_TONE[t.kind])} strokeWidth={2.2} />
                  <span className="flex-1">{t.text}</span>
                </div>
                <motion.span
                  initial={{ scaleX: 1 }}
                  animate={{ scaleX: 0 }}
                  transition={{ duration: 4, ease: 'linear' }}
                  className="absolute bottom-0 right-0 h-[2px] w-full origin-right bg-gold-500/70"
                  aria-hidden
                />
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  )
}

/* ─────────────────────────── Modal ─────────────────────────── */

export interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  maxWidth?: string
}

/** مودال مركزي (design.md §٨.٧) — دخول scale 0.96→1 + y 10→0 خلال 240ms فوق خلفية دافئة معتمة */
export function Modal({ open, onClose, title, subtitle, children, maxWidth = 'max-w-[520px]' }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[110] flex items-center justify-center bg-[rgba(44,36,24,.4)] p-4 backdrop-blur-[4px]"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <motion.div
            initial={{ scale: 0.96, y: 10, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.97, y: 8, opacity: 0 }}
            transition={{ duration: 0.24, ease: EASE }}
            onClick={(e) => e.stopPropagation()}
            className={cn('max-h-[90dvh] w-full overflow-y-auto rounded-xl border border-line bg-paper-surface shadow-pop', maxWidth)}
          >
            <div className="flex items-start justify-between gap-3 border-b border-line px-5 pt-4 pb-3">
              <div>
                <h3 className="font-kufi font-semibold text-[17px] leading-6 text-ink-900">{title}</h3>
                {subtitle && <p className="mt-0.5 text-[12px] text-ink-500">{subtitle}</p>}
                <img src="/ornament-divider.svg" alt="" className="mt-1.5 h-3 w-32 opacity-50 select-none" draggable={false} />
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="إغلاق"
                className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-line text-ink-500 transition-colors hover:bg-primary-50 hover:text-primary-600"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="px-5 py-4">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* ─────────────────────── ذرات ذهبية ─────────────────────── */

/** انفجار 14 ذرة ذهبية من نقطة (design.md §٦.٢) — مرة واحدة لكل burstKey، 700ms */
export function GoldParticles({ burstKey, className }: { burstKey: number; className?: string }) {
  const reduced = useReducedMotion()
  const parts = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const angle = (i / 14) * Math.PI * 2 + (i % 3) * 0.22
        const dist = 42 + ((i * 37) % 46)
        return {
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist * 0.8 - 22,
          size: 3 + ((i * 13) % 4),
          delay: (i % 5) * 0.02,
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [burstKey],
  )
  if (!burstKey || reduced) return null
  return (
    <span key={burstKey} className={cn('pointer-events-none absolute inset-0 z-20', className)} aria-hidden>
      {parts.map((p, i) => (
        <motion.span
          key={i}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: p.x, y: p.y + 26, opacity: 0, scale: 0.35 }}
          transition={{ duration: 0.7, delay: p.delay, ease: 'easeOut' }}
          className="absolute left-1/2 top-1/2 rounded-full bg-gold-500"
          style={{ width: p.size, height: p.size, boxShadow: '0 0 8px rgba(194,155,60,.85)' }}
        />
      ))}
    </span>
  )
}

/* ─────────────────────── تحميل وخطأ ─────────────────────── */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-paper-sunken', className)} aria-hidden />
}

export function CardSkeleton({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('surface-card p-5', className)}>
      <Skeleton className="h-5 w-1/3" />
      <div className="mt-4 flex flex-col gap-3">
        {Array.from({ length: lines }, (_, i) => (
          <Skeleton key={i} className={cn('h-4', i % 2 ? 'w-2/3' : 'w-full')} />
        ))}
      </div>
    </div>
  )
}

/** حالة خطأ دافئة مع زر إعادة المحاولة */
export function ErrorState({ onRetry, message, error }: { onRetry?: () => void; message?: string; error?: unknown }) {
  if (isAuthError(error) || isAuthError(message)) return <AuthErrorState />
  return (
    <div className="surface-card flex flex-col items-center justify-center px-6 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-redink-bg text-redink">
        <AlertTriangle className="size-6" />
      </span>
      <h3 className="mt-4 font-kufi font-semibold text-[17px] text-ink-900">حصلت مشكلة أثناء تحميل البيانات</h3>
      <p className="mt-1.5 max-w-[380px] text-[13px] text-ink-500">{message ?? 'اتأكد من اتصالك ومن تسجيل الدخول، ثم حاول مرة تانية.'}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex items-center gap-2 rounded-[10px] border border-line-strong px-[18px] py-2.5 text-[14px] font-medium text-ink-700 transition-colors hover:bg-primary-50"
        >
          إعادة المحاولة
        </button>
      )}
    </div>
  )
}

/* ─────────────────── منتقي تاريخ عربي مصغّر ─────────────────── */

export interface ArabicDateFieldProps {
  value: Date | null
  onChange: (d: Date) => void
  min?: Date
  className?: string
}

/** منتقي تاريخ عربي: شبكة شهر بأيام الأسبوع بالعربية، الشهر الحالي أولًا (weddings.md §١.٤) */
export function ArabicDateField({ value, onChange, min, className }: ArabicDateFieldProps) {
  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(() => (value ?? new Date()).getFullYear())
  const [viewMonth, setViewMonth] = useState(() => (value ?? new Date()).getMonth())
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const cells = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1)
    const startWeekday = first.getDay()
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const list: (Date | null)[] = Array.from({ length: startWeekday }, () => null)
    for (let d = 1; d <= daysInMonth; d++) list.push(new Date(viewYear, viewMonth, d))
    return list
  }, [viewYear, viewMonth])

  const shiftMonth = (delta: number) => {
    const next = new Date(viewYear, viewMonth + delta, 1)
    setViewYear(next.getFullYear())
    setViewMonth(next.getMonth())
  }

  const minDay = min ? new Date(min.getFullYear(), min.getMonth(), min.getDate()) : null
  const today = new Date()

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex h-11 w-full items-center gap-2.5 rounded-[10px] border border-line-strong bg-paper-surface px-3.5 text-[14px] transition-colors',
          open ? 'border-primary-500' : 'hover:border-primary-300',
          value ? 'text-ink-900' : 'text-ink-400',
        )}
      >
        <CalendarDays className="size-[18px] text-ink-500" />
        {value ? `${AR_WEEKDAYS[value.getDay()]}، ${formatShortArabicDate(value)}` : 'اختار تاريخ الفرح…'}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16, ease: EASE }}
            className="absolute z-50 mt-2 w-[300px] rounded-xl border border-line bg-paper-surface p-3 shadow-pop"
          >
            <div className="flex items-center justify-between">
              <button
                type="button"
                aria-label="الشهر التالي"
                onClick={() => shiftMonth(1)}
                className="flex size-8 items-center justify-center rounded-lg text-ink-500 transition-colors hover:bg-primary-50 hover:text-primary-600"
              >
                <ChevronRight className="size-4" />
              </button>
              <span className="font-kufi font-semibold text-[14px] text-ink-900">
                {arabicMonth(viewMonth)} {toArabicDigits(viewYear)}
              </span>
              <button
                type="button"
                aria-label="الشهر السابق"
                onClick={() => shiftMonth(-1)}
                className="flex size-8 items-center justify-center rounded-lg text-ink-500 transition-colors hover:bg-primary-50 hover:text-primary-600"
              >
                <ChevronLeft className="size-4" />
              </button>
            </div>

            <div className="mt-2 grid grid-cols-7 gap-0.5 text-center text-[11px] font-medium text-ink-500">
              {AR_WEEKDAYS.map((w) => (
                <span key={w} className="py-1">
                  {w}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {cells.map((d, i) => {
                if (!d) return <span key={`x-${i}`} />
                const disabled = minDay !== null && d.getTime() < minDay.getTime()
                const selected = value !== null && d.getTime() === new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime()
                const isToday = d.toDateString() === today.toDateString()
                return (
                  <button
                    key={d.getTime()}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      onChange(d)
                      setOpen(false)
                    }}
                    className={cn(
                      'flex h-9 items-center justify-center rounded-lg text-[13px] transition-colors',
                      selected
                        ? 'bg-primary-500 font-semibold text-[#FFFDF8]'
                        : disabled
                          ? 'cursor-not-allowed text-ink-400 opacity-40'
                          : isToday
                            ? 'bg-gold-100 font-semibold text-gold-600 hover:bg-primary-100'
                            : 'text-ink-700 hover:bg-primary-50',
                    )}
                  >
                    {toArabicDigits(d.getDate())}
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ─────────────────── مفتاح اختصار ─────────────────── */

/** مفتاح اختصار صغير kbd */
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd className={cn('rounded-md border border-line bg-paper-sunken px-1.5 py-0.5 text-[10.5px] font-medium text-ink-500 num-ltr', className)}>
      {children}
    </kbd>
  )
}

/* ─────────────── مودال إضافة شخص سريع ─────────────── */

export interface QuickAddPersonModalProps {
  open: boolean
  initialName: string
  regions: string[]
  onClose: () => void
  onCreated: (p: Person) => void
  /** وصف يظهر تحت العنوان */
  subtitle?: string
}

/** مودال «شخص جديد»: اسم معبّأ مسبقًا + تليفون + منطقة بإكمال تلقائي (design.md §٨.٥) */
export function QuickAddPersonModal(props: QuickAddPersonModalProps) {
  if (!props.open) return null
  return <QuickAddPersonForm key={props.initialName} {...props} />
}

function QuickAddPersonForm({ initialName, regions, onClose, onCreated, subtitle }: QuickAddPersonModalProps) {
  const toast = useToast()
  const utils = trpc.useUtils()
  const [name, setName] = useState(initialName)
  const [phone, setPhone] = useState('')
  const [region, setRegion] = useState('')
  const [error, setError] = useState('')

  const create = trpc.persons.create.useMutation({
    onSuccess: async (p) => {
      await utils.persons.invalidate()
      toast('success', `اتسجّل «${p.name}» في الدفتر ✓`)
      onCreated(p)
      onClose()
    },
    onError: (e) => setError(e.message),
  })

  const valid = name.trim().length >= 2 && phone.trim().length >= 6

  return (
    <Modal open onClose={onClose} title="شخص جديد" subtitle={subtitle ?? 'هيتسجّل في دفتر الأشخاص ويتحدد فورًا'}>
      <div className="flex flex-col gap-3.5">
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink-700">الاسم</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-11 rounded-[10px] border border-line-strong bg-paper-surface px-3.5 text-[14px] text-ink-900 focus:border-primary-500 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink-700">التليفون</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            dir="ltr"
            placeholder="01xxxxxxxxx"
            className="h-11 rounded-[10px] border border-line-strong bg-paper-surface px-3.5 text-[14px] text-ink-900 placeholder:text-ink-400 focus:border-primary-500 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink-700">المنطقة</span>
          <input
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            list="quick-add-regions"
            placeholder="المعادي، حلوان، مدينة نصر…"
            className="h-11 rounded-[10px] border border-line-strong bg-paper-surface px-3.5 text-[14px] text-ink-900 placeholder:text-ink-400 focus:border-primary-500 focus:outline-none"
          />
          <datalist id="quick-add-regions">
            {regions.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </label>

        {error && (
          <p className="flex items-center gap-2 rounded-lg bg-redink-bg px-3 py-2 text-[12.5px] text-redink">
            <AlertTriangle className="size-4 shrink-0" />
            {error}
          </p>
        )}

        <div className="mt-1 flex items-center gap-2.5">
          <button
            type="button"
            disabled={!valid || create.isPending}
            onClick={() => create.mutate({ name: name.trim(), phone: phone.trim(), region: region.trim() })}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-[10px] bg-primary-500 px-4 py-2.5 text-[14px] font-semibold text-[#FFFDF8] transition-all hover:bg-primary-600 active:scale-[0.97] disabled:opacity-50"
          >
            <UserPlus className="size-4" />
            {create.isPending ? 'بيحفظ…' : 'حفظ واختيار'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[10px] border border-line-strong px-4 py-2.5 text-[14px] font-medium text-ink-700 transition-colors hover:bg-primary-50"
          >
            إلغاء
          </button>
        </div>
      </div>
    </Modal>
  )
}
