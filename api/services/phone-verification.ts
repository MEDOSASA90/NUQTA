import { createHash, randomInt } from "node:crypto";

const CODE_LENGTH = 6;
const MAX_ATTEMPTS = 5;
const TTL_MS = 10 * 60 * 1000;

export function createVerificationCode(): string {
  return String(randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, "0");
}

export function hashVerificationCode(challengeId: number, code: string): string {
  return createHash("sha256")
    .update(`${challengeId}:${code}:${process.env.PHONE_OTP_SECRET ?? "nuqta-development-secret"}`)
    .digest("hex");
}

export function verificationExpiresAt(now: Date = new Date()): Date {
  return new Date(now.getTime() + TTL_MS);
}

export function canAttemptVerification(
  expiresAt: Date,
  attempts: number,
  consumedAt: Date | null,
  now: Date = new Date(),
): boolean {
  return consumedAt === null && attempts < MAX_ATTEMPTS && expiresAt.getTime() > now.getTime();
}

