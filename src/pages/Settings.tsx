import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { motion } from 'framer-motion'
import Lenis from 'lenis'
import {
  ArrowLeft,
  Building2,
  CalendarHeart,
  Check,
  Copy,
  Crown,
  Download,
  Eye,
  Link2,
  Lock,
  Mail,
  MessageCircle,
  NotebookPen,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  UserRound,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { EventListItem } from '@contracts/afrah'
import { trpc } from '@/providers/trpc'
import { useAuth } from '@/hooks/useAuth'
import { LOGIN_PATH } from '@/const'
import { cn } from '@/lib/utils'
import { formatArabicDate, formatMoney, toArabicDigits } from '@/lib/format'
import EmptyState from '@/components/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

/**
 * إعدادات الحساب والفريق (settings.md) — تخطيط بعمودين: قائمة أقسام لاصقة
 * يمينًا (240px) بمؤشر منزلق + scrollspy، ومحتوى الأقسام يسارًا (max 720px).
 * الأقسام: الملف الشخصي · النشاط والعلامة · الفريق والأدوار · روابط أصحاب
 * الأفراح · واتساب (مختصر) · تطبيق PWA. Lenis للتمرير الناعم بين الأقسام.
 */

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number]

const SECTIONS = [
  { id: 'profile', label: 'الملف الشخصي', icon: UserRound },
  { id: 'brand', label: 'النشاط والعلامة', icon: Building2 },
  { id: 'team', label: 'الفريق والأدوار', icon: Users },
  { id: 'share', label: 'روابط أصحاب الأفراح', icon: Link2 },
  { id: 'whatsapp', label: 'واتساب', icon: MessageCircle },
  { id: 'pwa', label: 'تطبيق PWA', icon: Smartphone },
] as const

type SectionId = (typeof SECTIONS)[number]['id']

/* ─── Lenis + تنقل داخلي ناعم ────────────────────────────────────────────── */

function useLenisRef() {
  const ref = useRef<Lenis | null>(null)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    // Lenis يتعارض مع scroll-behavior: smooth في CSS — نعطّله مؤقتًا
    const root = document.documentElement
    const prev = root.style.scrollBehavior
    root.style.scrollBehavior = 'auto'
    const lenis = new Lenis({ lerp: 0.1 })
    ref.current = lenis
    let rafId = 0
    const raf = (time: number) => {
      lenis.raf(time)
      rafId = requestAnimationFrame(raf)
    }
    rafId = requestAnimationFrame(raf)
    return () => {
      cancelAnimationFrame(rafId)
      lenis.destroy()
      ref.current = null
      root.style.scrollBehavior = prev
    }
  }, [])
  return ref
}

/* ─── PWA — موجه التثبيت ─────────────────────────────────────────────────── */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

function detectInstalled(): boolean {
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  return (navigator as Navigator & { standalone?: boolean }).standalone === true
}

function usePwaInstall() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState<boolean>(detectInstalled)

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setDeferred(null)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const install = useCallback(async () => {
    if (!deferred) return
    await deferred.prompt()
    const choice = await deferred.userChoice
    if (choice.outcome === 'accepted') setInstalled(true)
    setDeferred(null)
  }, [deferred])

  return { canInstall: !!deferred, installed, install }
}

/* ─── عنصر قسم بعنوان وأيقونة ─────────────────────────────────────────────── */

function SectionShell({
  id,
  icon: Icon,
  title,
  desc,
  children,
}: {
  id: SectionId
  icon: LucideIcon
  title: string
  desc: string
  children: React.ReactNode
}) {
  return (
    <motion.section
      id={id}
      className="scroll-mt-24"
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.38, ease: EASE }}
    >
      <header className="mb-4 flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-primary-100 text-primary-700">
          <Icon className="size-5" strokeWidth={2.1} />
        </span>
        <div>
          <h2 className="font-kufi text-[20px] font-semibold leading-7 text-ink-900">{title}</h2>
          <p className="text-[12px] text-ink-500">{desc}</p>
        </div>
      </header>
      {children}
    </motion.section>
  )
}

/** شريحة حالة صغيرة — لون + أيقونة + نص */
function StatusChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium',
        ok ? 'bg-laha-bg text-laha-text' : 'bg-open-bg text-open-text',
      )}
    >
      <span className={cn('size-1.5 rounded-full', ok ? 'bg-laha-solid' : 'bg-open-solid')} aria-hidden />
      {label}: {ok ? 'شغّال' : 'متوقف'}
    </span>
  )
}

