import { Button } from "../../../components/button";

export function InvoiceFormHeader({
  isEditMode,
  isWorkspaceBusy,
  isBackendAvailable,
  isSavingDraft,
  isSubmitting,
  onBack,
  onSaveDraft,
  onSubmitButtonClick,
}: {
  isEditMode: boolean;
  isWorkspaceBusy: boolean;
  isBackendAvailable: boolean;
  isSavingDraft: boolean;
  isSubmitting: boolean;
  onBack: () => void;
  onSaveDraft: () => void;
  onSubmitButtonClick: () => void;
}) {
  return (
    <div className="serene-form-section">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <nav className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.13em] text-on-surface-variant/65">
            <button type="button" className="transition hover:text-primary" onClick={onBack}>
              Invoices
            </button>
            <span>/</span>
            <span className="text-primary">{isEditMode ? "Edit Invoice" : "Create New Invoice"}</span>
          </nav>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-on-surface sm:text-3xl">
            {isEditMode ? "Edit Invoice" : "New Invoice"}
          </h1>
        </div>

        <div className="serene-form-actions rounded-xl bg-surface-container-low p-2">
          {!isEditMode ? (
            <Button
              variant="secondary"
              onClick={onSaveDraft}
              disabled={isWorkspaceBusy || !isBackendAvailable}
              title={
                isBackendAvailable
                  ? undefined
                  : "Backend invoice/database belum terhubung, draft belum bisa disimpan."
              }
            >
              {isSavingDraft ? "Saving Draft..." : "Save Draft"}
            </Button>
          ) : null}
          <Button
            variant="primary"
            onClick={onSubmitButtonClick}
            disabled={isWorkspaceBusy || !isBackendAvailable}
            title={
              isBackendAvailable
                ? undefined
                : `Backend invoice/database belum terhubung, ${
                    isEditMode ? "perubahan invoice" : "invoice"
                  } belum bisa disimpan.`
            }
          >
            {isSubmitting
              ? isEditMode
                ? "Saving..."
                : "Generating..."
              : isEditMode
                ? "Save Changes"
                : "Generate Invoice"}
          </Button>
        </div>
      </div>
    </div>
  );
}
