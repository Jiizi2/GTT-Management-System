import type {
  NewGroupAgreementFormState,
  NewGroupRaudhahFormState,
} from "../../shared/app-domain";

export type NewGroupScreenFormValues = {
  groupNumber: string;
  groupName: string;
  totalPax: string;
  visaStatus: "Draft" | "Pending" | "Issued";
  syarikahName: string;
  busStatus: "Visa Only" | "Visa+";
  paymentStatus: "Paid" | "Unpaid";
  makkahHotels: NewGroupAgreementFormState[];
  madinahHotels: NewGroupAgreementFormState[];
  raudhahDates: NewGroupRaudhahFormState[];
};
