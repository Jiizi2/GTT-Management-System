import { useEffect, useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { DatePickerInput } from "../date-time-pickers";
import { FieldErrorMessage, getFieldAriaInvalid, getFieldDescribedBy } from "../form-accessibility";
import { SereneSelect } from "../serene-select";
import { useModalFocusTrap } from "../use-modal-focus-trap";
import { createGroupEditModalSchema } from "./schemas";
import { getMinimumBusCountForPax } from "../../shared/app-domain";
import { ModalPortal, ModalShell, ModalHeader, ModalFooter, ModalFooterButton } from "./shared";

const modalFieldClassName = "serene-field";
const modalInputClassName = "serene-input";
const modalSelectClassName = "serene-select";
const modalErrorClassName = "text-xs font-medium text-brand-tertiary";
const modalBodyClassName = "serene-dialog-body px-5 py-4";

/**
 * Props untuk GroupEditModal
 */
type GroupEditModalProps = {
  /** Kode grup yang akan diedit */
  groupCode: string;
  /** Nama grup saat ini */
  groupName: string;
  /** Jumlah pax dalam grup */
  groupPax: number;
  /** Jumlah bus yang diperlukan */
  requiredBusCount: number;
  /** Tanggal kedatangan (ISO format) */
  arrivalDate: string;
  /** Tanggal kepulangan (ISO format) */
  returnDate: string;
  /** ID parent group jika grup ini adalah child (opsional) */
  parentGroupId?: string | null;
  /** Daftar grup lain yang bisa dijadikan parent (opsional) */
  groups?: Array<{ id?: string; code: string; name: string }>;
  /** Callback ketika modal ditutup */
  onClose: () => void;
  /** Callback ketika form di-submit dengan data yang valid */
  onSave: (values: {
    code: string;
    name: string;
    pax: number;
    totalBuses: number;
    arrivalDate: string;
    returnDate: string;
    parentGroupId?: string | null;
  }) => { ok: true } | { ok: false; message: string } | Promise<{ ok: true } | { ok: false; message: string }>;
};

/**
 * GroupEditModal - Modal untuk mengedit informasi dasar grup
 *
 * Komponen ini menyediakan form untuk mengedit kode, nama, jumlah pax,
 * jumlah bus, tanggal kedatangan/kepulangan, dan parent group.
 * Menggunakan react-hook-form dengan Zod validation untuk memastikan data yang valid.
 *
 * @example
 * ```tsx
 * <GroupEditModal
 *   groupCode="GRP-001"
 *   groupName="Umrah Januari 2024"
 *   groupPax={45}
 *   requiredBusCount={2}
 *   arrivalDate="2024-01-15"
 *   returnDate="2024-01-25"
 *   parentGroupId={null}
 *   groups={availableGroups}
 *   onClose={() => setIsOpen(false)}
 *   onSave={(values) => updateGroup(values)}
 * />
 * ```
 *
 * @component
 * @param {GroupEditModalProps} props - Komponen props
 * @returns {JSX.Element} Modal dengan form edit grup
 */
export function GroupEditModal({
  groupCode,
  groupName,
  groupPax,
  requiredBusCount,
  arrivalDate,
  returnDate,
  parentGroupId,
  groups = [],
  onClose,
  onSave,
}: GroupEditModalProps) {
  const dialogRef = useModalFocusTrap<HTMLDivElement>({ onClose });
  const groupEditModalSchema = useMemo(() => createGroupEditModalSchema(), []);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    control,
    formState: { errors, isSubmitting },
  } = useForm<{ code: string; name: string; pax: string; totalBuses: string; arrivalDate: string; returnDate: string; parentGroupId?: string }>({
    resolver: zodResolver(groupEditModalSchema),
    defaultValues: {
      code: groupCode,
      name: groupName,
      pax: String(groupPax),
      totalBuses: String(requiredBusCount),
      arrivalDate: arrivalDate,
      returnDate: returnDate,
      parentGroupId: parentGroupId || "none",
    },
  });

  useEffect(() => {
    reset({
      code: groupCode,
      name: groupName,
      pax: String(groupPax),
      totalBuses: String(requiredBusCount),
      arrivalDate: arrivalDate,
      returnDate: returnDate,
      parentGroupId: parentGroupId || "none",
    });
  }, [groupCode, groupName, groupPax, requiredBusCount, arrivalDate, returnDate, parentGroupId, reset]);

  const codeErrorMessage = errors.code?.message;
  const nameErrorMessage = errors.name?.message;
  const paxErrorMessage = errors.pax?.message;
  const totalBusesErrorMessage = errors.totalBuses?.message;
  const rootErrorMessage = errors.root?.message;
  const watchedPax = watch("pax");
  const previewPax = Number.parseInt((watchedPax ?? "").trim(), 10);
  const effectivePax = Number.isFinite(previewPax) && previewPax > 0 ? previewPax : groupPax;
  const minimumRequiredBusCount = useMemo(() => getMinimumBusCountForPax(effectivePax), [effectivePax]);

  return (
    <ModalPortal>
      <ModalShell onClose={onClose} ariaLabelledBy="group-edit-title" size="xl">
        <div id="group-edit-modal" ref={dialogRef}>
          <ModalHeader titleId="group-edit-title" title="Edit Group" onClose={onClose} />

          <form
            className={modalBodyClassName}
            onSubmit={handleSubmit(async (values) => {
              const result = await onSave({
                code: values.code.trim().toUpperCase(),
                name: values.name.trim(),
                pax: Number.parseInt(values.pax.trim(), 10),
                totalBuses: Number.parseInt(values.totalBuses.trim(), 10),
                arrivalDate: values.arrivalDate,
                returnDate: values.returnDate,
                parentGroupId: values.parentGroupId === "none" ? null : values.parentGroupId,
              });
              if (!result.ok) {
                setError("root", {
                  type: "server",
                  message: result.message,
                });
              }
            })}
          >
            <div className="space-y-1">
              <h2 id="group-edit-title" className="text-2xl font-bold tracking-tight text-slate-900">
                Edit Group
              </h2>
              <p className="text-sm text-slate-600">Update the group number, name, and required bus allocation.</p>
            </div>

            <label className={modalFieldClassName}>
              <span>Group Number</span>
              <input
                id="group-edit-code"
                className={modalInputClassName}
                type="text"
                {...register("code")}
                placeholder={groupCode}
                aria-invalid={getFieldAriaInvalid(codeErrorMessage)}
                aria-describedby={getFieldDescribedBy("group-edit-code", {
                  errorMessage: codeErrorMessage,
                })}
              />
            </label>
            <FieldErrorMessage fieldId="group-edit-code" message={codeErrorMessage} className={modalErrorClassName} />

            <label className={modalFieldClassName}>
              <span>Group Name</span>
              <input
                id="group-edit-name"
                className={modalInputClassName}
                type="text"
                {...register("name")}
                placeholder={groupName}
                aria-invalid={getFieldAriaInvalid(nameErrorMessage)}
                aria-describedby={getFieldDescribedBy("group-edit-name", {
                  errorMessage: nameErrorMessage,
                  extraDescribedBy: rootErrorMessage ? ["group-edit-root-error"] : [],
                })}
              />
            </label>
            <FieldErrorMessage fieldId="group-edit-name" message={nameErrorMessage} className={modalErrorClassName} />

            <label className={modalFieldClassName}>
              <span>Ikuti data dari Group (Sharing Musyrif & Itinerary)</span>
              <div className="relative">
                <Controller
                  control={control}
                  name="parentGroupId"
                  render={({ field }) => (
                    <SereneSelect
                      id="group-edit-parent"
                      className={modalSelectClassName}
                      value={field.value ?? "none"}
                      onChange={(event) => field.onChange(event.target.value)}
                    >
                      <option value="none">-- Mandiri (Tidak Terhubung) --</option>
                      {groups
                        .filter((g) => g.code !== groupCode)
                        .map((g) => (
                          <option key={g.id || g.code} value={g.id}>
                            {g.code} - {g.name}
                          </option>
                        ))}
                    </SereneSelect>
                  )}
                />
              </div>
            </label>

            <label className={modalFieldClassName}>
              <span>Total Pax</span>
              <input
                id="group-edit-pax"
                className={modalInputClassName}
                type="number"
                min={1}
                {...register("pax")}
                placeholder={String(groupPax)}
                aria-invalid={getFieldAriaInvalid(paxErrorMessage)}
                aria-describedby={getFieldDescribedBy("group-edit-pax", {
                  errorMessage: paxErrorMessage,
                })}
              />
            </label>
            <FieldErrorMessage fieldId="group-edit-pax" message={paxErrorMessage} className={modalErrorClassName} />

            <div className="grid gap-3 md:grid-cols-2">
              <label className={modalFieldClassName}>
                <span>Start Date</span>
                <Controller
                  control={control}
                  name="arrivalDate"
                  render={({ field }) => (
                    <DatePickerInput
                      id="group-edit-arrival-date"
                      inputClassName={modalInputClassName}
                      value={field.value}
                      onChange={field.onChange}
                      ariaInvalid={getFieldAriaInvalid(errors.arrivalDate?.message)}
                      ariaDescribedBy={getFieldDescribedBy("group-edit-arrival-date", {
                        errorMessage: errors.arrivalDate?.message,
                      })}
                    />
                  )}
                />
                <FieldErrorMessage
                  fieldId="group-edit-arrival-date"
                  message={errors.arrivalDate?.message}
                  className={modalErrorClassName}
                />
              </label>

              <label className={modalFieldClassName}>
                <span>End Date</span>
                <Controller
                  control={control}
                  name="returnDate"
                  render={({ field }) => (
                    <DatePickerInput
                      id="group-edit-return-date"
                      inputClassName={modalInputClassName}
                      value={field.value}
                      onChange={field.onChange}
                      ariaInvalid={getFieldAriaInvalid(errors.returnDate?.message)}
                      ariaDescribedBy={getFieldDescribedBy("group-edit-return-date", {
                        errorMessage: errors.returnDate?.message,
                      })}
                    />
                  )}
                />
                <FieldErrorMessage
                  fieldId="group-edit-return-date"
                  message={errors.returnDate?.message}
                  className={modalErrorClassName}
                />
              </label>
            </div>

            <label className={modalFieldClassName}>
              <span>Required Bus</span>
              <input
                id="group-edit-total-buses"
                className={modalInputClassName}
                type="number"
                min={minimumRequiredBusCount}
                {...register("totalBuses")}
                placeholder={String(requiredBusCount)}
                aria-invalid={getFieldAriaInvalid(totalBusesErrorMessage)}
                aria-describedby={getFieldDescribedBy("group-edit-total-buses", {
                  errorMessage: totalBusesErrorMessage,
                })}
              />
            </label>
            <FieldErrorMessage
              fieldId="group-edit-total-buses"
              message={totalBusesErrorMessage}
              className={modalErrorClassName}
            />
            <p className="text-xs font-medium text-slate-500">
              Minimum {minimumRequiredBusCount} bus untuk {effectivePax} pax. Kamu bisa isi lebih besar bila memang
              perlu armada tambahan.
            </p>
            {rootErrorMessage ? (
              <p id="group-edit-root-error" role="alert" aria-live="polite" className={modalErrorClassName}>
                {rootErrorMessage}
              </p>
            ) : null}

            <ModalFooter>
              <ModalFooterButton type="submit" variant="primary" disabled={isSubmitting} isLoading={isSubmitting}>
                Save Changes
              </ModalFooterButton>
              {isSubmitting ? (
                <p className="sr-only" role="status" aria-live="polite">
                  Saving group changes.
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
