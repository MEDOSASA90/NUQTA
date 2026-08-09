/**
 * أدوات تنسيق مشتركة — الأرقام والمبالغ والتواريخ
 * القرار المعتمد (design.md §٣.١): المبالغ والجداول بأرقام لاتينية جدولية (1,250)
 * مع وحدة «ج.م»، والعدّادات الاحتفالية بالأرقام المشرقية (٣ أيام).
 */

/** تنسيق مبلغ بأرقام لاتينية جدولية + فواصل آلاف */
export function formatMoney(n: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.abs(n))
}

/** تحويل الأرقام للأرقام العربية-مشرقية (للعدّادات الاحتفالية فقط) */
export function toArabicDigits(s: string | number): string {
  return String(s).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)])
}

/** تحية حسب الوقت */
export function greeting(hour = new Date().getHours()): 'صباح الخير' | 'مساء الخير' {
  return hour >= 5 && hour < 17 ? 'صباح الخير' : 'مساء الخير'
}

const AR_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
const AR_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']

/** «الخميس ١٦ أكتوبر ٢٠٢٥» */
export function formatArabicDate(d: Date): string {
  return `${AR_DAYS[d.getDay()]} ${toArabicDigits(d.getDate())} ${AR_MONTHS[d.getMonth()]} ${toArabicDigits(d.getFullYear())}`
}

/** تطبيع نص عربي للبحث (أإآ→ا، ة→ه، ى→ي، إزالة التشكيل) */
export function normalizeArabic(s: string): string {
  return s
    .replace(/[ً-ٟ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .trim()
}
