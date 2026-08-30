/**
 * تسجيل نقطة — record-nuqta.md: شاشة العمل ليلة الفرح.
 * نموذج واحد بلا خطوات: الفرح (القادمة أولًا) + الدافع (PersonCombobox) +
 * المبلغ + «مين دعاه» + معاينة حية لحالة السداد (tRPC previewSettlement)
 * + فقاعة واتساب + ذرات ذهبية + Ctrl+Enter للحفظ + شريط آخر الإدخالات.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Check,
  CheckCheck,
  ChevronDown,
  ExternalLink,
  MapPin,
  NotebookPen,
  Undo2,
  X,
} from 'lucide-react'
import { keepPreviousData } from '@tanstack/react-query'
import { trpc } from '@/providers/trpc'
import PersonCombobox from '@/components/PersonCombobox'
import StateStamp from '@/components/StateStamp'
import EmptyState from '@/components/EmptyState'
import { cn } from '@/lib/utils'
import { formatArabicDate, formatMoney, toArabicDigits } from '@/lib/format'
import { CardSkeleton, ErrorState, GoldParticles, Kbd, QuickAddPersonModal, Skeleton, ToastProvider } from '@/pages/grp-kit'
import { daysLeftLabel, daysUntil, EASE, parseAmountInput, timeAgo, useToast } from '@/pages/grp-utils'

/* ─────────── أشكال مساعدة ─────────── */

type ComboPerson = { id: string; name: string; phone: string; region: string; nuqtaId?: string | null }

const QUICK_AMOUNTS = [500, 1000, 1500, 2000, 5000]

const AVATAR_TONES = [
  'bg-primary-100 text-primary-700',
  'bg-gold-100 text-gold-600',
  'bg-laha-bg text-laha-text',
  'bg-partial-bg text-partial-text',
]

/** أي عنصر منبثق مفتوح حاليًا (قائمة/مودال) — يمنع اختصارات الصفحة */
function anyOverlayOpen(): boolean {
  return Boolean(document.querySelector('[role="listbox"], [role="dialog"]'))
}

/* ─────────── بطاقة الشخص المثبتة بعد الاختيار ─────────── */

function PinnedPerson({ person, onClear, tone }: { person: ComboPerson; onClear: () => void; tone: string }) {
  return (
    <motion.div
      initial={{ scale: 0.94, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 380, damping: 24 }}
      className="flex items-center gap-3 rounded-[10px] border border-primary-300 bg-primary-50 px-3.5 py-3"
    >
      <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-full font-kufi font-bold text-[14px]', tone)}>
        {person.name.trim().charAt(0)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-kufi font-semibold text-[15px] text-ink-900">{person.name}</span>
        <span className="mt-0.5 flex items-center gap-2 text-[12px] text-ink-500">
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3" />
            {person.region || 'بدون منطقة'}
          </span>
          <span className="num-ltr">{person.phone}</span>
        </span>
      </span>
      <button
        type="button"
        onClick={onClear}
        aria-label="تغيير الشخص"
        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-ink-500 transition-colors hover:bg-paper-surface hover:text-redink"
      >
        <X className="size-4" />
      </button>
    </motion.div>
  )
}

/* ─────────── فقاعة معاينة واتساب ─────────── */

function WhatsappBubble({ lines }: { lines: string[] }) {
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.24, ease: EASE }}
      className="relative rounded-[14px] rounded-tr-[4px] border border-[#CBE0CE] bg-whatsapp-bg px-4 py-3"
    >
      <span className="absolute -top-px right-4 size-2.5 rotate-45 border-l border-t border-[#CBE0CE] bg-whatsapp-bg" aria-hidden />
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-whatsapp">
        <CheckCheck className="size-3.5" />
        الرسالة اللي هتوصل للدافع
      </div>
      <div className="whitespace-pre-line text-[13px] leading-[22px] text-ink-700">{lines.join('\n')}</div>
    </motion.div>
  )
}

/* ═══════════ الصفحة ═══════════ */

