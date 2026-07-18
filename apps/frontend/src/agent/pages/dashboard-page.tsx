import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { OverviewScreen } from "../../pages/overview-page";
import type { GroupData, ItineraryItem, TimelineItem } from "../../shared/app-domain";
import type { Dashboard, GroupSummary } from "../data/contracts";
import { agentQueryKeys } from "../query/agent-query-boundary";
import { portalGet } from "../data/portal-query";
import { getAllAgentGroups } from "../data/all-groups-query";
import { ErrorState, LoadingState } from "../components/data-state";

const iconByCategory: Record<string, string> = {
  FLIGHT: "flight_takeoff",
  ARRIVAL: "flight_land",
  DEPARTURE: "flight_takeoff",
  HOTEL: "hotel",
  TRANSFER: "airport_shuttle",
  TRAIN: "train",
  "CITY TOUR": "tour",
};

function mapItinerary(group: GroupSummary): ItineraryItem[] {
  return group.itinerary.map((item) => ({
    date: item.dateLabel,
    year: item.yearLabel,
    category: item.category,
    title: item.title,
    meta: [item.time, item.fromLocation && item.toLocation ? `${item.fromLocation} → ${item.toLocation}` : null]
      .filter(Boolean)
      .join(" | "),
    icon: iconByCategory[item.category.toUpperCase()] ?? "route",
    isoDate: item.isoDate ?? undefined,
    time: item.time ?? undefined,
    flightNumber: item.flightNumber ?? undefined,
    hotelName: item.hotelName ?? undefined,
    fromHotelName: item.fromHotelName ?? undefined,
    from: item.fromLocation ?? undefined,
    to: item.toLocation ?? undefined,
    cityTourCity: item.cityTourCity ?? undefined,
    requiresBus: item.requiresBus,
    transferByTrain: item.transferByTrain,
    trainDepartureTime: item.trainDepartureTime ?? undefined,
    destinationPickupTime: item.destinationPickupTime ?? undefined,
    hotelPickupRequestTime: item.hotelPickupRequestTime ?? undefined,
  }));
}

function mapTimeline(group: GroupSummary): [TimelineItem, TimelineItem] {
  const rows = group.itinerary.slice(0, 2).map<TimelineItem>((item, index) => ({
    date: item.dateLabel,
    title: item.title,
    isCurrent: index === 0,
  }));
  while (rows.length < 2) {
    rows.push({ date: "-", title: rows.length === 0 ? "Belum ada itinerary" : "Menunggu jadwal berikutnya" });
  }
  return [rows[0], rows[1]];
}

export function mapAgentGroup(
  group: GroupSummary,
  agentId: string,
  agentName: string,
  visa?: {
    facet: import("../data/contracts").VisaFacet;
    hotels: import("../data/contracts").HotelAgreement[];
  },
): GroupData {
  const itinerary = mapItinerary(group);
  const next = itinerary[0];
  const durationDays = Math.max(
    1,
    Math.round((Date.parse(group.returnDate) - Date.parse(group.arrivalDate)) / 86_400_000) + 1,
  );
  return {
    id: group.id,
    agentId,
    agent: {
      id: agentId,
      code: agentName,
      name: agentName,
      type: "PARTNER",
      status: "ACTIVE",
    },
    code: group.code,
    name: group.name,
    status: group.lifecycleStatus.replaceAll("_", " "),
    lifecycleStatus: group.lifecycleStatus,
    tone: group.lifecycleStatus === "ACTIVE" ? "active" : "inactive",
    pax: group.pax,
    totalBuses: group.totalBuses ?? 0,
    packageName: group.packageName,
    durationDays,
    arrivalDate: group.arrivalDate.slice(0, 10),
    returnDate: group.returnDate.slice(0, 10),
    timeline: mapTimeline(group),
    nextActivity: {
      title: next?.title ?? "Belum ada aktivitas",
      date: next?.date ?? "-",
      time: next?.time ?? "-",
      icon: next?.icon ?? "schedule",
    },
    itinerary,
    notes: group.notes.map((note) => note.text),
    musyrif: group.musyrif ?? { name: "Belum ditentukan", phone: "-", avatar: "" },
    visaSetup: visa
      ? {
          visaStatus: visa.facet.status === "ISSUED" ? "Issued" : visa.facet.status === "PENDING" ? "Pending" : "Draft",
          issuedDate: visa.facet.issuedDate ?? undefined,
          syarikah: visa.facet.syarikah ?? "",
          busStatus: visa.facet.busStatus === "VISA_PLUS" ? "Visa+" : "Visa Only",
          paymentStatus:
            visa.facet.paymentStatus === "PAID"
              ? "Paid"
              : visa.facet.paymentStatus === "PARTIAL"
                ? "Partial"
                : "Unpaid",
          makkahHotels: visa.hotels
            .filter((hotel) => hotel.city === "MAKKAH")
            .map((hotel) => ({
              id: hotel.id,
              hotelName: hotel.hotelName,
              agreementNumber: hotel.agreementNumber,
              pax: hotel.pax,
              status:
                hotel.status === "APPROVED"
                  ? "Approved"
                  : hotel.status === "REJECTED"
                    ? "Rejected"
                    : "Waiting for Approval",
              stayStartIso: hotel.stayStart?.slice(0, 10) ?? "",
              stayEndIso: hotel.stayEnd?.slice(0, 10) ?? "",
              ownerGroupCode: group.code,
            })),
          madinahHotels: visa.hotels
            .filter((hotel) => hotel.city === "MADINAH")
            .map((hotel) => ({
              id: hotel.id,
              hotelName: hotel.hotelName,
              agreementNumber: hotel.agreementNumber,
              pax: hotel.pax,
              status:
                hotel.status === "APPROVED"
                  ? "Approved"
                  : hotel.status === "REJECTED"
                    ? "Rejected"
                    : "Waiting for Approval",
              stayStartIso: hotel.stayStart?.slice(0, 10) ?? "",
              stayEndIso: hotel.stayEnd?.slice(0, 10) ?? "",
              ownerGroupCode: group.code,
            })),
          raudhahAppointments: [],
        }
      : undefined,
  };
}

