import { IsIn, IsInt, IsOptional, IsString, MaxLength } from "class-validator";
import { Type } from "class-transformer";

export const ANALYTICS_MONTH_WINDOWS = [3, 6, 12, 24] as const;

export type AnalyticsMonthWindow = (typeof ANALYTICS_MONTH_WINDOWS)[number];

export class AnalyticsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn(ANALYTICS_MONTH_WINDOWS)
  months?: AnalyticsMonthWindow;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  agentId?: string;
}