/* ─── أزرار صغيرة مشتركة ─────────────────────────────────────────────────── */

const btnSecondary =
  'inline-flex items-center justify-center gap-1.5 rounded-[10px] border border-line-strong px-3 py-2 text-[12.5px] font-medium text-ink-700 transition-colors hover:bg-primary-50 disabled:opacity-50'
const btnDanger =
  'inline-flex items-center justify-center gap-1.5 rounded-[10px] border border-[#E3C4B8] px-3 py-2 text-[12.5px] font-medium text-redink transition-colors hover:bg-redink-bg disabled:opacity-50'

/* ─── (أ) الملف الشخصي ───────────────────────────────────────────────────── */

function ProfileSection() {
  const { user } = useAuth()
  const initials = useMemo(() => {
    const parts = (user?.name ?? '').trim().split(/\s+/).filter(Boolean)
    return (parts[0]?.charAt(0) ?? '؟') + (parts[1]?.charAt(0) ?? '')
  }, [user?.name])

  if (!user) return null
  const roleLabel = user.role === 'admin' ? 'مدير النظام' : 'الكاتب — مدير كامل'

  return (
    <SectionShell id="profile" icon={UserRound} title="الملف الشخصي" desc="بيانات حسابك الحالية في النظام">
      <div className="surface-card p-5 md:p-6">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary-100 font-kufi text-[20px] font-bold text-primary-700">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-kufi text-[18px] font-bold leading-7 text-ink-900">{user.name ?? 'مستخدم'}</p>
            {user.email && (
              <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-ink-500">
                <Mail className="size-3.5" />
                <span dir="ltr">{user.email}</span>
              </p>
            )}
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-100 px-3.5 py-1.5 text-[12.5px] font-semibold text-gold-600">
            <ShieldCheck className="size-4" strokeWidth={2.2} />
            {roleLabel}
          </span>
        </div>
        <div className="mt-5 grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
          <div className="rounded-[10px] bg-paper-sunken/60 px-4 py-3">
            <p className="text-[11.5px] text-ink-500">عضو منذ</p>
            <p className="mt-0.5 text-[13.5px] font-semibold text-ink-900">
              {formatArabicDate(new Date(user.createdAt))}
            </p>
          </div>
          <div className="rounded-[10px] bg-paper-sunken/60 px-4 py-3">
            <p className="text-[11.5px] text-ink-500">آخر دخول</p>
            <p className="mt-0.5 text-[13.5px] font-semibold text-ink-900">
              {formatArabicDate(new Date(user.lastSignInAt))}
            </p>
          </div>
        </div>
      </div>
    </SectionShell>
  )
}

/* ─── (ب) النشاط والعلامة ────────────────────────────────────────────────── */

function BrandSection() {
  const { user } = useAuth()
  const brandName = user?.name?.trim() ? `${user.name.trim()} للأفراح` : 'دفتر الأفراح'
  const signer = user?.name?.trim() || 'الكاتب'

  return (
    <SectionShell
      id="brand"
      icon={Building2}
      title="النشاط والعلامة"
      desc="بيظهروا على غلاف تقارير PDF وصفحة صاحب الفرح"
    >
      <div className="surface-card p-5 md:p-6">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex size-[72px] shrink-0 items-center justify-center rounded-full border border-line bg-paper-base p-2 shadow-card">
            <img src="/logo.svg" alt="شعار النشاط" className="size-full" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] text-ink-500">اسم النشاط</p>
            <p className="mt-0.5 font-kufi text-[18px] font-bold leading-7 text-primary-700">{brandName}</p>
            <p className="mt-1 text-[12px] text-ink-400">الشعار الافتراضي لدفتر «أفراح الجمعية»</p>
          </div>
        </div>

        {/* معاينة التوقيع بخط Aref Ruqaa داخل بطاقة ورقية */}
        <div className="mt-5">
          <p className="mb-2 text-[12px] font-medium text-ink-500">نص التوقيع — معاينة حية</p>
          <div className="relative rounded-xl border border-line-strong bg-paper-base p-6 text-center">
            <div className="pointer-events-none absolute inset-2 rounded-lg border border-line" aria-hidden />
            <p className="relative font-ruqaa text-[24px] leading-9 text-ink-700">مع تحيات {signer}</p>
          </div>
        </div>
      </div>
    </SectionShell>
  )
}

