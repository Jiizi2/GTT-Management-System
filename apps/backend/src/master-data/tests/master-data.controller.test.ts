import { describe, expect, it, vi } from "vitest";
import { MasterDataController } from "../master-data.controller";
import { MasterDataService } from "../master-data.service";
import { CreateMasterDataOptionDto } from "../dto/create-master-data-option.dto";
import { UpdateMasterDataOptionDto } from "../dto/update-master-data-option.dto";

describe("MasterDataController Unit Tests", () => {
  const mockCategorySummary = {
    categoryKey: "agreement-city",
    categoryLabel: "Agreement City",
    totalCount: 2,
    activeCount: 2,
  };

  const mockOptionItem = {
    id: "opt-1",
    categoryKey: "agreement-city",
    optionKey: "MAKKAH",
    optionLabel: "Makkah",
    sortOrder: 1,
    isActive: true,
  };

  const createMockService = () => {
    return {
      listCategories: vi.fn().mockResolvedValue([mockCategorySummary]),
      listOptions: vi.fn().mockResolvedValue([mockOptionItem]),
      createOption: vi.fn().mockResolvedValue(mockOptionItem),
      updateOption: vi.fn().mockResolvedValue(mockOptionItem),
    } as unknown as MasterDataService;
  };

  it("should list master data categories", async () => {
    const service = createMockService();
    const controller = new MasterDataController(service);

    const result = await controller.listCategories();

    expect(service.listCategories).toHaveBeenCalled();
    expect(result).toEqual([mockCategorySummary]);
  });

  it("should list master data options", async () => {
    const service = createMockService();
    const controller = new MasterDataController(service);

    const query = { categoryKey: "agreement-city", includeInactive: false };
    const result = await controller.listOptions(query);

    expect(service.listOptions).toHaveBeenCalledWith("agreement-city", false);
    expect(result).toEqual([mockOptionItem]);
  });

  it("should create a master data option", async () => {
    const service = createMockService();
    const controller = new MasterDataController(service);

    const payload: CreateMasterDataOptionDto = {
      categoryKey: "agreement-city",
      optionKey: "MADINAH",
      optionLabel: "Madinah",
      sortOrder: 2,
    };
    const result = await controller.createOption(payload);

    expect(service.createOption).toHaveBeenCalledWith(payload);
    expect(result).toEqual(mockOptionItem);
  });

  it("should update a master data option", async () => {
    const service = createMockService();
    const controller = new MasterDataController(service);

    const payload: UpdateMasterDataOptionDto = {
      optionLabel: "Makkah Al Mukarramah",
      isActive: true,
    };
    const result = await controller.updateOption("opt-1", payload);

    expect(service.updateOption).toHaveBeenCalledWith("opt-1", payload);
    expect(result).toEqual(mockOptionItem);
  });
});
