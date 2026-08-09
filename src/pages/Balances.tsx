import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeftRight,
  CircleArrowOutDownLeft,
  CircleArrowOutUpRight,
  Download,
  Eye,
  EyeClosed,
  Infinity as InfinityIcon,
  MessageCircle,
  Search,
  Stamp,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { normalizeArabic } from '@/lib/format'
import { trpc } from '@/providers/trpc'
import BalanceChip from '@/components/BalanceChip'
import EmptyState from '@/components/EmptyState'
import StatCard from '@/components/StatCard'
import PairDrillDown from '@/pages/grp-people/PairDrillDown'
import PairStateChip from '@/pages/grp-people/PairStateChip'
import OpenableMarks from '@/pages/grp-people/OpenableMarks'
import SettledNoticeCard from '@/pages/grp-people/SettledNoticeCard'
import Toaster from '@/pages/grp-people/Toast'
import { CardsSkeleton, ErrorBox, TableSkeleton } from '@/pages/grp-people/PageStates'
import { downloadCsv, formatDate, sinceLabel, statusText } from '@/pages/grp-people/helpers'
import type { BalanceRow, PairStatus } from '@contracts/afrah'

/**
 * صفحة الأرصدة `/balances` (balances.md) — قلب النظام المحاسبي:
 * جدول الأرصدة الثنائية (صافي + علامات «/» قابلة للضغط + drill-down متحرك
 * لكل مرة + معادلة الصافي)، فلاتر حالة/بحث/منطقة/فرز، تصدير CSV،
 * وقسم إشعارات «فلان صفّى حسابه معاك» بالختم النابض.
 * لا التزام زمني: العمر نص محايد بلا إنذار.
 */

type SortKey = 'net' | 'recent' | 'most' | 'alpha'
type StatusFilter = 'all' | PairStatus

const rowKey = (r: BalanceRow) => `${r.personAId}:${r.personBId}`

const STATUS_CHIPS: { value: StatusFilter; label: string; activeCls: string }[] = [
  { value: 'all', label: 'الكل', activeCls: 'bg-paper-surface text-ink-900 shadow-sm' },
  { value: 'open', label: 'مفتوح', activeCls: 'bg-open-bg text-open-text shadow-sm' },
  { value: 'partial', label: 'سداد جزئي', activeCls: 'bg-partial-bg text-partial-text shadow-sm' },
  { value: 'settled', label: 'صفا', activeCls: 'bg-laha-bg text-laha-text shadow-sm' },
  { value: 'overpaid', label: 'زيادة', activeCls: 'bg-over-bg text-over-text shadow-sm' },
]

