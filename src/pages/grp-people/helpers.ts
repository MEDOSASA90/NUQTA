/**
 * أدوات محلية لصفحات الأشخاص والأرصدة (grp-people) —
 * تنسيق التواريخ العربية، الوقت النسبي المحايد «منذ ١٤ شهرًا»،
 * تنسيق/تحقق التليفون المصري، وتصدير CSV.
 */
import { normalizeArabic, toArabicDigits } from '@/lib/format'

const AR_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
]

/** «12 سبتمبر 2025» بأرقام لاتينية (للجداول والبطاقات) */
export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '—'
  const date = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(date.getTime())) return '—'
  return `${date.getDate()} ${AR_MONTHS[date.getMonth()]} ${date.getFullYear()}`
}

/** «مارس 2022» — لعبارة «في الدفتر من…» */
export function formatMonthYear(d: Date | string | null | undefined): string {
  if (!d) return '—'
  const date = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(date.getTime())) return '—'
  return `${AR_MONTHS[date.getMonth()]} ${date.getFullYear()}`
}

/**
 * عمر محايد بالأرقام المشرقية: «منذ ١٤ شهرًا» — بلا أي إحساس تأخير
 * (design.md §٨.٦: الدَّين يفضل مفتوحًا، العمر للعلم فقط).
 */
export function sinceLabel(d: Date | string | null | undefined): string {
  if (!d) return ''
  const date = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(date.getTime())) return ''
  const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000))
  if (days < 1) return 'منذ النهارده'
  if (days === 1) return 'منذ يوم واحد'
  if (days === 2) return 'منذ يومين'
  if (days <= 10) return `منذ ${toArabicDigits(days)} أيام`
  if (days < 30) return `منذ ${toArabicDigits(days)} يومًا`
  const months = Math.floor(days / 30.44)
  if (months === 1) return 'منذ شهر واحد'
  if (months === 2) return 'منذ شهرين'
  if (months <= 10) return `منذ ${toArabicDigits(months)} شهور`
  if (months < 12) return `منذ ${toArabicDigits(months)} شهرًا`
  const years = Math.floor(months / 12)
  const rem = months % 12
  const yPart = years === 1 ? 'سنة' : years === 2 ? 'سنتين' : `${toArabicDigits(years)} سنوات`
  if (rem === 0) return `منذ ${yPart}`
  const mPart = rem === 1 ? 'شهر' : rem === 2 ? 'شهرين' : `${toArabicDigits(rem)} شهور`
  return `منذ ${yPart} و${mPart}`
}

/** أرقام التليفون فقط (يدعم الأرقام المشرقية) */
export function digitsOnly(s: string): string {
  return s.replace(/[^0-9٠-٩]/g, '').replace(/[٠-٩]/g, (ch) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(ch)))
}

/** تحقق التليفون المصري: 11 رقمًا يبدأ 01 */
export function isValidEgyptianPhone(s: string): boolean {
  return /^01[0-9]{9}$/.test(digitsOnly(s))
}

/** تنسيق أثناء الكتابة: «0100 234 5678» */
export function formatPhoneInput(s: string): string {
  const d = digitsOnly(s).slice(0, 11)
  if (d.length <= 4) return d
  if (d.length <= 7) return `${d.slice(0, 4)} ${d.slice(4)}`
  return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`
}

/** تطبيع الاسم للمقارنة (تمييز المتشابهين) */
export function nameKey(name: string): string {
  return normalizeArabic(name).replace(/\s+/g, ' ').trim()
}

/** حرف أول الاسم للدوائر */
export function initialOf(name: string): string {
  return name.trim().charAt(0) || '؟'
}

/** خلفيات دافئة متناوبة لدوائر الأحرف (people.md §١.٢) */
const AVATAR_BG = [
  'bg-primary-100 text-primary-700',
  'bg-gold-100 text-gold-600',
  'bg-laha-bg text-laha-text',
  'bg-paper-sunken text-ink-700',
]
export function avatarTone(id: number): string {
  return AVATAR_BG[Math.abs(id) % AVATAR_BG.length]
}

/** تصدير صفوف CSV (BOM للعربية في إكسل) */
export function downloadCsv(filename: string, header: string[], rows: (string | number)[][]): void {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
  const body = [header, ...rows].map((r) => r.map(esc).join(',')).join('\r\n')
  const blob = new Blob(['\uFEFF' + body], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** الترتيب الكنسي للزوج: الأصغر id = A */
export function canonicalPair(x: number, y: number): { a: number; b: number } {
  return x < y ? { a: x, b: y } : { a: y, b: x }
}

/** نص حالة السداد بالعربية */
export function statusText(s: 'open' | 'partial' | 'settled' | 'overpaid'): string {
  switch (s) {
    case 'open':
      return 'مفتوح'
    case 'partial':
      return 'سداد جزئي'
    case 'settled':
      return 'صفّى حسابه'
    case 'overpaid':
      return 'زيادة'
  }
}
