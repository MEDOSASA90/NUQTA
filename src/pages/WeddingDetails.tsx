/**
 * تفاصيل الفرح — weddings.md §٢: ترويسة احتفالية + إحصائيات + جدول النقوط
 * (تعديل/حذف مع مودال التصحيح الواتسابي، حبر أحمر بعد الفرح) + توزيع المناطق
 * + تصدير PDF + مشاركة رابط صاحب الفرح + «تمت الفرحة».
 */
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CalendarHeart,
  Check,
  CheckCheck,
  Clock,
  Eye,
  FileDown,
  Link2,
  LockKeyhole,
  MapPin,
  MoreVertical,
  NotebookPen,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Scale,
  Search,
  Share2,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { inferRouterOutputs } from '@trpc/server'
import { trpc } from '@/providers/trpc'
import type { AppRouter } from '../../server/router'
import EmptyState from '@/components/EmptyState'
import PersonCombobox from '@/components/PersonCombobox'
import WarmMenu from '@/components/WarmMenu'
import { cn } from '@/lib/utils'
import { formatArabicDate, formatMoney, normalizeArabic, toArabicDigits } from '@/lib/format'
import { abortReportTab, deliverReportToTab, openReportWaitingTab, reportDownloadName } from '@/lib/open-report'
import type { EventNuqtaItem } from '@contracts/afrah'
import { ArabicDateField, CardSkeleton, ErrorState, Modal, Skeleton, ToastProvider } from '@/pages/grp-kit'
import { copyText, daysLeftLabel, daysUntil, EASE, formatArabicTime, formatShortArabicDate, useToast } from '@/pages/grp-utils'

type ChipFilter = 'all' | 'notified' | 'noInviter' | 'edited'

type RouterOutputs = inferRouterOutputs<AppRouter>
type ExpenseItem = RouterOutputs['expenses']['listByEvent'][number]

/* ─────────── بطاقة إحصائية مصغّرة ─────────── */

function MiniStat({ icon: Icon, tone, title, value, sub, index, featured }: { icon: LucideIcon; tone: string; title: string; value: ReactNode; sub?: string; index: number; featured?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: EASE }}
      className={cn('surface-card flex flex-col gap-1.5 p-4', featured && 'border-gold-500 bg-gold-100/40')}
    >
      <span className="flex items-center gap-2">
        <span className={cn('flex size-8 items-center justify-center rounded-lg', tone)}>
          <Icon className="size-4" strokeWidth={2.1} />
        </span>
        <span className="text-[12px] font-medium text-ink-500">{title}</span>
      </span>
      <span className={cn('font-kufi font-bold text-[22px] leading-7 text-ink-900', featured && 'text-gold-600')}>{value}</span>
      {sub && <span className="text-[11.5px] text-ink-500">{sub}</span>}
    </motion.div>
  )
}

/* ─────────── مودال تعديل نقطة (صامت أو تصحيح واتسابي) ─────────── */

function EditNuqtaModal({ nuqta, ...rest }: { nuqta: EventNuqtaItem | null; eventDone: boolean; onClose: () => void }) {
  if (!nuqta) return null
  return <EditNuqtaForm key={nuqta.id} nuqta={nuqta} {...rest} />
}

