import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { InputItineraryScreen } from "./add-group-workspace-page";
import { ThemeToggleButton } from "../components/theme-toggle-button";
import { buildGroupDetailPath } from "../shared/app-route";
import type { GroupData, ItineraryPrefill, NewGroupItineraryDraft } from "../shared/app-domain";
import { resolveTotalBusCount } from "../shared/app-domain";

type SaveGroupResult = { ok: true } | { ok: false; message: string };

function buildIdentityDraftFromGroup(group: GroupData): NewGroupItineraryDraft {
  return {
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
      notes: itineraryGroup.notes,
      pax: itineraryGroup.pax,
      totalBuses: itineraryGroup.totalBuses,
      packageName: itineraryGroup.packageName,
      musyrif: itineraryGroup.musyrif,
    };
    const result = onSaveGroup(nextGroup, group.code);
    if (!result.ok) {
      setFeedbackMessage(result.message);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="serene-btn-secondary min-h-10 min-w-0 flex-1 sm:w-auto sm:flex-none"
          onClick={() => onBack(group.code)}
        >
          <span className="material-symbols-outlined text-base" aria-hidden="true">
            arrow_back
          </span>
          <span>Group Detail</span>
        </button>

        <ThemeToggleButton className="sm:ml-auto sm:mr-5" />
      </div>

      <section className="serene-section p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-primary/85">Itinerary Workspace</p>
            <h1 className="mt-2 font-display text-2xl font-extrabold tracking-tight text-on-surface sm:text-3xl lg:text-4xl">
              Itinerary Builder
            </h1>
            <p className="mt-2 text-sm font-semibold text-on-surface-variant">
              {group.code} | {group.name}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-lg bg-surface-container-high px-2.5 py-1 text-xs font-bold text-on-surface-variant">
                {group.pax} Pax
              </span>
              <span className="rounded-lg bg-surface-container-high px-2.5 py-1 text-xs font-bold text-on-surface-variant">
                {resolveTotalBusCount(group.pax, group.totalBuses)} Bus
              </span>
              <span className="rounded-lg bg-surface-container-high px-2.5 py-1 text-xs font-bold text-on-surface-variant">
                {group.arrivalDate} to {group.returnDate}
              </span>
              <span
                className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                  hasAgreementPrefill
                    ? "bg-primary/12 text-primary"
                    : "bg-tertiary-fixed/70 text-on-tertiary-fixed-variant"
                }`}
              >
                {hasAgreementPrefill ? "Agreement Prefill" : "No Agreement Prefill"}
              </span>
            </div>
          </div>

          <Link to={buildGroupDetailPath(group.code)} className="serene-btn-secondary min-h-10 w-full sm:w-auto">
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              travel_explore
            </span>
            <span>Open Detail</span>
          </Link>
        </div>
      </section>

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
