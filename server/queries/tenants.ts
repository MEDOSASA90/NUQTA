import { and, asc, eq } from "drizzle-orm";
import { tenantMembers, tenants, type Tenant, type TenantMember } from "@db/schema";
import { getDb } from "./connection";
import { env } from "../lib/env";

/**
 * قرار ربط مستخدم جديد (بدون أي عضوية) بمستأجر — دالة نقية قابلة للاختبار:
 * - المالك (unionId يساوي OWNER_UNION_ID) أو أول مستخدم في نظام بلا مستأجرين:
 *   لو يوجد tenant بالفعل (مثل tenant البذور «أحمد عمر للأفراح») يُربط به كـ scribe
 *   فيرى البيانات المزروعة، وإلا يُنشأ tenant جديد باسمه.
 * - أي مستخدم آخر غير المالك بدون عضوية في نظام فيه مستأجرون:
 *   يُنشأ له tenant جديد خاص به (عزل SaaS صحيح).
 */
export type TenantLinkDecision =
  | { action: "attach"; tenantId: number }
  | { action: "create" };

export function decideTenantLinkForNewUser(args: {
  isOwner: boolean;
  hasTenants: boolean;
  firstTenantId: number | null;
}): TenantLinkDecision {
  const { isOwner, hasTenants, firstTenantId } = args;
  if (isOwner || !hasTenants) {
    if (hasTenants && firstTenantId != null) {
      return { action: "attach", tenantId: firstTenantId };
    }
    return { action: "create" };
  }
  return { action: "create" };
}

/**
 * يجيب المستأجر الحالي للمستخدم عبر tenant_members.
 * لو له عضوية موجودة يستخدمها. لو مفيش عضوية: المالك (أو أول مستخدم في
 * النظام) يُربط بالمستأجر الموجود (tenant البذور) كـ scribe، وغير ذلك يُنشأ
 * tenant جديد باسمه («{name} للأفراح») ويبقى scribe.
 */
export async function resolveTenantForUser(user: {
  id: number;
  name: string | null;
  unionId: string;
}): Promise<{ tenant: Tenant; membership: TenantMember }> {
  const db = getDb();
  const rows = await db
    .select({ tenant: tenants, membership: tenantMembers })
    .from(tenantMembers)
    .innerJoin(tenants, eq(tenants.id, tenantMembers.tenantId))
    .where(eq(tenantMembers.userId, user.id))
    .limit(1);

  const found = rows.at(0);
  if (found) return found;

  // لا توجد عضوية: هل يوجد أي tenant في النظام؟ (الأقدم أولًا — tenant البذور)
  const firstTenant =
    (await db.select().from(tenants).orderBy(asc(tenants.id)).limit(1)).at(
      0,
    ) ?? null;
  const decision = decideTenantLinkForNewUser({
    isOwner: env.ownerUnionId !== "" && user.unionId === env.ownerUnionId,
    hasTenants: firstTenant != null,
    firstTenantId: firstTenant?.id ?? null,
  });

  let tenantId: number;
  if (decision.action === "attach") {
    // ربط بالمستأجر الموجود (مثل tenant البذور) كعضو scribe
    tenantId = decision.tenantId;
  } else {
    // إنشاء مستأجر جديد باسم المستخدم
    const brandName = user.name?.trim()
      ? `${user.name.trim()} للأفراح`
      : "دفتر الأفراح";
    const [{ id }] = await db
      .insert(tenants)
      .values({ name: brandName, ownerUserId: user.id })
      .$returningId();
    tenantId = id;
  }
  await db.insert(tenantMembers).values({
    tenantId,
    userId: user.id,
    role: "scribe",
    permissions: [],
  });
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  const [membership] = await db
    .select()
    .from(tenantMembers)
    .where(
      and(
        eq(tenantMembers.tenantId, tenantId),
        eq(tenantMembers.userId, user.id),
      ),
    )
    .limit(1);
  return { tenant, membership };
}

export async function getTenantById(id: number) {
  const rows = await getDb()
    .select()
    .from(tenants)
    .where(eq(tenants.id, id))
    .limit(1);
  return rows.at(0);
}

export async function listTenants() {
  return getDb().select().from(tenants);
}

export async function isMemberOfTenant(
  userId: number,
  tenantId: number,
): Promise<boolean> {
  const rows = await getDb()
    .select({ id: tenantMembers.id })
    .from(tenantMembers)
    .where(
      and(
        eq(tenantMembers.userId, userId),
        eq(tenantMembers.tenantId, tenantId),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export async function listTenantMembers(tenantId: number) {
  return getDb()
    .select()
    .from(tenantMembers)
    .where(eq(tenantMembers.tenantId, tenantId));
}

export async function updateTenantSettings(
  tenantId: number,
  settings: NonNullable<Tenant["settings"]>,
) {
  await getDb()
    .update(tenants)
    .set({ settings })
    .where(eq(tenants.id, tenantId));
}
