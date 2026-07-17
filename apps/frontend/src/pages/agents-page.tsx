import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createAgent,
  setAgentStatus,
  updateAgent,
  useAgentsQuery,
  type AgentOption,
} from "../hooks/use-agents-backend";

type AgentFormValues = {
  code: string;
  name: string;
  picName: string;
  phone: string;
  email: string;
};

const EMPTY_AGENT_FORM: AgentFormValues = { code: "", name: "", picName: "", phone: "", email: "" };

function formFromAgent(agent: AgentOption): AgentFormValues {
  return {
    code: agent.code,
    name: agent.name,
    picName: agent.picName ?? "",
    phone: agent.phone ?? "",
    email: agent.email ?? "",
  };
}

function normalizeAgentForm(form: AgentFormValues) {
  return {
    code: form.code.trim(),
    name: form.name.trim(),
    picName: form.picName.trim() || undefined,
    phone: form.phone.trim() || undefined,
    email: form.email.trim() || undefined,
  };
}

function AgentForm({
  initialValues,
  submitLabel,
  isSubmitting,
  onSubmit,
  onCancel,
}: {
  initialValues: AgentFormValues;
  submitLabel: string;
  isSubmitting: boolean;
  onSubmit: (values: AgentFormValues) => void;
  onCancel?: () => void;
}) {
  const [form, setForm] = useState(initialValues);
  const update = (key: keyof AgentFormValues, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  return (
    <form
      className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(form);
      }}
    >
      <div className="grid gap-3 md:grid-cols-2">
        {([[
          "code",
          "Agent Code",
          "AL-FALAH",
        ], ["name", "Agent Name", "PT Al Falah Travel"], ["picName", "PIC", "Nama PIC"], ["phone", "Phone", "+62..."], ["email", "Email", "ops@agent.com"]] as const).map(
          ([key, label, placeholder]) => (
            <label key={key} className="serene-field">
              <span>{label}</span>
              <input
                className="serene-input"
                type={key === "email" ? "email" : "text"}
                required={key === "code" || key === "name"}
                placeholder={placeholder}
                value={form[key]}
                onChange={(event) => update(key, event.target.value)}
              />
            </label>
          ),
        )}
      </div>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        {onCancel ? (
          <button type="button" className="serene-btn-secondary" onClick={onCancel} disabled={isSubmitting}>
            Batal
          </button>
        ) : null}
        <button
          type="submit"
          className="serene-btn-primary"
          disabled={!form.code.trim() || !form.name.trim() || isSubmitting}
        >
          {isSubmitting ? "Menyimpan..." : submitLabel}
        </button>
      </div>
    </form>
  );
}

