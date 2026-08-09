import { describe, expect, it } from "vitest";
import {
  computeAllPairs,
  computeNetworkNet,
  computePair,
  computePersonNet,
  computeSettlement,
  findSettlements,
  nuqtatBetween,
  type NuqtaLike,
} from "./balance-core";

let seq = 0;
function n(
  payerId: number,
  hostId: number,
  amount: number,
  dayOffset = 0,
): NuqtaLike {
  seq += 1;
  return {
    id: seq,
    payerId,
    hostId,
    amount,
    eventId: 100 + seq,
    createdAt: new Date(Date.UTC(2026, 0, 1 + dayOffset)),
  };
}

describe("computePair — الصافي وعدد التفاعلات", () => {
  it("اتجاه واحد: A دفع 1000 في فرح B ⇒ A له 1000، الحالة مفتوحة", () => {
    const p = computePair(1, 2, [n(1, 2, 1000)]);
    expect(p.aPaidToB).toBe(1000);
    expect(p.bPaidToA).toBe(0);
    expect(p.net).toBe(1000);
    expect(p.creditorId).toBe(1);
    expect(p.debtorId).toBe(2);
    expect(p.interactions).toBe(1);
    expect(p.status).toBe("open");
  });

  it("عدد التفاعلات = مجموع الاتجاهين", () => {
    const p = computePair(1, 2, [
      n(1, 2, 1000, 1),
      n(2, 1, 500, 2),
      n(1, 2, 300, 3),
    ]);
    expect(p.interactions).toBe(3);
    expect(p.net).toBe(1000 - 500 + 300);
  });

  it("رد جزئي: الحالة partial والصافي يقل", () => {
    const p = computePair(1, 2, [n(1, 2, 1000, 1), n(2, 1, 400, 2)]);
    expect(p.net).toBe(600);
    expect(p.creditorId).toBe(1);
    expect(p.status).toBe("partial");
  });

  it("رد كامل: الحالة settled والدائن null", () => {
    const p = computePair(1, 2, [n(1, 2, 1000, 1), n(2, 1, 1000, 2)]);
    expect(p.net).toBe(0);
    expect(p.creditorId).toBeNull();
    expect(p.debtorId).toBeNull();
    expect(p.status).toBe("settled");
  });

  it("رد بزيادة: آخر نقطة قلبت الإشارة ⇒ overpaid", () => {
    const p = computePair(1, 2, [n(1, 2, 1000, 1), n(2, 1, 1500, 2)]);
    expect(p.net).toBe(-500);
    expect(p.creditorId).toBe(2);
    expect(p.status).toBe("overpaid");
  });

  it("الترتيب الزمني يحترم حتى لو الإدخال غير مرتب", () => {
    const between = nuqtatBetween(
      [n(2, 1, 1000, 5), n(1, 2, 1000, 1)],
      1,
      2,
    );
    const p = computePair(1, 2, between);
    expect(p.net).toBe(0);
    expect(p.status).toBe("settled");
  });
});

