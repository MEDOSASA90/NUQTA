import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { AnimatePresence, motion } from 'framer-motion'
import {
  BadgeCheck,
  Eye,
  MapPin,
  Pencil,
  Phone,
  Search,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatMoney, normalizeArabic } from '@/lib/format'
import { trpc } from '@/providers/trpc'
import BalanceChip from '@/components/BalanceChip'
import DataTable from '@/components/DataTable'
import type { Column } from '@/components/DataTable'
import EmptyState from '@/components/EmptyState'
import InteractionMarks from '@/components/InteractionMarks'
import PersonFormModal from '@/pages/grp-people/PersonFormModal'
import Toaster from '@/pages/grp-people/Toast'
import { toast } from '@/pages/grp-people/toast-bus'
import { ErrorBox, TableSkeleton } from '@/pages/grp-people/PageStates'
import {
  avatarTone,
  formatDate,
  formatPhoneInput,
  initialOf,
  nameKey,
  sinceLabel,
} from '@/pages/grp-people/helpers'
import type { Person } from '@contracts/afrah'

/**
 * صفحة الأشخاص `/people` (people.md §١) —
 * بحث فوري (اسم/تليفون/منطقة) + شرائح مناطق وفلاتر رصيد + جدول الدفتر
 * (الاسم مع تمييز المتشابهين، التليفون بنسخ، المنطقة، التفاعلات، صافي الرصيد
 * له/عليه، حالة توثيق التليفون، آخر نشاط) + مودال إضافة بخطوة توثيق تليفون.
 */

interface PersonExtra {
  net: number
  interactions: number
  lastAt: Date | null
}

const PAGE = 50

