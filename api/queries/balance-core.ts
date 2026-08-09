/**
 * منطق الأرصدة والسداد — دوال نقية (pure) قابلة للاختبار بدون قاعدة بيانات.
 *
 * القواعد (سبيك §3):
 * - كل نقطة دفعها A في فرح B ⇒ B مديون لـ A بنفس المبلغ (A «له» عند B).
 * - الصافي بين (A,B) = مجموع نقاط A في أفراح B − مجموع نقاط B في أفراح A.
 * - عدد مرات التفاعل = عدد النقوط في الاتجاهين مجتمعة.
 * - حالة السداد عند نقطة جديدة (P يدفع m في فرح H):
 *   الدين المستحق على P قبل النقطة = صافي ما دفعه H سابقًا في أفراح P
 *   (لو P «عليه» عند H)، وإلا فالحالة «جديدة/مفتوحة».
 */
import type {
  PairStatus,
  PersonNet,
  SettlementPreview,
  SettledNotice,
} from "@contracts/afrah";

/** نقطة بأبسط صورة يحتاجها الحساب (host = صاحب الفرح شخص مسجل) */
export type NuqtaLike = {
  id: number;
  payerId: number;
  hostId: number;
  amount: number;
  eventId: number;
  createdAt: Date;
};

export type PairComputation = {
  personAId: number;
  personBId: number;
  aPaidToB: number;
  bPaidToA: number;
  net: number;
  creditorId: number | null;
  debtorId: number | null;
  interactions: number;
  status: PairStatus;
  lastInteractionAt: Date | null;
};

/** مفتاح ثابت للزوج مهما كان ترتيب الطرفين */
export function pairKey(a: number, b: number): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function byTime(x: NuqtaLike, y: NuqtaLike): number {
  const t = x.createdAt.getTime() - y.createdAt.getTime();
  return t !== 0 ? t : x.id - y.id;
}

/** يعيد النقوط بين شخصين فقط (أي اتجاه) */
export function nuqtatBetween<T extends NuqtaLike>(
  nuqtat: T[],
  aId: number,
  bId: number,
): T[] {
  return nuqtat
    .filter(
      (n) =>
        (n.payerId === aId && n.hostId === bId) ||
        (n.payerId === bId && n.hostId === aId),
    )
    .sort(byTime);
}

/**
 * يلخّص رصيد زوج أشخاص من نقوطهما المرتبة زمنيًا.
 * الاتفاق: personAId هو الأصغر id — الاتجاهات تتبع ذلك.
 */
export function computePair(
  aId: number,
  bId: number,
  between: NuqtaLike[],
): PairComputation {
  let aPaidToB = 0;
  let bPaidToA = 0;
  let net = 0; // موجب = A «له» عند B
  let lastWasFlip = false;
  let hasAtoB = false;
  let hasBtoA = false;
  let lastInteractionAt: Date | null = null;

  for (const n of between) {
    const delta = n.payerId === aId ? n.amount : -n.amount;
    if (n.payerId === aId) {
      aPaidToB += n.amount;
      hasAtoB = true;
    } else {
      bPaidToA += n.amount;
      hasBtoA = true;
    }
    const prev = net;
    net += delta;
    lastWasFlip =
      prev !== 0 && net !== 0 && Math.sign(prev) !== Math.sign(net);
    lastInteractionAt = n.createdAt;
  }

  const interactions = between.length;
  let status: PairStatus;
  if (interactions === 0 || net === 0) {
    status = interactions === 0 ? "open" : "settled";
  } else if (!hasAtoB || !hasBtoA) {
    status = "open";
  } else if (lastWasFlip) {
    status = "overpaid";
  } else {
    status = "partial";
  }

  return {
    personAId: aId,
    personBId: bId,
    aPaidToB,
    bPaidToA,
    net,
    creditorId: net > 0 ? aId : net < 0 ? bId : null,
    debtorId: net > 0 ? bId : net < 0 ? aId : null,
    interactions,
    status,
    lastInteractionAt,
  };
}

/** يبني كل الأزواج التي فيها تفاعل من قائمة نقوط المستأجر كاملة */
export function computeAllPairs(nuqtat: NuqtaLike[]): PairComputation[] {
  const groups = new Map<string, NuqtaLike[]>();
  for (const n of nuqtat) {
    if (n.payerId === n.hostId) continue; // نقطة لنفسه لا تصنع رصيدًا
    const key = pairKey(n.payerId, n.hostId);
    const arr = groups.get(key);
    if (arr) arr.push(n);
    else groups.set(key, [n]);
  }
  const out: PairComputation[] = [];
  for (const [key, list] of groups) {
    const [a, b] = key.split(":").map(Number);
    out.push(computePair(a, b, list.sort(byTime)));
  }
  return out.sort((x, y) => Math.abs(y.net) - Math.abs(x.net));
}

/**
 * معاينة/حساب حالة السداد لنقطة جديدة (P يدفع amount في فرح H).
 * `existing` = كل نقوط المستأجر قبل هذه النقطة (host محلول من الفرح).
 */
