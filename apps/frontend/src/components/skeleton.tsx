import type { CSSProperties, ReactNode } from "react";
import { PageLayout } from "./page-layout";
import { PageHeader } from "./page-header";
import { PageHeroSection } from "./page-hero-section";
import { ListToolbar, ResultSummary } from "./list-toolbar";
import { FilterField } from "./filter-panel";

/** Keep the chunk placeholder in the same centered frame as its destination. */
export function PageSkeleton({ pathname = "", form = false }: { pathname?: string; form?: boolean }) {
  const isAgent = pathname.startsWith("/agent/");
  const route = isAgent ? pathname.slice("/agent".length) : pathname;
  const agentHeaders: Record<string, [string, string]> = {
    "/overview": ["Dashboard", "Ringkasan perjalanan dan jadwal keberangkatan Anda."],
    "/groups": ["Perjalanan", "Temukan group yang ditugaskan dan buka itinerary perjalanannya."],
    "/visa": ["Visa Tracking", "Pantau progres visa setiap group."],
    "/checklist": ["H-1 Checklist", "Kesiapan driver untuk perjalanan hari ini, besok, dan lusa."],
    "/agreement-inbox": ["Agreement Inbox", "Review and track hotel agreements for your groups."],
    "/profile": ["Profile", "Informasi akun dan identitas Partner yang terhubung dengan portal Agent."],
  };
  const adminHeroes: Record<string, [string, string, ReactNode]> = {
    "/overview": [
      "Operations Overview",
      "Itinerary Overview",
      <>
        <span className="sm:hidden">Track your active Umrah groups in real-time.</span>
        <span className="hidden sm:inline">
          Manage your ongoing Umrah groups and track live itinerary status in real-time.
        </span>
      </>,
    ],
    "/statistics": [
      "Performance Analytics",
      "Statistik & Performa",
      "Pantau tren keberangkatan, throughput visa, dan kontribusi tiap agent dalam satu tampilan.",
    ],
    "/visa": [
      "Visa Control Board",
      "Visa Tracking",
      <>
        <span className="sm:hidden">Monitor visa status, agreement, and payment.</span>
        <span className="hidden sm:inline">
          Monitor group agreement numbers, visa issuance, and payment progress in one board.
        </span>
      </>,
    ],
    "/invoice": [
      "Invoice Workspace",
      "Invoice List",
      <>
        <span className="sm:hidden">Track all issued invoices.</span>
        <span className="hidden sm:inline">Manage and track all issued invoices.</span>
      </>,
    ],
    "/agreement-inbox": [
      "Hotel Agreements",
      "Agreement Inbox",
      "Review, assign, and track hotel agreements for all groups and agents.",
    ],
    "/user-management": [
      "User Access Control",
      "User Management",
      "Kelola akun pengguna, tambah user baru, dan atur role untuk kebutuhan operasional.",
    ],
  };
  let content: ReactNode;
  let filters: ReactNode;
  let header: ReactNode = <Skeleton className="h-8 w-48" />;
  const [eyebrow, title, description] = adminHeroes[route] ?? [];
  const agentHeader = agentHeaders[route];

  if (isAgent && agentHeader) {
    const actions =
      route === "/overview" ? (
        <Skeleton className="h-7 w-36" />
      ) : route === "/groups" ? (
        <MetricsSkeleton count={1} className="w-64 max-w-full" variant="compact" />
      ) : undefined;
    header = <PageHeader variant="compact" title={agentHeader[0]} description={agentHeader[1]} actions={actions} />;
  } else if (!isAgent && route === "/checklist") {
    header = (
      <>
        <header className="serene-card p-5">
          <h1 className="text-2xl font-bold text-on-surface">H-1 Checklist</h1>
          <p className="mt-2 text-sm text-on-surface-variant">
            Monitor every trip and driver readiness for today, tomorrow, and the day after tomorrow.
          </p>
        </header>
        <div className="serene-page-toolbar">
          <Skeleton className="h-11 w-full sm:max-w-xl" />
          <div className="space-y-1">
            <Skeleton className="h-[16.5px] w-12" />
            <Skeleton className="h-11 w-32" />
          </div>
        </div>
      </>
    );
  } else if (!isAgent && title && !form) {
    const toolbar = ["/overview", "/statistics", "/visa", "/invoice"].includes(route);
    header = (
      <>
        {toolbar && (
          <div className="serene-page-toolbar">
            <Skeleton className={route === "/statistics" ? "h-11 w-full" : "h-12 w-full sm:h-14"} />
          </div>
        )}
        <PageHeroSection eyebrow={eyebrow} title={title} description={description} />
      </>
    );
  }

  if (isAgent && ["/groups", "/checklist"].includes(route)) {
    filters = (
      <ListToolbar
        ariaLabel="Memuat filter"
        controlsClassName={route === "/groups" ? "grid gap-3 lg:grid-cols-[minmax(0,1fr)_13rem_auto] lg:items-end" : ""}
        footer={
          <ResultSummary>
            <Skeleton className="h-4 w-40" />
          </ResultSummary>
        }
      >
        {route === "/groups" ? (
          <>
            <div className="min-w-0">
              <span className="serene-field-label mb-2 block">Cari perjalanan</span>
              <Skeleton className="h-11 w-full" />
            </div>
            <FilterField label="Bulan keberangkatan">
              <Skeleton className="h-11 w-full" />
            </FilterField>
            <Skeleton className="h-11 w-32" />
          </>
        ) : (
          <Skeleton className="h-11 w-full" />
        )}
      </ListToolbar>
    );
  } else if (isAgent && route === "/visa") {
    filters = (
      <ListToolbar
        ariaLabel="Memuat filter visa"
        footer={
          <ResultSummary>
            <Skeleton className="h-4 w-64" />
          </ResultSummary>
        }
      >
        <div className="agent-visa-filters">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-11 w-40" />
          ))}
        </div>
        <div className="agent-visa-search-row">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-48" />
        </div>
      </ListToolbar>
    );
  }

  if (form) content = <DetailSkeleton kind="profile" />;
  else if (/^\/(groups|visa)\//.test(route))
    content = <DetailSkeleton kind={route.startsWith("/visa/") ? "visa" : "group"} />;
  else if (route === "/overview" && isAgent)
    content = (
      <>
        <MetricsSkeleton className="agent-dashboard-stats" variant="compact" metricClassName="agent-dashboard-metric" />
        <div className="agent-dashboard-workspace">
          <CalendarSkeleton />
          <ListSkeleton rows={3} columns={2} />
        </div>
      </>
    );
  else if (route === "/overview")
    content = (
      <>
        <MetricsSkeleton count={4} className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.15fr_1fr_1fr_1fr]" />
        <CardsSkeleton />
      </>
    );
  else if (route === "/groups") content = <CardsSkeleton family />;
  else if (route === "/checklist") content = <ChecklistSkeleton />;
  else if (route === "/statistics")
    content = (
      <>
        <MetricsSkeleton count={4} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" />
        <ChartSkeleton />
      </>
    );
  else if (route === "/visa" && isAgent) content = <ListSkeleton columns={5} rows={4} label="Memuat Visa Tracking" />;
  else if (route === "/visa")
    content = (
      <>
        <MetricsSkeleton count={4} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" />
        <ListSkeleton columns={8} />
      </>
    );
  else if (route === "/profile") content = <DetailSkeleton kind="profile" />;
  else content = <ListSkeleton />;

  const headerRegion = (
    <div role="status" aria-label="Memuat halaman…" aria-busy="true" className="space-y-6">
      {header}
    </div>
  );
  if (isAgent) {
    const workspace = ["/overview", "/visa", "/agreement-inbox"].includes(route) || route.startsWith("/visa/");
    return (
      <PageLayout
        width={workspace ? "workspace" : "standard"}
        className={`agent-page-layout ${route === "/overview" ? "agent-calendar-dashboard" : route === "/visa" ? "agent-visa-page" : route.startsWith("/visa/") ? "agent-visa-detail-page agent-visa-admin-aligned" : ""}`}
      >
        {headerRegion}
        {filters}
        {content}
      </PageLayout>
    );
  }
  const width =
    route === "/master-data"
      ? "max-w-[1586px]"
      : route === "/agreement-inbox"
        ? "max-w-screen-2xl"
        : form || ["/visa", "/invoice"].includes(route)
          ? "max-w-[88rem]"
          : "max-w-7xl";
  return (
    <div className={`mx-auto w-full ${width} space-y-6 px-4 pb-20 pt-4 sm:px-6 lg:px-8`}>
      {headerRegion}
      {content}
    </div>
  );
}