/* ─── (ج) الفريق والأدوار ────────────────────────────────────────────────── */

const ROLE_CARDS = [
  {
    icon: Crown,
    title: 'الكاتب (مدير كامل)',
    chip: 'bg-gold-100 text-gold-600',
    points: ['كل الصلاحيات: الإعدادات والفريق والحذف', 'تصحيح النقوط حتى بعد إرسال واتساب', 'توليد التقارير وروابط المشاركة'],
  },
  {
    icon: NotebookPen,
    title: 'فريق الكاتب (مدخل بيانات)',
    chip: 'bg-primary-100 text-primary-700',
    points: ['تسجيل نقوط وإضافة أشخاص أثناء الفرح', 'تعديل صامت قبل إرسال واتساب فقط', 'التصحيح بعد الإرسال يحتاج موافقة الكاتب'],
  },
  {
    icon: Eye,
    title: 'صاحب الفرح',
    chip: 'bg-open-bg text-open-text',
    points: ['قراءة فقط لكشف حسابه عبر رابط سري', 'لا يرى النظام نهائيًا ولا يحتاج تسجيل دخول', 'يستلم الرابط على واتساب من الكاتب'],
  },
]

function TeamSection() {
  const { user } = useAuth()
  const initials = useMemo(() => {
    const parts = (user?.name ?? '').trim().split(/\s+/).filter(Boolean)
    return (parts[0]?.charAt(0) ?? '؟') + (parts[1]?.charAt(0) ?? '')
  }, [user?.name])

  return (
    <SectionShell id="team" icon={Users} title="الفريق والأدوار" desc="الأدوار الثلاثة في النظام وصلاحيات كل دور">
      {/* العضو الحالي */}
      <div className="surface-card p-5 md:p-6">
        <div className="flex flex-wrap items-center gap-3.5">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-100 font-kufi text-[14px] font-bold text-primary-700">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-kufi text-[15px] font-semibold text-ink-900">{user?.name ?? 'مستخدم'}</p>
            {user?.email && <p className="text-[12px] text-ink-500" dir="ltr">{user.email}</p>}
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-100 px-3 py-1.5 text-[12px] font-semibold text-gold-600">
            <Crown className="size-3.5" strokeWidth={2.2} />
            الكاتب — مدير كامل
          </span>
        </div>
        <p className="mt-4 rounded-[10px] bg-paper-sunken/60 px-4 py-3 text-[12.5px] leading-6 text-ink-500">
          حاليًا بيظهر حسابك بس كعضو في الفريق — دعوة الأعضاء وإدارة أدوارهم هتتفعّل من هنا في تحديث قريب.
        </p>
      </div>

      {/* بطاقة شرح الأدوار */}
      <div className="mt-4 grid gap-3 rounded-xl border border-line bg-[#FBF5E6] p-4 md:grid-cols-3 md:p-5">
        {ROLE_CARDS.map((role) => (
          <div key={role.title} className="rounded-[10px] bg-paper-surface p-4 shadow-card">
            <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold', role.chip)}>
              <role.icon className="size-3.5" strokeWidth={2.2} />
              {role.title}
            </span>
            <ul className="mt-3 flex flex-col gap-2">
              {role.points.map((p) => (
                <li key={p} className="flex items-start gap-2 text-[12.5px] leading-5 text-ink-700">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-laha-solid" strokeWidth={2.6} />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </SectionShell>
  )
}

/* ─── (د) روابط أصحاب الأفراح ─────────────────────────────────────────────── */

function ShareLinkRow({ event }: { event: EventListItem }) {
  const utils = trpc.useUtils()
  const [copied, setCopied] = useState(false)
  const [regenerated, setRegenerated] = useState(false)
  const regenerate = trpc.events.regenerateShareToken.useMutation({
    onSuccess: async () => {
      await utils.events.list.invalidate()
      setRegenerated(true)
      window.setTimeout(() => setRegenerated(false), 2000)
    },
  })

  const shareUrl = `${window.location.origin}/w/${event.shareToken}`

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = shareUrl
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1000)
  }

  const preview = () => {
    window.open(`/w/${event.shareToken}`, '_blank', 'noopener')
  }

  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: EASE }}
      className="surface-card p-4"
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-gold-100 text-gold-600">
          <CalendarHeart className="size-5" strokeWidth={2.1} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-kufi text-[15px] font-semibold text-ink-900">
            فرحة {event.hostName}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-ink-500">
            <span>{formatArabicDate(new Date(event.eventDate))}</span>
            <span aria-hidden>·</span>
            <span className="num-ltr">
              {formatMoney(event.totalAmount)} ج.م
            </span>
            <span aria-hidden>·</span>
            <span>{toArabicDigits(event.payersCount)} مهنئًا</span>
          </p>
        </div>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium',
            event.status === 'upcoming' ? 'bg-gold-100 text-gold-600' : 'bg-open-bg text-open-text',
          )}
        >
          {event.status === 'upcoming' ? 'قادمة' : 'تمت'}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-laha-bg px-2.5 py-1 text-[11.5px] font-medium text-laha-text">
          <span className="size-1.5 rounded-full bg-laha-solid" aria-hidden />
          الرابط فعّال
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <button
          type="button"
          onClick={copyLink}
          className={cn(
            btnSecondary,
            copied && 'border-laha-solid bg-laha-bg text-laha-text hover:bg-laha-bg',
          )}
        >
          {copied ? <Check className="size-4" strokeWidth={2.4} /> : <Copy className="size-4" />}
          {copied ? 'اتنسخ ✓' : 'نسخ الرابط'}
        </button>
        <button type="button" onClick={preview} className={btnSecondary}>
          <Eye className="size-4" />
          معاينة
        </button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button type="button" className={btnDanger} disabled={regenerate.isPending}>
              <RefreshCw className={cn('size-4', regenerate.isPending && 'animate-spin')} />
              {regenerate.isPending ? 'بيتجدّد…' : 'تجديد الرابط'}
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent dir="rtl" className="bg-paper-surface">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-kufi text-ink-900">
                تجديد رابط «فرحة {event.hostName}»؟
              </AlertDialogTitle>
              <AlertDialogDescription className="text-ink-500">
                هيتم إبطال الرابط القديم فورًا وتوليد رابط جديد — لو صاحب الفرح معاه الرابط القديم
                هيحتاج تبعتله الجديد على واتساب.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-row-reverse gap-2 sm:flex-row-reverse">
              <AlertDialogAction
                onClick={() => regenerate.mutate({ id: event.id })}
                className="bg-primary-500 text-[#FFFDF8] hover:bg-primary-600"
              >
                تجديد الرابط
              </AlertDialogAction>
              <AlertDialogCancel className="border-line-strong text-ink-700 hover:bg-primary-50">
                إلغاء
              </AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {regenerated && (
          <motion.span
            initial={{ opacity: 0, x: 6 }}
            animate={{ opacity: 1, x: 0 }}
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-laha-text"
          >
            <Check className="size-3.5" strokeWidth={2.6} />
            اتجدّد الرابط ✓
          </motion.span>
        )}
        {regenerate.isError && (
          <span className="text-[12px] font-medium text-redink">
            حصل خطأ أثناء التجديد — جرّب تاني
          </span>
        )}
      </div>
    </motion.li>
  )
}

