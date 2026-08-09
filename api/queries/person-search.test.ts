import { describe, expect, it } from "vitest";
import { normalizeArabic, normalizePhone, searchPersons } from "./person-search";

const persons = [
  { id: 1, name: "محمد عبد الله السيد", phone: "01002345678", region: "المنصورة" },
  { id: 2, name: "محمد عبد الله", phone: "01112223334", region: "طلخا" },
  { id: 3, name: "محمد عبد الله", phone: "01223334445", region: "ميت غمر" },
  { id: 4, name: "أحمد عمر", phone: "01098765432", region: "المنصورة" },
  { id: 5, name: "خالد سمير عبد العزيز", phone: "01555566677", region: "بلقاس" },
];

describe("normalizeArabic / normalizePhone", () => {
  it("يطبع الحروف العربية", () => {
    expect(normalizeArabic("أحمد إبراهيم")).toBe("احمد ابراهيم");
    expect(normalizeArabic("فاطمة")).toBe("فاطمه");
    expect(normalizeArabic("على")).toBe("علي");
  });
  it("يطبع التليفون المصري", () => {
    expect(normalizePhone("+20 100 234 5678")).toBe("01002345678");
    expect(normalizePhone("00201002345678")).toBe("01002345678");
    expect(normalizePhone("1002345678")).toBe("01002345678");
    expect(normalizePhone("0100 234 5678")).toBe("01002345678");
  });
});

describe("searchPersons", () => {
  it("يطابق بالاسم الجزئي ويميّز المتشابهين", () => {
    const res = searchPersons(persons, "محمد عبد الله");
    expect(res.length).toBe(3);
    const exact = res.filter((r) => r.name === "محمد عبد الله");
    expect(exact.every((r) => r.sameNameCount === 1)).toBe(true);
    // التطابق الكامل قبل البادئة
    expect(res[0].score).toBeGreaterThanOrEqual(res[1].score);
  });

  it("يطابق التليفون بجزء من الرقم", () => {
    const res = searchPersons(persons, "0111");
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe(2);
    expect(res[0].matchedOn).toBe("phone");
  });

  it("يطابق المنطقة", () => {
    const res = searchPersons(persons, "بلقاس");
    expect(res).toHaveLength(1);
    expect(res[0].matchedOn).toBe("region");
  });

  it("يتجاهل اختلاف الهمزات والتاء المربوطة", () => {
    const res = searchPersons(persons, "احمد عمر");
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe(4);
  });

  it("يرجع فارغًا لاستعلام فارغ أو بلا نتائج", () => {
    expect(searchPersons(persons, "  ")).toHaveLength(0);
    expect(searchPersons(persons, "زوزو")).toHaveLength(0);
  });
});
