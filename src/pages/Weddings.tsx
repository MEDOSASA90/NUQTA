/**
 * الأفراح — weddings.md §١: قائمة الأفراح (بطاقات قادمة/سابقة) + إنشاء فرحة.
 * البيانات: trpc.events.list + reports.list + nuqtat.listRecent (لتوسيم التعديلات).
 */
import { useMemo, useState } from 'react'
import type { MouseEvent } from 'react'
import { useNavigate } from 'react-router'
import { AnimatePresence, motion } from 'framer-motion'
import {
  BellRing,
  CalendarDays,
  CalendarHeart,
  CalendarPlus,
  Eye,
  FileDown,
  MapPin,
  Search,
  Share2,
} from 'lucide-react'
import { trpc } from '@/providers/trpc'
import PersonCombobox from '@/components/PersonCombobox'
import EmptyState from '@/components/EmptyState'
import { cn } from '@/lib/utils'
import { formatArabicDate, formatMoney, normalizeArabic, toArabicDigits } from '@/lib/format'
import { abortReportTab, deliverReportToTab, openReportWaitingTab, reportDownloadName } from '@/lib/open-report'
import type { EventListItem, Person } from '@contracts/afrah'
import { ArabicDateField, CardSkeleton, ErrorState, Modal, QuickAddPersonModal, Skeleton, ToastProvider } from '@/pages/grp-kit'
import { copyText, daysLeftLabel, daysUntil, EASE, useToast } from '@/pages/grp-utils'

type ComboPerson = { id: string; name: string; phone: string; region: string }
type Filter = 'all' | 'upcoming' | 'done'
type SortKey = 'date' | 'total' | 'created'

/* ─────────── بطاقة فرح ─────────── */

