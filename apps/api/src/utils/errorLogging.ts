import { isAppError } from "./appError";

export function shouldLogServerError(error: unknown): boolean {
  if (isAppError(error)) {
    return error.status >= 500;
  }
  return true;
}
