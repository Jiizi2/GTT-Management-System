import type { ReactNode } from "react";
import { StatePanel } from "../../components/state-panel";
import { StatusBadge } from "../../components/status-badge";
import { AgentApiError } from "../auth/agent-api";

export function LoadingState({ label = "Memuat data…" }: { label?: string }) {
  return <StatePanel state="loading" title={label} compact />;
}

export function ErrorState({ retry }: { retry?: () => void }) {
  return (
    <StatePanel
      state="error"
      description="Silakan coba kembali."
      action={
        retry ? (
          <button className="serene-btn-secondary" onClick={retry}>
            Coba lagi
          </button>
        ) : undefined
      }
    />
  );
}

export function ResourceErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  if (error instanceof AgentApiError && error.status === 404) {
    return (
      <StatePanel
        state="not-found"
        title="Resource tidak ditemukan"
        description="Data mungkin tidak tersedia atau bukan bagian dari akun Partner ini."
      />
    );
  }
  return <ErrorState retry={retry} />;
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return <StatePanel state="empty" title={title} description={children} />;
}

export function StatusChip({ value }: { value: string }) {
  const normalized = value.toUpperCase();
  const tone =
    normalized.includes("PAID") || normalized.includes("ISSUED") || normalized.includes("APPROVED")
      ? "complete"
      : normalized.includes("OVERDUE") || normalized.includes("REJECT") || normalized.includes("CANCEL")
        ? "attention"
        : normalized.includes("PENDING") || normalized.includes("WAIT")
          ? "waiting"
          : "neutral";
  return <StatusBadge tone={tone}>{value.toLowerCase().replaceAll("_", " ")}</StatusBadge>;
}
