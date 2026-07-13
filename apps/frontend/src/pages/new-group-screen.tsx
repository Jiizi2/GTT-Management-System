import { type ReactNode, Suspense, lazy, useState } from "react";
import type { GroupIdentityDraftPayload } from "../hooks/use-app-controller-backend";
import type {
  GroupData,
  ItineraryPrefill,
  NewGroupItineraryDraft,
} from "../shared/app-domain";
import { ThemeToggleButton } from "../components/theme-toggle-button";
import { NewGroupContext } from "./new-group/context/NewGroupContext";
import { useNewGroupForm } from "./new-group/hooks/use-new-group-form";
import { NewGroupIdentityForm } from "./new-group/components/NewGroupIdentityForm";
import { NewGroupHotelsSection } from "./new-group/components/NewGroupHotelsSection";
import { NewGroupRaudhahSection } from "./new-group/components/NewGroupRaudhahSection";

const LazyInputItineraryScreen = lazy(async () => ({
  default: (await import("./add-group-workspace-page")).InputItineraryScreen,
}));

function ItinerarySectionFallback({ label }: { label: string }) {
  return (
    <section className="serene-section">
      <div
        className="flex items-center gap-3 text-sm font-semibold text-on-surface-variant"
        role="status"
        aria-live="polite"
      >
        <span className="material-symbols-outlined animate-pulse text-base text-primary" aria-hidden="true">
          sync
        </span>
        <span>{label}</span>
      </div>
    </section>
  );
}

export function NewGroupScreen({
  onSaveGroup,
  onCancel,
  hideHeader = false,
  itineraryDraft = null,
  itinerarySectionTop,
  itinerarySectionBottom,
  hideGroupInformation = false,
  requireItineraryBeforeSave = false,
  onItineraryPrefillChange,
  hideFooterActions = false,
  onSetupDraftChange,
}: {
  onSaveGroup: (group: GroupData) => void;
  onCancel: () => void;
  hideHeader?: boolean;
  itineraryDraft?: NewGroupItineraryDraft | null;
  itinerarySectionTop?: ReactNode;
  itinerarySectionBottom?: ReactNode;
  hideGroupInformation?: boolean;
  requireItineraryBeforeSave?: boolean;
  onItineraryPrefillChange?: (prefill: ItineraryPrefill | null) => void;
  hideFooterActions?: boolean;
  onSetupDraftChange?: (draft: any) => void;
}) {
  const detailState = useNewGroupForm({
    onSaveGroup,
    itineraryDraft,
    hideGroupInformation,
    requireItineraryBeforeSave,
    onItineraryPrefillChange,
    onSetupDraftChange,
  });

  const {
    form,
    isSaveDisabled,
    hasItineraryDraft,
  } = detailState;

  const containerClassName = hideHeader ? "space-y-6" : "mx-auto max-w-7xl space-y-6";

  return (
    <NewGroupContext.Provider value={{ ...detailState, hideGroupInformation }}>
      <div className={containerClassName}>
        {!hideHeader ? (
          <header className="serene-section p-6">
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-on-surface sm:text-3xl lg:text-4xl">
              Add New Group
            </h1>
            <p className="mt-2 text-sm text-on-surface-variant sm:text-base">
              <span className="sm:hidden">Create group and visa setup.</span>
              <span className="hidden sm:inline">Create group and initialize visa tracking details.</span>
            </p>
          </header>
        ) : null}

        <form className="space-y-6" onSubmit={form.handleSubmit(detailState.handleSave)}>
          {itinerarySectionTop ? <div className="space-y-4">{itinerarySectionTop}</div> : null}

          <NewGroupIdentityForm />
          <NewGroupHotelsSection />
          <NewGroupRaudhahSection />

          {itinerarySectionBottom ? <div className="space-y-4">{itinerarySectionBottom}</div> : null}

          {!hideFooterActions ? (
            <footer className="serene-form-actions">
              {requireItineraryBeforeSave && !hasItineraryDraft ? (
                <p className="w-full text-sm font-medium text-on-tertiary-fixed-variant" role="status" aria-live="polite">
                  <span className="sm:hidden">Isi Add Schedule dulu untuk mengaktifkan Save.</span>
                  <span className="hidden sm:inline">
                    Isi itinerary di bagian Add Schedule terlebih dahulu untuk mengaktifkan Save Group.
                  </span>
                </p>
              ) : null}
              {!detailState.agreementSaveStatus || detailState.agreementSaveStatus.tone === "warning" ? (
                <p className="w-full text-sm font-medium text-on-tertiary-fixed-variant" role="status" aria-live="polite">
                  <span className="sm:hidden">Save agreement hotel dulu sebelum simpan group.</span>
                  <span className="hidden sm:inline">
                    Simpan agreement hotel terlebih dahulu. Saat save, sistem akan validasi tanggal dan sync ke itinerary.
                  </span>
                </p>
              ) : null}
              <button type="button" className="serene-btn-secondary min-h-11 w-full sm:w-auto" onClick={onCancel}>
                Cancel
              </button>
              <button type="submit" className="serene-btn-primary min-h-11 w-full sm:w-auto" disabled={isSaveDisabled}>
                Save Group
              </button>
            </footer>
          ) : null}
        </form>
      </div>
    </NewGroupContext.Provider>
  );
}

