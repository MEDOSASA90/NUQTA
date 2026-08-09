import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  BadgeCheck,
  CircleAlert,
  LoaderCircle,
  MapPin,
  Phone,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  UserRound,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { trpc } from '@/providers/trpc'
import Modal from '@/pages/grp-people/Modal'
import { toast } from '@/pages/grp-people/toast-bus'
import { digitsOnly, formatPhoneInput, isValidEgyptianPhone, nameKey } from '@/pages/grp-people/helpers'
import type { Person } from '@contracts/afrah'

/**
 * مودال «إضافة/تعديل شخص» (people.md §١.٣):
 * - الاسم + التليفون (تحقق فوري: 11 رقمًا يبدأ 01، تنسيق «0100 234 5678»
 *   أثناء الكتابة) + المنطقة بإكمال تلقائي من المناطق المسجلة.
 * - تنبيه غير مانع عند تشابه الاسم: «في 2 بنفس الاسم — هيتميزوا بالمنطقة/التليفون».
 * - بعد الإضافة خطوة تأكيد رقم التليفون: زر توثيق يعتمد الرقم «مُتحقق منه».
 * - CONFLICT (تليفون مكرر) يعرض رسالة ودية داخلية.
 * - في وضع التعديل: حذف بمنع — الخادم يرفض (PRECONDITION_FAILED) لو له نقوط.
 * النموذج يُعاد تركيبه عند كل فتح (key) فتُهيأ الحقول من الـ props بلا تأثيرات.
 */

export interface PersonFormModalProps {
  open: boolean
  onClose: () => void
  /** وضع التعديل يتطلب الشخص الحالي */
  person?: Person | null
  /** تعبئة اسم مسبقة (من بحث) */
  prefillName?: string
  /** كل الأشخاص — لتنبيه تشابه الأسماء */
  people: Person[]
  /** المناطق المسجلة — للإكمال التلقائي */
  regions: string[]
  /** افتح المودال على خطوة معينة (مثل تأكيد الحذف مباشرة) */
  initialStep?: Step
  onSaved?: (person: Person, isNew: boolean) => void
  /** بعد نجاح الحذف (مثلًا للرجوع لقائمة الأشخاص من صفحة البطاقة) */
  onDeleted?: () => void
}

type Step = 'form' | 'verify' | 'delete-confirm'

const inputCls =
  'h-11 w-full rounded-[10px] border border-line-strong bg-paper-surface px-3.5 text-[14px] text-ink-900 placeholder:text-ink-400 transition-colors focus:border-primary-500 focus:outline-none disabled:bg-paper-sunken disabled:text-ink-500'

export default function PersonFormModal(props: PersonFormModalProps) {
  const { open, onClose, person, prefillName } = props
  // المفتاح يتغير عند كل فتح ⇒ إعادة تركيب وتهيئة الحالة من غير useEffect
  const formKey = `${person?.id ?? 'new'}|${prefillName ?? ''}|${open ? 'open' : 'closed'}`
  return (
    <Modal open={open} onClose={onClose} className="max-w-[480px]">
      <FormBody key={formKey} {...props} />
    </Modal>
  )
}

