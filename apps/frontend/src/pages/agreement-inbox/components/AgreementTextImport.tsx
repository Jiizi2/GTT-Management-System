import { useState, type FormEvent } from "react";
import { Button } from "../../../components/button";
import { DatePickerInput } from "../../../components/date-time-pickers";
import { SereneSelect } from "../../../components/serene-select";
import { useAgentsQuery } from "../../../hooks/use-agents-backend";
import type { AgreementApprovalStatus, HotelAgreementDraftFormState } from "../../../shared/app-domain";
import { parseAgreementText, type ParsedAgreementTextItem } from "../../../shared/agreement-text-parser";

type ImportError = { message: string } | null;

const SAMPLE_TEXT = `Agreement Kayan Alraia Hotel
15762600997977714
Waiting For Approval

Jabal Omar Jumeirah hotel
15762600970307022

16/11/2026 - 19/11/2026`;

export function AgreementTextImport({
  isSaving,
  onSaveDraft,
  onComplete,
}: {
  isSaving: boolean;
  onSaveDraft: (values: HotelAgreementDraftFormState) => Promise<boolean>;
  onComplete: () => void;
}) {
  const agentsQuery = useAgentsQuery();
  const [sourceText, setSourceText] = useState("");
  const [items, setItems] = useState<ParsedAgreementTextItem[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [agentId, setAgentId] = useState("");
  const [groupName, setGroupName] = useState("");
  const [pax, setPax] = useState("");
  const [error, setError] = useState<ImportError>(null);

  const parseText = () => {
    const result = parseAgreementText(sourceText);
    setItems(result.items);
    setWarnings(result.warnings);
    setError(result.items.length === 0 ? { message: "Format belum terbaca. Pastikan nama hotel berada tepat di atas nomor agreement." } : null);
  };

  const updateItem = <Key extends keyof ParsedAgreementTextItem>(
    index: number,
    key: Key,
    value: ParsedAgreementTextItem[Key],
  ) => {
    setItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const parsedPax = Number.parseInt(pax, 10);
    if (!agentId || !groupName.trim() || !Number.isInteger(parsedPax) || parsedPax < 1) {
      setError({ message: "Lengkapi agent, nama group, dan pax sebelum menyimpan." });
      return;
    }
    if (items.some((item) => !item.city || !item.status || !item.hotelName.trim() || !item.agreementNumber.trim() || !item.stayStartIso || !item.stayEndIso)) {
      setError({ message: "Lengkapi kota, status, hotel, nomor agreement, serta tanggal check-in dan check-out." });
      return;
    }
    if (items.some((item) => item.stayEndIso < item.stayStartIso)) {
      setError({ message: "Tanggal check-out tidak boleh sebelum check-in." });
      return;
    }

    setError(null);
    const remaining = [...items];
    while (remaining.length > 0) {
      const item = remaining[0];
      if (!item.city || !item.status) {
        setError({ message: "Pilih kota dan status untuk setiap agreement sebelum menyimpan." });
        return;
      }
      const saved = await onSaveDraft({
        city: item.city,
        agentId,
        groupName: groupName.trim(),
        hotelName: item.hotelName.trim(),
        agreementNumber: item.agreementNumber.trim(),
        pax: parsedPax.toString(),
        status: item.status,
        stayStartIso: item.stayStartIso,
        stayEndIso: item.stayEndIso,
        notes: "",
      });
      if (!saved) {
        setItems([...remaining]);
        setError({ message: "Draft yang belum tersimpan tetap ada di daftar. Periksa pesan error lalu coba lagi." });
        return;
      }
      remaining.shift();
      setItems([...remaining]);
    }
    onComplete();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-surface-container-low p-3 sm:p-4">
        <label className="block text-sm font-bold text-on-surface" htmlFor="agreement-source-text">
          Paste pesan agreement
        </label>
        <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
          Data yang terbaca akan diisi otomatis. Field yang tidak ada di pesan tetap kosong untuk dilengkapi manual.
        </p>
        <textarea
          id="agreement-source-text"
          className="serene-textarea mt-3 min-h-40 w-full font-medium"
          value={sourceText}
          onChange={(event) => setSourceText(event.target.value)}
          placeholder={SAMPLE_TEXT}
        />
        <div className="mt-3 flex justify-end">
          <Button variant="secondary" type="button" onClick={parseText} disabled={!sourceText.trim() || isSaving}>
            Baca & isi otomatis
          </Button>
        </div>
      </div>

      {warnings.length > 0 && items.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-semibold leading-relaxed text-amber-900" role="status">
          {warnings.join(" ")}
        </div>
      ) : null}

      {items.length > 0 ? (
        <form className="space-y-4" onSubmit={(event) => void submit(event)}>
          <div>
            <h3 className="text-sm font-extrabold text-on-surface">Data yang belum ada</h3>
            <p className="mt-1 text-xs text-on-surface-variant">Nilai ini akan dipakai untuk semua agreement di bawah.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-[minmax(180px,1fr)_minmax(220px,1.4fr)_120px]">
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
              <span>Agent</span>
              <SereneSelect value={agentId} onChange={(event) => setAgentId(event.target.value)} className="serene-select">
                <option value="" disabled>Select Agent</option>
                {(agentsQuery.data ?? []).filter((agent) => agent.status === "ACTIVE").map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
              </SereneSelect>
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
              <span>Group Name</span>
              <input className="serene-input serene-input-md" value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="Group Al Falah April" />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
              <span>Pax</span>
              <input className="serene-input serene-input-md" type="number" min={1} value={pax} onChange={(event) => setPax(event.target.value)} placeholder="40" />
            </label>
          </div>

          <div className="space-y-3">
            {items.map((item, index) => (
              <fieldset key={`${item.agreementNumber}-${index}`} className="rounded-xl border border-outline-variant/35 p-3 sm:p-4">
                <legend className="px-1 text-sm font-extrabold text-on-surface">Agreement {index + 1}</legend>
                <div className="grid gap-3 lg:grid-cols-12">
                  <label className="grid gap-1.5 text-sm font-semibold text-slate-700 lg:col-span-2">
                    <span>City</span>
                    <SereneSelect className="serene-select" value={item.city} onChange={(event) => updateItem(index, "city", event.target.value as ParsedAgreementTextItem["city"])}>
                      <option value="" disabled>Select City</option><option value="makkah">Makkah</option><option value="madinah">Madinah</option>
                    </SereneSelect>
                  </label>
                  <label className="grid gap-1.5 text-sm font-semibold text-slate-700 lg:col-span-5">
                    <span>Hotel Name</span>
                    <input className="serene-input serene-input-md" value={item.hotelName} onChange={(event) => updateItem(index, "hotelName", event.target.value)} />
                  </label>
                  <label className="grid gap-1.5 text-sm font-semibold text-slate-700 lg:col-span-5">
                    <span>Agreement Number</span>
                    <input className="serene-input serene-input-md tabular-nums" value={item.agreementNumber} onChange={(event) => updateItem(index, "agreementNumber", event.target.value)} />
                  </label>
                  <label className="grid gap-1.5 text-sm font-semibold text-slate-700 lg:col-span-4">
                    <span>Approval Status</span>
                    <SereneSelect className="serene-select" value={item.status} onChange={(event) => updateItem(index, "status", event.target.value as AgreementApprovalStatus)}>
                      <option value="" disabled>Select Status</option><option value="Waiting for Approval">Waiting for Approval</option><option value="Approved">Approved</option><option value="Rejected">Rejected</option>
                    </SereneSelect>
                  </label>
                  <label className="grid gap-1.5 text-sm font-semibold text-slate-700 lg:col-span-4">
                    <span>Stay Start</span>
                    <DatePickerInput id={`parsed-stay-start-${index}`} inputClassName="serene-input serene-input-md" value={item.stayStartIso} onChange={(value) => updateItem(index, "stayStartIso", value)} />
                  </label>
                  <label className="grid gap-1.5 text-sm font-semibold text-slate-700 lg:col-span-4">
                    <span>Stay End</span>
                    <DatePickerInput id={`parsed-stay-end-${index}`} inputClassName="serene-input serene-input-md" value={item.stayEndIso} onChange={(value) => updateItem(index, "stayEndIso", value)} />
                  </label>
                </div>
              </fieldset>
            ))}
          </div>

          {error ? <p className="text-sm font-semibold text-rose-700" role="alert">{error.message}</p> : null}
          <div className="flex justify-end border-t border-outline-variant/25 pt-4">
            <Button variant="primary" type="submit" disabled={isSaving} className="inline-flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base" aria-hidden="true">{isSaving ? "sync" : "check_circle"}</span>
              <span>{isSaving ? "Saving..." : `Save ${items.length} Agreement${items.length > 1 ? "s" : ""}`}</span>
            </Button>
          </div>
        </form>
      ) : error ? <p className="text-sm font-semibold text-rose-700" role="alert">{error.message}</p> : null}
    </div>
  );
}
