export type EventStatus = "draft" | "scheduled" | "live" | "completed" | "archived";

export type Permission =
  | "record"
  | "review"
  | "edit"
  | "reports"
  | "manage_events"
  | "manage_team";

export type PersonIdentity = {
  nuqtaId: string | null;
  name: string;
  phone: string;
  regionId: number | null;
  regionName: string;
  phoneVerified: boolean;
};

export type LedgerEntry = {
  id: number;
  eventId: number;
  payerNuqtaId: string;
  hostNuqtaId: string;
  amount: number;
  occurredAt: Date;
  recordedByUserId: number;
  notificationSentAt: Date | null;
  voidedAt: Date | null;
};

export type Balance = {
  creditorNuqtaId: string | null;
  debtorNuqtaId: string | null;
  netAmount: number;
  interactions: number;
};