function RecordNuqtaInner() {
  const toast = useToast()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const utils = trpc.useUtils()

  /* البيانات */
  const eventsQ = trpc.events.list.useQuery({ filter: 'all' })
  const personsQ = trpc.persons.list.useQuery()
  const [personSearch, setPersonSearch] = useState('')
  const globalPeopleQ = trpc.persons.searchGlobal.useQuery(
    { query: personSearch.trim(), limit: 10 },
    { enabled: personSearch.trim().length >= 2 },
  )
  const recentQ = trpc.nuqtat.listRecent.useQuery({ limit: 5 })

  const events = useMemo(() => eventsQ.data ?? [], [eventsQ.data])
  const upcoming = useMemo(() => events.filter((e) => e.status === 'upcoming'), [events])

  /* الحالة */
  const paramEvent = Number(searchParams.get('event') ?? 0) || null
  const [manualEventId, setManualEventId] = useState<number | null>(paramEvent)
  const [otherOpen, setOtherOpen] = useState(false)
  const [payer, setPayer] = useState<ComboPerson | null>(null)
  const [amountRaw, setAmountRaw] = useState('')
  const [invitedBy, setInvitedBy] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [addName, setAddName] = useState('')
  const [burstKey, setBurstKey] = useState(0)
  const [savedOk, setSavedOk] = useState(false)
  const [debouncedAmount, setDebouncedAmount] = useState<number | null>(null)
  const amountRef = useRef<HTMLInputElement>(null)
  const lastSubmittedAmount = useRef(0)
  const matrixQ = trpc.balances.matrix.useQuery(undefined, { enabled: Boolean(payer) })

  /* الفرح المختار: اليدوي أو أقرب قادمة */
  const selectedEvent = useMemo(() => {
    if (manualEventId) {
      const found = events.find((e) => e.id === manualEventId)
      if (found) return found
    }
    return upcoming[0] ?? events[0] ?? null
  }, [events, upcoming, manualEventId])

  /* الأشخاص لصندوق البحث */
  const comboPeople: ComboPerson[] = useMemo(
    () => (personsQ.data ?? []).map((p) => ({ id: String(p.id), name: p.name, phone: p.phone, region: p.region, nuqtaId: p.nuqtaId })),
    [personsQ.data],
  )
  const globalComboPeople: ComboPerson[] = useMemo(
    () => (globalPeopleQ.data ?? [])
      .filter((p) => p.nuqtaId !== null)
      .map((p) => ({ id: `global:${p.nuqtaId}`, name: p.name, phone: p.phone, region: p.region, nuqtaId: p.nuqtaId })),
    [globalPeopleQ.data],
  )
  const regions = useMemo(
    () => [...new Set((personsQ.data ?? []).map((p) => p.region).filter(Boolean))].sort(),
    [personsQ.data],
  )

  const hostId = selectedEvent?.hostPersonId ?? null

  /* أرصدة الأشخاص مع صاحب الفرح (لشرائح البحث) */
  const balancesProp = useMemo(() => {
    const matrix = matrixQ.data
    if (!matrix || !hostId) return {}
    const out: Record<string, number> = {}
    for (const row of matrix) {
      if (row.personAId === hostId) out[String(row.personBId)] = -row.net
      else if (row.personBId === hostId) out[String(row.personAId)] = row.net
    }
    return out
  }, [matrixQ.data, hostId])

  /* رصيد الدافع المختار مع صاحب الفرح + عدد التفاعلات */
  const payerPair = useMemo(() => {
    const matrix = matrixQ.data
    if (!matrix || !hostId || !payer) return null
    const pid = Number(payer.id)
    if (!Number.isInteger(pid)) return null
    const row = matrix.find(
      (r) => (r.personAId === pid && r.personBId === hostId) || (r.personBId === pid && r.personAId === hostId),
    )
    if (!row) return null
    const net = row.personAId === pid ? row.net : -row.net
    return { net, interactions: row.interactions }
  }, [matrixQ.data, hostId, payer])

  /* المبلغ + debounce للمعاينة */
  const amount = useMemo(() => parseAmountInput(amountRaw), [amountRaw])
  const localPayerId = payer && !payer.id.startsWith('global:') ? Number(payer.id) : 0
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedAmount(amount), 150)
    return () => window.clearTimeout(t)
  }, [amount])

  const previewEnabled = Boolean(selectedEvent && localPayerId > 0 && debouncedAmount && debouncedAmount > 0)
  const previewQ = trpc.nuqtat.previewSettlement.useQuery(
    {
      eventId: selectedEvent?.id ?? 0,
      payerPersonId: localPayerId,
      amount: debouncedAmount ?? 0,
    },
    { enabled: previewEnabled, placeholderData: keepPreviousData },
  )
  const preview = previewEnabled ? previewQ.data : undefined

  /* تفريغ النموذج */
  const clearForm = useCallback(() => {
    setPayer(null)
    setAmountRaw('')
    setInvitedBy('')
  }, [])

  /* الحفظ */
  const createNuqta = trpc.nuqtat.create.useMutation({
    onSuccess: async (res) => {
      setBurstKey((k) => k + 1)
      setSavedOk(true)
      window.setTimeout(() => setSavedOk(false), 900)
      const savedAmount = res.nuqta?.amount ?? lastSubmittedAmount.current
      toast(
        'success',
        res.whatsappNotified
          ? `اتسجلت نقطة ${formatMoney(savedAmount)} ج.م ✓ والتأكيد في طريقه لواتساب`
          : `اتسجلت نقطة ${formatMoney(savedAmount)} ج.م ✓ (من غير إشعار واتساب)`,
      )
      clearForm()
      void Promise.all([
        utils.nuqtat.listRecent.invalidate(),
        utils.nuqtat.previewSettlement.invalidate(),
        utils.events.list.invalidate(),
        utils.dashboard.stats.invalidate(),
        utils.balances.matrix.invalidate(),
      ])
    },
    onError: (e) => toast('error', e.message || 'حصل خطأ أثناء التسجيل — حاول تاني'),
  })

  const linkGlobalPerson = trpc.persons.create.useMutation()

  const canSave = Boolean(selectedEvent && payer && amount && amount > 0) && !createNuqta.isPending && !linkGlobalPerson.isPending

  const submit = useCallback(async () => {
    if (!selectedEvent || !payer || !amount || amount <= 0 || createNuqta.isPending || linkGlobalPerson.isPending) return
    lastSubmittedAmount.current = amount
    try {
      const linkedPerson = payer.id.startsWith('global:')
        ? await linkGlobalPerson.mutateAsync({
            name: payer.name,
            phone: payer.phone,
            region: payer.region,
            nuqtaId: payer.nuqtaId ?? undefined,
          })
        : null
      const payerPersonId = linkedPerson?.id ?? Number(payer.id)
      if (!Number.isInteger(payerPersonId) || payerPersonId <= 0) return
      createNuqta.mutate({ eventId: selectedEvent.id, payerPersonId, amount, invitedBy: invitedBy.trim() })
    } catch (error: unknown) {
      toast('error', error instanceof Error ? error.message : 'تعذر ربط الشخص بالدفتر الحالي')
    }
  }, [selectedEvent, payer, amount, invitedBy, createNuqta, linkGlobalPerson, toast])

  /* اختصارات: Ctrl+Enter حفظ، Esc مسح */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        if (anyOverlayOpen()) return
        e.preventDefault()
        submit()
      } else if (e.key === 'Escape' && !anyOverlayOpen()) {
        clearForm()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [submit, clearForm])

  /* تراجع عن نقطة (قبل إرسال إشعارها) */
  const deleteNuqta = trpc.nuqtat.delete.useMutation({
    onSuccess: async () => {
      toast('info', 'اتراجع عن النقطة — مفيش إشعار اتبعت')
      await Promise.all([
        utils.nuqtat.listRecent.invalidate(),
        utils.events.list.invalidate(),
        utils.dashboard.stats.invalidate(),
        utils.balances.matrix.invalidate(),
      ])
    },
    onError: (e) => toast('error', e.message),
  })

  /* تنسيق المبلغ بفواصل أثناء الكتابة */
  const onAmountChange = (raw: string) => {
    const n = parseAmountInput(raw)
    if (raw.trim() === '') setAmountRaw('')
    else if (n !== null) setAmountRaw(formatMoney(n))
  }

  /* نص فقاعة الواتساب المتوقع */
  const bubbleLines = useMemo(() => {
    if (!preview || !payer || !selectedEvent || !amount) return null
    const host = selectedEvent.hostName
    const lines = [
      `تمام يا ${payer.name} ✅`,
      `اتسجلت نقطتك في فرحة ${host} يوم ${formatArabicDate(new Date(selectedEvent.eventDate))} بمبلغ ${formatMoney(amount)} ج.م.`,
    ]
    if (preview.status === 'new') lines.push('مفيش حساب سابق بينكم — النقطة اتفتحت جديدة.')
    else if (preview.status === 'partial') lines.push(`سددت من حسابك مع ${host} — باقي عليك ${formatMoney(preview.remaining)} ج.م.`)
    else if (preview.status === 'settled') lines.push(`صفّيت حسابك مع ${host} بالكامل — مفيش باقي لا ليك ولا عليك. 🎉`)
    else lines.push(`صفّيت اللي كان عليك (${formatMoney(preview.outstandingBefore)} ج.م) وزاد ${formatMoney(preview.overpaid)} ج.م — بقى رصيد ليك عند ${host}.`)
    lines.push('— أفراح الجمعية')
    return lines
  }, [preview, payer, selectedEvent, amount])

  /* ─────────── حالات التحميل/الخطأ ─────────── */
  if (eventsQ.isLoading || personsQ.isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-7"><CardSkeleton lines={7} /></div>
        <div className="xl:col-span-5"><CardSkeleton lines={6} /></div>
      </div>
    )
  }
  if (eventsQ.error || personsQ.error) {
    return <ErrorState error={eventsQ.error ?? personsQ.error} onRetry={() => { void eventsQ.refetch(); void personsQ.refetch() }} />
  }
  if (events.length === 0) {
    return (
      <div className="surface-card">
        <EmptyState
          title="لسه مفيش أفراح متسجلة"
          description="النقطة لازم تتسجل في فرحة — اعمل أول فرحة وبعدين ارجع سجّل أول نقطة"
          actionLabel="إنشاء فرحة"
          actionHref="/weddings"
        />
      </div>
    )
  }

  const segEvents = upcoming.slice(0, 3)
  const inSeg = selectedEvent ? segEvents.some((e) => e.id === selectedEvent.id) : false
  const today = new Date()
  const sessionIsToday = selectedEvent ? new Date(selectedEvent.eventDate).toDateString() === today.toDateString() : false
  const lastEntry = recentQ.data?.[0]

  return (
    <div className="flex flex-col gap-5">
      {/* ── شريط جلسة الفرح ── */}
      {selectedEvent && (
        <motion.div
          initial={{ y: -56, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.35, ease: EASE }}
          className="sticky top-20 z-30 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-[#3A3026] px-4 py-3 text-[#F6F1E7] shadow-pop"
        >
          <span className="flex items-center gap-2 font-kufi font-semibold text-[14px]">
            <motion.span
              animate={sessionIsToday ? { opacity: [1, 0.4, 1] } : undefined}
              transition={sessionIsToday ? { duration: 2, repeat: Infinity } : undefined}
              className={cn('size-2.5 rounded-full', sessionIsToday ? 'bg-[#7FB069]' : 'bg-gold-500')}
            />
            فرحة {selectedEvent.hostName}
            {sessionIsToday ? ' — جاري التسجيل' : selectedEvent.status === 'upcoming' ? ` — ${daysLeftLabel(daysUntil(new Date(selectedEvent.eventDate)))}` : ' — تمت'}
          </span>
          <span className="hidden h-5 w-px bg-[#F6F1E7]/25 sm:block" aria-hidden />
          <span className="text-[13px]">
            <motion.span key={selectedEvent.nuqtatCount} initial={{ color: '#C29B3C' }} animate={{ color: '#F6F1E7' }} transition={{ duration: 0.5 }} className="num-ltr font-bold">
              {selectedEvent.nuqtatCount}
            </motion.span>{' '}
            نقطة · إجمالي{' '}
            <motion.span key={selectedEvent.totalAmount} initial={{ color: '#C29B3C' }} animate={{ color: '#F6F1E7' }} transition={{ duration: 0.5 }} className="num-ltr font-bold">
              {formatMoney(selectedEvent.totalAmount)}
            </motion.span>{' '}
            ج.م
          </span>
          {lastEntry && <span className="hidden text-[12px] text-[#F6F1E7]/70 lg:inline">آخر إدخال {timeAgo(new Date(lastEntry.createdAt))} — {lastEntry.payerName}</span>}
          <span className="ms-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setManualEventId(null)}
              className="rounded-lg px-3 py-1.5 text-[12.5px] font-medium text-[#F6F1E7]/85 transition-colors hover:bg-white/10"
            >
              إنهاء الجلسة
            </button>
            <button
              type="button"
              onClick={() => navigate(`/weddings/${selectedEvent.id}`)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-[12.5px] font-semibold transition-colors hover:bg-white/20"
            >
              <ExternalLink className="size-3.5" />
              افتح الفرح
            </button>
          </span>
        </motion.div>
      )}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        {/* ── نموذج التسجيل ── */}
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: EASE }}
          className="surface-card p-5 md:p-6 xl:col-span-7"
        >
          {/* المجموعة ١: أنهي فرحة؟ */}
          <div>
            <span className="mb-2 block text-[13px] font-medium text-ink-700">أنهي فرحة؟</span>
            <div className="flex flex-wrap items-stretch gap-2 rounded-xl bg-paper-sunken p-1.5">
              {segEvents.map((ev) => {
                const active = selectedEvent?.id === ev.id
                return (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => setManualEventId(ev.id)}
                    className={cn(
                      'relative flex-1 min-w-[140px] rounded-[10px] px-3.5 py-2 text-start transition-colors',
                      active ? 'text-[#FFFDF8]' : 'text-ink-700 hover:bg-primary-50',
                    )}
                  >
                    {active && <motion.span layoutId="nuqta-event-pill" transition={{ duration: 0.18 }} className="absolute inset-0 rounded-[10px] bg-primary-500 shadow-card" />}
                    <span className="relative block truncate font-kufi font-semibold text-[13.5px]">{ev.hostName}</span>
                    <span className={cn('relative block text-[11.5px]', active ? 'text-[#FFFDF8]/85' : 'text-ink-500')}>
                      {formatArabicDate(new Date(ev.eventDate))}
                    </span>
                  </button>
                )
              })}
              {/* فرحة تانية… */}
              <div className="relative flex-1 min-w-[140px]">
                <button
                  type="button"
                  onClick={() => setOtherOpen((o) => !o)}
                  className={cn(
                    'relative flex h-full w-full items-center justify-between gap-2 rounded-[10px] px-3.5 py-2 text-start transition-colors',
                    selectedEvent && !inSeg ? 'text-[#FFFDF8]' : 'text-ink-700 hover:bg-primary-50',
                  )}
                >
                  {selectedEvent && !inSeg && (
                    <motion.span layoutId="nuqta-event-pill" transition={{ duration: 0.18 }} className="absolute inset-0 rounded-[10px] bg-primary-500 shadow-card" />
                  )}
                  <span className="relative min-w-0">
                    <span className="block truncate font-kufi font-semibold text-[13.5px]">
                      {selectedEvent && !inSeg ? selectedEvent.hostName : 'فرحة تانية…'}
                    </span>
                    <span className={cn('block text-[11.5px]', selectedEvent && !inSeg ? 'text-[#FFFDF8]/85' : 'text-ink-500')}>
                      {selectedEvent && !inSeg ? formatArabicDate(new Date(selectedEvent.eventDate)) : 'كل الأفراح'}
                    </span>
                  </span>
                  <ChevronDown className={cn('relative size-4 shrink-0 transition-transform', otherOpen && 'rotate-180')} />
                </button>
                <AnimatePresence>
                  {otherOpen && (
                    <motion.ul
                      role="listbox"
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.16, ease: EASE }}
                      className="absolute z-40 mt-2 max-h-[280px] w-full min-w-[220px] overflow-y-auto rounded-xl border border-line bg-paper-surface py-1 shadow-pop"
                    >
                      {events.map((ev) => (
                        <li key={ev.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setManualEventId(ev.id)
                              setOtherOpen(false)
                            }}
                            className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-start text-[13px] text-ink-700 transition-colors hover:bg-primary-50"
                          >
                            <span className="min-w-0">
                              <span className="block truncate font-kufi font-semibold text-ink-900">{ev.hostName}</span>
                              <span className="block text-[11.5px] text-ink-500">{formatArabicDate(new Date(ev.eventDate))}</span>
                            </span>
                            <span
                              className={cn(
                                'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium',
                                ev.status === 'upcoming' ? 'bg-gold-100 text-gold-600' : 'bg-open-bg text-open-text',
                              )}
                            >
                              {ev.status === 'upcoming' ? 'قادمة' : 'تمت'}
                            </span>
                          </button>
                        </li>
                      ))}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* المجموعة ٢: مين اللي دفع؟ */}
          <div className="mt-5">
            <span className="mb-2 flex items-center gap-1.5 text-[13px] font-medium text-ink-700">
              الدافع <span className="text-gold-500">*</span>
            </span>
            {payer ? (
              <>
                <PinnedPerson person={payer} tone={AVATAR_TONES[payer.id.startsWith('global:') ? 0 : Math.abs(Number(payer.id)) % AVATAR_TONES.length]} onClear={() => setPayer(null)} />
                <p className="mt-2 text-[12.5px] font-medium text-gold-600">
                  {hostId && payerPair
                    ? payerPair.net !== 0
                      ? <>رصيده الحالي مع {selectedEvent?.hostName}: {payerPair.net > 0 ? 'له' : 'عليه'} <span className="num-ltr font-bold">{formatMoney(payerPair.net)}</span> ج.م من {toArabicDigits(payerPair.interactions)} {payerPair.interactions === 1 ? 'مرة' : 'مرات'}</>
                      : `حسابه مع ${selectedEvent?.hostName} متصفّى — النقطة دي هتفتح حساب جديد`
                    : hostId
                      ? `مفيش حساب سابق بينه وبين ${selectedEvent?.hostName} — أول نقطة بينهم`
                      : 'صاحب الفرح مش مسجل كشخص في الدفتر — هيتفتح حساب جديد'}
                </p>
              </>
            ) : (
              <div className="relative">
                <PersonCombobox
                  people={comboPeople}
                  balances={balancesProp}
                  autoFocus
                  placeholder="اكتب الاسم… أول حرفين هيطلعوه"
                  onSelect={(p) => {
                    setPayer({ id: p.id, name: p.name, phone: p.phone, region: p.region, nuqtaId: p.nuqtaId })
                    window.setTimeout(() => amountRef.current?.focus(), 60)
                  }}
                  onAddNew={(name) => {
                    setAddName(name)
                    setAddOpen(true)
                  }}
                  onQueryChange={setPersonSearch}
                  globalPeople={globalComboPeople}
                />
              </div>
            )}
          </div>

          {/* المجموعة ٣: دفع كام؟ */}
          <div className="mt-5">
            <span className="mb-2 block text-[13px] font-medium text-ink-700">دفع كام؟</span>
            <div className="relative">
              <input
                ref={amountRef}
                value={amountRaw}
                onChange={(e) => onAmountChange(e.target.value)}
                inputMode="numeric"
                placeholder="0"
                aria-label="المبلغ بالجنيه"
                className="num-ltr h-16 w-full rounded-[10px] border border-line-strong bg-paper-surface px-4 text-center text-[28px] font-bold text-ink-900 placeholder:text-ink-400 focus:border-primary-500 focus:outline-none"
              />
              <span className="pointer-events-none absolute end-4 top-1/2 -translate-y-1/2 text-[14px] text-ink-500">ج.م</span>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {QUICK_AMOUNTS.map((q) => {
                const active = amount === q
                return (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setAmountRaw(formatMoney(q))}
                    className={cn(
                      'num-ltr rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-all duration-150',
                      active ? 'border-primary-500 bg-primary-100 text-primary-700' : 'border-line-strong text-ink-700 hover:bg-primary-50',
                    )}
                  >
                    {formatMoney(q)}
                  </button>
                )
              })}
              <button
                type="button"
                onClick={() => amountRef.current?.focus()}
                className="rounded-full border border-dashed border-line-strong px-3.5 py-1.5 text-[13px] text-ink-500 transition-colors hover:bg-primary-50"
              >
                أخرى…
              </button>
            </div>
          </div>

          {/* المجموعة ٤: مين دعاه؟ */}
          <div className="mt-5">
            <span className="mb-2 block text-[13px] font-medium text-ink-700">مين دعاه؟ (اختياري)</span>
            {invitedBy ? (
              <div className="flex items-center justify-between gap-2 rounded-[10px] border border-line bg-paper-base px-3.5 py-2.5">
                <span className="truncate text-[14px] font-medium text-ink-900">{invitedBy}</span>
                <button
                  type="button"
                  onClick={() => setInvitedBy('')}
                  aria-label="مسح الداعي"
                  className="flex size-7 shrink-0 items-center justify-center rounded-lg text-ink-500 transition-colors hover:bg-paper-surface hover:text-redink"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setInvitedBy('معرفة شخصية — من غير وسيط')}
                  className="mb-2 rounded-full border border-line-strong px-3 py-1 text-[12px] text-ink-500 transition-colors hover:bg-primary-50 hover:text-ink-700"
                >
                  معرفة شخصية — من غير وسيط
                </button>
                <PersonCombobox
                  people={comboPeople}
                  placeholder="مين اللي قاله يجي؟"
                  onSelect={(p) => setInvitedBy(p.name)}
                  onAddNew={(name) => setInvitedBy(name)}
                />
              </>
            )}
          </div>

          {/* أزرار الحفظ */}
          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-5">
            <motion.button
              type="button"
              onClick={submit}
              disabled={!canSave}
              whileTap={{ scale: 0.97 }}
              animate={
                canSave && !savedOk
                  ? { boxShadow: ['0 0 0 0 rgba(194,155,60,0)', '0 0 20px 3px rgba(194,155,60,.5)', '0 0 0 0 rgba(194,155,60,0)'] }
                  : { boxShadow: '0 0 0 0 rgba(194,155,60,0)' }
              }
              transition={canSave && !savedOk ? { duration: 2.4, repeat: Infinity } : { duration: 0.3 }}
              className={cn(
                'relative inline-flex h-[52px] flex-1 items-center justify-center gap-2 overflow-visible rounded-[10px] px-6 text-[15px] font-semibold transition-colors',
                savedOk ? 'bg-laha-solid text-[#FFFDF8]' : 'bg-primary-500 text-[#FFFDF8] hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              <GoldParticles burstKey={burstKey} />
              {savedOk ? <Check className="size-5" strokeWidth={2.6} /> : <NotebookPen className="size-[18px]" />}
              {createNuqta.isPending ? 'بيسجّل…' : savedOk ? 'اتسجلت ✓' : 'سجّل النقطة وابعت تأكيد واتساب'}
              {!savedOk && <Kbd className="border-white/25 bg-white/15 text-[#FFFDF8]">Ctrl Enter</Kbd>}
            </motion.button>
            <button
              type="button"
              onClick={clearForm}
              className="inline-flex items-center gap-2 rounded-[10px] px-4 py-3 text-[14px] font-medium text-primary-600 transition-colors hover:bg-primary-50"
            >
              مسح
              <Kbd>Esc</Kbd>
            </button>
          </div>
        </motion.section>

        {/* ── المعاينة الحية ── */}
        <motion.aside
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.08, ease: EASE }}
          className="xl:sticky xl:top-[7.5rem] xl:col-span-5"
        >
          <div className="rounded-xl border border-[#E3D3A3] bg-[#FBF5E6] p-5 shadow-card">
            <h3 className="font-kufi font-semibold text-[16px] text-ink-900">إيه اللي هيحصل بعد التسجيل؟</h3>

            {!payer || !amount ? (
              <div className="flex flex-col items-center py-6 text-center">
                <img src="/empty-ledger.svg" alt="" className="w-[150px] opacity-90 select-none" draggable={false} />
                <p className="mt-3 max-w-[260px] text-[13px] text-ink-500">اختار الدافع والمبلغ وهنشوف حالة الحساب فورًا</p>
              </div>
            ) : (
              <div className="mt-4 flex flex-col gap-4">
                {/* المعادلة الحسابية */}
                <div className="rounded-xl border border-line bg-paper-surface p-4 [background-image:repeating-linear-gradient(0deg,transparent,transparent_27px,#EFE8D8_27px,#EFE8D8_28px)]">
                  <div className="flex items-center justify-between text-[13.5px] leading-7 text-ink-700">
                    <span>رصيده الحالي مع {selectedEvent?.hostName}:</span>
                    {preview ? (
                      <motion.span key={`before-${preview.outstandingBefore}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} className="num-ltr font-bold text-ink-900">
                        {preview.outstandingBefore > 0 ? `عليه ${formatMoney(preview.outstandingBefore)} ج.م` : 'مفيش حساب'}
                      </motion.span>
                    ) : (
                      <Skeleton className="h-4 w-20" />
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[13.5px] leading-7 text-ink-700">
                    <span>النقطة الجديدة من {selectedEvent?.hostName}:</span>
                    <motion.span key={`amount-${amount}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} className="num-ltr font-bold text-laha-text">
                      + {formatMoney(amount)} ج.م
                    </motion.span>
                  </div>
                  <div className="mt-1.5 border-t border-dashed border-line-strong pt-1.5">
                    {preview ? (
                      <motion.p
                        key={`res-${preview.status}-${preview.remaining}-${preview.overpaid}`}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.18 }}
                        className={cn(
                          'font-kufi font-bold text-[14.5px] leading-7',
                          preview.status === 'settled' && 'text-laha-text',
                          preview.status === 'partial' && 'text-partial-text',
                          preview.status === 'overpaid' && 'text-over-text',
                          preview.status === 'new' && 'text-ink-700',
                        )}
                      >
                        {preview.status === 'settled' && 'النتيجة: صفا — هيصفّي حسابه معاك بالظبط ✓'}
                        {preview.status === 'partial' && <>النتيجة: سداد جزئي — باقي عليه <span className="num-ltr">{formatMoney(preview.remaining)}</span> ج.م</>}
                        {preview.status === 'overpaid' && <>النتيجة: زيادة <span className="num-ltr">{formatMoney(preview.overpaid)}</span> ج.م — تتسجل رصيد جديد «له»</>}
                        {preview.status === 'new' && 'النتيجة: نقطة جديدة — هيتفتح حساب بينكم'}
                      </motion.p>
                    ) : (
                      <p className="text-[12.5px] text-ink-400">{previewQ.isFetching ? 'بنحسب حالة الحساب…' : 'اكتب المبلغ كاملًا'}</p>
                    )}
                  </div>
                </div>

                {/* ختم الحالة المتوقعة */}
                {preview && (
                  <div className="flex justify-center py-1">
                    <StateStamp
                      key={`${preview.status}-${preview.remaining}-${preview.overpaid}`}
                      state={preview.status === 'new' ? 'open' : preview.status}
                      paidAmount={amount}
                      totalAmount={preview.outstandingBefore}
                      overAmount={preview.overpaid}
                      sinceLabel="أول نقطة بينكم"
                    />
                  </div>
                )}

                {/* فقاعة الواتساب */}
                {bubbleLines && <WhatsappBubble lines={bubbleLines} />}
              </div>
            )}
          </div>
        </motion.aside>
      </div>

      {/* ── شريط آخر الإدخالات ── */}
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.12, ease: EASE }}
        className="surface-card p-4"
      >
        <div className="flex items-center justify-between px-1">
          <h3 className="font-kufi font-semibold text-[14.5px] text-ink-900">آخر إدخالات الجلسة</h3>
          {recentQ.isFetching && <span className="text-[11.5px] text-ink-400">بيتحدث…</span>}
        </div>
        {recentQ.isLoading ? (
          <div className="mt-3 flex gap-3 overflow-hidden">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-14 w-56 shrink-0" />
            ))}
          </div>
        ) : !recentQ.data?.length ? (
          <p className="px-1 py-4 text-[13px] text-ink-400">لسه مفيش إدخالات — أول نقطة هتظهر هنا فور حفظها</p>
        ) : (
          <ul className="mt-3 flex gap-3 overflow-x-auto pb-1">
            <AnimatePresence initial={false}>
              {recentQ.data.map((n) => (
                <motion.li
                  key={n.id}
                  layout
                  initial={{ x: 40, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ scaleY: 0, opacity: 0 }}
                  transition={{ duration: 0.32, ease: EASE }}
                  className={cn(
                    'flex w-64 shrink-0 items-center gap-3 rounded-xl border px-3.5 py-2.5',
                    n.editedAfterDone ? 'border-redink/30 bg-redink-bg' : 'border-line bg-paper-base',
                  )}
                >
                  <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-full font-kufi font-bold text-[13px]', AVATAR_TONES[Math.abs(n.id) % AVATAR_TONES.length])}>
                    {n.payerName.trim().charAt(0)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-ink-900">{n.payerName}</span>
                    <span className="block text-[11.5px] text-ink-500">
                      <span className="num-ltr font-semibold text-ink-700">{formatMoney(n.amount)}</span> ج.م · {timeAgo(new Date(n.createdAt))}
                    </span>
                  </span>
                  {n.whatsappNotified ? (
                    <Link
                      to={`/weddings/${n.eventId}`}
                      title="اتبعت إشعار واتساب — التعديل من صفحة الفرح"
                      className="flex size-8 shrink-0 items-center justify-center rounded-lg text-whatsapp transition-colors hover:bg-whatsapp-bg"
                    >
                      <CheckCheck className="size-4" />
                    </Link>
                  ) : (
                    <button
                      type="button"
                      title="تراجع عن النقطة (لسه ماتبعتش إشعار)"
                      disabled={deleteNuqta.isPending}
                      onClick={() => deleteNuqta.mutate({ id: n.id })}
                      className="flex size-8 shrink-0 items-center justify-center rounded-lg text-ink-500 transition-colors hover:bg-redink-bg hover:text-redink disabled:opacity-50"
                    >
                      <Undo2 className="size-4" />
                    </button>
                  )}
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </motion.section>

      {/* مودال إضافة شخص */}
      <QuickAddPersonModal
        open={addOpen}
        initialName={addName}
        regions={regions}
        onClose={() => setAddOpen(false)}
        onCreated={(p) => {
          setPayer({ id: String(p.id), name: p.name, phone: p.phone, region: p.region })
        }}
      />
    </div>
  )
}

export default function RecordNuqta() {
  return (
    <ToastProvider>
      <RecordNuqtaInner />
    </ToastProvider>
  )
}
