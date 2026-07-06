import { Controller, FormProvider } from "react-hook-form";
import { createPortal } from "react-dom";
import { FieldErrorMessage, getFieldAriaInvalid, getFieldDescribedBy } from "../components/form-accessibility";
import { DatePickerInput } from "../components/date-time-pickers";
import { SereneSelect } from "../components/serene-select";
import { Button } from "../components/button";
import { useInvoiceWorkspaceForm } from "./invoice/hooks/use-invoice-workspace-form";
import { InvoiceFormHeader } from "./invoice/components/InvoiceFormHeader";
import { InvoiceClientSelection } from "./invoice/components/InvoiceClientSelection";
import { InvoiceLineItemsTable } from "./invoice/components/InvoiceLineItemsTable";
import { InvoiceSummaryCard } from "./invoice/components/InvoiceSummaryCard";
import { InvoiceNotesSection } from "./invoice/components/InvoiceNotesSection";
import { InvoicePaymentsSection } from "./invoice/components/InvoicePaymentsSection";
import {
  formatNumberInput,
  parseNumberInput,
  type InvoiceWorkspaceInitialData,
  type InvoiceClientOption,
  type SelectOption,
  type InvoiceStatusOption,
  type InvoiceRow,
} from "./invoice/helpers/invoice-page-shared";
import type { GroupData } from "../shared/app-domain";

