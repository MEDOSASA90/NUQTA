import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowRight,
  BadgeCheck,
  CircleArrowOutDownLeft,
  CircleArrowOutUpRight,
  Copy,
  MapPin,
  NotebookPen,
  Pencil,
  Phone,
  Scale,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatMoney, toArabicDigits } from '@/lib/format'
import { trpc } from '@/providers/trpc'
import BalanceChip from '@/components/BalanceChip'
import EmptyState from '@/components/EmptyState'
import StatCard from '@/components/StatCard'
import PersonFormModal from '@/pages/grp-people/PersonFormModal'
import PairDrillDown from '@/pages/grp-people/PairDrillDown'
import PairStateChip from '@/pages/grp-people/PairStateChip'
import OpenableMarks from '@/pages/grp-people/OpenableMarks'
import SettledNoticeCard from '@/pages/grp-people/SettledNoticeCard'
import Toaster from '@/pages/grp-people/Toast'
import { toast } from '@/pages/grp-people/toast-bus'
import { ErrorBox, CardsSkeleton } from '@/pages/grp-people/PageStates'
import {
  avatarTone,
  canonicalPair,
  formatDate,
  formatMonthYear,
  formatPhoneInput,
  initialOf,
  nameKey,
  sinceLabel,
} from '@/pages/grp-people/helpers'
import type { BalanceRow } from '@contracts/afrah'

/**
 * بطاقة الشخص `/people/:id` (people.md §٢ — نسخة الصفحة الكاملة) —
 * رأس بالبيانات وتوثيق التليفون، ٣ StatCards لصافيه عبر الشبكة، إشعارات
 * «صفّى حسابه»، قائمة أرصدته الثنائية بـ drill-down لكل مرة،
 * timeline نقوطه في الاتجاهين (دفعه / اتسجّلت في فرحته)، وإجراءات سفلية.
 */

