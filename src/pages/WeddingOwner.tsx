import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { AnimatePresence, motion } from 'framer-motion'
import gsap from 'gsap'
import Lenis from 'lenis'
import {
  CalendarHeart,
  ChevronDown,
  Link2Off,
  Lock,
  MapPin,
  PenLine,
  Search,
  Sparkles,
  Users,
} from 'lucide-react'
import type { PublicWeddingRegion, PublicWeddingStatement } from '@contracts/afrah'
import { trpc } from '@/providers/trpc'
import { cn } from '@/lib/utils'
import { formatArabicDate, formatMoney, normalizeArabic, toArabicDigits } from '@/lib/format'

/**
 * صفحة صاحب الفرح — كشف حساب read-only برابط سري /w/:token (wedding-owner.md).
 * عامة تمامًا (خارج Layout)، mobile-first، روح احتفالية: نقشة مصرية خفيفة،
 * فاصل زخرفي، عدّاد GSAP للإجمالي، كشف مجمع بالمناطق قابل للطي،
 * وتعديلات ما بعد الفرح موسومة بالحبر الأحمر. Lenis للتمرير الناعم.
 */

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number]

const AR_MONTHS_SHORT = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
]

/** «24 أكتوبر» بأرقام لاتينية جدولية (سياق الجداول) */
function formatShortDate(d: Date): string {
  return `${d.getDate()} ${AR_MONTHS_SHORT[d.getMonth()]}`
}

