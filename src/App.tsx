import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'
import Layout from '@/components/Layout'

const Dashboard = lazy(() => import('@/pages/Dashboard'))
const RecordNuqta = lazy(() => import('@/pages/RecordNuqta'))
const Weddings = lazy(() => import('@/pages/Weddings'))
const WeddingDetails = lazy(() => import('@/pages/WeddingDetails'))
const People = lazy(() => import('@/pages/People'))
const PersonDetails = lazy(() => import('@/pages/PersonDetails'))
const Balances = lazy(() => import('@/pages/Balances'))
const Whatsapp = lazy(() => import('@/pages/Whatsapp'))
const Reports = lazy(() => import('@/pages/Reports'))
const AuditLog = lazy(() => import('@/pages/AuditLog'))
const Settings = lazy(() => import('@/pages/Settings'))
const Admin = lazy(() => import('@/pages/Admin'))
const WeddingOwner = lazy(() => import('@/pages/WeddingOwner'))
const Login = lazy(() => import('@/pages/Login'))
const NotFound = lazy(() => import('@/pages/NotFound'))

function RouteLoading() {
  return (
    <div className="flex min-h-[45vh] items-center justify-center px-4" role="status" aria-label="جاري تحميل الصفحة">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-line bg-paper-surface p-8 shadow-card">
        <img src="/logo.svg" alt="" className="size-12 animate-pulse" />
        <div className="h-2.5 w-40 animate-pulse rounded-full bg-paper-sunken" />
        <div className="h-2.5 w-24 animate-pulse rounded-full bg-paper-sunken" />
      </div>
    </div>
  )
}
/**
 * التوجيه — نمط المسارات المتداخلة (Layout-route): كل صفحات لوحة العمل
 * داخل <Layout/> (Sidebar + Topbar + Outlet). الصفحات العامة
 * (تسجيل الدخول، صفحة صاحب الفرح) خارجه.
 */
export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteLoading />}>
        <Routes>
          <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="nuqta/new" element={<RecordNuqta />} />
          <Route path="weddings" element={<Weddings />} />
          <Route path="weddings/:id" element={<WeddingDetails />} />
          <Route path="people" element={<People />} />
          <Route path="people/:id" element={<PersonDetails />} />
          <Route path="balances" element={<Balances />} />
          <Route path="whatsapp" element={<Whatsapp />} />
          <Route path="reports" element={<Reports />} />
          <Route path="audit" element={<AuditLog />} />
          <Route path="settings" element={<Settings />} />
          <Route path="admin" element={<Admin />} />
          </Route>
          <Route path="/w/:token" element={<WeddingOwner />} />
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
