import type { ServerResponse } from "node:http";

export function json(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body, null, 2));
}

export function unauthorized(res: ServerResponse) {
  return json(res, 401, { error: "unauthorized" });
}

export function badRequest(res: ServerResponse, message: string) {
  return json(res, 400, { error: "bad_request", message });
}

export function forbidden(res: ServerResponse, message: string) {
  return json(res, 403, { error: "forbidden", message });
}