export function AgentsScreen({ embedded = false }: { embedded?: boolean }) {
  const queryClient = useQueryClient();
  const agentsQuery = useAgentsQuery();
  const [includeInactive, setIncludeInactive] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);

  const agents = useMemo(
    () => (agentsQuery.data ?? []).filter((agent) => includeInactive || agent.status === "ACTIVE"),
    [agentsQuery.data, includeInactive],
  );
  const editingAgent = (agentsQuery.data ?? []).find((agent) => agent.id === editingAgentId) ?? null;

  const refreshAgents = () => queryClient.invalidateQueries({ queryKey: ["agents"] });
  const createMutation = useMutation({
    mutationFn: createAgent,
    onSuccess: async () => {
      setIsCreateOpen(false);
      await refreshAgents();
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: AgentFormValues }) =>
      updateAgent(id, normalizeAgentForm(values)),
    onSuccess: async () => {
      setEditingAgentId(null);
      await refreshAgents();
    },
  });
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "ACTIVE" | "INACTIVE" }) => setAgentStatus(id, status),
    onSuccess: refreshAgents,
  });
  const mutationError = createMutation.isError || updateMutation.isError || statusMutation.isError;

  return (
    <article className={`overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest pb-4 shadow-ambient sm:pb-5 ${embedded ? "" : "mx-auto max-w-7xl"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/30 px-4 py-3 sm:px-5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">Agent Table</p>
          <h2 className="mt-1 text-xl font-bold text-on-surface">Agents</h2>
          <p className="mt-0.5 text-xs text-on-surface-variant">
            Kelola Agent pemilik Group dan transaksi operasional.
          </p>
          <p className="mt-1 text-[11px] font-semibold text-on-surface-variant">
            Menampilkan {agents.length} Agent{includeInactive ? " (termasuk inactive)." : "."}
          </p>
        </div>
        <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
          <label className="inline-flex items-center gap-2 text-xs font-semibold text-on-surface-variant">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-outline-variant/55"
              checked={includeInactive}
              onChange={(event) => setIncludeInactive(event.target.checked)}
            />
            Show inactive
          </label>
          <button
            type="button"
            className="serene-btn-primary min-h-[38px] w-full px-3 py-1.5 text-xs sm:w-auto sm:px-4"
            onClick={() => {
              setIsCreateOpen((current) => !current);
              setEditingAgentId(null);
              createMutation.reset();
            }}
          >
            {isCreateOpen ? "Close Form" : "Add Option"}
          </button>
        </div>
      </div>

      {mutationError ? (
        <p className="mx-4 mt-4 rounded-xl border border-error/25 bg-error-container/60 px-4 py-3 text-sm font-semibold text-on-error-container sm:mx-5">
          Perubahan Agent gagal disimpan. Periksa kembali data yang dimasukkan.
        </p>
      ) : null}

      {isCreateOpen ? (
        <div className="mx-4 mt-4 sm:mx-5">
          <AgentForm
            key="create-agent"
            initialValues={EMPTY_AGENT_FORM}
            submitLabel="Simpan Option"
            isSubmitting={createMutation.isPending}
            onSubmit={(values) => createMutation.mutate(normalizeAgentForm(values))}
          />
        </div>
      ) : null}

      <div className="mx-4 mt-4 overflow-hidden rounded-xl border border-outline-variant/35 bg-surface-container-lowest sm:mx-5">
        {agentsQuery.isLoading ? (
          <div className="px-4 py-8 text-center text-sm font-medium text-on-surface-variant">Memuat Agent...</div>
        ) : agentsQuery.isError ? (
          <div className="px-4 py-8 text-center text-sm font-medium text-error">Agent gagal dimuat dari backend.</div>
        ) : agents.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm font-medium text-on-surface-variant">Belum ada Agent.</div>
        ) : (
          <>
            <div className="space-y-2 p-2 sm:hidden">
              {agents.map((agent) => (
                <article key={`${agent.id}-mobile`} className="rounded-lg border border-outline-variant/35 bg-surface-container-low p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-[11px] text-on-surface-variant">{agent.code}</p>
                      <p className="mt-1 text-sm font-semibold text-on-surface">{agent.name}</p>
                      <p className="mt-1 text-xs text-on-surface-variant">{agent.picName || "PIC belum diisi"} · {agent.groupCount ?? 0} groups</p>
                    </div>
                    <button
                      type="button"
                      className="serene-btn-secondary shrink-0"
                      disabled={agent.type === "DIRECT" || statusMutation.isPending}
                      onClick={() => statusMutation.mutate({ id: agent.id, status: agent.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" })}
                    >
                      {agent.status === "ACTIVE" ? "Active" : "Inactive"}
                    </button>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <button type="button" className="serene-btn-secondary" onClick={() => { setEditingAgentId(agent.id); setIsCreateOpen(false); }}>
                      Edit
                    </button>
                  </div>
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full min-w-[840px] table-fixed border-collapse text-left text-sm">
                <colgroup><col className="w-[16%]" /><col className="w-[27%]" /><col className="w-[20%]" /><col className="w-[10%]" /><col className="w-[13%]" /><col className="w-[14%]" /></colgroup>
                <thead className="border-b border-outline-variant/30 bg-surface-container-low">
                  <tr>{["Code", "Agent", "Contact", "Groups", "Status", "Action"].map((label) => <th key={label} className="whitespace-nowrap px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">{label}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                  {agents.map((agent) => (
                    <tr key={agent.id} className="align-middle transition hover:bg-primary/5">
                      <td className="break-all px-4 py-3 font-mono text-[11px] text-on-surface-variant">{agent.code}</td>
                      <td className="px-4 py-3"><p className="font-semibold text-on-surface">{agent.name}</p><p className="mt-0.5 text-xs text-on-surface-variant">{agent.picName || "PIC belum diisi"}</p></td>
                      <td className="px-4 py-3 text-xs text-on-surface-variant"><p>{agent.phone || "-"}</p><p className="mt-0.5 break-all">{agent.email || "-"}</p></td>
                      <td className="px-4 py-3 text-xs font-semibold text-on-surface-variant">{agent.groupCount ?? 0}</td>
                      <td className="px-4 py-3"><button type="button" className="serene-btn-secondary" disabled={agent.type === "DIRECT" || statusMutation.isPending} onClick={() => statusMutation.mutate({ id: agent.id, status: agent.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" })}>{agent.status === "ACTIVE" ? "Active" : "Inactive"}</button></td>
                      <td className="px-4 py-3"><button type="button" className="serene-btn-secondary" onClick={() => { setEditingAgentId(agent.id); setIsCreateOpen(false); }}>Edit</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {editingAgent ? (
        <section className="mx-4 mt-4 rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-4 sm:mx-5 sm:mb-5">
          <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-on-surface-variant">Edit Agent</h3>
          <div className="mt-3">
            <AgentForm
              key={editingAgent.id}
              initialValues={formFromAgent(editingAgent)}
              submitLabel="Simpan Perubahan"
              isSubmitting={updateMutation.isPending}
              onSubmit={(values) => updateMutation.mutate({ id: editingAgent.id, values })}
              onCancel={() => setEditingAgentId(null)}
            />
          </div>
        </section>
      ) : null}
    </article>
  );
}
