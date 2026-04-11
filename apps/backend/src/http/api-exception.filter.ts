import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";

type HttpExceptionResponseRecord = Record<string, unknown>;

type ErrorResponsePayload = {
  ok: false;
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
  requestId?: string;
} & Record<string, unknown>;

function toTitleCaseFromExceptionName(value: string): string {
  return value
    .replace(/Exception$/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim() || "Error";
}

function resolveErrorLabel(exception: unknown, statusCode: number, responseBody?: unknown): string {
  if (responseBody && typeof responseBody === "object" && !Array.isArray(responseBody)) {
    const error = (responseBody as { error?: unknown }).error;
    if (typeof error === "string" && error.trim()) {
      return error.trim();
    }
  }

  if (exception instanceof HttpException) {
    return toTitleCaseFromExceptionName(exception.name);
  }

  const statusLabel = HttpStatus[statusCode];
  if (typeof statusLabel === "string" && statusLabel.trim()) {
    return statusLabel
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/\b\w/g, (character) => character.toUpperCase());
  }

  return "Internal Server Error";
}

function resolveMessage(
  exception: unknown,
  statusCode: number,
  responseBody?: unknown,
): string | string[] {
  if (typeof responseBody === "string" && responseBody.trim()) {
    return responseBody.trim();
  }

  if (responseBody && typeof responseBody === "object" && !Array.isArray(responseBody)) {
    const message = (responseBody as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }

    if (Array.isArray(message)) {
      const normalizedMessages = message
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean);
      if (normalizedMessages.length > 0) {
        return normalizedMessages;
      }
    }
  }

  if (exception instanceof Error && exception.message.trim()) {
    return exception.message.trim();
  }

  if (statusCode === HttpStatus.INTERNAL_SERVER_ERROR) {
    return "Unexpected internal server error.";
  }

  return "Request failed.";
}

function extractExtraFields(responseBody?: unknown): HttpExceptionResponseRecord {
  if (!responseBody || typeof responseBody !== "object" || Array.isArray(responseBody)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(responseBody as HttpExceptionResponseRecord).filter(
      ([key]) =>
        key !== "ok" &&
        key !== "statusCode" &&
        key !== "error" &&
        key !== "message" &&
        key !== "path" &&
        key !== "timestamp" &&
        key !== "requestId",
    ),
  );
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const httpHost = host.switchToHttp();
    const request = httpHost.getRequest<{
      id?: string | number;
      url?: string;
      originalUrl?: string;
      headers?: Record<string, unknown>;
    }>();
    const response = httpHost.getResponse<{
      status: (statusCode: number) => {
        json: (body: ErrorResponsePayload) => void;
      };
    }>();

    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const responseBody = exception instanceof HttpException ? exception.getResponse() : undefined;
    const timestamp = new Date().toISOString();
    const requestId =
      typeof request.id === "string" || typeof request.id === "number"
        ? String(request.id)
        : undefined;
    const path = request.originalUrl ?? request.url ?? "";
    const payload: ErrorResponsePayload = {
      ok: false,
      statusCode,
      error: resolveErrorLabel(exception, statusCode, responseBody),
      message: resolveMessage(exception, statusCode, responseBody),
      path,
      timestamp,
      ...(requestId ? { requestId } : {}),
      ...extractExtraFields(responseBody),
    };

    response.status(statusCode).json(payload);
  }
}
