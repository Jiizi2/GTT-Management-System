import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { FieldErrorMessage, getFieldAriaInvalid, getFieldDescribedBy } from "../form-accessibility";
import { useModalFocusTrap } from "../use-modal-focus-trap";
import { musyrifModalSchema } from "./schemas";
import { ModalPortal, ModalShell, ModalHeader, ModalFooter, ModalFooterButton } from "./shared";
import type { MusyrifFormState } from "../../shared/app-domain";

const modalFieldClassName = "serene-field";
const modalInputClassName = "serene-input";
const modalErrorClassName = "text-xs font-medium text-brand-tertiary";
const modalBodyClassName = "serene-dialog-body px-5 py-4";

/**
 * Props untuk MusyrifModal
 */
type MusyrifModalProps = {
  /** Initial form values for musyrif data */
  initialValues: MusyrifFormState;
  /** Callback ketika modal ditutup */
  onClose: () => void;
  /** Callback ketika form di-submit dengan data yang valid */
  onSave: (values: MusyrifFormState) => void | Promise<void>;
};

/**
 * MusyrifModal - Modal untuk mengedit data musyrif (pendamping grup)
 *
 * Komponen ini menyediakan form untuk mengedit nama dan nomor telepon musyrif.
 * Menggunakan react-hook-form dengan Zod validation untuk memastikan data yang valid.
 *
 * @example
 * ```tsx
 * <MusyrifModal
 *   initialValues={{ name: 'Ahmad', phone: '+6281234567890' }}
 *   onClose={() => setIsOpen(false)}
 *   onSave={(values) => updateMusyrif(values)}
 * />
 * ```
 *
 * @component
 * @param {MusyrifModalProps} props - Komponen props
 * @returns {JSX.Element} Modal dengan form musyrif
 */
export function MusyrifModal({ initialValues, onClose, onSave }: MusyrifModalProps) {
  const dialogRef = useModalFocusTrap<HTMLDivElement>({ onClose });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<MusyrifFormState>({
    resolver: zodResolver(musyrifModalSchema),
    defaultValues: initialValues,
  });

  useEffect(() => {
    reset(initialValues);
  }, [initialValues, reset]);

  const nameErrorMessage = errors.name?.message;
  const phoneErrorMessage = errors.phone?.message;

  return (
    <ModalPortal>
      <ModalShell onClose={onClose} ariaLabelledBy="edit-musyrif-title" size="2xl">
        <div ref={dialogRef}>
          <ModalHeader titleId="edit-musyrif-title" title="Edit Musyrif" onClose={onClose} centered />

          <form className={modalBodyClassName} onSubmit={handleSubmit((values) => void onSave(values))}>
            <div className="grid gap-3 md:grid-cols-2">
              <label className={modalFieldClassName}>
                <span>Musyrif Name</span>
                <input
                  id="musyrif-name"
                  className={modalInputClassName}
                  type="text"
                  {...register("name")}
                  placeholder="e.g. Ust. Ahmad Hidayat"
                  aria-invalid={getFieldAriaInvalid(nameErrorMessage)}
                  aria-describedby={getFieldDescribedBy("musyrif-name", {
                    errorMessage: nameErrorMessage,
                  })}
                />
                <FieldErrorMessage fieldId="musyrif-name" message={nameErrorMessage} className={modalErrorClassName} />
              </label>

              <label className={modalFieldClassName}>
                <span>Phone Number</span>
                <input
                  id="musyrif-phone"
                  className={modalInputClassName}
                  type="tel"
                  {...register("phone")}
                  placeholder="+62 812-3456-7890"
                  aria-invalid={getFieldAriaInvalid(phoneErrorMessage)}
                  aria-describedby={getFieldDescribedBy("musyrif-phone", {
                    errorMessage: phoneErrorMessage,
                  })}
                />
                <FieldErrorMessage
                  fieldId="musyrif-phone"
                  message={phoneErrorMessage}
                  className={modalErrorClassName}
                />
              </label>
            </div>

            <ModalFooter>
              <ModalFooterButton type="submit" variant="primary" disabled={isSubmitting} isLoading={isSubmitting}>
                Save Changes
              </ModalFooterButton>
              {isSubmitting ? (
                <p className="sr-only" role="status" aria-live="polite">
                  Saving musyrif changes.
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
