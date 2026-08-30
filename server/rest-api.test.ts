import { describe, expect, it } from "vitest";
import { openApiDocument } from "./rest-api.js";

describe("versioned REST API contract", () => {
  it("publishes the documented authentication and ledger endpoints", () => {
    const document = openApiDocument();
    expect(document.openapi).toBe("3.0.3");
    expect(document.paths["/auth/login"]).toBeDefined();
    expect(document.paths["/events"]).toBeDefined();
    expect(document.paths["/persons"]).toBeDefined();
    expect(document.paths["/contributions"]).toBeDefined();
  });
});
