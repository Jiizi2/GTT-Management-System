import { AgreementCity } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { GroupsService } from "../application/groups.service";
import { GroupMemoryStore } from "../../infrastructure/repositories/memory/group-memory-store";
import { MemoryGroupRepository } from "../../infrastructure/repositories/memory/memory-group.repository";

describe("GroupsService itinerary replacement", () => {
  it("replaces itinerary without validating or changing hotel agreements", async () => {
    const store = new GroupMemoryStore();
    store.groups.splice(0, store.groups.length);
    const service = new GroupsService(new MemoryGroupRepository(store));
    await service.create({
      code: "ITIN-001",
      name: "Itinerary Test",
      status: "Active",
      arrivalDate: "2026-08-11",
      returnDate: "2026-08-20",
      pax: 30,
      packageName: "Regular",
      durationDays: 10,
      itinerary: [],
      visaSetup: {
        syarikah: "Test Syarikah",
        hotelAgreements: [{
          city: AgreementCity.MAKKAH,
          hotelName: "Hotel A",
          agreementNumber: "AGR-001",
          pax: 30,
          stayStart: "2026-08-11",
          stayEnd: "2026-08-15",
        }],
      },
    });

    const storedGroup = store.groups[0];
    const firstHotel = storedGroup.visaSetup?.hotelAgreements[0];
    if (!storedGroup.visaSetup || !firstHotel) {
      throw new Error("Test group hotel agreement was not created.");
    }
    storedGroup.visaSetup.hotelAgreements.push({
      ...firstHotel,
      id: "duplicate-hotel",
      agreementNumber: "AGR-002",
    });

    const result = await service.replaceItinerary("ITIN-001", {
      itinerary: [{
        dateLabel: "11 Aug",
        yearLabel: "2026",
        category: "Arrival",
        categoryKey: "arrival",
        title: "Arrival JED",
        meta: "09:00 | JED Airport",
        icon: "flight_land",
        isoDate: "2026-08-11",
        time: "09:00",
      }],
    });

    expect(result.itinerary).toHaveLength(1);
    expect(result.visaSetup?.hotelAgreements).toHaveLength(2);
    expect(result.visaSetup?.hotelAgreements.map((hotel) => hotel.agreementNumber)).toEqual([
      "AGR-001",
      "AGR-002",
    ]);
  });
});
