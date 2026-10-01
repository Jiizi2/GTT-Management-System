import { useMemo, useState } from "react";
import { InputItineraryScreen } from "./add-group-workspace-page";
import { ThemeToggleButton } from "../components/theme-toggle-button";
import { Button } from "../components/button";
import { PageHeader } from "../components/page-header";
import type { GroupData, ItineraryPrefill, NewGroupItineraryDraft } from "../shared/app-domain";
import { resolveTotalBusCount } from "../shared/app-domain";

type SaveGroupResult = { ok: true } | { ok: false; message: string };

function formatCompactDateRange(startIso: string, endIso: string): string {
  const start = new Date(`${startIso}T12:00:00Z`);
  const end = new Date(`${endIso}T12:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${startIso} to ${endIso}`;
  }

  const startDay = new Intl.DateTimeFormat("en-GB", { day: "numeric", timeZone: "UTC" }).format(start);
  const endDay = new Intl.DateTimeFormat("en-GB", { day: "numeric", timeZone: "UTC" }).format(end);
  const monthAndYear = new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
  if (startIso === endIso) {
    return `${startDay} ${monthAndYear.format(start)}`;
  }
  if (startIso.slice(0, 7) === endIso.slice(0, 7)) {
    return `${startDay}–${endDay} ${monthAndYear.format(end)}`;
  }

  return `${startDay} ${monthAndYear.format(start)} – ${endDay} ${monthAndYear.format(end)}`;
}

function buildIdentityDraftFromGroup(group: GroupData): NewGroupItineraryDraft {
  return {
    agentId: group.agentId?.trim() || group.agent?.id.trim() || "agent_gtt_direct",
    groupCode: group.code,
    groupName: group.name,
    pax: group.pax,
    totalBuses: group.totalBuses,
    packageName: group.packageName,
    startDate: group.arrivalDate,
    endDate: group.returnDate,
    musyrifName: group.musyrif.name,
    musyrifPhone: group.musyrif.phone,
  };
}

function firstHotelName(hotels: NonNullable<GroupData["visaSetup"]>["makkahHotels"]): string {
  return hotels.find((hotel) => hotel.hotelName.trim())?.hotelName.trim() ?? "";
}

function buildItineraryPrefillFromGroup(group: GroupData): ItineraryPrefill | null {
  const makkahHotels = group.visaSetup?.makkahHotels ?? [];
  const madinahHotels = group.visaSetup?.madinahHotels ?? [];
  const makkahHotelName = firstHotelName(makkahHotels);
  const madinahHotelName = firstHotelName(madinahHotels);
  const makkahStayStart = makkahHotels.find((hotel) => hotel.stayStartIso.trim())?.stayStartIso.trim() ?? "";
  const madinahStayStart = madinahHotels.find((hotel) => hotel.stayStartIso.trim())?.stayStartIso.trim() ?? "";
  const madinahStayEnd = madinahHotels.find((hotel) => hotel.stayEndIso.trim())?.stayEndIso.trim() ?? "";

  if (!makkahHotelName && !madinahHotelName && !makkahStayStart && !madinahStayStart && !madinahStayEnd) {
    return {
      startDate: group.arrivalDate,
      endDate: group.returnDate,
    };
  }

  return {
    startDate: group.arrivalDate,
    endDate: group.returnDate,
    cityHotelNames: {
      makkah: makkahHotelName,
      madinah: madinahHotelName,
    },
    trips: {
      "base-arrival": {
        date: makkahStayStart || group.arrivalDate,
        to: "Makkah",
        hotelName: makkahHotelName,
      },
      "base-transfer": {
        date: madinahStayStart || group.arrivalDate,
        from: "Makkah",
        to: "Madinah",
        hotelName: madinahHotelName,
      },
      "base-city-tour-first": {
        date: makkahStayStart || group.arrivalDate,
        cityTourCity: "Makkah",
        hotelName: makkahHotelName,
      },
      "base-departure": {
        date: madinahStayEnd || group.returnDate,
        from: "Madinah",
        hotelName: madinahHotelName,
      },
    },
  };
}

export function GroupItineraryBuilderPage({
  group,
  onBack,
  onSaveGroup,
}: {
  group: GroupData;
  onBack: (groupCode: string) => void;
  onSaveGroup: (group: GroupData, sourceGroupCode?: string) => SaveGroupResult;
}) {
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const identityDraft = useMemo(() => buildIdentityDraftFromGroup(group), [group]);
  const itineraryPrefill = useMemo(() => buildItineraryPrefillFromGroup(group), [group]);
  const hasAgreementPrefill = Boolean(group.visaSetup?.makkahHotels.length || group.visaSetup?.madinahHotels.length);

  const handleSaveItinerary = (itineraryGroup: GroupData) => {
    const nextGroup: GroupData = {
      ...group,
      status: itineraryGroup.status,
      tone: itineraryGroup.tone,
      durationDays: itineraryGroup.durationDays,
      arrivalDate: itineraryGroup.arrivalDate,
      returnDate: itineraryGroup.returnDate,
      timeline: itineraryGroup.timeline,
      nextActivity: itineraryGroup.nextActivity,
      itinerary: itineraryGroup.itinerary,
    };
    const result = onSaveGroup(nextGroup, group.code);
    if (!result.ok) {
      setFeedbackMessage(result.message);
    }
  };

  return (
    <div className="itinerary-builder mx-auto max-w-7xl space-y-4 pb-12 pt-4 sm:space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Button variant="secondary" className="min-h-11" onClick={() => onBack(group.code)}>
          <span className="material-symbols-outlined text-lg" aria-hidden="true">
            arrow_back
          </span>
          <span>Group Detail</span>
        </Button>
        <ThemeToggleButton className="shrink-0" />
      </div>
      <PageHeader
        variant="detail"
        title="Itinerary Builder"
        description={
          <div>
            <p className="break-words">
              {group.code} · {group.name}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-outline-variant/30 pt-3 text-xs font-semibold text-on-surface-variant">
              <span className="rounded-lg bg-surface-container-high px-2.5 py-1">{group.pax} Pax</span>
              <span className="rounded-lg bg-surface-container-high px-2.5 py-1">
                {resolveTotalBusCount(group.pax, group.totalBuses)} Bus Grup
              </span>
              {group.arrivalDate && group.returnDate ? (
                <span className="rounded-lg bg-surface-container-high px-2.5 py-1">
                  {formatCompactDateRange(group.arrivalDate, group.returnDate)}
                </span>
              ) : null}
              {hasAgreementPrefill ? (
                <span className="rounded-lg bg-primary/12 px-2.5 py-1 text-primary">Agreement Prefill</span>
              ) : null}
            </div>
          </div>
        }
      />

      {feedbackMessage ? (
        <section
          className="rounded-2xl border border-error-container/65 bg-error-container px-4 py-3 text-sm font-semibold text-on-error-container"
          role="status"
          aria-live="polite"
        >
          {feedbackMessage}
        </section>
      ) : null}

      <InputItineraryScreen
        onSaveGroup={handleSaveItinerary}
        hideHeader
        sectionMode="schedule-only"
        identityDraft={identityDraft}
        itineraryPrefill={itineraryPrefill}
        emitIdentityInDraft={false}
      />
    </div>
  );
}
