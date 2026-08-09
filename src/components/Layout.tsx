import { useState } from 'react'
import { Navigate, NavLink, Outlet, useLocation } from 'react-router'
import { AnimatePresence, motion } from 'framer-motion'
import {
  CalendarHeart,
  FileText,
  LayoutDashboard,
  MessageCircle,
  MoreHorizontal,
  NotebookPen,
  PanelLeftClose,
  PanelLeftOpen,
  Scale,
  ScrollText,
  ShieldCheck,
  Settings,
  Users,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toArabicDigits } from '@/lib/format'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { useAuth } from '@/hooks/useAuth'
import { LOGIN_PATH } from '@/const'
import { activeWeddingToday, currentUser } from '@/lib/seed-data'

/**
 * هيكل التطبيق (design.md §٧ و§٨.١) —
 * Sidebar يمين 264px قابل للطي إلى 76px + Topbar لزج 64px + منطقة محتوى
 * بحد أقصى 1440px. تحت 768px يتحول التنقل إلى شريط سفلي بخمسة عناصر.
 * المسارات المتداخلة تُعرض عبر <Outlet/> (نمط Nested-route).
 */

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  special?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'الرئيسية', icon: LayoutDashboard, end: true },
  { to: '/nuqta/new', label: 'تسجيل نقطة', icon: NotebookPen, special: true },
  { to: '/weddings', label: 'الأفراح', icon: CalendarHeart },
  { to: '/people', label: 'الأشخاص', icon: Users },
  { to: '/balances', label: 'الأرصدة', icon: Scale },
  { to: '/whatsapp', label: 'واتساب', icon: MessageCircle },
  { to: '/reports', label: 'التقارير', icon: FileText },
  { to: '/audit', label: 'سجل التدقيق', icon: ScrollText },
  { to: '/settings', label: 'الإعدادات', icon: Settings },
]

const MOBILE_MAIN = ['/', '/nuqta/new', '/weddings', '/people']

function SidebarLink({ item, collapsed, index }: { item: NavItem; collapsed: boolean; index: number }) {
  const Icon = item.icon
  return (
    <motion.li
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: 0.05 + index * 0.04, ease: [0.22, 1, 0.36, 1] }}
    >
      <NavLink
        to={item.to}
        end={item.end}
        title={collapsed ? item.label : undefined}
        className={({ isActive }) =>
          cn(
            'group relative flex items-center gap-3 rounded-[10px] px-3.5 py-2.5 text-[14px] transition-colors duration-150',
            item.special
              ? 'bg-primary-500 text-[#FFFDF8] font-semibold shadow-card hover:bg-primary-600'
              : isActive
                ? 'bg-primary-100 font-semibold text-ink-900 shadow-[inset_-3px_0_0_0_#A87438]'
                : 'text-ink-700 hover:bg-primary-50',
            collapsed && 'justify-center px-0',
          )
        }
      >
        {({ isActive }) => (
          <>
            <Icon
              className={cn(
                'size-[18px] shrink-0 transition-transform duration-150',
                item.special ? '' : isActive ? 'text-primary-700' : 'text-ink-500 group-hover:text-primary-600',
              )}
              strokeWidth={isActive || item.special ? 2.3 : 2}
            />
            {!collapsed && (
              <motion.span
                className="truncate"
                whileHover={item.special ? undefined : { x: -3 }}
                transition={{ duration: 0.16 }}
              >
                {item.label}
              </motion.span>
            )}
          </>
        )}
      </NavLink>
    </motion.li>
  )
}

