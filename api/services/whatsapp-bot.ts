/**
 * النظام ج — بوت الاستعلام الذاتي.
 * composeBotReply دالة نقية (تُختبر بدون DB)، وhandleBotMessage يلفها
 * بجلب البيانات من قاعدة البيانات وتسجيل الرسائل الواردة والصادرة.
 */
import type { BalanceRow, BotReply, PersonNet } from "@contracts/afrah";
import type { Person } from "@db/schema";
import { computePersonNet, computeSettlement } from "../queries/balance-core";
import { listTenantNuqtatJoined } from "../queries/nuqtat";
import { findPersonByPhoneAnyTenant, listPersons } from "../queries/persons";
import { listEvents } from "../queries/events";
import { getTenantById } from "../queries/tenants";
import { normalizeArabic, normalizePhone } from "../queries/person-search";
import { computeAllPairs } from "../queries/balance-core";
import { logWhatsappMessage } from "../queries/whatsapp-log";
import { sendWhatsapp, formatDateAr, formatMoneyAr } from "./whatsapp";

// ─── الأنواع ────────────────────────────────────────────────────────────────

export type BotUpcomingEvent = {
  eventId: number;
  hostName: string;
  eventDate: Date;
  place: string;
  /** الدين المستحق على الشخص تجاه صاحب الفرح */
  outstanding: number;
  /** رصيد الشخص «له» عند صاحب الفرح */
  owedToPerson: number;
};

export type BotContext = {
  brand: string;
  person: Pick<Person, "id" | "name" | "phone" | "region">;
  net: PersonNet;
  /** أرصدة الشخص الثنائية مع الآخرين */
  pairs: BalanceRow[];
  /** الأفراح القادمة المرتبطة بأشخاص تعاملوا معه */
  upcoming: BotUpcomingEvent[];
  /** باقي أشخاص الشبكة (للبحث بالاسم) */
  otherPersons: { id: number; name: string; region: string }[];
};

// ─── مساعدات ────────────────────────────────────────────────────────────────

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

function menuBody(brand: string, name: string): string {
  return [
    `أهلاً يا ${firstName(name)}! 👋 أنا بوت ${brand}.`,
    "ابعت رقم الاستعلام:",
    "1️⃣ كشف حساب كامل",
    "2️⃣ أفراحي القادمة والمطلوب مني",
    "3️⃣ الرصيد مع شخص (اكتب: 3 والاسم)",
    "4️⃣ صافي رصيدي الكلي",
    "أو اكتب سؤالك براحتك بالعامية.",
  ].join("\n");
}

function otherNameOf(ctx: BotContext, pair: BalanceRow): string {
  return pair.personAId === ctx.person.id ? pair.personBName : pair.personAName;
}

function otherRegionOf(ctx: BotContext, pair: BalanceRow): string {
  return pair.personAId === ctx.person.id ? pair.personBRegion : pair.personARegion;
}

/** صياغة رصيد الشخص مع طرف آخر من منظوره هو */
export function describePairForPerson(
  ctx: BotContext,
  pair: BalanceRow,
): string {
  const other = otherNameOf(ctx, pair);
  const region = otherRegionOf(ctx, pair);
  const times = `${pair.interactions} ${pair.interactions === 1 ? "مرة" : pair.interactions === 2 ? "مرتين" : "مرات"}`;
  if (pair.net === 0) {
    return `• ${other}${region ? ` (${region})` : ""}: الحساب صفا ✅ — ${times}`;
  }
  if (pair.creditorId === ctx.person.id) {
    return `• ${other}${region ? ` (${region})` : ""}: ليك ${formatMoneyAr(Math.abs(pair.net))} — ${times}`;
  }
  return `• ${other}${region ? ` (${region})` : ""}: عليك ${formatMoneyAr(Math.abs(pair.net))} — ${times}`;
}

function statementReply(ctx: BotContext): string {
  if (ctx.pairs.length === 0) {
    return `يا ${firstName(ctx.person.name)}، لسه مفيش أي تعاملات نقوط مسجلة باسمك عند ${ctx.brand}.`;
  }
  const sorted = [...ctx.pairs].sort(
    (a, b) => Math.abs(b.net) - Math.abs(a.net),
  );
  const shown = sorted.slice(0, 12).map((p) => describePairForPerson(ctx, p));
  const lines = [`كشف حسابك يا ${firstName(ctx.person.name)} 📒`, ...shown];
  if (sorted.length > shown.length) {
    lines.push(`…وفيه كمان ${sorted.length - shown.length} حساب.`);
  }
  lines.push(
    `الإجمالي: ليك ${formatMoneyAr(ctx.net.totalFor)} — عليك ${formatMoneyAr(ctx.net.totalAgainst)} — الصافي ${formatMoneyAr(Math.abs(ctx.net.net))} ${ctx.net.net >= 0 ? "ليك" : "عليك"}.`,
  );
  return lines.join("\n");
}