export function Skeleton({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return <span aria-hidden="true" className={`serene-skeleton ${className}`} style={style} />;
}

export function SkeletonRegion({
  label = "Memuat data…",
  className = "",
  children,
  as: Element = "div",
}: {
  label?: string;
  className?: string;
  children: ReactNode;
  as?: "div" | "span";
}) {
  return (
    <Element className={className} role="status" aria-label={label} aria-busy="true">
      <span className="sr-only">{label}</span>
      <Element className={className === "contents" ? "contents" : undefined} aria-hidden="true">
        {children}
      </Element>
    </Element>
  );
}

export function MetricSkeleton({
  className = "",
  variant = "card",
}: {
  className?: string;
  variant?: "card" | "compact";
}) {
  return (
    <div
      className={`flex min-w-0 items-center gap-3 ${variant === "card" ? "serene-card min-h-[6.5rem] p-4 sm:min-h-[7rem] sm:p-5" : ""} ${className}`}
    >
      <Skeleton className={`h-11 w-11 shrink-0 rounded-xl ${variant === "compact" ? "hidden sm:block" : ""}`} />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-3/4" />
      </div>
    </div>
  );
}

export function MetricsSkeleton({
  count = 3,
  className = "grid gap-4 sm:grid-cols-2 xl:grid-cols-3",
  label = "Memuat ringkasan…",
  variant = "card",
  metricClassName = "",
}: {
  count?: number;
  className?: string;
  label?: string;
  variant?: "card" | "compact";
  metricClassName?: string;
}) {
  return (
    <SkeletonRegion label={label}>
      <div className={className}>
        {Array.from({ length: count }, (_, i) => (
          <MetricSkeleton key={i} variant={variant} className={metricClassName} />
        ))}
      </div>
    </SkeletonRegion>
  );
}

export function ListSkeleton({
  rows = 5,
  columns = 4,
  label = "Memuat daftar…",
  className = "",
}: {
  rows?: number;
  columns?: number;
  label?: string;
  className?: string;
}) {
  return (
    <SkeletonRegion label={label} className={className}>
      <div className="serene-skeleton-list">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="serene-skeleton-row" style={{ "--skeleton-columns": columns } as CSSProperties}>
            {Array.from({ length: columns }, (_, col) => (
              <div key={col} className="min-w-0 space-y-2">
                <Skeleton className={col === 0 ? "h-4 w-3/4" : "h-3 w-2/3"} />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </SkeletonRegion>
  );
}

export function CardsSkeleton({
  count = 6,
  family = false,
  label = "Memuat perjalanan…",
}: {
  count?: number;
  family?: boolean;
  label?: string;
}) {
  return (
    <SkeletonRegion label={label}>
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="serene-card overflow-hidden">
            <div className="flex gap-4 bg-surface-container-high p-5">
              <Skeleton className="h-16 w-16 rounded-2xl" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-5 w-20" />
              </div>
            </div>
            <div className="space-y-5 p-5">
              <div className="grid grid-cols-2 gap-4">
                {Array.from({ length: 4 }, (_, j) => (
                  <div key={j} className="space-y-2">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                ))}
              </div>
              {family && (
                <div className="space-y-2 border-y border-outline-variant/30 py-3">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="ml-4 h-3 w-1/2" />
                </div>
              )}
              <div className="space-y-4">
                {[0, 1, 2].map((j) => (
                  <div key={j} className="flex gap-3">
                    <Skeleton className="h-4 w-4 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
              <Skeleton className="h-11 w-full rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </SkeletonRegion>
  );
}

export function DetailSkeleton({
  kind = "group",
  label = "Memuat detail…",
}: {
  kind?: "group" | "visa" | "profile";
  label?: string;
}) {
  const sections = kind === "profile" ? 1 : kind === "visa" ? 4 : 3;
  return (
    <SkeletonRegion label={label}>
      <div className="space-y-5">
        {kind !== "profile" && (
          <div className="space-y-3 py-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64 max-w-full" />
          </div>
        )}
        {kind === "visa" && (
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <MetricSkeleton key={i} />
            ))}
          </div>
        )}
        <div className={kind === "profile" ? "space-y-5" : "grid gap-5 lg:grid-cols-2"}>
          {Array.from({ length: sections }, (_, i) => (
            <div key={i} className="serene-section space-y-5 p-5">
              <Skeleton className="h-5 w-40" />
              <div className="grid gap-5 sm:grid-cols-2">
                {Array.from({ length: kind === "profile" ? 3 : 6 }, (_, j) => (
                  <div key={j} className="space-y-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                ))}
              </div>
              {kind === "group" && i === 1 && <Skeleton className="h-20 w-full" />}
            </div>
          ))}
        </div>
      </div>
    </SkeletonRegion>
  );
}

export function CalendarSkeleton({ weeks = 5 }: { weeks?: number }) {
  return (
    <SkeletonRegion label="Memuat kalender keberangkatan…">
      <div className="serene-skeleton-calendar" style={{ "--calendar-weeks": weeks } as CSSProperties}>
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={`day-${i}`} className="h-3 w-6 self-center justify-self-center" />
        ))}
        {Array.from({ length: weeks * 7 }, (_, i) => (
          <div key={i} className="min-w-0 space-y-3 border-t border-outline-variant/25 p-2">
            <Skeleton className="h-4 w-4" />
            {i % 4 === 0 && <Skeleton className="h-3 w-full" />}
          </div>
        ))}
      </div>
    </SkeletonRegion>
  );
}

export function ChartSkeleton({
  label = "Memuat grafik…",
  horizontal = false,
}: {
  label?: string;
  horizontal?: boolean;
}) {
  if (horizontal)
    return (
      <SkeletonRegion label={label}>
        <div className="flex h-60 flex-col justify-around border-b border-l border-outline-variant/40 p-4 sm:h-72">
          {[70, 45, 85].map((width, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-3 w-20 shrink-0" />
              <Skeleton className="h-6" style={{ width: `${width}%` }} />
            </div>
          ))}
        </div>
      </SkeletonRegion>
    );
  return (
    <SkeletonRegion label={label}>
      <div className="flex h-60 items-end gap-3 border-b border-l border-outline-variant/40 px-4 pb-2 pt-6 sm:h-72">
        {[40, 65, 48, 80, 56, 72, 44, 64].map((height, i) => (
          <Skeleton key={i} className="min-w-0 flex-1 rounded-t-md" style={{ height: `${height}%` }} />
        ))}
      </div>
    </SkeletonRegion>
  );
}

export function ChecklistSkeleton({ rows = 3, label = "Memuat checklist H-1…" }: { rows?: number; label?: string }) {
  return (
    <SkeletonRegion label={label}>
      <div className="space-y-4">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="serene-card space-y-4 p-5">
            <div className="flex gap-4">
              <Skeleton className="h-12 w-12 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </SkeletonRegion>
  );
}
