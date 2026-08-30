/**
 * قوالب رسائل واتساب بالعامية المصرية — الأنظمة أ (تذكير) وب (تأكيد/تصحيح).
 */
import type { SettlementPreview } from "@contracts/afrah";
import { formatDateAr, formatMoneyAr } from "./whatsapp.js";

/** النظام ب — تأكيد فوري بعد تسجيل النقطة */
export function composeConfirmationBody(params: {
  brand: string;
  payerName: string;
  hostName: string;
  amount: number;
  eventDate: Date;
  settlement: SettlementPreview;
}): string {
  const { payerName, hostName, amount, eventDate, settlement } = params;
  const lines = [
    `تمام يا ${payerName} ✅`,
    `اتسجلت نقطتك في فرحة ${hostName} يوم ${formatDateAr(eventDate)} بمبلغ ${formatMoneyAr(amount)}.`,
  ];
  switch (settlement.status) {
    case "new":
      lines.push("مفيش حساب سابق بينكم — النقطة اتفتحت جديدة.");
      break;
    case "partial":
      lines.push(
        `سددت من حسابك مع ${hostName} — باقي عليك ${formatMoneyAr(settlement.remaining)}.`,
      );
      break;
    case "settled":
      lines.push(`صفّيت حسابك مع ${hostName} بالكامل — مفيش باقي لا ليك ولا عليك. 🎉`);
      break;
    case "overpaid":
      lines.push(
        `صفّيت اللي كان عليك (${formatMoneyAr(settlement.outstandingBefore)}) وزاد ${formatMoneyAr(settlement.overpaid)} — بقى رصيد ليك عند ${hostName}.`,
      );
      break;
  }
  if (settlement.netAfter > 0) {
    lines.push(`رصيدك الحالي مع ${hostName}: ليك ${formatMoneyAr(settlement.netAfter)}.`);
  } else if (settlement.netAfter < 0) {
    lines.push(
      `رصيدك الحالي مع ${hostName}: عليك ${formatMoneyAr(-settlement.netAfter)}.`,
    );
  }
  lines.push(`— ${params.brand}`);
  return lines.join("\n");
}

/** رسالة تصحيحية بعد تعديل/حذف نقطة كان اتبعت لها إشعار */
export function composeCorrectionBody(params: {
  brand: string;
  payerName: string;
  hostName: string;
  change: "updated" | "deleted";
  oldAmount: number;
  newAmount?: number;
  note?: string;
}): string {
  const { payerName, hostName, change, oldAmount, newAmount, note } = params;
  const lines = [`تصحيح مهم يا ${payerName} ✏️`];
  if (change === "updated") {
    lines.push(
      `نقطتك في فرحة ${hostName} كانت ${formatMoneyAr(oldAmount)} واتعدلت بقت ${formatMoneyAr(newAmount ?? oldAmount)}.`,
    );
  } else {
    lines.push(
      `نقطتك في فرحة ${hostName} (${formatMoneyAr(oldAmount)}) اتحذفت من الدفتر.`,
    );
  }
  if (note) lines.push(`ملاحظة: ${note}`);
  lines.push(`— ${params.brand}`);
  return lines.join("\n");
}

/** النظام أ — تذكير ما قبل الفرح */
export function composeReminderBody(params: {
  brand: string;
  personName: string;
  hostName: string;
  eventDate: Date;
  place: string;
  daysLeft: number;
  outstanding: number;
}): string {
  const { personName, hostName, eventDate, place, daysLeft, outstanding } = params;
  const when =
    daysLeft === 0 ? "النهارده" : daysLeft === 1 ? "بكرة" : `بعد ${daysLeft} أيام`;
  const lines = [
    `مساء الخير يا ${personName} 🌙`,
    `فاكرك: فرحة ${hostName} ${when} (${formatDateAr(eventDate)})${place ? ` — ${place}` : ""}.`,
  ];
  if (outstanding > 0) {
    lines.push(`اللي عليك لـ${hostName} حتى دلوقتي: ${formatMoneyAr(outstanding)}.`);
  } else {
    lines.push("مفيش مستحق سابق بينكم — براحتك خالص.");
  }
  lines.push(`— ${params.brand}`);
  return lines.join("\n");
}