function FormBody({
  onClose,
  person,
  prefillName,
  people,
  regions,
  initialStep = 'form',
  onSaved,
  onDeleted,
}: PersonFormModalProps) {
  const isEdit = !!person
  const utils = trpc.useUtils()

  const [step, setStep] = useState<Step>(initialStep)
  const [name, setName] = useState(() => person?.name ?? prefillName ?? '')
  const [phone, setPhone] = useState(() => (person ? formatPhoneInput(person.phone) : ''))
  const [region, setRegion] = useState(() => person?.region ?? '')
  const [formError, setFormError] = useState<string | null>(null)
  const [created, setCreated] = useState<Person | null>(null)
  const [challengeId, setChallengeId] = useState<number | null>(null)
  const [otp, setOtp] = useState('')

  const invalidate = async (id?: number) => {
    await Promise.all([
      utils.persons.list.invalidate(),
      utils.persons.search.invalidate(),
      utils.balances.matrix.invalidate(),
      ...(id ? [utils.persons.get.invalidate({ id })] : []),
    ])
  }

  const createMut = trpc.persons.create.useMutation({
    onSuccess: async (p) => {
      setCreated(p)
      setStep('verify') // خطوة تأكيد رقم التليفون قبل اعتماده «مُتحقق منه»
      await invalidate(p.id)
      onSaved?.(p, true)
    },
    onError: (e) => setFormError(e.message), // CONFLICT → رسالة ودية من الخادم
  })

  const updateMut = trpc.persons.update.useMutation({
    onSuccess: async (p) => {
      if (p) {
        toast('اتحفظت التعديلات')
        await invalidate(p.id)
        onSaved?.(p as Person, false)
      }
      onClose()
    },
    onError: (e) => setFormError(e.message),
  })

  const verifyMut = trpc.persons.verifyPhone.useMutation({
    onSuccess: async (p) => {
      if (p) {
        setCreated(p)
        toast('تم توثيق رقم التليفون')
        await invalidate(p.id)
      }
    },
    onError: (e) => toast(e.message, 'error'),
  })

  const requestOtpMut = trpc.persons.requestPhoneVerification.useMutation({
    onSuccess: (result) => {
      setChallengeId(result.challengeId)
      toast('اتبعث كود التحقق على واتساب')
    },
    onError: (error) => toast(error.message, 'error'),
  })

  const confirmOtpMut = trpc.persons.confirmPhoneVerification.useMutation({
    onSuccess: async (p) => {
      if (p) {
        setCreated(p)
        toast('تم تأكيد رقم الهاتف')
        await invalidate(p.id)
      }
    },
    onError: (error) => toast(error.message, 'error'),
  })

  const deleteMut = trpc.persons.delete.useMutation({
    onSuccess: async () => {
      toast('اتحذف من الدفتر')
      await invalidate()
      onClose()
      onDeleted?.()
    },
    onError: (e) => {
      setFormError(e.message) // PRECONDITION_FAILED: ممنوع الحذف لو له نقوط
      setStep('form')
    },
  })

  // المتشابهون بالاسم — تنبيه غير مانع مع معاينة
  const sameName = useMemo(() => {
    const k = nameKey(name)
    if (k.length < 3) return []
    return people.filter((p) => p.id !== person?.id && nameKey(p.name) === k)
  }, [people, name, person?.id])

  const phoneDigitsOk = isValidEgyptianPhone(phone)
  const phoneTouchedInvalid = phone.length > 0 && !phoneDigitsOk
  const nameOk = name.trim().length >= 2
  const saving = createMut.isPending || updateMut.isPending

  const submit = () => {
    setFormError(null)
    if (!nameOk) return setFormError('اكتب الاسم كامل (حرفين على الأقل)')
    if (!phoneDigitsOk) return setFormError('رقم التليفون لازم يكون 11 رقم ويبدأ بـ 01')
    if (isEdit && person) {
      updateMut.mutate({
        id: person.id,
        name: name.trim(),
        phone: formatPhoneInput(phone),
        region: region.trim(),
      })
    } else {
      createMut.mutate({ name: name.trim(), phone: formatPhoneInput(phone), region: region.trim() })
    }
  }

  const title = isEdit ? 'تعديل بيانات الشخص' : 'شخص جديد في الدفتر'
  const subtitle = isEdit ? 'عدّل الاسم أو التليفون أو المنطقة' : 'الاسم الكامل رباعي يُفضّل — عشان التمييز بين المتشابهين'

  return (
    <div>
      {/* الرأس */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-kufi font-semibold text-[18px] leading-7 text-ink-900">
            {step === 'verify' ? 'تأكيد رقم التليفون' : title}
          </h2>
          {step === 'form' && <p className="mt-1 text-[12.5px] text-ink-500">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="إغلاق"
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-ink-500 hover:bg-primary-50 hover:text-primary-600 transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {step === 'verify' && created ? (
          /* ─── خطوة تأكيد رقم التليفون بعد الإضافة ─── */
          <motion.div
            key="verify"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
          >
            <div className="rounded-[12px] border border-laha-solid/40 bg-laha-bg/50 p-4">
              <div className="flex items-center gap-2 text-[14px] font-semibold text-laha-text">
                <BadgeCheck className="size-5" />
                اتسجّل «{created.name}» في الدفتر
              </div>
              <p className="mt-2 text-[13px] leading-6 text-ink-700">
                رقم التليفون <span className="num-ltr font-semibold">{formatPhoneInput(created.phone)}</span> لسه
                «غير مُتحقق منه». التوثيق خطوة لازمة قبل ما يقدر النظام يبعتله رسايل واتساب بالنقوط.
              </p>
              <div className="mt-4 rounded-[10px] border border-line bg-paper-surface p-3">
                <div className="text-[12.5px] font-semibold text-ink-800">تأكيد فعلي عبر واتساب</div>
                {!challengeId ? (
                  <button
                    type="button"
                    onClick={() => requestOtpMut.mutate({ id: created.id })}
                    disabled={requestOtpMut.isPending}
                    className="mt-2 rounded-[9px] bg-primary-500 px-3.5 py-2 text-[12.5px] font-semibold text-white disabled:opacity-60"
                  >
                    {requestOtpMut.isPending ? 'جاري الإرسال…' : 'إرسال كود التحقق'}
                  </button>
                ) : (
                  <div className="mt-2 flex gap-2">
                    <input
                      value={otp}
                      onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                      inputMode="numeric"
                      placeholder="000000"
                      className="h-10 flex-1 rounded-[9px] border border-line-strong px-3 text-center tracking-[0.35em]"
                    />
                    <button
                      type="button"
                      onClick={() => confirmOtpMut.mutate({ challengeId, code: otp })}
                      disabled={otp.length !== 6 || confirmOtpMut.isPending}
                      className="rounded-[9px] bg-primary-500 px-3.5 text-[12.5px] font-semibold text-white disabled:opacity-60"
                    >
                      تأكيد
                    </button>
                  </div>
                )}
              </div>
              {created.phoneVerified ? (
                <div className="mt-3 flex items-center gap-2 rounded-[10px] bg-laha-bg px-3 py-2.5 text-[13px] font-semibold text-laha-text">
                  <ShieldCheck className="size-4" />
                  تم التوثيق — الرقم بقى «مُتحقق منه»
                </div>
              ) : (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => verifyMut.mutate({ id: created.id, verified: true })}
                    disabled={verifyMut.isPending}
                    className="inline-flex items-center gap-2 rounded-[10px] bg-primary-500 px-4 py-2.5 text-[13.5px] font-semibold text-[#FFFDF8] shadow-card transition-all hover:bg-primary-600 active:scale-[0.97] disabled:opacity-60"
                  >
                    {verifyMut.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                    توثيق الرقم دلوقتي
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-[10px] border border-line-strong px-4 py-2.5 text-[13.5px] font-medium text-ink-700 transition-colors hover:bg-primary-50"
                  >
                    سيبه لبعدين
                  </button>
                </div>
              )}
              {created.phoneVerified && (
                <button
                  type="button"
                  onClick={onClose}
                  className="mt-3 w-full rounded-[10px] border border-line-strong py-2.5 text-[13.5px] font-medium text-ink-700 transition-colors hover:bg-primary-50"
                >
                  تم
                </button>
              )}
            </div>
          </motion.div>
        ) : step === 'delete-confirm' && person ? (
          /* ─── تأكيد الحذف (بمنع لو له نقوط) ─── */
          <motion.div
            key="delete"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
          >
            <div className="rounded-[12px] border border-[#E3C4B8] bg-redink-bg p-4">
              <div className="flex items-center gap-2 text-[14px] font-semibold text-redink">
                <TriangleAlert className="size-5" />
                متأكد من حذف «{person.name}»؟
              </div>
              <p className="mt-2 text-[13px] leading-6 text-ink-700">
                الحذف نهائي. لو للشخص نقوط أو أفراح مسجلة، الدفتر هيمنع الحذف حفاظًا على الحسابات —
                وساعتها عدّل بياناته بدل الحذف.
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => deleteMut.mutate({ id: person.id })}
                  disabled={deleteMut.isPending}
                  className="inline-flex items-center gap-2 rounded-[10px] bg-destructive px-4 py-2.5 text-[13.5px] font-semibold text-[#FFFDF8] transition-all hover:brightness-95 active:scale-[0.97] disabled:opacity-60"
                >
                  {deleteMut.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                  نعم، احذف
                </button>
                <button
                  type="button"
                  onClick={() => setStep('form')}
                  className="rounded-[10px] border border-line-strong bg-paper-surface px-4 py-2.5 text-[13.5px] font-medium text-ink-700 transition-colors hover:bg-primary-50"
                >
                  تراجع
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          /* ─── نموذج البيانات ─── */
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault()
                submit()
              }}
              className="flex flex-col gap-4"
            >
              {/* الاسم */}
              <label className="block">
                <span className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium text-ink-700">
                  <UserRound className="size-3.5 text-ink-500" />
                  الاسم
                </span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="محمد عبد الله السيد"
                  className={inputCls}
                  autoFocus
                  maxLength={255}
                />
              </label>

              {/* تنبيه تشابه الاسم — غير مانع */}
              <AnimatePresence>
                {sameName.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="rounded-[10px] border border-partial-solid/40 bg-partial-bg px-3.5 py-2.5">
                      <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-partial-text">
                        <CircleAlert className="size-3.5" />
                        في {sameName.length === 1 ? 'شخص' : `${sameName.length} أشخاص`} بنفس الاسم — هيتميزوا بالمنطقة/التليفون
                      </div>
                      <ul className="mt-1.5 space-y-0.5">
                        {sameName.slice(0, 3).map((p) => (
                          <li key={p.id} className="flex items-center gap-2 text-[12px] text-ink-700">
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="size-3 text-ink-400" />
                              {p.region || 'بدون منطقة'}
                            </span>
                            <span className="num-ltr text-ink-500">{formatPhoneInput(p.phone)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* التليفون */}
              <label className="block">
                <span className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium text-ink-700">
                  <Phone className="size-3.5 text-ink-500" />
                  التليفون
                  {isEdit && person?.phoneVerified && (
                    <span className="ms-auto inline-flex items-center gap-1 rounded-full bg-laha-bg px-2 py-0.5 text-[11px] font-medium text-laha-text">
                      <BadgeCheck className="size-3" />
                      مُتحقق منه
                    </span>
                  )}
                </span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                  placeholder="0100 234 5678"
                  inputMode="tel"
                  dir="ltr"
                  className={cn(inputCls, 'text-left num-ltr', phoneTouchedInvalid && 'border-destructive')}
                />
                <span className={cn('mt-1 block text-[11.5px]', phoneTouchedInvalid ? 'text-destructive' : 'text-ink-400')}>
                  {phoneTouchedInvalid ? 'الرقم لازم يكون 11 رقم ويبدأ بـ 01' : '11 رقم يبدأ بـ 01 — بيتنسق تلقائي أثناء الكتابة'}
                </span>
                {isEdit && person && digitsOnly(person.phone) !== digitsOnly(phone) && phoneDigitsOk && (
                  <span className="mt-0.5 block text-[11.5px] text-partial-text">تغيير الرقم هيلغي توثيقه وهيحتاج توثيق من جديد</span>
                )}
              </label>

              {/* المنطقة — إكمال تلقائي من المناطق المسجلة */}
              <label className="block">
                <span className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium text-ink-700">
                  <MapPin className="size-3.5 text-ink-500" />
                  المنطقة
                </span>
                <input
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  placeholder="المعادي"
                  list="grp-people-regions"
                  className={inputCls}
                  maxLength={255}
                />
                <datalist id="grp-people-regions">
                  {regions.map((r) => (
                    <option key={r} value={r} />
                  ))}
                </datalist>
                <span className="mt-1 block text-[11.5px] text-ink-400">اكتب أول حروف منطقة مسجلة أو أضف منطقة جديدة</span>
              </label>

              {/* رسالة الخطأ (CONFLICT / PRECONDITION / غيرها) */}
              <AnimatePresence>
                {formError && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="flex items-start gap-2 rounded-[10px] border border-[#E3C4B8] bg-redink-bg px-3.5 py-2.5 text-[13px] leading-6 text-redink">
                      <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                      {formError}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* الأزرار */}
              <div className="mt-1 flex items-center gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-[10px] bg-primary-500 px-[18px] py-2.5 text-[14px] font-semibold text-[#FFFDF8] shadow-card transition-all hover:bg-primary-600 hover:-translate-y-px active:bg-primary-700 active:scale-[0.97] disabled:opacity-60"
                >
                  {saving && <LoaderCircle className="size-4 animate-spin" />}
                  {isEdit ? 'حفظ التعديلات' : 'إضافة للدفتر'}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-[10px] border border-line-strong px-[18px] py-2.5 text-[14px] font-medium text-ink-700 transition-colors hover:bg-primary-50"
                >
                  إلغاء
                </button>
                {isEdit && person && (
                  <button
                    type="button"
                    onClick={() => {
                      setFormError(null)
                      setStep('delete-confirm')
                    }}
                    className="ms-auto inline-flex items-center gap-1.5 rounded-[10px] border border-[#E3C4B8] px-3.5 py-2.5 text-[13px] font-medium text-destructive transition-colors hover:bg-redink-bg"
                  >
                    <Trash2 className="size-3.5" />
                    حذف
                  </button>
                )}
              </div>

              {/* توثيق سريع داخل التعديل */}
              {isEdit && person && !person.phoneVerified && digitsOnly(person.phone) === digitsOnly(phone) && (
                <button
                  type="button"
                  onClick={() => verifyMut.mutate({ id: person.id, verified: true })}
                  disabled={verifyMut.isPending}
                  className="inline-flex items-center justify-center gap-2 rounded-[10px] border border-laha-solid/50 bg-laha-bg/50 py-2.5 text-[13px] font-semibold text-laha-text transition-colors hover:bg-laha-bg disabled:opacity-60"
                >
                  {verifyMut.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                  توثيق رقم التليفون الحالي
                </button>
              )}
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
