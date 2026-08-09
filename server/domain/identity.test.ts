import { describe, expect, it } from "vitest";
import { createNuqtaId, normalizePhoneNumber, sameIdentity } from "./identity";

describe("central identity", () => {
  it("normalizes Egyptian phone numbers", () => {
    expect(normalizePhoneNumber("+20 100 123 4567")).toBe("01001234567");
    expect(normalizePhoneNumber("01001234567")).toBe("01001234567");
  });

  it("creates stable-looking NUQTA IDs", () => {
    expect(createNuqtaId()).toMatch(/^NQ-[A-F0-9]{16}$/);
  });

  it("matches the same person by central id or verified phone", () => {
    const first = { nuqtaId: "NQ-ABC", name: "أحمد", phone: "01001234567", regionId: null, regionName: "", phoneVerified: true };
    const second = { nuqtaId: "NQ-XYZ", name: "أحمد عمر", phone: "+20 100 123 4567", regionId: null, regionName: "", phoneVerified: true };
    expect(sameIdentity(first, second)).toBe(true);
  });

  it("does not match two unlinked people just because both IDs are missing", () => {
    const first = { nuqtaId: null, name: "A", phone: "", regionId: null, regionName: "", phoneVerified: false };
    const second = { nuqtaId: null, name: "B", phone: "", regionId: null, regionName: "", phoneVerified: false };
    expect(sameIdentity(first, second)).toBe(false);
  });
});
