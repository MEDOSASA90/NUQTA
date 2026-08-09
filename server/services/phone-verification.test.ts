import { describe, expect, it } from "vitest";
import { canAttemptVerification, createVerificationCode, verificationExpiresAt } from "./phone-verification";

describe("phone verification", () => {
  it("creates six digit codes and expires them", () => {
    expect(createVerificationCode()).toMatch(/^\d{6}$/);
    const now = new Date("2026-01-01T00:00:00Z");
    expect(verificationExpiresAt(now).getTime() - now.getTime()).toBe(600000);
  });

  it("blocks expired, consumed, and exhausted challenges", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const expired = new Date(now.getTime() - 1);
    expect(canAttemptVerification(expired, 0, null, now)).toBe(false);
    expect(canAttemptVerification(new Date(now.getTime() + 1000), 0, new Date(), now)).toBe(false);
    expect(canAttemptVerification(new Date(now.getTime() + 1000), 5, null, now)).toBe(false);
  });
});

