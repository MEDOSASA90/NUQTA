import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Bell, CalendarHeart, CheckCheck, LogOut, NotebookPen, Search, Settings, UserRound, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { formatMoney, normalizeArabic, toArabicDigits } from '@/lib/format'
import { pastWeddings, people, upcomingWeddings } from '@/lib/seed-data'
import { useAuth } from '@/hooks/useAuth'
import { LOGIN_PATH } from '@/const'
import { trpc } from '@/providers/trpc'
import WarmMenu from '@/components/WarmMenu'
import { cn } from '@/lib/utils'
import { timeAgo } from '@/pages/grp-utils'

/**
 * الشريط العلوي (design.md §٨.٢) — 64px لزج بخلفية كريمية شفافة + blur:
 * عنوان الصفحة يمينًا، البحث الشامل (Ctrl+K) في المنتصف يفتح Command Palette،
 * ويسارًا زر «+ تسجيل نقطة» والإشعارات ومنطقة الحساب.
 */

const TITLE_MAP: { match: RegExp; title: string; sub?: string }[] = [
  { match: /^\/admin/, title: 'إدارة النظام', sub: 'المستخدمون والأدوار والصلاحيات' },
  { match: /^\/$/, title: 'الرئيسية', sub: 'نظرة شاملة على الدفتر' },
  { match: /^\/nuqta\/new/, title: 'تسجيل نقطة', sub: 'أضف نقطة جديدة للدفتر' },
  { match: /^\/weddings\/[^/]+/, title: 'تفاصيل الفرح', sub: 'النقوط والتقرير' },
  { match: /^\/weddings/, title: 'الأفراح', sub: 'كل الأفراح القادمة والسابقة' },
  { match: /^\/people\/[^/]+/, title: 'بطاقة شخص', sub: 'الأرصدة والتفاعلات' },
  { match: /^\/people/, title: 'الأشخاص', sub: 'دليل المدعوين والمتعاملين' },
  { match: /^\/balances/, title: 'الأرصدة', sub: 'له وعليه بينك وبين الناس' },
  { match: /^\/whatsapp/, title: 'واتساب', sub: 'الإشعارات والتذكيرات' },
  { match: /^\/reports/, title: 'التقارير', sub: 'تقارير PDF الرسمية' },
  { match: /^\/audit/, title: 'سجل التدقيق', sub: 'كل التعديلات بالتاريخ والوقت' },
  { match: /^\/settings/, title: 'الإعدادات', sub: 'الحساب والفريق والأدوار' },
]

interface PaletteItem {
  id: string
  group: 'أشخاص' | 'أفراح'
  label: string
  hint?: string
  href: string
}

function usePaletteItems(query: string): PaletteItem[] {
  return useMemo(() => {
    const nq = normalizeArabic(query)
    if (!nq) return []
    const items: PaletteItem[] = []
    for (const p of people) {
      if (normalizeArabic(p.name).includes(nq) || p.phone.includes(query.trim())) {
        items.push({ id: `p-${p.id}`, group: 'أشخاص', label: p.name, hint: p.region, href: `/people/${p.id}` })
      }
    }
    for (const w of [...upcomingWeddings, ...pastWeddings]) {
      if (normalizeArabic(w.title).includes(nq)) {
        items.push({ id: `w-${w.id}`, group: 'أفراح', label: w.title, hint: w.venue, href: `/weddings/${w.id}` })
      }
    }
    return items.slice(0, 8)
  }, [query])
}