function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()
  const { user } = useAuth()

  return (
    <aside
      className={cn(
        'hidden md:flex shrink-0 flex-col border-e border-line bg-paper-surface/80 backdrop-blur-sm transition-[width] duration-200 sticky top-0 h-[100dvh]',
        collapsed ? 'w-[76px]' : 'w-[264px]',
      )}
    >
      {/* الشعار */}
      <div className={cn('flex items-center gap-3 px-4 h-16 border-b border-line', collapsed && 'justify-center px-2')}>
        <img src="/logo.svg" alt="شعار أفراح الجمعية" className="size-10 shrink-0" />
        {!collapsed && (
          <div className="min-w-0">
            <div className="font-kufi font-bold text-[16px] leading-5 text-ink-900 truncate">أفراح الجمعية</div>
            <div className="text-[11px] text-ink-500 truncate">دفتر النقوط الرقمي</div>
          </div>
        )}
      </div>

      {/* عناصر التنقل */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map((item, i) => (
            <SidebarLink key={item.to} item={item} collapsed={collapsed} index={i} />
          ))}
          {user?.role === 'admin' && (
            <SidebarLink item={{ to: '/admin', label: 'إدارة النظام', icon: ShieldCheck }} collapsed={collapsed} index={NAV_ITEMS.length} />
          )}
        </ul>
      </nav>

      {/* بطاقة «فرحة نشطة» */}
      {!collapsed && activeWeddingToday && location.pathname !== '/nuqta/new' && (
        <div className="mx-3 mb-3 rounded-xl border border-gold-500/40 bg-gold-100/60 p-3.5">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-ink-900">
            <CalendarHeart className="size-4 text-gold-600" />
            فرحة اليوم
          </div>
          <div className="mt-1 font-kufi font-semibold text-[14px] text-ink-900">{activeWeddingToday.title}</div>
          <div className="text-[12px] text-ink-500">{toArabicDigits(activeWeddingToday.nuqtaCount)} نقطة حتى الآن</div>
          <NavLink
            to="/nuqta/new"
            className="mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary-500 py-2 text-[12.5px] font-semibold text-[#FFFDF8] transition-colors hover:bg-primary-600"
          >
            <NotebookPen className="size-3.5" />
            تابع التسجيل
          </NavLink>
        </div>
      )}

      {/* بطاقة المستخدم + زر الطي */}
      <div className={cn('border-t border-line p-3 flex items-center gap-3', collapsed && 'flex-col')}>
        {!collapsed && (
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-100 font-kufi font-bold text-[13px] text-primary-700">
              {currentUser.initials}
            </span>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-ink-900 truncate">{currentUser.name}</div>
              <div className="text-[11px] text-ink-500 truncate">{currentUser.role}</div>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'توسيع القائمة' : 'طي القائمة'}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-line text-ink-500 hover:bg-primary-50 hover:text-primary-600 transition-colors"
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </button>
      </div>
    </aside>
  )
}