export default function Balances() {
  const [params] = useSearchParams()
  const [query, setQuery] = useState(() => params.get('q') ?? '')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [region, setRegion] = useState('')
  const [sort, setSort] = useState<SortKey>('net')
  const [openKey, setOpenKey] = useState<string | null>(null)

  const matrixQ = trpc.balances.matrix.useQuery()
  const noticesQ = trpc.balances.settledNotice.useQuery()

  const rows = useMemo(() => matrixQ.data ?? [], [matrixQ.data])
  const notices = useMemo(() => (noticesQ.data ?? []).slice(0, 3), [noticesQ.data])

  // ملخصات الترويسة
  const summary = useMemo(() => {
    let totalFor = 0
    let totalAgainst = 0
    let countFor = 0
    let countAgainst = 0
    for (const r of rows) {
      if (r.net > 0) {
        totalFor += r.net
        countFor += 1
      } else if (r.net < 0) {
        totalAgainst += -r.net
        countAgainst += 1
      }
    }
    const now = new Date()
    const month = noticesQ.data?.filter(
      (n) => n.settledAt.getMonth() === now.getMonth() && n.settledAt.getFullYear() === now.getFullYear(),
    ) ?? []
    return {
      totalFor,
      totalAgainst,
      countFor,
      countAgainst,
      settledMonth: month.reduce((s, n) => s + n.amount, 0),
      settledMonthCount: month.length,
    }
  }, [rows, noticesQ.data])

  const regions = useMemo(() => {
    const set = new Set<string>()
    for (const r of rows) {
      if (r.personARegion.trim()) set.add(r.personARegion.trim())
      if (r.personBRegion.trim()) set.add(r.personBRegion.trim())
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'ar'))
  }, [rows])

  // الفلترة: بحث باسم أي طرف + حالة + منطقة (أي طرف)
  const filtered = useMemo(() => {
    const nq = normalizeArabic(query.trim())
    let out = rows
    if (nq) {
      out = out.filter(
        (r) =>
          normalizeArabic(r.personAName).includes(nq) ||
          normalizeArabic(r.personBName).includes(nq) ||
          normalizeArabic(r.personARegion).includes(nq) ||
          normalizeArabic(r.personBRegion).includes(nq),
      )
    }
    if (status !== 'all') out = out.filter((r) => r.status === status)
    if (region) out = out.filter((r) => r.personARegion.trim() === region || r.personBRegion.trim() === region)
    const sorted = [...out]
    switch (sort) {
      case 'net':
        sorted.sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
        break
      case 'recent':
        sorted.sort((a, b) => (b.lastInteractionAt?.getTime() ?? 0) - (a.lastInteractionAt?.getTime() ?? 0))
        break
      case 'most':
        sorted.sort((a, b) => b.interactions - a.interactions)
        break
      case 'alpha':
        sorted.sort(
          (a, b) =>
            a.personAName.localeCompare(b.personAName, 'ar') || a.personBName.localeCompare(b.personBName, 'ar'),
        )
        break
    }
    return sorted
  }, [rows, query, status, region, sort])

  const hasFilters = query.trim() !== '' || status !== 'all' || region !== ''
  const clearFilters = () => {
    setQuery('')
    setStatus('all')
    setRegion('')
  }

  const exportCsv = () => {
    downloadCsv(
      'الأرصدة.csv',
      ['الشخص أ', 'منطقة أ', 'الشخص ب', 'منطقة ب', 'دفع أ في أفراح ب', 'دفع ب في أفراح أ', 'الصافي (له أ)', 'الحالة', 'مرات التفاعل', 'آخر تفاعل'],
      filtered.map((r) => [
        r.personAName,
        r.personARegion,
        r.personBName,
        r.personBRegion,
        r.aPaidToB,
        r.bPaidToA,
        r.net,
        statusText(r.status),
        r.interactions,
        r.lastInteractionAt ? formatDate(r.lastInteractionAt) : '—',
      ]),
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <Toaster />

      {/* الترويسة */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
      >
        <h1 className="font-kufi font-bold text-[26px] leading-[34px] text-ink-900">الأرصدة</h1>
        <p className="mt-0.5 text-[13px] text-ink-500">
          كل حساب بين شخصين — اضغط على علامات / لتشوف كل مرة بالتفصيل
        </p>
      </motion.div>

      {/* ٣ بطاقات تلخيص */}
      {matrixQ.isLoading ? (
        <CardsSkeleton count={3} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            title="إجمالي اللي لك"
            value={summary.totalFor}
            suffix="ج.م"
            sub={`${summary.countFor} رصيد له بين الناس`}
            icon={CircleArrowOutDownLeft}
            tone="olive"
            index={0}
          />
          <StatCard
            title="إجمالي اللي عليك"
            value={summary.totalAgainst}
            suffix="ج.م"
            sub={`${summary.countAgainst} رصيد عليه`}
            icon={CircleArrowOutUpRight}
            tone="brick"
            index={1}
          />
          <StatCard
            title="اتصفّى الشهر ده"
            value={summary.settledMonth}
            suffix="ج.م"
            sub={`${summary.settledMonthCount} حسابات قفلت صفا`}
            icon={Stamp}
            tone="gold"
            index={2}
          />
        </div>
      )}

      {/* ملاحظة «لا التزام زمني» */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="flex items-center gap-2 text-[12px] text-ink-500"
      >
        <InfinityIcon className="size-4 shrink-0 text-ink-400" />
        مفيش التزام زمني على أي رصيد — الحساب مفتوح لحد ما يتصفّى، والعمر بيتعرض للعلم بس.
      </motion.p>

      {/* إشعارات «فلان صفّى حسابه معاك» */}
      {notices.length > 0 && (
        <section className="flex flex-col gap-3" aria-label="آخر التصفيات">
          <h2 className="font-kufi font-semibold text-[15px] text-ink-900">آخر التصفيات</h2>
          <div className="grid gap-3 lg:grid-cols-3 md:grid-cols-2">
            {notices.map((n, i) => (
              <SettledNoticeCard key={`${n.eventId}-${n.settlerId}-${n.hostId}`} notice={n} index={i} />
            ))}
          </div>
        </section>
      )}

      {/* شريط الفلاتر */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.38, delay: 0.07, ease: [0.22, 1, 0.36, 1] }}
        className="surface-card flex flex-col gap-3 p-4"
      >
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="اسم أي طرف من الطرفين…"
              className="h-11 w-full rounded-[10px] border border-line-strong bg-paper-surface ps-10 pe-3.5 text-[14px] text-ink-900 placeholder:text-ink-400 transition-colors focus:border-primary-500 focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="امسح البحث"
                className="absolute end-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700"
              >
                <X className="size-4" />
              </button>
            )}
          </label>

          {regions.length > 0 && (
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="h-11 rounded-[10px] border border-line-strong bg-paper-surface px-3 text-[13px] text-ink-700 focus:border-primary-500 focus:outline-none"
              aria-label="فلترة بالمنطقة"
            >
              <option value="">كل المناطق</option>
              {regions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          )}

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="h-11 rounded-[10px] border border-line-strong bg-paper-surface px-3 text-[13px] text-ink-700 focus:border-primary-500 focus:outline-none"
            aria-label="الفرز"
          >
            <option value="net">الأعلى صافيًا</option>
            <option value="recent">الأحدث تفاعلًا</option>
            <option value="most">الأكثر مرات</option>
            <option value="alpha">أبجدي</option>
          </select>

          <button
            type="button"
            onClick={exportCsv}
            disabled={filtered.length === 0}
            className="ms-auto inline-flex items-center gap-2 rounded-[10px] px-3.5 py-2.5 text-[13px] font-medium text-primary-600 transition-colors hover:bg-primary-50 disabled:opacity-50"
          >
            <Download className="size-4" />
            تصدير CSV
          </button>
        </div>

        {/* شرائح الحالة */}
        <div className="flex flex-wrap items-center gap-1 rounded-[10px] border border-line bg-paper-sunken/60 p-1">
          {STATUS_CHIPS.map((c) => (
            <motion.button
              key={c.value}
              type="button"
              onClick={() => setStatus(c.value)}
              whileTap={{ scale: 1.05 }}
              className={cn(
                'rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors duration-150',
                status === c.value ? c.activeCls : 'text-ink-500 hover:text-ink-900',
              )}
            >
              {c.label}
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* جدول الأرصدة */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.38, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
        className="surface-card overflow-hidden"
      >
        {matrixQ.isLoading ? (
          <TableSkeleton rows={8} cols={6} />
        ) : matrixQ.isError ? (
          <ErrorBox error={matrixQ.error} message={matrixQ.error.message} onRetry={() => matrixQ.refetch()} className="border-0 shadow-none" />
        ) : filtered.length === 0 ? (
          <EmptyState
            image="/empty-ledger.svg"
            title={hasFilters ? 'مفيش أرصدة بالفلاتر دي' : 'لسه مفيش أرصدة في الدفتر'}
            description={
              hasFilters
                ? 'جرّب تمسح الفلاتر أو تغيّر كلمة البحث'
                : 'الأرصدة بتتكوّن تلقائيًا أول ما الناس تدفع نقوط في أفراح بعض'
            }
            actionLabel={hasFilters ? 'امسح الفلاتر' : undefined}
            onAction={hasFilters ? clearFilters : undefined}
          />
        ) : (
          <>
            {/* جدول الدفتر — شاشات متوسطة فأكبر */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full border-collapse text-[13.5px] leading-[22px]">
                <thead>
                  <tr className="bg-[#F1EADA] sticky top-0 z-10">
                    <Th>الطرفان</Th>
                    <Th>صافي المبلغ (بمنظور أ)</Th>
                    <Th className="text-center">التفاعلات</Th>
                    <Th>الحالة</Th>
                    <Th>آخر تفاعل</Th>
                    <Th>العمر</Th>
                    <Th className="w-20" />
                  </tr>
                </thead>
                {filtered.map((r) => {
                  const key = rowKey(r)
                  const open = openKey === key
                  return (
                    <tbody key={key}>
                      <tr
                        onClick={() => setOpenKey(open ? null : key)}
                        className={cn(
                          'cursor-pointer border-t border-line transition-colors duration-150',
                          open ? 'bg-[#FAF5EA]' : 'hover:bg-[#FAF5EA]',
                          r.status === 'settled' && 'opacity-70',
                        )}
                      >
                        {/* الطرفان */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Link
                              to={`/people/${r.personAId}`}
                              onClick={(e) => e.stopPropagation()}
                              className="font-kufi font-semibold text-[13.5px] text-ink-900 transition-colors hover:text-primary-600"
                            >
                              {r.personAName}
                            </Link>
                            <ArrowLeftRight className="size-3.5 shrink-0 text-primary-500" aria-hidden />
                            <Link
                              to={`/people/${r.personBId}`}
                              onClick={(e) => e.stopPropagation()}
                              className="font-kufi font-semibold text-[13.5px] text-ink-900 transition-colors hover:text-primary-600"
                            >
                              {r.personBName}
                            </Link>
                          </div>
                          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-ink-500">
                            <span>{r.personARegion || '—'}</span>
                            <ArrowLeftRight className="size-2.5" aria-hidden />
                            <span>{r.personBRegion || '—'}</span>
                          </div>
                        </td>
                        {/* صافي المبلغ */}
                        <td className="px-4 py-3">
                          <BalanceChip amount={r.net} size="sm" />
                        </td>
                        {/* التفاعلات */}
                        <td className="px-4 py-3 text-center">
                          <OpenableMarks count={r.interactions} open={open} onToggle={() => setOpenKey(open ? null : key)} />
                        </td>
                        {/* الحالة */}
                        <td className="px-4 py-3">
                          <PairStateChip
                            status={r.status}
                            sinceLabel={sinceLabel(r.lastInteractionAt)}
                            paidAmount={Math.min(r.aPaidToB, r.bPaidToA)}
                            totalAmount={Math.max(r.aPaidToB, r.bPaidToA)}
                            overAmount={Math.abs(r.net)}
                            animate={false}
                          />
                        </td>
                        {/* آخر تفاعل */}
                        <td className="px-4 py-3 text-[12.5px] text-ink-700 whitespace-nowrap">
                          {r.lastInteractionAt ? formatDate(r.lastInteractionAt) : '—'}
                        </td>
                        {/* العمر — محايد تمامًا، بلا إنذار */}
                        <td className="px-4 py-3 text-[12px] text-ink-500 whitespace-nowrap" title="مفيش استعجال — الحساب محفوظ">
                          {sinceLabel(r.lastInteractionAt) || '—'}
                        </td>
                        {/* إجراءات */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setOpenKey(open ? null : key)
                              }}
                              title={open ? 'طي التفاصيل' : 'فتح التفاصيل'}
                              className="flex size-8 items-center justify-center rounded-lg text-ink-500 transition-colors hover:bg-primary-50 hover:text-primary-600"
                            >
                              {open ? <EyeClosed className="size-4" /> : <Eye className="size-4" />}
                            </button>
                            <Link
                              to="/whatsapp"
                              onClick={(e) => e.stopPropagation()}
                              title="إرسال كشف حساب واتساب"
                              className="flex size-8 items-center justify-center rounded-lg text-ink-500 transition-colors hover:bg-whatsapp-bg hover:text-whatsapp"
                            >
                              <MessageCircle className="size-4" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                      {/* صف الـ drill-down */}
                      <AnimatePresence initial={false}>
                        {open && (
                          <tr key={`${key}-drill`} className="border-t border-line bg-[#FAF5EA]/60">
                            <td colSpan={7} className="p-0">
                              <PairDrillDown
                                a={r.personAId}
                                b={r.personBId}
                                perspectiveId={r.personAId}
                                perspectiveName={r.personAName}
                              />
                            </td>
                          </tr>
                        )}
                      </AnimatePresence>
                    </tbody>
                  )
                })}
              </table>
            </div>

            {/* بطاقات مكدسة — موبايل */}
            <ul className="md:hidden divide-y divide-line">
              {filtered.map((r) => {
                const key = rowKey(r)
                const open = openKey === key
                return (
                  <li key={key} className={cn(r.status === 'settled' && 'opacity-70')}>
                    <button
                      type="button"
                      onClick={() => setOpenKey(open ? null : key)}
                      className="w-full px-4 py-3.5 text-start"
                      aria-expanded={open}
                    >
                      <div className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate font-kufi font-semibold text-[13.5px] text-ink-900">
                          {r.personAName} <ArrowLeftRight className="inline size-3 text-primary-500" aria-hidden /> {r.personBName}
                        </span>
                        <BalanceChip amount={r.net} size="sm" />
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <OpenableMarks count={r.interactions} open={open} onToggle={() => setOpenKey(open ? null : key)} />
                        <span className="text-[11px] text-ink-500">
                          {r.lastInteractionAt ? `${formatDate(r.lastInteractionAt)} · ${sinceLabel(r.lastInteractionAt)}` : '—'}
                        </span>
                      </div>
                    </button>
                    <AnimatePresence initial={false}>
                      {open && (
                        <PairDrillDown
                          key={`${key}-drill`}
                          a={r.personAId}
                          b={r.personBId}
                          perspectiveId={r.personAId}
                          perspectiveName={r.personAName}
                        />
                      )}
                    </AnimatePresence>
                  </li>
                )
              })}
            </ul>

            <div className="border-t border-line px-4 py-3 text-[12px] text-ink-500">
              عرض <span className="num-ltr font-semibold text-ink-700">{filtered.length}</span> من{' '}
              <span className="num-ltr font-semibold text-ink-700">{rows.length}</span> حساب ثنائي
            </div>
          </>
        )}
      </motion.div>
    </div>
  )
}

function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th scope="col" className={cn('px-4 py-3 text-start text-[12px] font-semibold text-ink-700 whitespace-nowrap', className)}>
      {children}
    </th>
  )
}