function EditNuqtaForm({
  nuqta,
  eventDone,
  onClose,
}: {
  nuqta: EventNuqtaItem
  eventDone: boolean
  onClose: () => void
}) {
  const toast = useToast()
  const utils = trpc.useUtils()
  const [amountRaw, setAmountRaw] = useState(formatMoney(nuqta.amount))
  const [invitedBy, setInvitedBy] = useState(nuqta.invitedBy)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const invalidate = async () => {
    await Promise.all([
      utils.events.get.invalidate(),
      utils.events.list.invalidate(),
      utils.nuqtat.listRecent.invalidate(),
      utils.dashboard.stats.invalidate(),
      utils.balances.invalidate(),
    ])
  }

  const update = trpc.nuqtat.update.useMutation({
    onSuccess: async () => {
      toast('success', nuqta.whatsappNotified ? 'اتحفظ التعديل واتبعتت رسالة التصحيح ✓' : 'اتحفظ التعديل ✓')
      await invalidate()
      onClose()
    },
    onError: (e) => setError(e.message),
  })

  const amount = Number(amountRaw.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[,\s]/g, '')) || 0
  const warned = nuqta.whatsappNotified

  return (
    <Modal
      open
      onClose={onClose}
      title={warned ? 'تعديل نقطة — إشعارها اتبعت' : 'تعديل نقطة'}
      subtitle={`${nuqta.payerName} · ${formatMoney(nuqta.amount)} ج.م`}
    >
      <div className="flex flex-col gap-4">
        {warned && (
          <div className="flex items-start gap-3 rounded-xl border border-[#E3D3A3] bg-[#FBF5E6] px-4 py-3">
            <AlertTriangle className="mt-0.5 size-[18px] shrink-0 text-partial-text" />
            <p className="text-[12.5px] leading-5 text-ink-700">
              تم إرسال إشعار بهذه النقطة بالفعل. حفظ التعديل سيرسل <span className="font-semibold">رسالة تصحيحية تلقائيًا</span> ويُسجَّل في سجل التدقيق.
            </p>
          </div>
        )}
        {eventDone && (
          <p className="rounded-lg bg-redink-bg px-3 py-2 text-[12.5px] text-redink">
            الفرح دي اتقفلت — التعديل هيتوسم بالحبر الأحمر «بعد الفرح».
          </p>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink-700">المبلغ (ج.م)</span>
          <input
            value={amountRaw}
            onChange={(e) => {
              const n = Number(e.target.value.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[,\s]/g, ''))
              setAmountRaw(e.target.value.trim() === '' ? '' : Number.isFinite(n) && n > 0 ? formatMoney(n) : amountRaw)
            }}
            inputMode="numeric"
            className="num-ltr h-12 rounded-[10px] border border-line-strong bg-paper-surface px-4 text-center text-[20px] font-bold text-ink-900 focus:border-primary-500 focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink-700">مين دعاه</span>
          <input
            value={invitedBy}
            onChange={(e) => setInvitedBy(e.target.value)}
            placeholder="اسم الداعي…"
            className="h-11 rounded-[10px] border border-line-strong bg-paper-surface px-3.5 text-[14px] text-ink-900 placeholder:text-ink-400 focus:border-primary-500 focus:outline-none"
          />
        </label>

        {warned && (
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-ink-700">سبب التصحيح (اختياري)</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="مثال: المبلغ كان ناقص"
              className="h-11 rounded-[10px] border border-line-strong bg-paper-surface px-3.5 text-[14px] text-ink-900 placeholder:text-ink-400 focus:border-primary-500 focus:outline-none"
            />
          </label>
        )}

        {error && <p className="rounded-lg bg-redink-bg px-3 py-2 text-[12.5px] text-redink">{error}</p>}

        <div className="flex items-center gap-2.5 border-t border-line pt-4">
          <button
            type="button"
            disabled={amount <= 0 || update.isPending}
            onClick={() => update.mutate({ id: nuqta.id, amount, invitedBy: invitedBy.trim(), note: note.trim() || undefined })}
            className={cn(
              'inline-flex flex-1 items-center justify-center gap-2 rounded-[10px] px-4 py-2.5 text-[14px] font-semibold transition-all active:scale-[0.97] disabled:opacity-50',
              warned ? 'bg-gold-500 text-[#3A2E10] hover:bg-gold-600' : 'bg-primary-500 text-[#FFFDF8] hover:bg-primary-600',
            )}
          >
            <Check className="size-4" />
            {update.isPending ? 'بيحفظ…' : warned ? 'حفظ وإرسال التصحيح' : 'حفظ التعديل'}
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

/* ─────────── مودال حذف نقطة ─────────── */

function DeleteNuqtaModal({ nuqta, onClose }: { nuqta: EventNuqtaItem | null; onClose: () => void }) {
  if (!nuqta) return null
  return <DeleteNuqtaForm key={nuqta.id} nuqta={nuqta} onClose={onClose} />
}

function DeleteNuqtaForm({ nuqta, onClose }: { nuqta: EventNuqtaItem; onClose: () => void }) {
  const toast = useToast()
  const utils = trpc.useUtils()
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const del = trpc.nuqtat.delete.useMutation({
    onSuccess: async () => {
      toast('success', nuqta.whatsappNotified ? 'اتحذفت النقطة واتبعتت رسالة تصحيح للدافع' : 'اتحذفت النقطة من الدفتر')
      await Promise.all([
        utils.events.get.invalidate(),
        utils.events.list.invalidate(),
        utils.nuqtat.listRecent.invalidate(),
        utils.dashboard.stats.invalidate(),
        utils.balances.invalidate(),
      ])
      onClose()
    },
    onError: (e) => setError(e.message),
  })

  const warned = nuqta.whatsappNotified

  return (
    <Modal open onClose={onClose} title="حذف نقطة" subtitle={`${nuqta.payerName} · ${formatMoney(nuqta.amount)} ج.م`}>
      <div className="flex flex-col gap-4">
        {warned ? (
          <div className="flex items-start gap-3 rounded-xl border border-[#E3D3A3] bg-[#FBF5E6] px-4 py-3">
            <AlertTriangle className="mt-0.5 size-[18px] shrink-0 text-partial-text" />
            <p className="text-[12.5px] leading-5 text-ink-700">
              الإشعار اتبعت بالفعل. الحذف هيبعت <span className="font-semibold">رسالة تصحيحية للطرفين</span> ويتسجل في سجل التدقيق بتاريخ ووقت.
            </p>
          </div>
        ) : (
          <p className="text-[13px] leading-5 text-ink-700">النقطة دي لسه ماتبعتلهاش إشعار — الحذف هيكون صامت من غير أي رسالة.</p>
        )}

        {warned && (
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-ink-700">سبب الحذف (اختياري)</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="مثال: اتسجلت بالغلط"
              className="h-11 rounded-[10px] border border-line-strong bg-paper-surface px-3.5 text-[14px] text-ink-900 placeholder:text-ink-400 focus:border-primary-500 focus:outline-none"
            />
          </label>
        )}

        {error && <p className="rounded-lg bg-redink-bg px-3 py-2 text-[12.5px] text-redink">{error}</p>}

        <div className="flex items-center gap-2.5 border-t border-line pt-4">
          <button
            type="button"
            disabled={del.isPending}
            onClick={() => del.mutate({ id: nuqta.id, note: note.trim() || undefined })}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-[10px] border border-[#E3C4B8] bg-redink px-4 py-2.5 text-[14px] font-semibold text-[#FFFDF8] transition-all hover:bg-[#8F352A] active:scale-[0.97] disabled:opacity-50"
          >
            <Trash2 className="size-4" />
            {del.isPending ? 'بيتحذف…' : warned ? 'حذف وإرسال التصحيح' : 'حذف النقطة'}
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

/* ─────────── مودال تعديل بيانات الفرح ─────────── */

function EditEventModal(props: {
  eventId: number
  initial: { hostName: string; eventDate: Date; place: string } | null
  open: boolean
  onClose: () => void
}) {
  if (!props.open || !props.initial) return null
  return <EditEventForm eventId={props.eventId} initial={props.initial} onClose={props.onClose} />
}

function EditEventForm({
  eventId,
  initial,
  onClose,
}: {
  eventId: number
  initial: { hostName: string; eventDate: Date; place: string }
  onClose: () => void
}) {
  const toast = useToast()
  const utils = trpc.useUtils()
  const [hostName, setHostName] = useState(initial.hostName)
  const [date, setDate] = useState<Date | null>(new Date(initial.eventDate))
  const [place, setPlace] = useState(initial.place)
  const [error, setError] = useState('')

  const update = trpc.events.update.useMutation({
    onSuccess: async () => {
      toast('success', 'اتحفظت بيانات الفرح ✓')
      await utils.events.invalidate()
      onClose()
    },
    onError: (e) => setError(e.message),
  })

  return (
    <Modal open onClose={onClose} title="تعديل بيانات الفرح">
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink-700">اسم الفرح</span>
          <div className="flex items-center rounded-[10px] border border-line-strong bg-paper-surface focus-within:border-primary-500">
            <span className="border-e border-line px-3.5 text-[14px] font-medium text-ink-500">فرحة</span>
            <input
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              className="h-11 flex-1 rounded-e-[10px] bg-transparent px-3.5 text-[14px] text-ink-900 focus:outline-none"
            />
          </div>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-ink-700">التاريخ</span>
            <ArabicDateField value={date} onChange={setDate} />
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-ink-700">المكان</span>
            <input
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              className="h-11 rounded-[10px] border border-line-strong bg-paper-surface px-3.5 text-[14px] text-ink-900 focus:border-primary-500 focus:outline-none"
            />
          </label>
        </div>

        {error && <p className="rounded-lg bg-redink-bg px-3 py-2 text-[12.5px] text-redink">{error}</p>}

        <div className="flex items-center gap-2.5 border-t border-line pt-4">
          <button
            type="button"
            disabled={hostName.trim().length < 2 || !date || update.isPending}
            onClick={() => date && update.mutate({ id: eventId, hostName: hostName.trim(), eventDate: date, place: place.trim() })}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-[10px] bg-primary-500 px-4 py-2.5 text-[14px] font-semibold text-[#FFFDF8] transition-all hover:bg-primary-600 active:scale-[0.97] disabled:opacity-50"
          >
            <Check className="size-4" />
            {update.isPending ? 'بيحفظ…' : 'حفظ'}
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

/* ─────────── قسم «مسؤولو الإدخال» (يظهر أثناء فتح الدفتر) ─────────── */

type Assignee = { userId: number; name: string | null }

const MEMBER_ROLE_LABEL: Record<string, string> = { scribe: 'كاتب', team: 'عضو فريق' }

function AssigneesSection({ eventId, assignees }: { eventId: number; assignees: Assignee[] }) {
  const toast = useToast()
  const utils = trpc.useUtils()
  const teamQ = trpc.events.teamMembers.useQuery()
  const [selected, setSelected] = useState<number[]>(() => assignees.map((a) => a.userId))
  const [error, setError] = useState('')

  /* مزامنة الاختيار مع بيانات السيرفر عند تغيّرها */
  const signature = assignees.map((a) => a.userId).join(',')
  useEffect(() => {
    setSelected(assignees.map((a) => a.userId))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])

  const team = useMemo(() => teamQ.data ?? [], [teamQ.data])
  const teamById = useMemo(() => new Map(team.map((m) => [m.userId, m])), [team])
  const nameOf = (uid: number, fallback: string | null) => teamById.get(uid)?.name ?? fallback ?? 'عضو بدون اسم'
  const roleOf = (uid: number) => MEMBER_ROLE_LABEL[teamById.get(uid)?.memberRole ?? ''] ?? 'عضو فريق'

  const save = trpc.events.setAssignees.useMutation({
    onSuccess: async () => {
      setError('')
      toast('success', 'اتحفظ مسؤولو الإدخال ✓')
      await utils.events.get.invalidate({ id: eventId })
    },
    onError: (e) => setError(e.message),
  })

  const toggle = (uid: number) => {
    setError('')
    setSelected((cur) => {
      if (cur.includes(uid)) return cur.filter((x) => x !== uid)
      if (cur.length >= 2) {
        setError('مسؤولو الإدخال حد أقصى 2 بس')
        return cur
      }
      return [...cur, uid]
    })
  }

  const dirty = useMemo(() => {
    const a = [...selected].sort((x, y) => x - y).join(',')
    const b = [...assignees.map((x) => x.userId)].sort((x, y) => x - y).join(',')
    return a !== b
  }, [selected, assignees])

  const addable = team.filter((m) => !selected.includes(m.userId))

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1, ease: EASE }}
      className="surface-card p-5"
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-lg bg-gold-100 text-gold-600">
          <Users className="size-[18px]" strokeWidth={2.1} />
        </span>
        <div>
          <h3 className="font-kufi font-semibold text-[17px] leading-6 text-ink-900">مسؤولو الإدخال</h3>
          <p className="text-[12px] text-ink-500">حد أقصى ٢ — بس هم والكاتب اللي يقدروا يسجّلوا في الدفتر أثناء الفرح</p>
        </div>
      </div>

      {/* المعيّنون الحاليون كبطاقات */}
      {assignees.length > 0 && (
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
          {assignees.map((a) => (
            <div key={a.userId} className="flex items-center gap-3 rounded-[10px] border border-line bg-paper-base px-3.5 py-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-600">
                <UserCheck className="size-4" strokeWidth={2.2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-kufi font-semibold text-[14px] text-ink-900">{nameOf(a.userId, a.name)}</span>
                <span className="text-[11.5px] text-ink-500">{roleOf(a.userId)}</span>
              </span>
              <span className="shrink-0 rounded-full bg-gold-100 px-2.5 py-0.5 text-[11px] font-semibold text-gold-600">معيّن</span>
            </div>
          ))}
        </div>
      )}

      {/* المحرر: chips المختارين + قائمة الإضافة */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {selected.map((uid) => (
          <span key={uid} className="inline-flex items-center gap-1.5 rounded-full border border-primary-300 bg-primary-100 py-1 ps-3 pe-1.5 text-[12.5px] font-semibold text-primary-700">
            {nameOf(uid, assignees.find((a) => a.userId === uid)?.name ?? null)}
            <button
              type="button"
              aria-label={`إزالة ${nameOf(uid, null)}`}
              onClick={() => toggle(uid)}
              className="flex size-5 items-center justify-center rounded-full text-primary-600 transition-colors hover:bg-primary-300/60"
            >
              <X className="size-3.5" strokeWidth={2.4} />
            </button>
          </span>
        ))}
        {selected.length === 0 && <span className="text-[12.5px] text-ink-400">مفيش مسؤولين معيّنين — التسجيل متاح لكل الفريق</span>}
      </div>

      {addable.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {addable.map((m) => (
            <button
              key={m.userId}
              type="button"
              onClick={() => toggle(m.userId)}
              className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-paper-surface px-3 py-1.5 text-[12.5px] font-medium text-ink-700 transition-colors hover:border-primary-300 hover:bg-primary-50"
            >
              <UserPlus className="size-3.5 text-ink-500" />
              {m.name ?? 'عضو بدون اسم'}
              <span className="text-[11px] text-ink-400">· {MEMBER_ROLE_LABEL[m.memberRole] ?? 'عضو فريق'}</span>
            </button>
          ))}
        </div>
      )}
      {teamQ.isLoading && <Skeleton className="mt-3 h-8 w-2/3" />}

      {error && (
        <p className="mt-3 flex items-center gap-2 rounded-lg bg-redink-bg px-3 py-2 text-[12.5px] text-redink">
          <AlertTriangle className="size-4 shrink-0" />
          {error}
        </p>
      )}

      <div className="mt-4 flex items-center gap-2.5 border-t border-line pt-4">
        <button
          type="button"
          disabled={!dirty || save.isPending}
          onClick={() => save.mutate({ id: eventId, userIds: selected })}
          className="inline-flex items-center justify-center gap-2 rounded-[10px] bg-primary-500 px-5 py-2.5 text-[14px] font-semibold text-[#FFFDF8] transition-all hover:bg-primary-600 active:scale-[0.97] disabled:opacity-50"
        >
          <Check className="size-4" />
          {save.isPending ? 'بيحفظ…' : 'حفظ المسؤولين'}
        </button>
        {dirty && (
          <button
            type="button"
            onClick={() => {
              setSelected(assignees.map((a) => a.userId))
              setError('')
            }}
            className="rounded-[10px] border border-line-strong px-4 py-2.5 text-[13.5px] font-medium text-ink-700 transition-colors hover:bg-primary-50"
          >
            تراجع
          </button>
        )}
      </div>
    </motion.section>
  )
}

/* ─────────── مودال إضافة/تعديل مصروف ─────────── */

function ExpenseFormModal({ eventId, expense, open, onClose }: { eventId: number; expense: ExpenseItem | null; open: boolean; onClose: () => void }) {
  if (!open) return null
  return <ExpenseForm key={expense ? `edit-${expense.id}` : 'new'} eventId={eventId} expense={expense} onClose={onClose} />
}

function ExpenseForm({ eventId, expense, onClose }: { eventId: number; expense: ExpenseItem | null; onClose: () => void }) {
  const toast = useToast()
  const utils = trpc.useUtils()
  const isEdit = Boolean(expense)
  const [receiverName, setReceiverName] = useState(expense?.receiverName ?? '')
  const [linked, setLinked] = useState<{ id: number; name: string } | null>(
    expense?.receiverPersonId ? { id: expense.receiverPersonId, name: expense.receiverName } : null,
  )
  const [pickerOpen, setPickerOpen] = useState(false)
  const [amountRaw, setAmountRaw] = useState(expense ? formatMoney(expense.amount) : '')
  const [note, setNote] = useState(expense?.note ?? '')
  const [error, setError] = useState('')

  /* الأشخاص المسجلون — يُجلبون فقط عند فتح منتقي الربط */
  const personsQ = trpc.persons.list.useQuery(undefined, { enabled: pickerOpen })
  const comboPeople = useMemo(
    () => (personsQ.data ?? []).map((p) => ({ id: String(p.id), name: p.name, phone: p.phone, region: p.region })),
    [personsQ.data],
  )

  const invalidate = async () => {
    await Promise.all([
      utils.expenses.listByEvent.invalidate({ eventId }),
      utils.events.get.invalidate({ id: eventId }),
      utils.events.list.invalidate(),
      utils.audit.list.invalidate(),
    ])
  }

  const create = trpc.expenses.create.useMutation({
    onSuccess: async () => {
      toast('success', 'اتسجّل المصروف من الشنطة ✓')
      await invalidate()
      onClose()
    },
    onError: (e) => setError(e.message),
  })
  const update = trpc.expenses.update.useMutation({
    onSuccess: async () => {
      toast('success', 'اتحفظ تعديل المصروف ✓')
      await invalidate()
      onClose()
    },
    onError: (e) => setError(e.message),
  })

  const amount = Number(amountRaw.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[,\s]/g, '')) || 0
  const pending = create.isPending || update.isPending
  const valid = receiverName.trim().length > 0 && amount > 0

  const submit = () => {
    if (!valid || pending) return
    if (expense) {
      update.mutate({
        id: expense.id,
        receiverName: receiverName.trim(),
        receiverPersonId: linked?.id ?? null,
        amount,
        note: note.trim() || null,
      })
    } else {
      create.mutate({
        eventId,
        receiverName: receiverName.trim(),
        receiverPersonId: linked?.id ?? undefined,
        amount,
        note: note.trim() || undefined,
      })
    }
  }

  return (
    <Modal open onClose={onClose} title={isEdit ? 'تعديل مصروف' : 'إضافة مصروف'} subtitle="فلوس خرجت من شنطة الفرح — بتتخصم من الصافي">
      <div className="flex flex-col gap-4">
        {/* المستلم: نص حر أو ربط بشخص مسجل */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink-700">اسم المستلم</span>
          {linked ? (
            <div className="flex items-center gap-2 rounded-[10px] border border-primary-300 bg-primary-50 px-3.5 py-2.5">
              <UserCheck className="size-4 shrink-0 text-primary-600" />
              <span className="min-w-0 flex-1 truncate font-kufi text-[14px] font-semibold text-ink-900">{linked.name}</span>
              <span className="shrink-0 rounded-full bg-primary-100 px-2 py-0.5 text-[11px] font-medium text-primary-700">مربوط من الدفتر</span>
              <button
                type="button"
                aria-label="فك الربط"
                onClick={() => setLinked(null)}
                className="flex size-6 shrink-0 items-center justify-center rounded-md text-ink-500 transition-colors hover:bg-paper-surface hover:text-redink"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ) : (
            <input
              value={receiverName}
              onChange={(e) => setReceiverName(e.target.value)}
              placeholder="مثال: المطرب، قاعة الفرح، عربة الكشري…"
              className="h-11 rounded-[10px] border border-line-strong bg-paper-surface px-3.5 text-[14px] text-ink-900 placeholder:text-ink-400 focus:border-primary-500 focus:outline-none"
            />
          )}
          {!linked && !pickerOpen && (
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="inline-flex items-center gap-1 self-start text-[12.5px] font-medium text-primary-600 transition-colors hover:text-primary-700"
            >
              <UserPlus className="size-3.5" />
              أو اربط بشخص مسجل في الدفتر…
            </button>
          )}
          {!linked && pickerOpen && (
            <PersonCombobox
              people={comboPeople}
              autoFocus
              placeholder="دوّر على الشخص المسجل…"
              addNewLabel={(name) => (
                <>
                  استخدام «<span className="font-kufi font-semibold">{name}</span>» كنص حر من غير ربط
                </>
              )}
              onSelect={(p) => {
                setLinked({ id: Number(p.id), name: p.name })
                setReceiverName(p.name)
                setPickerOpen(false)
              }}
              onAddNew={(name) => {
                setReceiverName(name)
                setPickerOpen(false)
              }}
            />
          )}
        </div>

        {/* المبلغ */}
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink-700">المبلغ (ج.م)</span>
          <input
            value={amountRaw}
            onChange={(e) => {
              const n = Number(e.target.value.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[,\s]/g, ''))
              setAmountRaw(e.target.value.trim() === '' ? '' : Number.isFinite(n) && n > 0 ? formatMoney(n) : amountRaw)
            }}
            inputMode="numeric"
            placeholder="٠"
            className="num-ltr h-12 rounded-[10px] border border-line-strong bg-paper-surface px-4 text-center text-[20px] font-bold text-ink-900 focus:border-primary-500 focus:outline-none"
          />
        </label>

        {/* ملاحظة */}
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink-700">ملاحظة (اختياري)</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="مثال: عربون القاعة، باقي حساب المطرب…"
            className="h-11 rounded-[10px] border border-line-strong bg-paper-surface px-3.5 text-[14px] text-ink-900 placeholder:text-ink-400 focus:border-primary-500 focus:outline-none"
          />
        </label>

        {error && (
          <p className="flex items-center gap-2 rounded-lg bg-redink-bg px-3 py-2 text-[12.5px] text-redink">
            <AlertTriangle className="size-4 shrink-0" />
            {error}
          </p>
        )}

        <div className="flex items-center gap-2.5 border-t border-line pt-4">
          <button
            type="button"
            disabled={!valid || pending}
            onClick={submit}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-[10px] bg-primary-500 px-4 py-2.5 text-[14px] font-semibold text-[#FFFDF8] transition-all hover:bg-primary-600 active:scale-[0.97] disabled:opacity-50"
          >
            <Check className="size-4" />
            {pending ? 'بيحفظ…' : isEdit ? 'حفظ التعديل' : 'تسجيل المصروف'}
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

/* ─────────── مودال حذف مصروف ─────────── */

function DeleteExpenseModal({ expense, onClose }: { expense: ExpenseItem | null; onClose: () => void }) {
  if (!expense) return null
  return <DeleteExpenseForm key={expense.id} expense={expense} onClose={onClose} />
}

function DeleteExpenseForm({ expense, onClose }: { expense: ExpenseItem; onClose: () => void }) {
  const toast = useToast()
  const utils = trpc.useUtils()
  const [error, setError] = useState('')

  const del = trpc.expenses.delete.useMutation({
    onSuccess: async () => {
      toast('success', 'اتحذف المصروف من الشنطة')
      await Promise.all([
        utils.expenses.listByEvent.invalidate({ eventId: expense.eventId }),
        utils.events.get.invalidate({ id: expense.eventId }),
        utils.events.list.invalidate(),
        utils.audit.list.invalidate(),
      ])
      onClose()
    },
    onError: (e) => setError(e.message),
  })

  return (
    <Modal open onClose={onClose} title="حذف مصروف" subtitle={`${expense.receiverName} · ${formatMoney(expense.amount)} ج.م`}>
      <div className="flex flex-col gap-4">
        <p className="text-[13px] leading-6 text-ink-700">
          المصروف ده هيتحذف من سجل الشنطة وهيرجع لصافي الفرح — والحذف هيتسجل في سجل التدقيق.
        </p>
        {error && (
          <p className="flex items-center gap-2 rounded-lg bg-redink-bg px-3 py-2 text-[12.5px] text-redink">
            <AlertTriangle className="size-4 shrink-0" />
            {error}
          </p>
        )}
        <div className="flex items-center gap-2.5 border-t border-line pt-4">
          <button
            type="button"
            disabled={del.isPending}
            onClick={() => del.mutate({ id: expense.id })}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-[10px] border border-[#E3C4B8] bg-redink px-4 py-2.5 text-[14px] font-semibold text-[#FFFDF8] transition-all hover:bg-[#8F352A] active:scale-[0.97] disabled:opacity-50"
          >
            <Trash2 className="size-4" />
            {del.isPending ? 'بيتحذف…' : 'حذف المصروف'}
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

/* ─────────── قسم «مصروفات الشنطة» ─────────── */

function ExpensesSection({ eventId, totalExpenses }: { eventId: number; totalExpenses: number }) {
  const expensesQ = trpc.expenses.listByEvent.useQuery({ eventId })
  const expenses = useMemo(() => expensesQ.data ?? [], [expensesQ.data])
  const [addOpen, setAddOpen] = useState(false)
  const [editExpense, setEditExpense] = useState<ExpenseItem | null>(null)
  const [deleteExpense, setDeleteExpense] = useState<ExpenseItem | null>(null)

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, ease: EASE }}
      className="surface-card p-5"
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-lg bg-aleh-bg text-aleh-text">
          <Wallet className="size-[18px]" strokeWidth={2.1} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-kufi font-semibold text-[17px] leading-6 text-ink-900">مصروفات الشنطة</h3>
          <p className="text-[12px] text-ink-500">الفلوس اللي خرجت من الشنطة أثناء الفرح</p>
        </div>
        <span className="rounded-full bg-aleh-bg px-3 py-0.5 text-[12px] font-semibold text-aleh-text">
          الإجمالي: <span className="num-ltr">{formatMoney(totalExpenses)}</span> ج.م
        </span>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-[10px] bg-primary-500 px-3.5 py-2 text-[13px] font-semibold text-[#FFFDF8] shadow-card transition-all hover:bg-primary-600 active:scale-[0.97]"
        >
          <Plus className="size-4" />
          إضافة مصروف
        </button>
      </div>

      {expensesQ.isLoading ? (
        <div className="mt-4 flex flex-col gap-2.5">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : expenses.length === 0 ? (
        <p className="mt-4 rounded-[10px] border border-dashed border-line-strong px-4 py-6 text-center text-[13px] text-ink-400">
          مفيش مصروفات متسجلة لسه — أول مصروف يتسجل هيظهر هنا ويتحسم من صافي الشنطة
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2.5">
          {expenses.map((e, i) => (
            <motion.li
              key={e.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: Math.min(i, 12) * 0.035, ease: EASE }}
              className="rounded-[10px] border border-line bg-paper-base px-3.5 py-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-kufi font-semibold text-[13.5px] text-ink-900">{e.receiverName}</span>
                    {e.receiverPersonId && (
                      <span className="shrink-0 rounded-full bg-primary-100 px-2 py-0.5 text-[10.5px] font-medium text-primary-700">مسجل</span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[11px] text-ink-500">
                    سلّمها: <span className="text-ink-700">{e.handedByName ?? '—'}</span>
                  </div>
                </div>
                <div className="shrink-0 text-end">
                  <span className="num-ltr font-bold text-[15px] text-ink-900">{formatMoney(e.amount)}</span>
                  <span className="text-[11px] text-ink-500"> ج.م</span>
                  <div className="text-[10.5px] text-ink-400">
                    {formatShortArabicDate(new Date(e.createdAt))} · {formatArabicTime(new Date(e.createdAt))}
                  </div>
                </div>
              </div>
              {e.note && <p className="mt-1.5 text-[12px] leading-5 text-ink-500">{e.note}</p>}
              <div className="mt-2 flex items-center justify-end gap-1 border-t border-line pt-2">
                <button
                  type="button"
                  title="تعديل المصروف"
                  onClick={() => setEditExpense(e)}
                  className="flex size-8 items-center justify-center rounded-lg text-ink-500 transition-colors hover:bg-primary-50 hover:text-primary-600"
                >
                  <Pencil className="size-4" />
                </button>
                <button
                  type="button"
                  title="حذف المصروف"
                  onClick={() => setDeleteExpense(e)}
                  className="flex size-8 items-center justify-center rounded-lg text-ink-500 transition-colors hover:bg-redink-bg hover:text-redink"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </motion.li>
          ))}
        </ul>
      )}

      <ExpenseFormModal eventId={eventId} expense={null} open={addOpen} onClose={() => setAddOpen(false)} />
      <ExpenseFormModal eventId={eventId} expense={editExpense} open={Boolean(editExpense)} onClose={() => setEditExpense(null)} />
      <DeleteExpenseModal expense={deleteExpense} onClose={() => setDeleteExpense(null)} />
    </motion.section>
  )
}

/* ─────────── قائمة ⋮ — WarmMenu عبر portal حتى لا تُقصّ بترويسة الفرح ─────────── */

function MoreMenu({ onEdit, onMarkDone, onRegenerate, isDone }: { onEdit: () => void; onMarkDone: () => void; onRegenerate: () => void; isDone: boolean }) {
  return (
    <WarmMenu
      ariaLabel="إجراءات الفرح"
      width={224}
      trigger={({ toggle }) => (
        <button
          type="button"
          aria-label="إجراءات أكتر"
          onClick={toggle}
          className="flex size-10 items-center justify-center rounded-[10px] border border-line-strong text-ink-700 transition-colors hover:bg-primary-50"
        >
          <MoreVertical className="size-[18px]" />
        </button>
      )}
      items={[
        {
          key: 'edit',
          label: 'تعديل بيانات الفرح',
          icon: <Pencil className="size-4 text-ink-500" />,
          onSelect: onEdit,
        },
        ...(!isDone
          ? [
              {
                key: 'done',
                label: 'إتمام الفرح',
                icon: <Check className="size-4 text-laha-text" />,
                onSelect: onMarkDone,
              },
            ]
          : []),
        {
          key: 'regen',
          label: 'تجديد رابط المشاركة',
          icon: <RefreshCw className="size-4 text-ink-500" />,
          onSelect: onRegenerate,
        },
      ]}
    />
  )
}

/* ═══════════ الصفحة ═══════════ */

function WeddingDetailsInner() {
  const { id: idParam } = useParams()
  const id = Number(idParam ?? 0)
  const navigate = useNavigate()
  const toast = useToast()
  const utils = trpc.useUtils()

  const detailsQ = trpc.events.get.useQuery({ id }, { enabled: id > 0 })
  const data = detailsQ.data
  const event = data?.event

  const hostQ = trpc.persons.get.useQuery({ id: event?.hostPersonId ?? 0 }, { enabled: Boolean(event?.hostPersonId) })

  const [chip, setChip] = useState<ChipFilter>('all')
  const [query, setQuery] = useState('')
  const [regionFilter, setRegionFilter] = useState<string | null>(null)
  const [editNuqta, setEditNuqta] = useState<EventNuqtaItem | null>(null)
  const [deleteNuqta, setDeleteNuqta] = useState<EventNuqtaItem | null>(null)
  const [editEventOpen, setEditEventOpen] = useState(false)
  const [markDoneOpen, setMarkDoneOpen] = useState(false)
  const [regenOpen, setRegenOpen] = useState(false)
  const [openLedgerOpen, setOpenLedgerOpen] = useState(false)
  const [closeLedgerOpen, setCloseLedgerOpen] = useState(false)
  const [lifecycleError, setLifecycleError] = useState('')
  /* تقرير جاهز لكن المتصفح حجب الفتح التلقائي — بطاقة دائمة حتى يفتحه المستخدم */
  const [readyReport, setReadyReport] = useState<{ id: number; fileUrl: string } | null>(null)

  const nuqtat = useMemo(() => data?.nuqtat ?? [], [data?.nuqtat])

  /* توزيع المناطق */
  const regions = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>()
    for (const n of nuqtat) {
      const key = n.payerRegion || 'بدون منطقة'
      const cur = map.get(key) ?? { count: 0, total: 0 }
      cur.count += 1
      cur.total += n.amount
      map.set(key, cur)
    }
    return [...map.entries()]
      .map(([region, v]) => ({ region, ...v, pct: nuqtat.length ? Math.round((v.count / nuqtat.length) * 100) : 0 }))
      .sort((a, b) => b.count - a.count)
  }, [nuqtat])

  /* الفلترة */
  const visible = useMemo(() => {
    let list = [...nuqtat].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    if (chip === 'notified') list = list.filter((n) => n.whatsappNotified)
    else if (chip === 'noInviter') list = list.filter((n) => !n.invitedBy.trim())
    else if (chip === 'edited') list = list.filter((n) => n.editedAfterDone)
    if (regionFilter) list = list.filter((n) => (n.payerRegion || 'بدون منطقة') === regionFilter)
    const nq = normalizeArabic(query)
    if (nq) list = list.filter((n) => normalizeArabic(n.payerName).includes(nq))
    return list
  }, [nuqtat, chip, regionFilter, query])

  const stats = useMemo(() => {
    const count = nuqtat.length
    const total = data?.totalAmount ?? 0
    const avg = count ? Math.round(total / count) : 0
    const max = nuqtat.reduce<EventNuqtaItem | null>((m, n) => (m && m.amount >= n.amount ? m : n), null)
    const notified = nuqtat.filter((n) => n.whatsappNotified).length
    return { count, total, avg, max, notified }
  }, [nuqtat, data?.totalAmount])

  /* الإجراءات */
  const generateReport = trpc.reports.generate.useMutation({
    onSuccess: () => {
      void utils.reports.list.invalidate()
    },
    onError: (e) => toast('error', e.message || 'مقدرش يولّد التقرير دلوقتي'),
  })

  /**
   * تصدير التقرير — يفتح تبويب الانتظار «متزامنًا» مع الضغطة (قبل أي await)
   * حتى لا تحجبه متصفحات الموبايل، ثم يوجّهه للملف بعد اكتمال التوليد.
   * لو التبويب محجوب أصلًا تظهر بطاقة دائمة برابط فتح/تحميل.
   */
  const handleExportPdf = () => {
    if (!event) return
    const win = openReportWaitingTab()
    setReadyReport(null)
    generateReport.mutate(
      { eventId: event.id },
      {
        onSuccess: (report) => {
          const delivered = deliverReportToTab(win, report.fileUrl)
          if (delivered) {
            toast('success', 'التقرير اتولّد ✓ — بيفتح في التبويب الجديد')
          } else {
            setReadyReport({ id: report.id, fileUrl: report.fileUrl })
            toast('info', 'المتصفح منع الفتح التلقائي — التقرير جاهز تحت زر التصدير')
          }
        },
        onError: () => abortReportTab(win),
      },
    )
  }

  const markDone = trpc.events.markDone.useMutation({
    onSuccess: async () => {
      toast('success', 'اتقفلت الفرح ✓ — أي تعديل بعد كده هيتوسم بالحبر الأحمر')
      await utils.events.invalidate()
      setMarkDoneOpen(false)
    },
    onError: (e) => toast('error', e.message),
  })

  /* دورة حياة الدفتر: فتح (upcoming→open) وإتمام/قفل (open→done) */
  const openLedger = trpc.events.openLedger.useMutation({
    onSuccess: async () => {
      toast('success', 'اتفتح الدفتر ✓ — الفرح بدأت رسميًا والتسجيل متاح')
      setLifecycleError('')
      setOpenLedgerOpen(false)
      await utils.events.invalidate()
    },
    onError: (e) => setLifecycleError(e.message),
  })

  const closeLedger = trpc.events.closeLedger.useMutation({
    onSuccess: async () => {
      toast('success', 'تمت الفرح واتقفل الدفتر ✓ — أي تعديل بعد كده بالحبر الأحمر وللكاتب فقط')
      setLifecycleError('')
      setCloseLedgerOpen(false)
      await utils.events.invalidate()
    },
    /* أخطاء السيرفر العربية (FORBIDDEN وغيرها) تُعرض كما هي */
    onError: (e) => setLifecycleError(e.message),
  })

  const regenToken = trpc.events.regenerateShareToken.useMutation({
    onSuccess: async (ev) => {
      await utils.events.invalidate()
      setRegenOpen(false)
      if (ev) {
        const ok = await copyText(`${window.location.origin}/w/${ev.shareToken}`)
        toast(ok ? 'success' : 'info', ok ? 'اتجدد الرابط واتنسخ — القديم بطل' : 'اتجدد الرابط — انسخه من زر المشاركة')
      }
    },
    onError: (e) => toast('error', e.message),
  })

  const shareLink = async () => {
    if (!data) return
    const ok = await copyText(`${window.location.origin}${data.sharePath}`)
    toast(ok ? 'success' : 'error', ok ? `الرابط اتنسخ — ابعته لـ${event?.hostName} واتساب` : 'مقدرتش أنسخ الرابط')
  }

  /* ── حالات ── */
  if (detailsQ.isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <CardSkeleton lines={4} />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <CardSkeleton lines={8} />
      </div>
    )
  }
  if (detailsQ.error || !data || !event) {
    return (
      <div className="flex flex-col gap-4">
        <Link to="/weddings" className="inline-flex items-center gap-1.5 self-start text-[13px] font-medium text-primary-600 hover:text-primary-700">
          <ArrowRight className="size-4" />
          رجوع للأفراح
        </Link>
        <ErrorState
          error={detailsQ.error}
          message="الفرحة دي مش موجودة أو حصل خطأ أثناء تحميلها."
          onRetry={() => void detailsQ.refetch()}
        />
      </div>
    )
  }

  const isDone = event.status === 'done'
  const days = daysUntil(new Date(event.eventDate))
  const hostPhone = hostQ.data?.person.phone

  return (
    <div className="flex flex-col gap-6">
      {/* رجوع */}
      <Link to="/weddings" className="inline-flex items-center gap-1.5 self-start text-[13px] font-medium text-primary-600 transition-colors hover:text-primary-700">
        <ArrowRight className="size-4" />
        كل الأفراح
      </Link>

      {/* ── ترويسة الفرح ── */}
      <motion.header
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.42, ease: EASE }}
        className="relative overflow-hidden rounded-xl border border-[#E3D3A3] bg-[#FBF5E6] p-6 shadow-card"
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.05 }}
          transition={{ duration: 0.8 }}
          className="pattern-festive pointer-events-none absolute inset-0"
          aria-hidden
        />
        <div className="relative flex flex-wrap items-start gap-5">
          <div className="min-w-[260px] flex-1">
            {event.status === 'done' ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-open-bg px-3 py-1 text-[12px] font-medium text-open-text">
                <LockKeyhole className="size-3.5" />
                تمت — الدفتر مقفول
                {event.closedAt && (
                  <span className="text-open-text/90">
                    · {formatShortArabicDate(new Date(event.closedAt))} {formatArabicTime(new Date(event.closedAt))}
                  </span>
                )}
              </span>
            ) : event.status === 'open' ? (
              <motion.span
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 1.2 }}
                className="inline-flex items-center gap-1.5 rounded-full bg-gold-100 px-3 py-1 text-[12px] font-semibold text-gold-600"
              >
                <BookOpen className="size-3.5" />
                الدفتر مفتوح — الفرح شغال
                {event.openedAt && (
                  <span className="font-medium text-gold-600/85">
                    · اتفتح {formatShortArabicDate(new Date(event.openedAt))} {formatArabicTime(new Date(event.openedAt))}
                  </span>
                )}
              </motion.span>
            ) : (
              <motion.span
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2.2, repeat: Infinity, repeatDelay: 1.6 }}
                className="inline-flex items-center gap-1.5 rounded-full bg-gold-100 px-3 py-1 text-[12px] font-semibold text-gold-600"
              >
                <CalendarHeart className="size-3.5" />
                قادمة — {daysLeftLabel(days)}
              </motion.span>
            )}
            <h2 className="mt-2.5 font-kufi font-bold text-[28px] leading-9 text-ink-900">فرحة {event.hostName}</h2>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-500">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-4" />
                {event.place || 'المكان لسه متحددش'}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="size-4" />
                {formatArabicDate(new Date(event.eventDate))}
              </span>
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-[13px] text-ink-500">
              <Phone className="size-4" />
              صاحب الفرح: <span className="font-semibold text-ink-900">{event.hostName}</span>
              {hostPhone && <span className="num-ltr text-ink-400">{hostPhone}</span>}
            </p>
          </div>

          {/* عمود الإجراءات */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15, ease: EASE }}
            className="flex flex-col gap-2.5"
          >
            <button
              type="button"
              disabled={generateReport.isPending}
              onClick={handleExportPdf}
              className="inline-flex items-center justify-center gap-2 rounded-[10px] bg-gold-500 px-5 py-2.5 text-[14px] font-semibold text-[#3A2E10] shadow-card transition-all hover:bg-gold-600 hover:-translate-y-px active:scale-[0.97] disabled:opacity-60"
            >
              <FileDown className="size-4" />
              {generateReport.isPending ? 'بيتولّد…' : 'تصدير تقرير PDF'}
            </button>
            {/* واجهة احتياطية دائمة لو المتصفح حجب التبويب — تبقى حتى يفتحها المستخدم */}
            {readyReport && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: EASE }}
                className="w-[260px] max-w-full rounded-[10px] border border-gold-500 bg-gold-100 p-3 shadow-card"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[13px] font-bold text-ink-900">التقرير جاهز ✓</p>
                  <button
                    type="button"
                    aria-label="إخفاء"
                    onClick={() => setReadyReport(null)}
                    className="text-[16px] leading-4 text-ink-400 transition-colors hover:text-ink-700"
                  >
                    ×
                  </button>
                </div>
                <p className="mt-0.5 text-[11.5px] leading-4 text-ink-500">المتصفح منع الفتح التلقائي — اضغط للفتح أو التحميل</p>
                <div className="mt-2 flex items-center gap-2">
                  <a
                    href={readyReport.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary-500 px-3 py-2 text-[12.5px] font-semibold text-[#FFFDF8] transition-colors hover:bg-primary-600"
                  >
                    <Eye className="size-3.5" />
                    فتح التقرير
                  </a>
                  <a
                    href={readyReport.fileUrl}
                    download={reportDownloadName(event.hostName, readyReport.id)}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-line-strong bg-paper-surface px-3 py-2 text-[12.5px] font-semibold text-ink-700 transition-colors hover:bg-primary-50"
                  >
                    <FileDown className="size-3.5" />
                    تحميل PDF
                  </a>
                </div>
              </motion.div>
            )}
            {/* زر التسجيل — معطّل قبل فتح الدفتر */}
            <span title={event.status === 'upcoming' ? 'افتح الدفتر الأول' : undefined} className="block">
              <button
                type="button"
                disabled={event.status === 'upcoming'}
                onClick={() => navigate(`/nuqta/new?event=${event.id}`)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-[10px] bg-primary-500 px-5 py-2.5 text-[14px] font-semibold text-[#FFFDF8] transition-all hover:bg-primary-600 hover:-translate-y-px active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
              >
                <NotebookPen className="size-4" />
                سجّل نقطة في الفرح دي
              </button>
            </span>
            {event.status === 'upcoming' ? (
              <button
                type="button"
                onClick={() => {
                  setLifecycleError('')
                  setOpenLedgerOpen(true)
                }}
                className="inline-flex items-center justify-center gap-2 rounded-[10px] bg-gold-500 px-5 py-2.5 text-[14px] font-semibold text-[#3A2E10] shadow-card transition-all hover:bg-gold-600 hover:-translate-y-px active:scale-[0.97]"
              >
                <BookOpen className="size-4" />
                فتح الدفتر
              </button>
            ) : event.status === 'open' ? (
              <button
                type="button"
                onClick={() => {
                  setLifecycleError('')
                  setCloseLedgerOpen(true)
                }}
                className="inline-flex items-center justify-center gap-2 rounded-[10px] border border-line-strong bg-paper-surface px-5 py-2.5 text-[14px] font-semibold text-ink-700 transition-all hover:bg-primary-50 hover:-translate-y-px active:scale-[0.97]"
              >
                <LockKeyhole className="size-4" />
                إتمام الفرح وقفل الدفتر
              </button>
            ) : null}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void shareLink()}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-[10px] border border-line-strong px-4 py-2.5 text-[13.5px] font-medium text-ink-700 transition-colors hover:bg-primary-50"
              >
                <Share2 className="size-4" />
                رابط صاحب الفرح
              </button>
              <MoreMenu
                isDone={isDone}
                onEdit={() => setEditEventOpen(true)}
                onMarkDone={() => {
                  setLifecycleError('')
                  if (event.status === 'open') setCloseLedgerOpen(true)
                  else setMarkDoneOpen(true)
                }}
                onRegenerate={() => setRegenOpen(true)}
              />
            </div>
          </motion.div>
        </div>
      </motion.header>

      {/* ── إحصائيات الفرح ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <MiniStat
          index={0}
          icon={FileDown}
          tone="bg-primary-100 text-primary-600"
          title="إجمالي النقوط"
          value={<><span className="num-ltr">{formatMoney(stats.total)}</span> <span className="text-[13px] font-medium text-ink-500">ج.م</span></>}
          sub={`${toArabicDigits(stats.count)} نقطة مسجلة`}
        />
        <MiniStat
          index={1}
          icon={Wallet}
          tone="bg-aleh-bg text-aleh-text"
          title="إجمالي المصروفات"
          value={<><span className="num-ltr">{formatMoney(data.totalExpenses)}</span> <span className="text-[13px] font-medium text-ink-500">ج.م</span></>}
          sub={data.expensesCount > 0 ? `${toArabicDigits(data.expensesCount)} مصروف من الشنطة` : 'مفيش مصروفات'}
        />
        <MiniStat
          index={2}
          featured
          icon={Scale}
          tone="bg-gold-100 text-gold-600"
          title="صافي الشنطة"
          value={<><span className="num-ltr">{data.netTotal < 0 ? '−' : ''}{formatMoney(data.netTotal)}</span> <span className="text-[13px] font-medium text-ink-500">ج.م</span></>}
          sub={data.netTotal < 0 ? 'المصروفات عدّت النقوط — راجع الحساب' : 'النقوط ناقص المصروفات'}
        />
        <MiniStat
          index={3}
          icon={CalendarHeart}
          tone="bg-gold-100 text-gold-600"
          title="متوسط النقطة"
          value={<><span className="num-ltr">{formatMoney(stats.avg)}</span> <span className="text-[13px] font-medium text-ink-500">ج.م</span></>}
          sub={stats.max ? `أكبر نقطة: ${formatMoney(stats.max.amount)} — من ${stats.max.payerName}` : 'لسه مفيش نقوط'}
        />
        <MiniStat
          index={4}
          icon={CheckCheck}
          tone="bg-whatsapp-bg text-whatsapp"
          title="تأكيدات واتساب"
          value={<span className="num-ltr">{stats.notified}/{stats.count}</span>}
          sub={stats.count - stats.notified > 0 ? `${toArabicDigits(stats.count - stats.notified)} قيد الإرسال` : 'كل الإشعارات اتبعتت'}
        />
        <MiniStat
          index={5}
          icon={CalendarDays}
          tone="bg-laha-bg text-laha-solid"
          title="المدعوون"
          value={<span className="num-ltr">{data.payersCount}<span className="text-ink-400">/{data.expectedGuests}</span></span>}
          sub="سجّلوا نقوط / متوقعين"
        />
      </div>

      {/* ── مسؤولو الإدخال — أثناء فتح الدفتر فقط ── */}
      {event.status === 'open' && <AssigneesSection eventId={event.id} assignees={data.assignees} />}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        {/* ── جدول نقوط الفرح ── */}
        <section className="surface-card p-5 xl:col-span-8">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="font-kufi font-semibold text-[17px] leading-6 text-ink-900">
              نقوط الفرح <span className="num-ltr text-ink-500">({toArabicDigits(stats.count)})</span>
            </h3>
            <span className="rounded-full bg-primary-100 px-3 py-0.5 text-[12px] font-semibold text-primary-700">
              الإجمالي: <span className="num-ltr">{formatMoney(stats.total)}</span> ج.م
            </span>
            <div className="relative ms-auto">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="دوّر باسم الدافع…"
                className="h-9 w-52 max-w-full rounded-[10px] border border-line bg-paper-surface ps-9 pe-3 text-[12.5px] text-ink-900 placeholder:text-ink-400 focus:border-primary-500 focus:outline-none"
              />
            </div>
          </div>

          {/* فلاتر الشرائح */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {(
              [
                ['all', 'الكل'],
                ['notified', 'اتأكدت واتساب'],
                ['noInviter', 'بدون داعٍ'],
                ['edited', 'معدّلة بعد الفرح'],
              ] as [ChipFilter, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setChip(key)}
                className={cn(
                  'rounded-full border px-3 py-1 text-[12px] font-medium transition-colors',
                  chip === key ? 'border-primary-500 bg-primary-100 text-primary-700' : 'border-line-strong text-ink-500 hover:bg-primary-50',
                )}
              >
                {label}
              </button>
            ))}
            {regionFilter && (
              <button
                type="button"
                onClick={() => setRegionFilter(null)}
                className="inline-flex items-center gap-1 rounded-full border border-gold-500 bg-gold-100 px-3 py-1 text-[12px] font-semibold text-gold-600"
              >
                {regionFilter} ×
              </button>
            )}
          </div>

          {/* الجدول */}
          {nuqtat.length === 0 ? (
            <EmptyState
              title="لسه مفيش نقوط في الفرح دي"
              description="أول نقطة تتسجل هتفتح صفحة الدفتر — وهيوصل تأكيد واتساب للدافع فورًا"
              actionLabel="سجّل أول نقطة"
              actionHref={`/nuqta/new?event=${event.id}`}
            />
          ) : visible.length === 0 ? (
            <EmptyState image="/empty-search.svg" title="مفيش نتائج مطابقة" description="غيّر الفلتر أو كلمة البحث" />
          ) : (
            <div className="mt-4 hidden overflow-x-auto md:block">
              <table className="w-full border-collapse text-[13.5px] leading-[22px]">
                <thead>
                  <tr className="sticky top-0 z-10 bg-[#F1EADA]">
                    <th className="px-4 py-3 text-start text-[12px] font-semibold text-ink-700">الدافع</th>
                    <th className="px-4 py-3 text-end text-[12px] font-semibold text-ink-700">المبلغ</th>
                    <th className="px-4 py-3 text-start text-[12px] font-semibold text-ink-700">مين دعاه</th>
                    <th className="px-4 py-3 text-start text-[12px] font-semibold text-ink-700">وقت التسجيل</th>
                    <th className="px-4 py-3 text-start text-[12px] font-semibold text-ink-700">واتساب</th>
                    <th className="px-4 py-3 text-start text-[12px] font-semibold text-ink-700">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((n, i) => {
                    const edited = n.editedAfterDone
                    return (
                      <motion.tr
                        key={n.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.28, delay: Math.min(i, 12) * 0.035, ease: EASE }}
                        className={cn('border-t border-line transition-colors', edited ? 'bg-redink-bg' : 'hover:bg-[#FAF5EA]')}
                      >
                        <td className="px-4 py-3">
                          <div className="font-kufi font-semibold text-[13.5px] text-ink-900">{n.payerName}</div>
                          <div className="text-[11px] text-ink-500">{n.payerRegion || 'بدون منطقة'}</div>
                          {edited && (
                            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-redink px-2 py-0.5 text-[10.5px] font-semibold text-[#FFFDF8]">
                              بعد الفرح
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-end">
                          <span className="num-ltr font-bold text-ink-900">{formatMoney(n.amount)}</span>
                          {edited && (
                            <div className="text-[10.5px] text-redink">آخر تعديل {formatShortArabicDate(new Date(n.updatedAt))}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-ink-700">{n.invitedBy.trim() || <span className="text-ink-400">—</span>}</td>
                        <td className="px-4 py-3 text-[12px] text-ink-500">
                          {formatShortArabicDate(new Date(n.createdAt))} · {formatArabicTime(new Date(n.createdAt))}
                        </td>
                        <td className="px-4 py-3">
                          {n.whatsappNotified ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-whatsapp-bg px-2.5 py-0.5 text-[11px] font-medium text-whatsapp">
                              <CheckCheck className="size-3" strokeWidth={2.6} />
                              اتبعت
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-open-bg px-2.5 py-0.5 text-[11px] text-open-text">
                              <Clock className="size-3" />
                              قيد الإرسال
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              title={n.whatsappNotified ? 'تعديل (هيبعت رسالة تصحيح)' : 'تعديل صامت'}
                              onClick={() => setEditNuqta(n)}
                              className="flex size-8 items-center justify-center rounded-lg text-ink-500 transition-colors hover:bg-primary-50 hover:text-primary-600"
                            >
                              <Pencil className="size-4" />
                            </button>
                            <button
                              type="button"
                              title="حذف النقطة"
                              onClick={() => setDeleteNuqta(n)}
                              className="flex size-8 items-center justify-center rounded-lg text-ink-500 transition-colors hover:bg-redink-bg hover:text-redink"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-line-strong bg-paper-base">
                    <td className="px-4 py-3 font-kufi font-semibold text-ink-900">الإجمالي</td>
                    <td className="px-4 py-3 text-end">
                      <span className="num-ltr font-bold text-[15px] text-ink-900">{formatMoney(visible.reduce((s, n) => s + n.amount, 0))}</span>
                      <span className="text-[12px] text-ink-500"> ج.م</span>
                    </td>
                    <td colSpan={4} className="px-4 py-3 text-[12px] text-ink-500">
                      {toArabicDigits(visible.length)} {visible.length === 1 ? 'نقطة' : 'نقطة'} معروضة
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* بطاقات النقوط — موبايل (< 768px): كل نقطة بطاقة رأسية بلا قصّ */}
          {visible.length > 0 && (
            <div className="mt-4 md:hidden">
              <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
                {visible.map((n, i) => {
                  const edited = n.editedAfterDone
                  return (
                    <motion.li
                      key={n.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.28, delay: Math.min(i, 12) * 0.035, ease: EASE }}
                      className={cn('px-4 py-3.5', edited && 'bg-redink-bg')}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-kufi font-semibold text-[13.5px] text-ink-900">{n.payerName}</span>
                            {edited && (
                              <span className="shrink-0 rounded-full bg-redink px-2 py-0.5 text-[10.5px] font-semibold text-[#FFFDF8]">
                                بعد الفرح
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 text-[11px] text-ink-500">{n.payerRegion || 'بدون منطقة'}</div>
                        </div>
                        <div className="shrink-0 text-end">
                          <span className="num-ltr font-bold text-[15px] text-ink-900">{formatMoney(n.amount)}</span>
                          <span className="text-[11px] text-ink-500"> ج.م</span>
                          {edited && (
                            <div className="text-[10.5px] text-redink">آخر تعديل {formatShortArabicDate(new Date(n.updatedAt))}</div>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11.5px] text-ink-500">
                        <span>مين دعاه: <span className="text-ink-700">{n.invitedBy.trim() || '—'}</span></span>
                        <span>{formatShortArabicDate(new Date(n.createdAt))} · {formatArabicTime(new Date(n.createdAt))}</span>
                        {n.whatsappNotified ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-whatsapp-bg px-2.5 py-0.5 text-[11px] font-medium text-whatsapp">
                            <CheckCheck className="size-3" strokeWidth={2.6} />
                            اتبعت
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-open-bg px-2.5 py-0.5 text-[11px] text-open-text">
                            <Clock className="size-3" />
                            قيد الإرسال
                          </span>
                        )}
                        <span className="ms-auto flex items-center gap-1">
                          <button
                            type="button"
                            title={n.whatsappNotified ? 'تعديل (هيبعت رسالة تصحيح)' : 'تعديل صامت'}
                            onClick={() => setEditNuqta(n)}
                            className="flex size-8 items-center justify-center rounded-lg text-ink-500 transition-colors hover:bg-primary-50 hover:text-primary-600"
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button
                            type="button"
                            title="حذف النقطة"
                            onClick={() => setDeleteNuqta(n)}
                            className="flex size-8 items-center justify-center rounded-lg text-ink-500 transition-colors hover:bg-redink-bg hover:text-redink"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </span>
                      </div>
                    </motion.li>
                  )
                })}
              </ul>
              <div className="mt-2 flex items-center justify-between rounded-xl border-2 border-line-strong bg-paper-base px-4 py-3">
                <span className="font-kufi font-semibold text-ink-900">الإجمالي</span>
                <span>
                  <span className="num-ltr font-bold text-[15px] text-ink-900">{formatMoney(visible.reduce((s, n) => s + n.amount, 0))}</span>
                  <span className="text-[12px] text-ink-500"> ج.م</span>
                  <span className="ms-2 text-[12px] text-ink-500">{toArabicDigits(visible.length)} نقطة معروضة</span>
                </span>
              </div>
            </div>
          )}
        </section>

        {/* ── العمود الجانبي: مصروفات الشنطة + التوزيع حسب المناطق ── */}
        <div className="flex flex-col gap-6 xl:col-span-4">
          <ExpensesSection eventId={event.id} totalExpenses={data.totalExpenses} />

          {/* ── التوزيع حسب المناطق ── */}
          <motion.aside
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, ease: EASE }}
            className="surface-card p-5"
          >
            <h3 className="font-kufi font-semibold text-[17px] leading-6 text-ink-900">التوزيع حسب المناطق</h3>
          {regions.length === 0 ? (
            <p className="mt-4 text-[13px] text-ink-400">هتظهر المناطق بعد تسجيل أول نقطة</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {regions.map((r, i) => (
                <li key={r.region}>
                  <button
                    type="button"
                    onClick={() => setRegionFilter((cur) => (cur === r.region ? null : r.region))}
                    className={cn(
                      'w-full rounded-lg px-2 py-1.5 text-start transition-colors',
                      regionFilter === r.region ? 'bg-gold-100' : 'hover:bg-primary-50',
                    )}
                  >
                    <span className="flex items-center justify-between text-[13px]">
                      <span className="font-medium text-ink-900">{r.region}</span>
                      <span className="text-[12px] text-ink-500">
                        <span className="num-ltr font-semibold text-ink-700">{r.count}</span> · <span className="num-ltr">{formatMoney(r.total)}</span> ج.م · {toArabicDigits(r.pct)}٪
                      </span>
                    </span>
                    <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-paper-sunken">
                      <motion.span
                        initial={{ scaleX: 0 }}
                        whileInView={{ scaleX: r.pct / 100 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: i * 0.05, ease: EASE }}
                        className="block h-full origin-right rounded-full bg-primary-400"
                      />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 border-t border-line pt-3 text-[11.5px] leading-5 text-ink-400">اضغط على منطقة لفلترة الجدول بيها</p>
          </motion.aside>
        </div>
      </div>

      {/* ── المودالات ── */}
      <EditNuqtaModal nuqta={editNuqta} eventDone={isDone} onClose={() => setEditNuqta(null)} />
      <DeleteNuqtaModal nuqta={deleteNuqta} onClose={() => setDeleteNuqta(null)} />
      <EditEventModal
        eventId={event.id}
        open={editEventOpen}
        onClose={() => setEditEventOpen(false)}
        initial={{ hostName: event.hostName, eventDate: new Date(event.eventDate), place: event.place }}
      />

      {/* تأكيد فتح الدفتر */}
      <Modal open={openLedgerOpen} onClose={() => setOpenLedgerOpen(false)} title="فتح الدفتر" subtitle={`فرحة ${event.hostName}`}>
        <div className="flex flex-col gap-4">
          <p className="flex items-start gap-2.5 text-[13px] leading-6 text-ink-700">
            <BookOpen className="mt-0.5 size-4 shrink-0 text-gold-600" />
            بفتح الدفتر بتعلن <span className="font-semibold">بداية الفرح رسميًا</span> — من اللحظة دي تسجيل النقوط
            والمصروفات في الدفتر متاح، وتقدر تعيّن حتى ٢ مسؤولين للإدخال.
          </p>
          {lifecycleError && (
            <p className="flex items-center gap-2 rounded-lg bg-redink-bg px-3 py-2 text-[12.5px] text-redink">
              <AlertTriangle className="size-4 shrink-0" />
              {lifecycleError}
            </p>
          )}
          <div className="flex items-center gap-2.5 border-t border-line pt-4">
            <button
              type="button"
              disabled={openLedger.isPending}
              onClick={() => openLedger.mutate({ id: event.id })}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-[10px] bg-gold-500 px-4 py-2.5 text-[14px] font-semibold text-[#3A2E10] transition-all hover:bg-gold-600 active:scale-[0.97] disabled:opacity-50"
            >
              <BookOpen className="size-4" />
              {openLedger.isPending ? 'بيفتح…' : 'افتح الدفتر'}
            </button>
            <button
              type="button"
              onClick={() => setOpenLedgerOpen(false)}
              className="rounded-[10px] border border-line-strong px-4 py-2.5 text-[14px] font-medium text-ink-700 transition-colors hover:bg-primary-50"
            >
              لسه
            </button>
          </div>
        </div>
      </Modal>

      {/* تأكيد إتمام الفرح وقفل الدفتر */}
      <Modal open={closeLedgerOpen} onClose={() => setCloseLedgerOpen(false)} title="إتمام الفرح وقفل الدفتر" subtitle="خطوة أخيرة — مفيش رجوع">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 rounded-xl border border-[#E3C4B8] bg-redink-bg px-4 py-3">
            <AlertTriangle className="mt-0.5 size-[18px] shrink-0 text-redink" />
            <p className="text-[12.5px] leading-5 text-ink-700">
              الدفتر هيتقفل — <span className="font-semibold text-redink">أي تعديل بعد كده هيتسجل بالحبر الأحمر</span>{' '}
              ومتاح للكاتب فقط. اتأكد إن كل النقوط والمصروفات اتسجلت قبل القفل.
            </p>
          </div>
          {lifecycleError && (
            <p className="flex items-center gap-2 rounded-lg bg-redink-bg px-3 py-2 text-[12.5px] text-redink">
              <AlertTriangle className="size-4 shrink-0" />
              {lifecycleError}
            </p>
          )}
          <div className="flex items-center gap-2.5 border-t border-line pt-4">
            <button
              type="button"
              disabled={closeLedger.isPending}
              onClick={() => closeLedger.mutate({ id: event.id })}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-[10px] bg-redink px-4 py-2.5 text-[14px] font-semibold text-[#FFFDF8] transition-all hover:bg-[#8F352A] active:scale-[0.97] disabled:opacity-50"
            >
              <LockKeyhole className="size-4" />
              {closeLedger.isPending ? 'بيتقفل…' : 'اتم الفرح واقفل الدفتر'}
            </button>
            <button
              type="button"
              onClick={() => setCloseLedgerOpen(false)}
              className="rounded-[10px] border border-line-strong px-4 py-2.5 text-[14px] font-medium text-ink-700 transition-colors hover:bg-primary-50"
            >
              لسه
            </button>
          </div>
        </div>
      </Modal>

      {/* تأكيد «تمت الفرحة» */}
      <Modal open={markDoneOpen} onClose={() => setMarkDoneOpen(false)} title="تمت الفرحة؟" subtitle="قفل دفتر الفرح">
        <div className="flex flex-col gap-4">
          <p className="text-[13px] leading-6 text-ink-700">
            بعد قفل الفرح، <span className="font-semibold text-redink">أي تعديل أو إضافة نقطة هيتوسم بالحبر الأحمر «بعد الفرح»</span> مع تاريخ ووقت التعديل — عشان الدفتر يفضل أمين.
          </p>
          <div className="flex items-center gap-2.5 border-t border-line pt-4">
            <button
              type="button"
              disabled={markDone.isPending}
              onClick={() => markDone.mutate({ id: event.id })}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-[10px] bg-primary-500 px-4 py-2.5 text-[14px] font-semibold text-[#FFFDF8] transition-all hover:bg-primary-600 active:scale-[0.97] disabled:opacity-50"
            >
              <Check className="size-4" />
              {markDone.isPending ? 'بيتقفل…' : 'أيوه، تمت الفرحة'}
            </button>
            <button
              type="button"
              onClick={() => setMarkDoneOpen(false)}
              className="rounded-[10px] border border-line-strong px-4 py-2.5 text-[14px] font-medium text-ink-700 transition-colors hover:bg-primary-50"
            >
              لسه
            </button>
          </div>
        </div>
      </Modal>

      {/* تأكيد تجديد الرابط */}
      <Modal open={regenOpen} onClose={() => setRegenOpen(false)} title="تجديد رابط صاحب الفرح">
        <div className="flex flex-col gap-4">
          <p className="flex items-start gap-2.5 text-[13px] leading-6 text-ink-700">
            <Link2 className="mt-0.5 size-4 shrink-0 text-ink-500" />
            هيتعمل رابط جديد لصفحة صاحب الفرح، <span className="font-semibold">والرابط القديم هيبطل فورًا</span>. الرابط الجديد هيتنسخ للحافظة.
          </p>
          <div className="flex items-center gap-2.5 border-t border-line pt-4">
            <button
              type="button"
              disabled={regenToken.isPending}
              onClick={() => regenToken.mutate({ id: event.id })}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-[10px] bg-primary-500 px-4 py-2.5 text-[14px] font-semibold text-[#FFFDF8] transition-all hover:bg-primary-600 active:scale-[0.97] disabled:opacity-50"
            >
              <RefreshCw className="size-4" />
              {regenToken.isPending ? 'بيتجدد…' : 'جدّد الرابط'}
            </button>
            <button
              type="button"
              onClick={() => setRegenOpen(false)}
              className="rounded-[10px] border border-line-strong px-4 py-2.5 text-[14px] font-medium text-ink-700 transition-colors hover:bg-primary-50"
            >
              إلغاء
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default function WeddingDetails() {
  return (
    <ToastProvider>
      <WeddingDetailsInner />
    </ToastProvider>
  )
}
