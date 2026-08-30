import { normalizeArabicText } from "./identity.js";

export function canonicalRegionName(value: string): string {
  const name = normalizeArabicText(value);
  if (name.length < 2 || name.length > 100) throw new Error("Invalid region name");
  return name;
}

export function regionKey(value: string): string {
  return canonicalRegionName(value).toLocaleLowerCase("ar-EG");
}

