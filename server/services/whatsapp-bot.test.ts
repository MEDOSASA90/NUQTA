import { describe, expect, it } from "vitest";
import type { BalanceRow } from "@contracts/afrah";
import { composeBotReply, type BotContext } from "./whatsapp-bot.js";

function row(partial: Partial<BalanceRow> & Pick<BalanceRow, "personAId" | "personBId">): BalanceRow {
  return {
    personAName: "",
    personARegion: "",
    personBName: "",
    personBRegion: "",
    aPaidToB: 0,
    bPaidToA: 0,
    net: 0,
    creditorId: null,
    debtorId: null,
    interactions: 0,
    status: "open",
    lastInteractionAt: null,
    ...partial,
  };
}

const ctx: BotContext = {
  brand: "أحمد عمر للأفراح",
  person: { id: 10, name: "محمود حسن", phone: "01000000010", region: "المنصورة" },
  net: { totalFor: 500, totalAgainst: 1000, net: -500 },
  pairs: [
    row({
      personAId: 10,
      personBId: 20,
      personBName: "خالد سمير",
      personBRegion: "طلخا",
      net: 500,
      creditorId: 10,
      debtorId: 20,
      interactions: 3,
      status: "open",
    }),
    row({
      personAId: 10,
      personBId: 30,
      personBName: "محمد عبد الله",
      personBRegion: "ميت غمر",
      net: -1000,
      creditorId: 30,
      debtorId: 10,
      interactions: 2,
      status: "partial",
    }),
    row({
      personAId: 10,
      personBId: 40,
      personBName: "محمد عبد الله",
      personBRegion: "بلقاس",
      net: 0,
      interactions: 2,
      status: "settled",
    }),
  ],
  upcoming: [
    {
      eventId: 99,
      hostName: "خالد سمير",
      eventDate: new Date(2026, 7, 1),
      place: "قاعة النيل",
      outstanding: 0,
      owedToPerson: 500,
    },
  ],
  otherPersons: [
    { id: 20, name: "خالد سمير", region: "طلخا" },
    { id: 30, name: "محمد عبد الله", region: "ميت غمر" },
    { id: 40, name: "محمد عبد الله", region: "بلقاس" },
    { id: 50, name: "أحمد عمر", region: "المنصورة" },
  ],
};

describe("البوت — القائمة المرقمة", () => {
  it("1 ⇒ كشف حساب كامل بالأرصدة والصافي", () => {
    const r = composeBotReply(ctx, "1");
    expect(r.matched).toBe("menu");
    expect(r.reply).toContain("كشف حسابك");
    expect(r.reply).toContain("خالد سمير");
    expect(r.reply).toContain("ليك 500 ج.م");
    expect(r.reply).toContain("عليك 1,000 ج.م");
    expect(r.reply).toContain("الصافي 500 ج.م عليك");
  });

  it("2 ⇒ الأفراح القادمة والمطلوب", () => {
    const r = composeBotReply(ctx, "2");
    expect(r.reply).toContain("فرحة خالد سمير");
    expect(r.reply).toContain("قاعة النيل");
  });

  it("3 بدون اسم ⇒ يطلب الاسم", () => {
    const r = composeBotReply(ctx, "3");
    expect(r.reply).toContain("اكتب 3");
  });

  it("3 باسم متكرر ⇒ يطلب التمييز بالمنطقة", () => {
    const r = composeBotReply(ctx, "3 محمد عبد الله");
    expect(r.personFound).toBe(false);
    expect(r.reply).toContain("ميت غمر");
    expect(r.reply).toContain("بلقاس");
  });

  it("3 باسم + منطقة ⇒ رصيد الطرف", () => {
    const r = composeBotReply(ctx, "3 محمد عبد الله ميت غمر");
    expect(r.personFound).toBe(true);
    expect(r.reply).toContain("عليك 1,000 ج.م");
  });

  it("3 باسم غير موجود ⇒ اعتذار", () => {
    const r = composeBotReply(ctx, "3 زوزو");
    expect(r.personFound).toBe(false);
    expect(r.reply).toContain("مش لاقي");
  });

  it("4 ⇒ الصافي الكلي", () => {
    const r = composeBotReply(ctx, "4");
    expect(r.reply).toContain("الصافي الكلي: 500 ج.م عليك");
  });
});

describe("البوت — الكتابة الحرة", () => {
  it("«كشف حساب»", () => {
    const r = composeBotReply(ctx, "عايز كشف حساب لو سمحت");
    expect(r.matched).toBe("keyword");
    expect(r.reply).toContain("كشف حسابك");
  });

  it("«عليا كام»", () => {
    const r = composeBotReply(ctx, "عليا كام؟");
    expect(r.reply).toContain("عليك للناس إجمالي 1,000 ج.م");
    expect(r.reply).toContain("محمد عبد الله");
  });

  it("«لي كام»", () => {
    const r = composeBotReply(ctx, "لي كام عند الناس");
    expect(r.reply).toContain("ليك عند الناس إجمالي 500 ج.م");
    expect(r.reply).toContain("خالد سمير");
  });

  it("اسم شخص لوحده ⇒ رصيده", () => {
    const r = composeBotReply(ctx, "خالد سمير");
    expect(r.matched).toBe("name");
    expect(r.reply).toContain("ليك 500 ج.م");
  });

  it("«فرح فلان» ⇒ معلومات الفرح", () => {
    const r = composeBotReply(ctx, "فرح خالد");
    expect(r.reply).toContain("فرحة خالد سمير");
    expect(r.reply).toContain("مفيش مستحق سابق");
  });

  it("نص غير مفهوم ⇒ قائمة المساعدة", () => {
    const r = composeBotReply(ctx, "صباح الفل");
    expect(r.matched).toBe("fallback");
    expect(r.reply).toContain("1️⃣");
    expect(r.reply).toContain("أحمد عمر للأفراح");
  });

  it("يتجاهل الهمزات في المطابقة", () => {
    const r = composeBotReply(ctx, "احمد عمر");
    expect(r.matched).toBe("name");
    expect(r.reply).toContain("أحمد عمر");
  });
});
