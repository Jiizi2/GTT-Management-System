import { type ReactNode, useId } from "react";
import { createPortal } from "react-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "../../../components/button";
import { DialogShell } from "../../../components/dialog-shell";
import { useModalFocusTrap } from "../../../components/use-modal-focus-trap";
import type { HotelAgreementDraft, HotelAgreementDraftFormState } from "../../../shared/app-domain";
import { draftSchema } from "../hooks/use-agreement-inbox";
import { AgreementDraftFields } from "./AgreementDraftFields";

function toDraftFormState(draft: HotelAgreementDraft): HotelAgreementDraftFormState {
  return {
    city: draft.city,
    agentId: draft.agentId,
    hotelName: draft.hotelName,
    agreementNumber: draft.agreementNumber,
    pax: draft.pax.toString(),
    status: draft.status,
    stayStartIso: draft.stayStartIso,
    stayEndIso: draft.stayEndIso,
    notes: draft.notes,
  };
}

function ModalPortal({ children }: { children: ReactNode }) {
  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(children, document.body);
}

export function AgreementDraftEditModal({
  draft,
  isSaving,
  onClose,
  onSave,
}: {
  draft: HotelAgreementDraft;
  isSaving: boolean;
  onClose: () => void;
  onSave: (values: HotelAgreementDraftFormState) => void | Promise<void>;
}) {
  const dialogRef = useModalFocusTrap<HTMLDivElement>({ onClose });
  const titleId = useId();
  const descriptionId = useId();
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<HotelAgreementDraftFormState>({
    resolver: zodResolver(draftSchema),
    defaultValues: toDraftFormState(draft),
  });
  const isBusy = isSaving || isSubmitting;

  return (
    <ModalPortal>
      <div
        className="serene-modal-overlay z-[130] flex items-start justify-center overflow-y-auto p-3 pt-10 pb-10 sm:p-4 sm:pt-20 sm:pb-20"
        onClick={onClose}
      >
        <section
          ref={dialogRef}
          className="serene-modal-shell flex max-h-[calc(100dvh-1.5rem)] w-full max-w-4xl flex-col sm:max-h-[calc(100dvh-2rem)]"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          tabIndex={-1}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="serene-dialog-header shrink-0 bg-surface-container-low px-5 py-4">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <span className="material-symbols-outlined" aria-hidden="true">
                  edit
                </span>
              </span>
              <div className="min-w-0">
                <h2 id={titleId} className="font-display text-2xl font-bold tracking-tight text-on-surface">
                  Edit Draft Agreement
                </h2>
                <p id={descriptionId} className="mt-1 break-words text-sm text-on-surface-variant">
                  Update agreement {draft.agreementNumber}.
                </p>
              </div>
            </div>

            <button
              type="button"
              className="serene-dialog-close-shell hover:border-primary"
              onClick={onClose}
              aria-label="Close edit agreement popup"
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                close
              </span>
            </button>
          </div>

          <form
            className="serene-dialog-body overflow-y-auto px-5 py-4"
            onSubmit={handleSubmit((values) => void onSave(values))}
          >
            <AgreementDraftFields
              control={control}
              register={register}
              errors={errors}
              idPrefix={`agreement-draft-edit-${draft.id}`}
            />

            <div className="serene-dialog-footer-bar -mx-5 -mb-4 mt-5 bg-surface-container-low">
              <button type="submit" className="serene-btn-primary" disabled={isBusy}>
                <span className="material-symbols-outlined" aria-hidden="true">
                  {isBusy ? "sync" : "check_circle"}
                </span>
                <span>{isBusy ? "Saving..." : "Save Changes"}</span>
              </button>
              <button type="button" className="serene-btn-secondary" onClick={onClose}>
                Cancel
              </button>
            </div>
          </form>
        </section>
      </div>
    </ModalPortal>
  );
}

export function DeleteAgreementDraftModal({
  draft,
  isDeleting,
  onClose,
  onConfirm,
}: {
  draft: HotelAgreementDraft;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const descriptionId = useId();

  return (
    <DialogShell
      isOpen={true}
      onClose={onClose}
      title="Hapus Draft Agreement"
      size="sm"
    >
      <div className="serene-dialog-body px-5 py-4">
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined rounded-full bg-rose-100 p-2 text-rose-700" aria-hidden="true">
            warning
          </span>
          <div className="min-w-0">
            <p id={descriptionId} className="text-sm leading-relaxed text-slate-600">
              Draft agreement <strong>{draft.agreementNumber}</strong> untuk hotel <strong>{draft.hotelName}</strong>{" "}
              akan dihapus dari inbox.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Batal
          </Button>
          <Button
            variant="danger"
            size="sm"
            className="inline-flex items-center gap-1.5"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              {isDeleting ? "sync" : "delete"}
            </span>
            <span>{isDeleting ? "Deleting..." : "Delete Agreement"}</span>
          </Button>
        </div>
      </div>
    </DialogShell>
  );
}