export default function PersonDetails() {
  const { id: idParam } = useParams()
  const personId = Number(idParam)
  const valid = Number.isInteger(personId) && personId > 0
  const navigate = useNavigate()

  const getQ = trpc.persons.get.useQuery({ id: personId }, { enabled: valid })
  const listQ = trpc.persons.list.useQuery()
  const eventsQ = trpc.events.list.useQuery()
  const noticesQ = trpc.balances.settledNotice.useQuery()

  const [openPair, setOpenPair] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const person = getQ.data?.person
  const net = getQ.data?.net
  const pairs = useMemo(() => getQ.data?.pairs ?? [], [getQ.data])
  const nuqtat = useMemo(() => getQ.data?.nuqtat ?? [], [getQ.data])

  const people = useMemo(() => listQ.data ?? [], [listQ.data])
  const regions = useMemo(
    () => [...new Set(people.map((p) => p.region.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ar')),
    [people],
  )

  const sameNameCount = useMemo(() => {
    if (!person) return 0
    const k = nameKey(person.name)
    return people.filter((p) => nameKey(p.name) === k).length - 1
  }, [people, person])

  // أفراحه هو (صاحب فرح) — لقسم «اتسجّلت له»
  const hisWeddings = useMemo(
    () => (eventsQ.data ?? []).filter((e) => e.hostPersonId === personId),
    [eventsQ.data, personId],
  )

  const myNotices = useMemo(
    () => (noticesQ.data ?? []).filter((n) => n.settlerId === personId).slice(0, 3),
    [noticesQ.data, personId],
  )

  // صف الإحصائيات المصغّرة (people.md §٢.٢)
  const mini = useMemo(() => {
    const paidTotal = nuqtat.reduce((s, n) => s + n.amount, 0)
    const receivedTotal = hisWeddings.reduce((s, e) => s + e.totalAmount, 0)
    let openFor = 0
    let openAgainst = 0
    for (const row of pairs) {
      if (row.net === 0) continue
      const mine = row.personAId === personId ? row.net : -row.net
      if (mine > 0) openFor += 1
      else openAgainst += 1
    }
    return { paidTotal, paidCount: nuqtat.length, receivedTotal, openFor, openAgainst }
  }, [nuqtat, hisWeddings, pairs, personId])

  // timeline في الاتجاهين (people.md §٢.٤)
  const timeline = useMemo(() => {
    const items: {
      key: string
      date: Date
      tone: 'gold' | 'olive' | 'crimson'
      text: string
      sub?: string
    }[] = []
    for (const n of nuqtat) {
      const edited = n.editedAfterDone
      items.push({
        key: `p-${n.id}`,
        date: new Date(n.eventDate),
        tone: edited ? 'crimson' : 'gold',
        text: `دفع ${formatMoney(n.amount)} ج.م في فرحة ${n.hostName}`,
        sub: `${formatDate(n.eventDate)}${n.invitedBy ? ` · دعاه: ${n.invitedBy}` : ''}${edited ? ' · عُدّلت بعد إتمام الفرح' : ''}`,
      })
    }
    for (const e of hisWeddings) {
      items.push({
        key: `h-${e.id}`,
        date: new Date(e.eventDate),
        tone: 'olive',
        text: `فرحته هو: استلم ${toArabicDigits(e.nuqtatCount)} نقطة بإجمالي ${formatMoney(e.totalAmount)} ج.م`,
        sub: `${formatDate(e.eventDate)}${e.place ? ` · ${e.place}` : ''}`,
      })
    }
    return items.sort((a, b) => b.date.getTime() - a.date.getTime())
  }, [nuqtat, hisWeddings])

  if (!valid) {
    return <ErrorBox message="رابط غير صحيح" />
  }

  if (getQ.isLoading) {
    return (
      <div className="flex flex-col gap-5">
        <div className="surface-card h-44 animate-pulse p-6">
          <div className="flex items-center gap-4">
            <div className="size-16 rounded-full bg-paper-sunken" />
            <div className="flex-1">
              <div className="h-5 w-48 rounded-full bg-paper-sunken" />
              <div className="mt-2 h-3.5 w-64 rounded-full bg-paper-sunken" />
            </div>
          </div>
        </div>
        <CardsSkeleton count={3} />
      </div>
    )
  }

  if (getQ.isError || !person) {
    return (
      <div className="flex flex-col gap-5">
        <BackLink />
        {getQ.error?.data?.code === 'NOT_FOUND' ? (
          <EmptyState
            image="/empty-search.svg"
            title="الشخص ده مش موجود في الدفتر"
            description="يمكن اتحذف أو الرابط اتغيّر — ارجع لقائمة الأشخاص ودوّر عليه"
            actionLabel="كل الأشخاص"
            actionHref="/people"
          />
        ) : (
          <ErrorBox error={getQ.error} message={getQ.error?.message} onRetry={() => getQ.refetch()} />
        )}
      </div>
    )
  }

  const copyPhone = () => {
    navigator.clipboard?.writeText(person.phone).catch(() => {})
    toast(`اتنسخ ${formatPhoneInput(person.phone)}`, 'copy')
  }

  return (
    <div className="flex flex-col gap-5 pb-24">
      <Toaster />
      <BackLink />

      {/* ─── رأس البطاقة ─── */}
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
        className="surface-card relative overflow-hidden bg-[#FBF5E6] p-6"
      >
        <div className="pattern-festive pointer-events-none absolute inset-0 opacity-[0.05]" aria-hidden />
        <div className="relative flex flex-wrap items-center gap-5">
          <motion.span
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.05 }}
            className={cn(
              'flex size-16 shrink-0 items-center justify-center rounded-full font-kufi font-bold text-[26px]',
              avatarTone(person.id),
            )}
          >
            {initialOf(person.name)}
          </motion.span>
          <div className="min-w-0 flex-1">
            <h1 className="font-kufi font-bold text-[22px] leading-8 text-ink-900">{person.name}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-700">
              {person.region.trim() && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5 text-ink-400" />
                  {person.region}
                </span>
              )}
              <button
                type="button"
                onClick={copyPhone}
                title="اضغط للنسخ"
                className="group inline-flex items-center gap-1.5 rounded-md px-1 transition-colors hover:bg-primary-50"
              >
                <Phone className="size-3.5 text-ink-400" />
                <span className="num-ltr">{formatPhoneInput(person.phone)}</span>
                <Copy className="size-3 text-ink-400 transition-colors group-hover:text-primary-600" />
              </button>
              <span className="text-ink-500">في الدفتر من {formatMonthYear(person.createdAt)}</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {person.phoneVerified ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-laha-bg px-2.5 py-1 text-[11.5px] font-medium text-laha-text">
                  <BadgeCheck className="size-3.5" />
                  تليفون مُتحقق منه
                </span>
              ) : (
                <VerifyButton personId={person.id} />
              )}
              {person.nuqtaId && (
                <span className="inline-flex items-center rounded-full bg-primary-100 px-2.5 py-1 text-[11.5px] font-medium text-primary-700">
                  {person.nuqtaId}
                </span>
              )}
              {sameNameCount > 0 && (
                <span className="inline-flex items-center rounded-full bg-partial-bg px-2.5 py-1 text-[11.5px] font-medium text-partial-text">
                  في {sameNameCount === 1 ? 'واحد تاني' : `${toArabicDigits(sameNameCount)} غيره`} بنفس الاسم
                  {person.region.trim() ? ` — ده صاحب ${person.region}` : ' — ميّزه بالتليفون'}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="inline-flex items-center gap-2 rounded-[10px] border border-line-strong bg-paper-surface px-4 py-2.5 text-[13.5px] font-medium text-ink-700 transition-colors hover:bg-primary-50"
            >
              <Pencil className="size-4" />
              تعديل البيانات
            </button>
            <button
              type="button"
              onClick={() => navigate('/nuqta/new')}
              className="inline-flex items-center gap-2 rounded-[10px] bg-primary-500 px-[18px] py-2.5 text-[14px] font-semibold text-[#FFFDF8] shadow-card transition-all hover:bg-primary-600 hover:-translate-y-px active:bg-primary-700 active:scale-[0.97]"
            >
              <NotebookPen className="size-4" />
              سجّل نقطة له
            </button>
          </div>
        </div>
      </motion.section>

      {/* ─── صافيه الكلي عبر الشبكة ─── */}
      {net && (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard title="إجمالي اللي له عند الناس" value={net.totalFor} suffix="ج.م" icon={CircleArrowOutDownLeft} tone="olive" index={0} />
          <StatCard title="إجمالي اللي عليه للناس" value={net.totalAgainst} suffix="ج.م" icon={CircleArrowOutUpRight} tone="brick" index={1} />
          <StatCard
            title="الصافي الكلي"
            value={Math.abs(net.net)}
            suffix={net.net > 0 ? 'ج.م له' : net.net < 0 ? 'ج.م عليه' : 'ج.م'}
            icon={Scale}
            tone={net.net > 0 ? 'olive' : net.net < 0 ? 'brick' : 'primary'}
            index={2}
          />
        </div>
      )}

      {/* ─── صف الإحصائيات المصغّرة ─── */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.38, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        className="surface-card flex flex-wrap items-center gap-x-8 gap-y-2 px-5 py-4 text-[13px] text-ink-700"
      >
        <span>
          إجمالي اللي دفعه:{' '}
          <strong className="num-ltr font-bold text-ink-900">{formatMoney(mini.paidTotal)} ج.م</strong>{' '}
          <span className="text-ink-500">({toArabicDigits(mini.paidCount)} {mini.paidCount === 1 ? 'نقطة' : 'نقوط'})</span>
        </span>
        <span>
          اللي اتسجّل في أفراحه:{' '}
          <strong className="num-ltr font-bold text-ink-900">{formatMoney(mini.receivedTotal)} ج.م</strong>
        </span>
        <span>
          أرصدة مفتوحة:{' '}
          <strong className="num-ltr font-bold text-ink-900">{toArabicDigits(mini.openFor + mini.openAgainst)}</strong>{' '}
          <span className="text-ink-500">
            (له <span className="text-laha-text font-medium">{toArabicDigits(mini.openFor)}</span> / عليه{' '}
            <span className="text-aleh-text font-medium">{toArabicDigits(mini.openAgainst)}</span>)
          </span>
        </span>
      </motion.div>

      {/* ─── إشعارات «صفّى حسابه» ─── */}
      {myNotices.length > 0 && (
        <section className="flex flex-col gap-3">
          {myNotices.map((n, i) => (
            <SettledNoticeCard key={`${n.eventId}-${n.settlerId}-${i}`} notice={n} index={i} />
          ))}
        </section>
      )}

      {/* ─── أرصدته مع الناس ─── */}
      <section className="flex flex-col gap-3">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
        >
          <h2 className="font-kufi font-semibold text-[17px] leading-6 text-ink-900">أرصدته مع الناس</h2>
          <p className="mt-0.5 text-[12.5px] text-ink-500">
            كل حساب بينه وبين شخص تاني — اضغط على علامات / لتفاصيل كل مرة
          </p>
        </motion.div>

        {pairs.length === 0 ? (
          <EmptyState
            image="/empty-ledger.svg"
            title="مفيش أرصدة لسه"
            description="أول ما يدفع نقطة في فرحة حد — أو حد يدفع في فرحته — هيظهر الحساب هنا"
          />
        ) : (
          <div className="flex flex-col gap-2.5">
            {pairs.map((row, i) => (
              <PairCard
                key={`${row.personAId}:${row.personBId}`}
                row={row}
                personId={personId}
                index={i}
                open={openPair === `${row.personAId}:${row.personBId}`}
                onToggle={() =>
                  setOpenPair((cur) => (cur === `${row.personAId}:${row.personBId}` ? null : `${row.personAId}:${row.personBId}`))
                }
                onOpenPerson={(id) => navigate(`/people/${id}`)}
              />
            ))}
          </div>
        )}
      </section>

      {/* ─── تاريخه في الأفراح ─── */}
      <section className="flex flex-col gap-3">
        <motion.h2
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
          className="font-kufi font-semibold text-[17px] leading-6 text-ink-900"
        >
          تاريخه في الأفراح
        </motion.h2>
        {timeline.length === 0 ? (
          <EmptyState
            image="/empty-ledger.svg"
            title="لسه مفيش نقوط باسمه"
            description="سجّل أول نقطة له من صفحة التسجيل — وهتلاقي تاريخه هنا"
            actionLabel="سجّل نقطة"
            actionHref="/nuqta/new"
          />
        ) : (
          <div className="surface-card p-5">
            <ol className="relative border-e-2 border-line-strong pe-5">
              {timeline.map((t, i) => (
                <motion.li
                  key={t.key}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, amount: 0.6 }}
                  transition={{ duration: 0.3, delay: Math.min(i, 8) * 0.05 }}
                  className="relative pb-5 last:pb-0"
                >
                  <motion.span
                    initial={{ scale: 0 }}
                    whileInView={{ scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ type: 'spring', stiffness: 420, damping: 22, delay: Math.min(i, 8) * 0.06 }}
                    className={cn(
                      'absolute -end-[26.5px] top-1 size-3 rounded-full border-2 border-paper-surface',
                      t.tone === 'gold' && 'bg-gold-500',
                      t.tone === 'olive' && 'bg-laha-solid',
                      t.tone === 'crimson' && 'bg-redink',
                    )}
                    aria-hidden
                  />
                  <div className="text-[13.5px] font-medium leading-6 text-ink-900">{t.text}</div>
                  {t.sub && <div className="text-[12px] text-ink-500">{t.sub}</div>}
                  {t.tone === 'crimson' && (
                    <span className="mt-1 inline-flex items-center rounded-full bg-redink-bg px-2 py-0.5 text-[10.5px] font-medium text-redink">
                      بعد الفرح
                    </span>
                  )}
                </motion.li>
              ))}
            </ol>
          </div>
        )}
      </section>

      {/* ─── إجراءات سفلية ثابتة ─── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.34, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="sticky bottom-20 z-30 md:bottom-6"
      >
        <div className="surface-card flex flex-wrap items-center gap-2 border-line-strong/60 p-3 shadow-[0_2px_6px_rgba(74,58,35,.08),0_24px_64px_-16px_rgba(74,58,35,.22)]">
          <button
            type="button"
            onClick={() => navigate('/nuqta/new')}
            className="inline-flex items-center gap-2 rounded-[10px] bg-primary-500 px-[18px] py-2.5 text-[13.5px] font-semibold text-[#FFFDF8] shadow-card transition-all hover:bg-primary-600 active:scale-[0.97]"
          >
            <NotebookPen className="size-4" />
            سجّل نقطة له
          </button>
          <Link
            to={`/balances?q=${encodeURIComponent(person.name)}`}
            className="inline-flex items-center gap-2 rounded-[10px] border border-line-strong px-4 py-2.5 text-[13.5px] font-medium text-ink-700 transition-colors hover:bg-primary-50"
          >
            <Scale className="size-4" />
            افتح كل أرصدته في صفحة الأرصدة
          </Link>
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="ms-auto inline-flex items-center gap-1.5 rounded-[10px] border border-[#E3C4B8] px-3.5 py-2.5 text-[13px] font-medium text-destructive transition-colors hover:bg-redink-bg"
          >
            <Trash2 className="size-3.5" />
            حذف من الدفتر
          </button>
        </div>
      </motion.div>

      {/* مودالات */}
      <PersonFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        person={person}
        people={people}
        regions={regions}
      />
      <PersonFormModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        person={person}
        people={people}
        regions={regions}
        initialStep="delete-confirm"
        onDeleted={() => navigate('/people')}
      />
    </div>
  )
}

