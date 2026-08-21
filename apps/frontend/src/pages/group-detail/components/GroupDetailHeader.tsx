import { Link } from "react-router-dom";
import { Button } from "../../../components/button";
import { buildVisaDetailPath } from "../../../shared/app-route";
import { useGroupDetailContext } from "../context/GroupDetailContext";

export function GroupDetailHeader() {
  const { group, isWhatsappCopied, handleCopyWhatsapp, handleDeleteGroupBtn, handleExportPdf, readOnly } =
    useGroupDetailContext();

  return (
    <header className="flex flex-col gap-4 rounded-3xl border border-outline-variant/45 bg-surface-container-lowest p-5 shadow-ambient backdrop-blur md:flex-row md:items-center md:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-on-surface sm:text-3xl">Group Detail</h1>
      </div>

      <div className="flex flex-wrap items-center gap-2 md:w-auto">
        <Link
          to={readOnly ? `/agent/visa/${encodeURIComponent(group.code)}` : buildVisaDetailPath(group.code)}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-primary px-3.5 py-2 text-xs font-bold text-on-primary transition hover:bg-primary-container"
        >
          <span className="material-symbols-outlined text-sm" aria-hidden="true">
            fact_check
          </span>
          <span>Visa Detail</span>
        </Link>

        <Button
          variant="secondary"
          size="sm"
          className={
            isWhatsappCopied
              ? "border-emerald-600/30 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/15"
              : ""
          }
          onClick={handleCopyWhatsapp}
          aria-label={`Copy WhatsApp formatted details for ${group.name}`}
        >
          <span className="material-symbols-outlined text-base" aria-hidden="true">
            {isWhatsappCopied ? "check" : "content_copy"}
          </span>
          <span>{isWhatsappCopied ? "Copied" : "Copy WhatsApp"}</span>
        </Button>

        {!readOnly ? (
          <Button variant="danger" size="sm" onClick={handleDeleteGroupBtn}>
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              delete
            </span>
            <span>Delete Group</span>
          </Button>
        ) : null}

        <Button variant="secondary" size="sm" onClick={handleExportPdf}>
          <span className="material-symbols-outlined text-base" aria-hidden="true">
            picture_as_pdf
          </span>
          <span>Export to PDF</span>
        </Button>
      </div>
    </header>
  );
}
