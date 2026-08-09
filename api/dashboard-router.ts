import { createRouter, tenantQuery } from "./middleware";
import type { DashboardStats } from "@contracts/afrah";
import { computeNetworkNet } from "./queries/balance-core";
import { listEvents } from "./queries/events";
import { listTenantNuqtatJoined } from "./queries/nuqtat";
import { listPersons } from "./queries/persons";
import { listWhatsappMessages } from "./queries/whatsapp-log";

export const dashboardRouter = createRouter({
  /** إحصائيات لوحة التحكم */
  stats: tenantQuery.query(async ({ ctx }) => {
    const tenantId = ctx.tenant.id;
    const [persons, events, joined] = await Promise.all([
      listPersons(tenantId),
      listEvents(tenantId),
      listTenantNuqtatJoined(tenantId),
    ]);

    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayNuqtat = joined.filter((n) => n.createdAt.getTime() >= dayStart.getTime());
    const todayMessages = await listWhatsappMessages(tenantId, {
      since: dayStart,
      limit: 500,
    });

    const upcoming = events.filter(
      (e) => e.status === "upcoming" && new Date(e.eventDate).getTime() >= dayStart.getTime(),
    );

    const stats: DashboardStats = {
      personsCount: persons.length,
      upcomingEventsCount: upcoming.length,
      nuqtatCount: joined.length,
      totalNuqtatAmount: joined.reduce((s, n) => s + n.amount, 0),
      network: computeNetworkNet(joined),
      today: {
        nuqtatCount: todayNuqtat.length,
        nuqtatAmount: todayNuqtat.reduce((s, n) => s + n.amount, 0),
        whatsappCount: todayMessages.length,
      },
    };
    return stats;
  }),
});