function BackLink() {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <Link
        to="/people"
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[13px] font-medium text-ink-500 transition-colors hover:bg-primary-50 hover:text-primary-600"
      >
        <ArrowRight className="size-4" />
        كل الأشخاص
      </Link>
    </motion.div>
  )
}

/** زر توثيق التليفون من رأس البطاقة */
function VerifyButton({ personId }: { personId: number }) {
  const utils = trpc.useUtils()
  const mut = trpc.persons.verifyPhone.useMutation({
    onSuccess: async () => {
      toast('تم توثيق رقم التليفون')
      await Promise.all([
        utils.persons.get.invalidate({ id: personId }),
        utils.persons.list.invalidate(),
        utils.persons.search.invalidate(),
      ])
    },
    onError: (e) => toast(e.message, 'error'),
  })
  return (
    <button
      type="button"
      onClick={() => mut.mutate({ id: personId, verified: true })}
      disabled={mut.isPending}
      title="اعتمد الرقم «مُتحقق منه» — لازم قبل رسايل واتساب"
      className="inline-flex items-center gap-1 rounded-full bg-open-bg px-2.5 py-1 text-[11.5px] font-medium text-open-text transition-colors hover:bg-laha-bg hover:text-laha-text disabled:opacity-60"
    >
      <ShieldCheck className="size-3.5" />
      التليفون غير موثّق — وثّقه
    </button>
  )
}

