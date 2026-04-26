export class AppError extends Error {
  status: number;
  code: string;
  details?: Record<string, unknown>;

  constructor(input: {
    message: string;
    status: number;
    code: string;
    details?: Record<string, unknown>;
  }) {
    super(input.message);
    this.name = "AppError";
    this.status = input.status;
    this.code = input.code;
    this.details = input.details;
  }
}

export function isAppError(error: unknown): error is AppError {
  if (!error || typeof error !== "object") {
    return false;
  }
  return (
    "status" in error &&
    typeof (error as { status?: unknown }).status === "number" &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  );
}

export function toAppErrorResponse(error: AppError) {
  return {
    error: error.code,
    message: error.message,
    ...(error.details || {}),
  };
}
