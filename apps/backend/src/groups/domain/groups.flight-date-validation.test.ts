import { AgreementCity } from "@prisma/client";
import { describe, expect, it } from "vitest";
import type { CreateGroupDto } from "../dto/create-group.dto";
import { validateCreateOrReplaceHotelAgreementRules } from "./groups.hotel-validation";

function payload(arrivalFlightDate: string, departureFlightDate: string): CreateGroupDto {
  return {
    visaSetup: {
      syarikah: "Provider",
      arrivalFlightDate,
      departureFlightDate,
      hotelAgreements: [
        {
          city: AgreementCity.MADINAH,
          hotelName: "Hotel Madinah",
          agreementNumber: "AG-1",
          pax: 20,
          stayStart: "2026-09-21",
          stayEnd: "2026-09-25",
        },
        {
          city: AgreementCity.MAKKAH,
          hotelName: "Hotel Makkah",
          agreementNumber: "AG-2",
          pax: 20,
          stayStart: "2026-09-25",
          stayEnd: "2026-09-29",
        },
      ],
    },
  } as CreateGroupDto;
}

describe("flight dates against hotel agreements", () => {
  it.each(["2026-09-20", "2026-09-21", "2026-09-22"])("accepts arrival date %s", (arrivalDate) => {
    expect(() => validateCreateOrReplaceHotelAgreementRules(payload(arrivalDate, "2026-09-29"))).not.toThrow();
  });

  it.each(["2026-09-29", "2026-09-30"])("accepts departure date %s", (departureDate) => {
    expect(() => validateCreateOrReplaceHotelAgreementRules(payload("2026-09-21", departureDate))).not.toThrow();
  });

  it.each(["2026-09-19", "2026-09-23"])("rejects arrival date %s", (arrivalDate) => {
    expect(() => validateCreateOrReplaceHotelAgreementRules(payload(arrivalDate, "2026-09-29"))).toThrow(
      /Tanggal kedatangan/,
    );
  });

  it.each(["2026-09-28", "2026-10-01"])("rejects departure date %s", (departureDate) => {
    expect(() => validateCreateOrReplaceHotelAgreementRules(payload("2026-09-21", departureDate))).toThrow(
      /Tanggal kepulangan/,
    );
  });
});
