/**
 * لوحة التحكم الرئيسية — dashboard.md: نظرة شاملة في ٥ ثوانٍ.
 * كل البيانات حية من tRPC: dashboard.stats + events.list + nuqtat.listRecent
 * + balances.matrix + persons.list + reports.list.
 */
import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  Banknote,
  BellRing,
  CalendarHeart,
  CalendarPlus,
  Check,
  CheckCheck,
  CircleArrowOutDownLeft,
  CircleArrowOutUpRight,
  FileText,
  Lightbulb,
  MapPin,
  Moon,
  NotebookPen,
  Share2,
  Sun,
  Users,
} from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { trpc } from '@/providers/trpc'
import StatCard from '@/components/StatCard'
import DataTable from '@/components/DataTable'
import type { Column } from '@/components/DataTable'
import BalanceChip from '@/components/BalanceChip'
import InteractionMarks from '@/components/InteractionMarks'
import EmptyState from '@/components/EmptyState'
import { cn } from '@/lib/utils'
import { formatArabicDate, formatMoney, greeting, toArabicDigits } from '@/lib/format'
import type { BalanceRow, EventListItem } from '@contracts/afrah'
import { ErrorState, Skeleton, ToastProvider } from '@/pages/grp-kit'
import { copyText, daysLeftLabel, daysUntil, EASE, timeAgo, useToast } from '@/pages/grp-utils'

const AR_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
const AVATAR_TONES = ['bg-primary-100 text-primary-700', 'bg-gold-100 text-gold-600', 'bg-laha-bg text-laha-text']

interface MonthlyPoint {
  month: string
  amount: number
  count: number
  current: boolean
}

/* ═══════════ ٢. ترويسة الترحيب ═══════════ */
function WelcomeHeader({ upcomingCount, next }: { upcomingCount: number; next: EventListItem | null }) {
  const isMorning = greeting() === 'صباح الخير'
  const GreetIcon = isMorning ? Sun : Moon

  return (
    <div className="relative overflow-hidden rounded-xl">
      <div className="pattern-festive pointer-events-none absolute inset-0 opacity-[0.04]" aria-hidden />
      <div className="relative flex flex-wrap items-center gap-4 py-2">
        <div className="min-w-[260px] flex-1">
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="flex items-center gap-2.5 font-kufi text-[26px] font-bold leading-[34px] text-ink-900"
          >
            {greeting()} يا كاتب
            <GreetIcon className="size-5 text-gold-500" strokeWidth={2.2} />
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.07, ease: EASE }}
            className="mt-1 text-[13px] text-ink-500"
          >
            النهارده {formatArabicDate(new Date())} ·{' '}
            {upcomingCount > 0 ? `عندك ${toArabicDigits(upcomingCount)} ${upcomingCount === 1 ? 'فرحة' : upcomingCount === 2 ? 'فرحتين' : 'أفراح'} قدامك` : 'مفيش أفراح قادمة حاليًا'}
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.14, ease: EASE }}
          className="flex flex-wrap items-center gap-3"
        >
          <Link
            to="/nuqta/new"
            className="inline-flex items-center gap-2 rounded-[10px] bg-primary-500 px-[22px] py-3 text-[15px] font-semibold text-[#FFFDF8] shadow-card transition-all hover:-translate-y-px hover:bg-primary-600 active:scale-[0.97] active:bg-primary-700"
          >
            <NotebookPen className="size-4" />
            تسجيل نقطة
          </Link>
          <Link
            to="/weddings"
            className="inline-flex items-center gap-2 rounded-[10px] border border-line-strong bg-transparent px-[18px] py-3 text-[14px] font-medium text-ink-700 transition-colors hover:bg-primary-50"
          >
            <CalendarPlus className="size-4" />
            إنشاء فرحة
          </Link>
          {next && (
            <motion.div initial={{ scale: 1 }} animate={{ scale: [1, 1.04, 1] }} transition={{ delay: 0.8, duration: 0.5 }}>
              <Link
                to={`/weddings/${next.id}`}
                className="inline-flex items-center gap-2 rounded-full border border-[#E3D3A3] bg-gold-100 px-4 py-2.5 text-[13px] font-medium text-gold-600 transition-colors hover:bg-[#F0E2BC]"
              >
                <CalendarHeart className="size-3.5" />
                فرحة {next.hostName} {daysLeftLabel(daysUntil(new Date(next.eventDate)))}
              </Link>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  )
}