function Highlight({ text, query }: { text: string; query: string }) {
  const idx = normalizeArabic(text).indexOf(normalizeArabic(query))
  if (!query.trim() || idx < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-gold-100 text-inherit rounded-[3px] px-px">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}

function CommandPalette({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const items = usePaletteItems(query)
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => inputRef.current?.focus(), [])
  useEffect(() => setActive(0), [query])

  const groups = useMemo(() => {
    const out: { name: string; items: (PaletteItem & { flat: number })[] }[] = []
    items.forEach((it, flat) => {
      let g = out.find((x) => x.name === it.group)
      if (!g) {
        g = { name: it.group, items: [] }
        out.push(g)
      }
      g.items.push({ ...it, flat })
    })
    return out
  }, [items])

  const go = (href: string) => {
    onClose()
    navigate(href)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-[70] bg-[rgba(44,36,24,.4)] backdrop-blur-[4px] flex justify-center pt-[12vh] px-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -16, opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[560px] h-fit rounded-xl border border-line bg-paper-surface shadow-pop overflow-hidden"
        role="dialog"
        aria-label="البحث الشامل"
      >
        <div className="flex items-center gap-3 px-4 border-b border-line">
          <Search className="size-[18px] text-ink-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActive((a) => Math.min(a + 1, items.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActive((a) => Math.max(a - 1, 0))
              } else if (e.key === 'Enter' && items[active]) {
                go(items[active].href)
              } else if (e.key === 'Escape') {
                onClose()
              }
            }}
            placeholder="ابحث عن شخص، فرحة، مبلغ…"
            className="h-12 w-full bg-transparent text-[15px] text-ink-900 placeholder:text-ink-400 focus:outline-none"
          />
          <kbd className="shrink-0 rounded-md border border-line bg-paper-sunken px-1.5 py-0.5 text-[10.5px] text-ink-500">Esc</kbd>
        </div>

        <div className="max-h-[320px] overflow-y-auto py-1.5">
          {query.trim() && items.length === 0 && (
            <div className="px-4 py-8 text-center text-[13px] text-ink-400">لا نتائج مطابقة — جرّب جزءًا من الاسم</div>
          )}
          {!query.trim() && (
            <div className="px-4 py-8 text-center text-[13px] text-ink-400">اكتب للبحث في الأشخاص والأفراح</div>
          )}
          {groups.map((g) => (
            <div key={g.name}>
              <div className="px-4 pt-2 pb-1 text-[11px] font-semibold text-ink-400 flex items-center gap-1.5">
                {g.name === 'أشخاص' ? <Users className="size-3.5" /> : <CalendarHeart className="size-3.5" />}
                {g.name}
              </div>
              {g.items.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  onMouseEnter={() => setActive(it.flat)}
                  onClick={() => go(it.href)}
                  className="relative w-full text-start px-4 py-2.5 flex items-center justify-between gap-3"
                >
                  {active === it.flat && (
                    <motion.span
                      layoutId="palette-selection"
                      transition={{ duration: 0.12 }}
                      className="absolute inset-0 bg-primary-50"
                    />
                  )}
                  <span className="relative font-kufi font-semibold text-[14px] text-ink-900">
                    <Highlight text={it.label} query={query} />
                  </span>
                  {it.hint && <span className="relative text-[12px] text-ink-500">{it.hint}</span>}
                </button>
              ))}
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  )
}

/* ─────────── الإشعارات الحقيقية (مشتقة من بيانات الدفتر) ─────────── */

type NotifKind = 'settled' | 'nuqta' | 'redink'

interface Notif {
  id: string
  kind: NotifKind
  title: string
  sub?: string
  at: Date
  href?: string
}

const NOTIF_ICON: Record<NotifKind, LucideIcon> = { settled: CheckCheck, nuqta: NotebookPen, redink: AlertTriangle }
const NOTIF_TONE: Record<NotifKind, string> = {
  settled: 'bg-whatsapp-bg text-whatsapp',
  nuqta: 'bg-primary-100 text-primary-600',
  redink: 'bg-redink-bg text-redink',
}

const NOTIF_LAST_READ_KEY = 'afrah:notifications-last-read'

function readLastRead(): number {
  try {
    return Number(localStorage.getItem(NOTIF_LAST_READ_KEY) ?? 0) || 0
  } catch {
    return 0
  }
}

/** يجمع الإشعارات من: التصفيات + نشاط النقوط + تعديلات الحبر الأحمر */
function useNotifications(enabled: boolean): { items: Notif[]; isLoading: boolean } {
  const settledQ = trpc.balances.settledNotice.useQuery(undefined, { enabled })
  const recentQ = trpc.nuqtat.listRecent.useQuery({ limit: 5 }, { enabled })
  const auditQ = trpc.audit.list.useQuery({ limit: 5 }, { enabled })

  return useMemo(() => {
    const items: Notif[] = []
    for (const s of settledQ.data ?? []) {
      items.push({
        id: `settled-${s.eventId}-${s.settlerId}-${new Date(s.settledAt).getTime()}`,
        kind: 'settled',
        title: `${s.settlerName} صفّى حسابه معاك`,
        sub: `${formatMoney(s.amount)} ج.م — ${s.eventLabel}`,
        at: new Date(s.settledAt),
        href: '/balances',
      })
    }
    for (const n of recentQ.data ?? []) {
      items.push({
        id: `nuqta-${n.id}`,
        kind: 'nuqta',
        title: `نقطة جديدة من ${n.payerName}`,
        sub: `${formatMoney(n.amount)} ج.م — فرحة ${n.hostName}`,
        at: new Date(n.createdAt),
        href: `/weddings/${n.eventId}`,
      })
    }
    for (const a of (auditQ.data ?? []).filter((x) => x.editedAfterDone)) {
      const action = a.action === 'update' ? 'اتعدلت' : a.action === 'delete' ? 'اتحذفت' : 'اتسجلت'
      items.push({
        id: `audit-${a.id}`,
        kind: 'redink',
        title: `نقطة ${action} بالحبر الأحمر`,
        sub: a.note?.trim() || `سجل تدقيق رقم ${toArabicDigits(a.id)}`,
        at: new Date(a.createdAt),
        href: '/audit',
      })
    }
    items.sort((a, b) => b.at.getTime() - a.at.getTime())
    return {
      items: items.slice(0, 12),
      isLoading: (enabled && (settledQ.isLoading || recentQ.isLoading || auditQ.isLoading)),
    }
  }, [enabled, settledQ.data, settledQ.isLoading, recentQ.data, recentQ.isLoading, auditQ.data, auditQ.isLoading])
}

