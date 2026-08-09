/**
 * أدوات نقية مشتركة لصفحات grp-core — بلا مكونات (يفصل react-refresh عن grp-kit).
 */
import { createContext, useContext } from 'react'
import { toArabicDigits } from '@/lib/format'

export const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number]

/* ─────────── Toast context ─────────── */

export type ToastKind = 'success' | 'error' | 'info'

export const ToastCtx = createContext<(kind: ToastKind, text: string) => void>(() => {})
export const useToast = () => useContext(ToastCtx)

/* ─────────── نسخ للحافظة ─────────── */

/** نسخ نص للحافظة مع بديل execCommand عند فشل Clipboard API */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    } catch {
      return false
    }
  }
}

/* ─────────── أدوات زمن عربية ─────────── */

function plural(n: number, one: string, two: string, few: string, many: string): string {
  if (n === 1) return one
  if (n === 2) return two
  if (n >= 3 && n <= 10) return `${toArabicDigits(n)} ${few}`
  return `${toArabicDigits(n)} ${many}`
}

/** «قبل ١٤ دقيقة» — زمن نسبي بالعربية */
export function timeAgo(date: Date): string {
  const mins = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000))
  if (mins < 1) return 'دلوقتي حالًا'
  if (mins < 60) return `قبل ${plural(mins, 'دقيقة', 'دقيقتين', 'دقائق', 'دقيقة')}`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `قبل ${plural(hours, 'ساعة', 'ساعتين', 'ساعات', 'ساعة')}`
  const days = Math.floor(hours / 24)
  if (days < 30) return `قبل ${plural(days, 'يوم', 'يومين', 'أيام', 'يومًا')}`
  const months = Math.floor(days / 30)
  return `قبل ${plural(months, 'شهر', 'شهرين', 'شهور', 'شهرًا')}`
}

/** الأيام المتبقية حتى تاريخ (بالتقويم المحلي، بلا ساعات) */
export function daysUntil(date: Date): number {
  const now = new Date()
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const b = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

export function daysLeftLabel(d: number): string {
  if (d <= 0) return 'النهارده'
  if (d === 1) return 'بكرة'
  if (d === 2) return 'بعد يومين'
  if (d <= 10) return `بعد ${toArabicDigits(d)} أيام`
  return `بعد ${toArabicDigits(d)} يوم`
}

const AR_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
export const AR_WEEKDAYS = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت']

export function arabicMonth(monthIndex: number): string {
  return AR_MONTHS[monthIndex]
}

/** «١٧ أكتوبر ٢٠٢٥» (بدون اسم اليوم) */
export function formatShortArabicDate(d: Date): string {
  return `${toArabicDigits(d.getDate())} ${AR_MONTHS[d.getMonth()]} ${toArabicDigits(d.getFullYear())}`
}

/** «8:14 م» — وقت عربي مختصر */
export function formatArabicTime(d: Date): string {
  const h24 = d.getHours()
  const period = h24 < 12 ? 'ص' : 'م'
  const h = h24 % 12 === 0 ? 12 : h24 % 12
  return `${toArabicDigits(h)}:${toArabicDigits(String(d.getMinutes()).padStart(2, '0'))} ${period}`
}

/* ─────────── أدوات مبالغ ─────────── */

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩'

/** يقبل أرقامًا عربية أو إنجليزية ويعيد رقمًا صحيحًا موجبًا أو null */
export function parseAmountInput(raw: string): number | null {
  const latin = raw.replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)))
  const cleaned = latin.replace(/[,\s\u066C]/g, '')
  if (!cleaned) return null
  const n = Number(cleaned)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n)
}
