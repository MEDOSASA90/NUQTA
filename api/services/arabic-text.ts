/**
 * تشكيل النص العربي للـ PDF: reshape (arabic-reshaper) ثم إعادة ترتيب
 * bidi (bidi-js) — الناتج نص «بصري» يُرسم من اليسار لليمين ويظهر عربيًا سليمًا.
 * 
 */
// ملاحظة: نسمّي الاستيراد باسم مغاير (`createModuleRequire`) لأن بانر بناء
// esbuild (package.json › build) يعرّف `createRequire` في أعلى الحزمة —
// الاسم المتطابق كان يكسر dist/boot.js كليًا بخطأ «already been declared».
// استيراد ساكن ليُضمّنه esbuild داخل dist/boot.js — require() الديناميكي كان
// يفشل على خادم الإنتاج (MODULE_NOT_FOUND) لأن الحزمة تُشغَّل بلا node_modules كامل.
// @ts-expect-error — بلا تعريفات TypeScript
import arabicReshaper from "arabic-reshaper";
// @ts-expect-error — بلا تعريفات TypeScript
import bidiFactory from "bidi-js";

type BidiParagraph = { start: number; end: number; level: number };
type EmbeddingLevelsResult = { levels: Uint8Array; paragraphs: BidiParagraph[] };
type Bidi = {
  getEmbeddingLevels(
    text: string,
    baseDirection?: "ltr" | "rtl" | "auto",
  ): EmbeddingLevelsResult;
  getReorderedString(
    text: string,
    embeddingLevelsResult: EmbeddingLevelsResult,
    start?: number,
    end?: number,
  ): string;
};

const reshaper = arabicReshaper as {
  convertArabic(text: string): string;
};
const bidi = (bidiFactory as () => Bidi)();

/** يحوّل نصًا عربيًا منطقي الترتيب إلى بصري جاهز للرسم */
export function toVisualArabic(logical: string): string {
  if (!logical) return "";
  const reshaped = reshaper.convertArabic(logical);
  const levels = bidi.getEmbeddingLevels(reshaped, "auto");
  return bidi.getReorderedString(reshaped, levels);
}

// نطاقات Unicode للعربية: كتل الأساسية + الصور العرضية (Presentation Forms)
// — نستخدم escapes صريحة لأن المحارف الحرفية للنطاقات سهلة الالتباس بصريًا.
const HAS_ARABIC_RE = new RegExp("[\\u0600-\\u06FF\\uFB50-\\uFEFF]");

/**
 * نص جاهز للرسم عبر pdf-lib: مكتبة pdf-lib تمرّر النص داخليًا عبر
 * fontkit.layout الذي يطبّق bidi بدائيًا يعكس أي سلسلة تحوي أحرفًا عربية
 * بالكامل — بما فيها مقاطع الأرقام اللاتينية (كانت السنة تظهر 6202 بدل
 * 2026، والمبالغ 057,15 بدل 15,750). نعكس النص البصري هنا مسبقًا ليتعادل
 * الانعكاسان فيظهر العرض النهائي بالترتيب الصحيح. النص اللاتيني الخالص
 * لا يعكسه fontkit فيُعاد كما هو.
 */
export function toPdfDrawableText(logical: string): string {
  const visual = toVisualArabic(logical);
  if (!HAS_ARABIC_RE.test(visual)) return visual;
  return [...visual].reverse().join("");
}

/** يلف نصًا طويلًا إلى أسطر بحد أقصى لعرض البكسل (يُقاس بعد التشكيل) */
export function wrapArabic(
  logical: string,
  maxWidth: number,
  measure: (visual: string) => number,
): string[] {
  const words = logical.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (measure(toVisualArabic(candidate)) <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}
