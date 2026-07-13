import { describe, expect } from "vitest";
import { runCase } from "../test/run-case";
import { BadRequestException } from "@nestjs/common";
import { ApiExceptionFilter } from "./api-exception.filter";

type MockResponse = {
  statusCode?: number;
  body?: unknown;
};

function createHost(response: MockResponse, requestOverrides?: Record<string, unknown>) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        id: "req-test-123",
        originalUrl: "/api/test",
        ...requestOverrides,
      }),
      getResponse: () => ({
        status: (statusCode: number) => {
          response.statusCode = statusCode;
          return {
            json: (body: unknown) => {
              response.body = body;
            },
          };
        },
      }),
    }),
  };
}

describe("ApiExceptionFilter", () => {
  runCase("handles bad request exception with categoryKey", () => {
    const filter = new ApiExceptionFilter();
    const response: MockResponse = {};
    filter.catch(
      new BadRequestException({
        message: ["code should not be empty"],
        error: "Bad Request",
        statusCode: 400,
        categoryKey: "group",
      }),
      createHost(response) as never,
    );

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      ok: false,
      statusCode: 400,
      error: "Bad Request",
      message: ["code should not be empty"],
      path: "/api/test",
      timestamp: (response.body as { timestamp: string }).timestamp,
      requestId: "req-test-123",
      categoryKey: "group",
    });
    expect(String((response.body as { timestamp: string }).timestamp)).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  runCase("handles generic error as 500", () => {
    const filter = new ApiExceptionFilter();
    const response: MockResponse = {};
    filter.catch(new Error("Boom"), createHost(response, { originalUrl: "/api/boom" }) as never);

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({
      ok: false,
      statusCode: 500,
      error: "Internal Server Error",
      message: "Boom",
      path: "/api/boom",
      timestamp: (response.body as { timestamp: string }).timestamp,
      requestId: "req-test-123",
    });
    expect(String((response.body as { timestamp: string }).timestamp)).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
