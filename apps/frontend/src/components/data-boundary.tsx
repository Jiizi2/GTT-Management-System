import type { ReactNode } from "react";
import { Button } from "./button";
import { StatePanel } from "./state-panel";

/** A structural subset of React Query, also usable by controller-backed pages. */
export type DataQueryState = {
  data?: unknown;
  isPending?: boolean;
  isFetching?: boolean;
  isError?: boolean;
  refetch?: () => unknown;
};

export function combineQueryStates(...queries: DataQueryState[]): DataQueryState {
  return {
    data: queries.every((query) => query.data !== undefined) ? queries.map((query) => query.data) : undefined,
    isPending: queries.some((query) => query.data === undefined && query.isPending),
    isFetching: queries.some((query) => query.isFetching),
    isError: queries.some((query) => query.isError),
    refetch: () => Promise.all(queries.map((query) => query.refetch?.())),
  };
}

export function DataStatus({ query }: { query?: DataQueryState }) {
  if (!query || query.data === undefined) return null;
  if (query.isFetching) {
    return (
      <p className="serene-data-status" role="status">
        <span className="serene-updating-dot" aria-hidden="true" />
        Memperbarui data…
      </p>
    );
  }
  if (query.isError) {
    return (
      <div className="serene-data-status" role="status">
        <span>Gagal memperbarui. Data terakhir tetap ditampilkan.</span>
        {query.refetch && (
          <Button variant="tertiary" size="sm" onClick={() => void query.refetch?.()}>
            Coba lagi
          </Button>
        )}
      </div>
    );
  }
  return null;
}

export function DataBoundary({
  query,
  skeleton,
  children,
  errorTitle = "Data belum dapat dimuat",
}: {
  query?: DataQueryState;
  skeleton: ReactNode;
  children: ReactNode;
  errorTitle?: string;
}) {
  const hasData = !query || query.data !== undefined;
  if (!hasData && query?.isError) {
    return (
      <StatePanel
        state="error"
        title={errorTitle}
        description="Periksa koneksi lalu coba kembali."
        action={
          query.refetch ? (
            <Button variant="secondary" onClick={() => void query.refetch?.()}>
              Coba lagi
            </Button>
          ) : undefined
        }
      />
    );
  }
  if (!hasData && query?.isPending) return <>{skeleton}</>;
  return (
    <>
      <DataStatus query={query} />
      {children}
    </>
  );
}
