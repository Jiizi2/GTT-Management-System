import { VisaDetailContext } from "./visa-detail/context/VisaDetailContext";
import { useVisaTrackingDetail } from "./visa-detail/hooks/use-visa-tracking-detail";
import { VisaDetailHeader } from "./visa-detail/components/VisaDetailHeader";
import { VisaStatusSection } from "./visa-detail/components/VisaStatusSection";
import { HotelAgreementSection } from "./visa-detail/components/HotelAgreementSection";
import { FlightDetailsSection } from "./visa-detail/components/FlightDetailsSection";
import { RaudhahStatusSection } from "./visa-detail/components/RaudhahStatusSection";
import { VisaDetailModals } from "./visa-detail/components/VisaDetailModals";
import type {
  GroupData,
  VisaFlightDetailsInput,
  VisaHotelEditFormState,
  VisaPaymentStatus,
  VisaRaudhahEditFormState,
  VisaStatus,
  VisaTrackingRow,
} from "../shared/app-domain";

export function VisaTrackingDetailScreen({
  row,
  groups,
  onBack,
  onDeleteGroup,
  onSaveGroup,
  onUpdateVisaStatus,
  onUpdateVisaType,
  onToggleHotelWaiver,
  onUpdatePaymentStatus,
  onUpdateSyarikah,
  onUpdateFlightDetails,
  onUpdateVisaHotel,
  onDeleteVisaHotel,
  onSyncVisaItinerary,
  onUpdateRaudhahAppointment,
  onClearRaudhahAppointment,
}: {
  row: VisaTrackingRow;
  groups: GroupData[];
  onBack: () => void;
  onDeleteGroup: (groupCode: string) => void;
  onSaveGroup: (group: GroupData, sourceGroupCode?: string) => { ok: true } | { ok: false; message: string };
  onUpdateVisaStatus: (groupCode: string, visaStatus: VisaStatus, issuedDateIso?: string) => void;
  onUpdatePaymentStatus: (groupCode: string, paymentStatus: VisaPaymentStatus) => void;
  onUpdateSyarikah: (groupCode: string, syarikah: string) => void;
  onUpdateFlightDetails: (groupCode: string, flight: VisaFlightDetailsInput) => void;
  onUpdateVisaHotel: (
    groupCode: string,
    city: "makkah" | "madinah",
    hotel: VisaHotelEditFormState,
    hotelId?: string,
  ) => void;
  onDeleteVisaHotel: (groupCode: string, city: "makkah" | "madinah", hotelId: string) => void;
  onSyncVisaItinerary: (groupCode: string) => void;
  onUpdateRaudhahAppointment: (groupCode: string, appointment: VisaRaudhahEditFormState) => void;
  onClearRaudhahAppointment: (groupCode: string) => void;
  onUpdateVisaType: (groupCode: string, visaType: "Visa Only" | "Visa+") => void;
  onToggleHotelWaiver: (groupCode: string, city: "makkah" | "madinah", waived: boolean) => void;
}) {
  const detailState = useVisaTrackingDetail({
    row,
    groups,
    onBack,
    onDeleteGroup,
    onSaveGroup,
    onUpdateVisaStatus,
    onUpdateVisaType,
    onToggleHotelWaiver,
    onUpdatePaymentStatus,
    onUpdateSyarikah,
    onUpdateFlightDetails,
    onUpdateVisaHotel,
    onDeleteVisaHotel,
    onSyncVisaItinerary,
    onUpdateRaudhahAppointment,
    onClearRaudhahAppointment,
  });

  return (
    <VisaDetailContext.Provider value={detailState}>
      <div className="mx-auto max-w-7xl space-y-6 overflow-x-hidden px-3 pb-20 pt-4 sm:px-6 lg:px-8">
        <VisaDetailHeader />
        <VisaStatusSection />
        <HotelAgreementSection />
        <FlightDetailsSection />
        <RaudhahStatusSection />
        <VisaDetailModals />
      </div>
    </VisaDetailContext.Provider>
  );
}