export function AddGroupWorkspaceScreen({
  onSaveGroup,
  onSaveIdentity,
  onCancel,
}: {
  onSaveGroup: (group: GroupData) => void;
  onSaveIdentity: (identity: GroupIdentityDraftPayload) => void;
  onCancel: () => void;
}) {
  const [identityDraft, setIdentityDraft] = useState<NewGroupItineraryDraft | null>(null);

  const isIdentityStepComplete = Boolean(
    identityDraft?.groupCode?.trim() &&
    identityDraft?.groupName?.trim() &&
    identityDraft?.packageName?.trim() &&
    identityDraft?.startDate &&
    identityDraft?.endDate &&
    typeof identityDraft?.pax === "number" &&
    identityDraft.pax > 0 &&
    typeof identityDraft?.totalBuses === "number" &&
    identityDraft.totalBuses > 0 &&
    identityDraft?.musyrifName?.trim() &&
    identityDraft?.musyrifPhone?.trim(),
  );

  const handleSaveIdentityWorkspace = () => {
    if (!identityDraft || !isIdentityStepComplete) {
      return;
    }

    onSaveIdentity({
      groupCode: identityDraft.groupCode?.trim().toUpperCase() ?? "",
      groupName: identityDraft.groupName?.trim(),
      packageName: identityDraft.packageName?.trim(),
      pax: identityDraft.pax,
      totalBuses: identityDraft.totalBuses,
      arrivalDate: identityDraft.startDate,
      returnDate: identityDraft.endDate,
      musyrifName: identityDraft.musyrifName?.trim(),
      musyrifPhone: identityDraft.musyrifPhone?.trim(),
    });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="serene-btn-secondary min-h-10 min-w-0 flex-1 sm:flex-none sm:w-auto"
          onClick={onCancel}
        >
          <span className="material-symbols-outlined text-base" aria-hidden="true">
            arrow_back
          </span>
          <span className="sm:hidden">Back</span>
          <span className="hidden sm:inline">Overview</span>
        </button>

        <ThemeToggleButton className="sm:ml-auto sm:mr-5" />
      </div>

      <section className="serene-section p-5 sm:p-6">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-primary/85">Group Workspace</p>
          <h1 className="mt-2 font-display text-2xl font-extrabold tracking-tight text-on-surface sm:text-3xl lg:text-4xl">
            Add New Group
          </h1>
          <p className="mt-2 text-sm text-on-surface-variant sm:text-base">
            <span className="sm:hidden">Buat workspace group dari data entry.</span>
            <span className="hidden sm:inline">
              Buat workspace group dari nomor entry, lalu sambungkan agreement dan itinerary secara terpisah.
            </span>
          </p>
        </div>
      </section>

      <Suspense fallback={<ItinerarySectionFallback label="Loading group identity form..." />}>
        <LazyInputItineraryScreen
          onSaveGroup={onSaveGroup}
          hideHeader
          hideSaveAction
          sectionMode="identity-only"
          onItineraryDraftChange={setIdentityDraft}
        />
      </Suspense>

      <section className="serene-section">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-tertiary-fixed/65 bg-tertiary-fixed/70 px-4 py-3 text-on-tertiary-fixed-variant">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base" aria-hidden="true">
                link
              </span>
              <p className="text-xs font-extrabold uppercase tracking-[0.14em]">Agreement</p>
            </div>
            <p className="mt-2 text-sm font-semibold">Pending link</p>
          </div>
          <div className="rounded-2xl border border-tertiary-fixed/65 bg-tertiary-fixed/70 px-4 py-3 text-on-tertiary-fixed-variant">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base" aria-hidden="true">
                travel_explore
              </span>
              <p className="text-xs font-extrabold uppercase tracking-[0.14em]">Itinerary</p>
            </div>
            <p className="mt-2 text-sm font-semibold">Pending builder</p>
          </div>
        </div>

        <div className="serene-form-actions-split serene-form-actions-fill mt-5">
          <button type="button" className="serene-btn-secondary min-h-11 w-full sm:w-auto" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="serene-btn-primary min-h-11 w-full sm:w-auto"
            onClick={handleSaveIdentityWorkspace}
            disabled={!isIdentityStepComplete}
          >
            Create Group Workspace
          </button>
        </div>
      </section>
    </div>
  );
}