function WeddingCard({
  ev,
  index,
  hasReport,
  hasLateEdits,
  onExportPdf,
  exporting,
}: {
  ev: EventListItem
  index: number
  hasReport: boolean
  hasLateEdits: boolean
  onExportPdf: (ev: EventListItem) => void
  exporting: boolean
}) {
  const navigate = useNavigate()
  const toast = useToast()
  const upcoming = ev.status === 'upcoming'
  const days = daysUntil(new Date(ev.eventDate))

  const share = async (e: MouseEvent) => {
    e.stopPropagation()
    const url = `${window.location.origin}/w/${ev.shareToken}`
    const ok = await copyText(url)
    toast(ok ? 'success' : 'error', ok ? `الرابط اتنسخ — ابعته لـ${ev.hostName} واتساب` : 'مقدرتش أنسخ الرابط')
  }

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.42, delay: (index % 12) * 0.07, ease: EASE }}
      whileHover={{ y: -3 }}
      onClick={() => navigate(`/weddings/${ev.id}`)}
      className="surface-card group relative cursor-pointer overflow-hidden transition-shadow duration-200 hover:shadow-card-hover"
    >
      {/* الشريط العلوي حسب الحالة */}
      <span className={cn('absolute inset-x-0 top-0 h-1', upcoming ? 'bg-gold-500' : 'bg-[#C9BFA9]')} aria-hidden />
      {/* ختم شفاف للفرح اللي تقريرها صدر */}
      {!upcoming && hasReport && (
        <img src="/stamp-settled.svg" alt="" aria-hidden className="absolute -bottom-3 left-3 w-24 rotate-[-8deg] opacity-20 select-none" draggable={false} />
      )}

      <div className="p-5">
        <div className="flex items-center justify-between gap-2">
          {upcoming ? (
            <motion.span
              initial={{ scale: 1 }}
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ delay: 0.4 + (index % 12) * 0.07, duration: 0.5 }}
              className="inline-flex items-center gap-1.5 rounded-full bg-gold-100 px-3 py-1 text-[12px] font-semibold text-gold-600"
            >
              <CalendarHeart className="size-3.5" />
              {daysLeftLabel(days)}
            </motion.span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-open-bg px-3 py-1 text-[12px] font-medium text-open-text">تمت</span>
          )}
          {hasLateEdits && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-redink" title="فيه تعديلات اتسجلت بعد إتمام الفرح">
              <span className="size-2 rounded-full bg-redink" />
              تعديل بعد الفرح
            </span>
          )}
        </div>

        <h3 className="mt-3 font-kufi font-bold text-[18px] leading-6 text-ink-900">فرحة {ev.hostName}</h3>
        <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-ink-500">
          <MapPin className="size-3.5 shrink-0" />
          <span className="truncate">{ev.place || 'المكان لسه متحددش'}</span>
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-ink-500">
          <CalendarDays className="size-3.5 shrink-0" />
          {formatArabicDate(new Date(ev.eventDate))}
        </p>

        {/* صف الأرقام */}
        <div className="mt-4 flex items-center divide-x divide-line rounded-lg bg-paper-base py-2 text-center">
          <div className="flex-1 px-2">
            <div className="num-ltr font-kufi font-bold text-[16px] text-ink-900">{ev.nuqtatCount}</div>
            <div className="text-[11px] text-ink-500">نقطة</div>
          </div>
          <div className="flex-1 px-2">
            <div className="num-ltr font-kufi font-bold text-[16px] text-ink-900">{formatMoney(ev.totalAmount)}</div>
            <div className="text-[11px] text-ink-500">ج.م</div>
          </div>
          <div className="flex-1 px-2">
            <div className="num-ltr font-kufi font-bold text-[16px] text-ink-900">{ev.payersCount}<span className="text-ink-400">/{ev.expectedGuests}</span></div>
            <div className="text-[11px] text-ink-500">دفع / متوقع</div>
          </div>
        </div>

        {/* الصف السفلي: صاحب الفرح + أزرار hover */}
        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-100 font-kufi font-bold text-[12px] text-primary-700">
              {ev.hostName.trim().charAt(0)}
            </span>
            <span className="truncate text-[12.5px] text-ink-500">صاحب الفرح: <span className="font-semibold text-ink-900">{ev.hostName}</span></span>
          </span>
          <span className="flex shrink-0 items-center gap-1 opacity-0 transition-all duration-200 group-hover:opacity-100">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/weddings/${ev.id}`)
              }}
              className="rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-primary-600 transition-colors hover:bg-primary-50"
            >
              التفاصيل
            </button>
            <button
              type="button"
              title="التقرير PDF"
              disabled={exporting}
              onClick={(e) => {
                e.stopPropagation()
                onExportPdf(ev)
              }}
              className="flex size-8 items-center justify-center rounded-lg text-gold-600 transition-colors hover:bg-gold-100 disabled:opacity-50"
            >
              <FileDown className="size-4" />
            </button>
            <button
              type="button"
              title="مشاركة رابط صاحب الفرح"
              onClick={share}
              className="flex size-8 items-center justify-center rounded-lg text-primary-600 transition-colors hover:bg-primary-50"
            >
              <Share2 className="size-4" />
            </button>
          </span>
        </div>
      </div>
    </motion.article>
  )
}

/* ─────────── مودال إنشاء فرحة ─────────── */

function CreateWeddingModal(props: { open: boolean; onClose: () => void; people: ComboPerson[]; regions: string[] }) {
  if (!props.open) return null
  return <CreateWeddingForm {...props} />
}

function CreateWeddingForm({
  onClose,
  people,
  regions,
}: {
  open: boolean
  onClose: () => void
  people: ComboPerson[]
  regions: string[]
}) {
  const toast = useToast()
  const utils = trpc.useUtils()
  const navigate = useNavigate()
  const [host, setHost] = useState<ComboPerson | null>(null)
  const [freeHost, setFreeHost] = useState(false)
  const [hostName, setHostName] = useState('')
  const [date, setDate] = useState<Date | null>(null)
  const [place, setPlace] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [addName, setAddName] = useState('')
  const [error, setError] = useState('')

  /* اسم الفرح يتولّد تلقائيًا من الاسم الأول لصاحب الفرح ويبقى قابلًا للتعديل */
  const pickHost = (p: ComboPerson) => {
    setHost(p)
    setHostName(p.name.trim().split(/\s+/)[0] ?? p.name)
  }

  const create = trpc.events.create.useMutation({
    onSuccess: async (ev) => {
      await Promise.all([utils.events.list.invalidate(), utils.dashboard.stats.invalidate()])
      toast('success', 'اتسجّلت الفرح ✓ — التذكيرات شغالة')
      onClose()
      navigate(`/weddings/${ev.id}`)
    },
    onError: (e) => setError(e.message),
  })

  const valid = (host !== null || hostName.trim().length >= 2) && date !== null

  const submit = () => {
    if (!valid || !date) return
    setError('')
    create.mutate({
      hostPersonId: host ? Number(host.id) : undefined,
      hostName: hostName.trim() || undefined,
      eventDate: date,
      place: place.trim(),
    })
  }

  return (
    <>
      <Modal open onClose={onClose} title="فرحة جديدة" subtitle="افتح دفتر فرح — النقوط هتتسجل عليه" maxWidth="max-w-[560px]">
        <div className="flex flex-col gap-4">
          {/* صاحب الفرح */}
          <div>
            <span className="mb-1.5 block text-[13px] font-medium text-ink-700">صاحب الفرح</span>
            {freeHost ? (
              <div className="flex items-center gap-2">
                <input
                  value={hostName}
                  onChange={(e) => setHostName(e.target.value)}
                  placeholder="اسم صاحب الفرح…"
                  className="h-[52px] flex-1 rounded-[10px] border border-line-strong bg-paper-surface px-4 text-[14px] text-ink-900 placeholder:text-ink-400 focus:border-primary-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    setFreeHost(false)
                    setHostName('')
                  }}
                  className="shrink-0 rounded-[10px] border border-line-strong px-3 py-2 text-[12.5px] text-ink-500 transition-colors hover:bg-primary-50"
                >
                  بحث من الدفتر
                </button>
              </div>
            ) : host ? (
              <div className="flex items-center gap-3 rounded-[10px] border border-primary-300 bg-primary-50 px-3.5 py-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-100 font-kufi font-bold text-[14px] text-primary-700">
                  {host.name.trim().charAt(0)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-kufi font-semibold text-[15px] text-ink-900">{host.name}</span>
                  <span className="num-ltr block text-[12px] text-ink-500">{host.phone}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setHost(null)}
                  className="shrink-0 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-primary-600 transition-colors hover:bg-paper-surface"
                >
                  تغيير
                </button>
              </div>
            ) : (
              <>
                <PersonCombobox
                  people={people}
                  placeholder="دوّر باسم صاحب الفرح أو تليفونه…"
                  onSelect={(p) => pickHost({ id: p.id, name: p.name, phone: p.phone, region: p.region })}
                  onAddNew={(name) => {
                    setAddName(name)
                    setAddOpen(true)
                  }}
                />
                <button
                  type="button"
                  onClick={() => setFreeHost(true)}
                  className="mt-1.5 text-[12px] font-medium text-ink-500 transition-colors hover:text-primary-600"
                >
                  صاحب الفرح مش في دفترك؟ اكتب اسمه نصًا
                </button>
              </>
            )}
          </div>

          {/* اسم الفرح (hostName) */}
          {!freeHost && (
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-ink-700">اسم الفرح</span>
              <div className="flex items-center rounded-[10px] border border-line-strong bg-paper-surface focus-within:border-primary-500">
                <span className="border-e border-line px-3.5 text-[14px] font-medium text-ink-500">فرحة</span>
                <input
                  value={hostName}
                  onChange={(e) => setHostName(e.target.value)}
                  placeholder="كريم وسلمى…"
                  className="h-11 flex-1 rounded-e-[10px] bg-transparent px-3.5 text-[14px] text-ink-900 placeholder:text-ink-400 focus:outline-none"
                />
              </div>
            </label>
          )}

          {/* التاريخ + المكان */}
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
                placeholder="قاعة / نادي / شارع…"
                className="h-11 rounded-[10px] border border-line-strong bg-paper-surface px-3.5 text-[14px] text-ink-900 placeholder:text-ink-400 focus:border-primary-500 focus:outline-none"
              />
            </label>
          </div>

          {/* التذكيرات — تُدار من إعدادات النشاط */}
          <div className="flex items-start gap-3 rounded-xl border border-[#E3D3A3] bg-gold-100/50 px-4 py-3">
            <BellRing className="mt-0.5 size-[18px] shrink-0 text-gold-600" />
            <p className="text-[12.5px] leading-5 text-ink-700">
              <span className="font-semibold">تذكير واتساب اليومي مفعّل</span> — هيبدأ قبل الفرح بـ {toArabicDigits(3)} أيام ويتبعت 9:00 ص لصاحب الفرح والمدعوين المسجلين. يتظبط من صفحة الإعدادات.
            </p>
          </div>

          {error && <p className="rounded-lg bg-redink-bg px-3 py-2 text-[12.5px] text-redink">{error}</p>}

          <div className="flex items-center gap-2.5 border-t border-line pt-4">
            <button
              type="button"
              disabled={!valid || create.isPending}
              onClick={submit}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-[10px] bg-primary-500 px-4 py-2.5 text-[14px] font-semibold text-[#FFFDF8] transition-all hover:bg-primary-600 active:scale-[0.97] disabled:opacity-50"
            >
              <CalendarPlus className="size-4" />
              {create.isPending ? 'بيتعمل…' : 'إنشاء الفرح'}
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

      <QuickAddPersonModal
        open={addOpen}
        initialName={addName}
        regions={regions}
        onClose={() => setAddOpen(false)}
        onCreated={(p: Person) => pickHost({ id: String(p.id), name: p.name, phone: p.phone, region: p.region })}
        subtitle="هيتسجّل في الدفتر ويتحدد كصاحب الفرح"
      />
    </>
  )
}

/* ═══════════ الصفحة ═══════════ */

function WeddingsInner() {
  const toast = useToast()
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('date')
  const [createOpen, setCreateOpen] = useState(false)
  /* تقرير جاهز لكن المتصفح حجب الفتح التلقائي — بطاقة دائمة حتى يفتحه المستخدم */
  const [readyReport, setReadyReport] = useState<{ id: number; fileUrl: string; hostName: string } | null>(null)

  const eventsQ = trpc.events.list.useQuery({ filter: 'all' })
  const personsQ = trpc.persons.list.useQuery()
  const reportsQ = trpc.reports.list.useQuery()
  const recentQ = trpc.nuqtat.listRecent.useQuery({ limit: 50 })

  const events = useMemo(() => eventsQ.data ?? [], [eventsQ.data])
  const reportedEventIds = useMemo(() => new Set((reportsQ.data ?? []).map((r) => r.eventId)), [reportsQ.data])
  const lateEditedEventIds = useMemo(
    () => new Set((recentQ.data ?? []).filter((n) => n.editedAfterDone).map((n) => n.eventId)),
    [recentQ.data],
  )

  const comboPeople: ComboPerson[] = useMemo(
    () => (personsQ.data ?? []).map((p) => ({ id: String(p.id), name: p.name, phone: p.phone, region: p.region })),
    [personsQ.data],
  )
  const regions = useMemo(
    () => [...new Set((personsQ.data ?? []).map((p) => p.region).filter(Boolean))].sort(),
    [personsQ.data],
  )

  const counts = useMemo(
    () => ({
      all: events.length,
      upcoming: events.filter((e) => e.status === 'upcoming').length,
      done: events.filter((e) => e.status === 'done').length,
    }),
    [events],
  )

  const visible = useMemo(() => {
    let list = filter === 'all' ? events : events.filter((e) => e.status === filter)
    const nq = normalizeArabic(query)
    if (nq) list = list.filter((e) => normalizeArabic(e.hostName).includes(nq) || normalizeArabic(e.place).includes(nq))
    const sorted = [...list]
    if (sort === 'total') sorted.sort((a, b) => b.totalAmount - a.totalAmount)
    else if (sort === 'created') sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    else
      sorted.sort((a, b) => {
        // القادمة أقربها أولًا ثم السابقة أحدثها
        if (a.status !== b.status) return a.status === 'upcoming' ? -1 : 1
        const ta = new Date(a.eventDate).getTime()
        const tb = new Date(b.eventDate).getTime()
        return a.status === 'upcoming' ? ta - tb : tb - ta
      })
    return sorted
  }, [events, filter, query, sort])

  const generateReport = trpc.reports.generate.useMutation({
    onError: (e) => toast('error', e.message || 'مقدرش يولّد التقرير دلوقتي'),
  })

  /**
   * تصدير التقرير — يفتح تبويب الانتظار «متزامنًا» مع الضغطة (قبل أي await)
   * حتى لا تحجبه متصفحات الموبايل، ثم يوجّهه للملف بعد اكتمال التوليد.
   * لو التبويب محجوب أصلًا تظهر بطاقة دائمة برابط فتح/تحميل.
   */
  const handleExportPdf = (target: EventListItem) => {
    const win = openReportWaitingTab()
    setReadyReport(null)
    generateReport.mutate(
      { eventId: target.id },
      {
        onSuccess: (report) => {
          const delivered = deliverReportToTab(win, report.fileUrl)
          if (delivered) {
            toast('success', 'التقرير اتولّد ✓ — بيفتح في التبويب الجديد')
          } else {
            setReadyReport({ id: report.id, fileUrl: report.fileUrl, hostName: target.hostName })
            toast('info', 'المتصفح منع الفتح التلقائي — التقرير جاهز في البطاقة فوق')
          }
        },
        onError: () => abortReportTab(win),
      },
    )
  }

  if (eventsQ.isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-9 w-48" />
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <CardSkeleton key={i} lines={4} />
          ))}
        </div>
      </div>
    )
  }
  if (eventsQ.error) {
    return <ErrorState error={eventsQ.error} onRetry={() => void eventsQ.refetch()} />
  }

  const TABS: { key: Filter; label: string }[] = [
    { key: 'all', label: `الكل (${toArabicDigits(counts.all)})` },
    { key: 'upcoming', label: `قادمة (${toArabicDigits(counts.upcoming)})` },
    { key: 'done', label: `تمت (${toArabicDigits(counts.done)})` },
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* الترويسة */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.38, ease: EASE }}
        className="flex flex-wrap items-center gap-4"
      >
        <div className="flex-1">
          <h2 className="font-kufi font-bold text-[26px] leading-[34px] text-ink-900">الأفراح</h2>
          <p className="mt-0.5 text-[13px] text-ink-500">
            {toArabicDigits(counts.all)} {counts.all === 1 ? 'فرحة' : 'أفراح'} · {toArabicDigits(counts.upcoming)} قادمة
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-2 rounded-[10px] bg-primary-500 px-[18px] py-2.5 text-[14px] font-semibold text-[#FFFDF8] shadow-card transition-all hover:bg-primary-600 hover:-translate-y-px active:scale-[0.97]"
        >
          <CalendarPlus className="size-4" />
          إنشاء فرحة جديدة
        </button>
      </motion.div>

      {/* واجهة احتياطية دائمة لو المتصفح حجب التبويب — تبقى حتى يفتحها المستخدم */}
      <AnimatePresence>
        {readyReport && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-gold-500 bg-gold-100 px-4 py-3 shadow-card"
          >
            <div className="min-w-[220px] flex-1">
              <p className="text-[13.5px] font-bold text-ink-900">التقرير جاهز ✓ — فرحة {readyReport.hostName}</p>
              <p className="mt-0.5 text-[12px] text-ink-500">المتصفح منع الفتح التلقائي في تبويب جديد — اضغط للفتح أو التحميل</p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={readyReport.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary-500 px-4 py-2 text-[12.5px] font-semibold text-[#FFFDF8] transition-colors hover:bg-primary-600"
              >
                <Eye className="size-4" />
                فتح التقرير
              </a>
              <a
                href={readyReport.fileUrl}
                download={reportDownloadName(readyReport.hostName, readyReport.id)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-paper-surface px-4 py-2 text-[12.5px] font-semibold text-ink-700 transition-colors hover:bg-primary-50"
              >
                <FileDown className="size-4" />
                تحميل PDF
              </a>
              <button
                type="button"
                aria-label="إخفاء"
                onClick={() => setReadyReport(null)}
                className="px-2 text-[18px] leading-4 text-ink-400 transition-colors hover:text-ink-700"
              >
                ×
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* شريط الأدوات */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.06, ease: EASE }}
        className="flex flex-wrap items-center gap-3"
      >
        <div className="flex rounded-full bg-paper-sunken p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setFilter(t.key)}
              className={cn(
                'relative rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors',
                filter === t.key ? 'text-ink-900' : 'text-ink-500 hover:text-ink-700',
              )}
            >
              {filter === t.key && (
                <motion.span layoutId="weddings-tab-pill" transition={{ duration: 0.2 }} className="absolute inset-0 rounded-full bg-paper-surface shadow-card" />
              )}
              <span className="relative">{t.label}</span>
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="دوّر باسم صاحب الفرح أو المكان…"
            className="h-10 w-[300px] max-w-full rounded-[10px] border border-line bg-paper-surface ps-9 pe-3 text-[13px] text-ink-900 placeholder:text-ink-400 focus:border-primary-500 focus:outline-none"
          />
        </div>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="ترتيب الأفراح"
          className="h-10 rounded-[10px] border border-line bg-paper-surface px-3 text-[13px] text-ink-700 focus:border-primary-500 focus:outline-none"
        >
          <option value="date">الأقرب تاريخًا</option>
          <option value="total">الأعلى إجماليًا</option>
          <option value="created">الأحدث إنشاءً</option>
        </select>
      </motion.div>

      {/* الشبكة */}
      {events.length === 0 ? (
        <div className="surface-card">
          <EmptyState
            title="لسه مفيش أفراح متسجلة"
            description="أول فرحة تسجلها هتفتح دفتر جديد — وبعدين تقدر تسجّل نقوطها وتطلّع تقريرها"
            actionLabel="إنشاء فرحة"
            onAction={() => setCreateOpen(true)}
          />
        </div>
      ) : visible.length === 0 ? (
        <div className="surface-card">
          <EmptyState
            image="/empty-search.svg"
            title="مفيش نتائج مطابقة"
            description="جرّب اسمًا تانيًا أو غيّر الفلتر — البحث بيطابق اسم صاحب الفرح والمكان"
          />
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {visible.map((ev, i) => (
              <WeddingCard
                key={ev.id}
                ev={ev}
                index={i}
                hasReport={reportedEventIds.has(ev.id)}
                hasLateEdits={lateEditedEventIds.has(ev.id)}
                exporting={generateReport.isPending}
                onExportPdf={handleExportPdf}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      <CreateWeddingModal open={createOpen} onClose={() => setCreateOpen(false)} people={comboPeople} regions={regions} />
    </div>
  )
}

export default function Weddings() {
  return (
    <ToastProvider>
      <WeddingsInner />
    </ToastProvider>
  )
}
