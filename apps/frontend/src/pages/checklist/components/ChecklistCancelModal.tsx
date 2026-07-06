import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import type { ChecklistItem } from "../../../shared/app-domain";

function ChecklistModalPortal({ children }: { children: ReactNode }) {
  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(children, document.body);
}

export function ChecklistCancelModal({
  cancelTargetItem,
  onClose,
  onConfirm,
}: {
  cancelTargetItem: ChecklistItem;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <ChecklistModalPortal>
      <div
        className="fixed inset-0 z-[130] flex items-start justify-center overflow-y-auto bg-background-deep/72 p-3 pt-10 pb-10 sm:p-4 sm:pt-20 sm:pb-20"
        onClick={onClose}
        role="presentation"
      >
        <div
          className="serene-modal-shell my-auto w-full max-w-md p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-assignment-title"
          aria-describedby="cancel-assignment-description"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="serene-dialog-header">
            <span
              className="serene-dialog-icon checklist-warning-button material-symbols-outlined"
              aria-hidden="true"
            >
              warning
            </span>
            <div className="min-w-0">
              <h4 id="cancel-assignment-title" className="text-lg font-extrabold text-on-surface">
                Cancel Driver Assignment?
              </h4>
              <p id="cancel-assignment-description" className="mt-1 text-sm text-on-surface-variant">
                Assignment untuk <strong>{(cancelTargetItem.groupCodes ?? [cancelTargetItem.groupCode]).join(" - ")}</strong> akan dikembalikan ke
                <strong> Need Attention</strong> dan data supir akan dihapus.
              </p>
            </div>
          </div>

          <div className="serene-dialog-footer">
            <button
              type="button"
              className="checklist-secondary-button rounded-xl px-3 py-2 text-sm font-semibold transition"
              onClick={onClose}
            >
              Keep Assigned
            </button>
            <button
              type="button"
              className="serene-btn-danger rounded-xl"
              onClick={onConfirm}
            >
              <span className="material-symbols-outlined text-base" aria-hidden="true">
                cancel
              </span>
              <span>Yes, Cancel</span>
            </button>
          </div>
        </div>
      </div>
    </ChecklistModalPortal>
  );
}
