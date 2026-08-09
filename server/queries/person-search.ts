/**
 * بحث الأشخاص — منطق نقي قابل للاختبار.
 * يطابق الاسم (بعد التطبيع العربي) ورقم التليفون والمنطقة،
 * ويرتّب النتائج ويعدّ المتشابهين بالاسم لتمييزهم في الواجهة.
 */

/** تطبيع نص عربي للبحث (مرآة src/lib/format.ts#normalizeArabic) */
export function normalizeArabic(s: string): string {
  return s
    .replace(/[ً-ٟ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .trim();
}

/** تطبيع رقم تليفون مصري للمقارنة: أرقام فقط، +20/0020/20 → صيغة محلية 01… */
export function normalizePhone(s: string): string {
  let d = s.replace(/\D/g, "");
  if (d.startsWith("0020")) d = d.slice(4);
  else if (d.startsWith("20") && d.length > 10) d = d.slice(2);
  if (d.length === 10 && d.startsWith("1")) d = `0${d}`;
  return d;
}

export type SearchablePerson = {
  id: number;
  name: string;
  phone: string;
  region: string;
  nuqtaId?: string | null;
};

export type RankedPerson<T extends SearchablePerson> = T & {
  matchedOn: "name" | "phone" | "region" | "nuqtaId";
  sameNameCount: number;
  score: number;
};

/**
 * يبحث ويرتّب: تطابق كامل للاسم أولًا، ثم بداية الاسم، ثم احتواء، ثم تليفون/منطقة.
 * sameNameCount = عدد الأشخاص الآخرين بنفس الاسم المطبع (للتنبيه «3 أشخاص بنفس الاسم»).
 */
export function searchPersons<T extends SearchablePerson>(
  persons: T[],
  query: string,
  limit = 20,
): RankedPerson<T>[] {
  const q = query.trim();
  if (!q) return [];
  const nq = normalizeArabic(q);
  const digits = q.replace(/\D/g, "");

  // عدّ الأسماء المتشابهة (بعد التطبيع) داخل الشبكة
  const nameCounts = new Map<string, number>();
  for (const p of persons) {
    const key = normalizeArabic(p.name);
    nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
  }

  const scored: RankedPerson<T>[] = [];
  for (const p of persons) {
    const name = normalizeArabic(p.name);
    const phone = normalizePhone(p.phone);
    const region = normalizeArabic(p.region);
    let matchedOn: "name" | "phone" | "region" | "nuqtaId" | null = null;
    let score = 0;

    if (p.nuqtaId && p.nuqtaId.toLowerCase() === q.toLowerCase()) {
      matchedOn = "nuqtaId";
      score = 120;
    } else if (name === nq) {
      matchedOn = "name";
      score = 100;
    } else if (name.startsWith(nq)) {
      matchedOn = "name";
      score = 80;
    } else if (name.includes(nq)) {
      matchedOn = "name";
      score = 60;
    } else if (digits.length >= 2 && phone.includes(digits)) {
      matchedOn = "phone";
      score = 50;
    } else if (region.includes(nq)) {
      matchedOn = "region";
      score = 40;
    }

    if (!matchedOn) continue;
    const sameNameCount = (nameCounts.get(name) ?? 1) - 1;
    scored.push({ ...p, matchedOn, sameNameCount, score });
  }

  return scored
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "ar"))
    .slice(0, limit);
}
