import { Readable } from "node:stream";
import { getSyntheticUser } from "../synthetic/scenarios";

export function createJsonRequest(
  body: unknown,
  options: {
    method?: string;
    url?: string;
    headers?: Record<string, string>;
  } = {}
) {
  const payload = body == null ? "" : JSON.stringify(body);
  const req = Readable.from(payload ? [payload] : []) as Readable & {
    method: string;
    url: string;
    headers: Record<string, string>;
  };
  req.method = options.method || "POST";
  req.url = options.url || "/";
  req.headers = options.headers || {};
  return req as any;
}

export function createAuthedRequest(
  userKey: Parameters<typeof getSyntheticUser>[0],
  body: unknown,
  options: {
    method?: string;
    url?: string;
    headers?: Record<string, string>;
  } = {}
) {
  const user = getSyntheticUser(userKey);
  return createJsonRequest(body, {
    ...options,
    headers: {
      ...(options.headers || {}),
      "x-demo-user-id": user.userId,
      "x-demo-role-type": user.roleType,
      "x-demo-email": user.email,
    },
  });
}

export function createResponse() {
  let body = "";
  const headers = new Map<string, string>();
  const res = {
    statusCode: 200,
    setHeader(name: string, value: string) {
      headers.set(name.toLowerCase(), value);
    },
    end(chunk?: string) {
      body = chunk || "";
    },
  } as any;

  return {
    res,
    headers,
    get statusCode() {
      return res.statusCode;
    },
    get json() {
      return body ? JSON.parse(body) : null;
    },
    get text() {
      return body;
    },
  };
}
