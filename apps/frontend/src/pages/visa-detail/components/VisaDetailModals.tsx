import { Suspense, lazy } from "react";
import { createPortal } from "react-dom";
import { useVisaDetailContext } from "../context/VisaDetailContext";

const LazyDeleteGroupModal = lazy(async () => ({
  default: (await import("../../../components/group-detail-modals")).DeleteGroupModal,
}));
const LazyGroupEditModal = lazy(async () => ({
  default: (await import("../../../components/group-detail-modals")).GroupEditModal,
}));
const LazyUnlinkGroupConfirmModal = lazy(async () => ({
  default: (await import("../../../components/group-detail-modals")).UnlinkGroupConfirmModal,
}));
const LazyPaymentStatusModal = lazy(async () => ({
  default: (await import("../../../components/visa-detail-modals")).PaymentStatusModal,
}));
const LazySyarikahModal = lazy(async () => ({
  default: (await import("../../../components/visa-detail-modals")).SyarikahModal,
}));
const LazyVisaHotelModal = lazy(async () => ({
  default: (await import("../../../components/visa-detail-modals")).VisaHotelModal,
}));
const LazyVisaRaudhahModal = lazy(async () => ({
  default: (await import("../../../components/visa-detail-modals")).VisaRaudhahModal,
}));
const LazyVisaStatusModal = lazy(async () => ({
  default: (await import("../../../components/visa-detail-modals")).VisaStatusModal,
}));
const LazyVisaTypeModal = lazy(async () => ({
  default: (await import("../../../components/visa-detail-modals")).VisaTypeModal,
}));

function VisaDetailModalFallback() {
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
    document.body
  );
}