function ShareLinksSection() {
  const eventsQuery = trpc.events.list.useQuery(undefined, { retry: false })

  return (
    <SectionShell
      id="share"
      icon={Link2}
      title="روابط أصحاب الأفراح"
      desc="الرابط بيدي صلاحية قراءة كشف الحساب بس — مش محتاج تسجيل دخول"
    >
      {eventsQuery.isLoading ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[104px] rounded-xl bg-paper-sunken" />
          ))}
        </div>
      ) : eventsQuery.isError ? (
        <div className="surface-card p-6 text-center">
          <p className="font-kufi text-[15px] font-semibold text-ink-900">مش قادرين نحمّل الأفراح</p>
          <p className="mt-1 text-[12.5px] text-ink-500">اتأكد من الاتصال وجرّب تاني</p>
          <button type="button" onClick={() => eventsQuery.refetch()} className={cn(btnSecondary, 'mt-4')}>
            <RefreshCw className="size-4" />
            إعادة المحاولة
          </button>
        </div>
      ) : !eventsQuery.data || eventsQuery.data.length === 0 ? (
        <div className="surface-card">
          <EmptyState
            image="/empty-ledger.svg"
            title="لسه مفيش أفراح"
            description="أنشئ أول فرحة من صفحة الأفراح وهتلاقي رابط المشاركة بتاعها هنا جاهز"
            actionLabel="روح للأفراح"
            actionHref="/weddings"
          />
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {eventsQuery.data.map((ev) => (
            <ShareLinkRow key={ev.id} event={ev} />
          ))}
        </ul>
      )}
    </SectionShell>
  )
}

