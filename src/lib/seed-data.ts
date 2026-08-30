/**
 * ────────────────────────────────────────────────────────────────
 *  SEED DATA — بيانات واقعية مؤقتة من وثيقة التصميم (design.md)
 *  ⚠️ DATA-SLOT: هذه الطبقة ستُستبدل بالكامل باستدعاءات tRPC
 *     (routers: weddings / people / nuqtas / balances / stats)
 *     في المرحلة الخلفية. كل الصفحات تستهلك من هنا فقط،
 *     فلا تربط المكونات بمصدر بيانات ثابت داخلها.
 * ────────────────────────────────────────────────────────────────
 */

// ---------- الأنواع (نموذج البيانات — design.md §٩) ----------

export interface Person {
  id: string
  name: string
  phone: string
  region: string
  nuqtaId?: string | null
}

export type WeddingStatus = 'upcoming' | 'done'

export interface Wedding {
  id: string
  title: string
  ownerName: string
  date: string // ISO
  hijriNote?: string
  venue: string
  status: WeddingStatus
}

export interface Nuqta {
  id: string
  payer: Person
  wedding: Wedding
  amount: number
  invitedBy?: string // «مين دعاه»
  recordedAt: string // ISO
  whatsappSent: boolean
  correctedAfterWedding?: boolean
}

export type SettlementState = 'open' | 'partial' | 'settled' | 'overpaid'

export interface Balance {
  id: string
  person: Person
  /** صافي المبلغ: موجب = له (مستحق لك)، سالب = عليه */
  net: number
  interactions: number
  state: SettlementState
  lastInteractionAt: string
}

// ---------- أدوات تنسيق مشتركة (تعيش في lib/format.ts) ----------
export { formatMoney, toArabicDigits, greeting, formatArabicDate, normalizeArabic } from './format'

// ---------- إحصائيات لوحة التحكم ----------

export interface StatItem {
  id: 'month-nuqtas' | 'balances-for' | 'balances-on' | 'people'
  title: string
  value: number
  suffix: string
  sub: string
  trend?: string
  spark: number[]
  href: string
}

export const dashboardStats: StatItem[] = [
  {
    id: 'month-nuqtas',
    title: 'نقوط أكتوبر',
    value: 216800,
    suffix: 'ج.م',
    sub: '174 نقطة',
    trend: '+18% عن سبتمبر',
    spark: [182, 240, 158, 171, 183, 217],
    href: '/reports',
  },
  {
    id: 'balances-for',
    title: 'أرصدة لك',
    value: 45500,
    suffix: 'ج.م',
    sub: '38 رصيد مفتوح بينك وبين الناس',
    spark: [31, 36, 33, 39, 42, 45.5],
    href: '/balances',
  },
  {
    id: 'balances-on',
    title: 'أرصدة عليك',
    value: 12750,
    suffix: 'ج.م',
    sub: '11 رصيد — مفيش استعجال، بمزاجك',
    spark: [18, 16.5, 17, 14, 13.4, 12.75],
    href: '/balances',
  },
  {
    id: 'people',
    title: 'الأشخاص',
    value: 1246,
    suffix: '',
    sub: '+23 شخص جديد الشهر ده',
    spark: [1150, 1171, 1190, 1204, 1223, 1246],
    href: '/people',
  },
]

// ---------- الأفراح القادمة ----------

export interface UpcomingWedding {
  id: string
  title: string
  dateLabel: string
  daysLeft: number
  venue: string
  readyCount: number
  invitedCount: number
  missingCount: number
  lastWeddingNote: string
  reminderNote: string
}

