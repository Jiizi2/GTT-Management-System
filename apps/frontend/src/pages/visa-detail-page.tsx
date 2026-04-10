import { useEffect, useRef, useState } from "react";
import * as Domain from "../shared/app-domain";
import { DatePickerInput } from "../components/date-time-pickers";
import { SereneSelect } from "../components/serene-select";
import {
  PaymentStatusModal,
  SyarikahModal,
  VisaHotelModal,
  VisaRaudhahModal,
  VisaStatusModal,
} from "../components/visa-detail-modals";
import type {
  GroupAgreementHotel,
  GroupData,
  VisaHotelEditFormState,
  VisaPaymentStatus,
  VisaRaudhahEditFormState,
  VisaStatus,
  VisaTrackingRow,
} from "../shared/app-domain";

const {
  formatVisaDateWithYear,
  getGroupAgreementHotelsByCity,
  resolveVisaAgreementDateRange,
  resolveVisaAgreementNumber,
  resolveVisaProvider,
  shiftIsoDate,
} = Domain;

type Tone = "success" | "warning" | "muted";
type RaudhahStatus = "Free" | "Before" | "After";

function getToneClasses(tone: Tone): string {
  if (tone === "success") {
    return "border-brand-primary/25 bg-brand-primary/12 text-brand-primary";
  }

  if (tone === "warning") {
    return "border-brand-tertiary/30 bg-brand-tertiary/12 text-brand-tertiary";
  }

  return "border-brand-secondary/30 bg-brand-secondary/12 text-brand-secondary";
}

function getToneTextClass(tone: Tone): string {
  if (tone === "success") {
    return "text-brand-primary";
  }

  if (tone === "warning") {
    return "text-brand-tertiary";
  }

  return "text-brand-secondary";
}

function getIconButtonClasses(isDanger = false): string {
  if (isDanger) {
    return "inline-flex h-9 w-9 items-center justify-center rounded-full border border-brand-tertiary/35 bg-brand-tertiary/12 text-brand-tertiary transition hover:bg-brand-tertiary/20";
  }

  return "inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-surface-container-lowest text-slate-600 transition hover:border-brand-primary hover:text-brand-primary";
}

function getCitySummaryClasses(hasMissing: boolean): string {
  if (hasMissing) {
    return "border-brand-tertiary/30 bg-brand-tertiary/12 text-brand-tertiary";
  }

  return "border-brand-primary/25 bg-brand-primary/10 text-brand-primary";
}

function getAgreementStatusClasses(isApproved: boolean): string {
  return isApproved
    ? "border-brand-primary/25 bg-brand-primary/12 text-brand-primary"
    : "border-amber-200 bg-amber-100 text-amber-800";
}

function getAgreementStatusLabel(status: GroupAgreementHotel["status"]): "Approved" | "Waiting for Approval" {
  return status === "Approved" ? "Approved" : "Waiting for Approval";
}

function formatAgreementStayRange(agreement: GroupAgreementHotel): string {
  const stayStartIso = agreement.stayStartIso?.trim() ?? "";
  const stayEndIso = agreement.stayEndIso?.trim() ?? "";

  if (!stayStartIso && !stayEndIso) {
    return "Stay dates pending";
  }

  if (stayStartIso && stayEndIso) {
    return `${formatVisaDateWithYear(stayStartIso)} - ${formatVisaDateWithYear(stayEndIso)}`;
  }

  if (stayStartIso) {
    return `Start ${formatVisaDateWithYear(stayStartIso)}`;
  }

  return `End ${formatVisaDateWithYear(stayEndIso)}`;
}

function formatAgreementSummary(agreement: GroupAgreementHotel): string {
  const agreementNumber = agreement.agreementNumber?.trim() || "Agreement number pending";
  const paxLabel = Number.isFinite(agreement.pax) ? agreement.pax.toString() : "0";

  return `${agreementNumber} - Pax ${paxLabel} - ${formatAgreementStayRange(agreement)}`;
}

function getRaudhahStatusBadgeClasses(status: RaudhahStatus): string {
  if (status === "After") {
    return "border-brand-primary/25 bg-brand-primary/12 text-brand-primary";
  }

  if (status === "Before") {
    return "border-brand-tertiary/30 bg-brand-tertiary/12 text-brand-tertiary";
  }

  return "border-brand-secondary/30 bg-brand-secondary/12 text-brand-secondary";
}

function formatReminderHeaderDate(isoDate: string): string {
  if (!isoDate) {
    return "-";
  }

  const parsedDate = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(parsedDate.getTime())) {
    return isoDate;
  }

  return parsedDate
    .toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    })
    .toUpperCase()
    .replace(".", "");
}

function buildRaudhahAgentScheduleLines(
  appointments: Array<{ dateIso: string; status: RaudhahStatus }>,
): string[] {
  const parsedAppointments = appointments
    .map((appointment) => {
      const parsedDate = new Date(`${appointment.dateIso}T12:00:00`);
      if (Number.isNaN(parsedDate.getTime())) {
        return null;
      }

      return {
        day: parsedDate.getDate(),
        status: appointment.status,
      };
    })
    .filter(
      (
        appointment,
      ): appointment is {
        day: number;
        status: RaudhahStatus;
      } => appointment !== null,
    );

  if (parsedAppointments.length === 0) {
    return ["- [tanggal] -> Free", "- [tanggal] -> After", "- [tanggal] -> Before (sebelum dzuhur)"];
  }

  const statusOrder: RaudhahStatus[] = ["Free", "After", "Before"];
  const lines = statusOrder
    .map((status) => {
      const days = Array.from(
        new Set(parsedAppointments.filter((appointment) => appointment.status === status).map((appointment) => appointment.day)),
      ).sort((left, right) => left - right);

      if (days.length === 0) {
        return null;
      }

      if (status === "Before") {
        return `- ${days.join(" - ")} -> ${status} (sebelum dzuhur)`;
      }

      return `- ${days.join(" - ")} -> ${status}`;
    })
    .filter((line): line is string => line !== null);

  if (lines.length > 0) {
    return lines;
  }

  return ["- [tanggal] -> Free", "- [tanggal] -> After", "- [tanggal] -> Before (sebelum dzuhur)"];
}