describe("computeSettlement — حالة السداد عند تسجيل نقطة", () => {
  it("لا دين سابق ⇒ new", () => {
    const s = computeSettlement([], 1, 2, 500);
    expect(s.status).toBe("new");
    expect(s.outstandingBefore).toBe(0);
    expect(s.remaining).toBe(0);
    expect(s.overpaid).toBe(0);
    expect(s.netAfter).toBe(500);
  });

  it("الاتجاه المعاكس لا يصنع دينًا على الدافع ⇒ new", () => {
    // P (1) دفع سابقًا في فرح H (2) — ده رصيد «له» مش «عليه»
    const s = computeSettlement([n(1, 2, 700)], 1, 2, 500);
    expect(s.status).toBe("new");
    expect(s.netAfter).toBe(1200);
  });

  it("دفع أقل من المستحق ⇒ partial والباقي صحيح", () => {
    // H (2) دفع 1000 في فرح P (1) سابقًا ⇒ على P دين 1000
    const s = computeSettlement([n(2, 1, 1000)], 1, 2, 400);
    expect(s.status).toBe("partial");
    expect(s.outstandingBefore).toBe(1000);
    expect(s.remaining).toBe(600);
    expect(s.overpaid).toBe(0);
    expect(s.netAfter).toBe(-600); // لسه عليه 600
  });

  it("دفع بالظبط المستحق ⇒ settled", () => {
    const s = computeSettlement([n(2, 1, 1000)], 1, 2, 1000);
    expect(s.status).toBe("settled");
    expect(s.remaining).toBe(0);
    expect(s.netAfter).toBe(0);
  });

  it("دفع أكثر من المستحق ⇒ overpaid والفرق رصيد «له»", () => {
    const s = computeSettlement([n(2, 1, 1000)], 1, 2, 1300);
    expect(s.status).toBe("overpaid");
    expect(s.overpaid).toBe(300);
    expect(s.remaining).toBe(0);
    expect(s.netAfter).toBe(300); // بقى له 300 عند H
  });

  it("سداد على دفعات متتالية يتراكم صح", () => {
    const existing = [n(2, 1, 1000, 1), n(1, 2, 300, 2)];
    const s = computeSettlement(existing, 1, 2, 700);
    expect(s.status).toBe("settled");
    expect(s.netAfter).toBe(0);
  });

  it("الرسالة العربية تتولد لكل حالة", () => {
    for (const [existing, amount] of [
      [[], 500],
      [[n(2, 1, 1000)], 400],
      [[n(2, 1, 1000)], 1000],
      [[n(2, 1, 1000)], 1300],
    ] as const) {
      const s = computeSettlement([...existing], 1, 2, amount);
      expect(s.message.length).toBeGreaterThan(0);
    }
  });
});

describe("computeAllPairs / personNet / networkNet", () => {
  it("يتجاهل نقطة الشخص في فرح نفسه", () => {
    const pairs = computeAllPairs([n(1, 1, 500), n(1, 2, 300)]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].personAId).toBe(1);
    expect(pairs[0].personBId).toBe(2);
  });

  it("personNet يجمع له وعليه عبر الشبكة", () => {
    const all = [
      n(1, 2, 1000, 1), // 1 له 1000 عند 2
      n(3, 1, 400, 2), // 1 عليه 400 لـ 3
      n(2, 3, 200, 3), // لا يخص 1
    ];
    const net = computePersonNet(all, 1);
    expect(net.totalFor).toBe(1000);
    expect(net.totalAgainst).toBe(400);
    expect(net.net).toBe(600);
  });

  it("networkNet: مجموع الله = مجموع العليه عبر الشبكة دائمًا", () => {
    const all = [n(1, 2, 1000), n(2, 3, 500), n(3, 1, 250)];
    const net = computeNetworkNet(all);
    expect(net.totalFor).toBe(1750);
    expect(net.totalAgainst).toBe(1750);
    expect(net.net).toBe(0);
  });
});

describe("findSettlements — فلان صفّى حسابه معاك", () => {
  it("يكتشف التصفية ويحدد المستفيد (صاحب الفرح)", () => {
    const notices = findSettlements([
      n(2, 1, 1000, 1), // 2 له 1000 عند 1
      n(1, 2, 1000, 2), // 1 صفّى في فرح 2
    ]);
    expect(notices).toHaveLength(1);
    expect(notices[0].settlerId).toBe(1);
    expect(notices[0].hostId).toBe(2);
    expect(notices[0].amount).toBe(1000);
  });

  it("لا إشعار عند السداد الجزئي أو الزيادة", () => {
    expect(findSettlements([n(2, 1, 1000, 1), n(1, 2, 400, 2)])).toHaveLength(0);
    expect(findSettlements([n(2, 1, 1000, 1), n(1, 2, 1400, 2)])).toHaveLength(0);
  });

  it("تصفية بعد جزئي متكرر تُكتشف", () => {
    const notices = findSettlements([
      n(2, 1, 1000, 1),
      n(1, 2, 400, 2),
      n(1, 2, 600, 3),
    ]);
    expect(notices).toHaveLength(1);
    expect(notices[0].amount).toBe(600);
  });
});