function NotificationsMenu({ enabled }: { enabled: boolean }) {
  const navigate = useNavigate()
  const { items } = useNotifications(enabled)
  const [lastRead, setLastRead] = useState<number>(readLastRead)
  const unread = items.filter((i) => i.at.getTime() > lastRead).length

  /* «آخر قراءة» تُحدَّث عند قفل القائمة — الجديد يفضل ظاهرًا وهي مفتوحة */
  const markAllRead = () => {
    const now = Date.now()
    try {
      localStorage.setItem(NOTIF_LAST_READ_KEY, String(now))
    } catch {
      /* التخزين المحلي غير متاح — تجاهل */
    }
    setLastRead(now)
  }

  return (
    <WarmMenu
      ariaLabel="الإشعارات"
      width={340}
      panelClassName="max-h-[420px] overflow-y-auto"
      onOpenChange={(o) => {
        if (!o) markAllRead()
      }}
      trigger={({ toggle }) => (
        <button
          type="button"
          aria-label="الإشعارات"
          onClick={toggle}
          className="relative flex size-10 items-center justify-center rounded-[10px] border border-line bg-paper-surface text-ink-700 transition-colors hover:bg-primary-50"
        >
          <Bell className="size-[18px]" />
          {unread > 0 && (
            <span className="absolute -top-1.5 -end-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-redink px-1 text-[10.5px] font-bold text-[#FFFDF8] shadow-card">
              {toArabicDigits(unread)}
            </span>
          )}
        </button>
      )}
    >
      {(close) => (
        <>
          <li className="border-b border-line px-4 py-2.5">
            <span className="font-kufi font-semibold text-[14px] text-ink-900">الإشعارات</span>
          </li>
          {items.length === 0 ? (
            <li className="px-4 py-8 text-center">
              <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-paper-sunken text-ink-400">
                <Bell className="size-5" />
              </span>
              <p className="mt-2.5 text-[12.5px] leading-5 text-ink-500">مفيش إشعارات لسه — أول حركة في الدفتر هتظهر هنا</p>
            </li>
          ) : (
            items.map((n) => {
              const Icon = NOTIF_ICON[n.kind]
              const fresh = n.at.getTime() > lastRead
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      close()
                      if (n.href) navigate(n.href)
                    }}
                    className="flex w-full items-start gap-3 px-4 py-3 text-start transition-colors hover:bg-primary-50"
                  >
                    <span className={cn('mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg', NOTIF_TONE[n.kind])}>
                      <Icon className="size-4" strokeWidth={2.1} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium leading-5 text-ink-900">{n.title}</span>
                      {n.sub && <span className="block truncate text-[11.5px] text-ink-500">{n.sub}</span>}
                      <span className="mt-0.5 block text-[10.5px] text-ink-400">{timeAgo(n.at)}</span>
                    </span>
                    {fresh && <span className="mt-2 size-2 shrink-0 rounded-full bg-gold-500" aria-label="جديد" />}
                  </button>
                </li>
              )
            })
          )}
        </>
      )}
    </WarmMenu>
  )
}

/* ─────────── قائمة الحساب ─────────── */

const MEMBER_ROLE_LABEL: Record<string, string> = { scribe: 'كاتب', team: 'عضو فريق' }

