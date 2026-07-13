import { DatePickerInput } from "../../../components/date-time-pickers";
import { SereneSelect } from "../../../components/serene-select";
import { useNewGroupContext } from "../context/NewGroupContext";
import type { AgreementApprovalStatus, NewGroupAgreementFormState } from "../../../shared/app-domain";
import * as Domain from "../../../shared/app-domain";

export function NewGroupHotelsSection() {
  const {
    makkahHotels,
    madinahHotels,
    agreementDraftOptionsByCity,
    selectedAgreementDraftIds,
    safePax,
    resolvedGroupCode,
    agreementDateConnection,
    agreementSaveValidationError,
    agreementSaveStatus,
    draftsLoading,
    isDraftsError,
    handleAgreementDraftSelect,
    handleAgreementChange,
    handleAddAgreement,
    handleRemoveAgreement,
    handleClearAgreement,
    handleSaveAgreement,
    getInvoiceToneDotClasses,
    getInvoiceToneClasses,
    getAgreementStatusTone,
    getToneSelectClassName,
    getAgreementStatusChipClassName,
    formatAgreementStayRange,
  } = useNewGroupContext();

  const { resolveVisaAgreementNumber } = Domain;

  const sectionClassName = "serene-section";
  const fieldClassName = "serene-field";
  const controlClassName = "serene-input";
  const selectClassName = "serene-select";
  const toneDotClassName =
    "pointer-events-none absolute left-3 top-1/2 z-10 h-2.5 w-2.5 -translate-y-1/2 rounded-full border";

  const getAgreementSaveClasses = (tone: "success" | "warning" | "error") => {
    if (tone === "success") {
      return "border-primary/35 bg-primary-fixed text-on-primary-fixed-variant";
    }

    if (tone === "warning") {
      return "border-tertiary-fixed/60 bg-tertiary-fixed text-on-tertiary-fixed-variant";
    }

    return "border-error-container/65 bg-error-container text-on-error-container";
  };

  const toCityLabel = (city: "makkah" | "madinah") => (city === "makkah" ? "Makkah" : "Madinah");

  const formatAgreementDraftDateRange = (draft: any) => {
    const startDate = draft.stayStartIso ? Domain.formatScheduleDate(draft.stayStartIso) : null;
    const endDate = draft.stayEndIso ? Domain.formatScheduleDate(draft.stayEndIso) : null;

    if (startDate && endDate) {
      return `${startDate.date} ${startDate.year} - ${endDate.date} ${endDate.year}`;
    }

    if (startDate) {
      return `Start ${startDate.date} ${startDate.year}`;
    }

    if (endDate) {
      return `End ${endDate.date} ${endDate.year}`;
    }

    return "Stay dates pending";
  };

  const formatAgreementDraftOptionLabel = (draft: any) => {
    const agentLabel = draft.agentName ? `${draft.agentName} - ` : "";
    return `${agentLabel}${draft.hotelName} - ${draft.agreementNumber} - Pax ${draft.pax} - ${formatAgreementDraftDateRange(
      draft
    )}`;
  };

  const renderAgreementSection = (city: "makkah" | "madinah", agreements: NewGroupAgreementFormState[]) => {
    const cityDraftOptions = agreementDraftOptionsByCity[city] ?? [];
    const draftSelectPlaceholder = draftsLoading
      ? "Loading agreements..."
      : cityDraftOptions.length === 0
      ? "No available agreements"
      : "Select from Agreement Inbox";

    return (
      <div className="rounded-2xl bg-surface-container-low p-4 shadow-ambient">
        <div className="mb-3 flex items-center gap-2 text-on-surface">
          <span className="material-symbols-outlined text-primary" aria-hidden="true">
            location_on
          </span>
          <h3 className="text-lg font-semibold">{toCityLabel(city)} Subsection</h3>
        </div>

        <div className="space-y-3">
          {agreements.map((agreement, index) => (
            <details key={agreement.id} className="serene-accordion">
              <summary className="serene-accordion-summary">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="truncate text-base font-semibold text-on-surface">
                      {agreement.hotelName.trim() || `Hotel ${index + 1}`}
                    </h4>
                    <span className={getAgreementStatusChipClassName(agreement.status)}>{agreement.status}</span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-on-surface-variant">
                    {agreement.agreementNumber.trim() || "Agreement number pending"} · Pax {agreement.pax.trim() || "0"}{" "}
                    · {formatAgreementStayRange(agreement)}
                  </p>
                </div>
                <span
                  className="serene-accordion-chevron material-symbols-outlined text-on-surface-variant"
                  aria-hidden="true"
                >
                  expand_more
                </span>
              </summary>

              <div className="serene-accordion-content">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className={`${fieldClassName} md:col-span-2`}>
                    <span>Agreement Inbox</span>
                    <SereneSelect
                      className={selectClassName}
                      value={agreement.sourceDraftId ?? ""}
                      onChange={(event) => handleAgreementDraftSelect(city, index, event.target.value)}
                      disabled={draftsLoading && cityDraftOptions.length === 0}
                    >
                      <option value="">{draftSelectPlaceholder}</option>
                      {cityDraftOptions.map((draft: any) => {
                        const isDraftSelectedElsewhere =
                          selectedAgreementDraftIds.has(draft.id) && agreement.sourceDraftId !== draft.id;
                        return (
                          <option key={draft.id} value={draft.id} disabled={isDraftSelectedElsewhere}>
                            {formatAgreementDraftOptionLabel(draft)}
                          </option>
                        );
                      })}
                    </SereneSelect>
                  </label>

                  <label className={`${fieldClassName} md:col-span-2`}>
                    <span>Hotel Name</span>
                    <input
                      className={controlClassName}
                      type="text"
                      value={agreement.hotelName}
                      onChange={(event) => handleAgreementChange(city, index, "hotelName", event.target.value)}
                      placeholder={`e.g. ${toCityLabel(city)} Main Hotel`}
                    />
                  </label>

                  <label className={`${fieldClassName} md:col-span-2`}>
                    <span>Agreement Number</span>
                    <input
                      className={controlClassName}
                      type="text"
                      value={agreement.agreementNumber}
                      onChange={(event) => handleAgreementChange(city, index, "agreementNumber", event.target.value)}
                      placeholder={resolveVisaAgreementNumber(
                        { groupCode: resolvedGroupCode || "901794508" },
                        undefined,
                        city
                      )}
                    />
                  </label>

                  <label className={fieldClassName}>
                    <span>Pax</span>
                    <input
                      className={controlClassName}
                      type="number"
                      min={0}
                      value={agreement.pax}
                      onChange={(event) => handleAgreementChange(city, index, "pax", event.target.value)}
                      placeholder={String(safePax || 0)}
                    />
                  </label>

                  <label className={fieldClassName}>
                    <span>Status</span>
                    <div className="relative">
                      <span
                        className={`${toneDotClassName} ${getInvoiceToneDotClasses(
                          getAgreementStatusTone(agreement.status)
                        )}`}
                        aria-hidden="true"
                      />
                      <SereneSelect
                        className={getToneSelectClassName(getAgreementStatusTone(agreement.status))}
                        value={agreement.status}
                        onChange={(event) =>
                          handleAgreementChange(city, index, "status", event.target.value as AgreementApprovalStatus)
                        }
                      >
                        <option value="Waiting for Approval">Waiting for Approval</option>
                        <option value="Approved">Approved</option>
                      </SereneSelect>
                    </div>
                  </label>

                  <label className={fieldClassName}>
                    <span>Stay Start</span>
                    <DatePickerInput
                      inputClassName={controlClassName}
                      value={agreement.stayStartIso}
                      onChange={(nextValue) => handleAgreementChange(city, index, "stayStartIso", nextValue)}
                    />
                  </label>

                  <label className={fieldClassName}>
                    <span>Stay End</span>
                    <DatePickerInput
                      inputClassName={controlClassName}
                      value={agreement.stayEndIso}
                      onChange={(nextValue) => handleAgreementChange(city, index, "stayEndIso", nextValue)}
                    />
                  </label>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-md border border-outline-variant/45 bg-surface-container-lowest px-3 py-1.5 text-xs font-semibold text-on-surface-variant transition hover:border-primary/35 hover:text-primary"
                    onClick={() => handleClearAgreement(city, index)}
                  >
                    <span className="material-symbols-outlined" aria-hidden="true">
                      close
                    </span>
                    <span>Clear</span>
                  </button>

                  {agreements.length > 1 ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-md bg-error-container px-3 py-1.5 text-xs font-semibold text-on-error-container transition hover:brightness-95"
                      onClick={() => handleRemoveAgreement(city, index)}
                    >
                      <span className="material-symbols-outlined" aria-hidden="true">
                        delete
                      </span>
                      <span>Remove Hotel {index + 1}</span>
                    </button>
                  ) : null}
                </div>
              </div>
            </details>
          ))}
        </div>

        {agreementDateConnection.cityWarnings[city] ? (
          <div
            className="mt-3 flex items-start gap-2 rounded-md bg-tertiary-fixed px-3 py-2 text-sm text-on-tertiary-fixed-variant"
            role="status"
            aria-live="polite"
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              warning
            </span>
            <p>{agreementDateConnection.cityWarnings[city]}</p>
          </div>
        ) : null}

        <div className="mt-3 flex justify-end">
          <button
            type="button"
            className="inline-flex items-center text-sm font-semibold text-primary transition hover:text-primary/85 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            onClick={() => handleAddAgreement(city)}
          >
            <span>Add Hotel</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <section className={sectionClassName}>
      <h2 className="mb-4 font-display text-xl font-semibold text-on-surface">Agreement Hotel</h2>
      {isDraftsError ? (
        <div
          className="mb-4 flex items-start gap-2 rounded-md border border-error-container/65 bg-error-container px-3 py-2 text-sm text-on-error-container"
          role="status"
          aria-live="polite"
        >
          <span className="material-symbols-outlined text-base" aria-hidden="true">
            error
          </span>
          <p>Agreement Inbox belum bisa dimuat. Input manual tetap tersedia.</p>
        </div>
      ) : null}
      {agreementDateConnection.crossCityWarning ? (
        <div
          className="mb-4 flex items-start gap-2 rounded-md bg-tertiary-fixed p-3 text-sm text-on-tertiary-fixed-variant"
          role="status"
          aria-live="polite"
        >
          <span className="material-symbols-outlined text-base" aria-hidden="true">
            warning
          </span>
          <p>{agreementDateConnection.crossCityWarning}</p>
        </div>
      ) : null}
      <div className="grid gap-4 xl:grid-cols-2">
        {renderAgreementSection("makkah", makkahHotels)}
        {renderAgreementSection("madinah", madinahHotels)}
      </div>
      {agreementSaveStatus ? (
        <div
          className={`mt-4 flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${getAgreementSaveClasses(
            agreementSaveStatus.tone
          )}`}
          role="status"
          aria-live="polite"
        >
          <span className="material-symbols-outlined text-base" aria-hidden="true">
            {agreementSaveStatus.tone === "success"
              ? "check_circle"
              : agreementSaveStatus.tone === "error"
              ? "error"
              : "info"}
          </span>
          <p>{agreementSaveStatus.message}</p>
        </div>
      ) : null}
      <div className="serene-form-actions mt-4 serene-form-actions-fill">
        <button
          type="button"
          className="serene-btn-primary min-h-10 w-full sm:w-auto"
          onClick={handleSaveAgreement}
        >
          <span className="material-symbols-outlined text-base" aria-hidden="true">
            task_alt
          </span>
          <span>Save Agreement</span>
        </button>
      </div>
    </section>
  );
}
