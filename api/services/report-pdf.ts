/**
 * توليد تقرير PDF الرسمي لفرحة (سبيك §6):
 *  ١) غلاف: اسم البراند + «فرحة» والتاريخ + اسم صاحب الفرح + تاريخ الإصدار + توقيع.
 *  ٢) فهرس: المناطق وعدد الأشخاص مع روابط داخلية لكل منطقة (+ رابط صفحة التجميع).
 *  ٣) صفحة لكل منطقة: لكل شخص الاسم/التليفون/المبلغ + تاريخ نقوطه السابقة مع صاحب الفرح.
 *  ٤) صفحة أخيرة «تجميع الشنطة»: جدول تجميعي لكل منطقة (أشخاص/نقوط/مبلغ)
 *     + صف إجمالي عام بارز + إجمالي الشنطة كلها برقم كبير رسمي.
 *
 * العربية تُشكّل عبر arabic-reshaper + bidi-js وخط Amiri (api/assets/fonts).
 */
import { promises as fs, existsSync } from "fs";
import * as fsSync from "fs";
import path from "path";
import { fileURLToPath } from "url";
import fontkit from "@pdf-lib/fontkit";
import {
  PDFDocument,
  PDFFont,
  PDFPage,
  PDFRef,
  rgb,
  type RGB,
} from "pdf-lib";
import type { Report } from "@db/schema";
import { getEvent } from "../queries/events";
import { listExpensesByEvent } from "../queries/expenses";
import { listNuqtatByEvent, listTenantNuqtatJoined } from "../queries/nuqtat";
import { listPersons } from "../queries/persons";
import { getTenantById } from "../queries/tenants";
import { createReportRow, deleteReportRow, updateReportFileUrl } from "../queries/reports";
import { toPdfDrawableText, wrapArabic } from "./arabic-text";
import { formatDateAr, formatMoneyAr } from "./whatsapp";

const A4_W = 595.28;
const A4_H = 841.89;
const MARGIN = 50;
const RIGHT = A4_W - MARGIN;

const INK = rgb(0.23, 0.19, 0.15);
const GOLD = rgb(0.76, 0.61, 0.24);
const RED = rgb(0.7, 0.15, 0.12);
const GRAY = rgb(0.45, 0.41, 0.36);

/**
 * حل المسارات بثبات في dev والإنتاج معًا — لا نعتمد على cwd وحده:
 *  - dev/vitest: الوحدة في api/services/ → الجذر = ../../
 *  - production bundle: كل شيء داخل dist/boot.js → الجذر = ../
 * نجرّب cwd أولًا (السلوك التقليدي) ثم المسارات المشتقة من مكان الوحدة.
 */
const HERE = path.dirname(fileURLToPath(import.meta.url));

function firstExisting(candidates: string[]): string {
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return candidates[0];
}

const FONT_PATH = firstExisting([
  path.resolve(process.cwd(), "api/assets/fonts/Amiri-Regular.ttf"),
  path.resolve(HERE, "../api/assets/fonts/Amiri-Regular.ttf"), // dist → <root>/api/assets
  path.resolve(HERE, "../assets/fonts/Amiri-Regular.ttf"), // api/services → api/assets
  path.resolve(HERE, "assets/fonts/Amiri-Regular.ttf"), // dist/assets (تُنسخ في البناء)
]);

/**
 * مجلد التقارير — مقاوم للفشل: على بعض الخوادم المنشورة يكون مجلد العمل
 * للقراءة فقط، فيفشل mkdir بصمت وتعلق الواجهة. نجرّب عدة مرشحين ونختار
 * أول مجلد ننجح فعليًا في إنشائه/الكتابة فيه، مع /tmp كملاذ أخير مضمون.
 * النتيجة تُثبَّت للعملية حتى يقرأ مسار التقديم من نفس مكان الكتابة.
 */
let _resolvedReportsDir: string | null = null;

export function reportsDir(): string {
  if (_resolvedReportsDir) return _resolvedReportsDir;
  const candidates = [
    path.resolve(process.cwd(), "reports"),
    path.resolve(HERE, "../reports"), // dist → <root>/reports
    path.resolve(HERE, "../../reports"), // api/services → <root>/reports
    "/tmp/afrah-reports", // ملاذ أخير — قابل للكتابة دائمًا تقريبًا
  ];
  for (const dir of candidates) {
    try {
      fsSync.mkdirSync(dir, { recursive: true });
      // اختبار كتابة حقيقي
      fsSync.accessSync(dir, fsSync.constants.W_OK);
      _resolvedReportsDir = dir;
      return dir;
    } catch (err) {
      console.error(`[reports] مجلد غير صالح للكتابة: ${dir} —`, (err as Error).message);
    }
  }
  // لن نصل هنا عمليًا (/tmp دائمًا قابل للكتابة)
  _resolvedReportsDir = candidates[candidates.length - 1];
  return _resolvedReportsDir;
}

