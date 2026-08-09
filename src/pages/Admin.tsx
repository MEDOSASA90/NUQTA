import { useMemo, useState } from 'react'
import { ShieldCheck, Users, Building2, Save, UserPlus } from 'lucide-react'
import { trpc } from '@/providers/trpc'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'

const PERMISSIONS = [
  ['record', 'تسجيل النقاط'],
  ['review', 'مراجعة السجل'],
  ['edit', 'تعديل النقاط'],
  ['reports', 'التقارير'],
  ['manage_events', 'إدارة الأفراح'],
  ['manage_team', 'إدارة الفريق'],
] as const

type Permission = (typeof PERMISSIONS)[number][0]

export default function Admin() {
  const { user } = useAuth()
  const usersQ = trpc.admin.users.useQuery(undefined, { enabled: user?.role === 'admin' })
  const tenantsQ = trpc.admin.tenants.useQuery(undefined, { enabled: user?.role === 'admin' })
  const [tenantId, setTenantId] = useState<number | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const membershipsQ = trpc.admin.memberships.useQuery(
    { tenantId: tenantId ?? 0 },
    { enabled: tenantId !== null },
  )
  const utils = trpc.useUtils()
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '' })
  const createUserMut = trpc.admin.createUser.useMutation({
    onSuccess: async () => {
      setNewUser({ name: '', email: '', password: '' })
      await utils.admin.users.invalidate()
    },
  })
  const statusMut = trpc.admin.setUserStatus.useMutation({
    onSuccess: async () => {
      await utils.admin.users.invalidate()
    },
  })
  const membershipMut = trpc.admin.setMembership.useMutation({
    onSuccess: async () => {
      await utils.admin.memberships.invalidate()
    },
  })

  const selectedMembership = useMemo(
    () => membershipsQ.data?.find((membership) => membership.userId === selectedUserId),
    [membershipsQ.data, selectedUserId],
  )
  const [role, setRole] = useState<'scribe' | 'team'>('team')
  const [permissions, setPermissions] = useState<Permission[]>([])

  const selectMembership = (userId: number) => {
    setSelectedUserId(userId)
    const membership = membershipsQ.data?.find((item) => item.userId === userId)
    if (!membership) {
      setRole('team')
      setPermissions([])
      return
    }
    setRole(membership.role)
    setPermissions(membership.permissions.filter((permission): permission is Permission => PERMISSIONS.some(([key]) => key === permission)))
  }

  if (user?.role !== 'admin') {
    return <div className="surface-card p-8 text-center text-ink-600">ليس لديك صلاحية الوصول إلى إدارة النظام.</div>
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-kufi text-[24px] font-bold text-ink-900">إدارة النظام</h1>
        <p className="mt-1 text-[13px] text-ink-500">إدارة المستخدمين، المستأجرين، وأدوار فريق التسجيل.</p>
      </div>

      <section className="surface-card p-5">
        <div className="mb-4 flex items-center gap-2 font-kufi font-semibold text-ink-900"><UserPlus className="size-5 text-primary-600" /> إنشاء مستخدم</div>
        <form onSubmit={(event) => { event.preventDefault(); createUserMut.mutate(newUser) }} className="grid gap-3 md:grid-cols-4">
          <input required minLength={2} value={newUser.name} onChange={(event) => setNewUser({ ...newUser, name: event.target.value })} placeholder="الاسم" className="h-11 rounded-lg border border-line-strong bg-paper-base px-3 text-sm" />
          <input required type="email" value={newUser.email} onChange={(event) => setNewUser({ ...newUser, email: event.target.value })} placeholder="البريد الإلكتروني" className="h-11 rounded-lg border border-line-strong bg-paper-base px-3 text-sm" dir="ltr" />
          <input required minLength={8} type="password" value={newUser.password} onChange={(event) => setNewUser({ ...newUser, password: event.target.value })} placeholder="كلمة المرور" className="h-11 rounded-lg border border-line-strong bg-paper-base px-3 text-sm" dir="ltr" />
          <button type="submit" disabled={createUserMut.isPending} className="h-11 rounded-lg bg-primary-500 px-4 text-sm font-semibold text-white disabled:opacity-60">{createUserMut.isPending ? 'جاري الإنشاء…' : 'إنشاء المستخدم'}</button>
        </form>
        {createUserMut.error && <p role="alert" className="mt-3 text-sm text-redink">تعذر إنشاء المستخدم: {createUserMut.error.message}</p>}
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="surface-card p-5">
          <div className="mb-4 flex items-center gap-2 font-kufi font-semibold text-ink-900"><Users className="size-5 text-primary-600" /> المستخدمون</div>
          <div className="flex flex-col gap-2">
            {usersQ.data?.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-xl border border-line bg-paper-base p-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold text-ink-900">{item.name ?? item.email ?? `مستخدم ${item.id}`}</div>
                  <div className="text-[12px] text-ink-500">{item.email ?? 'بدون بريد'} · {item.role === 'admin' ? 'مدير نظام' : 'مستخدم'}</div>
                </div>
                <button
                  type="button"
                  onClick={() => statusMut.mutate({ userId: item.id, status: item.status === 'active' ? 'suspended' : 'active' })}
                  disabled={statusMut.isPending}
                  className={cn('rounded-lg px-3 py-1.5 text-[12px] font-semibold', item.status === 'active' ? 'bg-laha-bg text-laha-text' : 'bg-redink-bg text-redink')}
                >
                  {item.status === 'active' ? 'نشط' : 'موقوف'}
                </button>
              </div>
            ))}
            {!usersQ.isLoading && !usersQ.data?.length && <p className="text-[13px] text-ink-500">لا يوجد مستخدمون.</p>}
          </div>
        </section>

        <section className="surface-card p-5">
          <div className="mb-4 flex items-center gap-2 font-kufi font-semibold text-ink-900"><Building2 className="size-5 text-primary-600" /> المستأجرون</div>
          <div className="flex flex-col gap-2">
            {tenantsQ.data?.map((tenant) => (
              <button
                key={tenant.id}
                type="button"
                onClick={() => { setTenantId(tenant.id); setSelectedUserId(null) }}
                className={cn('rounded-xl border p-3 text-start transition-colors', tenantId === tenant.id ? 'border-primary-500 bg-primary-50' : 'border-line bg-paper-base hover:bg-primary-50')}
              >
                <div className="text-[14px] font-semibold text-ink-900">{tenant.name}</div>
                <div className="text-[12px] text-ink-500">#{tenant.id}</div>
              </button>
            ))}
            {!tenantsQ.isLoading && !tenantsQ.data?.length && <p className="text-[13px] text-ink-500">لا يوجد مستأجرون.</p>}
          </div>
        </section>
      </div>

      {tenantId !== null && (
        <section className="surface-card p-5">
          <div className="mb-4 flex items-center gap-2 font-kufi font-semibold text-ink-900"><ShieldCheck className="size-5 text-primary-600" /> صلاحيات الفريق</div>
          <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
            <div className="flex flex-col gap-2">
              {usersQ.data?.map((item) => (
                <button key={item.id} type="button" onClick={() => selectMembership(item.id)} className={cn('rounded-lg border p-2.5 text-start text-[13px]', selectedUserId === item.id ? 'border-primary-500 bg-primary-50' : 'border-line')}>
                  {item.name ?? item.email ?? `مستخدم ${item.id}`}
                </button>
              ))}
            </div>
            {selectedMembership && selectedUserId !== null ? (
              <div>
                <div className="mb-3 text-[13px] text-ink-600">تعديل صلاحيات العضوية المختارة.</div>
                <select value={role} onChange={(event) => setRole(event.target.value as 'scribe' | 'team')} className="mb-4 h-10 rounded-lg border border-line-strong bg-paper-surface px-3 text-[13px]">
                  <option value="team">عضو فريق</option>
                  <option value="scribe">كاتب</option>
                </select>
                <div className="grid gap-2 sm:grid-cols-2">
                  {PERMISSIONS.map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 rounded-lg border border-line p-2.5 text-[13px]">
                      <input type="checkbox" checked={permissions.includes(key)} onChange={() => setPermissions((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key])} />
                      {label}
                    </label>
                  ))}
                </div>
                <button type="button" onClick={() => membershipMut.mutate({ tenantId, userId: selectedUserId, role, permissions })} disabled={membershipMut.isPending} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-60">
                  <Save className="size-4" /> حفظ الصلاحيات
                </button>
              </div>
            ) : (
              <p className="text-[13px] text-ink-500">اختر مستخدمًا لعرض عضويته.</p>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
