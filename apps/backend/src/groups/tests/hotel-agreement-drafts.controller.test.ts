import { describe, expect, it, vi } from "vitest";
import { HotelAgreementDraftsController } from "../http/hotel-agreement-drafts.controller";
import { HotelAgreementDraftsService } from "../application/hotel-agreement-drafts.service";
import { UpsertHotelAgreementDraftDto, AssignHotelAgreementDraftDto } from "../dto/hotel-agreement-draft.dto";

describe("HotelAgreementDraftsController", () => {
  const mockDraft = {
    id: "draft-1",
    city: "MAKKAH",
    hotelName: "Hotel A",
    agreementNumber: "AGR-123",
    pax: 10,
    status: "APPROVED",
    stayStart: "2026-07-06T00:00:00.000Z",
    stayEnd: "2026-07-10T00:00:00.000Z",
  };

  const createMockService = () => {
    return {
      findAll: vi.fn().mockResolvedValue([mockDraft]),
      create: vi.fn().mockResolvedValue(mockDraft),
      update: vi.fn().mockResolvedValue(mockDraft),
      remove: vi.fn().mockResolvedValue(undefined),
      assign: vi.fn().mockResolvedValue(mockDraft),
      unassign: vi.fn().mockResolvedValue(mockDraft),
    } as unknown as HotelAgreementDraftsService;
  };

  it("should find all agreement drafts", async () => {
    const service = createMockService();
    const controller = new HotelAgreementDraftsController(service);

    const result = await controller.findAll("query", "unassigned");

    expect(service.findAll).toHaveBeenCalledWith("query", "unassigned");
    expect(result).toEqual([mockDraft]);
  });

  it("should create an agreement draft", async () => {
    const service = createMockService();
    const controller = new HotelAgreementDraftsController(service);

    const payload: UpsertHotelAgreementDraftDto = {
      city: "MAKKAH",
      hotelName: "Hotel A",
      agreementNumber: "AGR-123",
      pax: 10,
      stayStart: "2026-07-06T00:00:00.000Z",
      stayEnd: "2026-07-10T00:00:00.000Z",
    };
    const result = await controller.create(payload);

    expect(service.create).toHaveBeenCalledWith(payload);
    expect(result).toEqual(mockDraft);
  });

  it("should update an agreement draft", async () => {
    const service = createMockService();
    const controller = new HotelAgreementDraftsController(service);

    const payload: UpsertHotelAgreementDraftDto = {
      city: "MAKKAH",
      hotelName: "Hotel A",
      agreementNumber: "AGR-123",
      pax: 12,
      stayStart: "2026-07-06T00:00:00.000Z",
      stayEnd: "2026-07-10T00:00:00.000Z",
    };
    const result = await controller.update("draft-1", payload);

    expect(service.update).toHaveBeenCalledWith("draft-1", payload);
    expect(result).toEqual(mockDraft);
  });

  it("should remove an agreement draft", async () => {
    const service = createMockService();
    const controller = new HotelAgreementDraftsController(service);

    await controller.remove("draft-1");

    expect(service.remove).toHaveBeenCalledWith("draft-1");
  });

  it("should assign draft to a group", async () => {
    const service = createMockService();
    const controller = new HotelAgreementDraftsController(service);

    const payload: AssignHotelAgreementDraftDto = {
      groupCode: "GRP-001",
    };
    const result = await controller.assign("draft-1", payload);

    expect(service.assign).toHaveBeenCalledWith("draft-1", payload);
    expect(result).toEqual(mockDraft);
  });

  it("should unassign draft from a group", async () => {
    const service = createMockService();
    const controller = new HotelAgreementDraftsController(service);

    const result = await controller.unassign("draft-1", "GRP-001");

    expect(service.unassign).toHaveBeenCalledWith("draft-1", "GRP-001");
    expect(result).toEqual(mockDraft);
  });
});
