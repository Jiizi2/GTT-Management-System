import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { GroupAgreementHotel, GroupData, HotelAgreementDraft } from "../../shared/app-domain";
import { buildVisaTrackingRowsFromGroups } from "../../shared/app-domain";
import { agreementDraftQueryKeys, groupQueryKeys } from "../../shared/query-keys";
import { filterAgreementDrafts } from "../../shared/visa-domain";
import { getUncoveredPeriod } from "../../pages/visa-detail/visa-detail-helpers";
import { useVisaTrackingDetail } from "../../pages/visa-detail/hooks/use-visa-tracking-detail";
import { HotelAgreementSection } from "../../pages/visa-detail/components/HotelAgreementSection";

const { mockVisaDetailContext, mockAssignDraftInBackend, mockUnassignDraftInBackend } = vi.hoisted(() => ({
  mockVisaDetailContext: vi.fn(),
  mockAssignDraftInBackend: vi.fn(),
  mockUnassignDraftInBackend: vi.fn(),
}));

vi.mock("../../pages/visa-detail/context/VisaDetailContext", () => ({
  useVisaDetailContext: mockVisaDetailContext,
}));

vi.mock("../../hooks/use-agreement-drafts-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../hooks/use-agreement-drafts-query")>()),
  assignAgreementDraftInBackend: mockAssignDraftInBackend,
  unassignAgreementDraftInBackend: mockUnassignDraftInBackend,
}));

const group: GroupData = {
  code: "GROUP-B",
  name: "Second Group",
  status: "ACTIVE",
  tone: "active",
  pax: 7,
  packageName: "PRIVATE",
  durationDays: 5,
  arrivalDate: "2026-06-14",
  returnDate: "2026-06-18",
  timeline: [
    { date: "-", title: "-" },
    { date: "-", title: "-" },
  ],
  nextActivity: { title: "-", date: "-", time: "-", icon: "schedule" },
  itinerary: [],
  notes: [],
  musyrif: { name: "-", phone: "-", avatar: "" },
};

function renderAssignment(city: HotelAgreementDraft["city"], assignedGroupCode = "GROUP-A", remainingPax = 7) {
  const draft: HotelAgreementDraft = {
    id: "shared-draft",
    agentId: "agent-1",
    city,
    agentName: "Agent A",
    hotelName: "Shared Hotel",
    agreementNumber: "AG-SHARED-30",
    pax: 30,
    remainingPax,
    assignedGroups: [
      {
        groupCode: assignedGroupCode,
        pax: 30 - remainingPax,
        stayStartIso: group.arrivalDate,
        stayEndIso: group.returnDate,
      },
    ],
    status: "Approved",
    stayStartIso: group.arrivalDate!,
    stayEndIso: group.returnDate!,
    notes: "",
    assignmentStatus: "Assigned",
    createdAtIso: "2026-06-01T00:00:00Z",
    updatedAtIso: "2026-06-01T00:00:00Z",
  };
  const assignAgreementDraft = vi.fn();
  mockVisaDetailContext.mockReturnValue({
    row: { makkahHotelWaived: false, madinahHotelWaived: false },
    group,
    familyGroups: [group],
    activeGroupCode: group.code,
    totalPax: group.pax,
    makkahAgreements: [],
    madinahAgreements: [],
    availableAgreementDraftsByCity: filterAgreementDrafts([draft], {
      groupArrivalDate: group.arrivalDate,
      groupReturnDate: group.returnDate,
      totalPax: group.pax,
      connectedAgreementKeys: new Set(),
    }),
    assignedDraftByAgreementId: new Map(),
    makkahAssigned: 0,
    madinahAssigned: 0,
    makkahMissing: group.pax,
    madinahMissing: group.pax,
    addingHotelCity: city,
    coverageStartIso: group.arrivalDate,
    coverageEndIso: group.returnDate,
    assigningAgreementDraftId: null,
    assignAgreementDraft,
  });

  render(<HotelAgreementSection />);
  return { draft, assignAgreementDraft };
}

