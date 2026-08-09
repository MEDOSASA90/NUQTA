import { describe, expect, it } from "vitest";
import { assertEventTransition, canRecordNuqta, hasPermission } from "./lifecycle";

describe("event lifecycle", () => {
  it("allows only the ordered lifecycle", () => {
    expect(() => assertEventTransition("draft", "scheduled")).not.toThrow();
    expect(() => assertEventTransition("draft", "live")).toThrow();
    expect(canRecordNuqta("live")).toBe(true);
    expect(canRecordNuqta("scheduled")).toBe(false);
  });

  it("enforces team permissions", () => {
    expect(hasPermission("team", ["record"], "record")).toBe(true);
    expect(hasPermission("team", ["record"], "edit")).toBe(false);
    expect(hasPermission("host", [], "reports")).toBe(false);
  });
});