function monthLabel(value: string): string {
  const parsed = new Date(`${value}-01T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(parsed);
}

export function DashboardPage({
  principalId,
  agentId,
  agentName,
}: {
  principalId: string;
  agentId: string;
  agentName: string;
}) {
  const client = useQueryClient();
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: agentQueryKeys.dashboard(principalId),
    queryFn: async () => ({
      dashboard: await portalGet<Dashboard>(client, "/dashboard"),
      groups: await getAllAgentGroups(client, "asc"),
    }),
    staleTime: 30_000,
  });
  const [search, setSearch] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);
  const [month, setMonth] = useState("all");

  const groups = useMemo(
    () => (query.data?.groups ?? []).map((group) => mapAgentGroup(group, agentId, agentName)),
    [agentId, agentName, query.data?.groups],
  );
  const filteredGroups = useMemo(() => {
    const term = search.trim().toLowerCase();
    return groups.filter(
      (group) =>
        (!term || `${group.code} ${group.name}`.toLowerCase().includes(term)) &&
        (!activeOnly || group.lifecycleStatus === "ACTIVE") &&
        (month === "all" || group.arrivalDate?.slice(0, 7) === month),
    );
  }, [activeOnly, groups, month, search]);
  const monthOptions = useMemo(
    () => [
      { value: "all", label: "All Months" },
      ...[...new Set(groups.map((group) => group.arrivalDate?.slice(0, 7)).filter(Boolean) as string[])]
        .sort()
        .map((value) => ({ value, label: monthLabel(value) })),
    ],
    [groups],
  );

  if (query.isPending) return <LoadingState label="Memuat overview..." />;
  if (query.isError) return <ErrorState retry={() => void query.refetch()} />;

  const dashboard = query.data.dashboard;
  return (
    <OverviewScreen
      query={search}
      filteredGroups={filteredGroups}
      isActiveOnly={activeOnly}
      overviewMonthFilter={month}
      overviewMonthOptions={monthOptions}
      statCards={[
        {
          label: "Active Groups",
          value: String(dashboard.groups.active),
          subtitle: "Currently managed",
          icon: "travel_explore",
          tone: "primary",
        },
        {
          label: "Total Jamaah",
          value: String(dashboard.groups.totalPax),
          subtitle: "Across your groups",
          icon: "groups",
          tone: "secondary",
        },
        {
          label: "Need Attention",
          value: String(dashboard.attention.visaGroups + dashboard.attention.hotelGroups),
          subtitle: "Visa or agreement",
          icon: "notifications_active",
          tone: "tertiary",
        },
      ]}
      summaryMessage={`${filteredGroups.length} group milik ${agentName} ditampilkan.`}
      onQueryChange={setSearch}
      onToggleActiveOnly={setActiveOnly}
      onOverviewMonthFilterChange={setMonth}
      onOpenDetail={(groupCode) => navigate(`/agent/groups/${encodeURIComponent(groupCode)}`)}
      groups={groups}
      fixedAgentName={agentName}
      showThemeToggle={false}
    />
  );
}
