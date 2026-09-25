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

      {group?.parentGroupId && (
        <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-xs font-semibold text-sky-800 flex items-center gap-3 shadow-xs">
          <span className="material-symbols-outlined text-base text-sky-700" aria-hidden="true">
            info
          </span>
          <div>
            <strong>Grup Operasional Terhubung</strong>
            <p className="mt-0.5 text-[11px] text-sky-600 font-medium">
              Grup ini mengikuti data operasional dari Group (
              {
                groups.find((g) => g.id === group.parentGroupId || g.code === group.parentGroupId)
                  ?.code
              }
              ). Itinerary dan Musyrif diwarisi secara otomatis.
            </p>
          </div>
        </div>
      )}

      <section className="flex flex-col gap-3 rounded-3xl border border-outline-variant/45 bg-surface-container-lowest p-4 shadow-ambient sm:p-5 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-primary">
                Visa Detail
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h1 className="break-words text-2xl font-bold tracking-tight text-on-surface sm:text-3xl">
                  {row.groupCode}
                </h1>
                {familyGroups.length > 1 && (
                  <div
                    className={`flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-lg border border-outline-variant/40 bg-surface-container-low px-2 py-1 font-semibold text-on-surface-variant sm:inline-flex ${
                      familyGroups.length > 2 ? "text-[10px]" : "text-xs"
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm text-on-surface-variant/70" aria-hidden="true">
                        link
                      </span>
                      <span>Terhubung:</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                      {familyGroups
                        .filter((g) => g.code !== activeGroupCode)
                        .map((g, index) => (
                          <span key={g.code} className="inline-flex items-center gap-0.5">
                            {index > 0 && <span className="mr-1.5 text-outline-variant">,</span>}
                            <button
                              type="button"
                              onClick={() => setActiveGroupCode(g.code)}
                              className="font-bold text-on-surface hover:underline"
                            >
                              {g.code}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenUnlinkModal(g)}
                              className="inline-flex h-11 w-11 items-center justify-center rounded text-on-surface-variant/70 transition hover:bg-brand-tertiary/10 hover:text-brand-tertiary xl:h-5 xl:w-5"
                              title="Pisahkan grup ini"
                            >
                              <span className="material-symbols-outlined text-[13px]" aria-hidden="true">
                                link_off
                              </span>
                            </button>
                          </span>
                        ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-on-surface-variant">
                <p className="min-w-0 break-words">{group?.name ?? row.groupName}</p>
                <span className="inline-flex rounded-lg border border-brand-primary/30 bg-brand-primary/10 px-2.5 py-1 text-xs font-bold leading-none text-brand-primary">
                  <span className="sm:hidden">{totalPax} Pax</span>
                  <span className="hidden sm:inline">{totalPax} Pax Total</span>
                </span>
              </div>
            </div>

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
        </div>

        <div className="flex w-full flex-col items-stretch gap-1.5 self-start md:w-auto md:shrink-0">
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
              <div className="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                <h2 className="text-sm font-extrabold leading-tight">Agreement Needs Attention</h2>
                <span className="hidden sm:inline text-tertiary-fixed/40">|</span>
                <p className="text-xs font-medium leading-tight">{primaryAgreementMessage}</p>
                <div className="flex flex-wrap gap-1.5 sm:ml-auto">
                  {agreementIssues.slice(0, 4).map((issue: any) => (
                    <span
                      key={issue.key}
                      className="rounded bg-surface-container-lowest/80 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide"
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
