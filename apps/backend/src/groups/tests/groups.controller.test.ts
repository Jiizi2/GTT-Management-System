import { describe, expect, it, vi } from "vitest";
import { GroupsController } from "../http/groups.controller";
import { GroupsService } from "../application/groups.service";
import { CreateGroupDto } from "../dto/create-group.dto";
import { CreateGroupIdentityDto } from "../dto/create-group-identity.dto";
import { UpdateGroupDto } from "../dto/update-group.dto";
import { ConfirmChecklistDriverDto } from "../dto/confirm-checklist-driver.dto";
import { ResetChecklistDriverDto } from "../dto/reset-checklist-driver.dto";
import {
  UpsertGroupItineraryItemDto,
  UpsertGroupRaudhahDto,
  UpsertGroupVisaHotelDto,
} from "../dto/group-operations.dto";

describe("GroupsController", () => {
  const mockGroupDetail = {
    id: "grp-1",
    code: "GRP-001",
    name: "Group A",
    pax: 10,
    status: "Active",
    lifecycleStatus: "Active",
    timeline: [],
    itinerary: [],
    notes: [],
    visaSetup: null,
    checklistAssignments: [],
  };

  const mockAuditLog = {
    id: "audit-1",
    groupCode: "GRP-001",
    action: "group.created",
    entity: "group",
    payload: {},
    createdAt: "2026-07-05T12:00:00Z",
  };

  const createMockService = () => {
    return {
      findAll: vi.fn().mockResolvedValue([mockGroupDetail]),
      listAuditLogs: vi.fn().mockResolvedValue([mockAuditLog]),
      findOneByIdOrCode: vi.fn().mockResolvedValue(mockGroupDetail),
      create: vi.fn().mockResolvedValue(mockGroupDetail),
      createIdentity: vi.fn().mockResolvedValue(mockGroupDetail),
      update: vi.fn().mockResolvedValue(mockGroupDetail),
      remove: vi.fn().mockResolvedValue(undefined),
      addItineraryItem: vi.fn().mockResolvedValue(mockGroupDetail),
      updateItineraryItem: vi.fn().mockResolvedValue(mockGroupDetail),
      removeItineraryItem: vi.fn().mockResolvedValue(mockGroupDetail),
      addVisaHotelAgreement: vi.fn().mockResolvedValue(mockGroupDetail),
      updateVisaHotelAgreement: vi.fn().mockResolvedValue(mockGroupDetail),
      removeVisaHotelAgreement: vi.fn().mockResolvedValue(mockGroupDetail),
      upsertPrimaryRaudhahAppointment: vi.fn().mockResolvedValue(mockGroupDetail),
      confirmChecklistDriver: vi.fn().mockResolvedValue({ success: true }),
      resetChecklistDriver: vi.fn().mockResolvedValue({ success: true }),
    } as unknown as GroupsService;
  };

  it("should find all groups", async () => {
    const service = createMockService();
    const controller = new GroupsController(service);

    const result = await controller.findAll("query", "1", "20", "missing-hotel", "true", "summary");

    expect(service.findAll).toHaveBeenCalledWith("query", {
      page: 1,
      pageSize: 20,
      filter: "missing-hotel",
      activeOnly: true,
      projection: "summary",
    });
    expect(result).toEqual([mockGroupDetail]);
  });

  it("should get audit logs", async () => {
    const service = createMockService();
    const controller = new GroupsController(service);

    const result = await controller.listAuditLogs("GRP-001", "25");

    expect(service.listAuditLogs).toHaveBeenCalledWith("GRP-001", 25);
    expect(result).toEqual([mockAuditLog]);
  });

  it("should find one group detail", async () => {
    const service = createMockService();
    const controller = new GroupsController(service);

    const result = await controller.findOne("GRP-001");

    expect(service.findOneByIdOrCode).toHaveBeenCalledWith("GRP-001");
    expect(result).toEqual(mockGroupDetail);
  });

  it("should create a group", async () => {
    const service = createMockService();
    const controller = new GroupsController(service);

    const payload: CreateGroupDto = {
      code: "GRP-001",
      name: "Group A",
      pax: 10,
    };
    const result = await controller.create(payload);

    expect(service.create).toHaveBeenCalledWith(payload);
    expect(result).toEqual(mockGroupDetail);
  });

  it("should create a group identity", async () => {
    const service = createMockService();
    const controller = new GroupsController(service);

    const payload: CreateGroupIdentityDto = {
      code: "GRP-001",
      name: "Group A",
      pax: 10,
    };
    const result = await controller.createIdentity(payload);

    expect(service.createIdentity).toHaveBeenCalledWith(payload);
    expect(result).toEqual(mockGroupDetail);
  });

  it("should update a group", async () => {
    const service = createMockService();
    const controller = new GroupsController(service);

    const payload: UpdateGroupDto = {
      name: "Updated Group A",
    };
    const result = await controller.update("GRP-001", payload);

    expect(service.update).toHaveBeenCalledWith("GRP-001", payload);
    expect(result).toEqual(mockGroupDetail);
  });

  it("should remove a group", async () => {
    const service = createMockService();
    const controller = new GroupsController(service);

    await controller.remove("GRP-001");

    expect(service.remove).toHaveBeenCalledWith("GRP-001");
  });

  it("should add itinerary item", async () => {
    const service = createMockService();
    const controller = new GroupsController(service);

    const payload: UpsertGroupItineraryItemDto = {
      dateLabel: "Hari 1",
      title: "Arrive",
      categoryKey: "flight",
    };
    const result = await controller.addItineraryItem("GRP-001", payload);

    expect(service.addItineraryItem).toHaveBeenCalledWith("GRP-001", payload);
    expect(result).toEqual(mockGroupDetail);
  });

  it("should update itinerary item", async () => {
    const service = createMockService();
    const controller = new GroupsController(service);

    const payload: UpsertGroupItineraryItemDto = {
      dateLabel: "Hari 1",
      title: "Arrive",
      categoryKey: "flight",
    };
    const result = await controller.updateItineraryItem("GRP-001", "item-1", payload);

    expect(service.updateItineraryItem).toHaveBeenCalledWith("GRP-001", "item-1", payload);
    expect(result).toEqual(mockGroupDetail);
  });

  it("should remove itinerary item", async () => {
    const service = createMockService();
    const controller = new GroupsController(service);

    const result = await controller.removeItineraryItem("GRP-001", "item-1");

    expect(service.removeItineraryItem).toHaveBeenCalledWith("GRP-001", "item-1");
    expect(result).toEqual(mockGroupDetail);
  });

  it("should add visa hotel agreement", async () => {
    const service = createMockService();
    const controller = new GroupsController(service);

    const payload: UpsertGroupVisaHotelDto = {
      visaStatus: "ISSUED",
    };
    const result = await controller.addVisaHotelAgreement("GRP-001", payload);

    expect(service.addVisaHotelAgreement).toHaveBeenCalledWith("GRP-001", payload);
    expect(result).toEqual(mockGroupDetail);
  });

  it("should update visa hotel agreement", async () => {
    const service = createMockService();
    const controller = new GroupsController(service);

    const payload: UpsertGroupVisaHotelDto = {
      visaStatus: "ISSUED",
    };
    const result = await controller.updateVisaHotelAgreement("GRP-001", "hotel-1", payload);

    expect(service.updateVisaHotelAgreement).toHaveBeenCalledWith("GRP-001", "hotel-1", payload);
    expect(result).toEqual(mockGroupDetail);
  });

  it("should delete visa hotel agreement", async () => {
    const service = createMockService();
    const controller = new GroupsController(service);

    const result = await controller.removeVisaHotelAgreement("GRP-001", "hotel-1");

    expect(service.removeVisaHotelAgreement).toHaveBeenCalledWith("GRP-001", "hotel-1");
    expect(result).toEqual(mockGroupDetail);
  });

  it("should upsert primary Raudhah appointment", async () => {
    const service = createMockService();
    const controller = new GroupsController(service);

    const payload: UpsertGroupRaudhahDto = {
      date: "2026-07-06T08:00:00.000Z",
      status: "CONFIRMED",
    };
    const result = await controller.upsertPrimaryRaudhahAppointment("GRP-001", payload);

    expect(service.upsertPrimaryRaudhahAppointment).toHaveBeenCalledWith("GRP-001", payload);
    expect(result).toEqual(mockGroupDetail);
  });

  it("should confirm checklist driver", async () => {
    const service = createMockService();
    const controller = new GroupsController(service);

    const payload: ConfirmChecklistDriverDto = {
      itineraryItemId: "item-1",
      slotNumber: 1,
      name: "Driver A",
      phone: "0812",
      plateNumber: "B 1234 CD",
    };
    const result = await controller.confirmChecklistDriver("GRP-001", payload);

    expect(service.confirmChecklistDriver).toHaveBeenCalledWith("GRP-001", payload);
    expect(result).toEqual({ success: true });
  });

  it("should reset checklist driver", async () => {
    const service = createMockService();
    const controller = new GroupsController(service);

    const payload: ResetChecklistDriverDto = {
      itineraryItemId: "item-1",
      slotNumber: 1,
    };
    const result = await controller.resetChecklistDriver("GRP-001", payload);

    expect(service.resetChecklistDriver).toHaveBeenCalledWith("GRP-001", payload);
    expect(result).toEqual({ success: true });
  });
});
