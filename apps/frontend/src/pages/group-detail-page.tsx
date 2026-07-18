import { Suspense, lazy } from "react";
import { createPortal } from "react-dom";
import { ThemeToggleButton } from "../components/theme-toggle-button";
import { Button } from "../components/button";
import type { GroupData } from "../shared/app-domain";
import { GroupDetailContext } from "./group-detail/context/GroupDetailContext";
import { GroupDetailHeader } from "./group-detail/components/GroupDetailHeader";
import { GroupTimelineTab } from "./group-detail/components/GroupTimelineTab";
import { GroupItineraryTab } from "./group-detail/components/GroupItineraryTab";
import { GroupChecklistTab } from "./group-detail/components/GroupChecklistTab";
import { GroupVisaTab } from "./group-detail/components/GroupVisaTab";
import { GroupNotesTab } from "./group-detail/components/GroupNotesTab";
import { useGroupDetailDashboard } from "./group-detail/hooks/use-group-detail-dashboard";

const LazyDeleteConfirmModal = lazy(async () => ({
  default: (await import("../components/group-detail-modals")).DeleteConfirmModal,
}));
const LazyDeleteGroupModal = lazy(async () => ({
  default: (await import("../components/group-detail-modals")).DeleteGroupModal,
}));
const LazyEditScheduleModal = lazy(async () => ({
  default: (await import("../components/group-detail-modals")).EditScheduleModal,
}));
const LazyGroupEditModal = lazy(async () => ({
  default: (await import("../components/group-detail-modals")).GroupEditModal,
}));
const LazyMusyrifModal = lazy(async () => ({
  default: (await import("../components/group-detail-modals")).MusyrifModal,
}));
const LazyUnlinkGroupConfirmModal = lazy(async () => ({
  default: (await import("../components/group-detail-modals")).UnlinkGroupConfirmModal,
}));
const LazyNoteModal = lazy(async () => ({
  default: (await import("../components/group-detail-modals")).NoteModal,
}));
const LazyScheduleModal = lazy(async () => ({
  default: (await import("../components/group-detail-modals")).ScheduleModal,
}));

function GroupDetailModalFallback() {
  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="serene-modal-overlay z-[140] flex items-center justify-center p-4">
      <div className="inline-flex items-center gap-2 rounded-xl bg-surface-container-lowest px-4 py-3 text-sm font-semibold text-on-surface shadow-ambient">
        <span className="material-symbols-outlined animate-pulse text-brand-primary" aria-hidden="true">
          hourglass_top
        </span>
        <span>Loading modal...</span>
      </div>
    </div>,
    document.body,
  );
}