export function computeSettlement(
  existing: NuqtaLike[],
  payerId: number,
  hostId: number,
  amount: number,
): SettlementPreview {
  let paidByHostAtPayer = 0; // ما دفعه H في أفراح P
  let paidByPayerAtHost = 0; // ما دفعه P في أفراح H
  for (const n of existing) {
    if (n.payerId === hostId && n.hostId === payerId)
      paidByHostAtPayer += n.amount;
    else if (n.payerId === payerId && n.hostId === hostId)
      paidByPayerAtHost += n.amount;
  }

  const outstandingBefore = Math.max(0, paidByHostAtPayer - paidByPayerAtHost);
  const netAfter = paidByPayerAtHost + amount - paidByHostAtPayer;

  let status: SettlementPreview["status"];
  let remaining = 0;
  let overpaid = 0;
  if (outstandingBefore === 0) {
    status = "new";
  } else if (amount < outstandingBefore) {
    status = "partial";
    remaining = outstandingBefore - amount;
  } else if (amount === outstandingBefore) {
    status = "settled";
  } else {
    status = "overpaid";
    overpaid = amount - outstandingBefore;
  }

  const preview: SettlementPreview = {
    status,
    outstandingBefore,
    remaining,
    overpaid,
    netAfter,
    message: "",
  };
  preview.message = buildSettlementMessage(preview);
  return preview;
}

/** رسالة عربية بالعامية توصف حالة السداد — للواجهة ورسالة واتساب */
export function buildSettlementMessage(
  p: Omit<SettlementPreview, "message">,
  payerName = "الدافع",
  hostName = "صاحب الفرح",
): string {
  switch (p.status) {
    case "new":
      return `نقطة جديدة — مفيش حساب سابق بين ${payerName} و${hostName}.`;
    case "partial":
      return `${payerName} سدد من حسابه مع ${hostName} — باقي عليه ${p.remaining} ج.م.`;
    case "settled":
      return `${payerName} صفّى حسابه معاك يا ${hostName} — مفيش باقي لا له ولا عليه.`;
    case "overpaid":
      return `${payerName} صفّى اللي عليه (${p.outstandingBefore} ج.م) وزاد ${p.overpaid} ج.م — بقت رصيد له عند ${hostName}.`;
  }
}

/** الصافي الكلي لشخص عبر كل الشبكة */
export function computePersonNet(
  nuqtat: NuqtaLike[],
  personId: number,
): PersonNet {
  let totalFor = 0;
  let totalAgainst = 0;
  for (const pair of computeAllPairs(nuqtat)) {
    if (pair.net === 0) continue;
    if (pair.creditorId === personId) totalFor += Math.abs(pair.net);
    else if (pair.debtorId === personId) totalAgainst += Math.abs(pair.net);
  }
  return { totalFor, totalAgainst, net: totalFor - totalAgainst };
}

/**
 * حجم الائتمان المفتوح عبر الشبكة كلها.
 * كل زوج برصيد |net| يضيف |net| لجهة «له» (دائن) و|net| لجهة «عليه» (مدين)
 * بالضرورة — لذلك المجموعان متساويان دائمًا والصافي صفر.
 */
export function computeNetworkNet(nuqtat: NuqtaLike[]): PersonNet {
  let totalFor = 0;
  let totalAgainst = 0;
  for (const pair of computeAllPairs(nuqtat)) {
    const abs = Math.abs(pair.net);
    if (abs === 0) continue;
    totalFor += abs;
    totalAgainst += abs;
  }
  return { totalFor, totalAgainst, net: totalFor - totalAgainst };
}

/**
 * قائمة «فلان صفّى حسابه معاك»: كل نقطة أصفرت دينًا قائمًا بين طرفين.
 * المستفيد (host) = صاحب الفرح الذي دُفعت فيه نقطة التصفية.
 */
export function findSettlements(
  nuqtat: NuqtaLike[],
): Omit<SettledNotice, "settlerName" | "hostName" | "eventLabel">[] {
  const notices: Omit<
    SettledNotice,
    "settlerName" | "hostName" | "eventLabel"
  >[] = [];
  const groups = new Map<string, NuqtaLike[]>();
  for (const n of nuqtat) {
    if (n.payerId === n.hostId) continue;
    const key = pairKey(n.payerId, n.hostId);
    const arr = groups.get(key);
    if (arr) arr.push(n);
    else groups.set(key, [n]);
  }
  for (const list of groups.values()) {
    let net = 0; // بمنظور الطرف صاحب الـ id الأصغر
    const smaller = Math.min(list[0].payerId, list[0].hostId);
    for (const n of list.sort(byTime)) {
      const delta = n.payerId === smaller ? n.amount : -n.amount;
      const prev = net;
      net += delta;
      if (prev !== 0 && net === 0) {
        notices.push({
          settlerId: n.payerId,
          hostId: n.hostId,
          amount: n.amount,
          eventId: n.eventId,
          settledAt: n.createdAt,
        });
      }
    }
  }
  return notices.sort((a, b) => b.settledAt.getTime() - a.settledAt.getTime());
}