/* ─── (هـ) واتساب — مختصر الإعدادات ───────────────────────────────────────── */

function WhatsappSection() {
  const utils = trpc.useUtils()
  const settingsQuery = trpc.whatsapp.getSettings.useQuery(undefined, { retry: false })
  const [days, setDays] = useState<number | null>(null)
  const [saved, setSaved] = useState(false)

  const serverDays = settingsQuery.data?.reminderDays ?? null
  const currentDays = days ?? serverDays ?? 3
  const dirty = days !== null && serverDays !== null && days !== serverDays

  const update = trpc.whatsapp.updateSettings.useMutation({
    onSuccess: async () => {
      await utils.whatsapp.getSettings.invalidate()
      setDays(null)
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2000)
    },
  })

  return (
    <SectionShell
      id="whatsapp"
      icon={MessageCircle}
      title="واتساب"
      desc="حالة الربط وإعدادات التذكير — التفاصيل الكاملة في صفحة واتساب"
    >
      <div className="surface-card p-5 md:p-6">
        {settingsQuery.isLoading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-9 w-2/3 rounded-full bg-paper-sunken" />
            <Skeleton className="h-12 rounded-[10px] bg-paper-sunken" />
          </div>
        ) : settingsQuery.isError || !settingsQuery.data ? (
          <div className="text-center">
            <p className="text-[13px] text-ink-500">مش قادرين نقرأ إعدادات واتساب دلوقتي</p>
            <button type="button" onClick={() => settingsQuery.refetch()} className={cn(btnSecondary, 'mt-3')}>
              <RefreshCw className="size-4" />
              إعادة المحاولة
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold',
                  settingsQuery.data.mode === 'cloud'
                    ? 'bg-whatsapp-bg text-whatsapp'
                    : 'bg-gold-100 text-gold-600',
                )}
              >
                <MessageCircle className="size-3.5" strokeWidth={2.2} />
                {settingsQuery.data.mode === 'cloud' ? 'ربط سحابي شغّال' : 'وضع المحاكاة'}
              </span>
              <StatusChip ok={settingsQuery.data.remindersEnabled} label="تذكير ما قبل الفرح" />
              <StatusChip ok={settingsQuery.data.confirmationsEnabled} label="التأكيد الفوري" />
              <StatusChip ok={settingsQuery.data.botEnabled} label="البوت الذكي" />
            </div>

            {/* تعديل أيام التذكير */}
            <div className="mt-5 flex flex-wrap items-center gap-3 rounded-[10px] border border-line bg-paper-base px-4 py-3.5">
              <label htmlFor="reminder-days" className="text-[13px] font-medium text-ink-700">
                بعت التذكير قبل الفرح بـ
              </label>
              <input
                id="reminder-days"
                type="number"
                min={1}
                max={30}
                value={currentDays}
                onChange={(e) => {
                  const v = Math.round(Number(e.target.value))
                  if (Number.isFinite(v)) setDays(Math.min(30, Math.max(1, v)))
                }}
                className="num-ltr h-10 w-20 rounded-[10px] border border-line-strong bg-paper-surface text-center text-[14px] font-semibold text-ink-900 focus:border-primary-300 focus:outline-none"
              />
              <span className="text-[13px] text-ink-500">{currentDays === 1 ? 'يوم' : 'أيام'}</span>
              {dirty && (
                <motion.button
                  type="button"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: EASE }}
                  onClick={() => update.mutate({ reminderDays: currentDays })}
                  disabled={update.isPending}
                  className="inline-flex items-center gap-1.5 rounded-[10px] bg-primary-500 px-4 py-2 text-[13px] font-semibold text-[#FFFDF8] shadow-card transition-colors hover:bg-primary-600 disabled:opacity-50"
                >
                  {update.isPending ? 'بيتحفظ…' : 'حفظ التغيير'}
                </motion.button>
              )}
              {saved && !dirty && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-laha-text"
                >
                  <Check className="size-4" strokeWidth={2.6} />
                  اتحفظت الإعدادات ✓
                </motion.span>
              )}
              {update.isError && (
                <span className="text-[12.5px] font-medium text-redink">حصل خطأ أثناء الحفظ — جرّب تاني</span>
              )}
            </div>

            <Link
              to="/whatsapp"
              className="mt-4 flex items-center justify-between gap-3 rounded-[10px] border border-whatsapp/25 bg-whatsapp-bg/60 px-4 py-3.5 transition-colors hover:bg-whatsapp-bg"
            >
              <span className="flex items-center gap-2.5 text-[13.5px] font-semibold text-whatsapp">
                <MessageCircle className="size-[18px]" strokeWidth={2.2} />
                كل إعدادات الرسائل وسجل الإرسال ومحاكاة البوت
              </span>
              <ArrowLeft className="size-4 shrink-0 text-whatsapp" strokeWidth={2.2} />
            </Link>
          </>
        )}
      </div>
    </SectionShell>
  )
}

