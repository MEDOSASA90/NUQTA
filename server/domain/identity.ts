import { createHash, randomBytes } from "node:crypto";
import type { PersonIdentity } from "./types";

export function normalizePhoneNumber(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("0020")) digits = digits.slice(4);
  else if (digits.startsWith("20") && digits.length > 10) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith("1")) digits = `0${digits}`;
  return digits;
}

export function normalizeArabicText(value: string): string {
  return value
    .trim()
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[\u0622\u0623\u0625]/g, "\u0627")
    .replace(/\u0629/g, "\u0647")
    .replace(/\u0649/g, "\u064A")
    .replace(/\s+/g, " ");
}

export function createNuqtaId(): string {
  const entropy = randomBytes(8).toString("hex").toUpperCase();
  return `NQ-${entropy}`;
}

export function identityFingerprint(name: string, phone: string, region: string): string {
  const normalized = [normalizeArabicText(name), normalizePhoneNumber(phone), normalizeArabicText(region)].join("|");
  return createHash("sha256").update(normalized).digest("hex");
}

export function sameIdentity(left: PersonIdentity, right: PersonIdentity): boolean {
  const leftPhone = normalizePhoneNumber(left.phone);
  const rightPhone = normalizePhoneNumber(right.phone);
  const sameNuqtaId = left.nuqtaId !== null && left.nuqtaId === right.nuqtaId;
  const sameVerifiedPhone = left.phoneVerified && right.phoneVerified && leftPhone !== "" && leftPhone === rightPhone;
  return sameNuqtaId || sameVerifiedPhone;
}