export const upcomingWeddings: UpcomingWedding[] = [
  {
    id: 'w-mahmoud-dina',
    title: 'فرحة محمود ودينا',
    dateLabel: 'الجمعة ١٧ أكتوبر ٢٠٢٥',
    daysLeft: 3,
    venue: 'نادي الشمس الرياضي',
    readyCount: 86,
    invitedCount: 120,
    missingCount: 34,
    lastWeddingNote: 'آخر فرحة لمحمود: سبتمبر ٢٠٢٣',
    reminderNote: 'التذكير اليومي شغال — بيبعت 9 صباحًا',
  },
  {
    id: 'w-karim-salma',
    title: 'فرحة كريم وسلمى',
    dateLabel: 'الخميس ٣٠ أكتوبر ٢٠٢٥',
    daysLeft: 16,
    venue: 'قاعة اللؤلؤة — مدينة نصر',
    readyCount: 54,
    invitedCount: 98,
    missingCount: 44,
    lastWeddingNote: 'أول فرحة لكريم في الدفتر',
    reminderNote: 'التذكير هيبدأ قبل الفرح بـ ٣ أيام',
  },
]

// ---------- نشاط اليوم ----------

export interface ActivityItem {
  id: string
  payerName: string
  amount: number
  weddingTitle: string
  timeAgo: string
  whatsappSent: boolean
  correction?: boolean
}

export const todayActivity: ActivityItem[] = [
  { id: 'a1', payerName: 'خالد سمير', amount: 2000, weddingTitle: 'فرحة عمر ونورهان', timeAgo: 'قبل 14 دقيقة', whatsappSent: true },
  { id: 'a2', payerName: 'منى عبد العزيز', amount: 1000, weddingTitle: 'فرحة عمر ونورهان', timeAgo: 'قبل 41 دقيقة', whatsappSent: true },
  { id: 'a3', payerName: 'حسن الطاهر', amount: 500, weddingTitle: 'فرحة عمر ونورهان', timeAgo: 'قبل ساعة', whatsappSent: true, correction: true },
  { id: 'a4', payerName: 'سامي رشوان', amount: 3000, weddingTitle: 'فرحة محمود ودينا', timeAgo: 'قبل ساعتين', whatsappSent: true },
  { id: 'a5', payerName: 'نهى فؤاد', amount: 750, weddingTitle: 'فرحة عمر ونورهان', timeAgo: 'قبل ٣ ساعات', whatsappSent: false },
  { id: 'a6', payerName: 'عادل منصور', amount: 1500, weddingTitle: 'فرحة محمود ودينا', timeAgo: 'قبل ٥ ساعات', whatsappSent: true },
]

export const todayCount = 7

// ---------- النقوط آخر ٦ شهور ----------

export interface MonthlyNuqta {
  month: string
  amount: number
  count: number
  current?: boolean
}

export const monthlyNuqtas: MonthlyNuqta[] = [
  { month: 'مايو', amount: 182400, count: 141 },
  { month: 'يونيو', amount: 240300, count: 193 },
  { month: 'يوليو', amount: 158200, count: 128 },
  { month: 'أغسطس', amount: 171600, count: 137 },
  { month: 'سبتمبر', amount: 183700, count: 149 },
  { month: 'أكتوبر', amount: 216800, count: 174, current: true },
]

export const monthlyPeakNote = 'أعلى شهر: يونيو (٣ أفراح) — 240,300 ج.م'

// ---------- ميزان الأرصدة ----------

export const balancesSummary = {
  forYou: 45500,
  onYou: 12750,
  settledThisMonth: 8200,
  activeCount: 66,
}

export interface TopBalance {
  id: string
  personName: string
  net: number
  interactions: number
}

export const topBalances: TopBalance[] = [
  { id: 'b1', personName: 'مصطفى كامل', net: 5000, interactions: 3 },
  { id: 'b2', personName: 'سعاد رزق', net: 2750, interactions: 2 },
  { id: 'b3', personName: 'إبراهيم شعبان', net: -1500, interactions: 4 },
]

// ---------- الأفراح السابقة ----------