function upcomingReply(ctx: BotContext): string {
  if (ctx.upcoming.length === 0) {
    return `مفيش أفراح قادمة مرتبطة بيك حاليًا يا ${firstName(ctx.person.name)}. 🌴`;
  }
  const lines = [`عندك ${ctx.upcoming.length} ${ctx.upcoming.length === 1 ? "فرحة" : "أفراح"} جاية:`];
  for (const ev of ctx.upcoming) {
    const base = `• فرحة ${ev.hostName} يوم ${formatDateAr(ev.eventDate)}${ev.place ? ` — ${ev.place}` : ""}`;
    if (ev.outstanding > 0) {
      lines.push(`${base} — المطلوب منك ${formatMoneyAr(ev.outstanding)}.`);
    } else if (ev.owedToPerson > 0) {
      lines.push(`${base} — ليك عنده ${formatMoneyAr(ev.owedToPerson)} ومفيش مطلوب منك.`);
    } else {
      lines.push(`${base} — مفيش مستحق سابق بينكم، براحتك.`);
    }
  }
  return lines.join("\n");
}

function netReply(ctx: BotContext): string {
  const n = ctx.net;
  return [
    `ليك عند الناس ${formatMoneyAr(n.totalFor)} وعليك للناس ${formatMoneyAr(n.totalAgainst)}.`,
    `الصافي الكلي: ${formatMoneyAr(Math.abs(n.net))} ${n.net >= 0 ? "ليك 👌" : "عليك"}.`,
  ].join("\n");
}

function findPersonMatches(
  ctx: BotContext,
  nameQuery: string,
): { id: number; name: string; region: string }[] {
  const nq = normalizeArabic(nameQuery);
  if (!nq) return [];
  return ctx.otherPersons.filter((p) => {
    const name = normalizeArabic(p.name);
    const region = normalizeArabic(p.region);
    if (name === nq || name.startsWith(nq) || name.includes(nq)) return true;
    // الاسم + المنطقة معًا («محمد عبد الله طلخا»)
    return `${name} ${region}`.includes(nq);
  });
}

function pairWithReply(
  ctx: BotContext,
  target: { id: number; name: string; region: string },
): string {
  const pair = ctx.pairs.find(
    (p) => p.personAId === target.id || p.personBId === target.id,
  );
  const lines: string[] = [];
  if (!pair || pair.interactions === 0) {
    lines.push(`مفيش تعامل نقوط سابق بينك وبين ${target.name}.`);
  } else {
    lines.push(`حسابك مع ${target.name}${target.region ? ` (${target.region})` : ""}:`);
    lines.push(describePairForPerson(ctx, pair).replace(/^• /, ""));
  }
  const targetName = normalizeArabic(target.name);
  const ev = ctx.upcoming.find((u) => {
    const host = normalizeArabic(u.hostName);
    return host.includes(targetName) || targetName.includes(host);
  });
  if (ev) {
    lines.push(
      `فرحته جاية يوم ${formatDateAr(ev.eventDate)}${ev.outstanding > 0 ? ` — المطلوب منك ${formatMoneyAr(ev.outstanding)}.` : "."}`,
    );
  }
  return lines.join("\n");
}

// ─── القلب: توليد الرد (دالة نقية) ─────────────────────────────────────────

