import type { GroupData } from "../../shared/app-domain";
import type { VisaApplication } from "./contracts";

export type VisaProcessTone = "complete" | "in-progress" | "waiting" | "attention" | "neutral";
export type VisaProcessStage = {
  id: "document" | "agreement" | "nusuk" | "visa";
  label: string;
  description: string;
  status: string;
  tone: VisaProcessTone;
  complete: boolean;
};

export const visaProcessDefinition = [
  { label: "Pengiriman dokumen", description: "Kirim dan verifikasi dokumen jamaah." },
  { label: "Agreement hotel", description: "Urus persetujuan hotel Makkah dan Madinah." },
  { label: "Upload paspor ke Nusuk", description: "Masukkan data paspor jamaah ke Nusuk." },
  { label: "Visa issued", description: "Pantau pengajuan sampai visa diterbitkan." },
] as const;

export function buildVisaProcessStages(application: VisaApplication | null, group: GroupData | null): VisaProcessStage[] {
  if (!application) return buildGroupFallbackStages(group);

  const document: VisaProcessStage = application.documentStatus === "VERIFIED"
    ? stage("document", 0, "Dokumen terverifikasi", "complete", true)
    : application.documentStatus === "NEED_REVISION"
      ? stage("document", 0, "Dokumen perlu revisi", "attention")
      : stage("document", 0, "Menunggu dokumen", "waiting");

  const agreement: VisaProcessStage = application.agreementStatus === "APPROVED"
    ? stage("agreement", 1, "Agreement disetujui", "complete", true)
    : application.agreementStatus === "WAITING_APPROVAL"
      ? stage("agreement", 1, "Menunggu persetujuan", "in-progress")
      : stage("agreement", 1, "Belum dimulai", "waiting");

  const nusuk: VisaProcessStage = application.nusukStatus === "GROUP_CREATED"
    ? stage("nusuk", 2, "Group Nusuk dibuat", "complete", true)
    : application.nusukStatus === "PASSENGER_ENTERED"
      ? stage("nusuk", 2, "Data paspor tercatat", "complete", true)
      : application.nusukStatus === "PASSENGER_ENTRY"
        ? stage("nusuk", 2, "Upload sedang berlangsung", "in-progress")
        : stage("nusuk", 2, "Belum dimulai", "waiting");

  const visa: VisaProcessStage = application.visaStatus === "ISSUED" || application.visaStatus === "COMPLETED"
    ? stage("visa", 3, "Visa issued", "complete", true)
    : application.visaStatus === "SUBMITTED" || application.visaStatus === "PROCESSING"
      ? stage("visa", 3, application.visaStatus === "SUBMITTED" ? "Visa diajukan" : "Visa diproses", "in-progress")
      : application.visaStatus === "READY_TO_SEND"
        ? stage("visa", 3, "Siap diajukan", "waiting")
        : stage("visa", 3, "Belum dimulai", "waiting");

  return [document, agreement, nusuk, visa];
}

export function currentVisaProcessStage(stages: VisaProcessStage[]): VisaProcessStage {
  const finalStage = stages[stages.length - 1];
  if (finalStage?.complete) return finalStage;
  return stages.find((item) => item.tone === "attention")
    ?? stages.find((item) => !item.complete && item.tone !== "neutral")
    ?? stages.find((item) => item.tone === "neutral")
    ?? finalStage;
}

function buildGroupFallbackStages(group: GroupData | null): VisaProcessStage[] {
  const hotels = [...(group?.visaSetup?.makkahHotels ?? []), ...(group?.visaSetup?.madinahHotels ?? [])];
  const agreement = hotels.some((hotel) => hotel.status === "Rejected")
    ? stage("agreement", 1, "Agreement ditolak", "attention")
    : hotels.some((hotel) => hotel.status === "Waiting for Approval")
      ? stage("agreement", 1, "Menunggu persetujuan", "in-progress")
      : hotels.length > 0 && hotels.every((hotel) => hotel.status === "Approved")
        ? stage("agreement", 1, "Agreement disetujui", "complete", true)
        : stage("agreement", 1, "Belum tercatat", "neutral");
  const visa = group?.visaSetup?.visaStatus === "Issued"
    ? stage("visa", 3, "Visa issued", "complete", true)
    : group?.visaSetup?.visaStatus === "Pending"
      ? stage("visa", 3, "Visa diproses", "in-progress")
      : group?.visaSetup?.visaStatus === "Draft"
        ? stage("visa", 3, "Belum diajukan", "waiting")
        : stage("visa", 3, "Belum tercatat", "neutral");

  return [
    stage("document", 0, "Belum tercatat", "neutral"),
    agreement,
    stage("nusuk", 2, "Belum tercatat", "neutral"),
    visa,
  ];
}

function stage(
  id: VisaProcessStage["id"],
  definitionIndex: number,
  status: string,
  tone: VisaProcessTone,
  complete = false,
): VisaProcessStage {
  return { id, ...visaProcessDefinition[definitionIndex], status, tone, complete };
}
