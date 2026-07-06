import { FormProvider } from "react-hook-form";
import { AddGroupWorkspaceHeader } from "./add-group-workspace/components/AddGroupWorkspaceHeader";
import { GroupInformationForm } from "./add-group-workspace/components/GroupInformationForm";
import { ItineraryTimelineView } from "./add-group-workspace/components/ItineraryTimelineView";
import { ManualScheduleModal } from "./add-group-workspace/components/ManualScheduleModal";
import { BaseTripSection } from "./add-group-workspace/components/BaseTripSection";
import { useAddGroupWorkspaceForm } from "./add-group-workspace/hooks/use-add-group-workspace-form";
import type { GroupData, ItineraryPrefill, NewGroupItineraryDraft } from "../shared/app-domain";
import type { ItinerarySectionMode } from "./add-group-workspace-helpers";

export function InputItineraryScreen({
  onSaveGroup,
  hideHeader = false,
  hideSaveAction = false,
  onItineraryDraftChange,
  sectionMode = "full",
  identityDraft = null,
  emitIdentityInDraft = true,
  itineraryPrefill = null,
}: {
  onSaveGroup: (group: GroupData) => void;
  hideHeader?: boolean;
  hideSaveAction?: boolean;
  onItineraryDraftChange?: (draft: NewGroupItineraryDraft | null) => void;
  sectionMode?: ItinerarySectionMode;
  identityDraft?: NewGroupItineraryDraft | null;
  emitIdentityInDraft?: boolean;
  itineraryPrefill?: ItineraryPrefill | null;
}) {
  const formState = useAddGroupWorkspaceForm({
    onSaveGroup,
    onItineraryDraftChange,
    sectionMode,
    identityDraft,
    emitIdentityInDraft,
    itineraryPrefill,
  });

  const {
    saudiCityOptions,
    identityMethods,
    scheduleMethods,
    itineraryItems,
    form,
    baseTripDrafts,
    baseTripStepIndex,
    editingItemId,
    isScheduleFormVisible,
    isBaseTripFormVisible,
    validationState,
    isIdentityOnlyMode,
    isScheduleOnlyMode,
    effectivePaxCountValue,
    enabledBaseTripCount,
    isBaseTripSaveDisabled,
    isFirstBaseTripStep,
    isLastBaseTripStep,
    isActiveBaseTripInvalid,
    isGroupSaveDisabled,
    showFridayCityTourWarning,
    currentBaseTripStepIndex,
    handleFormChange,
    handlePaxCountChange,
    handleOpenCreateForm,
    handleOpenManualCreateForm,
    handleCloseScheduleForm,
    handleCloseBaseTripForm,
    handleBaseTripStepChange,
    handleJumpToBaseTripStep,
    handleBaseTripChange,
    handleEditItem,
    handleDeleteItem,
    handleSaveItem,
    handleSaveBaseTrips,
    handleSaveGroup,
  } = formState;

  const { isGroupReadyForItinerary } = validationState;

  const containerClassName = hideHeader ? "space-y-6" : "mx-auto max-w-7xl space-y-6";

  return (
    <FormProvider {...identityMethods}>
      <div className={containerClassName}>
        <AddGroupWorkspaceHeader hideHeader={hideHeader} />

        <GroupInformationForm
          isScheduleOnlyMode={isScheduleOnlyMode}
          paxCount={effectivePaxCountValue}
          handlePaxCountChange={handlePaxCountChange}
          minimumBusCount={validationState.minimumBusCount}
          safePaxForBusRule={validationState.safePaxForBusRule}
          hasInvalidDateRange={validationState.hasInvalidDateRange}
          isTotalBusBelowMinimum={validationState.isTotalBusBelowMinimum}
        />

        {!isIdentityOnlyMode && !isGroupReadyForItinerary ? (
          <section className="flex items-start gap-3 rounded-3xl border border-tertiary-fixed/70 bg-tertiary-fixed/70 p-4 text-on-tertiary-fixed-variant">
            <div
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-surface-container-lowest text-on-tertiary-fixed-variant"
              aria-hidden="true"
            >
              <span className="material-symbols-outlined">assignment_turned_in</span>
            </div>
            <div>
              <h3 className="text-base font-semibold">Complete Group Information First</h3>
              <p className="mt-1 text-sm leading-relaxed text-on-tertiary-fixed-variant/90">
                <span className="sm:hidden">Complete group info before adding itinerary.</span>
                <span className="hidden sm:inline">
                  Please fill in Group Number, Group Name, Package Type, Pax, Total Bus, date range, and Musyrif
                  information before adding itinerary items.
                </span>
              </p>
            </div>
          </section>
        ) : null}

        {!isIdentityOnlyMode ? (
          <>
            <section className="serene-section">
              <div className="mb-4 flex items-center gap-3">
                <h2 className="text-xl font-semibold text-on-surface">Itinerary</h2>
                <div className="h-px flex-1 bg-outline-variant/35" aria-hidden="true" />
              </div>

              <div className="space-y-3">
                <ItineraryTimelineView
                  itineraryItems={itineraryItems}
                  handleEditItem={handleEditItem}
                  handleDeleteItem={handleDeleteItem}
                  isGroupReadyForItinerary={isGroupReadyForItinerary}
                />

                <BaseTripSection
                  isBaseTripFormVisible={isBaseTripFormVisible && itineraryItems.length === 0}
                  currentBaseTripStepIndex={currentBaseTripStepIndex}
                  baseTripDrafts={baseTripDrafts}
                  enabledBaseTripCount={enabledBaseTripCount}
                  isGroupReadyForItinerary={isGroupReadyForItinerary}
                  handleJumpToBaseTripStep={handleJumpToBaseTripStep}
                  updateBaseTripDraftAtIndex={(tripIndex, updater) =>
                    formState.baseTripMethods.setValue(
                      "trips",
                      baseTripDrafts.map((trip, idx) => (idx === tripIndex ? updater(trip) : trip))
                    )
                  }
                  handleBaseTripChange={handleBaseTripChange}
                  handleBaseTripStepChange={handleBaseTripStepChange}
                  isFirstBaseTripStep={isFirstBaseTripStep}
                  isLastBaseTripStep={isLastBaseTripStep}
                  handleSaveBaseTrips={handleSaveBaseTrips}
                  isBaseTripSaveDisabled={isBaseTripSaveDisabled}
                  handleCloseBaseTripForm={handleCloseBaseTripForm}
                  isActiveBaseTripInvalid={isActiveBaseTripInvalid}
                  saudiCityOptions={saudiCityOptions}
                />

                {itineraryItems.length === 0 && !isBaseTripFormVisible ? (
                  <article className="rounded-2xl border border-dashed border-outline-variant/45 bg-surface-container-high px-4 py-7 text-center">
                    <span className="material-symbols-outlined" aria-hidden="true">
                      search_off
                    </span>
                    <h2 className="mt-2 text-lg font-semibold text-on-surface">No itinerary found</h2>
                    <p className="mt-1 text-sm text-on-surface-variant">
                      <span className="sm:hidden">Add schedule below to start itinerary.</span>
                      <span className="hidden sm:inline">
                        Add a new schedule below to start building this itinerary.
                      </span>
                    </p>
                  </article>
                ) : null}

                {!isBaseTripFormVisible ? (
                  <>
                    <button
                      type="button"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-brand-primary/35 bg-brand-neutral px-4 py-3 text-base font-semibold text-brand-primary transition hover:bg-brand-primary/10 disabled:cursor-not-allowed disabled:opacity-45"
                      onClick={handleOpenCreateForm}
                      disabled={!isGroupReadyForItinerary}
                    >
                      <span className="material-symbols-outlined" aria-hidden="true">
                        add_circle
                      </span>
                      <span className="sm:hidden">Add 5 Trips</span>
                      <span className="hidden sm:inline">Add 5 Base Trips</span>
                    </button>

                    <button
                      type="button"
                      className="serene-btn-secondary w-full"
                      onClick={handleOpenManualCreateForm}
                      disabled={!isGroupReadyForItinerary}
                    >
                      <span className="material-symbols-outlined" aria-hidden="true">
                        add
                      </span>
                      <span className="sm:hidden">Add Manual Schedule</span>
                      <span className="hidden sm:inline">Add Single Schedule (Manual)</span>
                    </button>
                  </>
                ) : null}
              </div>
            </section>

            <ManualScheduleModal
              isScheduleFormVisible={isScheduleFormVisible}
              handleCloseScheduleForm={handleCloseScheduleForm}
              editingItemId={editingItemId}
              handleSaveItem={handleSaveItem}
              isFormDisabled={validationState.isFormDisabled}
              validationState={validationState}
              form={form}
              scheduleMethods={scheduleMethods}
              handleFormChange={handleFormChange}
              applyManualScheduleDraft={(draft, options) => {
                (Object.entries(draft) as Array<[any, any]>).forEach(([key, val]) => {
                  scheduleMethods.setValue(key, val, options);
                });
              }}
              isGroupReadyForItinerary={isGroupReadyForItinerary}
              saudiCityOptions={saudiCityOptions}
              showFridayCityTourWarning={showFridayCityTourWarning}
            />

            {!hideSaveAction ? (
              <section className="serene-section text-center">
                <button
                  type="button"
                  className="serene-btn-primary min-h-11 w-full px-5 sm:w-auto"
                  onClick={handleSaveGroup}
                  disabled={isGroupSaveDisabled}
                >
                  Save Itinerary
                </button>
                <p className="mt-2 text-sm text-on-surface-variant">
                  <span className="sm:hidden">Saved data will appear on Overview.</span>
                  <span className="hidden sm:inline">
                    After saving, the group data will appear on the Overview page.
                  </span>
                </p>
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </FormProvider>
  );
}
