export function WorkspaceHeader() {
  return (
    <section className="serene-section p-6">
      <div>
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-emerald-700/80">
          Operations Form
        </p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl">
          Input Itinerary
        </h1>
        <p className="mt-2 text-sm text-slate-600 sm:text-base">
          <span className="sm:hidden">Fill group info and travel plan.</span>
          <span className="hidden sm:inline">
            Fill in group information and travel plan for operational execution.
          </span>
        </p>
      </div>
    </section>
  );
}
