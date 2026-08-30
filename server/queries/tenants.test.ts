import { describe, expect, it } from "vitest";
import { decideTenantLinkForNewUser } from "./tenants.js";

/**
 * منطق ربط المستخدم الجديد (بدون عضوية) بمستأجر — resolveTenantForUser:
 * المالك يرث tenant البذور فيرى البيانات المزروعة، وغير المالك يحصل على
 * tenant خاص به (عزل SaaS).
 */
describe("decideTenantLinkForNewUser — ربط المستخدم الجديد بمستأجر", () => {
  it("المالك + tenant موجود (tenant البذور) ⇒ يُربط به كعضو فيرى البيانات المزروعة", () => {
    expect(
      decideTenantLinkForNewUser({
        isOwner: true,
        hasTenants: true,
        firstTenantId: 1,
      }),
    ).toEqual({ action: "attach", tenantId: 1 });
  });

  it("المالك + لا يوجد أي tenant بعد ⇒ إنشاء tenant جديد باسمه", () => {
    expect(
      decideTenantLinkForNewUser({
        isOwner: true,
        hasTenants: false,
        firstTenantId: null,
      }),
    ).toEqual({ action: "create" });
  });

  it("أول مستخدم في نظام فارغ (غير مالك) ⇒ إنشاء tenant جديد (تهيئة النظام)", () => {
    expect(
      decideTenantLinkForNewUser({
        isOwner: false,
        hasTenants: false,
        firstTenantId: null,
      }),
    ).toEqual({ action: "create" });
  });

  it("مستخدم عادي غير المالك + يوجد مستأجرون ⇒ tenant جديد خاص به (عزل SaaS)", () => {
    expect(
      decideTenantLinkForNewUser({
        isOwner: false,
        hasTenants: true,
        firstTenantId: 1,
      }),
    ).toEqual({ action: "create" });
  });
});
