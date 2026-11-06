export interface AppError {
  code: string;
  status: number;
  message: string;
}

export const ErrorCodes = {
  PROJECT_NOT_FOUND: {
    code: "PROJECT_NOT_FOUND",
    status: 404,
    message: "The requested project is not registered.",
  },
  RELEASE_NOT_FOUND: {
    code: "RELEASE_NOT_FOUND",
    status: 404,
    message: "The requested release was not found.",
  },
  NO_RELEASES: {
    code: "NO_RELEASES",
    status: 404,
    message: "This project has no published releases.",
  },
  INVALID_VERSION: {
    code: "INVALID_VERSION",
    status: 400,
    message: "The provided version is not a valid semantic version.",
  },
  INVALID_CHANNEL: {
    code: "INVALID_CHANNEL",
    status: 400,
    message: "The requested channel is not supported.",
  },
  INVALID_CONFIGURATION: {
    code: "INVALID_CONFIGURATION",
    status: 500,
    message: "The project configuration is invalid.",
  },
  GITHUB_RATE_LIMITED: {
    code: "GITHUB_RATE_LIMITED",
    status: 429,
    message: "GitHub API rate limit has been exceeded. Please try again later.",
  },
  UPSTREAM_ERROR: {
    code: "UPSTREAM_ERROR",
    status: 502,
    message: "An error occurred while communicating with the GitHub API.",
  },
  INTERNAL_ERROR: {
    code: "INTERNAL_ERROR",
    status: 500,
    message: "An internal server error occurred.",
  },
} as const;

export type ErrorCode = keyof typeof ErrorCodes;

export class HttpError extends Error {
  public readonly code: string;
  public readonly status: number;

  constructor(code: ErrorCode) {
    const def = ErrorCodes[code];
    super(def.message);
    this.name = "HttpError";
    this.code = def.code;
    this.status = def.status;
  }

  public static for(code: ErrorCode): HttpError {
    return new HttpError(code);
  }
}

export function isHttpError(error: unknown): error is HttpError {
  return error instanceof HttpError;
}

export function errorResponse(code: string, message: string, status: number): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: { code, message },
    }),
    {
      status,
      headers: { "Content-Type": "application/json" },
    },
  );
}

export function jsonResponse(data: unknown, status = 200, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}
