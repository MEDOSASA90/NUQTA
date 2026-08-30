import { expect, test } from "@playwright/test";

test("admin can authenticate and reach the live recording workspace", async ({ page }) => {
  page.on("pageerror", (error) => console.log(`PAGE_ERROR: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") console.log(`CONSOLE_ERROR: ${message.text()}`);
  });
  await page.goto("/login");
  await page.getByLabel("البريد الإلكتروني").fill("admin@nuqta.local");
  await page.getByLabel("كلمة المرور").fill("Admin@12345");
  await page.getByRole("button", { name: "تسجيل الدخول" }).click();

  await expect(page).toHaveURL(/\/$/, { timeout: 20_000 });
  await expect(page.getByRole("heading").first()).toBeVisible();

  await page.goto("/nuqta/new");
  await expect(page).toHaveURL(/\/nuqta\/new$/);
  await expect(page.getByText(/تسجيل نقطة|مفيش أفراح/).first()).toBeVisible();
});

test("versioned REST contract is reachable after login", async ({ request }) => {
  const login = await request.post("/api/v1/auth/login", {
    data: { email: "admin@nuqta.local", password: "Admin@12345" },
  });
  expect(login.ok()).toBeTruthy();
  const openapi = await request.get("/api/v1/openapi.json");
  expect(openapi.ok()).toBeTruthy();
  const document = (await openapi.json()) as { openapi: string; paths: Record<string, unknown> };
  expect(document.openapi).toBe("3.0.3");
  expect(document.paths["/contributions"]).toBeDefined();
});