function ProfileMenu({ user, onLogout }: { user: { id: number; name: string | null; email: string | null; role: string }; onLogout: () => void }) {
  const navigate = useNavigate()
  const teamQ = trpc.events.teamMembers.useQuery()
  const membership = (teamQ.data ?? []).find((m) => m.userId === user.id)
  const roleLabel = MEMBER_ROLE_LABEL[membership?.memberRole ?? ''] ?? (user.role === 'admin' ? 'مشرف' : 'مستخدم')

  return (
    <WarmMenu
      ariaLabel="الحساب"
      width={280}
      trigger={({ toggle }) => (
        <button
          type="button"
          aria-label="الحساب"
          onClick={toggle}
          className="flex h-10 items-center gap-2 rounded-[10px] border border-line bg-paper-surface px-3 text-[13px] font-medium text-ink-700 transition-colors hover:bg-primary-50"
        >
          <UserRound className="size-[18px]" />
          <span className="hidden max-w-[140px] truncate lg:inline">{user.name ?? 'حسابي'}</span>
        </button>
      )}
    >
      {(close) => (
        <>
          <li className="border-b border-line px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-100 font-kufi font-bold text-[16px] text-primary-600">
                {user.name?.trim().charAt(0) ?? '؟'}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-kufi font-semibold text-[14px] text-ink-900">{user.name ?? 'حسابي'}</div>
                {user.email && (
                  <div className="truncate text-[11.5px] text-ink-500" dir="ltr">
                    {user.email}
                  </div>
                )}
                <span className="mt-1 inline-block rounded-full bg-gold-100 px-2 py-0.5 text-[10.5px] font-semibold text-gold-600">{roleLabel}</span>
              </div>
            </div>
          </li>
          <li>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                close()
                navigate('/settings')
              }}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-start text-[13px] font-medium text-ink-900 transition-colors hover:bg-primary-50"
            >
              <Settings className="size-4 text-ink-500" />
              الإعدادات
            </button>
          </li>
          <li>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                close()
                onLogout()
              }}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-start text-[13px] font-medium text-redink transition-colors hover:bg-redink-bg"
            >
              <LogOut className="size-4" />
              تسجيل الخروج
            </button>
          </li>
        </>
      )}
    </WarmMenu>
  )
}

export default function Navbar() {
  const location = useLocation()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const page = TITLE_MAP.find((t) => t.match.test(location.pathname)) ?? TITLE_MAP[0]
  const { user, isAuthenticated, isLoading, logout } = useAuth()

  // اختصارات لوحة المفاتيح: Ctrl+K / ⌘K / «/» تفتح البحث الشامل
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((o) => !o)
      } else if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault()
        setPaletteOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <header className="sticky top-0 z-50 h-16 border-b border-line bg-[rgba(246,241,231,.92)] backdrop-blur-md">
      <div className="h-full px-3 sm:px-4 lg:px-8 flex items-center gap-2 sm:gap-4">
        {/* عنوان الصفحة */}
        <div className="min-w-0">
          <h1 className="font-kufi font-bold text-[16px] leading-6 text-ink-900 truncate sm:text-[18px]">{page.title}</h1>
          {page.sub && <p className="hidden sm:block text-[11px] text-ink-500 truncate">{page.sub}</p>}
        </div>

        {/* البحث الشامل */}
        <div className="flex-1 flex justify-center">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="hidden md:flex w-full max-w-[380px] h-10 items-center gap-2.5 rounded-[10px] border border-line bg-paper-surface px-3.5 text-[13px] text-ink-400 hover:border-line-strong transition-colors"
          >
            <Search className="size-4" />
            <span className="flex-1 text-start">ابحث عن شخص، فرحة، مبلغ…</span>
            <kbd className="rounded-md border border-line bg-paper-sunken px-1.5 py-0.5 text-[10.5px] text-ink-500 num-ltr">Ctrl K</kbd>
          </button>
          <button
            type="button"
            aria-label="البحث"
            onClick={() => setPaletteOpen(true)}
            className="md:hidden flex size-10 items-center justify-center rounded-[10px] border border-line bg-paper-surface text-ink-700"
          >
            <Search className="size-[18px]" />
          </button>
        </div>

        {/* الإجراءات */}
        <div className="flex items-center gap-2.5">
          <Link
            to="/nuqta/new"
            className="hidden sm:inline-flex items-center gap-2 rounded-[10px] bg-primary-500 px-[18px] py-2.5 text-[14px] font-semibold text-[#FFFDF8] shadow-card transition-all hover:bg-primary-600 hover:-translate-y-px active:bg-primary-700 active:scale-[0.97]"
          >
            <NotebookPen className="size-4" />
            تسجيل نقطة
          </Link>
          <NotificationsMenu enabled={isAuthenticated} />
          {/* AUTH-SLOT */}
          {isLoading ? (
            <div
              aria-hidden
              className="h-10 w-24 animate-pulse rounded-[10px] border border-line bg-paper-sunken"
            />
          ) : isAuthenticated && user ? (
            <ProfileMenu user={user} onLogout={() => logout()} />
          ) : (
            <Link
              to={LOGIN_PATH}
              className="flex h-10 items-center gap-2 rounded-[10px] border border-line bg-paper-surface px-3 text-[13px] font-medium text-ink-700 hover:bg-primary-50 transition-colors"
            >
              <UserRound className="size-[18px]" />
              <span className="hidden lg:inline">تسجيل الدخول</span>
            </Link>
          )}
        </div>
      </div>

      <AnimatePresence>{paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}</AnimatePresence>
    </header>
  )
}
