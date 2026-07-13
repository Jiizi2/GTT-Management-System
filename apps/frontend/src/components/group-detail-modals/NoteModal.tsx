import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { FieldErrorMessage, getFieldAriaInvalid, getFieldDescribedBy } from "../form-accessibility";
import { useModalFocusTrap } from "../use-modal-focus-trap";
import { noteModalSchema } from "./schemas";
import { ModalPortal, ModalShell, ModalHeader, ModalFooter, ModalFooterButton } from "./shared";
import type { NoteFormState } from "../../shared/app-domain";

const modalFieldClassName = "serene-field";
const modalTextareaClassName = "serene-textarea";
const modalErrorClassName = "text-xs font-medium text-brand-tertiary";
const modalBodyClassName = "serene-dialog-body px-5 py-4";
const modalMetaSectionClassName =
  "flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2";

/**
 * Props untuk NoteModal
 */
type NoteModalProps = {
  /** Callback ketika modal ditutup */
  onClose: () => void;
  /** Callback ketika form di-submit dengan data yang valid */
  onSave: (values: NoteFormState) => void | Promise<void>;
};

/**
 * NoteModal - Modal untuk menambahkan catatan operasional
 *
 * Komponen ini menyediakan form untuk menambahkan catatan dengan opsi pin/unpin.
 * Menggunakan react-hook-form dengan Zod validation untuk memastikan data yang valid.
 *
 * @example
 * ```tsx
 * <NoteModal
 *   onClose={() => setIsOpen(false)}
 *   onSave={(values) => addNote(values)}
 * />
 * ```
 *
 * @component
 * @param {NoteModalProps} props - Komponen props
 * @returns {JSX.Element} Modal dengan form catatan
 */
export function NoteModal({ onClose, onSave }: NoteModalProps) {
  const dialogRef = useModalFocusTrap<HTMLDivElement>({ onClose });
  const {
    register,
    watch,
    setValue,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<NoteFormState>({
    resolver: zodResolver(noteModalSchema),
    defaultValues: {
      text: "",
      pinned: false,
    },
  });

  const noteText = watch("text") || "";
  const pinned = watch("pinned") || false;
  const textErrorMessage = errors.text?.message;

  return (
    <ModalPortal>
      <ModalShell onClose={onClose} ariaLabelledBy="note-modal-title" size="2xl">
        <div ref={dialogRef}>
          <ModalHeader titleId="note-modal-title" title="Add New Note" onClose={onClose} centered />

          <form
            className={modalBodyClassName}
            onSubmit={handleSubmit((values) => void onSave(values))}
          >
            <label className={modalFieldClassName}>
              <span>Operational Note</span>
              <div className="space-y-1.5">
                <textarea
                  id="group-note-text"
                  className={modalTextareaClassName}
                  rows={8}
                  maxLength={2000}
                  placeholder="Write your operational note here..."
                  {...register("text")}
                  aria-invalid={getFieldAriaInvalid(textErrorMessage)}
                  aria-describedby={getFieldDescribedBy("group-note-text", {
                    errorMessage: textErrorMessage,
                    extraDescribedBy: ["group-note-count"],
                  })}
                />
                <div id="group-note-count" className="text-xs text-slate-500">
                  {noteText.length}/2000
                </div>
                <FieldErrorMessage fieldId="group-note-text" message={textErrorMessage} className={modalErrorClassName} />
              </div>
            </label>

            <div className={modalMetaSectionClassName}>
              <div className="inline-flex items-center gap-1.5 text-sm text-slate-600">
                <span className="material-symbols-outlined" aria-hidden="true">
                  visibility
                </span>
                <span>Visible to all operators</span>
              </div>

              <button
                type="button"
                className="inline-flex items-center gap-3"
                onClick={() => setValue("pinned", !pinned, { shouldDirty: true })}
                aria-pressed={pinned}
              >
                <div className="inline-flex items-center gap-1.5 text-sm text-slate-600">
                  <span className="material-symbols-outlined" aria-hidden="true">
                    push_pin
                  </span>
                  <span>Pin to top of group feed</span>
                </div>

                <span
                  className={`inline-flex h-6 w-11 items-center rounded-full p-0.5 transition ${pinned ? "bg-primary" : "bg-slate-300"}`}
                >
                  <span
                    className={`h-5 w-5 rounded-full bg-surface-container-lowest shadow-sm transition ${
                      pinned ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </span>
              </button>
            </div>

            <ModalFooter>
              <ModalFooterButton
                type="submit"
                variant="primary"
                disabled={isSubmitting}
                isLoading={isSubmitting}
                onClick={() => {}}
              >
                Save Note
              </ModalFooterButton>
              {isSubmitting ? (
                <p className="sr-only" role="status" aria-live="polite">
                  Saving note.
                </p>
              ) : null}
              <ModalFooterButton variant="secondary" onClick={onClose}>
                Cancel
              </ModalFooterButton>
            </ModalFooter>
          </form>
        </div>
      </ModalShell>
    </ModalPortal>
  );
}
