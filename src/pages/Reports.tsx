import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  BookOpen,
  CalendarHeart,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileDown,
  FileText,
  ListOrdered,
  Maximize,
  Minus,
  Plus,
  RotateCw,
  Users,
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatArabicDate, formatMoney, toArabicDigits } from '@/lib/format'
import { abortReportTab, deliverReportToTab, openReportWaitingTab, reportDownloadName } from '@/lib/open-report'
import EmptyState from '@/components/EmptyState'
import { AuthErrorState, isAuthError } from '@/components/AuthErrorBoundary'
import { trpc } from '@/providers/trpc'

/**
 * التقارير (reports.md) — توليد تقرير PDF رسمي لصاحب الفرح:
 * لوحة إنشاء (اختيار الفرح + خيارات + زر ذهبي بخطوات تقدم) · معاينة حية
 * بصرية لبنية التقرير (غلاف / فهرس مناطق بروابط داخلية / صفحة لكل منطقة)
 * على مسرح داكن بمقاس A4 · سجل التقارير المولدة مع فتح/تحميل الملف.
 */

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number]

interface EventItem {
  id: number
  hostName: string
  eventDate: Date
  status: 'upcoming' | 'done'
  place: string
  nuqtatCount: number
  totalAmount: number
  payersCount: number
}

interface ReportRow {
  id: number
  tenantId: number
  eventId: number
  issuedAt: Date
  fileUrl: string
  createdAt: Date
}

interface NuqtaItem {
  id: number
  payerPersonId: number
  payerName: string
  payerRegion: string
  payerPhone: string
  amount: number
  invitedBy: string
}

interface RegionGroup {
  name: string
  persons: { id: number; name: string; phone: string; amount: number; marks: number }[]
  total: number
}

/** تجميع النقوط حسب المنطقة (تنازليًا بعدد الأشخاص) أو أبجديًا */
function buildRegions(nuqtat: NuqtaItem[], groupByRegion: boolean): RegionGroup[] {
  const byRegion = new Map<string, Map<number, { id: number; name: string; phone: string; amount: number; marks: number }>>()
  for (const n of nuqtat) {
    const region = n.payerRegion?.trim() || 'بدون منطقة'
    if (!byRegion.has(region)) byRegion.set(region, new Map())
    const persons = byRegion.get(region)!
    const p = persons.get(n.payerPersonId) ?? {
      id: n.payerPersonId,
      name: n.payerName,
      phone: n.payerPhone,
      amount: 0,
      marks: 0,
    }
    p.amount += n.amount
    p.marks += 1
    persons.set(n.payerPersonId, p)
  }
  const groups: RegionGroup[] = [...byRegion.entries()].map(([name, persons]) => {
    const list = [...persons.values()].sort((a, b) => b.amount - a.amount)
    return { name, persons: list, total: list.reduce((s, p) => s + p.amount, 0) }
  })
  if (!groupByRegion) {
    const all = groups.flatMap((g) => g.persons).sort((a, b) => a.name.localeCompare(b.name, 'ar'))
    return [{ name: 'كل المدعوين (أبجديًا)', persons: all, total: all.reduce((s, p) => s + p.amount, 0) }]
  }
  return groups.sort((a, b) => b.persons.length - a.persons.length || b.total - a.total)
}

const GEN_STEPS = ['بنجهّز الغلاف…', 'بنرتب المناطق…', 'بنكتب صفحات الأشخاص…', 'بنركّب الروابط الداخلية…']

