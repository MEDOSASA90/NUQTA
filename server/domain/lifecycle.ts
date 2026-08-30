import type { EventStatus, Permission } from "./types.js";

const transitions: Readonly<Record<EventStatus, readonly EventStatus[]>> = {
  draft: ["scheduled"],
  scheduled: ["live"],
  live: ["completed"],
  completed: ["archived"],
  archived: [],
};

export function canTransitionEvent(from: EventStatus, to: EventStatus): boolean {
  return transitions[from].includes(to);
}

export function assertEventTransition(from: EventStatus, to: EventStatus): void {
  if (!canTransitionEvent(from, to)) {
    throw new Error(`Invalid event transition: ${from} -> ${to}`);
  }
}

export function canRecordNuqta(status: EventStatus): boolean {
  return status === "live";
}

export function hasPermission(
  role: "central_admin" | "scribe" | "team" | "host",
  permissions: readonly Permission[],
  permission: Permission,
): boolean {
  if (role === "central_admin" || role === "scribe") return true;
  if (role === "host") return false;
  return permissions.includes(permission);
}

