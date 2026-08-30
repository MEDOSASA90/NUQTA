import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  BellRing,
  Bot,
  Check,
  CheckCheck,
  Clock,
  Cloud,
  CloudOff,
  Eye,
  Inbox,
  ListOrdered,
  MessageCircle,
  Mic,
  NotebookPen,
  Phone,
  Play,
  Scale,
  Search,
  Send,
  Settings2,
  Square,
  Wallet,
  X,
  XCircle,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { trpc } from '@/providers/trpc'
import { cn } from '@/lib/utils'
import { formatArabicDate, toArabicDigits } from '@/lib/format'
import EmptyState from '@/components/EmptyState'
import { AuthErrorState, isAuthError } from '@/components/AuthErrorBoundary'

/**
 * صفحة واتساب (whatsapp.md) — مركز التحكم في قناة واتساب:
 * سجل الرسائل (فلاتر + درج معاينة بفقاعات) · إعدادات التذكير (٣ أيام
 * افتراضيًا + مفاتيح الأنظمة أ/ب/ج + بطاقة حالة التكامل + إرسال تذكيرات
 * الآن) · محاكاة البوت التفاعلية (شات حي + أوامر + رسائل صوتية مفرّغة).
 */

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number]

type WaKind = 'reminder' | 'confirmation' | 'phone_verification' | 'correction' | 'bot_reply' | 'bot_query'
type WaStatus = 'queued' | 'sent' | 'delivered' | 'failed' | 'simulated'
type LogRow = {
  id: number
  tenantId: number
  personId: number | null
  phone: string
  direction: 'out' | 'in'
  kind: WaKind
  body: string
  status: WaStatus
  eventId: number | null
  nuqtaId: number | null
  createdAt: Date
}

const KIND_META: Record<WaKind, { label: string; chip: string }> = {
  confirmation: { label: 'تأكيد نقطة', chip: 'bg-laha-bg text-laha-text' },
  phone_verification: { label: 'تحقق هاتف', chip: 'bg-primary-100 text-primary-700' },
  reminder: { label: 'تذكير فرح', chip: 'bg-gold-100 text-gold-600' },
  bot_reply: { label: 'رد بوت', chip: 'bg-primary-100 text-primary-700' },
  bot_query: { label: 'استفسار لبوت', chip: 'bg-whatsapp-bg text-whatsapp' },
  correction: { label: 'رسالة تصحيح', chip: 'bg-redink-bg text-redink' },
}

const STATUS_META: Record<WaStatus, { label: string; chip: string; icon: LucideIcon }> = {
  simulated: { label: 'محاكاة', chip: 'bg-paper-sunken text-ink-500', icon: Bot },
  queued: { label: 'في الانتظار', chip: 'bg-paper-sunken text-ink-500', icon: Clock },
  sent: { label: 'أُرسلت', chip: 'bg-primary-100 text-primary-700', icon: Check },
  delivered: { label: 'سُلّمت', chip: 'bg-laha-bg text-laha-text', icon: CheckCheck },
  failed: { label: 'فشلت', chip: 'bg-redink-bg text-redink', icon: XCircle },
}

function KindChip({ kind }: { kind: WaKind }) {
  const meta = KIND_META[kind] ?? { label: kind, chip: 'bg-paper-sunken text-ink-500' }
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-[11.5px] font-semibold whitespace-nowrap', meta.chip)}>
      {meta.label}
    </span>
  )
}

function StatusBadge({ status, className }: { status: WaStatus; className?: string }) {
  const meta = STATUS_META[status] ?? STATUS_META.queued
  const Icon = meta.icon
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold whitespace-nowrap', meta.chip, className)}>
      <Icon className="size-3.5" />
      {meta.label}
    </span>
  )
}

/** مفتاح تفعيل بنابض 180ms (design §٤.١) */
function Toggle({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 disabled:opacity-50',
        checked ? 'bg-primary-500' : 'bg-line-strong',
      )}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        className={cn(
          'absolute top-0.5 size-5 rounded-full bg-[#FFFDF8] shadow-sm',
          checked ? 'start-[22px]' : 'start-0.5',
        )}
      />
    </button>
  )
}

function timeLabel(dInput: Date): { day: string; time: string } {
  const d = new Date(dInput)
  const now = new Date()
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const dayDiff = Math.round((startOf(now) - startOf(d)) / 86400000)
  const day = dayDiff === 0 ? 'اليوم' : dayDiff === 1 ? 'أمس' : formatArabicDate(d).split(' ').slice(0, 3).join(' ')
  let h = d.getHours()
  const suffix = h < 12 ? 'ص' : 'م'
  h = h % 12 || 12
  const m = String(d.getMinutes()).padStart(2, '0')
  return { day, time: `${h}:${m} ${suffix}` }
}

