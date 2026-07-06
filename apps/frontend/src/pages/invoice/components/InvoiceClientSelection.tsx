import { useFormContext, Controller } from "react-hook-form";
import { SereneSelect } from "../../../components/serene-select";
import { FieldErrorMessage, getFieldAriaInvalid, getFieldDescribedBy } from "../../../components/form-accessibility";
import { MANUAL_CLIENT_OPTION_ID, type InvoiceClientOption } from "../../invoice-page-shared";
import type { GroupData } from "../../../shared/app-domain";

export function InvoiceClientSelection({
  clients,
  groups,
  manualClientNameSuggestions,
}: {
  clients: InvoiceClientOption[];
  groups: GroupData[];
  manualClientNameSuggestions: string[];
}) {
  const { control, register, setValue, clearErrors, watch, formState: { errors: formErrors } } = useFormContext();

  const selectedClientId = watch("selectedClientId");
  const isManualClientSelected = selectedClientId === MANUAL_CLIENT_OPTION_ID;

  const selectedClientErrorMessage = formErrors.selectedClientId?.message as string | undefined;
  const manualClientNameErrorMessage = formErrors.manualClientName?.message as string | undefined;

  return (
    <article className="serene-form-section">
      <h3 className="serene-form-section-header text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
        <span className="material-symbols-outlined text-sm" aria-hidden="true">
          person_pin
        </span>
        <span>Client Information</span>
      </h3>

      <div className="grid grid-cols-1 gap-3">
        <label className="space-y-1">
          <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface-variant/70">
            Client Name
          </span>
          <Controller
            name="selectedClientId"
            control={control}
            render={({ field }) => (
              <SereneSelect
                id="invoice-client"
                className="serene-select h-10 rounded-lg bg-surface-container-low text-xs font-semibold text-on-surface"
                value={field.value}
                onChange={(event) => {
                  const nextClientId = event.target.value;
                  clearErrors(["selectedClientId", "manualClientName"]);
                  field.onChange(nextClientId);
                  if (nextClientId === MANUAL_CLIENT_OPTION_ID) {
                    setValue("manualClientName", "");
                    setValue("recipientName", "", { shouldDirty: true });
                  } else if (nextClientId) {
                    const matchedClient = clients.find((client) => client.id === nextClientId);
                    if (matchedClient) {
                      const metadata = (matchedClient as any)?.metadata;
                      const defaultRecipient = metadata?.penerima || "";
                      setValue("recipientName", defaultRecipient, { shouldDirty: true });
                      if (matchedClient.groupCode) {
                        setValue("selectedGroupCode", matchedClient.groupCode, { shouldDirty: true });
                      }
                      setValue("address", matchedClient.name, { shouldDirty: true });
                    }
                  } else {
                    setValue("recipientName", "", { shouldDirty: true });
                  }
                }}
                aria-invalid={getFieldAriaInvalid(selectedClientErrorMessage)}
                aria-describedby={getFieldDescribedBy("invoice-client", {
                  errorMessage: selectedClientErrorMessage,
                })}
              >
                <option value="">Select client</option>
                <option value={MANUAL_CLIENT_OPTION_ID}>Other</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </SereneSelect>
            )}
          />
          <FieldErrorMessage fieldId="invoice-client" message={selectedClientErrorMessage} />
        </label>

        {isManualClientSelected ? (
          <label className="space-y-1">
            <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface-variant/70">
              Manual Client Name
            </span>
            <input
              id="invoice-manual-client-name"
              type="text"
              className="h-10 w-full rounded-lg border-none bg-surface-container-low px-3 text-xs font-semibold text-on-surface outline-none ring-0 focus:ring-2 focus:ring-primary/20"
              list="invoice-manual-client-suggestions"
              placeholder="Type client name..."
              {...register("manualClientName")}
              aria-invalid={getFieldAriaInvalid(manualClientNameErrorMessage)}
              aria-describedby={getFieldDescribedBy("invoice-manual-client-name", {
                errorMessage: manualClientNameErrorMessage,
              })}
            />
            {manualClientNameSuggestions.length > 0 ? (
              <datalist id="invoice-manual-client-suggestions">
                {manualClientNameSuggestions.map((suggestion) => (
                  <option key={suggestion} value={suggestion} />
                ))}
              </datalist>
            ) : null}
            <FieldErrorMessage fieldId="invoice-manual-client-name" message={manualClientNameErrorMessage} />
          </label>
        ) : null}

        <label className="space-y-1">
          <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface-variant/70">
            Linked Group (Optional)
          </span>
          <Controller
            name="selectedGroupCode"
            control={control}
            render={({ field }) => (
              <SereneSelect
                className="serene-select h-10 rounded-lg bg-surface-container-low text-xs font-semibold text-on-surface"
                value={field.value}
                onChange={(event) => field.onChange(event.target.value)}
              >
                <option value="">No linked group</option>
                {groups.map((group) => (
                  <option key={group.code} value={group.code}>
                    {group.code} - {group.name}
                  </option>
                ))}
              </SereneSelect>
            )}
          />
        </label>

        <label className="space-y-1">
          <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface-variant/70">
            Address
          </span>
          <input
            type="text"
            className="h-10 w-full rounded-lg border-none bg-surface-container-low px-3 text-xs font-semibold text-on-surface outline-none ring-0 focus:ring-2 focus:ring-primary/20"
            placeholder="Primary business address..."
            {...register("address")}
          />
        </label>

        <label className="space-y-1">
          <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface-variant/70">
            Nama Penerima / U.p.
          </span>
          <input
            type="text"
            className="h-10 w-full rounded-lg border-none bg-surface-container-low px-3 text-xs font-semibold text-on-surface outline-none ring-0 focus:ring-2 focus:ring-primary/20"
            placeholder="Nama PIC penerima invoice..."
            {...register("recipientName")}
          />
        </label>
      </div>
    </article>
  );
}
