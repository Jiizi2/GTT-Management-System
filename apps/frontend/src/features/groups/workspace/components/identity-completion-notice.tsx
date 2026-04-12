export function IdentityCompletionNotice() {
  return (
    <section className="flex items-start gap-3 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
      <div
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-800"
        aria-hidden="true"
      >
        <span className="material-symbols-outlined">assignment_turned_in</span>
      </div>
      <div>
        <h3 className="text-base font-semibold">Complete Group Information First</h3>
        <p className="mt-1 text-sm leading-relaxed text-amber-900/90">
          <span className="sm:hidden">Complete group info before adding itinerary.</span>
          <span className="hidden sm:inline">
            Please fill in Group Number, Group Name, Package Type, Pax, Total Bus, date range, and
            Musyrif information before adding itinerary items.
          </span>
        </p>
      </div>
    </section>
  );
}
