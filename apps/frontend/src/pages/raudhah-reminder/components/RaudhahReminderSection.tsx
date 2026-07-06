import type { ReminderItem, ReminderSlot, PendingTasrehAction } from "../hooks/use-raudhah-reminder";
import {
  reminderSectionConfig,
  getSectionBadgeAccentClass,
  getSectionDividerAccentClass,
} from "../hooks/use-raudhah-reminder";
import { RaudhahReminderCard } from "./RaudhahReminderCard";
import { PaginationControls } from "../../../components/pagination-controls";

export function RaudhahReminderSection({
  slot,
  items,
  copiedItemId,
  isDarkMode,
  onCopyTemplate,
  onOpenVisaDetail,
  onInitiateTasrehAction,
  currentPage,
  totalPages,
  totalItems,
  rangeStart,
  rangeEnd,
  onPageChange,
}: {
  slot: ReminderSlot;
  items: ReminderItem[];
  copiedItemId: string | null;
  isDarkMode: boolean;
  onCopyTemplate: (item: ReminderItem) => void;
  onOpenVisaDetail: (groupCode: string) => void;
  onInitiateTasrehAction: (action: PendingTasrehAction) => void;
  currentPage: number;
  totalPages: number;
  totalItems: number;
  rangeStart: number;
  rangeEnd: number;
  onPageChange: (nextPage: number) => void;
}) {
  const config = reminderSectionConfig[slot];

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <div
          className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ${getSectionBadgeAccentClass(
            slot,
            isDarkMode,
          )}`}
        >
          <span className="material-symbols-outlined text-sm" aria-hidden="true">
            notifications_active
          </span>
          <span>{config.title}</span>
        </div>
        <span className={`h-px flex-1 ${getSectionDividerAccentClass(slot, isDarkMode)}`} aria-hidden="true" />
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-on-surface-variant/80">
          {config.subtitle}
        </span>
      </div>

      {items.length === 0 ? (
        <article className={`rounded-2xl border border-dashed p-8 text-center ${config.emptyCardClassName}`}>
          <span className="material-symbols-outlined text-3xl" aria-hidden="true">
            verified
          </span>
          <h3 className="mt-2 text-base font-extrabold">{config.emptyTitle}</h3>
          <p className="mt-1 text-sm">{config.emptyDescription}</p>
        </article>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {items.map((item) => (
              <RaudhahReminderCard
                key={item.id}
                item={item}
                slot={slot}
                copiedItemId={copiedItemId}
                isDarkMode={isDarkMode}
                onCopyTemplate={onCopyTemplate}
                onOpenVisaDetail={onOpenVisaDetail}
                onInitiateTasrehAction={onInitiateTasrehAction}
              />
            ))}
          </div>

          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            itemLabel="reminders"
            onPageChange={onPageChange}
          />
        </>
      )}
    </section>
  );
}
