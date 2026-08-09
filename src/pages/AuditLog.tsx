import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Lenis from 'lenis'
import {
  AlarmClock,
  Bot,
  Download,
  Filter,
  History,
  MessageCircle,
  MoveLeft,
  Pencil,
  Plus,
  Search,
  Send,
  Trash2,
  Users,
  X,
  XCircle,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { trpc } from '@/providers/trpc'
import { cn } from '@/lib/utils'
import { formatArabicDate, formatMoney, normalizeArabic, toArabicDigits } from '@/lib/format'
import EmptyState from '@/components/EmptyState'
import { AuthErrorState, isAuthError } from '@/components/AuthErrorBoundary'
import { useAuth } from '@/hooks/useAuth'

/**
 * سجل التدقيق (audit-log.md) — خط زمني مجمّع بالأيام لكل الأحداث:
 * الفاعل، نوع الحدث، فرق قبل/بعد مقروء، والتعديلات بعد إتمام الفرح
 * بـ«الحبر الأحمر» (خلفية قرمزية + شارة بعد الفرح + وميض تنبيه).
 * Lenis للتمرير الناعم (design §٦.٢/٦).
 */

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number]

type AuditAction = 'create' | 'update' | 'delete'

interface AuditRow {
  id: number
  tenantId: number
  actorUserId: number | null
  entityType: string
  entityId: number
  action: AuditAction
  beforeJson: unknown
  afterJson: unknown
  note: string | null
  createdAt: Date
  editedAfterDone: boolean
}

/* ─── تسميات الحقول المقروءة للفرق قبل/بعد ─── */
const FIELD_LABELS: Record<string, string> = {
  amount: 'المبلغ',
  invitedBy: 'مين دعاه',
  payerPersonId: 'الدافع',
  eventId: 'رقم الفرح',
  name: 'الاسم',
  phone: 'التليفون',
  region: 'المنطقة',
  phoneVerified: 'التليفون مؤكد',
  hostName: 'صاحب الفرح',
  hostPersonId: 'صاحب الفرح',
  eventDate: 'تاريخ الفرح',
  place: 'المكان',
  status: 'الحالة',
  whatsappNotified: 'إشعار واتساب',
  reportId: 'رقم التقرير',
  fileUrl: 'ملف التقرير',
}

/** حقول تقنية لا تُعرض في الفرق */
const HIDDEN_FIELDS = new Set([
  'id',
  'tenantId',
  'createdAt',
  'updatedAt',
  'recordedByUserId',
  'actorUserId',
  'shareToken',
  'editedAfterDone',
  'nuqtaId',
  'personId',
])

const ENTITY_LABEL: Record<string, string> = {
  nuqta: 'نقطة',
  person: 'شخص',
  event: 'فرح',
}

const ACTION_LABEL: Record<AuditAction, string> = {
  create: 'تسجيل',
  update: 'تعديل',
  delete: 'حذف',
}

