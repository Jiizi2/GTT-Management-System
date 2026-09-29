import { Link } from "react-router-dom";
import { DetailOverflowMenu } from "../../../components/detail-overflow-menu";
import { WhatsappCopyMenu } from "../../../components/whatsapp-copy-menu";
import { useVisaDetailContext } from "../context/VisaDetailContext";

export function VisaDetailHeader() {
  const {
    row,
    group,
    groups,
    familyGroups,
    activeGroupCode,
    setActiveGroupCode,
    totalPax,
    isWhatsappCopied,
    agreementIssues,
    shouldShowLinkAgreementAction,
    primaryAgreementMessage,
    openGroupEditModal,
    openDeleteGroupModal,
    handleCopyWhatsapp,
    handleOpenUnlinkModal,
    onBack,
  } = useVisaDetailContext();

  const parentGroup = group?.parentGroupId
    ? groups.find((item) => item.id === group.parentGroupId || item.code === group.parentGroupId)
    : null;

  return (
    <div className="space-y-4">
      <header>
        <button
          type="button"
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-surface-container-lowest px-3 py-2 text-sm font-bold leading-none text-slate-700 transition hover:border-brand-primary hover:text-brand-primary sm:w-auto sm:justify-start sm:py-1.5"
          onClick={onBack}
        >
          <span className="material-symbols-outlined text-base" aria-hidden="true">
            arrow_back
          </span>
          <span className="sm:hidden">Back</span>
          <span className="hidden sm:inline">Back to Visa Tracking</span>
        </button>
      </header>

      <section className="flex flex-col gap-2 rounded-3xl border border-outline-variant/45 bg-surface-container-lowest p-3 shadow-ambient sm:p-4 md:grid md:grid-cols-[minmax(0,1fr)_auto] md:items-start md:gap-x-6 md:gap-y-2">
        <div className="contents">
          <div className="order-1 min-w-0 md:col-start-1 md:row-start-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-primary">Visa Detail</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <h1 className="break-words text-2xl font-bold tracking-tight text-on-surface sm:text-3xl">
                    {row.groupCode}
                  </h1>
                  <DetailOverflowMenu>
                    <button
                      type="button"
                      className="inline-flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold text-on-surface transition hover:bg-surface-container-low focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={openGroupEditModal}
                      disabled={!group}
                      aria-label={`Edit group info for ${row.groupCode}`}
                    >
                      <span className="material-symbols-outlined text-base" aria-hidden="true">
                        edit
                      </span>
                      <span>Edit Group</span>
                    </button>
                    <button
                      type="button"
                      className="inline-flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold text-brand-tertiary transition hover:bg-brand-tertiary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={openDeleteGroupModal}
                      disabled={!group}
                      aria-label={`Delete group ${row.groupCode}`}
                    >
                      <span className="material-symbols-outlined text-base" aria-hidden="true">
                        delete
                      </span>
                      <span>Delete Group</span>
                    </button>
                  </DetailOverflowMenu>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-on-surface-variant">
                  <p className="min-w-0 break-words">{group?.name ?? row.groupName}</p>
                  <span className="inline-flex rounded-lg border border-brand-primary/30 bg-brand-primary/10 px-2.5 py-1 text-xs font-bold leading-none text-brand-primary">
                    <span className="sm:hidden">{totalPax} Pax</span>
                    <span className="hidden sm:inline">{totalPax} Pax Total</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="order-3 flex w-full flex-col items-stretch gap-1.5 self-start md:col-start-2 md:row-start-1 md:w-auto md:shrink-0">
            <Link
              to={`/groups/${encodeURIComponent(activeGroupCode)}`}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 text-sm font-bold text-on-primary transition hover:bg-primary-container focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary md:w-auto"
              aria-label={`Buka Group Detail ${activeGroupCode}`}
            >
              <span className="material-symbols-outlined text-lg" aria-hidden="true">
                travel_explore
              </span>
              <span>Group Detail</span>
            </Link>
            <WhatsappCopyMenu isCopied={isWhatsappCopied} onCopy={handleCopyWhatsapp} className="w-full md:w-auto" />
          </div>
        </div>

        {familyGroups.length > 1 && (
          <div
            className="order-2 mt-3 border-t border-outline-variant/35 pt-3 md:col-span-2 md:row-start-2 md:mt-1"
            aria-label="Group yang berbagi data visa"
          >
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-bold text-on-surface">
              <span className="material-symbols-outlined text-base text-brand-primary" aria-hidden="true">
                link
              </span>
              <span>{familyGroups.length} group berbagi data visa</span>
              {parentGroup && (
                <span className="text-xs font-medium text-on-surface-variant">
                  · Itinerary &amp; Musyrif mengikuti {parentGroup.code}
                </span>
              )}
            </div>

            <div className="mt-2 flex flex-col divide-y divide-outline-variant/30 border-y border-outline-variant/25 md:flex-row md:items-stretch md:gap-2 md:divide-y-0 md:border-y-0">
              {familyGroups.map((familyGroup) => {
                const isActive = familyGroup.code === activeGroupCode;

                return (
                  <div
                    key={familyGroup.code}
                    className={`flex min-h-11 min-w-0 flex-1 items-center gap-3 py-0 md:min-h-12 md:gap-0 md:overflow-hidden md:rounded-xl md:border md:py-0 ${
                      isActive
                        ? "md:border-brand-primary/35 md:bg-brand-primary/5"
                        : "md:border-outline-variant/35 md:bg-surface-container-lowest"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveGroupCode(familyGroup.code)}
                      aria-pressed={isActive}
                      aria-label={isActive ? `${familyGroup.code}, sedang dibuka` : `Buka group ${familyGroup.code}`}
                      className="flex min-h-11 min-w-0 flex-1 items-center justify-between gap-3 rounded-lg px-2 text-left transition hover:bg-surface-container-low focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary md:min-h-12 md:rounded-none md:px-3 md:py-1"
                    >
                      <span className="flex min-w-0 flex-col justify-center gap-0.5">
                        <span className="truncate font-bold leading-tight text-on-surface">{familyGroup.code}</span>
                        <span
                          className={`hidden text-xs font-bold leading-tight md:inline ${
                            isActive ? "text-brand-primary" : "text-on-surface-variant"
                          }`}
                        >
                          {isActive ? "Sedang dibuka" : "Buka"}
                        </span>
                      </span>
                      <span
                        className={`material-symbols-outlined inline-flex shrink-0 text-lg md:hidden ${
                          isActive ? "text-brand-primary" : "text-on-surface-variant/60"
                        }`}
                        aria-hidden="true"
                      >
                        {isActive ? "radio_button_checked" : "radio_button_unchecked"}
                      </span>
                      <span
                        className={`hidden h-6 w-6 shrink-0 items-center justify-center rounded-full md:inline-flex ${
                          isActive ? "bg-brand-primary text-on-primary" : "border-2 border-outline-variant/70"
                        }`}
                        aria-hidden="true"
                      >
                        {isActive && <span className="material-symbols-outlined text-sm md:text-base">check</span>}
                      </span>
                    </button>

                    {!isActive && (
                      <button
                        type="button"
                        onClick={() => handleOpenUnlinkModal(familyGroup)}
                        className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-2 text-brand-tertiary transition hover:bg-brand-tertiary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary md:w-11 md:justify-center md:gap-0 md:rounded-none md:border-l md:border-outline-variant/35 md:px-0"
                        aria-label={`Pisahkan group ${familyGroup.code}`}
                        title={`Pisahkan group ${familyGroup.code}`}
                      >
                        <span className="material-symbols-outlined text-base" aria-hidden="true">
                          link_off
                        </span>
                        <span className="sr-only">Pisahkan</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {agreementIssues.length > 0 ? (
        <section
          className="rounded-2xl border border-tertiary-fixed/65 bg-tertiary-fixed/70 px-4 py-3 text-on-tertiary-fixed-variant shadow-sm"
          aria-label="Agreement setup status"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-container-lowest"
                aria-hidden="true"
              >
                <span className="material-symbols-outlined text-base">link</span>
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                <h2 className="text-sm font-extrabold leading-tight">Agreement Needs Attention</h2>
                <span className="hidden text-tertiary-fixed/40 sm:inline">|</span>
                <p className="text-xs font-medium leading-tight">{primaryAgreementMessage}</p>
                <div className="flex flex-wrap gap-1.5 sm:ml-auto">
                  {agreementIssues.slice(0, 4).map((issue: any) => (
                    <span
                      key={issue.key}
                      className="rounded bg-surface-container-lowest/80 px-1.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide"
                      title={issue.message}
                    >
                      {issue.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {shouldShowLinkAgreementAction ? (
              <div className="flex flex-col gap-2 sm:flex-row lg:shrink-0">
                <Link
                  to={`/agreement-inbox?groupCode=${encodeURIComponent(row.groupCode)}`}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-on-tertiary-fixed-variant/20 bg-surface-container-lowest px-3 text-sm font-bold text-brand-primary transition hover:bg-surface-container-low"
                >
                  <span className="material-symbols-outlined text-base" aria-hidden="true">
                    link
                  </span>
                  <span>Link Agreement</span>
                </Link>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