export function CreateInvoiceWorkspace({
  mode,
  initialInvoice,
  clients,
  issuingOfficeOptions,
  invoiceStatusOptions,
  bankDisbursementOptions,
  manualClientNameSuggestions,
  groups,
  existingInvoiceNumbers,
  isBackendAvailable,
  onBack,
  onCreate,
  onUpdate,
}: {
  mode: "create" | "edit";
  initialInvoice?: InvoiceWorkspaceInitialData | null;
  clients: InvoiceClientOption[];
  issuingOfficeOptions: SelectOption[];
  invoiceStatusOptions: InvoiceStatusOption[];
  bankDisbursementOptions: SelectOption[];
  manualClientNameSuggestions: string[];
  groups: GroupData[];
  existingInvoiceNumbers: string[];
  isBackendAvailable: boolean;
  onBack: () => void;
  onCreate: (invoice: InvoiceRow, action: "generated" | "draft") => void;
  onUpdate: (invoice: InvoiceRow) => void;
}) {
  const formState = useInvoiceWorkspaceForm({
    mode,
    initialInvoice,
    clients,
    issuingOfficeOptions,
    bankDisbursementOptions,
    invoiceStatusOptions,
    existingInvoiceNumbers,
    isBackendAvailable,
    groups,
    onBack,
    onCreate,
    onUpdate,
  });

  const {
    methods,
    isDarkMode,
    isEditMode,
    usdToIdr,
    setUsdToIdr,
    sarToIdr,
    setSarToIdr,
    keepValasCurrency,
    setKeepValasCurrency,
    saveFeedback,
    isSubmitting,
    isSavingDraft,
    isCancelConfirmationOpen,
    setIsCancelConfirmationOpen,
    cancelConfirmationDialogRef,
    isWorkspaceBusy,
    formErrors,
    bankAccount,
    selectedClient,
    selectedGroup,
    nextInvoiceNumberPreview,
    handleSaveDraft,
    handleSubmitButtonClick,
    handleConfirmCancelledStatus,
  } = formState;

  const resolvedInitialInvoice = initialInvoice ?? null;
  const issueDateErrorMessage = formErrors.issueDateIso?.message as string | undefined;
  const dueDateErrorMessage = formErrors.dueDateIso?.message as string | undefined;
  const issuingOfficeErrorMessage = formErrors.issuingOffice?.message as string | undefined;
  const invoiceStatusErrorMessage = formErrors.invoiceStatus?.message as string | undefined;
  const bankAccountErrorMessage = formErrors.bankAccount?.message as string | undefined;

  const bankDisbursementHintClassName = isDarkMode
    ? "flex items-start gap-2 rounded-lg border border-outline-variant/45 bg-surface-container-high p-2"
    : "flex items-start gap-2 rounded-lg border border-emerald-100 bg-emerald-50/50 p-2";

  const invoiceCurrency = "IDR";

  return (
    <FormProvider {...methods}>
      <div
        className="mx-auto max-w-[88rem] space-y-6 px-4 pb-20 pt-4 sm:px-6 lg:px-8"
        aria-busy={isWorkspaceBusy ? "true" : "false"}
      >
        <section className="space-y-3">
          <Button
            variant="secondary"
            size="sm"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 sm:justify-start"
            onClick={onBack}
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              arrow_back
            </span>
            <span>Back to List</span>
          </Button>

          {!isBackendAvailable ? (
            <section
              className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900"
              role="status"
              aria-live="polite"
            >
              <span className="material-symbols-outlined mt-0.5 text-base" aria-hidden="true">
                warning
              </span>
              <p className="text-xs font-semibold leading-relaxed">
                Backend invoice/database belum terhubung.{" "}
                {isEditMode ? "Save Changes" : "Save Draft dan Generate Invoice"} dinonaktifkan sampai koneksi backend
                kembali normal.
              </p>
            </section>
          ) : null}

          {saveFeedback ? (
            <div
              className={`rounded-xl border px-4 py-3 text-xs font-semibold shadow-sm transition-all duration-300 ${
                saveFeedback.toLowerCase().includes("failed") ||
                saveFeedback.toLowerCase().includes("invalid") ||
                saveFeedback.toLowerCase().includes("select") ||
                saveFeedback.toLowerCase().includes("isi")
                  ? "border-rose-200 bg-rose-50 text-rose-900"
                  : "border-primary/10 bg-primary/5 text-primary"
              }`}
              role="status"
              aria-live="assertive"
            >
              {saveFeedback}
            </div>
          ) : null}

          <InvoiceFormHeader
            isEditMode={isEditMode}
            isWorkspaceBusy={isWorkspaceBusy}
            isBackendAvailable={isBackendAvailable}
            isSavingDraft={isSavingDraft}
            isSubmitting={isSubmitting}
            onBack={onBack}
            onSaveDraft={handleSaveDraft}
            onSubmitButtonClick={handleSubmitButtonClick}
          />
        </section>

        <div className="grid grid-cols-12 gap-5">
          <section className="col-span-12 space-y-5 lg:col-span-9">
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <article className="serene-form-section">
                <h3 className="serene-form-section-header text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
                  <span className="material-symbols-outlined text-sm" aria-hidden="true">
                    confirmation_number
                  </span>
                  <span>Invoice Details</span>
                </h3>

                <div className="grid grid-cols-1 gap-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="space-y-1">
                      <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface-variant/70">
                        Invoice Number
                      </span>
                      <input
                        type="text"
                        className="h-10 w-full rounded-lg border-none bg-surface-container-low px-3 text-xs font-bold text-on-surface outline-none ring-0 focus:ring-2 focus:ring-primary/20"
                        value={
                          isEditMode && resolvedInitialInvoice
                            ? resolvedInitialInvoice.invoiceNumber
                            : nextInvoiceNumberPreview
                        }
                        readOnly
                      />
                    </label>

                    <label className="space-y-1">
                      <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface-variant/70">
                        Issue Date
                      </span>
                      <Controller
                        name="issueDateIso"
                        control={methods.control}
                        render={({ field }) => (
                          <DatePickerInput
                            id="invoice-issue-date"
                            inputClassName="h-10 w-full rounded-lg border-none bg-surface-container-low px-3 text-xs font-semibold text-on-surface outline-none ring-0 focus:ring-2 focus:ring-primary/20"
                            value={field.value}
                            onChange={field.onChange}
                            ariaInvalid={getFieldAriaInvalid(issueDateErrorMessage)}
                            ariaDescribedBy={getFieldDescribedBy("invoice-issue-date", {
                              errorMessage: issueDateErrorMessage,
                            })}
                          />
                        )}
                      />
                      <FieldErrorMessage fieldId="invoice-issue-date" message={issueDateErrorMessage} />
                    </label>
                  </div>

                  <label className="space-y-1">
                    <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface-variant/70">
                      Due Date
                    </span>
                    <Controller
                      name="dueDateIso"
                      control={methods.control}
                      render={({ field }) => (
                        <DatePickerInput
                          id="invoice-due-date"
                          inputClassName="h-10 w-full rounded-lg border-none bg-surface-container-low px-3 text-xs font-semibold text-on-surface outline-none ring-0 focus:ring-2 focus:ring-primary/20"
                          value={field.value || ""}
                          onChange={field.onChange}
                          ariaInvalid={getFieldAriaInvalid(dueDateErrorMessage)}
                          ariaDescribedBy={getFieldDescribedBy("invoice-due-date", {
                            errorMessage: dueDateErrorMessage,
                          })}
                        />
                      )}
                    />
                    <FieldErrorMessage fieldId="invoice-due-date" message={dueDateErrorMessage} />
                  </label>

                  <label className="space-y-1">
                    <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface-variant/70">
                      Issuing Office
                    </span>
                    <Controller
                      name="issuingOffice"
                      control={methods.control}
                      render={({ field }) => (
                        <SereneSelect
                          id="invoice-issuing-office"
                          className="serene-select h-10 rounded-lg bg-surface-container-low text-xs font-semibold text-on-surface"
                          value={field.value}
                          onChange={(event) => {
                            methods.clearErrors("issuingOffice");
                            field.onChange(event.target.value);
                          }}
                          aria-invalid={getFieldAriaInvalid(issuingOfficeErrorMessage)}
                          aria-describedby={getFieldDescribedBy("invoice-issuing-office", {
                            errorMessage: issuingOfficeErrorMessage,
                          })}
                        >
                          <option value="">Select office</option>
                          {issuingOfficeOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </SereneSelect>
                      )}
                    />
                    <FieldErrorMessage fieldId="invoice-issuing-office" message={issuingOfficeErrorMessage} />
                  </label>

                  <label className="space-y-1">
                    <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface-variant/70">
                      Invoice Status
                    </span>
                    <Controller
                      name="invoiceStatus"
                      control={methods.control}
                      render={({ field }) => (
                        <SereneSelect
                          id="invoice-status"
                          className="serene-select h-10 rounded-lg bg-surface-container-low text-xs font-semibold text-on-surface"
                          value={field.value}
                          onChange={(event) => {
                            methods.clearErrors("invoiceStatus");
                            field.onChange(event.target.value);
                          }}
                          aria-invalid={getFieldAriaInvalid(invoiceStatusErrorMessage)}
                          aria-describedby={getFieldDescribedBy("invoice-status", {
                            errorMessage: invoiceStatusErrorMessage,
                          })}
                        >
                          <option value="">Select status</option>
                          {invoiceStatusOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </SereneSelect>
                      )}
                    />
                    <FieldErrorMessage fieldId="invoice-status" message={invoiceStatusErrorMessage} />
                  </label>
                </div>
              </article>

              <InvoiceClientSelection
                clients={clients}
                groups={groups}
                manualClientNameSuggestions={manualClientNameSuggestions}
              />
            </div>

            <InvoiceLineItemsTable
              usdToIdr={usdToIdr}
              sarToIdr={sarToIdr}
              selectedGroup={selectedGroup}
            />

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <div className="space-y-5">
                <article className="serene-form-section">
                  <h3 className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant/70">
                    Bank Disbursement
                  </h3>
                  <div className="space-y-3">
                    <Controller
                      name="bankAccount"
                      control={methods.control}
                      render={({ field }) => (
                        <SereneSelect
                          id="invoice-bank-account"
                          className="serene-select h-10 rounded-lg bg-surface-container-low text-xs font-semibold text-on-surface"
                          value={field.value}
                          onChange={(event) => {
                            methods.clearErrors("bankAccount");
                            field.onChange(event.target.value);
                          }}
                          aria-invalid={getFieldAriaInvalid(bankAccountErrorMessage)}
                          aria-describedby={getFieldDescribedBy("invoice-bank-account", {
                            errorMessage: bankAccountErrorMessage,
                          })}
                        >
                          <option value="">Select bank account</option>
                          {bankDisbursementOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </SereneSelect>
                      )}
                    />
                    <FieldErrorMessage fieldId="invoice-bank-account" message={bankAccountErrorMessage} />
                    {bankAccount ? (
                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-surface-container-low p-2.5 flex items-center justify-between text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                        <span className="text-slate-500 dark:text-slate-400 font-medium">Penerima / Beneficiary:</span>
                        <strong className="text-primary font-extrabold uppercase">
                          {(() => {
                            const matchedBank = bankDisbursementOptions.find((o) => o.value === bankAccount);
                            return matchedBank?.metadata?.penerima || matchedBank?.metadata?.beneficiary || matchedBank?.metadata?.recipient || matchedBank?.metadata?.recipientName || "PT. Ghaniya Zilia Rahman";
                          })()}
                        </strong>
                      </div>
                    ) : null}
                    <div className={bankDisbursementHintClassName}>
                      <span className="material-symbols-outlined mt-0.5 text-sm text-primary" aria-hidden="true">
                        info
                      </span>
                      <p className="text-[10px] italic leading-tight text-on-surface-variant">
                        This account will be visible on the final invoice PDF for payment.
                      </p>
                    </div>
                  </div>
                </article>

                <article className="serene-form-section">
                  <h3 className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant/70">
                    Exchange Rates
                  </h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="space-y-1">
                      <span className="block text-[9px] font-bold uppercase tracking-[0.11em] text-on-surface-variant/65">
                        USD/IDR
                      </span>
                      <input
                        type="text"
                        className="h-10 w-full rounded-lg border border-outline-variant/35 bg-surface-container-low px-3 text-xs font-bold text-on-surface outline-none ring-0 focus:ring-2 focus:ring-primary/20"
                        value={formatNumberInput(usdToIdr)}
                        onChange={(event) => {
                          const val = Math.max(0, parseNumberInput(event.target.value));
                          setUsdToIdr(val);
                        }}
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="block text-[9px] font-bold uppercase tracking-[0.11em] text-on-surface-variant/65">
                        SAR/IDR
                      </span>
                      <input
                        type="text"
                        className="h-10 w-full rounded-lg border border-outline-variant/35 bg-surface-container-low px-3 text-xs font-bold text-on-surface outline-none ring-0 focus:ring-2 focus:ring-primary/20"
                        value={formatNumberInput(sarToIdr)}
                        onChange={(event) => {
                          const val = Math.max(0, parseNumberInput(event.target.value));
                          setSarToIdr(val);
                        }}
                      />
                    </label>
                  </div>
                </article>

                <InvoiceNotesSection />
              </div>

              <div>
                <InvoicePaymentsSection
                  usdToIdr={usdToIdr}
                  sarToIdr={sarToIdr}
                  keepValasCurrency={keepValasCurrency}
                  invoiceCurrency={invoiceCurrency}
                />
              </div>
            </div>
          </section>

          <InvoiceSummaryCard
            usdToIdr={usdToIdr}
            sarToIdr={sarToIdr}
            keepValasCurrency={keepValasCurrency}
            handleKeepValasCurrencyChange={setKeepValasCurrency}
            isDarkMode={isDarkMode}
            invoiceCurrency={invoiceCurrency}
          />
        </div>

        {isCancelConfirmationOpen && typeof document !== "undefined"
          ? createPortal(
              <div
                ref={cancelConfirmationDialogRef}
                className="serene-modal-overlay fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto p-3 pt-10 pb-10 sm:p-4 sm:pt-20 sm:pb-20"
                role="dialog"
                aria-modal="true"
                aria-labelledby="invoice-cancel-confirmation-title"
                aria-describedby="invoice-cancel-confirmation-description"
                tabIndex={-1}
                onClick={() => setIsCancelConfirmationOpen(false)}
              >
                <section
                  className="serene-modal-shell w-full max-w-[32rem] overflow-hidden"
                  onClick={(event) => event.stopPropagation()}
                >
                  <header className="serene-dialog-header border-b border-outline-variant/35 bg-surface-container-lowest px-4 py-4 sm:px-5">
                    <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-200 text-amber-800">
                      <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
                        warning
                      </span>
                    </div>

                    <div>
                      <h2
                        id="invoice-cancel-confirmation-title"
                        className="font-display text-2xl font-bold tracking-tight text-on-surface"
                      >
                        Konfirmasi Status Cancelled
                      </h2>
                    </div>
                  </header>

                  <div
                    id="invoice-cancel-confirmation-description"
                    className="serene-dialog-body bg-surface-container-lowest px-4 py-4 text-sm leading-relaxed text-on-surface-variant sm:px-5"
                  >
                    <p>Invoice ini akan disimpan sebagai Cancelled. Lanjutkan penyimpanan?</p>
                    <p>Status cancelled akan menandai invoice sebagai dibatalkan.</p>
                    <p>Amount invoice juga akan otomatis menjadi 0 saat disimpan.</p>
                  </div>

                  <footer className="serene-dialog-footer-bar bg-surface-container-lowest px-4 py-4 sm:px-5">
                    <button
                      type="button"
                      className="serene-btn-secondary min-h-10 rounded-2xl px-6 py-2 text-lg font-semibold"
                      onClick={() => setIsCancelConfirmationOpen(false)}
                      disabled={isSubmitting}
                    >
                      Kembali
                    </button>
                    <button
                      type="button"
                      className="serene-btn-primary min-h-10 rounded-2xl px-6 py-2 text-lg font-bold"
                      onClick={handleConfirmCancelledStatus}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? "Menyimpan..." : "Ya, Simpan"}
                    </button>
                  </footer>
                </section>
              </div>,
              document.body,
            )
          : null}
      </div>
    </FormProvider>
  );
}
