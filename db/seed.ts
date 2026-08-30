/**
 * بذور قاعدة البيانات — «أفراح الجمعية».
 * بيانات مصرية واقعية: مستأجر «أحمد عمر للأفراح»، ~40 شخصًا (بأسماء متشابهة
 * متعمدة بمناطق مختلفة)، 4 أفراح (2 تمت، 2 قادمة)، ~120 نقطة متداخلة تنتج
 * كل حالات السداد (صفا/جزئي/زيادة/مفتوح)، سجلات تدقيق، رسائل واتساب محاكاة.
 * التشغيل: npx tsx db/seed.ts  (يدعم إعادة التشغيل — يمسح بيانات الدومين أولًا)
 */
import { getDb } from "../server/queries/connection";
import {
  auditLog,
  eventAssignments,
  events,
  expenses,
  nuqtat,
  persons,
  reports,
  tenantMembers,
  tenants,
  users,
  whatsappMessages,
} from "./schema";
import { hashPassword } from "../server/services/password";
import { eq } from "drizzle-orm";

const db = getDb();

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const daysFromNow = (d: number, hour = 12) => {
  const base = new Date(now + d * DAY);
  return new Date(base.getFullYear(), base.getMonth(), base.getDate(), hour);
};

// ─── الأشخاص (أسماء + مناطق دقهلية واقعية + تشابه متعمد) ────────────────────
const PEOPLE: { name: string; region: string; verified?: boolean }[] = [
  { name: "كريم سامي الجندي", region: "المنصورة" },
  { name: "محمد عبد الله", region: "المنصورة" },
  { name: "محمد عبد الله", region: "طلخا" },
  { name: "محمد عبد الله", region: "ميت غمر" },
  { name: "خالد سمير عبد العزيز", region: "طلخا" },
  { name: "مصطفى كامل الشاذلي", region: "بلقاس" },
  { name: "أحمد السيد إبراهيم", region: "شربين" },
  { name: "أحمد السيد", region: "السنبلاوين" },
  { name: "محمود حسن علي", region: "المنصورة" },
  { name: "عبد الرحمن فتحي", region: "دكرنس" },
  { name: "ياسر عادل المليجي", region: "أجا" },
  { name: "حسن توفيق عبد الحميد", region: "منية النصر" },
  { name: "إبراهيم سعد الدين", region: "طلخا" },
  { name: "عمرو نبيل حجازي", region: "المنصورة" },
  { name: "تامر فؤاد رزق", region: "ميت غمر" },
  { name: "شريف عصمت البسيوني", region: "بلقاس" },
  { name: "وليد أنور قطب", region: "شربين" },
  { name: "هشام رأفت السباعي", region: "السنبلاوين" },
  { name: "أسامة لطفي غانم", region: "دكرنس" },
  { name: "بسام ناجي فرج", region: "أجا" },
  { name: "رامي صبري الشريف", region: "المنصورة" },
  { name: "سامح عزت بولس", region: "طلخا" },
  { name: "نبيل حامد عبد اللطيف", region: "ميت غمر" },
  { name: "جمال رمضان أبو زيد", region: "بلقاس" },
  { name: "فؤاد سلامة البحيري", region: "شربين" },
  { name: "ماجد فتح الله عوض", region: "السنبلاوين" },
  { name: "طارق زكي النجار", region: "المنصورة" },
  { name: "سعيد بدر الدخاخني", region: "دكرنس" },
  { name: "علاء الدين رضوان", region: "أجا" },
  { name: "حاتم شعبان مراد", region: "منية النصر" },
  { name: "عادل منصور الحلوجي", region: "المنصورة" },
  { name: "زكريا عثمان بيومي", region: "طلخا" },
  { name: "رأفت نجيب سلام", region: "ميت غمر" },
  { name: "فاروق حسين الشبراوي", region: "بلقاس" },
  { name: "لطفي عبد العال سالم", region: "شربين" },
  { name: "ناصر عبد المجيد", region: "السنبلاوين" },
  { name: "باهي خليل ترك", region: "دكرنس" },
  { name: "شوقي أمين رسلان", region: "أجا" },
  { name: "أنور جاد الكريم", region: "المنصورة", verified: false },
  { name: "حمادة عبد الفتاح", region: "طلخا", verified: false },
  { name: "ربيع السيد قناوي", region: "ميت غمر", verified: false },
];