function buildNusukSlotScheduleLines(appointments: Array<{ dateIso: string }>): string[] {
  const targetDates = Array.from(new Set(appointments.map((appointment) => appointment.dateIso))).sort((left, right) =>
    left.localeCompare(right),
  );

  if (targetDates.length === 0) {
    return ["- Target [tanggal] -> H-7 [tanggal] | H-2 [tanggal]"];
  }

  return targetDates.map((targetDateIso) => {
    const h7BookingDateIso = shiftIsoDate(targetDateIso, -7);
    const h2BookingDateIso = shiftIsoDate(targetDateIso, -2);
    return `- Target ${formatVisaDateWithYear(targetDateIso)} -> H-7 ${formatVisaDateWithYear(
      h7BookingDateIso,
    )} | H-2 ${formatVisaDateWithYear(h2BookingDateIso)}`;
  });
}
const inlineHotelFieldClassName = "flex min-w-0 flex-col gap-1.5 text-sm font-medium text-slate-700";
const inlineHotelInputClassName =
  "h-11 w-full rounded-xl border border-slate-300 bg-surface-container-lowest px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200";
const inlineHotelSelectClassName = "serene-select";

export function VisaTrackingDetailScreen({
  row,
  groups,
  onBack,
  onUpdateVisaStatus,
  onUpdatePaymentStatus,
  onUpdateSyarikah,
  onUpdateVisaHotel,
  onDeleteVisaHotel,
  onUpdateRaudhahAppointment,
  onClearRaudhahAppointment,
}: {
  row: VisaTrackingRow;
  groups: GroupData[];
  onBack: () => void;
  onUpdateVisaStatus: (groupCode: string, visaStatus: VisaStatus) => void;
  onUpdatePaymentStatus: (groupCode: string, paymentStatus: VisaPaymentStatus) => void;
  onUpdateSyarikah: (groupCode: string, syarikah: string) => void;
  onUpdateVisaHotel: (
    groupCode: string,
    city: "makkah" | "madinah",
    hotel: VisaHotelEditFormState,
    hotelId?: string,
  ) => void;
  onDeleteVisaHotel: (groupCode: string, city: "makkah" | "madinah", hotelId: string) => void;
  onUpdateRaudhahAppointment: (
    groupCode: string,
    appointment: VisaRaudhahEditFormState,
  ) => void;
  onClearRaudhahAppointment: (groupCode: string) => void;
}) {
  const [paymentStatus, setPaymentStatus] = useState<VisaPaymentStatus>(row.paymentStatus);
  const [activeModal, setActiveModal] = useState<
    "visa-status" | "payment-status" | "syarikah" | "hotel" | "raudhah" | null
  >(null);
  const [visaStatusDraft, setVisaStatusDraft] = useState<VisaStatus>(row.visaStatus);
  const [paymentStatusDraft, setPaymentStatusDraft] = useState<VisaPaymentStatus>(row.paymentStatus);
  const [syarikahDraft, setSyarikahDraft] = useState("");
  const [hotelCityDraft, setHotelCityDraft] = useState<"makkah" | "madinah">("makkah");
  const [hotelDraftMode, setHotelDraftMode] = useState<"add" | "edit">("edit");
  const [hotelDraftId, setHotelDraftId] = useState<string | null>(null);
  const [hotelDraft, setHotelDraft] = useState<VisaHotelEditFormState>({
    hotelName: "",
    agreementNumber: "",
    pax: "",
    status: "Waiting for Approval",
    stayStartIso: "",
    stayEndIso: "",
  });
  const [addingHotelCity, setAddingHotelCity] = useState<"makkah" | "madinah" | null>(null);
  const [addingHotelDraft, setAddingHotelDraft] = useState<VisaHotelEditFormState>({
    hotelName: "",
    agreementNumber: "",
    pax: "",
    status: "Waiting for Approval",
    stayStartIso: "",
    stayEndIso: "",
  });
  const [raudhahDraft, setRaudhahDraft] = useState<VisaRaudhahEditFormState>({
    appointments: [],
  });
  const [isRaudhahTemplateCopied, setIsRaudhahTemplateCopied] = useState(false);
  const [isClearRaudhahConfirmOpen, setIsClearRaudhahConfirmOpen] = useState(false);
  const raudhahCopyTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  const group = groups.find((item) => item.code === row.groupCode) ?? null;
  const groupIndex = Math.max(
    0,
    groups.findIndex((item) => item.code === row.groupCode),
  );

  const totalPax = group?.pax ?? row.pax;
  const durationDays = group?.durationDays ?? 8;
  const agreementDateRange = resolveVisaAgreementDateRange(row, durationDays, group ?? undefined);
  const departureIso = agreementDateRange.makkahStartIso;
  const makkahEndIso = agreementDateRange.makkahEndIso;
  const madinahStartIso = agreementDateRange.madinahStartIso;
  const fallbackReturnIso = agreementDateRange.madinahEndIso;

  const makkahHotels = [
    "Makkah Clock Tower",
    "Swissotel Al Maqam",
    "Hilton Suites Makkah",
    "Movenpick Hajar Tower",
  ];
  const madinahHotels = [
    "Anwar Al Madinah Movenpick",
    "Pullman Zamzam Madinah",
    "Taiba Front Hotel",
    "Shaza Regency Plaza",
  ];
  const primaryMakkahAgreement = getGroupAgreementHotelsByCity(group ?? undefined, "makkah")[0];
  const primaryMadinahAgreement = getGroupAgreementHotelsByCity(group ?? undefined, "madinah")[0];
  const makkahAgreements = getGroupAgreementHotelsByCity(group ?? undefined, "makkah");
  const madinahAgreements = getGroupAgreementHotelsByCity(group ?? undefined, "madinah");
  const makkahHotelName =
    primaryMakkahAgreement?.hotelName?.trim() || makkahHotels[groupIndex % makkahHotels.length];
  const madinahHotelName =
    primaryMadinahAgreement?.hotelName?.trim() || madinahHotels[groupIndex % madinahHotels.length];

  const makkahAssigned = Math.min(totalPax, row.makkahVerified);
  const madinahAssigned = Math.min(totalPax, row.madinahVerified);
  const makkahMissing = Math.max(0, totalPax - makkahAssigned);
  const madinahMissing = Math.max(0, totalPax - madinahAssigned);

  const visaTone: Tone =
    row.visaStatus === "Issued" ? "success" : row.visaStatus === "Pending" ? "warning" : "muted";
  const paymentTone: Tone =
    paymentStatus === "Paid" ? "success" : paymentStatus === "Unpaid" ? "warning" : "muted";
  const raudhahAppointments = (group?.visaSetup?.raudhahAppointments ?? [])
    .map((appointment) => ({
      dateIso: appointment.dateIso?.trim() ?? "",
      status: appointment.status,
    }))
    .filter((appointment) => appointment.dateIso.length > 0)
    .sort((left, right) => left.dateIso.localeCompare(right.dateIso))
    .map((appointment) => ({
      ...appointment,
      dateLabel: formatVisaDateWithYear(appointment.dateIso),
    }));
  const hasRaudhahDates = raudhahAppointments.length > 0;
  const raudhahTone: Tone = hasRaudhahDates ? "success" : "muted";
  const raudhahStatusText = hasRaudhahDates ? "Set" : "Not Set";
  const raudhahStatusSummary = hasRaudhahDates
    ? Array.from(new Set(raudhahAppointments.map((appointment) => appointment.status))).join(", ")
    : "";
  const raudhahSecondaryText = hasRaudhahDates
    ? `${raudhahAppointments.length} appointment date${raudhahAppointments.length > 1 ? "s" : ""} selected${
        raudhahStatusSummary ? ` (${raudhahStatusSummary})` : ""
      }`
    : "Appointment pending";
  const raudhahSecondaryTextMobile = hasRaudhahDates
    ? `${raudhahAppointments.length} date${raudhahAppointments.length > 1 ? "s" : ""} set`
    : "Pending";
  const providerName = group?.visaSetup?.syarikah?.trim() || resolveVisaProvider(row.packageName);
  const reminderCoordinatorName = (group?.musyrif?.name?.trim() || "PIC").toUpperCase();
  const reminderHeaderDate = formatReminderHeaderDate(row.departureIso);
  const raudhahAgentScheduleLines = buildRaudhahAgentScheduleLines(raudhahAppointments);
  const nusukSlotScheduleLines = buildNusukSlotScheduleLines(raudhahAppointments);
  const raudhahReminderTemplate = [
    `Reminder Booking Raudhah GROUP ${totalPax} PAX ${row.groupName.toUpperCase()} ${reminderHeaderDate} (${reminderCoordinatorName})`,
    "",
    `Syarikah: ${providerName}`,
    "Slot booking Nusuk hanya dibuka pada H-7 dan H-2 dari target date.",
    "Jadwal slot booking:",
    ...nusukSlotScheduleLines,
    "",
    "Detail Group:",
    `${row.groupCode} -> Ikhwan ... Pax | Akhwat ... pax`,
    "",
    "Jadwal Raudhah Agent:",
    ...raudhahAgentScheduleLines,
  ].join("\n");
  const makkahAgreementNumber = resolveVisaAgreementNumber(row, group ?? undefined, "makkah");
  const madinahAgreementNumber = resolveVisaAgreementNumber(row, group ?? undefined, "madinah");

  const fallbackMakkahAgreement: GroupAgreementHotel = {
    id: `${row.groupCode}-makkah-fallback`,
    hotelName: makkahHotelName,
    agreementNumber: makkahAgreementNumber,
    pax: totalPax,
    status: makkahMissing === 0 ? "Approved" : "Waiting for Approval",
    stayStartIso: departureIso,
    stayEndIso: makkahEndIso,
  };

  const fallbackMadinahAgreement: GroupAgreementHotel = {
    id: `${row.groupCode}-madinah-fallback`,
    hotelName: madinahHotelName,
    agreementNumber: madinahAgreementNumber,
    pax: totalPax,
    status: madinahMissing === 0 ? "Approved" : "Waiting for Approval",
    stayStartIso: madinahStartIso,
    stayEndIso: fallbackReturnIso,
  };

  const visibleMakkahAgreements = makkahAgreements.length > 0 ? makkahAgreements : [fallbackMakkahAgreement];
  const visibleMadinahAgreements = madinahAgreements.length > 0 ? madinahAgreements : [fallbackMadinahAgreement];
  const makkahAgreementIdSet = new Set(makkahAgreements.map((agreement) => agreement.id));
  const madinahAgreementIdSet = new Set(madinahAgreements.map((agreement) => agreement.id));

  const buildHotelDraft = (
    city: "makkah" | "madinah",
    mode: "add" | "edit",
    hotelId?: string,
  ): VisaHotelEditFormState => {
    const cityHotels = getGroupAgreementHotelsByCity(group ?? undefined, city);
    const currentHotel = hotelId
      ? cityHotels.find((entry) => entry.id === hotelId)
      : cityHotels[0];
    const cityRange = resolveVisaAgreementDateRange(row, durationDays, group ?? undefined);

    if (mode === "add") {
      return {
        hotelName: "",
        agreementNumber: resolveVisaAgreementNumber(row, group ?? undefined, city),
        pax: totalPax.toString(),
        status: "Waiting for Approval",
        stayStartIso: city === "makkah" ? cityRange.makkahStartIso : cityRange.madinahStartIso,
        stayEndIso: city === "makkah" ? cityRange.makkahEndIso : cityRange.madinahEndIso,
      };
    }

    return {
      hotelName:
        currentHotel?.hotelName?.trim() || (city === "makkah" ? makkahHotelName : madinahHotelName),
      agreementNumber:
        currentHotel?.agreementNumber?.trim() ||
        resolveVisaAgreementNumber(row, group ?? undefined, city),
      pax: currentHotel?.pax?.toString() || totalPax.toString(),
      status: currentHotel?.status ?? "Waiting for Approval",
      stayStartIso:
        currentHotel?.stayStartIso?.trim() ||
        (city === "makkah" ? cityRange.makkahStartIso : cityRange.madinahStartIso),
      stayEndIso:
        currentHotel?.stayEndIso?.trim() ||
        (city === "makkah" ? cityRange.makkahEndIso : cityRange.madinahEndIso),
    };
  };

  const buildRaudhahDraft = (): VisaRaudhahEditFormState => {
    return {
      appointments: (group?.visaSetup?.raudhahAppointments ?? [])
        .map((appointment, index) => ({
          id:
            appointment.id?.trim() ||
            `${row.groupCode}-raudhah-${Date.now().toString(36)}-${index + 1}`,
          dateIso: appointment.dateIso?.trim() ?? "",
          status: appointment.status,
          tasrehPrinted: Boolean(appointment.tasrehPrinted),
        }))
        .filter((appointment) => appointment.dateIso.length > 0),
    };
  };

  const openVisaStatusModal = () => {
    setVisaStatusDraft(row.visaStatus);
    setActiveModal("visa-status");
  };

  const openPaymentStatusModal = () => {
    setPaymentStatusDraft(paymentStatus);
    setActiveModal("payment-status");
  };

  const openSyarikahModal = () => {
    setSyarikahDraft(providerName);
    setActiveModal("syarikah");
  };

  const openHotelModal = (
    city: "makkah" | "madinah",
    mode: "add" | "edit",
    hotelId?: string,
  ) => {
    setAddingHotelCity(null);
    setHotelCityDraft(city);
    setHotelDraftMode(mode);
    setHotelDraftId(mode === "edit" ? hotelId ?? null : null);
    setHotelDraft(buildHotelDraft(city, mode, hotelId));
    setActiveModal("hotel");
  };

  const openAddHotelInline = (city: "makkah" | "madinah") => {
    setActiveModal(null);
    setAddingHotelCity(city);
    setAddingHotelDraft(buildHotelDraft(city, "add"));
  };

  const cancelAddHotelInline = () => {
    setAddingHotelCity(null);
  };

  const openRaudhahModal = () => {
    setRaudhahDraft(buildRaudhahDraft());
    setActiveModal("raudhah");
  };

  const closeModal = () => {
    setActiveModal(null);
  };

  const saveVisaStatus = () => {
    onUpdateVisaStatus(row.groupCode, visaStatusDraft);
    closeModal();
  };

  const savePaymentStatus = () => {
    onUpdatePaymentStatus(row.groupCode, paymentStatusDraft);
    setPaymentStatus(paymentStatusDraft);
    closeModal();
  };

  const saveSyarikah = () => {
    onUpdateSyarikah(row.groupCode, syarikahDraft);
    closeModal();
  };

  const saveHotel = () => {
    onUpdateVisaHotel(
      row.groupCode,
      hotelCityDraft,
      hotelDraft,
      hotelDraftMode === "edit" ? hotelDraftId ?? undefined : undefined,
    );
    closeModal();
  };

  const saveRaudhah = () => {
    onUpdateRaudhahAppointment(row.groupCode, raudhahDraft);
    closeModal();
  };

  const saveAddHotelInline = () => {
    if (!addingHotelCity) {
      return;
    }

    onUpdateVisaHotel(row.groupCode, addingHotelCity, addingHotelDraft);
    setAddingHotelCity(null);
  };

  const clearRaudhah = () => {
    onClearRaudhahAppointment(row.groupCode);
    setIsClearRaudhahConfirmOpen(false);
    closeModal();
  };

  const handleCopyRaudhahReminder = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(raudhahReminderTemplate);
      }
    } catch {
      // No-op fallback for browsers that block clipboard API.
    }

    setIsRaudhahTemplateCopied(true);
    if (raudhahCopyTimerRef.current !== null) {
      window.clearTimeout(raudhahCopyTimerRef.current);
    }

    raudhahCopyTimerRef.current = window.setTimeout(() => {
      setIsRaudhahTemplateCopied(false);
      raudhahCopyTimerRef.current = null;
    }, 1600);
  };

  const handleHotelDraftChange = <Key extends keyof VisaHotelEditFormState>(
    field: Key,
    nextValue: VisaHotelEditFormState[Key],
  ) => {
    setHotelDraft((current) => ({ ...current, [field]: nextValue }));
  };

  const handleAddRaudhahDraftAppointment = () => {
    setRaudhahDraft((current) => ({
      appointments: [
        ...current.appointments,
        {
          id: `${row.groupCode}-raudhah-draft-${Date.now().toString(36)}-${current.appointments.length + 1}`,
          dateIso: row.departureIso,
          status: "After",
          tasrehPrinted: false,
        },
      ],
    }));
  };

  const handleRemoveRaudhahDraftAppointment = (appointmentId: string) => {
    setRaudhahDraft((current) => ({
      appointments: current.appointments.filter((appointment) => appointment.id !== appointmentId),
    }));
  };

  const handleRaudhahDraftAppointmentChange = (
    appointmentId: string,
    field: "dateIso" | "status",
    nextValue: string | "Free" | "Before" | "After",
  ) => {
    setRaudhahDraft((current) => ({
      appointments: current.appointments.map((appointment) =>
        appointment.id === appointmentId
          ? {
              ...appointment,
              [field]: nextValue,
            }
          : appointment,
      ),
    }));
  };

  const handleAddingHotelDraftChange = <Key extends keyof VisaHotelEditFormState>(
    field: Key,
    nextValue: VisaHotelEditFormState[Key],
  ) => {
    setAddingHotelDraft((current) => ({ ...current, [field]: nextValue }));
  };

  const isAddingHotelDraftSaveDisabled =
    !addingHotelDraft.hotelName.trim() ||
    !addingHotelDraft.agreementNumber.trim() ||
    !addingHotelDraft.pax.trim() ||
    Number.parseInt(addingHotelDraft.pax, 10) <= 0 ||
    !addingHotelDraft.stayStartIso.trim() ||
    !addingHotelDraft.stayEndIso.trim() ||
    addingHotelDraft.stayEndIso < addingHotelDraft.stayStartIso;
  const isRaudhahDraftSaveDisabled = raudhahDraft.appointments.some(
    (appointment) => !appointment.dateIso.trim(),
  );

  useEffect(() => {
    setPaymentStatus(row.paymentStatus);
  }, [row.id, row.paymentStatus]);

  useEffect(() => {
    setAddingHotelCity(null);
    setIsRaudhahTemplateCopied(false);
    setIsClearRaudhahConfirmOpen(false);
  }, [row.id]);

  useEffect(() => () => {
    if (raudhahCopyTimerRef.current !== null) {
      window.clearTimeout(raudhahCopyTimerRef.current);
      raudhahCopyTimerRef.current = null;
    }
  }, []);

  return (
    <div className="mx-auto max-w-7xl space-y-6 overflow-x-hidden px-3 pb-20 pt-4 sm:px-6 lg:px-8">
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

      <section className="flex flex-col gap-4 rounded-3xl border border-slate-200/70 bg-brand-neutral p-4 shadow-sm sm:p-5 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-primary">Visa Detail</p>
          <h1 className="mt-2 break-words text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {row.groupCode}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <p className="min-w-0 break-words">{group?.name ?? row.groupName}</p>
            <span className="inline-flex rounded-lg border border-brand-primary/30 bg-brand-primary/10 px-2.5 py-1 text-xs font-bold leading-none text-brand-primary">
              <span className="sm:hidden">{totalPax} Pax</span>
              <span className="hidden sm:inline">{totalPax} Pax Total</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-surface-container-lowest px-3 py-2 text-sm font-semibold text-slate-700 transition disabled:cursor-not-allowed disabled:opacity-60"
            disabled
            title="Export PDF is coming soon."
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              picture_as_pdf
            </span>
            <span className="sm:hidden">Export (Soon)</span>
            <span className="hidden sm:inline">Export PDF (Soon)</span>
          </button>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3" aria-label="Quick status">
        <article className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-surface-container-lowest p-3 sm:p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Visa Status</p>
            <div className={`mt-2 inline-flex items-center gap-2 rounded-lg border px-2.5 py-1 text-sm font-bold leading-none ${getToneClasses(visaTone)}`}>
              <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />
              <strong>{row.visaStatus}</strong>
            </div>
          </div>
          <button
            type="button"
            className={`${getIconButtonClasses()} shrink-0`}
            aria-label="Edit visa status"
            onClick={openVisaStatusModal}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              edit
            </span>
          </button>
        </article>

        <article className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-surface-container-lowest p-3 sm:p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payment Status</p>
            <div className={`mt-2 inline-flex items-center gap-2 rounded-lg border px-2.5 py-1 text-sm font-bold leading-none ${getToneClasses(paymentTone)}`}>
              <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />
              <strong>{paymentStatus}</strong>
            </div>
          </div>
          <button
            type="button"
            className={`${getIconButtonClasses()} shrink-0`}
            aria-label="Edit payment status"
            onClick={openPaymentStatusModal}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              edit
            </span>
          </button>
        </article>

        <article className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-surface-container-lowest p-3 sm:p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span className="sm:hidden">Raudhah</span>
              <span className="hidden sm:inline">Raudhah Appointment</span>
            </p>
            <div className={`mt-2 inline-flex items-center gap-2 rounded-lg border px-2.5 py-1 text-sm font-bold leading-none ${getToneClasses(raudhahTone)}`}>
              <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />
              <strong>{raudhahStatusText}</strong>
            </div>
          </div>
          <button
            type="button"
            className={`${getIconButtonClasses()} shrink-0`}
            aria-label="Edit Raudhah appointment"
            onClick={openRaudhahModal}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              edit
            </span>
          </button>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-3xl border border-slate-200 bg-surface-container-lowest p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <span className="material-symbols-outlined text-brand-primary" aria-hidden="true">
                mosque
              </span>
              <h2 className="text-xl font-bold text-slate-900">Makkah</h2>
            </div>

            <button
              type="button"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-surface-container-lowest px-3 py-2 text-xs font-bold leading-none text-slate-700 transition hover:border-brand-primary hover:text-brand-primary sm:w-auto sm:justify-start sm:py-1.5"
              onClick={() => openAddHotelInline("makkah")}
            >
              <span className="material-symbols-outlined text-base" aria-hidden="true">
                add
              </span>
              <span>Add Hotel</span>
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {visibleMakkahAgreements.map((agreement, index) => {
              const canDeleteAgreement = makkahAgreementIdSet.has(agreement.id);
              const statusLabel = getAgreementStatusLabel(agreement.status);

              return (
                <details key={agreement.id} className="serene-accordion">
                  <summary className="serene-accordion-summary">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-base font-semibold text-slate-900">
                          {agreement.hotelName.trim() || `Hotel ${index + 1}`}
                        </h3>
                        <span
                          className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-bold leading-none ${getAgreementStatusClasses(
                            agreement.status === "Approved",
                          )}`}
                        >
                          {statusLabel}
                        </span>
                      </div>
                      <p className="mt-1 break-words text-xs leading-5 text-slate-500">
                        {formatAgreementSummary(agreement)}
                      </p>
                    </div>

                    <span
                      className="serene-accordion-chevron material-symbols-outlined text-on-surface-variant"
                      aria-hidden="true"
                    >
                      expand_more
                    </span>
                  </summary>

                  <div className="serene-accordion-content">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-slate-200 bg-surface-container-lowest px-2.5 py-1 text-xs font-bold leading-none text-slate-700">
                        <span className="material-symbols-outlined text-base" aria-hidden="true">
                          group
                        </span>
                        <span>{agreement.pax} Pax</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className={getIconButtonClasses()}
                          aria-label={`Edit Makkah agreement ${index + 1}`}
                          onClick={() => openHotelModal("makkah", "edit", agreement.id)}
                        >
                          <span className="material-symbols-outlined" aria-hidden="true">
                            edit
                          </span>
                        </button>
                        <button
                          type="button"
                          className={`${getIconButtonClasses(true)} disabled:cursor-not-allowed disabled:opacity-45`}
                          aria-label={`Delete Makkah agreement ${index + 1}`}
                          onClick={() => onDeleteVisaHotel(row.groupCode, "makkah", agreement.id)}
                          disabled={!canDeleteAgreement}
                        >
                          <span className="material-symbols-outlined" aria-hidden="true">
                            delete
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                </details>
              );
            })}
          </div>

          {addingHotelCity === "makkah" ? (
            <article className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="mb-3 flex items-center gap-2 text-emerald-900">
                <span className="material-symbols-outlined text-base" aria-hidden="true">
                  add_home_work
                </span>
                <h3 className="text-sm font-semibold">New Makkah Agreement</h3>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className={inlineHotelFieldClassName}>
                  <span>Hotel Name</span>
                  <input
                    type="text"
                    className={inlineHotelInputClassName}
                    value={addingHotelDraft.hotelName}
                    onChange={(event) => handleAddingHotelDraftChange("hotelName", event.target.value)}
                    placeholder="e.g. Swissotel Al Maqam"
                  />
                </label>

                <label className={inlineHotelFieldClassName}>
                  <span>Agreement Number</span>
                  <input
                    type="text"
                    className={inlineHotelInputClassName}
                    value={addingHotelDraft.agreementNumber}
                    onChange={(event) => handleAddingHotelDraftChange("agreementNumber", event.target.value)}
                    placeholder="2026xxxxxxxxxxxxx"
                  />
                </label>

                <label className={inlineHotelFieldClassName}>
                  <span>Total Pax</span>
                  <input
                    type="number"
                    min={1}
                    className={inlineHotelInputClassName}
                    value={addingHotelDraft.pax}
                    onChange={(event) => handleAddingHotelDraftChange("pax", event.target.value)}
                    placeholder={totalPax.toString()}
                  />
                </label>

                <label className={inlineHotelFieldClassName}>
                  <span>Approval Status</span>
                  <div className="relative">
                    <SereneSelect
                      className={inlineHotelSelectClassName}
                      value={addingHotelDraft.status}
                      onChange={(event) =>
                        handleAddingHotelDraftChange(
                          "status",
                          event.target.value as VisaHotelEditFormState["status"],
                        )
                      }
                    >
                      <option value="Waiting for Approval">Waiting for Approval</option>
                      <option value="Approved">Approved</option>
                    </SereneSelect>
                  </div>
                </label>

                <label className={inlineHotelFieldClassName}>
                  <span>Stay Start Date</span>
                  <DatePickerInput
                    inputClassName={inlineHotelInputClassName}
                    value={addingHotelDraft.stayStartIso}
                    onChange={(nextValue) => handleAddingHotelDraftChange("stayStartIso", nextValue)}
                  />
                </label>

                <label className={inlineHotelFieldClassName}>
                  <span>Stay End Date</span>
                  <DatePickerInput
                    inputClassName={inlineHotelInputClassName}
                    value={addingHotelDraft.stayEndIso}
                    onChange={(nextValue) => handleAddingHotelDraftChange("stayEndIso", nextValue)}
                  />
                </label>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  className="inline-flex items-center rounded-xl border border-slate-300 bg-surface-container-lowest px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand-primary hover:text-brand-primary"
                  onClick={cancelAddHotelInline}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="inline-flex items-center rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-on-primary transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-45"
                  onClick={saveAddHotelInline}
                  disabled={isAddingHotelDraftSaveDisabled}
                >
                  Save Agreement
                </button>
              </div>
            </article>
          ) : null}

          <div className={`mt-4 inline-flex w-full items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-medium ${getCitySummaryClasses(makkahMissing > 0)}`}>
            <span className="material-symbols-outlined" aria-hidden="true">
              {makkahMissing > 0 ? "error" : "check_circle"}
            </span>
            <p>
              <span className="sm:hidden">
                {makkahAssigned}/{totalPax} Pax - {makkahMissing > 0 ? `${makkahMissing} missing` : "All assigned"}
              </span>
              <span className="hidden sm:inline">
                Total Pax: {makkahAssigned} / {totalPax} - {" "}
                {makkahMissing > 0 ? `${makkahMissing} pax missing hotel in Makkah` : "All pax assigned"}
              </span>
            </p>
          </div>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-surface-container-lowest p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <span className="material-symbols-outlined text-brand-primary" aria-hidden="true">
                apartment
              </span>
              <h2 className="text-xl font-bold text-slate-900">Madinah</h2>
            </div>

            <button
              type="button"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-surface-container-lowest px-3 py-2 text-xs font-bold leading-none text-slate-700 transition hover:border-brand-primary hover:text-brand-primary sm:w-auto sm:justify-start sm:py-1.5"
              onClick={() => openAddHotelInline("madinah")}
            >
              <span className="material-symbols-outlined text-base" aria-hidden="true">
                add
              </span>
              <span>Add Hotel</span>
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {visibleMadinahAgreements.map((agreement, index) => {
              const canDeleteAgreement = madinahAgreementIdSet.has(agreement.id);
              const statusLabel = getAgreementStatusLabel(agreement.status);

              return (
                <details key={agreement.id} className="serene-accordion">
                  <summary className="serene-accordion-summary">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-base font-semibold text-slate-900">
                          {agreement.hotelName.trim() || `Hotel ${index + 1}`}
                        </h3>
                        <span
                          className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-bold leading-none ${getAgreementStatusClasses(
                            agreement.status === "Approved",
                          )}`}
                        >
                          {statusLabel}
                        </span>
                      </div>
                      <p className="mt-1 break-words text-xs leading-5 text-slate-500">
                        {formatAgreementSummary(agreement)}
                      </p>
                    </div>

                    <span
                      className="serene-accordion-chevron material-symbols-outlined text-on-surface-variant"
                      aria-hidden="true"
                    >
                      expand_more
                    </span>
                  </summary>

                  <div className="serene-accordion-content">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-slate-200 bg-surface-container-lowest px-2.5 py-1 text-xs font-bold leading-none text-slate-700">
                        <span className="material-symbols-outlined text-base" aria-hidden="true">
                          group
                        </span>
                        <span>{agreement.pax} Pax</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className={getIconButtonClasses()}
                          aria-label={`Edit Madinah agreement ${index + 1}`}
                          onClick={() => openHotelModal("madinah", "edit", agreement.id)}
                        >
                          <span className="material-symbols-outlined" aria-hidden="true">
                            edit
                          </span>
                        </button>
                        <button
                          type="button"
                          className={`${getIconButtonClasses(true)} disabled:cursor-not-allowed disabled:opacity-45`}
                          aria-label={`Delete Madinah agreement ${index + 1}`}
                          onClick={() => onDeleteVisaHotel(row.groupCode, "madinah", agreement.id)}
                          disabled={!canDeleteAgreement}
                        >
                          <span className="material-symbols-outlined" aria-hidden="true">
                            delete
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                </details>
              );
            })}
          </div>

          {addingHotelCity === "madinah" ? (
            <article className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="mb-3 flex items-center gap-2 text-emerald-900">
                <span className="material-symbols-outlined text-base" aria-hidden="true">
                  add_home_work
                </span>
                <h3 className="text-sm font-semibold">New Madinah Agreement</h3>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className={inlineHotelFieldClassName}>
                  <span>Hotel Name</span>
                  <input
                    type="text"
                    className={inlineHotelInputClassName}
                    value={addingHotelDraft.hotelName}
                    onChange={(event) => handleAddingHotelDraftChange("hotelName", event.target.value)}
                    placeholder="e.g. Pullman Zamzam Madinah"
                  />
                </label>

                <label className={inlineHotelFieldClassName}>
                  <span>Agreement Number</span>
                  <input
                    type="text"
                    className={inlineHotelInputClassName}
                    value={addingHotelDraft.agreementNumber}
                    onChange={(event) => handleAddingHotelDraftChange("agreementNumber", event.target.value)}
                    placeholder="2026xxxxxxxxxxxxx"
                  />
                </label>

                <label className={inlineHotelFieldClassName}>
                  <span>Total Pax</span>
                  <input
                    type="number"
                    min={1}
                    className={inlineHotelInputClassName}
                    value={addingHotelDraft.pax}
                    onChange={(event) => handleAddingHotelDraftChange("pax", event.target.value)}
                    placeholder={totalPax.toString()}
                  />
                </label>

                <label className={inlineHotelFieldClassName}>
                  <span>Approval Status</span>
                  <div className="relative">
                    <SereneSelect
                      className={inlineHotelSelectClassName}
                      value={addingHotelDraft.status}
                      onChange={(event) =>
                        handleAddingHotelDraftChange(
                          "status",
                          event.target.value as VisaHotelEditFormState["status"],
                        )
                      }
                    >
                      <option value="Waiting for Approval">Waiting for Approval</option>
                      <option value="Approved">Approved</option>
                    </SereneSelect>
                  </div>
                </label>

                <label className={inlineHotelFieldClassName}>
                  <span>Stay Start Date</span>
                  <DatePickerInput
                    inputClassName={inlineHotelInputClassName}
                    value={addingHotelDraft.stayStartIso}
                    onChange={(nextValue) => handleAddingHotelDraftChange("stayStartIso", nextValue)}
                  />
                </label>

                <label className={inlineHotelFieldClassName}>
                  <span>Stay End Date</span>
                  <DatePickerInput
                    inputClassName={inlineHotelInputClassName}
                    value={addingHotelDraft.stayEndIso}
                    onChange={(nextValue) => handleAddingHotelDraftChange("stayEndIso", nextValue)}
                  />
                </label>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  className="inline-flex items-center rounded-xl border border-slate-300 bg-surface-container-lowest px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand-primary hover:text-brand-primary"
                  onClick={cancelAddHotelInline}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="inline-flex items-center rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-on-primary transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-45"
                  onClick={saveAddHotelInline}
                  disabled={isAddingHotelDraftSaveDisabled}
                >
                  Save Agreement
                </button>
              </div>
            </article>
          ) : null}

          <div className={`mt-4 inline-flex w-full items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-medium ${getCitySummaryClasses(madinahMissing > 0)}`}>
            <span className="material-symbols-outlined" aria-hidden="true">
              {madinahMissing > 0 ? "error" : "check_circle"}
            </span>
            <p>
              <span className="sm:hidden">
                {madinahAssigned}/{totalPax} Pax - {madinahMissing > 0 ? `${madinahMissing} missing` : "All assigned"}
              </span>
              <span className="hidden sm:inline">
                Total Pax: {madinahAssigned} / {totalPax} - {" "}
                {madinahMissing > 0 ? `${madinahMissing} pax missing hotel in Madinah` : "All pax assigned"}
              </span>
            </p>
          </div>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-surface-container-lowest p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-brand-primary" aria-hidden="true">
                calendar_today
              </span>
              <h3 className="text-lg font-bold text-slate-900">Raudhah</h3>
            </div>

            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-surface-container-lowest px-3 py-1.5 text-xs font-bold leading-none text-slate-700 transition hover:border-brand-primary hover:text-brand-primary"
              onClick={handleCopyRaudhahReminder}
              aria-label={`Copy Raudhah reminder template for ${row.groupCode}`}
            >
              <span className="material-symbols-outlined text-sm" aria-hidden="true">
                {isRaudhahTemplateCopied ? "check" : "content_copy"}
              </span>
              <span>{isRaudhahTemplateCopied ? "Copied" : "Copy"}</span>
            </button>
          </div>

          <div className="mt-3 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Raudhah Dates</p>
            {hasRaudhahDates ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {raudhahAppointments.map((appointment, index) => (
                  <div
                    key={`${appointment.dateLabel}-${appointment.status}-${index}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs"
                  >
                    <span className="font-semibold text-slate-700">{appointment.dateLabel}</span>
                    <span
                      className={`inline-flex rounded-lg border px-1.5 py-0.5 text-[10px] font-bold leading-none ${getRaudhahStatusBadgeClasses(
                        appointment.status,
                      )}`}
                    >
                      {appointment.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <strong className={`block text-base font-semibold ${getToneTextClass(raudhahTone)}`}>
                Not Set
              </strong>
            )}
            <small className="mt-2 block text-xs text-slate-500">
              <span className="sm:hidden">Status: {raudhahStatusText} - {raudhahSecondaryTextMobile}</span>
              <span className="hidden sm:inline">Status: {raudhahStatusText} - {raudhahSecondaryText}</span>
            </small>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="inline-flex rounded-lg border border-brand-primary/30 bg-brand-primary/10 px-3 py-1.5 text-xs font-bold leading-none text-brand-primary transition hover:bg-brand-primary/15"
              onClick={openRaudhahModal}
            >
              Edit
            </button>
            <button
              type="button"
              className="inline-flex rounded-lg border border-slate-300 bg-surface-container-lowest px-3 py-1.5 text-xs font-bold leading-none text-slate-700 transition hover:border-slate-400"
              onClick={() => setIsClearRaudhahConfirmOpen(true)}
            >
              Clear
            </button>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-surface-container-lowest p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-brand-primary" aria-hidden="true">
              business
            </span>
            <h3 className="text-lg font-bold text-slate-900">Syarikah</h3>
          </div>

          <div className="mt-3 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Provider Agency</p>
            <strong className="block text-base font-semibold text-slate-900">{providerName}</strong>
            <small className="text-xs text-slate-500">
              <span className="sm:hidden">Package: {row.packageName}</span>
              <span className="hidden sm:inline">Assigned for {row.packageName} package</span>
            </small>
          </div>

          <button
            type="button"
            className="mt-4 inline-flex rounded-lg border border-brand-primary/30 bg-brand-primary/10 px-3 py-1.5 text-xs font-bold leading-none text-brand-primary transition hover:bg-brand-primary/15"
            onClick={openSyarikahModal}
          >
            <span className="sm:hidden">Edit</span>
            <span className="hidden sm:inline">Edit Syarikah</span>
          </button>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-surface-container-lowest p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-brand-primary" aria-hidden="true">
              payments
            </span>
            <h3 className="text-lg font-bold text-slate-900">Payment</h3>
          </div>

          <div className="mt-3 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
            <strong className={`block text-base font-semibold ${getToneTextClass(paymentTone)}`}>
              {paymentStatus}
            </strong>
            <small className="text-xs text-slate-500">
              <span className="sm:hidden">{paymentStatus === "Paid" ? "Payment complete" : "Need follow-up"}</span>
              <span className="hidden sm:inline">
                {paymentStatus === "Paid" ? "Payment is complete" : "Payment still requires follow-up"}
              </span>
            </small>
          </div>

          <button
            type="button"
            className="mt-4 inline-flex rounded-lg bg-brand-primary px-3 py-1.5 text-xs font-bold leading-none text-on-primary transition hover:bg-primary-container"
            onClick={() => {
              const nextStatus = paymentStatus === "Paid" ? "Unpaid" : "Paid";
              setPaymentStatus(nextStatus);
              setPaymentStatusDraft(nextStatus);
              onUpdatePaymentStatus(row.groupCode, nextStatus);
            }}
          >
            <span className="sm:hidden">{paymentStatus === "Paid" ? "Mark Unpaid" : "Mark Paid"}</span>
            <span className="hidden sm:inline">{paymentStatus === "Paid" ? "Mark as Unpaid" : "Toggle to Paid"}</span>
          </button>
        </article>
      </section>

      {activeModal === "visa-status" ? (
        <VisaStatusModal
          value={visaStatusDraft}
          onChange={(nextValue) => setVisaStatusDraft(nextValue)}
          onClose={closeModal}
          onSave={saveVisaStatus}
        />
      ) : null}

      {activeModal === "payment-status" ? (
        <PaymentStatusModal
          value={paymentStatusDraft}
          onChange={(nextValue) => setPaymentStatusDraft(nextValue)}
          onClose={closeModal}
          onSave={savePaymentStatus}
        />
      ) : null}

      {activeModal === "syarikah" ? (
        <SyarikahModal
          value={syarikahDraft}
          onChange={(nextValue) => setSyarikahDraft(nextValue)}
          onClose={closeModal}
          onSave={saveSyarikah}
          isSaveDisabled={!syarikahDraft.trim()}
        />
      ) : null}

      {activeModal === "hotel" ? (
        <VisaHotelModal
          city={hotelCityDraft}
          mode={hotelDraftMode}
          value={hotelDraft}
          onChange={handleHotelDraftChange}
          onClose={closeModal}
          onSave={saveHotel}
          isSaveDisabled={
            !hotelDraft.hotelName.trim() ||
            !hotelDraft.agreementNumber.trim() ||
            !hotelDraft.pax.trim() ||
            Number.parseInt(hotelDraft.pax, 10) <= 0 ||
            !hotelDraft.stayStartIso.trim() ||
            !hotelDraft.stayEndIso.trim() ||
            hotelDraft.stayEndIso < hotelDraft.stayStartIso
          }
        />
      ) : null}

      {activeModal === "raudhah" ? (
        <VisaRaudhahModal
          value={raudhahDraft}
          onAddAppointment={handleAddRaudhahDraftAppointment}
          onRemoveAppointment={handleRemoveRaudhahDraftAppointment}
          onChangeAppointment={handleRaudhahDraftAppointmentChange}
          onClose={closeModal}
          onSave={saveRaudhah}
          isSaveDisabled={isRaudhahDraftSaveDisabled}
        />
      ) : null}

      {isClearRaudhahConfirmOpen ? (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/55 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-raudhah-title"
          aria-describedby="clear-raudhah-description"
          onClick={() => setIsClearRaudhahConfirmOpen(false)}
        >
          <section
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-surface-container-lowest p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span
                className="material-symbols-outlined rounded-full bg-rose-100 p-2 text-rose-700"
                aria-hidden="true"
              >
                warning
              </span>
              <div className="min-w-0">
                <h3 id="clear-raudhah-title" className="text-lg font-extrabold text-slate-900">
                  Clear Raudhah Dates?
                </h3>
                <p id="clear-raudhah-description" className="mt-1 text-sm leading-relaxed text-slate-600">
                  Semua tanggal appointment Raudhah untuk group <strong>{row.groupCode}</strong> akan dihapus.
                  Tindakan ini tidak bisa dibatalkan.
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border border-slate-300 bg-surface-container-lowest px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-surface-container-high"
                onClick={() => setIsClearRaudhahConfirmOpen(false)}
              >
                Batal
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-2 text-sm font-semibold text-on-primary transition hover:bg-rose-700"
                onClick={clearRaudhah}
              >
                <span className="material-symbols-outlined text-base" aria-hidden="true">
                  delete
                </span>
                <span>Ya, Clear</span>
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}






