import { createContext, useContext } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { NewGroupScreenFormValues } from "../new-group-types";
import type {
  AgreementApprovalStatus,
  GroupRaudhahStatus,
  HotelAgreementDraft,
  NewGroupAgreementFormState,
  NewGroupRaudhahFormState,
} from "../../../shared/app-domain";

export interface NewGroupContextType {
  // Form elements
  form: UseFormReturn<NewGroupScreenFormValues>;
  
  // Computed & state values
  makkahHotels: NewGroupAgreementFormState[];
  madinahHotels: NewGroupAgreementFormState[];
  raudhahDates: NewGroupRaudhahFormState[];
  agreementDraftOptionsByCity: { makkah: HotelAgreementDraft[]; madinah: HotelAgreementDraft[] };
  selectedAgreementDraftIds: Set<string>;
  safePax: number;
  hasValidPax: boolean;
  minimumBusCount: number;
  resolvedGroupCode: string;
  resolvedGroupName: string;
  agreementDateConnection: any;
  agreementSaveValidationError: string | null;
  agreementSaveStatus: { tone: "success" | "warning" | "error"; message: string } | null;
  visaStatus: string;
  syarikahName: string;
  busStatus: string;
  paymentStatus: string;
  hideGroupInformation: boolean;
  draftsLoading: boolean;
  isDraftsError: boolean;

  // Actions
  handleAgreementDraftSelect: (city: "makkah" | "madinah", agreementIndex: number, draftId: string) => void;
  handleAgreementChange: (city: "makkah" | "madinah", agreementIndex: number, field: any, value: any) => void;
  handleAddAgreement: (city: "makkah" | "madinah") => void;
  handleRemoveAgreement: (city: "makkah" | "madinah", agreementIndex: number) => void;
  handleClearAgreement: (city: "makkah" | "madinah", agreementIndex: number) => void;
  handleRaudhahChange: (appointmentIndex: number, field: any, value: any) => void;
  handleSaveAgreement: () => void;
  appendRaudhahDate: (value: NewGroupRaudhahFormState) => void;
  
  // Helpers classes
  getInvoiceToneClasses: (tone: any) => string;
  getInvoiceToneDotClasses: (tone: any) => string;
  getVisaStatusTone: (status: any) => any;
  getBusStatusTone: (status: any) => any;
  getRaudhahStatusTone: (status: any) => any;
  getPaymentStatusTone: (status: any) => any;
  getAgreementStatusTone: (status: any) => any;
  getToneSelectClassName: (tone: any) => string;
  getAgreementStatusChipClassName: (status: AgreementApprovalStatus) => string;
  formatAgreementStayRange: (agreement: NewGroupAgreementFormState) => string;
}

export const NewGroupContext = createContext<NewGroupContextType | null>(null);

export function useNewGroupContext() {
  const context = useContext(NewGroupContext);
  if (!context) {
    throw new Error("useNewGroupContext must be used within NewGroupContext.Provider");
  }
  return context;
}