// تليفونات مصرية فريدة حتمية
const phoneOf = (i: number) => `010${String(23000000 + i * 137).slice(0, 8)}`;

const INVITERS = ["العريس نفسه", "والد العريس", "حاج محمود", "عم صابر", "الحاج رمضان", ""];

async function seed() {
  console.log("Seeding database...");

  // ── تنظيف بيانات الدومين (إعادة التشغيل آمنة) ──
  await db.delete(expenses);
  await db.delete(eventAssignments);
  await db.delete(nuqtat);
  await db.delete(whatsappMessages);
  await db.delete(auditLog);
  await db.delete(reports);
  await db.delete(events);
  await db.delete(persons);
  await db.delete(tenantMembers);
  await db.delete(tenants);

  // ── المستخدم المالك + المستأجر ──
  await db
    .insert(users)
    .values({
      unionId: "seed-mahmoud-admin",
      name: "محمود خميس",
      email: "admin@nuqta.local",
      passwordHash: hashPassword("Admin@12345"),
      role: "admin",
      lastSignInAt: new Date(),
    })
    .onDuplicateKeyUpdate({ set: { name: "أحمد عمر", passwordHash: hashPassword("Admin@12345") } });
  const ownerRows = await db.select().from(users);
  const ownerUser = ownerRows.find((u) => u.unionId === "seed-mahmoud-admin");
  if (!ownerUser) throw new Error("seed user missing");
  await db.update(users).set({ email: "admin@nuqta.local" }).where(eq(users.id, ownerUser.id));

  await db
    .insert(users)
    .values({
      unionId: "seed-ahmed-omar",
      name: "أحمد عمر",
      email: "scribe@nuqta.local",
      passwordHash: hashPassword("Scribe@12345"),
      role: "user",
      lastSignInAt: new Date(),
    })
    .onDuplicateKeyUpdate({ set: { passwordHash: hashPassword("Scribe@12345"), name: "كاتب التجربة" } });
  const writerRows = await db.select().from(users);
  const writerUser = writerRows.find((u) => u.unionId === "seed-ahmed-omar");
  if (!writerUser) throw new Error("seed writer missing");

  const [{ id: tenantId }] = await db
    .insert(tenants)
    .values({
      name: "أحمد عمر للأفراح",
      ownerUserId: ownerUser.id,
      settings: {
        reminderDays: 3,
        remindersEnabled: true,
        confirmationsEnabled: true,
        botEnabled: true,
      },
    })
    .$returningId();
  await db.insert(tenantMembers).values({
    tenantId,
    userId: ownerUser.id,
    role: "scribe",
    permissions: [],
  });
  await db.insert(tenantMembers).values({
    tenantId,
    userId: writerUser.id,
    role: "team",
    permissions: ["record", "review"],
  });

  // ── الأشخاص ──
  const personIds: number[] = [];
  for (let i = 0; i < PEOPLE.length; i++) {
    const p = PEOPLE[i];
    const [{ id }] = await db
      .insert(persons)
      .values({
        tenantId,
        name: p.name,
        phone: phoneOf(i),
        region: p.region,
        nuqtaId: `NQ-SEED${String(i).padStart(12, "0")}`,
        phoneVerified: p.verified ?? true,
        createdAt: daysFromNow(-120 + i),
      })
      .$returningId();
    personIds.push(id);
  }
  const P = (i: number) => personIds[i];
  // اختصارات للمضيفين
  const KARIM = 0; // كريم سامي الجندي — المنصورة
  const MOH_MANS = 1; // محمد عبد الله — المنصورة
  const KHALED = 4; // خالد سمير — طلخا
  const MOSTAFA = 5; // مصطفى كامل — بلقاس

  // ── الأفراح (2 تمت، 2 قادمة) ──
  const [{ id: evKarim }] = await db
    .insert(events)
    .values({
      tenantId,
      hostPersonId: P(KARIM),
      hostName: PEOPLE[KARIM].name,
      eventDate: daysFromNow(-45),
      status: "done",
      lifecycleStatus: "completed",
      openedAt: daysFromNow(-46),
      closedAt: daysFromNow(-45),
      closedByUserId: ownerUser.id,
      place: "قاعة النيل — المنصورة",
      shareToken: "seed-w-karim-45d-ago",
      createdAt: daysFromNow(-100),
    })
    .$returningId();
  const [{ id: evMohamed }] = await db
    .insert(events)
    .values({
      tenantId,
      hostPersonId: P(MOH_MANS),
      hostName: `${PEOPLE[MOH_MANS].name} (المنصورة)`,
      eventDate: daysFromNow(-12),
      status: "done",
      lifecycleStatus: "completed",
      openedAt: daysFromNow(-13),
      closedAt: daysFromNow(-12),
      closedByUserId: ownerUser.id,
      place: "قاعة الياسمين — المنصورة",
      shareToken: "seed-w-mohamed-12d-ago",
      createdAt: daysFromNow(-70),
    })
    .$returningId();
  const [{ id: evKhaled }] = await db
    .insert(events)
    .values({
      tenantId,
      hostPersonId: P(KHALED),
      hostName: PEOPLE[KHALED].name,
      eventDate: daysFromNow(2),
      status: "upcoming",
      lifecycleStatus: "scheduled",
      place: "قاعة الفيروز — طلخا",
      shareToken: "seed-w-khaled-in-2d",
      createdAt: daysFromNow(-40),
    })
    .$returningId();
  const [{ id: evMostafa }] = await db
    .insert(events)
    .values({
      tenantId,
      hostPersonId: P(MOSTAFA),
      hostName: PEOPLE[MOSTAFA].name,
      eventDate: daysFromNow(6),
      status: "upcoming",
      lifecycleStatus: "scheduled",
      place: "نادي بلقاس",
      shareToken: "seed-w-mostafa-in-6d",
      createdAt: daysFromNow(-35),
    })
    .$returningId();
  // فرح شغال دلوقتي — الدفتر مفتوح (لتجربة التسجيل والمصروفات لحظيًا)
  const [{ id: evOpenToday }] = await db
    .insert(events)
    .values({
      tenantId,
      hostPersonId: P(MOH_MANS),
      hostName: `${PEOPLE[MOH_MANS].name} (المنصورة) — فرح اليوم`,
      eventDate: daysFromNow(0),
      status: "open",
      lifecycleStatus: "live",
      openedAt: daysFromNow(0),
      place: "قاعة المصرية — المنصورة",
      shareToken: "seed-w-open-today",
      createdAt: daysFromNow(-30),
    })
    .$returningId();

  // ── النقوط (~120) ──
  type NuqtaSeed = {
    eventId: number;
    payerIdx: number;
    amount: number;
    invitedBy?: string;
    daysAgo: number;
    notified?: boolean;
    red?: boolean;
  };
  const plan: NuqtaSeed[] = [];

  // مدعوو فرحة كريم (45 يوم مضت): كل الأشخاص تقريبًا عدا كريم
  const amounts1 = [
    500, 1000, 1000, 1500, 2000, 750, 1000, 2500, 500, 1000, 3000, 500, 1000,
    1500, 500, 2000, 1000, 500, 1000, 750, 500, 1000, 1500, 500, 1000, 2000,
    500, 1000, 500, 1000, 1500, 500, 1000, 500, 750, 1000, 500, 1000, 500,
  ];
  let ai = 0;
  for (let i = 0; i < PEOPLE.length; i++) {
    if (i === KARIM) continue;
    plan.push({
      eventId: evKarim,
      payerIdx: i,
      amount: amounts1[ai++ % amounts1.length],
      invitedBy: INVITERS[i % INVITERS.length],
      daysAgo: 45,
      notified: true,
    });
  }
  // مدعوو فرحة محمد عبد الله (12 يوم مضت): ~48 نقطة
  const amounts2 = [
    1000, 500, 2000, 1000, 1500, 500, 1000, 500, 2500, 1000, 500, 1000, 750,
    500, 1000, 1500, 500, 2000, 1000, 500,
  ];
  let bi = 0;
  for (let i = 0; i < PEOPLE.length; i++) {
    if (i === MOH_MANS) continue;
    // بعض الناس راحوا فرح واحد بس
    if (i % 7 === 3) continue;
    plan.push({
      eventId: evMohamed,
      payerIdx: i,
      amount: amounts2[bi++ % amounts2.length],
      invitedBy: INVITERS[(i + 2) % INVITERS.length],
      daysAgo: 12,
      notified: i % 6 !== 0,
    });
  }
  // دفعات تكميلية (ناس زوّدت نقطتها بعد الفرح بيوم — عادة شائعة)
  for (let i = 0; i < PEOPLE.length; i++) {
    if (i === KARIM || i === MOH_MANS) continue;
    if (i % 2 === 0) {
      plan.push({
        eventId: evKarim,
        payerIdx: i,
        amount: 250 + (i % 4) * 250,
        invitedBy: INVITERS[(i + 1) % INVITERS.length],
        daysAgo: 44,
        notified: i % 4 !== 0,
      });
    } else if (i % 7 !== 3) {
      plan.push({
        eventId: evMohamed,
        payerIdx: i,
        amount: 300 + (i % 3) * 350,
        invitedBy: INVITERS[(i + 3) % INVITERS.length],
        daysAgo: 11,
        notified: i % 5 !== 0,
      });
    }
  }

  // ── حالات سداد مصنوعة يدويًا بين المضيفين ──
  // 1) محمد عبد الله دفع 1500 في فرحة كريم → كريم ردها بالظبط في فرح محمد ⇒ صفا
  plan.push({ eventId: evMohamed, payerIdx: KARIM, amount: 1500, invitedBy: "العريس نفسه", daysAgo: 12, notified: true });
  // 2) خالد دفع 2000 في فرحة كريم → كريم دفع 1200 مقدمًا في فرح خالد ⇒ جزئي (باقي 800)
  plan.push({ eventId: evKhaled, payerIdx: KARIM, amount: 1200, daysAgo: 3, notified: true });
  // 3) مصطفى دفع 800 في فرحة كريم → كريم دفع 1500 في فرح مصطفى ⇒ زيادة 700
  plan.push({ eventId: evMostafa, payerIdx: KARIM, amount: 1500, daysAgo: 2, notified: true });
  // 4) خالد دفع 3000 في فرحة محمد → محمد دفع 3000 في فرح خالد ⇒ صفا تانية
  plan.push({ eventId: evKhaled, payerIdx: MOH_MANS, amount: 3000, daysAgo: 2, notified: true });
  // 5) مصطفى دفع 1500 في فرحة محمد → محمد دفع 800 في فرح مصطفى ⇒ جزئي
  plan.push({ eventId: evMostafa, payerIdx: MOH_MANS, amount: 800, daysAgo: 1, notified: false });
  // دفعات مقدمة عشوائية للفرحتين الجايين
  plan.push({ eventId: evKhaled, payerIdx: 8, amount: 1000, daysAgo: 2, notified: true });
  plan.push({ eventId: evKhaled, payerIdx: 13, amount: 500, daysAgo: 1, notified: true });
  plan.push({ eventId: evKhaled, payerIdx: 20, amount: 2000, daysAgo: 1, notified: true });
  plan.push({ eventId: evKhaled, payerIdx: 26, amount: 1000, daysAgo: 0, notified: false });
  plan.push({ eventId: evMostafa, payerIdx: 9, amount: 750, daysAgo: 1, notified: true });
  plan.push({ eventId: evMostafa, payerIdx: 15, amount: 1000, daysAgo: 0, notified: false });

  // نقطتين اتعدلوا بعد قفل الفرحة (حبر أحمر)
  plan.push({ eventId: evKarim, payerIdx: 9, amount: 1000, daysAgo: 5, notified: true, red: true });
  plan.push({ eventId: evMohamed, payerIdx: 13, amount: 1500, daysAgo: 3, notified: true, red: true });

  const nuqtaIds: number[] = [];
  for (const q of plan) {
    const created = daysFromNow(-q.daysAgo, 20);
    const [{ id }] = await db
      .insert(nuqtat)
      .values({
        tenantId,
        eventId: q.eventId,
        payerPersonId: P(q.payerIdx),
        amount: q.amount,
        invitedBy: q.invitedBy ?? "",
        recordedByUserId: ownerUser.id,
        whatsappNotified: q.notified ?? true,
        editedAfterDone: q.red ?? false,
        createdAt: created,
        updatedAt: created,
      })
      .$returningId();
    nuqtaIds.push(id);
  }

  // ── سجل التدقيق ──
  const auditSeeds: {
    entityType: string;
    entityId: number;
    action: "create" | "update" | "delete";
    note: string | null;
    daysAgo: number;
  }[] = [
    {
      entityType: "nuqta",
      entityId: nuqtaIds[0],
      action: "create",
      note: null,
      daysAgo: 45,
    },
    {
      entityType: "nuqta",
      entityId: nuqtaIds[nuqtaIds.length - 2],
      action: "update",
      note: "تعديل المبلغ بعد إرسال إشعار واتساب — اتبعتت رسالة تصحيحية",
      daysAgo: 5,
    },
    {
      entityType: "nuqta",
      entityId: nuqtaIds[nuqtaIds.length - 1],
      action: "update",
      note: "تعديل بعد قفل الفرحة",
      daysAgo: 3,
    },
    {
      entityType: "event",
      entityId: evKarim,
      action: "update",
      note: "قفل الفرحة",
      daysAgo: 44,
    },
    {
      entityType: "person",
      entityId: P(38),
      action: "create",
      note: null,
      daysAgo: 10,
    },
  ];
  for (const a of auditSeeds) {
    await db.insert(auditLog).values({
      tenantId,
      actorUserId: ownerUser.id,
      entityType: a.entityType,
      entityId: a.entityId,
      action: a.action,
      beforeJson: a.action === "update" ? { amount: 750 } : null,
      afterJson: a.action !== "delete" ? { seeded: true } : null,
      note: a.note,
      createdAt: daysFromNow(-a.daysAgo, 21),
    });
  }

  // ── رسائل واتساب محاكاة ──
  const waSeeds: {
    personIdx: number | null;
    kind: "reminder" | "confirmation" | "correction" | "bot_reply" | "bot_query";
    direction: "out" | "in";
    body: string;
    eventId?: number;
    nuqtaId?: number;
    daysAgo: number;
  }[] = [
    {
      personIdx: 8,
      kind: "confirmation",
      direction: "out",
      body: "تمام يا محمود ✅\nاتسجلت نقطتك في فرحة خالد سمير عبد العزيز بمبلغ 1,000 ج.م.\n— أحمد عمر للأفراح",
      eventId: evKhaled,
      daysAgo: 2,
    },
    {
      personIdx: 13,
      kind: "confirmation",
      direction: "out",
      body: "تمام يا عمرو ✅\nاتسجلت نقطتك في فرحة خالد سمير عبد العزيز بمبلغ 500 ج.م.\n— أحمد عمر للأفراح",
      eventId: evKhaled,
      daysAgo: 1,
    },
    {
      personIdx: 9,
      kind: "correction",
      direction: "out",
      body: "تصحيح مهم يا عبد الرحمن ✏️\nنقطتك في فرحة كريم سامي الجندي كانت 750 ج.م واتعدلت بقت 1,000 ج.م.\n— أحمد عمر للأفراح",
      eventId: evKarim,
      daysAgo: 5,
    },
    {
      personIdx: 20,
      kind: "reminder",
      direction: "out",
      body: "مساء الخير يا رامي 🌙\nفاكرك: فرحة خالد سمير عبد العزيز بعد يومين — قاعة الفيروز — طلخا.\n— أحمد عمر للأفراح",
      eventId: evKhaled,
      daysAgo: 0,
    },
    {
      personIdx: 8,
      kind: "reminder",
      direction: "out",
      body: "مساء الخير يا محمود 🌙\nفاكرك: فرحة خالد سمير عبد العزيز بعد يومين — قاعة الفيروز — طلخا.\n— أحمد عمر للأفراح",
      eventId: evKhaled,
      daysAgo: 0,
    },
    {
      personIdx: 8,
      kind: "bot_query",
      direction: "in",
      body: "عليا كام؟",
      daysAgo: 1,
    },
    {
      personIdx: 8,
      kind: "bot_reply",
      direction: "out",
      body: "عليك للناس إجمالي 2,500 ج.م.\n• خالد سمير عبد العزيز (طلخا): عليك 1,000 ج.م — 3 مرات",
      daysAgo: 1,
    },
    {
      personIdx: 13,
      kind: "bot_query",
      direction: "in",
      body: "1",
      daysAgo: 2,
    },
    {
      personIdx: 13,
      kind: "bot_reply",
      direction: "out",
      body: "كشف حسابك يا عمرو 📒\n• كريم سامي الجندي (المنصورة): ليك 500 ج.م — مرة واحدة",
      daysAgo: 2,
    },
  ];
  for (const m of waSeeds) {
    await db.insert(whatsappMessages).values({
      tenantId,
      personId: m.personIdx != null ? P(m.personIdx) : null,
      phone: m.personIdx != null ? phoneOf(m.personIdx) : "01000000000",
      direction: m.direction,
      kind: m.kind,
      body: m.body,
      status: "simulated",
      eventId: m.eventId ?? null,
      nuqtaId: m.nuqtaId ?? null,
      createdAt: daysFromNow(-m.daysAgo, 22),
    });
  }

  // ── مصروفات الشنطة (3 لفرح منتهٍ + 1 لفرح اليوم المفتوح) ──
  const expenseSeeds = [
    { eventId: evMohamed, receiverName: `${PEOPLE[MOH_MANS].name} (صاحب الفرح)`, amount: 10000, note: "دفعة لتجهيز القاعة", daysAgo: 12 },
    { eventId: evMohamed, receiverName: "أم العريس", amount: 3000, note: "لمستلزمات الفرح", daysAgo: 12 },
    { eventId: evMohamed, receiverName: "خالد سمير عبد العزيز (من طرف العريس)", amount: 1500, note: null, daysAgo: 11 },
    { eventId: evOpenToday, receiverName: "أبو العريس", amount: 5000, note: "سلفة أثناء الفرح", daysAgo: 0 },
  ];
  for (const ex of expenseSeeds) {
    await db.insert(expenses).values({
      tenantId,
      eventId: ex.eventId,
      receiverName: ex.receiverName,
      receiverPersonId: null,
      amount: ex.amount,
      handedByUserId: ownerUser.id,
      note: ex.note,
      createdAt: daysFromNow(-ex.daysAgo, 21),
    });
  }

  // ── تقرير PDF لفرحة محمد عبد الله (تمت) ──
  try {
    const { generateEventReport } = await import(
      "../server/services/report-pdf"
    );
    const report = await generateEventReport(tenantId, evMohamed);
    console.log(`PDF report generated: ${report.fileUrl}`);
  } catch (err) {
    console.warn("PDF generation skipped:", (err as Error).message);
  }

  console.log(
    `Done. tenant=${tenantId} persons=${personIds.length} events=5 nuqtat=${plan.length} (target ~120)`,
  );
  process.exit(0); // close MySQL connection pool
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