export function reportFilePath(reportId: number): string {
  // نبحث أولًا عن ملف موجود في أي من المرشحين (تقارير قديمة قد تكون في مجلد مختلف)
  const name = `report-${reportId}.pdf`;
  const candidates = [
    path.join(reportsDir(), name),
    path.resolve(process.cwd(), "reports", name),
    path.resolve(HERE, "../reports", name),
    path.resolve(HERE, "../../reports", name),
    path.join("/tmp/afrah-reports", name),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return candidates[0];
}

// ─── بيانات التقرير ─────────────────────────────────────────────────────────

export type ReportPersonHistory = {
  date: Date;
  amount: number;
  label: string; // «دفع في فرحة {host}» أو «صاحب الفرح دفع في فرحته»
};

export type ReportPersonRow = {
  name: string;
  phone: string;
  amount: number;
  editedAfterDone: boolean;
  history: ReportPersonHistory[];
};

export type ReportRegion = {
  region: string;
  persons: ReportPersonRow[];
  totalAmount: number;
};

export type ReportExpenseRow = {
  receiverName: string;
  amount: number;
  handedByName: string | null;
  date: Date;
  note: string | null;
};

export type ReportLedgerPerson = {
  name: string;
  phone: string;
  region: string;
  previousAmount: number;
  currentAmount: number;
  remainingAmount: number;
};

export type ReportData = {
  brand: string;
  hostName: string;
  eventDate: Date;
  place: string;
  issuedAt: Date;
  grandTotal: number;
  personsCount: number;
  regions: ReportRegion[];
  /** مصروفات الشنطة (فلوس اتسلمت لصاحب الفرح أو من طرفه) */
  expenses: ReportExpenseRow[];
  totalExpenses: number;
  /** صافي الشنطة = إجمالي النقوط − المصروفات */
  netTotal: number;
  previousNonAttendees?: ReportLedgerPerson[];
  underpaid?: ReportLedgerPerson[];
  settled?: ReportLedgerPerson[];
  outstanding?: ReportLedgerPerson[];
};

export async function buildReportData(
  tenantId: number,
  eventId: number,
): Promise<ReportData> {
  const [event, tenant, eventNuqtat, allJoined, eventExpenses, allPersons] = await Promise.all([
    getEvent(tenantId, eventId),
    getTenantById(tenantId),
    listNuqtatByEvent(tenantId, eventId),
    listTenantNuqtatJoined(tenantId),
    listExpensesByEvent(tenantId, eventId),
    listPersons(tenantId),
  ]);
  if (!event) throw new Error(`Event ${eventId} not found`);
  const brand = tenant?.name ?? "دفتر الأفراح";
  const hostPersonId = event.hostPersonId;

  const previousByPerson = new Map<number, number>();
  if (hostPersonId !== null) {
    for (const entry of allJoined) {
      if (entry.eventId === eventId) continue;
      if (entry.hostId === hostPersonId && entry.payerId !== hostPersonId) {
        previousByPerson.set(entry.payerId, (previousByPerson.get(entry.payerId) ?? 0) + entry.amount);
      }
    }
  }
  const currentByPerson = new Map<number, number>();
  for (const entry of eventNuqtat) {
    currentByPerson.set(entry.payerPersonId, (currentByPerson.get(entry.payerPersonId) ?? 0) + entry.amount);
  }
  const personById = new Map(allPersons.map((person) => [person.id, person]));
  const previousNonAttendees: ReportLedgerPerson[] = [];
  const underpaid: ReportLedgerPerson[] = [];
  const settled: ReportLedgerPerson[] = [];
  const outstanding: ReportLedgerPerson[] = [];
  for (const [personId, previousAmount] of previousByPerson) {
    const person = personById.get(personId);
    if (!person) continue;
    const currentAmount = currentByPerson.get(personId) ?? 0;
    const row: ReportLedgerPerson = {
      name: person.name,
      phone: person.phone,
      region: person.region || "بدون منطقة",
      previousAmount,
      currentAmount,
      remainingAmount: Math.max(previousAmount - currentAmount, 0),
    };
    if (currentAmount === 0) previousNonAttendees.push(row);
    else if (currentAmount < previousAmount) {
      underpaid.push(row);
      outstanding.push(row);
    } else settled.push(row);
  }

  const byRegion = new Map<string, ReportPersonRow[]>();
  for (const n of eventNuqtat) {
    const region = n.payerRegion?.trim() || "بدون منطقة";
    // تاريخ النقوط السابقة مع صاحب الفرح (الاتجاهين، بدون نقطة الفرح الحالية)
    const history: ReportPersonHistory[] = hostPersonId
      ? allJoined
          .filter(
            (x) =>
              x.id !== n.id &&
              ((x.payerId === n.payerPersonId && x.hostId === hostPersonId) ||
                (x.payerId === hostPersonId && x.hostId === n.payerPersonId)),
          )
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
          .map((x) => ({
            date: x.createdAt,
            amount: x.amount,
            label:
              x.payerId === n.payerPersonId
                ? `دفع في فرحة ${x.hostName}`
                : `${x.hostName} دفع في فرحته`,
          }))
      : [];

    const list = byRegion.get(region) ?? [];
    list.push({
      name: n.payerName,
      phone: n.payerPhone,
      amount: n.amount,
      editedAfterDone: n.editedAfterDone,
      history,
    });
    byRegion.set(region, list);
  }

  const regions: ReportRegion[] = [...byRegion.entries()]
    .map(([region, persons]) => ({
      region,
      persons: persons.sort((a, b) => b.amount - a.amount),
      totalAmount: persons.reduce((s, p) => s + p.amount, 0),
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount);

  const grandTotal = eventNuqtat.reduce((s, n) => s + n.amount, 0);
  const totalExpenses = eventExpenses.reduce((s, e) => s + e.amount, 0);
  return {
    brand,
    hostName: event.hostName,
    eventDate: new Date(event.eventDate),
    place: event.place,
    issuedAt: new Date(),
    grandTotal,
    personsCount: new Set(eventNuqtat.map((n) => n.payerPersonId)).size,
    regions,
    expenses: eventExpenses.map((e) => ({
      receiverName: e.receiverName,
      amount: e.amount,
      handedByName: e.handedByName,
      date: e.createdAt,
      note: e.note,
    })),
    totalExpenses,
    netTotal: grandTotal - totalExpenses,
    previousNonAttendees,
    underpaid,
    settled,
    outstanding,
  };
}

// ─── مساعدات رسم ────────────────────────────────────────────────────────────

class Pen {
  private page: PDFPage;
  private font: PDFFont;
  constructor(page: PDFPage, font: PDFFont) {
    this.page = page;
    this.font = font;
  }

  widthOf(visual: string, size: number): number {
    return this.font.widthOfTextAtSize(visual, size);
  }

  /** نص عربي — محاذاة يمين افتراضيًا */
  ar(
    logical: string,
    opts: { y: number; size?: number; color?: RGB; align?: "right" | "center" | "left"; x?: number },
  ): number {
    const { y, size = 12, color = INK, align = "right", x } = opts;
    // نص معوَّض لانعكاس fontkit الداخلي (راجع toPdfDrawableText) —
    // عرض القياس واحد لأن الانعكاس لا يغيّر مجموع المسافات.
    const drawable = toPdfDrawableText(logical);
    const w = this.widthOf(drawable, size);
    let drawX: number;
    if (align === "center") drawX = (A4_W - w) / 2;
    else if (align === "left") drawX = x ?? MARGIN;
    else drawX = (x ?? RIGHT) - w;
    this.page.drawText(drawable, { x: drawX, y, size, font: this.font, color });
    return w;
  }

  line(y: number, x1 = MARGIN, x2 = RIGHT, color = GOLD, thickness = 0.8) {
    this.page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness, color });
  }
}

// ─── توليد المستند ──────────────────────────────────────────────────────────

export async function buildEventReportPdf(data: ReportData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const fontBytes = await fs.readFile(FONT_PATH);
  // ملاحظة: subset:true يفسد الخريطة مع @pdf-lib/fontkit — ندمج الخط كاملًا
  const font = await doc.embedFont(fontBytes);
  doc.setTitle(`${data.brand} — كشف حساب فرحة ${data.hostName}`);
  doc.setAuthor(data.brand);
  doc.setCreationDate(data.issuedAt);

  // ── ١) الغلاف ──
  const cover = doc.addPage([A4_W, A4_H]);
  const pen = new Pen(cover, font);
  // إطار مزدوج
  cover.drawRectangle({ x: 24, y: 24, width: A4_W - 48, height: A4_H - 48, borderColor: GOLD, borderWidth: 2 });
  cover.drawRectangle({ x: 34, y: 34, width: A4_W - 68, height: A4_H - 68, borderColor: GOLD, borderWidth: 0.7 });

  pen.ar(data.brand, { y: A4_H - 170, size: 30, align: "center" });
  pen.line(A4_H - 200, A4_W / 2 - 110, A4_W / 2 + 110);
  pen.ar("كشف حساب النقوط الرسمي", { y: A4_H - 235, size: 14, align: "center", color: GRAY });

  pen.ar("فرحة", { y: A4_H - 330, size: 20, align: "center", color: GOLD });
  pen.ar(data.hostName, { y: A4_H - 375, size: 26, align: "center" });
  pen.ar(formatDateAr(data.eventDate), { y: A4_H - 412, size: 15, align: "center", color: GRAY });
  if (data.place) {
    pen.ar(data.place, { y: A4_H - 438, size: 13, align: "center", color: GRAY });
  }

  pen.line(240, A4_W / 2 - 130, A4_W / 2 + 130);
  pen.ar(`إجمالي النقوط: ${formatMoneyAr(data.grandTotal)} — عدد الأشخاص: ${data.personsCount}`, {
    y: 205,
    size: 12,
    align: "center",
  });
  pen.ar(`تاريخ الإصدار: ${formatDateAr(data.issuedAt)}`, { y: 168, size: 12, align: "center", color: GRAY });
  pen.ar(`مع تحيات ${data.brand}`, { y: 120, size: 15, align: "center" });

  // ── ٢) الفهرس (نحجزه الآن ونملؤه بعد معرفة صفحات المناطق) ──
  const indexPage = doc.addPage([A4_W, A4_H]);
  const indexPen = new Pen(indexPage, font);

  // ── ٣) صفحات المناطق ──
  const regionPageRefs = new Map<string, PDFRef[]>();
  const regionFirstPage = new Map<string, PDFPage>();

  for (const region of data.regions) {
    let page = doc.addPage([A4_W, A4_H]);
    regionFirstPage.set(region.region, page);
    regionPageRefs.set(region.region, [page.ref]);
    let p = new Pen(page, font);
    let y = A4_H - MARGIN - 6;

    const header = (title: string) => {
      p.ar(title, { y, size: 18 });
      y -= 26;
      p.line(y + 10);
      y -= 14;
    };
    header(`منطقة ${region.region} — ${region.persons.length} ${region.persons.length === 1 ? "شخص" : "أشخاص"} — إجمالي ${formatMoneyAr(region.totalAmount)}`);

    for (const person of region.persons) {
      const linesNeeded = 22 + Math.max(1, person.history.length) * 16 + 10;
      if (y - linesNeeded < MARGIN) {
        page = doc.addPage([A4_W, A4_H]);
        regionPageRefs.get(region.region)!.push(page.ref);
        p = new Pen(page, font);
        y = A4_H - MARGIN - 6;
        header(`تابع منطقة ${region.region}`);
      }

      const marker = person.editedAfterDone ? "  (اتعدلت بعد الفرحة)" : "";
      p.ar(`${person.name} — ${person.phone} — ${formatMoneyAr(person.amount)}${marker}`, {
        y,
        size: 13,
        color: person.editedAfterDone ? RED : INK,
      });
      y -= 18;

      if (person.history.length === 0) {
        p.ar("أول تعامل مسجل مع صاحب الفرح", { y, size: 10.5, color: GRAY });
        y -= 16;
      } else {
        p.ar("النقوط السابقة مع صاحب الفرح:", { y, size: 10.5, color: GRAY });
        y -= 15;
        for (const h of person.history) {
          for (const wrapped of wrapArabic(
            `• ${formatDateAr(h.date)} — ${h.label} — ${formatMoneyAr(h.amount)}`,
            A4_W - 2 * MARGIN - 24,
            (v) => p.widthOf(v, 10.5),
          )) {
            p.ar(wrapped, { y, size: 10.5, color: GRAY, x: RIGHT - 18 });
            y -= 14;
          }
        }
      }
      y -= 8;
    }
  }

  // ── ٣.٥) صفحة «مصروفات الشنطة» (تُتخطى لو مفيش مصروفات) ──
  // فلوس اتسلمت من الشنطة لصاحب الفرح أو أي حد من طرفه أثناء الفرح —
  // باسم المستلم ومين سلّمها من فريق الكاتب.
  let expensesFirstPage: PDFPage | null = null;
  if (data.expenses.length > 0) {
    const EXP_COLS = [
      { label: "المستلم", right: RIGHT },
      { label: "المبلغ", right: RIGHT - 190 },
      { label: "سلّمها", right: RIGHT - 285 },
      { label: "التاريخ", right: RIGHT - 395 },
    ] as const;
    let ePage = doc.addPage([A4_W, A4_H]);
    expensesFirstPage = ePage;
    let ep = new Pen(ePage, font);
    let ey = A4_H - MARGIN - 6;
    const eHeader = (title: string) => {
      ep.ar(title, { y: ey, size: 18 });
      ey -= 26;
      ep.line(ey + 10);
      ey -= 14;
      for (const col of EXP_COLS) {
        ep.ar(col.label, { y: ey, size: 11, color: GRAY, x: col.right });
      }
      ey -= 8;
      ep.line(ey + 4);
      ey -= 16;
    };
    eHeader(`مصروفات الشنطة — فرحة ${data.hostName}`);
    for (const ex of data.expenses) {
      if (ey - 20 < MARGIN + 40) {
        ePage = doc.addPage([A4_W, A4_H]);
        ep = new Pen(ePage, font);
        ey = A4_H - MARGIN - 6;
        eHeader(`تابع مصروفات الشنطة — فرحة ${data.hostName}`);
      }
      ep.ar(ex.receiverName, { y: ey, size: 12.5, x: EXP_COLS[0].right });
      ep.ar(formatMoneyAr(ex.amount), { y: ey, size: 12.5, x: EXP_COLS[1].right });
      ep.ar(ex.handedByName ?? "—", { y: ey, size: 12.5, x: EXP_COLS[2].right });
      ep.ar(formatDateAr(ex.date), { y: ey, size: 11.5, color: GRAY, x: EXP_COLS[3].right });
      ey -= 6;
      ep.line(ey, MARGIN, RIGHT, rgb(0.88, 0.85, 0.78), 0.4);
      ey -= 14;
      if (ex.note) {
        for (const wrapped of wrapArabic(`ملاحظة: ${ex.note}`, A4_W - 2 * MARGIN - 24, (v) => ep.widthOf(v, 10.5))) {
          ep.ar(wrapped, { y: ey, size: 10.5, color: GRAY, x: RIGHT - 18 });
          ey -= 14;
        }
      }
    }
    ey -= 8;
    ep.ar(`إجمالي المصروفات: ${formatMoneyAr(data.totalExpenses)} — عدد المصروفات: ${data.expenses.length}`, {
      y: ey,
      size: 13.5,
      color: RED,
    });
  }

  // ── ٤) الصفحة الأخيرة: «تجميع الشنطة» ──
  // جدول تجميعي لكل منطقة (أشخاص/نقوط/مبلغ) + صف إجمالي عام بارز
  // + صندوق مؤطر بإجمالي الشنطة كلها برقم كبير يليق بالغلاف.
  const summaryRows = data.regions.map((region) => ({
    region: region.region,
    personsCount: new Set(region.persons.map((pr) => `${pr.name}|${pr.phone}`)).size,
    nuqtatCount: region.persons.length,
    totalAmount: region.totalAmount,
  }));
  const totalNuqtat = summaryRows.reduce((s, r) => s + r.nuqtatCount, 0);

  const SUMMARY_COLS = [
    { label: "المنطقة", right: RIGHT },
    { label: "عدد الأشخاص", right: RIGHT - 200 },
    { label: "عدد النقوط", right: RIGHT - 295 },
    { label: "إجمالي المبلغ", right: RIGHT - 390 },
  ] as const;
  const SUMMARY_REGION_COL_W = 192;
  const SUMMARY_ROW_H = 22;
  const SUMMARY_BOX_H = 110;
  const LIGHT_LINE = rgb(0.88, 0.85, 0.78);
  const HIGHLIGHT_BG = rgb(0.96, 0.92, 0.81);

  let summaryPage = doc.addPage([A4_W, A4_H]);
  const summaryFirstPage = summaryPage;
  let sp = new Pen(summaryPage, font);
  let sy = A4_H - MARGIN - 16;

  const summaryFrame = (page: PDFPage) => {
    // نفس الإطار المزدوج الذهبي للغلاف — هوية رسمية موحدة
    page.drawRectangle({ x: 24, y: 24, width: A4_W - 48, height: A4_H - 48, borderColor: GOLD, borderWidth: 2 });
    page.drawRectangle({ x: 34, y: 34, width: A4_W - 68, height: A4_H - 68, borderColor: GOLD, borderWidth: 0.7 });
  };
  const summaryHeader = (title: string) => {
    sp.ar(title, { y: sy, size: 20 });
    sy -= 28;
    sp.line(sy + 12);
    sy -= 16;
    sp.ar(`ملخص كل المناطق — فرحة ${data.hostName}`, { y: sy, size: 12, color: GRAY });
    sy -= 30;
    for (const col of SUMMARY_COLS) {
      sp.ar(col.label, { y: sy, size: 11.5, color: GRAY, x: col.right });
    }
    sy -= 10;
    sp.line(sy + 4);
    sy -= 16;
  };
  const truncateToWidth = (text: string, size: number, maxW: number): string => {
    if (sp.widthOf(toPdfDrawableText(text), size) <= maxW) return text;
    let t = text;
    while (t.length > 1 && sp.widthOf(toPdfDrawableText(`${t}…`), size) > maxW) {
      t = t.slice(0, -1);
    }
    return `${t}…`;
  };
  const drawSummaryRow = (
    cells: string[],
    opts: { size?: number; color?: RGB; highlight?: boolean } = {},
  ) => {
    const size = opts.size ?? 12.5;
    // نحجز أسفل الصفحة مساحة صندوق الإجمالي الكلي
    if (sy - SUMMARY_ROW_H < MARGIN + 16 + SUMMARY_BOX_H + 22) {
      summaryPage = doc.addPage([A4_W, A4_H]);
      summaryFrame(summaryPage);
      sp = new Pen(summaryPage, font);
      sy = A4_H - MARGIN - 16;
      summaryHeader("تابع تجميع الشنطة");
    }
    if (opts.highlight) {
      summaryPage.drawRectangle({
        x: MARGIN - 6,
        y: sy - 6,
        width: RIGHT - MARGIN + 12,
        height: SUMMARY_ROW_H + 2,
        color: HIGHLIGHT_BG,
      });
    }
    cells.forEach((cell, i) => {
      const text = i === 0 ? truncateToWidth(cell, size, SUMMARY_REGION_COL_W) : cell;
      sp.ar(text, { y: sy, size, color: opts.color ?? INK, x: SUMMARY_COLS[i].right });
    });
    sp.line(sy - 6, MARGIN, RIGHT, opts.highlight ? GOLD : LIGHT_LINE, opts.highlight ? 0.9 : 0.4);
    sy -= SUMMARY_ROW_H;
  };

  summaryFrame(summaryPage);
  summaryHeader("تجميع الشنطة");

  for (const row of summaryRows) {
    drawSummaryRow([
      row.region,
      String(row.personsCount),
      String(row.nuqtatCount),
      formatMoneyAr(row.totalAmount),
    ]);
  }

  // صف الإجمالي العام — بارز بخلفية ذهبية فاتحة
  sy -= 6;
  drawSummaryRow(
    [
      "الإجمالي العام — كل المناطق",
      String(data.personsCount),
      String(totalNuqtat),
      formatMoneyAr(data.grandTotal),
    ],
    { size: 13.5, highlight: true },
  );

  // صف المصروفات (لو فيه) — بالحبر الأحمر
  if (data.totalExpenses > 0) {
    drawSummaryRow(
      [
        "مصروفات الشنطة",
        `${data.expenses.length} ${data.expenses.length === 1 ? "مصروف" : "مصروفات"}`,
        "—",
        `− ${formatMoneyAr(data.totalExpenses)}`,
      ],
      { size: 13, color: RED },
    );
  }

  // صندوق «إجمالي الشنطة كلها» + «صافي الشنطة» — الأرقام الرسمية الكبيرة
  const hasExpenses = data.totalExpenses > 0;
  const boxH = hasExpenses ? SUMMARY_BOX_H + 44 : SUMMARY_BOX_H;
  if (sy - 16 - boxH < 40) {
    summaryPage = doc.addPage([A4_W, A4_H]);
    summaryFrame(summaryPage);
    sp = new Pen(summaryPage, font);
    sy = A4_H - MARGIN - 40;
  }
  {
    const boxTop = sy - 16;
    const boxBottom = boxTop - boxH;
    const boxX1 = A4_W / 2 - 180;
    const boxX2 = A4_W / 2 + 180;
    summaryPage.drawRectangle({ x: boxX1, y: boxBottom, width: boxX2 - boxX1, height: boxH, borderColor: GOLD, borderWidth: 1.8 });
    summaryPage.drawRectangle({ x: boxX1 + 6, y: boxBottom + 6, width: boxX2 - boxX1 - 12, height: boxH - 12, borderColor: GOLD, borderWidth: 0.6 });
    sp.ar("إجمالي الشنطة كلها", { y: boxTop - 34, size: 14, align: "center", color: GRAY });
    sp.ar(formatMoneyAr(data.grandTotal), { y: boxTop - 72, size: 26, align: "center" });
    sp.ar(`إجمالي المهنئين: ${data.personsCount} — عدد النقوط: ${totalNuqtat}`, {
      y: boxTop - 94,
      size: 11.5,
      align: "center",
      color: GRAY,
    });
    if (hasExpenses) {
      sp.ar(`إجمالي المصروفات: − ${formatMoneyAr(data.totalExpenses)}`, {
        y: boxTop - 116,
        size: 12.5,
        align: "center",
        color: RED,
      });
      sp.line(boxTop - 126, boxX1 + 30, boxX2 - 30, GOLD, 0.6);
      sp.ar("صافي الشنطة", { y: boxTop - 148, size: 13, align: "center", color: GRAY });
      sp.ar(formatMoneyAr(data.netTotal), { y: boxTop - 182, size: 24, align: "center" });
    }
  }

  // ملء الفهرس بعد اكتمال صفحات المناطق
  let ledgerStatusPage: PDFPage | null = null;
  let ledgerStatusFirstPage: PDFPage | null = null;
  const statusGroups: ReadonlyArray<{ title: string; rows: ReportLedgerPerson[]; color: RGB }> = [
    { title: "اللي عليهم نقطة سابقة ومحضروش", rows: data.previousNonAttendees ?? [], color: GRAY },
    { title: "اللي دفعوا أقل من المتوقع", rows: data.underpaid ?? [], color: RED },
    { title: "اللي صفّوا حسابهم", rows: data.settled ?? [], color: GOLD },
    { title: "الأرصدة المفتوحة", rows: data.outstanding ?? [], color: RED },
  ];
  if (statusGroups.some((group) => group.rows.length > 0)) {
    ledgerStatusPage = doc.addPage([A4_W, A4_H]);
    ledgerStatusFirstPage = ledgerStatusPage;
    let lp = new Pen(ledgerStatusPage, font);
    let ly = A4_H - MARGIN - 16;
    lp.ar("حالات الدفتر التاريخية", { y: ly, size: 20 });
    ly -= 32;
    lp.line(ly + 12);
    ly -= 18;
    for (const group of statusGroups) {
      if (group.rows.length === 0) continue;
      lp.ar(`${group.title} (${group.rows.length})`, { y: ly, size: 14, color: group.color });
      ly -= 24;
      for (const row of group.rows) {
        if (ly < MARGIN + 24) {
          ledgerStatusPage = doc.addPage([A4_W, A4_H]);
          lp = new Pen(ledgerStatusPage, font);
          ly = A4_H - MARGIN - 30;
        }
        const amounts = row.remainingAmount > 0 ? ` — باقي ${formatMoneyAr(row.remainingAmount)}` : "";
        lp.ar(`${row.name} — ${row.phone} — السابق ${formatMoneyAr(row.previousAmount)} — الحالي ${formatMoneyAr(row.currentAmount)}${amounts}`, {
          y: ly,
          size: 10.5,
        });
        ly -= 18;
      }
      ly -= 12;
    }
  }

  {
    const p = indexPen;
    let y = A4_H - MARGIN - 10;
    p.ar("الفهرس — المناطق", { y, size: 20 });
    y -= 30;
    p.line(y + 12);
    y -= 16;
    p.ar(`اضغط على أي منطقة للانتقال لصفحتها`, { y, size: 11, color: GRAY });
    y -= 28;

    const pages = doc.getPages();
    for (const region of data.regions) {
      if (y < MARGIN + 30) break;
      const target = regionFirstPage.get(region.region)!;
      const pageNumber = pages.indexOf(target) + 1;
      const label = `${region.region} — ${region.persons.length} ${region.persons.length === 1 ? "شخص" : "أشخاص"} — ${formatMoneyAr(region.totalAmount)}`;
      const w = p.ar(label, { y, size: 13 });
      p.ar(`ص ${pageNumber}`, { y, size: 11, color: GRAY, align: "left" });
      // رابط داخلي لصفحة المنطقة
      const annot = doc.context.obj({
        Type: "Annot",
        Subtype: "Link",
        Rect: [RIGHT - w - 6, y - 4, RIGHT + 2, y + 16],
        Border: [0, 0, 0],
        Dest: [target.ref, "XYZ", null, null, null],
      });
      const annotRef = doc.context.register(annot);
      indexPage.node.addAnnot(annotRef as PDFRef);
      y -= 26;
    }

    // مدخل صفحة «مصروفات الشنطة» (لو موجودة)
    if (expensesFirstPage && y >= MARGIN + 30) {
      const pageNumber = pages.indexOf(expensesFirstPage) + 1;
      const label = `مصروفات الشنطة — ${data.expenses.length} ${data.expenses.length === 1 ? "مصروف" : "مصروفات"} — ${formatMoneyAr(data.totalExpenses)}`;
      const w = p.ar(label, { y, size: 13 });
      p.ar(`ص ${pageNumber}`, { y, size: 11, color: GRAY, align: "left" });
      const annot = doc.context.obj({
        Type: "Annot",
        Subtype: "Link",
        Rect: [RIGHT - w - 6, y - 4, RIGHT + 2, y + 16],
        Border: [0, 0, 0],
        Dest: [expensesFirstPage.ref, "XYZ", null, null, null],
      });
      const annotRef = doc.context.register(annot);
      indexPage.node.addAnnot(annotRef as PDFRef);
      y -= 26;
    }

    // مدخل الصفحة الأخيرة «تجميع الشنطة» — رابط داخلي مثل باقي المناطق
    if (ledgerStatusFirstPage && y >= MARGIN + 30) {
      const pageNumber = pages.indexOf(ledgerStatusFirstPage) + 1;
      const label = "حالات الدفتر التاريخية";
      const w = p.ar(label, { y, size: 13 });
      p.ar(`ص ${pageNumber}`, { y, size: 11, color: GRAY, align: "left" });
      const annot = doc.context.obj({
        Type: "Annot",
        Subtype: "Link",
        Rect: [RIGHT - w - 6, y - 4, RIGHT + 2, y + 16],
        Border: [0, 0, 0],
        Dest: [ledgerStatusFirstPage.ref, "XYZ", null, null, null],
      });
      const annotRef = doc.context.register(annot);
      indexPage.node.addAnnot(annotRef as PDFRef);
      y -= 26;
    }

    if (y >= MARGIN + 30) {
      const pageNumber = pages.indexOf(summaryFirstPage) + 1;
      const label = `تجميع الشنطة — الملخص الكلي — ${formatMoneyAr(data.grandTotal)}`;
      const w = p.ar(label, { y, size: 13 });
      p.ar(`ص ${pageNumber}`, { y, size: 11, color: GRAY, align: "left" });
      const annot = doc.context.obj({
        Type: "Annot",
        Subtype: "Link",
        Rect: [RIGHT - w - 6, y - 4, RIGHT + 2, y + 16],
        Border: [0, 0, 0],
        Dest: [summaryFirstPage.ref, "XYZ", null, null, null],
      });
      const annotRef = doc.context.register(annot);
      indexPage.node.addAnnot(annotRef as PDFRef);
      y -= 26;
    }

    y -= 10;
    p.line(y + 14);
    p.ar(`الإجمالي الكلي: ${formatMoneyAr(data.grandTotal)} — ${data.personsCount} ${data.personsCount === 1 ? "شخص" : "أشخاص"}`, {
      y: y - 8,
      size: 12,
    });
  }

  return doc.save();
}

// ─── التوليد الكامل مع التخزين ──────────────────────────────────────────────

export async function generateEventReport(
  tenantId: number,
  eventId: number,
): Promise<Report> {
  const data = await buildReportData(tenantId, eventId);
  const row = await createReportRow({ tenantId, eventId, fileUrl: "" });
  try {
    const bytes = await buildEventReportPdf(data);
    await fs.writeFile(reportFilePath(row.id), bytes);
  } catch (err) {
    // لا نترك سجلًا يتيمًا بدون ملف — نحذف الصف ونرمي الخطأ برسالة واضحة
    console.error("[reports] فشل كتابة ملف التقرير:", reportFilePath(row.id), err);
    await deleteReportRow(row.id).catch(() => {});
    throw err;
  }
  const fileUrl = `/api/reports/file/${row.id}`;
  await updateReportFileUrl(row.id, fileUrl);
  return { ...row, fileUrl };
}
