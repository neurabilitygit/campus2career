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
  return error instanceof AppError;
}

export function toAppErrorResponse(error: AppError) {
  return {
    error: error.code,
    message: error.message,
    ...(error.details || {}),
  };
}
