import { describe, expect, it } from "vitest";
import { PDFArray, PDFDict, PDFDocument, PDFName } from "pdf-lib";
import { buildEventReportPdf, type ReportData } from "./report-pdf.js";

const sample: ReportData = {
  brand: "أحمد عمر للأفراح",
  hostName: "كريم سامي الجندي",
  eventDate: new Date(2026, 5, 22),
  place: "قاعة النيل — المنصورة",
  issuedAt: new Date(2026, 5, 23),
  grandTotal: 68500,
  personsCount: 3,
  expenses: [],
  totalExpenses: 0,
  netTotal: 68500,
  regions: [
    {
      region: "المنصورة",
      totalAmount: 4500,
      persons: [
        {
          name: "محمد عبد الله السيد",
          phone: "01002345678",
          amount: 2500,
          editedAfterDone: true,
          history: [
            { date: new Date(2025, 9, 12), amount: 1000, label: "دفع في فرحة كريم سامي الجندي" },
            { date: new Date(2024, 3, 2), amount: 500, label: "كريم سامي الجندي دفع في فرحته" },
          ],
        },
        {
          name: "خالد سمير عبد العزيز",
          phone: "01112223334",
          amount: 2000,
          editedAfterDone: false,
          history: [],
        },
      ],
    },
    {
      region: "طلخا",
      totalAmount: 3000,
      persons: [
        {
          name: "مصطفى كامل",
          phone: "01223334445",
          amount: 3000,
          editedAfterDone: false,
          history: [
            { date: new Date(2025, 0, 5), amount: 700, label: "دفع في فرحة كريم سامي الجندي" },
          ],
        },
      ],
    },
  ],
};

describe("توليد تقرير PDF", () => {
  it("يولّد PDF صالح بغلاف وفهرس وصفحات مناطق وروابط داخلية", async () => {
    const bytes = await buildEventReportPdf(sample);
    expect(bytes.length).toBeGreaterThan(5000);

    const doc = await PDFDocument.load(bytes);
    // غلاف + فهرس + منطقتان + صفحة تجميع الشنطة = 5 صفحات
    expect(doc.getPageCount()).toBe(5);

    // تحقق من وجود روابط داخلية في الفهرس (منطقتان + صفحة التجميع)
    const indexPage = doc.getPage(1);
    const annots = indexPage.node.Annots();
    expect(annots).toBeDefined();
    expect(annots!.size()).toBeGreaterThanOrEqual(3);
  });

  it("يضيف صفحة أخيرة «تجميع الشنطة» مربوطة من الفهرس", async () => {
    const bytes = await buildEventReportPdf(sample);
    const doc = await PDFDocument.load(bytes);

    const lastPageRef = doc.getPage(doc.getPageCount() - 1).ref;
    const indexAnnots = doc.getPage(1).node.Annots();
    expect(indexAnnots).toBeDefined();

    // آخر رابط في الفهرس يشير للصفحة الأخيرة (صفحة التجميع)
    const lastAnnotRef = indexAnnots!.get(indexAnnots!.size() - 1);
    const annot = doc.context.lookup(lastAnnotRef);
    expect(annot).toBeInstanceOf(PDFDict);
    const dest = (annot as PDFDict).get(PDFName.of("Dest"));
    expect(dest).toBeInstanceOf(PDFArray);
    expect(String((dest as PDFArray).get(0))).toBe(String(lastPageRef));
  });

  it("يبني صفحة التجميع حتى بلا مناطق (فرحة بلا نقوط)", async () => {
    const empty: ReportData = { ...sample, grandTotal: 0, personsCount: 0, regions: [] };
    const bytes = await buildEventReportPdf(empty);
    const doc = await PDFDocument.load(bytes);
    // غلاف + فهرس + صفحة تجميع = 3 صفحات
    expect(doc.getPageCount()).toBe(3);
  });

  it("يضيف صفحة «مصروفات الشنطة» عند وجود مصروفات ويربطها من الفهرس", async () => {
    const withExpenses: ReportData = {
      ...sample,
      expenses: [
        { receiverName: "كريم سامي الجندي", amount: 10000, handedByName: "أحمد عمر", date: new Date(2026, 5, 22), note: "دفعة لتجهيز القاعة" },
        { receiverName: "أم العريس", amount: 5000, handedByName: "محمود", date: new Date(2026, 5, 22), note: null },
      ],
      totalExpenses: 15000,
      netTotal: 53500,
    };
    const bytes = await buildEventReportPdf(withExpenses);
    const doc = await PDFDocument.load(bytes);
    // غلاف + فهرس + منطقتان + مصروفات + تجميع = 6 صفحات
    expect(doc.getPageCount()).toBe(6);
    // الفهرس فيه روابط: منطقتان + مصروفات + تجميع
    const annots = doc.getPage(1).node.Annots();
    expect(annots).toBeDefined();
    expect(annots!.size()).toBeGreaterThanOrEqual(4);
  });

  it("يتخطى صفحة المصروفات تمامًا بلا مصروفات", async () => {
    const bytes = await buildEventReportPdf(sample);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(5);
  });
});