/* ─── لوحة الإنشاء (يمين) ─── */
function CreatePanel({
  events,
  selectedId,
  onSelect,
  options,
  setOptions,
  scribeName,
  setScribeName,
  signature,
  setSignature,
  onGenerate,
  generating,
  genError,
}: {
  events: EventItem[]
  selectedId: number | null
  onSelect: (id: number) => void
  options: { groupByRegion: boolean; includeHistory: boolean; showPhones: boolean; showMarks: boolean }
  setOptions: (o: Partial<{ groupByRegion: boolean; includeHistory: boolean; showPhones: boolean; showMarks: boolean }>) => void
  scribeName: string
  setScribeName: (s: string) => void
  signature: string
  setSignature: (s: string) => void
  onGenerate: () => void
  generating: boolean
  genError: string | null
}) {
  const [stepIdx, setStepIdx] = useState(0)

  // خطوات التوليد المتتالية (0.4s لكل خطوة) أثناء الـ mutation
  useEffect(() => {
    if (!generating) return
    const t = setInterval(() => setStepIdx((s) => (s + 1) % GEN_STEPS.length), 400)
    return () => clearInterval(t)
  }, [generating])

  const optRows: { key: 'groupByRegion' | 'includeHistory' | 'showPhones' | 'showMarks'; label: string }[] = [
    { key: 'groupByRegion', label: 'تجميع حسب المناطق (إلغاؤه = فهرس أبجدي)' },
    { key: 'includeHistory', label: 'تضمين تاريخ النقوط السابقة مع صاحب الفرح' },
    { key: 'showPhones', label: 'إظهار أرقام التليفون' },
    { key: 'showMarks', label: 'إظهار علامات / للتفاعلات' },
  ]

  return (
    <motion.aside
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.38, ease: EASE }}
      className="surface-card self-start p-5 lg:sticky lg:top-24"
    >
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-[10px] bg-gold-100 text-gold-600">
          <FileText className="size-5" />
        </span>
        <div>
          <h3 className="font-kufi font-semibold text-[16px] text-ink-900">تقرير جديد</h3>
          <p className="text-[12px] text-ink-500">اختار الفرح وولّد PDF رسمي لصاحبها</p>
        </div>
      </div>

      {/* اختيار الفرح */}
      <div className="mt-4">
        <div className="mb-2 text-[13px] font-semibold text-ink-700">الفرح</div>
        <div className="max-h-[260px] space-y-2 overflow-y-auto pe-1">
          {events.map((e) => {
            const active = e.id === selectedId
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => onSelect(e.id)}
                className={cn(
                  'relative w-full rounded-xl border p-3 text-start transition-all',
                  active ? 'border-primary-500 bg-primary-50 shadow-card' : 'border-line bg-paper-base hover:bg-primary-50/60',
                )}
              >
                {active && (
                  <motion.span
                    layoutId="report-event-pick"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    className="absolute inset-y-2 start-0 w-[3px] rounded-full bg-primary-500"
                  />
                )}
                <div className="flex items-center justify-between gap-2">
                  <span className="font-kufi text-[13.5px] font-semibold text-ink-900">فرحة {e.hostName}</span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10.5px] font-semibold',
                      e.status === 'done' ? 'bg-paper-sunken text-ink-500' : 'bg-gold-100 text-gold-600',
                    )}
                  >
                    {e.status === 'done' ? 'تمت' : 'قادمة'}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11.5px] text-ink-500">
                  <span>{formatArabicDate(new Date(e.eventDate))}</span>
                  <span>·</span>
                  <span className="num-ltr">{toArabicDigits(e.nuqtatCount)} نقطة</span>
                  <span>·</span>
                  <span className="num-ltr">{formatMoney(e.totalAmount)} ج.م</span>
                </div>
              </button>
            )
          })}
          {events.length === 0 && (
            <p className="rounded-lg bg-paper-sunken px-3 py-3 text-[12.5px] text-ink-500">لسه مفيش أفراح — سجّل أول فرحة من صفحة الأفراح.</p>
          )}
        </div>
      </div>

      {/* خيارات التقرير */}
      <div className="mt-4 border-t border-line pt-4">
        <div className="mb-2 text-[13px] font-semibold text-ink-700">خيارات التقرير</div>
        <div className="space-y-2.5">
          {optRows.map((o) => (
            <label key={o.key} className="flex cursor-pointer items-center gap-2.5 text-[12.5px] font-medium text-ink-700">
              <input
                type="checkbox"
                checked={options[o.key]}
                onChange={(e) => setOptions({ [o.key]: e.target.checked })}
                className="size-4 accent-[#A87438]"
              />
              {o.label}
            </label>
          ))}
        </div>
        <div className="mt-3 space-y-2.5">
          <label className="block text-[12px] font-semibold text-ink-500">
            اسم الكاتب على الغلاف
            <input
              value={scribeName}
              onChange={(e) => setScribeName(e.target.value)}
              className="mt-1 h-10 w-full rounded-[10px] border border-line bg-paper-base px-3 text-[13px] font-normal text-ink-900 focus:border-line-strong focus:outline-none"
            />
          </label>
          <label className="block text-[12px] font-semibold text-ink-500">
            التوقيع
            <input
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              className="mt-1 h-10 w-full rounded-[10px] border border-line bg-paper-base px-3 font-ruqaa text-[15px] text-ink-900 focus:border-line-strong focus:outline-none"
            />
          </label>
        </div>
      </div>

      {/* زر التوليد الذهبي */}
      <motion.button
        type="button"
        whileTap={{ scale: 0.97 }}
        onClick={() => {
          setStepIdx(0)
          onGenerate()
        }}
        disabled={selectedId == null || generating}
        className="relative mt-4 inline-flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-[10px] bg-gold-500 text-[15px] font-bold text-[#3A2E10] shadow-card transition-colors hover:bg-[#cfaa4e] disabled:opacity-60"
      >
        {generating && (
          <motion.span
            className="absolute inset-y-0 start-0 bg-[#3A2E10]/10"
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 6, ease: 'linear' }}
          />
        )}
        <FileText className="relative size-5" />
        <span className="relative">{generating ? 'بنولّد التقرير…' : 'توليد PDF'}</span>
      </motion.button>
      <p className="mt-2 text-center text-[11.5px] text-ink-400">هيتولد PDF تفاعلي — الروابط الداخلية شغالة</p>

      <AnimatePresence>
        {generating && (
          <motion.ol
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 space-y-1.5 overflow-hidden"
          >
            {GEN_STEPS.map((s, i) => (
              <li key={s} className="flex items-center gap-2 text-[12px] text-ink-500">
                <span
                  className={cn(
                    'flex size-4 items-center justify-center rounded-full border text-[10px]',
                    i <= stepIdx ? 'border-laha-solid bg-laha-bg text-laha-text' : 'border-line text-ink-400',
                  )}
                >
                  {i < stepIdx ? <Check className="size-3" /> : i === stepIdx ? (
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
                      className="size-2.5 rounded-full border border-laha-solid border-t-transparent"
                    />
                  ) : (
                    i + 1
                  )}
                </span>
                <span className={cn(i <= stepIdx && 'font-semibold text-ink-700')}>{s}</span>
              </li>
            ))}
          </motion.ol>
        )}
        {genError && (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-3 rounded-lg bg-redink-bg px-3 py-2 text-[12.5px] font-semibold text-redink"
          >
            {genError}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.aside>
  )
}