/* ─── (و) تطبيق PWA ───────────────────────────────────────────────────────── */

function PwaSection() {
  const { canInstall, installed, install } = usePwaInstall()

  return (
    <SectionShell id="pwa" icon={Smartphone} title="تطبيق PWA" desc="ثبّت الدفتر على اللاب توب والموبايل">
      <div className="surface-card p-5 md:p-6">
        <div className="flex flex-wrap items-center gap-4">
          <img
            src="/pwa-icon-512.png"
            alt="أيقونة التطبيق"
            className="size-14 rounded-2xl border border-line shadow-card"
          />
          <div className="min-w-0 flex-1">
            <p className="font-kufi text-[15.5px] font-semibold text-ink-900">
              ثبّت «أفراح الجمعية» على جهازك
            </p>
            <p className="mt-1 text-[12.5px] leading-6 text-ink-500">
              يفتح بسرعة من سطح المكتب أو الشاشة الرئيسية، ويشتغل حتى مع نت ضعيف
              (قراءة آخر بيانات محفوظة).
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {installed ? (
            <span className="inline-flex items-center gap-1.5 rounded-[10px] bg-laha-bg px-4 py-2.5 text-[13px] font-semibold text-laha-text">
              <Check className="size-4" strokeWidth={2.6} />
              التطبيق مثبّت ✓
            </span>
          ) : canInstall ? (
            <button
              type="button"
              onClick={install}
              className="inline-flex items-center gap-2 rounded-[10px] bg-primary-500 px-5 py-2.5 text-[13.5px] font-semibold text-[#FFFDF8] shadow-card transition-all hover:bg-primary-600 hover:-translate-y-px active:scale-[0.97]"
            >
              <Download className="size-4" />
              تثبيت التطبيق
            </button>
          ) : (
            <p className="rounded-[10px] bg-paper-sunken/60 px-4 py-3 text-[12.5px] leading-6 text-ink-500">
              لو زر التثبيت مش ظاهر تلقائيًا: من Chrome أو Edge على الديسكتوب هتلاقي أيقونة
              «تثبيت» في شريط العنوان، وعلى الموبايل اختار «إضافة إلى الشاشة الرئيسية» من قائمة
              المتصفح.
            </p>
          )}
        </div>

        <p className="mt-4 flex items-center gap-2 border-t border-line pt-3.5 text-[12px] text-ink-500">
          <span className="size-1.5 rounded-full bg-laha-solid" aria-hidden />
          البيانات بتتحفظ أول بأول — وقراءة آخر بيانات متاحة حتى بدون نت
        </p>
      </div>
    </SectionShell>
  )
}

/* ─── هيكل تحميل + بوابة الدخول ───────────────────────────────────────────── */

function SettingsSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-10">
      {[0, 1, 2].map((i) => (
        <div key={i}>
          <Skeleton className="mb-4 h-10 w-48 rounded-[10px] bg-paper-sunken" />
          <Skeleton className="h-40 rounded-xl bg-paper-sunken" />
        </div>
      ))}
    </div>
  )
}

function LoginPrompt() {
  return (
    <div className="mx-auto max-w-[420px] rounded-xl border border-line bg-paper-surface p-8 text-center shadow-card">
      <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary-100">
        <Lock className="size-6 text-primary-600" strokeWidth={2.2} />
      </span>
      <h1 className="mt-4 font-kufi text-[18px] font-bold text-ink-900">الإعدادات للكاتب المسجل</h1>
      <p className="mt-2 text-[13px] leading-6 text-ink-500">
        سجّل دخولك عشان تدير حسابك ونشاطك وروابط أصحاب الأفراح
      </p>
      <Link
        to={LOGIN_PATH}
        className="mt-5 inline-flex items-center gap-2 rounded-[10px] bg-primary-500 px-5 py-2.5 text-[14px] font-semibold text-[#FFFDF8] shadow-card transition-colors hover:bg-primary-600"
      >
        تسجيل الدخول
      </Link>
    </div>
  )
}