export interface PastWedding {
  id: string
  title: string
  venue: string
  dateLabel: string
  nuqtaCount: number
  total: number
  reportReady: boolean
  postWeddingEdits?: { count: number; lastAt: string }
}

export const pastWeddings: PastWedding[] = [
  {
    id: 'pw1',
    title: 'فرحة عمر ونورهان',
    venue: 'قاعة الأندلس',
    dateLabel: '١٠ أكتوبر',
    nuqtaCount: 128,
    total: 142500,
    reportReady: true,
    postWeddingEdits: { count: 3, lastAt: '12 أكتوبر 9:41 م' },
  },
  {
    id: 'pw2',
    title: 'فرحة حسن وآية',
    venue: 'نادي الجزيرة',
    dateLabel: '٢٦ سبتمبر',
    nuqtaCount: 96,
    total: 118300,
    reportReady: true,
  },
  {
    id: 'pw3',
    title: 'فرحة طارق ومريم',
    venue: 'قاعة رمسيس',
    dateLabel: '١٢ سبتمبر',
    nuqtaCount: 74,
    total: 64900,
    reportReady: false,
  },
]

// ---------- تنبيهات ذكية ----------

export interface SmartAlert {
  id: string
  kind: 'warning' | 'idea'
  text: string
  actionLabel: string
  actionHref: string
}

export const smartAlerts: SmartAlert[] = [
  {
    id: 'al1',
    kind: 'warning',
    text: '3 أشخاص بنفس الاسم «محمد عبد الله» — راجع تمييزهم بالمنطقة قبل فرحة الجمعة',
    actionLabel: 'راجع الأشخاص',
    actionHref: '/people',
  },
  {
    id: 'al2',
    kind: 'idea',
    text: '5 نقوط اتسجلت بدون «مين دعاه» في فرحة عمر — تكملها؟',
    actionLabel: 'أكمل البيانات',
    actionHref: '/weddings/pw1',
  },
]

export const calmNote = 'مفيش التزام زمني على الأرصدة — كل حاجة محفوظة لحد ما تتصفّى'

// ---------- أشخاص (للبحث الذكي / PersonCombobox) ----------

export const people: Person[] = [
  { id: 'p1', name: 'محمد عبد الله', phone: '01005551234', region: 'المعادي' },
  { id: 'p2', name: 'محمد عبد الله', phone: '01227778890', region: 'شبرا' },
  { id: 'p3', name: 'محمد عبد الله', phone: '01113334445', region: 'حلوان' },
  { id: 'p4', name: 'خالد سمير', phone: '01001239876', region: 'مدينة نصر' },
  { id: 'p5', name: 'مصطفى كامل', phone: '01550001122', region: 'الجيزة' },
  { id: 'p6', name: 'منى عبد العزيز', phone: '01098766554', region: 'الزمالك' },
  { id: 'p7', name: 'سعاد رزق', phone: '01211223344', region: 'المعادي' },
  { id: 'p8', name: 'إبراهيم شعبان', phone: '01033445566', region: 'عين شمس' },
  { id: 'p9', name: 'حسن الطاهر', phone: '01122334455', region: 'مصر الجديدة' },
  { id: 'p10', name: 'نهى فؤاد', phone: '01566778899', region: 'التجمع' },
  { id: 'p11', name: 'سامي رشوان', phone: '01044556677', region: 'المهندسين' },
  { id: 'p12', name: 'عادل منصور', phone: '01277889900', region: 'الهرم' },
]

/** أرصدة الأشخاص المفتوحة مع صاحب الفرح الحالي (لنتائج البحث المركّبة) */
export const personBalances: Record<string, number> = {
  p5: 5000,
  p7: 2750,
  p8: -1500,
}

// ---------- فرحة نشطة اليوم (بطاقة أسفل الشريط الجانبي) ----------

export const activeWeddingToday = {
  id: 'w-mahmoud-dina',
  title: 'فرحة محمود ودينا',
  nuqtaCount: 47,
}