/* ─── صفحات المعاينة (مقاس تصميم ثابت 794×1123 = A4) ─── */

const PAGE_W = 794
const PAGE_H = 1123

function CoverPage({ event, scribeName, signature }: { event: EventItem; scribeName: string; signature: string }) {
  return (
    <div className="relative flex h-full flex-col items-center overflow-hidden bg-[#FBF7EE] px-16 py-14 text-center">
      <img src="/pdf-cover-frame.svg" alt="" className="pointer-events-none absolute inset-0 h-full w-full" draggable={false} />
      <div className="relative z-10 flex h-full w-full flex-col items-center">
        <img src="/pattern-egyptian.svg" alt="" className="h-10 w-40 opacity-60" draggable={false} />
        <h2 className="mt-10 font-kufi text-[30px] font-bold text-primary-700">{scribeName}</h2>
        <img src="/ornament-divider.svg" alt="" className="mt-6 h-6 w-72" draggable={false} />
        <p className="mt-8 text-[14px] font-semibold text-ink-500">تقرير نقوط</p>
        <h1 className="mt-3 font-kufi text-[40px] font-bold leading-[1.35] text-ink-900">فرحة {event.hostName}</h1>
        <p className="mt-4 text-[15px] text-ink-700">
          {formatArabicDate(new Date(event.eventDate))}
          {event.place ? ` — ${event.place}` : ''}
        </p>
        <p className="mt-8 text-[14px] text-ink-500">
          إهداء إلى صاحب الفرح: <span className="font-kufi font-bold text-ink-900">{event.hostName}</span>
        </p>
        <div className="mt-auto flex w-full items-end justify-between">
          <div className="text-[12.5px] text-ink-500">
            تاريخ الإصدار:
            <br />
            <span className="font-semibold text-ink-700">{formatArabicDate(new Date())}</span>
          </div>
          <div className="relative flex flex-col items-center">
            <img src="/logo.svg" alt="" className="absolute -top-8 size-20 opacity-30" draggable={false} />
            <motion.span
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.9, ease: EASE }}
              className="relative font-ruqaa text-[26px] text-primary-700"
            >
              {signature}
            </motion.span>
          </div>
        </div>
      </div>
    </div>
  )
}

function IndexPage({
  regions,
  event,
  pageOf,
  onGoTo,
  scribeName,
}: {
  regions: RegionGroup[]
  event: EventItem
  pageOf: (regionIdx: number) => number
  onGoTo: (page: number) => void
  scribeName: string
}) {
  const totalPersons = regions.reduce((s, r) => s + r.persons.length, 0)
  return (
    <div className="relative flex h-full flex-col bg-[#FBF7EE] px-14 py-12">
      <img src="/pattern-egyptian.svg" alt="" className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.35]" draggable={false} />
      <div className="relative z-10">
        <h2 className="font-kufi text-[24px] font-bold text-ink-900">الفهرس — المناطق</h2>
        <div className="mt-2 h-[3px] w-24 rounded-full bg-gold-500" />
        <p className="mt-2 text-[12.5px] text-ink-500">فرحة {event.hostName} — أرقام الصفحات روابط داخلية (دوس عليها في المعاينة)</p>

        <ol className="mt-8 space-y-3.5">
          {regions.map((r, i) => (
            <li key={r.name} className="flex items-baseline gap-3 text-[15px]">
              <span className="font-kufi font-bold text-primary-700">{r.name}</span>
              <span className="mx-1 flex-1 border-b-2 border-dotted border-line-strong" />
              <span className="text-[12.5px] text-ink-500">
                {toArabicDigits(r.persons.length)} {r.persons.length === 1 ? 'شخص' : 'أشخاص'}
              </span>
              <button
                type="button"
                onClick={() => onGoTo(pageOf(i))}
                className="rounded-md px-2 py-0.5 font-kufi text-[14px] font-bold text-gold-600 underline decoration-gold-500/50 underline-offset-4 transition-colors hover:bg-gold-100 hover:decoration-gold-500"
              >
                صفحة {toArabicDigits(pageOf(i))}
              </button>
            </li>
          ))}
          {regions.length === 0 && <li className="text-[13px] text-ink-400">لا توجد نقوط مسجلة بعد لهذه الفرحة.</li>}
        </ol>

        <div className="mt-10 rounded-xl border border-line bg-paper-surface/80 p-4 text-[13px] text-ink-700">
          <span className="font-semibold">الملخص:</span> إجمالي الأشخاص: <span className="num-ltr font-bold">{totalPersons}</span> ·
          إجمالي النقوط: <span className="num-ltr font-bold">{formatMoney(event.totalAmount)} ج.م</span> · عدد المناطق:{' '}
          <span className="num-ltr font-bold">{regions.length}</span>
        </div>
      </div>
      <div className="relative z-10 mt-auto flex items-center justify-between text-[11.5px] text-ink-400">
        <span>{scribeName}</span>
        <span className="num-ltr">2</span>
      </div>
    </div>
  )
}