/* ─── قائمة الأقسام اللاصقة (scrollspy + مؤشر منزلق) ─────────────────────── */

function SectionsNav({ active, onSelect }: { active: SectionId; onSelect: (id: SectionId) => void }) {
  return (
    <nav aria-label="أقسام الإعدادات" className="sticky top-24 self-start">
      <ul className="flex flex-col gap-1">
        {SECTIONS.map((s) => {
          const isActive = active === s.id
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onSelect(s.id)}
                aria-current={isActive ? 'true' : undefined}
                className={cn(
                  'relative flex w-full items-center gap-2.5 rounded-[10px] px-3.5 py-2.5 text-right text-[13.5px] transition-colors duration-150',
                  isActive ? 'font-semibold text-ink-900' : 'text-ink-500 hover:bg-primary-50 hover:text-ink-700',
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId="settings-nav-indicator"
                    transition={{ duration: 0.2, ease: EASE }}
                    className="absolute inset-0 rounded-[10px] bg-primary-100 shadow-[inset_-3px_0_0_0_#A87438]"
                    aria-hidden
                  />
                )}
                <s.icon
                  className={cn('relative size-[18px] shrink-0', isActive ? 'text-primary-700' : 'text-ink-400')}
                  strokeWidth={isActive ? 2.3 : 2}
                />
                <span className="relative truncate">{s.label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/** تنقل أفقي بالشرائح للموبايل */
function SectionsNavMobile({ active, onSelect }: { active: SectionId; onSelect: (id: SectionId) => void }) {
  return (
    <nav aria-label="أقسام الإعدادات" className="sticky top-16 z-30 -mx-4 mb-2 border-b border-line bg-paper-base/90 px-4 py-2 backdrop-blur-sm lg:hidden">
      <ul className="flex gap-2 overflow-x-auto pb-1">
        {SECTIONS.map((s) => {
          const isActive = active === s.id
          return (
            <li key={s.id} className="shrink-0">
              <button
                type="button"
                onClick={() => onSelect(s.id)}
                className={cn(
                  'flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[12.5px] font-medium transition-colors',
                  isActive
                    ? 'border-primary-500 bg-primary-100 text-primary-700'
                    : 'border-line bg-paper-surface text-ink-500',
                )}
              >
                <s.icon className="size-3.5" strokeWidth={2.2} />
                {s.label}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/* ─── الصفحة ─────────────────────────────────────────────────────────────── */

export default function Settings() {
  const { user, isLoading, isAuthenticated } = useAuth()
  const [active, setActive] = useState<SectionId>('profile')
  const lenisRef = useLenisRef()

  // scrollspy — القسم الظاهر في منتصف الشاشة هو النشط
  useEffect(() => {
    if (!isAuthenticated) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id as SectionId)
        }
      },
      { rootMargin: '-25% 0px -65% 0px', threshold: 0 },
    )
    for (const s of SECTIONS) {
      const el = document.getElementById(s.id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [isAuthenticated])

  const scrollToSection = useCallback(
    (id: SectionId) => {
      setActive(id)
      const el = document.getElementById(id)
      if (!el) return
      if (lenisRef.current) lenisRef.current.scrollTo(el, { offset: -88 })
      else el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    },
    [lenisRef],
  )

  if (isLoading) return <SettingsSkeleton />
  if (!isAuthenticated || !user) return <LoginPrompt />

  return (
    <div className="lg:grid lg:grid-cols-[240px_minmax(0,720px)] lg:justify-center lg:gap-10">
      <div className="hidden lg:block">
        <SectionsNav active={active} onSelect={scrollToSection} />
      </div>
      <div className="min-w-0">
        <SectionsNavMobile active={active} onSelect={scrollToSection} />
        <div className="flex flex-col gap-12 pb-8">
          <ProfileSection />
          <BrandSection />
          <TeamSection />
          <ShareLinksSection />
          <WhatsappSection />
          <PwaSection />
        </div>
      </div>
    </div>
  )
}