describe("shared hotel agreement assignment", () => {
  it.each(["makkah", "madinah"] as const)(
    "allows assigning an already linked %s agreement to another group",
    (city) => {
      const { draft, assignAgreementDraft } = renderAssignment(city);

      expect(screen.getByText(draft.agreementNumber)).toBeInTheDocument();
      expect(screen.getByText("Pax 7/30")).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Assign" });
      expect(button).toBeEnabled();
      fireEvent.click(button);
      expect(assignAgreementDraft).toHaveBeenCalledWith(draft, group.arrivalDate, group.returnDate);
    },
  );

  it.each([6, 0])("hides an agreement with %i remaining pax when the group needs 7", (remainingPax) => {
    const { draft, assignAgreementDraft } = renderAssignment("makkah", "GROUP-A", remainingPax);

    expect(screen.queryByText(draft.agreementNumber)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Assign" })).not.toBeInTheDocument();
    expect(assignAgreementDraft).not.toHaveBeenCalled();
  });

  it("prevents assigning the same agreement to its existing group again", () => {
    const { assignAgreementDraft } = renderAssignment("makkah", " group-b ");

    expect(screen.getByText("Sudah di-assign ke grup ini.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Assign" })).toBeDisabled();
    expect(assignAgreementDraft).not.toHaveBeenCalled();
  });

  it("advances uncovered coverage dates across Makkah and multiple Madinah agreements so subsequent Madinah drafts stay visible", () => {
    const makkahHotel: GroupAgreementHotel = {
      id: "mak-1",
      hotelName: "Manazil Ajyad Hotel",
      agreementNumber: "11259001941685175",
      pax: 4,
      status: "Approved",
      stayStartIso: "2026-11-24",
      stayEndIso: "2026-11-30",
    };
    const madinahHotel1: GroupAgreementHotel = {
      id: "mad-1",
      hotelName: "SAJA BY WARWICK MADINAH",
      agreementNumber: "4503602470383091",
      pax: 4,
      status: "Approved",
      stayStartIso: "2026-11-30",
      stayEndIso: "2026-12-06",
    };
    const madinahDraft2: HotelAgreementDraft = {
      id: "mad-draft-2",
      agentId: "agent-1",
      agentName: "Agent A",
      city: "madinah",
      hotelName: "waqf uthman bin affan Hotel",
      agreementNumber: "15762601634186802",
      pax: 4,
      remainingPax: 4,
      status: "Approved",
      stayStartIso: "2026-12-06",
      stayEndIso: "2026-12-08",
      notes: "",
      assignmentStatus: "Unassigned",
      createdAtIso: "2026-11-01T00:00:00Z",
      updatedAtIso: "2026-11-01T00:00:00Z",
    };
    const madinahDraft3: HotelAgreementDraft = {
      ...madinahDraft2,
      id: "mad-draft-3",
      hotelName: "Aamar Tayba Hotel",
      agreementNumber: "2251802632660180",
      stayStartIso: "2026-12-08",
      stayEndIso: "2026-12-13",
    };

    const uncovered = getUncoveredPeriod(
      "madinah",
      "2026-11-24",
      "2026-12-13",
      [makkahHotel, madinahHotel1],
    );
    expect(uncovered).toEqual({ start: "2026-12-06", end: "2026-12-13" });

    mockVisaDetailContext.mockReturnValue({
      row: { makkahHotelWaived: false, madinahHotelWaived: false },
      group: { ...group, pax: 4, arrivalDate: "2026-11-24", returnDate: "2026-12-13" },
      familyGroups: [group],
      activeGroupCode: group.code,
      totalPax: 4,
      makkahAgreements: [makkahHotel],
      madinahAgreements: [madinahHotel1],
      availableAgreementDraftsByCity: { makkah: [], madinah: [madinahDraft2, madinahDraft3] },
      assignedDraftByAgreementId: new Map(),
      makkahAssigned: 4,
      madinahAssigned: 4,
      makkahMissing: 0,
      madinahMissing: 0,
      addingHotelCity: "madinah",
      coverageStartIso: uncovered.start,
      coverageEndIso: uncovered.end,
      assigningAgreementDraftId: null,
      assignAgreementDraft: vi.fn(),
    });

    render(<HotelAgreementSection />);
    expect(screen.getByText("15762601634186802")).toBeInTheDocument();
    expect(screen.getByText("2251802632660180")).toBeInTheDocument();
  });

  it("optimistically updates group hotels and closes inline/modal UI immediately on assign and unassign", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    const draft: HotelAgreementDraft = {
      id: "draft-opt-1",
      agentId: "agent-1",
      city: "makkah",
      agentName: "Agent A",
      hotelName: "Optimistic Makkah Hotel",
      agreementNumber: "AG-OPT-100",
      pax: 20,
      remainingPax: 20,
      assignedGroups: [],
      status: "Approved",
      stayStartIso: group.arrivalDate!,
      stayEndIso: group.returnDate!,
      notes: "",
      assignmentStatus: "Unassigned",
      createdAtIso: "2026-06-01T00:00:00Z",
      updatedAtIso: "2026-06-01T00:00:00Z",
    };

    queryClient.setQueryData(groupQueryKeys.list("detail", false), [group]);
    queryClient.setQueryData(agreementDraftQueryKeys.list("", "all"), [draft]);

    let resolveAssign!: (val: HotelAgreementDraft) => void;
    mockAssignDraftInBackend.mockReturnValueOnce(
      new Promise<HotelAgreementDraft>((res) => {
        resolveAssign = res;
      }),
    );

    const row = buildVisaTrackingRowsFromGroups([group])[0]!;
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(
      () =>
        useVisaTrackingDetail({
          row,
          groups: (queryClient.getQueryData<GroupData[]>(groupQueryKeys.list("detail", false)) ?? [group]),
          onBack: vi.fn(),
          onDeleteGroup: vi.fn(),
          onSaveGroup: vi.fn(() => ({ ok: true as const })),
          onUpdateVisaStatus: vi.fn(),
          onUpdateVisaType: vi.fn(),
          onToggleHotelWaiver: vi.fn(),
          onUpdatePaymentStatus: vi.fn(),
          onUpdateSyarikah: vi.fn(),
          onUpdateFlightDetails: vi.fn(),
          onUpdateVisaHotel: vi.fn(),
          onDeleteVisaHotel: vi.fn(),
          onSyncVisaItinerary: vi.fn(),
          onUpdateRaudhahAppointment: vi.fn(),
          onClearRaudhahAppointment: vi.fn(),
        }),
      { wrapper },
    );

    act(() => {
      result.current.openAddHotelInline("makkah");
    });
    expect(result.current.addingHotelCity).toBe("makkah");

    let assignPromise!: Promise<void>;
    act(() => {
      assignPromise = result.current.assignAgreementDraft(draft, group.arrivalDate, group.returnDate);
    });

    // Immediately updated before backend resolves
    expect(result.current.addingHotelCity).toBeNull();
    const optimisticGroups = queryClient.getQueryData<GroupData[]>(groupQueryKeys.list("detail", false))!;
    expect(optimisticGroups[0]?.visaSetup?.makkahHotels).toHaveLength(1);
    expect(optimisticGroups[0]?.visaSetup?.makkahHotels[0]?.agreementNumber).toBe("AG-OPT-100");

    await act(async () => {
      resolveAssign({ ...draft, assignmentStatus: "Assigned" });
      await assignPromise;
    });

    // Now test optimistic unassign
    const assignedHotel = optimisticGroups[0]!.visaSetup!.makkahHotels[0]!;
    let resolveUnassign!: (val: HotelAgreementDraft) => void;
    mockUnassignDraftInBackend.mockReturnValueOnce(
      new Promise<HotelAgreementDraft>((res) => {
        resolveUnassign = res;
      }),
    );

    act(() => {
      result.current.openDeleteAgreementConfirm("makkah", assignedHotel, true, draft);
    });
    expect(result.current.deleteAgreementDraft).not.toBeNull();

    let unassignPromise!: Promise<void>;
    act(() => {
      unassignPromise = result.current.deleteAgreement();
    });

    // Modal closes and hotel is removed immediately before backend resolves
    expect(result.current.deleteAgreementDraft).toBeNull();
    const afterUnassignGroups = queryClient.getQueryData<GroupData[]>(groupQueryKeys.list("detail", false))!;
    expect(afterUnassignGroups[0]?.visaSetup?.makkahHotels).toHaveLength(0);

    await act(async () => {
      resolveUnassign(draft);
      await unassignPromise;
    });
  });
});
