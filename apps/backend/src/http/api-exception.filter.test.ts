import assert from "node:assert/strict";
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

async function main(): Promise<void> {
  const filter = new ApiExceptionFilter();

  {
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

    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.body, {
      ok: false,
      statusCode: 400,
      error: "Bad Request",
      message: ["code should not be empty"],
      path: "/api/test",
      timestamp: (response.body as { timestamp: string }).timestamp,
      requestId: "req-test-123",
      categoryKey: "group",
    });
    assert.match(String((response.body as { timestamp: string }).timestamp), /^\d{4}-\d{2}-\d{2}T/);
  }

  {
    const response: MockResponse = {};
    filter.catch(new Error("Boom"), createHost(response, { originalUrl: "/api/boom" }) as never);

    assert.equal(response.statusCode, 500);
    assert.deepEqual(response.body, {
      ok: false,
      statusCode: 500,
      error: "Internal Server Error",
      message: "Boom",
      path: "/api/boom",
      timestamp: (response.body as { timestamp: string }).timestamp,
      requestId: "req-test-123",
    });
    assert.match(String((response.body as { timestamp: string }).timestamp), /^\d{4}-\d{2}-\d{2}T/);
  }
}

void main();
