import { Link } from "react-router-dom";
import { DetailOverflowMenu } from "../../../components/detail-overflow-menu";
import { WhatsappCopyMenu } from "../../../components/whatsapp-copy-menu";
import { buildVisaDetailPath } from "../../../shared/app-route";
import { useGroupDetailContext } from "../context/GroupDetailContext";

export function GroupDetailHeader() {
  const { group, isWhatsappCopied, handleCopyWhatsapp, handleDeleteGroupBtn, handleExportPdf, readOnly } =
    useGroupDetailContext();

  return (
    <header className="rounded-3xl border border-outline-variant/45 bg-surface-container-lowest p-4 shadow-ambient backdrop-blur sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-on-surface">Group Detail</h1>
        <DetailOverflowMenu>
          {!readOnly ? (
            <button
              type="button"
              className="inline-flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold text-brand-tertiary transition hover:bg-brand-tertiary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
              onClick={handleDeleteGroupBtn}
            >
              <span className="material-symbols-outlined text-base" aria-hidden="true">
                delete
              </span>
              <span>Delete Group</span>
            </button>
          ) : null}
          <button
            type="button"
            className="inline-flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold text-on-surface transition hover:bg-surface-container-low focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
            onClick={handleExportPdf}
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              picture_as_pdf
            </span>
            <span>Export to PDF</span>
          </button>
        </DetailOverflowMenu>
      </div>

      <div className="mt-3 flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
        <Link
          to={readOnly ? `/agent/visa/${encodeURIComponent(group.code)}` : buildVisaDetailPath(group.code)}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 py-2 text-sm font-bold text-on-primary transition hover:bg-primary-container focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary sm:w-auto"
        >
          <span className="material-symbols-outlined text-sm" aria-hidden="true">
            fact_check
          </span>
          <span>Visa Detail</span>
        </Link>

        <WhatsappCopyMenu isCopied={isWhatsappCopied} onCopy={handleCopyWhatsapp} className="w-full sm:w-auto" />
      </div>
    </header>
  );
}