export function VisaDetailModals() {
  const {
    row,
    group,
    groups,
    paymentStatus,
    activeModal,
    hotelCityDraft,
    hotelDraftMode,
    hotelDraftId,
    hotelDraftSeed,
    unlinkingGroup,
    isGroupEditModalOpen,
    isDeleteGroupModalOpen,
    deleteAgreementDraft,
    isClearRaudhahConfirmOpen,
    unassigningAgreementDraftId,
    requiredBusCount,
    deleteAgreementDialogRef,
    clearRaudhahDialogRef,
    closeModal,
    saveGroupEdit,
    closeGroupEditModal,
    closeDeleteGroupModal,
    confirmDeleteGroup,
    saveVisaStatus,
    saveVisaType,
    savePaymentStatus,
    saveSyarikah,
    saveHotel,
    saveRaudhah,
    buildHotelDraft,
    buildRaudhahDraft,
    handleCloseUnlinkModal,
    handleConfirmUnlink,
    setDeleteAgreementDraft,
    deleteAgreement,
    setIsClearRaudhahConfirmOpen,
    clearRaudhah,
  } = useVisaDetailContext();

  const syarikahValue = group?.visaSetup?.syarikah?.trim() ?? "";

  const deleteAgreementCityLabel = deleteAgreementDraft?.city === "makkah" ? "Makkah" : "Madinah";
  const isUnassigningAgreement =
    deleteAgreementDraft?.draft !== undefined && unassigningAgreementDraftId === deleteAgreementDraft.draft.id;
  const deleteAgreementActionLabel = deleteAgreementDraft?.draft ? "Unassign Agreement" : "Delete Agreement";

  return (
    <>
      {isGroupEditModalOpen && group ? (
        <Suspense fallback={<VisaDetailModalFallback />}>
          <LazyGroupEditModal
            groupCode={group.code}
            groupName={group.name}
            groupPax={group.pax}
            requiredBusCount={requiredBusCount}
            arrivalDate={group.arrivalDate ?? ""}
            returnDate={group.returnDate ?? ""}
            parentGroupId={group.parentGroupId}
            groups={groups}
            onClose={closeGroupEditModal}
            onSave={saveGroupEdit}
          />
        </Suspense>
      ) : null}

      {isDeleteGroupModalOpen && group ? (
        <Suspense fallback={<VisaDetailModalFallback />}>
          <LazyDeleteGroupModal
            groupCode={group.code}
            groupName={group.name}
            onClose={closeDeleteGroupModal}
            onConfirm={confirmDeleteGroup}
          />
        </Suspense>
      ) : null}

      {activeModal ? (
        <Suspense fallback={<VisaDetailModalFallback />}>
          {activeModal === "visa-status" ? (
            <LazyVisaStatusModal initialValue={row.visaStatus} onClose={closeModal} onSave={saveVisaStatus} />
          ) : null}

          {activeModal === "visa-type" ? (
            <LazyVisaTypeModal
              initialValue={(group?.visaSetup?.busStatus as "Visa Only" | "Visa+") ?? "Visa Only"}
              onClose={closeModal}
              onSave={saveVisaType}
            />
          ) : null}

          {activeModal === "payment-status" ? (
            <LazyPaymentStatusModal initialValue={paymentStatus} onClose={closeModal} onSave={savePaymentStatus} />
          ) : null}

          {activeModal === "syarikah" ? (
            <LazySyarikahModal initialValue={syarikahValue} onClose={closeModal} onSave={saveSyarikah} />
          ) : null}

          {activeModal === "hotel" ? (
            <LazyVisaHotelModal
              city={hotelCityDraft}
              mode={hotelDraftMode}
              initialValue={
                hotelDraftSeed ?? buildHotelDraft(hotelCityDraft, hotelDraftMode, hotelDraftId ?? undefined)
              }
              onClose={closeModal}
              onSave={saveHotel}
            />
          ) : null}

          {activeModal === "raudhah" ? (
            <LazyVisaRaudhahModal
              initialValue={buildRaudhahDraft()}
              appointmentIdPrefix={row.groupCode}
              defaultAppointmentDateIso={row.departureIso}
              onClose={closeModal}
              onSave={saveRaudhah}
            />
          ) : null}
        </Suspense>
      ) : null}

      {unlinkingGroup ? (
        <Suspense fallback={<VisaDetailModalFallback />}>
          <LazyUnlinkGroupConfirmModal
            groupCode={unlinkingGroup.code}
            onClose={handleCloseUnlinkModal}
            onConfirm={handleConfirmUnlink}
          />
        </Suspense>
      ) : null}

      {deleteAgreementDraft ? (
        <div
          ref={deleteAgreementDialogRef}
          className="fixed inset-0 z-[130] flex items-start justify-center overflow-y-auto bg-slate-950/55 p-3 pt-10 pb-10 sm:p-4 sm:pt-20 sm:pb-20"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-agreement-title"
          aria-describedby="delete-agreement-description"
          tabIndex={-1}
          onClick={() => setDeleteAgreementDraft(null)}
        >
          <section
            className="serene-modal-shell my-auto w-full max-w-md p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined rounded-full bg-rose-100 p-2 text-rose-700" aria-hidden="true">
                warning
              </span>
              <div className="min-w-0">
                <h3 id="delete-agreement-title" className="text-lg font-extrabold text-slate-900">
                  {deleteAgreementDraft.draft ? "Unassign" : "Delete"} {deleteAgreementCityLabel} Agreement?
                </h3>
                <p id="delete-agreement-description" className="mt-1 text-sm leading-relaxed text-slate-600">
                  Agreement <strong>{deleteAgreementDraft.agreement.agreementNumber}</strong> untuk hotel{" "}
                  <strong>{deleteAgreementDraft.agreement.hotelName}</strong>{" "}
                  {deleteAgreementDraft.draft ? (
                    <>
                      akan dilepas dari group <strong>{row.groupCode}</strong> dan dikembalikan ke Agreement Inbox
                      Unassigned.
                    </>
                  ) : (
                    <>
                      akan dihapus dari group <strong>{row.groupCode}</strong>.
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border border-slate-300 bg-surface-container-lowest px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-surface-container-high"
                onClick={() => setDeleteAgreementDraft(null)}
              >
                Batal
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-2 text-sm font-semibold text-on-primary transition hover:bg-rose-700"
                onClick={() => void deleteAgreement()}
                disabled={isUnassigningAgreement}
              >
                <span className="material-symbols-outlined text-base" aria-hidden="true">
                  {isUnassigningAgreement ? "sync" : deleteAgreementDraft.draft ? "link_off" : "delete"}
                </span>
                <span>{isUnassigningAgreement ? "Unassigning..." : deleteAgreementActionLabel}</span>
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {isClearRaudhahConfirmOpen ? (
        <div
          ref={clearRaudhahDialogRef}
          className="fixed inset-0 z-[130] flex items-start justify-center overflow-y-auto bg-slate-950/55 p-3 pt-10 pb-10 sm:p-4 sm:pt-20 sm:pb-20"
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-raudhah-title"
          aria-describedby="clear-raudhah-description"
          tabIndex={-1}
          onClick={() => setIsClearRaudhahConfirmOpen(false)}
        >
          <section
            className="serene-modal-shell my-auto w-full max-w-md p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined rounded-full bg-rose-100 p-2 text-rose-700" aria-hidden="true">
                warning
              </span>
              <div className="min-w-0">
                <h3 id="clear-raudhah-title" className="text-lg font-extrabold text-slate-900">
                  Clear Raudhah Dates?
                </h3>
                <p id="clear-raudhah-description" className="mt-1 text-sm leading-relaxed text-slate-600">
                  Semua tanggal appointment Raudhah untuk group <strong>{row.groupCode}</strong> akan dihapus. Tindakan
                  ini tidak bisa dibatalkan.
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border border-slate-300 bg-surface-container-lowest px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-surface-container-high"
                onClick={() => setIsClearRaudhahConfirmOpen(false)}
              >
                Batal
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-2 text-sm font-semibold text-on-primary transition hover:bg-rose-700"
                onClick={clearRaudhah}
              >
                <span className="material-symbols-outlined text-base" aria-hidden="true">
                  delete
                </span>
                <span>Ya, Clear</span>
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