/* ═══════════ ٤. الأفراح القادمة ═══════════ */
function UpcomingWeddings({ events }: { events: EventListItem[] }) {
  const navigate = useNavigate()
  const shown = events.slice(0, 2)

  return (
    <section className="xl:col-span-7">
      <div className="flex items-end justify-between">
        <div>
          <h3 className="font-kufi text-[20px] font-semibold leading-7 text-ink-900">الأفراح القادمة</h3>
          <img src="/ornament-divider.svg" alt="" className="mt-1 h-3.5 w-40 select-none opacity-60" draggable={false} />
        </div>
        <Link to="/weddings" className="text-[13px] font-medium text-primary-600 transition-colors hover:text-primary-700">
          كل الأفراح ←
        </Link>
      </div>

      {shown.length === 0 ? (
        <div className="surface-card mt-4">
          <EmptyState
            title="مفيش أفراح قادمة"
            description="أول فرحة تسجلها هتظهر هنا بجاهزية التسجيل والعد التنازلي"
            actionLabel="إنشاء فرحة"
            actionHref="/weddings"
          />
        </div>
      ) : (
        <div className="mt-4 grid gap-5 lg:grid-cols-2">
          {shown.map((w, i) => {
            const pct = w.expectedGuests > 0 ? Math.min(100, Math.round((w.payersCount / w.expectedGuests) * 100)) : 0
            return (
              <motion.article
                key={w.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.5, delay: i * 0.12, ease: EASE }}
                className="surface-card group p-5 transition-[border-color,box-shadow] duration-200 hover:border-[#D8C48F] hover:shadow-card-hover"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-100 px-3 py-1 text-[12px] font-semibold text-gold-600">
                    <CalendarHeart className="size-3.5" />
                    {daysLeftLabel(daysUntil(new Date(w.eventDate)))}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-500">
                    <MapPin className="size-3.5" />
                    <span className="max-w-[130px] truncate">{w.place || 'لسه متحددش'}</span>
                  </span>
                </div>

                <h4 className="mt-3 font-kufi text-[20px] font-bold leading-7 text-ink-900">فرحة {w.hostName}</h4>
                <p className="mt-1 flex items-center gap-2 text-[13px] text-ink-500">
                  {formatArabicDate(new Date(w.eventDate))}
                  <span className="rounded-full bg-gold-100 px-2.5 py-0.5 text-[11px] font-semibold text-gold-600">قادمة</span>
                </p>

                {/* شريط جاهزية التسجيل */}
                <div className="mt-4">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="font-medium text-ink-700">جاهزية التسجيل</span>
                    <span className="num-ltr text-ink-500">
                      {w.payersCount}/{w.expectedGuests || '؟'}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-paper-sunken">
                    <motion.div
                      className="h-full rounded-full bg-primary-500"
                      initial={{ width: 0 }}
                      whileInView={{ width: `${pct}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.9, ease: EASE }}
                    />
                  </div>
                </div>

                {/* أرقام مصغرة */}
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-paper-base px-2 py-2">
                    <div className="num-ltr font-kufi text-[16px] font-bold text-laha-text">{w.nuqtatCount}</div>
                    <div className="text-[11px] text-ink-500">نقطة متسجلة</div>
                  </div>
                  <div className="rounded-lg bg-paper-base px-2 py-2">
                    <div className="num-ltr font-kufi text-[16px] font-bold text-partial-text">{formatMoney(w.totalAmount)}</div>
                    <div className="text-[11px] text-ink-500">ج.م حتى الآن</div>
                  </div>
                  <div className="rounded-lg bg-paper-base px-2 py-2">
                    <div className="num-ltr font-kufi text-[16px] font-bold text-primary-600">{w.expectedGuests}</div>
                    <div className="text-[11px] text-ink-500">مدعو متوقع</div>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => navigate(`/nuqta/new?event=${w.id}`)}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-[10px] bg-primary-500 px-4 py-2.5 text-[13.5px] font-semibold text-[#FFFDF8] transition-all hover:-translate-y-px hover:bg-primary-600 active:scale-[0.97]"
                  >
                    <NotebookPen className="size-4" />
                    ابدأ تسجيل النقوط
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(`/weddings/${w.id}`)}
                    className="inline-flex items-center justify-center rounded-[10px] border border-line-strong px-4 py-2.5 text-[13.5px] font-medium text-ink-700 transition-colors hover:bg-primary-50"
                  >
                    تفاصيل الفرح
                  </button>
                  <span
                    title="التذكير اليومي شغال — بيبعت 9 صباحًا قبل الفرح بـ ٣ أيام"
                    className="flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-line text-gold-600"
                  >
                    <BellRing className="size-[18px]" />
                  </span>
                </div>
              </motion.article>
            )
          })}
        </div>
      )}
    </section>
  )
}

/* ═══════════ ٥. نشاط اليوم ═══════════ */
interface RecentNuqtaItem {
  id: number
  eventId: number
  amount: number
  invitedBy: string
  whatsappNotified: boolean
  editedAfterDone: boolean
  createdAt: Date
  payerName: string
  payerRegion: string
  hostName: string
  eventDate: Date
}

function TodayActivity({ items, todayCount }: { items: RecentNuqtaItem[]; todayCount: number }) {
  const shown = items.slice(0, 6)
  return (
    <section className="xl:col-span-5">
      <div className="surface-card flex h-full flex-col p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-kufi text-[17px] font-semibold leading-6 text-ink-900">آخر النقوط المسجلة</h3>
          <span className="rounded-full bg-primary-100 px-2.5 py-0.5 text-[12px] font-semibold text-primary-700">
            اليوم: {toArabicDigits(todayCount)}
          </span>
        </div>

        {shown.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
            <img src="/empty-ledger.svg" alt="" className="w-[130px] select-none opacity-90" draggable={false} />
            <p className="mt-3 text-[13px] text-ink-500">لسه مفيش نقوط متسجلة — ابدأ بتسجيل أول نقطة</p>
            <Link to="/nuqta/new" className="mt-3 text-[13px] font-semibold text-primary-600 hover:text-primary-700">
              تسجيل نقطة ←
            </Link>
          </div>
        ) : (
          <ul className="mt-4 flex flex-1 flex-col gap-1">
            {shown.map((a, i) => (
              <motion.li
                key={a.id}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: i * 0.06, ease: EASE }}
                className={cn('flex items-center gap-3 rounded-lg px-2 py-2', a.editedAfterDone && 'bg-redink-bg')}
              >
                <motion.span
                  initial={{ scale: 0.6 }}
                  whileInView={{ scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ type: 'spring', stiffness: 380, damping: 22, delay: i * 0.06 }}
                  className={cn('flex size-9 shrink-0 items-center justify-center rounded-full font-kufi text-[13px] font-bold', AVATAR_TONES[i % AVATAR_TONES.length])}
                >
                  {a.payerName.trim().charAt(0)}
                </motion.span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] leading-5 text-ink-700">
                    <span className="font-kufi font-semibold text-ink-900">{a.payerName}</span> سجّل{' '}
                    <span className="num-ltr font-bold text-ink-900">{formatMoney(a.amount)} ج.م</span> في فرحة {a.hostName}
                  </p>
                  <p className="text-[11.5px] text-ink-400">{timeAgo(new Date(a.createdAt))}</p>
                </div>
                {a.editedAfterDone ? (
                  <span className="shrink-0 rounded-full bg-redink px-2.5 py-0.5 text-[11px] font-semibold text-[#FFFDF8]">تصحيح</span>
                ) : a.whatsappNotified ? (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-whatsapp-bg px-2.5 py-0.5 text-[11px] font-medium text-whatsapp">
                    <Check className="size-3" strokeWidth={3} />
                    اتبعت
                  </span>
                ) : (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-open-bg px-2.5 py-0.5 text-[11px] text-open-text">
                    <CheckCheck className="size-3 opacity-60" />
                    قيد الإرسال
                  </span>
                )}
              </motion.li>
            ))}
          </ul>
        )}

        <Link to="/audit" className="mt-3 self-start text-[13px] font-medium text-primary-600 transition-colors hover:text-primary-700">
          سجل التدقيق الكامل ←
        </Link>
      </div>
    </section>
  )
}

/* ═══════════ ٦. رسم النقوط الشهري ═══════════ */
function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: MonthlyPoint }[] }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-lg bg-[#3A3026] px-3.5 py-2.5 text-[12px] text-[#F6F1E7] shadow-pop">
      <span className="font-semibold">{d.month}:</span> <span className="num-ltr">{formatMoney(d.amount)}</span> ج.م ·{' '}
      <span className="num-ltr">{d.count}</span> نقطة
    </div>
  )
}

function MonthlyChart({ data }: { data: MonthlyPoint[] }) {
  const peak = data.reduce<MonthlyPoint | null>((m, p) => (m && m.amount >= p.amount ? m : p), null)
  return (
    <section className="xl:col-span-7">
      <div className="surface-card h-full p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-kufi text-[17px] font-semibold leading-6 text-ink-900">النقوط آخر ٦ شهور</h3>
          <span className="flex items-center gap-1.5 text-[12px] text-ink-500">
            <span className="size-2.5 rounded-full bg-primary-500" />
            مبلغ
          </span>
        </div>
        <div className="mt-4 h-[220px]" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }} barCategoryGap="28%">
              <CartesianGrid vertical={false} stroke="#E9DFC9" strokeDasharray="4 4" />
              <XAxis dataKey="month" tickLine={false} axisLine={{ stroke: '#E5DAC6' }} tick={{ fill: '#7C7060', fontSize: 12, fontFamily: 'IBM Plex Sans Arabic' }} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(168,116,56,0.07)' }} />
              <Bar dataKey="amount" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={600}>
                {data.map((m) => (
                  <Cell key={m.month} fill={m.current ? '#A87438' : '#C8985E'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-3 text-[12.5px] text-ink-500">
          {peak && peak.amount > 0 ? `أعلى شهر: ${peak.month} — ${formatMoney(peak.amount)} ج.م (${toArabicDigits(peak.count)} نقطة)` : 'لسه مفيش نقوط كفاية للمقارنة الشهرية'}
        </p>
      </div>
    </section>
  )
}

/* ═══════════ ٧. ملخص ميزان الأرصدة ═══════════ */
function BalanceSummary({ matrix, totalFor, totalAgainst }: { matrix: BalanceRow[]; totalFor: number; totalAgainst: number }) {
  const top = useMemo(() => [...matrix].sort((a, b) => Math.abs(b.net) - Math.abs(a.net)).slice(0, 3), [matrix])
  const total = totalFor + totalAgainst
  const pieData = [
    { name: 'له', value: totalFor, color: '#4A6741' },
    { name: 'عليه', value: totalAgainst, color: '#C08050' },
  ].filter((d) => d.value > 0)

  return (
    <section className="xl:col-span-5">
      <div className="surface-card h-full p-5">
        <h3 className="font-kufi text-[17px] font-semibold leading-6 text-ink-900">ميزان الأرصدة</h3>

        {total === 0 ? (
          <div className="flex flex-col items-center py-6 text-center">
            <img src="/empty-ledger.svg" alt="" className="w-[130px] select-none opacity-90" draggable={false} />
            <p className="mt-3 text-[13px] text-ink-500">مفيش أرصدة مفتوحة — الدفاتر كلها مصفّاة ✓</p>
          </div>
        ) : (
          <>
            <div className="relative mx-auto mt-3 h-[160px] w-[160px]" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" innerRadius={56} outerRadius={76} startAngle={90} endAngle={-270} strokeWidth={0} isAnimationActive animationDuration={700}>
                    {pieData.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="num-ltr font-kufi text-[20px] font-bold text-ink-900">{toArabicDigits(matrix.length)}</span>
                <span className="text-[11px] text-ink-500">رصيد نشط</span>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-center gap-5 text-[12px]">
              <span className="flex items-center gap-1.5 text-ink-700">
                <span className="size-2.5 rounded-full bg-laha-solid" />
                له <span className="num-ltr font-semibold">{formatMoney(totalFor)}</span>
              </span>
              <span className="flex items-center gap-1.5 text-ink-700">
                <span className="size-2.5 rounded-full bg-[#C08050]" />
                عليه <span className="num-ltr font-semibold">{formatMoney(totalAgainst)}</span>
              </span>
            </div>

            <ul className="mt-4 flex flex-col gap-2">
              {top.map((r) => {
                const creditor = r.net > 0 ? r.personAName : r.personBName
                const debtor = r.net > 0 ? r.personBName : r.personAName
                const amount = Math.abs(r.net)
                return (
                  <li key={`${r.personAId}-${r.personBId}`} className="flex items-center justify-between gap-2 rounded-lg bg-paper-base px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-ink-900">{creditor}</p>
                      <p className="text-[11px] text-ink-400">على {debtor}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <InteractionMarks count={r.interactions} />
                      <BalanceChip amount={amount} />
                    </div>
                  </li>
                )
              })}
            </ul>
          </>
        )}

        <Link to="/balances" className="mt-3 inline-block text-[13px] font-medium text-primary-600 transition-colors hover:text-primary-700">
          إدارة الأرصدة ←
        </Link>
      </div>
    </section>
  )
}

/* ═══════════ ٨. جدول الأفراح السابقة ═══════════ */
function PastWeddingsTable({
  events,
  reportedIds,
  lateEditedIds,
}: {
  events: EventListItem[]
  reportedIds: Set<number>
  lateEditedIds: Set<number>
}) {
  const navigate = useNavigate()
  const toast = useToast()
  const utils = trpc.useUtils()

  const generateReport = trpc.reports.generate.useMutation({
    onSuccess: (report) => {
      toast('success', 'التقرير اتولّد ✓ — بيفتح في تبويب جديد')
      window.open(report.fileUrl, '_blank', 'noopener')
      void utils.reports.list.invalidate()
    },
    onError: (e) => toast('error', e.message || 'مقدرش يولّد التقرير دلوقتي'),
  })

  const columns: Column<EventListItem>[] = [
    {
      key: 'الفرح',
      header: 'الفرح',
      render: (w) => (
        <div className="flex items-start gap-2">
          {lateEditedIds.has(w.id) && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-redink" title="فيه تعديلات بعد الفرح" />}
          <div>
            <div className="font-kufi font-semibold text-[13.5px] text-ink-900">فرحة {w.hostName}</div>
            <div className="text-[11px] text-ink-500">{w.place || 'بدون مكان'}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'التاريخ',
      header: 'التاريخ',
      render: (w) => <span className="text-ink-700">{formatArabicDate(new Date(w.eventDate))}</span>,
    },
    {
      key: 'النقوط',
      header: 'النقوط',
      numeric: true,
      sortable: true,
      sortValue: (w) => w.nuqtatCount,
      render: (w) => <span className="text-ink-700">{w.nuqtatCount}</span>,
    },
    {
      key: 'الإجمالي',
      header: 'الإجمالي',
      numeric: true,
      sortable: true,
      sortValue: (w) => w.totalAmount,
      render: (w) => (
        <span className="text-ink-900">
          <span className="font-bold">{formatMoney(w.totalAmount)}</span> <span className="text-[11px] text-ink-500">ج.م</span>
        </span>
      ),
    },
    {
      key: 'التقرير',
      header: 'التقرير',
      render: (w) =>
        reportedIds.has(w.id) ? (
          <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-gold-600">
            <span className="size-1.5 rounded-full bg-gold-500" />
            جاهز
          </span>
        ) : (
          <span className="text-[12px] text-ink-400">لسه</span>
        ),
    },
    {
      key: 'إجراءات',
      header: 'إجراءات',
      render: (w) => (
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={generateReport.isPending}
            onClick={(e) => {
              e.stopPropagation()
              generateReport.mutate({ eventId: w.id })
            }}
            title="توليد التقرير PDF"
            className="flex size-8 items-center justify-center rounded-lg text-gold-600 transition-colors hover:bg-gold-100 disabled:opacity-50"
          >
            <FileText className="size-4" />
          </button>
          <button
            type="button"
            title="نسخ رابط صاحب الفرح"
            onClick={async (e) => {
              e.stopPropagation()
              const ok = await copyText(`${window.location.origin}/w/${w.shareToken}`)
              toast(ok ? 'success' : 'error', ok ? `الرابط اتنسخ — ابعته لـ${w.hostName}` : 'مقدرتش أنسخ الرابط')
            }}
            className="flex size-8 items-center justify-center rounded-lg text-primary-600 transition-colors hover:bg-primary-50"
          >
            <Share2 className="size-4" />
          </button>
        </div>
      ),
    },
  ]

  return (
    <section className="xl:col-span-7">
      <div className="surface-card p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-kufi text-[17px] font-semibold leading-6 text-ink-900">الأفراح السابقة</h3>
          <Link to="/weddings" className="text-[13px] font-medium text-primary-600 transition-colors hover:text-primary-700">
            كل الأفراح ←
          </Link>
        </div>
        <div className="mt-4">
          <DataTable
            columns={columns}
            rows={events}
            rowKey={(w) => String(w.id)}
            onRowClick={(w) => navigate(`/weddings/${w.id}`)}
            renderCard={(w) => (
              <div onClick={() => navigate(`/weddings/${w.id}`)} className="cursor-pointer px-4 py-3.5 active:bg-[#FAF5EA]">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2">
                    {lateEditedIds.has(w.id) && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-redink" title="فيه تعديلات بعد الفرح" />}
                    <div className="min-w-0">
                      <div className="truncate font-kufi font-semibold text-[13.5px] text-ink-900">فرحة {w.hostName}</div>
                      <div className="text-[11px] text-ink-500">{w.place || 'بدون مكان'}</div>
                    </div>
                  </div>
                  {reportedIds.has(w.id) ? (
                    <span className="inline-flex shrink-0 items-center gap-1.5 text-[12px] font-medium text-gold-600">
                      <span className="size-1.5 rounded-full bg-gold-500" />
                      التقرير جاهز
                    </span>
                  ) : (
                    <span className="shrink-0 text-[12px] text-ink-400">التقرير لسه</span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-500">
                  <span>{formatArabicDate(new Date(w.eventDate))}</span>
                  <span className="num-ltr">{w.nuqtatCount} نقطة</span>
                  <span className="num-ltr font-bold text-ink-900">
                    {formatMoney(w.totalAmount)} <span className="text-[11px] font-normal text-ink-500">ج.م</span>
                  </span>
                  <span className="ms-auto flex items-center gap-1">
                    <button
                      type="button"
                      disabled={generateReport.isPending}
                      onClick={(e) => {
                        e.stopPropagation()
                        generateReport.mutate({ eventId: w.id })
                      }}
                      title="توليد التقرير PDF"
                      className="flex size-8 items-center justify-center rounded-lg text-gold-600 transition-colors hover:bg-gold-100 disabled:opacity-50"
                    >
                      <FileText className="size-4" />
                    </button>
                    <button
                      type="button"
                      title="نسخ رابط صاحب الفرح"
                      onClick={async (e) => {
                        e.stopPropagation()
                        const ok = await copyText(`${window.location.origin}/w/${w.shareToken}`)
                        toast(ok ? 'success' : 'error', ok ? `الرابط اتنسخ — ابعته لـ${w.hostName}` : 'مقدرتش أنسخ الرابط')
                      }}
                      className="flex size-8 items-center justify-center rounded-lg text-primary-600 transition-colors hover:bg-primary-50"
                    >
                      <Share2 className="size-4" />
                    </button>
                  </span>
                </div>
              </div>
            )}
          />
        </div>
      </div>
    </section>
  )
}

/* ═══════════ ٩. تنبيهات ذكية ═══════════ */
function SmartAlerts({ dupName, dupCount, noInviterCount, noInviterEventId, noInviterHost }: { dupName: string | null; dupCount: number; noInviterCount: number; noInviterEventId: number | null; noInviterHost: string }) {
  return (
    <section className="xl:col-span-5">
      <div className="surface-card h-full p-5">
        <h3 className="font-kufi text-[17px] font-semibold leading-6 text-ink-900">تنبيهات ذكية</h3>
        <ul className="mt-4 flex flex-col gap-3">
          {dupName && (
            <motion.li
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, ease: EASE }}
              className="flex items-start gap-3 rounded-xl bg-paper-base p-3"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-600">
                <Users className="size-[18px]" />
              </span>
              <p className="text-[13px] leading-5 text-ink-700">
                <span className="font-semibold text-ink-900">{toArabicDigits(dupCount)} أشخاص بنفس الاسم «{dupName}»</span> — ميّز بينهم بالمنطقة عند التسجيل
              </p>
            </motion.li>
          )}
          {noInviterCount > 0 && (
            <motion.li
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: 0.08, ease: EASE }}
              className="flex items-start gap-3 rounded-xl bg-paper-base p-3"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-partial-bg text-partial-text">
                <AlertTriangle className="size-[18px]" />
              </span>
              <p className="text-[13px] leading-5 text-ink-700">
                <span className="font-semibold text-ink-900">{toArabicDigits(noInviterCount)} نقوط بدون «مين دعاه»</span> في فرحة {noInviterHost} —{' '}
                {noInviterEventId ? (
                  <Link to={`/weddings/${noInviterEventId}`} className="font-semibold text-primary-600 hover:text-primary-700">
                    أكمّل البيانات؟
                  </Link>
                ) : (
                  'أكمّل البيانات؟'
                )}
              </p>
            </motion.li>
          )}
          <motion.li
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.35, delay: 0.16, ease: EASE }}
            className="flex items-start gap-3 rounded-xl border border-[#E3D3A3] bg-gold-100/60 p-3"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gold-100 text-gold-600">
              <Lightbulb className="size-[18px]" />
            </span>
            <p className="text-[13px] leading-5 text-ink-700">
              النقوط اللي اتبعت إشعارها محفوظة — لو عدّلتها هيبعت <span className="font-semibold text-ink-900">تصحيح تلقائي</span> للطرفين ويتسجل في سجل التدقيق.
            </p>
          </motion.li>
        </ul>
      </div>
    </section>
  )
}

/* ═══════════ الصفحة ═══════════ */
function DashboardInner() {
  const statsQ = trpc.dashboard.stats.useQuery()
  const eventsQ = trpc.events.list.useQuery({ filter: 'all' })
  const recentQ = trpc.nuqtat.listRecent.useQuery({ limit: 50 })
  const matrixQ = trpc.balances.matrix.useQuery()
  const personsQ = trpc.persons.list.useQuery()
  const reportsQ = trpc.reports.list.useQuery()

  const stats = statsQ.data
  const events = useMemo(() => eventsQ.data ?? [], [eventsQ.data])
  const recent = useMemo(() => recentQ.data ?? [], [recentQ.data])
  const matrix = useMemo(() => matrixQ.data ?? [], [matrixQ.data])

  const upcoming = useMemo(() => events.filter((e) => e.status === 'upcoming'), [events])
  const past = useMemo(() => events.filter((e) => e.status === 'done').slice(0, 3), [events])

  /* تجميع شهري لآخر ٦ شهور من إجماليات الأفراح */
  const monthly = useMemo<MonthlyPoint[]>(() => {
    const now = new Date()
    const buckets: MonthlyPoint[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      buckets.push({ month: AR_MONTHS[d.getMonth()], amount: 0, count: 0, current: i === 0 })
    }
    const start = new Date(now.getFullYear(), now.getMonth() - 5, 1).getTime()
    for (const ev of events) {
      const t = new Date(ev.eventDate)
      if (t.getTime() < start) continue
      const monthsAgo = (now.getFullYear() - t.getFullYear()) * 12 + (now.getMonth() - t.getMonth())
      const i = 5 - monthsAgo
      if (i >= 0 && i < 6) {
        buckets[i].amount += ev.totalAmount
        buckets[i].count += ev.nuqtatCount
      }
    }
    return buckets
  }, [events])

  const reportedIds = useMemo(() => new Set((reportsQ.data ?? []).map((r) => r.eventId)), [reportsQ.data])
  const lateEditedIds = useMemo(() => new Set(recent.filter((n) => n.editedAfterDone).map((n) => n.eventId)), [recent])

  /* تنبيهات: أسماء مكررة + نقوط بدون داعٍ */
  const dup = useMemo(() => {
    const counts = new Map<string, { name: string; count: number }>()
    for (const p of personsQ.data ?? []) {
      const key = p.name.trim().replace(/\s+/g, ' ')
      const cur = counts.get(key) ?? { name: key, count: 0 }
      cur.count += 1
      counts.set(key, cur)
    }
    let best: { name: string; count: number } | null = null
    for (const v of counts.values()) if (v.count > 1 && (!best || v.count > best.count)) best = v
    return best
  }, [personsQ.data])

  const noInviter = useMemo(() => {
    const byEvent = new Map<number, { count: number; host: string }>()
    for (const n of recent) {
      if (n.invitedBy.trim()) continue
      const cur = byEvent.get(n.eventId) ?? { count: 0, host: n.hostName }
      cur.count += 1
      byEvent.set(n.eventId, cur)
    }
    let best: { id: number; count: number; host: string } | null = null
    for (const [id, v] of byEvent) if (!best || v.count > best.count) best = { id, ...v }
    return best
  }, [recent])

  if (statsQ.isLoading || eventsQ.isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <Skeleton className="h-72 xl:col-span-7" />
          <Skeleton className="h-72 xl:col-span-5" />
        </div>
      </div>
    )
  }

  if (statsQ.error || !stats) {
    return <ErrorState error={statsQ.error ?? eventsQ.error} onRetry={() => { void statsQ.refetch(); void eventsQ.refetch() }} />
  }

  const forPairs = matrix.filter((r) => r.net > 0).length
  const againstPairs = matrix.filter((r) => r.net < 0).length

  return (
    <div className="flex flex-col gap-6">
      <WelcomeHeader upcomingCount={upcoming.length} next={upcoming[0] ?? null} />

      {/* ٣. صف الإحصائيات */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          index={0}
          title="إجمالي النقوط"
          value={stats.totalNuqtatAmount}
          suffix="ج.م"
          sub={`${toArabicDigits(stats.nuqtatCount)} نقطة في الدفتر`}
          icon={Banknote}
          tone="primary"
          spark={monthly.map((m) => m.amount)}
        />
        <StatCard
          index={1}
          title="أرصدة «له»"
          value={stats.network.totalFor}
          suffix="ج.م"
          sub={`${toArabicDigits(forPairs)} ${forPairs === 1 ? 'شخص' : 'أشخاص'} ليهم حق`}
          icon={CircleArrowOutDownLeft}
          tone="olive"
        />
        <StatCard
          index={2}
          title="أرصدة «عليه»"
          value={stats.network.totalAgainst}
          suffix="ج.م"
          sub={`${toArabicDigits(againstPairs)} ${againstPairs === 1 ? 'شخص' : 'أشخاص'} عليهم`}
          icon={CircleArrowOutUpRight}
          tone="brick"
        />
        <StatCard
          index={3}
          title="الأشخاص"
          value={stats.personsCount}
          sub={`${toArabicDigits(stats.upcomingEventsCount)} ${stats.upcomingEventsCount === 1 ? 'فرحة' : 'أفراح'} قادمة`}
          icon={Users}
          tone="gold"
        />
      </div>

      {/* ٤ + ٥ */}
      <div className="grid grid-cols-1 items-stretch gap-6 xl:grid-cols-12">
        <UpcomingWeddings events={upcoming} />
        <TodayActivity items={recent} todayCount={stats.today.nuqtatCount} />
      </div>

      {/* ٦ + ٧ */}
      <div className="grid grid-cols-1 items-stretch gap-6 xl:grid-cols-12">
        <MonthlyChart data={monthly} />
        <BalanceSummary matrix={matrix} totalFor={stats.network.totalFor} totalAgainst={stats.network.totalAgainst} />
      </div>

      {/* ٨ + ٩ */}
      <div className="grid grid-cols-1 items-stretch gap-6 xl:grid-cols-12">
        {past.length > 0 ? (
          <PastWeddingsTable events={past} reportedIds={reportedIds} lateEditedIds={lateEditedIds} />
        ) : (
          <section className="xl:col-span-7">
            <div className="surface-card p-5">
              <h3 className="font-kufi text-[17px] font-semibold leading-6 text-ink-900">الأفراح السابقة</h3>
              <EmptyState title="لسه مفيش أفراح سابقة" description="أول فرحة تتم هتظهر هنا مع تقريرها وإجمالي نقوطها" />
            </div>
          </section>
        )}
        <SmartAlerts
          dupName={dup?.name ?? null}
          dupCount={dup?.count ?? 0}
          noInviterCount={noInviter?.count ?? 0}
          noInviterEventId={noInviter?.id ?? null}
          noInviterHost={noInviter?.host ?? ''}
        />
      </div>
    </div>
  )
}

export default function Dashboard() {
  return (
    <ToastProvider>
      <DashboardInner />
    </ToastProvider>
  )
}