export function composeBotReply(ctx: BotContext, rawText: string): BotReply {
  const text = normalizeArabic(rawText).replace(/\s+/g, " ").trim();
  if (!text) {
    return { reply: menuBody(ctx.brand, ctx.person.name), matched: "fallback", personFound: true };
  }

  // ① أوامر مرقمة
  const cmdMatch = /^([1-4])(?:\s+(.*))?$/.exec(text);
  if (cmdMatch) {
    const cmd = cmdMatch[1];
    const rest = (cmdMatch[2] ?? "").trim();
    if (cmd === "1") return { reply: statementReply(ctx), matched: "menu", personFound: true };
    if (cmd === "2") return { reply: upcomingReply(ctx), matched: "menu", personFound: true };
    if (cmd === "4") return { reply: netReply(ctx), matched: "menu", personFound: true };
    // 3: الرصيد مع شخص
    if (!rest) {
      return {
        reply: "اكتب 3 وبعدها اسم الشخص — مثال: «3 محمد عبد الله».",
        matched: "menu",
        personFound: true,
      };
    }
    const matches = findPersonMatches(ctx, rest);
    if (matches.length === 0) {
      return { reply: `مش لاقي حد باسم «${rest}» في الشبكة — اتأكد من الاسم.`, matched: "menu", personFound: false };
    }
    if (matches.length > 1) {
      const regions = matches.map((m) => m.region || "بدون منطقة").join("، ");
      return {
        reply: `فيه ${matches.length} أشخاص بالاسم ده (${regions}) — اكتب الاسم والمنطقة عشان أميّز.`,
        matched: "menu",
        personFound: false,
      };
    }
    return { reply: pairWithReply(ctx, matches[0]), matched: "menu", personFound: true };
  }

  // ② كتابة حرة — كلمات مفتاحية
  if (text.includes("كشف حساب") || text.includes("كشف الحساب") || text === "حسابي" || text.includes("كشف")) {
    return { reply: statementReply(ctx), matched: "keyword", personFound: true };
  }
  if (text.includes("عليا كام") || text.includes("عليا") || text.includes("عليا اي")) {
    const debts = ctx.pairs
      .filter((p) => p.debtorId === ctx.person.id)
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
      .slice(0, 8)
      .map((p) => describePairForPerson(ctx, p));
    const lines = [`عليك للناس إجمالي ${formatMoneyAr(ctx.net.totalAgainst)}.`];
    if (debts.length) lines.push(...debts);
    else lines.push("مفيش عليك حاجة — دفتري معاك نضيف ✅");
    return { reply: lines.join("\n"), matched: "keyword", personFound: true };
  }
  if (text.includes("لي كام") || text.includes("ليا كام") || text.startsWith("لي ") || text.includes("لي عند")) {
    const credits = ctx.pairs
      .filter((p) => p.creditorId === ctx.person.id)
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
      .slice(0, 8)
      .map((p) => describePairForPerson(ctx, p));
    const lines = [`ليك عند الناس إجمالي ${formatMoneyAr(ctx.net.totalFor)}.`];
    if (credits.length) lines.push(...credits);
    else lines.push("لسه مفيش رصيد ليك عند حد.");
    return { reply: lines.join("\n"), matched: "keyword", personFound: true };
  }
  if (text.includes("صافي") || text.includes("الصافي")) {
    return { reply: netReply(ctx), matched: "keyword", personFound: true };
  }
  if (text.includes("افراحي") || text.includes("الافراح") || text.includes("افراح") || text.includes("مطلوب مني")) {
    return { reply: upcomingReply(ctx), matched: "keyword", personFound: true };
  }
  if (text.startsWith("فرح ")) {
    const hostQuery = text.slice(4).trim();
    const ev = ctx.upcoming.find((u) =>
      normalizeArabic(u.hostName).includes(hostQuery),
    );
    if (ev) {
      return {
        reply: `فرحة ${ev.hostName} يوم ${formatDateAr(ev.eventDate)}${ev.place ? ` في ${ev.place}` : ""} — ${ev.outstanding > 0 ? `المطلوب منك ${formatMoneyAr(ev.outstanding)}.` : "مفيش مستحق سابق عليك."}`,
        matched: "keyword",
        personFound: true,
      };
    }
    return { reply: `مفيش فرحة قادمة مسجلة باسم «${hostQuery}».`, matched: "keyword", personFound: false };
  }

  // ③ «الرصيد مع فلان» / «حسابي مع فلان» / اسم شخص لوحده
  let nameQuery = "";
  const withIdx = text.indexOf(" مع ");
  if (withIdx > 0) nameQuery = text.slice(withIdx + 4).trim();
  if (!nameQuery && (text.startsWith("رصيد ") || text.startsWith("حساب "))) {
    nameQuery = text.replace(/^(رصيد|حساب)\s+(مع\s+)?/, "").trim();
  }
  if (!nameQuery) nameQuery = text;

  const matches = findPersonMatches(ctx, nameQuery);
  if (matches.length === 1) {
    return { reply: pairWithReply(ctx, matches[0]), matched: "name", personFound: true };
  }
  if (matches.length > 1) {
    const regions = matches.map((m) => m.region || "بدون منطقة").join("، ");
    return {
      reply: `فيه ${matches.length} أشخاص بالاسم ده (${regions}) — اكتب الاسم والمنطقة عشان أميّز.`,
      matched: "name",
      personFound: false,
    };
  }

  // ④ قائمة المساعدة
  return { reply: menuBody(ctx.brand, ctx.person.name), matched: "fallback", personFound: true };
}

