import { describe, expect } from "vitest";
import { runCase } from "../test/run-case";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { ListMasterDataOptionsDto } from "./dto/list-master-data-options.dto";

describe("ListMasterDataOptionsDto", () => {
  runCase("accepts boolean-like query values", () => {
    const dto = plainToInstance(ListMasterDataOptionsDto, {
      categoryKey: "airline",
      includeInactive: "true",
    });
    const errors = validateSync(dto);

    expect(errors.length).toBe(0);
    expect(dto.includeInactive).toBe(true);
  });

  runCase("rejects invalid boolean-like query values", () => {
    const dto = plainToInstance(ListMasterDataOptionsDto, {
      categoryKey: "airline",
      includeInactive: "abc",
    });
    const errors = validateSync(dto);

    expect(errors.some((error) => error.property === "includeInactive")).toBe(true);
  });
});