function RegionPage({
  region,
  pageNum,
  totalPages,
  scribeName,
  showPhones,
  showMarks,
  includeHistory,
}: {
  region: RegionGroup
  pageNum: number
  totalPages: number
  scribeName: string
  showPhones: boolean
  showMarks: boolean
  includeHistory: boolean
}) {
  return (
    <div className="relative flex h-full flex-col bg-[#FBF7EE] px-12 py-10">
      <img src="/pattern-egyptian.svg" alt="" className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.35]" draggable={false} />
      <div className="relative z-10">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-kufi text-[22px] font-bold text-ink-900">منطقة {region.name}</h2>
          <span className="rounded-full bg-gold-100 px-3 py-1 text-[12px] font-semibold text-gold-600">
            {toArabicDigits(region.persons.length)} {region.persons.length === 1 ? 'شخص' : 'أشخاص'} — إجمالي{' '}
            <span className="num-ltr">{formatMoney(region.total)}</span> ج.م
          </span>
        </div>
        <div className="mt-2 h-[3px] w-16 rounded-full bg-gold-500" />

        <table className="mt-6 w-full border-collapse text-[12.5px]">
          <thead>
            <tr className="bg-[#F1EADA] text-[11.5px] font-semibold text-ink-700">
              <th className="border border-line px-2.5 py-2 text-start">#</th>
              <th className="border border-line px-2.5 py-2 text-start">الاسم</th>
              {showPhones && <th className="border border-line px-2.5 py-2 text-start">التليفون</th>}
              <th className="border border-line px-2.5 py-2 text-start">نقطة الفرح دي</th>
              {showMarks && <th className="border border-line px-2.5 py-2 text-start">مرات</th>}
              {includeHistory && <th className="border border-line px-2.5 py-2 text-start">تاريخ النقوط السابقة</th>}
            </tr>
          </thead>
          <tbody>
            {region.persons.map((p, i) => (
              <tr key={p.id} className="transition-colors hover:bg-[#FAF5EA]">
                <td className="num-ltr border border-line px-2.5 py-2 text-ink-500">{i + 1}</td>
                <td className="border border-line px-2.5 py-2 font-kufi font-semibold text-ink-900">{p.name}</td>
                {showPhones && <td className="num-ltr border border-line px-2.5 py-2 text-ink-700">{p.phone}</td>}
                <td className="num-ltr border border-line px-2.5 py-2 font-bold text-ink-900">{formatMoney(p.amount)} ج.م</td>
                {showMarks && (
                  <td className="border border-line px-2.5 py-2 font-kufi font-bold text-primary-600">
                    {'/'.repeat(Math.min(p.marks, 5))}
                    {p.marks > 5 ? ` ×${p.marks}` : ''}
                  </td>
                )}
                {includeHistory && (
                  <td className="border border-line px-2.5 py-2 text-[11px] font-semibold text-gold-600">— أول مرة</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="relative z-10 mt-auto flex items-center justify-between text-[11.5px] text-ink-400">
        <span>{scribeName}</span>
        <span className="num-ltr">
          {pageNum} / {totalPages}
        </span>
      </div>
    </div>
  )
}

/* ─── مسرح المعاينة الداكن ─── */
const ZOOMS = [0.38, 0.45, 0.62, 0.78, 0.95]

function PreviewStage({
  event,
  nuqtat,
  options,
  scribeName,
  signature,
  fileUrl,
  loading,
}: {
  event: EventItem | null
  nuqtat: NuqtaItem[]
  options: { groupByRegion: boolean; includeHistory: boolean; showPhones: boolean; showMarks: boolean }
  scribeName: string
  signature: string
  fileUrl: string | null
  loading: boolean
}) {
  const [page, setPage] = useState(0)
  const [dir, setDir] = useState(1)
  // مؤشر في ZOOMS — الافتراضي 62% (38% على الموبايل عشان المعاينة تدخل الشاشة كلها)
  const [zoom, setZoom] = useState(() => (typeof window !== 'undefined' && window.innerWidth < 768 ? 0 : 2))

  const regions = useMemo(() => buildRegions(nuqtat, options.groupByRegion), [nuqtat, options.groupByRegion])
  const totalPages = event ? 2 + regions.length : 0
  const scale = ZOOMS[zoom]

  const goTo = (p: number) => {
    const next = Math.max(0, Math.min(p, totalPages - 1))
    setDir(next >= page ? 1 : -1)
    setPage(next)
  }

  // العودة للغلاف عند تغيير الفرح أو إعادة التجميع
  useEffect(() => {
    setPage(0)
    setDir(-1)
  }, [event?.id, options.groupByRegion])

  // التنقل بالأسهم (RTL: السهم الشمال = الصفحة التالية)
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'ArrowLeft') goTo(page + 1)
      else if (e.key === 'ArrowRight') goTo(page - 1)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, totalPages])

  const pageOf = (regionIdx: number) => 2 + regionIdx + 1 // رقم صفحة المنطقة (1-based)

  const renderPage = () => {
    if (!event) return null
    if (page === 0) return <CoverPage event={event} scribeName={scribeName} signature={signature} />
    if (page === 1) {
      return <IndexPage regions={regions} event={event} pageOf={pageOf} onGoTo={(p) => goTo(p - 1)} scribeName={scribeName} />
    }
    const region = regions[page - 2]
    if (!region) return null
    return (
      <RegionPage
        region={region}
        pageNum={page + 1}
        totalPages={totalPages}
        scribeName={scribeName}
        showPhones={options.showPhones}
        showMarks={options.showMarks}
        includeHistory={options.includeHistory}
      />
    )
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, delay: 0.08, ease: EASE }}
      className="overflow-hidden rounded-xl border border-line shadow-card"
    >
      {/* المسرح الداكن */}
      <div className="relative flex min-h-[420px] items-start justify-center overflow-auto bg-[#3A3026] p-3 md:min-h-[520px] md:p-10">
        {!event ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <img src="/pdf-cover-frame.svg" alt="" className="w-[240px] opacity-25" draggable={false} />
            <p className="mt-5 max-w-[320px] text-[13.5px] font-medium text-[#C9BFA9]">
              اختار فرحة من اللوحة — وهتشوف معاينة بنية التقرير هنا
            </p>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="h-[400px] w-[283px] animate-pulse rounded-md bg-[#4a3f32]" />
            <p className="mt-4 text-[12.5px] text-[#C9BFA9]">بنجهّز المعاينة…</p>
          </div>
        ) : (
          <div style={{ width: PAGE_W * scale, height: PAGE_H * scale }} className="relative shrink-0">
            <AnimatePresence mode="wait" custom={dir}>
              <motion.div
                key={`${event.id}-${page}-${options.groupByRegion}`}
                custom={dir}
                initial={{ opacity: 0, x: dir > 0 ? -60 : 60 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: dir > 0 ? 60 : -60 }}
                transition={{ duration: 0.26, ease: EASE }}
                className="absolute inset-0"
              >
                {/* مقياس الزوم على div داخلي — framer-motion يدير transform العنصر المتحرك ويمسح أي transform ثابت */}
                <div
                  style={{ width: PAGE_W, height: PAGE_H, transform: `scale(${scale})`, transformOrigin: 'top right' }}
                  className="overflow-hidden rounded-[3px] bg-[#FBF7EE] shadow-pop"
                >
                  {renderPage()}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* شريط أدوات المعاينة */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-paper-surface px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="الصفحة السابقة"
            onClick={() => goTo(page - 1)}
            disabled={!event || page <= 0}
            className="flex size-9 items-center justify-center rounded-lg border border-line text-ink-700 transition-colors hover:bg-primary-50 disabled:opacity-40"
          >
            <ChevronRight className="size-4" />
          </button>
          <span className="min-w-[110px] text-center text-[12.5px] font-semibold text-ink-700">
            {event ? `صفحة ${toArabicDigits(page + 1)} من ${toArabicDigits(totalPages)}` : 'لا معاينة'}
          </span>
          <button
            type="button"
            aria-label="الصفحة التالية"
            onClick={() => goTo(page + 1)}
            disabled={!event || page >= totalPages - 1}
            className="flex size-9 items-center justify-center rounded-lg border border-line text-ink-700 transition-colors hover:bg-primary-50 disabled:opacity-40"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="mx-1 h-5 w-px bg-line" />
          <button
            type="button"
            aria-label="تصغير"
            onClick={() => setZoom((z) => Math.max(0, z - 1))}
            disabled={zoom === 0}
            className="flex size-9 items-center justify-center rounded-lg border border-line text-ink-700 transition-colors hover:bg-primary-50 disabled:opacity-40"
          >
            <Minus className="size-4" />
          </button>
          <span className="num-ltr min-w-[44px] text-center text-[12px] font-semibold text-ink-500">{Math.round(scale * 100)}%</span>
          <button
            type="button"
            aria-label="تكبير"
            onClick={() => setZoom((z) => Math.min(ZOOMS.length - 1, z + 1))}
            disabled={zoom === ZOOMS.length - 1}
            className="flex size-9 items-center justify-center rounded-lg border border-line text-ink-700 transition-colors hover:bg-primary-50 disabled:opacity-40"
          >
            <Plus className="size-4" />
          </button>
          <button
            type="button"
            aria-label="ملاءمة العرض"
            onClick={() => setZoom(typeof window !== 'undefined' && window.innerWidth < 768 ? 0 : 2)}
            className="flex size-9 items-center justify-center rounded-lg border border-line text-ink-700 transition-colors hover:bg-primary-50"
          >
            <Maximize className="size-4" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          {fileUrl ? (
            <>
              <a
                href={fileUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-[10px] border border-line-strong bg-paper-surface px-4 py-2 text-[12.5px] font-semibold text-ink-700 transition-colors hover:bg-primary-50"
              >
                <Eye className="size-4" />
                فتح في تبويب
              </a>
              <a
                href={fileUrl}
                target="_blank"
                rel="noreferrer"
                download
                className="inline-flex items-center gap-2 rounded-[10px] bg-gold-500 px-4 py-2 text-[12.5px] font-bold text-[#3A2E10] shadow-card transition-colors hover:bg-[#cfaa4e]"
              >
                <FileDown className="size-4" />
                تنزيل PDF
              </a>
            </>
          ) : (
            <span className="text-[12px] text-ink-400">ولّد التقرير ليظهر رابط التنزيل الحقيقي</span>
          )}
        </div>
      </div>
    </motion.section>
  )
}

/* ───────────────────────── الصفحة الرئيسية ───────────────────────── */

export default function Reports() {
  const utils = trpc.useUtils()
  const eventsQuery = trpc.events.list.useQuery({ filter: 'all' })
  const reportsQuery = trpc.reports.list.useQuery()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [options, setOptionsState] = useState({
    groupByRegion: true,
    includeHistory: true,
    showPhones: true,
    showMarks: false,
  })
  const [scribeName, setScribeName] = useState('أحمد عمر للأفراح')
  const [signature, setSignature] = useState('مع تحيات أحمد عمر')
  const [lastReport, setLastReport] = useState<ReportRow | null>(null)
  /* تقرير جاهز لكن المتصفح حجب الفتح التلقائي — بطاقة دائمة حتى يفتحه المستخدم */
  const [blockedReport, setBlockedReport] = useState<{ id: number; fileUrl: string; hostName: string } | null>(null)

  const events = useMemo(() => (eventsQuery.data ?? []) as EventItem[], [eventsQuery.data])

  // الافتراضي: آخر فرح تمت، وإلا أول فرح (قيمة مشتقة — لا state إضافي)
  const defaultId = useMemo<number | null>(() => {
    const done = events.filter((e) => e.status === 'done')
    return (done[0] ?? events[0])?.id ?? null
  }, [events])
  const effectiveId = selectedId ?? defaultId

  const detailsQuery = trpc.events.get.useQuery(
    { id: effectiveId ?? 0 },
    { enabled: effectiveId != null },
  )

  const generateMut = trpc.reports.generate.useMutation({
    onSuccess: async (report) => {
      setLastReport(report as ReportRow)
      await Promise.all([utils.reports.list.invalidate(), utils.audit.list.invalidate()])
    },
  })

  const selectedEvent = events.find((e) => e.id === effectiveId) ?? null
  const nuqtat = (detailsQuery.data?.nuqtat ?? []) as NuqtaItem[]
  const setOptions = (o: Partial<typeof options>) => setOptionsState((s) => ({ ...s, ...o }))

  const eventName = (id: number) => events.find((e) => e.id === id)?.hostName ?? `#${id}`

  /**
   * توليد التقرير — يفتح تبويب الانتظار «متزامنًا» مع الضغطة (قبل أي await)
   * حتى لا تحجبه متصفحات الموبايل، ثم يوجّهه للملف بعد اكتمال التوليد.
   * لو التبويب محجوب أصلًا تظهر بطاقة دائمة برابط فتح/تحميل (بجانب روابط
   * الفتح/التنزيل الثابتة في شريط المعاينة).
   */
  const generate = (eventId?: number) => {
    const id = eventId ?? effectiveId
    if (id == null) return
    const win = openReportWaitingTab()
    setBlockedReport(null)
    generateMut.mutate(
      { eventId: id },
      {
        onSuccess: (report) => {
          const delivered = deliverReportToTab(win, report.fileUrl)
          if (!delivered) {
            setBlockedReport({ id: report.id, fileUrl: report.fileUrl, hostName: eventName(id) })
          }
        },
        onError: () => abortReportTab(win),
      },
    )
  }

  return (
    <div className="space-y-5">
      {/* الترويسة */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.38, ease: EASE }}
      >
        <h2 className="font-kufi text-[26px] font-bold leading-[34px] text-ink-900">التقارير</h2>
        <p className="mt-1 text-[13px] text-ink-500">تقارير PDF رسمية لصاحب الفرح — غلاف + فهرس مناطق + صفحة لكل منطقة</p>
      </motion.div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-4">
          {eventsQuery.error ? (
            isAuthError(eventsQuery.error) ? (
              <AuthErrorState />
            ) : (
              <div className="surface-card flex flex-col items-center gap-2 p-6 text-center">
                <XCircle className="size-7 text-redink" />
                <p className="text-[12.5px] text-ink-500">{eventsQuery.error.message}</p>
              </div>
            )
          ) : (
            <CreatePanel
              events={events}
              selectedId={effectiveId}
              onSelect={setSelectedId}
              options={options}
              setOptions={setOptions}
              scribeName={scribeName}
              setScribeName={setScribeName}
              signature={signature}
              setSignature={setSignature}
              onGenerate={() => generate()}
              generating={generateMut.isPending}
              genError={generateMut.error?.message ?? null}
            />
          )}
        </div>
        <div className="min-w-0 space-y-3 lg:col-span-8">
          {/* واجهة احتياطية دائمة لو المتصفح حجب التبويب — تبقى حتى يفتحها المستخدم */}
          <AnimatePresence>
            {blockedReport && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.3, ease: EASE }}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-gold-500 bg-gold-100 px-4 py-3 shadow-card"
              >
                <div className="min-w-[220px] flex-1">
                  <p className="text-[13.5px] font-bold text-ink-900">التقرير جاهز ✓ — فرحة {blockedReport.hostName}</p>
                  <p className="mt-0.5 text-[12px] text-ink-500">المتصفح منع الفتح التلقائي في تبويب جديد — اضغط للفتح أو التحميل</p>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={blockedReport.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary-500 px-4 py-2 text-[12.5px] font-semibold text-[#FFFDF8] transition-colors hover:bg-primary-600"
                  >
                    <Eye className="size-4" />
                    فتح التقرير
                  </a>
                  <a
                    href={blockedReport.fileUrl}
                    download={reportDownloadName(blockedReport.hostName, blockedReport.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-paper-surface px-4 py-2 text-[12.5px] font-semibold text-ink-700 transition-colors hover:bg-primary-50"
                  >
                    <FileDown className="size-4" />
                    تحميل PDF
                  </a>
                  <button
                    type="button"
                    aria-label="إخفاء"
                    onClick={() => setBlockedReport(null)}
                    className="px-2 text-[18px] leading-4 text-ink-400 transition-colors hover:text-ink-700"
                  >
                    ×
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <PreviewStage
            event={selectedEvent}
            nuqtat={nuqtat}
            options={options}
            scribeName={scribeName}
            signature={signature}
            fileUrl={lastReport?.fileUrl || null}
            loading={detailsQuery.isLoading && effectiveId != null}
          />
          {/* شرح بنية التقرير */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
            className="grid gap-2.5 sm:grid-cols-3"
          >
            {[
              { icon: BookOpen, title: 'غلاف رسمي', desc: 'إطار مزخرف + ختم وتوقيع الكاتب' },
              { icon: ListOrdered, title: 'فهرس مناطق تفاعلي', desc: 'أرقام الصفحات روابط داخلية شغالة' },
              { icon: Users, title: 'صفحة لكل منطقة', desc: 'الأشخاص ومبالغهم وتاريخهم مع صاحب الفرح' },
            ].map((c) => {
              const Icon = c.icon
              return (
                <div key={c.title} className="surface-card flex items-start gap-2.5 p-3.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gold-100 text-gold-600">
                    <Icon className="size-4" />
                  </span>
                  <div>
                    <div className="text-[12.5px] font-bold text-ink-900">{c.title}</div>
                    <div className="text-[11.5px] leading-4 text-ink-500">{c.desc}</div>
                  </div>
                </div>
              )
            })}
          </motion.div>
        </div>
      </div>

      {/* سجل التقارير المولدة */}
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.38, delay: 0.1, ease: EASE }}
        className="surface-card overflow-hidden"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h3 className="font-kufi font-semibold text-[16px] text-ink-900">سجل التقارير المولدة</h3>
          <span className="num-ltr text-[12px] text-ink-500">{toArabicDigits(reportsQuery.data?.length ?? 0)} تقرير</span>
        </div>
        {reportsQuery.isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-paper-sunken" />
            ))}
          </div>
        ) : reportsQuery.error ? (
          isAuthError(reportsQuery.error) ? (
            <AuthErrorState className="border-0 shadow-none" />
          ) : (
            <div className="flex flex-col items-center gap-2 p-8 text-center">
              <XCircle className="size-7 text-redink" />
              <p className="text-[12.5px] text-ink-500">{reportsQuery.error.message}</p>
            </div>
          )
        ) : (reportsQuery.data ?? []).length === 0 ? (
          <EmptyState
            image="/empty-ledger.svg"
            title="لسه مفيش تقارير مولدة"
            description="اختار فرحة من اللوحة واضغط «توليد PDF» — وأول تقرير هيظهر هنا."
          />
        ) : (
          <>
          {/* الجدول — شاشات متوسطة فأكبر */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-[13.5px] leading-[22px]">
              <thead>
                <tr className="bg-[#F1EADA]">
                  <th className="px-4 py-3 text-start text-[12px] font-semibold text-ink-700">التقرير</th>
                  <th className="px-4 py-3 text-start text-[12px] font-semibold text-ink-700">الفرح</th>
                  <th className="px-4 py-3 text-start text-[12px] font-semibold text-ink-700">تاريخ التوليد</th>
                  <th className="px-4 py-3 text-end text-[12px] font-semibold text-ink-700">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {(reportsQuery.data ?? []).map((r, i) => (
                  <motion.tr
                    key={r.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: Math.min(i, 10) * 0.04, ease: EASE }}
                    className="border-t border-line transition-colors hover:bg-[#FAF5EA]"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-2 font-kufi font-semibold text-ink-900">
                        <FileText className="size-4 text-primary-600" />
                        تقرير #{r.id}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 text-ink-700">
                        <CalendarHeart className="size-4 text-gold-600" />
                        فرحة {eventName(r.eventId)}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-ink-500">{formatArabicDate(new Date(r.issuedAt))}</td>
                    <td className="px-4 py-3 text-end whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <a
                          href={r.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          aria-label="معاينة التقرير في تبويب جديد"
                          className="inline-flex size-8 items-center justify-center rounded-lg border border-line text-ink-500 transition-colors hover:bg-primary-50 hover:text-primary-600"
                        >
                          <Eye className="size-4" />
                        </a>
                        <a
                          href={r.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          download
                          aria-label="تنزيل التقرير"
                          className="inline-flex size-8 items-center justify-center rounded-lg border border-line text-ink-500 transition-colors hover:bg-gold-100 hover:text-gold-600"
                        >
                          <FileDown className="size-4" />
                        </a>
                        <button
                          type="button"
                          aria-label="إعادة توليد"
                          onClick={() => generate(r.eventId)}
                          disabled={generateMut.isPending}
                          className="inline-flex size-8 items-center justify-center rounded-lg border border-line text-ink-500 transition-colors hover:bg-redink-bg hover:text-redink disabled:opacity-40"
                        >
                          <RotateCw className="size-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* بطاقات مكدسة — موبايل (< 768px) */}
          <ul className="divide-y divide-line md:hidden">
            {(reportsQuery.data ?? []).map((r, i) => (
              <motion.li
                key={r.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(i, 10) * 0.04, ease: EASE }}
                className="px-4 py-3.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex min-w-0 items-center gap-2 font-kufi font-semibold text-ink-900">
                    <FileText className="size-4 shrink-0 text-primary-600" />
                    <span className="truncate">تقرير #{r.id} — فرحة {eventName(r.eventId)}</span>
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2 text-[12px] text-ink-500">
                  <CalendarHeart className="size-3.5 text-gold-600" />
                  {formatArabicDate(new Date(r.issuedAt))}
                  <span className="ms-auto flex items-center gap-1.5">
                    <a
                      href={r.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="معاينة التقرير في تبويب جديد"
                      className="inline-flex size-8 items-center justify-center rounded-lg border border-line text-ink-500 transition-colors hover:bg-primary-50 hover:text-primary-600"
                    >
                      <Eye className="size-4" />
                    </a>
                    <a
                      href={r.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      download
                      aria-label="تنزيل التقرير"
                      className="inline-flex size-8 items-center justify-center rounded-lg border border-line text-ink-500 transition-colors hover:bg-gold-100 hover:text-gold-600"
                    >
                      <FileDown className="size-4" />
                    </a>
                    <button
                      type="button"
                      aria-label="إعادة توليد"
                      onClick={() => generate(r.eventId)}
                      disabled={generateMut.isPending}
                      className="inline-flex size-8 items-center justify-center rounded-lg border border-line text-ink-500 transition-colors hover:bg-redink-bg hover:text-redink disabled:opacity-40"
                    >
                      <RotateCw className="size-4" />
                    </button>
                  </span>
                </div>
              </motion.li>
            ))}
          </ul>
          </>
        )}
      </motion.section>
    </div>
  )
}