// ─── الغلاف المتصل بقاعدة البيانات ─────────────────────────────────────────

/** يبني سياق البوت لشخص داخل مستأجر */
export async function buildBotContext(
  tenantId: number,
  person: Person,
): Promise<BotContext> {
  const [joined, persons, events, tenant] = await Promise.all([
    listTenantNuqtatJoined(tenantId),
    listPersons(tenantId),
    listEvents(tenantId),
    getTenantById(tenantId),
  ]);
  const byId = new Map(persons.map((p) => [p.id, p]));
  const pairs = computeAllPairs(joined)
    .filter((p) => p.personAId === person.id || p.personBId === person.id)
    .map((p): BalanceRow => {
      const a = byId.get(p.personAId);
      const b = byId.get(p.personBId);
      return {
        ...p,
        personAName: a?.name ?? "",
        personARegion: a?.region ?? "",
        personBName: b?.name ?? "",
        personBRegion: b?.region ?? "",
      };
    });

  // الأفراح القادمة لأصحاب تعاملوا مع الشخص سابقًا
  const today = new Date();
  const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const counterparties = new Set<number>();
  for (const p of pairs) {
    counterparties.add(p.personAId === person.id ? p.personBId : p.personAId);
  }
  const upcoming: BotUpcomingEvent[] = events
    .filter((e) => {
      if (e.status !== "upcoming" || !e.hostPersonId) return false;
      if (!counterparties.has(e.hostPersonId) && e.hostPersonId !== person.id)
        return false;
      return new Date(e.eventDate).getTime() >= dayStart.getTime();
    })
    .map((e) => {
      const hostId = e.hostPersonId!;
      const s = computeSettlement(joined, person.id, hostId, 0);
      // لو هو صاحب الفرح نفسه مفيش «مطلوب منه»
      const isSelf = hostId === person.id;
      return {
        eventId: e.id,
        hostName: e.hostName,
        eventDate: new Date(e.eventDate),
        place: e.place,
        outstanding: isSelf ? 0 : s.outstandingBefore,
        owedToPerson: isSelf ? 0 : Math.max(0, s.netAfter),
      };
    });

  return {
    brand: tenant?.name ?? "دفتر الأفراح",
    person,
    net: computePersonNet(joined, person.id),
    pairs,
    upcoming,
    otherPersons: persons
      .filter((p) => p.id !== person.id)
      .map((p) => ({ id: p.id, name: p.name, region: p.region })),
  };
}

/**
 * نقطة دخول البوت: يستقبل نصًا (أو نصًا مفرّغًا من صوتية) + تليفون،
 * يرد بالنص، ويسجل الوارد والصادر في whatsapp_messages.
 */
export async function handleBotMessage(
  tenantId: number | null,
  phone: string,
  text: string,
): Promise<BotReply> {
  const normalizedPhone = normalizePhone(phone);

  // تحديد الشخص والمستأجر: من التليفون مباشرة عبر كل المستأجرين
  const found = await findPersonByPhoneAnyTenant(normalizedPhone);
  const person = found && found.phone === normalizedPhone ? found : null;
  const effectiveTenantId = person?.tenantId ?? tenantId;

  if (!person || !effectiveTenantId) {
    return {
      reply:
        "أهلاً بيك! رقمك مش مسجل عندنا لسه — كلم الكاتب اللي سجل دعتك عشان يضيفك للدفتر. 📒",
      matched: "fallback",
      personFound: false,
    };
  }

  // سجّل الوارد
  await logWhatsappMessage({
    tenantId: effectiveTenantId,
    personId: person.id,
    phone: normalizedPhone,
    direction: "in",
    kind: "bot_query",
    body: text,
    status: "delivered",
    eventId: null,
    nuqtaId: null,
  });

  const ctx = await buildBotContext(effectiveTenantId, person);
  const reply = composeBotReply(ctx, text);

  // سجّل وأرسل الرد
  await sendWhatsapp({
    tenantId: effectiveTenantId,
    personId: person.id,
    phone: normalizedPhone,
    kind: "bot_reply",
    body: reply.reply,
  });

  return reply;
}
