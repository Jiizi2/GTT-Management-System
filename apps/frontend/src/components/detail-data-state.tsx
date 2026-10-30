import { Button } from "./button";
import { DataBoundary, type DataQueryState } from "./data-boundary";
import { DetailSkeleton } from "./skeleton";
import { PageLayout } from "./page-layout";
import { PageHeader } from "./page-header";
import { StatePanel } from "./state-panel";

export function DetailDataState({
  query,
  title,
  kind = "group",
  onBack,
  backLabel = "Kembali",
}: {
  query?: DataQueryState;
  title: string;
  kind?: "group" | "visa";
  onBack: () => void;
  backLabel?: string;
}) {
  return (
    <PageLayout width="wide">
      <Button variant="secondary" className="w-fit" onClick={onBack}>
        {backLabel}
      </Button>
      <PageHeader variant="detail" title={title} />
      <DataBoundary query={query} skeleton={<DetailSkeleton kind={kind} />}>
        <StatePanel
          state="not-found"
          title="Data tidak ditemukan"
          description="Data mungkin tidak tersedia atau tidak dapat diakses oleh akun ini."
        />
      </DataBoundary>
    </PageLayout>
  );
}
