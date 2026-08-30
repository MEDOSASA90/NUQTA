import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password.js";

describe("local password authentication", () => {
  it("hashes and verifies passwords without storing plaintext", () => {
    const password = "Admin@12345";
    const encoded = hashPassword(password);
    expect(encoded).not.toContain(password);
    expect(verifyPassword(password, encoded)).toBe(true);
    expect(verifyPassword("wrong-password", encoded)).toBe(false);
  });
});
