import { Transform } from "class-transformer";
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class ListMasterDataOptionsDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  categoryKey!: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === "") {
      return undefined;
    }

    if (value === true || value === "true") {
      return true;
    }

    if (value === false || value === "false") {
      return false;
    }

    return value;
  })
  @IsBoolean()
  includeInactive?: boolean;
}
