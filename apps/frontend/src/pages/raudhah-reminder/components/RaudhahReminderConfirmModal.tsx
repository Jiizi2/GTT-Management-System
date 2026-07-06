import type { PendingTasrehAction } from "../hooks/use-raudhah-reminder";
import { DialogShell } from "../../../components/dialog-shell";
import { formatVisaDateWithYear } from "../../../shared/app-domain";

export function RaudhahReminderConfirmModal({
  pendingAction,
  onClose,
  onConfirm,
}: {
  pendingAction: PendingTasrehAction;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const nextPrintedLabel = pendingAction.nextTasrehPrinted ? "SUDAH DICETAK" : "BELUM DICETAK";
  const actionTitle = pendingAction.nextTasrehPrinted ? "Confirm Tasreh Printed" : "Confirm Reset Tasreh";

  return (
    <DialogShell isOpen={true} onClose={onClose} title={actionTitle} size="sm">
      <div className="flex items-start gap-3 mt-4">
        <span
          className={`material-symbols-outlined text-2xl ${
            pendingAction.nextTasrehPrinted ? "text-emerald-700" : "text-amber-700"
          }`}
          aria-hidden="true"
        >
          {pendingAction.nextTasrehPrinted ? "check_circle" : "warning"}
        </span>
        <div className="min-w-0">
          <p className="text-sm leading-relaxed text-slate-600">
            Apakah Anda yakin ingin mengubah status tasreh tanggal{" "}
            <strong>{formatVisaDateWithYear(pendingAction.targetDateIso)}</strong> untuk grup{" "}
            <strong>{pendingAction.groupCode}</strong> menjadi <strong>{nextPrintedLabel}</strong>?
          </p>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-3">
        <button
          type="button"
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          type="button"
          className={`rounded-xl px-4 py-2 text-sm font-extrabold text-white transition ${
            pendingAction.nextTasrehPrinted ? "bg-emerald-600 hover:bg-emerald-700" : "bg-amber-600 hover:bg-amber-700"
          }`}
          onClick={onConfirm}
        >
          Yes, Update
        </button>
      </div>
    </DialogShell>
  );
}