export function GroupDetail({
  group,
  groups = [],
  onBack,
  onDeleteGroup,
  onSaveGroup,
  onPatchGroup,
  readOnly = false,
  showThemeToggle = true,
}: {
  group: GroupData;
  groups?: GroupData[];
  onBack: () => void;
  onDeleteGroup: (groupCode: string) => void;
  onSaveGroup: (group: GroupData, sourceGroupCode?: string) => { ok: true } | { ok: false; message: string };
  onPatchGroup: (group: GroupData, sourceGroupCode?: string) => { ok: true } | { ok: false; message: string };
  readOnly?: boolean;
  showThemeToggle?: boolean;
}) {
  const dashboard = useGroupDetailDashboard({
    group,
    groups,
    onBack,
    onDeleteGroup,
    onSaveGroup,
    onPatchGroup,
  });
  const contextValue = { ...dashboard, readOnly };

  const {
    hasOpenModal,
    isScheduleModalOpen,
    scheduleForm,
    isScheduleSaveDisabled,
    showScheduleFridayCityTourWarning,
    handleScheduleFieldChange,
    handleCloseScheduleModal,
    handleSaveSchedule,
    isMusyrifModalOpen,
    musyrifProfile,
    handleCloseMusyrifModal,
    handleSaveMusyrif,
    isEditModalOpen,
    editScheduleForm,
    isEditSaveDisabled,
    showEditFridayCityTourWarning,
    handleEditFieldChange,
    handleCloseEditModal,
    handleSaveEditedSchedule,
    isDeleteModalOpen,
    deletingItem,
    handleCloseDeleteModal,
    handleConfirmDelete,
    isDeleteGroupModalOpen,
    handleCloseDeleteGroupModal,
    handleConfirmDeleteGroup,
    isGroupEditModalOpen,
    requiredBusCount,
    handleCloseGroupEditModal,
    handleSaveGroupEdit,
    isUnlinkModalOpen,
    unlinkingGroup,
    handleCloseUnlinkModal,
    handleConfirmUnlink,
    isNoteModalOpen,
    handleCloseNoteModal,
    handleSaveNote,
  } = contextValue;

  return (
    <GroupDetailContext.Provider value={contextValue}>
      <div className="mx-auto max-w-7xl space-y-6 px-4 pb-24 pt-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" onClick={onBack}>
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              arrow_back
            </span>
            <span className="sm:hidden">Back</span>
            <span className="hidden sm:inline">Back to Groups</span>
          </Button>

          {showThemeToggle ? <ThemeToggleButton className="ml-auto sm:mr-5" /> : null}
        </div>

        {group.parentGroupId && (
          <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs font-semibold text-sky-800 flex items-center gap-3 shadow-sm">
            <span className="material-symbols-outlined text-sky-700" aria-hidden="true">
              info
            </span>
            <div>
              <strong>Grup Operasional Terhubung</strong>
              <p className="mt-0.5 text-[11px] text-sky-700 font-medium">
                Grup ini mewarisi data operasional dari Group (
                {groups.find((g) => g.id === group.parentGroupId || g.code === group.parentGroupId)?.code}) (Musyrif &
                Itinerary) secara otomatis. Anda tidak dapat mengedit data operasional di grup ini.
              </p>
            </div>
          </div>
        )}

        <GroupDetailHeader />

        <div className="space-y-6">
          {/* Grid atas: Group Info (Kiri) & Musyrif / Hotel Agreement (Kanan) */}
          <div className="grid items-stretch gap-4 xl:grid-cols-[1.45fr_0.75fr]">
            <GroupChecklistTab />
            <GroupVisaTab />
          </div>

          {/* Grid bawah: Next Activity & Full Itinerary (Kiri) & Notes (Kanan) */}
          <div className="grid items-stretch gap-4 xl:grid-cols-[1.45fr_0.75fr]">
            <div className="space-y-4">
              <GroupTimelineTab />
              <GroupItineraryTab />
            </div>
            <aside>
              <GroupNotesTab />
            </aside>
          </div>

          <footer className="rounded-2xl border border-outline-variant/45 bg-surface-container-lowest p-3 text-center text-xs font-medium text-on-surface-variant/80">
            <p>
              <span className="sm:hidden">{readOnly ? "GTT Agent Portal" : "GTT Operations Desk"}</span>
              <span className="hidden sm:inline">
                Ghaniya Tour and Travel Management System | {readOnly ? "GTT Agent Portal" : "GTT Operations Desk"}
              </span>
            </p>
          </footer>
        </div>

        {!readOnly && hasOpenModal ? (
          <Suspense fallback={<GroupDetailModalFallback />}>
            {isScheduleModalOpen ? (
              <LazyScheduleModal
                form={scheduleForm}
                isSaveDisabled={isScheduleSaveDisabled}
                showFridayCityTourWarning={showScheduleFridayCityTourWarning}
                onChange={handleScheduleFieldChange}
                onClose={handleCloseScheduleModal}
                onSave={handleSaveSchedule}
              />
            ) : null}

            {isMusyrifModalOpen ? (
              <LazyMusyrifModal
                initialValues={{
                  name: musyrifProfile.name,
                  phone: musyrifProfile.phone,
                }}
                onClose={handleCloseMusyrifModal}
                onSave={handleSaveMusyrif}
              />
            ) : null}

            {isEditModalOpen && editScheduleForm ? (
              <LazyEditScheduleModal
                form={editScheduleForm}
                isSaveDisabled={isEditSaveDisabled}
                showFridayCityTourWarning={showEditFridayCityTourWarning}
                onChange={handleEditFieldChange}
                onClose={handleCloseEditModal}
                onSave={handleSaveEditedSchedule}
              />
            ) : null}

            {isDeleteModalOpen && deletingItem ? (
              <LazyDeleteConfirmModal
                item={deletingItem}
                onClose={handleCloseDeleteModal}
                onConfirm={handleConfirmDelete}
              />
            ) : null}

            {isDeleteGroupModalOpen ? (
              <LazyDeleteGroupModal
                groupCode={group.code}
                groupName={group.name}
                childGroupCount={contextValue.childGroupCount}
                onClose={handleCloseDeleteGroupModal}
                onConfirm={handleConfirmDeleteGroup}
              />
            ) : null}

            {isGroupEditModalOpen ? (
              <LazyGroupEditModal
                groupCode={group.code}
                groupName={group.name}
                groupPax={group.pax}
                requiredBusCount={requiredBusCount}
                arrivalDate={group.arrivalDate ?? ""}
                returnDate={group.returnDate ?? ""}
                parentGroupId={group.parentGroupId}
                groups={groups}
                onClose={handleCloseGroupEditModal}
                onSave={handleSaveGroupEdit}
              />
            ) : null}

            {isUnlinkModalOpen && unlinkingGroup ? (
              <LazyUnlinkGroupConfirmModal
                groupCode={unlinkingGroup.code}
                onClose={handleCloseUnlinkModal}
                onConfirm={handleConfirmUnlink}
              />
            ) : null}

            {isNoteModalOpen ? <LazyNoteModal onClose={handleCloseNoteModal} onSave={handleSaveNote} /> : null}
          </Suspense>
        ) : null}
      </div>
    </GroupDetailContext.Provider>
  );
}
