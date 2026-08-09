/**
 * أنواع مشتركة بين الواجهة والخادم — نظام «أفراح الجمعية».
 * مصدر الحقيقة للجداول: db/schema.ts (تُعاد تصديرها من contracts/types.ts).
 */
import type {
  Event,
  Nuqta,
  Person,
  Report,
  Tenant,
  WhatsappMessage,
} from "../db/schema";

export const DEFAULT_REMINDER_DAYS = 3;

// ─── حالة السداد عند تسجيل نقطة ────────────────────────────────────────────

export type SettlementStatus = "new" | "partial" | "settled" | "overpaid";

/** نتيجة حساب حالة السداد — تُستخدم في معاينة التسجيل ورسالة واتساب */
export type SettlementPreview = {
  status: SettlementStatus;
  /** الدين المستحق على الدافع تجاه صاحب الفرح قبل هذه النقطة (جنيه) */
  outstandingBefore: number;
  /** المتبقي على الدافع بعد هذه النقطة */
  remaining: number;
  /** الزيادة عن المستحق — تتحول لرصيد «له» جديد عند صاحب الفرح */
  overpaid: number;
  /** صافي الرصيد بين الطرفين بعد التسجيل (موجب = للدافع «له» عند صاحب الفرح) */
  netAfter: number;
  /** وصف عربي جاهز للعرض/الإرسال */
  message: string;
};

// ─── الأرصدة الثنائية (محسوبة من النقوط — لا تُخزن) ─────────────────────────

export type PairStatus = "open" | "partial" | "settled" | "overpaid";

/** سطر رصيد ثنائي بين شخصين في نفس المستأجر */
export type BalanceRow = {
  personAId: number;
  personAName: string;
  personARegion: string;
  personBId: number;
  personBName: string;
  personBRegion: string;
  /** مجموع ما دفعه A في أفراح B */
  aPaidToB: number;
  /** مجموع ما دفعه B في أفراح A */
  bPaidToA: number;
  /** الصافي = aPaidToB − bPaidToA (موجب: B مديون لـ A — A «له») */
  net: number;
  /** صاحب الرصيد «له» (الدائن) — null عند التعادل */
  creditorId: number | null;
  /** المديون — null عند التعادل */
  debtorId: number | null;
  /** عدد مرات التفاعل في الاتجاهين مجتمعة (علامات «/») */
  interactions: number;
  status: PairStatus;
  lastInteractionAt: Date | null;
};

/** تفاصيل مرة واحدة من مرات التفاعل بين شخصين */
export type PairInteraction = {
  nuqtaId: number;
  direction: "a_to_b" | "b_to_a";
  payerId: number;
  payerName: string;
  hostId: number;
  hostName: string;
  amount: number;
  eventId: number;
  eventLabel: string;
  eventDate: Date;
  invitedBy: string;
  createdAt: Date;
};

/** إشعار «فلان صفّى حسابه معاك» */
export type SettledNotice = {
  /** من سدد (الدافع) */
  settlerId: number;
  settlerName: string;
  /** المستفيد = صاحب الفرح الذي سُددت فيه النقطة */
  hostId: number;
  hostName: string;
  amount: number;
  eventId: number;
  eventLabel: string;
  settledAt: Date;
};

/** الصافي الكلي لشخص عبر الشبكة */
export type PersonNet = {
  /** إجمالي اللي له عند الناس */
  totalFor: number;
  /** إجمالي اللي عليه للناس */
  totalAgainst: number;
  /** الصافي (totalFor − totalAgainst) */
  net: number;
};

// ─── الأشخاص ────────────────────────────────────────────────────────────────

export type PersonSearchResult = Person & {
  matchedOn: "name" | "phone" | "region" | "nuqtaId";
  /** عدد الأشخاص الآخرين بنفس الاسم المطبع (لتمييز المتشابهين) */
  sameNameCount: number;
};

export type PersonWithNet = Person & { net: PersonNet };

// ─── الأفراح ────────────────────────────────────────────────────────────────

export type EventListItem = Event & {
  nuqtatCount: number;
  totalAmount: number;
  /** عدد الأشخاص المختلفين اللي دفعوا فعلًا */
  payersCount: number;
  /** عدد المدعوين المتوقعين (تفاعلوا مع صاحب الفرح سابقًا) */
  expectedGuests: number;
};

export type EventNuqtaItem = Nuqta & {
  payerName: string;
  payerRegion: string;
  payerPhone: string;
};

// ─── لوحة التحكم ────────────────────────────────────────────────────────────

export type DashboardStats = {
  personsCount: number;
  upcomingEventsCount: number;
  nuqtatCount: number;
  /** إجمالي مبالغ كل النقوط */
  totalNuqtatAmount: number;
  /** صافي له/عليه عبر الشبكة كلها */
  network: PersonNet;
  /** نشاط اليوم */
  today: {
    nuqtatCount: number;
    nuqtatAmount: number;
    whatsappCount: number;
  };
};

// ─── البوت ──────────────────────────────────────────────────────────────────

export type BotReply = {
  reply: string;
  matched: "menu" | "keyword" | "name" | "fallback";
  personFound: boolean;
};

// ─── الكشف العام لصاحب الفرح (/w/:token) ────────────────────────────────────

export type PublicWeddingPerson = {
  name: string;
  phone: string;
  amount: number;
  /** التعديلات اللاحقة (حبر أحمر) */
  editedAfterDone: boolean;
  paidAt: Date;
  invitedBy: string;
};

export type PublicWeddingRegion = {
  region: string;
  personsCount: number;
  totalAmount: number;
  persons: PublicWeddingPerson[];
};

export type PublicWeddingStatement = {
  brand: string;
  hostName: string;
  eventDate: Date;
  place: string;
  status: Event["status"];
  grandTotal: number;
  personsCount: number;
  regions: PublicWeddingRegion[];
  issuedAt: Date;
};

// ─── إعادة تصدير أنواع الجداول المستخدمة في الواجهات ────────────────────────

export type { Event, Nuqta, Person, Report, Tenant, WhatsappMessage };