/** بطاقة رصيد ثنائي في قائمة «أرصدته مع الناس» */
function PairCard({
  row,
  personId,
  index,
  open,
  onToggle,
  onOpenPerson,
}: {
  row: BalanceRow
  personId: number
  index: number
  open: boolean
  onToggle: () => void
  onOpenPerson: (id: number) => void
}) {
  const isA = row.personAId === personId
  const otherId = isA ? row.personBId : row.personAId
  const otherName = isA ? row.personBName : row.personAName
  const otherRegion = isA ? row.personBRegion : row.personARegion
  const net = isA ? row.net : -row.net
  const { a, b } = canonicalPair(row.personAId, row.personBId)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay: Math.min(index, 10) * 0.05, ease: [0.22, 1, 0.36, 1] }}
      className={cn('surface-card overflow-hidden', row.status === 'settled' && 'opacity-75')}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
        <button
          type="button"
          onClick={() => onOpenPerson(otherId)}
          className="group flex min-w-0 items-center gap-2.5 text-start"
          title={`فتح بطاقة ${otherName}`}
        >
          <span
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-full font-kufi font-bold text-[13px]',
              avatarTone(otherId),
            )}
          >
            {initialOf(otherName)}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-kufi font-semibold text-[14px] text-ink-900 transition-colors group-hover:text-primary-600">
              {otherName}
            </span>
            {otherRegion && (
              <span className="mt-0.5 flex items-center gap-1 text-[11.5px] text-ink-500">
                <MapPin className="size-3" />
                {otherRegion}
              </span>
            )}
          </span>
        </button>

        <div className="ms-auto flex flex-wrap items-center gap-x-4 gap-y-2">
          <BalanceChip amount={net} size="sm" />
          <OpenableMarks count={row.interactions} open={open} onToggle={onToggle} />
          <PairStateChip
            status={row.status}
            sinceLabel={sinceLabel(row.lastInteractionAt)}
            paidAmount={Math.min(row.aPaidToB, row.bPaidToA)}
            totalAmount={Math.max(row.aPaidToB, row.bPaidToA)}
            overAmount={Math.abs(row.net)}
          />
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open && <PairDrillDown a={a} b={b} perspectiveId={personId} />}
      </AnimatePresence>
    </motion.div>
  )
}
