import { Transform } from "class-transformer";
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ListMasterDataOptionsDto {
  @ApiProperty({
    description: "Key kategori master data yang ingin dibaca.",
    example: "agreement-city",
    minLength: 2,
    maxLength: 80,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  categoryKey!: string;

  @ApiPropertyOptional({
    description: "Jika true, backend juga mengembalikan opsi yang nonaktif.",
    example: true,
    default: false,
  })
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
