import { fireEvent, render, screen } from "@testing-library/react";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import { InvoiceClientSelection } from "../../pages/invoice/components/InvoiceClientSelection";
import { MANUAL_CLIENT_OPTION_ID } from "../../pages/invoice/helpers/invoice-page-shared";
import { baseGroups } from "../../shared/app-domain";

vi.mock("../../hooks/use-agents-backend", () => ({
  useAgentsQuery: () => ({
    data: [
      { id: "agent-a", name: "Agent Alpha", status: "ACTIVE" },
      { id: "agent-b", name: "Agent Beta", status: "ACTIVE" },
      { id: "inactive", name: "Inactive Agent", status: "INACTIVE" },
    ],
  }),
}));

function InvoiceForm() {
  const form = useForm({
    defaultValues: {
      agentId: "agent-a",
      selectedClientId: "",
      manualClientName: "",
      recipientName: "",
      address: "",
      selectedGroupCode: "GROUP-A",
    },
  });
  return (
    <FormProvider {...form}>
      <InvoiceClientSelection
        clients={[
          { id: "client-a", name: "Client Alpha", label: "Client Alpha", sortOrder: 0 },
          {
            id: "client-b",
            name: "Client Beta",
            label: "Client Beta",
            sortOrder: 1,
            groupCode: "GROUP-B",
            metadata: { penerima: "PIC Beta" },
          },
        ]}
        groups={[
          { ...baseGroups[0], agentId: "agent-a", code: "GROUP-A", name: "Group Alpha" },
          { ...baseGroups[0], agentId: "agent-b", code: "GROUP-B", name: "Group Beta" },
        ]}
        manualClientNameSuggestions={["Manual Client"]}
      />
      <output data-testid="form-values">{JSON.stringify(form.watch())}</output>
    </FormProvider>
  );
}

const getFormValues = () => JSON.parse(screen.getByTestId("form-values").textContent!);

describe("invoice name selection", () => {
  it("searches clients while keeping recipient, address, and linked group defaults", () => {
    render(<InvoiceForm />);
    fireEvent.click(screen.getByRole("button", { name: /^Client Name/ }));
    expect(screen.getByRole("option", { name: "Other" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Client Alpha" })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Cari nama client..." }), { target: { value: "bEtA" } });
    expect(screen.getAllByRole("option")).toHaveLength(1);
    fireEvent.click(screen.getByRole("option", { name: "Client Beta" }));
    expect(getFormValues()).toMatchObject({
      selectedClientId: "client-b",
      recipientName: "PIC Beta",
      address: "Client Beta",
      selectedGroupCode: "GROUP-B",
    });
  });

  it("keeps the Other option and manual client name suggestions available", () => {
    render(<InvoiceForm />);
    fireEvent.click(screen.getByRole("button", { name: /^Client Name/ }));
    fireEvent.change(screen.getByRole("combobox", { name: "Cari nama client..." }), { target: { value: "other" } });
    fireEvent.click(screen.getByRole("option", { name: "Other" }));
    const manualName = screen.getByRole("combobox", { name: "Manual Client Name" });
    expect(manualName).toHaveAttribute("list", "invoice-manual-client-suggestions");
    fireEvent.change(manualName, { target: { value: "New Client" } });
    expect(getFormValues()).toMatchObject({
      selectedClientId: MANUAL_CLIENT_OPTION_ID,
      manualClientName: "New Client",
    });
  });

  it("searches active agents and resets the linked group only after selecting another agent", () => {
    render(<InvoiceForm />);
    fireEvent.click(screen.getByLabelText("Agent"));
    expect(screen.queryByRole("option", { name: "Inactive Agent" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Cari nama agent..." }), { target: { value: "beta" } });
    expect(getFormValues()).toMatchObject({ agentId: "agent-a", selectedGroupCode: "GROUP-A" });
    fireEvent.click(screen.getByRole("option", { name: "Agent Beta" }));
    expect(getFormValues()).toMatchObject({ agentId: "agent-b", selectedGroupCode: "" });
    fireEvent.click(screen.getByRole("button", { name: /^Linked Group/ }));
    expect(screen.getByRole("option", { name: "GROUP-B - Group Beta" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "GROUP-A - Group Alpha" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Cari nama agent..." })).not.toBeInTheDocument();
  });
});
