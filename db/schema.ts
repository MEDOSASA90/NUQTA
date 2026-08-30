import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  text,
  timestamp,
  bigint,
  int,
  boolean,
  json,
  date,
  uniqueIndex,
  index,
} from "drizzle-orm/mysql-core";
import type { Permission } from "../server/domain/types";

export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  unionId: varchar("unionId", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  avatar: text("avatar"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  status: mysqlEnum("status", ["active", "suspended"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// نظام «أفراح الجمعية» — multi-tenant: كل البيانات معزولة per tenant (الكاتب)
// ملاحظة: كل FK يشير لـ serial PK معرّف كـ bigint unsigned (توافق MySQL/TiDB)
// ─────────────────────────────────────────────────────────────────────────────

/** إعدادات المستأجر (تُخزن JSON في tenants.settings) */
export type TenantSettings = {
  /** أيام التذكير قبل الفرح (النظام أ) — الافتراضي 3 */
  reminderDays?: number;
  /** تفعيل النظام أ: تذكير ما قبل الفرح */
  remindersEnabled?: boolean;
  /** تفعيل النظام ب: تأكيد فوري بعد تسجيل النقطة */
  confirmationsEnabled?: boolean;
  /** تفعيل النظام ج: بوت الاستعلام الذاتي */
  botEnabled?: boolean;
};

/** المستأجر = الكاتب/البراند (مثال: «أحمد عمر للأفراح») */
export const tenants = mysqlTable("tenants", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  ownerUserId: bigint("ownerUserId", { mode: "number", unsigned: true }).notNull(),
  settings: json("settings").$type<TenantSettings>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = typeof tenants.$inferInsert;

/** ربط مستخدمي OAuth بالمستأجرين + دورهم داخل المستأجر */
export const tenantMembers = mysqlTable(
  "tenant_members",
  {
    id: serial("id").primaryKey(),
    tenantId: bigint("tenantId", { mode: "number", unsigned: true }).notNull(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    role: mysqlEnum("role", ["scribe", "team"]).notNull().default("team"),
    permissions: json("permissions").$type<Permission[]>().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("tenant_members_tenant_user").on(t.tenantId, t.userId),
    index("tenant_members_user").on(t.userId),
  ],
);

export type TenantMember = typeof tenantMembers.$inferSelect;
export type InsertTenantMember = typeof tenantMembers.$inferInsert;

/** قائمة المناطق الموحدة على مستوى NUQTA بالكامل. */
export const regions = mysqlTable(
  "regions",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    normalizedName: varchar("normalizedName", { length: 255 }).notNull(),
    createdByUserId: bigint("createdByUserId", { mode: "number", unsigned: true }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("regions_normalized_name").on(t.normalizedName)],
);

export type Region = typeof regions.$inferSelect;
export type InsertRegion = typeof regions.$inferInsert;

/** شخص (ضيف/متعامل) — رقم التليفون مفتاح التمييز داخل المستأجر */
export const persons = mysqlTable(
  "persons",
  {
    id: serial("id").primaryKey(),
    tenantId: bigint("tenantId", { mode: "number", unsigned: true }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 32 }).notNull(),
    region: varchar("region", { length: 255 }).notNull().default(""),
    /** هوية الشخص المركزية؛ قد يظهر نفس الـ ID في أكثر من Tenant. */
    nuqtaId: varchar("nuqtaId", { length: 40 }),
    regionId: bigint("regionId", { mode: "number", unsigned: true }),
    phoneVerified: boolean("phoneVerified").notNull().default(false),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("persons_tenant_phone").on(t.tenantId, t.phone),
    uniqueIndex("persons_tenant_nuqta").on(t.tenantId, t.nuqtaId),
    index("persons_nuqta_id").on(t.nuqtaId),
    index("persons_tenant_name").on(t.tenantId, t.name),
  ],
);

export type Person = typeof persons.$inferSelect;
export type InsertPerson = typeof persons.$inferInsert;

/** فرحة (حدث) — صاحب الفرح شخص مسجل أو اسم نصي احتياطي */
export const events = mysqlTable(
  "events",
  {
    id: serial("id").primaryKey(),
    tenantId: bigint("tenantId", { mode: "number", unsigned: true }).notNull(),
    hostPersonId: bigint("hostPersonId", { mode: "number", unsigned: true }),
    hostName: varchar("hostName", { length: 255 }).notNull(),
    eventDate: date("eventDate", { mode: "date" }).notNull(),
    /** دورة الحياة: مجدولة → الدفتر مفتوح (الفرح شغال) → اتقفل بيد الكاتب */
    status: mysqlEnum("status", ["upcoming", "open", "done"]).notNull().default("upcoming"),
    lifecycleStatus: mysqlEnum("lifecycleStatus", ["draft", "scheduled", "live", "completed", "archived"]).notNull().default("draft"),
    place: varchar("place", { length: 255 }).notNull().default(""),
    shareToken: varchar("shareToken", { length: 64 }).notNull(),
    openedAt: timestamp("openedAt"),
    closedAt: timestamp("closedAt"),
    closedByUserId: bigint("closedByUserId", { mode: "number", unsigned: true }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("events_share_token").on(t.shareToken),
    index("events_tenant_date").on(t.tenantId, t.eventDate),
    index("events_tenant_host").on(t.tenantId, t.hostPersonId),
  ],
);

export type Event = typeof events.$inferSelect;
export type InsertEvent = typeof events.$inferInsert;

/** نقطة (دفعة) — المبلغ بالجنيه المصري (int) */
export const nuqtat = mysqlTable(
  "nuqtat",
  {
    id: serial("id").primaryKey(),
    tenantId: bigint("tenantId", { mode: "number", unsigned: true }).notNull(),
    eventId: bigint("eventId", { mode: "number", unsigned: true }).notNull(),
    payerPersonId: bigint("payerPersonId", { mode: "number", unsigned: true }).notNull(),
    amount: int("amount").notNull(),
    /** مين اللي دعاه (نص حر) */
    invitedBy: varchar("invitedBy", { length: 255 }).notNull().default(""),
    recordedByUserId: bigint("recordedByUserId", { mode: "number", unsigned: true }),
    whatsappNotified: boolean("whatsappNotified").notNull().default(false),
    notificationSentAt: timestamp("notificationSentAt"),
    voidedAt: timestamp("voidedAt"),
    voidedByUserId: bigint("voidedByUserId", { mode: "number", unsigned: true }),
    voidReason: text("voidReason"),
    activeDuplicateKey: varchar("activeDuplicateKey", { length: 100 }),
    /** اتعدلت بعد ما الفرح خلصت → تظهر بالحبر الأحمر */
    editedAfterDone: boolean("editedAfterDone").notNull().default(false),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("nuqtat_tenant_event").on(t.tenantId, t.eventId),
    index("nuqtat_tenant_payer").on(t.tenantId, t.payerPersonId),
    uniqueIndex("nuqtat_active_duplicate").on(t.activeDuplicateKey),
  ],
);

export type Nuqta = typeof nuqtat.$inferSelect;
export type InsertNuqta = typeof nuqtat.$inferInsert;

/** سجل التدقيق — كل إنشاء/تعديل/حذف موثق بالقيم قبل وبعد */
export const auditLog = mysqlTable(
  "audit_log",
  {
    id: serial("id").primaryKey(),
    tenantId: bigint("tenantId", { mode: "number", unsigned: true }).notNull(),
    actorUserId: bigint("actorUserId", { mode: "number", unsigned: true }),
    entityType: varchar("entityType", { length: 64 }).notNull(),
    entityId: bigint("entityId", { mode: "number", unsigned: true }).notNull(),
    action: mysqlEnum("action", ["create", "update", "delete"]).notNull(),
    beforeJson: json("beforeJson"),
    afterJson: json("afterJson"),
    note: text("note"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [
    index("audit_tenant_entity").on(t.tenantId, t.entityType, t.entityId),
    index("audit_tenant_created").on(t.tenantId, t.createdAt),
  ],
);

export type AuditLogEntry = typeof auditLog.$inferSelect;
export type InsertAuditLogEntry = typeof auditLog.$inferInsert;

/** رسائل واتساب (الأنظمة أ/ب/ج) — حقيقية أو محاكاة حسب مفاتيح البيئة */
export const whatsappMessages = mysqlTable(
  "whatsapp_messages",
  {
    id: serial("id").primaryKey(),
    tenantId: bigint("tenantId", { mode: "number", unsigned: true }).notNull(),
    personId: bigint("personId", { mode: "number", unsigned: true }),
    phone: varchar("phone", { length: 32 }).notNull(),
    direction: mysqlEnum("direction", ["out", "in"]).notNull(),
    kind: mysqlEnum("kind", [
      "reminder",
      "confirmation",
      "phone_verification",
      "correction",
      "bot_reply",
      "bot_query",
    ]).notNull(),
    body: text("body").notNull(),
    status: mysqlEnum("status", [
      "queued",
      "sent",
      "delivered",
      "failed",
      "simulated",
    ])
      .notNull()
      .default("queued"),
    eventId: bigint("eventId", { mode: "number", unsigned: true }),
    nuqtaId: bigint("nuqtaId", { mode: "number", unsigned: true }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [
    index("wa_tenant_created").on(t.tenantId, t.createdAt),
    index("wa_tenant_person").on(t.tenantId, t.personId),
  ],
);

export type WhatsappMessage = typeof whatsappMessages.$inferSelect;
export type InsertWhatsappMessage = typeof whatsappMessages.$inferInsert;

export type NotificationJobPayload = {
  tenantId: number;
  personId: number;
  phone: string;
  body: string;
  eventId: number;
  nuqtaId: number;
};

/** Durable outbound jobs. External delivery is never part of the ledger write transaction. */
export const notificationJobs = mysqlTable(
  "notification_jobs",
  {
    id: serial("id").primaryKey(),
    tenantId: bigint("tenantId", { mode: "number", unsigned: true }).notNull(),
    kind: mysqlEnum("kind", ["confirmation", "correction", "reminder"]).notNull(),
    idempotencyKey: varchar("idempotencyKey", { length: 255 }).notNull().unique(),
    payload: json("payload").$type<NotificationJobPayload>().notNull(),
    status: mysqlEnum("status", ["queued", "processing", "sent", "failed"]).notNull().default("queued"),
    attempts: int("attempts").notNull().default(0),
    nextAttemptAt: timestamp("nextAttemptAt").defaultNow().notNull(),
    lastError: text("lastError"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (t) => [
    index("notification_jobs_status_next_attempt").on(t.status, t.nextAttemptAt),
    index("notification_jobs_tenant_created").on(t.tenantId, t.createdAt),
  ],
);

export type NotificationJob = typeof notificationJobs.$inferSelect;
export type InsertNotificationJob = typeof notificationJobs.$inferInsert;

export const phoneVerificationChallenges = mysqlTable(
  "phone_verification_challenges",
  {
    id: serial("id").primaryKey(),
    tenantId: bigint("tenantId", { mode: "number", unsigned: true }).notNull(),
    personId: bigint("personId", { mode: "number", unsigned: true }).notNull(),
    phone: varchar("phone", { length: 32 }).notNull(),
    codeHash: varchar("codeHash", { length: 128 }).notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    attempts: int("attempts").notNull().default(0),
    consumedAt: timestamp("consumedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [index("phone_challenges_person").on(t.tenantId, t.personId, t.createdAt)],
);

export type PhoneVerificationChallenge = typeof phoneVerificationChallenges.$inferSelect;
export type InsertPhoneVerificationChallenge = typeof phoneVerificationChallenges.$inferInsert;

/** تقارير PDF المولدة لأصحاب الأفراح */
export const reports = mysqlTable(
  "reports",
  {
    id: serial("id").primaryKey(),
    tenantId: bigint("tenantId", { mode: "number", unsigned: true }).notNull(),
    eventId: bigint("eventId", { mode: "number", unsigned: true }).notNull(),
    issuedAt: timestamp("issuedAt").defaultNow().notNull(),
    fileUrl: varchar("fileUrl", { length: 512 }).notNull().default(""),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [index("reports_tenant_event").on(t.tenantId, t.eventId)],
);

export type Report = typeof reports.$inferSelect;
export type InsertReport = typeof reports.$inferInsert;

/** مصروف من الشنطة — صاحب الفرح (أو من طرفه) استلم فلوس أثناء الفرح */
export const expenses = mysqlTable(
  "expenses",
  {
    id: serial("id").primaryKey(),
    tenantId: bigint("tenantId", { mode: "number", unsigned: true }).notNull(),
    eventId: bigint("eventId", { mode: "number", unsigned: true }).notNull(),
    /** اسم اللي استلم الفلوس (نص — مش شرط يكون مسجل) */
    receiverName: varchar("receiverName", { length: 255 }).notNull(),
    /** لو المستلم شخص مسجل في الدفتر */
    receiverPersonId: bigint("receiverPersonId", { mode: "number", unsigned: true }),
    /** المبلغ بالجنيه */
    amount: int("amount").notNull(),
    /** مين من فريق الكاتب سلّم الفلوس */
    handedByUserId: bigint("handedByUserId", { mode: "number", unsigned: true }),
    note: text("note"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("expenses_tenant_event").on(t.tenantId, t.eventId)],
);

export type Expense = typeof expenses.$inferSelect;
export type InsertExpense = typeof expenses.$inferInsert;

/** مسؤولو إدخال البيانات أثناء الفرح (حد أقصى 2) */
export const eventAssignments = mysqlTable(
  "event_assignments",
  {
    id: serial("id").primaryKey(),
    tenantId: bigint("tenantId", { mode: "number", unsigned: true }).notNull(),
    eventId: bigint("eventId", { mode: "number", unsigned: true }).notNull(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    assignedBy: bigint("assignedBy", { mode: "number", unsigned: true }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("event_assignments_event_user").on(t.eventId, t.userId),
    index("event_assignments_event").on(t.eventId),
  ],
);

export type EventAssignment = typeof eventAssignments.$inferSelect;
export type InsertEventAssignment = typeof eventAssignments.$inferInsert;
