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

test("full ledger flow reaches a consistent report", async ({ request }) => {
  test.skip(process.env.E2E_FULL_FLOW !== "true", "Requires a disposable E2E database");
  const login = await request.post("/api/v1/auth/login", {
    data: { email: "admin@nuqta.local", password: "Admin@12345" },
  });
  expect(login.ok()).toBeTruthy();

  const eventResponse = await request.post("/api/v1/events", {
    data: { hostName: `اختبار ${Date.now()}`, eventDate: "2030-01-01T18:00:00.000Z", place: "اختبار" },
  });
  expect(eventResponse.ok()).toBeTruthy();
  const event = (await eventResponse.json()) as { id: number };

  const personResponse = await request.post("/api/v1/persons", {
    data: { name: "شخص اختبار", phone: `010${String(Date.now()).slice(-8)}`, region: "المعادي" },
  });
  expect(personResponse.ok()).toBeTruthy();
  const person = (await personResponse.json()) as { id: number };

  for (const state of ["scheduled", "live"] as const) {
    const transition = await request.post(`/api/v1/events/${event.id}/transition`, { data: { to: state } });
    expect(transition.ok()).toBeTruthy();
  }

  const contribution = await request.post("/api/v1/contributions", {
    data: { eventId: event.id, payerPersonId: person.id, amount: 1500 },
  });
  expect(contribution.ok()).toBeTruthy();

  const events = await request.get("/api/v1/events?filter=open");
  expect(events.ok()).toBeTruthy();
  const liveEvents = (await events.json()) as Array<{ id: number; totalAmount: number; nuqtatCount: number }>;
  const liveEvent = liveEvents.find((item) => item.id === event.id);
  expect(liveEvent).toMatchObject({ totalAmount: 1500, nuqtatCount: 1 });

  const completed = await request.post(`/api/v1/events/${event.id}/transition`, { data: { to: "completed" } });
  expect(completed.ok()).toBeTruthy();
  const report = await request.post("/api/v1/reports", { data: { eventId: event.id } });
  expect(report.ok()).toBeTruthy();
  const reportBody = (await report.json()) as { id: number; eventId: number };
  expect(reportBody.eventId).toBe(event.id);
});
