import { GroupLifecycleStatus } from "@prisma/client";

export function resolveGroupLifecycleStatus(
  value: GroupLifecycleStatus | string | null | undefined,
): GroupLifecycleStatus {
  if (value === GroupLifecycleStatus.ENTRY_ONLY) {
    return GroupLifecycleStatus.ENTRY_ONLY;
  }
  if (value === GroupLifecycleStatus.ACTIVE) {
    return GroupLifecycleStatus.ACTIVE;
  }
  if (value === GroupLifecycleStatus.INACTIVE) {
    return GroupLifecycleStatus.INACTIVE;
  }
  if (value === GroupLifecycleStatus.COMPLETED) {
    return GroupLifecycleStatus.COMPLETED;
  }
  if (value === GroupLifecycleStatus.ARCHIVED) {
    return GroupLifecycleStatus.ARCHIVED;
  }

  const normalized = (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

  if (normalized === "entryonly") {
    return GroupLifecycleStatus.ENTRY_ONLY;
  }
  if (normalized === "inactive" || normalized === "inaktif") {
    return GroupLifecycleStatus.INACTIVE;
  }
  if (normalized === "completed" || normalized === "complete") {
    return GroupLifecycleStatus.COMPLETED;
  }
  if (normalized === "archived" || normalized === "archive") {
    return GroupLifecycleStatus.ARCHIVED;
  }

  return GroupLifecycleStatus.ACTIVE;
}

export function toGroupStatusLabel(status: GroupLifecycleStatus): string {
  if (status === GroupLifecycleStatus.ENTRY_ONLY) {
    return "Entry Only";
  }
  if (status === GroupLifecycleStatus.INACTIVE) {
    return "In Active";
  }
  if (status === GroupLifecycleStatus.COMPLETED) {
    return "Completed";
  }
  if (status === GroupLifecycleStatus.ARCHIVED) {
    return "Archived";
  }

  return "Active";
}
