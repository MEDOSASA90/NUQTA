import { promises as fs } from "fs";
import path from "path";
import fontkit from "@pdf-lib/fontkit";
import { describe, expect, it } from "vitest";
import { toPdfDrawableText, toVisualArabic, wrapArabic } from "./arabic-text";

/**
 * يحاكي ما تفعله pdf-lib بالضبط عند drawText:
 * CustomFontEmbedder.encodeText تستدعي font.layout(text) وتكتب معرّفات
 * الـ glyphs بترتيبها — نفكّها عبر cmap العكسي لنحصل على السلسلة المعروضة
 * فعليًا (glyph.codePoints لا يعكس ترتيب العرض النهائي).
 */
async function renderedByPdfLib(text: string): Promise<string> {
  const fontBytes = await fs.readFile(
    path.resolve(process.cwd(), "server/assets/fonts/Amiri-Regular.ttf"),
  );
  const font = await fontkit.create(fontBytes);
  const idToChar = new Map<number, string>();
  for (const cp of font.characterSet) {
    const glyph = font.glyphForCodePoint(cp);
    if (!idToChar.has(glyph.id)) idToChar.set(glyph.id, String.fromCodePoint(cp));
  }
  const run = font.layout(text);
  return run.glyphs.map((g) => idToChar.get(g.id) ?? "�").join("");
}

describe("toPdfDrawableText — تعويض انعكاس fontkit", () => {
  it("تُبقي الأرقام اللاتينية بترتيبها الصحيح داخل نص عربي", async () => {
    const rendered = await renderedByPdfLib(toPdfDrawableText("3 يونيو 2026"));
    expect(rendered).toContain("2026");
    expect(rendered).not.toContain("6202");
  });

  it("تُبقي المبالغ المنسقة والأعداد دون قلب", async () => {
    const rendered = await renderedByPdfLib(
      toPdfDrawableText("إجمالي النقوط: 15,750 ج.م — عدد الأشخاص: 40"),
    );
    expect(rendered).toContain("15,750");
    // الترتيب البصري يبدأ بعدد الأشخاص: «40» لا «04»
    expect(rendered.startsWith("40 ")).toBe(true);
    expect(rendered).not.toContain("057,15");
  });

  it("تُبقي أرقام التليفون داخل سطور الأشخاص", async () => {
    const rendered = await renderedByPdfLib(
      toPdfDrawableText("كريم سامي الجندي — 01002345678 — 2,500 ج.م"),
    );
    expect(rendered).toContain("01002345678");
    expect(rendered).toContain("2,500");
  });

  it("النص اللاتيني الخالص يمر كما هو", () => {
    expect(toPdfDrawableText("2026")).toBe("2026");
  });

  it("النص البصري الخام ما زال متاحًا للقياس", () => {
    // wrapArabic يعتمد على toVisualArabic للقياس — يجب ألا يتغير سلوكه
    const visual = toVisualArabic("أحمد عمر للأفراح");
    expect(visual.length).toBeGreaterThan(0);
    const lines = wrapArabic("سطر عربي طويل للاختبار", 1000, (v) => v.length * 10);
    expect(lines).toEqual(["سطر عربي طويل للاختبار"]);
  });
});
