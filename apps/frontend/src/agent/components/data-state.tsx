import type { ReactNode } from "react";
import { AgentApiError } from "../auth/agent-api";

export function LoadingState({ label = "Memuat data…" }: { label?: string }) {
  return (
    <div className="data-state" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      {label}
    </div>
  );
}
export function ErrorState({ retry }: { retry?: () => void }) {
  return (
    <div className="data-state error-state" role="alert">
      <strong>Data belum dapat dimuat.</strong>
      <span>Silakan coba kembali.</span>
      {retry ? (
        <button className="secondary-button" onClick={retry}>
          Coba lagi
        </button>
      ) : null}
    </div>
  );
}
export function ResourceErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  if (error instanceof AgentApiError && error.status === 404) {
    return (
      <div className="data-state" role="status">
        <strong>Resource tidak ditemukan.</strong>
        <span>Data mungkin tidak tersedia atau bukan bagian dari akun Partner ini.</span>
      </div>
    );
  }
  return <ErrorState retry={retry} />;
}
export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="data-state">
      <strong>{title}</strong>
      {children ? <span>{children}</span> : null}
    </div>
  );
}
export function StatusChip({ value }: { value: string }) {
  return (
    <span className={`status-chip status-${value.toLowerCase().replaceAll("_", "-")}`}>
      {value.toLowerCase().replaceAll("_", " ")}
    </span>
  );
}
