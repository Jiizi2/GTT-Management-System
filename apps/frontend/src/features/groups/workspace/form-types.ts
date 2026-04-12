import type { InputItineraryFormState } from "../../../shared/app-domain.js";

export type ManualScheduleFormValues = Omit<InputItineraryFormState, "hotelName" | "fromHotelName"> & {
  hotelName: string;
  fromHotelName: string;
};

export function toManualScheduleFormValues(draft: InputItineraryFormState): ManualScheduleFormValues {
  return {
    ...draft,
    hotelName: draft.hotelName ?? "",
    fromHotelName: draft.fromHotelName ?? "",
  };
}