function formatShortDateTime(d: Date): string {
  const h = d.getHours()
  const m = String(d.getMinutes()).padStart(2, '0')
  const suffix = h >= 12 ? 'م' : 'ص'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${formatShortDate(d)} · ${h12}:${m} ${suffix}`
}

/* ─── Lenis — تمرير ناعم للصفحة العامة الطويلة (design.md §٦.٢) ─────────── */

function useLenis(active: boolean) {
  useEffect(() => {
    if (!active) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    // Lenis يتعارض مع scroll-behavior: smooth في CSS — نعطّله مؤقتًا
    const root = document.documentElement
    const prev = root.style.scrollBehavior
    root.style.scrollBehavior = 'auto'
    const lenis = new Lenis({ lerp: 0.1 })
    let rafId = 0
    const raf = (time: number) => {
      lenis.raf(time)
      rafId = requestAnimationFrame(raf)
    }
    rafId = requestAnimationFrame(raf)
    return () => {
      cancelAnimationFrame(rafId)
      lenis.destroy()
      root.style.scrollBehavior = prev
    }
  }, [active])
}

/* ─── عدّاد GSAP معزول (design.md §٦.٢ — count-up بفواصل آلاف) ───────────── */

const GsapCountUp = memo(function GsapCountUp({
  value,
  className,
  duration = 0.9,
}: {
  value: number
  className?: string
  duration?: number
}) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = formatMoney(value)
      return
    }
    const counter = { v: 0 }
    const tween = gsap.to(counter, {
      v: value,
      duration,
      ease: 'power3.out',
      onUpdate: () => {
        el.textContent = formatMoney(Math.round(counter.v))
      },
    })
    return () => {
      tween.kill()
    }
  }, [value, duration])

  return (
    <span ref={ref} className={className}>
      0
    </span>
  )
})

/* ─── حالة التحميل ─────────────────────────────────────────────────────── */

function LoadingState() {
  return (
    <div
      dir="rtl"
      className="relative flex min-h-[100dvh] flex-col items-center justify-center gap-5 px-6"
      style={{ background: 'linear-gradient(180deg, #FBF7EE 0%, #F4EDDE 100%)' }}
    >
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gold-500" aria-hidden />
      <div className="absolute inset-0 pattern-festive opacity-[0.05]" aria-hidden />
      <motion.img
        src="/logo.svg"
        alt="أفراح الجمعية"
        className="relative size-14"
        animate={{ scale: [1, 1.08, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
      />
      <p className="relative font-kufi text-[14px] font-semibold text-ink-500">
        بنجهّز كشف الحساب…
      </p>
    </div>
  )
}

/* ─── صفحة الاعتذار — رابط غير صالح/ملغي (wedding-owner.md §٩) ──────────── */

function InvalidLinkState() {
  return (
    <div
      dir="rtl"
      className="relative flex min-h-[100dvh] items-center justify-center px-5 py-12"
      style={{ background: 'linear-gradient(180deg, #FBF7EE 0%, #F4EDDE 100%)' }}
    >
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gold-500" aria-hidden />
      <div className="absolute inset-0 pattern-festive opacity-[0.05]" aria-hidden />
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.38, ease: EASE }}
        className="relative w-full max-w-[420px] rounded-xl border border-line bg-paper-surface p-8 text-center shadow-card"
      >
        <img src="/logo.svg" alt="" className="mx-auto size-12" />
        <img src="/ornament-divider.svg" alt="" className="mx-auto mt-4 w-40 opacity-80" aria-hidden />
        <span className="mx-auto mt-6 flex size-14 items-center justify-center rounded-full bg-redink-bg">
          <Link2Off className="size-6 text-redink" strokeWidth={2.2} />
        </span>
        <h1 className="mt-4 font-kufi text-[20px] font-bold leading-8 text-ink-900">
          الرابط ده مش شغال
        </h1>
        <p className="mt-2 text-[13.5px] leading-6 text-ink-500">
          يمكن الرابط اتلغى أو اتجدّد — كلم الكاتب يبعتلك رابط جديد لكشف حساب فرحتك.
        </p>
        <p className="mt-6 text-[11px] text-ink-400">أفراح الجمعية — دفتر النقوط الرقمي</p>
      </motion.div>
    </div>
  )
}

/* ─── الترويسة الاحتفالية (§٣) ──────────────────────────────────────────── */

function FestiveHeader({ data }: { data: PublicWeddingStatement }) {
  const words = useMemo(() => `فرحة ${data.hostName}`.split(' '), [data.hostName])
  return (
    <header
      className="relative overflow-hidden pb-8 pt-10 text-center"
      style={{ background: 'linear-gradient(180deg, #FBF7EE 0%, #F4EDDE 100%)' }}
    >
      <div className="absolute inset-0 pattern-festive opacity-[0.07]" aria-hidden />
      <div className="relative px-5">
        <motion.img
          src="/logo.svg"
          alt="شعار الكاتب"
          className="mx-auto size-14"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, ease: EASE }}
        />
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="mt-3 font-kufi text-[20px] font-bold leading-7 text-primary-700"
        >
          {data.brand}
        </motion.p>

        {/* الفاصل الزخرفي يرسم نفسه من المنتصف */}
        <motion.img
          src="/ornament-divider.svg"
          alt=""
          aria-hidden
          className="mx-auto mt-4 w-56 max-w-full"
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.25, ease: EASE }}
        />

        {/* شارة العرض فقط — تنبض مرة واحدة بعد اكتمال الدخول */}
        <motion.span
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0, scale: [1, 1.06, 1] }}
          transition={{
            opacity: { duration: 0.3, delay: 0.55 },
            y: { duration: 0.3, delay: 0.55, ease: EASE },
            scale: { duration: 0.5, delay: 0.95 },
          }}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-gold-500/50 bg-gold-100 px-3.5 py-1.5 text-[12px] font-semibold text-gold-600"
        >
          <Lock className="size-3.5" strokeWidth={2.4} />
          كشف حساب رسمي — عرض فقط
        </motion.span>

        {/* العنوان يدخل كلمة-كلمة (العربية لا تُقسّم حروفًا) */}
        <h1 className="mt-4 font-kufi text-[30px] font-bold leading-[42px] text-ink-900 sm:text-[34px]">
          {words.map((w, i) => (
            <motion.span
              key={`${w}-${i}`}
              className="inline-block"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.5 + i * 0.09, ease: EASE }}
            >
              {w}
              {i < words.length - 1 ? ' ' : ''}
            </motion.span>
          ))}
        </h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.85 }}
          className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[13px] text-ink-500"
        >
          <span className="inline-flex items-center gap-1.5">
            <CalendarHeart className="size-4 text-gold-600" strokeWidth={2.2} />
            {formatArabicDate(new Date(data.eventDate))}
          </span>
          {data.place && (
            <>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-4 text-ink-400" strokeWidth={2.2} />
                {data.place}
              </span>
            </>
          )}
        </motion.p>
      </div>
    </header>
  )
}

/* ─── الإجمالي الكبير + الإحصائيات (§٤) ────────────────────────────────── */

function TotalsSection({ data }: { data: PublicWeddingStatement }) {
  const editedCount = useMemo(
    () => data.regions.reduce((s, r) => s + r.persons.filter((p) => p.editedAfterDone).length, 0),
    [data.regions],
  )
  // العد التنازلي من وقت إصدار الكشف (ساعة الخادم — قيمة نقية من البيانات)
  const daysLeft = useMemo(() => {
    const ms = new Date(data.eventDate).getTime() - new Date(data.issuedAt).getTime()
    return Math.max(0, Math.ceil(ms / 86_400_000))
  }, [data.eventDate, data.issuedAt])

  if (data.status === 'upcoming') {
    return (
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.45, ease: EASE }}
        className="rounded-xl border border-gold-500/40 bg-gold-100/50 p-6 text-center shadow-card"
      >
        <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-gold-600">
          <Sparkles className="size-4" strokeWidth={2.2} />
          الفرحة لسه جاية
        </span>
        <p className="mt-2 font-kufi text-[30px] font-bold leading-[38px] text-gold-600">
          {daysLeft === 0
            ? 'فرحتك النهارده'
            : daysLeft === 1
              ? 'فرحتك بكرة'
              : `فرحتك بعد ${toArabicDigits(daysLeft)} أيام`}
        </p>
        <p className="mt-1.5 text-[13px] text-ink-500">
          {data.personsCount > 0
            ? `اتسجّل لحد دلوقتي ${formatMoney(data.grandTotal)} ج.م من ${toArabicDigits(data.personsCount)} مهنئًا`
            : 'أول ما النقوط تتسجّل هتظهر هنا تلقائيًا'}
        </p>
      </motion.section>
    )
  }

  const stats = [
    { icon: Users, label: 'مهنئًا شرفونا', value: data.personsCount, tone: 'text-primary-600 bg-primary-100' },
    { icon: MapPin, label: 'منطقة', value: data.regions.length, tone: 'text-gold-600 bg-gold-100' },
    {
      icon: PenLine,
      label: 'تعديل بعد الفرح',
      value: editedCount,
      tone: editedCount > 0 ? 'text-redink bg-redink-bg' : 'text-open-text bg-open-bg',
    },
  ]

  return (
    <section className="flex flex-col gap-4">
      {/* بطاقة الإجمالي — لمعان ذهبي يمر مرة واحدة */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.45, ease: EASE }}
        className="relative overflow-hidden rounded-xl border border-gold-500/40 bg-paper-surface p-6 text-center shadow-card"
      >
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 w-1/3"
          style={{
            background:
              'linear-gradient(105deg, transparent 0%, rgba(194,155,60,.18) 45%, rgba(194,155,60,.3) 50%, rgba(194,155,60,.18) 55%, transparent 100%)',
          }}
          initial={{ x: '320%' }}
          animate={{ x: '-320%' }}
          transition={{ duration: 1.2, delay: 0.9, ease: 'easeInOut' }}
        />
        <p className="text-[13px] font-medium text-ink-500">إجمالي نقوط فرحتك</p>
        <p className="mt-1 font-kufi text-[38px] font-bold leading-[46px] text-ink-900 sm:text-[44px] sm:leading-[52px]">
          <GsapCountUp value={data.grandTotal} className="num-ltr inline-block" />
          <span className="mr-2 text-[18px] font-semibold text-ink-500">ج.م</span>
        </p>
        <p className="mt-1 text-[13px] text-ink-500">
          من {toArabicDigits(data.personsCount)} مهنئًا — ربنا يتمم بخير
        </p>
      </motion.div>

      {/* ٣ بطاقات إحصائية */}
      <div className="grid grid-cols-3 gap-3">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.45, delay: 0.1 * (i + 1), ease: EASE }}
            className="rounded-xl border border-line bg-paper-surface p-4 text-center shadow-card"
          >
            <span className={cn('mx-auto flex size-9 items-center justify-center rounded-[10px]', s.tone)}>
              <s.icon className="size-[18px]" strokeWidth={2.2} />
            </span>
            <p className="mt-2 font-kufi text-[22px] font-bold leading-7 text-ink-900">
              <GsapCountUp value={s.value} className="num-ltr inline-block" duration={0.7} />
            </p>
            <p className="mt-0.5 text-[11.5px] text-ink-500">{s.label}</p>
          </motion.div>
        ))}
      </div>
    </section>
  )
}

/* ─── صف شخص في الكشف — الحبر الأحمر للتعديلات اللاحقة (§٢.٤/§٥) ─────────── */

function PersonRow({ person, index }: { person: PublicWeddingRegion['persons'][number]; index: number }) {
  const edited = person.editedAfterDone
  return (
    <motion.li
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index, 12) * 0.05, ease: EASE }}
      className={cn(
        'flex items-center gap-3 px-4 py-3.5',
        edited && 'bg-redink-bg/70',
      )}
    >
      <span
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-full font-kufi text-[14px] font-bold',
          edited ? 'bg-redink-bg text-redink' : 'bg-primary-100 text-primary-700',
        )}
      >
        {person.name.trim().charAt(0) || '؟'}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-kufi text-[14.5px] font-semibold text-ink-900">{person.name}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-ink-500">
          {person.phone && <span className="num-ltr">{person.phone}</span>}
          {person.invitedBy && (
            <>
              {person.phone && <span aria-hidden>·</span>}
              <span>دعاه: {person.invitedBy}</span>
            </>
          )}
        </p>
        {edited && (
          <span className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-redink/30 bg-redink-bg px-2 py-0.5 text-[10.5px] font-semibold text-redink">
            <PenLine className="size-3" strokeWidth={2.4} />
            عُدّل بعد الفرح
          </span>
        )}
      </div>
      <div className="shrink-0 text-left">
        <p className={cn('text-[15px] font-bold', edited ? 'text-redink' : 'text-ink-900')}>
          <span className="num-ltr">{formatMoney(person.amount)}</span>{' '}
          <span className="text-[11px] font-medium text-ink-500">ج.م</span>
        </p>
        <p className="mt-0.5 text-[10.5px] text-ink-400 num-ltr">{formatShortDate(new Date(person.paidAt))}</p>
      </div>
    </motion.li>
  )
}

/* ─── مجموعة منطقة قابلة للطي (§٥) ───────────────────────────────────────── */

function RegionGroup({
  region,
  open,
  onToggle,
}: {
  region: PublicWeddingRegion
  open: boolean
  onToggle: () => void
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-paper-surface shadow-card">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 bg-[#F1EADA] px-4 py-3 text-right transition-colors hover:bg-[#EDE4D0]"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-paper-surface text-gold-600">
          <MapPin className="size-4" strokeWidth={2.2} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-kufi text-[14.5px] font-semibold text-ink-900">
            {region.region}
          </span>
          <span className="block text-[11px] text-ink-500">
            {toArabicDigits(region.personsCount)} {region.personsCount === 1 ? 'شخص' : 'أشخاص'}
          </span>
        </span>
        <span className="shrink-0 text-[13.5px] font-bold text-primary-700">
          <span className="num-ltr">{formatMoney(region.totalAmount)}</span>{' '}
          <span className="text-[10.5px] font-medium text-ink-500">ج.م</span>
        </span>
        <ChevronDown
          className={cn('size-[18px] shrink-0 text-ink-500 transition-transform duration-300', open && 'rotate-180')}
          strokeWidth={2.2}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="overflow-hidden"
          >
            <ul className="divide-y divide-line">
              {region.persons.map((p, i) => (
                <PersonRow key={`${p.name}-${p.phone}-${i}`} person={p} index={i} />
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ─── قسم «نقوط فرحتك» — كشف مجمع بالمناطق + بحث فوري ────────────────────── */

function StatementSection({ data }: { data: PublicWeddingStatement }) {
  const [query, setQuery] = useState('')
  const [openSet, setOpenSet] = useState<ReadonlySet<string> | null>(null)

  const filtered = useMemo(() => {
    const nq = normalizeArabic(query)
    if (!nq) return data.regions
    return data.regions
      .map((r) => ({
        ...r,
        persons: r.persons.filter(
          (p) => normalizeArabic(p.name).includes(nq) || p.phone.includes(query.trim()),
        ),
      }))
      .filter((r) => r.persons.length > 0)
  }, [data.regions, query])

  // افتراضيًا: أول منطقة مفتوحة
  const effectiveOpen = useMemo(() => {
    if (openSet) return openSet
    return new Set<string>(filtered[0] ? [filtered[0].region] : [])
  }, [openSet, filtered])

  const toggle = (name: string) => {
    const next = new Set(effectiveOpen)
    if (next.has(name)) next.delete(name)
    else next.add(name)
    setOpenSet(next)
  }

  if (data.regions.length === 0) {
    return (
      <section className="rounded-xl border border-line bg-paper-surface py-8 shadow-card">
        <img src="/empty-ledger.svg" alt="" className="mx-auto w-[200px] max-w-full" draggable={false} />
        <h2 className="mt-4 text-center font-kufi text-[17px] font-semibold text-ink-900">
          لسه مفيش نقوط متسجلة
        </h2>
        <p className="mt-1.5 px-6 text-center text-[13px] text-ink-500">
          أول ما الكاتب يسجّل نقوط الفرح هتظهر هنا تلقائيًا
        </p>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="text-center">
        <h2 className="font-kufi text-[20px] font-semibold leading-7 text-ink-900">نقوط فرحتك</h2>
        <img src="/ornament-divider.svg" alt="" aria-hidden className="mx-auto mt-2 w-36 opacity-70" />
      </div>

      {/* بحث فوري */}
      <div className="relative">
        <Search className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="دوّر على اسم أو تليفون…"
          className="h-12 w-full rounded-[10px] border border-line-strong bg-paper-surface pr-10 pl-4 text-[14px] text-ink-900 placeholder:text-ink-400 focus:border-primary-300 focus:outline-none"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-line bg-paper-surface px-6 py-10 text-center shadow-card">
          <img src="/empty-search.svg" alt="" className="mx-auto w-[180px] max-w-full" draggable={false} />
          <p className="mt-3 font-kufi text-[15px] font-semibold text-ink-900">
            مفيش نتائج لـ«{query}»
          </p>
          <p className="mt-1 text-[12.5px] text-ink-500">جرّب جزء من الاسم أو رقم التليفون</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((r) => (
            <RegionGroup
              key={r.region}
              region={r}
              open={effectiveOpen.has(r.region)}
              onToggle={() => toggle(r.region)}
            />
          ))}
        </div>
      )}

      {/* سطر الإجمالي الثابت */}
      <div className="rounded-xl border border-gold-500/40 bg-gold-100/50 px-4 py-3.5 text-center text-[13.5px] font-semibold text-ink-900">
        المجموع: <span className="num-ltr font-bold">{formatMoney(data.grandTotal)}</span> ج.م من{' '}
        {toArabicDigits(data.personsCount)} {data.personsCount === 1 ? 'شخص' : 'أشخاص'}
      </div>
    </section>
  )
}

/* ─── التذييل (§٨) ───────────────────────────────────────────────────────── */

function OwnerFooter({ data }: { data: PublicWeddingStatement }) {
  const editedCount = data.regions.reduce(
    (s, r) => s + r.persons.filter((p) => p.editedAfterDone).length,
    0,
  )
  const signer = data.brand.replace(/\s*للأفراح\s*$/, '').trim() || data.brand
  return (
    <motion.footer
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.6 }}
      className="pb-10 pt-4 text-center"
    >
      {editedCount > 0 && (
        <p className="mx-auto mb-5 inline-flex items-center gap-1.5 rounded-full bg-redink-bg px-3.5 py-1.5 text-[12px] font-medium text-redink">
          <PenLine className="size-3.5" strokeWidth={2.2} />
          فيه {editedCount === 1 ? 'تعديل واحد' : `${toArabicDigits(editedCount)} تعديلات`} بعد الفرح — موسومة بالحبر الأحمر فوق
        </p>
      )}
      <img src="/ornament-divider.svg" alt="" aria-hidden className="mx-auto w-48 opacity-70" />
      <p className="mt-4 font-ruqaa text-[24px] leading-9 text-ink-700">مع تحيات {signer}</p>
      <p className="mt-2 text-[11px] text-ink-400">أفراح الجمعية — دفتر النقوط الرقمي</p>
      <p className="mt-1 text-[11px] text-ink-400">
        الكشف بيتحدث تلقائيًا مع أي تعديل — آخر تحديث: {formatShortDateTime(new Date(data.issuedAt))}
      </p>
    </motion.footer>
  )
}

/* ─── الصفحة ─────────────────────────────────────────────────────────────── */

export default function WeddingOwner() {
  const { token } = useParams()
  const query = trpc.public_wedding.getByToken.useQuery(
    { token: token ?? '' },
    { enabled: !!token, retry: false, refetchOnWindowFocus: false },
  )

  useLenis(true)

  if (!token) return <InvalidLinkState />
  if (query.isLoading) return <LoadingState />
  if (query.isError || !query.data) return <InvalidLinkState />

  const data = query.data
  return (
    <div dir="rtl" className="min-h-[100dvh] bg-paper-base">
      {/* الشريط الذهبي العلوي */}
      <div className="h-[3px] bg-gold-500" aria-hidden />
      <FestiveHeader data={data} />

      <main className="mx-auto flex w-full max-w-[860px] flex-col gap-8 px-4 pb-6 sm:px-6">
        <TotalsSection data={data} />
        <StatementSection data={data} />
        <OwnerFooter data={data} />
      </main>
    </div>
  )
}
