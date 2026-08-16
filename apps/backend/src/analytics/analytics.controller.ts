import { Controller, Get, Header, Query } from "@nestjs/common";
import { AnalyticsService } from "./analytics.service";
import { AnalyticsQueryDto } from "./dto/analytics-query.dto";

@Controller("analytics")
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get("operational")
  @Header("Cache-Control", "private, no-store")
  operational(@Query() query: AnalyticsQueryDto) {
    return this.analytics.operational(query);
  }

  @Get("visa")
  @Header("Cache-Control", "private, no-store")
  visa(@Query() query: AnalyticsQueryDto) {
    return this.analytics.visa(query);
  }

  @Get("agents")
  @Header("Cache-Control", "private, no-store")
  agents(@Query() query: AnalyticsQueryDto) {
    return this.analytics.agents(query);
  }
}