/** شريط التنقل السفلي للموبايل — خمسة عناصر (design.md §٧) */
function MobileNav() {
  const [moreOpen, setMoreOpen] = useState(false)
  const location = useLocation()
  const { user } = useAuth()
  const main = NAV_ITEMS.filter((i) => MOBILE_MAIN.includes(i.to))
  const more = [
    ...NAV_ITEMS.filter((i) => !MOBILE_MAIN.includes(i.to) && !i.special),
    ...(user?.role === 'admin' ? [{ to: '/admin', label: 'إدارة النظام', icon: ShieldCheck }] : []),
  ]

  return (
    <>
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t border-line bg-paper-surface/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
        <ul className="grid grid-cols-5">
          {main.map((item) => {
            const Icon = item.icon
            const active = item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)
            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={cn(
                    'flex flex-col items-center gap-1 py-2 text-[10.5px]',
                    item.special ? 'text-primary-600 font-semibold' : active ? 'text-primary-700 font-semibold' : 'text-ink-500',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-9 items-center justify-center rounded-full',
                      item.special && 'bg-primary-500 text-[#FFFDF8] -mt-4 shadow-card border-2 border-paper-surface',
                      active && !item.special && 'bg-primary-100',
                    )}
                  >
                    <Icon className="size-[18px]" />
                  </span>
                  {item.label}
                </NavLink>
              </li>
            )
          })}
          <li>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className={cn(
                'w-full flex flex-col items-center gap-1 py-2 text-[10.5px]',
                more.some((m) => location.pathname.startsWith(m.to)) ? 'text-primary-700 font-semibold' : 'text-ink-500',
              )}
            >
              <span className="flex size-9 items-center justify-center rounded-full">
                <MoreHorizontal className="size-[18px]" />
              </span>
              المزيد
            </button>
          </li>
        </ul>
      </nav>

      <AnimatePresence>
        {moreOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="md:hidden fixed inset-0 z-[60] bg-[rgba(44,36,24,.4)] backdrop-blur-[4px]"
            onClick={() => setMoreOpen(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 34 }}
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-0 inset-x-0 rounded-t-2xl border-t border-line bg-paper-surface p-4 pb-8"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-kufi font-semibold text-[15px] text-ink-900">المزيد</span>
                <button
                  type="button"
                  aria-label="إغلاق"
                  onClick={() => setMoreOpen(false)}
                  className="flex size-8 items-center justify-center rounded-lg border border-line text-ink-500"
                >
                  <X className="size-4" />
                </button>
              </div>
              <ul className="grid grid-cols-2 gap-2">
                {more.map((item) => {
                  const Icon = item.icon
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        onClick={() => setMoreOpen(false)}
                        className="flex items-center gap-2.5 rounded-[10px] border border-line bg-paper-base px-3.5 py-3 text-[13.5px] font-medium text-ink-700"
                      >
                        <Icon className="size-[18px] text-primary-600" />
                        {item.label}
                      </NavLink>
                    </li>
                  )
                })}
              </ul>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

/**
 * شاشة «جاري التحقق من الدخول» — skeleton دافئ بشعار التطبيق يظهر
 * أثناء فحص الجلسة (auth.me) قبل عرض لوحة العمل.
 */
function AuthCheckingScreen() {
  return (
    <div
      dir="rtl"
      role="status"
      aria-label="جاري التحقق من تسجيل الدخول"
      className="flex min-h-[100dvh] flex-col items-center justify-center gap-5 bg-paper-base px-6"
    >
      <motion.img
        src="/logo.svg"
        alt="شعار أفراح الجمعية"
        className="size-20 drop-shadow-sm"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      />
      <div className="text-center">
        <div className="font-kufi font-bold text-[20px] leading-7 text-ink-900">أفراح الجمعية</div>
        <div className="mt-1 text-[13px] text-ink-500">دفتر النقوط الرقمي</div>
      </div>
      <img src="/ornament-divider.svg" alt="" className="h-3 w-36 select-none opacity-60" draggable={false} />
      <div className="flex w-full max-w-[280px] flex-col items-center gap-2.5" aria-hidden>
        <div className="h-3 w-full animate-pulse rounded-full bg-paper-sunken" />
        <div className="h-3 w-2/3 animate-pulse rounded-full bg-paper-sunken [animation-delay:150ms]" />
      </div>
      <span className="text-[12.5px] text-ink-500">لحظة واحدة… بنتأكد من تسجيل دخولك</span>
    </div>
  )
}

export default function Layout() {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  // بوابة المصادقة العالمية: كل صفحات لوحة العمل داخل Layout تتطلب تسجيل دخول.
  // الصفحات العامة (/login و/w/:token) خارج Layout فلا تمر بهذه البوابة.
  if (isLoading) return <AuthCheckingScreen />
  if (!isAuthenticated) {
    return (
      <Navigate
        to={LOGIN_PATH}
        replace
        state={{ from: location.pathname + location.search }}
      />
    )
  }

  return (
    <div className="flex min-h-[100dvh]">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Navbar />
        <main className="mx-auto w-full max-w-[1440px] flex-1 px-3 pb-24 pt-4 sm:px-4 md:px-8 md:pb-10 md:pt-8">
          <Outlet />
        </main>
        <Footer />
      </div>
      <MobileNav />
    </div>
  )
}