function fullTime(dInput: Date): string {
  const d = new Date(dInput)
  let h = d.getHours()
  const suffix = h < 12 ? 'صباحًا' : 'مساءً'
  h = h % 12 || 12
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${h}:${mm}:${ss} ${suffix}`
}

/** هيكل تحميل باهت */
function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-paper-sunken', className)} />
}

/** بطاقة خطأ استعلام — خطأ المصادقة يعرض زر «تسجيل الدخول» بدل إعادة المحاولة */
function QueryError({ message, onRetry }: { message: string; onRetry: () => void }) {
  if (isAuthError(message)) return <AuthErrorState />
  return (
    <div className="surface-card flex flex-col items-center gap-3 py-10 text-center">
      <XCircle className="size-8 text-redink" />
      <p className="text-[14px] font-semibold text-ink-900">تعذّر تحميل البيانات</p>
      <p className="max-w-[420px] text-[12.5px] text-ink-500">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-[10px] border border-line-strong px-4 py-2 text-[13px] font-semibold text-ink-700 transition-colors hover:bg-primary-50"
      >
        إعادة المحاولة
      </button>
    </div>
  )
}

/* ───────────────────────── تبويب سجل الرسائل ───────────────────────── */

type KindFilter = WaKind | 'all'
type DirFilter = 'out' | 'in' | 'all'
type StatusFilter = WaStatus | 'all'

const KIND_FILTERS: { value: KindFilter; label: string }[] = [
  { value: 'all', label: 'الكل' },
  { value: 'confirmation', label: 'تأكيد نقطة' },
  { value: 'phone_verification', label: 'تحقق هاتف' },
  { value: 'reminder', label: 'تذكير فرح' },
  { value: 'bot_reply', label: 'رد بوت' },
  { value: 'correction', label: 'رسالة تصحيح' },
  { value: 'bot_query', label: 'استفسار لبوت' },
]

const DIR_FILTERS: { value: DirFilter; label: string }[] = [
  { value: 'all', label: 'الكل' },
  { value: 'out', label: 'صادرة' },
  { value: 'in', label: 'واردة' },
]

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'الكل' },
  { value: 'simulated', label: 'محاكاة' },
  { value: 'sent', label: 'أُرسلت' },
  { value: 'delivered', label: 'سُلّمت' },
  { value: 'failed', label: 'فشلت' },
  { value: 'queued', label: 'في الانتظار' },
]

function FilterChips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all duration-150',
            value === o.value
              ? 'bg-primary-500 text-[#FFFDF8] shadow-card'
              : 'border border-line bg-paper-surface text-ink-700 hover:bg-primary-50',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** درج معاينة الرسالة — محادثة بفقاعة واتساب + خط زمني الحالة */
function MessageDrawer({
  msg,
  personName,
  eventTitle,
  onClose,
}: {
  msg: LogRow | null
  personName: (m: LogRow) => string
  eventTitle: (id: number | null) => string | null
  onClose: () => void
}) {
  return (
    <AnimatePresence>
      {msg && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[70] bg-[rgba(44,36,24,.4)] backdrop-blur-[4px]"
          onClick={onClose}
        >
          <motion.aside
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-y-0 left-0 flex w-full max-w-[480px] flex-col border-e border-line bg-paper-surface shadow-pop"
            role="dialog"
            aria-label="معاينة الرسالة"
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <div className="min-w-0">
                <h3 className="font-kufi font-semibold text-[16px] text-ink-900 truncate">{personName(msg)}</h3>
                <p className="num-ltr text-[12px] text-ink-500">{msg.phone}</p>
              </div>
              <button
                type="button"
                aria-label="إغلاق"
                onClick={onClose}
                className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-line text-ink-500 transition-colors hover:bg-primary-50"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-[#ECE2D0] p-5">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <KindChip kind={msg.kind} />
                <StatusBadge status={msg.status} />
                <span className="rounded-full bg-paper-surface/80 px-2.5 py-1 text-[11px] font-semibold text-ink-500">
                  {msg.direction === 'out' ? 'صادرة' : 'واردة'}
                </span>
                {eventTitle(msg.eventId) && (
                  <span className="rounded-full bg-gold-100 px-2.5 py-1 text-[11px] font-semibold text-gold-600">
                    {eventTitle(msg.eventId)}
                  </span>
                )}
              </div>

              {/* فقاعة الرسالة كاملة بذيل واتساب */}
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 8 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 26 }}
                className={cn('relative max-w-[85%]', msg.direction === 'out' ? 'ms-auto' : 'me-auto')}
              >
                <div
                  className={cn(
                    'whitespace-pre-wrap rounded-xl p-3.5 text-[13.5px] leading-[22px] shadow-sm',
                    msg.direction === 'out' ? 'rounded-br-sm bg-[#E4F0E6] text-ink-900' : 'rounded-bl-sm bg-paper-surface text-ink-900',
                  )}
                >
                  {msg.body}
                  <span className="mt-1.5 flex items-center justify-end gap-1 text-[10.5px] text-ink-500">
                    {timeLabel(msg.createdAt).time}
                    {msg.direction === 'out' &&
                      (msg.status === 'failed' ? (
                        <XCircle className="size-3.5 text-redink" />
                      ) : msg.status === 'delivered' ? (
                        <CheckCheck className="size-3.5 text-whatsapp" />
                      ) : msg.status === 'sent' ? (
                        <Check className="size-3.5 text-ink-500" />
                      ) : (
                        <Bot className="size-3.5 text-ink-400" />
                      ))}
                  </span>
                </div>
              </motion.div>

              {msg.kind === 'correction' && (
                <div className="mt-3 rounded-xl border border-[#E3C4B8] bg-redink-bg p-3.5 text-[12.5px] text-redink">
                  <span className="font-semibold">رسالة تصحيح</span> — أُرسلت بعد تعديل نقطة سبق إشعارها،
                  والتعديل موثق في سجل التدقيق.
                </div>
              )}

              {/* خط زمني الحالة */}
              <div className="mt-5 rounded-xl border border-line bg-paper-surface p-4">
                <div className="mb-3 text-[12px] font-semibold text-ink-500">رحلة الرسالة</div>
                <ol className="relative space-y-3 border-s-2 border-line ps-4">
                  <li className="relative">
                    <span className="absolute -start-[23px] top-1 size-3 rounded-full bg-primary-500 ring-4 ring-primary-100" />
                    <div className="text-[13px] font-semibold text-ink-900">
                      {msg.status === 'simulated' ? 'اتسجلت كمحاكاة' : msg.direction === 'in' ? 'وصلت للنظام' : 'أُرسلت'}
                    </div>
                    <div className="num-ltr text-[11.5px] text-ink-500">{fullTime(msg.createdAt)}</div>
                  </li>
                  <li className="relative">
                    <span
                      className={cn(
                        'absolute -start-[23px] top-1 size-3 rounded-full ring-4',
                        msg.status === 'delivered' ? 'bg-whatsapp ring-whatsapp-bg' : 'bg-line-strong ring-paper-sunken',
                      )}
                    />
                    <div className={cn('text-[13px] font-semibold', msg.status === 'delivered' ? 'text-ink-900' : 'text-ink-400')}>
                      {msg.status === 'failed' ? 'فشل التسليم' : msg.status === 'delivered' ? 'سُلّمت' : 'بانتظار التسليم'}
                    </div>
                  </li>
                </ol>
              </div>
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function LogTab({ refreshKey }: { refreshKey: number }) {
  const [kind, setKind] = useState<KindFilter>('all')
  const [direction, setDirection] = useState<DirFilter>('all')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [eventId, setEventId] = useState<number | 'all'>('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<LogRow | null>(null)

  const queryInput = useMemo(
    () => ({
      ...(kind !== 'all' ? { kind } : {}),
      ...(direction !== 'all' ? { direction } : {}),
      ...(eventId !== 'all' ? { eventId } : {}),
      limit: 200,
    }),
    [kind, direction, eventId],
  )
  const logQuery = trpc.whatsapp.log.useQuery(queryInput, { refetchInterval: 30000 })
  const personsQuery = trpc.persons.list.useQuery()
  const eventsQuery = trpc.events.list.useQuery({ filter: 'all' })

  // تحديث يدوي عند refreshKey (بعد إرسال تذكيرات/محاكاة)
  useEffect(() => {
    if (refreshKey > 0) logQuery.refetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey])

  const personById = useMemo(() => {
    const map = new Map<number, { name: string; region: string }>()
    for (const p of personsQuery.data ?? []) map.set(p.id, { name: p.name, region: p.region })
    return map
  }, [personsQuery.data])

  const eventById = useMemo(() => {
    const map = new Map<number, string>()
    for (const e of eventsQuery.data ?? []) map.set(e.id, `فرحة ${e.hostName}`)
    return map
  }, [eventsQuery.data])

  const personName = (m: LogRow) =>
    (m.personId != null && personById.get(m.personId)?.name) || 'غير مسجل'
  const eventTitle = (id: number | null) => (id != null ? eventById.get(id) ?? null : null)

  const rows = useMemo(() => {
    const list = (logQuery.data ?? []) as LogRow[]
    const q = search.trim()
    return list.filter((m) => {
      if (status !== 'all' && m.status !== status) return false
      if (!q) return true
      const name = m.personId != null ? personById.get(m.personId)?.name ?? '' : ''
      return name.includes(q) || m.phone.includes(q) || m.body.includes(q)
    })
  }, [logQuery.data, status, search, personById])

  if (logQuery.error) {
    return <QueryError message={logQuery.error.message} onRetry={() => logQuery.refetch()} />
  }

  return (
    <div className="space-y-4">
      {/* شريط الفلاتر */}
      <div className="surface-card space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث باسم المستلم أو رقمه أو نص الرسالة…"
              className="h-10 w-full rounded-[10px] border border-line bg-paper-base ps-9 pe-3 text-[13px] text-ink-900 placeholder:text-ink-400 focus:border-line-strong focus:outline-none"
            />
          </div>
          <select
            value={eventId === 'all' ? 'all' : String(eventId)}
            onChange={(e) => setEventId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="h-10 rounded-[10px] border border-line bg-paper-base px-3 text-[13px] text-ink-700 focus:border-line-strong focus:outline-none"
            aria-label="فلترة بالفرح"
          >
            <option value="all">كل الأفراح</option>
            {(eventsQuery.data ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                فرحة {e.hostName}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[11.5px] font-semibold text-ink-400">النوع:</span>
            <FilterChips options={KIND_FILTERS} value={kind} onChange={setKind} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11.5px] font-semibold text-ink-400">الاتجاه:</span>
            <FilterChips options={DIR_FILTERS} value={direction} onChange={setDirection} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11.5px] font-semibold text-ink-400">الحالة:</span>
            <FilterChips options={STATUS_FILTERS} value={status} onChange={setStatus} />
          </div>
        </div>
      </div>

      {/* الجدول */}
      <div className="surface-card overflow-hidden">
        {logQuery.isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            image="/empty-whatsapp.svg"
            title={(logQuery.data?.length ?? 0) > 0 ? 'مفيش رسائل بالفلاتر دي' : 'لسه مفيش رسائل'}
            description={
              (logQuery.data?.length ?? 0) > 0
                ? 'جرّب توسعة الفلاتر أو امسح البحث.'
                : 'أول نقطة تسجلها هيبعت تأكيدها هنا — وجرّب محاكاة البوت من التبويب التالت.'
            }
          />
        ) : (
          <>
          {/* الجدول — شاشات متوسطة فأكبر */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-[13.5px] leading-[22px]">
              <thead>
                <tr className="sticky top-0 z-10 bg-[#F1EADA]">
                  <th className="px-4 py-3 text-start text-[12px] font-semibold text-ink-700 whitespace-nowrap">الوقت</th>
                  <th className="px-4 py-3 text-start text-[12px] font-semibold text-ink-700 whitespace-nowrap">المستلم</th>
                  <th className="px-4 py-3 text-start text-[12px] font-semibold text-ink-700 whitespace-nowrap">النوع</th>
                  <th className="px-4 py-3 text-start text-[12px] font-semibold text-ink-700">معاينة النص</th>
                  <th className="px-4 py-3 text-start text-[12px] font-semibold text-ink-700 whitespace-nowrap">الحالة</th>
                  <th className="px-4 py-3 text-end text-[12px] font-semibold text-ink-700 whitespace-nowrap">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m, i) => {
                  const t = timeLabel(m.createdAt)
                  return (
                    <motion.tr
                      key={m.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: Math.min(i, 12) * 0.03, ease: EASE }}
                      onClick={() => setSelected(m)}
                      className={cn(
                        'cursor-pointer border-t border-line transition-colors hover:bg-[#FAF5EA]',
                        m.status === 'failed' && 'bg-redink-bg/40',
                      )}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-[12.5px] font-semibold text-ink-900">{t.day}</div>
                        <div className="num-ltr text-[11px] text-ink-500">{t.time}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-kufi text-[13px] font-semibold text-ink-900">{personName(m)}</div>
                        <div className="num-ltr text-[11px] text-ink-500">{m.phone}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <KindChip kind={m.kind} />
                      </td>
                      <td className="max-w-[320px] px-4 py-3">
                        <span className="block truncate text-[12.5px] text-ink-700">{m.body}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusBadge status={m.status} />
                      </td>
                      <td className="px-4 py-3 text-end whitespace-nowrap">
                        <button
                          type="button"
                          aria-label="معاينة الرسالة"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelected(m)
                          }}
                          className="inline-flex size-8 items-center justify-center rounded-lg border border-line text-ink-500 transition-colors hover:bg-primary-50 hover:text-primary-600"
                        >
                          <Eye className="size-4" />
                        </button>
                      </td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* بطاقات مكدسة — موبايل (< 768px) */}
          <ul className="divide-y divide-line md:hidden">
            {rows.map((m, i) => {
              const t = timeLabel(m.createdAt)
              return (
                <motion.li
                  key={m.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(i, 12) * 0.03, ease: EASE }}
                  className={cn(m.status === 'failed' && 'bg-redink-bg/40')}
                >
                  <button
                    type="button"
                    onClick={() => setSelected(m)}
                    className="w-full px-4 py-3.5 text-start active:bg-[#FAF5EA]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block truncate font-kufi text-[13px] font-semibold text-ink-900">{personName(m)}</span>
                        <span className="num-ltr block text-[11px] text-ink-500">{m.phone}</span>
                      </span>
                      <StatusBadge status={m.status} />
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-5 text-ink-700">{m.body}</p>
                    <div className="mt-2 flex items-center gap-2 text-[11px] text-ink-500">
                      <KindChip kind={m.kind} />
                      <span className="ms-auto">
                        {t.day} · <span className="num-ltr">{t.time}</span>
                      </span>
                      <Eye className="size-3.5 text-ink-400" />
                    </div>
                  </button>
                </motion.li>
              )
            })}
          </ul>
          </>
        )}
      </div>

      <MessageDrawer msg={selected} personName={personName} eventTitle={eventTitle} onClose={() => setSelected(null)} />
    </div>
  )
}

/* ───────────────────── تبويب إعدادات التذكير والتكامل ───────────────────── */

function IntegrationCard({
  settings,
}: {
  settings: { mode: 'cloud' | 'simulation'; cloudConfigured: boolean } | undefined
}) {
  const cloud = settings?.mode === 'cloud'
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, ease: EASE }}
      className={cn(
        'surface-card relative overflow-hidden p-5',
        cloud ? 'border-whatsapp/40' : 'border-gold-500/50',
      )}
    >
      <div className="flex items-start gap-4">
        <span
          className={cn(
            'flex size-11 shrink-0 items-center justify-center rounded-[10px]',
            cloud ? 'bg-whatsapp-bg text-whatsapp' : 'bg-gold-100 text-gold-600',
          )}
        >
          {cloud ? <Cloud className="size-5" /> : <CloudOff className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-kufi font-semibold text-[16px] text-ink-900">حالة التكامل</h3>
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold',
                cloud ? 'bg-whatsapp-bg text-whatsapp' : 'bg-gold-100 text-gold-600',
              )}
            >
              <span className="relative flex size-2">
                <span
                  className={cn(
                    'absolute inline-flex h-full w-full animate-ping rounded-full opacity-60',
                    cloud ? 'bg-whatsapp' : 'bg-gold-500',
                  )}
                />
                <span className={cn('relative inline-flex size-2 rounded-full', cloud ? 'bg-whatsapp' : 'bg-gold-500')} />
              </span>
              {cloud ? 'Cloud API مضبوط' : 'وضع المحاكاة'}
            </span>
          </div>
          <p className="mt-1.5 text-[12.5px] leading-5 text-ink-500">
            {cloud
              ? 'الرسائل تُرسل فعليًا عبر WhatsApp Cloud API — التذكيرات والتأكيدات والبوت كلها شغالة على الرقم المربوط.'
              : 'مفاتيح WhatsApp Cloud API مش مضبوطة — كل الرسائل (تذكيرات/تأكيدات/ردود بوت) بتتسجل في الدفتر بحالة «محاكاة» من غير ما تتبعت فعليًا. اضبط المفاتيح في بيئة الخادم للتفعيل الحقيقي.'}
          </p>
        </div>
      </div>
    </motion.div>
  )
}

function SettingsTab({ onRemindersSent }: { onRemindersSent: () => void }) {
  const utils = trpc.useUtils()
  const settingsQuery = trpc.whatsapp.getSettings.useQuery()
  const eventsQuery = trpc.events.list.useQuery({ filter: 'all' })
  const [selectedEvent, setSelectedEvent] = useState<number | null>(null)
  const [sendResult, setSendResult] = useState<{
    hostName: string
    sent: number
    failed: number
    skippedAlreadySentToday: number
    skippedUnverified: number
  } | null>(null)

  const updateMut = trpc.whatsapp.updateSettings.useMutation({
    onSuccess: async () => {
      await utils.whatsapp.getSettings.invalidate()
    },
  })
  const sendMut = trpc.whatsapp.sendRemindersNow.useMutation({
    onSuccess: async (res) => {
      setSendResult(res)
      await Promise.all([utils.whatsapp.log.invalidate(), utils.whatsapp.getSettings.invalidate()])
      onRemindersSent()
    },
  })

  const s = settingsQuery.data
  const upcoming = useMemo(
    () => (eventsQuery.data ?? []).filter((e) => e.status === 'upcoming'),
    [eventsQuery.data],
  )
  // الافتراضي: أول فرحة قادمة (قيمة مشتقة)
  const effectiveEvent: number | null = selectedEvent ?? upcoming[0]?.id ?? null

  const setField = (field: 'reminderDays' | 'remindersEnabled' | 'confirmationsEnabled' | 'botEnabled', value: number | boolean) => {
    if (field === 'reminderDays') updateMut.mutate({ reminderDays: Number(value) })
    else if (field === 'remindersEnabled') updateMut.mutate({ remindersEnabled: Boolean(value) })
    else if (field === 'confirmationsEnabled') updateMut.mutate({ confirmationsEnabled: Boolean(value) })
    else updateMut.mutate({ botEnabled: Boolean(value) })
  }

  if (settingsQuery.error) {
    return <QueryError message={settingsQuery.error.message} onRetry={() => settingsQuery.refetch()} />
  }

  const reminderDays = s?.reminderDays ?? 3

  return (
    <div className="space-y-4">
      <IntegrationCard settings={s} />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* بطاقة تذكير الأفراح (النظام أ) */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, delay: 0.05, ease: EASE }}
          className="surface-card p-5"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-[10px] bg-gold-100 text-gold-600">
                <BellRing className="size-5" />
              </span>
              <div>
                <h3 className="font-kufi font-semibold text-[16px] text-ink-900">تذكير الأفراح</h3>
                <p className="text-[12px] text-ink-500">النظام أ — التذكير اليومي قبل الفرح</p>
              </div>
            </div>
            <Toggle
              label="تفعيل التذكير اليومي قبل الفرح"
              checked={s?.remindersEnabled ?? true}
              disabled={settingsQuery.isLoading || updateMut.isPending}
              onChange={(v) => setField('remindersEnabled', v)}
            />
          </div>

          <div className="mt-5 space-y-4">
            <div>
              <div className="mb-2 text-[13px] font-semibold text-ink-700">يبدأ التذكير قبل الفرح بـ</div>
              <div className="flex items-center gap-2">
                {[2, 3, 5].map((d) => (
                  <button
                    key={d}
                    type="button"
                    disabled={updateMut.isPending}
                    onClick={() => setField('reminderDays', d)}
                    className={cn(
                      'flex h-11 min-w-[64px] flex-col items-center justify-center rounded-[10px] border px-4 transition-all duration-150',
                      reminderDays === d
                        ? 'border-primary-500 bg-primary-100 text-primary-700 shadow-card'
                        : 'border-line bg-paper-base text-ink-700 hover:bg-primary-50',
                    )}
                  >
                    <span className="num-ltr font-kufi text-[17px] font-bold leading-5">{toArabicDigits(d)}</span>
                    <span className="text-[10.5px]">{d === 2 ? 'يومين' : 'أيام'}</span>
                  </button>
                ))}
                <span className="text-[12px] text-ink-500">(الافتراضي {toArabicDigits(3)} أيام)</span>
              </div>
            </div>

            {/* معاينة حية لنص التذكير */}
            <div className="rounded-xl bg-[#ECE2D0] p-3.5">
              <div className="mb-2 text-[11px] font-semibold text-ink-500">معاينة نص التذكير</div>
              <div className="max-w-[90%] rounded-xl rounded-br-sm bg-[#E4F0E6] p-3 text-[12.5px] leading-5 text-ink-900 shadow-sm">
                ⏰ فاضل <span className="font-semibold">{toArabicDigits(reminderDays)} {reminderDays === 2 ? 'يومين' : 'أيام'}</span> على
                فرحة {upcoming.find((e) => e.id === effectiveEvent)?.hostName ?? '…'}
                — دفترك جاهز وربنا يتمم بخير 🎉
              </div>
            </div>
          </div>
        </motion.div>

        {/* بطاقة الأنظمة ب/ج */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, delay: 0.1, ease: EASE }}
          className="surface-card p-5"
        >
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-[10px] bg-laha-bg text-laha-solid">
              <Settings2 className="size-5" />
            </span>
            <div>
              <h3 className="font-kufi font-semibold text-[16px] text-ink-900">التأكيدات والبوت</h3>
              <p className="text-[12px] text-ink-500">النظام ب (تأكيد النقطة) والنظام ج (البوت الذكي)</p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-paper-base p-3.5">
              <div>
                <div className="text-[13.5px] font-semibold text-ink-900">تأكيد النقطة الفوري</div>
                <p className="text-[12px] text-ink-500">رسالة واتساب للدافع بعد تسجيل كل نقطة مباشرة</p>
              </div>
              <Toggle
                label="تفعيل تأكيد النقطة الفوري"
                checked={s?.confirmationsEnabled ?? true}
                disabled={settingsQuery.isLoading || updateMut.isPending}
                onChange={(v) => setField('confirmationsEnabled', v)}
              />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-paper-base p-3.5">
              <div>
                <div className="text-[13.5px] font-semibold text-ink-900">البوت الذكي (الرد الآلي)</div>
                <p className="text-[12px] text-ink-500">يرد على استفسارات الناس بالعامية — كشف حساب وأرصدة وأفراح</p>
              </div>
              <Toggle
                label="تفعيل البوت الذكي"
                checked={s?.botEnabled ?? true}
                disabled={settingsQuery.isLoading || updateMut.isPending}
                onChange={(v) => setField('botEnabled', v)}
              />
            </div>
            {s?.botEnabled === false && (
              <p className="rounded-lg bg-redink-bg px-3 py-2 text-[12px] font-semibold text-redink">
                البوت متعطل حاليًا — محاكاة البوت هترفض الردود لحد ما تفعّله.
              </p>
            )}
          </div>
        </motion.div>
      </div>

      {/* إرسال تذكيرات الآن */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.38, delay: 0.15, ease: EASE }}
        className="surface-card p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-[10px] bg-whatsapp-bg text-whatsapp">
              <Send className="size-5" />
            </span>
            <div>
              <h3 className="font-kufi font-semibold text-[16px] text-ink-900">إرسال تذكيرات الآن</h3>
              <p className="text-[12px] text-ink-500">اختبار يدوي للنظام أ — يبعت التذكير لكل المتعاملين مع صاحب الفرح</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={effectiveEvent == null ? '' : String(effectiveEvent)}
              onChange={(e) => setSelectedEvent(Number(e.target.value))}
              className="h-11 min-w-[200px] rounded-[10px] border border-line bg-paper-base px-3 text-[13px] text-ink-700 focus:border-line-strong focus:outline-none"
              aria-label="اختيار الفرح"
            >
              {upcoming.length === 0 && <option value="">مفيش أفراح قادمة</option>}
              {upcoming.map((e) => (
                <option key={e.id} value={e.id}>
                  فرحة {e.hostName} — {formatArabicDate(new Date(e.eventDate))}
                </option>
              ))}
            </select>
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              disabled={effectiveEvent == null || sendMut.isPending || s?.remindersEnabled === false}
              onClick={() => effectiveEvent != null && sendMut.mutate({ eventId: effectiveEvent })}
              className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-whatsapp px-5 text-[14px] font-semibold text-[#FFFDF8] shadow-card transition-colors hover:bg-[#276a41] disabled:opacity-50"
            >
              {sendMut.isPending ? (
                <span className="size-4 animate-spin rounded-full border-2 border-[#FFFDF8]/40 border-t-[#FFFDF8]" />
              ) : (
                <BellRing className="size-4" />
              )}
              {sendMut.isPending ? 'بنبعت…' : 'إرسال تذكيرات الآن'}
            </motion.button>
          </div>
        </div>

        <AnimatePresence>
          {sendMut.error && (
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-3 rounded-lg bg-redink-bg px-3 py-2 text-[12.5px] font-semibold text-redink"
            >
              {sendMut.error.message}
            </motion.p>
          )}
          {sendResult && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="mt-4 grid gap-2.5 sm:grid-cols-4"
            >
              <div className="rounded-xl border border-laha-solid/30 bg-laha-bg p-3.5 text-center">
                <div className="num-ltr font-kufi text-[24px] font-bold leading-7 text-laha-text">{sendResult.sent}</div>
                <div className="text-[12px] font-semibold text-laha-text">رسالة اتبعتت</div>
              </div>
              <div className="rounded-xl border border-line bg-paper-sunken p-3.5 text-center">
                <div className="num-ltr font-kufi text-[24px] font-bold leading-7 text-ink-700">
                  {sendResult.skippedAlreadySentToday}
                </div>
                <div className="text-[12px] font-semibold text-ink-500">اتخطّى (اتبعت النهارده)</div>
              </div>
              <div className="rounded-xl border border-partial-solid/30 bg-partial-bg p-3.5 text-center">
                <div className="num-ltr font-kufi text-[24px] font-bold leading-7 text-partial-text">
                  {sendResult.skippedUnverified}
                </div>
                <div className="text-[12px] font-semibold text-partial-text">اتخطّى (تليفون غير مؤكد)</div>
              </div>
              <div className="rounded-xl border border-redink/20 bg-redink-bg p-3.5 text-center">
                <div className="num-ltr font-kufi text-[24px] font-bold leading-7 text-redink">{sendResult.failed}</div>
                <div className="text-[12px] font-semibold text-redink">فشل الإرسال</div>
              </div>
              <p className="text-[12px] text-ink-500 sm:col-span-3">
                تم تنفيذ الإرسال لفرحة «{sendResult.hostName}» — الرسائل متسجلة في سجل الرسائل
                {s?.mode === 'simulation' ? ' بحالة «محاكاة»' : ''}.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}

/* ───────────────────── تبويب محاكاة البوت التفاعلية ───────────────────── */

type BotMatched = 'menu' | 'keyword' | 'name' | 'fallback'

interface ChatMsg {
  id: number
  from: 'user' | 'bot'
  text: string
  kind: 'text' | 'voice'
  matched?: BotMatched
  personFound?: boolean
  duration?: string
}

const MATCHED_LABEL: Record<BotMatched, string> = {
  menu: 'أمر من القائمة',
  keyword: 'كلمة مفتاحية بالعامية',
  name: 'اسم شخص من الدفتر',
  fallback: 'القائمة الافتراضية',
}

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/** موجة التسجيل الصوتي — أعمدة تتذبذب (معزولة حتى لا يعاد تصيير الشات) */
const RecordingWave = function RecordingWave() {
  return (
    <span className="flex h-6 items-center gap-[3px]" aria-hidden>
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <motion.span
          key={i}
          className="w-[3px] rounded-full bg-[#FFFDF8]"
          style={{ height: 20 }}
          animate={{ scaleY: [0.3, 1, 0.45] }}
          transition={{ repeat: Infinity, duration: 0.5 + (i % 3) * 0.12, delay: i * 0.07, ease: 'easeInOut' }}
        />
      ))}
    </span>
  )
}

/** موجة ثابتة داخل فقاعة الرسالة الصوتية */
function StaticWave() {
  const heights = [8, 14, 10, 18, 12, 20, 9, 15, 11, 17, 8, 13, 10, 6]
  return (
    <span className="flex h-6 items-center gap-[2.5px]" aria-hidden>
      {heights.map((h, i) => (
        <span key={i} className="w-[3px] rounded-full bg-whatsapp/70" style={{ height: h }} />
      ))}
    </span>
  )
}

/** مؤشر كتابة البوت — ٣ نقاط متتالية النبض */
const TypingIndicator = function TypingIndicator() {
  return (
    <div className="flex items-center gap-2">
      <img src="/bot-avatar.svg" alt="" className="size-8 shrink-0 rounded-full border border-line bg-paper-surface p-0.5" />
      <div className="flex items-center gap-1.5 rounded-xl rounded-bl-sm bg-paper-surface px-4 py-3 shadow-sm">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="size-2 rounded-full bg-ink-400"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ repeat: Infinity, duration: 0.9, delay: i * 0.2, ease: 'easeInOut' }}
          />
        ))}
      </div>
    </div>
  )
}

/** فقاعة رسالة في الشات — تنبثق scale 0.85→1 (design §٦.٢/٤) */
function ChatBubble({ msg }: { msg: ChatMsg }) {
  const isUser = msg.from === 'user'
  return (
    <motion.div
      initial={{ scale: 0.85, opacity: 0, y: 8 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 420, damping: 28 }}
      className={cn('flex items-end gap-2', isUser ? 'justify-start' : 'justify-end')}
    >
      {!isUser && (
        <img src="/bot-avatar.svg" alt="بوت أفراح الجمعية" className="size-8 shrink-0 rounded-full border border-line bg-paper-surface p-0.5" />
      )}
      <div className={cn('flex max-w-[82%] flex-col gap-1', isUser ? 'items-start' : 'items-end')}>
        {/* بطاقة الفهم فوق رد البوت */}
        {!isUser && msg.matched && msg.matched !== 'fallback' && (
          <motion.span
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.25 }}
            className="rounded-full border border-line bg-paper-surface/85 px-2.5 py-1 text-[10.5px] font-semibold text-ink-500 backdrop-blur-sm"
          >
            فهمت: {MATCHED_LABEL[msg.matched]}
          </motion.span>
        )}
        <div
          className={cn(
            'whitespace-pre-wrap rounded-xl p-3 text-[13px] leading-[21px] shadow-sm',
            isUser ? 'rounded-br-sm bg-[#E4F0E6] text-ink-900' : 'rounded-bl-sm bg-paper-surface text-ink-900',
          )}
        >
          {msg.kind === 'voice' ? (
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-whatsapp text-[#FFFDF8]">
                <Play className="size-4 -scale-x-100" />
              </span>
              <StaticWave />
              <span className="num-ltr text-[11px] text-ink-500">{msg.duration ?? '0:07'}</span>
            </div>
          ) : null}
          {msg.kind === 'voice' && <div className="mt-2 border-t border-line pt-2 text-[12px] text-ink-500">التفريغ: «{msg.text}»</div>}
          {msg.kind === 'text' && msg.text}
          {isUser && (
            <span className="mt-1 flex items-center justify-end gap-1 text-[10px] text-ink-500">
              الآن
              <CheckCheck className="size-3.5 text-whatsapp" />
            </span>
          )}
        </div>
      </div>
    </motion.div>
  )
}

const COMMANDS: { cmd: string; title: string; desc: string; icon: LucideIcon; action: 'send' | 'prefill' }[] = [
  { cmd: '1', title: 'كشف حساب', desc: 'كل أرصدتك له وعليه', icon: Wallet, action: 'send' },
  { cmd: '2', title: 'أفراحي القادمة', desc: 'الأفراح الجاية والمطلوب منك', icon: BellRing, action: 'send' },
  { cmd: '3', title: 'رصيد مع شخص', desc: 'اكتب 3 والاسم — مثل: 3 كريم', icon: NotebookPen, action: 'prefill' },
  { cmd: '4', title: 'صافي رصيدي', desc: 'صافيك الكلي مع الناس', icon: Scale, action: 'send' },
  { cmd: 'القائمة', title: 'قائمة الأوامر', desc: 'البوت يعرض الأوامر داخل الشات', icon: ListOrdered, action: 'send' },
]

function BotSimTab({ onActivity }: { onActivity: () => void }) {
  const utils = trpc.useUtils()
  const personsQuery = trpc.persons.list.useQuery()
  const [phone, setPhone] = useState('')
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [recording, setRecording] = useState(false)
  const [transcribe, setTranscribe] = useState<string | null>(null)
  const [transcribeText, setTranscribeText] = useState('')
  const [msgs, setMsgs] = useState<ChatMsg[]>([
    {
      id: 0,
      from: 'bot',
      kind: 'text',
      matched: 'menu',
      text: 'أهلاً بيك في محاكاة بوت أفراح الجمعية 📒\nاختار رقم تليفون من دفترك (أو اكتب أي رقم)، وبعدين ابعت بالعامية براحتك أو دوس على أمر من القائمة.',
    },
  ])
  const idRef = useRef(1)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const simulateMut = trpc.whatsapp.simulateBot.useMutation({
    onSuccess: async () => {
      await utils.whatsapp.log.invalidate()
      onActivity()
    },
  })

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [msgs, typing])

  const pushMsg = (m: Omit<ChatMsg, 'id'>) => {
    const id = idRef.current++
    setMsgs((prev) => [...prev.slice(-40), { ...m, id }])
  }

  const sendToBot = async (text: string) => {
    const clean = text.trim()
    if (!clean || typing) return
    setTyping(true)
    try {
      const [res] = await Promise.all([
        simulateMut.mutateAsync({ phone: phone.trim() || '01000000000', text: clean }),
        delay(750),
      ])
      pushMsg({ from: 'bot', kind: 'text', text: res.reply, matched: res.matched, personFound: res.personFound })
    } catch (e) {
      pushMsg({
        from: 'bot',
        kind: 'text',
        text: `⚠️ ${e instanceof Error ? e.message : 'حصل خطأ أثناء المحاكاة'}`,
        matched: 'fallback',
      })
    } finally {
      setTyping(false)
    }
  }

  const sendText = () => {
    const clean = input.trim()
    if (!clean) return
    setInput('')
    pushMsg({ from: 'user', kind: 'text', text: clean })
    void sendToBot(clean)
  }

  const runCommand = (c: (typeof COMMANDS)[number]) => {
    if (c.action === 'prefill') {
      setInput('3 ')
      inputRef.current?.focus()
      return
    }
    pushMsg({ from: 'user', kind: 'text', text: c.cmd })
    void sendToBot(c.cmd)
  }

  // محاكاة التسجيل الصوتي: موجة ثانيتين ثم حقل «التفريغ»
  const startRecording = async () => {
    if (recording || transcribe !== null) return
    setRecording(true)
    await delay(2000)
    setRecording(false)
    setTranscribeText('يا بوت قولي أنا مطلوب مني كام')
    setTranscribe('ready')
  }

  const sendVoice = () => {
    const text = transcribeText.trim() || 'يا بوت قولي أنا مطلوب مني كام'
    setTranscribe(null)
    pushMsg({ from: 'user', kind: 'voice', text, duration: '0:07' })
    void sendToBot(text)
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-12">
      {/* نافذة الشات */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.38, ease: EASE }}
        className="surface-card overflow-hidden lg:col-span-7"
      >
        {/* اختيار شخصية المتصل */}
        <div className="flex flex-wrap items-center gap-2.5 border-b border-line bg-paper-base px-4 py-3">
          <span className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-500">
            <Phone className="size-3.5" />
            شخصية المتصل:
          </span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="01xxxxxxxxx"
            inputMode="tel"
            aria-label="رقم تليفون المتصل"
            className="num-ltr h-9 w-[150px] rounded-lg border border-line bg-paper-surface px-3 text-[13px] text-ink-900 placeholder:text-ink-400 focus:border-line-strong focus:outline-none"
          />
          <select
            value=""
            onChange={(e) => {
              const p = (personsQuery.data ?? []).find((x) => String(x.id) === e.target.value)
              if (p) setPhone(p.phone)
            }}
            className="h-9 rounded-lg border border-line bg-paper-surface px-2 text-[12.5px] text-ink-700 focus:border-line-strong focus:outline-none"
            aria-label="اختيار شخص من الدفتر"
          >
            <option value="">اختار من الدفتر…</option>
            {(personsQuery.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.phone}
              </option>
            ))}
          </select>
          <span className="text-[11px] text-ink-400">رقم مسجل = البوت يعرفه، رقم غريب = رسالة ترحيب</span>
        </div>

        {/* ترويسة الشات الخضراء */}
        <div className="flex items-center gap-3 bg-whatsapp px-4 py-3">
          <img src="/bot-avatar.svg" alt="" className="size-10 rounded-full border-2 border-[#FFFDF8]/40 bg-paper-surface p-0.5" />
          <div className="min-w-0 flex-1">
            <div className="font-kufi font-semibold text-[15px] text-[#FFFDF8]">بوت أفراح الجمعية</div>
            <div className="flex items-center gap-1.5 text-[11.5px] text-[#FFFDF8]/85">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#9BE7B4] opacity-70" />
                <span className="relative inline-flex size-2 rounded-full bg-[#9BE7B4]" />
              </span>
              متصل الآن — محاكاة
            </div>
          </div>
          <Bot className="size-5 text-[#FFFDF8]/70" />
        </div>

        {/* منطقة الرسائل */}
        <div ref={scrollRef} className="h-[420px] space-y-3.5 overflow-y-auto bg-[#ECE2D0] p-4">
          {msgs.map((m) => (
            <ChatBubble key={m.id} msg={m} />
          ))}
          {typing && <TypingIndicator />}
        </div>

        {/* لوحة التفريغ بعد التسجيل */}
        <AnimatePresence>
          {transcribe !== null && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.25 }}
              className="border-t border-line bg-paper-sunken px-4 py-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[12px] font-semibold text-ink-700">التفريغ (نص الرسالة الصوتية):</span>
                <button
                  type="button"
                  onClick={() => setTranscribe(null)}
                  className="text-[11.5px] font-semibold text-ink-500 hover:text-redink"
                >
                  إلغاء
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={transcribeText}
                  onChange={(e) => setTranscribeText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendVoice()}
                  className="h-10 flex-1 rounded-lg border border-line bg-paper-surface px-3 text-[13px] text-ink-900 focus:border-line-strong focus:outline-none"
                  aria-label="نص التفريغ"
                />
                <button
                  type="button"
                  onClick={sendVoice}
                  className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-whatsapp px-4 text-[13px] font-semibold text-[#FFFDF8] transition-colors hover:bg-[#276a41]"
                >
                  <Send className="size-4 -scale-x-100" />
                  إرسال كصوتية
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* حقل الإدخال */}
        <div className="flex items-center gap-2 border-t border-line bg-paper-surface px-3 py-2.5">
          <motion.button
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={recording ? () => setRecording(false) : startRecording}
            aria-label={recording ? 'إيقاف التسجيل' : 'تسجيل رسالة صوتية'}
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors',
              recording ? 'bg-redink text-[#FFFDF8]' : 'bg-paper-sunken text-ink-700 hover:bg-line',
            )}
          >
            {recording ? <Square className="size-4" /> : <Mic className="size-5" />}
          </motion.button>
          {recording ? (
            <div className="flex h-11 flex-1 items-center gap-3 rounded-full bg-redink px-4">
              <RecordingWave />
              <span className="text-[12.5px] font-semibold text-[#FFFDF8]">بيسجّل… دوس للإيقاف</span>
            </div>
          ) : (
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendText()}
              placeholder="اكتب بالعامية براحتك…"
              aria-label="نص الرسالة للبوت"
              className="h-11 flex-1 rounded-full border border-line bg-paper-base px-4 text-[13.5px] text-ink-900 placeholder:text-ink-400 focus:border-line-strong focus:outline-none"
            />
          )}
          <motion.button
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={sendText}
            disabled={!input.trim() || typing || recording}
            aria-label="إرسال"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-whatsapp text-[#FFFDF8] shadow-card transition-colors hover:bg-[#276a41] disabled:opacity-40"
          >
            <Send className="size-5 -scale-x-100" />
          </motion.button>
        </div>
      </motion.div>

      {/* بطاقة الأوامر */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.38, delay: 0.06, ease: EASE }}
        className="surface-card p-5 lg:col-span-5"
      >
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-[10px] bg-whatsapp-bg text-whatsapp">
            <MessageCircle className="size-5" />
          </span>
          <div>
            <h3 className="font-kufi font-semibold text-[16px] text-ink-900">الأوامر المتاحة</h3>
            <p className="text-[12px] text-ink-500">الدوس على الأمر يبعته في الشات فورًا</p>
          </div>
        </div>
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {COMMANDS.map((c, i) => {
            const Icon = c.icon
            return (
              <motion.button
                key={c.cmd}
                type="button"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 + i * 0.05, ease: EASE }}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => runCommand(c)}
                disabled={typing}
                className="group rounded-xl border border-line bg-paper-base p-3.5 text-start transition-all hover:border-primary-300 hover:bg-primary-50 hover:shadow-card disabled:opacity-50"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-whatsapp-bg text-whatsapp transition-colors group-hover:bg-whatsapp group-hover:text-[#FFFDF8]">
                    <Icon className="size-4" />
                  </span>
                  <span className="font-kufi text-[13.5px] font-semibold text-ink-900">
                    {/^\d$/.test(c.cmd) ? `${c.cmd} — ${c.title}` : c.title}
                  </span>
                </div>
                <p className="mt-1.5 text-[11.5px] leading-4 text-ink-500">{c.desc}</p>
              </motion.button>
            )
          })}
        </div>
        <p className="mt-4 rounded-lg bg-paper-sunken px-3 py-2.5 text-[11.5px] leading-5 text-ink-500">
          جرّب تكتب بالعامية: «فضيلي كام لكريم» أو «كشف حساب» أو ابعت اسم شخص لوحده — ولو رقم التليفون
          مش مسجل في الدفتر، البوت هيرد برسالة ترحيب. كل رسايل المحاكاة بتتسجل في سجل الرسائل.
        </p>
      </motion.div>
    </div>
  )
}

/* ───────────────────────── الصفحة الرئيسية ───────────────────────── */

type TabKey = 'log' | 'settings' | 'bot'

const TABS: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: 'log', label: 'سجل الرسائل', icon: Inbox },
  { key: 'settings', label: 'إعدادات التذكير', icon: Settings2 },
  { key: 'bot', label: 'محاكاة البوت', icon: Bot },
]

function Kpi({ icon: Icon, label, value, sub, tone, index }: { icon: LucideIcon; label: string; value: string; sub?: string; tone: string; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, delay: 0.05 + index * 0.06, ease: EASE }}
      className="surface-card flex items-center gap-3.5 p-4"
    >
      <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-[10px]', tone)}>
        <Icon className="size-5" strokeWidth={2.1} />
      </span>
      <div className="min-w-0">
        <div className="text-[12px] font-medium text-ink-500">{label}</div>
        <div className="num-ltr font-kufi text-[20px] font-bold leading-7 text-ink-900">{value}</div>
        {sub && <div className="truncate text-[11px] text-ink-400">{sub}</div>}
      </div>
    </motion.div>
  )
}

export default function Whatsapp() {
  const [tab, setTab] = useState<TabKey>('log')
  const [refreshKey, setRefreshKey] = useState(0)
  const bump = () => setRefreshKey((k) => k + 1)

  const settingsQuery = trpc.whatsapp.getSettings.useQuery()
  const statsQuery = trpc.whatsapp.log.useQuery({ limit: 200 })
  const upcomingQuery = trpc.events.list.useQuery({ filter: 'upcoming' })

  const kpis = useMemo(() => {
    const list = (statsQuery.data ?? []) as LogRow[]
    const now = new Date()
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const weekAgo = startToday - 6 * 86400000
    const today = list.filter((m) => new Date(m.createdAt).getTime() >= startToday).length
    const out = list.filter((m) => m.direction === 'out' && m.status !== 'simulated' && m.status !== 'queued')
    const delivered = out.filter((m) => m.status === 'delivered').length
    const rate = out.length > 0 ? Math.round((delivered / out.length) * 100) : null
    const botWeek = list.filter((m) => m.kind === 'bot_reply' && new Date(m.createdAt).getTime() >= weekAgo).length
    return {
      today: String(today),
      rate: rate === null ? '—' : `${rate}%`,
      botWeek: String(botWeek),
      scheduled: String(upcomingQuery.data?.length ?? 0),
    }
  }, [statsQuery.data, upcomingQuery.data])

  const mode = settingsQuery.data?.mode

  return (
    <div className="space-y-5">
      {/* الترويسة */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.38, ease: EASE }}
        className="flex flex-wrap items-center justify-between gap-3"
      >
        <div>
          <h2 className="font-kufi text-[26px] font-bold leading-[34px] text-ink-900">واتساب</h2>
          <p className="mt-1 text-[13px] text-ink-500">سجل الرسائل، إعدادات التذكير، ومحاكاة البوت الذكي</p>
        </div>
        <span
          className={cn(
            'inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[12.5px] font-semibold',
            mode === 'cloud'
              ? 'border-whatsapp/40 bg-whatsapp-bg text-whatsapp'
              : 'border-gold-500/50 bg-gold-100 text-gold-600',
          )}
        >
          <span className="relative flex size-2.5">
            <span
              className={cn(
                'absolute inline-flex h-full w-full animate-ping rounded-full opacity-60',
                mode === 'cloud' ? 'bg-whatsapp' : 'bg-gold-500',
              )}
            />
            <span className={cn('relative inline-flex size-2.5 rounded-full', mode === 'cloud' ? 'bg-whatsapp' : 'bg-gold-500')} />
          </span>
          {mode === 'cloud' ? 'Cloud API متصل' : 'وضع محاكاة — الرسائل لا تُرسل فعليًا'}
        </span>
      </motion.div>

      {/* مؤشرات KPI */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={MessageCircle} label="رسائل النهارده" value={kpis.today} tone="bg-whatsapp-bg text-whatsapp" index={0} />
        <Kpi icon={CheckCheck} label="نسبة التسليم" value={kpis.rate} sub="من الرسائل الصادرة الفعلية" tone="bg-laha-bg text-laha-solid" index={1} />
        <Kpi icon={Bot} label="ردود البوت الأسبوع ده" value={kpis.botWeek} tone="bg-primary-100 text-primary-600" index={2} />
        <Kpi icon={BellRing} label="تذكيرات مجدولة" value={kpis.scheduled} sub="فرحة قادمة" tone="bg-gold-100 text-gold-600" index={3} />
      </div>

      {/* التبويبات */}
      <div className="surface-card flex w-fit max-w-full items-center gap-1 overflow-x-auto p-1.5">
        {TABS.map((t) => {
          const Icon = t.icon
          const active = tab === t.key
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                'relative flex items-center gap-2 whitespace-nowrap rounded-[10px] px-4 py-2.5 text-[13.5px] font-semibold transition-colors',
                active ? 'text-[#FFFDF8]' : 'text-ink-700 hover:bg-primary-50',
              )}
            >
              {active && (
                <motion.span
                  layoutId="wa-tab"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  className="absolute inset-0 rounded-[10px] bg-primary-500 shadow-card"
                />
              )}
              <Icon className="relative size-4" />
              <span className="relative">{t.label}</span>
            </button>
          )
        })}
      </div>

      {/* محتوى التبويب */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.22, ease: EASE }}
        >
          {tab === 'log' && <LogTab refreshKey={refreshKey} />}
          {tab === 'settings' && <SettingsTab onRemindersSent={bump} />}
          {tab === 'bot' && <BotSimTab onActivity={bump} />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