export default function People() {
  const navigate = useNavigate()
  const utils = trpc.useUtils()

  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [regionFilter, setRegionFilter] = useState<string[]>([])
  const [dirFilter, setDirFilter] = useState<'all' | 'for' | 'against'>('all')
  const [dupFilter, setDupFilter] = useState<string | null>(null) // nameKey
  const [shown, setShown] = useState(PAGE)
  const [addOpen, setAddOpen] = useState(false)
  const [addPrefill, setAddPrefill] = useState('')
  const [editPerson, setEditPerson] = useState<Person | null>(null)
  const [flashId, setFlashId] = useState<number | null>(null)

  // debounce 120ms — فلترة فورية
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 120)
    return () => clearTimeout(t)
  }, [query])

  const listQ = trpc.persons.list.useQuery()
  const searching = debounced.length > 0
  const searchQ = trpc.persons.search.useQuery(
    { query: debounced, limit: 50 },
    { enabled: searching, placeholderData: (prev) => prev },
  )
  const matrixQ = trpc.balances.matrix.useQuery()

  const verifyMut = trpc.persons.verifyPhone.useMutation({
    onSuccess: async (p) => {
      toast('تم توثيق رقم التليفون')
      await Promise.all([
        utils.persons.list.invalidate(),
        utils.persons.search.invalidate(),
        ...(p ? [utils.persons.get.invalidate({ id: p.id })] : []),
      ])
    },
    onError: (e) => toast(e.message, 'error'),
  })

  const people = useMemo(() => listQ.data ?? [], [listQ.data])

  // خريطة إضافية لكل شخص من مصفوفة الأرصدة: الصافي + عدد التفاعلات + آخر نشاط
  const extras = useMemo(() => {
    const map = new Map<number, PersonExtra>()
    for (const row of matrixQ.data ?? []) {
      for (const [id, delta] of [
        [row.personAId, row.net],
        [row.personBId, -row.net],
      ] as const) {
        const cur = map.get(id) ?? { net: 0, interactions: 0, lastAt: null }
        cur.net += delta
        cur.interactions += row.interactions
        if (row.lastInteractionAt && (!cur.lastAt || row.lastInteractionAt > cur.lastAt)) {
          cur.lastAt = row.lastInteractionAt
        }
        map.set(id, cur)
      }
    }
    return map
  }, [matrixQ.data])

  // عدّ المتشابهين بالاسم عبر القائمة الكاملة
  const dupCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of people) map.set(nameKey(p.name), (map.get(nameKey(p.name)) ?? 0) + 1)
    return map
  }, [people])

  const regions = useMemo(
    () => [...new Set(people.map((p) => p.region.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ar')),
    [people],
  )

  // الصفوف المعروضة: نتيجة البحث أو القائمة، ثم الفلاتر
  // (تصفية المتشابهين تشتغل على القائمة الكاملة حتى مع وجود بحث)
  const rows = useMemo(() => {
    let base: Person[] = dupFilter ? people : searching ? (searchQ.data ?? []) : people
    if (dupFilter) base = base.filter((p) => nameKey(p.name) === dupFilter)
    if (regionFilter.length > 0) base = base.filter((p) => regionFilter.includes(p.region.trim()))
    if (dirFilter !== 'all') {
      base = base.filter((p) => {
        const net = extras.get(p.id)?.net ?? 0
        return dirFilter === 'for' ? net > 0 : net < 0
      })
    }
    return base
  }, [searching, searchQ.data, people, dupFilter, regionFilter, dirFilter, extras])

  const visible = rows.slice(0, shown)

  // وميض ذهبي للصف الجديد (1.2s)
  useEffect(() => {
    if (flashId == null) return
    const t = setTimeout(() => setFlashId(null), 1400)
    return () => clearTimeout(t)
  }, [flashId])

  const copyPhone = (p: Person) => {
    navigator.clipboard?.writeText(p.phone).catch(() => {})
    toast(`اتنسخ ${formatPhoneInput(p.phone)}`, 'copy')
  }

  const dupLabel = dupFilter ? people.find((p) => nameKey(p.name) === dupFilter)?.name : null
  const dupCount = dupFilter ? rows.length : 0

  const columns: Column<Person>[] = [
    {
      key: 'name',
      header: 'الاسم',
      sortable: true,
      sortValue: (p) => p.name,
      render: (p) => {
        const dups = dupCounts.get(nameKey(p.name)) ?? 0
        return (
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-full font-kufi font-bold text-[13px]',
                avatarTone(p.id),
              )}
            >
              {initialOf(p.name)}
            </span>
            <span className="min-w-0">
              <span className="block truncate font-kufi font-semibold text-[13.5px] text-ink-900">{p.name}</span>
              {dups > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setDupFilter(nameKey(p.name))
                    setShown(PAGE)
                  }}
                  title={`في ${dups} بهذا الاسم — اعرضهم بس`}
                  className="mt-0.5 inline-flex items-center rounded-full bg-partial-bg px-2 py-px text-[10.5px] font-medium text-partial-text transition-colors hover:bg-partial-solid/30"
                >
                  مكرر ×{dups}
                </button>
              )}
            </span>
          </div>
        )
      },
    },
    {
      key: 'phone',
      header: 'التليفون',
      render: (p) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            copyPhone(p)
          }}
          title="اضغط للنسخ"
          className="group inline-flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-ink-700 transition-colors hover:bg-primary-50"
        >
          <Phone className="size-3.5 text-ink-400 transition-colors group-hover:text-primary-600" />
          <span className="num-ltr text-[13px]">{formatPhoneInput(p.phone)}</span>
        </button>
      ),
    },
    {
      key: 'region',
      header: 'المنطقة',
      render: (p) =>
        p.region.trim() ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-paper-sunken px-2.5 py-1 text-[12px] text-ink-700">
            <MapPin className="size-3 text-ink-400" />
            {p.region}
          </span>
        ) : (
          <span className="text-ink-400">—</span>
        ),
    },
    {
      key: 'interactions',
      header: 'التفاعلات',
      numeric: true,
      sortable: true,
      sortValue: (p) => extras.get(p.id)?.interactions ?? 0,
      render: (p) => (
        <InteractionMarks
          count={extras.get(p.id)?.interactions ?? 0}
          onOpen={() => navigate(`/people/${p.id}`)}
        />
      ),
    },
    {
      key: 'net',
      header: 'صافي الرصيد',
      numeric: true,
      sortable: true,
      sortValue: (p) => Math.abs(extras.get(p.id)?.net ?? 0),
      render: (p) => {
        const ex = extras.get(p.id)
        if (!ex || ex.interactions === 0) return <span className="text-ink-400">—</span>
        return <BalanceChip amount={ex.net} size="sm" />
      },
    },
    {
      key: 'verified',
      header: 'توثيق التليفون',
      render: (p) =>
        p.phoneVerified ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-laha-bg px-2.5 py-1 text-[11.5px] font-medium text-laha-text">
            <BadgeCheck className="size-3.5" />
            مُتحقق منه
          </span>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              verifyMut.mutate({ id: p.id, verified: true })
            }}
            disabled={verifyMut.isPending}
            title="اعتمد الرقم «مُتحقق منه» — لازم قبل رسايل واتساب"
            className="inline-flex items-center gap-1 rounded-full bg-open-bg px-2.5 py-1 text-[11.5px] font-medium text-open-text transition-colors hover:bg-laha-bg hover:text-laha-text disabled:opacity-60"
          >
            <ShieldCheck className="size-3.5" />
            غير موثّق — وثّقه
          </button>
        ),
    },
    {
      key: 'last',
      header: 'آخر نشاط',
      render: (p) => {
        const at = extras.get(p.id)?.lastAt
        if (!at) return <span className="text-ink-400">—</span>
        return (
          <span className="block leading-5">
            <span className="block text-[12.5px] text-ink-700">{formatDate(at)}</span>
            <span className="block text-[11px] text-ink-500">{sinceLabel(at)}</span>
          </span>
        )
      },
    },
    {
      key: 'actions',
      header: '',
      render: (p) => (
        <div className="flex items-center gap-1 opacity-0 transition-opacity duration-150 [tr:hover_&]:opacity-100 [tr:focus-within_&]:opacity-100">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/people/${p.id}`)
            }}
            title="فتح البطاقة"
            className="flex size-8 items-center justify-center rounded-lg text-ink-500 transition-colors hover:bg-primary-50 hover:text-primary-600"
          >
            <Eye className="size-4" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setEditPerson(p)
            }}
            title="تعديل"
            className="flex size-8 items-center justify-center rounded-lg text-ink-500 transition-colors hover:bg-primary-50 hover:text-primary-600"
          >
            <Pencil className="size-4" />
          </button>
        </div>
      ),
    },
  ]

  const isLoading = searching ? searchQ.isLoading : listQ.isLoading
  const error = searching ? searchQ.error : listQ.error

  // بطاقة الشخص على الموبايل (< 768px) — كل الحقول مرتبة رأسيًا بلا قصّ
  const renderPersonCard = (p: Person) => {
    const dups = dupCounts.get(nameKey(p.name)) ?? 0
    const ex = extras.get(p.id)
    const lastAt = ex?.lastAt
    return (
      <div
        onClick={() => navigate(`/people/${p.id}`)}
        className={cn(
          'cursor-pointer px-4 py-3.5 transition-colors',
          flashId === p.id ? 'bg-primary-50' : 'active:bg-[#FAF5EA]',
        )}
      >
        {/* السطر الأول: الاسم + صافي الرصيد */}
        <div className="flex items-center gap-2.5">
          <span
            className={cn('flex size-9 shrink-0 items-center justify-center rounded-full font-kufi font-bold text-[13px]', avatarTone(p.id))}
          >
            {initialOf(p.name)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-kufi font-semibold text-[14px] text-ink-900">{p.name}</span>
              {dups > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setDupFilter(nameKey(p.name))
                    setShown(PAGE)
                  }}
                  className="shrink-0 rounded-full bg-partial-bg px-2 py-px text-[10.5px] font-medium text-partial-text"
                >
                  مكرر ×{dups}
                </button>
              )}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-ink-500">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  copyPhone(p)
                }}
                title="اضغط للنسخ"
                className="inline-flex items-center gap-1 num-ltr"
              >
                <Phone className="size-3 text-ink-400" />
                {formatPhoneInput(p.phone)}
              </button>
              {p.region.trim() && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3 text-ink-400" />
                  {p.region}
                </span>
              )}
            </div>
          </div>
          {ex && ex.interactions > 0 ? <BalanceChip amount={ex.net} size="sm" /> : null}
        </div>

        {/* السطر الثاني: التفاعلات + التوثيق + آخر نشاط + إجراءات */}
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
          <InteractionMarks count={ex?.interactions ?? 0} onOpen={() => navigate(`/people/${p.id}`)} />
          {p.phoneVerified ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-laha-bg px-2.5 py-1 text-[11px] font-medium text-laha-text">
              <BadgeCheck className="size-3.5" />
              مُتحقق منه
            </span>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                verifyMut.mutate({ id: p.id, verified: true })
              }}
              disabled={verifyMut.isPending}
              className="inline-flex items-center gap-1 rounded-full bg-open-bg px-2.5 py-1 text-[11px] font-medium text-open-text disabled:opacity-60"
            >
              <ShieldCheck className="size-3.5" />
              وثّق الرقم
            </button>
          )}
          <span className="text-[11px] text-ink-500">
            {lastAt ? `${formatDate(lastAt)} · ${sinceLabel(lastAt)}` : 'لا نشاط بعد'}
          </span>
          <span className="ms-auto flex items-center gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/people/${p.id}`)
              }}
              title="فتح البطاقة"
              className="flex size-8 items-center justify-center rounded-lg text-ink-500 hover:bg-primary-50 hover:text-primary-600"
            >
              <Eye className="size-4" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setEditPerson(p)
              }}
              title="تعديل"
              className="flex size-8 items-center justify-center rounded-lg text-ink-500 hover:bg-primary-50 hover:text-primary-600"
            >
              <Pencil className="size-4" />
            </button>
          </span>
        </div>
      </div>
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
        className="flex flex-wrap items-center gap-3"
      >
        <div>
          <h1 className="font-kufi font-bold text-[26px] leading-[34px] text-ink-900">الأشخاص</h1>
          <p className="mt-0.5 text-[13px] text-ink-500">
            {listQ.data ? (
              <>
                <span className="num-ltr font-semibold text-ink-700">{formatMoney(people.length)}</span> شخص مسجل في الدفتر
              </>
            ) : (
              'دليل الأشخاص — الاسم مفتاح البحث، والمنطقة والتليفون للتمييز'
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setAddPrefill('')
            setAddOpen(true)
          }}
          className="ms-auto inline-flex items-center gap-2 rounded-[10px] bg-primary-500 px-[18px] py-2.5 text-[14px] font-semibold text-[#FFFDF8] shadow-card transition-all hover:bg-primary-600 hover:-translate-y-px active:bg-primary-700 active:scale-[0.97]"
        >
          <UserPlus className="size-4" />
          إضافة شخص
        </button>
      </motion.div>

      {/* شريط الأدوات */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.38, delay: 0.07, ease: [0.22, 1, 0.36, 1] }}
        className="surface-card flex flex-col gap-3 p-4"
      >
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setShown(PAGE)
              }}
              placeholder="اسم، تليفون، أو منطقة…"
              className="h-11 w-full rounded-[10px] border border-line-strong bg-paper-surface ps-10 pe-3.5 text-[14px] text-ink-900 placeholder:text-ink-400 transition-colors focus:border-primary-500 focus:outline-none"
            />
          </label>
          {/* فلاتر اتجاه الرصيد */}
          <div className="flex items-center gap-1 rounded-[10px] border border-line bg-paper-sunken/60 p-1">
            {(
              [
                ['all', 'الكل'],
                ['for', 'ليه رصيد'],
                ['against', 'عليه رصيد'],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => {
                  setDirFilter(v)
                  setShown(PAGE)
                }}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-all duration-150',
                  dirFilter === v
                    ? v === 'for'
                      ? 'bg-laha-bg text-laha-text shadow-sm'
                      : v === 'against'
                        ? 'bg-aleh-bg text-aleh-text shadow-sm'
                        : 'bg-paper-surface text-ink-900 shadow-sm'
                    : 'text-ink-500 hover:text-ink-900',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* شرائح المناطق */}
        {regions.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <MapPin className="size-3.5 text-ink-400" />
            {regions.map((r) => {
              const active = regionFilter.includes(r)
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setRegionFilter((xs) => (xs.includes(r) ? xs.filter((x) => x !== r) : [...xs, r]))
                    setShown(PAGE)
                  }}
                  className={cn(
                    'rounded-full border px-3 py-1 text-[12px] transition-colors duration-150',
                    active
                      ? 'border-primary-500 bg-primary-100 font-medium text-primary-700'
                      : 'border-line bg-paper-surface text-ink-700 hover:border-primary-300 hover:bg-primary-50',
                  )}
                >
                  {r}
                </button>
              )
            })}
            {regionFilter.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setRegionFilter([])
                  setShown(PAGE)
                }}
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11.5px] text-ink-500 hover:text-primary-600"
              >
                <X className="size-3" />
                امسح المناطق
              </button>
            )}
          </div>
        )}
      </motion.div>

      {/* شريط تمييز المتشابهين */}
      <AnimatePresence>
        {dupFilter && dupLabel && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="flex flex-wrap items-center gap-2 rounded-[12px] border border-partial-solid/40 bg-partial-bg px-4 py-3"
          >
            <Users className="size-4 text-partial-text" />
            <span className="text-[13px] font-medium text-partial-text">
              {dupCount} {dupCount === 1 ? 'شخص' : 'أشخاص'} باسم «{dupLabel}» — التمييز بالمنطقة والتليفون
            </span>
            <button
              type="button"
              onClick={() => {
                setDupFilter(null)
                setShown(PAGE)
              }}
              className="ms-auto inline-flex items-center gap-1.5 rounded-lg border border-partial-solid/50 bg-paper-surface px-3 py-1.5 text-[12px] font-medium text-ink-700 transition-colors hover:bg-primary-50"
            >
              <X className="size-3.5" />
              إلغاء التصفية
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* الجدول */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.38, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
        className="surface-card overflow-hidden"
      >
        {isLoading ? (
          <TableSkeleton rows={8} cols={6} />
        ) : error ? (
          <ErrorBox error={error} message={error.message} onRetry={() => (searching ? searchQ.refetch() : listQ.refetch())} className="border-0 shadow-none" />
        ) : rows.length === 0 ? (
          searching || regionFilter.length > 0 || dirFilter !== 'all' || dupFilter ? (
            <EmptyState
              image="/empty-search.svg"
              title={searching ? `مفيش حد بـ«${debounced}»` : 'مفيش نتائج بالفلاتر دي'}
              description={searching ? 'جرّب رقم التليفون أو المنطقة — أو سجّله شخص جديد في الدفتر' : 'جرّب تمسح شوية فلاتر'}
              actionLabel={searching && normalizeArabic(debounced).length >= 2 ? `إضافة «${debounced}» كشخص جديد` : undefined}
              onAction={searching ? () => {
                setAddPrefill(debounced)
                setAddOpen(true)
              } : undefined}
            />
          ) : (
            <EmptyState
              image="/empty-ledger.svg"
              title="لسه مفيش أشخاص في الدفتر"
              description="سجّل أول شخص — وهتلاقي أرصدته وتفاعلاته هنا أول بأول"
              actionLabel="إضافة أول شخص"
              onAction={() => {
                setAddPrefill('')
                setAddOpen(true)
              }}
            />
          )
        ) : (
          <>
            <DataTable<Person>
              columns={columns}
              rows={visible}
              rowKey={(p) => String(p.id)}
              selectedKey={flashId != null ? String(flashId) : undefined}
              onRowClick={(p) => navigate(`/people/${p.id}`)}
              renderCard={renderPersonCard}
            />
            <div className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-3">
              <span className="text-[12px] text-ink-500">
                عرض <span className="num-ltr font-semibold text-ink-700">{visible.length}</span> من{' '}
                <span className="num-ltr font-semibold text-ink-700">{rows.length}</span>
                {searching && ' نتيجة بحث'}
              </span>
              {rows.length > visible.length && (
                <button
                  type="button"
                  onClick={() => setShown((s) => s + PAGE)}
                  className="ms-auto rounded-[10px] border border-line-strong px-4 py-2 text-[12.5px] font-medium text-ink-700 transition-colors hover:bg-primary-50"
                >
                  عرض المزيد
                </button>
              )}
            </div>
          </>
        )}
      </motion.div>

      {/* مودالات الإضافة/التعديل */}
      <PersonFormModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        prefillName={addPrefill}
        people={people}
        regions={regions}
        onSaved={(p, isNew) => {
          if (isNew) setFlashId(p.id)
        }}
      />
      <PersonFormModal
        open={!!editPerson}
        onClose={() => setEditPerson(null)}
        person={editPerson}
        people={people}
        regions={regions}
      />
    </div>
  )
}