function fmtFieldValue(key: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (key === 'amount') return `${formatMoney(Number(v))} ج.م`
  if (key === 'status') return v === 'done' ? 'تمت' : 'قادمة'
  if (typeof v === 'boolean') return v ? 'نعم' : 'لا'
  if (key === 'eventDate' || key.endsWith('At')) {
    const d = new Date(String(v))
    if (!Number.isNaN(d.getTime())) return formatArabicDate(d)
  }
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

interface DiffLine {
  key: string
  label: string
  before: string
  after: string
}

/** فرق مقروء بين قبل/بعد — للتحديث المتغيرات فقط، للإنشاء كل القيم الجديدة */
function computeDiff(entry: AuditRow): DiffLine[] {
  const before = (entry.beforeJson ?? {}) as Record<string, unknown>
  const after = (entry.afterJson ?? {}) as Record<string, unknown>
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(
    (k) => !HIDDEN_FIELDS.has(k),
  )
  const lines: DiffLine[] = []
  for (const key of keys) {
    const b = fmtFieldValue(key, before[key])
    const a = fmtFieldValue(key, after[key])
    if (entry.action === 'update' && b === a) continue
    lines.push({ key, label: FIELD_LABELS[key] ?? key, before: b, after: a })
  }
  return lines
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

function dayLabel(ts: number): string {
  const today = startOfDay(new Date())
  if (ts === today) return `النهارده — ${formatArabicDate(new Date(ts))}`
  if (ts === today - 86400000) return `أمس — ${formatArabicDate(new Date(ts))}`
  return formatArabicDate(new Date(ts))
}

function timeOf(dInput: Date): string {
  const d = new Date(dInput)
  let h = d.getHours()
  const suffix = h < 12 ? 'ص' : 'م'
  h = h % 12 || 12
  return `${h}:${String(d.getMinutes()).padStart(2, '0')} ${suffix}`
}

function fullStamp(dInput: Date): string {
  return `${formatArabicDate(new Date(dInput))} — ${timeOf(dInput)}`
}

/** أيقونة ولون الحدث حسب الإجراء/الملاحظة */
function eventVisual(entry: AuditRow): { icon: LucideIcon; box: string; chip: string; label: string } {
  const note = entry.note ?? ''
  if (entry.actorUserId == null || note.includes('تذكير')) {
    return { icon: Bot, box: 'bg-paper-sunken text-ink-500', chip: 'bg-paper-sunken text-ink-500', label: 'حدث نظام' }
  }
  if (note.includes('تصحيح')) {
    return { icon: History, box: 'bg-redink-bg text-redink', chip: 'bg-redink-bg text-redink', label: 'تصحيح بعد إرسال' }
  }
  if (note.includes('واتساب') || note.includes('إرسال')) {
    return { icon: MessageCircle, box: 'bg-whatsapp-bg text-whatsapp', chip: 'bg-whatsapp-bg text-whatsapp', label: 'إرسال واتساب' }
  }
  if (entry.action === 'create') {
    return { icon: Plus, box: 'bg-laha-bg text-laha-solid', chip: 'bg-laha-bg text-laha-text', label: entry.entityType === 'nuqta' ? 'تسجيل نقطة' : 'إنشاء' }
  }
  if (entry.action === 'delete') {
    return { icon: Trash2, box: 'bg-redink-bg text-redink', chip: 'bg-redink-bg text-redink', label: 'حذف' }
  }
  return { icon: Pencil, box: 'bg-primary-100 text-primary-600', chip: 'bg-primary-100 text-primary-700', label: 'تعديل' }
}

/* ─── بطاقة حدث في الخط الزمني ─── */
function EventCard({
  entry,
  index,
  actorName,
  onOpen,
}: {
  entry: AuditRow
  index: number
  actorName: (id: number | null) => string
  onOpen: (e: AuditRow) => void
}) {
  const v = eventVisual(entry)
  const Icon = v.icon
  const diff = computeDiff(entry)
  const shown = diff.slice(0, 3)
  const red = entry.editedAfterDone && entry.action !== 'create'
  const deleted = entry.action === 'delete'

  const card = (
    <motion.button
      type="button"
      onClick={() => onOpen(entry)}
      initial={{ opacity: 0, x: -14 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.32, delay: Math.min(index, 8) * 0.04, ease: EASE }}
      className={cn(
        'relative w-full rounded-xl border p-4 text-start shadow-card transition-shadow hover:shadow-card-hover',
        red ? 'border-[#E3C4B8] bg-redink-bg shadow-[inset_3px_0_0_0_#A03E31]' : 'border-line bg-paper-surface',
        deleted && !red && 'bg-paper-sunken/60',
      )}
    >
      {/* شارة الحبر الأحمر */}
      {red && (
        <div className="mb-2.5 inline-flex items-center gap-1.5 rounded-full bg-redink px-3 py-1 text-[11px] font-semibold text-[#FFFDF8]">
          <AlarmClock className="size-3.5" />
          بعد الفرح — التعديل اتعمل {fullStamp(entry.createdAt)}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <span className="num-ltr text-[13px] font-bold text-ink-900">{timeOf(entry.createdAt)}</span>
        <span className="font-kufi text-[13.5px] font-semibold text-ink-900">{actorName(entry.actorUserId)}</span>
        <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold', v.chip)}>
          <Icon className="size-3" />
          {v.label}
        </span>
        <span className="text-[12px] text-ink-500">
          {ENTITY_LABEL[entry.entityType] ?? entry.entityType} #{entry.entityId}
        </span>
      </div>

      {/* فرق قبل/بعد */}
      {shown.length > 0 && (
        <div className={cn('mt-2.5 space-y-1.5', deleted && 'opacity-70')}>
          {shown.map((d) => (
            <div key={d.key} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px]">
              <span className="font-semibold text-ink-500">{d.label}:</span>
              {entry.action !== 'create' && (
                <>
                  <span className={cn('text-redink line-through decoration-redink/60', deleted && 'no-underline')}>{d.before}</span>
                  <MoveLeft className="size-3.5 text-ink-400" />
                </>
              )}
              <span className={cn('font-bold', deleted ? 'text-ink-500 line-through' : 'text-laha-text')}>{d.after}</span>
            </div>
          ))}
          {diff.length > shown.length && (
            <div className="text-[11.5px] font-semibold text-primary-600">+ {toArabicDigits(diff.length - shown.length)} تغييرات أخرى — دوس للتفاصيل</div>
          )}
        </div>
      )}

      {entry.note && (
        <div className={cn('mt-2 flex items-center gap-1.5 text-[12px]', red ? 'font-semibold text-redink' : 'text-ink-500')}>
          {red ? <Send className="size-3.5" /> : null}
          {entry.note}
        </div>
      )}
    </motion.button>
  )

  // وميض تنبيه مرة واحدة لبطاقات الحبر الأحمر عند دخولها النافذة
  if (red) {
    return (
      <motion.div
        initial={{ opacity: 1 }}
        whileInView={{ opacity: [1, 0.72, 1] }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.9, delay: 0.35 }}
      >
        {card}
      </motion.div>
    )
  }
  return card
}

/* ─── مودال تفاصيل الحدث ─── */
function EntryModal({
  entry,
  actorName,
  onClose,
}: {
  entry: AuditRow | null
  actorName: (id: number | null) => string
  onClose: () => void
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <AnimatePresence>
      {entry && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(44,36,24,.4)] p-4 backdrop-blur-[4px]"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.96, y: 10, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, y: 10, opacity: 0 }}
            transition={{ duration: 0.24, ease: EASE }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label={`تفاصيل الحدث ${entry.id}`}
            className={cn(
              'max-h-[85dvh] w-full max-w-[560px] overflow-y-auto rounded-xl border p-5 shadow-pop',
              entry.editedAfterDone ? 'border-[#E3C4B8] bg-redink-bg' : 'border-line bg-paper-surface',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-kufi text-[17px] font-semibold text-ink-900">تفاصيل الحدث #{entry.id}</h3>
                <p className="num-ltr mt-0.5 text-[12px] text-ink-500">{fullStamp(entry.createdAt)}</p>
              </div>
              <button
                type="button"
                aria-label="إغلاق"
                onClick={onClose}
                className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-line bg-paper-surface text-ink-500 transition-colors hover:bg-primary-50"
              >
                <X className="size-4" />
              </button>
            </div>

            {entry.editedAfterDone && (
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-redink px-3 py-1 text-[11.5px] font-semibold text-[#FFFDF8]">
                <AlarmClock className="size-3.5" />
                تعديل بعد إتمام الفرح — حبر أحمر
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2.5 text-[12.5px]">
              <div className="rounded-lg bg-paper-surface/80 p-3">
                <div className="text-[11px] text-ink-500">الفاعل</div>
                <div className="mt-0.5 font-kufi font-semibold text-ink-900">{actorName(entry.actorUserId)}</div>
              </div>
              <div className="rounded-lg bg-paper-surface/80 p-3">
                <div className="text-[11px] text-ink-500">الكيان</div>
                <div className="mt-0.5 font-semibold text-ink-900">
                  {ENTITY_LABEL[entry.entityType] ?? entry.entityType} #{entry.entityId} — {ACTION_LABEL[entry.action]}
                </div>
              </div>
            </div>

            {/* جدول الفرق الكامل */}
            <div className="mt-4 overflow-hidden rounded-xl border border-line bg-paper-surface">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="bg-[#F1EADA] text-[11.5px] font-semibold text-ink-700">
                    <th className="px-3 py-2 text-start">الحقل</th>
                    <th className="px-3 py-2 text-start">قبل</th>
                    <th className="px-3 py-2 text-start">بعد</th>
                  </tr>
                </thead>
                <tbody>
                  {computeDiff(entry).map((d) => (
                    <tr key={d.key} className="border-t border-line">
                      <td className="px-3 py-2 font-semibold text-ink-700">{d.label}</td>
                      <td className="px-3 py-2 text-redink line-through decoration-redink/50">
                        {entry.action === 'create' ? '—' : d.before}
                      </td>
                      <td className="px-3 py-2 font-bold text-laha-text">{entry.action === 'delete' ? '—' : d.after}</td>
                    </tr>
                  ))}
                  {computeDiff(entry).length === 0 && (
                    <tr className="border-t border-line">
                      <td colSpan={3} className="px-3 py-4 text-center text-ink-400">
                        لا يوجد فرق حقول مسجل
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {entry.note && (
              <p className="mt-3 rounded-lg bg-paper-surface/80 px-3 py-2.5 text-[12.5px] text-ink-700">
                <span className="font-semibold">ملاحظة:</span> {entry.note}
              </p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* ───────────────────────── الصفحة الرئيسية ───────────────────────── */

type EntityFilter = 'all' | 'nuqta' | 'person' | 'event'
type ActionFilter = 'all' | AuditAction
type RangeKey = 'all' | 'today' | 'week' | 'month'

const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: 'all', label: 'كل الفترات' },
  { key: 'today', label: 'النهارده' },
  { key: 'week', label: 'الأسبوع ده' },
  { key: 'month', label: 'الشهر ده' },
]

function rangeToDates(range: RangeKey): { from?: Date; to?: Date } {
  if (range === 'all') return {}
  const now = new Date()
  const today = startOfDay(now)
  if (range === 'today') return { from: new Date(today), to: now }
  if (range === 'week') return { from: new Date(today - 6 * 86400000), to: now }
  return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now }
}

function Chip({ active, onClick, children, danger }: { active: boolean; onClick: () => void; children: ReactNode; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all duration-150',
        active
          ? danger
            ? 'bg-redink text-[#FFFDF8] shadow-card'
            : 'bg-primary-500 text-[#FFFDF8] shadow-card'
          : danger
            ? 'border border-[#E3C4B8] bg-paper-surface text-redink hover:bg-redink-bg'
            : 'border border-line bg-paper-surface text-ink-700 hover:bg-primary-50',
      )}
    >
      {children}
    </button>
  )
}

export default function AuditLog() {
  const { user } = useAuth()
  const [entityType, setEntityType] = useState<EntityFilter>('all')
  const [action, setAction] = useState<ActionFilter>('all')
  const [range, setRange] = useState<RangeKey>('all')
  const [redOnly, setRedOnly] = useState(false)
  const [showSystem, setShowSystem] = useState(true)
  const [search, setSearch] = useState('')
  const [limit, setLimit] = useState(50)
  const [selected, setSelected] = useState<AuditRow | null>(null)

  // Lenis — تمرير ناعم للصفحة الطويلة (design §٦.٢/٦)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const lenis = new Lenis({ lerp: 0.1 })
    let raf = 0
    const loop = (t: number) => {
      lenis.raf(t)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      lenis.destroy()
    }
  }, [])

  const queryInput = useMemo(() => {
    const { from, to } = rangeToDates(range)
    return {
      ...(entityType !== 'all' ? { entityType } : {}),
      ...(action !== 'all' ? { action } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      limit,
    }
  }, [entityType, action, range, limit])

  const listQuery = trpc.audit.list.useQuery(queryInput)
  const statsQuery = trpc.audit.list.useQuery({ limit: 500 })

  const actorName = (id: number | null): string => {
    if (id == null) return 'النظام'
    if (user && id === user.id) return user.name ? `${user.name} (أنت)` : 'أنت'
    return `عضو الفريق #${id}`
  }

  const entries = useMemo(() => {
    const list = (listQuery.data ?? []) as AuditRow[]
    const q = normalizeArabic(search)
    return list.filter((e) => {
      if (redOnly && !e.editedAfterDone) return false
      if (!showSystem && e.actorUserId == null) return false
      if (!q) return true
      const hay = normalizeArabic(
        `${e.note ?? ''} ${JSON.stringify(e.beforeJson ?? {})} ${JSON.stringify(e.afterJson ?? {})}`,
      )
      return hay.includes(q)
    })
  }, [listQuery.data, redOnly, showSystem, search])

  // تجميع حسب اليوم (الأحدث أولًا — القائمة أصلًا مرتبة تنازليًا)
  const groups = useMemo(() => {
    const map = new Map<number, AuditRow[]>()
    for (const e of entries) {
      const key = startOfDay(new Date(e.createdAt))
      const arr = map.get(key) ?? []
      arr.push(e)
      map.set(key, arr)
    }
    return [...map.entries()].sort((a, b) => b[0] - a[0])
  }, [entries])

  const stats = useMemo(() => {
    const list = (statsQuery.data ?? []) as AuditRow[]
    const today = startOfDay(new Date())
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
    const todayCount = list.filter((e) => startOfDay(new Date(e.createdAt)) === today).length
    const redMonth = list.filter((e) => e.editedAfterDone && new Date(e.createdAt).getTime() >= monthStart).length
    const corrections = list.filter((e) => (e.note ?? '').includes('تصحيح')).length
    const counts = new Map<number, number>()
    for (const e of list) {
      if (e.actorUserId == null) continue
      counts.set(e.actorUserId, (counts.get(e.actorUserId) ?? 0) + 1)
    }
    let topActor = '—'
    let topCount = 0
    for (const [id, c] of counts) {
      if (c > topCount) {
        topCount = c
        topActor = actorName(id)
      }
    }
    return { todayCount, redMonth, corrections, topActor, topCount }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statsQuery.data, user])

  const exportCsv = () => {
    const header = ['id', 'التاريخ', 'الفاعل', 'الكيان', 'رقم الكيان', 'الحدث', 'بعد الفرح', 'ملاحظة', 'قبل', 'بعد']
    const rows = entries.map((e) => [
      e.id,
      new Date(e.createdAt).toISOString(),
      actorName(e.actorUserId),
      ENTITY_LABEL[e.entityType] ?? e.entityType,
      e.entityId,
      ACTION_LABEL[e.action],
      e.editedAfterDone ? 'نعم' : 'لا',
      (e.note ?? '').replace(/[\r\n]+/g, ' '),
      JSON.stringify(e.beforeJson ?? null),
      JSON.stringify(e.afterJson ?? null),
    ])
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const STAT_CARDS: { label: string; value: string; sub?: string; tone: string; icon: LucideIcon }[] = [
    { label: 'أحداث النهارده', value: toArabicDigits(stats.todayCount), tone: 'bg-primary-100 text-primary-600', icon: History },
    { label: 'تعديلات بعد الفرح (الشهر ده)', value: toArabicDigits(stats.redMonth), tone: 'bg-redink-bg text-redink', icon: AlarmClock },
    { label: 'تصحيحات واتساب', value: toArabicDigits(stats.corrections), tone: 'bg-whatsapp-bg text-whatsapp', icon: MessageCircle },
    { label: 'أنشط مستخدم', value: stats.topActor, sub: stats.topCount > 0 ? `${toArabicDigits(stats.topCount)} حدث` : undefined, tone: 'bg-gold-100 text-gold-600', icon: Users },
  ]

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
          <h2 className="font-kufi text-[26px] font-bold leading-[34px] text-ink-900">سجل التدقيق</h2>
          <p className="mt-1 text-[13px] text-ink-500">كل حركة على الدفتر محفوظة — التعديلات بعد الفرح ملونة بالحبر الأحمر</p>
        </div>
        <div className="flex items-center gap-2.5">
          <label className="flex cursor-pointer items-center gap-2 rounded-[10px] border border-line bg-paper-surface px-3 py-2 text-[12.5px] font-semibold text-ink-700">
            <input
              type="checkbox"
              checked={showSystem}
              onChange={(e) => setShowSystem(e.target.checked)}
              className="size-4 accent-[#A87438]"
            />
            عرض أحداث النظام
          </label>
          <button
            type="button"
            onClick={exportCsv}
            disabled={entries.length === 0}
            className="inline-flex items-center gap-2 rounded-[10px] border border-line-strong bg-paper-surface px-4 py-2.5 text-[13px] font-semibold text-ink-700 transition-colors hover:bg-primary-50 disabled:opacity-50"
          >
            <Download className="size-4" />
            تصدير CSV
          </button>
        </div>
      </motion.div>

      {/* إحصائيات سريعة */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {STAT_CARDS.map((s, i) => {
          const Icon = s.icon
          return (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.38, delay: 0.05 + i * 0.06, ease: EASE }}
              className="surface-card flex items-center gap-3.5 p-4"
            >
              <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-[10px]', s.tone)}>
                <Icon className="size-5" strokeWidth={2.1} />
              </span>
              <div className="min-w-0">
                <div className="text-[12px] font-medium text-ink-500">{s.label}</div>
                <div className="truncate font-kufi text-[18px] font-bold leading-6 text-ink-900">{s.value}</div>
                {s.sub && <div className="text-[11px] text-ink-400">{s.sub}</div>}
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* شريط الفلاتر */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.38, delay: 0.15, ease: EASE }}
        className={cn(
          'surface-card space-y-3 p-4 transition-shadow',
          redOnly && 'border-[#E3C4B8] shadow-[inset_3px_0_0_0_#A03E31]',
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="size-4 text-ink-400" />
          {RANGE_OPTIONS.map((r) => (
            <Chip key={r.key} active={range === r.key} onClick={() => setRange(r.key)}>
              {r.label}
            </Chip>
          ))}
          <span className="mx-1 h-5 w-px bg-line" />
          <Chip active={entityType === 'all'} onClick={() => setEntityType('all')}>كل الكيانات</Chip>
          <Chip active={entityType === 'nuqta'} onClick={() => setEntityType('nuqta')}>نقطة</Chip>
          <Chip active={entityType === 'person'} onClick={() => setEntityType('person')}>شخص</Chip>
          <Chip active={entityType === 'event'} onClick={() => setEntityType('event')}>فرح</Chip>
          <span className="mx-1 h-5 w-px bg-line" />
          <Chip active={action === 'all'} onClick={() => setAction('all')}>كل الأحداث</Chip>
          <Chip active={action === 'create'} onClick={() => setAction('create')}>تسجيل</Chip>
          <Chip active={action === 'update'} onClick={() => setAction('update')}>تعديل</Chip>
          <Chip active={action === 'delete'} onClick={() => setAction('delete')}>حذف</Chip>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث في التفاصيل والملاحظات (اسم، مبلغ، مكان…)"
              className="h-10 w-full rounded-[10px] border border-line bg-paper-base ps-9 pe-3 text-[13px] text-ink-900 placeholder:text-ink-400 focus:border-line-strong focus:outline-none"
            />
          </div>
          <Chip active={redOnly} danger onClick={() => setRedOnly((v) => !v)}>
            <AlarmClock className="-mt-0.5 me-1 inline size-3.5" />
            فقط تعديلات ما بعد الفرح
          </Chip>
        </div>
      </motion.div>

      {/* الخط الزمني */}
      {listQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-paper-sunken" />
          ))}
        </div>
      ) : listQuery.error ? (
        isAuthError(listQuery.error) ? (
          <AuthErrorState />
        ) : (
          <div className="surface-card flex flex-col items-center gap-3 py-10 text-center">
            <XCircle className="size-8 text-redink" />
            <p className="text-[14px] font-semibold text-ink-900">تعذّر تحميل السجل</p>
            <p className="max-w-[420px] text-[12.5px] text-ink-500">{listQuery.error.message}</p>
            <button
              type="button"
              onClick={() => listQuery.refetch()}
              className="rounded-[10px] border border-line-strong px-4 py-2 text-[13px] font-semibold text-ink-700 transition-colors hover:bg-primary-50"
            >
              إعادة المحاولة
            </button>
          </div>
        )
      ) : groups.length === 0 ? (
        <div className="surface-card">
          <EmptyState
            image="/empty-search.svg"
            title="مفيش أحداث بالفلاتر دي"
            description="جرّب توسعة الفترة أو شيل فلتر «بعد الفرح» — أول حركة على الدفتر هتتسجل هنا."
          />
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(([day, items], gi) => (
            <section key={day} className="relative">
              {/* عنوان اليوم اللاصق */}
              <h3 className="sticky top-16 z-20 -mx-1 mb-3 w-fit rounded-full border border-line bg-paper-base/95 px-4 py-1.5 font-kufi text-[14px] font-semibold text-ink-900 shadow-card backdrop-blur-sm">
                {dayLabel(day)}
                <span className="ms-2 text-[11.5px] font-normal text-ink-500">{toArabicDigits(items.length)} حدث</span>
              </h3>

              <div className="relative">
                {/* الخط الرأسي يرسم نفسه */}
                <motion.span
                  initial={{ scaleY: 0 }}
                  whileInView={{ scaleY: 1 }}
                  viewport={{ once: true, amount: 0.05 }}
                  transition={{ duration: 0.8, ease: EASE }}
                  style={{ transformOrigin: 'top' }}
                  className="absolute bottom-2 start-[15px] top-2 w-[2px] rounded-full bg-line-strong"
                  aria-hidden
                />
                <ol className="space-y-3">
                  {items.map((entry, i) => {
                    const v = eventVisual(entry)
                    const Icon = v.icon
                    return (
                      <li key={entry.id} className="relative flex items-start gap-3.5">
                        <motion.span
                          initial={{ scale: 0 }}
                          whileInView={{ scale: 1 }}
                          viewport={{ once: true, amount: 0.5 }}
                          transition={{ type: 'spring', stiffness: 420, damping: 22, delay: 0.1 + Math.min(i, 8) * 0.04 }}
                          className={cn(
                            'relative z-10 mt-3.5 flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-paper-base shadow-card',
                            v.box,
                          )}
                        >
                          <Icon className="size-4" />
                        </motion.span>
                        <div className="min-w-0 flex-1">
                          <EventCard entry={entry} index={i + gi} actorName={actorName} onOpen={setSelected} />
                        </div>
                      </li>
                    )
                  })}
                </ol>
              </div>
            </section>
          ))}

          {/* تحميل تدريجي */}
          {(listQuery.data?.length ?? 0) >= limit && (
            <div className="flex justify-center pt-2">
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={() => setLimit((l) => l + 50)}
                className="rounded-[10px] border border-line-strong bg-paper-surface px-6 py-2.5 text-[13px] font-semibold text-ink-700 shadow-card transition-colors hover:bg-primary-50"
              >
                عرض أقدم (50 حدث إضافي)
              </motion.button>
            </div>
          )}
        </div>
      )}

      <EntryModal entry={selected} actorName={actorName} onClose={() => setSelected(null)} />
    </div>
  )
}
